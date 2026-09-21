from flask import Blueprint, request, jsonify
from extensions import db
from models.assessment import Assessment, AssessmentQuestion, AssessmentAssignment, AssessmentAnswer, AssessmentResult
from models.employee import Employee
from models.role import LeadershipRole
from models.employee_competency import EmployeeCompetency
from models.competency import Competency
from services.gap_service import calculate_competency_gaps
from services.readiness_service import calculate_successor_readiness
from datetime import datetime

assessments_bp = Blueprint('assessments', __name__)

@assessments_bp.route('/assessments', methods=['GET'])
def get_assessments():
    assessments = Assessment.query.order_by(Assessment.id.desc()).all()
    return jsonify({
        "success": True,
        "data": [a.to_dict() for a in assessments]
    }), 200

@assessments_bp.route('/assessments', methods=['POST'])
def create_assessment():
    data = request.get_json() or {}

    title = data.get('title', '').strip()
    description = data.get('description', '').strip()
    created_by = data.get('created_by')
    role_id = data.get('role_id')
    duration = int(data.get('duration', 30))
    due_date = data.get('due_date', '')
    threshold = float(data.get('passing_threshold', 70.0))
    questions_data = data.get('questions', [])

    if not title or not role_id:
        return jsonify({"success": False, "message": "Assessment title and target leadership role are required"}), 400

    new_assessment = Assessment(
        title=title,
        description=description,
        created_by=created_by,
        role_id=role_id,
        duration=duration,
        due_date=due_date,
        passing_threshold=threshold,
        status="Active"
    )
    db.session.add(new_assessment)
    db.session.flush()

    for idx, q in enumerate(questions_data, start=1):
        q_obj = AssessmentQuestion(
            assessment_id=new_assessment.id,
            question=q.get('question', '').strip(),
            question_type=q.get('question_type', 'Multiple Choice'),
            competency_id=q.get('competency_id'),
            max_score=float(q.get('max_score', 10.0)),
            correct_answer=q.get('correct_answer', '').strip(),
            difficulty=q.get('difficulty', 'Medium'),
            order_index=idx
        )
        q_obj.set_options(q.get('options', []))
        db.session.add(q_obj)

    db.session.commit()

    return jsonify({
        "success": True,
        "data": new_assessment.to_dict(),
        "message": "Assessment created successfully with questions"
    }), 201

@assessments_bp.route('/assessments/<int:assessment_id>/assign', methods=['POST'])
def assign_assessment(assessment_id):
    assessment = Assessment.query.get(assessment_id)
    if not assessment:
        return jsonify({"success": False, "message": "Assessment not found"}), 404

    data = request.get_json() or {}
    employee_id = data.get('employee_id')
    assigned_by = data.get('assigned_by')
    due_date = data.get('due_date', assessment.due_date)
    instructions = data.get('instructions', '')

    if not employee_id:
        return jsonify({"success": False, "message": "Employee ID is required for assignment"}), 400

    employee = Employee.query.get(employee_id)
    if not employee:
        return jsonify({"success": False, "message": "Employee not found"}), 404

    # Check if already assigned and pending
    existing = AssessmentAssignment.query.filter_by(
        assessment_id=assessment_id, employee_id=employee_id
    ).filter(AssessmentAssignment.status != 'Completed').first()

    if existing:
        return jsonify({
            "success": True,
            "data": existing.to_dict(),
            "message": "Assessment already assigned to this employee"
        }), 200

    assignment = AssessmentAssignment(
        assessment_id=assessment_id,
        employee_id=employee_id,
        assigned_by=assigned_by,
        due_date=due_date,
        status="Assigned",
        instructions=instructions
    )
    db.session.add(assignment)
    db.session.commit()

    return jsonify({
        "success": True,
        "data": assignment.to_dict(),
        "message": f"Assessment assigned successfully to {employee.name}"
    }), 201

@assessments_bp.route('/my-assessments', methods=['GET'])
def get_my_assessments():
    employee_id = request.args.get('employee_id', type=int)
    
    if not employee_id:
        # Default fallback to Employee #1 (Arun Kumar) if not specified
        employee_id = 1

    assignments = AssessmentAssignment.query.filter_by(employee_id=employee_id).order_by(AssessmentAssignment.id.desc()).all()
    
    return jsonify({
        "success": True,
        "data": [a.to_dict() for a in assignments]
    }), 200

@assessments_bp.route('/assessment-assignments/<int:assignment_id>', methods=['GET'])
def get_assignment_detail(assignment_id):
    assignment = AssessmentAssignment.query.get(assignment_id)
    if not assignment:
        return jsonify({"success": False, "message": "Assessment assignment not found"}), 404

    data = assignment.to_dict()
    
    # Include questions list
    questions = AssessmentQuestion.query.filter_by(assessment_id=assignment.assessment_id).order_by(AssessmentQuestion.order_index.asc()).all()
    data["questions"] = [q.to_dict() for q in questions]

    return jsonify({
        "success": True,
        "data": data
    }), 200

@assessments_bp.route('/assessment-assignments/<int:assignment_id>/submit', methods=['POST'])
def submit_assessment(assignment_id):
    assignment = AssessmentAssignment.query.get(assignment_id)
    if not assignment:
        return jsonify({"success": False, "message": "Assessment assignment not found"}), 404

    data = request.get_json() or {}
    answers_input = data.get('answers', {}) # Dict of question_id -> string answer

    questions = AssessmentQuestion.query.filter_by(assessment_id=assignment.assessment_id).all()

    total_achieved = 0.0
    total_possible = 0.0
    competency_scores_map = {} # competency_id -> {"total": x, "possible": y}

    # Remove prior answers if resubmitting
    AssessmentAnswer.query.filter_by(assignment_id=assignment_id).delete()

    for q in questions:
        user_ans = str(answers_input.get(str(q.id)) or answers_input.get(q.id) or "").strip()
        max_sc = q.max_score
        total_possible += max_sc

        # Simple grading logic
        achieved = 0.0
        if q.question_type in ['Multiple Choice', 'Yes/No']:
            # Compare first char or string equality
            corr = (q.correct_answer or "").strip()
            if corr and (user_ans.lower() == corr.lower() or user_ans.startswith(corr[:1])):
                achieved = max_sc
            elif not corr: # if no strict key, grant full on selection
                achieved = max_sc
        elif q.question_type == 'Rating Scale':
            # Numeric value 1-5 scale to percentage
            try:
                val = float(user_ans)
                achieved = (val / 5.0) * max_sc
            except ValueError:
                achieved = max_sc * 0.8
        else: # Scenario-Based or Short Answer
            if len(user_ans) > 5:
                achieved = max_sc * 0.9 # Grant scenario answer credit
            else:
                achieved = max_sc * 0.5

        total_achieved += achieved

        # Record answer
        ans_record = AssessmentAnswer(
            assignment_id=assignment_id,
            question_id=q.id,
            answer=user_ans,
            score=achieved
        )
        db.session.add(ans_record)

        # Track per-competency score
        if q.competency_id:
            if q.competency_id not in competency_scores_map:
                competency_scores_map[q.competency_id] = {"total": 0.0, "possible": 0.0}
            competency_scores_map[q.competency_id]["total"] += achieved
            competency_scores_map[q.competency_id]["possible"] += max_sc

    # Overall percentage
    overall_score = round((total_achieved / total_possible * 100.0), 2) if total_possible > 0 else 80.0
    readiness_lvl = "High" if overall_score >= 80.0 else ("Medium" if overall_score >= 60.0 else "Low")

    # Update Assignment status
    assignment.status = "Completed"

    # Save or update result record
    result = AssessmentResult.query.filter_by(assignment_id=assignment_id).first()
    if not result:
        result = AssessmentResult(assignment_id=assignment_id)
        db.session.add(result)
    
    result.overall_score = overall_score
    result.readiness_level = readiness_lvl
    result.completed_at = datetime.utcnow()

    # Detail breakdown
    detail = {}
    for cid, sc_data in competency_scores_map.items():
        comp = Competency.query.get(cid)
        cname = comp.name if comp else f"Comp #{cid}"
        calc_pct = round((sc_data["total"] / sc_data["possible"] * 100.0), 2) if sc_data["possible"] > 0 else overall_score
        detail[cname] = calc_pct

        # Update Employee Competency current score in DB!
        emp_comp = EmployeeCompetency.query.filter_by(
            employee_id=assignment.employee_id, competency_id=cid
        ).first()
        if emp_comp:
            # Weighted average between current & new score
            emp_comp.score = round((emp_comp.score * 0.4 + calc_pct * 0.6), 2)
        else:
            db.session.add(EmployeeCompetency(
                employee_id=assignment.employee_id, competency_id=cid, score=calc_pct
            ))

    result.set_detail(detail)
    db.session.commit()

    # Calculate updated gap analysis & readiness score for employee
    updated_gap = calculate_competency_gaps(assignment.employee_id, assignment.assessment.role_id if assignment.assessment else 1)
    updated_readiness = calculate_successor_readiness(assignment.employee_id, assignment.assessment.role_id if assignment.assessment else 1)

    return jsonify({
        "success": True,
        "message": "Assessment submitted successfully.",
        "data": {
            "assignment_id": assignment_id,
            "overall_score": overall_score,
            "readiness_level": readiness_lvl,
            "competency_scores": detail,
            "updated_readiness": updated_readiness,
            "updated_gaps": updated_gap
        }
    }), 200

@assessments_bp.route('/assessment-results/<int:assignment_id>', methods=['GET'])
def get_assessment_result(assignment_id):
    assignment = AssessmentAssignment.query.get(assignment_id)
    if not assignment:
        return jsonify({"success": False, "message": "Assessment assignment not found"}), 404

    if not assignment.result:
        return jsonify({"success": False, "message": "Assessment has not been completed yet"}), 400

    data = assignment.result.to_dict()
    data["assignment"] = assignment.to_dict()

    return jsonify({
        "success": True,
        "data": data
    }), 200
