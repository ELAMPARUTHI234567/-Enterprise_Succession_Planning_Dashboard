from flask import Blueprint, request, jsonify
from datetime import datetime, date
from extensions import db
from models.employee import Employee
from models.user import User
from models.role import LeadershipRole
from models.competency import Competency
from models.role_competency import RoleCompetency
from models.employee_competency import EmployeeCompetency
from models.employee_project import EmployeeProject
from models.assessment import AssessmentAssignment, AssessmentResult
from models.manager_dashboard import (
    TeamTask, TeamGoal, TeamIssue, ManagerFeedback, ManagerRecommendation, PerformanceReview
)
from services.suitability_service import evaluate_leadership_suitability
from services.gap_service import calculate_competency_gaps
from services.readiness_service import calculate_successor_readiness
from utils.auth_middleware import get_current_user

manager_bp = Blueprint('manager', __name__)

def get_authorized_manager_context():
    """
    Validates authentication and determines the active manager scope.
    Returns: (user, manager_emp, is_hr_or_admin, error_response)
    """
    user, current_emp, err_msg, status = get_current_user()
    if err_msg:
        return None, None, False, (jsonify({"success": False, "message": err_msg}), status)

    role_lower = user.role.lower()
    if role_lower not in ['manager', 'hr', 'admin']:
        return None, None, False, (jsonify({
            "success": False,
            "message": "Access forbidden: Manager or HR role required."
        }), 403)

    is_hr_or_admin = role_lower in ['hr', 'admin']
    manager_emp = current_emp

    # HR/Admin may specify an explicit manager_id parameter
    if is_hr_or_admin:
        req_mgr_id = request.args.get('manager_id', type=int)
        if req_mgr_id:
            specified_mgr = Employee.query.get(req_mgr_id)
            if specified_mgr:
                manager_emp = specified_mgr
        elif not manager_emp:
            # Fall back to first available manager employee
            first_mgr = Employee.query.filter(
                (Employee.designation.ilike('%manager%')) | (Employee.id == 4)
            ).first()
            if first_mgr:
                manager_emp = first_mgr

    if not manager_emp:
        return None, None, False, (jsonify({
            "success": False,
            "message": "No employee profile associated with manager account."
        }), 404)

    return user, manager_emp, is_hr_or_admin, None


def verify_direct_report(manager_emp, employee_id, is_hr_or_admin):
    """
    Ensures the target employee is an authorized direct report of the manager.
    """
    if is_hr_or_admin:
        emp = Employee.query.get(employee_id)
        return emp, None

    emp = Employee.query.filter_by(id=employee_id, manager_id=manager_emp.id).first()
    if not emp:
        return None, (jsonify({
            "success": False,
            "message": "Access forbidden: Employee is not in your authorized direct report scope."
        }), 403)
    return emp, None


# ============================================================================
# 1. OVERVIEW & KPI METRICS (8 SPECIFIC DASHBOARD CARDS & CHARTS)
# ============================================================================

@manager_bp.route('/overview', methods=['GET'])
def get_manager_overview():
    user, mgr_emp, is_hr, err = get_authorized_manager_context()
    if err:
        return err

    # 1. Authorized direct reports
    team_members = Employee.query.options(db.joinedload(Employee.manager)).filter_by(manager_id=mgr_emp.id).order_by(Employee.id.asc()).all()
    team_ids = [e.id for e in team_members]

    # 2. Tasks
    tasks = TeamTask.query.filter_by(manager_id=mgr_emp.id).all()
    active_tasks = 0
    completed_tasks = 0
    overdue_tasks = 0
    pending_tasks = 0

    for t in tasks:
        eff_status = t.get_effective_status()
        if eff_status == 'Completed':
            completed_tasks += 1
        elif eff_status == 'Overdue':
            overdue_tasks += 1
            active_tasks += 1
        elif eff_status == 'In Progress':
            active_tasks += 1
        else: # Pending
            pending_tasks += 1
            active_tasks += 1

    total_tasks = len(tasks)
    completion_rate = round((completed_tasks / total_tasks * 100.0), 1) if total_tasks > 0 else 0.0

    # 3. Projects in progress across team members
    in_progress_projects_count = 0
    completed_projects_count = 0
    on_hold_projects_count = 0

    if team_ids:
        team_projects = EmployeeProject.query.filter(EmployeeProject.employee_id.in_(team_ids)).all()
        for p in team_projects:
            st = (p.status or '').strip().lower()
            if st == 'in progress':
                in_progress_projects_count += 1
            elif st == 'completed':
                completed_projects_count += 1
            else:
                on_hold_projects_count += 1
    else:
        team_projects = []

    # 4. Open issues
    issues = TeamIssue.query.filter_by(manager_id=mgr_emp.id).all()
    open_issues = sum(1 for i in issues if i.status != 'Resolved')

    # 5. Pending feedback (direct reports without recent completed feedback follow-up)
    feedbacks = ManagerFeedback.query.filter_by(manager_id=mgr_emp.id).all()
    feedback_emp_ids_completed = {f.employee_id for f in feedbacks if f.follow_up_status == 'Completed'}
    pending_feedback = sum(1 for e_id in team_ids if e_id not in feedback_emp_ids_completed)

    # 6. Employees requiring development
    # Evaluated through competency gaps (< 70% or readiness == 'Low')
    needing_dev_count = 0
    competencies = Competency.query.all()
    default_role = LeadershipRole.query.first()
    default_role_id = default_role.id if default_role else 1
    role_reqs = RoleCompetency.query.filter_by(role_id=default_role_id).all() if default_role else []

    all_emp_comps = EmployeeCompetency.query.filter(EmployeeCompetency.employee_id.in_(team_ids)).all() if team_ids else []
    emp_comp_map = {}
    for ec in all_emp_comps:
        emp_comp_map.setdefault(ec.employee_id, []).append(ec)

    team_perf_labels = []
    team_perf_scores = []
    team_readiness_scores = []

    for emp in team_members:
        team_perf_labels.append(emp.name)
        team_perf_scores.append(emp.performance_score or 0.0)

        e_comps = emp_comp_map.get(emp.id, [])
        r_info = calculate_successor_readiness(
            emp.id, default_role_id,
            employee=emp, role=default_role,
            competencies=competencies, role_reqs=role_reqs, emp_scores=e_comps
        )
        r_score = r_info.get("readiness_score", 0.0) if r_info else 0.0
        r_lvl = r_info.get("readiness_level", "Low") if r_info else "Low"
        team_readiness_scores.append(r_score)

        if r_lvl in ['Low', 'Medium'] or (emp.performance_score and emp.performance_score < 75.0):
            needing_dev_count += 1

    # 7. Dynamic Competency Gaps calculation
    comp_gap_aggregates = {c.name: {"total_score": 0.0, "count": 0, "target": 80.0} for c in competencies}
    role_req_dict = {rr.competency_id: rr.required_score for rr in role_reqs}
    for c in competencies:
        comp_gap_aggregates[c.name]["target"] = role_req_dict.get(c.id, 80.0)

    for ec in all_emp_comps:
        comp_obj = next((c for c in competencies if c.id == ec.competency_id), None)
        if comp_obj and comp_obj.name in comp_gap_aggregates:
            comp_gap_aggregates[comp_obj.name]["total_score"] += ec.score
            comp_gap_aggregates[comp_obj.name]["count"] += 1

    comp_labels = []
    comp_gaps = []
    comp_current = []
    comp_required = []

    for name, agg in comp_gap_aggregates.items():
        comp_labels.append(name)
        avg_score = round(agg["total_score"] / agg["count"], 1) if agg["count"] > 0 else 0.0
        tgt = agg["target"]
        gap = max(0.0, round(tgt - avg_score, 1))
        comp_current.append(avg_score)
        comp_required.append(tgt)
        comp_gaps.append(gap)

    return jsonify({
        "success": True,
        "manager": {
            "id": mgr_emp.id,
            "name": mgr_emp.name,
            "employee_code": mgr_emp.employee_code,
            "department": mgr_emp.department,
            "designation": mgr_emp.designation,
            "email": mgr_emp.email
        },
        "kpis": {
            "total_team_members": len(team_members),
            "active_tasks": active_tasks,
            "completed_tasks": completed_tasks,
            "overdue_tasks": overdue_tasks,
            "projects_in_progress": in_progress_projects_count,
            "open_issues": open_issues,
            "pending_feedback": pending_feedback,
            "employees_needing_development": needing_dev_count,
            "task_completion_rate": completion_rate
        },
        "charts": {
            "task_status": {
                "labels": ["Pending", "In Progress", "Completed", "Overdue"],
                "data": [pending_tasks, active_tasks - pending_tasks - overdue_tasks, completed_tasks, overdue_tasks]
            },
            "project_progress": {
                "labels": ["In Progress", "Completed", "Other"],
                "data": [in_progress_projects_count, completed_projects_count, on_hold_projects_count]
            },
            "team_performance": {
                "labels": team_perf_labels,
                "scores": team_perf_scores,
                "readiness": team_readiness_scores
            },
            "competency_gaps": {
                "labels": comp_labels,
                "current": comp_current,
                "required": comp_required,
                "gaps": comp_gaps
            }
        }
    }), 200


# ============================================================================
# 2. MY TEAM — DYNAMIC EMPLOYEE MANAGEMENT
# ============================================================================

@manager_bp.route('/team', methods=['GET'])
def get_team_members():
    user, mgr_emp, is_hr, err = get_authorized_manager_context()
    if err:
        return err

    team_members = Employee.query.options(
        db.joinedload(Employee.manager),
        db.selectinload(Employee.skills),
        db.selectinload(Employee.competencies).joinedload(EmployeeCompetency.competency),
        db.selectinload(Employee.projects),
        db.selectinload(Employee.employment_history),
        db.selectinload(Employee.assessment_assignments).joinedload(AssessmentAssignment.assessment),
        db.selectinload(Employee.assessment_assignments).joinedload(AssessmentAssignment.result)
    ).filter_by(manager_id=mgr_emp.id).order_by(Employee.id.asc()).all()
    team_ids = [e.id for e in team_members]

    # Pre-fetch tasks counts
    tasks = TeamTask.query.filter_by(manager_id=mgr_emp.id).all()
    tasks_by_emp = {}
    for t in tasks:
        eff_st = t.get_effective_status()
        t_data = tasks_by_emp.setdefault(t.employee_id, {"active": 0, "completed": 0, "overdue": 0})
        if eff_st == 'Completed':
            t_data["completed"] += 1
        elif eff_st == 'Overdue':
            t_data["overdue"] += 1
            t_data["active"] += 1
        else:
            t_data["active"] += 1

    # Pre-fetch projects counts
    projects = EmployeeProject.query.filter(EmployeeProject.employee_id.in_(team_ids)).all() if team_ids else []
    projects_by_emp = {}
    for p in projects:
        p_data = projects_by_emp.setdefault(p.employee_id, {"in_progress": 0, "verified": 0, "total": 0})
        p_data["total"] += 1
        if (p.status or '').strip().lower() == 'in progress':
            p_data["in_progress"] += 1
        if (p.verification_status or '').startswith('HR-Verified') or (p.verification_status or '').startswith('Supervisor'):
            p_data["verified"] += 1

    # Pre-fetch latest assessment results
    results = AssessmentResult.query.join(
        AssessmentAssignment, AssessmentResult.assignment_id == AssessmentAssignment.id
    ).filter(AssessmentAssignment.employee_id.in_(team_ids)).all() if team_ids else []

    results_by_emp = {}
    for r in results:
        e_id = r.assignment.employee_id
        if e_id not in results_by_emp or (r.completed_at and results_by_emp[e_id]["raw_completed_at"] and r.completed_at > results_by_emp[e_id]["raw_completed_at"]):
            results_by_emp[e_id] = {
                "score": r.overall_score,
                "readiness": r.readiness_level,
                "raw_completed_at": r.completed_at,
                "completed_at": r.completed_at.strftime('%Y-%m-%d') if r.completed_at else None
            }

    # Pre-fetch performance reviews in batch (avoiding per-employee N+1 queries)
    reviews = PerformanceReview.query.filter(PerformanceReview.employee_id.in_(team_ids)).all() if team_ids else []
    reviews_by_emp = {}
    for r in reviews:
        reviews_by_emp.setdefault(r.employee_id, []).append(r.to_dict())

    data = []
    for emp in team_members:
        emp_dict = emp.to_dict()
        t_stats = tasks_by_emp.get(emp.id, {"active": 0, "completed": 0, "overdue": 0})
        p_stats = projects_by_emp.get(emp.id, {"in_progress": 0, "verified": 0, "total": 0})
        r_stats = results_by_emp.get(emp.id, None)

        emp_dict["task_counts"] = t_stats
        emp_dict["project_counts"] = p_stats
        emp_dict["latest_assessment"] = r_stats

        # Comprehensive Direct Report Details (loaded efficiently via selectinload)
        emp_dict["skills"] = [s.to_dict() for s in emp.skills]
        emp_dict["competencies"] = [
            {
                "competency_id": ec.competency_id,
                "competency_name": ec.competency.name if ec.competency else f"Competency {ec.competency_id}",
                "score": ec.score
            }
            for ec in emp.competencies
        ]
        emp_dict["projects"] = [p.to_dict() for p in emp.projects]
        emp_dict["employment_history"] = [h.to_dict() for h in emp.employment_history]
        emp_dict["assessments"] = [a.to_dict() for a in emp.assessment_assignments]
        latest_assign = emp.assessment_assignments[-1] if emp.assessment_assignments else None
        emp_dict["latest_assignment_status"] = latest_assign.get_real_status() if latest_assign else "Not Scheduled"
        emp_dict["performance_reviews"] = reviews_by_emp.get(emp.id, [])

        data.append(emp_dict)

    return jsonify({"success": True, "data": data}), 200



@manager_bp.route('/team/<int:emp_id>', methods=['GET'])
def get_team_member_profile(emp_id):
    user, mgr_emp, is_hr, err = get_authorized_manager_context()
    if err:
        return err

    emp, emp_err = verify_direct_report(mgr_emp, emp_id, is_hr)
    if emp_err:
        return emp_err

    # Gather full profile
    projects = [p.to_dict() for p in emp.projects]
    skills = [s.to_dict() for s in emp.skills]
    history = [h.to_dict() for h in emp.employment_history]
    feedbacks = [f.to_dict() for f in ManagerFeedback.query.filter_by(employee_id=emp.id).order_by(ManagerFeedback.created_at.desc()).all()]
    tasks = [t.to_dict() for t in TeamTask.query.filter_by(employee_id=emp.id).order_by(TeamTask.created_at.desc()).all()]
    reviews = [r.to_dict() for r in PerformanceReview.query.filter_by(employee_id=emp.id).order_by(PerformanceReview.created_at.desc()).all()]

    emp_data = emp.to_dict()
    emp_data["projects"] = projects
    emp_data["skills"] = skills
    emp_data["employment_history"] = history
    emp_data["feedbacks"] = feedbacks
    emp_data["tasks"] = tasks
    emp_data["performance_reviews"] = reviews

    return jsonify({"success": True, "data": emp_data}), 200


@manager_bp.route('/team/<int:emp_id>', methods=['PUT'])
def update_team_member_profile(emp_id):
    """
    Allows authorized managers to update permitted profile fields and responsibilities:
    - availability_status (Work status: Available, On Leave, Busy, Remote, etc.)
    - responsibilities (Key duties and scope)
    - performance_score (Optional quick rating update)
    """
    user, mgr_emp, is_hr, err = get_authorized_manager_context()
    if err:
        return err

    emp, emp_err = verify_direct_report(mgr_emp, emp_id, is_hr)
    if emp_err:
        return emp_err

    body = request.get_json() or {}

    try:
        if 'availability_status' in body:
            emp.availability_status = str(body['availability_status']).strip()

        if 'responsibilities' in body:
            emp.responsibilities = str(body['responsibilities']).strip()

        if 'performance_score' in body and body['performance_score'] is not None:
            score = float(body['performance_score'])
            if 0.0 <= score <= 100.0:
                emp.performance_score = score

        emp.updated_at = datetime.utcnow()
        db.session.commit()

        return jsonify({
            "success": True,
            "message": f"Updated profile and responsibilities for {emp.name}.",
            "data": emp.to_dict()
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": f"Failed to update employee: {str(e)}"}), 500


# ============================================================================
# 3. DYNAMIC TASK & PROJECT MANAGEMENT
# ============================================================================

@manager_bp.route('/tasks', methods=['GET'])
def get_team_tasks():
    user, mgr_emp, is_hr, err = get_authorized_manager_context()
    if err:
        return err

    query = TeamTask.query.filter_by(manager_id=mgr_emp.id)

    emp_id = request.args.get('employee_id', type=int)
    if emp_id:
        query = query.filter_by(employee_id=emp_id)

    priority = request.args.get('priority', '').strip()
    if priority and priority != 'All':
        query = query.filter_by(priority=priority)

    status_filter = request.args.get('status', '').strip()
    tasks = query.order_by(TeamTask.created_at.desc()).all()

    result = []
    for t in tasks:
        eff_st = t.get_effective_status()
        if status_filter and status_filter != 'All' and eff_st != status_filter:
            continue
        result.append(t.to_dict())

    return jsonify({"success": True, "data": result}), 200


@manager_bp.route('/tasks', methods=['POST'])
def create_team_task():
    user, mgr_emp, is_hr, err = get_authorized_manager_context()
    if err:
        return err

    data = request.get_json() or {}
    title = (data.get('title') or '').strip()
    employee_id = data.get('employee_id')

    if not title:
        return jsonify({"success": False, "message": "Task title is required."}), 400
    if not employee_id:
        return jsonify({"success": False, "message": "Assigned employee is required."}), 400

    emp, emp_err = verify_direct_report(mgr_emp, int(employee_id), is_hr)
    if emp_err:
        return emp_err

    priority = data.get('priority', 'Medium')
    if priority not in ['Low', 'Medium', 'High', 'Urgent']:
        priority = 'Medium'

    status = data.get('status', 'Pending')
    if status not in ['Pending', 'In Progress', 'Completed', 'Overdue']:
        status = 'Pending'

    project_id = data.get('project_id')
    if project_id:
        try:
            project_id = int(project_id)
        except Exception:
            project_id = None

    try:
        task = TeamTask(
            manager_id=mgr_emp.id,
            employee_id=emp.id,
            project_id=project_id,
            title=title,
            description=data.get('description', ''),
            priority=priority,
            start_date=data.get('start_date'),
            due_date=data.get('due_date'),
            status=status,
            completed_at=datetime.utcnow() if status == 'Completed' else None
        )
        db.session.add(task)
        db.session.commit()

        return jsonify({
            "success": True,
            "message": f"Task '{title}' created and assigned to {emp.name}.",
            "data": task.to_dict()
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": f"Failed to create task: {str(e)}"}), 500


@manager_bp.route('/tasks/<int:task_id>', methods=['PUT'])
def update_team_task(task_id):
    user, mgr_emp, is_hr, err = get_authorized_manager_context()
    if err:
        return err

    task = TeamTask.query.get(task_id)
    if not task or (not is_hr and task.manager_id != mgr_emp.id):
        return jsonify({"success": False, "message": "Task not found or access forbidden."}), 404

    data = request.get_json() or {}

    try:
        if 'title' in data and data['title'].strip():
            task.title = data['title'].strip()
        if 'description' in data:
            task.description = data['description']
        if 'priority' in data and data['priority'] in ['Low', 'Medium', 'High', 'Urgent']:
            task.priority = data['priority']
        if 'start_date' in data:
            task.start_date = data['start_date']
        if 'due_date' in data:
            task.due_date = data['due_date']
        if 'project_id' in data:
            task.project_id = int(data['project_id']) if data['project_id'] else None
        if 'employee_id' in data and data['employee_id']:
            emp, emp_err = verify_direct_report(mgr_emp, int(data['employee_id']), is_hr)
            if emp_err:
                return emp_err
            task.employee_id = emp.id

        if 'status' in data:
            new_status = data['status']
            if new_status in ['Pending', 'In Progress', 'Completed', 'Overdue']:
                task.status = new_status
                if new_status == 'Completed' and not task.completed_at:
                    task.completed_at = datetime.utcnow()
                elif new_status != 'Completed':
                    task.completed_at = None

        task.updated_at = datetime.utcnow()
        db.session.commit()

        return jsonify({
            "success": True,
            "message": f"Task '{task.title}' updated successfully.",
            "data": task.to_dict()
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": f"Failed to update task: {str(e)}"}), 500


@manager_bp.route('/tasks/<int:task_id>', methods=['DELETE'])
def delete_team_task(task_id):
    user, mgr_emp, is_hr, err = get_authorized_manager_context()
    if err:
        return err

    task = TeamTask.query.get(task_id)
    if not task or (not is_hr and task.manager_id != mgr_emp.id):
        return jsonify({"success": False, "message": "Task not found or access forbidden."}), 404

    try:
        db.session.delete(task)
        db.session.commit()
        return jsonify({"success": True, "message": "Task deleted successfully."}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": f"Failed to delete task: {str(e)}"}), 500


# ============================================================================
# 4. DYNAMIC TEAM GOALS
# ============================================================================

@manager_bp.route('/goals', methods=['GET'])
def get_team_goals():
    user, mgr_emp, is_hr, err = get_authorized_manager_context()
    if err:
        return err

    goals = TeamGoal.query.filter_by(manager_id=mgr_emp.id).order_by(TeamGoal.created_at.desc()).all()
    return jsonify({"success": True, "data": [g.to_dict() for g in goals]}), 200


@manager_bp.route('/goals', methods=['POST'])
def create_team_goal():
    user, mgr_emp, is_hr, err = get_authorized_manager_context()
    if err:
        return err

    data = request.get_json() or {}
    title = (data.get('title') or '').strip()
    if not title:
        return jsonify({"success": False, "message": "Goal title is required."}), 400

    try:
        target_metric = float(data.get('target_metric', 100.0))
        current_metric = float(data.get('current_metric', 0.0))
    except Exception:
        return jsonify({"success": False, "message": "Metrics must be valid numeric values."}), 400

    goal = TeamGoal(
        manager_id=mgr_emp.id,
        title=title,
        description=data.get('description', ''),
        target_metric=target_metric,
        current_metric=current_metric,
        metric_unit=data.get('metric_unit', '%'),
        target_date=data.get('target_date'),
        status=data.get('status', 'On Track')
    )

    try:
        db.session.add(goal)
        db.session.commit()
        return jsonify({
            "success": True,
            "message": f"Goal '{title}' created successfully.",
            "data": goal.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": f"Failed to create goal: {str(e)}"}), 500


@manager_bp.route('/goals/<int:goal_id>', methods=['PUT'])
def update_team_goal(goal_id):
    user, mgr_emp, is_hr, err = get_authorized_manager_context()
    if err:
        return err

    goal = TeamGoal.query.get(goal_id)
    if not goal or (not is_hr and goal.manager_id != mgr_emp.id):
        return jsonify({"success": False, "message": "Goal not found or access forbidden."}), 404

    data = request.get_json() or {}

    try:
        if 'title' in data and data['title'].strip():
            goal.title = data['title'].strip()
        if 'description' in data:
            goal.description = data['description']
        if 'target_metric' in data:
            goal.target_metric = float(data['target_metric'])
        if 'current_metric' in data:
            goal.current_metric = float(data['current_metric'])
        if 'metric_unit' in data:
            goal.metric_unit = str(data['metric_unit'])
        if 'target_date' in data:
            goal.target_date = data['target_date']
        if 'status' in data and data['status'] in ['On Track', 'At Risk', 'Completed', 'Overdue']:
            goal.status = data['status']

        goal.updated_at = datetime.utcnow()
        db.session.commit()

        return jsonify({
            "success": True,
            "message": f"Goal '{goal.title}' updated successfully.",
            "data": goal.to_dict()
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": f"Failed to update goal: {str(e)}"}), 500


@manager_bp.route('/goals/<int:goal_id>', methods=['DELETE'])
def delete_team_goal(goal_id):
    user, mgr_emp, is_hr, err = get_authorized_manager_context()
    if err:
        return err

    goal = TeamGoal.query.get(goal_id)
    if not goal or (not is_hr and goal.manager_id != mgr_emp.id):
        return jsonify({"success": False, "message": "Goal not found or access forbidden."}), 404

    try:
        db.session.delete(goal)
        db.session.commit()
        return jsonify({"success": True, "message": "Goal deleted successfully."}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": f"Failed to delete goal: {str(e)}"}), 500


# ============================================================================
# 5. DYNAMIC ISSUES & BLOCKERS
# ============================================================================

@manager_bp.route('/issues', methods=['GET'])
def get_team_issues():
    user, mgr_emp, is_hr, err = get_authorized_manager_context()
    if err:
        return err

    issues = TeamIssue.query.filter_by(manager_id=mgr_emp.id).order_by(TeamIssue.created_at.desc()).all()
    return jsonify({"success": True, "data": [i.to_dict() for i in issues]}), 200


@manager_bp.route('/issues', methods=['POST'])
def create_team_issue():
    user, mgr_emp, is_hr, err = get_authorized_manager_context()
    if err:
        return err

    data = request.get_json() or {}
    title = (data.get('title') or '').strip()
    if not title:
        return jsonify({"success": False, "message": "Issue title is required."}), 400

    emp_id = data.get('employee_id')
    if emp_id:
        emp, emp_err = verify_direct_report(mgr_emp, int(emp_id), is_hr)
        if emp_err:
            return emp_err
        emp_id = emp.id

    severity = data.get('severity', 'Medium')
    if severity not in ['Low', 'Medium', 'High', 'Critical']:
        severity = 'Medium'

    issue = TeamIssue(
        manager_id=mgr_emp.id,
        employee_id=emp_id,
        title=title,
        description=data.get('description', ''),
        severity=severity,
        status=data.get('status', 'Open')
    )

    try:
        db.session.add(issue)
        db.session.commit()
        return jsonify({
            "success": True,
            "message": f"Issue '{title}' logged successfully.",
            "data": issue.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": f"Failed to log issue: {str(e)}"}), 500


@manager_bp.route('/issues/<int:issue_id>', methods=['PUT'])
def update_team_issue(issue_id):
    user, mgr_emp, is_hr, err = get_authorized_manager_context()
    if err:
        return err

    issue = TeamIssue.query.get(issue_id)
    if not issue or (not is_hr and issue.manager_id != mgr_emp.id):
        return jsonify({"success": False, "message": "Issue not found or access forbidden."}), 404

    data = request.get_json() or {}

    try:
        if 'title' in data and data['title'].strip():
            issue.title = data['title'].strip()
        if 'description' in data:
            issue.description = data['description']
        if 'severity' in data and data['severity'] in ['Low', 'Medium', 'High', 'Critical']:
            issue.severity = data['severity']
        if 'resolution_notes' in data:
            issue.resolution_notes = data['resolution_notes']

        if 'status' in data:
            new_st = data['status']
            if new_st in ['Open', 'Investigating', 'Resolved']:
                issue.status = new_st
                if new_st == 'Resolved' and not issue.resolved_at:
                    issue.resolved_at = datetime.utcnow()
                elif new_st != 'Resolved':
                    issue.resolved_at = None

        issue.updated_at = datetime.utcnow()
        db.session.commit()

        return jsonify({
            "success": True,
            "message": f"Issue '{issue.title}' updated successfully.",
            "data": issue.to_dict()
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": f"Failed to update issue: {str(e)}"}), 500


@manager_bp.route('/issues/<int:issue_id>', methods=['DELETE'])
def delete_team_issue(issue_id):
    user, mgr_emp, is_hr, err = get_authorized_manager_context()
    if err:
        return err

    issue = TeamIssue.query.get(issue_id)
    if not issue or (not is_hr and issue.manager_id != mgr_emp.id):
        return jsonify({"success": False, "message": "Issue not found or access forbidden."}), 404

    try:
        db.session.delete(issue)
        db.session.commit()
        return jsonify({"success": True, "message": "Issue deleted successfully."}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": f"Failed to delete issue: {str(e)}"}), 500


# ============================================================================
# 6. DYNAMIC FEEDBACK & DEVELOPMENT
# ============================================================================

@manager_bp.route('/feedback', methods=['GET'])
def get_team_feedback():
    user, mgr_emp, is_hr, err = get_authorized_manager_context()
    if err:
        return err

    query = ManagerFeedback.query.filter_by(manager_id=mgr_emp.id)

    emp_id = request.args.get('employee_id', type=int)
    if emp_id:
        emp, emp_err = verify_direct_report(mgr_emp, emp_id, is_hr)
        if emp_err:
            return emp_err
        query = query.filter_by(employee_id=emp.id)

    feedbacks = query.order_by(ManagerFeedback.created_at.desc()).all()
    return jsonify({"success": True, "data": [f.to_dict() for f in feedbacks]}), 200


@manager_bp.route('/feedback', methods=['POST'])
def record_team_feedback():
    user, mgr_emp, is_hr, err = get_authorized_manager_context()
    if err:
        return err

    data = request.get_json() or {}
    employee_id = data.get('employee_id')
    if not employee_id:
        return jsonify({"success": False, "message": "Employee ID is required."}), 400

    emp, emp_err = verify_direct_report(mgr_emp, int(employee_id), is_hr)
    if emp_err:
        return emp_err

    fb = ManagerFeedback(
        manager_id=mgr_emp.id,
        employee_id=emp.id,
        feedback_date=data.get('feedback_date') or date.today().isoformat(),
        strengths=data.get('strengths', ''),
        improvement_areas=data.get('improvement_areas', ''),
        development_plan=data.get('development_plan', ''),
        follow_up_status=data.get('follow_up_status', 'Scheduled'),
        is_private=bool(data.get('is_private', True))
    )

    try:
        db.session.add(fb)
        db.session.commit()
        return jsonify({
            "success": True,
            "message": f"Feedback recorded for {emp.name}.",
            "data": fb.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": f"Failed to record feedback: {str(e)}"}), 500


# ============================================================================
# 7. DYNAMIC LEADERSHIP RECOMMENDATIONS (SUBMIT TO HR WITH 5-FACTOR EVIDENCE)
# ============================================================================

@manager_bp.route('/recommendations', methods=['GET'])
def get_recommendations():
    user, mgr_emp, is_hr, err = get_authorized_manager_context()
    if err:
        return err

    if is_hr:
        # HR sees all recommendations
        recs = ManagerRecommendation.query.order_by(ManagerRecommendation.created_at.desc()).all()
    else:
        # Manager sees recommendations they authored
        recs = ManagerRecommendation.query.filter_by(manager_id=mgr_emp.id).order_by(ManagerRecommendation.created_at.desc()).all()

    return jsonify({"success": True, "data": [r.to_dict() for r in recs]}), 200


@manager_bp.route('/recommendations', methods=['POST'])
def submit_recommendation():
    user, mgr_emp, is_hr, err = get_authorized_manager_context()
    if err:
        return err

    data = request.get_json() or {}
    employee_id = data.get('employee_id')
    role_id = data.get('role_id')

    if not employee_id or not role_id:
        return jsonify({"success": False, "message": "Employee ID and Target Role ID are required."}), 400

    emp, emp_err = verify_direct_report(mgr_emp, int(employee_id), is_hr)
    if emp_err:
        return emp_err

    role = LeadershipRole.query.get(int(role_id))
    if not role:
        return jsonify({"success": False, "message": "Target Leadership Role not found."}), 404

    # Calculate real 5-factor suitability from actual database records
    suitability_result = evaluate_leadership_suitability(emp.id, role.id)
    suit_score = suitability_result.get("suitability_score") if suitability_result else None
    readiness_level = suitability_result.get("readiness_level", "Low") if suitability_result else "Low"

    rec = ManagerRecommendation(
        manager_id=mgr_emp.id,
        employee_id=emp.id,
        role_id=role.id,
        suitability_score=suit_score,
        readiness_level=readiness_level,
        strengths_summary=data.get('strengths_summary', ''),
        development_needs=data.get('development_needs', ''),
        recommendation_notes=data.get('recommendation_notes', ''),
        status='Submitted'
    )

    try:
        db.session.add(rec)
        db.session.commit()
        return jsonify({
            "success": True,
            "message": f"Succession recommendation for {emp.name} as '{role.role_name}' submitted to HR for review.",
            "data": rec.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": f"Failed to submit recommendation: {str(e)}"}), 500


@manager_bp.route('/recommendations/<int:rec_id>/review', methods=['PUT'])
def review_recommendation_hr(rec_id):
    """
    HR endpoint: Review manager succession recommendation, separate from final decision.
    """
    user, current_emp, err_msg, status = get_current_user()
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    if user.role.lower() not in ['hr', 'admin']:
        return jsonify({"success": False, "message": "Access forbidden: Only HR can review recommendations."}), 403

    rec = ManagerRecommendation.query.get(rec_id)
    if not rec:
        return jsonify({"success": False, "message": "Recommendation not found."}), 404

    data = request.get_json() or {}
    new_status = data.get('status')
    if new_status not in ['Under Review', 'Approved', 'Declined']:
        return jsonify({"success": False, "message": "Valid status required: 'Under Review', 'Approved', 'Declined'."}), 400

    try:
        rec.status = new_status
        rec.hr_feedback = data.get('hr_feedback', rec.hr_feedback)
        rec.reviewed_by = user.id
        rec.reviewed_at = datetime.utcnow()
        rec.updated_at = datetime.utcnow()
        db.session.commit()

        return jsonify({
            "success": True,
            "message": f"Recommendation marked as '{new_status}' with HR feedback.",
            "data": rec.to_dict()
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": f"Failed to update recommendation: {str(e)}"}), 500


# ============================================================================
# 8. PERFORMANCE REVIEWS
# ============================================================================

@manager_bp.route('/performance-reviews', methods=['POST'])
def record_performance_review():
    user, mgr_emp, is_hr, err = get_authorized_manager_context()
    if err:
        return err

    data = request.get_json() or {}
    emp_id = data.get('employee_id')
    rating = data.get('rating')

    if not emp_id or rating is None:
        return jsonify({"success": False, "message": "Employee ID and rating are required."}), 400

    emp, emp_err = verify_direct_report(mgr_emp, int(emp_id), is_hr)
    if emp_err:
        return emp_err

    try:
        rating_val = float(rating)
        if not (0.0 <= rating_val <= 100.0):
            return jsonify({"success": False, "message": "Rating must be between 0 and 100."}), 400
    except Exception:
        return jsonify({"success": False, "message": "Rating must be a valid number."}), 400

    rev = PerformanceReview(
        manager_id=mgr_emp.id,
        employee_id=emp.id,
        rating=rating_val,
        review_period=data.get('review_period', 'Q3 2026'),
        review_notes=data.get('review_notes', ''),
        review_date=data.get('review_date') or date.today().isoformat()
    )

    try:
        # Also update employee's performance_score to reflect the verified review
        emp.performance_score = rating_val
        emp.updated_at = datetime.utcnow()
        db.session.add(rev)
        db.session.commit()

        return jsonify({
            "success": True,
            "message": f"Performance review for {emp.name} recorded ({rating_val}/100).",
            "data": rev.to_dict()
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": f"Failed to record performance review: {str(e)}"}), 500
