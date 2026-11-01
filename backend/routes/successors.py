from flask import Blueprint, jsonify, request
from services.suitability_service import compare_candidates_for_role
from utils.auth_middleware import require_role

successors_bp = Blueprint('successors', __name__)

@successors_bp.route('/successors/<int:role_id>', methods=['GET'])
def get_successors(role_id):
    user, employee, err_msg, status = require_role('HR', 'Admin', 'Manager')
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    sort_by = request.args.get('sort_by', 'suitability_score')
    min_coverage = float(request.args.get('min_coverage', 0.0))

    result = compare_candidates_for_role(
        role_id,
        sort_by=sort_by,
        min_coverage=min_coverage,
        current_user=user,
        current_employee=employee
    )
    if not result:
        return jsonify({"success": False, "message": "Leadership role not found"}), 404

    return jsonify({"success": True, "data": result}), 200

