from flask import Blueprint, request, jsonify
from extensions import db
from models.question_bank import QuestionBank
from models.role import LeadershipRole
from models.competency import Competency
from models.assessment import Assessment, AssessmentQuestion, AssessmentAssignment, AssessmentAnswer
from models.employee import Employee
from utils.auth_middleware import get_current_user, require_role
from utils.seed_question_bank import seed_question_bank
from datetime import datetime
from sqlalchemy import or_

question_bank_bp = Blueprint('question_bank', __name__)

@question_bank_bp.route('/question-bank', methods=['GET'])
def get_question_bank():
    user, employee, err_msg, status = get_current_user()
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    role_id = request.args.get('role_id', type=int)
    competency_id = request.args.get('competency_id', type=int)
    difficulty = request.args.get('difficulty', type=str)
    search_query = request.args.get('q', type=str)
    q_type = request.args.get('type', type=str) # 'builtin', 'custom', 'all'

    query = QuestionBank.query.options(
        db.joinedload(QuestionBank.role),
        db.joinedload(QuestionBank.competency)
    )

    if role_id:
        query = query.filter(QuestionBank.role_id == role_id)
        # Ensure at least 20 built-in questions exist for this role
        if QuestionBank.query.filter_by(role_id=role_id).count() < 20:
            seed_question_bank()

    if competency_id:
        query = query.filter(QuestionBank.competency_id == competency_id)

    if difficulty and difficulty.strip():
        query = query.filter(QuestionBank.difficulty.ilike(f"%{difficulty.strip()}%"))

    if search_query and search_query.strip():
        query = query.filter(QuestionBank.question_text.ilike(f"%{search_query.strip()}%"))

    if q_type and q_type.strip().lower() != 'all':
        if q_type.strip().lower() in ['custom']:
            query = query.filter(or_(QuestionBank.is_custom == True, QuestionBank.stable_code.contains("CUSTOM")))
        elif q_type.strip().lower() in ['builtin', 'built-in']:
            query = query.filter(or_(QuestionBank.is_custom == False, QuestionBank.stable_code.startswith("BUILTIN_")))

    questions = query.order_by(QuestionBank.role_id.asc(), QuestionBank.id.asc()).all()

    # Determine if user is HR/Admin to securely include correct answers and explanations
    is_hr_or_admin = user and user.role.lower() in ['hr', 'admin']
    include_correct = is_hr_or_admin and request.args.get('include_correct', 'true').lower() == 'true'

    return jsonify({
        "success": True,
        "data": [q.to_dict(include_correct=include_correct) for q in questions],
        "total": len(questions)
    }), 200

@question_bank_bp.route('/question-bank/summary', methods=['GET'])
def get_question_bank_summary():
    roles = LeadershipRole.query.order_by(LeadershipRole.id.asc()).all()
    summary = []

    for r in roles:
        qb_questions = QuestionBank.query.filter_by(role_id=r.id).all()
        if len(qb_questions) < 20:
            seed_question_bank()
            qb_questions = QuestionBank.query.filter_by(role_id=r.id).all()

        builtin_count = sum(1 for q in qb_questions if not getattr(q, 'is_custom', False) and (not q.stable_code or "CUSTOM" not in q.stable_code))
        custom_count = sum(1 for q in qb_questions if getattr(q, 'is_custom', False) or (q.stable_code and "CUSTOM" in q.stable_code))

        unique_competencies = db.session.query(QuestionBank.competency_id).filter_by(role_id=r.id).distinct().count()

        summary.append({
            "role_id": r.id,
            "role_name": r.role_name,
            "department": r.department,
            "description": r.description or "",
            "total_questions": len(qb_questions),
            "builtin_questions_count": builtin_count,
            "custom_questions_count": custom_count,
            "mcq_count": len(qb_questions),
            "competencies_covered": unique_competencies,
            "question_type": "Multiple Choice"
        })

    return jsonify({
        "success": True,
        "data": summary
    }), 200

@question_bank_bp.route('/question-bank/roles/<int:role_id>', methods=['GET'])
def get_role_question_bank(role_id):
    user, employee, err_msg, status = get_current_user()
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    role = LeadershipRole.query.get(role_id)
    if not role:
        return jsonify({"success": False, "message": "Leadership role not found"}), 404

    questions = QuestionBank.query.filter_by(role_id=role_id).order_by(QuestionBank.id.asc()).all()
    if len(questions) < 20:
        seed_question_bank()
        questions = QuestionBank.query.filter_by(role_id=role_id).order_by(QuestionBank.id.asc()).all()

    builtin_count = sum(1 for q in questions if not getattr(q, 'is_custom', False) and (not q.stable_code or "CUSTOM" not in q.stable_code))
    custom_count = sum(1 for q in questions if getattr(q, 'is_custom', False) or (q.stable_code and "CUSTOM" in q.stable_code))

    is_hr = user and user.role.lower() in ['hr', 'admin']

    return jsonify({
        "success": True,
        "data": {
            "role": role.to_dict(),
            "total_question_count": len(questions),
            "built_in_question_count": builtin_count,
            "custom_question_count": custom_count,
            "question_type": "Multiple Choice",
            "questions": [q.to_dict(include_correct=is_hr) for q in questions]
        }
    }), 200

@question_bank_bp.route('/question-bank', methods=['POST'])
def add_question_to_bank():
    user, employee, err_msg, status = require_role('HR', 'Admin')
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    data = request.get_json() or {}
    role_id = data.get('role_id')
    question_text = (data.get('question_text') or data.get('question') or '').strip()
    competency_id = data.get('competency_id')
    options = data.get('options', [])
    correct_answer = (data.get('correct_answer') or '').strip().upper()
    explanation = (data.get('explanation') or '').strip()
    difficulty = (data.get('difficulty') or 'Medium').strip()
    max_score = float(data.get('max_score', 1.0))

    if not role_id:
        return jsonify({"success": False, "message": "Leadership Role is required."}), 400
    if not competency_id:
        return jsonify({"success": False, "message": "Competency is required."}), 400
    if not question_text:
        return jsonify({"success": False, "message": "Question text cannot be empty."}), 400
    if not isinstance(options, list) or len(options) < 4 or any(not str(opt).strip() for opt in options[:4]):
        return jsonify({"success": False, "message": "All 4 MCQ options (A, B, C, D) must be provided."}), 400
    if correct_answer not in ["A", "B", "C", "D"]:
        return jsonify({"success": False, "message": "Correct Answer must be selected as A, B, C, or D."}), 400

    role = LeadershipRole.query.get(role_id)
    if not role:
        return jsonify({"success": False, "message": "Leadership role not found."}), 404

    # Prevent duplicate question for the same role
    existing = QuestionBank.query.filter(
        QuestionBank.role_id == role_id,
        QuestionBank.question_text.ilike(question_text)
    ).first()
    if existing:
        return jsonify({"success": False, "message": "A question with this exact text already exists for this role."}), 400

    timestamp_str = int(datetime.utcnow().timestamp())
    new_q = QuestionBank(
        role_id=role_id,
        competency_id=competency_id,
        question_text=question_text,
        question_type='Multiple Choice',
        correct_answer=correct_answer,
        explanation=explanation,
        difficulty=difficulty,
        max_score=max_score,
        is_custom=True,
        stable_code=f"QB_{role_id}_CUSTOM_{timestamp_str}"
    )
    new_q.set_options(options[:4])
    db.session.add(new_q)
    db.session.commit()

    return jsonify({
        "success": True,
        "data": new_q.to_dict(include_correct=True),
        "message": "Custom question added successfully to Question Bank"
    }), 201

@question_bank_bp.route('/question-bank/<int:question_id>', methods=['PUT'])
def update_question_in_bank(question_id):
    user, employee, err_msg, status = require_role('HR', 'Admin')
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    q = QuestionBank.query.get(question_id)
    if not q:
        return jsonify({"success": False, "message": "Question not found"}), 404

    # Protect built-in questions
    is_builtin = not getattr(q, 'is_custom', False) and (not q.stable_code or "CUSTOM" not in q.stable_code)

    if is_builtin:
        return jsonify({"success": False, "message": "Built-in assessment questions are protected and cannot be edited."}), 400

    data = request.get_json() or {}
    role_id = data.get('role_id', q.role_id)
    question_text = (data.get('question_text') or data.get('question') or q.question_text).strip()
    competency_id = data.get('competency_id', q.competency_id)
    options = data.get('options', q.get_options())
    correct_answer = (data.get('correct_answer') or q.correct_answer).strip().upper()
    explanation = (data.get('explanation') or q.explanation or '').strip()
    difficulty = (data.get('difficulty') or q.difficulty).strip()
    max_score = float(data.get('max_score', q.max_score))

    if not role_id:
        return jsonify({"success": False, "message": "Leadership Role is required."}), 400
    if not competency_id:
        return jsonify({"success": False, "message": "Competency is required."}), 400
    if not question_text:
        return jsonify({"success": False, "message": "Question text cannot be empty."}), 400
    if not isinstance(options, list) or len(options) < 4 or any(not str(opt).strip() for opt in options[:4]):
        return jsonify({"success": False, "message": "All 4 MCQ options (A, B, C, D) must be provided."}), 400
    if correct_answer not in ["A", "B", "C", "D"]:
        return jsonify({"success": False, "message": "Correct Answer must be selected as A, B, C, or D."}), 400

    q.role_id = role_id
    q.competency_id = competency_id
    q.question_text = question_text
    q.correct_answer = correct_answer
    q.explanation = explanation
    q.difficulty = difficulty
    q.max_score = max_score
    q.set_options(options[:4])

    db.session.commit()

    return jsonify({
        "success": True,
        "data": q.to_dict(include_correct=True),
        "message": "Custom question updated successfully."
    }), 200

@question_bank_bp.route('/question-bank/<int:question_id>', methods=['DELETE'])
def delete_question_from_bank(question_id):
    user, employee, err_msg, status = require_role('HR', 'Admin')
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    q = QuestionBank.query.get(question_id)
    if not q:
        return jsonify({"success": False, "message": "Question not found"}), 404

    # Protect built-in questions
    is_builtin = not getattr(q, 'is_custom', False) and (not q.stable_code or "CUSTOM" not in q.stable_code)

    if is_builtin:
        return jsonify({"success": False, "message": "Built-in assessment questions are protected and cannot be deleted."}), 400

    # Protect historical submitted assessment results
    completed_usage = db.session.query(AssessmentAnswer).join(
        AssessmentQuestion, AssessmentAnswer.question_id == AssessmentQuestion.id
    ).join(
        AssessmentAssignment, AssessmentAnswer.assignment_id == AssessmentAssignment.id
    ).filter(
        AssessmentQuestion.question == q.question_text,
        AssessmentAssignment.status == 'Completed'
    ).count()

    if completed_usage > 0:
        return jsonify({
            "success": False,
            "message": "Cannot delete this custom question because it has already been used in completed employee assessments. Historical assessment results are protected."
        }), 400

    db.session.delete(q)
    db.session.commit()

    return jsonify({
        "success": True,
        "message": "Custom question deleted successfully from Question Bank."
    }), 200

@question_bank_bp.route('/question-bank/create-assessment', methods=['POST'])
def create_assessment_from_question_bank():
    user, employee, err_msg, status = require_role('HR', 'Admin', 'Manager')
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    data = request.get_json() or {}
    role_id = data.get('role_id')
    title = data.get('title', '').strip()
    description = data.get('description', '').strip()
    duration = int(data.get('duration', 30))
    due_date = data.get('due_date', '')
    threshold = float(data.get('passing_threshold', 70.0))
    selected_question_ids = data.get('question_ids', []) # optional list of specific question_bank IDs

    if not role_id:
        return jsonify({"success": False, "message": "Target Leadership Role is required"}), 400

    role = LeadershipRole.query.get(role_id)
    if not role:
        return jsonify({"success": False, "message": "Target leadership role not found"}), 404

    if not title:
        title = f"{role.role_name} Leadership Competency Readiness Assessment"

    # Fetch selected or all questions for selected role
    if selected_question_ids and len(selected_question_ids) > 0:
        qb_questions = QuestionBank.query.filter(
            QuestionBank.role_id == role_id,
            QuestionBank.id.in_(selected_question_ids)
        ).order_by(QuestionBank.id.asc()).all()
    else:
        qb_questions = QuestionBank.query.filter_by(role_id=role_id).order_by(QuestionBank.id.asc()).all()

    if not qb_questions or len(qb_questions) < 20:
        seed_question_bank()
        if selected_question_ids and len(selected_question_ids) > 0:
            qb_questions = QuestionBank.query.filter(
                QuestionBank.role_id == role_id,
                QuestionBank.id.in_(selected_question_ids)
            ).order_by(QuestionBank.id.asc()).all()
        else:
            qb_questions = QuestionBank.query.filter_by(role_id=role_id).order_by(QuestionBank.id.asc()).all()

    # Create Assessment template
    new_assessment = Assessment(
        title=title,
        description=description or f"Official multiple choice leadership assessment for {role.role_name}.",
        created_by=user.id,
        role_id=role_id,
        duration=duration,
        due_date=due_date,
        passing_threshold=threshold,
        status="Active"
    )
    db.session.add(new_assessment)
    db.session.flush()

    # Associate questions from Question Bank
    for idx, qb in enumerate(qb_questions, start=1):
        aq = AssessmentQuestion(
            assessment_id=new_assessment.id,
            question=qb.question_text,
            question_type='Multiple Choice',
            competency_id=qb.competency_id,
            max_score=qb.max_score,
            correct_answer=qb.correct_answer,
            explanation=qb.explanation,
            difficulty=qb.difficulty,
            order_index=idx
        )
        aq.set_options(qb.get_options())
        db.session.add(aq)

    # Optional immediate assignment to employee
    employee_id = data.get('assign_employee_id')
    assignment_dict = None
    if employee_id:
        emp = Employee.query.get(employee_id)
        if emp:
            assignment = AssessmentAssignment(
                assessment_id=new_assessment.id,
                employee_id=emp.id,
                assigned_by=user.id,
                due_date=due_date or new_assessment.due_date,
                status="Assigned",
                instructions=f"Complete all {len(qb_questions)} multiple choice questions for target role: {role.role_name}."
            )
            db.session.add(assignment)
            db.session.flush()
            assignment_dict = assignment.to_dict()

    db.session.commit()

    return jsonify({
        "success": True,
        "data": new_assessment.to_dict(),
        "assignment": assignment_dict,
        "selected_question_count": len(qb_questions),
        "message": f"Successfully created assessment with {len(qb_questions)} questions for {role.role_name}"
    }), 201
