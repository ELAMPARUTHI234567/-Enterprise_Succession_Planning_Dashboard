from flask import Blueprint, request, jsonify
from extensions import db
from models.employee import Employee
from models.employee_competency import EmployeeCompetency
from models.competency import Competency
from models.role import LeadershipRole
from models.role_competency import RoleCompetency
from services.gap_service import calculate_competency_gaps
from services.readiness_service import calculate_successor_readiness
from utils.auth_middleware import get_current_user, require_role

employees_bp = Blueprint('employees', __name__)

@employees_bp.route('/employees', methods=['GET'])
def get_employees():
    search = request.args.get('search', '').strip()
    department = request.args.get('department', '').strip()
    manager_id = request.args.get('manager_id', type=int)
    availability = request.args.get('availability', '').strip()

    user, current_emp, err_msg, _ = get_current_user()
    
    # If authenticated user is a Manager without manager_id parameter, scope to their direct reports
    if user and user.role.lower() == 'manager' and current_emp and not manager_id:
        manager_id = current_emp.id

    query = Employee.query

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

    # Team members = direct reports
    subordinates = Employee.query.filter_by(manager_id=current_emp.id).all()
    return jsonify({
        "success": True,
        "data": [s.to_dict() for s in subordinates]
    }), 200

@employees_bp.route('/employees/<int:emp_id>', methods=['GET'])
def get_employee_detail(emp_id):
    user, current_emp, err_msg, _ = get_current_user()
    
    # Enforce data isolation: Employees can ONLY view their own profile!
    if user and user.role.lower() not in ['hr', 'admin', 'manager']:
        if current_emp and current_emp.id != emp_id:
            return jsonify({"success": False, "message": "Access forbidden: Employees can only view their own profile"}), 403

    emp = Employee.query.get(emp_id)
    if not emp:
        return jsonify({"success": False, "message": "Employee not found"}), 404

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
        availability_status=availability
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
