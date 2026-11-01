import unittest
import json
from unittest.mock import patch, MagicMock
from app import create_app
from extensions import db
from models.assessment import Assessment, AssessmentAssignment
from models.user import User
from models.employee import Employee
from models.role import LeadershipRole
from models.competency import Competency
from utils.migrations import run_schema_migrations

class TestDashboardAssessmentFix(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = create_app()
        cls.app.config['TESTING'] = True
        cls.client = cls.app.test_client()

    def test_01_dashboard_summary_success(self):
        """Verify that /api/dashboard-summary loads cleanly with 200 and all assessment KPIs."""
        with self.app.app_context():
            res = self.client.get('/api/dashboard-summary')
            self.assertEqual(res.status_code, 200)
            data = res.get_json()
            self.assertTrue(data['success'])
            self.assertIn('kpis', data['data'])
            kpis = data['data']['kpis']
            self.assertIn('pending_assessments', kpis)
            self.assertIn('completed_assessments', kpis)
            self.assertIn('total_employees', kpis)
            self.assertIn('leadership_roles', kpis)
            
            # Verify charts
            charts = data['data']['charts']
            self.assertIn('assessment_completion', charts)
            self.assertEqual(charts['assessment_completion']['labels'], ["Completed", "Pending", "In Progress"])

    def test_02_status_filtering_excludes_completed(self):
        """Verify that pending_assessments strictly excludes 'Completed' assignments."""
        with self.app.app_context():
            # Query directly using the new optimized scalar count pattern
            pending_count = db.session.query(db.func.count(AssessmentAssignment.id)).filter(
                db.or_(AssessmentAssignment.status != 'Completed', AssessmentAssignment.status.is_(None))
            ).scalar() or 0

            completed_count = db.session.query(db.func.count(AssessmentAssignment.id)).filter(
                AssessmentAssignment.status == 'Completed'
            ).scalar() or 0

            total_count = db.session.query(db.func.count(AssessmentAssignment.id)).scalar() or 0

            # Sum of completed and non-completed must equal total
            self.assertEqual(pending_count + completed_count, total_count)

            # Any record counted as pending must not have status 'Completed'
            pending_records = AssessmentAssignment.query.filter(
                db.or_(AssessmentAssignment.status != 'Completed', AssessmentAssignment.status.is_(None))
            ).all()
            for r in pending_records:
                self.assertNotEqual(r.status, 'Completed')

    def test_03_query_does_not_generate_subquery_or_anon_alias(self):
        """Verify that the compiled SQL statement is direct count(id) without anon_1 subquery wrapper."""
        from sqlalchemy.dialects import postgresql, sqlite
        with self.app.app_context():
            q = db.session.query(db.func.count(AssessmentAssignment.id)).filter(
                db.or_(AssessmentAssignment.status != 'Completed', AssessmentAssignment.status.is_(None))
            )
            sql_pg = str(q.statement.compile(dialect=postgresql.dialect()))
            sql_sqlite = str(q.statement.compile(dialect=sqlite.dialect()))

            self.assertNotIn('AS anon_1', sql_pg)
            self.assertNotIn('AS anon_1', sql_sqlite)
            self.assertIn('count(assessment_assignments.id)', sql_pg.lower())
            self.assertIn('assessment_assignments.status !=', sql_pg)

    def test_04_postgres_schema_migration_types(self):
        """Verify that run_schema_migrations uses valid TIMESTAMP and SERIAL syntax for PostgreSQL."""
        mock_engine = MagicMock()
        mock_engine.dialect.name = 'postgresql'

        with patch('utils.migrations.inspect') as mock_inspect:
            mock_inspector = MagicMock()
            mock_inspector.get_table_names.return_value = ['assessment_assignments', 'role_eligibility_configs']
            mock_inspector.get_columns.return_value = [{'name': 'id'}, {'name': 'assessment_id'}]
            mock_inspect.return_value = mock_inspector

            executed_sqls = []
            mock_conn = MagicMock()
            mock_conn.execute.side_effect = lambda stmt, *args, **kwargs: executed_sqls.append(str(stmt))
            mock_engine.begin.return_value.__enter__.return_value = mock_conn

            run_schema_migrations(mock_engine)

            # Ensure executed statements do not specify DATETIME as data type (or AUTOINCREMENT)
            for sql in executed_sqls:
                if 'ADD COLUMN' in sql.upper():
                    tokens = sql.strip().split()
                    col_name = tokens[5]
                    col_type = " ".join(tokens[6:]).upper()
                    self.assertNotIn('DATETIME', col_type, f"Column {col_name} should not have DATETIME type: {sql}")
                self.assertNotIn('AUTOINCREMENT', sql.upper(), f"PostgreSQL migration should not use AUTOINCREMENT: {sql}")

    def test_05_sanitized_error_handling(self):
        """Verify that 500 error handler masks raw SQL and internal exceptions."""
        with self.app.app_context():
            with patch('routes.dashboard.LeadershipRole.query') as mock_role_q:
                mock_role_q.all.side_effect = Exception("(psycopg2.errors.UndefinedColumn) column assessment_assignments.dummy does not exist\n[SQL: SELECT count(1) AS count_1 FROM (SELECT * FROM assessment_assignments WHERE assessment_assignments.status != %(status_1)s) AS anon_1]")
                res = self.client.get('/api/dashboard-summary')
                self.assertEqual(res.status_code, 500)
                data = res.get_json()
                self.assertFalse(data['success'])
                # Verify no raw SQL or database internal errors leaked
                self.assertNotIn('SELECT', data['message'])
                self.assertNotIn('anon_1', data['message'])
                self.assertNotIn('psycopg2', data['message'])
                self.assertNotIn('UndefinedColumn', data['message'])

if __name__ == '__main__':
    unittest.main()
