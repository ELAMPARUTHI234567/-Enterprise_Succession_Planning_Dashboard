from flask import Blueprint, request, jsonify
from extensions import db
from models.role import LeadershipRole
from models.role_competency import RoleCompetency
from models.competency import Competency
from models.role_required_skill import RoleRequiredSkill
from models.employee import Employee
from models.suitability_config import SuitabilityConfig
from services.suitability_service import compare_candidates_for_role, evaluate_leadership_suitability
from services.eligibility_service import (
    get_role_eligibility_config,
    update_role_eligibility_config,
    get_pre_assessment_candidates_for_role,
    evaluate_pre_assessment_eligibility
)
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

@roles_bp.route('/roles/<int:role_id>/eligibility-config', methods=['GET'])
def get_role_eligibility(role_id):
    user, employee, err_msg, status = require_role('HR', 'Manager', 'Admin')
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    config = get_role_eligibility_config(role_id)
    if not config:
        return jsonify({"success": False, "message": "Leadership role not found"}), 404

    cfg_dict = config.to_dict()
    return jsonify({"success": True, "data": {"config": cfg_dict, **cfg_dict}}), 200

@roles_bp.route('/roles/<int:role_id>/eligibility-config', methods=['PUT'])
def update_role_eligibility(role_id):
    user, _, err_msg, status = require_role('HR', 'Admin')
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    data = request.get_json() or {}
    config, err, code = update_role_eligibility_config(role_id, data, user_id=user.id)
    if err:
        return jsonify({"success": False, "message": err}), code

    cfg_dict = config.to_dict()
    return jsonify({
        "success": True,
        "data": {"config": cfg_dict, **cfg_dict},
        "message": "Role-specific pre-assessment eligibility thresholds updated successfully."
    }), 200

@roles_bp.route('/roles/<int:role_id>/pre-assessment-candidates', methods=['GET'])
def get_role_pre_assessment_candidates(role_id):
    user, employee, err_msg, status = require_role('HR', 'Manager', 'Admin')
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    candidates_data = get_pre_assessment_candidates_for_role(
        role_id, current_user=user, current_employee=employee
    )
    if not candidates_data:
        return jsonify({"success": False, "message": "Leadership role not found"}), 404

    return jsonify({"success": True, "data": candidates_data}), 200

@roles_bp.route('/roles/<int:role_id>/candidates-comparison', methods=['GET'])
def get_candidates_comparison(role_id):
    user, employee, err_msg, status = require_role('HR', 'Manager', 'Admin')
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    sort_by = request.args.get('sort_by', 'suitability_score')
    min_coverage = float(request.args.get('min_coverage', 0.0))
    meets_readiness_param = request.args.get('meets_readiness', 'false').lower() in ['true', '1', 'yes']

    result = compare_candidates_for_role(
        role_id, 
        sort_by=sort_by, 
        min_coverage=min_coverage,
        current_user=user,
        current_employee=employee,
        meets_readiness=meets_readiness_param
    )
    if not result:
        return jsonify({"success": False, "message": "Role not found"}), 404

    return jsonify({"success": True, "data": result}), 200

@roles_bp.route('/roles/<int:role_id>/candidates/<int:employee_id>/dossier', methods=['GET'])
def get_candidate_dossier(role_id, employee_id):
    user, employee, err_msg, status = require_role('HR', 'Manager', 'Admin')
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    # Enforce RBAC data isolation
    if user.role.lower() == 'manager' and employee:
        emp_obj = Employee.query.get(employee_id)
        if not emp_obj or (emp_obj.manager_id != employee.id and emp_obj.id != employee.id):
            return jsonify({"success": False, "message": "Access forbidden: Managers can only view direct reports"}), 403
    elif user.role.lower() == 'employee' and employee:
        if employee.id != employee_id:
            return jsonify({"success": False, "message": "Access forbidden: Employees can only view their own dossier"}), 403

    dossier = evaluate_leadership_suitability(employee_id, role_id)
    if not dossier:
        return jsonify({"success": False, "message": "Candidate or role not found"}), 404

    return jsonify({"success": True, "data": dossier}), 200

@roles_bp.route('/roles/<int:role_id>/assessment-scores', methods=['GET'])
@roles_bp.route('/roles/<int:role_id>/assessment-summary', methods=['GET'])
def get_role_assessment_scores(role_id):
    user, employee, err_msg, status = require_role('HR', 'Manager', 'Admin')
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    comparison = compare_candidates_for_role(role_id, sort_by='assessment_score', current_user=user, current_employee=employee)
    if not comparison:
        return jsonify({"success": False, "message": "Leadership role not found"}), 404

    summary = {
        "role_id": comparison["role_id"],
        "role_name": comparison["role_name"],
        "highest_assessment_scorer": comparison.get("highest_assessment_scorer"),
        "candidates": [
            {
                "employee_id": c["employee_id"],
                "employee_name": c["employee_name"],
                "employee_code": c["employee_code"],
                "email": c["email"],
                "department": c["department"],
                "designation": c["designation"],
                "assessment_score": c["assessment_score"],
                "assessment_marks": c["assessment_marks"],
                "assessment_max_marks": c["assessment_max_marks"],
                "assessment_name": c["assessment_name"],
                "assessment_status": c["assessment_status"],
                "completed_assessments_count": c["completed_assessments_count"],
                "assessment_rank": c["assessment_rank"],
                "is_highest_assessment_scorer": c.get("is_highest_assessment_scorer", False),
                "attempts": c.get("criteria_scores", {}).get("assessments", {}).get("attempts", [])
            }
            for c in comparison["candidates"]
        ]
    }
    return jsonify({"success": True, "data": summary}), 200

@roles_bp.route('/roles/<int:role_id>/projects-summary', methods=['GET'])
def get_role_projects_summary(role_id):
    user, employee, err_msg, status = require_role('HR', 'Manager', 'Admin')
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    comparison = compare_candidates_for_role(role_id, sort_by='projects', current_user=user, current_employee=employee)
    if not comparison:
        return jsonify({"success": False, "message": "Leadership role not found"}), 404

    summary = {
        "role_id": comparison["role_id"],
        "role_name": comparison["role_name"],
        "highest_project_performer": comparison.get("highest_project_performer"),
        "candidates": [
            {
                "employee_id": c["employee_id"],
                "employee_name": c["employee_name"],
                "employee_code": c["employee_code"],
                "department": c["department"],
                "designation": c["designation"],
                "project_score": c["project_score"],
                "has_verified_projects": c["has_verified_projects"],
                "is_highest_project_performer": c.get("is_highest_project_performer", False),
                "project_summary": c.get("project_summary", {})
            }
            for c in comparison["candidates"]
        ]
    }
    return jsonify({"success": True, "data": summary}), 200

@roles_bp.route('/roles/<int:role_id>/skills-summary', methods=['GET'])
def get_role_skills_summary(role_id):
    user, employee, err_msg, status = require_role('HR', 'Manager', 'Admin')
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    comparison = compare_candidates_for_role(role_id, sort_by='skills', current_user=user, current_employee=employee)
    if not comparison:
        return jsonify({"success": False, "message": "Leadership role not found"}), 404

    summary = {
        "role_id": comparison["role_id"],
        "role_name": comparison["role_name"],
        "best_skill_matcher": comparison.get("best_skill_matcher"),
        "candidates": [
            {
                "employee_id": c["employee_id"],
                "employee_name": c["employee_name"],
                "employee_code": c["employee_code"],
                "department": c["department"],
                "designation": c["designation"],
                "skill_score": c["skill_score"],
                "is_best_skill_matcher": c.get("is_best_skill_matcher", False),
                "missing_mandatory": c.get("missing_mandatory", []),
                "is_mandatory_eligible": c.get("is_mandatory_eligible", True),
                "skill_details": c.get("skill_details", {})
            }
            for c in comparison["candidates"]
        ]
    }
    return jsonify({"success": True, "data": summary}), 200

@roles_bp.route('/roles/<int:role_id>/experience-summary', methods=['GET'])
def get_role_experience_summary(role_id):
    user, employee, err_msg, status = require_role('HR', 'Manager', 'Admin')
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    comparison = compare_candidates_for_role(role_id, sort_by='experience', current_user=user, current_employee=employee)
    if not comparison:
        return jsonify({"success": False, "message": "Leadership role not found"}), 404

    summary = {
        "role_id": comparison["role_id"],
        "role_name": comparison["role_name"],
        "candidates": [
            {
                "employee_id": c["employee_id"],
                "employee_name": c["employee_name"],
                "employee_code": c["employee_code"],
                "department": c["department"],
                "designation": c["designation"],
                "experience_score": c["experience_score"],
                "experience_summary": c.get("experience_summary", {})
            }
            for c in comparison["candidates"]
        ]
    }
    return jsonify({"success": True, "data": summary}), 200


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


