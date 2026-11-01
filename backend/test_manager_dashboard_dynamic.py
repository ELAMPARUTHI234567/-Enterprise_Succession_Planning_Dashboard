import unittest
import json
from app import create_app
from extensions import db
from models.user import User
from models.employee import Employee
from models.role import LeadershipRole
from models.manager_dashboard import (
    TeamTask, TeamGoal, TeamIssue, ManagerFeedback, ManagerRecommendation, PerformanceReview
)

class TestManagerDashboardDynamic(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = create_app()
        cls.client = cls.app.test_client()

    def get_jwt_token(self, username, password):
        res = self.client.post('/api/login', json={'username': username, 'password': password})
        self.assertEqual(res.status_code, 200, f"Login failed for {username}: {res.get_json()}")
        return res.get_json()['data']['token']

    def test_01_manager_overview_metrics(self):
        token = self.get_jwt_token('manager', 'manager123')
        res = self.client.get('/api/manager/overview', headers={'Authorization': f'Bearer {token}'})
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data['success'])
        kpis = data['kpis']
        self.assertIn('total_team_members', kpis)
        self.assertIn('active_tasks', kpis)
        self.assertIn('completed_tasks', kpis)
        self.assertIn('overdue_tasks', kpis)
        self.assertIn('projects_in_progress', kpis)
        self.assertIn('open_issues', kpis)
        self.assertIn('pending_feedback', kpis)
        self.assertIn('employees_needing_development', kpis)
        self.assertGreaterEqual(kpis['total_team_members'], 1)

        charts = data['charts']
        self.assertIn('task_status', charts)
        self.assertIn('project_progress', charts)
        self.assertIn('team_performance', charts)
        self.assertIn('competency_gaps', charts)

    def test_02_get_team_members_and_isolation(self):
        token = self.get_jwt_token('manager', 'manager123')
        res = self.client.get('/api/manager/team', headers={'Authorization': f'Bearer {token}'})
        self.assertEqual(res.status_code, 200)
        team = res.get_json()['data']
        self.assertGreaterEqual(len(team), 1)

        # Confirm all returned employees are direct reports of Manager 4
        with self.app.app_context():
            mgr_emp = Employee.query.filter_by(id=4).first()
            for member in team:
                self.assertEqual(member['manager_id'], mgr_emp.id)

    def test_03_unauthorized_employee_access_blocked(self):
        emp_token = self.get_jwt_token('arun.kumar', 'employee123')
        res = self.client.get('/api/manager/overview', headers={'Authorization': f'Bearer {emp_token}'})
        self.assertEqual(res.status_code, 403)
        self.assertFalse(res.get_json()['success'])

    def test_04_task_lifecycle_crud(self):
        token = self.get_jwt_token('manager', 'manager123')
        # 1. Create Task for direct report Emp 1
        create_res = self.client.post('/api/manager/tasks', headers={'Authorization': f'Bearer {token}'}, json={
            'title': 'Test Microservices Regression Verification',
            'description': 'Ensure zero regression on API test endpoints.',
            'employee_id': 1,
            'priority': 'Urgent',
            'start_date': '2026-11-01',
            'due_date': '2026-12-28',
            'status': 'Pending'
        })
        self.assertEqual(create_res.status_code, 201)
        task = create_res.get_json()['data']
        task_id = task['id']
        self.assertEqual(task['priority'], 'Urgent')
        self.assertEqual(task['status'], 'Pending')

        # 2. Update Task to In Progress
        upd_res = self.client.put(f'/api/manager/tasks/{task_id}', headers={'Authorization': f'Bearer {token}'}, json={
            'status': 'In Progress'
        })
        self.assertEqual(upd_res.status_code, 200)
        self.assertEqual(upd_res.get_json()['data']['status'], 'In Progress')

        # 3. Update Task to Completed
        comp_res = self.client.put(f'/api/manager/tasks/{task_id}', headers={'Authorization': f'Bearer {token}'}, json={
            'status': 'Completed'
        })
        self.assertEqual(comp_res.status_code, 200)
        self.assertEqual(comp_res.get_json()['data']['status'], 'Completed')
        self.assertIsNotNone(comp_res.get_json()['data']['completed_at'])

        # 4. Delete Task
        del_res = self.client.delete(f'/api/manager/tasks/{task_id}', headers={'Authorization': f'Bearer {token}'})
        self.assertEqual(del_res.status_code, 200)

    def test_05_task_foreign_assignment_rejected(self):
        token = self.get_jwt_token('manager', 'manager123')
        # Employee 5 is not a direct report of Manager 4 (Sneha Reddy)
        with self.app.app_context():
            emp5 = Employee.query.filter(Employee.manager_id != 4).first()
            if emp5:
                res = self.client.post('/api/manager/tasks', headers={'Authorization': f'Bearer {token}'}, json={
                    'title': 'Foreign Assignment Attempt',
                    'employee_id': emp5.id,
                    'priority': 'Medium',
                    'status': 'Pending'
                })
                self.assertEqual(res.status_code, 403)
                self.assertFalse(res.get_json()['success'])

    def test_06_team_goals_crud(self):
        token = self.get_jwt_token('manager', 'manager123')
        create_res = self.client.post('/api/manager/goals', headers={'Authorization': f'Bearer {token}'}, json={
            'title': 'Deliver Zero Critical Security Vulnerabilities',
            'description': 'Resolve static analysis alerts in all repository packages.',
            'target_metric': 100.0,
            'current_metric': 60.0,
            'metric_unit': '%',
            'target_date': '2026-11-30',
            'status': 'On Track'
        })
        self.assertEqual(create_res.status_code, 201)
        goal_id = create_res.get_json()['data']['id']

        # Update progress
        upd_res = self.client.put(f'/api/manager/goals/{goal_id}', headers={'Authorization': f'Bearer {token}'}, json={
            'current_metric': 90.0
        })
        self.assertEqual(upd_res.status_code, 200)
        self.assertEqual(upd_res.get_json()['data']['progress_pct'], 90.0)

        # Cleanup
        del_res = self.client.delete(f'/api/manager/goals/{goal_id}', headers={'Authorization': f'Bearer {token}'})
        self.assertEqual(del_res.status_code, 200)

    def test_07_team_issues_and_resolution(self):
        token = self.get_jwt_token('manager', 'manager123')
        create_res = self.client.post('/api/manager/issues', headers={'Authorization': f'Bearer {token}'}, json={
            'title': 'Database Connection Pool Exhaustion under Stress Test',
            'description': 'Spike in active connections exceeding max pool size.',
            'employee_id': 1,
            'severity': 'Critical',
            'status': 'Open'
        })
        self.assertEqual(create_res.status_code, 201)
        issue_id = create_res.get_json()['data']['id']

        # Resolve issue
        res_res = self.client.put(f'/api/manager/issues/{issue_id}', headers={'Authorization': f'Bearer {token}'}, json={
            'status': 'Resolved',
            'resolution_notes': 'Increased max connections and optimized pooling recycle timeout.'
        })
        self.assertEqual(res_res.status_code, 200)
        self.assertEqual(res_res.get_json()['data']['status'], 'Resolved')
        self.assertIsNotNone(res_res.get_json()['data']['resolved_at'])

        # Cleanup
        self.client.delete(f'/api/manager/issues/{issue_id}', headers={'Authorization': f'Bearer {token}'})

    def test_08_manager_feedback_recording(self):
        token = self.get_jwt_token('manager', 'manager123')
        res = self.client.post('/api/manager/feedback', headers={'Authorization': f'Bearer {token}'}, json={
            'employee_id': 1,
            'strengths': 'High reliability and deep mastery of cloud infrastructure.',
            'improvement_areas': 'Public presentation of architectural proposals.',
            'development_plan': 'Attend company tech symposium as keynote speaker.',
            'follow_up_status': 'Scheduled',
            'is_private': True
        })
        self.assertEqual(res.status_code, 201)
        fb_data = res.get_json()['data']
        self.assertEqual(fb_data['employee_id'], 1)
        self.assertEqual(fb_data['follow_up_status'], 'Scheduled')

        # Retrieve feedback
        get_res = self.client.get('/api/manager/feedback?employee_id=1', headers={'Authorization': f'Bearer {token}'})
        self.assertEqual(get_res.status_code, 200)
        self.assertGreaterEqual(len(get_res.get_json()['data']), 1)

    def test_09_recommendations_submission_and_hr_review(self):
        mgr_token = self.get_jwt_token('manager', 'manager123')
        hr_token = self.get_jwt_token('hr', 'hr123')

        # 1. Manager submits recommendation
        sub_res = self.client.post('/api/manager/recommendations', headers={'Authorization': f'Bearer {mgr_token}'}, json={
            'employee_id': 1,
            'role_id': 2,
            'strengths_summary': 'Demonstrated technical execution and mentor capabilities.',
            'development_needs': 'Cross-department financial budgeting.',
            'recommendation_notes': 'Arun is ready to step into Team Lead role for upcoming project release.'
        })
        self.assertEqual(sub_res.status_code, 201)
        rec = sub_res.get_json()['data']
        rec_id = rec['id']
        self.assertEqual(rec['status'], 'Submitted')
        self.assertIsNotNone(rec['suitability_score'])

        # 2. HR reviews recommendation
        review_res = self.client.put(f'/api/manager/recommendations/{rec_id}/review', headers={'Authorization': f'Bearer {hr_token}'}, json={
            'status': 'Approved',
            'hr_feedback': 'Approved based on verified project track record and assessment scores.'
        })
        self.assertEqual(review_res.status_code, 200)
        self.assertEqual(review_res.get_json()['data']['status'], 'Approved')

    def test_10_update_profile_responsibilities_and_availability(self):
        token = self.get_jwt_token('manager', 'manager123')
        res = self.client.put('/api/manager/team/1', headers={'Authorization': f'Bearer {token}'}, json={
            'availability_status': 'Available',
            'responsibilities': 'Lead engineer for microservice architecture, sprint coordination, and mentoring junior devs.',
            'performance_score': 95.0
        })
        self.assertEqual(res.status_code, 200)
        emp_data = res.get_json()['data']
        self.assertEqual(emp_data['responsibilities'], 'Lead engineer for microservice architecture, sprint coordination, and mentoring junior devs.')
        self.assertEqual(emp_data['performance_score'], 95.0)

if __name__ == '__main__':
    unittest.main()
