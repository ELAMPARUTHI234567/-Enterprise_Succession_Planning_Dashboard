from flask import Blueprint, request, jsonify
from extensions import db
from models.assessment import Assessment, AssessmentQuestion, AssessmentAssignment, AssessmentAnswer, AssessmentResult, AssignmentQuestion
from models.question_bank import QuestionBank
from models.ml_prediction import MLPrediction
from models.employee import Employee
from models.role import LeadershipRole
from models.employee_competency import EmployeeCompetency
from models.competency import Competency
from services.gap_service import calculate_competency_gaps
from services.readiness_service import calculate_successor_readiness
from services.ml_service import run_ml_readiness_prediction
from services.eligibility_service import evaluate_pre_assessment_eligibility
from services.suitability_service import evaluate_leadership_suitability
from utils.auth_middleware import get_current_user, require_role
from datetime import datetime, timedelta
from models.notification import Notification
from services.scheduling_service import (
    check_scheduling_conflicts,
    validate_and_save_manual_schedules,
    check_assessment_start_permission,
    calculate_end_time_str,
    create_utc_datetime
)

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

    # Stage 1 Prerequisite and Duplicate Check (for Stage 2 Leadership Assessments)
    if (assessment.assessment_type or '').lower() != 'initial_screening':
        stage_1_assigns = [
            a for a in emp_target.assessment_assignments
            if a.status == 'Completed' and a.result and (
                (a.assessment_type or '').lower() == 'initial_screening' or
                (a.assessment and (a.assessment.assessment_type or '').lower() == 'initial_screening') or
                (a.stage and 'stage 1' in a.stage.lower())
            )
        ]
        has_passed_s1 = False
        if stage_1_assigns:
            latest_s1 = max(stage_1_assigns, key=lambda x: (x.result.completed_at if x.result else datetime.min) or datetime.min)
            res = latest_s1.result
            thresh = res.passing_threshold if (res and res.passing_threshold is not None) else 70.0
            has_passed_s1 = res.passed if (res and res.passed is not None) else (res.overall_score >= thresh)

        if not has_passed_s1:
            return jsonify({
                "success": False,
                "message": f"Stage 2 Leadership Assessment requires completing and passing Stage 1 Initial Screening (≥70%). Employee '{emp_target.name}' has not passed Stage 1."
            }), 422

        existing_active = AssessmentAssignment.query.filter(
            AssessmentAssignment.employee_id == employee_id,
            AssessmentAssignment.assessment_id == assessment.id,
            AssessmentAssignment.status.in_(['Assigned', 'Scheduled', 'In Progress', 'In-Progress'])
        ).first()
        if existing_active:
            return jsonify({
                "success": False,
                "message": f"Employee '{emp_target.name}' already has an active assignment for '{assessment.title}'."
            }), 409

    # Enforce Pre-Assessment Eligibility Check
    target_role_id = assessment.role_id if assessment.role_id else 1
    elig = evaluate_pre_assessment_eligibility(employee_id, target_role_id, employee=emp_target)
    if not elig or not elig.get("is_eligible"):
        unmet_text = "; ".join(elig.get("unmet_requirements", [])) if elig else "Pre-assessment role prerequisites not met"
        return jsonify({
            "success": False,
            "message": f"Pre-assessment eligibility check failed: Employee '{emp_target.name}' is not eligible for this leadership assessment. Reason(s): {unmet_text}",
            "eligibility": elig,
            "data": {
                "eligibility_evaluation": elig
            }
        }), 422

    existing = AssessmentAssignment.query.filter_by(
        assessment_id=assessment_id, employee_id=employee_id
    ).filter(AssessmentAssignment.status != 'Completed').first()

    if existing:
        return jsonify({
            "success": True,
            "data": existing.to_dict(),
            "message": "Assessment already assigned to this employee"
        }), 200

    prior_count = db.session.query(db.func.count(AssessmentAssignment.id)).filter(
        AssessmentAssignment.assessment_id == assessment_id,
        AssessmentAssignment.employee_id == employee_id
    ).scalar() or 0

    assignment = AssessmentAssignment(
        assessment_id=assessment_id,
        employee_id=employee_id,
        assigned_by=assigned_by,
        due_date=due_date,
        status="Assigned",
        instructions=instructions,
        attempt_number=prior_count + 1
    )
    db.session.add(assignment)
    db.session.flush()

    # Generate and persist fresh role-specific questions for this attempt
    from services.question_generator_service import generate_and_persist_attempt_questions
    success_q, res_q, code_q = generate_and_persist_attempt_questions(assignment, target_role_id)
    if not success_q:
        db.session.rollback()
        return jsonify({"success": False, "message": res_q}), code_q

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

    assignments = AssessmentAssignment.query.options(
        db.joinedload(AssessmentAssignment.assessment),
        db.joinedload(AssessmentAssignment.employee),
        db.joinedload(AssessmentAssignment.result)
    ).filter_by(employee_id=target_emp_id).order_by(AssessmentAssignment.id.desc()).all()
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

    assignments = AssessmentAssignment.query.options(
        db.joinedload(AssessmentAssignment.assessment),
        db.joinedload(AssessmentAssignment.result)
    ).filter_by(employee_id=employee.id, status='Completed').order_by(AssessmentAssignment.id.desc()).all()
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
                    total_possible = sum(
                        (ans.assignment_question.max_score if ans.assignment_question else (ans.question.max_score if ans.question else 10.0))
                        for ans in answers
                    )
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

            # Phase 3: Enforce backend timing window on question access (with early window check)
            can_access, reason, status_code = check_assessment_start_permission(
                assignment, current_user_employee_id=employee.id, is_admin=False
            )
            if not can_access:
                return jsonify({"success": False, "message": reason}), status_code

    data = assignment.to_dict()

    # Phase 3 Question Retrieval: Use attempt-specific assigned_questions if present
    if assignment.assigned_questions and len(assignment.assigned_questions) > 0:
        formatted_questions = [q.to_dict(include_correct=False) for q in assignment.assigned_questions]
    else:
        # Fallback to legacy assessment.questions
        all_questions = AssessmentQuestion.query.filter_by(assessment_id=assignment.assessment_id).order_by(AssessmentQuestion.order_index.asc()).all()
        mcq_questions = [q for q in all_questions if q.question_type and q.question_type.lower() in ['multiple choice', 'mcq']]
        formatted_questions = []
        labels = ["A", "B", "C", "D", "E", "F"]
        for q in mcq_questions:
            q_dict = q.to_dict()
            q_dict.pop('correct_answer', None) # Security: hide correct answer from frontend
            q_dict.pop('explanation', None)
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

    # Prevent duplicate submission
    if assignment.status == 'Completed':
        return jsonify({"success": False, "message": "This assessment has already been completed and submitted."}), 400

    # Backend deadline enforcement (with 60-second grace period for network latency)
    if assignment.submission_deadline:
        now_utc = datetime.utcnow()
        if now_utc > (assignment.submission_deadline + timedelta(seconds=60)):
            assignment.status = 'Completed'
            assignment.schedule_status = 'Missed'
            db.session.commit()
            return jsonify({
                "success": False,
                "message": "Submission rejected: The assessment deadline has expired. Contact HR to request a rescheduled session."
            }), 403

    data = request.get_json() or {}
    answers_input = data.get('answers', {})
    if not isinstance(answers_input, dict):
        return jsonify({"success": False, "message": "Answers must be a key-value mapping of question IDs to selected answers."}), 400

    # Phase 3: Evaluate against attempt-specific assigned_questions if present
    assigned_qs = assignment.assigned_questions
    if assigned_qs and len(assigned_qs) > 0:
        questions_to_grade = assigned_qs
        is_assigned_model = True
    else:
        all_questions = AssessmentQuestion.query.filter_by(assessment_id=assignment.assessment_id).all()
        questions_to_grade = [q for q in all_questions if q.question_type and q.question_type.lower() in ['multiple choice', 'mcq']]
        is_assigned_model = False

    valid_q_map = {q.id: q for q in questions_to_grade}

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

    for q in questions_to_grade:
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

        if is_assigned_model:
            target_assignment_question_id = q.id
            
            # Step 1: Look for an AssessmentQuestion in the current assignment's assessment template matching question text
            resolved_aq = AssessmentQuestion.query.filter_by(
                assessment_id=assignment.assessment_id,
                question=q.question
            ).first()

            # Step 2: If not found in current assessment, search across any assessment template for matching question text
            if not resolved_aq:
                resolved_aq = AssessmentQuestion.query.filter_by(question=q.question).first()

            # Step 3: Check by QuestionBank item text if question_bank_id is present
            if not resolved_aq and getattr(q, 'question_bank_id', None):
                qb_item = QuestionBank.query.get(q.question_bank_id)
                if qb_item:
                    resolved_aq = (AssessmentQuestion.query.filter_by(
                        assessment_id=assignment.assessment_id,
                        question=qb_item.question_text
                    ).first() or AssessmentQuestion.query.filter_by(question=qb_item.question_text).first())

            # Step 4: If still not found, safely create a template AssessmentQuestion for this assessment
            # so NOT NULL and FOREIGN KEY constraints in SQLite and PostgreSQL are strictly maintained.
            if not resolved_aq:
                resolved_aq = AssessmentQuestion(
                    assessment_id=assignment.assessment_id,
                    question=q.question,
                    question_type=q.question_type or 'Multiple Choice',
                    competency_id=q.competency_id,
                    max_score=q.max_score or 10.0,
                    options_json=q.options_json,
                    correct_answer=q.correct_answer,
                    explanation=q.explanation,
                    difficulty=q.difficulty or 'Medium',
                    order_index=q.order_index or 1
                )
                db.session.add(resolved_aq)
                db.session.flush()

            target_question_id = resolved_aq.id
        else:
            target_question_id = q.id
            target_assignment_question_id = None

        ans_record = AssessmentAnswer(
            assignment_id=assignment_id,
            question_id=target_question_id,
            assignment_question_id=target_assignment_question_id,
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
    passing_threshold = assignment.assessment.passing_threshold if assignment.assessment and assignment.assessment.passing_threshold is not None else 70.0
    passed = bool(overall_score >= passing_threshold)
    ass_type = assignment.assessment_type or (assignment.assessment.assessment_type if assignment.assessment else 'leadership_role')
    stage_val = assignment.stage or (assignment.assessment.stage if assignment.assessment else 'Stage 2')

    result = AssessmentResult.query.filter_by(assignment_id=assignment_id).first()
    if not result:
        result = AssessmentResult(assignment_id=assignment_id)
        db.session.add(result)
    
    result.overall_score = overall_score
    result.readiness_level = readiness_lvl
    result.passed = passed
    result.passing_threshold = passing_threshold
    result.assessment_type = ass_type
    result.stage = stage_val
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
    assignment.status = 'Completed'
    assignment.schedule_status = 'Completed'
    assignment.submitted_at = datetime.utcnow()
    assignment.assessment_type = ass_type
    assignment.stage = stage_val
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
            "passed": passed,
            "passing_threshold": passing_threshold,
            "assessment_type": ass_type,
            "stage": stage_val,
            "competency_scores": detail,
            "updated_readiness": updated_readiness,
            "updated_gaps": updated_gap,
            "ml_prediction": ml_prediction
        }
    }), 200

@assessments_bp.route('/hr/eligible-initial-screened-employees', methods=['GET'])
def get_eligible_initial_screened_employees():
    """
    Module 5: HR Eligible Employee Dashboard Endpoint.
    Retrieves active employees who passed Stage 1 Initial Screening assessment (score >= 70%)
    across the entire organization, eligible for Stage 2 leadership role assessments.
    Supports filtering by department, manager_id, min_score, and search keyword.
    """
    user, _, err_msg, status = require_role('HR', 'Admin')
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    dept_filter = request.args.get('department')
    mgr_filter = request.args.get('manager_id', type=int)
    min_score_filter = request.args.get('min_score', default=70.0, type=float)
    search_q = (request.args.get('search') or '').strip().lower()

    # Query all active employees with direct relationships
    query = Employee.query.options(
        db.joinedload(Employee.manager),
        db.selectinload(Employee.assessment_assignments).joinedload(AssessmentAssignment.assessment),
        db.selectinload(Employee.assessment_assignments).joinedload(AssessmentAssignment.result)
    )

    if dept_filter and dept_filter != 'All':
        query = query.filter_by(department=dept_filter)
    if mgr_filter:
        query = query.filter_by(manager_id=mgr_filter)
    if search_q:
        query = query.filter(
            (Employee.name.ilike(f"%{search_q}%")) |
            (Employee.employee_code.ilike(f"%{search_q}%")) |
            (Employee.email.ilike(f"%{search_q}%"))
        )

    all_employees = query.order_by(Employee.id.asc()).all()
    eligible_list = []

    for emp in all_employees:
        # Find completed Stage 1 initial screening assignments
        stage_1_assigns = [
            a for a in emp.assessment_assignments
            if a.status == 'Completed' and a.result and (
                (a.assessment_type or '').lower() == 'initial_screening' or
                (a.assessment and (a.assessment.assessment_type or '').lower() == 'initial_screening') or
                (a.stage and 'stage 1' in a.stage.lower())
            )
        ]

        if not stage_1_assigns:
            continue

        latest_s1 = max(stage_1_assigns, key=lambda x: (x.result.completed_at if x.result else datetime.min) or datetime.min)
        res = latest_s1.result
        score = res.overall_score if res else 0.0
        threshold = res.passing_threshold if (res and res.passing_threshold is not None) else 70.0
        is_passed = res.passed if (res and res.passed is not None) else (score >= threshold)

        if not is_passed or score < min_score_filter:
            continue

        # Look for any Stage 2 leadership assignments
        stage_2_assigns = [
            a for a in emp.assessment_assignments
            if (a.assessment_type or '').lower() == 'leadership_role' or
               (a.stage and 'stage 2' in a.stage.lower()) or
               (a.assessment and (a.assessment.assessment_type or '').lower() == 'leadership_role')
        ]

        s2_summary = []
        for s2 in stage_2_assigns:
            s2_res = s2.result
            s2_summary.append({
                "assignment_id": s2.id,
                "assessment_id": s2.assessment_id,
                "role_id": s2.assessment.role_id if s2.assessment else None,
                "role_name": s2.assessment.role.role_name if s2.assessment and s2.assessment.role else "Leadership Role",
                "status": s2.status,
                "score": s2_res.overall_score if s2_res else None,
                "passed": s2_res.passed if (s2_res and s2_res.passed is not None) else ((s2_res.overall_score >= 70.0) if s2_res else False),
                "completed_at": s2_res.completed_at.isoformat() if s2_res and s2_res.completed_at else None
            })

        eligible_list.append({
            "employee_id": emp.id,
            "name": emp.name,
            "employee_code": emp.employee_code,
            "email": emp.email,
            "department": emp.department,
            "designation": emp.designation,
            "experience_years": emp.experience_years,
            "performance_score": emp.performance_score,
            "leadership_score": emp.leadership_score,
            "manager_id": emp.manager_id,
            "manager_name": emp.manager.name if emp.manager else "Unassigned",
            "stage_1_screening": {
                "assignment_id": latest_s1.id,
                "assessment_id": latest_s1.assessment_id,
                "title": latest_s1.assessment.title if latest_s1.assessment else "Initial Screening",
                "score": score,
                "passing_threshold": threshold,
                "passed": True,
                "status": "Passed",
                "completed_at": res.completed_at.isoformat() if res and res.completed_at else None
            },
            "stage_2_count": len(s2_summary),
            "stage_2_assessments": s2_summary,
            "eligible_for_stage_2": True
        })

    # Sort descending by Stage 1 score then experience
    eligible_list.sort(key=lambda x: (x["stage_1_screening"]["score"], x["experience_years"]), reverse=True)

    return jsonify({
        "success": True,
        "count": len(eligible_list),
        "data": eligible_list
    }), 200

@assessments_bp.route('/assessment-results', methods=['GET'])
def get_assessment_results():
    user, employee, err_msg, status = get_current_user()
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    try:
        include_all = request.args.get('include_all', 'false').strip().lower() in ['true', '1', 'yes']
        status_filter = request.args.get('status', '').strip()

        query = AssessmentAssignment.query.options(
            db.joinedload(AssessmentAssignment.assessment),
            db.joinedload(AssessmentAssignment.employee),
            db.joinedload(AssessmentAssignment.result)
        )

        # Status filtering on the initial query
        if not include_all and (not status_filter or status_filter == 'Completed'):
            query = query.filter_by(status='Completed')
        elif status_filter and status_filter not in ['All', '']:
            if status_filter == 'Completed':
                query = query.filter_by(status='Completed')
            elif status_filter in ['Assigned', 'Scheduled']:
                query = query.filter(AssessmentAssignment.status.in_(['Assigned', 'Scheduled']))
            elif status_filter in ['In Progress', 'In-Progress']:
                query = query.filter(AssessmentAssignment.status.in_(['In Progress', 'In-Progress', 'Scheduled']))
            elif status_filter in ['Passed', 'Failed']:
                query = query.filter_by(status='Completed')

        # RBAC Data Isolation
        if user.role.lower() not in ['hr', 'admin']:
            if user.role.lower() == 'manager':
                if not employee:
                    return jsonify({"success": True, "data": []}), 200
                team_members = Employee.query.filter(
                    (Employee.manager_id == employee.id) | (Employee.id == employee.id)
                ).all()
                team_ids = [e.id for e in team_members]
                # Manager sees direct reports OR assessments they assigned
                query = query.filter(
                    (AssessmentAssignment.employee_id.in_(team_ids)) |
                    (AssessmentAssignment.assigned_by == user.id)
                )
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

        latest_only_param = request.args.get('latest_only', 'true').strip().lower() in ['true', '1', 'yes']
        by_candidate_param = request.args.get('by_candidate', 'false').strip().lower() in ['true', '1', 'yes']

        # Group duplicate attempts by (employee_id, assessment_id) to pick the latest valid completed attempt
        if latest_only_param or by_candidate_param:
            attempts_map = {}
            for a in completed_assignments:
                key = (a.employee_id, a.assessment_id)
                curr_time = a.submitted_at or (a.result.completed_at if a.result else None)
                if key not in attempts_map:
                    attempts_map[key] = a
                else:
                    prev_a = attempts_map[key]
                    prev_time = prev_a.submitted_at or (prev_a.result.completed_at if prev_a.result else None)
                    if curr_time and prev_time:
                        if curr_time > prev_time:
                            attempts_map[key] = a
                    elif curr_time and not prev_time:
                        attempts_map[key] = a
                    elif a.id > prev_a.id:
                        attempts_map[key] = a
            completed_assignments = list(attempts_map.values())

        results_list = []
        for a in completed_assignments:
            real_st = a.get_real_status()
            is_completed = (a.status == 'Completed' and a.result is not None)
            stage_name = a.stage or ("Stage 1: Initial Screening" if (a.assessment_type or '').lower() == 'initial_screening' else "Stage 2: Leadership Role")
            pass_score = (a.result.passing_threshold if (a.result and a.result.passing_threshold is not None) else (a.assessment.passing_threshold if a.assessment else 70.0))

            if not is_completed:
                # If uncompleted assignments not requested, skip
                if not include_all and (not status_filter or status_filter in ['Completed', 'Passed', 'Failed']):
                    continue
                if status_filter == 'In Progress' and real_st != 'In Progress':
                    continue
                if status_filter in ['Assigned', 'Scheduled'] and real_st not in ['Assigned', 'Scheduled', 'Available']:
                    continue

                rdata = {
                    "id": a.id,
                    "assignment_id": a.id,
                    "assignment": a.to_dict(),
                    "employee_id": a.employee_id,
                    "employee_name": a.employee.name if a.employee else "",
                    "employee_code": a.employee.employee_code if a.employee else "",
                    "email": a.employee.email if a.employee else "",
                    "department": a.employee.department if a.employee else "",
                    "designation": a.employee.designation if a.employee else "",
                    "manager_id": a.employee.manager_id if a.employee else None,
                    "manager_name": a.employee.manager.name if (a.employee and a.employee.manager) else "Unassigned",
                    "assessment_id": a.assessment_id,
                    "assessment_title": a.assessment.title if a.assessment else "",
                    "assessment_stage": stage_name,
                    "stage": stage_name,
                    "role_id": a.assessment.role_id if a.assessment else 1,
                    "role_name": a.assessment.role.role_name if a.assessment and a.assessment.role else "",
                    "overall_score": None,
                    "score": None,
                    "normalized_percentage": None,
                    "total_score": None,
                    "total_possible": 100.0,
                    "passing_score": pass_score,
                    "passing_threshold": pass_score,
                    "result": "Pending",
                    "passed": None,
                    "completion_date": None,
                    "submission_date": None,
                    "status": real_st,
                    "hr_eligibility": "Ineligible",
                    "eligible_for_hr": False,
                    "readiness_level": "Evaluating",
                    "development_areas": [],
                    "strengths": [],
                    "answers": []
                }
                results_list.append(rdata)
                continue

            # Completed assignment processing
            rdata = a.result.to_dict()
            rdata["assignment"] = a.to_dict()
            rdata["assignment_id"] = a.id
            rdata["employee_id"] = a.employee_id
            rdata["employee_name"] = a.employee.name if a.employee else ""
            rdata["employee_code"] = a.employee.employee_code if a.employee else ""
            rdata["email"] = a.employee.email if a.employee else ""
            rdata["department"] = a.employee.department if a.employee else ""
            rdata["designation"] = a.employee.designation if a.employee else ""
            rdata["manager_id"] = a.employee.manager_id if a.employee else None
            rdata["manager_name"] = a.employee.manager.name if (a.employee and a.employee.manager) else "Unassigned"
            rdata["assessment_id"] = a.assessment_id
            rdata["assessment_title"] = a.assessment.title if a.assessment else ""
            rdata["assessment_stage"] = stage_name
            rdata["stage"] = stage_name
            rdata["role_id"] = a.assessment.role_id if a.assessment else 1
            rdata["role_name"] = a.assessment.role.role_name if a.assessment and a.assessment.role else ""
            rdata["submission_date"] = a.result.completed_at.isoformat() if a.result.completed_at else None
            rdata["completion_date"] = a.result.completed_at.strftime('%Y-%m-%d') if a.result.completed_at else None
            rdata["status"] = real_st

            detail = rdata.get("detail", {})
            total_score = detail.get("_total_score")
            total_possible = detail.get("_total_possible")

            if total_score is None or total_possible is None:
                answers = AssessmentAnswer.query.filter_by(assignment_id=a.id).all()
                if answers:
                    total_score = sum(ans.score for ans in answers)
                    total_possible = sum(
                        (ans.assignment_question.max_score if ans.assignment_question else (ans.question.max_score if ans.question else 10.0))
                        for ans in answers
                    )
                else:
                    total_score = rdata.get("overall_score", 80.0)
                    total_possible = 100.0

            total_sc_num = float(total_score)
            total_poss_num = float(total_possible) if float(total_possible) > 0 else 100.0
            norm_pct = round((total_sc_num / total_poss_num * 100.0), 2)

            is_pass = a.result.passed if a.result.passed is not None else (norm_pct >= pass_score)
            if status_filter == 'Passed' and not is_pass:
                continue
            if status_filter == 'Failed' and is_pass:
                continue

            rdata["total_score"] = round(total_sc_num, 2)
            rdata["total_possible"] = round(total_poss_num, 2)
            rdata["normalized_percentage"] = norm_pct
            rdata["overall_score"] = norm_pct
            rdata["score"] = norm_pct
            rdata["passing_score"] = pass_score
            rdata["passing_threshold"] = pass_score
            rdata["result"] = "Pass" if is_pass else "Fail"
            rdata["passed"] = bool(is_pass)
            rdata["hr_eligibility"] = "Eligible" if is_pass else "Ineligible"
            rdata["eligible_for_hr"] = bool(is_pass)

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

            # Pre-assessment eligibility and evidence enrichment
            pre_elig = evaluate_pre_assessment_eligibility(a.employee_id, target_role_id, employee=a.employee)
            cand_suit = evaluate_leadership_suitability(a.employee_id, target_role_id, employee=a.employee)

            rdata["pre_assessment_eligibility"] = pre_elig
            rdata["pre_assessment_status"] = pre_elig.get("status") if pre_elig else "Not Evaluated"
            rdata["is_pre_assessment_eligible"] = pre_elig.get("is_eligible") if pre_elig else False
            rdata["pre_assessment_reasons"] = pre_elig.get("reasons", []) if pre_elig else []
            rdata["unmet_requirements"] = pre_elig.get("unmet_requirements", []) if pre_elig else []

            rdata["suitability_score"] = cand_suit.get("suitability_score") if cand_suit else None
            rdata["suitability_level"] = cand_suit.get("suitability", {}).get("suitability_level") or (cand_suit.get("suitability_level") if cand_suit else "Medium")
            rdata["evidence_coverage_pct"] = cand_suit.get("evidence_coverage_pct", 0.0) if cand_suit else 0.0
            rdata["project_summary"] = cand_suit.get("project_summary", {}) if cand_suit else {}
            rdata["skill_details"] = cand_suit.get("skill_details", {}) if cand_suit else {}
            rdata["experience_summary"] = cand_suit.get("experience_summary", {}) if cand_suit else {}
            rdata["is_mandatory_eligible"] = cand_suit.get("is_mandatory_eligible", True) if cand_suit else True
            rdata["missing_mandatory"] = cand_suit.get("criteria_scores", {}).get("skills", {}).get("missing_mandatory", []) if cand_suit else []

            results_list.append(rdata)

        # Standard competition rank calculation with honest tie-handling
        # Sort numerically by normalized_percentage descending (completed first)
        results_list.sort(key=lambda x: (x["normalized_percentage"] is not None, x["normalized_percentage"] or 0.0), reverse=True)

        current_rank = 1
        for idx, res in enumerate(results_list):
            if res["normalized_percentage"] is None:
                res["assessment_rank"] = "-"
                res["is_highest_scorer"] = False
            else:
                if idx > 0 and results_list[idx - 1]["normalized_percentage"] is not None and res["normalized_percentage"] < results_list[idx - 1]["normalized_percentage"]:
                    current_rank = idx + 1
                res["assessment_rank"] = current_rank
                res["is_highest_scorer"] = (current_rank == 1 and res["normalized_percentage"] > 0)
            res["assessment_rank"] = current_rank
            res["is_highest_scorer"] = (current_rank == 1 and res["normalized_percentage"] > 0)

        # Count completed assessments per employee across the organization
        emp_counts = {}
        for r in results_list:
            eid = r["employee_id"]
            emp_counts[eid] = emp_counts.get(eid, 0) + 1
        for r in results_list:
            r["completed_assessments_count"] = emp_counts.get(r["employee_id"], 1)

        # If aggregated candidate view requested
        if by_candidate_param:
            by_emp = {}
            for r in results_list:
                eid = r["employee_id"]
                if eid not in by_emp:
                    by_emp[eid] = {
                        "employee_id": eid,
                        "employee_name": r["employee_name"],
                        "employee_code": r["employee_code"],
                        "email": r["email"],
                        "department": r["department"],
                        "designation": r["designation"],
                        "role_id": r["role_id"],
                        "role_name": r["role_name"],
                        "assessment_name": r["assessment_title"],
                        "total_score": r["total_score"],
                        "total_possible": r["total_possible"],
                        "normalized_percentage": r["normalized_percentage"],
                        "overall_score": r["normalized_percentage"],
                        "status": "Completed",
                        "completed_assessments_count": 1,
                        "submission_date": r["submission_date"],
                        "readiness_level": r.get("readiness_level", "Medium"),
                        "attempts": [r]
                    }
                else:
                    rec = by_emp[eid]
                    rec["attempts"].append(r)
                    rec["completed_assessments_count"] += 1
                    rec["total_score"] = round(rec["total_score"] + r["total_score"], 2)
                    rec["total_possible"] = round(rec["total_possible"] + r["total_possible"], 2)
                    rec["assessment_name"] += f", {r['assessment_title']}"
                    # Aggregate normalized percentage across relevant completed assessments
                    avg_norm = round(sum(att["normalized_percentage"] for att in rec["attempts"]) / len(rec["attempts"]), 1)
                    rec["normalized_percentage"] = avg_norm
                    rec["overall_score"] = avg_norm

            candidate_summaries = list(by_emp.values())
            candidate_summaries.sort(key=lambda x: x["normalized_percentage"], reverse=True)
            c_rank = 1
            for idx, c_res in enumerate(candidate_summaries):
                if idx > 0 and c_res["normalized_percentage"] < candidate_summaries[idx - 1]["normalized_percentage"]:
                    c_rank = idx + 1
                c_res["assessment_rank"] = c_rank
                c_res["computed_rank"] = c_rank
                c_res["is_highest_scorer"] = (c_rank == 1 and c_res["normalized_percentage"] > 0)
                c_res["is_highest"] = (c_rank == 1 and c_res["normalized_percentage"] > 0)
            return jsonify({"success": True, "data": candidate_summaries}), 200

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
            if not employee or (assignment.employee.manager_id != employee.id and assignment.employee_id != employee.id and assignment.assigned_by != user.id):
                return jsonify({"success": False, "message": "Access forbidden: Managers can only view team member results or assessments they assigned"}), 403
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
            total_possible = sum(
                (ans.assignment_question.max_score if ans.assignment_question else (ans.question.max_score if ans.question else 10.0))
                for ans in answers
            )
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

# =========================================================================
# MODULE 5: HR-CONTROLLED MANUAL ASSESSMENT SCHEDULING & TIMING ENFORCEMENT
# =========================================================================

@assessments_bp.route('/assessment-schedules/check-conflicts', methods=['POST'])
def check_conflicts():
    user, _, err_msg, status = require_role('HR', 'Admin')
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    data = request.get_json() or {}
    schedules = data.get('schedules')
    if schedules is None:
        schedules = data.get('assignments')
    if not schedules or not isinstance(schedules, list):
        schedules = []
    res = check_scheduling_conflicts(schedules)

    return jsonify({
        "success": True,
        "has_blocking_conflicts": res["has_blocking_conflicts"],
        "conflicts": res["conflicts"]
    }), 200

@assessments_bp.route('/assessment-schedules/batch-save', methods=['POST'])
def batch_save_schedules():
    user, employee, err_msg, status = require_role('HR', 'Admin', 'Manager')
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    data = request.get_json() or {}
    assessment_id = data.get('assessment_id')
    schedules = data.get('schedules')
    if schedules is None:
        schedules = data.get('assignments')

    # Defensive check: if assessment_id was passed as a dict
    if isinstance(assessment_id, dict):
        nested = assessment_id
        if not schedules:
            schedules = nested.get('schedules') or nested.get('assignments')
        assessment_id = nested.get('assessment_id')
        if not data.get('role_id') and nested.get('role_id'):
            data['role_id'] = nested.get('role_id')
        if not data.get('title') and nested.get('title'):
            data['title'] = nested.get('title')

    if not assessment_id:
        role_id = data.get('role_id') or data.get('target_role_id')
        title = str(data.get('title') or '').strip()
        if role_id:
            role = LeadershipRole.query.get(role_id)
            existing = None
            if title:
                existing = Assessment.query.filter_by(role_id=role_id, title=title).first()
            if not existing:
                existing = Assessment.query.filter_by(role_id=role_id).first()
            if existing:
                assessment_id = existing.id
            else:
                new_ass = Assessment(
                    title=title or (f"{role.role_name} Leadership Assessment" if role else f"Role #{role_id} Leadership Assessment"),
                    description=str(data.get('description') or 'Manual HR-scheduled leadership assessment.').strip(),
                    created_by=user.id,
                    role_id=role_id,
                    duration=30,
                    passing_threshold=70.0
                )
                db.session.add(new_ass)
                db.session.flush()
                assessment_id = new_ass.id

    if not assessment_id:
        return jsonify({"success": False, "message": "Assessment ID or target leadership role is required"}), 400

    # Phase 3 Unified Batch Scheduling: HR / Manager provides:
    if not schedules or not isinstance(schedules, list):
        emp_ids = (
            data.get('employee_ids') or 
            data.get('selected_employee_ids') or 
            data.get('target_employee_ids') or 
            data.get('employees')
        )
        sc_date = str(data.get('scheduled_date') or data.get('date') or '').strip()
        st_time = str(data.get('start_time') or '').strip()
        end_time = str(data.get('end_time') or '').strip()
        dur_val = data.get('duration_minutes') if data.get('duration_minutes') is not None else data.get('duration')
        tz_val = str(data.get('time_zone') or 'IST (Asia/Kolkata)').strip()
        inst_val = str(data.get('instructions') or '').strip()

        if emp_ids and isinstance(emp_ids, list) and len(emp_ids) > 0:
            schedules = []
            for eid in emp_ids:
                schedules.append({
                    "employee_id": eid,
                    "scheduled_date": sc_date,
                    "start_time": st_time,
                    "end_time": end_time if end_time else None,
                    "duration_minutes": dur_val,
                    "time_zone": tz_val,
                    "instructions": inst_val
                })

    if not schedules or not isinstance(schedules, list):
        return jsonify({"success": False, "message": "Schedules list is required and cannot be empty"}), 400

    # Strict Scope Enforcement for Managers:
    if user.role.lower() == 'manager':
        mgr_emp = employee
        if not mgr_emp:
            return jsonify({"success": False, "message": "Manager profile not associated with account"}), 404
        for s in schedules:
            if isinstance(s, dict):
                eid = s.get('employee_id')
                if eid:
                    target_emp = Employee.query.get(eid)
                    if not target_emp or target_emp.manager_id != mgr_emp.id:
                        return jsonify({
                            "success": False,
                            "message": "Access forbidden: Managers may only schedule assessments for their authorized direct reports."
                        }), 403


    global_tz = str(data.get('time_zone') or 'IST (Asia/Kolkata)').strip()
    for s in schedules:
        if isinstance(s, dict) and not s.get('time_zone'):
            s['time_zone'] = global_tz

    saved, err, err_code = validate_and_save_manual_schedules(assessment_id, schedules, user.id)
    if err:
        return jsonify({"success": False, "message": err}), err_code

    return jsonify({
        "success": True,
        "data": {
            "assignments": saved,
            "created_count": len(saved)
        },
        "message": f"Successfully assigned and saved schedules for {len(saved)} employee(s)."
    }), 201

@assessments_bp.route('/assessment-schedules', methods=['GET'])
def get_assessment_schedules():
    user, current_emp, err_msg, status = get_current_user()
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    query = AssessmentAssignment.query.options(
        db.joinedload(AssessmentAssignment.assessment),
        db.joinedload(AssessmentAssignment.employee),
        db.joinedload(AssessmentAssignment.result)
    ).filter(AssessmentAssignment.scheduled_date.isnot(None))

    role_lower = user.role.lower()
    if role_lower not in ['hr', 'admin']:
        if role_lower == 'manager':
            if not current_emp:
                return jsonify({"success": True, "data": []}), 200
            team_members = Employee.query.filter(
                (Employee.manager_id == current_emp.id) | (Employee.id == current_emp.id)
            ).all()
            team_ids = [e.id for e in team_members]
            query = query.filter(AssessmentAssignment.employee_id.in_(team_ids))
        else: # Employee: strict data isolation
            if not current_emp:
                return jsonify({"success": True, "data": []}), 200
            query = query.filter_by(employee_id=current_emp.id)

    status_filter = request.args.get('status')
    if status_filter and status_filter != 'All':
        query = query.filter(
            (AssessmentAssignment.schedule_status == status_filter) |
            (AssessmentAssignment.status == status_filter)
        )

    date_filter = request.args.get('date')
    if date_filter:
        query = query.filter(AssessmentAssignment.scheduled_date == date_filter)

    role_id_filter = request.args.get('role_id', type=int)
    if role_id_filter:
        query = query.join(Assessment).filter(Assessment.role_id == role_id_filter)

    schedules = query.order_by(AssessmentAssignment.scheduled_date.desc(), AssessmentAssignment.start_time.asc()).all()

    return jsonify({
        "success": True,
        "data": [s.to_dict() for s in schedules]
    }), 200

@assessments_bp.route('/assessment-schedules/<int:assignment_id>/reschedule', methods=['PUT'])
def reschedule_assessment(assignment_id):
    user, _, err_msg, status = require_role('HR', 'Admin')
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    assignment = AssessmentAssignment.query.get(assignment_id)
    if not assignment:
        return jsonify({"success": False, "message": "Assessment assignment not found"}), 404

    data = request.get_json() or {}
    sc_date = str(data.get('scheduled_date', '')).strip()
    st_time = str(data.get('start_time', '')).strip()
    duration = data.get('duration_minutes')
    time_zone = str(data.get('time_zone') or assignment.time_zone or 'UTC').strip()
    instructions = data.get('instructions')

    if not sc_date or not st_time or not duration:
        return jsonify({"success": False, "message": "Explicit date, start time, and duration are required to reschedule"}), 400

    duration = int(duration)
    end_time_calc = calculate_end_time_str(st_time, duration)

    # Check conflicts for rescheduled slot
    conflict_check = check_scheduling_conflicts([{
        "assignment_id": assignment_id,
        "employee_id": assignment.employee_id,
        "employee_name": assignment.employee.name if assignment.employee else "",
        "scheduled_date": sc_date,
        "start_time": st_time,
        "duration_minutes": duration
    }])

    if conflict_check["has_blocking_conflicts"]:
        err_msgs = [c["message"] for c in conflict_check["conflicts"] if c["severity"] == "error"]
        return jsonify({"success": False, "message": f"Conflict detected: {'; '.join(err_msgs)}"}), 409

    start_utc = create_utc_datetime(sc_date, st_time, time_zone)
    end_utc = start_utc + timedelta(minutes=duration) if start_utc else create_utc_datetime(sc_date, end_time_calc, time_zone)

    assignment.scheduled_date = sc_date
    assignment.start_time = st_time
    assignment.duration_minutes = duration
    assignment.end_time = end_time_calc
    assignment.time_zone = time_zone
    assignment.scheduled_start_datetime = start_utc
    assignment.scheduled_end_datetime = end_utc
    assignment.due_date = f"{sc_date} {end_time_calc}"
    assignment.status = 'Scheduled'
    assignment.schedule_status = 'Scheduled'
    if instructions:
        assignment.instructions = instructions.strip()

    # Create in-app notification for the employee
    if assignment.employee and assignment.employee.user_id:
        notif = Notification(
            user_id=assignment.employee.user_id,
            title="Assessment Rescheduled",
            message=f"HR has rescheduled your assessment '{assignment.assessment.title if assignment.assessment else ''}' to {sc_date} at {st_time} ({duration} mins).",
            type="schedule_updated",
            link="/employee-dashboard"
        )
        db.session.add(notif)

    db.session.commit()

    return jsonify({
        "success": True,
        "data": assignment.to_dict(),
        "message": "Assessment successfully rescheduled"
    }), 200

@assessments_bp.route('/assessment-schedules/<int:assignment_id>/cancel', methods=['POST'])
def cancel_assessment_schedule(assignment_id):
    user, _, err_msg, status = require_role('HR', 'Admin')
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    assignment = AssessmentAssignment.query.get(assignment_id)
    if not assignment:
        return jsonify({"success": False, "message": "Assessment assignment not found"}), 404

    data = request.get_json() or {}
    reason = data.get('reason', 'Cancelled by HR administration').strip()

    assignment.status = 'Cancelled'
    assignment.schedule_status = 'Cancelled'

    if assignment.employee and assignment.employee.user_id:
        notif = Notification(
            user_id=assignment.employee.user_id,
            title="Assessment Cancelled",
            message=f"The scheduled session for '{assignment.assessment.title if assignment.assessment else ''}' on {assignment.scheduled_date} has been cancelled: {reason}.",
            type="assessment_cancelled",
            link="/employee-dashboard"
        )
        db.session.add(notif)

    db.session.commit()

    return jsonify({
        "success": True,
        "data": assignment.to_dict(),
        "message": "Assessment appointment cancelled"
    }), 200

@assessments_bp.route('/assessment-assignments/<int:assignment_id>/start', methods=['POST'])
def start_assessment_attempt(assignment_id):
    """
    Backend Authoritative Start Window & Timer Initiation:
    Ensures that the attempt is strictly authorized, records the exact start timestamp,
    calculates the authoritative submission deadline, and marks status as 'In-Progress'.
    """
    user, current_emp, err_msg, status = get_current_user()
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    assignment = AssessmentAssignment.query.get(assignment_id)
    if not assignment:
        return jsonify({"success": False, "message": "Assessment assignment not found"}), 404

    is_admin = user.role.lower() in ['hr', 'admin']
    curr_emp_id = current_emp.id if current_emp else None

    can_start, reason, status_code = check_assessment_start_permission(
        assignment, current_user_employee_id=curr_emp_id, is_admin=is_admin
    )
    if not can_start:
        return jsonify({"success": False, "message": reason}), status_code

    now_utc = datetime.utcnow()
    duration = assignment.duration_minutes or (assignment.assessment.duration if assignment.assessment else 30)

    # Set actual start time if not already started
    if not assignment.actual_start_time:
        assignment.actual_start_time = now_utc
        assignment.submission_deadline = now_utc + timedelta(minutes=duration)
        assignment.status = 'In-Progress'
        assignment.schedule_status = 'In-Progress'
        db.session.commit()

    # Calculate remaining seconds against the authoritative backend deadline
    remaining_seconds = max(0, int((assignment.submission_deadline - now_utc).total_seconds()))

    return jsonify({
        "success": True,
        "message": "Assessment attempt started successfully.",
        "data": {
            "assignment_id": assignment_id,
            "actual_start_time": assignment.actual_start_time.isoformat() + "Z" if assignment.actual_start_time else None,
            "submission_deadline": assignment.submission_deadline.isoformat() + "Z" if assignment.submission_deadline else None,
            "duration_minutes": duration,
            "duration_seconds": duration * 60,
            "seconds_remaining": remaining_seconds,
            "remaining_seconds": remaining_seconds,
            "time_zone": assignment.time_zone or "IST (Asia/Kolkata)"
        }
    }), 200

@assessments_bp.route('/assessment-assignments/<int:assignment_id>/window-status', methods=['GET'])
def get_window_status(assignment_id):
    user, current_emp, err_msg, status = get_current_user()
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    assignment = AssessmentAssignment.query.get(assignment_id)
    if not assignment:
        return jsonify({"success": False, "message": "Assessment assignment not found"}), 404

    is_admin = user.role.lower() in ['hr', 'admin']
    curr_emp_id = current_emp.id if current_emp else None

    can_start, reason, status_code = check_assessment_start_permission(
        assignment, current_user_employee_id=curr_emp_id, is_admin=is_admin
    )

    now_utc = datetime.utcnow()
    early_window = assignment.scheduled_start_datetime - timedelta(minutes=15) if assignment.scheduled_start_datetime else None

    is_expired = False
    if assignment.scheduled_end_datetime and now_utc > assignment.scheduled_end_datetime:
        is_expired = True

    is_early = False
    if early_window and now_utc < early_window:
        is_early = True

    seconds_until_start = 0
    if assignment.scheduled_start_datetime and now_utc < assignment.scheduled_start_datetime:
        seconds_until_start = max(0, int((assignment.scheduled_start_datetime - now_utc).total_seconds()))

    seconds_until_open = 0
    if early_window and now_utc < early_window:
        seconds_until_open = max(0, int((early_window - now_utc).total_seconds()))

    seconds_remaining = None
    if assignment.submission_deadline:
        seconds_remaining = max(0, int((assignment.submission_deadline - now_utc).total_seconds()))
    elif assignment.scheduled_end_datetime and not is_expired and not is_early:
        seconds_remaining = (assignment.duration_minutes or 30) * 60

    window_status_str = "open" if can_start else ("expired" if is_expired else ("early" if is_early else "locked"))

    response_data = {
        "assignment_id": assignment_id,
        "window_status": window_status_str,
        "can_start": can_start,
        "window_open": can_start,
        "permitted": can_start,
        "is_expired": is_expired,
        "is_early": is_early,
        "reason": reason,
        "message": reason,
        "schedule_status": assignment.schedule_status or assignment.status,
        "scheduled_date": assignment.scheduled_date,
        "start_time": assignment.start_time,
        "end_time": assignment.end_time,
        "duration_minutes": assignment.duration_minutes or 30,
        "time_zone": assignment.time_zone or "IST (Asia/Kolkata)",
        "scheduled_start": f"{assignment.scheduled_date} {assignment.start_time} ({assignment.time_zone or 'UTC'})",
        "scheduled_end": f"{assignment.scheduled_date} {assignment.end_time} ({assignment.time_zone or 'UTC'})",
        "scheduled_start_utc": assignment.scheduled_start_datetime.isoformat() + "Z" if assignment.scheduled_start_datetime else None,
        "scheduled_end_utc": assignment.scheduled_end_datetime.isoformat() + "Z" if assignment.scheduled_end_datetime else None,
        "current_server_time_utc": now_utc.isoformat() + "Z",
        "actual_start_time": assignment.actual_start_time.isoformat() + "Z" if assignment.actual_start_time else None,
        "submission_deadline": assignment.submission_deadline.isoformat() + "Z" if assignment.submission_deadline else None,
        "seconds_until_start": seconds_until_start,
        "seconds_until_open": seconds_until_open,
        "seconds_remaining": seconds_remaining,
        "remaining_seconds": seconds_remaining,
        "is_in_progress": assignment.status == 'In-Progress',
        "is_completed": assignment.status == 'Completed'
    }

    return jsonify({
        "success": True,
        "window_status": window_status_str,
        "can_start": can_start,
        "window_open": can_start,
        "permitted": can_start,
        "is_expired": is_expired,
        "message": reason,
        "data": response_data
    }), 200

