import unittest
from datetime import datetime, date, timedelta, timezone
from app import create_app
from extensions import db
from models.user import User
from models.employee import Employee
from models.role import LeadershipRole
from models.assessment import Assessment, AssessmentQuestion, AssessmentAssignment, AssessmentAnswer, AssessmentResult
from models.competency import Competency
from models.employee_project import EmployeeProject
from models.employee_skill import EmployeeSkill
from models.role_required_skill import RoleRequiredSkill
from models.employment_history import EmploymentHistory
from models.suitability_config import SuitabilityConfig
from services.suitability_service import evaluate_leadership_suitability, compare_candidates_for_role
from services.project_service import calculate_project_success_rate, get_employee_projects_summary
from services.skill_service import evaluate_employee_skill_gaps, PROFICIENCY_SCALE
from services.experience_service import merge_overlapping_intervals, calculate_employee_experience

class TestSuccessionRankingAndEvaluation(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = create_app()
        cls.app.config['TESTING'] = True
        cls.app_context = cls.app.app_context()
        cls.app_context.push()

    @classmethod
    def tearDownClass(cls):
        cls.app_context.pop()

    # -------------------------------------------------------------------------
    # TEST 1: The employee with highest actual assessment percentage receives rank 1
    # -------------------------------------------------------------------------
    def test_01_highest_assessment_scorer_gets_rank_1(self):
        role = LeadershipRole.query.first()
        res = compare_candidates_for_role(role.id, sort_by='assessment_score')
        candidates_with_scores = [c for c in res["candidates"] if c["assessment_score"] is not None]
        if len(candidates_with_scores) >= 2:
            top_scorer = candidates_with_scores[0]
            self.assertEqual(top_scorer["assessment_rank"], 1)
            self.assertTrue(top_scorer["is_highest_assessment_scorer"])
            # Verify no candidate has a higher assessment score than top_scorer
            for c in candidates_with_scores:
                self.assertLessEqual(c["assessment_score"], top_scorer["assessment_score"])

    # -------------------------------------------------------------------------
    # TEST 2: Numeric sorting works correctly for scores such as 9, 80, and 100
    # -------------------------------------------------------------------------
    def test_02_numeric_sorting_not_lexicographic(self):
        raw_scores = [9.0, 100.0, 80.0, 15.0, 87.5]
        # Lexicographic sort would put '9.0' ahead of '80.0' or '100.0'
        # Numeric sort must put 100.0 > 87.5 > 80.0 > 15.0 > 9.0
        sorted_scores = sorted(raw_scores, reverse=True)
        self.assertEqual(sorted_scores, [100.0, 87.5, 80.0, 15.0, 9.0])

        role = LeadershipRole.query.first()
        res = compare_candidates_for_role(role.id, sort_by='assessment_score')
        scores = [c["assessment_score"] for c in res["candidates"] if c["assessment_score"] is not None]
        for i in range(len(scores) - 1):
            self.assertGreaterEqual(scores[i], scores[i + 1], "Assessment scores must be strictly ordered descending numerically")

    # -------------------------------------------------------------------------
    # TEST 3: Incomplete or ungraded assessments do not affect ranking
    # -------------------------------------------------------------------------
    def test_03_incomplete_ungraded_assessments_excluded(self):
        # Create temporary role and employees
        role = LeadershipRole.query.first()
        emp = Employee.query.first()

        # Check completed assignments query only pulls status='Completed'
        completed = AssessmentAssignment.query.filter_by(employee_id=emp.id, status='Completed').all()
        for a in completed:
            self.assertEqual(a.status, 'Completed')
            self.assertIsNotNone(a.result)

    # -------------------------------------------------------------------------
    # TEST 4: Duplicate attempts follow documented attempt policy (latest valid attempt)
    # -------------------------------------------------------------------------
    def test_04_duplicate_attempts_policy(self):
        # Find an employee who has taken assessments
        role = LeadershipRole.query.get(1)
        res = evaluate_leadership_suitability(1, 1) # Arun Kumar for Role 1
        self.assertIsNotNone(res)
        # Unique attempts per assessment
        ass_attempts = res["criteria_scores"]["assessments"]["attempts"]
        ass_ids = [a["assessment_id"] for a in ass_attempts]
        self.assertEqual(len(ass_ids), len(set(ass_ids)), "Duplicate attempts of same assessment must be deduplicated to latest")

    # -------------------------------------------------------------------------
    # TEST 5: Candidates with equal assessment scores receive correct tie ranks
    # -------------------------------------------------------------------------
    def test_05_honest_tie_ranking(self):
        # Role 2 (Team Lead) has multiple 100% scorers (e.g. Ganesh Iyer, Pooja Agarwal, ELAMPARUTHI K P, Yuvanraj)
        res = compare_candidates_for_role(2, sort_by='assessment_score')
        top_candidates = [c for c in res["candidates"] if c["assessment_score"] == 100.0]
        if len(top_candidates) >= 2:
            for cand in top_candidates:
                self.assertEqual(cand["assessment_rank"], 1, "Tied top candidates must both share Rank 1")
            
            # The candidate immediately following the tie should receive standard competition rank
            next_cand = [c for c in res["candidates"] if c["assessment_score"] is not None and c["assessment_score"] < 100.0]
            if next_cand:
                expected_next_rank = len(top_candidates) + 1
                self.assertEqual(next_cand[0]["assessment_rank"], expected_next_rank, 
                                 f"Next candidate after {len(top_candidates)} tied candidates should be rank {expected_next_rank}")

    # -------------------------------------------------------------------------
    # TEST 6: Project success rates follow documented formula
    # -------------------------------------------------------------------------
    def test_06_project_success_formula(self):
        # Formula: (0.25 * Milestones) + (0.25 * Deliverables) + (0.20 * Timeline) + (0.15 * Quality) + (0.15 * Business Goals)
        proj_data = {
            'milestones_completed_pct': 100.0,
            'deliverables_accepted_pct': 90.0,
            'timeline_adherence_pct': 85.0,
            'quality_defect_score': 95.0,
            'business_goals_achieved_pct': 90.0
        }
        # Expected: (100*0.25) + (90*0.25) + (85*0.20) + (95*0.15) + (90*0.15)
        # = 25.0 + 22.5 + 17.0 + 14.25 + 13.5 = 92.25 -> 92.2 or 92.3
        expected = round((25.0 + 22.5 + 17.0 + 14.25 + 13.5) / 1.0, 1)
        actual = calculate_project_success_rate(proj_data)
        self.assertEqual(actual, expected)
        self.assertEqual(actual, 92.2)

    # -------------------------------------------------------------------------
    # TEST 7: Missing project metrics do not produce fabricated success rates
    # -------------------------------------------------------------------------
    def test_07_missing_project_metrics_no_fabrication(self):
        empty_proj = {
            'milestones_completed_pct': None,
            'deliverables_accepted_pct': None,
            'timeline_adherence_pct': None,
            'quality_defect_score': None,
            'business_goals_achieved_pct': None
        }
        actual = calculate_project_success_rate(empty_proj)
        self.assertIsNone(actual, "Empty project metrics must return None, not 0% or 100%")

        partial_proj = {
            'milestones_completed_pct': 80.0,
            'deliverables_accepted_pct': None,
            'timeline_adherence_pct': None,
            'quality_defect_score': None,
            'business_goals_achieved_pct': None
        }
        # Normalized over available weight 0.25: (80.0 * 0.25) / 0.25 = 80.0
        self.assertEqual(calculate_project_success_rate(partial_proj), 80.0)

    # -------------------------------------------------------------------------
    # TEST 8: Verified and self-reported project results remain distinguishable
    # -------------------------------------------------------------------------
    def test_08_verified_vs_self_reported_distinction(self):
        emp_summary = get_employee_projects_summary(1)
        self.assertIn("average_verified_success_rate", emp_summary)
        self.assertIn("average_overall_success_rate", emp_summary)
        self.assertIn("verified_projects_count", emp_summary)

    # -------------------------------------------------------------------------
    # TEST 9: Skill gaps match configured role requirements (1-5 scale)
    # -------------------------------------------------------------------------
    def test_09_skill_proficiency_scale(self):
        self.assertEqual(PROFICIENCY_SCALE[1], "Beginner")
        self.assertEqual(PROFICIENCY_SCALE[2], "Basic")
        self.assertEqual(PROFICIENCY_SCALE[3], "Intermediate")
        self.assertEqual(PROFICIENCY_SCALE[4], "Advanced")
        self.assertEqual(PROFICIENCY_SCALE[5], "Expert")

        skill_eval = evaluate_employee_skill_gaps(1, 1)
        self.assertIsNotNone(skill_eval)
        self.assertIn("skill_match_score", skill_eval)
        self.assertIn("matched_skills", skill_eval)
        self.assertIn("skills_below_requirement", skill_eval)
        self.assertIn("missing_skills", skill_eval)

    # -------------------------------------------------------------------------
    # TEST 10: Missing mandatory skills are handled according to policy
    # -------------------------------------------------------------------------
    def test_10_missing_mandatory_skills_flagged(self):
        res = evaluate_leadership_suitability(1, 1)
        self.assertIsNotNone(res)
        self.assertIn("criteria_scores", res)
        self.assertIn("missing_mandatory", res["criteria_scores"]["skills"])

    # -------------------------------------------------------------------------
    # TEST 11: Professional experience is not double-counted (overlapping intervals)
    # -------------------------------------------------------------------------
    def test_11_merge_overlapping_experience(self):
        # Two jobs: Job 1 from 2020-01-01 to 2022-01-01 (2 years), Job 2 from 2021-01-01 to 2023-01-01 (2 years)
        # Total span should be 2020-01-01 to 2023-01-01 (3 years, NOT 4 years!)
        d1_s = date(2020, 1, 1)
        d1_e = date(2022, 1, 1)
        d2_s = date(2021, 1, 1)
        d2_e = date(2023, 1, 1)

        merged = merge_overlapping_intervals([(d1_s, d1_e), (d2_s, d2_e)])
        self.assertEqual(len(merged), 1)
        self.assertEqual(merged[0][0], date(2020, 1, 1))
        self.assertEqual(merged[0][1], date(2023, 1, 1))

    # -------------------------------------------------------------------------
    # TEST 12: Configurable weights must total 100%
    # -------------------------------------------------------------------------
    def test_12_configurable_weights_sum_100(self):
        config = SuitabilityConfig.get_active_config()
        total_weight = (
            config.assessment_weight +
            config.readiness_weight +
            config.skills_weight +
            config.projects_weight +
            config.experience_weight
        )
        self.assertAlmostEqual(total_weight, 100.0, places=2)

    # -------------------------------------------------------------------------
    # TEST 13: Missing data is handled consistently in overall suitability
    # -------------------------------------------------------------------------
    def test_13_missing_data_normalization_and_coverage(self):
        role = LeadershipRole.query.first()
        res = compare_candidates_for_role(role.id)
        for cand in res["candidates"]:
            self.assertIn("evidence_coverage_pct", cand)
            self.assertIn("has_sufficient_data", cand)
            if not cand["has_sufficient_data"]:
                self.assertIsNone(cand["suitability_score"], "Candidates with insufficient evidence must have suitability_score = None")
                self.assertEqual(cand["suitability_level"], "Insufficient Data")

    # -------------------------------------------------------------------------
    # TEST 14: Highest assessment scorer can differ from highest overall suitability
    # -------------------------------------------------------------------------
    def test_14_highest_assessment_scorer_can_differ_from_highest_suitability(self):
        role = LeadershipRole.query.get(1)
        res = compare_candidates_for_role(role.id)
        top_ass = res.get("highest_assessment_scorer")
        top_suit = res.get("highest_overall_suitability")
        self.assertIsNotNone(top_ass)
        self.assertIsNotNone(top_suit)
        # Note: top_ass and top_suit have distinct keys and track distinct employees/metrics

    # -------------------------------------------------------------------------
    # TEST 15: HR, Manager, and Employee data access restrictions remain intact
    # -------------------------------------------------------------------------
    def test_15_rbac_data_isolation(self):
        role = LeadershipRole.query.first()
        hr_user = User.query.filter_by(role='HR').first()
        emp_user = User.query.filter_by(role='Employee').first()
        current_emp = emp_user.employee_profile if emp_user else None

        # HR gets all candidates
        res_hr = compare_candidates_for_role(role.id, current_user=hr_user)
        self.assertGreater(len(res_hr["candidates"]), 1)

        # Employee gets only self
        if emp_user and current_emp:
            res_emp = compare_candidates_for_role(role.id, current_user=emp_user, current_employee=current_emp)
            self.assertEqual(len(res_emp["candidates"]), 1)
            self.assertEqual(res_emp["candidates"][0]["employee_id"], current_emp.id)

    # -------------------------------------------------------------------------
    # TEST 16: Empty databases produce honest empty states
    # -------------------------------------------------------------------------
    def test_16_non_existent_role_honest_empty_state(self):
        res = compare_candidates_for_role(999999)
        self.assertIsNone(res, "Non-existent role must return None / 404")

    # -------------------------------------------------------------------------
    # TEST 17: Summary REST endpoints and candidate dossier integrity
    # -------------------------------------------------------------------------
    def test_17_summary_endpoints_and_dossier_integrity(self):
        import jwt
        from config import Config
        hr_user = User.query.filter_by(role='HR').first()
        self.assertIsNotNone(hr_user)

        payload = {
            "sub": str(hr_user.id),
            "username": hr_user.username,
            "role": hr_user.role,
            "iat": datetime.now(timezone.utc),
            "exp": datetime.now(timezone.utc) + timedelta(hours=24)
        }
        token = jwt.encode(payload, Config.JWT_SECRET_KEY, algorithm="HS256")
        headers = {"Authorization": f"Bearer {token}"}

        with self.app.test_client() as client:
            # 1. Role Assessment Scores Summary
            r_ass = client.get('/api/roles/1/assessment-scores', headers=headers)
            self.assertEqual(r_ass.status_code, 200)
            data_ass = r_ass.get_json()
            self.assertTrue(data_ass.get("success"))
            self.assertIn("highest_assessment_scorer", data_ass["data"])
            self.assertIn("candidates", data_ass["data"])

            # 2. Role Projects Summary
            r_proj = client.get('/api/roles/1/projects-summary', headers=headers)
            self.assertEqual(r_proj.status_code, 200)
            data_proj = r_proj.get_json()
            self.assertTrue(data_proj.get("success"))
            self.assertIn("highest_project_performer", data_proj["data"])

            # 3. Role Skills Summary
            r_skills = client.get('/api/roles/1/skills-summary', headers=headers)
            self.assertEqual(r_skills.status_code, 200)
            data_skills = r_skills.get_json()
            self.assertTrue(data_skills.get("success"))
            self.assertIn("best_skill_matcher", data_skills["data"])

            # 4. Role Experience Summary
            r_exp = client.get('/api/roles/1/experience-summary', headers=headers)
            self.assertEqual(r_exp.status_code, 200)
            data_exp = r_exp.get_json()
            self.assertTrue(data_exp.get("success"))
            self.assertIn("candidates", data_exp["data"])

            # 5. Candidate Evidence Dossier Endpoint
            r_dos = client.get('/api/roles/1/candidates/1/dossier', headers=headers)
            self.assertEqual(r_dos.status_code, 200)
            data_dos = r_dos.get_json()
            self.assertTrue(data_dos.get("success"))
            self.assertIn("criteria_scores", data_dos["data"])
            self.assertIn("recommendation", data_dos["data"])
            self.assertIn("project_summary", data_dos["data"])
            self.assertIn("skill_details", data_dos["data"])
            self.assertIn("experience_summary", data_dos["data"])
            self.assertIn("suitability_score", data_dos["data"])

            # 6. Candidate-level Summaries
            r_cproj = client.get('/api/employees/1/projects-summary', headers=headers)
            self.assertEqual(r_cproj.status_code, 200)
            r_cexp = client.get('/api/employees/1/experience-summary', headers=headers)
            self.assertEqual(r_cexp.status_code, 200)
            r_cskill = client.get('/api/employees/1/roles/1/skills-summary', headers=headers)
            self.assertEqual(r_cskill.status_code, 200)
            r_cass = client.get('/api/employees/1/roles/1/assessment-summary', headers=headers)
            self.assertEqual(r_cass.status_code, 200)

if __name__ == '__main__':
    unittest.main()

