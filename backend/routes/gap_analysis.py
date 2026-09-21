from flask import Blueprint, jsonify
from services.gap_service import calculate_competency_gaps
from services.readiness_service import calculate_successor_readiness

gap_analysis_bp = Blueprint('gap_analysis', __name__)

@gap_analysis_bp.route('/gap-analysis/<int:employee_id>/<int:role_id>', methods=['GET'])
def get_gap_analysis(employee_id, role_id):
    result = calculate_competency_gaps(employee_id, role_id)
    if not result:
        return jsonify({"success": False, "message": "Employee or Role not found"}), 404

    return jsonify({"success": True, "data": result}), 200

@gap_analysis_bp.route('/readiness/<int:employee_id>/<int:role_id>', methods=['GET'])
def get_readiness_analysis(employee_id, role_id):
    result = calculate_successor_readiness(employee_id, role_id)
    if not result:
        return jsonify({"success": False, "message": "Employee or Role not found"}), 404

    return jsonify({"success": True, "data": result}), 200
