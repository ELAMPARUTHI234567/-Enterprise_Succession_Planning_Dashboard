from extensions import db
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash

class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(100), nullable=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)
    oauth_email = db.Column(db.String(100), unique=True, nullable=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), default='Employee', nullable=False) # 'HR', 'Manager', 'Employee'
    status = db.Column(db.String(20), default='Active', nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    employee_profile = db.relationship('Employee', backref='user', uselist=False, foreign_keys='Employee.user_id')

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        emp = self.employee_profile
        # Return None for name when not explicitly set so the frontend can display
        # the authenticated email address as display name rather than a synthetic value.
        stored_name = self.name.strip() if self.name and self.name.strip() else None
        # Never expose demo identities 'Sarah Jenkins' or 'Sneha Reddy' as a real user's name when linked to OAuth
        if stored_name and any(demo in stored_name.lower() for demo in ["sarah jenkins", "sneha reddy"]) and self.oauth_email:
            stored_name = None
        return {
            "id": self.id,
            "name": stored_name,          # None means "no name stored" — frontend should use email
            "username": self.username,
            "email": self.email,
            "oauth_email": self.oauth_email,
            "role": self.role,
            "status": self.status,
            "employee_id": emp.id if emp else None,
            "employee_code": emp.employee_code if emp else None,
            "department": emp.department if emp else None,   # None when not linked to employee record
            "designation": emp.designation if emp else None,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
