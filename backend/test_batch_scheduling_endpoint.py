import unittest
import jwt
from datetime import datetime, timedelta
from app import app
from extensions import db
from models.user import User
from models.employee import Employee
from models.assessment import Assessment, AssessmentAssignment
from config import Config

class TestBatchSchedulingEndpoint(unittest.TestCase):
    def setUp(self):
        self.app = app
        self.client = self.app.test_client()

    def generate_token(self, user):
        payload = {
            "sub": str(user.id),
            "username": user.username,
            "role": user.role,
            "auth_email": user.email,
            "iat": datetime.utcnow(),
            "exp": datetime.utcnow() + timedelta(hours=2)
        }
        return jwt.encode(payload, Config.JWT_SECRET_KEY, algorithm="HS256")

    def test_01_one_selected_employee_valid_schedule(self):
        """Case 1: One selected employee with a valid manual schedule saves cleanly via HTTP POST"""
        with self.app.app_context():
            hr_user = User.query.filter_by(role='HR').first()
            emp = Employee.query.first()
            assess = Assessment.query.first()
            token = self.generate_token(hr_user)

            # Cleanup any existing test schedule
            AssessmentAssignment.query.filter_by(scheduled_date="2026-11-25", employee_id=emp.id).delete()
            db.session.commit()

            payload = {
                "assessment_id": assess.id,
                "role_id": assess.role_id,
                "title": assess.title,
                "time_zone": "IST (Asia/Kolkata)",
                "schedules": [
                    {
                        "employee_id": emp.id,
                        "employee_name": emp.name,
                        "scheduled_date": "2026-11-25",
                        "start_time": "10:00",
                        "duration_minutes": 45,
                        "time_zone": "IST (Asia/Kolkata)"
                    }
                ]
            }

            res = self.client.post(
                "/api/assessment-schedules/batch-save",
                headers={"Authorization": f"Bearer {token}"},
                json=payload
            )

            self.assertEqual(res.status_code, 201)
            data = res.get_json()
            self.assertTrue(data.get("success"))
            self.assertEqual(data["data"]["created_count"], 1)

            # Verify in DB
            saved_assign = AssessmentAssignment.query.filter_by(
                scheduled_date="2026-11-25", employee_id=emp.id
            ).first()
            self.assertIsNotNone(saved_assign)
            self.assertEqual(saved_assign.start_time, "10:00")
            self.assertEqual(saved_assign.duration_minutes, 45)
            self.assertEqual(saved_assign.end_time, "10:45")

            # Cleanup
            db.session.delete(saved_assign)
            db.session.commit()

    def test_02_two_selected_employees_different_schedules(self):
        """Case 2: Two selected employees with different manually entered schedules"""
        with self.app.app_context():
            hr_user = User.query.filter_by(role='HR').first()
            employees = Employee.query.limit(2).all()
            self.assertGreaterEqual(len(employees), 2)
            assess = Assessment.query.first()
            token = self.generate_token(hr_user)

            emp1, emp2 = employees[0], employees[1]
            AssessmentAssignment.query.filter(
                AssessmentAssignment.scheduled_date.in_(["2026-11-26", "2026-11-27"])
            ).delete()
            db.session.commit()

            payload = {
                "assessment_id": assess.id,
                "schedules": [
                    {
                        "employee_id": emp1.id,
                        "employee_name": emp1.name,
                        "scheduled_date": "2026-11-26",
                        "start_time": "09:30",
                        "duration_minutes": 60
                    },
                    {
                        "employee_id": emp2.id,
                        "employee_name": emp2.name,
                        "scheduled_date": "2026-11-27",
                        "start_time": "14:15",
                        "duration_minutes": 90
                    }
                ]
            }

            res = self.client.post(
                "/api/assessment-schedules/batch-save",
                headers={"Authorization": f"Bearer {token}"},
                json=payload
            )

            self.assertEqual(res.status_code, 201)
            data = res.get_json()
            self.assertEqual(data["data"]["created_count"], 2)

            # Verify both assignments saved with respective individual details
            assign1 = AssessmentAssignment.query.filter_by(employee_id=emp1.id, scheduled_date="2026-11-26").first()
            assign2 = AssessmentAssignment.query.filter_by(employee_id=emp2.id, scheduled_date="2026-11-27").first()
            self.assertIsNotNone(assign1)
            self.assertIsNotNone(assign2)
            self.assertEqual(assign1.start_time, "09:30")
            self.assertEqual(assign1.end_time, "10:30")
            self.assertEqual(assign2.start_time, "14:15")
            self.assertEqual(assign2.end_time, "15:45")

            # Cleanup
            db.session.delete(assign1)
            db.session.delete(assign2)
            db.session.commit()

    def test_03_ten_selected_employees_manual_schedules(self):
        """Case 3: Ten selected employees with manually entered schedules without auto-generation"""
        with self.app.app_context():
            hr_user = User.query.filter_by(role='HR').first()
            employees = Employee.query.limit(10).all()
            assess = Assessment.query.first()
            token = self.generate_token(hr_user)

            AssessmentAssignment.query.filter_by(scheduled_date="2026-11-28").delete()
            db.session.commit()

            schedules = []
            for idx, emp in enumerate(employees):
                schedules.append({
                    "employee_id": emp.id,
                    "employee_name": emp.name,
                    "scheduled_date": "2026-11-28",
                    "start_time": f"{9 + idx // 2:02d}:{(idx % 2) * 30:02d}",
                    "duration_minutes": 30 + idx * 5
                })

            payload = {
                "assessment_id": assess.id,
                "schedules": schedules
            }

            res = self.client.post(
                "/api/assessment-schedules/batch-save",
                headers={"Authorization": f"Bearer {token}"},
                json=payload
            )

            self.assertEqual(res.status_code, 201)
            data = res.get_json()
            self.assertEqual(data["data"]["created_count"], len(employees))

            # Cleanup
            AssessmentAssignment.query.filter_by(scheduled_date="2026-11-28").delete()
            db.session.commit()

    def test_04_empty_schedules_rejected(self):
        """Case 4: Empty schedules array is rejected with clear 400 error message"""
        with self.app.app_context():
            hr_user = User.query.filter_by(role='HR').first()
            assess = Assessment.query.first()
            token = self.generate_token(hr_user)

            payload = {
                "assessment_id": assess.id,
                "schedules": []
            }

            res = self.client.post(
                "/api/assessment-schedules/batch-save",
                headers={"Authorization": f"Bearer {token}"},
                json=payload
            )

            self.assertEqual(res.status_code, 400)
            data = res.get_json()
            self.assertFalse(data.get("success"))
            self.assertIn("Schedules list is required and cannot be empty", data.get("message"))

    def test_05_missing_date_time_or_duration_rejected(self):
        """Case 5: Incomplete schedule (missing date, start time, or duration) rejected with 400"""
        with self.app.app_context():
            hr_user = User.query.filter_by(role='HR').first()
            emp = Employee.query.first()
            assess = Assessment.query.first()
            token = self.generate_token(hr_user)

            # Missing start_time
            payload = {
                "assessment_id": assess.id,
                "schedules": [
                    {
                        "employee_id": emp.id,
                        "employee_name": emp.name,
                        "scheduled_date": "2026-11-29",
                        "start_time": "",
                        "duration_minutes": 45
                    }
                ]
            }

            res = self.client.post(
                "/api/assessment-schedules/batch-save",
                headers={"Authorization": f"Bearer {token}"},
                json=payload
            )

            self.assertEqual(res.status_code, 400)
            data = res.get_json()
            self.assertIn("Incomplete schedule", data.get("message"))

    def test_06_saved_assignments_appear_in_schedules_list(self):
        """Case 6: Successfully saved assignments appear in GET /api/assessment-schedules"""
        with self.app.app_context():
            hr_user = User.query.filter_by(role='HR').first()
            emp = Employee.query.first()
            assess = Assessment.query.first()
            token = self.generate_token(hr_user)

            AssessmentAssignment.query.filter_by(scheduled_date="2026-11-30", employee_id=emp.id).delete()
            db.session.commit()

            # Save assignment
            save_res = self.client.post(
                "/api/assessment-schedules/batch-save",
                headers={"Authorization": f"Bearer {token}"},
                json={
                    "assessment_id": assess.id,
                    "schedules": [
                        {
                            "employee_id": emp.id,
                            "employee_name": emp.name,
                            "scheduled_date": "2026-11-30",
                            "start_time": "11:00",
                            "duration_minutes": 50
                        }
                    ]
                }
            )
            self.assertEqual(save_res.status_code, 201)

            # Query list
            list_res = self.client.get(
                "/api/assessment-schedules?date=2026-11-30",
                headers={"Authorization": f"Bearer {token}"}
            )
            self.assertEqual(list_res.status_code, 200)
            list_data = list_res.get_json()
            schedules_found = [s for s in list_data.get("data", []) if s.get("employee_id") == emp.id]
            self.assertGreaterEqual(len(schedules_found), 1)
            self.assertEqual(schedules_found[0]["start_time"], "11:00")
            self.assertEqual(schedules_found[0]["end_time"], "11:50")

            # Cleanup
            AssessmentAssignment.query.filter_by(scheduled_date="2026-11-30", employee_id=emp.id).delete()
            db.session.commit()

    def test_07_unauthorized_users_cannot_create_schedules(self):
        """Case 7: Unauthorized users (Employee role) cannot call /batch-save"""
        with self.app.app_context():
            emp_user = User.query.filter_by(role='Employee').first()
            assess = Assessment.query.first()
            emp = Employee.query.first()
            token = self.generate_token(emp_user)

            payload = {
                "assessment_id": assess.id,
                "schedules": [
                    {
                        "employee_id": emp.id,
                        "scheduled_date": "2026-12-01",
                        "start_time": "10:00",
                        "duration_minutes": 30
                    }
                ]
            }

            res = self.client.post(
                "/api/assessment-schedules/batch-save",
                headers={"Authorization": f"Bearer {token}"},
                json=payload
            )

            self.assertEqual(res.status_code, 403)
            data = res.get_json()
            self.assertFalse(data.get("success"))

if __name__ == '__main__':
    unittest.main()
