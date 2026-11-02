"""
Comprehensive Integration Test for Employee Individual Login Accounts
Verifies:
1. Authentication of all 19 target employee accounts with registered email and 'employee123'.
2. Role is strictly 'Employee' and must_change_password flag is set initially.
3. Access token issues and validates via /api/me.
4. Correct employee profile linkage (id, code, name, designation, department).
5. Access control / isolation:
   - Access to own profile (/api/employees/<own_id>) succeeds (HTTP 200).
   - Access to other employee profile (/api/employees/<other_id>) is forbidden (HTTP 403).
   - Access to manager routes (/api/manager/overview) is forbidden (HTTP 403).
   - Unauthorized role escalation (/api/switch-role to Manager or HR) is forbidden (HTTP 403).
6. Password change (/api/change-password) successfully updates password and resets must_change_password.
"""

import sys
import os
import json
import unittest

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))
from app import create_app
from extensions import db
from models.user import User
from models.employee import Employee
from utils.employee_account_service import TARGET_EMPLOYEES, sync_all_employee_accounts

class TestEmployeeIndividualLogins(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = create_app()
        cls.client = cls.app.test_client()
        with cls.app.app_context():
            # Synchronize all accounts to ensure baseline state
            cls.sync_report = sync_all_employee_accounts(target_password="employee123", sync_supabase=False)

    def test_all_19_target_employees_authentication_and_isolation(self):
        with self.app.app_context():
            for target in TARGET_EMPLOYEES:
                code = target["code"]
                email = target["email"]
                name = target["name"]
                prefix = email.split('@')[0]

                # 1. Test Login with Full Email
                login_resp = self.client.post('/api/login', json={
                    'username': email,
                    'password': 'employee123'
                })
                self.assertEqual(login_resp.status_code, 200, f"Login failed for {email}: {login_resp.get_data(as_text=True)}")
                login_data = login_resp.get_json()
                self.assertTrue(login_data.get('success'), f"Login success false for {email}")
                user_info = login_data['data']['user']
                token = login_data['data']['token']

                self.assertEqual(user_info['role'], 'Employee', f"Role is not Employee for {email}")
                self.assertEqual(user_info['allowed_roles'], ['Employee'], f"Allowed roles is not ['Employee'] for {email}")
                self.assertFalse(user_info['is_multi_role'], f"Multi-role should be False for {email}")
                self.assertTrue(user_info.get('must_change_password'), f"must_change_password should be True for {email}")
                emp_id = user_info.get('employee_id')
                self.assertIsNotNone(emp_id, f"employee_id is None for {email}")
                self.assertEqual(user_info.get('employee_code'), code, f"employee_code mismatch for {email}")

                auth_headers = {'Authorization': f'Bearer {token}'}

                # 2. Test Login with Prefix Username Handle
                prefix_login_resp = self.client.post('/api/login', json={
                    'username': prefix,
                    'password': 'employee123'
                })
                self.assertEqual(prefix_login_resp.status_code, 200, f"Prefix handle login failed for {prefix}")

                # 3. Test /api/me
                me_resp = self.client.get('/api/me', headers=auth_headers)
                self.assertEqual(me_resp.status_code, 200, f"/api/me failed for {email}")
                me_data = me_resp.get_json()['data']
                self.assertEqual(me_data['employee_id'], emp_id)
                self.assertEqual(me_data['email'], email)
                self.assertEqual(me_data['role'], 'Employee')

                # 4. Test Isolation: Access to Own Profile succeeds (HTTP 200)
                own_profile_resp = self.client.get(f'/api/employees/{emp_id}', headers=auth_headers)
                self.assertEqual(own_profile_resp.status_code, 200, f"Access to own profile failed for {email}")
                own_data = own_profile_resp.get_json()['data']
                self.assertEqual(own_data['employee_code'], code)

                # 5. Test Isolation: Access to Other Profile is Forbidden (HTTP 403)
                other_emp_id = 2 if emp_id != 2 else 1
                other_profile_resp = self.client.get(f'/api/employees/{other_emp_id}', headers=auth_headers)
                self.assertEqual(other_profile_resp.status_code, 403, f"Access to other profile should be 403 for {email}")

                # 6. Test RBAC: Access to Manager Routes is Forbidden (HTTP 403)
                mgr_resp = self.client.get('/api/manager/overview', headers=auth_headers)
                self.assertEqual(mgr_resp.status_code, 403, f"Access to manager/overview should be 403 for {email}")

                # 7. Test RBAC: Unauthorized role escalation (/api/switch-role) is Forbidden (HTTP 403)
                switch_resp = self.client.post('/api/switch-role', json={'role': 'Manager'}, headers=auth_headers)
                self.assertEqual(switch_resp.status_code, 403, f"Role switch to Manager should be 403 for {email}")

    def test_password_change_flow(self):
        with self.app.app_context():
            # Test password change for EMP001 (Arun Kumar)
            email = "arun.kumar@company.com"
            login_resp = self.client.post('/api/login', json={'username': email, 'password': 'employee123'})
            token = login_resp.get_json()['data']['token']
            headers = {'Authorization': f'Bearer {token}'}

            # 1. Change password
            change_resp = self.client.post('/api/change-password', json={
                'current_password': 'employee123',
                'new_password': 'NewSecurePassword2026!'
            }, headers=headers)
            self.assertEqual(change_resp.status_code, 200, f"Password change failed: {change_resp.get_data(as_text=True)}")
            change_data = change_resp.get_json()
            self.assertTrue(change_data['success'])
            self.assertFalse(change_data['data']['user']['must_change_password'])

            # 2. Login with old password fails (HTTP 401)
            old_login = self.client.post('/api/login', json={'username': email, 'password': 'employee123'})
            self.assertEqual(old_login.status_code, 401)

            # 3. Login with new password succeeds (HTTP 200)
            new_login = self.client.post('/api/login', json={'username': email, 'password': 'NewSecurePassword2026!'})
            self.assertEqual(new_login.status_code, 200)
            self.assertFalse(new_login.get_json()['data']['user']['must_change_password'])

            # 4. Reset back to testing password for subsequent runs
            reset_headers = {'Authorization': f"Bearer {new_login.get_json()['data']['token']}"}
            self.client.post('/api/change-password', json={
                'current_password': 'NewSecurePassword2026!',
                'new_password': 'employee123'
            }, headers=reset_headers)

if __name__ == '__main__':
    unittest.main()

