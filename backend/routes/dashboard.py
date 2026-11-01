from flask import Blueprint, request, jsonify
from models.employee import Employee
from models.role import LeadershipRole
from models.competency import Competency
from models.role_competency import RoleCompetency
from models.employee_competency import EmployeeCompetency
from models.assessment import Assessment, AssessmentAssignment
from models.user import User
from services.readiness_service import calculate_successor_readiness
from services.gap_service import calculate_competency_gaps
from extensions import db

from utils.auth_middleware import get_current_user

dashboard_bp = Blueprint('dashboard', __name__)

@dashboard_bp.route('/dashboard-summary', methods=['GET'])
def get_dashboard_summary():
    try:
        manager_id = request.args.get('manager_id', type=int)
        employee_id = request.args.get('employee_id', type=int)

        user, current_emp, _, _ = get_current_user()
        if user:
            if user.role.lower() == 'manager':
                manager_id = current_emp.id if current_emp else -1
                employee_id = None
            elif user.role.lower() == 'employee':
                employee_id = current_emp.id if current_emp else -1
                manager_id = None

        total_roles = db.session.query(db.func.count(LeadershipRole.id)).scalar() or 0
        total_competencies = db.session.query(db.func.count(Competency.id)).scalar() or 0

        # Filter employees list if manager_id or employee_id provided
        if manager_id:
            employees = Employee.query.filter_by(manager_id=manager_id).all()
            total_employees = len(employees)
            total_managers = 1
        elif employee_id:
            employees = Employee.query.filter_by(id=employee_id).all()
            total_employees = len(employees)
            total_managers = 0
        else:
            employees = Employee.query.all()
            total_employees = len(employees)
            total_managers = db.session.query(db.func.count(User.id)).filter(db.func.lower(User.role) == 'manager').scalar() or 0
            if total_managers == 0:
                total_managers = db.session.query(db.func.count(Employee.id)).filter(Employee.designation.ilike('%manager%')).scalar() or 0

        if manager_id or employee_id:
            scoped_emp_ids = [e.id for e in employees]
            if scoped_emp_ids:
                pending_assessments = db.session.query(db.func.count(AssessmentAssignment.id)).filter(
                    db.or_(AssessmentAssignment.status != 'Completed', AssessmentAssignment.status.is_(None)),
                    AssessmentAssignment.employee_id.in_(scoped_emp_ids)
                ).scalar() or 0
                completed_assessments = db.session.query(db.func.count(AssessmentAssignment.id)).filter(
                    AssessmentAssignment.status == 'Completed',
                    AssessmentAssignment.employee_id.in_(scoped_emp_ids)
                ).scalar() or 0
                in_progress_assessments = db.session.query(db.func.count(AssessmentAssignment.id)).filter(
                    AssessmentAssignment.status.in_(['In Progress', 'In-Progress']),
                    AssessmentAssignment.employee_id.in_(scoped_emp_ids)
                ).scalar() or 0
            else:
                pending_assessments = 0
                completed_assessments = 0
                in_progress_assessments = 0
        else:
            pending_assessments = db.session.query(db.func.count(AssessmentAssignment.id)).filter(
                db.or_(AssessmentAssignment.status != 'Completed', AssessmentAssignment.status.is_(None))
            ).scalar() or 0
            completed_assessments = db.session.query(db.func.count(AssessmentAssignment.id)).filter(
                AssessmentAssignment.status == 'Completed'
            ).scalar() or 0
            in_progress_assessments = db.session.query(db.func.count(AssessmentAssignment.id)).filter(
                AssessmentAssignment.status.in_(['In Progress', 'In-Progress'])
            ).scalar() or 0

        roles = LeadershipRole.query.all()
        competencies = Competency.query.all()
        comp_by_id = {c.id: c for c in competencies}

        high_readiness_count = 0
        med_readiness_count = 0
        low_readiness_count = 0
        all_readiness_scores = []
        top_candidates = []

        default_role = roles[0] if roles else None
        default_role_id = default_role.id if default_role else 1
        role_reqs = RoleCompetency.query.filter_by(role_id=default_role_id).all() if default_role else []

        all_emp_comps = EmployeeCompetency.query.all()
        emp_comp_map = {}
        for ec in all_emp_comps:
            emp_comp_map.setdefault(ec.employee_id, []).append(ec)

        for emp in employees:
            e_comps = emp_comp_map.get(emp.id, [])
            r_info = calculate_successor_readiness(
                emp.id, default_role_id,
                employee=emp, role=default_role,
                competencies=competencies, role_reqs=role_reqs, emp_scores=e_comps
            )
            if r_info:
                all_readiness_scores.append(r_info["readiness_score"])
                lvl = r_info["readiness_level"]
                if lvl == "High":
                    high_readiness_count += 1
                elif lvl == "Medium":
                    med_readiness_count += 1
                else:
                    low_readiness_count += 1

                top_candidates.append(r_info)

        top_candidates.sort(key=lambda x: x["readiness_score"], reverse=True)
        top_candidates_slice = top_candidates[:5]

        avg_comp_score = round(sum(ec.score for ec in all_emp_comps) / len(all_emp_comps), 2) if all_emp_comps else 0.0

        critical_gaps_count = 0
        comp_gap_aggregates = {c.name: {"current_total": 0.0, "required_score": 80.0, "count": 0} for c in competencies}

        role_req_dict = {rr.competency_id: rr.required_score for rr in role_reqs}

        for comp in competencies:
            req_val = role_req_dict.get(comp.id, 85.0)
            comp_gap_aggregates[comp.name]["required_score"] = req_val

        for ec in all_emp_comps:
            comp_obj = comp_by_id.get(ec.competency_id)
            if comp_obj and comp_obj.name in comp_gap_aggregates:
                comp_gap_aggregates[comp_obj.name]["current_total"] += ec.score
                comp_gap_aggregates[comp_obj.name]["count"] += 1
                
                req_score = comp_gap_aggregates[comp_obj.name]["required_score"]
                if (req_score - ec.score) > 20.0:
                    critical_gaps_count += 1

        comp_labels = []
        comp_current_averages = []
        comp_required_targets = []
        comp_gaps = []

        for name, agg in comp_gap_aggregates.items():
            comp_labels.append(name)
            avg_curr = round(agg["current_total"] / agg["count"], 2) if agg["count"] > 0 else 0.0
            req_tgt = agg["required_score"]
            gap_val = max(0.0, req_tgt - avg_curr)

            comp_current_averages.append(avg_curr)
            comp_required_targets.append(req_tgt)
            comp_gaps.append(round(gap_val, 2))

        summary_data = {
            "kpis": {
                "total_employees": len(employees) if (manager_id or employee_id) else total_employees,
                "total_managers": total_managers,
                "leadership_roles": total_roles,
                "total_competencies": total_competencies,
                "pending_assessments": pending_assessments,
                "completed_assessments": completed_assessments,
                "potential_successors": high_readiness_count + med_readiness_count,
                "high_readiness": high_readiness_count,
                "medium_readiness": med_readiness_count,
                "low_readiness": low_readiness_count,
                "critical_competency_gaps": critical_gaps_count,
                "average_competency_score": avg_comp_score
            },
            "charts": {
                "current_vs_required": {
                    "labels": comp_labels,
                    "current": comp_current_averages,
                    "required": comp_required_targets
                },
                "readiness_distribution": {
                    "labels": ["High Readiness", "Medium Readiness", "Low Readiness"],
                    "data": [high_readiness_count, med_readiness_count, low_readiness_count]
                },
                "competency_gaps": {
                    "labels": comp_labels,
                    "gaps": comp_gaps
                },
                "assessment_completion": {
                    "labels": ["Completed", "Pending", "In Progress"],
                    "data": [completed_assessments, pending_assessments, in_progress_assessments]
                }
            },
            "top_successors": top_candidates_slice
        }

        return jsonify({"success": True, "data": summary_data}), 200
    except Exception as e:
        import traceback, sys
        print(f"[ERROR] Failed to generate dashboard summary: {str(e)}\n{traceback.format_exc()}", file=sys.stderr)
        return jsonify({
            "success": False,
            "message": "Unable to load dashboard summary analytics. Please retry or contact system administrator."
        }), 500
