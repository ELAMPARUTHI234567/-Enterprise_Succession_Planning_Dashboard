import unittest
import json
import jwt
from unittest.mock import patch, MagicMock
from app import create_app
from extensions import db
from models.user import User
from models.employee import Employee
from config import Config

class TestAuthIdentityVerification(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = create_app()
        cls.client = cls.app.test_client()

    def _make_token(self, email="elamparuthikp@gmail.com"):
        return jwt.encode({
            "iss": "https://livemvqdyupoipuajury.supabase.co/auth/v1",
            "sub": "mock-sub"
        }, "secret", algorithm="HS256")

    def _mock_supabase_response(self, email, name=None):
        mock_response = MagicMock()
        payload = {
            "email": email,
            "id": f"sub-{email}",
        }
        if name:
            payload["user_metadata"] = {"full_name": name, "name": name}
        mock_response.read.return_value = json.dumps(payload).encode("utf-8")
        mock_response.__enter__ = lambda s: s
        mock_response.__exit__ = MagicMock(return_value=False)
        return mock_response

    # Scenario 1: Existing HR Google Account opens HR Dashboard
    def test_01_hr_google_account_authenticated(self):
        token = self._make_token("elamparuthikp@gmail.com")
        mock_response = self._mock_supabase_response("elamparuthikp@gmail.com", name="Elamparuthi K P")

        with patch("urllib.request.urlopen", return_value=mock_response):
            res = self.client.post("/api/supabase", json={"access_token": token})
            self.assertEqual(res.status_code, 200)
            data = res.get_json()["data"]

            self.assertEqual(data["user"]["email"], "elamparuthikp@gmail.com")
            self.assertEqual(data["user"]["oauth_email"], "elamparuthikp@gmail.com")
            self.assertEqual(data["user"]["role"], "HR")

            # Verify /api/me
            app_token = data["token"]
            me_res = self.client.get("/api/me", headers={"Authorization": f"Bearer {app_token}"})
            self.assertEqual(me_res.status_code, 200)
            me_data = me_res.get_json()["data"]
            self.assertEqual(me_data["email"], "elamparuthikp@gmail.com")
            self.assertEqual(me_data["role"], "HR")

    # Scenario 2: Manager Google Account (elamparuthikp777@gmail.com) opens Manager Dashboard
    def test_02_manager_google_account_authenticated(self):
        token = self._make_token("elamparuthikp777@gmail.com")
        mock_response = self._mock_supabase_response("elamparuthikp777@gmail.com")

        with patch("urllib.request.urlopen", return_value=mock_response):
            res = self.client.post("/api/supabase", json={"access_token": token})
            self.assertEqual(res.status_code, 200)
            data = res.get_json()["data"]

            self.assertEqual(data["user"]["email"], "elamparuthikp777@gmail.com")
            self.assertEqual(data["user"]["oauth_email"], "elamparuthikp777@gmail.com")
            self.assertEqual(data["user"]["role"], "Manager")
            self.assertEqual(data["user"]["department"], "Operations")
            self.assertEqual(data["user"]["designation"], "Assistant Manager")

            # Verify /api/me returns Manager role and real email
            app_token = data["token"]
            me_res = self.client.get("/api/me", headers={"Authorization": f"Bearer {app_token}"})
            self.assertEqual(me_res.status_code, 200)
            me_data = me_res.get_json()["data"]
            self.assertEqual(me_data["email"], "elamparuthikp777@gmail.com")
            self.assertEqual(me_data["role"], "Manager")
            self.assertEqual(me_data["department"], "Operations")
            self.assertEqual(me_data["designation"], "Assistant Manager")

    # Scenario 3: Active Employee signs in with Google
    def test_03_active_employee_google_signin(self):
        token = self._make_token("arun.google@gmail.com")
        mock_response = self._mock_supabase_response("arun.google@gmail.com")

        with patch("urllib.request.urlopen", return_value=mock_response):
            res = self.client.post("/api/supabase", json={"access_token": token})
            self.assertEqual(res.status_code, 200)
            data = res.get_json()["data"]

            self.assertEqual(data["user"]["email"], "arun.google@gmail.com")
            self.assertEqual(data["user"]["role"], "Employee")

            # Verify /api/me
            app_token = data["token"]
            me_res = self.client.get("/api/me", headers={"Authorization": f"Bearer {app_token}"})
            self.assertEqual(me_res.status_code, 200)
            me_data = me_res.get_json()["data"]
            self.assertEqual(me_data["role"], "Employee")

    # Scenario 4: Unregistered Google email rejected with exact message
    def test_04_unregistered_google_account_rejected(self):
        token = self._make_token("unknown.candidate@gmail.com")
        mock_response = self._mock_supabase_response("unknown.candidate@gmail.com")

        with patch("urllib.request.urlopen", return_value=mock_response):
            res = self.client.post("/api/supabase", json={"access_token": token})
            self.assertEqual(res.status_code, 404)
            data = res.get_json()
            self.assertFalse(data["success"])
            self.assertEqual(
                data["message"],
                "Your employee account is not registered. Please contact HR to request access."
            )

    # Scenario 5: Inactive account is rejected
    def test_05_inactive_account_rejected(self):
        token = self._make_token("inactive.test@company.com")
        mock_response = self._mock_supabase_response("inactive.test@company.com")

        with patch("urllib.request.urlopen", return_value=mock_response):
            res = self.client.post("/api/supabase", json={"access_token": token})
            self.assertEqual(res.status_code, 403)
            data = res.get_json()
            self.assertFalse(data["success"])
            self.assertIn("deactivated", data["message"].lower())

    # Scenario 6: Employee cannot access Manager or HR APIs
    def test_06_employee_cannot_access_manager_or_hr_apis(self):
        token = self._make_token("arun.google@gmail.com")
        mock_response = self._mock_supabase_response("arun.google@gmail.com")

        with patch("urllib.request.urlopen", return_value=mock_response):
            res = self.client.post("/api/supabase", json={"access_token": token})
            emp_token = res.get_json()["data"]["token"]

        # User accounts (HR only) -> 403
        r1 = self.client.get("/api/user-accounts", headers={"Authorization": f"Bearer {emp_token}"})
        self.assertEqual(r1.status_code, 403)

        # Analytics (HR/Admin only) -> 403
        r2 = self.client.get("/api/analytics", headers={"Authorization": f"Bearer {emp_token}"})
        self.assertEqual(r2.status_code, 403)

        # Reports summary (HR/Manager only) -> 403
        r3 = self.client.get("/api/reports/summary", headers={"Authorization": f"Bearer {emp_token}"})
        self.assertEqual(r3.status_code, 403)

        # AI Role replacement (HR/Manager only) -> 403
        r4 = self.client.post("/api/ai/role-replacement", headers={"Authorization": f"Bearer {emp_token}"}, json={})
        self.assertEqual(r4.status_code, 403)

    # Scenario 7: Manager cannot access unrelated employee profile
    def test_07_manager_cannot_access_unrelated_employee(self):
        token = self._make_token("elamparuthikp777@gmail.com")
        mock_response = self._mock_supabase_response("elamparuthikp777@gmail.com")

        with patch("urllib.request.urlopen", return_value=mock_response):
            res = self.client.post("/api/supabase", json={"access_token": token})
            mgr_token = res.get_json()["data"]["token"]

        # Employee 5 (Vikram Singh) reports to someone else (manager_id = 4 or other)
        # Let's check employee 5:
        with self.app.app_context():
            emp5 = Employee.query.get(5)
            # User 2 is linked to Employee 4
            is_report = (emp5.manager_id == 4)

        if not is_report:
            res_unrelated = self.client.get("/api/employees/5", headers={"Authorization": f"Bearer {mgr_token}"})
            self.assertEqual(res_unrelated.status_code, 403)

        # Manager accessing direct report (Employee 1, Arun Kumar) -> 200
        res_report = self.client.get("/api/employees/1", headers={"Authorization": f"Bearer {mgr_token}"})
        self.assertEqual(res_report.status_code, 200)

    # Scenario 8: Demo names are never returned
    def test_08_no_demo_names_returned(self):
        token = self._make_token("elamparuthikp777@gmail.com")
        mock_response = self._mock_supabase_response("elamparuthikp777@gmail.com")

        with patch("urllib.request.urlopen", return_value=mock_response):
            res = self.client.post("/api/supabase", json={"access_token": token})
            data = res.get_json()["data"]
            name = (data["user"]["name"] or "").lower()
            self.assertNotIn("sarah jenkins", name)
            self.assertNotIn("sneha reddy", name)

    # Scenario 9: Existing password login works
    def test_09_existing_password_login_works(self):
        # HR password login
        res_hr = self.client.post("/api/login", json={"username": "hr", "password": "hr123"})
        self.assertEqual(res_hr.status_code, 200)
        self.assertEqual(res_hr.get_json()["data"]["user"]["role"], "HR")

        # Manager password login
        res_mgr = self.client.post("/api/login", json={"username": "manager", "password": "manager123"})
        self.assertEqual(res_mgr.status_code, 200)
        self.assertEqual(res_mgr.get_json()["data"]["user"]["role"], "Manager")

        # Employee password login
        res_emp = self.client.post("/api/login", json={"username": "arun.kumar", "password": "employee123"})
        self.assertEqual(res_emp.status_code, 200)
        self.assertEqual(res_emp.get_json()["data"]["user"]["role"], "Employee")

if __name__ == "__main__":
    unittest.main()
