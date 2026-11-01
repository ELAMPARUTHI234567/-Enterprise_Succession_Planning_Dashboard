from flask import Blueprint, request, jsonify
from datetime import datetime
from extensions import db
from models.vacancy import ManagerVacancy, VacancyDecision
from models.employee import Employee
from models.role import LeadershipRole
from models.suitability_config import SuitabilityConfig
from models.notification import Notification
from models.assessment import AssessmentAssignment
from services.suitability_service import evaluate_leadership_suitability
from services.eligibility_service import evaluate_pre_assessment_eligibility, get_role_eligibility_config
from utils.auth_middleware import require_role, get_current_user

vacancies_bp = Blueprint('vacancies', __name__)

# ============================================================================
# STEP 1: RECORD THE VACANCY
# ============================================================================

@vacancies_bp.route('/vacancies', methods=['POST'])
def create_manager_vacancy():
    """
    POST /api/vacancies
    Step 1: HR records or confirms a Manager's departure and logs the open vacancy.
    Preserves historical tasks, reviews, projects, and assessments without deleting records.
    """
    user, employee, err_msg, status = require_role('HR', 'Admin')
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    data = request.get_json() or {}
    departing_mgr_id = data.get('departing_manager_id')
    role_id = data.get('role_id')
    effective_date = str(data.get('effective_departure_date') or datetime.utcnow().strftime('%Y-%m-%d')).strip()
    reason = str(data.get('reason') or 'Leadership Vacancy').strip()

    if not departing_mgr_id:
        return jsonify({"success": False, "message": "Departing manager ID is required"}), 400

    departing_mgr = Employee.query.get(departing_mgr_id)
    if not departing_mgr:
        return jsonify({"success": False, "message": "Departing manager not found"}), 404

    # Determine or infer role
    if not role_id:
        role = LeadershipRole.query.filter(LeadershipRole.role_name.ilike(f"%{departing_mgr.designation}%")).first()
        if not role:
            role = LeadershipRole.query.first()
        role_id = role.id if role else 1
    else:
        role = LeadershipRole.query.get(role_id)
        if not role:
            return jsonify({"success": False, "message": f"Leadership role #{role_id} not found"}), 404

    # Check for existing open vacancy for this departing manager and role
    existing = ManagerVacancy.query.filter_by(
        departing_manager_id=departing_mgr_id,
        role_id=role_id,
        status='Open'
    ).first()
    if existing:
        return jsonify({
            "success": True,
            "data": existing.to_dict(),
            "message": "An open vacancy already exists for this managerial position."
        }), 200

    # Mark departing manager as Departed / Unavailable without deleting account or history
    departing_mgr.availability_status = 'Departed'

    vacancy = ManagerVacancy(
        role_id=role_id,
        departing_manager_id=departing_mgr_id,
        effective_departure_date=effective_date,
        reason=reason,
        status='Open'
    )
    db.session.add(vacancy)
    db.session.commit()

    # Direct reports affected
    reports_count = Employee.query.filter_by(manager_id=departing_mgr_id).count()

    return jsonify({
        "success": True,
        "data": vacancy.to_dict(),
        "affected_direct_reports_count": reports_count,
        "message": f"Recorded vacancy for {departing_mgr.name}'s position ({role.role_name}). {reports_count} direct report(s) are pending successor appointment."
    }), 201


@vacancies_bp.route('/vacancies', methods=['GET'])
def list_manager_vacancies():
    """
    GET /api/vacancies
    Lists all manager vacancies. Filterable by status ('Open', 'Appointed', 'All').
    """
    user, employee, err_msg, status = require_role('HR', 'Admin', 'Manager')
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    status_filter = request.args.get('status', 'All').strip()
    query = ManagerVacancy.query

    if status_filter != 'All' and status_filter:
        query = query.filter(ManagerVacancy.status == status_filter)

    vacancies = query.order_by(ManagerVacancy.id.desc()).all()
    results = []
    for v in vacancies:
        vd = v.to_dict()
        affected_count = Employee.query.filter_by(manager_id=v.departing_manager_id).count()
        vd["affected_direct_reports_count"] = affected_count
        results.append(vd)

    return jsonify({
        "success": True,
        "data": results,
        "total": len(results)
    }), 200


@vacancies_bp.route('/vacancies/<int:vacancy_id>', methods=['GET'])
def get_vacancy_detail(vacancy_id):
    """
    GET /api/vacancies/<id>
    Returns detailed vacancy profile, departing manager records, and affected direct reports.
    """
    user, employee, err_msg, status = require_role('HR', 'Admin', 'Manager')
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    vacancy = ManagerVacancy.query.get(vacancy_id)
    if not vacancy:
        return jsonify({"success": False, "message": "Vacancy not found"}), 404

    vd = vacancy.to_dict()
    affected_reports = Employee.query.filter_by(manager_id=vacancy.departing_manager_id).all()
    vd["affected_direct_reports"] = [e.to_dict() for e in affected_reports]
    vd["decisions"] = [d.to_dict() for d in vacancy.decisions]

    return jsonify({
        "success": True,
        "data": vd
    }), 200


# ============================================================================
# STEP 2: FIND POTENTIAL CANDIDATES ACROSS ALL TEAMS & UNASSIGNED
# ============================================================================

@vacancies_bp.route('/vacancies/<int:vacancy_id>/candidates', methods=['GET'])
def get_vacancy_candidates(vacancy_id):
    """
    GET /api/vacancies/<id>/candidates
    Step 2: Cross-team candidate discovery!
    Searches employees across ALL sources:
    1. Employees reporting to departing manager
    2. Employees reporting to other managers
    3. Unassigned employees (no manager)
    4. Other qualified employees org-wide
    Categorizes candidates into:
    - 'Eligible for consideration'
    - 'Requires assessment'
    - 'Not eligible yet'
    - 'Insufficient evidence'
    """
    user, employee, err_msg, status = require_role('HR', 'Admin')
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    vacancy = ManagerVacancy.query.get(vacancy_id)
    if not vacancy:
        return jsonify({"success": False, "message": "Vacancy not found"}), 404

    role_id = vacancy.role_id
    role = vacancy.role
    config = get_role_eligibility_config(role_id, role.role_name if role else "")

    # Exclude departing manager and already departed employees
    all_employees = Employee.query.filter(
        Employee.id != vacancy.departing_manager_id,
        Employee.availability_status != 'Departed'
    ).order_by(Employee.id.asc()).all()

    emp_ids = [e.id for e in all_employees]

    # Pre-fetch completed assessments for this role
    completed_assignments = AssessmentAssignment.query.filter(
        AssessmentAssignment.employee_id.in_(emp_ids),
        AssessmentAssignment.assessment.has(role_id=role_id),
        AssessmentAssignment.status == 'Completed'
    ).all() if emp_ids else []
    completed_emp_ids = set(a.employee_id for a in completed_assignments)

    categorized = {
        "eligible": [],
        "requires_assessment": [],
        "not_eligible": [],
        "insufficient_evidence": []
    }

    all_candidate_evals = []

    for emp in all_employees:
        # Determine candidate source
        if emp.manager_id == vacancy.departing_manager_id:
            source = "Departing Manager's Team"
        elif emp.manager_id is None:
            source = "Unassigned Employee"
        else:
            source = f"Team {emp.manager.name if emp.manager else 'Other'}"

        elig = evaluate_pre_assessment_eligibility(emp.id, role_id, config=config, employee=emp, role=role)
        if not elig:
            continue

        cov = elig.get("evidence_coverage_pct", 0.0)
        has_completed_ass = emp.id in completed_emp_ids

        # Evaluate candidate categorization
        if cov < 40.0:
            category = "Insufficient evidence"
            badge = "insufficient_evidence"
            categorized["insufficient_evidence"].append(emp.id)
        elif not elig.get("is_eligible"):
            category = "Not eligible yet"
            badge = "not_eligible"
            categorized["not_eligible"].append(emp.id)
        elif not has_completed_ass:
            category = "Requires assessment"
            badge = "requires_assessment"
            categorized["requires_assessment"].append(emp.id)
        else:
            category = "Eligible for consideration"
            badge = "eligible"
            categorized["eligible"].append(emp.id)

        item = {
            "employee_id": emp.id,
            "employee_code": emp.employee_code,
            "name": emp.name,
            "email": emp.email,
            "department": emp.department,
            "designation": emp.designation,
            "current_manager_id": emp.manager_id,
            "current_manager_name": emp.manager.name if emp.manager else "Unassigned",
            "candidate_source": source,
            "category": category,
            "category_badge": badge,
            "is_pre_assessment_eligible": elig.get("is_eligible", False),
            "has_completed_assessment": has_completed_ass,
            "evidence_coverage_pct": cov,
            "skill_match_pct": elig.get("skill_match_pct", 0.0),
            "total_experience_years": elig.get("total_experience_years", 0.0),
            "company_tenure_months": elig.get("company_tenure_months", 0.0),
            "competency_average": elig.get("competency_average", 0.0),
            "unmet_requirements": elig.get("unmet_requirements", [])
        }
        all_candidate_evals.append(item)

    payload_data = {
        "vacancy_id": vacancy_id,
        "role_id": role_id,
        "role_name": role.role_name if role else "Leadership Role",
        "thresholds_applied": config.to_dict(),
        "candidates": all_candidate_evals,
        "counts": {
            "total_considered": len(all_candidate_evals),
            "eligible_for_consideration": len(categorized["eligible"]),
            "requires_assessment": len(categorized["requires_assessment"]),
            "not_eligible_yet": len(categorized["not_eligible"]),
            "insufficient_evidence": len(categorized["insufficient_evidence"])
        }
    }
    return jsonify({
        "success": True,
        "data": payload_data,
        **payload_data
    }), 200


# ============================================================================
# STEPS 3 & 4: EVALUATE, RANK, AND RECOMMEND SUCCESSORS
# ============================================================================

@vacancies_bp.route('/vacancies/<int:vacancy_id>/recommendations', methods=['GET'])
def get_vacancy_recommendations(vacancy_id):
    """
    GET /api/vacancies/<id>/recommendations
    Steps 3 & 4: Evaluate candidates using the 5-criterion framework:
    1. Leadership competencies and readiness (30%)
    2. Performance and verified project outcomes (25%)
    3. Skills match (20%)
    4. Relevant professional experience (15%)
    5. Completed role-specific assessment (10%)
    Total = 100%. Configurable by HR.
    Ranks candidates, highlights strengths/gaps/evidence, and distinguishes:
    - Highest overall suitability
    - Highest assessment scorer
    - Strongest project performer
    """
    user, employee, err_msg, status = require_role('HR', 'Admin')
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    vacancy = ManagerVacancy.query.get(vacancy_id)
    if not vacancy:
        return jsonify({"success": False, "message": "Vacancy not found"}), 404

    role_id = vacancy.role_id
    role = vacancy.role
    config = SuitabilityConfig.get_active_config()

    # Search all active employees across all teams and unassigned
    all_employees = Employee.query.filter(
        Employee.id != vacancy.departing_manager_id,
        Employee.availability_status != 'Departed'
    ).order_by(Employee.id.asc()).all()

    ranked_candidates = []
    top_assessment_cand = None
    top_project_cand = None
    top_suitability_cand = None

    for emp in all_employees:
        eval_dossier = evaluate_leadership_suitability(
            emp.id, role_id, config=config, employee=emp, role=role
        )
        if not eval_dossier:
            continue

        suit_score = eval_dossier.get("suitability_score")
        has_sufficient = eval_dossier.get("has_sufficient_data", True)
        cov = eval_dossier.get("evidence_coverage_pct", 0.0)

        # Source tracking
        if emp.manager_id == vacancy.departing_manager_id:
            source = "Departing Manager's Direct Report"
        elif emp.manager_id is None:
            source = "Unassigned Employee"
        else:
            source = f"Reporting to {emp.manager.name if emp.manager else 'Other Manager'}"

        ass_score = eval_dossier.get("assessment_score")
        proj_score = eval_dossier.get("projects_score")
        readiness_score = eval_dossier.get("readiness_score")
        skills_score = eval_dossier.get("skills_score")
        exp_score = eval_dossier.get("experience_score")

        crit = eval_dossier.get("criteria_scores", {})
        ass_status = eval_dossier.get("assessment_status", "Not Assigned")

        # Clear explanation generation
        strengths = []
        gaps = []
        if readiness_score is not None and readiness_score >= 75.0:
            strengths.append(f"Strong leadership readiness ({readiness_score}%)")
        elif readiness_score is not None and readiness_score < 60.0:
            gaps.append(f"Leadership readiness gap ({readiness_score}%)")

        if proj_score is not None and proj_score >= 80.0:
            strengths.append(f"Outstanding verified project delivery ({proj_score}%)")
        elif proj_score is None:
            gaps.append("Unverified project outcome records")

        if skills_score is not None and skills_score >= 80.0:
            strengths.append(f"High technical skill alignment ({skills_score}%)")
        elif skills_score is not None and skills_score < 60.0:
            gaps.append(f"Missing core technical skill requirements ({skills_score}%)")

        if ass_score is not None and ass_score >= 75.0:
            strengths.append(f"Validated assessment score ({ass_score}%)")
        elif ass_score is None:
            gaps.append("Has not completed target role assessment")

        explanation = ""
        if suit_score is not None:
            if suit_score >= 80.0:
                explanation = f"Top-tier succession candidate with strong balance across verified competencies ({readiness_score}%) and verified projects."
            elif suit_score >= 65.0:
                explanation = f"Viable candidate with solid technical skills, recommended for shortlisting with focused development on {gaps[0] if gaps else 'leadership mentoring'}."
            else:
                explanation = f"Emerging candidate who requires structured coaching on {', '.join(gaps[:2]) if gaps else 'leadership skills'}."
        else:
            explanation = "Insufficient verified evidence (<40% data coverage) to formulate a reliable leadership ranking."

        candidate_record = {
            "employee_id": emp.id,
            "employee_code": emp.employee_code,
            "name": emp.name,
            "email": emp.email,
            "department": emp.department,
            "designation": emp.designation,
            "candidate_source": source,
            "suitability_score": suit_score,
            "has_sufficient_data": has_sufficient,
            "evidence_coverage_pct": cov,
            "criterion_scores": {
                "leadership_readiness": {
                    "score": readiness_score,
                    "weight": config.readiness_weight,
                    "weighted_points": round(readiness_score * (config.readiness_weight / 100.0), 1) if readiness_score is not None else 0.0,
                    "evidence_source": "Leadership Competencies & Readiness Evaluation"
                },
                "project_outcomes": {
                    "score": proj_score,
                    "weight": config.projects_weight,
                    "weighted_points": round(proj_score * (config.projects_weight / 100.0), 1) if proj_score is not None else 0.0,
                    "evidence_source": "Verified Project History & Success Rates"
                },
                "skills_match": {
                    "score": skills_score,
                    "weight": config.skills_weight,
                    "weighted_points": round(skills_score * (config.skills_weight / 100.0), 1) if skills_score is not None else 0.0,
                    "evidence_source": "Registered Skills & Proficiency Matrix"
                },
                "professional_experience": {
                    "score": exp_score,
                    "weight": config.experience_weight,
                    "weighted_points": round(exp_score * (config.experience_weight / 100.0), 1) if exp_score is not None else 0.0,
                    "evidence_source": "Professional History & Company Tenure"
                },
                "role_assessment": {
                    "score": ass_score,
                    "weight": config.assessment_weight,
                    "weighted_points": round(ass_score * (config.assessment_weight / 100.0), 1) if ass_score is not None else 0.0,
                    "status": ass_status,
                    "evidence_source": "Validated Role-Specific Assessment Results"
                }
            },
            "strengths": strengths,
            "competency_gaps": gaps,
            "explanation": explanation,
            "dossier": eval_dossier
        }
        ranked_candidates.append(candidate_record)

    # Sort candidates by suitability_score descending, putting None at the end
    ranked_candidates.sort(
        key=lambda c: (
            c["suitability_score"] is not None,
            c["suitability_score"] if c["suitability_score"] is not None else -1
        ),
        reverse=True
    )

    # Identify top performers in distinct domains
    valid_suit = [c for c in ranked_candidates if c["suitability_score"] is not None]
    if valid_suit:
        top_suitability_cand = {
            "name": valid_suit[0]["name"],
            "employee_id": valid_suit[0]["employee_id"],
            "score": valid_suit[0]["suitability_score"],
            "department": valid_suit[0]["department"]
        }

    valid_ass = sorted(
        [c for c in ranked_candidates if c["criterion_scores"]["role_assessment"]["score"] is not None],
        key=lambda c: c["criterion_scores"]["role_assessment"]["score"],
        reverse=True
    )
    if valid_ass:
        top_assessment_cand = {
            "name": valid_ass[0]["name"],
            "employee_id": valid_ass[0]["employee_id"],
            "score": valid_ass[0]["criterion_scores"]["role_assessment"]["score"],
            "department": valid_ass[0]["department"]
        }

    valid_proj = sorted(
        [c for c in ranked_candidates if c["criterion_scores"]["project_outcomes"]["score"] is not None],
        key=lambda c: c["criterion_scores"]["project_outcomes"]["score"],
        reverse=True
    )
    if valid_proj:
        top_project_cand = {
            "name": valid_proj[0]["name"],
            "employee_id": valid_proj[0]["employee_id"],
            "score": valid_proj[0]["criterion_scores"]["project_outcomes"]["score"],
            "department": valid_proj[0]["department"]
        }

    return jsonify({
        "success": True,
        "vacancy_id": vacancy_id,
        "role_name": role.role_name if role else "Leadership Position",
        "scoring_weights": config.to_dict(),
        "top_performers": {
            "top_overall_suitability": top_suitability_cand,
            "top_assessment_scorer": top_assessment_cand,
            "top_project_performer": top_project_cand
        },
        "ranked_candidates": ranked_candidates,
        "total_evaluated": len(ranked_candidates)
    }), 200


# ============================================================================
# STEP 5: HR REVIEWS, ACTIONS, AND CONFIRMS APPOINTMENT
# ============================================================================

@vacancies_bp.route('/vacancies/<int:vacancy_id>/action', methods=['POST'])
def record_vacancy_action(vacancy_id):
    """
    POST /api/vacancies/<id>/action
    Step 5 Review: HR shortlists, requests assessment, or records feedback.
    """
    user, employee, err_msg, status = require_role('HR', 'Admin')
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    vacancy = ManagerVacancy.query.get(vacancy_id)
    if not vacancy:
        return jsonify({"success": False, "message": "Vacancy not found"}), 404

    data = request.get_json() or {}
    employee_id = data.get('employee_id')
    action = str(data.get('action') or 'Shortlist').strip()
    comments = str(data.get('comments') or '').strip()

    if not employee_id:
        return jsonify({"success": False, "message": "Employee ID is required"}), 400

    cand_emp = Employee.query.get(employee_id)
    if not cand_emp:
        return jsonify({"success": False, "message": "Employee not found"}), 404

    valid_actions = ['Shortlist', 'Approve', 'Decline', 'Request Assessment']
    if action not in valid_actions:
        return jsonify({"success": False, "message": f"Action must be one of: {', '.join(valid_actions)}"}), 400

    decision = VacancyDecision(
        vacancy_id=vacancy_id,
        employee_id=employee_id,
        reviewer_user_id=user.id,
        action=action,
        comments=comments
    )
    db.session.add(decision)

    if action == 'Shortlist' and vacancy.status == 'Open':
        vacancy.status = 'Under Review'

    # In-app notification
    if action == 'Request Assessment' and cand_emp.user_id:
        notif = Notification(
            user_id=cand_emp.user_id,
            title="Leadership Assessment Requested",
            message=f"HR has flagged your profile for the vacant {vacancy.role.role_name if vacancy.role else 'Leadership'} position. Please complete your assigned assessment.",
            type="assessment_assigned",
            link="/employee-dashboard"
        )
        db.session.add(notif)

    db.session.commit()

    return jsonify({
        "success": True,
        "message": f"Recorded action '{action}' for candidate {cand_emp.name}.",
        "data": decision.to_dict()
    }), 201


@vacancies_bp.route('/vacancies/<int:vacancy_id>/appoint', methods=['POST'])
def appoint_manager_successor(vacancy_id):
    """
    POST /api/vacancies/<id>/appoint
    Step 5 Appointment Confirmation:
    Authorized HR confirms the appointment of the successor.
    Executed in an atomic database transaction:
    - Concurrency check: Vacancy must still be 'Open' or 'Under Review'. Prevents race conditions / duplicate appointment.
    - Updates appointed employee's designation to managerial role.
    - Atomically transfers all direct reports of the departing manager to the newly appointed manager.
    - Updates vacancy status to 'Appointed'.
    - Preserves audit history and historical records.
    - Emits in-app notifications to newly appointed manager and affected direct reports.
    """
    user, employee, err_msg, status = require_role('HR', 'Admin')
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    data = request.get_json() or {}
    appointed_emp_id = data.get('employee_id') or data.get('appointed_employee_id')
    appointment_notes = str(data.get('appointment_notes') or data.get('notes') or '').strip()

    if not appointed_emp_id:
        return jsonify({"success": False, "message": "Employee ID is required for appointment"}), 400

    # Atomic Transaction
    try:
        vacancy = ManagerVacancy.query.filter_by(id=vacancy_id).with_for_update().first()
        if not vacancy:
            return jsonify({"success": False, "message": "Vacancy not found"}), 404

        # Concurrency & Duplicate Appointment Prevention
        if vacancy.status == 'Appointed':
            return jsonify({
                "success": False,
                "message": f"Conflict: This vacancy has already been filled. Manager {vacancy.appointed_employee.name if vacancy.appointed_employee else ''} was appointed on {vacancy.appointed_at}."
            }), 409

        if vacancy.status == 'Cancelled':
            return jsonify({"success": False, "message": "Conflict: This vacancy has been cancelled and cannot be filled."}), 409

        candidate = Employee.query.get(appointed_emp_id)
        if not candidate:
            return jsonify({"success": False, "message": "Candidate employee not found"}), 404

        if candidate.id == vacancy.departing_manager_id:
            return jsonify({"success": False, "message": "Departing manager cannot be appointed as their own successor"}), 400

        # Update candidate designation to the leadership position
        role_title = vacancy.role.role_name if vacancy.role else "Engineering Manager"
        old_desig = candidate.designation
        candidate.designation = role_title

        # Reassign departing manager's direct reports to the newly appointed manager
        affected_reports = Employee.query.filter_by(manager_id=vacancy.departing_manager_id).all()
        for report in affected_reports:
            report.manager_id = candidate.id

        # Update candidate's own manager relationship if they previously reported to someone else
        if candidate.manager_id == vacancy.departing_manager_id:
            candidate.manager_id = None # Now top-level manager in team

        # Update vacancy record
        vacancy.status = 'Appointed'
        vacancy.appointed_employee_id = candidate.id
        vacancy.appointed_by_user_id = user.id
        vacancy.appointed_at = datetime.utcnow()
        vacancy.appointment_notes = appointment_notes

        # Audit decision record
        decision = VacancyDecision(
            vacancy_id=vacancy.id,
            employee_id=candidate.id,
            reviewer_user_id=user.id,
            action='Approve',
            comments=f"Official appointment confirmed by {user.name}. Designation updated from {old_desig} to {role_title}. {len(affected_reports)} direct report(s) transferred."
        )
        db.session.add(decision)

        # Notify newly appointed manager
        if candidate.user_id:
            notif = Notification(
                user_id=candidate.user_id,
                title="Leadership Appointment Confirmed",
                message=f"Congratulations! You have been officially appointed as {role_title}. Your team now has {len(affected_reports)} direct report(s).",
                type="appointment_confirmed",
                link="/manager-dashboard"
            )
            db.session.add(notif)

        # Notify reassigned direct reports
        for report in affected_reports:
            if report.user_id and report.id != candidate.id:
                notif = Notification(
                    user_id=report.user_id,
                    title="Reporting Line Update",
                    message=f"{candidate.name} has been appointed as your new manager for {vacancy.departing_manager.department if vacancy.departing_manager else 'your department'}.",
                    type="reporting_update",
                    link="/my-profile"
                )
                db.session.add(notif)

        db.session.commit()

        return jsonify({
            "success": True,
            "message": f"Successfully appointed {candidate.name} as {role_title}. {len(affected_reports)} direct report(s) reassigned.",
            "data": {
                "vacancy": vacancy.to_dict(),
                "appointed_manager": candidate.to_dict(),
                "transferred_direct_reports_count": len(affected_reports)
            }
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": f"Appointment transaction failed: {str(e)}"}), 500


# ============================================================================
# CONFIGURABLE SCORING WEIGHTS
# ============================================================================

@vacancies_bp.route('/vacancies/scoring-config', methods=['GET'])
def get_scoring_config():
    """GET /api/vacancies/scoring-config: Returns current suitability weights."""
    config = SuitabilityConfig.get_active_config()
    return jsonify({"success": True, "data": config.to_dict()}), 200


@vacancies_bp.route('/vacancies/scoring-config', methods=['PUT'])
def update_scoring_config():
    """PUT /api/vacancies/scoring-config: Updates suitability weights (must sum to 100%)."""
    user, employee, err_msg, status = require_role('HR', 'Admin')
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    data = request.get_json() or {}
    config = SuitabilityConfig.get_active_config()

    try:
        r_w = float(data.get('readiness_weight', config.readiness_weight))
        p_w = float(data.get('projects_weight', config.projects_weight))
        s_w = float(data.get('skills_weight', config.skills_weight))
        e_w = float(data.get('experience_weight', config.experience_weight))
        a_w = float(data.get('assessment_weight', config.assessment_weight))
    except (ValueError, TypeError):
        return jsonify({"success": False, "message": "All weights must be numbers"}), 400

    total = r_w + p_w + s_w + e_w + a_w
    if abs(total - 100.0) > 0.01:
        return jsonify({
            "success": False,
            "message": f"Weights must sum to 100.0% (Current sum: {round(total, 2)}%)"
        }), 400

    config.readiness_weight = r_w
    config.projects_weight = p_w
    config.skills_weight = s_w
    config.experience_weight = e_w
    config.assessment_weight = a_w
    config.updated_by = user.id
    db.session.commit()

    return jsonify({
        "success": True,
        "message": "Scoring framework weights updated successfully.",
        "data": config.to_dict()
    }), 200
