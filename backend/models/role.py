from extensions import db
from datetime import datetime

class LeadershipRole(db.Model):
    __tablename__ = 'leadership_roles'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    role_name = db.Column(db.String(100), unique=True, nullable=False)
    department = db.Column(db.String(50), nullable=False)
    description = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    required_competencies = db.relationship('RoleCompetency', backref='role', cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "role_name": self.role_name,
            "department": self.department,
            "description": self.description or "",
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
