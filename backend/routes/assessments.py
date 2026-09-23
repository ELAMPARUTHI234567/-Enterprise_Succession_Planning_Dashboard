from flask import Blueprint, request, jsonify
from extensions import db
from models.assessment import Assessment, AssessmentQuestion, AssessmentAssignment, AssessmentAnswer, AssessmentResult
from models.employee import Employee
from models.role import LeadershipRole
from models.employee_competency import EmployeeCompetency
from models.competency import Competency
from services.gap_service import calculate_competency_gaps
from services.readiness_service import calculate_successor_readiness
from services.ml_service import run_ml_readiness_prediction
from utils.auth_middleware import get_current_user, require_role
from datetime import datetime

assessments_bp = Blueprint('assessments', __name__)

@assessments_bp.route('/assessments', methods=['GET'])
def get_assessments():
    assessments = Assessment.query.options(
        db.joinedload(Assessment.role),
        db.joinedload(Assessment.creator),
        db.selectinload(Assessment.questions)
    ).order_by(Assessment.id.desc()).all()
    return jsonify({
        "success": True,
        "data": [a.to_dict() for a in assessments]
    }), 200

@assessments_bp.route('/assessments', methods=['POST'])
def create_assessment():
    user, employee, err_msg, status = require_role('HR', 'Admin')
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    data = request.get_json() or {}
    title = data.get('title', '').strip()
    description = data.get('description', '').strip()
    created_by = user.id
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
    user, employee, err_msg, status = require_role('HR', 'Manager', 'Admin')
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    assessment = Assessment.query.get(assessment_id)
    if not assessment:
        return jsonify({"success": False, "message": "Assessment not found"}), 404

    data = request.get_json() or {}
    employee_id = data.get('employee_id')
    assigned_by = user.id
    due_date = data.get('due_date', assessment.due_date)
    instructions = data.get('instructions', '')

    if not employee_id:
        return jsonify({"success": False, "message": "Employee ID is required for assignment"}), 400

    emp_target = Employee.query.get(employee_id)
    if not emp_target:
        return jsonify({"success": False, "message": "Employee not found"}), 404

    # If Manager, ensure target employee belongs to their team
    if user.role.lower() == 'manager' and employee:
        if emp_target.manager_id != employee.id and emp_target.id != employee.id:
            return jsonify({"success": False, "message": "Access forbidden: Managers can only assign assessments to direct reports."}), 403

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
        "message": f"Assessment assigned successfully to {emp_target.name}"
    }), 201

@assessments_bp.route('/my-assessments', methods=['GET'])
@assessments_bp.route('/me/assessments', methods=['GET'])
def get_my_assessments():
    user, employee, err_msg, status = get_current_user()
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    if not employee:
        return jsonify({"success": True, "data": []}), 200

    # Data Isolation: Employees ALWAYS see only their own assessments derived from authenticated user identity
    if user.role.lower() == 'employee':
        target_emp_id = employee.id
    else:
        # HR or Manager can specify employee_id query param if permitted
        requested_emp_id = request.args.get('employee_id', type=int)
        if requested_emp_id:
            if user.role.lower() == 'manager':
                target_emp = Employee.query.get(requested_emp_id)
                if not target_emp or (target_emp.manager_id != employee.id and target_emp.id != employee.id):
                    return jsonify({"success": False, "message": "Access forbidden: Managers can only view team member assessments"}), 403
            target_emp_id = requested_emp_id
        else:
            target_emp_id = employee.id

    assignments = AssessmentAssignment.query.filter_by(employee_id=target_emp_id).order_by(AssessmentAssignment.id.desc()).all()
    return jsonify({
        "success": True,
        "data": [a.to_dict() for a in assignments]
    }), 200

@assessments_bp.route('/me/results', methods=['GET'])
def get_my_results():
    user, employee, err_msg, status = get_current_user()
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    if not employee:
        return jsonify({"success": True, "data": []}), 200

    assignments = AssessmentAssignment.query.filter_by(employee_id=employee.id, status='Completed').order_by(AssessmentAssignment.id.desc()).all()
    results = []
    for a in assignments:
        if a.result:
            rdata = a.result.to_dict()
            rdata["assignment"] = a.to_dict()

            detail = rdata.get("detail", {})
            total_score = detail.get("_total_score")
            total_possible = detail.get("_total_possible")

            if total_score is None or total_possible is None:
                answers = AssessmentAnswer.query.filter_by(assignment_id=a.id).all()
                if answers:
                    total_score = sum(ans.score for ans in answers)
                    total_possible = sum(ans.question.max_score for ans in answers if ans.question)
                else:
                    total_score = rdata.get("overall_score", 80.0)
                    total_possible = 100.0

            rdata["total_score"] = round(total_score, 2)
            rdata["total_possible"] = round(total_possible, 2)

            target_role_id = a.assessment.role_id if a.assessment else 1
            gaps = calculate_competency_gaps(employee.id, target_role_id)
            readiness = calculate_successor_readiness(employee.id, target_role_id)
            rdata["gap_analysis"] = gaps
            rdata["readiness"] = readiness

            dev_areas = []
            if gaps and "competencies" in gaps:
                for c in gaps["competencies"]:
                    if c.get("gap", 0) > 0:
                        dev_areas.append({
                            "competency": c.get("name"),
                            "current_score": c.get("current_score"),
                            "target_score": c.get("target_score"),
                            "gap": c.get("gap")
                        })
            rdata["development_areas"] = dev_areas

            results.append(rdata)

    return jsonify({"success": True, "data": results}), 200

@assessments_bp.route('/me/gaps', methods=['GET'])
def get_my_gaps():
    user, employee, err_msg, status = get_current_user()
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    if not employee:
        return jsonify({"success": False, "message": "No linked employee profile found"}), 404

    role_id = request.args.get('role_id', default=1, type=int)
    gap_data = calculate_competency_gaps(employee.id, role_id)
    return jsonify({"success": True, "data": gap_data}), 200

@assessments_bp.route('/me/readiness', methods=['GET'])
def get_my_readiness():
    user, employee, err_msg, status = get_current_user()
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    if not employee:
        return jsonify({"success": False, "message": "No linked employee profile found"}), 404

    role_id = request.args.get('role_id', default=1, type=int)
    readiness_data = calculate_successor_readiness(employee.id, role_id)
    return jsonify({"success": True, "data": readiness_data}), 200

@assessments_bp.route('/assessment-assignments/<int:assignment_id>', methods=['GET'])
def get_assignment_detail(assignment_id):
    user, employee, err_msg, status = get_current_user()
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    assignment = AssessmentAssignment.query.get(assignment_id)
    if not assignment:
        return jsonify({"success": False, "message": "Assessment assignment not found"}), 404

    # Enforce data isolation: Employees can ONLY view their own assignments!
    if user.role.lower() not in ['hr', 'admin']:
        if user.role.lower() == 'manager':
            if not employee or (assignment.employee.manager_id != employee.id and assignment.employee_id != employee.id):
                return jsonify({"success": False, "message": "Access forbidden: Managers can only view team member assessments"}), 403
        else: # Employee
            if not employee or assignment.employee_id != employee.id:
                return jsonify({"success": False, "message": "Access forbidden: You cannot view another employee's assessment"}), 403

    data = assignment.to_dict()
    questions = AssessmentQuestion.query.filter_by(assessment_id=assignment.assessment_id).order_by(AssessmentQuestion.order_index.asc()).all()
    data["questions"] = [q.to_dict() for q in questions]

    return jsonify({
        "success": True,
        "data": data
    }), 200

@assessments_bp.route('/assessment-assignments/<int:assignment_id>/submit', methods=['POST'])
def submit_assessment(assignment_id):
    user, employee, err_msg, status = get_current_user()
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    assignment = AssessmentAssignment.query.get(assignment_id)
    if not assignment:
        return jsonify({"success": False, "message": "Assessment assignment not found"}), 404

    # Enforce strict data isolation: Employees can ONLY submit their own assignments!
    if user.role.lower() not in ['hr', 'admin']:
        if user.role.lower() == 'manager':
            if not employee or (assignment.employee.manager_id != employee.id and assignment.employee_id != employee.id):
                return jsonify({"success": False, "message": "Access forbidden: You cannot submit an assessment assigned to another employee"}), 403
        else: # Employee
            if not employee or assignment.employee_id != employee.id:
                return jsonify({"success": False, "message": "Access forbidden: You cannot submit an assessment assigned to another employee"}), 403

    data = request.get_json() or {}
    answers_input = data.get('answers', {})

    questions = AssessmentQuestion.query.filter_by(assessment_id=assignment.assessment_id).all()

    total_achieved = 0.0
    total_possible = 0.0
    competency_scores_map = {}

    AssessmentAnswer.query.filter_by(assignment_id=assignment_id).delete()

    for q in questions:
        user_ans = str(answers_input.get(str(q.id)) or answers_input.get(q.id) or "").strip()
        max_sc = q.max_score
        total_possible += max_sc

        achieved = 0.0
        if q.question_type in ['Multiple Choice', 'Yes/No']:
            corr = (q.correct_answer or "").strip()
            if corr and (user_ans.lower() == corr.lower() or user_ans.startswith(corr[:1])):
                achieved = max_sc
            elif not corr:
                achieved = max_sc
        elif q.question_type == 'Rating Scale':
            try:
                val = float(user_ans)
                achieved = (val / 5.0) * max_sc
            except ValueError:
                achieved = max_sc * 0.8
        else:
            if len(user_ans) > 5:
                achieved = max_sc * 0.9
            else:
                achieved = max_sc * 0.5

        total_achieved += achieved

        ans_record = AssessmentAnswer(
            assignment_id=assignment_id,
            question_id=q.id,
            answer=user_ans,
            score=achieved
        )
        db.session.add(ans_record)

        if q.competency_id:
            if q.competency_id not in competency_scores_map:
                competency_scores_map[q.competency_id] = {"total": 0.0, "possible": 0.0}
            competency_scores_map[q.competency_id]["total"] += achieved
            competency_scores_map[q.competency_id]["possible"] += max_sc

    overall_score = round((total_achieved / total_possible * 100.0), 2) if total_possible > 0 else 80.0
    readiness_lvl = "High" if overall_score >= 80.0 else ("Medium" if overall_score >= 60.0 else "Low")

    assignment.status = "Completed"

    result = AssessmentResult.query.filter_by(assignment_id=assignment_id).first()
    if not result:
        result = AssessmentResult(assignment_id=assignment_id)
        db.session.add(result)
    
    result.overall_score = overall_score
    result.readiness_level = readiness_lvl
    result.completed_at = datetime.utcnow()

    # Update Employee Competency Scores in database
    for cid, sc_data in competency_scores_map.items():
        calc_pct = round((sc_data["total"] / sc_data["possible"] * 100.0), 2) if sc_data["possible"] > 0 else overall_score

        emp_comp = EmployeeCompetency.query.filter_by(
            employee_id=assignment.employee_id, competency_id=cid
        ).first()
        if emp_comp:
            emp_comp.score = round((emp_comp.score * 0.4 + calc_pct * 0.6), 2)
        else:
            db.session.add(EmployeeCompetency(
                employee_id=assignment.employee_id, competency_id=cid, score=calc_pct
            ))

    # Fetch updated competency ratings for all competencies
    all_competencies = Competency.query.all()
    emp_competencies = EmployeeCompetency.query.filter_by(employee_id=assignment.employee_id).all()
    emp_comp_dict = {ec.competency_id: ec.score for ec in emp_competencies}

    detail = {}
    for comp in all_competencies:
        detail[comp.name] = emp_comp_dict.get(comp.id, overall_score)

    detail["_total_score"] = round(total_achieved, 2)
    detail["_total_possible"] = round(total_possible, 2)

    result.set_detail(detail)
    db.session.commit()

    target_role_id = assignment.assessment.role_id if assignment.assessment else 1
    updated_gap = calculate_competency_gaps(assignment.employee_id, target_role_id)
    updated_readiness = calculate_successor_readiness(assignment.employee_id, target_role_id)
    ml_prediction = run_ml_readiness_prediction(assignment.employee_id, target_role_id)

    return jsonify({
        "success": True,
        "message": "Assessment submitted successfully.",
        "data": {
            "assignment_id": assignment_id,
            "overall_score": overall_score,
            "total_score": round(total_achieved, 2),
            "total_possible": round(total_possible, 2),
            "readiness_level": readiness_lvl,
            "competency_scores": detail,
            "updated_readiness": updated_readiness,
            "updated_gaps": updated_gap,
            "ml_prediction": ml_prediction
        }
    }), 200

@assessments_bp.route('/assessment-results/<int:assignment_id>', methods=['GET'])
def get_assessment_result(assignment_id):
    user, employee, err_msg, status = get_current_user()
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    assignment = AssessmentAssignment.query.get(assignment_id)
    if not assignment:
        return jsonify({"success": False, "message": "Assessment assignment not found"}), 404

    # Enforce data isolation: Employee can view ONLY their own results! Manager can view direct reports' results.
    if user.role.lower() not in ['hr', 'admin']:
        if user.role.lower() == 'manager':
            if not employee or (assignment.employee.manager_id != employee.id and assignment.employee_id != employee.id):
                return jsonify({"success": False, "message": "Access forbidden: Managers can only view team member results"}), 403
        else: # Employee
            if not employee or assignment.employee_id != employee.id:
                return jsonify({"success": False, "message": "Access forbidden: You cannot view another employee's result"}), 403

    if not assignment.result:
        return jsonify({"success": False, "message": "Assessment has not been completed yet"}), 400

    data = assignment.result.to_dict()
    data["assignment"] = assignment.to_dict()

    detail = data.get("detail", {})
    total_score = detail.get("_total_score")
    total_possible = detail.get("_total_possible")

    if total_score is None or total_possible is None:
        answers = AssessmentAnswer.query.filter_by(assignment_id=assignment_id).all()
        if answers:
            total_score = sum(ans.score for ans in answers)
            total_possible = sum(ans.question.max_score for ans in answers if ans.question)
        else:
            total_score = data.get("overall_score", 80.0)
            total_possible = 100.0

    data["total_score"] = round(total_score, 2)
    data["total_possible"] = round(total_possible, 2)

    target_role_id = assignment.assessment.role_id if assignment.assessment else 1
    gaps = calculate_competency_gaps(assignment.employee_id, target_role_id)
    readiness = calculate_successor_readiness(assignment.employee_id, target_role_id)
    
    data["gap_analysis"] = gaps
    data["readiness"] = readiness

    dev_areas = []
    if gaps and "competencies" in gaps:
        for c in gaps["competencies"]:
            if c.get("gap", 0) > 0:
                dev_areas.append({
                    "competency": c.get("name"),
                    "current_score": c.get("current_score"),
                    "target_score": c.get("target_score"),
                    "gap": c.get("gap")
                })
    data["development_areas"] = dev_areas

    return jsonify({
        "success": True,
        "data": data
    }), 200

