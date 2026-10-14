from flask import Blueprint, request, jsonify
from datetime import datetime
from extensions import db
from models.employee import Employee
from models.employee_competency import EmployeeCompetency
from models.competency import Competency
from models.role import LeadershipRole
from models.role_competency import RoleCompetency
from models.employee_project import EmployeeProject
from models.employment_history import EmploymentHistory
from models.employee_skill import EmployeeSkill
from services.gap_service import calculate_competency_gaps
from services.readiness_service import calculate_successor_readiness
from services.project_service import calculate_project_success_rate, get_employee_projects_summary
from services.experience_service import calculate_employee_experience
from services.skill_service import evaluate_employee_skill_gaps
from services.suitability_service import evaluate_leadership_suitability
from utils.auth_middleware import get_current_user, require_role

employees_bp = Blueprint('employees', __name__)

def check_employee_access(emp_id, allow_manager_direct_report=True, require_write=False):
    """
    Enforces RBAC data isolation:
    Returns (user, current_emp, target_emp, err_msg, status_code)
    """
    user, current_emp, err_msg, status = get_current_user()
    if err_msg:
        return None, None, None, err_msg, status

    target_emp = Employee.query.get(emp_id)
    if not target_emp:
        return None, None, None, "Employee not found", 404

    role_lower = user.role.lower()
    if role_lower in ['hr', 'admin']:
        return user, current_emp, target_emp, None, 200

    if role_lower == 'manager':
        if current_emp and current_emp.id == emp_id:
            return user, current_emp, target_emp, None, 200
        if allow_manager_direct_report and current_emp and target_emp.manager_id == current_emp.id:
            return user, current_emp, target_emp, None, 200
        return None, None, None, "Access forbidden: Managers can only access their direct reports", 403

    # Employee role
    if not current_emp or current_emp.id != emp_id:
        return None, None, None, "Access forbidden: Employees can only view their own profile", 403

    return user, current_emp, target_emp, None, 200

@employees_bp.route('/employees', methods=['GET'])
def get_employees():
    search = request.args.get('search', '').strip()
    department = request.args.get('department', '').strip()
    manager_id = request.args.get('manager_id', type=int)
    availability = request.args.get('availability', '').strip()

    user, current_emp, err_msg, _ = get_current_user()
    query = Employee.query

    # Enforce role-based data isolation
    if user:
        role_lower = user.role.lower()
        if role_lower == 'manager':
            if current_emp:
                manager_id = current_emp.id
        elif role_lower == 'employee':
            if current_emp:
                query = query.filter(Employee.id == current_emp.id)
            else:
                return jsonify({"success": True, "data": []}), 200

    if search:
        query = query.filter(
            (Employee.name.ilike(f"%{search}%")) |
            (Employee.employee_code.ilike(f"%{search}%")) |
            (Employee.designation.ilike(f"%{search}%"))
        )

    if department and department != 'All':
        query = query.filter(Employee.department == department)

    if manager_id:
        query = query.filter(Employee.manager_id == manager_id)

    if availability and availability != 'All':
        query = query.filter(Employee.availability_status == availability)

    employees = query.order_by(Employee.id.asc()).all()
    roles = LeadershipRole.query.all()
    competencies = Competency.query.all()
    default_role = roles[0] if roles else None
    default_role_id = default_role.id if default_role else 1
    role_reqs = RoleCompetency.query.filter_by(role_id=default_role_id).all() if default_role else []

    all_emp_comps = EmployeeCompetency.query.all()
    emp_comp_map = {}
    for ec in all_emp_comps:
        emp_comp_map.setdefault(ec.employee_id, []).append(ec)

    emp_data = []
    for emp in employees:
        d = emp.to_dict()
        e_comps = emp_comp_map.get(emp.id, [])
        readiness_info = calculate_successor_readiness(
            emp.id, default_role_id,
            employee=emp, role=default_role,
            competencies=competencies, role_reqs=role_reqs, emp_scores=e_comps
        )
        d["readiness_score"] = readiness_info["readiness_score"] if readiness_info else 0.0
        d["readiness_level"] = readiness_info["readiness_level"] if readiness_info else "Low"
        emp_data.append(d)

    return jsonify({"success": True, "data": emp_data}), 200

@employees_bp.route('/team/employees', methods=['GET'])
def get_team_employees():
    user, current_emp, err_msg, status = get_current_user()
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    if not current_emp:
        return jsonify({"success": True, "data": []}), 200

    subordinates = Employee.query.filter_by(manager_id=current_emp.id).all()
    return jsonify({
        "success": True,
        "data": [s.to_dict() for s in subordinates]
    }), 200

@employees_bp.route('/employees/<int:emp_id>', methods=['GET'])
def get_employee_detail(emp_id):
    user, current_emp, emp, err_msg, status = check_employee_access(emp_id)
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    emp_dict = emp.to_dict()

    emp_comps = EmployeeCompetency.query.filter_by(employee_id=emp_id).all()
    comp_list = []
    for ec in emp_comps:
        comp_list.append({
            "competency_id": ec.competency_id,
            "competency_name": ec.competency.name if ec.competency else "",
            "score": ec.score
        })
    emp_dict["competencies"] = comp_list

    target_role_id = request.args.get('role_id', 1, type=int)
    gap_data = calculate_competency_gaps(emp_id, target_role_id)
    readiness_data = calculate_successor_readiness(emp_id, target_role_id)

    # Enhanced profile sections
    projects_list = [p.to_dict() for p in emp.projects]
    emp_dict["projects"] = projects_list
    emp_dict["project_summary"] = get_employee_projects_summary(emp_id)

    emp_dict["experience_summary"] = calculate_employee_experience(emp_id)
    emp_dict["employment_history"] = [h.to_dict() for h in emp.employment_history]

    emp_dict["skills"] = [s.to_dict() for s in emp.skills]
    emp_dict["skill_gap_analysis"] = evaluate_employee_skill_gaps(emp_id, target_role_id)

    emp_dict["suitability"] = evaluate_leadership_suitability(emp_id, target_role_id)
    emp_dict["target_role_id"] = target_role_id
    emp_dict["gap_analysis"] = gap_data
    emp_dict["readiness"] = readiness_data

    return jsonify({"success": True, "data": emp_dict}), 200

@employees_bp.route('/employees', methods=['POST'])
def create_employee():
    user, _, err_msg, status = require_role('HR', 'Admin')
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    data = request.get_json() or {}
    code = data.get('employee_code', '').strip()
    name = data.get('name', '').strip()
    email = data.get('email', '').strip()
    department = data.get('department', '').strip()
    designation = data.get('designation', '').strip()
    manager_id = data.get('manager_id')
    experience = float(data.get('experience_years', 0.0))
    performance = float(data.get('performance_score', 0.0))
    leadership = float(data.get('leadership_score', 0.0))
    availability = data.get('availability_status', 'Available').strip()
    joining_date = data.get('company_joining_date', '').strip() or None

    if not name or not email or not code:
        return jsonify({"success": False, "message": "Name, email, and employee code are required"}), 400

    if Employee.query.filter_by(email=email).first():
        return jsonify({"success": False, "message": "An employee with this email already exists"}), 409

    if Employee.query.filter_by(employee_code=code).first():
        return jsonify({"success": False, "message": "An employee with this code already exists"}), 409

    new_emp = Employee(
        employee_code=code,
        name=name,
        email=email,
        department=department,
        designation=designation,
        manager_id=manager_id,
        experience_years=experience,
        performance_score=performance,
        leadership_score=leadership,
        availability_status=availability,
        company_joining_date=joining_date
    )
    db.session.add(new_emp)
    db.session.flush()

    competencies = Competency.query.all()
    for comp in competencies:
        db.session.add(EmployeeCompetency(
            employee_id=new_emp.id,
            competency_id=comp.id,
            score=70.0
        ))

    db.session.commit()
    return jsonify({"success": True, "data": new_emp.to_dict(), "message": "Employee created successfully"}), 201

@employees_bp.route('/employees/<int:emp_id>', methods=['PUT'])
def update_employee(emp_id):
    user, _, err_msg, status = require_role('HR', 'Admin', 'Manager')
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    emp = Employee.query.get(emp_id)
    if not emp:
        return jsonify({"success": False, "message": "Employee not found"}), 404

    data = request.get_json() or {}
    if 'name' in data: emp.name = data['name'].strip()
    if 'email' in data: emp.email = data['email'].strip()
    if 'department' in data: emp.department = data['department'].strip()
    if 'designation' in data: emp.designation = data['designation'].strip()
    if 'manager_id' in data: emp.manager_id = data['manager_id']
    if 'experience_years' in data: emp.experience_years = float(data['experience_years'])
    if 'performance_score' in data: emp.performance_score = float(data['performance_score'])
    if 'leadership_score' in data: emp.leadership_score = float(data['leadership_score'])
    if 'availability_status' in data: emp.availability_status = data['availability_status'].strip()
    if 'company_joining_date' in data: emp.company_joining_date = data['company_joining_date'].strip() or None

    db.session.commit()
    return jsonify({"success": True, "data": emp.to_dict(), "message": "Employee updated successfully"}), 200

@employees_bp.route('/employees/<int:emp_id>', methods=['DELETE'])
def delete_employee(emp_id):
    user, _, err_msg, status = require_role('HR', 'Admin')
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    emp = Employee.query.get(emp_id)
    if not emp:
        return jsonify({"success": False, "message": "Employee not found"}), 404

    db.session.delete(emp)
    db.session.commit()
    return jsonify({"success": True, "message": "Employee deleted successfully"}), 200

# ==========================================
# MODULE 1: PROJECT EXPERIENCE ENDPOINTS
# ==========================================

@employees_bp.route('/employees/<int:emp_id>/projects', methods=['GET'])
def get_employee_projects(emp_id):
    user, current_emp, emp, err_msg, status = check_employee_access(emp_id)
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    summary = get_employee_projects_summary(emp_id)
    return jsonify({"success": True, "data": summary}), 200

@employees_bp.route('/employees/<int:emp_id>/projects', methods=['POST'])
def add_employee_project(emp_id):
    user, current_emp, emp, err_msg, status = check_employee_access(emp_id)
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    data = request.get_json() or {}
    project_name = data.get('project_name', '').strip()
    if not project_name:
        return jsonify({"success": False, "message": "Project name is required"}), 400

    # Calculate success rate from provided indicators (None if no valid metrics)
    success_rate = calculate_project_success_rate(data)

    is_admin_or_hr = user.role.lower() in ['hr', 'admin']
    verification_status = 'HR-Verified' if is_admin_or_hr and data.get('is_verified') else 'Self-Reported'

    new_project = EmployeeProject(
        employee_id=emp_id,
        project_name=project_name,
        description=data.get('description', '').strip(),
        role_responsibilities=data.get('role_responsibilities', '').strip(),
        start_date=data.get('start_date', '').strip(),
        completion_date=data.get('completion_date', '').strip(),
        status=data.get('status', 'In Progress').strip(),
        outcomes_kpis=data.get('outcomes_kpis', '').strip(),
        milestones_completed_pct=float(data['milestones_completed_pct']) if data.get('milestones_completed_pct') is not None and data.get('milestones_completed_pct') != '' else None,
        deliverables_accepted_pct=float(data['deliverables_accepted_pct']) if data.get('deliverables_accepted_pct') is not None and data.get('deliverables_accepted_pct') != '' else None,
        quality_defect_score=float(data['quality_defect_score']) if data.get('quality_defect_score') is not None and data.get('quality_defect_score') != '' else None,
        timeline_adherence_pct=float(data['timeline_adherence_pct']) if data.get('timeline_adherence_pct') is not None and data.get('timeline_adherence_pct') != '' else None,
        business_goals_achieved_pct=float(data['business_goals_achieved_pct']) if data.get('business_goals_achieved_pct') is not None and data.get('business_goals_achieved_pct') != '' else None,
        success_rate=success_rate,
        verification_status=verification_status,
        verified_by=user.id if verification_status != 'Self-Reported' else None,
        verified_at=datetime.utcnow() if verification_status != 'Self-Reported' else None,
        supervisor_feedback=data.get('supervisor_feedback', '').strip(),
        evidence_url=data.get('evidence_url', '').strip()
    )
    new_project.set_technologies(data.get('technologies', []))

    db.session.add(new_project)
    db.session.commit()

    return jsonify({"success": True, "data": new_project.to_dict(), "message": "Project experience added successfully"}), 201

@employees_bp.route('/employees/<int:emp_id>/projects/<int:project_id>', methods=['PUT'])
def update_employee_project(emp_id, project_id):
    user, current_emp, emp, err_msg, status = check_employee_access(emp_id)
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    proj = EmployeeProject.query.filter_by(id=project_id, employee_id=emp_id).first()
    if not proj:
        return jsonify({"success": False, "message": "Project record not found"}), 404

    data = request.get_json() or {}
    if 'project_name' in data: proj.project_name = data['project_name'].strip()
    if 'description' in data: proj.description = data['description'].strip()
    if 'role_responsibilities' in data: proj.role_responsibilities = data['role_responsibilities'].strip()
    if 'start_date' in data: proj.start_date = data['start_date'].strip()
    if 'completion_date' in data: proj.completion_date = data['completion_date'].strip()
    if 'status' in data: proj.status = data['status'].strip()
    if 'outcomes_kpis' in data: proj.outcomes_kpis = data['outcomes_kpis'].strip()
    if 'technologies' in data: proj.set_technologies(data['technologies'])

    for metric in ['milestones_completed_pct', 'deliverables_accepted_pct', 'quality_defect_score', 'timeline_adherence_pct', 'business_goals_achieved_pct']:
        if metric in data:
            val = data[metric]
            setattr(proj, metric, float(val) if val is not None and val != '' else None)

    # Recalculate success rate
    metric_dict = {
        'milestones_completed_pct': proj.milestones_completed_pct,
        'deliverables_accepted_pct': proj.deliverables_accepted_pct,
        'quality_defect_score': proj.quality_defect_score,
        'timeline_adherence_pct': proj.timeline_adherence_pct,
        'business_goals_achieved_pct': proj.business_goals_achieved_pct
    }
    proj.success_rate = calculate_project_success_rate(metric_dict)

    if 'evidence_url' in data: proj.evidence_url = data['evidence_url'].strip()

    db.session.commit()
    return jsonify({"success": True, "data": proj.to_dict(), "message": "Project updated successfully"}), 200

@employees_bp.route('/employees/<int:emp_id>/projects/<int:project_id>', methods=['DELETE'])
def delete_employee_project(emp_id, project_id):
    user, current_emp, emp, err_msg, status = check_employee_access(emp_id)
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    proj = EmployeeProject.query.filter_by(id=project_id, employee_id=emp_id).first()
    if not proj:
        return jsonify({"success": False, "message": "Project record not found"}), 404

    db.session.delete(proj)
    db.session.commit()
    return jsonify({"success": True, "message": "Project record removed successfully"}), 200

@employees_bp.route('/employees/<int:emp_id>/projects/<int:project_id>/verify', methods=['POST'])
def verify_employee_project(emp_id, project_id):
    user, current_emp, err_msg, status = require_role('HR', 'Manager', 'Admin')
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    proj = EmployeeProject.query.filter_by(id=project_id, employee_id=emp_id).first()
    if not proj:
        return jsonify({"success": False, "message": "Project record not found"}), 404

    data = request.get_json() or {}
    status_choice = data.get('status', 'HR-Verified')
    feedback = data.get('supervisor_feedback', '').strip()

    proj.verification_status = status_choice
    proj.verified_by = user.id
    proj.verified_at = datetime.utcnow()
    if feedback:
        proj.supervisor_feedback = feedback

    db.session.commit()
    return jsonify({"success": True, "data": proj.to_dict(), "message": f"Project marked as {status_choice}"}), 200

# ==========================================
# MODULE 2: EMPLOYMENT HISTORY ENDPOINTS
# ==========================================

@employees_bp.route('/employees/<int:emp_id>/employment-history', methods=['GET'])
def get_employment_history(emp_id):
    user, current_emp, emp, err_msg, status = check_employee_access(emp_id)
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    summary = calculate_employee_experience(emp_id)
    return jsonify({"success": True, "data": summary}), 200

@employees_bp.route('/employees/<int:emp_id>/employment-history', methods=['POST'])
def add_employment_history(emp_id):
    user, current_emp, emp, err_msg, status = check_employee_access(emp_id)
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    data = request.get_json() or {}
    company_name = data.get('company_name', '').strip()
    designation = data.get('designation', '').strip()
    start_date = data.get('start_date', '').strip()
    end_date = data.get('end_date', '').strip()

    if not company_name or not designation or not start_date or not end_date:
        return jsonify({"success": False, "message": "Company name, designation, start date, and end date are required"}), 400

    new_hist = EmploymentHistory(
        employee_id=emp_id,
        company_name=company_name,
        designation=designation,
        start_date=start_date,
        end_date=end_date,
        responsibilities=data.get('responsibilities', '').strip(),
        domain=data.get('domain', '').strip(),
        leadership_experience_years=float(data.get('leadership_experience_years', 0.0)),
        is_leadership_role=bool(data.get('is_leadership_role', False)),
        verification_status='HR-Verified' if user.role.lower() in ['hr', 'admin'] and data.get('is_verified') else 'Self-Reported',
        verified_by=user.id if user.role.lower() in ['hr', 'admin'] and data.get('is_verified') else None,
        verified_at=datetime.utcnow() if user.role.lower() in ['hr', 'admin'] and data.get('is_verified') else None
    )

    db.session.add(new_hist)
    db.session.commit()

    return jsonify({"success": True, "data": new_hist.to_dict(), "message": "Employment history record added"}), 201

@employees_bp.route('/employees/<int:emp_id>/employment-history/<int:history_id>', methods=['PUT'])
def update_employment_history(emp_id, history_id):
    user, current_emp, emp, err_msg, status = check_employee_access(emp_id)
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    hist = EmploymentHistory.query.filter_by(id=history_id, employee_id=emp_id).first()
    if not hist:
        return jsonify({"success": False, "message": "Employment history record not found"}), 404

    data = request.get_json() or {}
    if 'company_name' in data: hist.company_name = data['company_name'].strip()
    if 'designation' in data: hist.designation = data['designation'].strip()
    if 'start_date' in data: hist.start_date = data['start_date'].strip()
    if 'end_date' in data: hist.end_date = data['end_date'].strip()
    if 'responsibilities' in data: hist.responsibilities = data['responsibilities'].strip()
    if 'domain' in data: hist.domain = data['domain'].strip()
    if 'leadership_experience_years' in data: hist.leadership_experience_years = float(data['leadership_experience_years'])
    if 'is_leadership_role' in data: hist.is_leadership_role = bool(data['is_leadership_role'])

    db.session.commit()
    return jsonify({"success": True, "data": hist.to_dict(), "message": "Employment record updated"}), 200

@employees_bp.route('/employees/<int:emp_id>/employment-history/<int:history_id>', methods=['DELETE'])
def delete_employment_history(emp_id, history_id):
    user, current_emp, emp, err_msg, status = check_employee_access(emp_id)
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    hist = EmploymentHistory.query.filter_by(id=history_id, employee_id=emp_id).first()
    if not hist:
        return jsonify({"success": False, "message": "Employment history record not found"}), 404

    db.session.delete(hist)
    db.session.commit()
    return jsonify({"success": True, "message": "Employment history record removed"}), 200

@employees_bp.route('/employees/<int:emp_id>/employment-history/<int:history_id>/verify', methods=['POST'])
def verify_employment_history(emp_id, history_id):
    user, current_emp, err_msg, status = require_role('HR', 'Admin')
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    hist = EmploymentHistory.query.filter_by(id=history_id, employee_id=emp_id).first()
    if not hist:
        return jsonify({"success": False, "message": "Employment record not found"}), 404

    hist.verification_status = 'HR-Verified'
    hist.verified_by = user.id
    hist.verified_at = datetime.utcnow()
    db.session.commit()

    return jsonify({"success": True, "data": hist.to_dict(), "message": "Employment record verified"}), 200

@employees_bp.route('/employees/<int:emp_id>/company-info', methods=['PUT'])
def update_company_info(emp_id):
    user, current_emp, emp, err_msg, status = check_employee_access(emp_id)
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    data = request.get_json() or {}
    if 'company_joining_date' in data:
        emp.company_joining_date = data['company_joining_date'].strip() or None

    db.session.commit()
    exp_summary = calculate_employee_experience(emp_id)
    return jsonify({"success": True, "data": emp.to_dict(), "experience_summary": exp_summary, "message": "Company information updated"}), 200

# ==========================================
# MODULE 3: SKILLS AND COMPETENCIES ENDPOINTS
# ==========================================

@employees_bp.route('/employees/<int:emp_id>/skills', methods=['GET'])
def get_employee_skills(emp_id):
    user, current_emp, emp, err_msg, status = check_employee_access(emp_id)
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    target_role_id = request.args.get('role_id', 1, type=int)
    gap_analysis = evaluate_employee_skill_gaps(emp_id, target_role_id)
    skills_list = [s.to_dict() for s in emp.skills]

    return jsonify({
        "success": True,
        "skills": skills_list,
        "gap_analysis": gap_analysis
    }), 200

@employees_bp.route('/employees/<int:emp_id>/skills', methods=['POST'])
def add_employee_skill(emp_id):
    user, current_emp, emp, err_msg, status = check_employee_access(emp_id)
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    data = request.get_json() or {}
    skill_name = data.get('skill_name', '').strip()
    category = data.get('category', 'Technical').strip()
    proficiency = int(data.get('proficiency_level', 3))

    if not skill_name:
        return jsonify({"success": False, "message": "Skill name is required"}), 400

    # Prevent duplicate skill entry for same employee
    existing = EmployeeSkill.query.filter(
        EmployeeSkill.employee_id == emp_id,
        db.func.lower(EmployeeSkill.skill_name) == skill_name.lower()
    ).first()

    if existing:
        existing.proficiency_level = max(1, min(5, proficiency))
        existing.category = category
        if 'years_of_experience' in data:
            existing.years_of_experience = float(data['years_of_experience'])
        db.session.commit()
        return jsonify({"success": True, "data": existing.to_dict(), "message": f"Updated proficiency for {skill_name}"}), 200

    new_skill = EmployeeSkill(
        employee_id=emp_id,
        skill_name=skill_name,
        category=category,
        proficiency_level=max(1, min(5, proficiency)),
        years_of_experience=float(data.get('years_of_experience', 0.0)),
        assessment_score=float(data['assessment_score']) if data.get('assessment_score') is not None and data.get('assessment_score') != '' else None,
        verification_status='Assessment-Verified' if user.role.lower() in ['hr', 'admin'] and data.get('is_verified') else 'Self-Reported',
        verified_by=user.id if user.role.lower() in ['hr', 'admin'] and data.get('is_verified') else None,
        verified_at=datetime.utcnow() if user.role.lower() in ['hr', 'admin'] and data.get('is_verified') else None,
        evidence_notes=data.get('evidence_notes', '').strip()
    )

    db.session.add(new_skill)
    db.session.commit()

    return jsonify({"success": True, "data": new_skill.to_dict(), "message": "Skill added successfully"}), 201

@employees_bp.route('/employees/<int:emp_id>/skills/<int:skill_id>', methods=['PUT'])
def update_employee_skill(emp_id, skill_id):
    user, current_emp, emp, err_msg, status = check_employee_access(emp_id)
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    skill = EmployeeSkill.query.filter_by(id=skill_id, employee_id=emp_id).first()
    if not skill:
        return jsonify({"success": False, "message": "Skill record not found"}), 404

    data = request.get_json() or {}
    if 'skill_name' in data: skill.skill_name = data['skill_name'].strip()
    if 'category' in data: skill.category = data['category'].strip()
    if 'proficiency_level' in data: skill.proficiency_level = max(1, min(5, int(data['proficiency_level'])))
    if 'years_of_experience' in data: skill.years_of_experience = float(data['years_of_experience'])
    if 'evidence_notes' in data: skill.evidence_notes = data['evidence_notes'].strip()

    db.session.commit()
    return jsonify({"success": True, "data": skill.to_dict(), "message": "Skill updated successfully"}), 200

@employees_bp.route('/employees/<int:emp_id>/skills/<int:skill_id>', methods=['DELETE'])
def delete_employee_skill(emp_id, skill_id):
    user, current_emp, emp, err_msg, status = check_employee_access(emp_id)
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    skill = EmployeeSkill.query.filter_by(id=skill_id, employee_id=emp_id).first()
    if not skill:
        return jsonify({"success": False, "message": "Skill record not found"}), 404

    db.session.delete(skill)
    db.session.commit()
    return jsonify({"success": True, "message": "Skill record deleted"}), 200

@employees_bp.route('/employees/<int:emp_id>/skills/<int:skill_id>/verify', methods=['POST'])
def verify_employee_skill(emp_id, skill_id):
    user, current_emp, err_msg, status = require_role('HR', 'Manager', 'Admin')
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    skill = EmployeeSkill.query.filter_by(id=skill_id, employee_id=emp_id).first()
    if not skill:
        return jsonify({"success": False, "message": "Skill record not found"}), 404

    data = request.get_json() or {}
    status_choice = data.get('status', 'Reviewer-Verified')
    score = data.get('assessment_score')

    skill.verification_status = status_choice
    skill.verified_by = user.id
    skill.verified_at = datetime.utcnow()
    if score is not None and score != '':
        skill.assessment_score = float(score)

    db.session.commit()
    return jsonify({"success": True, "data": skill.to_dict(), "message": f"Skill marked as {status_choice}"}), 200
