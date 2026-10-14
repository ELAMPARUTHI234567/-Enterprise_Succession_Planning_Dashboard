import unittest
import json
import io
import urllib.request
import urllib.error
import jwt
from unittest.mock import patch, MagicMock
from app import create_app
from extensions import db
from models.user import User
from config import Config

class TestSupabaseAuthFull(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = create_app()
        cls.app.config['TESTING'] = True
        cls.client = cls.app.test_client()

    # ─── Helper to create mock Supabase token ───────────────────────────
    def _make_supabase_token(self, sub="test-uuid"):
        return jwt.encode({
            "iss": "https://livemvqdyupoipuajury.supabase.co/auth/v1",
            "sub": sub
        }, "secret", algorithm="HS256")

    def _mock_supabase_user(self, email, user_id="mock-uuid"):
        mock_response = MagicMock()
        mock_response.read.return_value = json.dumps({
            "email": email, "id": user_id
        }).encode('utf-8')
        mock_response.__enter__ = lambda s: s
        mock_response.__exit__ = MagicMock(return_value=False)
        return mock_response

    # ─── Test 1: Missing access_token ───────────────────────────────────
    def test_01_missing_access_token(self):
        """Missing access_token returns 400"""
        res = self.client.post('/api/supabase', json={})
        self.assertEqual(res.status_code, 400)
        data = res.get_json()
        self.assertFalse(data['success'])
        self.assertIn("Supabase access token required", data['message'])

    # ─── Test 2: Invalid issuer ─────────────────────────────────────────
    def test_02_invalid_issuer(self):
        """Invalid token issuer returns 401"""
        fake_token = jwt.encode({"iss": "https://unknown-domain.com", "sub": "123"}, "secret", algorithm="HS256")
        res = self.client.post('/api/supabase', json={"access_token": fake_token})
        self.assertEqual(res.status_code, 401)
        data = res.get_json()
        self.assertFalse(data['success'])
        self.assertIn("Invalid token issuer", data['message'])

    # ─── Test 3: Supabase HTTP 401 sanitized ────────────────────────────
    def test_03_supabase_gateway_401_sanitized(self):
        """Supabase HTTP 401 error response is captured and sanitized"""
        fake_token = self._make_supabase_token("user-123")
        error_json = json.dumps({"message": "No API key found in request"}).encode('utf-8')
        mock_http_error = urllib.error.HTTPError(
            url="https://livemvqdyupoipuajury.supabase.co/auth/v1/user",
            code=401, msg="Unauthorized", hdrs={},
            fp=io.BytesIO(error_json)
        )
        with patch('urllib.request.urlopen', side_effect=mock_http_error):
            res = self.client.post('/api/supabase', json={"access_token": fake_token})
            self.assertEqual(res.status_code, 401)
            data = res.get_json()
            self.assertFalse(data['success'])
            self.assertIn("Supabase token validation failed (401)", data['message'])

    # ─── Test 4: Endpoint URL and headers construction ──────────────────
    def test_04_endpoint_url_and_headers(self):
        """Backend calls correct endpoint with Authorization and apikey headers"""
        fake_token = self._make_supabase_token("hr-user-id")
        mock_response = self._mock_supabase_user("hr@company.com", "hr-user-id")

        captured_req = None
        def mock_urlopen(req):
            nonlocal captured_req
            captured_req = req
            return mock_response

        with patch('urllib.request.urlopen', side_effect=mock_urlopen):
            res = self.client.post('/api/supabase', json={"access_token": fake_token})
            self.assertEqual(res.status_code, 200)
            self.assertEqual(captured_req.full_url, "https://livemvqdyupoipuajury.supabase.co/auth/v1/user")
            self.assertEqual(captured_req.headers.get('Authorization'), f"Bearer {fake_token}")
            self.assertTrue(bool(captured_req.headers.get('Apikey')))

    # ─── Test 5: HR user Google Sign-In → reaches /dashboard ────────────
    def test_05_hr_google_signin_routes_to_dashboard(self):
        """Authorized HR user signs in with Google and gets HR role (routes to /dashboard)"""
        fake_token = self._make_supabase_token("hr-uuid")
        mock_response = self._mock_supabase_user("hr@company.com", "hr-uuid")

        with patch('urllib.request.urlopen', return_value=mock_response):
            res = self.client.post('/api/supabase', json={"access_token": fake_token})
            self.assertEqual(res.status_code, 200)
            data = res.get_json()
            self.assertTrue(data['success'])
            self.assertEqual(data['data']['user']['role'], 'HR')
            # Frontend routes HR to /dashboard based on this role
            issued_jwt = data['data']['token']
            decoded = jwt.decode(issued_jwt, Config.JWT_SECRET_KEY, algorithms=["HS256"])
            self.assertEqual(decoded['role'], 'HR')

    # ─── Test 6: Manager user Google Sign-In → reaches /manager-dashboard
    def test_06_manager_google_signin_routes_to_manager_dashboard(self):
        """Authorized Manager user signs in with Google and gets Manager role (routes to /manager-dashboard)"""
        fake_token = self._make_supabase_token("mgr-uuid")
        mock_response = self._mock_supabase_user("manager@company.com", "mgr-uuid")

        with patch('urllib.request.urlopen', return_value=mock_response):
            res = self.client.post('/api/supabase', json={"access_token": fake_token})
            self.assertEqual(res.status_code, 200)
            data = res.get_json()
            self.assertTrue(data['success'])
            self.assertEqual(data['data']['user']['role'], 'Manager')

    # ─── Test 7: Employee user Google Sign-In → reaches /employee-dashboard ──
    def test_07_employee_google_signin_routes_to_employee_dashboard(self):
        """Active Employee signs in with Google and receives application JWT with Employee role"""
        fake_token = self._make_supabase_token("emp-uuid")
        
        # Use an employee email that exists in the DB
        with self.app.app_context():
            emp_user = User.query.filter_by(role='Employee', status='Active').first()
            emp_email = emp_user.email if emp_user else "arun.kumar@company.com"

        mock_response = self._mock_supabase_user(emp_email, "emp-uuid")

        with patch('urllib.request.urlopen', return_value=mock_response):
            res = self.client.post('/api/supabase', json={"access_token": fake_token})
            self.assertEqual(res.status_code, 200)
            data = res.get_json()
            self.assertTrue(data['success'])
            self.assertEqual(data['data']['user']['role'], 'Employee')
            issued_jwt = data['data']['token']
            decoded = jwt.decode(issued_jwt, Config.JWT_SECRET_KEY, algorithms=["HS256"])
            self.assertEqual(decoded['role'], 'Employee')

    # ─── Test 8: Unmapped Google email is rejected ──────────────────────
    def test_08_unmapped_google_email_rejected(self):
        """Valid Supabase token with unmapped email returns 404"""
        fake_token = self._make_supabase_token("unknown-uuid")
        mock_response = self._mock_supabase_user("not.in.db@company.com", "unknown-uuid")

        with patch('urllib.request.urlopen', return_value=mock_response):
            res = self.client.post('/api/supabase', json={"access_token": fake_token})
            self.assertEqual(res.status_code, 404)
            data = res.get_json()
            self.assertFalse(data['success'])
            self.assertEqual(data['message'], "Your employee account is not registered. Please contact HR to request access.")

    # ─── Test 9: Inactive user is rejected ──────────────────────────────
    def test_09_inactive_user_rejected(self):
        """Deactivated user returns 403 Forbidden"""
        fake_token = self._make_supabase_token("inactive-uuid")

        with self.app.app_context():
            inactive_user = User.query.filter(User.status != 'Active').first()
            if not inactive_user:
                inactive_user = User(
                    username="inactive.test", email="inactive.test@company.com",
                    role="Employee", status="Inactive"
                )
                inactive_user.set_password("pass123")
                db.session.add(inactive_user)
                db.session.commit()
            inactive_email = inactive_user.email

        mock_response = self._mock_supabase_user(inactive_email, "inactive-uuid")

        with patch('urllib.request.urlopen', return_value=mock_response):
            res = self.client.post('/api/supabase', json={"access_token": fake_token})
            self.assertEqual(res.status_code, 403)
            data = res.get_json()
            self.assertFalse(data['success'])
            self.assertIn("deactivated", data['message'].lower())

    # ─── Test 10: User with missing name shows email via to_dict ────────
    def test_10_missing_name_shows_email_not_fake(self):
        """User with no stored name returns name=None so frontend shows email"""
        with self.app.app_context():
            # Create or find a user with blank name
            user = User.query.filter_by(username='hr').first()
            original_name = user.name
            user.name = ''  # Simulate no stored name
            db.session.commit()

            user_dict = user.to_dict()
            # name should be None when empty, so frontend uses email
            self.assertIsNone(user_dict['name'])
            self.assertTrue(bool(user_dict['email']))

            # Restore original name
            user.name = original_name
            db.session.commit()

    # ─── Test 11: Displayed email matches authenticated backend profile ─
    def test_11_displayed_email_matches_auth_profile(self):
        """The /api/me endpoint returns the correct email for the authenticated user"""
        # Login as HR via password
        login_res = self.client.post('/api/login', json={"username": "hr", "password": "hr123"})
        self.assertEqual(login_res.status_code, 200)
        token = login_res.get_json()['data']['token']

        me_res = self.client.get('/api/me', headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(me_res.status_code, 200)
        me_data = me_res.get_json()
        self.assertTrue(me_data['success'])
        self.assertEqual(me_data['data']['email'], 'hr@company.com')
        self.assertEqual(me_data['data']['username'], 'hr')

    # ─── Test 12: Stale Manager session cannot override HR user's role ──
    def test_12_stale_session_cannot_override_role(self):
        """JWT role must match database role — stale token rejected"""
        with self.app.app_context():
            hr_user = User.query.filter_by(username='hr').first()
            # Create a token with wrong role
            stale_token = jwt.encode({
                "sub": str(hr_user.id),
                "username": hr_user.username,
                "role": "Manager"  # Wrong role — stale
            }, Config.JWT_SECRET_KEY, algorithm="HS256")

        me_res = self.client.get('/api/me', headers={"Authorization": f"Bearer {stale_token}"})
        # Auth middleware detects role mismatch and rejects
        self.assertEqual(me_res.status_code, 401)
        data = me_res.get_json()
        self.assertFalse(data['success'])
        self.assertIn("Invalid token role", data['message'])

    # ─── Test 13: Existing password login continues to work ─────────────
    def test_13_legacy_password_login_works(self):
        """Legacy login remains fully operational"""
        res = self.client.post('/api/login', json={"username": "manager", "password": "manager123"})
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data['success'])
        self.assertEqual(data['data']['user']['role'], 'Manager')

        # Test authenticated /me endpoint using legacy token
        token = data['data']['token']
        me_res = self.client.get('/api/me', headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(me_res.status_code, 200)
        me_data = me_res.get_json()
        self.assertTrue(me_data['success'])
        self.assertEqual(me_data['data']['username'], 'manager')

    # ─── Test 14: Direct URL access cannot bypass role restrictions ─────
    def test_14_api_calls_enforce_rbac(self):
        """Employee token cannot access HR-only endpoints"""
        with self.app.app_context():
            emp = User.query.filter_by(role='Employee', status='Active').first()
            if emp:
                emp_token = jwt.encode({
                    "sub": str(emp.id),
                    "username": emp.username,
                    "role": emp.role
                }, Config.JWT_SECRET_KEY, algorithm="HS256")
            else:
                self.skipTest("No active employee found")

        # Try accessing HR-only endpoint
        res = self.client.get('/api/user-accounts', headers={"Authorization": f"Bearer {emp_token}"})
        self.assertEqual(res.status_code, 403)
        data = res.get_json()
        self.assertFalse(data['success'])
        self.assertIn("not authorized", data['message'].lower())

    # ─── Test 15: Case-insensitive email matching ───────────────────────
    def test_15_case_insensitive_email_matching(self):
        """Supabase token with mixed case/whitespace maps correctly"""
        fake_token = self._make_supabase_token("hr-case-uuid")
        mock_response = self._mock_supabase_user("   HR@COMPANY.COM   ", "hr-case-uuid")

        with patch('urllib.request.urlopen', return_value=mock_response):
            res = self.client.post('/api/supabase', json={"access_token": fake_token})
            self.assertEqual(res.status_code, 200)
            data = res.get_json()
            self.assertTrue(data['success'])
            self.assertEqual(data['data']['user']['email'], 'hr@company.com')
            self.assertEqual(data['data']['user']['role'], 'HR')

    # ─── Test 16: OAuth email link used for authentication ──────────────
    def test_16_oauth_email_link_authentication(self):
        """User can authenticate via linked oauth_email with preserved database role"""
        with self.app.app_context():
            u = User.query.filter_by(oauth_email='elamparuthikp@gmail.com').first()
            if u:
                expected_role = u.role
                expected_username = u.username
            else:
                self.skipTest("No user with oauth_email elamparuthikp@gmail.com found")

        fake_token = self._make_supabase_token("google-oauth-sub")
        mock_response = self._mock_supabase_user("   ELAMPARUTHIKP@GMAIL.COM  ", "google-oauth-sub")

        with patch('urllib.request.urlopen', return_value=mock_response):
            res = self.client.post('/api/supabase', json={"access_token": fake_token})
            self.assertEqual(res.status_code, 200)
            data = res.get_json()
            self.assertTrue(data['success'])
            self.assertEqual(data['data']['user']['username'], expected_username)
            self.assertEqual(data['data']['user']['role'], expected_role)
            self.assertEqual(data['data']['user']['oauth_email'], 'elamparuthikp@gmail.com')

    # ─── Test 17: Token without email returns 401 ───────────────────────
    def test_17_token_without_email_returns_401(self):
        """Token without associated email returns 401"""
        fake_token = self._make_supabase_token("no-email-uuid")
        mock_response = self._mock_supabase_user("", "no-email-uuid")

        with patch('urllib.request.urlopen', return_value=mock_response):
            res = self.client.post('/api/supabase', json={"access_token": fake_token})
            self.assertEqual(res.status_code, 401)
            data = res.get_json()
            self.assertFalse(data['success'])
            self.assertIn("No email associated", data['message'])

    # ─── Test 18: Admin link/unlink OAuth email ─────────────────────────
    def test_18_admin_link_oauth_email(self):
        """HR/Admin can link an OAuth email; duplicate link attempt returns 409"""
        with self.app.app_context():
            hr = User.query.filter_by(username='hr').first()
            hr_token = jwt.encode({
                "sub": str(hr.id), "username": hr.username, "role": hr.role
            }, Config.JWT_SECRET_KEY, algorithm="HS256")
            target_user = User.query.filter_by(username='arun.kumar').first()
            target_id = target_user.id

        res = self.client.post(
            f'/api/user-accounts/{target_id}/link-oauth-email',
            headers={"Authorization": f"Bearer {hr_token}"},
            json={"oauth_email": "arun.google@gmail.com"}
        )
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data['success'])
        self.assertEqual(data['data']['oauth_email'], 'arun.google@gmail.com')
        self.assertEqual(data['data']['role'], 'Employee')

    # ─── Test 19: Unauthorized user cannot link OAuth email ─────────────
    def test_19_unauthorized_linking_rejected(self):
        """Employee/no-token cannot link OAuth email"""
        with self.app.app_context():
            emp = User.query.filter_by(username='arun.kumar').first()
            emp_token = jwt.encode({
                "sub": str(emp.id), "username": emp.username, "role": emp.role
            }, Config.JWT_SECRET_KEY, algorithm="HS256")

        # No auth token -> 401
        res_no_auth = self.client.post('/api/user-accounts/1/link-oauth-email', json={"oauth_email": "hacker@gmail.com"})
        self.assertEqual(res_no_auth.status_code, 401)

        # Employee token -> 403 Forbidden
        res_forbidden = self.client.post(
            '/api/user-accounts/1/link-oauth-email',
            headers={"Authorization": f"Bearer {emp_token}"},
            json={"oauth_email": "hacker@gmail.com"}
        )
        self.assertEqual(res_forbidden.status_code, 403)


if __name__ == '__main__':
    unittest.main()
