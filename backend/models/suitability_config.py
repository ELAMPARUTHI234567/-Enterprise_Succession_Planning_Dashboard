from extensions import db
from datetime import datetime

class SuitabilityConfig(db.Model):
    __tablename__ = 'suitability_configs'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    # Weights stored as percentages (must sum to 100.0)
    assessment_weight = db.Column(db.Float, default=30.0, nullable=False)
    readiness_weight = db.Column(db.Float, default=25.0, nullable=False)
    skills_weight = db.Column(db.Float, default=20.0, nullable=False)
    projects_weight = db.Column(db.Float, default=15.0, nullable=False)
    experience_weight = db.Column(db.Float, default=10.0, nullable=False)

    updated_by = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    updater = db.relationship('User', foreign_keys=[updated_by])

    @classmethod
    def get_active_config(cls):
        cfg = cls.query.first()
        if not cfg:
            cfg = cls(
                assessment_weight=30.0,
                readiness_weight=25.0,
                skills_weight=20.0,
                projects_weight=15.0,
                experience_weight=10.0
            )
            db.session.add(cfg)
            db.session.commit()
        return cfg

    def validate_weights(self):
        total = (
            self.assessment_weight +
            self.readiness_weight +
            self.skills_weight +
            self.projects_weight +
            self.experience_weight
        )
        return abs(total - 100.0) < 0.001

    def to_dict(self):
        return {
            "id": self.id,
            "assessment_weight": self.assessment_weight,
            "readiness_weight": self.readiness_weight,
            "skills_weight": self.skills_weight,
            "projects_weight": self.projects_weight,
            "experience_weight": self.experience_weight,
            "total_weight": round(
                self.assessment_weight +
                self.readiness_weight +
                self.skills_weight +
                self.projects_weight +
                self.experience_weight, 2
            ),
            "updated_by": self.updated_by,
            "updated_by_name": self.updater.name if self.updater else "System Default",
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
