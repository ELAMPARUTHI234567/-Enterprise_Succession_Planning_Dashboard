from models.employee import Employee
from models.role import LeadershipRole
from models.suitability_config import SuitabilityConfig
from models.assessment import AssessmentAssignment
from services.gap_service import calculate_competency_gaps
from services.readiness_service import calculate_successor_readiness
from services.project_service import get_employee_projects_summary
from services.experience_service import calculate_employee_experience
from services.skill_service import evaluate_employee_skill_gaps

def evaluate_leadership_suitability(employee_id, role_id, config=None):
    """
    Evaluates an employee against a target leadership role using the 5 core criteria:
    1. Existing assessment results (weight configurable, default 30%)
    2. Leadership competency and readiness (weight configurable, default 25%)
    3. Relevant skills and skill gaps (weight configurable, default 20%)
    4. Project experience and verified outcomes (weight configurable, default 15%)
    5. Professional and company experience (weight configurable, default 10%)

    Missing Data Policy:
    - Calculates evidence coverage (0.0 to 100.0%) across criteria.
    - If evidence coverage is below threshold (< 30%) or neither assessments nor readiness exist,
      flags has_sufficient_data = False ("Insufficient data for reliable evaluation").
    - Transparent documentation of all sub-scores and weights.
    """
    employee = Employee.query.get(employee_id)
    role = LeadershipRole.query.get(role_id)
    if not employee or not role:
        return None

    if config is None:
        config = SuitabilityConfig.get_active_config()

    w_assessment = config.assessment_weight
    w_readiness = config.readiness_weight
    w_skills = config.skills_weight
    w_projects = config.projects_weight
    w_experience = config.experience_weight

    evidence_present_count = 0
    total_criteria_count = 5
    unverified_flags = []
    missing_flags = []

    # 1. Existing Assessment Results (0-100)
    # Check completed assessment assignments for this employee
    completed_assignments = AssessmentAssignment.query.filter_by(
        employee_id=employee_id, status='Completed'
    ).all()

    assessment_score = None
    if completed_assignments:
        scores = [a.result.overall_score for a in completed_assignments if a.result]
        if scores:
            assessment_score = round(sum(scores) / len(scores), 1)
            evidence_present_count += 1
        else:
            assessment_score = float(employee.performance_score or 70.0)
            unverified_flags.append("Using baseline employee performance score in lieu of completed assessments")
    else:
        # Check baseline employee performance score
        if employee.performance_score and employee.performance_score > 0:
            assessment_score = float(employee.performance_score)
            unverified_flags.append("Using baseline performance score (no direct assessment completed yet)")
        else:
            assessment_score = 0.0
            missing_flags.append("No completed assessments found")

    # 2. Leadership Competency & Successor Readiness (0-100)
    readiness_data = calculate_successor_readiness(employee_id, role_id, employee=employee, role=role)
    if readiness_data:
        readiness_score = float(readiness_data["readiness_score"])
        competency_score = float(readiness_data["competency_score"])
        major_gap = readiness_data.get("major_gap", "None")
        evidence_present_count += 1
    else:
        readiness_score = 0.0
        competency_score = 0.0
        major_gap = "None"
        missing_flags.append("Leadership competency data missing")

    # 3. Technical Skills and Skill Gaps (0-100)
    skill_data = evaluate_employee_skill_gaps(employee_id, role_id)
    skills_score = float(skill_data["skill_match_score"]) if skill_data else 0.0
    if skill_data and (skill_data["matched_skills_count"] > 0 or skill_data["below_requirement_count"] > 0):
        evidence_present_count += 1
    else:
        missing_flags.append("No technical skills registered")

    if skill_data and skill_data["skills_needing_assessment"]:
        unverified_flags.append(f"{len(skill_data['skills_needing_assessment'])} skills are self-reported and pending verification")

    # 4. Project Experience and Verified Outcomes (0-100)
    proj_summary = get_employee_projects_summary(employee_id)
    projects_score = 0.0
    if proj_summary["total_projects"] > 0:
        evidence_present_count += 1
        if proj_summary["average_verified_success_rate"] is not None:
            projects_score = float(proj_summary["average_verified_success_rate"])
        elif proj_summary["average_overall_success_rate"] is not None:
            projects_score = float(proj_summary["average_overall_success_rate"])
            unverified_flags.append("Project success metrics are self-reported (pending supervisor verification)")
        else:
            # Projects exist but metrics not evaluated yet -> baseline based on project volume (capped at 75)
            projects_score = min(75.0, proj_summary["total_projects"] * 25.0)
            unverified_flags.append("Project outcomes lack quantified success indicators ('Not evaluated')")
    else:
        missing_flags.append("No projects registered in employee profile")

    # 5. Professional and Company Experience (0-100)
    exp_summary = calculate_employee_experience(employee_id)
    exp_score = 0.0
    if exp_summary:
        if exp_summary["has_employment_history"] or exp_summary["current_company_tenure_years"] > 0:
            evidence_present_count += 1

        # Normalized Experience Scoring:
        # Total experience (up to 10 years = 50 pts)
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

    # Evidence Coverage Calculation
    evidence_coverage_pct = round((evidence_present_count / total_criteria_count) * 100.0, 1)

    # Missing Data Policy:
    # Insufficient data if evidence coverage < 40% AND no verified assessments/projects
    has_sufficient_data = (evidence_coverage_pct >= 40.0) or (assessment_score > 0 and readiness_score > 0)

    # Calculate Weighted Suitability Score
    raw_suitability_score = (
        (assessment_score * (w_assessment / 100.0)) +
        (readiness_score * (w_readiness / 100.0)) +
        (skills_score * (w_skills / 100.0)) +
        (projects_score * (w_projects / 100.0)) +
        (exp_score * (w_experience / 100.0))
    )
    suitability_score = round(raw_suitability_score, 1)

    # Classification
    if not has_sufficient_data:
        suitability_level = "Insufficient Data"
    elif suitability_score >= 80.0:
        suitability_level = "High Suitability"
    elif suitability_score >= 65.0:
        suitability_level = "Medium Suitability"
    else:
        suitability_level = "Developing / Low"

    # Suggested Development Actions
    suggested_actions = []
    if skill_data and skill_data["recommended_development_activities"]:
        suggested_actions.extend(skill_data["recommended_development_activities"][:3])
    if exp_summary and exp_summary["leadership_experience_years"] < 2.0:
        suggested_actions.append("Assign mentorship or interim team-lead responsibility to expand leadership tenure.")
    if proj_summary["total_projects"] == 0:
        suggested_actions.append("Assign target leadership role projects to demonstrate domain execution.")
    if not completed_assignments:
        suggested_actions.append("Schedule formal leadership competency assessment to benchmark readiness.")

    return {
        "employee_id": employee.id,
        "employee_code": employee.employee_code,
        "employee_name": employee.name,
        "email": employee.email,
        "department": employee.department,
        "designation": employee.designation,
        "role_id": role.id,
        "role_name": role.role_name,
        "suitability_score": suitability_score if has_sufficient_data else None,
        "suitability_level": suitability_level,
        "has_sufficient_data": has_sufficient_data,
        "evidence_coverage_pct": evidence_coverage_pct,
        "criteria_scores": {
            "assessments": {
                "score": assessment_score,
                "weight": w_assessment,
                "weighted_points": round(assessment_score * (w_assessment / 100.0), 1),
                "is_available": completed_assignments is not None and len(completed_assignments) > 0
            },
            "readiness": {
                "score": readiness_score,
                "competency_score": competency_score,
                "major_gap": major_gap,
                "weight": w_readiness,
                "weighted_points": round(readiness_score * (w_readiness / 100.0), 1),
                "is_available": readiness_data is not None
            },
            "skills": {
                "score": skills_score,
                "matched_count": skill_data["matched_skills_count"] if skill_data else 0,
                "missing_count": skill_data["missing_skills_count"] if skill_data else 0,
                "weight": w_skills,
                "weighted_points": round(skills_score * (w_skills / 100.0), 1),
                "is_available": skill_data is not None and skill_data["matched_skills_count"] > 0
            },
            "projects": {
                "score": projects_score,
                "total_projects": proj_summary["total_projects"],
                "verified_count": proj_summary["verified_projects_count"],
                "weight": w_projects,
                "weighted_points": round(projects_score * (w_projects / 100.0), 1),
                "is_available": proj_summary["total_projects"] > 0
            },
            "experience": {
                "score": exp_score,
                "total_years": exp_summary["total_professional_experience_years"] if exp_summary else 0.0,
                "tenure_years": exp_summary["current_company_tenure_years"] if exp_summary else 0.0,
                "leadership_years": exp_summary["leadership_experience_years"] if exp_summary else 0.0,
                "weight": w_experience,
                "weighted_points": round(exp_score * (w_experience / 100.0), 1),
                "is_available": exp_summary is not None and (exp_summary["has_employment_history"] or exp_summary["current_company_tenure_years"] > 0)
            }
        },
        "missing_information": missing_flags,
        "unverified_information": unverified_flags,
        "suggested_development_activities": suggested_actions,
        "skill_details": skill_data,
        "project_summary": proj_summary,
        "experience_summary": exp_summary
    }

def compare_candidates_for_role(role_id, sort_by='suitability_score', min_coverage=0.0):
    """
    Evaluates all employees for a leadership role, returning candidates ranked
    by suitability score with full evidence breakdown for HR evaluation.
    """
    role = LeadershipRole.query.get(role_id)
    if not role:
        return None

    employees = Employee.query.all()
    config = SuitabilityConfig.get_active_config()

    candidates = []
    for emp in employees:
        cand_eval = evaluate_leadership_suitability(emp.id, role_id, config=config)
        if cand_eval:
            if cand_eval["evidence_coverage_pct"] >= min_coverage:
                candidates.append(cand_eval)

    # Sort candidates
    if sort_by == 'suitability_score':
        # Put sufficient data candidates first sorted by score descending, then insufficient data
        candidates.sort(
            key=lambda x: (
                1 if x["has_sufficient_data"] else 0,
                x["suitability_score"] if x["suitability_score"] is not None else -1.0
            ),
            reverse=True
        )
    elif sort_by == 'readiness':
        candidates.sort(key=lambda x: x["criteria_scores"]["readiness"]["score"], reverse=True)
    elif sort_by == 'experience':
        candidates.sort(key=lambda x: x["criteria_scores"]["experience"]["score"], reverse=True)
    elif sort_by == 'skills':
        candidates.sort(key=lambda x: x["criteria_scores"]["skills"]["score"], reverse=True)

    # Assign rank numbers
    for idx, cand in enumerate(candidates, start=1):
        cand["rank"] = idx

    return {
        "role_id": role.id,
        "role_name": role.role_name,
        "department": role.department,
        "description": role.description,
        "weights_config": config.to_dict(),
        "total_evaluated": len(candidates),
        "candidates": candidates
    }
