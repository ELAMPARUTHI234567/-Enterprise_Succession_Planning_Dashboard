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

class TestEmployeeGoogleOnboardingAndRBAC(unittest.TestCase):
    """
    Exhaustive test suite covering all 10 required test cases:
    1. Existing active Employee Google account signs in successfully.
    2. New Google email starts the onboarding process.
    3. A pending employee cannot access the dashboard.
    4. HR approval activates the employee account.
    5. An approved employee reaches /employee-dashboard.
    6. A new user cannot register as HR or Manager.
    7. Existing HR and Manager Google login continue working.
    8. Duplicate email registration is rejected safely.
    9. Employees cannot access another employee's data.
    10. Existing password login remains functional.
    """

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

    def _mock_supabase_response(self, email, name=None):
        mock_resp = MagicMock()
        payload = {
            "email": email,
            "id": f"sub-{email}",
            "user_metadata": {
                "full_name": name or "",
                "name": name or ""
            }
        }
        mock_resp.read.return_value = json.dumps(payload).encode("utf-8")
        mock_resp.__enter__ = lambda s: s
        mock_resp.__exit__ = MagicMock(return_value=False)
        return mock_resp

    def test_01_existing_active_employee_google_signin(self):
        """Case 1: Existing active Employee Google account signs in successfully."""
        token = self._make_token("arun.google@gmail.com")
        mock_resp = self._mock_supabase_response("arun.google@gmail.com", name="Arun Kumar")

        with patch("urllib.request.urlopen", return_value=mock_resp):
            res = self.client.post("/api/supabase", json={"access_token": token})
            self.assertEqual(res.status_code, 200)
            data = res.get_json()
            self.assertTrue(data["success"])
            self.assertEqual(data["data"]["user"]["role"], "Employee")
            self.assertEqual(data["data"]["user"]["email"], "arun.google@gmail.com")
            
            # Verify issued token can access /api/me
            emp_token = data["data"]["token"]
            me_res = self.client.get("/api/me", headers={"Authorization": f"Bearer {emp_token}"})
            self.assertEqual(me_res.status_code, 200)
            self.assertEqual(me_res.get_json()["data"]["role"], "Employee")

    def test_02_new_google_email_starts_onboarding_and_registers_pending(self):
        """Case 2: New Google email starts the onboarding process and creates Pending account."""
        test_email = "alex.onboard.test@gmail.com"
        
        # Clean up any previous test artifacts
        with self.app.app_context():
            old_u = User.query.filter((User.email == test_email) | (User.oauth_email == test_email)).first()
            if old_u:
                old_emp = Employee.query.filter_by(user_id=old_u.id).first()
                if old_emp:
                    db.session.delete(old_emp)
                db.session.delete(old_u)
                db.session.commit()

        token = self._make_token(test_email)
        mock_resp = self._mock_supabase_response(test_email, name="Alex Rivera")

        # Step A: Supabase login indicates needs_onboarding
        with patch("urllib.request.urlopen", return_value=mock_resp):
            login_res = self.client.post("/api/supabase", json={"access_token": token})
            self.assertEqual(login_res.status_code, 404)
            data = login_res.get_json()
            self.assertFalse(data["success"])
            self.assertTrue(data.get("needs_onboarding"))
            self.assertEqual(data.get("verified_email"), test_email)
            self.assertEqual(data.get("verified_name"), "Alex Rivera")

        # Step B: Submit onboarding registration
        with patch("urllib.request.urlopen", return_value=mock_resp):
            onboard_res = self.client.post("/api/onboard-employee", json={
                "access_token": token,
                "name": "Alex Rivera",
                "department": "Engineering",
                "designation": "Staff Engineer"
            })
            self.assertEqual(onboard_res.status_code, 201)
            onboard_data = onboard_res.get_json()
            self.assertTrue(onboard_data["success"])
            self.assertEqual(onboard_data["status"], "Pending")
            self.assertEqual(onboard_data["data"]["user"]["role"], "Employee")
            self.assertEqual(onboard_data["data"]["user"]["status"], "Pending")
            self.assertIn("pending HR approval", onboard_data["message"])

    def test_03_pending_employee_cannot_access_dashboard(self):
        """Case 3: A pending employee cannot access the dashboard or protected APIs."""
        test_email = "alex.onboard.test@gmail.com"
        token = self._make_token(test_email)
        mock_resp = self._mock_supabase_response(test_email, name="Alex Rivera")

        # Login attempt returns 403 Pending
        with patch("urllib.request.urlopen", return_value=mock_resp):
            res = self.client.post("/api/supabase", json={"access_token": token})
            self.assertEqual(res.status_code, 403)
            data = res.get_json()
            self.assertFalse(data["success"])
            self.assertEqual(data.get("status"), "Pending")
            self.assertIn("pending HR approval", data["message"])

        # Direct API access with crafted token for pending user is also rejected
        with self.app.app_context():
            pending_user = User.query.filter_by(email=test_email).first()
            self.assertIsNotNone(pending_user)
            self.assertEqual(pending_user.status, "Pending")

            fake_token = jwt.encode({
                "sub": str(pending_user.id),
                "role": "Employee",
                "auth_email": test_email,
                "exp": 9999999999
            }, Config.JWT_SECRET_KEY, algorithm="HS256")

        me_res = self.client.get("/api/me", headers={"Authorization": f"Bearer {fake_token}"})
        self.assertEqual(me_res.status_code, 403)
        self.assertIn("pending HR approval", me_res.get_json()["message"])

    def test_04_hr_approval_activates_employee_account(self):
        """Case 4: HR approval activates the employee account."""
        test_email = "alex.onboard.test@gmail.com"
        
        # HR logs in with Google
        hr_token = self._make_token("elamparuthikp@gmail.com")
        mock_hr_resp = self._mock_supabase_response("elamparuthikp@gmail.com", name="Elamparuthi K P")

        with patch("urllib.request.urlopen", return_value=mock_hr_resp):
            login_res = self.client.post("/api/supabase", json={"access_token": hr_token})
            self.assertEqual(login_res.status_code, 200)
            app_hr_token = login_res.get_json()["data"]["token"]

        # HR lists pending user accounts
        pending_res = self.client.get(
            "/api/user-accounts/pending",
            headers={"Authorization": f"Bearer {app_hr_token}"}
        )
        self.assertEqual(pending_res.status_code, 200)
        pending_list = pending_res.get_json()["data"]
        matching = [u for u in pending_list if u["email"] == test_email]
        self.assertTrue(len(matching) > 0)
        pending_user_id = matching[0]["id"]

        # HR approves account
        approve_res = self.client.post(
            f"/api/user-accounts/{pending_user_id}/approve",
            headers={"Authorization": f"Bearer {app_hr_token}"}
        )
        self.assertEqual(approve_res.status_code, 200)
        self.assertEqual(approve_res.get_json()["data"]["status"], "Active")

        # Verify DB status
        with self.app.app_context():
            u = User.query.get(pending_user_id)
            self.assertEqual(u.status, "Active")

    def test_05_approved_employee_reaches_employee_dashboard(self):
        """Case 5: An approved employee reaches /employee-dashboard."""
        test_email = "alex.onboard.test@gmail.com"
        token = self._make_token(test_email)
        mock_resp = self._mock_supabase_response(test_email, name="Alex Rivera")

        with patch("urllib.request.urlopen", return_value=mock_resp):
            res = self.client.post("/api/supabase", json={"access_token": token})
            self.assertEqual(res.status_code, 200)
            data = res.get_json()["data"]
            self.assertEqual(data["user"]["role"], "Employee")
            self.assertEqual(data["user"]["status"], "Active")
            
            # Verify /api/me works and returns employee profile details
            emp_jwt = data["token"]
            me_res = self.client.get("/api/me", headers={"Authorization": f"Bearer {emp_jwt}"})
            self.assertEqual(me_res.status_code, 200)
            me_data = me_res.get_json()["data"]
            self.assertEqual(me_data["email"], test_email)
            self.assertEqual(me_data["department"], "Engineering")
            self.assertEqual(me_data["designation"], "Staff Engineer")

    def test_06_new_user_cannot_register_as_hr_or_manager(self):
        """Case 6: A new user cannot register as HR or Manager (role escalation blocked)."""
        bad_email = "unauthorized.admin.seeker@gmail.com"
        token = self._make_token(bad_email)
        mock_resp = self._mock_supabase_response(bad_email, name="Bad Actor")

        # Attempt to onboard requesting 'HR' role
        with patch("urllib.request.urlopen", return_value=mock_resp):
            res_hr = self.client.post("/api/onboard-employee", json={
                "access_token": token,
                "name": "Bad Actor",
                "department": "Security",
                "designation": "Hacker",
                "role": "HR"
            })
            self.assertEqual(res_hr.status_code, 403)
            self.assertIn("strictly limited to Employee", res_hr.get_json()["message"])

        # Attempt to onboard requesting 'Manager' role
        with patch("urllib.request.urlopen", return_value=mock_resp):
            res_mgr = self.client.post("/api/onboard-employee", json={
                "access_token": token,
                "name": "Bad Actor",
                "department": "Security",
                "designation": "Hacker",
                "role": "Manager"
            })
            self.assertEqual(res_mgr.status_code, 403)
            self.assertIn("strictly limited to Employee", res_mgr.get_json()["message"])

    def test_07_existing_hr_and_manager_google_login_continue_working(self):
        """Case 7: Existing HR and Manager Google login continue working without changes."""
        # 1. HR Account (elamparuthikp@gmail.com) -> role: HR
        hr_token = self._make_token("elamparuthikp@gmail.com")
        mock_hr = self._mock_supabase_response("elamparuthikp@gmail.com", name="Elamparuthi K P")

        with patch("urllib.request.urlopen", return_value=mock_hr):
            hr_res = self.client.post("/api/supabase", json={"access_token": hr_token})
            self.assertEqual(hr_res.status_code, 200)
            hr_data = hr_res.get_json()["data"]
            self.assertEqual(hr_data["user"]["role"], "HR")
            self.assertEqual(hr_data["user"]["email"], "elamparuthikp@gmail.com")

        # 2. Manager Account (elamparuthikp777@gmail.com) -> role: Manager
        mgr_token = self._make_token("elamparuthikp777@gmail.com")
        mock_mgr = self._mock_supabase_response("elamparuthikp777@gmail.com", name="Elamparuthi Manager")

        with patch("urllib.request.urlopen", return_value=mock_mgr):
            mgr_res = self.client.post("/api/supabase", json={"access_token": mgr_token})
            self.assertEqual(mgr_res.status_code, 200)
            mgr_data = mgr_res.get_json()["data"]
            self.assertEqual(mgr_data["user"]["role"], "Manager")
            self.assertEqual(mgr_data["user"]["email"], "elamparuthikp777@gmail.com")

    def test_08_duplicate_email_registration_rejected_safely(self):
        """Case 8: Duplicate email registration is rejected safely."""
        test_email = "alex.onboard.test@gmail.com"
        token = self._make_token(test_email)
        mock_resp = self._mock_supabase_response(test_email, name="Alex Rivera")

        with patch("urllib.request.urlopen", return_value=mock_resp):
            res = self.client.post("/api/onboard-employee", json={
                "access_token": token,
                "name": "Alex Rivera Duplicate",
                "department": "Engineering",
                "designation": "Staff Engineer"
            })
            self.assertEqual(res.status_code, 409)
            data = res.get_json()
            self.assertFalse(data["success"])
            self.assertIn("already exists", data["message"])

    def test_09_employees_cannot_access_another_employees_data(self):
        """Case 9: Employees cannot access another employee's data."""
        # Log in as Arun Kumar (Employee ID 3)
        token = self._make_token("arun.google@gmail.com")
        mock_resp = self._mock_supabase_response("arun.google@gmail.com")

        with patch("urllib.request.urlopen", return_value=mock_resp):
            login_res = self.client.post("/api/supabase", json={"access_token": token})
            emp_jwt = login_res.get_json()["data"]["token"]

        # Accessing own profile (Employee ID 1) succeeds with 200
        own_res = self.client.get("/api/employees/1", headers={"Authorization": f"Bearer {emp_jwt}"})
        self.assertEqual(own_res.status_code, 200)

        # Attempt to access another employee's detail (e.g. Employee ID 2) returns 403
        res = self.client.get("/api/employees/2", headers={"Authorization": f"Bearer {emp_jwt}"})
        self.assertEqual(res.status_code, 403)
        self.assertIn("Employees can only view their own profile", res.get_json()["message"])

        # Attempt to access restricted HR analytics returns 403
        analytics_res = self.client.get("/api/analytics", headers={"Authorization": f"Bearer {emp_jwt}"})
        self.assertEqual(analytics_res.status_code, 403)

    def test_10_existing_password_login_remains_functional(self):
        """Case 10: Existing password login remains functional."""
        # 1. HR password login
        hr_res = self.client.post("/api/login", json={"username": "hr", "password": "hr123"})
        self.assertEqual(hr_res.status_code, 200)
        self.assertEqual(hr_res.get_json()["data"]["user"]["role"], "HR")

        # 2. Manager password login
        mgr_res = self.client.post("/api/login", json={"username": "manager", "password": "manager123"})
        self.assertEqual(mgr_res.status_code, 200)
        self.assertEqual(mgr_res.get_json()["data"]["user"]["role"], "Manager")

        # 3. Invalid credentials rejected
        bad_res = self.client.post("/api/login", json={"username": "hr", "password": "wrongpassword"})
        self.assertEqual(bad_res.status_code, 401)


if __name__ == '__main__':
    unittest.main()
