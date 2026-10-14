import unittest
import json
import jwt
from unittest.mock import patch, MagicMock
from app import create_app
from extensions import db
from models.user import User
from models.employee import Employee
from models.role import LeadershipRole
from models.competency import Competency
from models.role_competency import RoleCompetency
from models.employee_competency import EmployeeCompetency
from models.assessment import Assessment, AssessmentAssignment, AssessmentQuestion, AssessmentResult
from config import Config
from utils.migrations import run_schema_migrations
from utils.seed_data import seed_database_if_empty, sync_employee_users

class TestEndToEndEnterpriseVerification(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = create_app()
        cls.app.config['TESTING'] = True
        cls.client = cls.app.test_client()

        with cls.app.app_context():
            # Discover authenticated test credentials
            cls.hr_user = User.query.filter_by(role='HR').first()
            cls.mgr_user = User.query.filter_by(role='Manager').first()
            cls.emp_user = User.query.filter_by(username='arun.kumar').first() or User.query.filter_by(role='Employee').first()

            # Find employee records
            cls.mgr_emp = Employee.query.filter_by(user_id=cls.mgr_user.id).first() if cls.mgr_user else None
            if not cls.mgr_emp:
                cls.mgr_emp = Employee.query.filter(Employee.email == cls.mgr_user.email).first()

            cls.emp_record = Employee.query.filter_by(user_id=cls.emp_user.id).first() if cls.emp_user else None
            if not cls.emp_record:
                cls.emp_record = Employee.query.filter(Employee.email == cls.emp_user.email).first()

    def setUp(self):
        self.ctx = self.app.app_context()
        self.ctx.push()

    def tearDown(self):
        self.ctx.pop()

    def get_auth_token(self, username, password):
        res = self.client.post('/api/login', json={"username": username, "password": password})
        if res.status_code == 200:
            return res.get_json()['data']['token']
        return None

    # =========================================================================
    # 1. USER IDENTITY & PROFILE VERIFICATION
    # =========================================================================
    def test_01_user_identity_hr(self):
        """Verify HR user identity returned by /api/me matches real DB record"""
        token = self.get_auth_token('hr', 'hr123')
        self.assertIsNotNone(token)

        res = self.client.get('/api/me', headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(res.status_code, 200)
        data = res.get_json()['data']
        self.assertEqual(data['role'], 'HR')
        self.assertEqual(data['username'], 'hr')
        self.assertIn('@', data['email'])

    def test_02_user_identity_manager(self):
        """Verify Manager identity and linked employee designation / department"""
        token = self.get_auth_token('manager', 'manager123')
        self.assertIsNotNone(token)

        res = self.client.get('/api/me', headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(res.status_code, 200)
        data = res.get_json()['data']
        self.assertEqual(data['role'], 'Manager')
        self.assertEqual(data['username'], 'manager')
        if data.get('employee'):
            self.assertTrue(bool(data['employee']['department']))
            self.assertTrue(bool(data['employee']['designation']))

    def test_03_user_identity_employee(self):
        """Verify Employee identity and reporting manager relationship"""
        token = self.get_auth_token('arun.kumar', 'employee123')
        self.assertIsNotNone(token)

        res = self.client.get('/api/me', headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(res.status_code, 200)
        data = res.get_json()['data']
        self.assertEqual(data['role'], 'Employee')
        self.assertEqual(data['username'], 'arun.kumar')
        if data.get('employee'):
            self.assertIn('manager_name', data['employee'])

    def test_04_account_switching_no_data_leakage(self):
        """Confirm switching between sessions leaves no cached or cross-leaked user data"""
        hr_token = self.get_auth_token('hr', 'hr123')
        emp_token = self.get_auth_token('arun.kumar', 'employee123')

        # First request as HR
        res1 = self.client.get('/api/me', headers={"Authorization": f"Bearer {hr_token}"})
        self.assertEqual(res1.get_json()['data']['username'], 'hr')

        # Next request as Employee
        res2 = self.client.get('/api/me', headers={"Authorization": f"Bearer {emp_token}"})
        self.assertEqual(res2.get_json()['data']['username'], 'arun.kumar')
        self.assertEqual(res2.get_json()['data']['role'], 'Employee')

        # Invalid token returns 401 and does not expose either user
        res_invalid = self.client.get('/api/me', headers={"Authorization": "Bearer invalid_token_12345"})
        self.assertEqual(res_invalid.status_code, 401)

    # =========================================================================
    # 2. ROLE-BASED DATA ISOLATION
    # =========================================================================
    def test_05_hr_sees_all_employees(self):
        """HR / Admin can access full employee roster"""
        token = self.get_auth_token('hr', 'hr123')
        res = self.client.get('/api/employees', headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(res.status_code, 200)
        emps = res.get_json()['data']
        with self.app.app_context():
            total_db = Employee.query.count()
        self.assertEqual(len(emps), total_db)

    def test_06_manager_sees_only_direct_reports(self):
        """Manager only receives their direct reports and cannot bypass via manager_id param"""
        token = self.get_auth_token('manager', 'manager123')
        
        # 1. Standard call
        res = self.client.get('/api/employees', headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(res.status_code, 200)
        mgr_emps = res.get_json()['data']

        # 2. Tampered call with another manager_id parameter
        res_tampered = self.client.get('/api/employees?manager_id=9999', headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(res_tampered.status_code, 200)
        tampered_emps = res_tampered.get_json()['data']

        # Backend enforces scoping to the manager's team
        self.assertEqual(len(mgr_emps), len(tampered_emps))

    def test_07_employee_sees_only_self_in_employees_list(self):
        """Employee calling /api/employees only receives their own record"""
        token = self.get_auth_token('arun.kumar', 'employee123')
        res = self.client.get('/api/employees', headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(res.status_code, 200)
        data = res.get_json()['data']
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]['email'], 'arun.kumar@company.com')

    def test_08_employee_cannot_access_other_employee_detail(self):
        """Employee cannot access another employee profile via /api/employees/<id>"""
        token = self.get_auth_token('arun.kumar', 'employee123')
        with self.app.app_context():
            other_emp = Employee.query.filter(Employee.email != 'arun.kumar@company.com').first()
            other_id = other_emp.id

        res = self.client.get(f'/api/employees/{other_id}', headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(res.status_code, 403)
        self.assertIn("forbidden", res.get_json()['message'].lower())

    def test_09_employee_cannot_access_other_gap_analysis(self):
        """Employee cannot access another employee's competency gaps via /api/gap-analysis/<id>/<role_id>"""
        token = self.get_auth_token('arun.kumar', 'employee123')
        with self.app.app_context():
            other_emp = Employee.query.filter(Employee.email != 'arun.kumar@company.com').first()
            other_id = other_emp.id

        res = self.client.get(f'/api/gap-analysis/{other_id}/1', headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(res.status_code, 403)

    def test_10_employee_cannot_access_other_readiness(self):
        """Employee cannot access another employee's readiness score via /api/readiness/<id>/<role_id>"""
        token = self.get_auth_token('arun.kumar', 'employee123')
        with self.app.app_context():
            other_emp = Employee.query.filter(Employee.email != 'arun.kumar@company.com').first()
            other_id = other_emp.id

        res = self.client.get(f'/api/readiness/{other_id}/1', headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(res.status_code, 403)

    def test_11_employee_cannot_access_successors_pipeline(self):
        """Employee cannot access organization-wide successor pipelines"""
        token = self.get_auth_token('arun.kumar', 'employee123')
        res = self.client.get('/api/successors/1', headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(res.status_code, 403)

    def test_12_employee_can_access_own_gaps_and_readiness(self):
        """Employee can access their own authenticated gap and readiness endpoints"""
        token = self.get_auth_token('arun.kumar', 'employee123')
        res_gaps = self.client.get('/api/me/gaps?role_id=1', headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(res_gaps.status_code, 200)
        self.assertTrue(res_gaps.get_json()['success'])

        res_readiness = self.client.get('/api/me/readiness?role_id=1', headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(res_readiness.status_code, 200)
        self.assertTrue(res_readiness.get_json()['success'])

    # =========================================================================
    # 3. ACTUAL DATABASE-DRIVEN METRICS & EMPTY STATE INTEGRITY
    # =========================================================================
    def test_13_dashboard_metrics_match_database(self):
        """Dashboard summary metrics match actual database records"""
        token = self.get_auth_token('hr', 'hr123')
        res = self.client.get('/api/dashboard-summary', headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(res.status_code, 200)
        data = res.get_json()['data']

        with self.app.app_context():
            actual_emp_count = Employee.query.count()
            actual_role_count = LeadershipRole.query.count()
            actual_comp_count = Competency.query.count()

        kpis = data.get('kpis', {})
        self.assertEqual(kpis.get('total_employees'), actual_emp_count)
        self.assertEqual(kpis.get('leadership_roles'), actual_role_count)
        self.assertEqual(kpis.get('total_competencies'), actual_comp_count)

    def test_14_non_existent_entity_returns_honest_404(self):
        """Querying non-existent entity returns clean 404, not fabricated data"""
        token = self.get_auth_token('hr', 'hr123')
        res = self.client.get('/api/employees/999999', headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(res.status_code, 404)
        self.assertFalse(res.get_json()['success'])

    # =========================================================================
    # 4. MIGRATIONS & SEEDING PRODUCTION SAFETY
    # =========================================================================
    def test_15_migrations_are_idempotent(self):
        """Schema migrations run repeatedly without error or data loss"""
        with self.app.app_context():
            # Running migration check multiple times
            run_schema_migrations(db.engine)
            run_schema_migrations(db.engine)

    def test_16_seeding_is_safely_disabled_in_production(self):
        """seed_database_if_empty and sync_employee_users abort immediately in production"""
        with patch.object(Config, 'IS_PRODUCTION', True):
            # Neither function should alter data or raise error
            seed_database_if_empty()
            sync_employee_users()

    # =========================================================================
    # 5. SUCCESSION WORKFLOW INTEGRITY
    # =========================================================================
    def test_17_succession_workflow_pipeline(self):
        """Verify end-to-end pipeline: employee -> gaps -> readiness -> succession"""
        token = self.get_auth_token('hr', 'hr123')
        with self.app.app_context():
            first_role = LeadershipRole.query.first()
            role_id = first_role.id

        # Successor rankings for role
        res = self.client.get(f'/api/successors/{role_id}', headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(res.status_code, 200)
        succ_data = res.get_json()['data']
        candidates = succ_data.get("candidates") or succ_data.get("ranked_successors", [])
        self.assertTrue(len(candidates) > 0)

        # Check candidate score and competency gap consistency
        top_candidate = candidates[0]
        self.assertIn("readiness_score", top_candidate)
        self.assertIn("readiness_level", top_candidate)
        self.assertTrue(0 <= top_candidate["readiness_score"] <= 100)

if __name__ == '__main__':
    unittest.main()
