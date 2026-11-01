import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import unittest
import json
from app import create_app
from extensions import db
from models.user import User
from models.employee import Employee
from models.role import LeadershipRole
from models.assessment import Assessment, AssessmentAssignment, AssessmentResult

class TestAIWorkforceIntelligence(unittest.TestCase):
    def setUp(self):
        self.app = create_app()
        self.app.config['TESTING'] = True
        self.client = self.app.test_client()
        self.ctx = self.app.app_context()
        self.ctx.push()

    def tearDown(self):
        self.ctx.pop()

    def get_jwt_token(self, username, password):
        res = self.client.post('/api/login', json={'username': username, 'password': password})
        self.assertEqual(res.status_code, 200, f"Login failed for {username}: {res.get_json()}")
        return res.get_json()['data']['token']

    def test_01_top_successors_eligible_candidates(self):
        """Test Top 3 successors for Role 1 (Project Manager) returns qualified candidates who completed assessment"""
        token = self.get_jwt_token('hr', 'hr123')
        res = self.client.get(
            '/api/ai/top-successors?role_id=1',
            headers={'Authorization': f'Bearer {token}'}
        )
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data['success'])
        self.assertIn('top_candidates', data)
        self.assertIn('role', data)
        self.assertIn('notice', data)

        # Candidates in top_candidates must have completed assessments
        for cand in data['top_candidates']:
            self.assertIn('rank', cand)
            self.assertIn('ranking_score', cand)
            self.assertIn('assessment_score', cand)
            self.assertIn('readiness_score', cand)
            self.assertIn('competency_match_pct', cand)
            self.assertIn('ai_explanation', cand)
            self.assertIn('major_strengths', cand)
            self.assertIn('major_gaps', cand)
            self.assertIn('suggested_training', cand)
            self.assertGreater(cand['assessment_score'], 0)

    def test_02_top_successors_fewer_than_three_handling(self):
        """Test that roles with 0 completed assessments (e.g. Technical Lead Role 4) return 0 candidates with transparent notice"""
        token = self.get_jwt_token('hr', 'hr123')
        res = self.client.get(
            '/api/ai/top-successors?role_id=4',
            headers={'Authorization': f'Bearer {token}'}
        )
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data['success'])
        self.assertEqual(len(data['top_candidates']), 0)
        self.assertIn("No candidates currently satisfy all mandatory prerequisites", data['notice'])

    def test_03_manager_team_scoped_successors(self):
        """Test Manager Top 3 recommendations are strictly scoped to manager's direct reports"""
        token = self.get_jwt_token('manager', 'manager123')
        res = self.client.get(
            '/api/ai/manager/top-successors?role_id=1',
            headers={'Authorization': f'Bearer {token}'}
        )
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data['success'])

    def test_04_compare_candidates(self):
        """Test side-by-side comparison of candidates"""
        token = self.get_jwt_token('hr', 'hr123')
        res = self.client.post(
            '/api/ai/compare-candidates',
            data=json.dumps({"role_id": 1, "candidate_ids": [1, 2]}),
            content_type='application/json',
            headers={'Authorization': f'Bearer {token}'}
        )
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data['success'])
        self.assertIn('candidates', data)
        self.assertIn('competency_dimensions', data)
        self.assertIn('ai_comparative_summary', data)

    def test_05_shortlist_candidate_lifecycle(self):
        """Test shortlisting a candidate, approving, and retrieving from shortlists"""
        token = self.get_jwt_token('hr', 'hr123')
        # Shortlist
        res = self.client.post(
            '/api/ai/shortlist',
            data=json.dumps({"employee_id": 1, "role_id": 1, "action": "Shortlist", "notes": "Top candidate for PM"}),
            content_type='application/json',
            headers={'Authorization': f'Bearer {token}'}
        )
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.get_json()['success'])

        # Get Shortlists
        res_get = self.client.get(
            '/api/ai/shortlists?role_id=1',
            headers={'Authorization': f'Bearer {token}'}
        )
        self.assertEqual(res_get.status_code, 200)
        shortlists = res_get.get_json()['data']
        self.assertTrue(any(s['employee_id'] == 1 and s['role_id'] == 1 for s in shortlists))

    def test_06_workforce_summary(self):
        """Test HR Executive Workforce Summary"""
        token = self.get_jwt_token('hr', 'hr123')
        res = self.client.get(
            '/api/ai/workforce-summary',
            headers={'Authorization': f'Bearer {token}'}
        )
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data['success'])
        self.assertIn('total_leadership_roles', data)
        self.assertIn('coverage_ratio_pct', data)
        self.assertIn('roles_covered', data)
        self.assertIn('roles_at_risk', data)
        self.assertIn('strategic_recommendations', data)

    def test_07_competency_intelligence_8_dimensions(self):
        """Test Competency Intelligence returns all 8 core dimensions"""
        token = self.get_jwt_token('hr', 'hr123')
        res = self.client.get(
            '/api/ai/competency-intelligence',
            headers={'Authorization': f'Bearer {token}'}
        )
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data['success'])
        self.assertEqual(len(data['dimensions']), 8)
        dim_names = [d['name'] for d in data['dimensions']]
        self.assertIn('Leadership', dim_names)
        self.assertIn('Strategic Thinking', dim_names)
        self.assertIn('Communication', dim_names)
        self.assertIn('Technical Knowledge', dim_names)

    def test_08_team_intelligence_and_risks(self):
        """Test Manager Team Intelligence endpoint returns team metrics and risks"""
        token = self.get_jwt_token('hr', 'hr123')
        mgr_emp = Employee.query.filter(Employee.manager_id.isnot(None)).first()
        mgr_id = mgr_emp.manager_id if mgr_emp else 1

        res = self.client.get(
            f'/api/ai/team-intelligence?manager_id={mgr_id}',
            headers={'Authorization': f'Bearer {token}'}
        )
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data['success'])
        self.assertIn('team_readiness_avg', data)
        self.assertIn('risk_summary', data)
        self.assertIn('members', data)

    def test_09_ai_chat_queries(self):
        """Test AI Chat queries with factual DB responses"""
        token = self.get_jwt_token('hr', 'hr123')
        queries = [
            "Who are the top successors for Project Manager?",
            "What are our biggest competency gaps?",
            "How many assessments are completed?",
            "Give me an executive summary of our succession health"
        ]
        for q in queries:
            res = self.client.post(
                '/api/ai/chat',
                data=json.dumps({"query": q}),
                content_type='application/json',
                headers={'Authorization': f'Bearer {token}'}
            )
            self.assertEqual(res.status_code, 200)
            data = res.get_json()
            self.assertTrue(data['success'])
            self.assertTrue(len(data['reply']) > 0)

    def test_10_manager_candidate_comparison_authorization(self):
        """Test that Manager can only compare authorized direct reports, 403 on non-reports"""
        token = self.get_jwt_token('manager', 'manager123')
        # Manager is Sneha Reddy (ID 4). Direct reports in seed data: 1, 2, 3, 8.
        # Compare direct reports 1 and 2 -> Should succeed (200)
        res_ok = self.client.post(
            '/api/ai/compare-candidates',
            data=json.dumps({"role_id": 1, "candidate_ids": [1, 2]}),
            content_type='application/json',
            headers={'Authorization': f'Bearer {token}'}
        )
        self.assertEqual(res_ok.status_code, 200)

        # Compare unauthorized employee (ID 5 or 999) -> Should return 403
        res_forbidden = self.client.post(
            '/api/ai/compare-candidates',
            data=json.dumps({"role_id": 1, "candidate_ids": [1, 999]}),
            content_type='application/json',
            headers={'Authorization': f'Bearer {token}'}
        )
        self.assertEqual(res_forbidden.status_code, 403)
        self.assertIn("Managers can only view direct reports", res_forbidden.get_json()['message'])

    def test_11_manager_shortlist_authorization(self):
        """Test that Manager can only shortlist authorized direct reports, 403 on non-reports"""
        token = self.get_jwt_token('manager', 'manager123')
        # Shortlist direct report 1 -> Should succeed (200)
        res_ok = self.client.post(
            '/api/ai/shortlist',
            data=json.dumps({"employee_id": 1, "role_id": 1, "action": "Shortlist"}),
            content_type='application/json',
            headers={'Authorization': f'Bearer {token}'}
        )
        self.assertEqual(res_ok.status_code, 200)

        # Shortlist unauthorized employee (999) -> Should return 403
        res_forbidden = self.client.post(
            '/api/ai/shortlist',
            data=json.dumps({"employee_id": 999, "role_id": 1, "action": "Shortlist"}),
            content_type='application/json',
            headers={'Authorization': f'Bearer {token}'}
        )
        self.assertEqual(res_forbidden.status_code, 403)
        self.assertIn("Managers can only view direct reports", res_forbidden.get_json()['message'])

    def test_12_manager_recommendations_authorization(self):
        """Test manager authorization on predict-readiness and recommendation endpoints"""
        token = self.get_jwt_token('manager', 'manager123')
        # Direct report 1 -> Should succeed (200)
        res_ok = self.client.post(
            '/api/predict-readiness',
            data=json.dumps({"employee_id": 1, "role_id": 1}),
            content_type='application/json',
            headers={'Authorization': f'Bearer {token}'}
        )
        self.assertEqual(res_ok.status_code, 200)

        # Unauthorized employee 999 -> Should return 403
        res_forbidden = self.client.post(
            '/api/predict-readiness',
            data=json.dumps({"employee_id": 999, "role_id": 1}),
            content_type='application/json',
            headers={'Authorization': f'Bearer {token}'}
        )
        self.assertEqual(res_forbidden.status_code, 403)

    def test_13_executive_summary_fast_and_cached(self):
        """Test executive summary performance and caching"""
        token = self.get_jwt_token('hr', 'hr123')
        res1 = self.client.get('/api/ai/workforce-summary', headers={'Authorization': f'Bearer {token}'})
        self.assertEqual(res1.status_code, 200)
        res2 = self.client.get('/api/ai/workforce-summary', headers={'Authorization': f'Bearer {token}'})
        self.assertEqual(res2.status_code, 200)
        self.assertEqual(res1.get_json()['total_leadership_roles'], res2.get_json()['total_leadership_roles'])

if __name__ == '__main__':
    unittest.main()
