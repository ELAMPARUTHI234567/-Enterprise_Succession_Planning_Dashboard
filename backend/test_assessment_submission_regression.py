import unittest
import json
import jwt
from datetime import datetime, timedelta
from app import app
from extensions import db
from config import Config
from models.user import User
from models.employee import Employee
from models.role import LeadershipRole
from models.competency import Competency
from models.employee_competency import EmployeeCompetency
from models.assessment import (
    Assessment, AssessmentAssignment, AssessmentQuestion,
    AssignmentQuestion, AssessmentAnswer, AssessmentResult
)
from models.question_bank import QuestionBank
from services.question_generator_service import generate_and_persist_attempt_questions

class TestAssessmentSubmissionRegression(unittest.TestCase):
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

    def setUp(self):
        self.created_assignment_ids = []
        with self.app.app_context():
            # Backup employee 1 competency scores
            self.emp1_scores = {
                ec.competency_id: ec.score
                for ec in EmployeeCompetency.query.filter_by(employee_id=1).all()
            }

    def tearDown(self):
        with self.app.app_context():
            # Clean up any assignments created during this test
            if self.created_assignment_ids:
                for a_id in self.created_assignment_ids:
                    AssessmentAnswer.query.filter_by(assignment_id=a_id).delete()
                    AssignmentQuestion.query.filter_by(assignment_id=a_id).delete()
                    AssessmentResult.query.filter_by(assignment_id=a_id).delete()
                    AssessmentAssignment.query.filter_by(id=a_id).delete()
                db.session.commit()

            # Restore assignment 32 to In-Progress if it was tested
            a32 = AssessmentAssignment.query.get(32)
            if a32:
                a32.status = "In-Progress"
                a32.schedule_status = "In-Progress"
                a32.submitted_at = None
                AssessmentAnswer.query.filter_by(assignment_id=32).delete()
                AssessmentResult.query.filter_by(assignment_id=32).delete()

            # Restore employee 1 competency scores
            for cid, sc in self.emp1_scores.items():
                ec = EmployeeCompetency.query.filter_by(employee_id=1, competency_id=cid).first()
                if ec:
                    ec.score = sc
            db.session.commit()

    def test_01_failing_submission_scenario_with_assigned_questions(self):
        """
        Reproduces the exact failing submission scenario reported by the user:
        sqlite3.IntegrityError: NOT NULL constraint failed: assessment_answers.question_id
        Parameters: (32, None, 1631, 'A', 10.0)

        Ensures question_id is resolved to a valid AssessmentQuestion.id and
        assignment_question_id references 1631.
        """
        with self.app.app_context():
            # Find assignment 32 and its employee/user
            assignment = AssessmentAssignment.query.get(32)
            self.assertIsNotNone(assignment, "Assignment 32 should exist in database")
            
            # Ensure assignment 32 is In-Progress and deadline is active
            assignment.status = "In-Progress"
            assignment.schedule_status = "In-Progress"
            assignment.submission_deadline = datetime.utcnow() + timedelta(minutes=30)
            db.session.commit()

            # Find employee and user
            emp = Employee.query.get(assignment.employee_id)
            user = User.query.get(emp.user_id) if emp and emp.user_id else User.query.filter_by(role='Employee').first()
            token = self.generate_token(user)

            # Get assigned questions
            assigned_qs = assignment.assigned_questions
            self.assertTrue(len(assigned_qs) > 0, "Assignment 32 must have assigned_questions")
            
            # Find target question (1631 or first assigned question)
            target_q = next((q for q in assigned_qs if q.id == 1631), assigned_qs[0])
            target_q_id = target_q.id
            self.assertIsNotNone(target_q, f"Assignment 32 should contain assigned question {target_q_id}")

            # Prepare submission payload with answer 'A' for target_q (the exact failed insert parameters)
            answers_payload = {str(q.id): q.correct_answer for q in assigned_qs}
            answers_payload[str(target_q_id)] = "A"

            res = self.client.post(
                f"/api/assessment-assignments/{assignment.id}/submit",
                headers={"Authorization": f"Bearer {token}"},
                json={"answers": answers_payload}
            )

            self.assertEqual(res.status_code, 200, f"Submission failed with: {res.get_json()}")
            data = res.get_json()
            self.assertTrue(data.get("success"))

            # Verify persisted records in assessment_answers table
            answers = AssessmentAnswer.query.filter_by(assignment_id=assignment.id).all()
            self.assertEqual(len(answers), len(assigned_qs))

            ans_target = next((a for a in answers if a.assignment_question_id == target_q_id), None)
            self.assertIsNotNone(ans_target, f"assessment_answers should have a row with assignment_question_id={target_q_id}")
            
            # CRITICAL ASSERTIONS:
            # 1. question_id must NOT be None!
            self.assertIsNotNone(ans_target.question_id, "assessment_answers.question_id must NOT be None")
            self.assertTrue(ans_target.question_id > 0, "assessment_answers.question_id must be a valid positive ID")
            
            # 2. question_id must point to an existing AssessmentQuestion
            aq = AssessmentQuestion.query.get(ans_target.question_id)
            self.assertIsNotNone(aq, "question_id must reference a valid AssessmentQuestion record")
            self.assertEqual(aq.question, target_q.question, "Referenced AssessmentQuestion text must match AssignmentQuestion text")

            # 3. assignment_question_id must reference exact assigned question
            self.assertEqual(ans_target.assignment_question_id, target_q_id)
            self.assertEqual(ans_target.answer, "A")
            expected_score = target_q.max_score if ("A" == target_q.correct_answer) else 0.0
            self.assertEqual(ans_target.score, expected_score)

            # 4. Verify to_dict output includes question_id, assignment_question_id, and template_question_id
            ans_dict = ans_target.to_dict()
            self.assertEqual(ans_dict["question_id"], target_q_id)
            self.assertEqual(ans_dict["assignment_question_id"], target_q_id)
            self.assertEqual(ans_dict["template_question_id"], aq.id)
            self.assertEqual(ans_dict["question_text"], target_q.question)

            # 5. Assignment status must be Completed
            self.assertEqual(assignment.status, "Completed")
            self.assertIsNotNone(assignment.submitted_at)

    def test_02_server_side_scoring_ignores_client_tampering(self):
        """
        Verify that scoring uses the server-persisted correct answer and max_score,
        completely ignoring any client-supplied scores or fabricated answer keys.
        """
        with self.app.app_context():
            emp = Employee.query.filter(Employee.id > 1).first() or Employee.query.first()
            user = User.query.get(emp.user_id) if emp and emp.user_id else User.query.filter_by(role='Employee').first()
            token = self.generate_token(user)

            role = LeadershipRole.query.first()
            assess = Assessment.query.filter_by(role_id=role.id).first()

            # Create fresh assignment
            test_assignment = AssessmentAssignment(
                assessment_id=assess.id,
                employee_id=emp.id,
                status="In-Progress",
                schedule_status="In-Progress",
                submission_deadline=datetime.utcnow() + timedelta(minutes=45),
                attempt_number=99
            )
            db.session.add(test_assignment)
            db.session.flush()
            self.created_assignment_ids.append(test_assignment.id)

            # Generate fresh attempt questions
            success, questions, _ = generate_and_persist_attempt_questions(test_assignment, role.id, num_questions=4)
            self.assertTrue(success)
            db.session.commit()

            # Submit 2 correct answers and 2 incorrect answers
            q_list = test_assignment.assigned_questions
            self.assertEqual(len(q_list), 4)

            correct_q1 = q_list[0]
            correct_q2 = q_list[1]
            wrong_q3 = q_list[2]
            wrong_q4 = q_list[3]

            def get_wrong(corr):
                for ch in ["A", "B", "C", "D"]:
                    if ch != (corr or "").strip().upper()[:1]:
                        return ch
                return "Z"

            wrong_ans3 = get_wrong(wrong_q3.correct_answer)
            wrong_ans4 = get_wrong(wrong_q4.correct_answer)

            # Client attempts to send fake client-supplied score
            answers_payload = {
                str(correct_q1.id): correct_q1.correct_answer,
                str(correct_q2.id): correct_q2.correct_answer,
                str(wrong_q3.id): wrong_ans3,
                str(wrong_q4.id): wrong_ans4,
            }
            tampered_request = {
                "answers": answers_payload,
                "score": 100.0,
                "overall_score": 100.0,
                "readiness_level": "High"
            }

            res = self.client.post(
                f"/api/assessment-assignments/{test_assignment.id}/submit",
                headers={"Authorization": f"Bearer {token}"},
                json=tampered_request
            )

            self.assertEqual(res.status_code, 200)
            data = res.get_json()
            
            # Expected score: 2 out of 4 questions correct = 50.0%
            expected_achieved = correct_q1.max_score + correct_q2.max_score
            expected_possible = sum(q.max_score for q in q_list)
            expected_pct = round((expected_achieved / expected_possible * 100.0), 2)

            self.assertEqual(data["data"]["overall_score"], expected_pct)
            self.assertEqual(data["data"]["total_score"], round(expected_achieved, 2))
            self.assertEqual(data["data"]["total_possible"], round(expected_possible, 2))

    def test_03_invalid_question_id_rejected_with_400(self):
        """
        Verify that submitting an arbitrary or non-existent question ID is rejected with 400.
        """
        with self.app.app_context():
            emp = Employee.query.filter(Employee.id > 1).first() or Employee.query.first()
            user = User.query.get(emp.user_id) if emp and emp.user_id else User.query.filter_by(role='Employee').first()
            token = self.generate_token(user)

            role = LeadershipRole.query.first()
            assess = Assessment.query.filter_by(role_id=role.id).first()

            assign = AssessmentAssignment(
                assessment_id=assess.id,
                employee_id=emp.id,
                status="In-Progress",
                submission_deadline=datetime.utcnow() + timedelta(minutes=30)
            )
            db.session.add(assign)
            db.session.flush()
            self.created_assignment_ids.append(assign.id)
            generate_and_persist_attempt_questions(assign, role.id, num_questions=3)
            db.session.commit()

            # Submit with an arbitrary invalid question ID 999999
            res = self.client.post(
                f"/api/assessment-assignments/{assign.id}/submit",
                headers={"Authorization": f"Bearer {token}"},
                json={"answers": {"999999": "A"}}
            )
            self.assertEqual(res.status_code, 400)
            data = res.get_json()
            self.assertIn("Invalid question ID", data.get("message", ""))

    def test_04_cross_assignment_question_rejected(self):
        """
        Verify that submitting a question ID belonging to another assignment attempt is rejected.
        """
        with self.app.app_context():
            role = LeadershipRole.query.first()
            assess = Assessment.query.filter_by(role_id=role.id).first()
            emps = Employee.query.all()
            emp1, emp2 = emps[0], emps[1]
            user1 = User.query.get(emp1.user_id) if emp1.user_id else User.query.filter_by(role='Employee').first()
            token1 = self.generate_token(user1)

            # Assign 1
            assign1 = AssessmentAssignment(
                assessment_id=assess.id, employee_id=emp1.id, status="In-Progress",
                submission_deadline=datetime.utcnow() + timedelta(minutes=30)
            )
            db.session.add(assign1)
            db.session.flush()
            self.created_assignment_ids.append(assign1.id)
            generate_and_persist_attempt_questions(assign1, role.id, num_questions=3)

            # Assign 2
            assign2 = AssessmentAssignment(
                assessment_id=assess.id, employee_id=emp2.id, status="In-Progress",
                submission_deadline=datetime.utcnow() + timedelta(minutes=30)
            )
            db.session.add(assign2)
            db.session.flush()
            self.created_assignment_ids.append(assign2.id)
            generate_and_persist_attempt_questions(assign2, role.id, num_questions=3)
            db.session.commit()

            assign2_q = assign2.assigned_questions[0]

            # Employee 1 attempts to submit a question ID from Assignment 2
            res = self.client.post(
                f"/api/assessment-assignments/{assign1.id}/submit",
                headers={"Authorization": f"Bearer {token1}"},
                json={"answers": {str(assign2_q.id): "A"}}
            )
            self.assertEqual(res.status_code, 400)
            data = res.get_json()
            self.assertIn(f"Invalid question ID {assign2_q.id}", data.get("message", ""))

    def test_05_cross_employee_submission_forbidden(self):
        """
        Verify that Employee 1 cannot submit an assessment assigned to Employee 2.
        """
        with self.app.app_context():
            emps = Employee.query.all()
            emp1, emp2 = emps[0], emps[1]
            user1 = User.query.get(emp1.user_id) if emp1.user_id else User.query.filter_by(role='Employee').first()
            token1 = self.generate_token(user1)

            role = LeadershipRole.query.first()
            assess = Assessment.query.first()

            assign_emp2 = AssessmentAssignment(
                assessment_id=assess.id,
                employee_id=emp2.id,
                status="In-Progress",
                submission_deadline=datetime.utcnow() + timedelta(minutes=30)
            )
            db.session.add(assign_emp2)
            db.session.flush()
            self.created_assignment_ids.append(assign_emp2.id)
            generate_and_persist_attempt_questions(assign_emp2, role.id, num_questions=3)
            db.session.commit()

            # Employee 1 attempts to submit Employee 2's assignment
            res = self.client.post(
                f"/api/assessment-assignments/{assign_emp2.id}/submit",
                headers={"Authorization": f"Bearer {token1}"},
                json={"answers": {}}
            )
            self.assertEqual(res.status_code, 403)
            data = res.get_json()
            self.assertIn("Access forbidden", data.get("message", ""))

    def test_06_legacy_assessment_submission_without_assigned_questions(self):
        """
        Verify backwards compatibility: An assessment assignment without assigned_questions
        (legacy model) grades against assessment_questions, sets question_id correctly,
        and sets assignment_question_id to None.
        """
        with self.app.app_context():
            emp = Employee.query.filter(Employee.id > 1).first() or Employee.query.first()
            user = User.query.get(emp.user_id) if emp and emp.user_id else User.query.filter_by(role='Employee').first()
            token = self.generate_token(user)

            assess = Assessment.query.first()
            legacy_assign = AssessmentAssignment(
                assessment_id=assess.id,
                employee_id=emp.id,
                status="In-Progress",
                submission_deadline=datetime.utcnow() + timedelta(minutes=30)
            )
            db.session.add(legacy_assign)
            db.session.flush()
            self.created_assignment_ids.append(legacy_assign.id)
            db.session.commit()

            # Ensure assigned_questions is empty
            self.assertEqual(len(legacy_assign.assigned_questions), 0)

            # Get legacy questions
            all_qs = [q for q in assess.questions if q.question_type and q.question_type.lower() in ['multiple choice', 'mcq']]
            self.assertTrue(len(all_qs) > 0)

            answers_payload = {str(q.id): (q.correct_answer or "A") for q in all_qs[:3]}

            res = self.client.post(
                f"/api/assessment-assignments/{legacy_assign.id}/submit",
                headers={"Authorization": f"Bearer {token}"},
                json={"answers": answers_payload}
            )
            self.assertEqual(res.status_code, 200)

            ans_records = AssessmentAnswer.query.filter_by(assignment_id=legacy_assign.id).all()
            self.assertTrue(len(ans_records) > 0)
            for a in ans_records:
                self.assertIsNotNone(a.question_id)
                self.assertIsNone(a.assignment_question_id)

    def test_07_invalid_submission_payload_format(self):
        """
        Verify that sending non-dict answers payload (e.g. string or list) is rejected with 400.
        """
        with self.app.app_context():
            assignment = AssessmentAssignment.query.get(32)
            emp = Employee.query.get(assignment.employee_id)
            user = User.query.get(emp.user_id) if emp and emp.user_id else User.query.filter_by(role='Employee').first()
            token = self.generate_token(user)

            res = self.client.post(
                f"/api/assessment-assignments/{assignment.id}/submit",
                headers={"Authorization": f"Bearer {token}"},
                json={"answers": "invalid_string_instead_of_dict"}
            )
            self.assertEqual(res.status_code, 400)
            data = res.get_json()
            self.assertIn("Answers must be a key-value mapping", data.get("message", ""))

if __name__ == '__main__':
    unittest.main()
