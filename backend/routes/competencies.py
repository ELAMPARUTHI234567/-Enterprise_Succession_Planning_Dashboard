from flask import Blueprint, request, jsonify
from extensions import db
from models.competency import Competency

competencies_bp = Blueprint('competencies', __name__)

@competencies_bp.route('/competencies', methods=['GET'])
def get_competencies():
    comps = Competency.query.order_by(Competency.id.asc()).all()
    return jsonify({"success": True, "data": [c.to_dict() for c in comps]}), 200

@competencies_bp.route('/competencies/<int:comp_id>', methods=['GET'])
def get_competency_detail(comp_id):
    comp = Competency.query.get(comp_id)
    if not comp:
        return jsonify({"success": False, "message": "Competency not found"}), 404
    return jsonify({"success": True, "data": comp.to_dict()}), 200

@competencies_bp.route('/competencies', methods=['POST'])
def create_competency():
    data = request.get_json() or {}
    name = data.get('name', '').strip()
    description = data.get('description', '').strip()

    if not name:
        return jsonify({"success": False, "message": "Competency name is required"}), 400

    if Competency.query.filter_by(name=name).first():
        return jsonify({"success": False, "message": "A competency with this name already exists"}), 409

    new_comp = Competency(name=name, description=description)
    db.session.add(new_comp)
    db.session.commit()

    return jsonify({"success": True, "data": new_comp.to_dict(), "message": "Competency created successfully"}), 201

@competencies_bp.route('/competencies/<int:comp_id>', methods=['PUT'])
def update_competency(comp_id):
    comp = Competency.query.get(comp_id)
    if not comp:
        return jsonify({"success": False, "message": "Competency not found"}), 404

    data = request.get_json() or {}
    if 'name' in data: comp.name = data['name'].strip()
    if 'description' in data: comp.description = data['description'].strip()

    db.session.commit()

    return jsonify({"success": True, "data": comp.to_dict(), "message": "Competency updated successfully"}), 200

@competencies_bp.route('/competencies/<int:comp_id>', methods=['DELETE'])
def delete_competency(comp_id):
    comp = Competency.query.get(comp_id)
    if not comp:
        return jsonify({"success": False, "message": "Competency not found"}), 404

    db.session.delete(comp)
    db.session.commit()

    return jsonify({"success": True, "message": "Competency deleted successfully"}), 200
