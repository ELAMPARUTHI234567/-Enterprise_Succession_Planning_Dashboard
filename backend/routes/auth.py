import re
import jwt
import json
import secrets
import urllib.request
import urllib.error
from datetime import datetime, timedelta, timezone
from flask import Blueprint, request, jsonify
from models.user import User
from models.employee import Employee
from extensions import db
from config import Config
from utils.auth_middleware import get_current_user, require_role

auth_bp = Blueprint('auth', __name__)

AUTHORIZED_ADMIN_EMAILS = {"elamparuthikp@gmail.com"}

def validate_supabase_access_token(access_token, apikey=None, user_metadata=None):
    """
    Validates Supabase JWT against configured project endpoint.
    Returns: (email, real_name, error_tuple)
    """
    if not access_token:
        return None, None, ({"success": False, "message": "Supabase access token required"}, 400)

    try:
        unverified_claims = jwt.decode(access_token, options={"verify_signature": False})
        iss = unverified_claims.get('iss', '')
    except Exception:
        return None, None, ({"success": False, "message": "Invalid JWT token structure"}, 401)

    configured_url = getattr(Config, 'SUPABASE_URL', '').rstrip('/')
    if not configured_url:
        return None, None, ({"success": False, "message": "Supabase URL is not configured on server"}, 500)

    clean_iss = iss.rstrip('/')
    expected_issuers = {configured_url, f"{configured_url}/auth/v1"}
    if clean_iss not in expected_issuers:
        return None, None, ({"success": False, "message": "Invalid token issuer: token does not belong to configured Supabase project"}, 401)

    user_endpoint = f"{configured_url}/auth/v1/user"
    resolved_apikey = (
        getattr(Config, 'SUPABASE_ANON_KEY', None) or 
        apikey or 
        ''
    )

    req = urllib.request.Request(user_endpoint)
    req.add_header('Authorization', f'Bearer {access_token}')
    if resolved_apikey:
        req.add_header('apikey', resolved_apikey)
    req.add_header('Accept', 'application/json')

    try:
        with urllib.request.urlopen(req) as response:
            user_res = json.loads(response.read().decode())
            raw_email = user_res.get('email') or user_res.get('user_metadata', {}).get('email') or ''
            email = str(raw_email).strip().lower()
            metadata = user_res.get('user_metadata', {}) or {}
            client_metadata = user_metadata or {}
            real_name = (
                metadata.get('full_name') or
                metadata.get('name') or
                user_res.get('name') or
                client_metadata.get('full_name') or
                client_metadata.get('name') or
                ''
            ).strip()
            return email, real_name, None
    except urllib.error.HTTPError as e:
        err_msg = ""
        try:
            raw_body = e.read().decode('utf-8')
            err_json = json.loads(raw_body)
            err_msg = err_json.get('msg') or err_json.get('message') or err_json.get('error_description') or raw_body
        except Exception:
            err_msg = str(e.reason)
        return None, None, ({"success": False, "message": f"Supabase token validation failed ({e.code}): {err_msg}"}, 401)
    except Exception as e:
        return None, None, ({"success": False, "message": f"Token validation failed with Supabase: {str(e)}"}, 401)

@auth_bp.route('/supabase', methods=['POST', 'OPTIONS'])
def supabase_login():
    if request.method == 'OPTIONS':
        return jsonify({"status": "ok"}), 200
    data = request.get_json() or {}
    access_token = data.get('access_token')

    if not access_token:
        return jsonify({"success": False, "message": "Supabase access token required"}), 400

    try:
        email, real_name, err = validate_supabase_access_token(
            access_token,
            apikey=data.get('apikey') or request.headers.get('apikey'),
            user_metadata=data.get('user_metadata')
        )
        if err:
            return jsonify(err[0]), err[1]

        if not email:
            return jsonify({"success": False, "message": "No email associated with this token"}), 401
            
        # Find user by primary email or linked oauth_email in database (case-insensitive & whitespace-trimmed)
        user = User.query.filter(
            (db.func.lower(db.func.trim(User.email)) == email) |
            (db.func.lower(db.func.trim(User.oauth_email)) == email)
        ).first()

        # If not directly in User, check if registered in active Employee records
        if not user:
            emp = Employee.query.filter(db.func.lower(db.func.trim(Employee.email)) == email).first()
            if emp:
                if emp.user_id:
                    user = User.query.get(emp.user_id)
                    if user and not user.oauth_email:
                        user.oauth_email = email
                        db.session.commit()
                else:
                    username_candidate = (emp.email.split('@')[0] if emp.email else f"emp_{emp.id}").lower()
                    counter = 1
                    base_username = username_candidate
                    while User.query.filter(User.username == username_candidate).first():
                        username_candidate = f"{base_username}_{counter}"
                        counter += 1

                    user = User(
                        name=emp.name or real_name,
                        username=username_candidate,
                        email=emp.email,
                        oauth_email=email,
                        role='Employee',
                        status='Active'
                    )
                    user.set_password(secrets.token_urlsafe(16))
                    db.session.add(user)
                    db.session.flush()
                    emp.user_id = user.id
                    db.session.commit()

        if not user:
            return jsonify({
                "success": False, 
                "needs_onboarding": True,
                "verified_email": email,
                "verified_name": real_name or None,
                "message": "Your employee account is not registered. Please contact HR to request access."
            }), 404
            
        if user.status == 'Pending':
            return jsonify({
                "success": False,
                "status": "Pending",
                "message": "Your employee account registration is pending HR approval. Please contact HR or check back shortly."
            }), 403

        if user.status != 'Active':
            return jsonify({"success": False, "message": "Your enterprise account is deactivated. Contact HR admin."}), 403

        # Prevent unauthorized role escalation via request body or query parameter
        requested_role = (data.get('role', '') or request.args.get('role', '')).strip()
        is_authorized_admin = (
            (user.email and user.email.lower() in AUTHORIZED_ADMIN_EMAILS) or
            (user.oauth_email and user.oauth_email.lower() in AUTHORIZED_ADMIN_EMAILS) or
            user.role.lower() == 'admin'
        )
        if requested_role and requested_role.lower() != user.role.lower():
            if is_authorized_admin and requested_role.upper() in ['HR', 'MANAGER']:
                user.role = 'HR' if requested_role.upper() == 'HR' else 'Manager'
                db.session.commit()
            else:
                return jsonify({
                    "success": False,
                    "message": "Unauthorized role escalation: Your account is not authorized for the requested role."
                }), 403

        # Synchronize verified real name if available, and clear demo name fallbacks
        if real_name:
            if not user.name or any(demo in user.name.lower() for demo in ["sarah jenkins", "sneha reddy"]):
                user.name = real_name
                db.session.commit()
        elif user.name and any(demo in user.name.lower() for demo in ["sarah jenkins", "sneha reddy"]):
            user.name = None
            db.session.commit()

        # Ensure oauth_email is set to the verified email
        if not user.oauth_email or user.oauth_email.strip().lower() != email:
            if user.email and user.email.strip().lower() != email:
                user.oauth_email = email
                db.session.commit()

        # Issue application JWT with database-authoritative role and verified authenticated email
        user_dict = user.to_dict()
        user_dict["email"] = email  # Verified email of the authenticated session
        user_dict["authenticated_email"] = email
        if real_name:
            user_dict["name"] = real_name
        elif user_dict.get("name") and any(demo in user_dict["name"].lower() for demo in ["sarah jenkins", "sneha reddy"]):
            user_dict["name"] = None

        payload = {
            "sub": str(user.id),
            "username": user.username,
            "role": user.role,
            "auth_email": email,
            "auth_name": user_dict.get("name"),
            "iat": datetime.now(timezone.utc),
            "exp": datetime.now(timezone.utc) + timedelta(hours=24)
        }
        token = jwt.encode(payload, Config.JWT_SECRET_KEY, algorithm="HS256")

        return jsonify({
            "success": True,
            "data": {
                "user": user_dict,
                "token": token,
                "message": f"Login successful as {user.role}"
            }
        }), 200
        
    except Exception as e:
        return jsonify({"success": False, "message": "Supabase authentication failed"}), 500

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    username_or_email = (data.get('username', '') or data.get('email', '')).strip().lower()
    password = data.get('password', '').strip()
    requested_role = (data.get('role', '') or request.args.get('role', '')).strip()

    if not username_or_email or not password:
        return jsonify({"success": False, "message": "Email/Username and password are required"}), 400

    try:
        user = User.query.filter(
            (db.func.lower(db.func.trim(User.username)) == username_or_email) | 
            (db.func.lower(db.func.trim(User.email)) == username_or_email) |
            (db.func.lower(db.func.trim(User.oauth_email)) == username_or_email)
        ).first()

        if user:
            if user.status != 'Active':
                return jsonify({"success": False, "message": "Your enterprise account is deactivated. Contact HR admin."}), 403

            # Strictly verify password hash - NO demo bypasses!
            if not user.check_password(password):
                return jsonify({"success": False, "message": "Invalid email/username or password"}), 401

            is_authorized_admin = (
                (user.email and user.email.lower() in AUTHORIZED_ADMIN_EMAILS) or
                (user.oauth_email and user.oauth_email.lower() in AUTHORIZED_ADMIN_EMAILS) or
                user.role.lower() == 'admin'
            )

            # Prevent unauthorized role escalation via request body or query parameter
            if requested_role and requested_role.lower() != user.role.lower():
                if is_authorized_admin and requested_role.upper() in ['HR', 'MANAGER']:
                    user.role = 'HR' if requested_role.upper() == 'HR' else 'Manager'
                    db.session.commit()
                else:
                    return jsonify({
                        "success": False,
                        "message": "Unauthorized role escalation: Your account is not authorized for the requested role."
                    }), 403

            auth_email = user.email
            if username_or_email == (user.oauth_email or '').lower():
                auth_email = user.oauth_email

            user_dict = user.to_dict()
            if auth_email and auth_email != user_dict.get("email"):
                user_dict["email"] = auth_email
                user_dict["authenticated_email"] = auth_email

            # Real cryptographically signed JWT with authoritative role
            payload = {
                "sub": str(user.id),
                "username": user.username,
                "role": user.role,
                "auth_email": auth_email,
                "auth_name": user_dict.get("name"),
                "iat": datetime.now(timezone.utc),
                "exp": datetime.now(timezone.utc) + timedelta(hours=24)
            }
            token = jwt.encode(payload, Config.JWT_SECRET_KEY, algorithm="HS256")

            return jsonify({
                "success": True,
                "data": {
                    "user": user_dict,
                    "token": token,
                    "message": f"Login successful as {user.role}"
                }
            }), 200
    except Exception as db_err:
        pass

    return jsonify({"success": False, "message": "Invalid email/username or password"}), 401

@auth_bp.route('/switch-role', methods=['POST'])
@auth_bp.route('/auth/switch-role', methods=['POST'])
def switch_role():
    user, employee, err_msg, status = get_current_user()
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    data = request.get_json() or {}
    target_role = (data.get('role') or '').strip()

    if target_role.upper() not in ['HR', 'MANAGER']:
        return jsonify({"success": False, "message": "Invalid target role for switching. Must be HR or Manager."}), 400

    target_role_normalized = 'HR' if target_role.upper() == 'HR' else 'Manager'

    is_authorized_admin = (
        (user.email and user.email.lower() in AUTHORIZED_ADMIN_EMAILS) or
        (user.oauth_email and user.oauth_email.lower() in AUTHORIZED_ADMIN_EMAILS) or
        user.role.lower() == 'admin'
    )

    if not is_authorized_admin:
        return jsonify({
            "success": False,
            "message": "Unauthorized role escalation: Role switching is restricted to authorized administrative accounts."
        }), 403

    user.role = target_role_normalized
    db.session.commit()

    current_auth_email = getattr(request, 'auth_email', None) or user.oauth_email
    current_auth_name = getattr(request, 'auth_name', None)

    # Issue updated token with new role
    payload = {
        "sub": str(user.id),
        "username": user.username,
        "role": user.role,
        "auth_email": current_auth_email,
        "auth_name": current_auth_name,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(hours=24)
    }
    new_token = jwt.encode(payload, Config.JWT_SECRET_KEY, algorithm="HS256")

    user_dict = user.to_dict()
    if current_auth_email:
        user_dict["email"] = current_auth_email
        user_dict["authenticated_email"] = current_auth_email
    if current_auth_name:
        user_dict["name"] = current_auth_name
    elif user_dict.get("name") and "sarah jenkins" in user_dict["name"].lower():
        user_dict["name"] = None

    return jsonify({
        "success": True,
        "data": {
            "user": user_dict,
            "token": new_token,
            "message": f"Role successfully switched to {user.role}"
        }
    }), 200

@auth_bp.route('/me', methods=['GET', 'OPTIONS'])
def get_me():
    if request.method == 'OPTIONS':
        return jsonify({"status": "ok"}), 200
    user, employee, err_msg, status = get_current_user()
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    data = user.to_dict()
    auth_email = getattr(request, 'auth_email', None)
    auth_name = getattr(request, 'auth_name', None)

    if auth_email:
        data["email"] = auth_email
        data["authenticated_email"] = auth_email
    elif user.oauth_email and user.email and any(generic in user.email.lower() for generic in ["hr@company.com", "manager@company.com"]):
        data["email"] = user.oauth_email
        data["authenticated_email"] = user.oauth_email

    if auth_name:
        data["name"] = auth_name
    elif data.get("name") and any(demo in data["name"].lower() for demo in ["sarah jenkins", "sneha reddy"]):
        data["name"] = None
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
        target_user.name = data['name'].strip() if data['name'] else target_user.name
    if 'role' in data and data['role'] in ['HR', 'Manager', 'Employee']:
        target_user.role = data['role']
    if 'status' in data and data['status'] in ['Active', 'Inactive']:
        target_user.status = data['status']
    if 'password' in data and data['password'].strip():
        target_user.set_password(data['password'].strip())

    if 'email' in data:
        new_email = (data['email'] or '').strip().lower()
        if not new_email or '@' not in new_email or '.' not in new_email:
            return jsonify({"success": False, "message": "Invalid email address format"}), 400
        conflict = User.query.filter(
            User.id != target_user.id,
            (db.func.lower(db.func.trim(User.email)) == new_email) |
            (db.func.lower(db.func.trim(User.oauth_email)) == new_email)
        ).first()
        if conflict:
            return jsonify({"success": False, "message": f"Email '{new_email}' is already associated with another account"}), 409
        target_user.email = new_email

    if 'oauth_email' in data:
        new_oauth = (data['oauth_email'] or '').strip().lower()
        if new_oauth:
            if '@' not in new_oauth or '.' not in new_oauth:
                return jsonify({"success": False, "message": "Invalid OAuth email address format"}), 400
            conflict = User.query.filter(
                User.id != target_user.id,
                (db.func.lower(db.func.trim(User.email)) == new_oauth) |
                (db.func.lower(db.func.trim(User.oauth_email)) == new_oauth)
            ).first()
            if conflict:
                return jsonify({"success": False, "message": f"OAuth email '{new_oauth}' is already associated with another account"}), 409
            target_user.oauth_email = new_oauth
        else:
            target_user.oauth_email = None

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

@auth_bp.route('/user-accounts/<int:user_id>/link-oauth-email', methods=['POST'])
def link_oauth_email(user_id):
    hr_user, _, err_msg, status = require_role('HR', 'Admin')
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    target_user = User.query.get(user_id)
    if not target_user:
        return jsonify({"success": False, "message": "User account not found"}), 404

    data = request.get_json() or {}
    oauth_email = (data.get('oauth_email') or '').strip().lower()

    if not oauth_email or '@' not in oauth_email or '.' not in oauth_email:
        return jsonify({"success": False, "message": "Valid OAuth email is required"}), 400

    conflict = User.query.filter(
        User.id != target_user.id,
        (db.func.lower(db.func.trim(User.email)) == oauth_email) |
        (db.func.lower(db.func.trim(User.oauth_email)) == oauth_email)
    ).first()
    if conflict:
        return jsonify({
            "success": False, 
            "message": f"Email '{oauth_email}' is already associated with user '{conflict.username}'"
        }), 409

    target_user.oauth_email = oauth_email
    db.session.commit()

    return jsonify({
        "success": True,
        "data": target_user.to_dict(),
        "message": f"Successfully linked OAuth email '{oauth_email}' to user '{target_user.username}' ({target_user.role})"
    }), 200

@auth_bp.route('/user-accounts/<int:user_id>/unlink-oauth-email', methods=['POST', 'DELETE'])
def unlink_oauth_email(user_id):
    hr_user, _, err_msg, status = require_role('HR', 'Admin')
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    target_user = User.query.get(user_id)
    if not target_user:
        return jsonify({"success": False, "message": "User account not found"}), 404

    target_user.oauth_email = None
    db.session.commit()

    return jsonify({
        "success": True,
        "data": target_user.to_dict(),
        "message": f"Successfully unlinked OAuth email from user '{target_user.username}'"
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

@auth_bp.route('/onboard-employee', methods=['POST', 'OPTIONS'])
def onboard_employee():
    if request.method == 'OPTIONS':
        return jsonify({"status": "ok"}), 200
    data = request.get_json() or {}
    auth_header = request.headers.get('Authorization', '')
    access_token = data.get('access_token') or auth_header.replace('Bearer ', '').strip()
    apikey = data.get('apikey') or request.headers.get('apikey') or ''
    user_metadata = data.get('user_metadata', {})

    if not access_token:
        return jsonify({"success": False, "message": "Supabase access token is required for onboarding"}), 400

    # 1. Strictly validate the Supabase token and retrieve verified Google email
    email, real_name, err = validate_supabase_access_token(access_token, apikey, user_metadata)
    if err:
        return jsonify(err[0]), err[1]

    if not email:
        return jsonify({"success": False, "message": "No verified email associated with this token"}), 401

    # 2. Prevent role tampering - self-registration is strictly Employee
    client_role = data.get('role', '').strip()
    if client_role and client_role.lower() != 'employee':
        return jsonify({
            "success": False,
            "message": "Unauthorized role selection: Self-registration is strictly limited to Employee accounts."
        }), 403

    # 3. Check for duplicate account / existing registration
    existing_user = User.query.filter(
        (db.func.lower(db.func.trim(User.email)) == email) |
        (db.func.lower(db.func.trim(User.oauth_email)) == email)
    ).first()

    if existing_user:
        if existing_user.status == 'Pending':
            return jsonify({
                "success": False,
                "status": "Pending",
                "message": "An account registration for this email is already pending HR approval."
            }), 409
        elif existing_user.status == 'Active':
            return jsonify({
                "success": False,
                "status": "Active",
                "message": "An active account for this email already exists. Please log in directly."
            }), 409
        else:
            return jsonify({
                "success": False,
                "message": "An account for this email already exists in the system."
            }), 409

    # Check for employee profile email duplicate as well
    existing_emp = Employee.query.filter(db.func.lower(db.func.trim(Employee.email)) == email).first()
    if existing_emp and existing_emp.user_id:
        return jsonify({
            "success": False,
            "message": "An employee profile with this email is already registered."
        }), 409

    # 4. Validate profile fields
    name = (data.get('name') or real_name or '').strip()
    if not name:
        return jsonify({"success": False, "message": "Full name is required for registration"}), 400

    department = (data.get('department') or '').strip()
    if not department:
        department = 'General'

    designation = (data.get('designation') or '').strip()
    if not designation:
        designation = 'Employee'

    # Employee Code handling: auto-generate if blank or validate uniqueness
    employee_code = (data.get('employee_code') or '').strip().upper()
    if employee_code:
        conflict_code = Employee.query.filter(Employee.employee_code == employee_code).first()
        if conflict_code:
            return jsonify({
                "success": False,
                "message": f"Employee code '{employee_code}' is already assigned to another employee"
            }), 409
    else:
        # Auto-generate next unique EMPxxx code
        max_emp = Employee.query.order_by(Employee.id.desc()).first()
        next_code_num = (max_emp.id + 1) if max_emp else 1
        employee_code = f"EMP{next_code_num:03d}"
        while Employee.query.filter_by(employee_code=employee_code).first():
            next_code_num += 1
            employee_code = f"EMP{next_code_num:03d}"

    # Generate unique username from email
    base_username = re.sub(r'[^a-z0-9_.]', '', email.split('@')[0].lower()) or f"emp_{next_code_num}"
    username_candidate = base_username
    counter = 1
    while User.query.filter_by(username=username_candidate).first():
        username_candidate = f"{base_username}_{counter}"
        counter += 1

    # 5. Create new User with role='Employee', status='Pending'
    new_user = User(
        name=name,
        username=username_candidate,
        email=email,
        oauth_email=email,
        role='Employee',
        status='Pending'
    )
    new_user.set_password(secrets.token_urlsafe(16))
    db.session.add(new_user)
    db.session.flush()

    # 6. Create Employee record or link existing unlinked record
    if existing_emp and not existing_emp.user_id:
        existing_emp.user_id = new_user.id
        existing_emp.name = name
        existing_emp.department = department
        existing_emp.designation = designation
        emp_record = existing_emp
    else:
        emp_record = Employee(
            user_id=new_user.id,
            employee_code=employee_code,
            name=name,
            email=email,
            department=department,
            designation=designation,
            experience_years=float(data.get('experience_years') or 2.0),
            performance_score=float(data.get('performance_score') or 75.0),
            leadership_score=float(data.get('leadership_score') or 70.0),
            availability_status='Available'
        )
        db.session.add(emp_record)
        db.session.flush()

        # Seed baseline competencies for the new employee
        from models.competency import Competency
        from models.employee_competency import EmployeeCompetency
        competencies = Competency.query.all()
        for comp in competencies:
            db.session.add(EmployeeCompetency(
                employee_id=emp_record.id,
                competency_id=comp.id,
                score=70.0
            ))

    db.session.commit()

    return jsonify({
        "success": True,
        "status": "Pending",
        "data": {
            "user": new_user.to_dict(),
            "employee": emp_record.to_dict()
        },
        "message": "Registration submitted successfully. Your employee account is pending HR approval before you can access the dashboard."
    }), 201

@auth_bp.route('/user-accounts/pending', methods=['GET'])
def get_pending_user_accounts():
    hr_user, _, err_msg, status = require_role('HR', 'Admin')
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    pending_users = User.query.filter_by(status='Pending').order_by(User.created_at.desc()).all()
    return jsonify({
        "success": True,
        "data": [u.to_dict() for u in pending_users]
    }), 200

@auth_bp.route('/user-accounts/<int:user_id>/approve', methods=['POST'])
def approve_user_account(user_id):
    hr_user, _, err_msg, status = require_role('HR', 'Admin')
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    target_user = User.query.get(user_id)
    if not target_user:
        return jsonify({"success": False, "message": "User account not found"}), 404

    target_user.status = 'Active'
    db.session.commit()

    return jsonify({
        "success": True,
        "data": target_user.to_dict(),
        "message": f"Employee account for '{target_user.name or target_user.username}' has been approved and activated."
    }), 200

@auth_bp.route('/user-accounts/<int:user_id>/reject', methods=['POST'])
def reject_user_account(user_id):
    hr_user, _, err_msg, status = require_role('HR', 'Admin')
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    target_user = User.query.get(user_id)
    if not target_user:
        return jsonify({"success": False, "message": "User account not found"}), 404

    target_user.status = 'Inactive'
    db.session.commit()

    return jsonify({
        "success": True,
        "data": target_user.to_dict(),
        "message": f"Registration for '{target_user.name or target_user.username}' has been rejected."
    }), 200

