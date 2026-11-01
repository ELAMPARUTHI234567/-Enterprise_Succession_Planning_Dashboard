import json
import unittest
import sys
import os

# Add backend directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app
from extensions import db
from models.user import User
from models.employee import Employee
from config import Config

class TestRoleSwitching(unittest.TestCase):
    def setUp(self):
        self.app = create_app()
        self.app.config['TESTING'] = True
        self.client = self.app.test_client()
        self.ctx = self.app.app_context()
        self.ctx.push()

    def tearDown(self):
        self.ctx.pop()

    def test_role_switching_workflow(self):
        client = self.client

        # 1. Test multi-role user (hr@company.com or elamparuthikp@gmail.com) login as HR
        login_res = client.post('/api/login', json={
            'username': 'hr',
            'password': 'hr123'
        })
        self.assertEqual(login_res.status_code, 200, f"HR login failed: {login_res.get_json()}")
        hr_data = login_res.get_json()['data']
        hr_token = hr_data['token']
        self.assertEqual(hr_data['user']['role'], 'HR')
        self.assertIn('Manager', hr_data['user']['allowed_roles'])
        self.assertIn('HR', hr_data['user']['allowed_roles'])

        # 2. Test OPTIONS preflight for /switch-role
        options_res = client.open('/api/switch-role', method='OPTIONS', headers={
            'Origin': 'https://enterprise-succession-planning-dash.vercel.app',
            'Access-Control-Request-Method': 'POST',
            'Access-Control-Request-Headers': 'authorization,content-type'
        })
        self.assertEqual(options_res.status_code, 200)

        # 3. Multi-role switch HR -> Manager
        switch_to_mgr_res = client.post('/api/switch-role', json={
            'role': 'Manager'
        }, headers={'Authorization': f'Bearer {hr_token}'})
        self.assertEqual(switch_to_mgr_res.status_code, 200, f"Switch to Manager failed: {switch_to_mgr_res.get_json()}")
        mgr_switched = switch_to_mgr_res.get_json()['data']
        self.assertEqual(mgr_switched['user']['role'], 'Manager')
        mgr_token = mgr_switched['token']

        # Verify Manager overview access with the new manager token
        mgr_me_res = client.get('/api/me', headers={'Authorization': f'Bearer {mgr_token}'})
        self.assertEqual(mgr_me_res.status_code, 200)
        self.assertEqual(mgr_me_res.get_json()['data']['role'], 'Manager')

        # 4. Multi-role switch Manager -> HR
        switch_to_hr_res = client.post('/api/switch-role', json={
            'role': 'HR'
        }, headers={'Authorization': f'Bearer {mgr_token}'})
        self.assertEqual(switch_to_hr_res.status_code, 200, f"Switch back to HR failed: {switch_to_hr_res.get_json()}")
        hr_switched = switch_to_hr_res.get_json()['data']
        self.assertEqual(hr_switched['user']['role'], 'HR')
        self.assertIn('Manager', hr_switched['user']['allowed_roles'])

        # 5. Single-role Manager isolation (manager@company.com with only Manager permission)
        mgr_login = client.post('/api/login', json={
            'username': 'manager',
            'password': 'manager123'
        })
        self.assertEqual(mgr_login.status_code, 200)
        mgr_single_token = mgr_login.get_json()['data']['token']

        # Single-role Manager attempting switch to HR -> HTTP 403
        unauth_mgr_switch = client.post('/api/switch-role', json={
            'role': 'HR'
        }, headers={'Authorization': f'Bearer {mgr_single_token}'})
        self.assertEqual(unauth_mgr_switch.status_code, 403)
        self.assertIn("Unauthorized role escalation", unauth_mgr_switch.get_json()['message'])

        # 6. Single-role Employee isolation (arun.kumar@company.com)
        emp_login = client.post('/api/login', json={
            'username': 'arun.kumar',
            'password': 'employee123'
        })
        self.assertEqual(emp_login.status_code, 200, f"Employee login failed: {emp_login.get_json()}")
        emp_token = emp_login.get_json()['data']['token']

        # Employee attempting switch to HR -> HTTP 403
        emp_switch_hr = client.post('/api/switch-role', json={
            'role': 'HR'
        }, headers={'Authorization': f'Bearer {emp_token}'})
        self.assertEqual(emp_switch_hr.status_code, 403)
        self.assertIn("Unauthorized role escalation", emp_switch_hr.get_json()['message'])

        # Employee attempting switch to Manager -> HTTP 403
        emp_switch_mgr = client.post('/api/switch-role', json={
            'role': 'Manager'
        }, headers={'Authorization': f'Bearer {emp_token}'})
        self.assertEqual(emp_switch_mgr.status_code, 403)
        self.assertIn("Unauthorized role escalation", emp_switch_mgr.get_json()['message'])

        # 7. Invalid target role
        invalid_role_res = client.post('/api/switch-role', json={
            'role': 'SuperAdmin'
        }, headers={'Authorization': f'Bearer {hr_token}'})
        self.assertEqual(invalid_role_res.status_code, 400)

        # 8. Unauthenticated switch-role attempt -> HTTP 401
        no_auth_res = client.post('/api/switch-role', json={'role': 'Manager'})
        self.assertEqual(no_auth_res.status_code, 401)

if __name__ == '__main__':
    unittest.main()
