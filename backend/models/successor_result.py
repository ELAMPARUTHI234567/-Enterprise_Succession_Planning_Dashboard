from extensions import db
from datetime import datetime

class SuccessorResult(db.Model):
    __tablename__ = 'successor_results'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    employee_id = db.Column(db.Integer, db.ForeignKey('employees.id', ondelete='CASCADE'), nullable=False)
    role_id = db.Column(db.Integer, db.ForeignKey('leadership_roles.id', ondelete='CASCADE'), nullable=False)
    competency_score = db.Column(db.Float, nullable=False)
    performance_score = db.Column(db.Float, nullable=False)
    experience_score = db.Column(db.Float, nullable=False)
    leadership_score = db.Column(db.Float, nullable=False)
    readiness_score = db.Column(db.Float, nullable=False)
    readiness_level = db.Column(db.String(20), nullable=False)
    major_gap = db.Column(db.String(100), default='None')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    role = db.relationship('LeadershipRole', backref='successor_results')

    def to_dict(self):
        return {
            "id": self.id,
            "employee_id": self.employee_id,
            "employee_name": self.employee.name if self.employee else "",
            "employee_code": self.employee.employee_code if self.employee else "",
            "department": self.employee.department if self.employee else "",
            "designation": self.employee.designation if self.employee else "",
            "role_id": self.role_id,
            "role_name": self.role.role_name if self.role else "",
            "competency_score": self.competency_score,
            "performance_score": self.performance_score,
            "experience_score": self.experience_score,
            "leadership_score": self.leadership_score,
            "readiness_score": self.readiness_score,
            "readiness_level": self.readiness_level,
            "major_gap": self.major_gap or "None",
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
