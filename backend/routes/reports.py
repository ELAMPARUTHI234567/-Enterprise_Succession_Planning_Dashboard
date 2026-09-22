import io
import csv
from flask import Blueprint, jsonify, Response, request
from models.employee import Employee
from models.role import LeadershipRole
from models.competency import Competency
from models.employee_competency import EmployeeCompetency
from services.readiness_service import calculate_successor_readiness
from services.gap_service import calculate_competency_gaps

reports_bp = Blueprint('reports', __name__)

from models.role_competency import RoleCompetency

@reports_bp.route('/reports/summary', methods=['GET'])
def get_reports_summary():
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

    emp_reports = []
    for emp in employees:
        e_comps = emp_comp_map.get(emp.id, [])
        r_info = calculate_successor_readiness(
            emp.id, default_role_id,
            employee=emp, role=default_role,
            competencies=competencies, role_reqs=role_reqs, emp_scores=e_comps
        )

        emp_reports.append({
            "id": emp.id,
            "employee_code": emp.employee_code,
            "name": emp.name,
            "department": emp.department,
            "designation": emp.designation,
            "experience_years": emp.experience_years,
            "performance_score": emp.performance_score,
            "leadership_score": emp.leadership_score,
            "overall_competency_score": r_info["competency_score"] if r_info else 0.0,
            "readiness_score": r_info["readiness_score"] if r_info else 0.0,
            "readiness_level": r_info["readiness_level"] if r_info else "Low",
            "major_gap": r_info["major_gap"] if r_info else "None"
        })

    return jsonify({"success": True, "data": emp_reports}), 200

@reports_bp.route('/reports/export-csv', methods=['GET'])
def export_reports_csv():
    report_type = request.args.get('type', 'readiness')
    employees = Employee.query.all()
    roles = LeadershipRole.query.all()
    default_role_id = roles[0].id if roles else 1

    output = io.StringIO()
    writer = csv.writer(output)

    if report_type == 'readiness':
        writer.writerow([
            "Employee Code", "Name", "Department", "Designation",
            "Experience (Yrs)", "Performance Score", "Leadership Score",
            "Competency Score", "Readiness Score", "Readiness Level", "Major Gap"
        ])
        for emp in employees:
            r_info = calculate_successor_readiness(emp.id, default_role_id)
            g_info = calculate_competency_gaps(emp.id, default_role_id)
            writer.writerow([
                emp.employee_code,
                emp.name,
                emp.department,
                emp.designation,
                emp.experience_years,
                emp.performance_score,
                emp.leadership_score,
                g_info["overall_competency_score"] if g_info else 0.0,
                r_info["readiness_score"] if r_info else 0.0,
                r_info["readiness_level"] if r_info else "Low",
                r_info["major_gap"] if r_info else "None"
            ])
        filename = "successor_readiness_report.csv"

    elif report_type == 'gaps':
        writer.writerow(["Employee Code", "Name", "Target Role", "Competency", "Current Score", "Required Score", "Gap", "Status"])
        for emp in employees:
            g_info = calculate_competency_gaps(emp.id, default_role_id)
            if g_info:
                for item in g_info["competencies"]:
                    writer.writerow([
                        emp.employee_code,
                        emp.name,
                        g_info["role_name"],
                        item["competency_name"],
                        item["current_score"],
                        item["required_score"],
                        item["gap"],
                        item["status"]
                    ])
        filename = "competency_gap_report.csv"

    else:
        writer.writerow(["Employee Code", "Name", "Department", "Designation", "Experience Years", "Performance Score"])
        for emp in employees:
            writer.writerow([emp.employee_code, emp.name, emp.department, emp.designation, emp.experience_years, emp.performance_score])
        filename = "employee_competency_report.csv"

    output.seek(0)
    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": f"attachment;filename={filename}"}
    )
