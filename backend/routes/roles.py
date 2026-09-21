from flask import Blueprint, request, jsonify
from extensions import db
from models.role import LeadershipRole
from models.role_competency import RoleCompetency
from models.competency import Competency

roles_bp = Blueprint('roles', __name__)

@roles_bp.route('/roles', methods=['GET'])
def get_roles():
    roles = LeadershipRole.query.order_by(LeadershipRole.id.asc()).all()
    result = []
    for r in roles:
        rd = r.to_dict()
        reqs = RoleCompetency.query.filter_by(role_id=r.id).all()
        rd["required_competencies"] = [req.to_dict() for req in reqs]
        result.append(rd)

    return jsonify({"success": True, "data": result}), 200

@roles_bp.route('/roles/<int:role_id>', methods=['GET'])
def get_role_detail(role_id):
    role = LeadershipRole.query.get(role_id)
    if not role:
        return jsonify({"success": False, "message": "Role not found"}), 404

    rd = role.to_dict()
    reqs = RoleCompetency.query.filter_by(role_id=role_id).all()
    rd["required_competencies"] = [req.to_dict() for req in reqs]

    return jsonify({"success": True, "data": rd}), 200

@roles_bp.route('/roles', methods=['POST'])
def create_role():
    data = request.get_json() or {}
    role_name = data.get('role_name', '').strip()
    department = data.get('department', '').strip()
    description = data.get('description', '').strip()

    if not role_name or not department:
        return jsonify({"success": False, "message": "Role name and department are required"}), 400

    if LeadershipRole.query.filter_by(role_name=role_name).first():
        return jsonify({"success": False, "message": "A leadership role with this name already exists"}), 409

    new_role = LeadershipRole(
        role_name=role_name,
        department=department,
        description=description
    )
    db.session.add(new_role)
    db.session.flush()

    # Default assign default competency requirements (e.g. 85 for all)
    competencies = Competency.query.all()
    for c in competencies:
        db.session.add(RoleCompetency(
            role_id=new_role.id,
            competency_id=c.id,
            required_score=85.0
        ))

    db.session.commit()

    return jsonify({"success": True, "data": new_role.to_dict(), "message": "Leadership role created successfully"}), 201

@roles_bp.route('/roles/<int:role_id>', methods=['PUT'])
def update_role(role_id):
    role = LeadershipRole.query.get(role_id)
    if not role:
        return jsonify({"success": False, "message": "Role not found"}), 404

    data = request.get_json() or {}
    if 'role_name' in data: role.role_name = data['role_name'].strip()
    if 'department' in data: role.department = data['department'].strip()
    if 'description' in data: role.description = data['description'].strip()

    db.session.commit()

    return jsonify({"success": True, "data": role.to_dict(), "message": "Leadership role updated successfully"}), 200

@roles_bp.route('/roles/<int:role_id>', methods=['DELETE'])
def delete_role(role_id):
    role = LeadershipRole.query.get(role_id)
    if not role:
        return jsonify({"success": False, "message": "Role not found"}), 404

    db.session.delete(role)
    db.session.commit()

    return jsonify({"success": True, "message": "Leadership role deleted successfully"}), 200

@roles_bp.route('/roles/<int:role_id>/competencies', methods=['GET'])
def get_role_competencies(role_id):
    reqs = RoleCompetency.query.filter_by(role_id=role_id).all()
    return jsonify({"success": True, "data": [r.to_dict() for r in reqs]}), 200

@roles_bp.route('/roles/<int:role_id>/competencies', methods=['POST'])
def save_role_competencies(role_id):
    role = LeadershipRole.query.get(role_id)
    if not role:
        return jsonify({"success": False, "message": "Role not found"}), 404

    data = request.get_json() or {}
    competencies_list = data.get('competencies', [])

    for item in competencies_list:
        comp_id = item.get('competency_id')
        req_score = float(item.get('required_score', 80.0))

        rc = RoleCompetency.query.filter_by(role_id=role_id, competency_id=comp_id).first()
        if rc:
            rc.required_score = req_score
        else:
            db.session.add(RoleCompetency(role_id=role_id, competency_id=comp_id, required_score=req_score))

    db.session.commit()

    return jsonify({"success": True, "message": "Role competency standards saved successfully"}), 200
