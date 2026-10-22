import unittest
from unittest.mock import patch
from app import create_app
from extensions import db
from models.user import User
from models.employee import Employee
from config import Config

class OAuthRoleApprovalTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = create_app()
        cls.app.config['TESTING'] = True
        cls.client = cls.app.test_client()

    def test_01_trusted_config_mappings(self):
        """Verify Config.TRUSTED_ROLE_MAPPINGS defines authorized HR and Manager roles"""
        hr_mapping = Config.get_trusted_mapping("elamparuthikp@gmail.com")
        self.assertIsNotNone(hr_mapping)
        self.assertEqual(hr_mapping['default_role'], 'HR')
        self.assertIn('HR', hr_mapping['allowed_roles'])
        self.assertIn('Manager', hr_mapping['allowed_roles'])
        self.assertTrue(hr_mapping.get('is_admin'))

        mgr_mapping = Config.get_trusted_mapping("elamparuthikp777@gmail.com")
        self.assertIsNotNone(mgr_mapping)
        self.assertEqual(mgr_mapping['default_role'], 'Manager')
        self.assertEqual(mgr_mapping['allowed_roles'], ['Manager'])
        self.assertFalse(mgr_mapping.get('is_admin'))

        # Unknown email must return None
        unknown = Config.get_trusted_mapping("unknown_user@random.com")
        self.assertIsNone(unknown)

    def test_02_trusted_hr_auto_correction_and_multi_role(self):
        """Verify that if an authorized email was previously stuck in Pending Employee status, it is safely corrected"""
        with self.app.app_context():
            # Setup a user stuck in Pending with Employee role
            test_hr_email = "elamparuthikp@gmail.com"
            existing = User.query.filter(User.email == test_hr_email).first()
            if not existing:
                existing = User(
                    name="Pending Admin Test",
                    username="test_pending_admin",
                    email=test_hr_email,
                    role="Employee",
                    status="Pending"
                )
                existing.set_password("SecurePass123!")
                db.session.add(existing)
                db.session.commit()
            else:
                existing.role = "Employee"
                existing.status = "Pending"
                db.session.commit()

        # Mock Supabase token verification returning the trusted email
        with patch('routes.auth.validate_supabase_access_token') as mock_val:
            mock_val.return_value = (test_hr_email, "Elamparuthi K P", None)
            res = self.client.post('/api/supabase', json={
                "access_token": "fake_valid_supabase_token"
            })
            self.assertEqual(res.status_code, 200)
            data = res.get_json()
            self.assertTrue(data['success'])
            user_data = data['data']['user']
            self.assertEqual(user_data['status'], 'Active')
            self.assertEqual(user_data['role'], 'HR')
            self.assertTrue(user_data['is_multi_role'])
            self.assertIn('HR', user_data['allowed_roles'])
            self.assertIn('Manager', user_data['allowed_roles'])

            # Verify that database record was corrected
            with self.app.app_context():
                reloaded = User.query.filter(User.email == test_hr_email).first()
                self.assertEqual(reloaded.status, 'Active')
                self.assertEqual(reloaded.role, 'HR')

    def test_03_trusted_manager_mapping(self):
        """Verify that manager account elamparuthikp777@gmail.com maps to Manager role"""
        mgr_email = "elamparuthikp777@gmail.com"
        with patch('routes.auth.validate_supabase_access_token') as mock_val:
            mock_val.return_value = (mgr_email, "Elamparuthi Manager", None)
            res = self.client.post('/api/supabase', json={
                "access_token": "fake_mgr_token"
            })
            self.assertEqual(res.status_code, 200)
            data = res.get_json()
            user_data = data['data']['user']
            self.assertEqual(user_data['status'], 'Active')
            self.assertEqual(user_data['role'], 'Manager')
            self.assertEqual(user_data['allowed_roles'], ['Manager'])

    def test_04_unknown_email_not_auto_approved(self):
        """Verify that an unknown email is NOT auto-approved and requires HR approval"""
        unknown_email = "new_hire_jane@corporate.org"
        with self.app.app_context():
            # Clean up if exists
            u = User.query.filter(User.email == unknown_email).first()
            if u:
                db.session.delete(u)
                db.session.commit()

        # Step 1: Login should return 404 needs_onboarding
        with patch('routes.auth.validate_supabase_access_token') as mock_val:
            mock_val.return_value = (unknown_email, "Jane Doe", None)
            res = self.client.post('/api/supabase', json={
                "access_token": "fake_token"
            })
            self.assertEqual(res.status_code, 404)
            self.assertTrue(res.get_json()['needs_onboarding'])

        # Step 2: Onboard employee
        with patch('routes.auth.validate_supabase_access_token') as mock_val:
            mock_val.return_value = (unknown_email, "Jane Doe", None)
            onboard_res = self.client.post('/api/onboard-employee', json={
                "access_token": "fake_token",
                "name": "Jane Doe",
                "department": "Design",
                "designation": "UI Designer"
            })
            self.assertEqual(onboard_res.status_code, 201)
            self.assertEqual(onboard_res.get_json()['status'], 'Pending')

        # Step 3: Attempting login while Pending must return HTTP 403 Pending
        with patch('routes.auth.validate_supabase_access_token') as mock_val:
            mock_val.return_value = (unknown_email, "Jane Doe", None)
            login_res = self.client.post('/api/supabase', json={
                "access_token": "fake_token"
            })
            self.assertEqual(login_res.status_code, 403)
            self.assertEqual(login_res.get_json()['status'], 'Pending')

    def test_05_role_switching_security(self):
        """Verify role switching between HR and Manager is allowed for multi-role and blocked for others"""
        test_hr_email = "elamparuthikp@gmail.com"
        with patch('routes.auth.validate_supabase_access_token') as mock_val:
            mock_val.return_value = (test_hr_email, "Elamparuthi K P", None)
            res = self.client.post('/api/supabase', json={"access_token": "token"})
            token = res.get_json()['data']['token']

        # Multi-role user switches to Manager
        switch_res = self.client.post(
            '/api/switch-role',
            headers={'Authorization': f'Bearer {token}'},
            json={'role': 'Manager'}
        )
        self.assertEqual(switch_res.status_code, 200)
        self.assertEqual(switch_res.get_json()['data']['user']['role'], 'Manager')
        new_token = switch_res.get_json()['data']['token']

        # Switch back to HR
        switch_back = self.client.post(
            '/api/switch-role',
            headers={'Authorization': f'Bearer {new_token}'},
            json={'role': 'HR'}
        )
        self.assertEqual(switch_back.status_code, 200)
        self.assertEqual(switch_back.get_json()['data']['user']['role'], 'HR')

        # Attempt illegal role switch
        invalid_switch = self.client.post(
            '/api/switch-role',
            headers={'Authorization': f'Bearer {token}'},
            json={'role': 'SuperAdmin'}
        )
        self.assertEqual(invalid_switch.status_code, 400)

if __name__ == '__main__':
    unittest.main()
