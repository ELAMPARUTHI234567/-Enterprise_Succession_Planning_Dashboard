from extensions import db
from datetime import datetime

class EmployeeSkill(db.Model):
    __tablename__ = 'employee_skills'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    employee_id = db.Column(db.Integer, db.ForeignKey('employees.id', ondelete='CASCADE'), nullable=False)
    skill_name = db.Column(db.String(100), nullable=False)
    category = db.Column(db.String(50), nullable=False)
    # Scale 1 (Beginner) to 5 (Expert)
    proficiency_level = db.Column(db.Integer, nullable=False, default=3)
    years_of_experience = db.Column(db.Float, default=0.0, nullable=False)
    assessment_score = db.Column(db.Float, nullable=True)  # Optional score 0-100

    # Verification: 'Self-Reported', 'Assessment-Verified', 'Reviewer-Verified'
    verification_status = db.Column(db.String(50), default='Self-Reported', nullable=False)
    verified_by = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    verified_at = db.Column(db.DateTime, nullable=True)
    evidence_notes = db.Column(db.Text, nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    verifier = db.relationship('User', foreign_keys=[verified_by])

    PROFICIENCY_LABELS = {
        1: "Beginner",
        2: "Basic",
        3: "Intermediate",
        4: "Advanced",
        5: "Expert"
    }

    def get_proficiency_label(self):
        return self.PROFICIENCY_LABELS.get(self.proficiency_level, "Intermediate")

    def to_dict(self):
        return {
            "id": self.id,
            "employee_id": self.employee_id,
            "skill_name": self.skill_name,
            "category": self.category,
            "proficiency_level": self.proficiency_level,
            "proficiency_label": self.get_proficiency_label(),
            "years_of_experience": self.years_of_experience,
            "assessment_score": self.assessment_score,
            "verification_status": self.verification_status,
            "verified_by": self.verified_by,
            "verified_by_name": self.verifier.name if self.verifier else None,
            "verified_at": self.verified_at.isoformat() if self.verified_at else None,
            "evidence_notes": self.evidence_notes or "",
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
