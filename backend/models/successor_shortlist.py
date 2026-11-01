from extensions import db
from datetime import datetime

class SuccessorShortlist(db.Model):
    __tablename__ = 'successor_shortlists'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    employee_id = db.Column(db.Integer, db.ForeignKey('employees.id', ondelete='CASCADE'), nullable=False)
    role_id = db.Column(db.Integer, db.ForeignKey('leadership_roles.id', ondelete='CASCADE'), nullable=False)
    shortlisted_by = db.Column(db.Integer, nullable=True)
    status = db.Column(db.String(50), default='Shortlisted', nullable=False) # 'Shortlisted', 'Approved', 'Nominated', 'Rejected'
    notes = db.Column(db.Text, nullable=True)
    ranking_score = db.Column(db.Float, nullable=True)
    readiness_score = db.Column(db.Float, nullable=True)
    assessment_score = db.Column(db.Float, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    employee = db.relationship('Employee', backref='successor_shortlists')
    role = db.relationship('LeadershipRole', backref='successor_shortlists')

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
            "shortlisted_by": self.shortlisted_by,
            "status": self.status,
            "notes": self.notes or "",
            "ranking_score": self.ranking_score,
            "readiness_score": self.readiness_score,
            "assessment_score": self.assessment_score,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }

