import jwt
from datetime import datetime, timezone
from flask import request, jsonify
from models.user import User
from models.employee import Employee
from config import Config

def get_current_user():
    """
    Extracts and cryptographically verifies the Bearer JWT token from request headers.
    Returns (user, employee, error_message, status_code)
    """
    auth_header = request.headers.get('Authorization', '')
    if not auth_header:
        token = request.args.get('token', '')
    else:
        token = auth_header.replace('Bearer ', '').strip()

    if not token:
        return None, None, "Missing authorization token", 401

    try:
        # Decode and cryptographically verify JWT token signature and expiration
        payload = jwt.decode(
            token,
            Config.JWT_SECRET_KEY,
            algorithms=["HS256"]
        )

        sub_val = payload.get("sub")
        token_role = payload.get("role", "").lower()

        if not sub_val:
            return None, None, "Invalid token payload", 401

        user_id = int(sub_val)
        user = User.query.get(user_id)
        if not user:
            return None, None, "User account not found or deactivated", 401

        user_role_lower = user.role.lower()
        if token_role != user_role_lower:
            if not (token_role in ['hr', 'admin'] and user_role_lower in ['hr', 'admin']):
                return None, None, "Invalid token role signature", 401

        if user.status != 'Active':
            return None, None, "Account is deactivated. Please contact HR.", 403

        # Retrieve linked employee profile
        employee = user.employee_profile
        if not employee:
            employee = Employee.query.filter_by(user_id=user.id).first()

        return user, employee, None, 200

    except jwt.ExpiredSignatureError:
        return None, None, "Authorization token has expired. Please log in again.", 401
    except jwt.InvalidTokenError:
        return None, None, "Invalid authorization token signature", 401
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
