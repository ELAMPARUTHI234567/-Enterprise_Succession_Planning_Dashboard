from flask import Blueprint, request, jsonify, current_app
import time
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

# Lightweight in-memory TTL cache for dashboard analytics to eliminate redundant Supabase roundtrips
_DASHBOARD_CACHE = {}
_CACHE_TTL_SECONDS = 30  # 30-second TTL

def get_cached_dashboard(cache_key):
    now = time.time()
    entry = _DASHBOARD_CACHE.get(cache_key)
    if entry and (now - entry['time'] < _CACHE_TTL_SECONDS):
        return entry['data']
    return None

def set_cached_dashboard(cache_key, data):
    _DASHBOARD_CACHE[cache_key] = {
        'time': time.time(),
        'data': data
    }

def clear_dashboard_cache():
    _DASHBOARD_CACHE.clear()

@dashboard_bp.route('/dashboard-summary', methods=['GET'])
def get_dashboard_summary():
    try:
        manager_id = request.args.get('manager_id', type=int)
        employee_id = request.args.get('employee_id', type=int)
        force_refresh = request.args.get('refresh', '').lower() in ('true', '1') or request.args.get('nocache', '').lower() in ('true', '1')

        user, current_emp, _, _ = get_current_user()
        if user:
            if user.role.lower() == 'manager':
                manager_id = current_emp.id if current_emp else -1
                employee_id = None
            elif user.role.lower() == 'employee':
                employee_id = current_emp.id if current_emp else -1
                manager_id = None

        cache_key = f"{user.role if user else 'anon'}:{manager_id}:{employee_id}"
        is_testing = current_app.config.get('TESTING', False)
        if not force_refresh and not is_testing:
            cached_data = get_cached_dashboard(cache_key)
            if cached_data is not None:
                return jsonify({"success": True, "data": cached_data, "cached": True}), 200

        # Eager load roles & competencies once (eliminating redundant count roundtrips)
        roles = LeadershipRole.query.all()
        competencies = Competency.query.all()
        total_roles = len(roles)
        total_competencies = len(competencies)

        # Filter employees list with eager loading of manager to avoid N+1 queries
        if manager_id:
            employees = Employee.query.options(db.joinedload(Employee.manager)).filter_by(manager_id=manager_id).all()
            total_employees = len(employees)
            total_managers = 1
        elif employee_id:
            employees = Employee.query.options(db.joinedload(Employee.manager)).filter_by(id=employee_id).all()
            total_employees = len(employees)
            total_managers = 0
        else:
            employees = Employee.query.options(db.joinedload(Employee.manager)).all()
            total_employees = len(employees)
            total_managers = db.session.query(db.func.count(User.id)).filter(db.func.lower(User.role) == 'manager').scalar() or 0
            if total_managers == 0:
                total_managers = sum(1 for e in employees if 'manager' in (e.designation or '').lower())

        # Single conditional aggregation query for all assessment status counts
        if manager_id or employee_id:
            scoped_emp_ids = [e.id for e in employees]
            if scoped_emp_ids:
                counts = db.session.query(
                    db.func.count(db.case((AssessmentAssignment.status == 'Completed', 1))),
                    db.func.count(db.case((db.or_(AssessmentAssignment.status != 'Completed', AssessmentAssignment.status.is_(None)), 1))),
                    db.func.count(db.case((AssessmentAssignment.status.in_(['In Progress', 'In-Progress']), 1)))
                ).filter(AssessmentAssignment.employee_id.in_(scoped_emp_ids)).first()
                completed_assessments, pending_assessments, in_progress_assessments = counts or (0, 0, 0)
            else:
                pending_assessments = 0
                completed_assessments = 0
                in_progress_assessments = 0
        else:
            counts = db.session.query(
                db.func.count(db.case((AssessmentAssignment.status == 'Completed', 1))),
                db.func.count(db.case((db.or_(AssessmentAssignment.status != 'Completed', AssessmentAssignment.status.is_(None)), 1))),
                db.func.count(db.case((AssessmentAssignment.status.in_(['In Progress', 'In-Progress']), 1)))
            ).first()
            completed_assessments, pending_assessments, in_progress_assessments = counts or (0, 0, 0)

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

        # Cache valid response in memory for 30s
        set_cached_dashboard(cache_key, summary_data)

        return jsonify({"success": True, "data": summary_data}), 200
    except Exception as e:
        import traceback, sys
        print(f"[ERROR] Failed to generate dashboard summary: {str(e)}\n{traceback.format_exc()}", file=sys.stderr)
        return jsonify({
            "success": False,
            "message": "Unable to load dashboard summary analytics. Please retry or contact system administrator."
        }), 500
    except Exception as e:
        import traceback, sys
        print(f"[ERROR] Failed to generate dashboard summary: {str(e)}\n{traceback.format_exc()}", file=sys.stderr)
        return jsonify({
            "success": False,
            "message": "Unable to load dashboard summary analytics. Please retry or contact system administrator."
        }), 500
