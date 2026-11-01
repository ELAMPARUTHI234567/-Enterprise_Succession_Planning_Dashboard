import unittest
import json
import jwt
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from app import app
from extensions import db
from config import Config
from models.user import User
from models.employee import Employee
from models.role import LeadershipRole
from models.assessment import Assessment, AssessmentAssignment, AssignmentQuestion, AssessmentResult, AssessmentAnswer
from models.question_bank import QuestionBank
from services.scheduling_service import (
    validate_time_window,
    create_utc_datetime,
    validate_and_save_manual_schedules,
    check_assessment_start_permission
)
from services.question_generator_service import (
    generate_and_persist_attempt_questions,
    shuffle_options_and_relabel
)
from services.eligibility_service import evaluate_pre_assessment_eligibility

class TestPhase3BatchAndQuestions(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = app
        cls.client = cls.app.test_client()

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

    def test_01_batch_scheduling_single_and_multiple_employees_shared_consistency(self):
        """
        Requirements A & D:
        1. Batch scheduling one employee and multiple employees
        2. Shared schedule consistency: Every employee in that batch receives identical date and time window
        """
        with self.app.app_context():
            hr_user = User.query.filter_by(role='HR').first()
            self.assertIsNotNone(hr_user)
            token = self.generate_token(hr_user)
            role = LeadershipRole.query.first()
            self.assertIsNotNone(role)
            assess = Assessment.query.filter_by(role_id=role.id).first()
            if not assess:
                assess = Assessment.query.first()

            # Find 2 eligible employees for this role
            all_emps = Employee.query.all()
            eligible_emps = []
            for emp in all_emps:
                res = evaluate_pre_assessment_eligibility(emp.id, role.id, employee=emp)
                if res and res.get("is_eligible"):
                    eligible_emps.append(emp)
                if len(eligible_emps) >= 2:
                    break

            if len(eligible_emps) < 2:
                eligible_emps = all_emps[:2]

            emp1, emp2 = eligible_emps[0], eligible_emps[1]

            # Clean previous test assignments
            test_date = "2026-11-15"
            AssessmentAssignment.query.filter_by(scheduled_date=test_date).delete()
            db.session.commit()

            # Batch assign both employees with ONE date, start time, end time
            batch_payload = {
                "assessment_id": assess.id,
                "role_id": role.id,
                "title": f"{role.role_name} Unified Batch Assessment",
                "employee_ids": [emp1.id, emp2.id],
                "scheduled_date": test_date,
                "start_time": "10:00",
                "end_time": "10:45",
                "time_zone": "IST (Asia/Kolkata)",
                "instructions": "All candidates join the synchronized assessment session simultaneously."
            }

            res = self.client.post(
                "/api/assessment-schedules/batch-save",
                headers={"Authorization": f"Bearer {token}"},
                json=batch_payload
            )

            self.assertEqual(res.status_code, 201)
            data = res.get_json()
            self.assertTrue(data.get("success"))
            self.assertEqual(data["data"]["created_count"], 2)

            # Verify database persistence: both have identical shared schedule window
            assign1 = AssessmentAssignment.query.filter_by(employee_id=emp1.id, scheduled_date=test_date).first()
            assign2 = AssessmentAssignment.query.filter_by(employee_id=emp2.id, scheduled_date=test_date).first()

            self.assertIsNotNone(assign1)
            self.assertIsNotNone(assign2)

            for a in [assign1, assign2]:
                self.assertEqual(a.scheduled_date, test_date)
                self.assertEqual(a.start_time, "10:00")
                self.assertEqual(a.end_time, "10:45")
                self.assertEqual(a.duration_minutes, 45)
                self.assertEqual(a.time_zone, "IST (Asia/Kolkata)")
                self.assertIsNotNone(a.scheduled_start_datetime)
                self.assertIsNotNone(a.scheduled_end_datetime)
                # Verify fresh questions were persisted for each attempt
                self.assertGreater(len(a.assigned_questions), 0)

            # Cleanup
            db.session.delete(assign1)
            db.session.delete(assign2)
            db.session.commit()

    def test_02_invalid_time_ranges_rejected(self):
        """
        Requirements A & D:
        Validation rejects invalid time ranges (end_time <= start_time, invalid format)
        """
        # Test helper function directly
        valid, dur, err = validate_time_window("10:30", "10:00")
        self.assertFalse(valid)
        self.assertIn("must be strictly after", err)

        valid, dur, err = validate_time_window("10:00", "10:00")
        self.assertFalse(valid)
        self.assertIn("must be strictly after", err)

        valid, dur, err = validate_time_window("invalid", "10:30")
        self.assertFalse(valid)
        self.assertIn("Invalid time format", err)

        valid, dur, err = validate_time_window("10:00", "11:30")
        self.assertTrue(valid)
        self.assertEqual(dur, 90)

        # Test through API endpoint
        with self.app.app_context():
            hr_user = User.query.filter_by(role='HR').first()
            token = self.generate_token(hr_user)
            emp = Employee.query.first()
            assess = Assessment.query.first()

            payload = {
                "assessment_id": assess.id,
                "employee_ids": [emp.id],
                "scheduled_date": "2026-11-18",
                "start_time": "14:00",
                "end_time": "13:30" # Inverted window!
            }

            res = self.client.post(
                "/api/assessment-schedules/batch-save",
                headers={"Authorization": f"Bearer {token}"},
                json=payload
            )
            self.assertEqual(res.status_code, 400)
            data = res.get_json()
            self.assertFalse(data.get("success"))
            self.assertIn("must be strictly after", data.get("message"))

    def test_03_timezone_conversion_and_authoritative_utc_persistence(self):
        """
        Requirements A & D:
        Authoritative UTC datetime conversion for IST and other timezones.
        10:00 IST is 04:30 UTC.
        """
        dt_str = "2026-11-20"
        time_str = "10:00"
        tz_str = "IST (Asia/Kolkata)"

        utc_dt = create_utc_datetime(dt_str, time_str, tz_str)
        self.assertIsNotNone(utc_dt)
        # IST is UTC+5:30, so 10:00 IST = 04:30 UTC
        self.assertEqual(utc_dt.hour, 4)
        self.assertEqual(utc_dt.minute, 30)

        # UTC timezone test: 10:00 UTC = 10:00 UTC
        utc_dt_utc = create_utc_datetime(dt_str, time_str, "UTC")
        self.assertEqual(utc_dt_utc.hour, 10)
        self.assertEqual(utc_dt_utc.minute, 0)

    def test_04_duplicate_assignments_within_batch_rejected(self):
        """
        Requirements A & D:
        Duplicate employee IDs in the same batch are detected and rejected.
        """
        with self.app.app_context():
            hr_user = User.query.filter_by(role='HR').first()
            token = self.generate_token(hr_user)
            emp = Employee.query.first()
            assess = Assessment.query.first()

            # Passing same employee twice in batch
            payload = {
                "assessment_id": assess.id,
                "schedules": [
                    {
                        "employee_id": emp.id,
                        "scheduled_date": "2026-11-21",
                        "start_time": "10:00",
                        "duration_minutes": 30
                    },
                    {
                        "employee_id": emp.id,
                        "scheduled_date": "2026-11-21",
                        "start_time": "11:00",
                        "duration_minutes": 30
                    }
                ]
            }

            res = self.client.post(
                "/api/assessment-schedules/batch-save",
                headers={"Authorization": f"Bearer {token}"},
                json=payload
            )
            self.assertIn(res.status_code, [400, 409])
            data = res.get_json()
            self.assertFalse(data.get("success"))
            self.assertIn("Duplicate assignment", data.get("message"))

    def test_05_unauthorized_user_cannot_batch_schedule(self):
        """
        Requirements A, C & D:
        Non-HR users (Employees) receive 403 Forbidden when calling /batch-save.
        """
        with self.app.app_context():
            emp_user = User.query.filter_by(role='Employee').first()
            if not emp_user:
                emp_user = User(username="test_emp_sec", email="test_emp_sec@test.com", role="Employee")
                emp_user.set_password("pass123")
                db.session.add(emp_user)
                db.session.commit()

            token = self.generate_token(emp_user)
            res = self.client.post(
                "/api/assessment-schedules/batch-save",
                headers={"Authorization": f"Bearer {token}"},
                json={"employee_ids": [1], "scheduled_date": "2026-11-22", "start_time": "10:00", "end_time": "10:30"}
            )
            self.assertEqual(res.status_code, 403)
            data = res.get_json()
            self.assertFalse(data.get("success"))

    def test_06_ineligible_employees_rejected_with_422(self):
        """
        Requirements A & D:
        Scheduling an assessment for an employee who does NOT meet target role prerequisites
        is rejected with 422 Unprocessable Entity.
        """
        with self.app.app_context():
            hr_user = User.query.filter_by(role='HR').first()
            token = self.generate_token(hr_user)
            role = LeadershipRole.query.first()
            assess = Assessment.query.filter_by(role_id=role.id).first() or Assessment.query.first()

            # Find or identify an ineligible employee
            all_emps = Employee.query.all()
            ineligible_emp = None
            for emp in all_emps:
                res = evaluate_pre_assessment_eligibility(emp.id, role.id, employee=emp)
                if res and not res.get("is_eligible"):
                    ineligible_emp = emp
                    break

            if ineligible_emp:
                payload = {
                    "assessment_id": assess.id,
                    "role_id": role.id,
                    "employee_ids": [ineligible_emp.id],
                    "scheduled_date": "2026-11-23",
                    "start_time": "10:00",
                    "end_time": "10:30"
                }

                res = self.client.post(
                    "/api/assessment-schedules/batch-save",
                    headers={"Authorization": f"Bearer {token}"},
                    json=payload
                )
                self.assertEqual(res.status_code, 422)
                data = res.get_json()
                self.assertFalse(data.get("success"))
                self.assertIn("Pre-assessment eligibility check failed", data.get("message"))

    def test_07_fresh_question_selection_across_attempts_and_no_within_attempt_duplicates(self):
        """
        Requirements B & D:
        - Each attempt receives questions without within-attempt duplicates (10 distinct questions).
        - Reassessment creates a new attempt avoiding previous attempt's questions.
        """
        with self.app.app_context():
            role = LeadershipRole.query.first()
            assess = Assessment.query.filter_by(role_id=role.id).first() or Assessment.query.first()

            # Clean test employee with no prior question history
            clean_emp = Employee(
                name="Fresh Attempt Candidate",
                email="fresh_candidate_07@company.internal",
                employee_code="FAC007",
                department="Engineering",
                designation="Principal Engineer"
            )
            db.session.add(clean_emp)
            db.session.commit()

            try:
                # Create attempt 1
                assign1 = AssessmentAssignment(
                    assessment_id=assess.id,
                    employee_id=clean_emp.id,
                    attempt_number=1,
                    status="Scheduled"
                )
                db.session.add(assign1)
                db.session.commit()

                success1, questions1, code1 = generate_and_persist_attempt_questions(assign1, role.id, num_questions=10)
                self.assertTrue(success1)
                self.assertEqual(len(questions1), 10)

                # Check no duplicates within attempt 1
                q_bank_ids_1 = [q.question_bank_id for q in questions1]
                self.assertEqual(len(q_bank_ids_1), len(set(q_bank_ids_1)), "Attempt 1 has duplicate questions")

                # Mark attempt 1 completed with result
                assign1.status = "Completed"
                res1 = AssessmentResult(assignment_id=assign1.id, overall_score=80.0, readiness_level="Ready")
                db.session.add(res1)
                db.session.commit()

                # Check total available questions for this role
                total_role_questions = QuestionBank.query.filter_by(role_id=role.id).count()

                # Create attempt 2 (reassessment)
                assign2 = AssessmentAssignment(
                    assessment_id=assess.id,
                    employee_id=clean_emp.id,
                    attempt_number=2,
                    status="Scheduled"
                )
                db.session.add(assign2)
                db.session.commit()

                if total_role_questions >= 20:
                    # If question bank has >= 20 questions, attempt 2 should use fresh, non-overlapping questions
                    success2, questions2, code2 = generate_and_persist_attempt_questions(assign2, role.id, num_questions=10)
                    self.assertTrue(success2, f"Attempt 2 question generation failed: {questions2}")
                    q_bank_ids_2 = [q.question_bank_id for q in questions2]
                    overlap = set(q_bank_ids_1).intersection(set(q_bank_ids_2))
                    self.assertEqual(len(overlap), 0, f"Attempt 2 reused questions from attempt 1: {overlap}")
                else:
                    # If capacity is under 20, check that capacity guard properly triggers with 422!
                    success2, err_msg2, code2 = generate_and_persist_attempt_questions(assign2, role.id, num_questions=10)
                    self.assertFalse(success2)
                    self.assertEqual(code2, 422)
                    self.assertIn("Question Bank capacity reached", err_msg2)
            finally:
                # Cleanup
                if 'assign1' in locals() and assign1.id:
                    AssignmentQuestion.query.filter_by(assignment_id=assign1.id).delete()
                    AssessmentResult.query.filter_by(assignment_id=assign1.id).delete()
                    db.session.delete(assign1)
                if 'assign2' in locals() and assign2.id:
                    AssignmentQuestion.query.filter_by(assignment_id=assign2.id).delete()
                    db.session.delete(assign2)
                db.session.delete(clean_emp)
                db.session.commit()

    def test_08_insufficient_question_bank_capacity_alerts_hr(self):
        """
        Requirements B.9 & D:
        If question bank lacks enough unused questions for an attempt, do not silently
        reuse old questions. Return 422 with a clear explanation to HR.
        """
        with self.app.app_context():
            emp = Employee.query.first()
            role = LeadershipRole.query.first()
            assess = Assessment.query.first()

            assign = AssessmentAssignment(
                assessment_id=assess.id,
                employee_id=emp.id,
                attempt_number=99,
                status="Scheduled"
            )
            db.session.add(assign)
            db.session.commit()

            # Request 9999 questions when question bank only has ~15-30
            success, msg, code = generate_and_persist_attempt_questions(assign, role.id, num_questions=9999)
            self.assertFalse(success)
            self.assertEqual(code, 422)
            self.assertIn("Question Bank capacity reached", msg)
            self.assertIn("Please add more questions to the Question Bank", msg)

            db.session.delete(assign)
            db.session.commit()

    def test_09_answer_option_randomization_preserves_scoring_key(self):
        """
        Requirements B.3 & D:
        Shuffling answer options correctly remaps the correct_answer label (A, B, C, D)
        so candidate evaluation remains mathematically accurate.
        """
        raw_options = [
            "A. First choice",
            "B. Second choice (Correct answer)",
            "C. Third choice",
            "D. Fourth choice"
        ]
        original_correct = "B"

        # Shuffle 10 times to test various random distributions
        for _ in range(10):
            shuffled_opts, new_corr = shuffle_options_and_relabel(raw_options, original_correct)
            self.assertEqual(len(shuffled_opts), 4)

            # Find the option with label == new_corr
            correct_opt = next((o for o in shuffled_opts if o["label"] == new_corr), None)
            self.assertIsNotNone(correct_opt)
            self.assertIn("Second choice", correct_opt["text"])

    def test_10_stable_questions_on_page_refresh_and_conceals_answers(self):
        """
        Requirements B.7, B.8 & D:
        Questions do not change on page refresh or subsequent GET requests.
        Correct answers and explanations are stripped from frontend GET responses.
        """
        with self.app.app_context():
            role = LeadershipRole.query.first()
            assess = Assessment.query.filter_by(role_id=role.id).first() or Assessment.query.first()
            hr_user = User.query.filter_by(role='HR').first()
            token = self.generate_token(hr_user)

            clean_emp = Employee(
                name="Stable Candidate",
                email="stable_cand_10@company.internal",
                employee_code="SC010",
                department="Engineering",
                designation="Senior Engineer"
            )
            db.session.add(clean_emp)
            db.session.commit()

            assign = AssessmentAssignment(
                assessment_id=assess.id,
                employee_id=clean_emp.id,
                scheduled_date="2026-11-25",
                start_time="09:00",
                end_time="10:00",
                time_zone="IST (Asia/Kolkata)",
                attempt_number=1,
                status="Scheduled"
            )
            db.session.add(assign)
            db.session.commit()

            generate_and_persist_attempt_questions(assign, role.id, num_questions=10)
            db.session.commit()

            # First GET request
            res1 = self.client.get(
                f"/api/assessment-assignments/{assign.id}",
                headers={"Authorization": f"Bearer {token}"}
            )
            self.assertEqual(res1.status_code, 200)
            data1 = res1.get_json()["data"]
            questions1 = data1["questions"]
            self.assertEqual(len(questions1), 10)

            # Second GET request (simulating page refresh)
            res2 = self.client.get(
                f"/api/assessment-assignments/{assign.id}",
                headers={"Authorization": f"Bearer {token}"}
            )
            self.assertEqual(res2.status_code, 200)
            data2 = res2.get_json()["data"]
            questions2 = data2["questions"]

            # Verify identical order and IDs
            for q1, q2 in zip(questions1, questions2):
                self.assertEqual(q1["id"], q2["id"])
                self.assertEqual(q1["question"], q2["question"])
                self.assertEqual(q1["options"], q2["options"])
                # Requirement B.8: Correct answers must NOT be exposed in GET
                self.assertNotIn("correct_answer", q1)
                self.assertNotIn("correct_answer", q2)

            # Cleanup
            AssignmentQuestion.query.filter_by(assignment_id=assign.id).delete()
            db.session.delete(assign)
            db.session.delete(clean_emp)
            db.session.commit()

    def test_11_historical_attempt_preservation_on_reassessment(self):
        """
        Requirements A, C & D:
        Reassessment must create a new attempt and a new question set without
        destroying the previous attempt or its score.
        """
        with self.app.app_context():
            role = LeadershipRole.query.first()
            assess = Assessment.query.filter_by(role_id=role.id).first() or Assessment.query.first()

            # Find an eligible employee with no prior completed attempts
            eligible_emp = None
            for e in Employee.query.all():
                elig = evaluate_pre_assessment_eligibility(e.id, role.id, employee=e)
                if elig and elig.get("is_eligible"):
                    used_count = AssessmentAssignment.query.filter_by(employee_id=e.id, status='Completed').count()
                    if used_count == 0:
                        eligible_emp = e
                        break

            if not eligible_emp:
                eligible_emp = Employee.query.get(2) # Priya Sharma

            # Clean any old test records for this employee on test dates
            AssessmentAssignment.query.filter(
                AssessmentAssignment.employee_id == eligible_emp.id,
                AssessmentAssignment.scheduled_date.in_(["2026-10-01", "2026-11-28"])
            ).delete()
            db.session.commit()

            # Historical Attempt 1: Completed with score 85.0
            assign1 = AssessmentAssignment(
                assessment_id=assess.id,
                employee_id=eligible_emp.id,
                scheduled_date="2026-10-01",
                start_time="10:00",
                end_time="10:30",
                time_zone="IST (Asia/Kolkata)",
                status="Completed",
                attempt_number=1
            )
            db.session.add(assign1)
            db.session.flush()

            # Generate attempt 1 questions
            generate_and_persist_attempt_questions(assign1, role.id, num_questions=10)

            result1 = AssessmentResult(
                assignment_id=assign1.id,
                overall_score=85.0,
                readiness_level="Ready Now"
            )
            db.session.add(result1)
            db.session.commit()

            # HR creates a new schedule for this candidate
            hr_user = User.query.filter_by(role='HR').first()
            schedules_input = [{
                "employee_id": eligible_emp.id,
                "scheduled_date": "2026-11-28",
                "start_time": "14:00",
                "end_time": "14:45",
                "time_zone": "IST (Asia/Kolkata)"
            }]

            saved, err, code = validate_and_save_manual_schedules(assess.id, schedules_input, hr_user.id)
            self.assertIsNone(err)
            self.assertEqual(code, 201)

            # Verify Attempt 1 remains intact
            check_assign1 = AssessmentAssignment.query.get(assign1.id)
            self.assertIsNotNone(check_assign1)
            self.assertEqual(check_assign1.status, "Completed")
            self.assertEqual(check_assign1.attempt_number, 1)
            self.assertIsNotNone(check_assign1.result)
            self.assertEqual(check_assign1.result.overall_score, 85.0)

            # Verify Attempt 2 is a separate new assignment
            new_assign = AssessmentAssignment.query.filter_by(
                employee_id=eligible_emp.id, scheduled_date="2026-11-28"
            ).first()
            self.assertIsNotNone(new_assign)
            self.assertNotEqual(new_assign.id, assign1.id)
            self.assertEqual(new_assign.attempt_number, 2)
            self.assertEqual(new_assign.status, "Scheduled")

            # Cleanup
            AssignmentQuestion.query.filter(AssignmentQuestion.assignment_id.in_([assign1.id, new_assign.id])).delete()
            db.session.delete(new_assign)
            db.session.delete(result1)
            db.session.delete(assign1)
            db.session.commit()

    def test_12_backend_timing_window_and_early_access_enforcement(self):
        """
        Requirements A, C & D:
        Enforce the assessment start and end window on the backend.
        Respects 15-minute early-start allowance. Rejects too early and expired attempts.
        """
        with self.app.app_context():
            emp = Employee.query.first()
            assess = Assessment.query.first()

            # Schedule: 10:00 to 10:45 UTC
            base_time = datetime(2026, 11, 30, 10, 0, 0)
            start_utc = base_time
            end_utc = base_time + timedelta(minutes=45)

            assign = AssessmentAssignment(
                assessment_id=assess.id,
                employee_id=emp.id,
                scheduled_date="2026-11-30",
                start_time="10:00",
                end_time="10:45",
                duration_minutes=45,
                time_zone="UTC",
                scheduled_start_datetime=start_utc,
                scheduled_end_datetime=end_utc,
                status="Scheduled"
            )

            # 1. Access 30 minutes before start (Too early, outside 15-min early window)
            time_too_early = start_utc - timedelta(minutes=30)
            can_start, reason, status_code = check_assessment_start_permission(
                assign, current_user_employee_id=emp.id, is_admin=False, current_time=time_too_early
            )
            self.assertFalse(can_start)
            self.assertEqual(status_code, 403)
            self.assertIn("Assessment window is not open yet", reason)

            # 2. Access 10 minutes before start (Inside 15-min early allowance)
            time_early_allowance = start_utc - timedelta(minutes=10)
            can_start, reason, status_code = check_assessment_start_permission(
                assign, current_user_employee_id=emp.id, is_admin=False, current_time=time_early_allowance
            )
            self.assertTrue(can_start)
            self.assertEqual(status_code, 200)

            # 3. Access right during the scheduled window (e.g. 15 mins in)
            time_in_window = start_utc + timedelta(minutes=15)
            can_start, reason, status_code = check_assessment_start_permission(
                assign, current_user_employee_id=emp.id, is_admin=False, current_time=time_in_window
            )
            self.assertTrue(can_start)
            self.assertEqual(status_code, 200)

            # 4. Access 10 minutes AFTER scheduled end (Window expired)
            time_expired = end_utc + timedelta(minutes=10)
            can_start, reason, status_code = check_assessment_start_permission(
                assign, current_user_employee_id=emp.id, is_admin=False, current_time=time_expired
            )
            self.assertFalse(can_start)
            self.assertEqual(status_code, 403)
            self.assertIn("Assessment window expired", reason)

if __name__ == "__main__":
    unittest.main()
