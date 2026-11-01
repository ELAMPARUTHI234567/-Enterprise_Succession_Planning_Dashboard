import jwt
from datetime import datetime, timezone
from flask import request, jsonify
from extensions import db
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
        user = User.query.options(db.joinedload(User.employee_profile)).get(user_id)
        if not user:
            return None, None, "User account not found or deactivated", 401

        user_role_lower = user.role.lower()
        token_allowed_roles = [str(r).lower() for r in payload.get("allowed_roles", [])]
        if token_role != user_role_lower:
            is_valid_transition = (
                (user_role_lower in token_allowed_roles) or
                (token_role in ['hr', 'admin'] and user_role_lower in ['hr', 'admin']) or
                (token_role in ['hr', 'manager'] and user_role_lower in ['hr', 'manager'] and (payload.get('is_multi_role') or ('hr' in token_allowed_roles and 'manager' in token_allowed_roles)))
            )
            if not is_valid_transition:
                return None, None, "Invalid token role signature", 401

        if user.status != 'Active':
            if user.status == 'Pending':
                return None, None, "Your registration is pending HR approval. Please contact HR.", 403
            return None, None, "Account is deactivated. Please contact HR.", 403

        # Retrieve linked employee profile
        employee = user.employee_profile
        if not employee:
            employee = Employee.query.filter_by(user_id=user.id).first()
        if not employee and (user.email or getattr(user, 'oauth_email', None)):
            # Robust fallback: link by authenticated email or oauth_email
            employee = Employee.query.filter(
                (Employee.email == user.email) |
                (Employee.email == getattr(user, 'oauth_email', None))
            ).first()
            if employee and not employee.user_id:
                try:
                    employee.user_id = user.id
                    db.session.commit()
                except Exception:
                    db.session.rollback()

        # Attach verified authenticated session claims to request context
        request.auth_email = payload.get("auth_email")
        request.auth_name = payload.get("auth_name")
        request.allowed_roles = payload.get("allowed_roles", [])
        request.is_multi_role = payload.get("is_multi_role", False)

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
    user_roles = [user.role.lower()]
    for r in getattr(request, 'allowed_roles', []):
        if r and r.lower() not in user_roles:
            user_roles.append(r.lower())

    if not any(r in normalized_allowed for r in user_roles) and 'admin' not in user_roles:
        return None, None, f"Access forbidden: User role '{user.role}' is not authorized for this resource.", 403

    return user, employee, None, 200
