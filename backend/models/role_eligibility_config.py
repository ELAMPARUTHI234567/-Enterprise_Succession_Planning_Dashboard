from extensions import db
from datetime import datetime

class RoleEligibilityConfig(db.Model):
    __tablename__ = 'role_eligibility_configs'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    role_id = db.Column(db.Integer, db.ForeignKey('leadership_roles.id', ondelete='CASCADE'), unique=True, nullable=False)
    
    # 1. Experience & Tenure Thresholds
    min_experience_years = db.Column(db.Float, default=2.0, nullable=False)
    min_company_tenure_months = db.Column(db.Float, default=6.0, nullable=False)
    
    # 2. Project Performance Thresholds
    min_project_success_rate = db.Column(db.Float, default=60.0, nullable=False)
    min_verified_projects = db.Column(db.Integer, default=1, nullable=False)
    require_verified_projects = db.Column(db.Boolean, default=False, nullable=False)
    
    # 3. Technical Skills Thresholds
    min_skill_match_pct = db.Column(db.Float, default=50.0, nullable=False)
    require_all_mandatory_skills = db.Column(db.Boolean, default=True, nullable=False)
    
    # 4. Leadership Competency Thresholds
    min_competency_score = db.Column(db.Float, default=60.0, nullable=False)
    
    # 5. Evidence Coverage & Reliability Thresholds
    min_evidence_coverage_pct = db.Column(db.Float, default=40.0, nullable=False)
    
    # Metadata
    updated_by = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    role = db.relationship('LeadershipRole', backref=db.backref('eligibility_config', uselist=False, cascade="all, delete-orphan"))
    updater = db.relationship('User', foreign_keys=[updated_by])

    ROLE_DEFAULT_THRESHOLDS = {
        "project manager": {
            "min_experience_years": 3.0,
            "min_company_tenure_months": 6.0,
            "min_project_success_rate": 65.0,
            "min_verified_projects": 0,
            "require_verified_projects": False,
            "min_skill_match_pct": 55.0,
            "require_all_mandatory_skills": True,
            "min_competency_score": 60.0,
            "min_evidence_coverage_pct": 40.0
        },
        "team lead": {
            "min_experience_years": 2.0,
            "min_company_tenure_months": 6.0,
            "min_project_success_rate": 60.0,
            "min_verified_projects": 0,
            "require_verified_projects": False,
            "min_skill_match_pct": 50.0,
            "require_all_mandatory_skills": True,
            "min_competency_score": 60.0,
            "min_evidence_coverage_pct": 40.0
        },
        "department manager": {
            "min_experience_years": 4.0,
            "min_company_tenure_months": 12.0,
            "min_project_success_rate": 70.0,
            "min_verified_projects": 0,
            "require_verified_projects": False,
            "min_skill_match_pct": 60.0,
            "require_all_mandatory_skills": True,
            "min_competency_score": 70.0,
            "min_evidence_coverage_pct": 40.0
        },
        "technical lead": {
            "min_experience_years": 3.0,
            "min_company_tenure_months": 6.0,
            "min_project_success_rate": 65.0,
            "min_verified_projects": 0,
            "require_verified_projects": False,
            "min_skill_match_pct": 60.0,
            "require_all_mandatory_skills": True,
            "min_competency_score": 65.0,
            "min_evidence_coverage_pct": 40.0
        },
        "operations manager": {
            "min_experience_years": 4.0,
            "min_company_tenure_months": 12.0,
            "min_project_success_rate": 70.0,
            "min_verified_projects": 0,
            "require_verified_projects": False,
            "min_skill_match_pct": 55.0,
            "require_all_mandatory_skills": True,
            "min_competency_score": 65.0,
            "min_evidence_coverage_pct": 40.0
        },
        "frontend developer": {
            "min_experience_years": 1.5,
            "min_company_tenure_months": 3.0,
            "min_project_success_rate": 60.0,
            "min_verified_projects": 0,
            "require_verified_projects": False,
            "min_skill_match_pct": 50.0,
            "require_all_mandatory_skills": True,
            "min_competency_score": 55.0,
            "min_evidence_coverage_pct": 30.0
        }
    }

    @classmethod
    def get_defaults_for_role(cls, role_name=""):
        name_lower = (role_name or "").lower().strip()
        for key, defaults in cls.ROLE_DEFAULT_THRESHOLDS.items():
            if key in name_lower or name_lower in key:
                return defaults.copy()

        # General Leadership default
        return {
            "min_experience_years": 2.5,
            "min_company_tenure_months": 6.0,
            "min_project_success_rate": 60.0,
            "min_verified_projects": 0,
            "require_verified_projects": False,
            "min_skill_match_pct": 50.0,
            "require_all_mandatory_skills": True,
            "min_competency_score": 60.0,
            "min_evidence_coverage_pct": 40.0
        }

    @classmethod
    def get_or_create(cls, role_id, role_name=""):
        config = cls.query.filter_by(role_id=role_id).first()
        if config:
            return config
        
        defaults = cls.get_defaults_for_role(role_name)
        new_cfg = cls(
            role_id=role_id,
            min_experience_years=defaults["min_experience_years"],
            min_company_tenure_months=defaults["min_company_tenure_months"],
            min_project_success_rate=defaults["min_project_success_rate"],
            min_verified_projects=defaults["min_verified_projects"],
            require_verified_projects=defaults["require_verified_projects"],
            min_skill_match_pct=defaults["min_skill_match_pct"],
            require_all_mandatory_skills=defaults["require_all_mandatory_skills"],
            min_competency_score=defaults["min_competency_score"],
            min_evidence_coverage_pct=defaults["min_evidence_coverage_pct"]
        )
        db.session.add(new_cfg)
        try:
            db.session.flush()
        except Exception:
            db.session.rollback()
            return cls.query.filter_by(role_id=role_id).first()
        return new_cfg

    def to_dict(self):
        return {
            "id": self.id,
            "role_id": self.role_id,
            "role_name": self.role.role_name if self.role else "",
            "min_experience_years": float(self.min_experience_years),
            "min_company_tenure_months": float(self.min_company_tenure_months),
            "min_project_success_rate": float(self.min_project_success_rate),
            "min_verified_projects": int(self.min_verified_projects),
            "require_verified_projects": bool(self.require_verified_projects),
            "min_skill_match_pct": float(self.min_skill_match_pct),
            "require_all_mandatory_skills": bool(self.require_all_mandatory_skills),
            "min_competency_score": float(self.min_competency_score),
            "min_evidence_coverage_pct": float(self.min_evidence_coverage_pct),
            "updated_by": self.updated_by,
            "updater_name": self.updater.name if self.updater else "System Default",
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
