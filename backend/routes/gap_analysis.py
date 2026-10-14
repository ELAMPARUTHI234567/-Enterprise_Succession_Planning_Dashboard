from flask import Blueprint, jsonify
from services.gap_service import calculate_competency_gaps
from services.readiness_service import calculate_successor_readiness
from utils.auth_middleware import get_current_user
from models.employee import Employee

gap_analysis_bp = Blueprint('gap_analysis', __name__)

@gap_analysis_bp.route('/gap-analysis/<int:employee_id>/<int:role_id>', methods=['GET'])
def get_gap_analysis(employee_id, role_id):
    user, current_emp, err_msg, _ = get_current_user()
    if user:
        role_lower = user.role.lower()
        if role_lower not in ['hr', 'admin']:
            if role_lower == 'manager':
                target = Employee.query.get(employee_id)
                if not current_emp or (current_emp.id != employee_id and (not target or target.manager_id != current_emp.id)):
                    return jsonify({"success": False, "message": "Access forbidden: Managers can only view their direct reports"}), 403
            else:  # Employee
                if not current_emp or current_emp.id != employee_id:
                    return jsonify({"success": False, "message": "Access forbidden: Employees can only view their own gap analysis"}), 403

    result = calculate_competency_gaps(employee_id, role_id)
    if not result:
        return jsonify({"success": False, "message": "Employee or Role not found"}), 404

    return jsonify({"success": True, "data": result}), 200

@gap_analysis_bp.route('/readiness/<int:employee_id>/<int:role_id>', methods=['GET'])
def get_readiness_analysis(employee_id, role_id):
    user, current_emp, err_msg, _ = get_current_user()
    if user:
        role_lower = user.role.lower()
        if role_lower not in ['hr', 'admin']:
            if role_lower == 'manager':
                target = Employee.query.get(employee_id)
                if not current_emp or (current_emp.id != employee_id and (not target or target.manager_id != current_emp.id)):
                    return jsonify({"success": False, "message": "Access forbidden: Managers can only view their direct reports"}), 403
            else:  # Employee
                if not current_emp or current_emp.id != employee_id:
                    return jsonify({"success": False, "message": "Access forbidden: Employees can only view their own readiness analysis"}), 403

    result = calculate_successor_readiness(employee_id, role_id)
    if not result:
        return jsonify({"success": False, "message": "Employee or Role not found"}), 404

    return jsonify({"success": True, "data": result}), 200
