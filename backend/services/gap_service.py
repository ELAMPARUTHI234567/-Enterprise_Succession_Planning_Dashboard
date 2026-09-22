from models.employee import Employee
from models.role import LeadershipRole
from models.competency import Competency
from models.role_competency import RoleCompetency
from models.employee_competency import EmployeeCompetency

def calculate_competency_gaps(employee_id, role_id, employee=None, role=None, competencies=None, role_reqs=None, emp_scores=None):
    """
    Calculates competency gaps between employee's current scores and target leadership role requirements.
    Formula: Gap = Required Score - Current Score (If Current >= Required, Gap = 0).
    Categorization:
      - 0-10: Low Gap
      - 11-20: Medium Gap
      - > 20: High Gap
    Status:
      - Current >= Required: Strength
      - Current < Required: Improvement Area
    """
    if employee is None:
        employee = Employee.query.get(employee_id)
    if role is None:
        role = LeadershipRole.query.get(role_id)

    if not employee or not role:
        return None

    # Fetch role competency requirements if not provided
    if role_reqs is None:
        role_reqs = RoleCompetency.query.filter_by(role_id=role_id).all()
    req_dict = {rr.competency_id: rr.required_score for rr in role_reqs}

    # Fetch employee current scores if not provided
    if emp_scores is None:
        emp_scores = EmployeeCompetency.query.filter_by(employee_id=employee_id).all()
    score_dict = {es.competency_id: es.score for es in emp_scores}

    # All competencies dictionary
    if competencies is None:
        competencies = Competency.query.all()

    gap_items = []
    total_current_score = 0.0
    valid_count = 0
    max_gap = -1.0
    major_gap_name = "None"

    for comp in competencies:
        req_score = req_dict.get(comp.id, 80.0) # default 80 if not mapped
        curr_score = score_dict.get(comp.id, 0.0)
        
        raw_gap = req_score - curr_score
        actual_gap = max(0.0, raw_gap)

        if raw_gap > max_gap:
            max_gap = raw_gap
            major_gap_name = comp.name

        # Categorize gap
        if curr_score >= req_score:
            gap_level = "No Gap"
            status = "Strength"
        elif actual_gap <= 10.0:
            gap_level = "Low Gap"
            status = "Improvement Area"
        elif actual_gap <= 20.0:
            gap_level = "Medium Gap"
            status = "Improvement Area"
        else:
            gap_level = "High Gap"
            status = "Improvement Area"

        gap_items.append({
            "competency_id": comp.id,
            "competency_name": comp.name,
            "description": comp.description,
            "current_score": round(curr_score, 2),
            "required_score": round(req_score, 2),
            "gap": round(actual_gap, 2),
            "raw_gap": round(raw_gap, 2),
            "gap_level": gap_level,
            "status": status
        })

        total_current_score += curr_score
        valid_count += 1

    overall_competency_score = round(total_current_score / valid_count, 2) if valid_count > 0 else 0.0

    return {
        "employee_id": employee.id,
        "employee_name": employee.name,
        "role_id": role.id,
        "role_name": role.role_name,
        "overall_competency_score": overall_competency_score,
        "major_gap": major_gap_name if max_gap > 0 else "None",
        "competencies": gap_items
    }
