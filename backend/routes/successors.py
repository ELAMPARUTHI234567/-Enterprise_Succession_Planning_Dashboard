from flask import Blueprint, jsonify
from services.readiness_service import get_ranked_successors_for_role

successors_bp = Blueprint('successors', __name__)

@successors_bp.route('/successors/<int:role_id>', methods=['GET'])
def get_successors(role_id):
    result = get_ranked_successors_for_role(role_id)
    if not result:
        return jsonify({"success": False, "message": "Leadership role not found"}), 404

    return jsonify({"success": True, "data": result}), 200
