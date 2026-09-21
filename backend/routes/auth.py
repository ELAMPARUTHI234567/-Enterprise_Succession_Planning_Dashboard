from flask import Blueprint, request, jsonify
from models.user import User

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    username_or_email = data.get('username', '').strip() or data.get('email', '').strip()
    password = data.get('password', '').strip()
    role_hint = data.get('role', '').strip() # Optional role filter from login selector UI

    if not username_or_email or not password:
        return jsonify({"success": False, "message": "Email/Username and password are required"}), 400

    # Search user by username or email
    user = User.query.filter(
        (User.username == username_or_email) | (User.email == username_or_email)
    ).first()

    if user and user.check_password(password):
        # If user role differs from requested role selector hint, warn or adjust if valid
        return jsonify({
            "success": True,
            "data": {
                "user": user.to_dict(),
                "token": f"jwt-token-enterprise-{user.role.lower()}-{user.id}",
                "message": f"Login successful as {user.role}"
            }
        }), 200

    # Demo Fallback Accounts check for easy testing if database reset
    demo_accounts = {
        'hr': ('hr123', 'HR', 1, 'Sarah Jenkins', 'hr@company.com'),
        'manager': ('manager123', 'Manager', 2, 'Sneha Reddy', 'manager@company.com'),
        'employee': ('employee123', 'Employee', 3, 'Arun Kumar', 'employee@company.com'),
        'admin': ('admin123', 'HR', 4, 'System Admin', 'admin@company.com')
    }

    if username_or_email in demo_accounts:
        pwd, r, uid, name, email = demo_accounts[username_or_email]
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
                        "status": "Active"
                    },
                    "token": f"jwt-token-enterprise-{r.lower()}-{uid}",
                    "message": f"Login successful as {r}"
                }
            }), 200

    return jsonify({"success": False, "message": "Invalid credentials or unauthorized role"}), 401

@auth_bp.route('/me', methods=['GET'])
def get_me():
    # In a full JWT app, parse header token. Here extract token or auth user header.
    auth_header = request.headers.get('Authorization', '')
    token = auth_header.replace('Bearer ', '').strip()

    if not token or not token.startswith('jwt-token-enterprise-'):
        return jsonify({"success": False, "message": "Unauthorized"}), 401

    parts = token.split('-')
    user_id = int(parts[-1]) if parts[-1].isdigit() else 1
    user = User.query.get(user_id)
    if not user:
        # Return fallback user
        user = User.query.first()

    return jsonify({"success": True, "data": user.to_dict() if user else {}}), 200
