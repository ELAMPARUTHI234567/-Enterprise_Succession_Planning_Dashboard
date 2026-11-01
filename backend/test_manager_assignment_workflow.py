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

class TestManagerAssignmentWorkflow(unittest.TestCase):
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

    def test_01_get_managers_list_hr_authorized(self):
        """Test GET /api/managers returns organization manager list with employee counts"""
        token = self.get_jwt_token('hr', 'hr123')
        res = self.client.get('/api/managers', headers={'Authorization': f'Bearer {token}'})
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data['success'])
        self.assertIn('data', data)
        self.assertGreater(data['count'], 0)
        
        # Verify structure of manager items
        first_mgr = data['data'][0]
        self.assertIn('id', first_mgr)
        self.assertIn('name', first_mgr)
        self.assertIn('department', first_mgr)
        self.assertIn('assigned_employee_count', first_mgr)
        self.assertIn('employee_ids', first_mgr)
        self.assertIsInstance(first_mgr['employee_ids'], list)

    def test_02_get_managers_list_unauthorized(self):
        """Test GET /api/managers rejects unauthenticated requests with 401"""
        res = self.client.get('/api/managers')
        self.assertIn(res.status_code, [401, 403])

    def test_03_bulk_assign_validation_empty_ids(self):
        """Test POST /api/employees/bulk-assign-manager requires valid employee_ids"""
        token = self.get_jwt_token('hr', 'hr123')
        res = self.client.post(
            '/api/employees/bulk-assign-manager',
            json={'employee_ids': [], 'new_manager_id': 4},
            headers={'Authorization': f'Bearer {token}'}
        )
        self.assertEqual(res.status_code, 400)
        data = res.get_json()
        self.assertFalse(data['success'])

    def test_04_bulk_assign_self_reporting_check(self):
        """Test POST /api/employees/bulk-assign-manager rejects assigning manager to report to himself"""
        token = self.get_jwt_token('hr', 'hr123')
        # Try assigning Sneha Reddy (emp 4) to report to Sneha Reddy (emp 4)
        res = self.client.post(
            '/api/employees/bulk-assign-manager',
            json={'employee_ids': [4], 'new_manager_id': 4},
            headers={'Authorization': f'Bearer {token}'}
        )
        self.assertEqual(res.status_code, 400)
        data = res.get_json()
        self.assertFalse(data['success'])
        self.assertIn('cannot be assigned as their own manager', data['message'])

    def test_05_bulk_assign_success_and_revert(self):
        """Test HR assigning employees to manager and verifying manager_id updates atomically"""
        token = self.get_jwt_token('hr', 'hr123')
        
        # Find 2 test employees
        emp1 = Employee.query.filter_by(id=1).first()
        orig_mgr1 = emp1.manager_id if emp1 else None

        # Assign Emp 1 to Manager 4
        res = self.client.post(
            '/api/employees/bulk-assign-manager',
            json={'employee_ids': [1], 'new_manager_id': 4},
            headers={'Authorization': f'Bearer {token}'}
        )
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data['success'])
        self.assertEqual(data['updated_count'], 1)

        # Verify database record
        emp1_updated = Employee.query.get(1)
        self.assertEqual(emp1_updated.manager_id, 4)

        # Restore original state if needed
        if orig_mgr1 is not None and orig_mgr1 != 4:
            emp1_updated.manager_id = orig_mgr1
            db.session.commit()

    def test_06_unassign_filter_and_endpoint(self):
        """Test GET /api/employees with unassigned=true returns only unassigned employees"""
        token = self.get_jwt_token('hr', 'hr123')
        res = self.client.get('/api/employees?unassigned=true', headers={'Authorization': f'Bearer {token}'})
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data['success'])
        for emp in data['data']:
            self.assertIsNone(emp.get('manager_id'), f"Employee {emp.get('id')} has manager_id {emp.get('manager_id')} but unassigned filter was requested")

    def test_07_manager_portal_sees_assigned_reports_only(self):
        """Test Manager portal (/api/manager/team) strictly limits data to direct reports"""
        mgr_token = self.get_jwt_token('manager', 'manager123')
        res = self.client.get('/api/manager/team', headers={'Authorization': f'Bearer {mgr_token}'})
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data['success'])
        self.assertIn('data', data)

        # Verify all team members have manager_id matching current manager or current manager himself
        mgr_user = User.query.filter_by(username='manager').first()
        mgr_emp = Employee.query.filter_by(id=4).first()
        for member in data['data']:
            if member['id'] != mgr_emp.id:
                self.assertEqual(member['manager_id'], mgr_emp.id, f"Employee {member['id']} has manager_id {member['manager_id']} not equal to manager {mgr_emp.id}")

    def test_08_assessment_schedules_scoping(self):
        """Test /api/assessment-schedules returns org-wide for HR and team-only for Manager"""
        hr_token = self.get_jwt_token('hr', 'hr123')
        hr_res = self.client.get('/api/assessment-schedules', headers={'Authorization': f'Bearer {hr_token}'})
        self.assertEqual(hr_res.status_code, 200)
        hr_data = hr_res.get_json()
        self.assertTrue(hr_data['success'])

        mgr_token = self.get_jwt_token('manager', 'manager123')
        mgr_res = self.client.get('/api/assessment-schedules', headers={'Authorization': f'Bearer {mgr_token}'})
        self.assertEqual(mgr_res.status_code, 200)
        mgr_data = mgr_res.get_json()
        self.assertTrue(mgr_data['success'])

        # Manager schedules count must be <= HR schedules count
        self.assertLessEqual(len(mgr_data['data']), len(hr_data['data']))

if __name__ == '__main__':
    unittest.main()
