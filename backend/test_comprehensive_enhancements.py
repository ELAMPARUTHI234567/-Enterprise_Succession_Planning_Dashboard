import unittest
import json
from datetime import datetime, timedelta, date
from app import create_app
from extensions import db
from models.user import User
from models.employee import Employee
from models.role import LeadershipRole
from models.competency import Competency
from models.assessment import Assessment, AssessmentAssignment, AssessmentQuestion, AssessmentResult
from models.employee_project import EmployeeProject
from models.employment_history import EmploymentHistory
from models.employee_skill import EmployeeSkill
from models.role_required_skill import RoleRequiredSkill
from models.suitability_config import SuitabilityConfig
from services.project_service import calculate_project_success_rate, get_employee_projects_summary
from services.experience_service import calculate_employee_experience, merge_overlapping_intervals, parse_date_safe
from services.skill_service import evaluate_employee_skill_gaps
from services.suitability_service import evaluate_leadership_suitability, compare_candidates_for_role
from services.scheduling_service import (
    calculate_end_time_str, check_scheduling_conflicts,
    validate_and_save_manual_schedules, check_assessment_start_permission
)
import jwt
from config import Config

class TestComprehensiveEnhancements(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = create_app()
        cls.app.config['TESTING'] = True
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

    # ==========================================
    # MODULE 1 TESTS: PROJECT EXPERIENCE & SUCCESS RATE
    # ==========================================
    def test_01_project_creation_and_editing(self):
        """1. Project creation and editing via model and REST API"""
        with self.app.app_context():
            emp = Employee.query.first()
            p = EmployeeProject(
                employee_id=emp.id,
                project_name="Test Automation Suite",
                status="Completed",
                milestones_completed_pct=90.0,
                deliverables_accepted_pct=85.0
            )
            p.set_technologies(["Python", "Flask"])
            db.session.add(p)
            db.session.commit()

            self.assertEqual(p.project_name, "Test Automation Suite")
            self.assertIn("Python", p.get_technologies())

            # Edit project
            p.project_name = "Enterprise Test Automation"
            db.session.commit()
            reloaded = EmployeeProject.query.get(p.id)
            self.assertEqual(reloaded.project_name, "Enterprise Test Automation")

            db.session.delete(p)
            db.session.commit()

    def test_02_project_success_calculation_and_missing_metrics(self):
        """2. Project success calculation formula and missing metrics handling"""
        # When metrics are provided:
        # Milestones: 100 * 0.25 = 25
        # Deliverables: 100 * 0.25 = 25
        # Timeline: 80 * 0.20 = 16
        # Quality: 90 * 0.15 = 13.5
        # Business: 90 * 0.15 = 13.5
        # Total = 25 + 25 + 16 + 13.5 + 13.5 = 93.0
        data = {
            'milestones_completed_pct': 100.0,
            'deliverables_accepted_pct': 100.0,
            'timeline_adherence_pct': 80.0,
            'quality_defect_score': 90.0,
            'business_goals_achieved_pct': 90.0
        }
        score = calculate_project_success_rate(data)
        self.assertEqual(score, 93.0)

        # When no valid metrics are provided, returns None ('Not evaluated'), NOT 100%
        empty_data = {'milestones_completed_pct': None, 'status': 'Completed'}
        none_score = calculate_project_success_rate(empty_data)
        self.assertIsNone(none_score)

    def test_03_verified_vs_self_reported_projects(self):
        """3. Distinguishes verified vs self-reported project results"""
        with self.app.app_context():
            emp = Employee.query.first()
            p1 = EmployeeProject(
                employee_id=emp.id,
                project_name="Verified Platform",
                milestones_completed_pct=90.0,
                deliverables_accepted_pct=90.0,
                success_rate=90.0,
                verification_status="HR-Verified"
            )
            p2 = EmployeeProject(
                employee_id=emp.id,
                project_name="Self Reported Tool",
                milestones_completed_pct=70.0,
                deliverables_accepted_pct=70.0,
                success_rate=70.0,
                verification_status="Self-Reported"
            )
            db.session.add_all([p1, p2])
            db.session.commit()

            summary = get_employee_projects_summary(emp.id)
            self.assertGreaterEqual(summary["verified_projects_count"], 1)
            self.assertIsNotNone(summary["average_verified_success_rate"])

            db.session.delete(p1)
            db.session.delete(p2)
            db.session.commit()

    # ==========================================
    # MODULE 2 TESTS: COMPANY & EMPLOYMENT EXPERIENCE
    # ==========================================
    def test_04_company_tenure_calculation(self):
        """4. Company tenure calculation from joining date"""
        with self.app.app_context():
            emp = Employee.query.first()
            emp.company_joining_date = "2022-01-15"
            db.session.commit()

            tenure = emp.calculate_company_tenure_years()
            self.assertGreater(tenure, 2.0)

    def test_05_prevention_of_overlapping_employment_double_counting(self):
        """5. Overlapping employment periods are merged and NOT double-counted"""
        # Overlapping intervals:
        # Job A: 2020-01-01 to 2021-06-30 (1.5 years)
        # Job B: 2020-06-01 to 2022-01-01 (1.5 years)
        # Without merging = 3.0 years
        # Merged range: 2020-01-01 to 2022-01-01 = 2.0 years (731 days)
        d1 = date(2020, 1, 1)
        d2 = date(2021, 6, 30)
        d3 = date(2020, 6, 1)
        d4 = date(2022, 1, 1)

        merged = merge_overlapping_intervals([(d1, d2), (d3, d4)])
        self.assertEqual(len(merged), 1)
        self.assertEqual(merged[0][0], d1)
        self.assertEqual(merged[0][1], d4)
        total_days = (merged[0][1] - merged[0][0]).days
        years = round(total_days / 365.25, 2)
        self.assertEqual(years, 2.0)

    # ==========================================
    # MODULE 3 TESTS: SKILLS & COMPETENCY GAPS
    # ==========================================
    def test_06_skill_proficiency_and_gap_calculation(self):
        """6. Required-skill gap analysis (Required: 4, Actual: 3 -> Gap: 1)"""
        with self.app.app_context():
            role = LeadershipRole.query.first()
            emp = Employee.query.first()

            # Add required skill
            req = RoleRequiredSkill(
                role_id=role.id,
                skill_name="Python",
                category="Programming Language",
                min_proficiency_level=4
            )
            # Add employee skill
            es = EmployeeSkill(
                employee_id=emp.id,
                skill_name="Python",
                category="Programming Language",
                proficiency_level=3,
                verification_status="Self-Reported"
            )
            db.session.add_all([req, es])
            db.session.commit()

            gap_res = evaluate_employee_skill_gaps(emp.id, role.id)
            self.assertIsNotNone(gap_res)

            below_items = [s for s in gap_res["skills_below_requirement"] if s["skill_name"] == "Python"]
            self.assertEqual(len(below_items), 1)
            self.assertEqual(below_items[0]["gap"], 1)
            self.assertIn("Python", [s["skill_name"] for s in gap_res["skills_needing_assessment"]])

            db.session.delete(req)
            db.session.delete(es)
            db.session.commit()

    # ==========================================
    # MODULE 4 TESTS: SUITABILITY & WEIGHTS
    # ==========================================
    def test_07_configurable_weights_sum_to_100(self):
        """7. Configurable weights must sum to 100%"""
        with self.app.app_context():
            cfg = SuitabilityConfig.get_active_config()
            self.assertTrue(cfg.validate_weights())

            # Attempt invalid weight sum
            cfg.assessment_weight = 50.0  # Sum is now 120
            self.assertFalse(cfg.validate_weights())

            # Reset back to valid
            cfg.assessment_weight = 30.0
            db.session.commit()

    def test_08_suitability_score_calculation_and_missing_data(self):
        """8. Suitability score calculation & missing data policy"""
        with self.app.app_context():
            emp = Employee.query.first()
            role = LeadershipRole.query.first()

            eval_res = evaluate_leadership_suitability(emp.id, role.id)
            self.assertIsNotNone(eval_res)
            self.assertIn("evidence_coverage_pct", eval_res)
            self.assertIn("criteria_scores", eval_res)

    def test_09_candidate_comparison_authorization(self):
        """9. Candidate comparison requires HR/Admin/Manager authorization"""
        with self.app.app_context():
            role = LeadershipRole.query.first()
            res = self.client.get(f"/api/roles/{role.id}/candidates-comparison")
            # Unauthenticated -> 401
            self.assertEqual(res.status_code, 401)

            # HR authenticated
            hr_user = User.query.filter_by(role='HR').first()
            token = self.generate_token(hr_user)
            res_auth = self.client.get(
                f"/api/roles/{role.id}/candidates-comparison",
                headers={"Authorization": f"Bearer {token}"}
            )
            self.assertEqual(res_auth.status_code, 200)
            json_data = res_auth.get_json()
            self.assertTrue(json_data["success"])
            self.assertIn("candidates", json_data["data"])

    # ==========================================
    # MODULE 5 TESTS: HR MANUAL SCHEDULING (CRITICAL)
    # ==========================================
    def test_10_hr_manually_assigns_dates_times_durations(self):
        """10. HR manually assigns date, start time, and duration; end time is calculated"""
        st = "10:00"
        dur = 45
        end_time = calculate_end_time_str(st, dur)
        self.assertEqual(end_time, "10:45")

    def test_11_scheduling_10_employees_without_automatic_assignment(self):
        """11. Scheduling 10 employees requires explicit date, time, and duration for each"""
        with self.app.app_context():
            assess = Assessment.query.first()
            hr_user = User.query.filter_by(role='HR').first()
            employees = Employee.query.limit(10).all()

            # Clean up any previous test assignments for this test date so tests are idempotent
            AssessmentAssignment.query.filter_by(scheduled_date="2026-11-15").delete()
            db.session.commit()

            schedules_batch = []
            for idx, emp in enumerate(employees):
                schedules_batch.append({
                    "employee_id": emp.id,
                    "employee_name": emp.name,
                    "scheduled_date": "2026-11-15",
                    "start_time": f"{9 + idx // 2:02d}:{(idx % 2) * 30:02d}",
                    "duration_minutes": 45,
                    "time_zone": "UTC"
                })

            saved, err, code = validate_and_save_manual_schedules(assess.id, schedules_batch, hr_user.id)
            self.assertIsNone(err)
            self.assertEqual(len(saved), len(employees))

            # Clean up after test
            AssessmentAssignment.query.filter_by(scheduled_date="2026-11-15").delete()
            db.session.commit()

    def test_12_incomplete_schedule_cannot_be_saved(self):
        """12. Incomplete schedule (missing date or time or duration) cannot be saved"""
        with self.app.app_context():
            assess = Assessment.query.first()
            hr_user = User.query.filter_by(role='HR').first()
            emp = Employee.query.first()

            incomplete = [{
                "employee_id": emp.id,
                "employee_name": emp.name,
                "scheduled_date": "2026-11-20",
                "start_time": "",  # Missing start time!
                "duration_minutes": 30
            }]

            saved, err, code = validate_and_save_manual_schedules(assess.id, incomplete, hr_user.id)
            self.assertIsNotNone(err)
            self.assertEqual(code, 400)
            self.assertIn("Incomplete schedule", err)

    def test_13_scheduling_conflicts_detected(self):
        """13. Overlapping schedules for same employee are detected and rejected"""
        with self.app.app_context():
            assess = Assessment.query.first()
            hr_user = User.query.filter_by(role='HR').first()
            emp = Employee.query.first()

            conflicting_batch = [
                {
                    "employee_id": emp.id,
                    "employee_name": emp.name,
                    "scheduled_date": "2026-11-25",
                    "start_time": "14:00",
                    "duration_minutes": 60  # Ends 15:00
                },
                {
                    "employee_id": emp.id,
                    "employee_name": emp.name,
                    "scheduled_date": "2026-11-25",
                    "start_time": "14:30",  # Overlaps!
                    "duration_minutes": 30
                }
            ]

            saved, err, code = validate_and_save_manual_schedules(assess.id, conflicting_batch, hr_user.id)
            self.assertIsNotNone(err)
            self.assertEqual(code, 409)
            self.assertIn("Conflict", err)

    def test_14_employees_cannot_view_another_employees_schedule(self):
        """14. Employees can only view their own assessment schedules"""
        with self.app.app_context():
            emp_user1 = User.query.filter_by(role='Employee').first()
            emp_rec1 = Employee.query.filter_by(user_id=emp_user1.id).first()
            emp_rec2 = Employee.query.filter(Employee.id != emp_rec1.id).first()

            token = self.generate_token(emp_user1)

            res = self.client.get("/api/assessment-schedules", headers={"Authorization": f"Bearer {token}"})
            self.assertEqual(res.status_code, 200)
            schedules = res.get_json()["data"]

            # All returned schedules MUST belong to emp_rec1
            for sc in schedules:
                self.assertEqual(sc["employee_id"], emp_rec1.id)

    def test_15_backend_timing_window_enforcement(self):
        """15. Assessment cannot be started before the permitted time or after expiration"""
        with self.app.app_context():
            assess = Assessment.query.first()
            emp = Employee.query.first()

            future_start = datetime.utcnow() + timedelta(days=2)
            future_end = future_start + timedelta(minutes=45)

            assignment = AssessmentAssignment(
                assessment_id=assess.id,
                employee_id=emp.id,
                scheduled_date=future_start.strftime("%Y-%m-%d"),
                start_time=future_start.strftime("%H:%M"),
                duration_minutes=45,
                scheduled_start_datetime=future_start,
                scheduled_end_datetime=future_end,
                status="Scheduled",
                schedule_status="Scheduled"
            )
            db.session.add(assignment)
            db.session.commit()

            # Attempt to start future assessment -> Rejected (not open yet)
            can_start, msg, code = check_assessment_start_permission(assignment, current_user_employee_id=emp.id)
            self.assertFalse(can_start)
            self.assertEqual(code, 403)
            self.assertIn("Assessment window is not open yet", msg)

            # Test expired assessment
            past_start = datetime.utcnow() - timedelta(days=2)
            past_end = past_start + timedelta(minutes=45)
            assignment.scheduled_start_datetime = past_start
            assignment.scheduled_end_datetime = past_end
            db.session.commit()

            can_start_exp, msg_exp, code_exp = check_assessment_start_permission(assignment, current_user_employee_id=emp.id)
            self.assertFalse(can_start_exp)
            self.assertEqual(code_exp, 403)
            self.assertIn("expired", msg_exp.lower())

            db.session.delete(assignment)
            db.session.commit()

    def test_16_reschedule_and_cancel_assessment(self):
        """16. HR can reschedule and cancel assignments"""
        with self.app.app_context():
            assess = Assessment.query.first()
            emp = Employee.query.first()
            hr_user = User.query.filter_by(role='HR').first()
            token = self.generate_token(hr_user)

            assignment = AssessmentAssignment(
                assessment_id=assess.id,
                employee_id=emp.id,
                scheduled_date="2026-11-20",
                start_time="11:00",
                duration_minutes=30,
                status="Scheduled"
            )
            db.session.add(assignment)
            db.session.commit()

            # Reschedule
            res = self.client.put(
                f"/api/assessment-schedules/{assignment.id}/reschedule",
                headers={"Authorization": f"Bearer {token}"},
                json={
                    "scheduled_date": "2026-11-21",
                    "start_time": "15:00",
                    "duration_minutes": 60
                }
            )
            self.assertEqual(res.status_code, 200)
            reloaded = AssessmentAssignment.query.get(assignment.id)
            self.assertEqual(reloaded.scheduled_date, "2026-11-21")
            self.assertEqual(reloaded.start_time, "15:00")
            self.assertEqual(reloaded.end_time, "16:00")

            # Cancel
            res_cancel = self.client.post(
                f"/api/assessment-schedules/{assignment.id}/cancel",
                headers={"Authorization": f"Bearer {token}"},
                json={"reason": "Operational reschedule required"}
            )
            self.assertEqual(res_cancel.status_code, 200)
            reloaded_c = AssessmentAssignment.query.get(assignment.id)
            self.assertEqual(reloaded_c.schedule_status, "Cancelled")

            db.session.delete(assignment)
            db.session.commit()

if __name__ == '__main__':
    unittest.main()
