from flask import Blueprint, request, jsonify
from datetime import datetime
from extensions import db
from models.employee import Employee
from models.user import User
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
    manager_arg = request.args.get('manager_id')
    availability = request.args.get('availability', '').strip()
    unassigned = request.args.get('unassigned', '').lower() in ['true', '1', 'yes'] or str(manager_arg).lower() == 'unassigned'

    manager_id = None
    if manager_arg and not unassigned:
        try:
            manager_id = int(manager_arg)
        except (ValueError, TypeError):
            manager_id = None

    include_readiness = request.args.get('include_readiness', 'true').lower() in ('true', '1')

    user, current_emp, err_msg, _ = get_current_user()
    query = Employee.query

    # Enforce role-based data isolation
    if user:
        role_lower = user.role.lower()
        if role_lower == 'manager':
            if not current_emp and (user.email or getattr(user, 'oauth_email', None)):
                current_emp = Employee.query.filter(
                    (Employee.user_id == user.id) |
                    (Employee.email == user.email) |
                    (Employee.email == getattr(user, 'oauth_email', None))
                ).first()
            if current_emp:
                manager_id = current_emp.id
            else:
                # Unresolved manager account sees empty team scope
                return jsonify({"success": True, "data": []}), 200
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

    if unassigned:
        query = query.filter(Employee.manager_id.is_(None))
    elif manager_id:
        query = query.filter(Employee.manager_id == manager_id)

    if availability and availability != 'All':
        query = query.filter(Employee.availability_status == availability)

    employees = query.options(db.joinedload(Employee.manager)).order_by(Employee.id.asc()).all()
    if not include_readiness:
        return jsonify({"success": True, "data": [e.to_dict() for e in employees]}), 200

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

    subordinates = Employee.query.options(db.joinedload(Employee.manager)).filter_by(manager_id=current_emp.id).all()
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

# ==========================================
# SUMMARY ENDPOINTS FOR SUCCESSION ANALYSIS
# ==========================================

@employees_bp.route('/employees/<int:emp_id>/projects-summary', methods=['GET'])
def get_employee_projects_summary_endpoint(emp_id):
    user, current_emp, emp, err_msg, status = check_employee_access(emp_id)
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    summary = get_employee_projects_summary(emp_id)
    return jsonify({"success": True, "data": summary}), 200

@employees_bp.route('/employees/<int:emp_id>/experience-summary', methods=['GET'])
def get_employee_experience_summary_endpoint(emp_id):
    user, current_emp, emp, err_msg, status = check_employee_access(emp_id)
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    summary = calculate_employee_experience(emp_id)
    return jsonify({"success": True, "data": summary}), 200

@employees_bp.route('/employees/<int:emp_id>/roles/<int:role_id>/skills-summary', methods=['GET'])
def get_employee_role_skills_summary(emp_id, role_id):
    user, current_emp, emp, err_msg, status = check_employee_access(emp_id)
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    eval_data = evaluate_employee_skill_gaps(emp_id, role_id)
    if not eval_data:
        return jsonify({"success": False, "message": "Employee or role not found"}), 404

    return jsonify({"success": True, "data": eval_data}), 200

@employees_bp.route('/employees/<int:emp_id>/roles/<int:role_id>/assessment-summary', methods=['GET'])
def get_employee_role_assessment_summary(emp_id, role_id):
    user, current_emp, emp, err_msg, status = check_employee_access(emp_id)
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    dossier = evaluate_leadership_suitability(emp_id, role_id)
    if not dossier:
        return jsonify({"success": False, "message": "Employee or role not found"}), 404

    ass_data = dossier.get("criteria_scores", {}).get("assessments", {})
    return jsonify({
        "success": True,
        "data": {
            "employee_id": emp_id,
            "employee_name": emp.name,
            "role_id": role_id,
            "assessment_score": dossier.get("assessment_score"),
            "marks_obtained": dossier.get("assessment_marks"),
            "max_marks": dossier.get("assessment_max_marks"),
            "assessment_name": dossier.get("assessment_name"),
            "status": dossier.get("assessment_status"),
            "completed_count": dossier.get("completed_assessments_count"),
            "attempts": ass_data.get("attempts", [])
        }
    }), 200


# ============================================================================
# COMPANY MANAGER HIERARCHY & REPORTING TRANSFERS (Section 2)
# ============================================================================

def would_create_circular_reporting(employee_id, new_manager_id):
    """
    Prevents circular hierarchy loops.
    Returns True if assigning employee_id to new_manager_id creates a circular loop.
    Traverses up the reporting chain starting from new_manager_id:
    if employee_id is encountered, it is a circular dependency.
    """
    if employee_id == new_manager_id:
        return True

    current_id = new_manager_id
    visited = set()
    while current_id is not None:
        if current_id == employee_id:
            return True
        if current_id in visited:
            break
        visited.add(current_id)
        mgr = Employee.query.get(current_id)
        if not mgr:
            break
        current_id = mgr.manager_id
    return False


@employees_bp.route('/hierarchy', methods=['GET'])
def get_company_hierarchy():
    """
    GET /api/hierarchy
    Returns dynamic, database-backed organization reporting tree:
    Company -> Managers -> Direct Reports + Unassigned Employees.
    Authorized for HR and Admin.
    """
    user, employee, err_msg, status = require_role('HR', 'Admin')
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    all_employees = Employee.query.order_by(Employee.id.asc()).all()

    # Map employees by manager_id
    reports_by_manager = {}
    unassigned = []
    emp_map = {e.id: e for e in all_employees}

    for emp in all_employees:
        if emp.manager_id is not None:
            reports_by_manager.setdefault(emp.manager_id, []).append(emp)
        else:
            unassigned.append(emp)

    # A manager is any employee who has direct reports OR holds a managerial designation
    manager_ids = set(reports_by_manager.keys())
    for emp in all_employees:
        if 'manager' in emp.designation.lower() or 'lead' in emp.designation.lower() or 'director' in emp.designation.lower():
            manager_ids.add(emp.id)

    managers_list = []
    # If a manager was in the unassigned list, remove from unassigned if they manage others
    final_unassigned = []
    for u in unassigned:
        if u.id in reports_by_manager and len(reports_by_manager[u.id]) > 0:
            pass # They are a top-level manager
        else:
            final_unassigned.append(u.to_dict())

    for mid in sorted(list(manager_ids)):
        mgr = emp_map.get(mid)
        if not mgr:
            continue
        direct_reports = reports_by_manager.get(mid, [])
        dr_dicts = []
        perf_sum = 0.0
        exp_sum = 0.0
        for dr in direct_reports:
            dr_d = dr.to_dict()
            # Attach latest assignment status
            latest_ass = dr.assessment_assignments[-1] if dr.assessment_assignments else None
            dr_d["latest_assignment_status"] = latest_ass.get_real_status() if latest_ass else "Not Scheduled"
            dr_dicts.append(dr_d)
            perf_sum += (dr.performance_score or 0.0)
            exp_sum += (dr.experience_years or 0.0)

        n_reports = len(direct_reports)
        avg_perf = round(perf_sum / n_reports, 1) if n_reports > 0 else 0.0
        avg_exp = round(exp_sum / n_reports, 1) if n_reports > 0 else 0.0

        managers_list.append({
            "manager_id": mgr.id,
            "manager_name": mgr.name,
            "employee_code": mgr.employee_code,
            "email": mgr.email,
            "department": mgr.department,
            "designation": mgr.designation,
            "experience_years": mgr.experience_years,
            "company_tenure_years": mgr.calculate_company_tenure_years(),
            "direct_reports_count": n_reports,
            "direct_reports": dr_dicts,
            "team_statistics": {
                "total_direct_reports": n_reports,
                "average_performance": avg_perf,
                "average_experience_years": avg_exp
            }
        })

    # Sort managers by direct report count descending
    managers_list.sort(key=lambda m: m["direct_reports_count"], reverse=True)

    total_team_members = sum(m["direct_reports_count"] for m in managers_list)
    avg_team_size = round(total_team_members / len(managers_list), 1) if managers_list else 0.0

    return jsonify({
        "success": True,
        "data": {
            "company_name": "Enterprise Succession Planning Organization",
            "managers": managers_list,
            "unassigned_employees": final_unassigned,
            "statistics": {
                "total_employees": len(all_employees),
                "total_managers": len(managers_list),
                "total_unassigned": len(final_unassigned),
                "average_team_size": avg_team_size
            },
            "summary": {
                "total_employees": len(all_employees),
                "total_managers": len(managers_list),
                "total_assigned_direct_reports": total_team_members,
                "unassigned_employees_count": len(final_unassigned),
                "average_direct_reports_per_manager": avg_team_size
            }
        }
    }), 200


@employees_bp.route('/manager/hierarchy', methods=['GET'])
def get_manager_team_hierarchy():
    """
    GET /api/manager/hierarchy
    Returns the reporting hierarchy for the logged-in manager's authorized scope.
    Strictly prevents exposure of other managers' confidential teams.
    """
    user, current_emp, err_msg, status = get_current_user()
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    if user.role.lower() not in ['manager', 'hr', 'admin']:
        return jsonify({"success": False, "message": "Access forbidden: Manager role required."}), 403

    mgr = current_emp
    if not mgr:
        return jsonify({"success": False, "message": "Manager profile not associated with account"}), 404

    direct_reports = Employee.query.filter_by(manager_id=mgr.id).order_by(Employee.id.asc()).all()
    dr_dicts = []
    perf_sum = 0.0
    exp_sum = 0.0
    for dr in direct_reports:
        dr_d = dr.to_dict()
        latest_ass = dr.assessment_assignments[-1] if dr.assessment_assignments else None
        dr_d["latest_assignment_status"] = latest_ass.get_real_status() if latest_ass else "Not Scheduled"
        dr_dicts.append(dr_d)
        perf_sum += (dr.performance_score or 0.0)
        exp_sum += (dr.experience_years or 0.0)

    n_reports = len(direct_reports)
    avg_perf = round(perf_sum / n_reports, 1) if n_reports > 0 else 0.0
    avg_exp = round(exp_sum / n_reports, 1) if n_reports > 0 else 0.0

    return jsonify({
        "success": True,
        "data": {
            "manager_id": mgr.id,
            "manager_name": mgr.name,
            "employee_code": mgr.employee_code,
            "department": mgr.department,
            "designation": mgr.designation,
            "direct_reports_count": n_reports,
            "direct_reports": dr_dicts,
            "team_statistics": {
                "total_direct_reports": n_reports,
                "average_performance": avg_perf,
                "average_experience_years": avg_exp
            }
        }
    }), 200


@employees_bp.route('/hierarchy/transfer', methods=['POST'])
@employees_bp.route('/employees/<int:emp_id>/manager', methods=['PUT'])
def transfer_employee_manager(emp_id=None):
    """
    POST /api/hierarchy/transfer or PUT /api/employees/<id>/manager
    Assigns, transfers, or removes reporting relationships.
    Strictly validates against circular reporting relationships.
    Uses database transaction for safe atomic updates.
    """
    user, employee, err_msg, status = require_role('HR', 'Admin')
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    data = request.get_json() or {}
    target_emp_id = emp_id or data.get('employee_id')
    new_manager_id = data.get('new_manager_id')

    if target_emp_id is None:
        return jsonify({"success": False, "message": "Employee ID is required"}), 400

    target_emp = Employee.query.get(target_emp_id)
    if not target_emp:
        return jsonify({"success": False, "message": "Employee not found"}), 404

    # Allow unassigning manager by passing null / None / 0
    if new_manager_id in [None, 0, '']:
        old_mgr_name = target_emp.manager.name if target_emp.manager else "None"
        target_emp.manager_id = None
        db.session.commit()
        return jsonify({
            "success": True,
            "message": f"Successfully removed manager for {target_emp.name}. Employee is now unassigned.",
            "data": target_emp.to_dict()
        }), 200

    new_manager_id = int(new_manager_id)

    # 1. Self-reporting check
    if target_emp_id == new_manager_id:
        return jsonify({
            "success": False,
            "message": "Invalid assignment: An employee cannot be assigned as their own manager."
        }), 400

    new_mgr = Employee.query.get(new_manager_id)
    if not new_mgr:
        return jsonify({"success": False, "message": f"Manager #{new_manager_id} not found"}), 404

    # 2. Circular reporting check
    if would_create_circular_reporting(target_emp_id, new_manager_id):
        return jsonify({
            "success": False,
            "message": f"Circular reporting relationship detected: {target_emp.name} cannot be assigned to report to {new_mgr.name} because {new_mgr.name} reports to {target_emp.name} directly or indirectly."
        }), 400

    # 3. Apply transfer in transaction
    old_mgr_name = target_emp.manager.name if target_emp.manager else "None"
    target_emp.manager_id = new_manager_id
    db.session.commit()

    return jsonify({
        "success": True,
        "message": f"Successfully transferred {target_emp.name} from {old_mgr_name} to {new_mgr.name}.",
        "data": target_emp.to_dict()
    }), 200


@employees_bp.route('/managers', methods=['GET'])
def get_managers_list():
    """
    GET /api/managers
    Returns all managers in the organization along with their assigned employee counts and direct reports.
    Authorized for HR, Admin, and Manager.
    """
    user, current_emp, err_msg, status = require_role('HR', 'Admin', 'Manager')
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    # Find all manager user IDs
    manager_users = User.query.filter(db.func.lower(User.role) == 'manager').all()
    manager_user_ids = {u.id for u in manager_users}

    # Employees who are managers
    all_employees = Employee.query.options(db.joinedload(Employee.subordinates)).order_by(Employee.id.asc()).all()
    
    managers_data = []
    seen_ids = set()

    for emp in all_employees:
        is_mgr = (
            emp.user_id in manager_user_ids or
            len(emp.subordinates) > 0 or
            any(k in (emp.designation or '').lower() for k in ['manager', 'lead', 'head', 'director', 'supervisor']) or
            emp.id in [4, 21]
        )
        if is_mgr and emp.id not in seen_ids:
            seen_ids.add(emp.id)
            sub_ids = [s.id for s in emp.subordinates]
            managers_data.append({
                "id": emp.id,
                "name": emp.name,
                "employee_code": emp.employee_code,
                "email": emp.email,
                "department": emp.department,
                "designation": emp.designation,
                "assigned_employee_count": len(sub_ids),
                "employee_ids": sub_ids,
                "user_id": emp.user_id,
                "availability_status": emp.availability_status
            })

    # Sort managers with assigned reports first, then by name
    managers_data.sort(key=lambda m: (-m["assigned_employee_count"], m["name"]))

    return jsonify({
        "success": True,
        "count": len(managers_data),
        "data": managers_data
    }), 200


@employees_bp.route('/employees/bulk-assign-manager', methods=['POST'])
def bulk_assign_employees_to_manager():
    """
    POST /api/employees/bulk-assign-manager
    Body: { "employee_ids": [1, 2, 3], "new_manager_id": 4 } (or new_manager_id: null to unassign)
    Assigns multiple employees to a manager atomically with full RBAC & circular reporting validation.
    """
    user, employee, err_msg, status = require_role('HR', 'Admin')
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    data = request.get_json() or {}
    employee_ids = data.get('employee_ids', [])
    new_manager_id = data.get('new_manager_id')

    if not employee_ids or not isinstance(employee_ids, list):
        return jsonify({"success": False, "message": "employee_ids array is required and cannot be empty"}), 400

    # Handle unassign
    is_unassign = new_manager_id in [None, 0, 'null', 'none', '']

    target_manager = None
    if not is_unassign:
        try:
            new_manager_id = int(new_manager_id)
            target_manager = Employee.query.get(new_manager_id)
            if not target_manager:
                return jsonify({"success": False, "message": f"Target Manager #{new_manager_id} not found"}), 404
        except (ValueError, TypeError):
            return jsonify({"success": False, "message": "Invalid new_manager_id format"}), 400

    updated_count = 0
    errors = []

    for eid in employee_ids:
        try:
            eid_int = int(eid)
            emp = Employee.query.get(eid_int)
            if not emp:
                errors.append(f"Employee #{eid} not found")
                continue

            if is_unassign:
                emp.manager_id = None
                updated_count += 1
            else:
                # 1. Self reporting check
                if eid_int == new_manager_id:
                    errors.append(f"{emp.name} cannot be assigned as their own manager")
                    continue

                # 2. Circular reporting check
                if would_create_circular_reporting(eid_int, new_manager_id):
                    errors.append(f"Circular reporting detected for {emp.name}")
                    continue

                emp.manager_id = new_manager_id
                updated_count += 1
        except Exception as e:
            errors.append(f"Error processing #{eid}: {str(e)}")

    if updated_count > 0:
        db.session.commit()
    else:
        db.session.rollback()
        return jsonify({
            "success": False,
            "message": f"No assignments updated. Errors: {'; '.join(errors)}"
        }), 400

    mgr_label = f"manager {target_manager.name}" if target_manager else "Unassigned (No Manager)"
    msg = f"Successfully assigned {updated_count} employee(s) to {mgr_label}."
    if errors:
        msg += f" Note: {len(errors)} employee(s) skipped due to errors: {'; '.join(errors)}"

    return jsonify({
        "success": True,
        "updated_count": updated_count,
        "skipped_count": len(errors),
        "message": msg
    }), 200


@employees_bp.route('/employees/unassigned', methods=['GET'])
def get_unassigned_employees():
    """
    GET /api/employees/unassigned
    Returns all employees who currently have no assigned manager.
    """
    user, employee, err_msg, status = require_role('HR', 'Admin')
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    unassigned = Employee.query.filter(Employee.manager_id.is_(None)).order_by(Employee.id.asc()).all()
    return jsonify({
        "success": True,
        "data": [e.to_dict() for e in unassigned],
        "count": len(unassigned)
    }), 200


@employees_bp.route('/employees/directory', methods=['GET'])
def get_employee_directory():
    """
    GET /api/employees/directory
    Returns organization employee directory with search, filtering, and sorting.
    Enforces RBAC data isolation:
    - HR / Admin: Full organizational directory with performance details.
    - Managers: Full details for authorized team members; public professional directory
      fields (name, code, department, designation, manager, tenure, availability) for others,
      strictly masking confidential performance reviews and ratings of other teams.
    """
    user, current_emp, err_msg, status = get_current_user()
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    search = request.args.get('search', '').strip()
    department = request.args.get('department', '').strip()
    manager_arg = request.args.get('manager_id')
    availability = request.args.get('availability', '').strip()
    unassigned = request.args.get('unassigned', '').lower() in ['true', '1', 'yes'] or str(manager_arg).lower() == 'unassigned'

    manager_id = None
    if manager_arg and not unassigned:
        try:
            manager_id = int(manager_arg)
        except (ValueError, TypeError):
            manager_id = None
    only_unassigned = request.args.get('unassigned', '').lower() in ['true', '1', 'yes']

    query = Employee.query

    if search:
        query = query.filter(
            (Employee.name.ilike(f"%{search}%")) |
            (Employee.employee_code.ilike(f"%{search}%")) |
            (Employee.designation.ilike(f"%{search}%"))
        )

    if department and department != 'All':
        query = query.filter(Employee.department == department)

    if only_unassigned:
        query = query.filter(Employee.manager_id.is_(None))
    elif manager_id:
        query = query.filter(Employee.manager_id == manager_id)

    if availability and availability != 'All':
        query = query.filter(Employee.availability_status == availability)

    employees = query.options(db.joinedload(Employee.manager)).order_by(Employee.id.asc()).all()

    is_hr = user.role.lower() in ['hr', 'admin']
    mgr_id = current_emp.id if current_emp else None

    result = []
    for emp in employees:
        is_direct_report = (mgr_id and emp.manager_id == mgr_id) or (mgr_id and emp.id == mgr_id)

        if is_hr or is_direct_report:
            # Full details authorized
            d = emp.to_dict()
            d["is_direct_report"] = is_direct_report
            d["access_scope"] = "Full (Authorized Scope)"
        else:
            # Public professional directory fields only (no confidential ratings/reviews)
            d = {
                "id": emp.id,
                "employee_code": emp.employee_code,
                "name": emp.name,
                "email": emp.email,
                "department": emp.department,
                "designation": emp.designation,
                "manager_id": emp.manager_id,
                "manager_name": emp.manager.name if emp.manager else None,
                "company_tenure_years": emp.calculate_company_tenure_years(),
                "experience_years": emp.experience_years,
                "availability_status": emp.availability_status,
                "is_direct_report": False,
                "access_scope": "Directory (Public Profile)"
            }
        result.append(d)

    return jsonify({
        "success": True,
        "data": result,
        "total": len(result)
    }), 200


