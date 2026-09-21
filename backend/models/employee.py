from extensions import db
from datetime import datetime

class Employee(db.Model):
    __tablename__ = 'employees'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    employee_code = db.Column(db.String(20), unique=True, nullable=False)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)
    department = db.Column(db.String(50), nullable=False)
    designation = db.Column(db.String(50), nullable=False)
    manager_id = db.Column(db.Integer, db.ForeignKey('employees.id', ondelete='SET NULL'), nullable=True)
    experience_years = db.Column(db.Float, nullable=False, default=0.0)
    performance_score = db.Column(db.Float, nullable=False, default=0.0)
    leadership_score = db.Column(db.Float, nullable=False, default=0.0)
    availability_status = db.Column(db.String(20), nullable=False, default='Available') # 'Available', 'Unavailable'
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Self-referential relationship for manager -> direct reports
    subordinates = db.relationship('Employee', backref=db.backref('manager', remote_side=[id]))

    # Relationships
    competencies = db.relationship('EmployeeCompetency', backref='employee', cascade="all, delete-orphan")
    assessments = db.relationship('Assessment', backref='employee', cascade="all, delete-orphan")
    successor_results = db.relationship('SuccessorResult', backref='employee', cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "employee_code": self.employee_code,
            "name": self.name,
            "email": self.email,
            "department": self.department,
            "designation": self.designation,
            "manager_id": self.manager_id,
            "manager_name": self.manager.name if self.manager else None,
            "experience_years": self.experience_years,
            "performance_score": self.performance_score,
            "leadership_score": self.leadership_score,
            "availability_status": self.availability_status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
