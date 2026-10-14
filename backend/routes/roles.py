from flask import Blueprint, request, jsonify
from extensions import db
from models.role import LeadershipRole
from models.role_competency import RoleCompetency
from models.competency import Competency
from models.role_required_skill import RoleRequiredSkill
from models.suitability_config import SuitabilityConfig
from services.suitability_service import compare_candidates_for_role
from utils.auth_middleware import get_current_user, require_role

roles_bp = Blueprint('roles', __name__)

@roles_bp.route('/roles', methods=['GET'])
def get_roles():
    roles = LeadershipRole.query.order_by(LeadershipRole.id.asc()).all()
    
    # Bulk load all RoleCompetency records with eager-loaded Competency relation to avoid N+1 queries
    all_reqs = RoleCompetency.query.options(db.joinedload(RoleCompetency.competency)).all()
    reqs_by_role = {}
    for req in all_reqs:
        reqs_by_role.setdefault(req.role_id, []).append(req)

    # Bulk load all RoleRequiredSkill records
    all_skills = RoleRequiredSkill.query.all()
    skills_by_role = {}
    for sk in all_skills:
        skills_by_role.setdefault(sk.role_id, []).append(sk)

    result = []
    for r in roles:
        rd = r.to_dict()
        reqs = reqs_by_role.get(r.id, [])
        skills = skills_by_role.get(r.id, [])
        rd["required_competencies"] = [req.to_dict() for req in reqs]
        rd["required_skills"] = [sk.to_dict() for sk in skills]
        result.append(rd)

    return jsonify({"success": True, "data": result}), 200

@roles_bp.route('/roles/<int:role_id>', methods=['GET'])
def get_role_detail(role_id):
    role = LeadershipRole.query.get(role_id)
    if not role:
        return jsonify({"success": False, "message": "Role not found"}), 404

    rd = role.to_dict()
    reqs = RoleCompetency.query.filter_by(role_id=role_id).all()
    skills = RoleRequiredSkill.query.filter_by(role_id=role_id).all()
    rd["required_competencies"] = [req.to_dict() for req in reqs]
    rd["required_skills"] = [sk.to_dict() for sk in skills]

    return jsonify({"success": True, "data": rd}), 200

@roles_bp.route('/roles', methods=['POST'])
def create_role():
    user, _, err_msg, status = require_role('HR', 'Admin')
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

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
    user, _, err_msg, status = require_role('HR', 'Admin')
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

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
    user, _, err_msg, status = require_role('HR', 'Admin')
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

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
    user, _, err_msg, status = require_role('HR', 'Admin')
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

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

# ==========================================
# MODULE 3: ROLE REQUIRED SKILLS
# ==========================================

@roles_bp.route('/roles/<int:role_id>/required-skills', methods=['GET'])
def get_role_required_skills(role_id):
    role = LeadershipRole.query.get(role_id)
    if not role:
        return jsonify({"success": False, "message": "Role not found"}), 404

    skills = RoleRequiredSkill.query.filter_by(role_id=role_id).all()
    return jsonify({"success": True, "data": [s.to_dict() for s in skills]}), 200

@roles_bp.route('/roles/<int:role_id>/required-skills', methods=['POST'])
def add_role_required_skill(role_id):
    user, _, err_msg, status = require_role('HR', 'Admin')
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    role = LeadershipRole.query.get(role_id)
    if not role:
        return jsonify({"success": False, "message": "Role not found"}), 404

    data = request.get_json() or {}
    skill_name = data.get('skill_name', '').strip()
    category = data.get('category', 'Technical').strip()
    level = int(data.get('min_proficiency_level', 3))
    is_mandatory = bool(data.get('is_mandatory', True))
    weight = float(data.get('weight', 1.0))

    if not skill_name:
        return jsonify({"success": False, "message": "Skill name is required"}), 400

    existing = RoleRequiredSkill.query.filter(
        RoleRequiredSkill.role_id == role_id,
        db.func.lower(RoleRequiredSkill.skill_name) == skill_name.lower()
    ).first()

    if existing:
        existing.min_proficiency_level = max(1, min(5, level))
        existing.category = category
        existing.is_mandatory = is_mandatory
        existing.weight = weight
        db.session.commit()
        return jsonify({"success": True, "data": existing.to_dict(), "message": f"Updated required proficiency for {skill_name}"}), 200

    new_skill = RoleRequiredSkill(
        role_id=role_id,
        skill_name=skill_name,
        category=category,
        min_proficiency_level=max(1, min(5, level)),
        is_mandatory=is_mandatory,
        weight=weight
    )
    db.session.add(new_skill)
    db.session.commit()

    return jsonify({"success": True, "data": new_skill.to_dict(), "message": f"Added {skill_name} requirement to role"}), 201

@roles_bp.route('/roles/<int:role_id>/required-skills/<int:skill_id>', methods=['DELETE'])
def delete_role_required_skill(role_id, skill_id):
    user, _, err_msg, status = require_role('HR', 'Admin')
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    skill = RoleRequiredSkill.query.filter_by(id=skill_id, role_id=role_id).first()
    if not skill:
        return jsonify({"success": False, "message": "Skill requirement not found"}), 404

    db.session.delete(skill)
    db.session.commit()
    return jsonify({"success": True, "message": "Role skill requirement removed"}), 200

# ==========================================================
# MODULE 4: HR CANDIDATE COMPARISON & SUITABILITY SCORING
# ==========================================================

@roles_bp.route('/roles/<int:role_id>/candidates-comparison', methods=['GET'])
def get_candidates_comparison(role_id):
    user, _, err_msg, status = require_role('HR', 'Manager', 'Admin')
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    sort_by = request.args.get('sort_by', 'suitability_score')
    min_coverage = float(request.args.get('min_coverage', 0.0))

    result = compare_candidates_for_role(role_id, sort_by=sort_by, min_coverage=min_coverage)
    if not result:
        return jsonify({"success": False, "message": "Role not found"}), 404

    return jsonify({"success": True, "data": result}), 200

@roles_bp.route('/suitability-config', methods=['GET'])
def get_suitability_config():
    config = SuitabilityConfig.get_active_config()
    return jsonify({"success": True, "data": config.to_dict()}), 200

@roles_bp.route('/suitability-config', methods=['PUT'])
def update_suitability_config():
    user, _, err_msg, status = require_role('HR', 'Admin')
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    data = request.get_json() or {}
    w_assess = float(data.get('assessment_weight', 30.0))
    w_read = float(data.get('readiness_weight', 25.0))
    w_skills = float(data.get('skills_weight', 20.0))
    w_proj = float(data.get('projects_weight', 15.0))
    w_exp = float(data.get('experience_weight', 10.0))

    total = w_assess + w_read + w_skills + w_proj + w_exp
    if abs(total - 100.0) > 0.01:
        return jsonify({
            "success": False,
            "message": f"Weights must sum exactly to 100%. Current sum: {total:.1f}%."
        }), 400

    config = SuitabilityConfig.get_active_config()
    config.assessment_weight = w_assess
    config.readiness_weight = w_read
    config.skills_weight = w_skills
    config.projects_weight = w_proj
    config.experience_weight = w_exp
    config.updated_by = user.id

    db.session.commit()
    return jsonify({"success": True, "data": config.to_dict(), "message": "Suitability evaluation weights updated successfully"}), 200
