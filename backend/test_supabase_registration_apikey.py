import os
import sys
import json
import unittest
from unittest.mock import patch, MagicMock
import jwt

os.environ['USE_SQLITE'] = 'true'
sys.path.insert(0, os.path.dirname(__file__))

from app import create_app
from extensions import db
from models.user import User
from models.employee import Employee
from config import Config

class TestSupabaseRegistrationApiKey(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = create_app()
        cls.app.config['TESTING'] = True
        cls.client = cls.app.test_client()

    def _make_token(self, email):
        supabase_url = getattr(Config, 'SUPABASE_URL', 'https://livemvqdyupoipuajury.supabase.co').rstrip('/')
        return jwt.encode({
            "iss": f"{supabase_url}/auth/v1",
            "sub": f"sub-{email}",
            "email": email
        }, "mock-secret-key-at-least-32-bytes-long", algorithm="HS256")

    def _mock_supabase_response(self, email, name="Test User"):
        mock_resp = MagicMock()
        payload = {
            "email": email,
            "id": f"sub-{email}",
            "user_metadata": {
                "full_name": name,
                "name": name
            }
        }
        mock_resp.read.return_value = json.dumps(payload).encode("utf-8")
        mock_resp.__enter__ = lambda s: s
        mock_resp.__exit__ = MagicMock(return_value=False)
        return mock_resp

    def test_01_backend_attaches_apikey_header_to_supabase_call(self):
        """Verify that validate_supabase_access_token always includes apikey header in outbound request."""
        from routes.auth import validate_supabase_access_token
        test_email = "employee.test.key@example.com"
        token = self._make_token(test_email)
        mock_resp = self._mock_supabase_response(test_email, name="Key Test Employee")

        captured_req = None
        def mock_urlopen(req):
            nonlocal captured_req
            captured_req = req
            return mock_resp

        with patch('urllib.request.urlopen', side_effect=mock_urlopen):
            email, real_name, err = validate_supabase_access_token(token)
            self.assertIsNone(err)
            self.assertEqual(email, test_email)
            self.assertIsNotNone(captured_req)
            self.assertEqual(captured_req.headers.get('Apikey'), Config.SUPABASE_ANON_KEY)
            self.assertEqual(captured_req.headers.get('Authorization'), f"Bearer {token}")

    def test_02_onboard_employee_passes_apikey_and_registers_pending(self):
        """Verify that /onboard-employee passes apikey and registers employee as Pending."""
        test_email = "sam.registration.pending@example.com"

        with self.app.app_context():
            old_u = User.query.filter((User.email == test_email) | (User.oauth_email == test_email)).first()
            if old_u:
                old_e = Employee.query.filter_by(user_id=old_u.id).first()
                if old_e:
                    db.session.delete(old_e)
                db.session.delete(old_u)
                db.session.commit()

        token = self._make_token(test_email)
        mock_resp = self._mock_supabase_response(test_email, name="Sam Pending")

        captured_req = None
        def mock_urlopen(req):
            nonlocal captured_req
            captured_req = req
            return mock_resp

        with patch('urllib.request.urlopen', side_effect=mock_urlopen):
            res = self.client.post('/api/onboard-employee', json={
                "access_token": token,
                "apikey": "custom_test_apikey_value",
                "name": "Sam Pending",
                "department": "Engineering",
                "designation": "Cloud Architect"
            })
            self.assertEqual(res.status_code, 201)
            data = res.get_json()
            self.assertTrue(data['success'])
            self.assertEqual(data['status'], 'Pending')
            self.assertEqual(data['data']['user']['role'], 'Employee')
            self.assertEqual(data['data']['user']['status'], 'Pending')
            # Outbound request must have captured custom apikey
            self.assertEqual(captured_req.headers.get('Apikey'), "custom_test_apikey_value")

    def test_03_duplicate_registration_prevented(self):
        """Verify that attempting to register an already pending email returns 409 Conflict."""
        test_email = "sam.registration.pending@example.com"
        token = self._make_token(test_email)
        mock_resp = self._mock_supabase_response(test_email, name="Sam Pending")

        with patch('urllib.request.urlopen', return_value=mock_resp):
            res = self.client.post('/api/onboard-employee', json={
                "access_token": token,
                "name": "Sam Pending Duplicate",
                "department": "Engineering",
                "designation": "Cloud Architect"
            })
            self.assertEqual(res.status_code, 409)
            data = res.get_json()
            self.assertFalse(data['success'])
            self.assertIn("already pending HR approval", data['message'])

    def test_04_role_escalation_blocked(self):
        """Verify that a registering user cannot request HR or Manager role."""
        test_email = "hacker.wannabe@example.com"
        token = self._make_token(test_email)
        mock_resp = self._mock_supabase_response(test_email, name="Hacker")

        with patch('urllib.request.urlopen', return_value=mock_resp):
            res = self.client.post('/api/onboard-employee', json={
                "access_token": token,
                "role": "HR",
                "name": "Hacker",
                "department": "Security",
                "designation": "Admin"
            })
            self.assertEqual(res.status_code, 403)
            data = res.get_json()
            self.assertFalse(data['success'])
            self.assertIn("strictly limited to Employee accounts", data['message'])

    def test_05_hr_approval_activates_account(self):
        """Verify HR user can approve pending registration to Active."""
        test_email = "sam.registration.pending@example.com"
        with self.app.app_context():
            user = User.query.filter((User.email == test_email) | (User.oauth_email == test_email)).first()
            self.assertIsNotNone(user)
            user_id = user.id

        # HR logs in with Google to get authentic app JWT
        hr_token = self._make_token("elamparuthikp@gmail.com")
        mock_hr_resp = self._mock_supabase_response("elamparuthikp@gmail.com", name="Elamparuthi K P")

        with patch("urllib.request.urlopen", return_value=mock_hr_resp):
            login_res = self.client.post("/api/supabase", json={"access_token": hr_token})
            self.assertEqual(login_res.status_code, 200)
            app_hr_token = login_res.get_json()["data"]["token"]

        res = self.client.post(
            f'/api/user-accounts/{user_id}/approve',
            headers={'Authorization': f'Bearer {app_hr_token}'}
        )
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data['success'])
        self.assertEqual(data['data']['status'], 'Active')

        with self.app.app_context():
            updated = User.query.get(user_id)
            self.assertEqual(updated.status, 'Active')

    def test_06_google_provider_token_rejected_cleanly(self):
        """Verify that sending a Google provider_token (starting with ya29.) returns 400 error."""
        res = self.client.post('/api/onboard-employee', json={
            "access_token": "ya29.a0AfH6SMB_fake_google_provider_token_12345",
            "name": "Provider Token User"
        })
        self.assertEqual(res.status_code, 400)
        data = res.get_json()
        self.assertFalse(data['success'])
        self.assertIn("Google provider_token instead of Supabase session.access_token", data['message'])

    def test_07_asymmetric_es256_jwks_signature_verification(self):
        """Verify that an ES256 token signed by an EC key can be verified cryptographically."""
        from cryptography.hazmat.primitives.asymmetric import ec
        from routes.auth import validate_supabase_access_token

        priv_key = ec.generate_private_key(ec.SECP256R1())
        pub_key = priv_key.public_key()
        kid = "test-ec-kid"

        supabase_url = getattr(Config, 'SUPABASE_URL', 'https://livemvqdyupoipuajury.supabase.co').rstrip('/')
        token = jwt.encode({
            "iss": f"{supabase_url}/auth/v1",
            "aud": "authenticated",
            "sub": "test-uuid-es256",
            "email": "es256.candidate@example.com",
            "exp": 9999999999,
            "user_metadata": {"full_name": "ES256 Candidate"}
        }, priv_key, algorithm="ES256", headers={"kid": kid})

        # Mock PyJWKClient to return pub_key
        mock_jwk = MagicMock()
        mock_jwk.key = pub_key
        mock_client = MagicMock()
        mock_client.get_signing_key_from_jwt.return_value = mock_jwk

        mock_resp = self._mock_supabase_response("es256.candidate@example.com", name="ES256 Candidate")

        with patch('routes.auth.get_jwks_client', return_value=mock_client):
            with patch('urllib.request.urlopen', return_value=mock_resp):
                email, real_name, err = validate_supabase_access_token(token)
                self.assertIsNone(err)
                self.assertEqual(email, "es256.candidate@example.com")
                self.assertEqual(real_name, "ES256 Candidate")

    def test_08_expired_token_rejected(self):
        """Verify that an expired token is rejected with 401."""
        from routes.auth import validate_supabase_access_token
        from cryptography.hazmat.primitives.asymmetric import ec

        priv_key = ec.generate_private_key(ec.SECP256R1())
        pub_key = priv_key.public_key()
        supabase_url = getattr(Config, 'SUPABASE_URL', 'https://livemvqdyupoipuajury.supabase.co').rstrip('/')

        expired_token = jwt.encode({
            "iss": f"{supabase_url}/auth/v1",
            "aud": "authenticated",
            "sub": "test-uuid-expired",
            "email": "expired@example.com",
            "exp": 1000000000  # Year 2001
        }, priv_key, algorithm="ES256", headers={"kid": "test-kid"})

        mock_jwk = MagicMock()
        mock_jwk.key = pub_key
        mock_client = MagicMock()
        mock_client.get_signing_key_from_jwt.return_value = mock_jwk

        with patch('routes.auth.get_jwks_client', return_value=mock_client):
            email, real_name, err = validate_supabase_access_token(expired_token)
            self.assertIsNotNone(err)
            self.assertEqual(err[1], 401)
            self.assertIn("expired", err[0]["message"].lower())

if __name__ == '__main__':
    unittest.main()
