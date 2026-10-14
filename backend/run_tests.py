"""
Test runner for auth baseline and new Google OAuth role routing tests.
Run with: python run_tests.py (from the backend directory, using the project venv)
"""
import os
import sys
import unittest

os.environ['USE_SQLITE'] = 'true'
sys.path.insert(0, os.path.dirname(__file__))

# Import test modules
import test_auth_baseline
import test_employee_google_onboarding
import jwt
from unittest.mock import patch, MagicMock
from app import create_app
from extensions import db
from models.user import User
from config import Config


class TestGoogleOAuthRoleRouting(unittest.TestCase):
    """Tests for the Google Sign-In role-based routing requirements."""

    def setUp(self):
        self.app = create_app()
        self.app.config['TESTING'] = True
        self.client = self.app.test_client()

    def _make_supabase_token(self, email):
        supabase_url = getattr(Config, 'SUPABASE_URL', 'https://livemvqdyupoipuajury.supabase.co')
        payload = {
            "iss": f"{supabase_url}/auth/v1",
            "sub": f"test-uid-{email}",
            "email": email,
            "aud": "authenticated"
        }
        return jwt.encode(payload, "test-secret-long-enough-for-hs256-signing-test", algorithm="HS256")

    def test_hr_google_signin_routes_to_hr(self):
        """Test 1: HR account (elamparuthikp@gmail.com) via Google gets HR role."""
        token = self._make_supabase_token("elamparuthikp@gmail.com")
        mock_response_body = '{"email": "elamparuthikp@gmail.com", "user_metadata": {"full_name": "Elamparuthi K P"}}'.encode()

        with patch('urllib.request.urlopen') as mock_urlopen:
            mock_resp = MagicMock()
            mock_resp.read.return_value = mock_response_body
            mock_resp.__enter__ = lambda s: s
            mock_resp.__exit__ = MagicMock(return_value=False)
            mock_urlopen.return_value = mock_resp

            res = self.client.post('/api/supabase', json={"access_token": token})
            self.assertEqual(res.status_code, 200)
            data = res.get_json()
            self.assertTrue(data['success'])
            self.assertEqual(data['data']['user']['role'], 'HR')
            self.assertEqual(data['data']['user']['email'], 'elamparuthikp@gmail.com')
            print(f"[PASS] Test 1: elamparuthikp@gmail.com gets HR role in response.")

    def test_manager_google_signin_routes_to_manager(self):
        """Test 2: Manager account (elamparuthikp777@gmail.com) via Google gets Manager role."""
        token = self._make_supabase_token("elamparuthikp777@gmail.com")
        mock_response_body = '{"email": "elamparuthikp777@gmail.com"}'.encode()

        with patch('urllib.request.urlopen') as mock_urlopen:
            mock_resp = MagicMock()
            mock_resp.read.return_value = mock_response_body
            mock_resp.__enter__ = lambda s: s
            mock_resp.__exit__ = MagicMock(return_value=False)
            mock_urlopen.return_value = mock_resp

            res = self.client.post('/api/supabase', json={"access_token": token})
            self.assertEqual(res.status_code, 200)
            data = res.get_json()
            self.assertTrue(data['success'])
            self.assertEqual(data['data']['user']['role'], 'Manager')
            self.assertEqual(data['data']['user']['email'], 'elamparuthikp777@gmail.com')
            print(f"[PASS] Test 2: elamparuthikp777@gmail.com gets Manager role in response.")

    def test_active_employee_google_signin_routes_to_employee(self):
        """Test 3: Active Employee account via Google gets Employee role."""
        token = self._make_supabase_token("arun.google@gmail.com")
        mock_response_body = '{"email": "arun.google@gmail.com", "id": "test-arun"}'.encode()

        with patch('urllib.request.urlopen') as mock_urlopen:
            mock_resp = MagicMock()
            mock_resp.read.return_value = mock_response_body
            mock_resp.__enter__ = lambda s: s
            mock_resp.__exit__ = MagicMock(return_value=False)
            mock_urlopen.return_value = mock_resp

            res = self.client.post('/api/supabase', json={"access_token": token})
            self.assertEqual(res.status_code, 200)
            data = res.get_json()
            self.assertTrue(data['success'])
            self.assertEqual(data['data']['user']['role'], 'Employee')
            print(f"[PASS] Test 3: Active employee arun.google@gmail.com signs in successfully.")

    def test_unmapped_google_email_triggers_onboarding(self):
        """Test 4: Unmapped Google email triggers onboarding metadata."""
        token = self._make_supabase_token("unknown.person@gmail.com")
        mock_response_body = '{"email": "unknown.person@gmail.com"}'.encode()

        with patch('urllib.request.urlopen') as mock_urlopen:
            mock_resp = MagicMock()
            mock_resp.read.return_value = mock_response_body
            mock_resp.__enter__ = lambda s: s
            mock_resp.__exit__ = MagicMock(return_value=False)
            mock_urlopen.return_value = mock_resp

            res = self.client.post('/api/supabase', json={"access_token": token})
            self.assertEqual(res.status_code, 404)
            data = res.get_json()
            self.assertFalse(data['success'])
            self.assertTrue(data.get('needs_onboarding'))
            self.assertEqual(data.get('verified_email'), 'unknown.person@gmail.com')
            print(f"[PASS] Test 4: Unmapped email returns needs_onboarding=True. Message: {data['message']}")

    def test_inactive_user_rejected(self):
        """Test 5: Inactive user is rejected."""
        token = self._make_supabase_token("inactive.test@company.com")
        mock_response_body = '{"email": "inactive.test@company.com"}'.encode()

        with patch('urllib.request.urlopen') as mock_urlopen:
            mock_resp = MagicMock()
            mock_resp.read.return_value = mock_response_body
            mock_resp.__enter__ = lambda s: s
            mock_resp.__exit__ = MagicMock(return_value=False)
            mock_urlopen.return_value = mock_resp

            res = self.client.post('/api/supabase', json={"access_token": token})
            self.assertEqual(res.status_code, 403)
            data = res.get_json()
            self.assertFalse(data['success'])
            self.assertIn('deactivated', data['message'].lower())
            print(f"[PASS] Test 5: Inactive user rejected. Message: {data['message']}")

    def test_legacy_password_login_still_works(self):
        """Test 6: Password login still functional."""
        res = self.client.post('/api/login', json={"username": "hr", "password": "hr123"})
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data['success'])
        self.assertEqual(data['data']['user']['role'], 'HR')
        print(f"[PASS] Test 6: HR password login works. Role: {data['data']['user']['role']}")


def run_all():
    baseline_suite = unittest.TestLoader().loadTestsFromModule(test_auth_baseline)
    role_suite = unittest.TestLoader().loadTestsFromTestCase(TestGoogleOAuthRoleRouting)
    onboard_suite = unittest.TestLoader().loadTestsFromModule(test_employee_google_onboarding)
    all_tests = unittest.TestSuite([baseline_suite, role_suite, onboard_suite])
    
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(all_tests)
    return result


if __name__ == '__main__':
    result = run_all()
    sys.exit(0 if result.wasSuccessful() else 1)
