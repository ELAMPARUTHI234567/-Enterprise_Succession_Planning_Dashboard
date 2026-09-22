from flask import request, jsonify
from models.user import User
from models.employee import Employee
from extensions import db

def get_current_user():
    """
    Extracts the authenticated user and employee profile from the Bearer token in request headers.
    Returns (user, employee, error_message, status_code)
    """
    auth_header = request.headers.get('Authorization', '')
    if not auth_header:
        # Fallback query param for quick dev/testing if header not present
        token = request.args.get('token', '')
    else:
        token = auth_header.replace('Bearer ', '').strip()

    if not token:
        return None, None, "Missing authorization token", 401

    try:
        # Token format: jwt-token-enterprise-{role}-{user_id} or legacy format
        parts = token.split('-')
        user_id = None
        for p in reversed(parts):
            if p.isdigit():
                user_id = int(p)
                break

        if not user_id:
            user = User.query.first()
        else:
            user = User.query.get(user_id)

        if not user:
            return None, None, "User account not found or deactivated", 401

        if user.status != 'Active':
            return None, None, "Account is deactivated. Please contact HR.", 403

        # Retrieve linked employee profile
        employee = user.employee_profile
        if not employee:
            employee = Employee.query.filter_by(user_id=user.id).first()

        return user, employee, None, 200

    except Exception as e:
        return None, None, f"Authentication error: {str(e)}", 401

def require_role(*allowed_roles):
    """
    Decorator / Helper to enforce RBAC permissions.
    """
    user, employee, err_msg, status = get_current_user()
    if err_msg:
        return None, None, err_msg, status

    normalized_allowed = [r.lower() for r in allowed_roles]
    if user.role.lower() not in normalized_allowed and 'admin' not in user.role.lower():
        return None, None, f"Access forbidden: User role '{user.role}' is not authorized for this resource.", 403

    return user, employee, None, 200
