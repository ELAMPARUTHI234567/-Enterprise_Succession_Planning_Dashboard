from extensions import db
from datetime import datetime

class MLPrediction(db.Model):
    __tablename__ = 'ml_predictions'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    employee_id = db.Column(db.Integer, db.ForeignKey('employees.id', ondelete='CASCADE'), nullable=False)
    role_id = db.Column(db.Integer, db.ForeignKey('leadership_roles.id', ondelete='CASCADE'), nullable=False)
    predicted_class = db.Column(db.String(20), nullable=False)
    high_probability = db.Column(db.Float, nullable=False)
    medium_probability = db.Column(db.Float, nullable=False)
    low_probability = db.Column(db.Float, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    employee = db.relationship('Employee', backref='ml_predictions')
    role = db.relationship('LeadershipRole', backref='ml_predictions')

    def to_dict(self):
        return {
            "id": self.id,
            "employee_id": self.employee_id,
            "employee_name": self.employee.name if self.employee else "",
            "role_id": self.role_id,
            "role_name": self.role.role_name if self.role else "",
            "predicted_class": self.predicted_class,
            "high_probability": round(self.high_probability, 4),
            "medium_probability": round(self.medium_probability, 4),
            "low_probability": round(self.low_probability, 4),
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
