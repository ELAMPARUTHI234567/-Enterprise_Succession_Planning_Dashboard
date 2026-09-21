from extensions import db
from datetime import datetime

class AIRecommendation(db.Model):
    __tablename__ = 'ai_recommendations'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    employee_id = db.Column(db.Integer, db.ForeignKey('employees.id', ondelete='CASCADE'), nullable=False)
    role_id = db.Column(db.Integer, db.ForeignKey('leadership_roles.id', ondelete='CASCADE'), nullable=False)
    recommendation_type = db.Column(db.String(50), default='Competency Analysis', nullable=False) # 'Competency Analysis', 'Role Replacement'
    recommendation_text = db.Column(db.Text, nullable=False)
    generated_at = db.Column(db.DateTime, default=datetime.utcnow)

    employee = db.relationship('Employee')
    role = db.relationship('LeadershipRole')

    def to_dict(self):
        return {
            "id": self.id,
            "employee_id": self.employee_id,
            "employee_name": self.employee.name if self.employee else "",
            "role_id": self.role_id,
            "role_name": self.role.role_name if self.role else "",
            "recommendation_type": self.recommendation_type,
            "recommendation_text": self.recommendation_text,
            "generated_at": self.generated_at.isoformat() if self.generated_at else None
        }
