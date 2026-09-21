from extensions import db
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash

class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(100), nullable=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)
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
        return {
            "id": self.id,
            "name": self.name or self.username,
            "username": self.username,
            "email": self.email,
            "role": self.role,
            "status": self.status,
            "employee_id": emp.id if emp else None,
            "employee_code": emp.employee_code if emp else None,
            "department": emp.department if emp else "Enterprise",
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
