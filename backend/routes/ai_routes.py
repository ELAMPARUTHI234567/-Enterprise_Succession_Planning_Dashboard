from flask import Blueprint, request, jsonify
from utils.auth_middleware import require_role, get_current_user
from services.successor_recommendation import (
    get_top_3_successors,
    compare_candidates_for_role,
    shortlist_candidate_for_role
)
from services.competency_intelligence import get_competency_intelligence
from services.team_intelligence import get_team_intelligence
from services.executive_summary_service import get_hr_workforce_summary
from services.ai_chat_service import handle_ai_chat_query
from models.successor_shortlist import SuccessorShortlist
from models.role import LeadershipRole
from models.employee import Employee
import logging

logger = logging.getLogger(__name__)
ai_bp = Blueprint('ai', __name__)

@ai_bp.route('/ai/top-successors', methods=['GET'])
def top_successors_route():
    """
    GET /api/ai/top-successors?role_id=1
    Identifies the Top 3 eligible successors for HR.
    Strictly verifies active employment, prerequisites, and mandatory role-specific assessment completion.
    """
    user, employee, err_msg, status = require_role('HR', 'Admin', 'Manager')
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    try:
        role_id = int(request.args.get('role_id', 1))
    except (ValueError, TypeError):
        role_id = 1

    result = get_top_3_successors(role_id, current_user=user, current_employee=employee)
    if not result.get("success"):
        return jsonify(result), 404

    return jsonify(result), 200

@ai_bp.route('/ai/manager/top-successors', methods=['GET'])
def manager_top_successors_route():
    """
    GET /api/ai/manager/top-successors?role_id=1
    Identifies Top 3 successors strictly isolated to manager's direct reports.
    """
    user, employee, err_msg, status = require_role('Manager', 'Admin', 'HR')
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    try:
        role_id = int(request.args.get('role_id', 1))
    except (ValueError, TypeError):
        role_id = 1

    mgr_emp_id = employee.id if employee else None
    if not mgr_emp_id and user:
        m = Employee.query.filter_by(user_id=user.id).first()
        if m:
            mgr_emp_id = m.id

    result = get_top_3_successors(role_id, current_user=user, current_employee=employee, manager_id=mgr_emp_id)
    return jsonify(result), 200

@ai_bp.route('/ai/compare-candidates', methods=['POST'])
def compare_candidates_route():
    """
    POST /api/ai/compare-candidates
    Body: { "role_id": 1, "candidate_ids": [1, 2, 3] }
    """
    user, employee, err_msg, status = require_role('HR', 'Admin', 'Manager')
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    data = request.get_json() or {}
    role_id = data.get('role_id', 1)
    candidate_ids = data.get('candidate_ids', [])

    if not candidate_ids:
        return jsonify({"success": False, "message": "candidate_ids array is required"}), 400

    # Manager scoping: candidates must belong to manager's direct reports
    if user.role.lower() == 'manager' and employee:
        valid_reports = set(e.id for e in Employee.query.filter_by(manager_id=employee.id).all())
        valid_reports.add(employee.id)
        for cid in candidate_ids:
            try:
                if int(cid) not in valid_reports:
                    return jsonify({"success": False, "message": "Access forbidden: Managers can only view direct reports."}), 403
            except (ValueError, TypeError):
                return jsonify({"success": False, "message": "Invalid candidate ID format"}), 400

    result = compare_candidates_for_role(role_id, candidate_ids)
    return jsonify(result), 200

@ai_bp.route('/ai/shortlist', methods=['POST'])
def shortlist_candidate_route():
    """
    POST /api/ai/shortlist
    Body: { "employee_id": 1, "role_id": 1, "action": "Shortlist"|"Approve"|"Remove", "notes": "" }
    """
    user, employee, err_msg, status = require_role('HR', 'Admin', 'Manager')
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    data = request.get_json() or {}
    employee_id = data.get('employee_id')
    role_id = data.get('role_id')
    action = data.get('action', 'Shortlist')
    notes = data.get('notes', '')

    if not employee_id or not role_id:
        return jsonify({"success": False, "message": "employee_id and role_id are required"}), 400

    # Manager scoping: candidate must be an authorized direct report
    if user.role.lower() == 'manager' and employee:
        try:
            target_emp_id = int(employee_id)
            target = Employee.query.get(target_emp_id)
            if not target or (target.manager_id != employee.id and target.id != employee.id):
                return jsonify({"success": False, "message": "Access forbidden: Managers can only view direct reports."}), 403
        except (ValueError, TypeError):
            return jsonify({"success": False, "message": "Invalid employee ID format"}), 400

    result = shortlist_candidate_for_role(
        employee_id=employee_id,
        role_id=role_id,
        user_id=user.id if user else None,
        action=action,
        notes=notes
    )
    return jsonify(result), 200 if result.get("success") else 400

@ai_bp.route('/ai/shortlists', methods=['GET'])
def get_shortlists_route():
    """
    GET /api/ai/shortlists?role_id=1
    """
    user, employee, err_msg, status = require_role('HR', 'Admin', 'Manager')
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    role_id = request.args.get('role_id')
    query = SuccessorShortlist.query

    if role_id:
        try:
            query = query.filter_by(role_id=int(role_id))
        except ValueError:
            pass

    # Manager filtering
    if user.role.lower() == 'manager' and employee:
        emp_ids = [e.id for e in Employee.query.filter_by(manager_id=employee.id).all()]
        query = query.filter(SuccessorShortlist.employee_id.in_(emp_ids))

    shortlists = query.order_by(SuccessorShortlist.created_at.desc()).all()
    return jsonify({
        "success": True,
        "count": len(shortlists),
        "data": [s.to_dict() for s in shortlists]
    }), 200

@ai_bp.route('/ai/workforce-summary', methods=['GET'])
def workforce_summary_route():
    """
    GET /api/ai/workforce-summary
    Module 1: HR Executive Workforce & Succession Summary
    """
    user, employee, err_msg, status = require_role('HR', 'Admin', 'Manager')
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    result = get_hr_workforce_summary()
    return jsonify(result), 200

@ai_bp.route('/ai/competency-intelligence', methods=['GET'])
def competency_intelligence_route():
    """
    GET /api/ai/competency-intelligence
    Module 3: Enterprise 8-Dimension Competency Gap Intelligence
    """
    user, employee, err_msg, status = require_role('HR', 'Admin', 'Manager')
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    mgr_id = None
    if user.role.lower() == 'manager':
        mgr_id = employee.id if employee else None
    else:
        mgr_arg = request.args.get('manager_id')
        if mgr_arg:
            try:
                mgr_id = int(mgr_arg)
            except ValueError:
                pass

    department = request.args.get('department')
    result = get_competency_intelligence(manager_id=mgr_id, department=department)
    return jsonify(result), 200

@ai_bp.route('/ai/team-intelligence', methods=['GET'])
def team_intelligence_route():
    """
    GET /api/ai/team-intelligence
    Modules 6 & 7: Manager Portal AI Team Performance, Readiness & Risk Intelligence
    """
    user, employee, err_msg, status = require_role('Manager', 'Admin', 'HR')
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    mgr_emp_id = None
    if user.role.lower() == 'manager':
        mgr_emp_id = employee.id if employee else None
        if not mgr_emp_id and user:
            m = Employee.query.filter_by(user_id=user.id).first()
            if m:
                mgr_emp_id = m.id
    else:
        # HR / Admin can inspect a specific manager
        mgr_arg = request.args.get('manager_id')
        if mgr_arg:
            try:
                mgr_emp_id = int(mgr_arg)
            except ValueError:
                pass
        if not mgr_emp_id and employee:
            mgr_emp_id = employee.id

    if not mgr_emp_id:
        return jsonify({"success": False, "message": "Manager profile not found"}), 404

    result = get_team_intelligence(mgr_emp_id)
    return jsonify(result), 200

@ai_bp.route('/ai/chat', methods=['POST'])
def ai_chat_route():
    """
    POST /api/ai/chat
    Modules 5 & 8: AI Chat Assistant for HR and Managers
    """
    user, employee, _, _ = get_current_user()
    data = request.get_json() or {}
    query = data.get('query', '')

    if not query:
        return jsonify({"success": False, "message": "query is required"}), 400

    result = handle_ai_chat_query(query, user=user, current_employee=employee)
    return jsonify(result), 200

