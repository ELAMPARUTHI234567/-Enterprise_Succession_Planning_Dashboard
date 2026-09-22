from flask import Blueprint, request, jsonify
from models.user import User
from models.employee import Employee
from extensions import db
from utils.auth_middleware import get_current_user, require_role

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    username_or_email = (data.get('username', '') or data.get('email', '')).strip().lower()
    password = data.get('password', '').strip()
    role_hint = (data.get('role', '')).strip()

    if not username_or_email or not password:
        return jsonify({"success": False, "message": "Email/Username and password are required"}), 400

    # Search user by username or email from database
    try:
        user = User.query.filter(
            (db.func.lower(User.username) == username_or_email) | (db.func.lower(User.email) == username_or_email)
        ).first()

        if user:
            if user.status != 'Active':
                return jsonify({"success": False, "message": "Account is deactivated. Contact HR administrator."}), 403

            if user.check_password(password):
                user_dict = user.to_dict()
                token = f"jwt-token-enterprise-{user.role.lower()}-{user.id}"
                return jsonify({
                    "success": True,
                    "data": {
                        "user": user_dict,
                        "token": token,
                        "message": f"Login successful as {user.role}"
                    }
                }), 200
    except Exception as db_err:
        print(f"[WARNING] Database query error in login: {db_err}")

    # Fallback Account Check for Demo Credentials
    demo_users = {
        'hr': ('hr123', 'HR', 1, 'Sarah Jenkins (HR Director)', 'hr@company.com', 1),
        'manager': ('manager123', 'Manager', 2, 'Sneha Reddy (Engineering Manager)', 'manager@company.com', 4),
        'employee': ('employee123', 'Employee', 3, 'Arun Kumar (Senior Developer)', 'employee@company.com', 1),
        'admin': ('admin123', 'HR', 4, 'System Administrator', 'admin@company.com', 1),
        'arun.kumar': ('employee123', 'Employee', 3, 'Arun Kumar', 'arun.kumar@company.com', 1),
        'priya.sharma': ('employee123', 'Employee', 5, 'Priya Sharma', 'priya.sharma@company.com', 2),
        'rajesh.patel': ('employee123', 'Employee', 6, 'Rajesh Patel', 'rajesh.patel@company.com', 3),
        'sneha.reddy': ('manager123', 'Manager', 2, 'Sneha Reddy', 'sneha.reddy@company.com', 4),
        'vikram.singh': ('employee123', 'Employee', 7, 'Vikram Singh', 'vikram.singh@company.com', 5)
    }

    if username_or_email in demo_users:
        pwd, r, uid, name, email, emp_id = demo_users[username_or_email]
        if password == pwd:
            return jsonify({
                "success": True,
                "data": {
                    "user": {
                        "id": uid,
                        "name": name,
                        "username": username_or_email,
                        "email": email,
                        "role": r,
                        "status": "Active",
                        "employee_id": emp_id
                    },
                    "token": f"jwt-token-enterprise-{r.lower()}-{uid}",
                    "message": f"Login successful as {r}"
                }
            }), 200

    return jsonify({"success": False, "message": "Invalid username/email or password"}), 401

@auth_bp.route('/me', methods=['GET'])
def get_me():
    user, employee, err_msg, status = get_current_user()
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    data = user.to_dict()
    if employee:
        data["employee_profile"] = employee.to_dict()

    return jsonify({"success": True, "data": data}), 200

# HR User Account Management Endpoints
@auth_bp.route('/user-accounts', methods=['GET'])
def list_user_accounts():
    user, employee, err_msg, status = require_role('HR', 'Admin')
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    users = User.query.order_by(User.id.asc()).all()
    return jsonify({
        "success": True,
        "data": [u.to_dict() for u in users]
    }), 200

@auth_bp.route('/user-accounts', methods=['POST'])
def create_user_account():
    user, employee, err_msg, status = require_role('HR', 'Admin')
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    data = request.get_json() or {}
    name = data.get('name', '').strip()
    username = data.get('username', '').strip().lower()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '').strip()
    role = data.get('role', 'Employee').strip()
    employee_id = data.get('employee_id')

    if not username or not email or not password:
        return jsonify({"success": False, "message": "Username, email, and password are required"}), 400

    existing = User.query.filter((User.username == username) | (User.email == email)).first()
    if existing:
        return jsonify({"success": False, "message": "Username or email already exists"}), 400

    new_user = User(
        name=name or username,
        username=username,
        email=email,
        role=role,
        status='Active'
    )
    new_user.set_password(password)
    db.session.add(new_user)
    db.session.flush()

    if employee_id:
        emp = Employee.query.get(employee_id)
        if emp:
            emp.user_id = new_user.id

    db.session.commit()

    return jsonify({
        "success": True,
        "data": new_user.to_dict(),
        "message": f"User account created successfully for {username}"
    }), 201

@auth_bp.route('/user-accounts/<int:user_id>', methods=['PUT'])
def update_user_account(user_id):
    hr_user, _, err_msg, status = require_role('HR', 'Admin')
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    target_user = User.query.get(user_id)
    if not target_user:
        return jsonify({"success": False, "message": "User account not found"}), 404

    data = request.get_json() or {}
    if 'name' in data:
        target_user.name = data['name']
    if 'role' in data:
        target_user.role = data['role']
    if 'status' in data:
        target_user.status = data['status']
    if 'password' in data and data['password'].strip():
        target_user.set_password(data['password'].strip())

    if 'employee_id' in data:
        emp_id = data['employee_id']
        if emp_id:
            emp = Employee.query.get(emp_id)
            if emp:
                emp.user_id = target_user.id

    db.session.commit()

    return jsonify({
        "success": True,
        "data": target_user.to_dict(),
        "message": "User account updated successfully"
    }), 200

@auth_bp.route('/user-accounts/<int:user_id>/toggle-status', methods=['POST'])
def toggle_user_status(user_id):
    hr_user, _, err_msg, status = require_role('HR', 'Admin')
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    target_user = User.query.get(user_id)
    if not target_user:
        return jsonify({"success": False, "message": "User account not found"}), 404

    target_user.status = 'Inactive' if target_user.status == 'Active' else 'Active'
    db.session.commit()

    return jsonify({
        "success": True,
        "data": target_user.to_dict(),
        "message": f"Account status updated to {target_user.status}"
    }), 200
