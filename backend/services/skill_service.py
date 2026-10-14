from models.employee import Employee
from models.role import LeadershipRole
from models.employee_skill import EmployeeSkill
from models.role_required_skill import RoleRequiredSkill

PROFICIENCY_SCALE = {
    1: "Beginner",
    2: "Basic",
    3: "Intermediate",
    4: "Advanced",
    5: "Expert"
}

def evaluate_employee_skill_gaps(employee_id, role_id):
    """
    Evaluates employee skills against role requirements:
    - Matched skills (proficiency >= required)
    - Skills below required proficiency (gap = required - actual)
    - Missing required skills (gap = required)
    - Skills needing assessment (self-reported but unverified)
    - Recommended skill-development activities
    - Composite skill match score (0.0 to 100.0)
    """
    employee = Employee.query.get(employee_id)
    role = LeadershipRole.query.get(role_id)
    if not employee or not role:
        return None

    # Role required skills
    required_skills = RoleRequiredSkill.query.filter_by(role_id=role_id).all()

    # Employee skills
    emp_skills = EmployeeSkill.query.filter_by(employee_id=employee_id).all()
    emp_skill_map = {s.skill_name.strip().lower(): s for s in emp_skills}

    matched_skills = []
    below_req_skills = []
    missing_skills = []
    needing_assessment = []
    recommended_activities = []

    total_possible_score = 0.0
    total_achieved_score = 0.0

    for req in required_skills:
        req_name_clean = req.skill_name.strip().lower()
        req_level = req.min_proficiency_level
        weight = req.weight or 1.0

        total_possible_score += (req_level * weight)

        emp_s = emp_skill_map.get(req_name_clean)

        if emp_s:
            actual_level = emp_s.proficiency_level
            gap = max(0, req_level - actual_level)

            is_verified = emp_s.verification_status in ['Assessment-Verified', 'Reviewer-Verified', 'HR-Verified']
            if not is_verified:
                needing_assessment.append({
                    "skill_name": emp_s.skill_name,
                    "category": emp_s.category,
                    "reported_level": actual_level,
                    "reported_label": PROFICIENCY_SCALE.get(actual_level, "Intermediate"),
                    "verification_status": emp_s.verification_status
                })

            item = {
                "skill_name": req.skill_name,
                "category": req.category,
                "required_level": req_level,
                "required_label": PROFICIENCY_SCALE.get(req_level, "Intermediate"),
                "employee_level": actual_level,
                "employee_label": PROFICIENCY_SCALE.get(actual_level, "Intermediate"),
                "gap": gap,
                "is_mandatory": req.is_mandatory,
                "verification_status": emp_s.verification_status,
                "is_verified": is_verified,
                "years_of_experience": emp_s.years_of_experience
            }

            if actual_level >= req_level:
                matched_skills.append(item)
                total_achieved_score += (req_level * weight)
            else:
                below_req_skills.append(item)
                total_achieved_score += (actual_level * weight)
                recommended_activities.append(
                    f"Advance {req.skill_name} proficiency from {PROFICIENCY_SCALE.get(actual_level)} to {PROFICIENCY_SCALE.get(req_level)} through targeted workshops and projects."
                )
        else:
            # Missing skill
            missing_skills.append({
                "skill_name": req.skill_name,
                "category": req.category,
                "required_level": req_level,
                "required_label": PROFICIENCY_SCALE.get(req_level, "Intermediate"),
                "employee_level": 0,
                "employee_label": "Not Acquired",
                "gap": req_level,
                "is_mandatory": req.is_mandatory,
                "verification_status": "Missing",
                "is_verified": False,
                "years_of_experience": 0.0
            })
            recommended_activities.append(
                f"Complete introductory and intermediate curriculum in {req.skill_name} to meet role requirement ({PROFICIENCY_SCALE.get(req_level)})."
            )

    # Any extra skills employee has not required by role
    additional_skills = []
    req_names_set = {req.skill_name.strip().lower() for req in required_skills}
    for emp_s in emp_skills:
        if emp_s.skill_name.strip().lower() not in req_names_set:
            additional_skills.append(emp_s.to_dict())

    # Overall Skill Match Score
    if total_possible_score > 0:
        skill_match_score = round((total_achieved_score / total_possible_score) * 100.0, 1)
    else:
        # If no role skills configured yet, evaluate based on employee's average skill proficiency (normalized / 5 * 100)
        if emp_skills:
            avg_prof = sum(s.proficiency_level for s in emp_skills) / len(emp_skills)
            skill_match_score = round((avg_prof / 5.0) * 100.0, 1)
        else:
            skill_match_score = 0.0

    return {
        "employee_id": employee.id,
        "employee_name": employee.name,
        "role_id": role.id,
        "role_name": role.role_name,
        "skill_match_score": skill_match_score,
        "required_skills_count": len(required_skills),
        "matched_skills_count": len(matched_skills),
        "below_requirement_count": len(below_req_skills),
        "missing_skills_count": len(missing_skills),
        "matched_skills": matched_skills,
        "skills_below_requirement": below_req_skills,
        "missing_skills": missing_skills,
        "skills_needing_assessment": needing_assessment,
        "additional_skills": additional_skills,
        "recommended_development_activities": recommended_activities,
        "has_required_skills": len(required_skills) > 0
    }
