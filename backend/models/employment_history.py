from extensions import db
from datetime import datetime

class EmploymentHistory(db.Model):
    __tablename__ = 'employment_history'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    employee_id = db.Column(db.Integer, db.ForeignKey('employees.id', ondelete='CASCADE'), nullable=False)
    company_name = db.Column(db.String(150), nullable=False)
    designation = db.Column(db.String(100), nullable=False)
    start_date = db.Column(db.String(50), nullable=False)  # 'YYYY-MM-DD' or 'YYYY-MM'
    end_date = db.Column(db.String(50), nullable=False)    # 'YYYY-MM-DD' or 'YYYY-MM'
    responsibilities = db.Column(db.Text, nullable=True)
    domain = db.Column(db.String(100), nullable=True)
    leadership_experience_years = db.Column(db.Float, default=0.0, nullable=False)
    is_leadership_role = db.Column(db.Boolean, default=False, nullable=False)

    # Verification
    verification_status = db.Column(db.String(50), default='Self-Reported', nullable=False) # 'Self-Reported', 'HR-Verified'
    verified_by = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    verified_at = db.Column(db.DateTime, nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    verifier = db.relationship('User', foreign_keys=[verified_by])

    def to_dict(self):
        return {
            "id": self.id,
            "employee_id": self.employee_id,
            "company_name": self.company_name,
            "designation": self.designation,
            "start_date": self.start_date,
            "end_date": self.end_date,
            "responsibilities": self.responsibilities or "",
            "domain": self.domain or "",
            "leadership_experience_years": self.leadership_experience_years,
            "is_leadership_role": self.is_leadership_role,
            "verification_status": self.verification_status,
            "verified_by": self.verified_by,
            "verified_by_name": self.verifier.name if self.verifier else None,
            "verified_at": self.verified_at.isoformat() if self.verified_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
