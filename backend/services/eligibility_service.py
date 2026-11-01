from extensions import db
from models.employee import Employee
from models.role import LeadershipRole
from models.role_eligibility_config import RoleEligibilityConfig
from models.role_required_skill import RoleRequiredSkill
from models.competency import Competency
from models.role_competency import RoleCompetency
from models.employee_competency import EmployeeCompetency
from models.employee_project import EmployeeProject
from models.employment_history import EmploymentHistory
from models.employee_skill import EmployeeSkill
from models.assessment import AssessmentAssignment
from services.project_service import get_employee_projects_summary
from services.skill_service import evaluate_employee_skill_gaps
from services.experience_service import calculate_employee_experience
from services.gap_service import calculate_competency_gaps
from services.readiness_service import calculate_successor_readiness

def get_role_eligibility_config(role_id, role_name=""):
    """
    Fetches the configured pre-assessment eligibility thresholds for a role.
    If no custom config exists yet, creates and returns sensible role-specific defaults.
    """
    role = LeadershipRole.query.get(role_id)
    if not role:
        return None
    
    config = RoleEligibilityConfig.query.filter_by(role_id=role_id).first()
    if not config:
        config = RoleEligibilityConfig.get_or_create(role_id, role.role_name)
    return config

def update_role_eligibility_config(role_id, data, user_id=None):
    """
    Updates the pre-assessment eligibility thresholds for a leadership role.
    Strictly validates boundary limits to ensure reliable criteria.
    """
    role = LeadershipRole.query.get(role_id)
    if not role:
        return None, "Leadership role not found", 404

    config = get_role_eligibility_config(role_id, role.role_name)
    if not config:
        config = RoleEligibilityConfig(role_id=role_id)
        db.session.add(config)

    # Validate and assign thresholds
    if "min_experience_years" in data:
        val = float(data["min_experience_years"])
        if val < 0 or val > 40:
            return None, "Minimum experience years must be between 0 and 40 years", 400
        config.min_experience_years = val

    if "min_company_tenure_months" in data:
        val = float(data["min_company_tenure_months"])
        if val < 0 or val > 240:
            return None, "Minimum company tenure must be between 0 and 240 months", 400
        config.min_company_tenure_months = val

    if "min_project_success_rate" in data:
        val = float(data["min_project_success_rate"])
        if val < 0.0 or val > 100.0:
            return None, "Minimum project success rate must be between 0% and 100%", 400
        config.min_project_success_rate = val

    if "min_verified_projects" in data:
        val = int(data["min_verified_projects"])
        if val < 0:
            return None, "Minimum verified projects must be 0 or greater", 400
        config.min_verified_projects = val

    if "require_verified_projects" in data:
        config.require_verified_projects = bool(data["require_verified_projects"])

    if "min_skill_match_pct" in data:
        val = float(data["min_skill_match_pct"])
        if val < 0.0 or val > 100.0:
            return None, "Minimum skill match percentage must be between 0% and 100%", 400
        config.min_skill_match_pct = val

    if "require_all_mandatory_skills" in data:
        config.require_all_mandatory_skills = bool(data["require_all_mandatory_skills"])

    if "min_competency_score" in data:
        val = float(data["min_competency_score"])
        if val < 0.0 or val > 100.0:
            return None, "Minimum competency score must be between 0 and 100", 400
        config.min_competency_score = val

    if "min_evidence_coverage_pct" in data:
        val = float(data["min_evidence_coverage_pct"])
        if val < 0.0 or val > 100.0:
            return None, "Minimum evidence coverage percentage must be between 0% and 100%", 400
        config.min_evidence_coverage_pct = val

    if user_id:
        config.updated_by = user_id

    db.session.commit()
    return config, None, 200

def evaluate_pre_assessment_eligibility(
    employee_id, role_id, config=None,
    employee=None, role=None,
    emp_projects=None,
    emp_skills=None,
    emp_histories=None,
    role_required_skills=None,
    competencies=None,
    role_competencies=None,
    employee_competencies=None
):
    """
    Evaluates an employee against role-specific pre-assessment eligibility requirements.
    
    Returns a transparent, auditable breakdown with 3 possible status outcomes:
    - 'Eligible for assessment'
    - 'Not eligible yet'
    - 'Insufficient data for reliable evaluation'
    
    Guarantees:
    - Distinguishes verified project outcomes from self-reported data.
    - Never fabricates missing scores or treats missing data as 0 or 100.
    - Accurately checks skill proficiencies (1-5 scale) and mandatory role skills.
    - Calculates non-overlapping professional tenure.
    - Documents explicit unmet requirements and reasons.
    """
    if employee is None:
        employee = Employee.query.get(employee_id)
    if role is None:
        role = LeadershipRole.query.get(role_id)
    if not employee or not role:
        return None

    if config is None:
        config = get_role_eligibility_config(role_id, role.role_name)
    elif isinstance(config, dict):
        defaults = RoleEligibilityConfig.get_defaults_for_role(role.role_name)
        cfg_obj = RoleEligibilityConfig(role_id=role_id)
        for k, v in defaults.items():
            setattr(cfg_obj, k, config.get(k, v))
        config = cfg_obj

    unmet_requirements = []
    reasons = []
    evidence_points = 0
    total_evidence_points = 4  # Projects, Skills, Experience, Competencies

    # =========================================================================
    # 1. VERIFIED PROJECTS & OUTCOMES EVALUATION
    # =========================================================================
    proj_summary = get_employee_projects_summary(employee_id, projects=emp_projects)
    total_projects = proj_summary.get("total_projects", 0)
    verified_projects_count = proj_summary.get("verified_projects_count", 0)
    has_verified = proj_summary.get("has_verified_projects", False)
    avg_verified_rate = proj_summary.get("average_verified_success_rate")
    avg_overall_rate = proj_summary.get("average_overall_success_rate")

    project_passed = True
    project_status = "No Projects"
    project_score_used = None
    project_message = ""

    if total_projects > 0:
        evidence_points += 1
        if has_verified and avg_verified_rate is not None:
            project_status = "Verified"
            project_score_used = float(avg_verified_rate)
            if project_score_used < config.min_project_success_rate:
                project_passed = False
                unmet_requirements.append(
                    f"Verified project success rate ({project_score_used}%) is below role requirement ({config.min_project_success_rate}%)"
                )
            if verified_projects_count < config.min_verified_projects:
                project_passed = False
                unmet_requirements.append(
                    f"Candidate has {verified_projects_count} verified project(s), but role requires at least {config.min_verified_projects}"
                )
            project_message = f"{verified_projects_count} verified project(s) with {project_score_used}% average success rate."
        elif avg_overall_rate is not None:
            project_status = "Self-Reported"
            project_score_used = float(avg_overall_rate)
            if config.require_verified_projects:
                project_passed = False
                unmet_requirements.append(
                    "Project records are self-reported and pending supervisor/HR verification (verified projects mandatory for this role)"
                )
            elif project_score_used < config.min_project_success_rate:
                project_passed = False
                unmet_requirements.append(
                    f"Self-reported project success rate ({project_score_used}%) is below role requirement ({config.min_project_success_rate}%)"
                )
            project_message = f"Self-reported project outcomes ({project_score_used}% success rate), pending HR verification."
        else:
            project_status = "Not Evaluated"
            project_passed = False
            unmet_requirements.append("Recorded projects lack evaluated success metrics")
            project_message = "Projects recorded without quantifiable performance indicators."
    else:
        project_status = "No Projects"
        if config.min_verified_projects > 0 or config.require_verified_projects:
            project_passed = False
            unmet_requirements.append("No project records registered for candidate (role requires verified project evidence)")
        project_message = "No project history registered in candidate profile."

    # =========================================================================
    # 2. ROLE-REQUIRED SKILLS & PROFICIENCY EVALUATION
    # =========================================================================
    skill_eval = evaluate_employee_skill_gaps(
        employee_id, role_id,
        employee=employee, role=role,
        required_skills=role_required_skills,
        emp_skills=emp_skills
    )

    skill_passed = True
    skill_match_score = float(skill_eval.get("skill_match_score", 0.0))
    missing_mandatory = []
    missing_skills = skill_eval.get("missing_skills", [])
    matched_skills = skill_eval.get("matched_skills", [])
    below_req_skills = skill_eval.get("below_requirement_skills", [])
    skills_needing_assessment = skill_eval.get("skills_needing_assessment", [])

    if skill_eval.get("has_required_skills") or len(matched_skills) > 0:
        evidence_points += 1

    for s in missing_skills:
        if s.get("is_mandatory"):
            missing_mandatory.append(s.get("skill_name"))

    if config.require_all_mandatory_skills and missing_mandatory:
        skill_passed = False
        unmet_requirements.append(
            f"Missing {len(missing_mandatory)} mandatory role skill(s): {', '.join(missing_mandatory)}"
        )

    if skill_match_score < config.min_skill_match_pct:
        skill_passed = False
        unmet_requirements.append(
            f"Technical skill match ({skill_match_score}%) is below minimum required threshold ({config.min_skill_match_pct}%)"
        )

    skills_message = (
        f"Matched {len(matched_skills)} skills ({skill_match_score}% match). "
        f"{len(missing_mandatory)} missing mandatory, {len(below_req_skills)} below required proficiency."
    )

    # =========================================================================
    # 3. PROFESSIONAL EXPERIENCE & NON-OVERLAPPING TENURE
    # =========================================================================
    exp_summary = calculate_employee_experience(
        employee_id, employee=employee, histories=emp_histories
    )

    total_exp_years = float(exp_summary.get("total_professional_experience_years", 0.0))
    tenure_years = float(exp_summary.get("current_company_tenure_years", 0.0))
    tenure_months = round(tenure_years * 12.0, 1)
    leadership_exp_years = float(exp_summary.get("leadership_experience_years", 0.0))

    exp_passed = True
    if exp_summary.get("has_employment_history") or tenure_years > 0:
        evidence_points += 1

    if total_exp_years < config.min_experience_years:
        exp_passed = False
        unmet_requirements.append(
            f"Total professional experience ({total_exp_years} yrs) is below role minimum ({config.min_experience_years} yrs)"
        )

    if tenure_months < config.min_company_tenure_months:
        exp_passed = False
        unmet_requirements.append(
            f"Company tenure ({tenure_months} mos) is below required minimum tenure ({config.min_company_tenure_months} mos)"
        )

    exp_message = (
        f"{total_exp_years} years total non-overlapping experience, "
        f"{tenure_years} years ({tenure_months} mos) company tenure, {leadership_exp_years} years leadership."
    )

    # =========================================================================
    # 4. COMPETENCY LEVELS VS REQUIRED COMPETENCIES
    # =========================================================================
    gap_data = calculate_competency_gaps(
        employee_id, role_id,
        employee=employee, role=role,
        competencies=competencies,
        role_reqs=role_competencies,
        emp_scores=employee_competencies
    )

    comp_score = 0.0
    comp_passed = True
    major_gap_info = "None"
    comp_gaps_list = []

    if gap_data and "competencies" in gap_data and len(gap_data["competencies"]) > 0:
        evidence_points += 1
        comp_items = gap_data["competencies"]
        avg_comp = sum(float(c.get("current_score", 0.0)) for c in comp_items) / len(comp_items)
        comp_score = round(avg_comp, 1)

        for c in comp_items:
            g_val = float(c.get("gap", 0.0))
            if g_val > 0:
                comp_gaps_list.append({
                    "competency_name": c.get("name") or c.get("competency_name"),
                    "current_score": c.get("current_score"),
                    "required_score": c.get("required_score") or c.get("target_score"),
                    "gap": g_val
                })

        major_gap_info = gap_data.get("major_gap", "None")

        if comp_score < config.min_competency_score:
            comp_passed = False
            unmet_requirements.append(
                f"Current competency rating ({comp_score}) is below role readiness prerequisite ({config.min_competency_score})"
            )
    else:
        comp_passed = False
        unmet_requirements.append("No competency assessment records on file for candidate")

    comp_message = f"Average competency rating: {comp_score}/100. Gaps identified: {len(comp_gaps_list)}."

    # =========================================================================
    # 5. EVIDENCE COVERAGE & RELIABILITY CHECK
    # =========================================================================
    evidence_coverage_pct = round((evidence_points / total_evidence_points) * 100.0, 1)
    coverage_passed = evidence_coverage_pct >= config.min_evidence_coverage_pct

    # =========================================================================
    # 6. FINAL ELIGIBILITY DETERMINATION
    # =========================================================================
    if not coverage_passed:
        status = "Insufficient data for reliable evaluation"
        is_eligible = False
        reasons.append(
            f"Evidence coverage ({evidence_coverage_pct}%) is insufficient for reliable evaluation (minimum required: {config.min_evidence_coverage_pct}%)."
        )
    elif project_passed and skill_passed and exp_passed and comp_passed:
        status = "Eligible for assessment"
        is_eligible = True
        reasons.append("Candidate satisfies all pre-assessment prerequisites and requirements for target leadership role.")
    else:
        status = "Not eligible yet"
        is_eligible = False
        reasons.extend(unmet_requirements)

    return {
        "employee_id": employee.id,
        "employee_name": employee.name,
        "employee_code": employee.employee_code,
        "email": employee.email,
        "department": employee.department,
        "designation": employee.designation,
        "role_id": role.id,
        "role_name": role.role_name,
        "is_eligible": is_eligible,
        "status": status,
        "reasons": reasons,
        "unmet_requirements": unmet_requirements,
        "evidence_coverage_pct": evidence_coverage_pct,
        "skill_match_pct": skill_match_score,
        "project_success_rate": avg_verified_rate if avg_verified_rate is not None else avg_overall_rate,
        "verified_projects_count": verified_projects_count,
        "total_projects_count": total_projects,
        "total_experience_years": total_exp_years,
        "company_tenure_months": round(tenure_months, 1),
        "matched_skills": [s.get("skill_name") for s in matched_skills if isinstance(s, dict)] or matched_skills,
        "missing_skills": [s.get("skill_name") for s in missing_skills if isinstance(s, dict)] or missing_skills,
        "competency_average": comp_score,
        "criteria_evaluations": {
            "projects": {
                "passed": project_passed,
                "status": project_status,
                "total_projects": total_projects,
                "verified_projects_count": verified_projects_count,
                "average_verified_success_rate": avg_verified_rate,
                "average_overall_success_rate": avg_overall_rate,
                "evaluated_score": project_score_used,
                "required_success_rate": config.min_project_success_rate,
                "required_verified_projects": config.min_verified_projects,
                "is_verified": has_verified,
                "message": project_message
            },
            "skills": {
                "passed": skill_passed,
                "skill_match_score": skill_match_score,
                "required_match_pct": config.min_skill_match_pct,
                "matched_skills_count": len(matched_skills),
                "matched_skills": [s.get("skill_name") for s in matched_skills],
                "missing_skills": [s.get("skill_name") for s in missing_skills],
                "missing_mandatory": missing_mandatory,
                "has_missing_mandatory": len(missing_mandatory) > 0,
                "below_requirement_count": len(below_req_skills),
                "skills_needing_assessment_count": len(skills_needing_assessment),
                "message": skills_message
            },
            "experience": {
                "passed": exp_passed,
                "total_experience_years": total_exp_years,
                "required_experience_years": config.min_experience_years,
                "company_tenure_years": tenure_years,
                "company_tenure_months": tenure_months,
                "required_tenure_months": config.min_company_tenure_months,
                "leadership_experience_years": leadership_exp_years,
                "message": exp_message
            },
            "competencies": {
                "passed": comp_passed,
                "competency_score": comp_score,
                "required_competency_score": config.min_competency_score,
                "competency_gaps": comp_gaps_list,
                "major_gap": major_gap_info,
                "message": comp_message
            },
            "evidence_coverage": {
                "passed": coverage_passed,
                "coverage_pct": evidence_coverage_pct,
                "required_coverage_pct": config.min_evidence_coverage_pct,
                "evidence_points": evidence_points,
                "total_possible_points": total_evidence_points
            }
        },
        "thresholds_applied": config.to_dict()
    }

def get_pre_assessment_candidates_for_role(role_id, current_user=None, current_employee=None):
    """
    Evaluates all employees within the authorized scope against pre-assessment prerequisites.
    Applies strict RBAC:
    - HR / Admin: Organization-wide pool.
    - Manager: Direct reports only (+ self).
    - Employee: Self only.
    """
    role = LeadershipRole.query.get(role_id)
    if not role:
        return None

    # Scope candidates by role
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

    config = get_role_eligibility_config(role_id, role.role_name)

    emp_ids = [e.id for e in employees]
    if not emp_ids:
        return {
            "role_id": role.id,
            "role_name": role.role_name,
            "thresholds": config.to_dict(),
            "eligible_candidates": [],
            "not_eligible_candidates": [],
            "insufficient_data_candidates": [],
            "all_candidates": [],
            "summary": {
                "total": 0,
                "eligible_count": 0,
                "not_eligible_count": 0,
                "insufficient_data_count": 0
            }
        }

    # Batch pre-fetch dependencies for O(1) performance
    all_projects = EmployeeProject.query.filter(EmployeeProject.employee_id.in_(emp_ids)).all()
    projects_by_emp = {}
    for p in all_projects:
        projects_by_emp.setdefault(p.employee_id, []).append(p)

    all_histories = EmploymentHistory.query.filter(EmploymentHistory.employee_id.in_(emp_ids)).all()
    histories_by_emp = {}
    for h in all_histories:
        histories_by_emp.setdefault(h.employee_id, []).append(h)

    all_skills = EmployeeSkill.query.filter(EmployeeSkill.employee_id.in_(emp_ids)).all()
    skills_by_emp = {}
    for s in all_skills:
        skills_by_emp.setdefault(s.employee_id, []).append(s)

    all_comps = EmployeeCompetency.query.filter(EmployeeCompetency.employee_id.in_(emp_ids)).all()
    comps_by_emp = {}
    for ec in all_comps:
        comps_by_emp.setdefault(ec.employee_id, []).append(ec)

    role_skills = RoleRequiredSkill.query.filter_by(role_id=role_id).all()
    competencies = Competency.query.all()
    role_reqs = RoleCompetency.query.filter_by(role_id=role_id).all()

    # Pre-fetch latest assessment assignments for these employees
    all_role_assignments = AssessmentAssignment.query.filter(
        AssessmentAssignment.employee_id.in_(emp_ids),
        AssessmentAssignment.assessment.has(role_id=role_id)
    ).order_by(AssessmentAssignment.id.desc()).all() if emp_ids else []
    assignments_by_emp = {}
    for a in all_role_assignments:
        if a.employee_id not in assignments_by_emp:
            assignments_by_emp[a.employee_id] = a

    eligible_list = []
    not_eligible_list = []
    insufficient_data_list = []
    all_list = []

    for emp in employees:
        eval_res = evaluate_pre_assessment_eligibility(
            emp.id, role_id, config=config,
            employee=emp, role=role,
            emp_projects=projects_by_emp.get(emp.id, []),
            emp_skills=skills_by_emp.get(emp.id, []),
            emp_histories=histories_by_emp.get(emp.id, []),
            role_required_skills=role_skills,
            competencies=competencies,
            role_competencies=role_reqs,
            employee_competencies=comps_by_emp.get(emp.id, [])
        )
        if not eval_res:
            continue

        # Attach real-time assignment status
        assign_obj = assignments_by_emp.get(emp.id)
        if assign_obj:
            eval_res["assignment_status"] = assign_obj.get_real_status()
            eval_res["assignment_id"] = assign_obj.id
            eval_res["scheduled_date"] = assign_obj.scheduled_date
            eval_res["start_time"] = assign_obj.start_time
            eval_res["end_time"] = assign_obj.end_time
            eval_res["duration_minutes"] = assign_obj.duration_minutes
            eval_res["time_zone"] = assign_obj.time_zone
            eval_res["is_scheduled"] = True
        else:
            eval_res["assignment_status"] = "Not Scheduled"
            eval_res["assignment_id"] = None
            eval_res["is_scheduled"] = False

        all_list.append(eval_res)
        if eval_res["status"] == "Eligible for assessment":
            eligible_list.append(eval_res)
        elif eval_res["status"] == "Insufficient data for reliable evaluation":
            insufficient_data_list.append(eval_res)
        else:
            not_eligible_list.append(eval_res)


    return {
        "role_id": role.id,
        "role_name": role.role_name,
        "thresholds": config.to_dict(),
        "eligible_candidates": eligible_list,
        "not_eligible_candidates": not_eligible_list,
        "insufficient_data_candidates": insufficient_data_list,
        "all_candidates": all_list,
        "summary": {
            "total": len(all_list),
            "eligible": len(eligible_list),
            "eligible_count": len(eligible_list),
            "not_eligible": len(not_eligible_list),
            "not_eligible_count": len(not_eligible_list),
            "insufficient_data": len(insufficient_data_list),
            "insufficient_data_count": len(insufficient_data_list),
            "eligibility_rate_pct": round((len(eligible_list) / len(all_list) * 100.0), 1) if all_list else 0.0
        }
    }
