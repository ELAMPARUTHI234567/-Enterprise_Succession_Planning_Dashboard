from flask import Blueprint, request, jsonify
from extensions import db
from models.assessment import Assessment, AssessmentQuestion, AssessmentAssignment, AssessmentAnswer, AssessmentResult
from models.ml_prediction import MLPrediction
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
    all_questions = AssessmentQuestion.query.filter_by(assessment_id=assignment.assessment_id).order_by(AssessmentQuestion.order_index.asc()).all()
    
    # Requirement 1 & 16: Return ONLY MCQ questions for employee assessment
    mcq_questions = [q for q in all_questions if q.question_type and q.question_type.lower() in ['multiple choice', 'mcq']]
    
    # Requirement 9 & 10: Format MCQ questions and strip correct_answer for security
    formatted_questions = []
    labels = ["A", "B", "C", "D", "E", "F"]
    for q in mcq_questions:
        q_dict = q.to_dict()
        q_dict.pop('correct_answer', None) # Security: hide correct answer from frontend
        q_dict['question_type'] = 'mcq'
        
        raw_options = q.get_options()
        formatted_options = []
        for idx, opt in enumerate(raw_options):
            if isinstance(opt, dict):
                formatted_options.append(opt)
            elif isinstance(opt, str):
                opt_str = opt.strip()
                if len(opt_str) >= 3 and opt_str[0] in "ABCDEF" and opt_str[1:3] in [". ", ") "]:
                    lbl = opt_str[0]
                    txt = opt_str[3:].strip()
                else:
                    lbl = labels[idx] if idx < len(labels) else str(idx + 1)
                    txt = opt_str
                formatted_options.append({"label": lbl, "text": txt})
        q_dict['options'] = formatted_options
        formatted_questions.append(q_dict)

    data["questions"] = formatted_questions
    data["question_count"] = len(formatted_questions)

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

    all_questions = AssessmentQuestion.query.filter_by(assessment_id=assignment.assessment_id).all()
    # Filter to MCQ questions only
    mcq_questions = [q for q in all_questions if q.question_type and q.question_type.lower() in ['multiple choice', 'mcq']]
    valid_q_map = {q.id: q for q in mcq_questions}

    # Requirement 16: Validate submitted question IDs
    for q_id_str in answers_input.keys():
        try:
            q_id_int = int(q_id_str)
            if q_id_int not in valid_q_map:
                return jsonify({"success": False, "message": f"Invalid question ID {q_id_str} submitted for this assessment"}), 400
        except ValueError:
            return jsonify({"success": False, "message": "Invalid question ID format in submission"}), 400

    total_achieved = 0.0
    total_possible = 0.0
    competency_scores_map = {}

    AssessmentAnswer.query.filter_by(assignment_id=assignment_id).delete()

    for q in mcq_questions:
        user_ans_raw = str(answers_input.get(str(q.id)) or answers_input.get(q.id) or "").strip()
        max_sc = q.max_score
        total_possible += max_sc

        achieved = 0.0
        corr = (q.correct_answer or "").strip()

        if user_ans_raw:
            # Extract label e.g. "A" from "A" or "A. Option Text"
            user_label = user_ans_raw[0].upper() if len(user_ans_raw) > 0 and user_ans_raw[0] in "ABCDEF" else user_ans_raw.lower()
            corr_label = corr[0].upper() if len(corr) > 0 and corr[0] in "ABCDEF" else corr.lower()

            if user_ans_raw.lower() == corr.lower() or user_label == corr_label or user_ans_raw.startswith(corr[:1]):
                achieved = max_sc
            elif not corr:
                achieved = max_sc

        total_achieved += achieved

        ans_record = AssessmentAnswer(
            assignment_id=assignment_id,
            question_id=q.id,
            answer=user_ans_raw,
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

@assessments_bp.route('/assessment-results', methods=['GET'])
def get_assessment_results():
    user, employee, err_msg, status = get_current_user()
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    try:
        query = AssessmentAssignment.query.filter_by(status='Completed')

        # RBAC Data Isolation
        if user.role.lower() not in ['hr', 'admin']:
            if user.role.lower() == 'manager':
                if not employee:
                    return jsonify({"success": True, "data": []}), 200
                team_members = Employee.query.filter(
                    (Employee.manager_id == employee.id) | (Employee.id == employee.id)
                ).all()
                team_ids = [e.id for e in team_members]
                query = query.filter(AssessmentAssignment.employee_id.in_(team_ids))
            else: # Employee
                if not employee:
                    return jsonify({"success": True, "data": []}), 200
                query = query.filter_by(employee_id=employee.id)

        # Track joins to prevent duplicate join collisions in SQLAlchemy
        joined_employee = False
        joined_assessment = False
        joined_result = False

        # Optional Query Parameters
        emp_id_param = request.args.get('employee_id', type=int)
        if emp_id_param:
            query = query.filter_by(employee_id=emp_id_param)

        assessment_id_param = request.args.get('assessment_id', type=int)
        if assessment_id_param:
            query = query.filter_by(assessment_id=assessment_id_param)

        role_id_param = request.args.get('role_id', type=int)
        if role_id_param:
            if not joined_assessment:
                query = query.join(AssessmentAssignment.assessment)
                joined_assessment = True
            query = query.filter(Assessment.role_id == role_id_param)

        dept_param = request.args.get('department', '').strip()
        if dept_param and dept_param != 'All':
            if not joined_employee:
                query = query.join(AssessmentAssignment.employee)
                joined_employee = True
            query = query.filter(Employee.department == dept_param)

        search_param = request.args.get('search', '').strip()
        if search_param:
            if not joined_employee:
                query = query.join(AssessmentAssignment.employee)
                joined_employee = True
            query = query.filter(
                (Employee.name.ilike(f"%{search_param}%")) |
                (Employee.employee_code.ilike(f"%{search_param}%")) |
                (Employee.designation.ilike(f"%{search_param}%"))
            )

        readiness_param = request.args.get('readiness_level', '').strip()
        if readiness_param and readiness_param != 'All':
            if not joined_result:
                query = query.join(AssessmentAssignment.result)
                joined_result = True
            query = query.filter(AssessmentResult.readiness_level == readiness_param)

        completed_assignments = query.order_by(AssessmentAssignment.id.desc()).all()

        results_list = []
        for a in completed_assignments:
            if not a.result:
                continue

            rdata = a.result.to_dict()
            rdata["assignment"] = a.to_dict()
            rdata["employee_id"] = a.employee_id
            rdata["employee_name"] = a.employee.name if a.employee else ""
            rdata["employee_code"] = a.employee.employee_code if a.employee else ""
            rdata["department"] = a.employee.department if a.employee else ""
            rdata["designation"] = a.employee.designation if a.employee else ""
            rdata["assessment_id"] = a.assessment_id
            rdata["assessment_title"] = a.assessment.title if a.assessment else ""
            rdata["role_id"] = a.assessment.role_id if a.assessment else 1
            rdata["role_name"] = a.assessment.role.role_name if a.assessment and a.assessment.role else ""
            rdata["submission_date"] = a.result.completed_at.isoformat() if a.result.completed_at else None

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
            gaps = calculate_competency_gaps(a.employee_id, target_role_id)
            readiness = calculate_successor_readiness(a.employee_id, target_role_id)

            rdata["gap_analysis"] = gaps
            rdata["readiness"] = readiness

            # ML Prediction fetch or generate
            ml_pred = MLPrediction.query.filter_by(employee_id=a.employee_id, role_id=target_role_id).order_by(MLPrediction.id.desc()).first()
            if ml_pred:
                rdata["ml_prediction"] = ml_pred.to_dict()
            else:
                ml_res = run_ml_readiness_prediction(a.employee_id, target_role_id)
                rdata["ml_prediction"] = ml_res.get("data") if isinstance(ml_res, dict) and ml_res.get("success") else None

            dev_areas = []
            strengths = []
            if gaps and "competencies" in gaps:
                for c in gaps["competencies"]:
                    if c.get("gap", 0) > 0:
                        dev_areas.append({
                            "competency": c.get("competency_name") or c.get("name"),
                            "current_score": c.get("current_score"),
                            "required_score": c.get("required_score"),
                            "gap": c.get("gap")
                        })
                    else:
                        strengths.append({
                            "competency": c.get("competency_name") or c.get("name"),
                            "current_score": c.get("current_score"),
                            "required_score": c.get("required_score")
                        })
            rdata["development_areas"] = dev_areas
            rdata["strengths"] = strengths

            results_list.append(rdata)

        return jsonify({"success": True, "data": results_list}), 200
    except Exception as e:
        print(f"[ERROR] Exception in get_assessment_results: {str(e)}")
        return jsonify({"success": False, "message": f"Server error processing assessment results: {str(e)}"}), 500

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
    data["employee_id"] = assignment.employee_id
    data["employee_name"] = assignment.employee.name if assignment.employee else ""
    data["employee_code"] = assignment.employee.employee_code if assignment.employee else ""
    data["department"] = assignment.employee.department if assignment.employee else ""
    data["designation"] = assignment.employee.designation if assignment.employee else ""
    data["assessment_id"] = assignment.assessment_id
    data["assessment_title"] = assignment.assessment.title if assignment.assessment else ""
    data["role_id"] = assignment.assessment.role_id if assignment.assessment else 1
    data["role_name"] = assignment.assessment.role.role_name if assignment.assessment and assignment.assessment.role else ""
    data["submission_date"] = assignment.result.completed_at.isoformat() if assignment.result.completed_at else None

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

    # ML Prediction
    ml_pred = MLPrediction.query.filter_by(employee_id=assignment.employee_id, role_id=target_role_id).order_by(MLPrediction.id.desc()).first()
    if ml_pred:
        data["ml_prediction"] = ml_pred.to_dict()
    else:
        ml_res = run_ml_readiness_prediction(assignment.employee_id, target_role_id)
        data["ml_prediction"] = ml_res.get("data") if isinstance(ml_res, dict) and ml_res.get("success") else None

    dev_areas = []
    strengths = []
    if gaps and "competencies" in gaps:
        for c in gaps["competencies"]:
            if c.get("gap", 0) > 0:
                dev_areas.append({
                    "competency": c.get("competency_name") or c.get("name"),
                    "current_score": c.get("current_score"),
                    "required_score": c.get("required_score"),
                    "gap": c.get("gap")
                })
            else:
                strengths.append({
                    "competency": c.get("competency_name") or c.get("name"),
                    "current_score": c.get("current_score"),
                    "required_score": c.get("required_score")
                })
    data["development_areas"] = dev_areas
    data["strengths"] = strengths

    # Include user's question answers (without revealing correct_answer if employee role)
    answers_records = AssessmentAnswer.query.filter_by(assignment_id=assignment_id).all()
    formatted_answers = []
    for ans in answers_records:
        ans_dict = ans.to_dict()
        if user.role.lower() == 'employee':
            ans_dict.pop('correct_answer', None)
        formatted_answers.append(ans_dict)
    data["answers"] = formatted_answers

    return jsonify({
        "success": True,
        "data": data
    }), 200

