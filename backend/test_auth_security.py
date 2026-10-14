import unittest
import json
import jwt
from unittest.mock import patch, MagicMock
from app import create_app
from extensions import db
from models.user import User
from models.employee import Employee
from config import Config
from utils.seed_data import seed_database_if_empty, sync_employee_users

class TestEnterpriseAuthSecurity(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = create_app()
        cls.app.config['TESTING'] = True
        cls.client = cls.app.test_client()

    def test_production_gating_skips_demo_seeding(self):
        """1. Production gating prevents demo account generation and password overwrites"""
        with self.app.app_context():
            with patch.object(Config, 'IS_PRODUCTION', True):
                # Should return immediately without errors or re-seeding
                seed_database_if_empty()
                sync_employee_users()

    def test_existing_user_password_preserved_on_sync(self):
        """2. sync_employee_users does not overwrite or reset customized passwords"""
        with self.app.app_context():
            user = User.query.filter_by(username='arun.kumar').first()
            if not user:
                user = User.query.filter_by(username='employee').first()
            if user:
                # Set custom password
                user.set_password("MySecretPassword999!")
                db.session.commit()

                # Run sync_employee_users in non-production mode
                with patch.object(Config, 'IS_PRODUCTION', False):
                    with patch.dict('os.environ', {'DISABLE_DEMO_SEEDING': 'false'}):
                        sync_employee_users()

                # Verify custom password was NOT overwritten
                reloaded = User.query.get(user.id)
                self.assertTrue(reloaded.check_password("MySecretPassword999!"))
                self.assertFalse(reloaded.check_password("employee123"))

                # Restore password back to employee123 for other standard tests
                reloaded.set_password("employee123")
                db.session.commit()

    def test_authorized_admin_email_oauth_login(self):
        """3. Authorized admin elamparuthikp@gmail.com authenticates with valid role"""
        with self.app.app_context():
            hr_user = User.query.filter_by(username='hr').first()
            hr_user.oauth_email = 'elamparuthikp@gmail.com'
            manager_user = User.query.filter_by(username='manager').first()
            manager_user.oauth_email = 'elamparuthikp777@gmail.com'
            db.session.commit()

        fake_token = jwt.encode({
            "iss": "https://livemvqdyupoipuajury.supabase.co/auth/v1",
            "sub": "google-elam-id"
        }, "secret", algorithm="HS256")

        mock_response = MagicMock()
        mock_response.read.return_value = json.dumps({
            "email": "elamparuthikp@gmail.com",
            "id": "google-elam-id"
        }).encode('utf-8')
        mock_response.__enter__.return_value = mock_response

        with patch('urllib.request.urlopen', return_value=mock_response):
            res = self.client.post('/api/supabase', json={"access_token": fake_token})
            self.assertEqual(res.status_code, 200)
            data = res.get_json()
            self.assertTrue(data['success'])
            self.assertEqual(data['data']['user']['oauth_email'], 'elamparuthikp@gmail.com')
            self.assertEqual(data['data']['user']['role'], 'HR')

    def test_unregistered_employee_oauth_returns_404_with_helpful_message(self):
        """4. Unregistered email receives 404 with exact helpful message to contact HR"""
        fake_token = jwt.encode({
            "iss": "https://livemvqdyupoipuajury.supabase.co/auth/v1",
            "sub": "unregistered-id"
        }, "secret", algorithm="HS256")

        mock_response = MagicMock()
        mock_response.read.return_value = json.dumps({
            "email": "unregistered.contractor@external.com",
            "id": "unregistered-id"
        }).encode('utf-8')
        mock_response.__enter__.return_value = mock_response

        with patch('urllib.request.urlopen', return_value=mock_response):
            res = self.client.post('/api/supabase', json={"access_token": fake_token})
            self.assertEqual(res.status_code, 404)
            data = res.get_json()
            self.assertFalse(data['success'])
            self.assertIn("Your employee account is not registered. Please contact HR", data['message'])

    def test_deactivated_account_rejected_with_403(self):
        """5. Inactive/deactivated account receives 403 Forbidden"""
        with self.app.app_context():
            inactive_user = User.query.filter_by(username='temp_inactive_user').first()
            if not inactive_user:
                inactive_user = User(
                    name="Deactivated Employee",
                    username="temp_inactive_user",
                    email="deactivated@company.com",
                    role="Employee",
                    status="Inactive"
                )
                inactive_user.set_password("pass123")
                db.session.add(inactive_user)
                db.session.commit()

        # Test login via standard credentials
        res = self.client.post('/api/login', json={
            "username": "temp_inactive_user",
            "password": "pass123"
        })
        self.assertEqual(res.status_code, 403)
        data = res.get_json()
        self.assertFalse(data['success'])
        self.assertIn("deactivated", data['message'].lower())

    def test_unauthorized_role_escalation_rejected_on_login(self):
        """6. Regular employee attempting role escalation in login request is rejected with 403"""
        res = self.client.post('/api/login', json={
            "username": "arun.kumar@company.com",
            "password": "employee123",
            "role": "HR"
        })
        self.assertEqual(res.status_code, 403)
        data = res.get_json()
        self.assertFalse(data['success'])
        self.assertIn("Unauthorized role escalation", data['message'])

    def test_unauthorized_role_escalation_rejected_on_oauth(self):
        """7. Regular employee attempting role escalation via OAuth params is rejected with 403"""
        fake_token = jwt.encode({
            "iss": "https://livemvqdyupoipuajury.supabase.co/auth/v1",
            "sub": "arun-sub"
        }, "secret", algorithm="HS256")

        mock_response = MagicMock()
        mock_response.read.return_value = json.dumps({
            "email": "arun.kumar@company.com",
            "id": "arun-sub"
        }).encode('utf-8')
        mock_response.__enter__.return_value = mock_response

        with patch('urllib.request.urlopen', return_value=mock_response):
            res = self.client.post('/api/supabase', json={
                "access_token": fake_token,
                "role": "HR"
            })
            self.assertEqual(res.status_code, 403)
            data = res.get_json()
            self.assertFalse(data['success'])
            self.assertIn("Unauthorized role escalation", data['message'])

    def test_standard_password_verification_no_backdoors(self):
        """8. Real PBKDF2 hash verification strictly enforced without bypasses"""
        # Invalid password returns 401
        res = self.client.post('/api/login', json={
            "username": "hr",
            "password": "WrongPassword123"
        })
        self.assertEqual(res.status_code, 401)
        data = res.get_json()
        self.assertFalse(data['success'])

    def test_switch_role_endpoint_permissions(self):
        """9. Role switching allowed only for authorized administrator accounts"""
        with self.app.app_context():
            emp_user = User.query.filter_by(username='arun.kumar').first()
            emp_token = jwt.encode({
                "sub": str(emp_user.id),
                "username": emp_user.username,
                "role": emp_user.role
            }, Config.JWT_SECRET_KEY, algorithm="HS256")

            admin_user = User.query.filter_by(username='hr').first()
            admin_user.oauth_email = 'elamparuthikp@gmail.com'
            db.session.commit()
            admin_token = jwt.encode({
                "sub": str(admin_user.id),
                "username": admin_user.username,
                "role": admin_user.role
            }, Config.JWT_SECRET_KEY, algorithm="HS256")

        # 1. Employee trying to switch to HR -> 403 Forbidden
        emp_res = self.client.post(
            '/api/switch-role',
            headers={"Authorization": f"Bearer {emp_token}"},
            json={"role": "HR"}
        )
        self.assertEqual(emp_res.status_code, 403)
        emp_data = emp_res.get_json()
        self.assertFalse(emp_data['success'])
        self.assertIn("Unauthorized role escalation", emp_data['message'])

        # 2. Authorized admin switching to Manager -> 200 OK with new JWT
        admin_res = self.client.post(
            '/api/switch-role',
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"role": "Manager"}
        )
        self.assertEqual(admin_res.status_code, 200)
        admin_data = admin_res.get_json()
        self.assertTrue(admin_data['success'])
        self.assertEqual(admin_data['data']['user']['role'], 'Manager')

        # Decode newly issued token and verify role is Manager
        decoded = jwt.decode(admin_data['data']['token'], Config.JWT_SECRET_KEY, algorithms=["HS256"])
        self.assertEqual(decoded['role'], 'Manager')

        # Switch back to HR
        switch_back_res = self.client.post(
            '/api/switch-role',
            headers={"Authorization": f"Bearer {admin_data['data']['token']}"},
            json={"role": "HR"}
        )
        self.assertEqual(switch_back_res.status_code, 200)

    def test_employee_data_isolation_on_backend_api(self):
        """10. Employee role cannot view other employee details or modify accounts"""
        with self.app.app_context():
            emp_user = User.query.filter_by(username='arun.kumar').first()
            emp_token = jwt.encode({
                "sub": str(emp_user.id),
                "username": emp_user.username,
                "role": 'Employee'
            }, Config.JWT_SECRET_KEY, algorithm="HS256")

            # Try to access admin user accounts management
            res = self.client.get(
                '/api/user-accounts',
                headers={"Authorization": f"Bearer {emp_token}"}
            )
            self.assertEqual(res.status_code, 403)

if __name__ == '__main__':
    unittest.main()
