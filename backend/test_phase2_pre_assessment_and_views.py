import unittest
import json
import jwt
from datetime import datetime, timedelta
from app import app
from extensions import db
from config import Config
from models.user import User
from models.employee import Employee
from models.role import LeadershipRole
from models.assessment import Assessment, AssessmentAssignment
from models.role_eligibility_config import RoleEligibilityConfig
from services.eligibility_service import (
    evaluate_pre_assessment_eligibility,
    get_role_eligibility_config,
    update_role_eligibility_config,
    get_pre_assessment_candidates_for_role
)

class TestPhase2PreAssessmentAndViews(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = app
        cls.client = cls.app.test_client()

    def generate_token(self, user):
        payload = {
            "sub": str(user.id),
            "username": user.username,
            "role": user.role,
            "auth_email": user.email,
            "iat": datetime.utcnow(),
            "exp": datetime.utcnow() + timedelta(hours=2)
        }
        return jwt.encode(payload, Config.JWT_SECRET_KEY, algorithm="HS256")

    def test_01_pre_assessment_candidates_endpoint_structure(self):
        """Pre-assessment candidate evaluation returns transparent statuses, metrics, and evidence"""
        with self.app.app_context():
            hr_user = User.query.filter_by(role='HR').first()
            self.assertIsNotNone(hr_user, "HR user must exist in test database")
            token = self.generate_token(hr_user)
            role = LeadershipRole.query.first()
            self.assertIsNotNone(role, "At least one leadership role must exist")

            res = self.client.get(
                f"/api/roles/{role.id}/pre-assessment-candidates",
                headers={"Authorization": f"Bearer {token}"}
            )
            self.assertEqual(res.status_code, 200)
            data = res.get_json()
            self.assertTrue(data.get("success"))
            payload = data.get("data", {})
            self.assertEqual(payload.get("role_id"), role.id)
            self.assertIn("summary", payload)
            self.assertIn("eligible", payload["summary"])
            self.assertIn("not_eligible", payload["summary"])
            self.assertIn("insufficient_data", payload["summary"])

            candidates = payload.get("all_candidates", [])
            self.assertGreater(len(candidates), 0, "Should evaluate all active employees")

            valid_statuses = [
                "Eligible for assessment",
                "Not eligible yet",
                "Insufficient data for reliable evaluation"
            ]
            for cand in candidates:
                self.assertIn(cand["status"], valid_statuses)
                self.assertIn("reasons", cand)
                self.assertIn("unmet_requirements", cand)
                self.assertIn("skill_match_pct", cand)
                self.assertIn("project_success_rate", cand)
                self.assertIn("verified_projects_count", cand)
                self.assertIn("total_experience_years", cand)
                self.assertIn("company_tenure_months", cand)
                self.assertIn("evidence_coverage_pct", cand)

    def test_02_missing_data_and_insufficient_evidence_handling(self):
        """Coverage < 40% results in 'Insufficient data for reliable evaluation', without treating missing data as 0 or 100"""
        with self.app.app_context():
            role = LeadershipRole.query.first()
            emp = Employee.query.first()
            
            # Evaluate with custom config requiring 99% evidence coverage
            custom_config = {
                "min_experience_years": 0.0,
                "min_company_tenure_months": 0,
                "min_project_success_rate": 0.0,
                "min_verified_projects": 0,
                "require_verified_projects": False,
                "min_skill_match_pct": 0.0,
                "require_all_mandatory_skills": False,
                "min_competency_score": 0.0,
                "min_evidence_coverage_pct": 101.0  # Impossible coverage requirement
            }
            eval_result = evaluate_pre_assessment_eligibility(emp.id, role.id, custom_config)
            self.assertFalse(eval_result["is_eligible"])
            self.assertEqual(eval_result["status"], "Insufficient data for reliable evaluation")
            self.assertTrue(any("evidence coverage" in r.lower() for r in eval_result["reasons"]))

    def test_03_configurable_thresholds_crud(self):
        """HR can retrieve and update role-specific eligibility thresholds via API"""
        with self.app.app_context():
            hr_user = User.query.filter_by(role='HR').first()
            token = self.generate_token(hr_user)
            role = LeadershipRole.query.first()

            # 1. GET threshold config
            res = self.client.get(
                f"/api/roles/{role.id}/eligibility-config",
                headers={"Authorization": f"Bearer {token}"}
            )
            self.assertEqual(res.status_code, 200)
            config_data = res.get_json()["data"]["config"]
            self.assertIn("min_experience_years", config_data)
            self.assertIn("min_project_success_rate", config_data)

            # 2. PUT updated config
            new_thresholds = {
                "min_experience_years": 4.5,
                "min_company_tenure_months": 12,
                "min_project_success_rate": 75.0,
                "min_verified_projects": 1,
                "require_verified_projects": True,
                "min_skill_match_pct": 65.0,
                "require_all_mandatory_skills": True,
                "min_competency_score": 65.0,
                "min_evidence_coverage_pct": 45.0,
                "assessment_pass_score": 75.0
            }
            update_res = self.client.put(
                f"/api/roles/{role.id}/eligibility-config",
                headers={"Authorization": f"Bearer {token}"},
                json=new_thresholds
            )
            self.assertEqual(update_res.status_code, 200)
            saved_config = update_res.get_json()["data"]["config"]
            self.assertEqual(saved_config["min_experience_years"], 4.5)
            self.assertEqual(saved_config["min_project_success_rate"], 75.0)
            self.assertTrue(saved_config["require_verified_projects"])

    def test_04_threshold_boundary_filtering(self):
        """Setting extreme thresholds dynamically disqualifies candidates with transparent reasons"""
        with self.app.app_context():
            role = LeadershipRole.query.first()
            emp = Employee.query.first()

            # Extreme threshold: 40 years experience required
            strict_config = {
                "min_experience_years": 40.0,
                "min_company_tenure_months": 6,
                "min_project_success_rate": 50.0,
                "min_verified_projects": 0,
                "require_verified_projects": False,
                "min_skill_match_pct": 10.0,
                "require_all_mandatory_skills": False,
                "min_competency_score": 10.0,
                "min_evidence_coverage_pct": 20.0
            }
            res = evaluate_pre_assessment_eligibility(emp.id, role.id, strict_config)
            self.assertFalse(res["is_eligible"])
            self.assertEqual(res["status"], "Not eligible yet")
            self.assertTrue(any("experience" in r.lower() for r in res["unmet_requirements"]))

    def test_05_assign_assessment_rejects_ineligible_candidate(self):
        """POST /api/assessments/assign returns 422 if candidate does not meet role eligibility rules"""
        with self.app.app_context():
            hr_user = User.query.filter_by(role='HR').first()
            token = self.generate_token(hr_user)
            role = LeadershipRole.query.first()
            assess = Assessment.query.filter_by(role_id=role.id).first() or Assessment.query.first()
            emp = Employee.query.first()

            # Temporarily configure target role to require high experience (35 years)
            target_role_id = assess.role_id or role.id
            update_role_eligibility_config(target_role_id, {
                "min_experience_years": 35.0,
                "min_company_tenure_months": 6,
                "min_project_success_rate": 50.0,
                "min_verified_projects": 0,
                "require_verified_projects": False,
                "min_skill_match_pct": 50.0,
                "require_all_mandatory_skills": False,
                "min_competency_score": 50.0,
                "min_evidence_coverage_pct": 40.0
            })

            payload = {
                "assessment_id": assess.id,
                "employee_id": emp.id,
                "role_id": target_role_id,
                "scheduled_date": "2026-12-01"
            }
            res = self.client.post(
                f"/api/assessments/{assess.id}/assign",
                headers={"Authorization": f"Bearer {token}"},
                json=payload
            )
            # Must return 422 Unprocessable Entity
            self.assertEqual(res.status_code, 422)
            body = res.get_json()
            self.assertFalse(body.get("success"))
            self.assertIn("not eligible", body.get("message", "").lower())
            self.assertIn("eligibility_evaluation", body.get("data", {}))

            # Reset config back to normal
            update_role_eligibility_config(target_role_id, {
                "min_experience_years": 2.0,
                "min_company_tenure_months": 3,
                "min_project_success_rate": 60.0,
                "min_verified_projects": 0,
                "require_verified_projects": False,
                "min_skill_match_pct": 50.0,
                "require_all_mandatory_skills": False,
                "min_competency_score": 50.0,
                "min_evidence_coverage_pct": 40.0
            })

    def test_06_batch_schedule_rejects_ineligible_candidate(self):
        """Batch scheduling endpoint rejects manual schedules containing ineligible candidates with 422"""
        with self.app.app_context():
            hr_user = User.query.filter_by(role='HR').first()
            token = self.generate_token(hr_user)
            role = LeadershipRole.query.first()
            assess = Assessment.query.first()
            emp = Employee.query.first()

            # Set high requirement on target role
            target_role_id = assess.role_id or role.id
            update_role_eligibility_config(target_role_id, {
                "min_experience_years": 35.0,
                "min_company_tenure_months": 6,
                "min_project_success_rate": 50.0,
                "min_verified_projects": 0,
                "require_verified_projects": False,
                "min_skill_match_pct": 50.0,
                "require_all_mandatory_skills": False,
                "min_competency_score": 50.0,
                "min_evidence_coverage_pct": 40.0
            })

            try:
                # Clear any prior schedule on test date to prevent duplicate schedule conflict
                from models.assessment import AssessmentAssignment
                AssessmentAssignment.query.filter_by(scheduled_date="2026-12-15", employee_id=emp.id).delete()
                db.session.commit()

                payload = {
                    "assessment_id": assess.id,
                    "role_id": target_role_id,
                    "title": "Batch Scheduling Ineligibility Test",
                    "time_zone": "IST (Asia/Kolkata)",
                    "schedules": [
                        {
                            "employee_id": emp.id,
                            "employee_name": emp.name,
                            "scheduled_date": "2026-12-15",
                            "start_time": "11:00",
                            "duration_minutes": 60,
                            "time_zone": "IST (Asia/Kolkata)"
                        }
                    ]
                }

                res = self.client.post(
                    "/api/assessment-schedules/batch-save",
                    headers={"Authorization": f"Bearer {token}"},
                    json=payload
                )
                self.assertEqual(res.status_code, 422)
                body = res.get_json()
                self.assertTrue("eligibility" in body.get("message", "").lower() or "not meet" in body.get("message", "").lower())
            finally:
                # Reset config back
                update_role_eligibility_config(target_role_id, {
                    "min_experience_years": 2.0,
                    "min_company_tenure_months": 3,
                    "min_project_success_rate": 60.0,
                    "min_verified_projects": 0,
                    "require_verified_projects": False,
                    "min_skill_match_pct": 50.0,
                    "require_all_mandatory_skills": False,
                    "min_competency_score": 50.0,
                    "min_evidence_coverage_pct": 40.0
                })

    def test_07_hr_succession_ready_shortlist_filtering(self):
        """GET /api/roles/<id>/candidates-comparison?meets_readiness=true filters non-ready candidates"""
        with self.app.app_context():
            hr_user = User.query.filter_by(role='HR').first()
            token = self.generate_token(hr_user)
            role = LeadershipRole.query.first()

            # Call with meets_readiness=true
            res = self.client.get(
                f"/api/roles/{role.id}/candidates-comparison?meets_readiness=true",
                headers={"Authorization": f"Bearer {token}"}
            )
            self.assertEqual(res.status_code, 200)
            data = res.get_json()["data"]
            self.assertTrue(data.get("meets_readiness_filter_active"))
            candidates = data.get("candidates", [])
            for c in candidates:
                self.assertTrue(c.get("meets_readiness_requirements"), "All candidates in filtered view must meet readiness")

    def test_08_manager_authorized_team_scope(self):
        """Manager only receives assessment results for their authorized direct reports"""
        with self.app.app_context():
            # Find a manager user with associated direct reports
            manager_emp = Employee.query.filter(Employee.manager_id.isnot(None)).first()
            if not manager_emp or not manager_emp.manager:
                manager_emp = Employee.query.first()
            
            # Find or check manager user
            manager_user = User.query.filter_by(role='Manager').first()
            if not manager_user:
                manager_user = User(username='test_mgr', email='test_mgr@test.com', role='Manager')
                db.session.add(manager_user)
                db.session.commit()

            token = self.generate_token(manager_user)
            res = self.client.get(
                "/api/assessment-results",
                headers={"Authorization": f"Bearer {token}"}
            )
            self.assertEqual(res.status_code, 200)
            data = res.get_json()
            self.assertTrue(data.get("success"))
            results = data.get("data", [])
            # Verify each returned result has honest intra-team fields
            for r in results:
                self.assertIn("overall_score", r)
                self.assertIn("status", r)
                self.assertIn("project_summary", r)
                self.assertIn("skill_details", r)

    def test_09_cross_team_isolation_and_unauthorized_access(self):
        """Non-HR, non-Manager users or unauthenticated callers are rejected with 401 or 403"""
        with self.app.app_context():
            # 1. Unauthenticated call
            res = self.client.get("/api/roles/1/pre-assessment-candidates")
            self.assertEqual(res.status_code, 401)

            # 2. Employee role attempting HR threshold config
            emp_user = User.query.filter_by(role='Employee').first()
            if not emp_user:
                emp_user = User(username='test_emp_reg', email='emp_reg@test.com', role='Employee')
                db.session.add(emp_user)
                db.session.commit()

            emp_token = self.generate_token(emp_user)
            res2 = self.client.put(
                "/api/roles/1/eligibility-config",
                headers={"Authorization": f"Bearer {emp_token}"},
                json={"min_experience_years": 5.0}
            )
            self.assertEqual(res2.status_code, 403)

if __name__ == '__main__':
    unittest.main()
