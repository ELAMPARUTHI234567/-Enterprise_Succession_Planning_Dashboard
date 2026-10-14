from extensions import db
from datetime import datetime

class RoleRequiredSkill(db.Model):
    __tablename__ = 'role_required_skills'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    role_id = db.Column(db.Integer, db.ForeignKey('leadership_roles.id', ondelete='CASCADE'), nullable=False)
    skill_name = db.Column(db.String(100), nullable=False)
    category = db.Column(db.String(50), nullable=False, default='Technical')
    # Minimum required proficiency on scale 1 to 5
    min_proficiency_level = db.Column(db.Integer, nullable=False, default=3)
    is_mandatory = db.Column(db.Boolean, default=True, nullable=False)
    weight = db.Column(db.Float, default=1.0, nullable=False)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    role = db.relationship('LeadershipRole', backref=db.backref('required_skills', cascade="all, delete-orphan"))

    PROFICIENCY_LABELS = {
        1: "Beginner",
        2: "Basic",
        3: "Intermediate",
        4: "Advanced",
        5: "Expert"
    }

    def to_dict(self):
        return {
            "id": self.id,
            "role_id": self.role_id,
            "skill_name": self.skill_name,
            "category": self.category,
            "min_proficiency_level": self.min_proficiency_level,
            "min_proficiency_label": self.PROFICIENCY_LABELS.get(self.min_proficiency_level, "Intermediate"),
            "is_mandatory": self.is_mandatory,
            "weight": self.weight
        }
