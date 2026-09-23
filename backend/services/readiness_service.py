from models.employee import Employee
from models.role import LeadershipRole
from models.successor_result import SuccessorResult
from services.gap_service import calculate_competency_gaps
from extensions import db

def calculate_successor_readiness(employee_id, role_id, employee=None, role=None, competencies=None, role_reqs=None, emp_scores=None):
    """
    Computes baseline successor readiness score using weighted components:
    - Competency Score: 40%
    - Performance Score: 25%
    - Experience Score: 15% (Normalized: experience_years / 10 * 100, max 100)
    - Leadership Score: 20%
    """
    if employee is None:
        employee = Employee.query.get(employee_id)
    if role is None:
        role = LeadershipRole.query.get(role_id)

    if not employee or not role:
        return None

    # Calculate competency gaps and overall competency score
    gap_result = calculate_competency_gaps(
        employee_id, role_id,
        employee=employee, role=role,
        competencies=competencies, role_reqs=role_reqs, emp_scores=emp_scores
    )
    competency_score = gap_result["overall_competency_score"]
    major_gap = gap_result["major_gap"]

    # Calculate experience score (normalized 0-100, 10+ years = 100)
    experience_score = min(100.0, (employee.experience_years / 10.0) * 100.0)

    # Readiness Score Formula
    readiness_score = (
        (competency_score * 0.40) +
        (employee.performance_score * 0.25) +
        (experience_score * 0.15) +
        (employee.leadership_score * 0.20)
    )
    readiness_score = round(readiness_score, 2)

    # Classification
    if readiness_score >= 80.0:
        readiness_level = "High"
    elif readiness_score >= 60.0:
        readiness_level = "Medium"
    else:
        readiness_level = "Low"

    return {
        "employee_id": employee.id,
        "employee_code": employee.employee_code,
        "name": employee.name,
        "department": employee.department,
        "designation": employee.designation,
        "role_id": role.id,
        "role_name": role.role_name,
        "competency_score": competency_score,
        "performance_score": round(employee.performance_score, 2),
        "experience_score": round(experience_score, 2),
        "experience_years": employee.experience_years,
        "leadership_score": round(employee.leadership_score, 2),
        "readiness_score": readiness_score,
        "readiness_level": readiness_level,
        "major_gap": major_gap,
        "gap_analysis": gap_result["competencies"]
    }

def get_ranked_successors_for_role(role_id):
    """
    Ranks all employees for a target leadership role sorted by highest readiness score first.
    Pre-fetches all required data to execute in O(1) queries instead of O(N) database queries.
    """
    from models.competency import Competency
    from models.role_competency import RoleCompetency
    from models.employee_competency import EmployeeCompetency

    role = LeadershipRole.query.get(role_id)
    if not role:
        return None

    employees = Employee.query.all()
    competencies = Competency.query.all()
    role_reqs = RoleCompetency.query.filter_by(role_id=role_id).all()
    
    all_emp_comps = EmployeeCompetency.query.all()
    emp_comp_map = {}
    for ec in all_emp_comps:
        emp_comp_map.setdefault(ec.employee_id, []).append(ec)

    results = []

    for emp in employees:
        e_comps = emp_comp_map.get(emp.id, [])
        res = calculate_successor_readiness(
            emp.id, role_id,
            employee=emp, role=role,
            competencies=competencies, role_reqs=role_reqs, emp_scores=e_comps
        )
        if res:
            results.append(res)

    # Sort descending by readiness score
    results.sort(key=lambda x: x["readiness_score"], reverse=True)

    # Assign rank numbers
    for idx, item in enumerate(results, start=1):
        item["rank"] = idx

    return {
        "role_id": role.id,
        "role_name": role.role_name,
        "department": role.department,
        "description": role.description,
        "candidates": results
    }
