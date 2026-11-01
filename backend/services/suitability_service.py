from models.employee import Employee
from models.role import LeadershipRole
from models.suitability_config import SuitabilityConfig
from models.assessment import AssessmentAssignment, AssessmentAnswer
from services.gap_service import calculate_competency_gaps
from services.readiness_service import calculate_successor_readiness
from services.project_service import get_employee_projects_summary
from services.experience_service import calculate_employee_experience
from services.skill_service import evaluate_employee_skill_gaps

def evaluate_leadership_suitability(
    employee_id, role_id, config=None,
    employee=None, role=None,
    role_completed_assignments=None,
    emp_projects=None,
    emp_histories=None,
    emp_skills=None,
    role_required_skills=None,
    competencies=None,
    role_competencies=None,
    employee_competencies=None
):
    """
    Evaluates an employee against a target leadership role using the 5 core criteria:
    1. Existing assessment results (weight configurable, default 30%)
    2. Leadership competency and readiness (weight configurable, default 25%)
    3. Relevant skills and skill gaps (weight configurable, default 20%)
    4. Project experience and verified outcomes (weight configurable, default 15%)
    5. Professional and company experience (weight configurable, default 10%)

    Rules & Policies:
    - Assessment score uses real completed results relevant to the target role.
    - Multiple attempts for the same assessment pick the latest valid completed attempt.
    - Incomplete, ungraded, or cancelled assessments are strictly excluded.
    - If no completed assessment exists for the target role, assessment_score is None
      (NO fallback to baseline employee.performance_score).
    - Missing data policy: Normalized weighted average over criteria with valid evidence.
    - If evidence coverage is below threshold (< 40%), flags has_sufficient_data = False
      ("Insufficient data for reliable evaluation") and suitability_score = None.
    - Transparent documentation of all sub-scores, weights, and evidence coverage.
    """
    if employee is None:
        employee = Employee.query.get(employee_id)
    if role is None:
        role = LeadershipRole.query.get(role_id)
    if not employee or not role:
        return None

    if config is None:
        config = SuitabilityConfig.get_active_config()

    w_assessment = float(config.assessment_weight)
    w_readiness = float(config.readiness_weight)
    w_skills = float(config.skills_weight)
    w_projects = float(config.projects_weight)
    w_experience = float(config.experience_weight)

    evidence_present_count = 0
    total_criteria_count = 5
    unverified_flags = []
    missing_flags = []

    # =========================================================================
    # 1. ASSESSMENT RESULTS (0-100)
    # =========================================================================
    if role_completed_assignments is not None:
        role_completed = [
            a for a in role_completed_assignments 
            if a.assessment and a.assessment.role_id == role_id and a.result is not None
        ]
    else:
        # Fetch all completed assessment assignments with a valid result for this employee
        all_completed = AssessmentAssignment.query.filter_by(
            employee_id=employee_id, status='Completed'
        ).all()

        # Filter assignments that belong to the target leadership role and have results
        role_completed = [
            a for a in all_completed 
            if a.assessment and a.assessment.role_id == role_id and a.result is not None
        ]

    assessment_score = None
    marks_obtained = None
    max_marks = None
    assessment_name = None
    completed_assessments_count = 0
    assessment_status = "Not Assigned"
    assessment_attempts_details = []

    if role_completed:
        # Group duplicate attempts by assessment_id and pick the latest valid completed attempt
        attempts_by_assessment = {}
        for a in role_completed:
            aid = a.assessment_id
            curr_time = a.submitted_at or (a.result.completed_at if a.result else None)
            if aid not in attempts_by_assessment:
                attempts_by_assessment[aid] = a
            else:
                prev_a = attempts_by_assessment[aid]
                prev_time = prev_a.submitted_at or (prev_a.result.completed_at if prev_a.result else None)
                # Compare submission timestamps or fallback to highest assignment id
                if curr_time and prev_time:
                    if curr_time > prev_time:
                        attempts_by_assessment[aid] = a
                elif a.id > prev_a.id:
                    attempts_by_assessment[aid] = a

        unique_latest_attempts = list(attempts_by_assessment.values())
        completed_assessments_count = len(unique_latest_attempts)

        norm_scores = []
        total_obtained_sum = 0.0
        total_possible_sum = 0.0
        titles = []

        for a in unique_latest_attempts:
            r = a.result
            raw_score = r.overall_score if r else 0.0

            # Inspect detail_json for exact marks obtained and max possible
            detail = r.get_detail() if r else {}
            item_obtained = detail.get("_total_score")
            item_possible = detail.get("_total_possible")

            if item_obtained is None or item_possible is None:
                answers = AssessmentAnswer.query.filter_by(assignment_id=a.id).all()
                if answers:
                    item_obtained = sum(ans.score for ans in answers)
                    item_possible = sum(
                        (ans.assignment_question.max_score if ans.assignment_question else (ans.question.max_score if ans.question else 10.0))
                        for ans in answers
                    )
                else:
                    item_obtained = raw_score
                    item_possible = 100.0

            item_obtained = float(item_obtained)
            item_possible = float(item_possible) if float(item_possible) > 0 else 100.0
            item_norm = round((item_obtained / item_possible * 100.0), 2)

            norm_scores.append(item_norm)
            total_obtained_sum += item_obtained
            total_possible_sum += item_possible
            title = a.assessment.title if a.assessment else f"Assessment #{a.assessment_id}"
            titles.append(title)

            assessment_attempts_details.append({
                "assignment_id": a.id,
                "assessment_id": a.assessment_id,
                "assessment_title": title,
                "marks_obtained": round(item_obtained, 2),
                "max_marks": round(item_possible, 2),
                "normalized_percentage": item_norm,
                "readiness_level": r.readiness_level if r else "Medium",
                "completed_at": a.submitted_at.isoformat() if a.submitted_at else (r.completed_at.isoformat() if r and r.completed_at else None)
            })

        if norm_scores:
            assessment_score = round(sum(norm_scores) / len(norm_scores), 1)
            marks_obtained = round(total_obtained_sum, 2)
            max_marks = round(total_possible_sum, 2)
            assessment_name = ", ".join(titles)
            assessment_status = "Completed"
            evidence_present_count += 1
    else:
        # Check if candidate has active, scheduled, or pending assignments for this role
        any_role_assignment = AssessmentAssignment.query.filter(
            AssessmentAssignment.employee_id == employee_id,
            AssessmentAssignment.assessment.has(role_id=role_id)
        ).order_by(AssessmentAssignment.id.desc()).first()

        if any_role_assignment:
            assessment_status = any_role_assignment.status
            if any_role_assignment.assessment:
                assessment_name = any_role_assignment.assessment.title

        missing_flags.append("No completed assessments found for this target role")

    # =========================================================================
    # 2. LEADERSHIP COMPETENCY & SUCCESSOR READINESS (0-100)
    # =========================================================================
    readiness_data = calculate_successor_readiness(
        employee_id, role_id, employee=employee, role=role,
        competencies=competencies, role_reqs=role_competencies, emp_scores=employee_competencies
    )
    if readiness_data:
        readiness_score = float(readiness_data["readiness_score"])
        competency_score = float(readiness_data["competency_score"])
        major_gap = readiness_data.get("major_gap", "None")
        evidence_present_count += 1
    else:
        readiness_score = None
        competency_score = None
        major_gap = "None"
        missing_flags.append("Leadership competency data missing")

    # =========================================================================
    # 3. TECHNICAL SKILLS AND SKILL GAPS (0-100)
    # =========================================================================
    skill_data = evaluate_employee_skill_gaps(
        employee_id, role_id, employee=employee, role=role,
        required_skills=role_required_skills, emp_skills=emp_skills
    )
    skills_score = None
    if skill_data and (skill_data["matched_skills_count"] > 0 or skill_data["below_requirement_count"] > 0 or skill_data.get("has_required_skills")):
        skills_score = float(skill_data["skill_match_score"])
        evidence_present_count += 1
    else:
        missing_flags.append("No technical skills registered for target role")

    if skill_data and skill_data.get("skills_needing_assessment"):
        unverified_flags.append(f"{len(skill_data['skills_needing_assessment'])} skills are self-reported and pending verification")

    # Mandatory skills check
    missing_mandatory = []
    if skill_data and skill_data.get("missing_skills"):
        missing_mandatory = [s["skill_name"] for s in skill_data["missing_skills"] if s.get("is_mandatory")]
        if missing_mandatory:
            unverified_flags.append(f"Missing mandatory skills: {', '.join(missing_mandatory)}")

    # =========================================================================
    # 4. PROJECT EXPERIENCE AND VERIFIED OUTCOMES (0-100)
    # =========================================================================
    proj_summary = get_employee_projects_summary(employee_id, projects=emp_projects)
    projects_score = None
    has_verified_projects = False

    if proj_summary["total_projects"] > 0:
        if proj_summary["average_verified_success_rate"] is not None:
            projects_score = float(proj_summary["average_verified_success_rate"])
            has_verified_projects = True
            evidence_present_count += 1
        elif proj_summary["average_overall_success_rate"] is not None:
            projects_score = float(proj_summary["average_overall_success_rate"])
            evidence_present_count += 1
            unverified_flags.append("Project success metrics are self-reported (pending HR/supervisor verification)")
        else:
            # Projects exist but metrics not evaluated yet -> Not evaluated
            projects_score = None
            unverified_flags.append("Projects recorded without quantified outcome metrics ('Not evaluated')")
    else:
        missing_flags.append("No projects registered in employee profile")

    # =========================================================================
    # 5. PROFESSIONAL AND COMPANY EXPERIENCE (0-100)
    # =========================================================================
    exp_summary = calculate_employee_experience(employee_id, employee=employee, histories=emp_histories)
    exp_score = None
    if exp_summary and (exp_summary["has_employment_history"] or exp_summary["current_company_tenure_years"] > 0):
        evidence_present_count += 1

        # Normalized Experience Scoring (0-100 scale):
        # Total non-overlapping experience (up to 10 years = 50 pts)
        tot_pts = min(50.0, (exp_summary["total_professional_experience_years"] / 10.0) * 50.0)
        # Current tenure (up to 5 years = 30 pts)
        tenure_pts = min(30.0, (exp_summary["current_company_tenure_years"] / 5.0) * 30.0)
        # Leadership experience (up to 4 years = 20 pts)
        ldr_pts = min(20.0, (exp_summary["leadership_experience_years"] / 4.0) * 20.0)

        exp_score = round(tot_pts + tenure_pts + ldr_pts, 1)

        if exp_summary["verified_experience_years"] < exp_summary["total_professional_experience_years"]:
            unverified_flags.append("Portion of past employment experience is self-reported")
    else:
        missing_flags.append("Employment experience details not recorded")

    # =========================================================================
    # EVIDENCE COVERAGE & MISSING DATA NORMALIZATION
    # =========================================================================
    evidence_coverage_pct = round((evidence_present_count / total_criteria_count) * 100.0, 1)

    valid_weights_sum = 0.0
    weighted_points_sum = 0.0

    criteria_breakdown = {
        "assessments": {
            "score": assessment_score,
            "weight": w_assessment,
            "weighted_points": round(assessment_score * (w_assessment / 100.0), 1) if assessment_score is not None else 0.0,
            "is_available": assessment_score is not None,
            "marks_obtained": marks_obtained,
            "max_marks": max_marks,
            "assessment_name": assessment_name,
            "completed_count": completed_assessments_count,
            "status": assessment_status,
            "attempts": assessment_attempts_details
        },
        "readiness": {
            "score": readiness_score,
            "competency_score": competency_score,
            "major_gap": major_gap,
            "weight": w_readiness,
            "weighted_points": round(readiness_score * (w_readiness / 100.0), 1) if readiness_score is not None else 0.0,
            "is_available": readiness_score is not None
        },
        "skills": {
            "score": skills_score,
            "matched_count": skill_data["matched_skills_count"] if skill_data else 0,
            "missing_count": skill_data["missing_skills_count"] if skill_data else 0,
            "missing_mandatory": missing_mandatory,
            "weight": w_skills,
            "weighted_points": round(skills_score * (w_skills / 100.0), 1) if skills_score is not None else 0.0,
            "is_available": skills_score is not None
        },
        "projects": {
            "score": projects_score,
            "total_projects": proj_summary["total_projects"],
            "verified_count": proj_summary["verified_projects_count"],
            "has_verified": has_verified_projects,
            "average_verified_success_rate": proj_summary["average_verified_success_rate"],
            "average_overall_success_rate": proj_summary["average_overall_success_rate"],
            "weight": w_projects,
            "weighted_points": round(projects_score * (w_projects / 100.0), 1) if projects_score is not None else 0.0,
            "is_available": projects_score is not None
        },
        "experience": {
            "score": exp_score,
            "total_years": exp_summary["total_professional_experience_years"] if exp_summary else 0.0,
            "tenure_years": exp_summary["current_company_tenure_years"] if exp_summary else 0.0,
            "leadership_years": exp_summary["leadership_experience_years"] if exp_summary else 0.0,
            "weight": w_experience,
            "weighted_points": round(exp_score * (w_experience / 100.0), 1) if exp_score is not None else 0.0,
            "is_available": exp_score is not None
        }
    }

    for key, c_info in criteria_breakdown.items():
        if c_info["is_available"] and c_info["score"] is not None:
            valid_weights_sum += c_info["weight"]
            weighted_points_sum += c_info["score"] * (c_info["weight"] / 100.0)

    # Reliability threshold: At least 40% evidence coverage required
    has_sufficient_data = evidence_coverage_pct >= 40.0 and valid_weights_sum > 0

    if has_sufficient_data and valid_weights_sum > 0:
        # Re-scale proportionally over valid criteria
        normalized_suitability = (weighted_points_sum / (valid_weights_sum / 100.0))
        suitability_score = round(normalized_suitability, 1)

        if suitability_score >= 80.0:
            suitability_level = "High Suitability"
        elif suitability_score >= 65.0:
            suitability_level = "Medium Suitability"
        else:
            suitability_level = "Developing / Low"
    else:
        suitability_score = None
        suitability_level = "Insufficient Data"

    # Evidence-based recommendations
    suggested_actions = []
    if skill_data and skill_data.get("recommended_development_activities"):
        suggested_actions.extend(skill_data["recommended_development_activities"][:3])
    if exp_summary and exp_summary["leadership_experience_years"] < 2.0:
        suggested_actions.append("Assign mentorship or interim team-lead responsibility to expand leadership tenure.")
    if proj_summary["total_projects"] == 0:
        suggested_actions.append("Assign target leadership role projects to demonstrate domain execution.")
    if assessment_score is None:
        suggested_actions.append(f"Schedule formal leadership competency assessment for {role.role_name} to benchmark readiness.")

    # Generate transparent evidence-based recommendation strengths and gaps
    candidate_strengths = []
    candidate_gaps = []
    if assessment_score is not None:
        if assessment_score >= 80.0:
            candidate_strengths.append(f"High assessment score of {assessment_score}% in completed evaluation")
        elif assessment_score >= 60.0:
            candidate_strengths.append(f"Satisfactory assessment benchmark ({assessment_score}%)")
        else:
            candidate_gaps.append(f"Assessment score ({assessment_score}%) below 60% threshold")
    else:
        candidate_gaps.append("No completed assessment for target leadership role")

    if proj_summary["average_verified_success_rate"] is not None:
        candidate_strengths.append(f"Verified project success rate of {proj_summary['average_verified_success_rate']}% across {proj_summary['verified_projects_count']} projects")
    elif proj_summary["average_overall_success_rate"] is not None:
        candidate_strengths.append(f"Average project success rate of {proj_summary['average_overall_success_rate']}% (self-reported)")
    elif proj_summary["total_projects"] > 0:
        candidate_gaps.append("Project records logged without quantified outcome evaluation")
    else:
        candidate_gaps.append("No projects registered in profile")

    if skill_data and skill_data.get("skill_match_score") is not None:
        if skill_data["skill_match_score"] >= 70.0:
            candidate_strengths.append(f"Strong role skill alignment ({skill_data['skill_match_score']}%) meeting {skill_data['matched_skills_count']} requirements")
        else:
            candidate_gaps.append(f"Skill match at {skill_data['skill_match_score']}% with {skill_data['missing_skills_count']} missing skills")
    if missing_mandatory:
        candidate_gaps.append(f"Missing mandatory skills: {', '.join(missing_mandatory)}")

    if exp_summary:
        if exp_summary["total_professional_experience_years"] >= 5.0:
            candidate_strengths.append(f"{exp_summary['total_professional_experience_years']} yrs total experience ({exp_summary['current_company_tenure_years']} yrs tenure)")
        if exp_summary["leadership_experience_years"] >= 2.0:
            candidate_strengths.append(f"{exp_summary['leadership_experience_years']} yrs demonstrated leadership tenure")
        elif exp_summary["leadership_experience_years"] < 1.0:
            candidate_gaps.append("Limited formal leadership experience (<1 year)")

    if suitability_score is not None and suitability_score >= 80.0:
        verdict = f"High suitability ({suitability_score}%) — Recommended succession match for {role.role_name}."
    elif suitability_score is not None and suitability_score >= 65.0:
        verdict = f"Medium suitability ({suitability_score}%) — Viable successor with targeted development."
    elif suitability_score is not None:
        verdict = f"Developing suitability ({suitability_score}%) — Foundational skill and leadership growth needed."
    else:
        verdict = f"Insufficient data ({evidence_coverage_pct}% coverage) for reliable succession recommendation."

    concise_summary = verdict
    if candidate_strengths:
        concise_summary += f" Key strength: {candidate_strengths[0]}."
    if candidate_gaps:
        concise_summary += f" Priority gap: {candidate_gaps[0]}."

    recommendation_data = {
        "verdict": verdict,
        "summary": concise_summary,
        "strengths": candidate_strengths,
        "gaps": candidate_gaps,
        "development_priorities": suggested_actions[:3]
    }

    readiness_level = readiness_data.get("readiness_level", "Medium") if readiness_data else "Low"

    return {
        "id": employee.id,
        "employee_id": employee.id,
        "employee_code": employee.employee_code,
        "name": employee.name,
        "employee_name": employee.name,
        "email": employee.email,
        "department": employee.department,
        "designation": employee.designation,
        "role_id": role.id,
        "role_name": role.role_name,
        "suitability_score": suitability_score,
        "overall_suitability_score": suitability_score,
        "suitability_level": suitability_level,
        "readiness_level": readiness_level,
        "has_sufficient_data": has_sufficient_data,
        "insufficient_data_flag": not has_sufficient_data,
        "evidence_coverage_pct": evidence_coverage_pct,
        "assessment_score": assessment_score,
        "assessment_marks": marks_obtained,
        "assessment_max_marks": max_marks,
        "assessment_name": assessment_name,
        "assessment_status": assessment_status,
        "completed_assessments_count": completed_assessments_count,
        "project_score": projects_score,
        "has_verified_projects": has_verified_projects,
        "skill_score": skills_score,
        "missing_mandatory": missing_mandatory,
        "is_mandatory_eligible": len(missing_mandatory) == 0,
        "has_missing_mandatory": len(missing_mandatory) > 0,
        "experience_score": exp_score,
        "readiness_score": readiness_score,
        "criteria_scores": criteria_breakdown,
        "suitability": {
            "overall_suitability_score": suitability_score,
            "evidence_coverage_pct": evidence_coverage_pct,
            "insufficient_data_flag": not has_sufficient_data,
            "suitability_level": suitability_level,
            "criteria_breakdown": criteria_breakdown
        },
        "missing_information": missing_flags,
        "unverified_information": unverified_flags,
        "suggested_development_activities": suggested_actions,
        "recommendation": recommendation_data,
        "recommendation_summary": concise_summary,
        "recommendation_verdict": verdict,
        "skill_details": skill_data,
        "project_summary": proj_summary,
        "experience_summary": exp_summary
    }

def compare_candidates_for_role(role_id, sort_by='suitability_score', min_coverage=0.0, current_user=None, current_employee=None, meets_readiness=False):
    """
    Evaluates candidates for a leadership role, returning candidates ranked
    by real criteria with full evidence breakdown, honest tie-handling,
    and distinct identification of leaders across each domain.
    If meets_readiness=True, filters candidates to ONLY those meeting all
    role readiness criteria.
    """
    role = LeadershipRole.query.get(role_id)
    if not role:
        return None

    # Enforce RBAC filtering on candidate pool
    if current_user and current_user.role.lower() not in ['hr', 'admin']:
        if current_user.role.lower() == 'manager':
            if not current_employee:
                employees = []
            else:
                employees = Employee.query.filter(
                    (Employee.manager_id == current_employee.id) | (Employee.id == current_employee.id)
                ).all()
        else: # Employee
            if not current_employee:
                employees = []
            else:
                employees = [current_employee]
    else:
        employees = Employee.query.all()

    config = SuitabilityConfig.get_active_config()

    emp_ids = [emp.id for emp in employees]

    # Pre-fetch candidate data in constant O(1) queries to prevent N+1 query bottlenecks
    from models.employee_project import EmployeeProject
    from models.employment_history import EmploymentHistory
    from models.employee_skill import EmployeeSkill
    from models.role_required_skill import RoleRequiredSkill
    from models.competency import Competency
    from models.role_competency import RoleCompetency
    from models.employee_competency import EmployeeCompetency

    all_completed = AssessmentAssignment.query.filter(
        AssessmentAssignment.employee_id.in_(emp_ids),
        AssessmentAssignment.status == 'Completed'
    ).all() if emp_ids else []
    all_completed_by_emp = {}
    for a in all_completed:
        all_completed_by_emp.setdefault(a.employee_id, []).append(a)

    all_projects = EmployeeProject.query.filter(
        EmployeeProject.employee_id.in_(emp_ids)
    ).order_by(EmployeeProject.id.desc()).all() if emp_ids else []
    projects_by_emp = {}
    for p in all_projects:
        projects_by_emp.setdefault(p.employee_id, []).append(p)

    all_histories = EmploymentHistory.query.filter(
        EmploymentHistory.employee_id.in_(emp_ids)
    ).all() if emp_ids else []
    histories_by_emp = {}
    for h in all_histories:
        histories_by_emp.setdefault(h.employee_id, []).append(h)

    all_skills = EmployeeSkill.query.filter(
        EmployeeSkill.employee_id.in_(emp_ids)
    ).all() if emp_ids else []
    skills_by_emp = {}
    for s in all_skills:
        skills_by_emp.setdefault(s.employee_id, []).append(s)

    role_skills = RoleRequiredSkill.query.filter_by(role_id=role_id).all()
    competencies = Competency.query.all()
    role_reqs = RoleCompetency.query.filter_by(role_id=role_id).all()

    all_emp_comps = EmployeeCompetency.query.filter(
        EmployeeCompetency.employee_id.in_(emp_ids)
    ).all() if emp_ids else []
    emp_comp_map = {}
    for ec in all_emp_comps:
        emp_comp_map.setdefault(ec.employee_id, []).append(ec)

    candidates = []
    for emp in employees:
        cand_eval = evaluate_leadership_suitability(
            emp.id, role_id, config=config,
            employee=emp, role=role,
            role_completed_assignments=all_completed_by_emp.get(emp.id, []),
            emp_projects=projects_by_emp.get(emp.id, []),
            emp_histories=histories_by_emp.get(emp.id, []),
            emp_skills=skills_by_emp.get(emp.id, []),
            role_required_skills=role_skills,
            competencies=competencies,
            role_competencies=role_reqs,
            employee_competencies=emp_comp_map.get(emp.id, [])
        )
        if cand_eval:
            if cand_eval["evidence_coverage_pct"] >= min_coverage:
                candidates.append(cand_eval)

    # -------------------------------------------------------------------------
    # ASSESSMENT RANKING & HONEST TIE-HANDLING
    # -------------------------------------------------------------------------
    # Sort candidates with completed assessment scores descending
    assessed_candidates = [c for c in candidates if c["assessment_score"] is not None]
    assessed_candidates.sort(key=lambda x: x["assessment_score"], reverse=True)

    # Standard competition ranking (1, 1, 3) for ties
    current_ass_rank = 1
    for i, cand in enumerate(assessed_candidates):
        if i > 0 and cand["assessment_score"] < assessed_candidates[i - 1]["assessment_score"]:
            current_ass_rank = i + 1
        cand["assessment_rank"] = current_ass_rank

    for cand in candidates:
        if cand["assessment_score"] is None:
            cand["assessment_rank"] = None

    # -------------------------------------------------------------------------
    # IDENTIFY DISTINCT LEADERS ACROSS CATEGORIES
    # -------------------------------------------------------------------------
    # 1. Highest Assessment Scorer
    highest_ass_candidates = [c for c in candidates if c["assessment_rank"] == 1]
    highest_ass_score = assessed_candidates[0]["assessment_score"] if assessed_candidates else None
    for cand in candidates:
        cand["is_highest_assessment_scorer"] = (cand["assessment_rank"] == 1 and cand["assessment_score"] is not None)

    # 2. Strongest Verified Project Performer
    # Prefer candidates with verified project success rates
    verified_project_candidates = [
        c for c in candidates 
        if c.get("project_summary", {}).get("average_verified_success_rate") is not None
    ]
    if verified_project_candidates:
        verified_project_candidates.sort(
            key=lambda x: x["project_summary"]["average_verified_success_rate"], reverse=True
        )
        best_proj_rate = verified_project_candidates[0]["project_summary"]["average_verified_success_rate"]
        best_proj_candidates = [c for c in verified_project_candidates if c["project_summary"]["average_verified_success_rate"] == best_proj_rate]
    else:
        # Fallback to overall project rate if no verified ones
        overall_project_candidates = [
            c for c in candidates 
            if c.get("project_summary", {}).get("average_overall_success_rate") is not None
        ]
        overall_project_candidates.sort(
            key=lambda x: x["project_summary"]["average_overall_success_rate"], reverse=True
        )
        best_proj_rate = overall_project_candidates[0]["project_summary"]["average_overall_success_rate"] if overall_project_candidates else None
        best_proj_candidates = [c for c in overall_project_candidates if c["project_summary"]["average_overall_success_rate"] == best_proj_rate] if best_proj_rate is not None else []

    best_proj_ids = {c["employee_id"] for c in best_proj_candidates}
    for cand in candidates:
        cand["is_highest_project_performer"] = cand["employee_id"] in best_proj_ids

    # 3. Best Role Skill Match
    skill_candidates = [c for c in candidates if c["skill_score"] is not None]
    skill_candidates.sort(key=lambda x: x["skill_score"], reverse=True)
    best_skill_score = skill_candidates[0]["skill_score"] if skill_candidates else None
    best_skill_candidates = [c for c in skill_candidates if c["skill_score"] == best_skill_score] if best_skill_score is not None else []
    best_skill_ids = {c["employee_id"] for c in best_skill_candidates}
    for cand in candidates:
        cand["is_best_skill_matcher"] = cand["employee_id"] in best_skill_ids

    # 4. Highest Overall Suitability Candidate
    sufficient_candidates = [c for c in candidates if c["has_sufficient_data"] and c["suitability_score"] is not None]
    sufficient_candidates.sort(key=lambda x: x["suitability_score"], reverse=True)
    best_suit_score = sufficient_candidates[0]["suitability_score"] if sufficient_candidates else None
    best_suit_candidates = [c for c in sufficient_candidates if c["suitability_score"] == best_suit_score] if best_suit_score is not None else []
    best_suit_ids = {c["employee_id"] for c in best_suit_candidates}
    for cand in candidates:
        cand["is_highest_overall_suitability"] = cand["employee_id"] in best_suit_ids

    # -------------------------------------------------------------------------
    # OVERALL CANDIDATE SORTING
    # -------------------------------------------------------------------------
    if sort_by in ['assessment', 'assessment_score']:
        # Real assessment scores: higher first, missing at bottom
        candidates.sort(
            key=lambda x: (
                1 if x["assessment_score"] is not None else 0,
                x["assessment_score"] if x["assessment_score"] is not None else -1.0
            ),
            reverse=True
        )
    elif sort_by in ['projects', 'project_score']:
        candidates.sort(
            key=lambda x: (
                1 if x.get("project_summary", {}).get("average_verified_success_rate") is not None else (0.5 if x.get("project_score") is not None else 0),
                x.get("project_summary", {}).get("average_verified_success_rate") or x.get("project_score") or -1.0
            ),
            reverse=True
        )
    elif sort_by in ['skills', 'skill_score']:
        candidates.sort(
            key=lambda x: (
                1 if x["skill_score"] is not None else 0,
                x["skill_score"] if x["skill_score"] is not None else -1.0
            ),
            reverse=True
        )
    elif sort_by in ['experience', 'experience_score']:
        candidates.sort(
            key=lambda x: (
                1 if x["experience_score"] is not None else 0,
                x["experience_score"] if x["experience_score"] is not None else -1.0
            ),
            reverse=True
        )
    elif sort_by in ['readiness', 'readiness_score']:
        candidates.sort(
            key=lambda x: (
                1 if x["readiness_score"] is not None else 0,
                x["readiness_score"] if x["readiness_score"] is not None else -1.0
            ),
            reverse=True
        )
    else:  # Default: suitability_score
        candidates.sort(
            key=lambda x: (
                1 if x["has_sufficient_data"] else 0,
                x["suitability_score"] if x["suitability_score"] is not None else -1.0
            ),
            reverse=True
        )

    # Assign overall rank numbers with honest tie handling
    current_overall_rank = 1
    for idx, cand in enumerate(candidates):
        if idx > 0:
            prev = candidates[idx - 1]
            if sort_by in ['assessment', 'assessment_score']:
                score_curr = cand["assessment_score"]
                score_prev = prev["assessment_score"]
            elif sort_by in ['projects', 'project_score']:
                score_curr = cand.get("project_summary", {}).get("average_verified_success_rate") or cand["project_score"]
                score_prev = prev.get("project_summary", {}).get("average_verified_success_rate") or prev["project_score"]
            elif sort_by in ['skills', 'skill_score']:
                score_curr = cand["skill_score"]
                score_prev = prev["skill_score"]
            elif sort_by in ['experience', 'experience_score']:
                score_curr = cand["experience_score"]
                score_prev = prev["experience_score"]
            elif sort_by in ['readiness', 'readiness_score']:
                score_curr = cand["readiness_score"]
                score_prev = prev["readiness_score"]
            else:
                score_curr = cand["suitability_score"]
                score_prev = prev["suitability_score"]

            if score_curr != score_prev:
                current_overall_rank = idx + 1

        cand["rank"] = current_overall_rank

    # -------------------------------------------------------------------------
    # ROLE-SPECIFIC ANALYSIS PANEL NARRATIVE
    # -------------------------------------------------------------------------
    leading_candidate = sufficient_candidates[0] if sufficient_candidates else (candidates[0] if candidates else None)
    role_analysis_summary = {}

    if leading_candidate:
        lead_name = leading_candidate["employee_name"]
        lead_suit = leading_candidate["suitability_score"]
        lead_ass = leading_candidate["assessment_score"]
        lead_proj = leading_candidate["project_summary"]
        lead_skill = leading_candidate["skill_details"]
        lead_exp = leading_candidate["experience_summary"]

        role_analysis_summary = {
            "leading_candidate_name": lead_name,
            "leading_candidate_id": leading_candidate["employee_id"],
            "leading_candidate_score": lead_suit,
            "why_ranks_first": (
                f"{lead_name} ranks leading with a composite suitability score of {lead_suit}%, supported by "
                f"{leading_candidate['evidence_coverage_pct']}% verified criteria coverage across assessments, readiness, and technical skills."
            ),
            "assessment_evidence": (
                f"Scored {lead_ass}% in completed role assessment '{leading_candidate['assessment_name']}' "
                f"({leading_candidate['assessment_marks']} / {leading_candidate['assessment_max_marks']} marks)."
                if lead_ass is not None else
                f"No role-specific assessment completed yet. Baseline evaluation relies on proven competency readiness ({leading_candidate['readiness_score']}%)."
            ),
            "project_evidence": (
                f"Demonstrated execution across {lead_proj['total_projects']} projects with a verified success rate of "
                f"{lead_proj['average_verified_success_rate']}%, adhering to milestones and quality targets."
                if lead_proj['average_verified_success_rate'] is not None else
                (f"Completed {lead_proj['total_projects']} projects with average success rate of {lead_proj['average_overall_success_rate']}% (pending supervisor verification)."
                 if lead_proj['average_overall_success_rate'] is not None else "Projects logged require quantified outcome evaluation.")
            ),
            "skill_evidence": (
                f"Achieved {lead_skill['skill_match_score']}% match against {lead_skill['required_skills_count']} role requirements, "
                f"with {lead_skill['matched_skills_count']} skills at or above target proficiency."
                if lead_skill else "Technical skills pending role mapping."
            ),
            "experience_evidence": (
                f"{lead_exp['total_professional_experience_years']} years total professional experience ({lead_exp['current_company_tenure_years']} years company tenure, "
                f"{lead_exp['leadership_experience_years']} years leadership)."
                if lead_exp else "Tenure records verified."
            ),
            "criteria_needing_evidence": leading_candidate.get("missing_information", []) + leading_candidate.get("unverified_information", []),
            "development_activities": leading_candidate.get("suggested_development_activities", [])[:3],
        }

    # -------------------------------------------------------------------------
    # ROLE READINESS QUALIFICATION EVALUATION
    # -------------------------------------------------------------------------
    from models.assessment import Assessment
    role_ass = Assessment.query.filter_by(role_id=role_id).first()
    passing_threshold = float(role_ass.passing_threshold) if role_ass and role_ass.passing_threshold else 70.0

    for cand in candidates:
        unmet = []
        if cand.get("assessment_score") is None:
            unmet.append("Assessment not completed for this target role")
        elif float(cand["assessment_score"]) < passing_threshold:
            unmet.append(f"Assessment score ({cand['assessment_score']}%) is below role passing threshold ({passing_threshold}%)")

        if not cand.get("is_mandatory_eligible", True):
            missing_m = cand.get("criteria_scores", {}).get("skills", {}).get("missing_mandatory", [])
            unmet.append(f"Missing mandatory role skills: {', '.join(missing_m)}")

        if cand.get("readiness_level") not in ["High", "Medium"]:
            unmet.append(f"Readiness classification is '{cand.get('readiness_level', 'Low')}' (requires High or Medium)")

        if not cand.get("has_sufficient_data", True):
            unmet.append("Insufficient data coverage (< 40%) for reliable evaluation")

        if cand.get("suitability_score") is None or float(cand["suitability_score"]) < 60.0:
            unmet.append(f"Overall suitability score ({cand.get('suitability_score', 'N/A')}%) is below succession readiness threshold (60%)")

        cand["meets_readiness_requirements"] = (len(unmet) == 0)
        cand["readiness_unmet_reasons"] = unmet
        cand["passing_threshold"] = passing_threshold

    all_evaluated_candidates = list(candidates)
    qualified_count = len([c for c in all_evaluated_candidates if c.get("meets_readiness_requirements")])
    if meets_readiness:
        candidates = [c for c in candidates if c["meets_readiness_requirements"]]

    return {
        "role_id": role.id,
        "role_name": role.role_name,
        "department": role.department,
        "description": role.description,
        "weights": config.to_dict(),
        "weights_config": config.to_dict(),
        "is_readiness_filtered": bool(meets_readiness),
        "meets_readiness_filter_active": bool(meets_readiness),
        "total_evaluated": len(all_evaluated_candidates),
        "total_candidates_evaluated": len(all_evaluated_candidates),
        "qualified_successors_count": qualified_count,
        "eligible_candidates_count": len([c for c in candidates if c["has_sufficient_data"]]),
        "insufficient_evidence_count": len([c for c in candidates if not c["has_sufficient_data"]]),
        "highest_assessment_scorer": {
            "employee_id": highest_ass_candidates[0]["employee_id"] if highest_ass_candidates else None,
            "employee_name": highest_ass_candidates[0]["employee_name"] if highest_ass_candidates else None,
            "score": highest_ass_score,
            "count": len(highest_ass_candidates),
            "tied_candidates": [
                {"employee_id": c["employee_id"], "employee_name": c["employee_name"], "score": c["assessment_score"]}
                for c in highest_ass_candidates
            ]
        } if highest_ass_score is not None else None,
        "highest_project_performer": {
            "employee_id": best_proj_candidates[0]["employee_id"] if best_proj_candidates else None,
            "employee_name": best_proj_candidates[0]["employee_name"] if best_proj_candidates else None,
            "rate": best_proj_rate,
            "is_verified": bool(verified_project_candidates),
            "count": len(best_proj_candidates),
            "tied_candidates": [
                {"employee_id": c["employee_id"], "employee_name": c["employee_name"], "rate": best_proj_rate, "is_verified": bool(c.get("project_summary", {}).get("average_verified_success_rate") is not None)}
                for c in best_proj_candidates
            ]
        } if best_proj_rate is not None else None,
        "best_skill_matcher": {
            "employee_id": best_skill_candidates[0]["employee_id"] if best_skill_candidates else None,
            "employee_name": best_skill_candidates[0]["employee_name"] if best_skill_candidates else None,
            "score": best_skill_score,
            "count": len(best_skill_candidates),
            "tied_candidates": [
                {"employee_id": c["employee_id"], "employee_name": c["employee_name"], "score": c["skill_score"]}
                for c in best_skill_candidates
            ]
        } if best_skill_score is not None else None,
        "highest_overall_suitability": {
            "employee_id": best_suit_candidates[0]["employee_id"] if best_suit_candidates else None,
            "employee_name": best_suit_candidates[0]["employee_name"] if best_suit_candidates else None,
            "score": best_suit_score,
            "count": len(best_suit_candidates),
            "tied_candidates": [
                {"employee_id": c["employee_id"], "employee_name": c["employee_name"], "score": c["suitability_score"]}
                for c in best_suit_candidates
            ]
        } if best_suit_score is not None else None,
        "role_analysis_summary": role_analysis_summary,
        "candidates": candidates,
        "ranked_successors": candidates
    }
