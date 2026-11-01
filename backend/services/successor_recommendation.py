import logging
from datetime import datetime
from extensions import db
from models.employee import Employee
from models.role import LeadershipRole
from models.user import User
from models.assessment import Assessment, AssessmentAssignment, AssessmentResult
from models.successor_shortlist import SuccessorShortlist
from services.eligibility_service import evaluate_pre_assessment_eligibility
from services.gap_service import calculate_competency_gaps
from services.readiness_service import calculate_successor_readiness

logger = logging.getLogger(__name__)

def get_top_3_successors(role_id, current_user=None, current_employee=None, manager_id=None):
    """
    Identifies the Top 3 eligible successors for a leadership role.
    
    Guarantees:
    - Pre-assessment eligibility verification (skills, competency benchmarks, minimum experience).
    - MANDATORY: Role-specific assessment must be Completed with verified result on file.
    - Active account and availability verification.
    - If fewer than 3 qualify (0, 1, or 2), returns ONLY those available - never adds ineligible employees.
    - Deterministic multi-factor ranking:
        Competency Match (30%) + Readiness (30%) + Assessment Score (20%) + Performance (10%) + Experience (10%).
    - Role-based scoping: HR has org-wide scope; Manager has team-isolated scope.
    """
    role = db.session.get(LeadershipRole, role_id)
    if not role:
        return {"success": False, "message": f"Leadership role with ID {role_id} not found", "data": None}

    # 1. Mandatory Pre-filter: Identify employees who have completed an assessment for this role
    completed_assignments_query = db.session.query(
        AssessmentAssignment.employee_id
    ).join(
        Assessment, AssessmentAssignment.assessment_id == Assessment.id
    ).filter(
        Assessment.role_id == role.id,
        AssessmentAssignment.status == 'Completed'
    ).join(
        AssessmentResult, AssessmentAssignment.id == AssessmentResult.assignment_id
    ).filter(
        AssessmentResult.overall_score.isnot(None)
    ).distinct()

    completed_emp_ids = [row[0] for row in completed_assignments_query.all()]

    if not completed_emp_ids:
        return {
            "success": True,
            "role": {
                "id": role.id,
                "role_name": role.role_name,
                "department": role.department,
                "min_experience_years": getattr(role, 'min_experience_years', 5)
            },
            "total_evaluated": 0,
            "total_eligible": 0,
            "top_candidates": [],
            "notice": (
                f"No candidates currently satisfy all mandatory prerequisites and possess completed "
                f"role-specific assessment results for {role.role_name}. Ineligible employees are excluded "
                f"according to succession governance policy."
            ),
            "governance_note": "Evaluations strictly require active employment, prerequisite eligibility, and role-specific assessment completion."
        }

    # 2. Scope Candidate Pool based on RBAC among employees with completed assessments
    is_hr_or_admin = False
    if current_user and current_user.role.lower() in ['hr', 'admin']:
        is_hr_or_admin = True

    if manager_id:
        candidate_pool = Employee.query.filter(
            Employee.id.in_(completed_emp_ids),
            Employee.manager_id == manager_id,
            Employee.availability_status != 'Unavailable'
        ).all()
    elif not is_hr_or_admin:
        # Manager scope: strictly direct reports
        mgr_emp_id = None
        if current_employee:
            mgr_emp_id = current_employee.id
        elif current_user:
            mgr_emp = Employee.query.filter_by(user_id=current_user.id).first()
            if mgr_emp:
                mgr_emp_id = mgr_emp.id

        if not mgr_emp_id:
            return {
                "success": True,
                "role": {"id": role.id, "role_name": role.role_name, "department": role.department},
                "total_evaluated": 0,
                "total_eligible": 0,
                "top_candidates": [],
                "notice": "No manager profile identified for team-scoped succession analysis."
            }

        candidate_pool = Employee.query.filter(
            Employee.id.in_(completed_emp_ids),
            Employee.manager_id == mgr_emp_id,
            Employee.availability_status != 'Unavailable'
        ).all()
    else:
        # HR / Admin: Enterprise-wide pool among candidates with completed assessment
        candidate_pool = Employee.query.filter(
            Employee.id.in_(completed_emp_ids),
            Employee.availability_status != 'Unavailable'
        ).all()

    evaluated_count = len(candidate_pool)
    qualified_candidates = []

    # 2. Evaluate each candidate against strict eligibility + mandatory assessment criteria
    for emp in candidate_pool:
        # Check active account status if linked to user
        if emp.user_id:
            u = db.session.get(User, emp.user_id)
            if u and u.status in ['Suspended', 'Inactive']:
                continue

        # Check pre-assessment prerequisites (experience, company tenure, skills, competency baseline)
        try:
            el = evaluate_pre_assessment_eligibility(emp.id, role.id, employee=emp, role=role)
        except Exception as e:
            logger.warning(f"Error evaluating eligibility for emp {emp.id} and role {role.id}: {e}")
            el = None

        if not el or not el.get("is_eligible"):
            # Exclude: Does not satisfy pre-assessment criteria
            continue

        # MANDATORY CHECK: Candidate MUST have completed the role-specific assessment with a valid result
        completed_assignments = AssessmentAssignment.query.join(Assessment).filter(
            AssessmentAssignment.employee_id == emp.id,
            Assessment.role_id == role.id,
            AssessmentAssignment.status == 'Completed'
        ).all()

        valid_completed = [a for a in completed_assignments if a.result is not None and a.result.overall_score is not None]
        if not valid_completed:
            # Strictly exclude: Incomplete or missing required assessment
            continue

        # Pick latest completed attempt
        def get_submission_time(a):
            return a.submitted_at or (a.result.completed_at if a.result else None) or datetime.min

        latest_assignment = max(valid_completed, key=lambda a: (get_submission_time(a), a.id))
        latest_result = latest_assignment.result
        assessment_score = round(float(latest_result.overall_score), 1)
        assessment_title = latest_assignment.assessment.title if latest_assignment.assessment else "Role Assessment"
        completed_date_dt = latest_assignment.submitted_at or (latest_result.completed_at if latest_result else None)
        assessment_date = completed_date_dt.strftime("%b %d, %Y") if completed_date_dt else "Completed"

        # Calculate readiness & competency gaps
        readiness_data = calculate_successor_readiness(emp.id, role.id)
        gap_data = calculate_competency_gaps(emp.id, role.id)

        comp_match = round(float(readiness_data.get("competency_score", 0.0)), 1)
        readiness_score = round(float(readiness_data.get("readiness_score", 0.0)), 1)
        readiness_lvl = readiness_data.get("readiness_level", "Developing")

        # Performance score (0-100 normalized)
        raw_perf = float(emp.performance_score or 3.5)
        perf_score = round((raw_perf / 5.0) * 100.0, 1) if raw_perf <= 5.0 else round(raw_perf, 1)

        # Experience score (0-100 normalized against role target)
        target_exp = float(getattr(role, 'min_experience_years', 5.0) or 5.0)
        raw_exp = float(emp.experience_years or 0.0)
        exp_score = round(min(100.0, (raw_exp / max(target_exp, 1.0)) * 100.0), 1)

        # Multi-factor deterministic ranking formula
        ranking_score = round(
            (comp_match * 0.30) +
            (readiness_score * 0.30) +
            (assessment_score * 0.20) +
            (perf_score * 0.10) +
            (exp_score * 0.10),
            2
        )

        # Extract major strengths
        strengths = []
        gaps = []
        training_suggestions = []

        for comp in gap_data.get("competencies", []):
            c_name = comp.get("competency_name") or comp.get("name")
            gap_val = float(comp.get("gap", 0.0))
            if gap_val <= 0 or comp.get("status") == "Strength":
                strengths.append(f"{c_name} ({comp.get('current_score')}/100)")
            else:
                gaps.append(f"{c_name} (Gap: {gap_val} pts)")
                training_suggestions.append(f"Targeted coaching in {c_name} to bridge {gap_val} pt benchmark gap")

        if not strengths:
            strengths.append("Verified foundational technical competence")
        if not gaps:
            gaps.append("No critical competency deficits detected")
            training_suggestions.append("Executive leadership shadowing & strategic project rotation")

        # Check shortlist record
        shortlist_entry = SuccessorShortlist.query.filter_by(
            employee_id=emp.id,
            role_id=role.id
        ).first()

        is_shortlisted = shortlist_entry is not None and shortlist_entry.status in ['Shortlisted', 'Approved', 'Nominated']
        shortlist_status = shortlist_entry.status if shortlist_entry else None

        qualified_candidates.append({
            "employee_id": emp.id,
            "employee_code": emp.employee_code,
            "name": emp.name,
            "email": emp.email,
            "department": emp.department,
            "designation": emp.designation,
            "experience_years": emp.experience_years,
            "ranking_score": ranking_score,
            "competency_match_pct": comp_match,
            "readiness_score": readiness_score,
            "readiness_level": readiness_lvl,
            "assessment_score": assessment_score,
            "assessment_title": assessment_title,
            "assessment_date": assessment_date,
            "performance_score": raw_perf,
            "normalized_performance_score": perf_score,
            "experience_score": exp_score,
            "major_strengths": strengths[:4],
            "major_gaps": gaps[:3],
            "suggested_training": training_suggestions[:3],
            "is_shortlisted": is_shortlisted,
            "shortlist_status": shortlist_status,
            "shortlist_notes": shortlist_entry.notes if shortlist_entry else ""
        })

    # 3. Sort descending by ranking score, breaking ties by assessment score -> readiness score
    qualified_candidates.sort(
        key=lambda c: (c["ranking_score"], c["assessment_score"], c["readiness_score"], c["normalized_performance_score"]),
        reverse=True
    )

    # 4. Limit to Top 3
    top_candidates = qualified_candidates[:3]

    # Assign ranks and generate factual AI narrative for each candidate
    for idx, cand in enumerate(top_candidates):
        cand["rank"] = idx + 1
        rank_label = f"#{cand['rank']}"
        cand["ai_explanation"] = (
            f"Candidate {cand['name']} qualifies as rank {rank_label} successor for {role.role_name} "
            f"with an overall ranking index of {cand['ranking_score']}%. "
            f"Achieved {cand['assessment_score']}% in the verified '{cand['assessment_title']}' assessment (completed {cand['assessment_date']}), "
            f"demonstrating {cand['readiness_score']}% leadership readiness ({cand['readiness_level']}) "
            f"and a {cand['competency_match_pct']}% competency benchmark alignment. "
            f"Key asset: {cand['major_strengths'][0] if cand['major_strengths'] else 'Technical competence'}."
        )

    # 5. Transparent Notice when fewer than 3 qualify
    if len(top_candidates) == 0:
        notice = (
            f"No candidates currently satisfy all mandatory prerequisites and possess completed "
            f"role-specific assessment results for {role.role_name}. Ineligible employees are excluded "
            f"according to succession governance policy."
        )
    elif len(top_candidates) < 3:
        notice = (
            f"Only {len(top_candidates)} candidate(s) currently satisfy all mandatory eligibility requirements "
            f"and have completed the required assessment for {role.role_name}. "
            f"Additional candidates are pending assessment completion or prerequisite qualification."
        )
    else:
        notice = f"Top 3 eligible successors identified through verified assessments, competency benchmarks, and readiness metrics."

    return {
        "success": True,
        "role": {
            "id": role.id,
            "role_name": role.role_name,
            "department": role.department,
            "min_experience_years": getattr(role, 'min_experience_years', 5)
        },
        "total_evaluated": evaluated_count,
        "total_eligible": len(qualified_candidates),
        "top_candidates": top_candidates,
        "notice": notice,
        "governance_note": "Evaluations strictly require active employment, prerequisite eligibility, and role-specific assessment completion."
    }

def compare_candidates_for_role(role_id, candidate_ids):
    """
    Compares 2-3 specific candidates side-by-side for a target leadership role.
    Returns multi-dimensional breakdown including radar chart dimensions, strengths, and transition timeline.
    """
    role = db.session.get(LeadershipRole, role_id)
    if not role:
        return {"success": False, "message": "Role not found", "data": None}

    if not candidate_ids or not isinstance(candidate_ids, list):
        return {"success": False, "message": "candidate_ids array required", "data": None}

    comparison_results = []
    all_competencies_keys = set()

    for emp_id in candidate_ids[:4]: # at most 4
        emp = db.session.get(Employee, emp_id)
        if not emp:
            continue

        readiness_data = calculate_successor_readiness(emp.id, role.id)
        gap_data = calculate_competency_gaps(emp.id, role.id)

        # Get latest assessment result
        completed_assignments = AssessmentAssignment.query.join(Assessment).filter(
            AssessmentAssignment.employee_id == emp.id,
            Assessment.role_id == role.id,
            AssessmentAssignment.status == 'Completed'
        ).all()
        valid = [a for a in completed_assignments if a.result is not None and a.result.overall_score is not None]
        latest_score = max([float(a.result.overall_score) for a in valid], default=0.0) if valid else 0.0

        comp_scores_dict = {}
        for c in gap_data.get("competencies", []):
            name = c.get("competency_name") or c.get("name")
            comp_scores_dict[name] = float(c.get("current_score", 0.0))
            all_competencies_keys.add(name)

        readiness_score = float(readiness_data.get("readiness_score", 0.0))
        
        # Transition timeline recommendation
        if readiness_score >= 80.0:
            timeline = "Immediate (0 - 3 Months)"
        elif readiness_score >= 60.0:
            timeline = "Near-Term (3 - 6 Months)"
        else:
            timeline = "Mid-Term (6 - 12 Months)"

        comparison_results.append({
            "employee_id": emp.id,
            "name": emp.name,
            "employee_code": emp.employee_code,
            "department": emp.department,
            "designation": emp.designation,
            "readiness_score": readiness_score,
            "readiness_level": readiness_data.get("readiness_level", "Developing"),
            "competency_match_pct": round(float(readiness_data.get("competency_score", 0.0)), 1),
            "assessment_score": latest_score,
            "performance_score": emp.performance_score,
            "experience_years": emp.experience_years,
            "competency_scores": comp_scores_dict,
            "major_gap": readiness_data.get("major_gap", "None"),
            "transition_timeline": timeline
        })

    # Summary synthesis
    if len(comparison_results) >= 2:
        top_cand = max(comparison_results, key=lambda c: c["readiness_score"])
        ai_summary = (
            f"Comparative analysis shows {top_cand['name']} currently holds the highest leadership readiness "
            f"({top_cand['readiness_score']}%) with a projected transition timeline of {top_cand['transition_timeline']}."
        )
    else:
        ai_summary = "Select at least two candidates for detailed comparative analysis."

    return {
        "success": True,
        "role": {"id": role.id, "role_name": role.role_name, "department": role.department},
        "competency_dimensions": sorted(list(all_competencies_keys)),
        "candidates": comparison_results,
        "ai_comparative_summary": ai_summary
    }

def shortlist_candidate_for_role(employee_id, role_id, user_id=None, action='Shortlist', notes=''):
    """
    Persists or updates candidate shortlisting / nomination status for a leadership role.
    Action: 'Shortlist', 'Approve', 'Nominate', 'Remove'
    """
    emp = db.session.get(Employee, employee_id)
    role = db.session.get(LeadershipRole, role_id)
    if not emp or not role:
        return {"success": False, "message": "Employee or Role not found"}

    entry = SuccessorShortlist.query.filter_by(employee_id=employee_id, role_id=role_id).first()

    if action.lower() == 'remove':
        if entry:
            db.session.delete(entry)
            db.session.commit()
        return {"success": True, "message": f"{emp.name} removed from shortlist for {role.role_name}", "data": None}

    readiness = calculate_successor_readiness(emp.id, role.id)
    readiness_score = float(readiness.get("readiness_score", 0.0))

    completed = AssessmentAssignment.query.join(Assessment).filter(
        AssessmentAssignment.employee_id == emp.id,
        Assessment.role_id == role.id,
        AssessmentAssignment.status == 'Completed'
    ).all()
    valid = [a for a in completed if a.result is not None and a.result.overall_score is not None]
    assess_score = max([float(a.result.overall_score) for a in valid], default=0.0) if valid else 0.0

    status_val = 'Approved' if action.lower() == 'approve' else ('Nominated' if action.lower() == 'nominate' else 'Shortlisted')

    if entry:
        entry.status = status_val
        if notes:
            entry.notes = notes
        entry.readiness_score = readiness_score
        entry.assessment_score = assess_score
        entry.updated_at = datetime.utcnow()
    else:
        entry = SuccessorShortlist(
            employee_id=employee_id,
            role_id=role_id,
            shortlisted_by=user_id,
            status=status_val,
            notes=notes,
            readiness_score=readiness_score,
            assessment_score=assess_score
        )
        db.session.add(entry)

    db.session.commit()
    return {
        "success": True,
        "message": f"Successfully updated {emp.name} as {status_val} for {role.role_name}",
        "data": entry.to_dict()
    }

