from flask import Blueprint, jsonify
from models.employee import Employee
from models.role import LeadershipRole
from models.competency import Competency
from models.employee_competency import EmployeeCompetency
from services.readiness_service import calculate_successor_readiness
from services.gap_service import calculate_competency_gaps

analytics_bp = Blueprint('analytics', __name__)
from models.role_competency import RoleCompetency

@analytics_bp.route('/analytics', methods=['GET'])
def get_analytics():
    employees = Employee.query.all()
    roles = LeadershipRole.query.all()
    competencies = Competency.query.all()

    default_role = roles[0] if roles else None
    default_role_id = default_role.id if default_role else 1
    role_reqs = RoleCompetency.query.filter_by(role_id=default_role_id).all() if default_role else []

    all_emp_comps = EmployeeCompetency.query.all()
    emp_comp_map = {}
    for ec in all_emp_comps:
        emp_comp_map.setdefault(ec.employee_id, []).append(ec)

    dept_map = {}
    scatter_points = []
    gap_severity = {"Strength": 0, "Low Gap": 0, "Medium Gap": 0, "High Gap": 0}

    for emp in employees:
        d = emp.department
        if d not in dept_map:
            dept_map[d] = {"count": 0, "readiness_sum": 0.0, "performance_sum": 0.0}

        e_comps = emp_comp_map.get(emp.id, [])
        r_info = calculate_successor_readiness(
            emp.id, default_role_id,
            employee=emp, role=default_role,
            competencies=competencies, role_reqs=role_reqs, emp_scores=e_comps
        )
        r_score = r_info["readiness_score"] if r_info else 0.0

        dept_map[d]["count"] += 1
        dept_map[d]["readiness_sum"] += r_score
        dept_map[d]["performance_sum"] += emp.performance_score

        if r_info:
            scatter_points.append({
                "x": round(emp.performance_score, 2),
                "y": r_info["readiness_score"],
                "name": emp.name,
                "department": emp.department,
                "readiness_level": r_info["readiness_level"]
            })
            for item in r_info.get("gap_analysis", []):
                lvl = item["gap_level"]
                if lvl == "No Gap":
                    gap_severity["Strength"] += 1
                elif lvl in gap_severity:
                    gap_severity[lvl] += 1

    dept_labels = list(dept_map.keys())
    dept_counts = [dept_map[d]["count"] for d in dept_labels]
    dept_avg_readiness = [round(dept_map[d]["readiness_sum"] / dept_map[d]["count"], 2) for d in dept_labels] if dept_labels else []

    comp_averages = []
    comp_labels = []
    for c in competencies:
        emp_comps = [ec for ec in all_emp_comps if ec.competency_id == c.id]
        avg_s = round(sum(ec.score for ec in emp_comps) / len(emp_comps), 2) if emp_comps else 0.0
        comp_labels.append(c.name)
        comp_averages.append(avg_s)

    return jsonify({
        "success": True,
        "data": {
            "department_analytics": {
                "labels": dept_labels,
                "counts": dept_counts,
                "avg_readiness": dept_avg_readiness
            },
            "competency_averages": {
                "labels": comp_labels,
                "averages": comp_averages
            },
            "gap_severity": gap_severity,
            "performance_vs_readiness": scatter_points
        }
    }), 200
