from flask import Blueprint, jsonify
from models.employee import Employee
from models.role import LeadershipRole
from models.competency import Competency
from models.employee_competency import EmployeeCompetency
from services.readiness_service import calculate_successor_readiness
from services.gap_service import calculate_competency_gaps

analytics_bp = Blueprint('analytics', __name__)

@analytics_bp.route('/analytics', methods=['GET'])
def get_analytics():
    employees = Employee.query.all()
    roles = LeadershipRole.query.all()
    competencies = Competency.query.all()

    default_role_id = roles[0].id if roles else 1

    # 1. Department Breakdown
    dept_map = {}
    for emp in employees:
        d = emp.department
        if d not in dept_map:
            dept_map[d] = {"count": 0, "readiness_sum": 0.0, "performance_sum": 0.0}
        
        r_info = calculate_successor_readiness(emp.id, default_role_id)
        r_score = r_info["readiness_score"] if r_info else 0.0

        dept_map[d]["count"] += 1
        dept_map[d]["readiness_sum"] += r_score
        dept_map[d]["performance_sum"] += emp.performance_score

    dept_labels = list(dept_map.keys())
    dept_counts = [dept_map[d]["count"] for d in dept_labels]
    dept_avg_readiness = [round(dept_map[d]["readiness_sum"] / dept_map[d]["count"], 2) for d in dept_labels]

    # 2. Competency Averages across enterprise
    comp_averages = []
    comp_labels = []
    for c in competencies:
        emp_comps = EmployeeCompetency.query.filter_by(competency_id=c.id).all()
        avg_s = round(sum(ec.score for ec in emp_comps) / len(emp_comps), 2) if emp_comps else 0.0
        comp_labels.append(c.name)
        comp_averages.append(avg_s)

    # 3. Gap Severity Count Breakdown
    gap_severity = {"Strength": 0, "Low Gap": 0, "Medium Gap": 0, "High Gap": 0}
    for emp in employees:
        g_info = calculate_competency_gaps(emp.id, default_role_id)
        if g_info:
            for item in g_info["competencies"]:
                lvl = item["gap_level"]
                if lvl == "No Gap":
                    gap_severity["Strength"] += 1
                elif lvl in gap_severity:
                    gap_severity[lvl] += 1

    # 4. Performance vs Readiness correlation scatter data
    scatter_points = []
    for emp in employees:
        r_info = calculate_successor_readiness(emp.id, default_role_id)
        if r_info:
            scatter_points.append({
                "x": round(emp.performance_score, 2),
                "y": r_info["readiness_score"],
                "name": emp.name,
                "department": emp.department,
                "readiness_level": r_info["readiness_level"]
            })

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
