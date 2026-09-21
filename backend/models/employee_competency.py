from extensions import db
from datetime import datetime

class EmployeeCompetency(db.Model):
    __tablename__ = 'employee_competencies'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    employee_id = db.Column(db.Integer, db.ForeignKey('employees.id', ondelete='CASCADE'), nullable=False)
    competency_id = db.Column(db.Integer, db.ForeignKey('competencies.id', ondelete='CASCADE'), nullable=False)
    score = db.Column(db.Float, nullable=False, default=0.0)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    competency = db.relationship('Competency', backref='employee_mappings')

    def to_dict(self):
        return {
            "id": self.id,
            "employee_id": self.employee_id,
            "competency_id": self.competency_id,
            "competency_name": self.competency.name if self.competency else "",
            "score": self.score,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
