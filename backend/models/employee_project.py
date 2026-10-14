from extensions import db
from datetime import datetime
import json

class EmployeeProject(db.Model):
    __tablename__ = 'employee_projects'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    employee_id = db.Column(db.Integer, db.ForeignKey('employees.id', ondelete='CASCADE'), nullable=False)
    project_name = db.Column(db.String(150), nullable=False)
    description = db.Column(db.Text, nullable=True)
    role_responsibilities = db.Column(db.Text, nullable=True)
    start_date = db.Column(db.String(50), nullable=True)
    completion_date = db.Column(db.String(50), nullable=True)
    status = db.Column(db.String(50), default='In Progress', nullable=False)  # 'In Progress', 'Completed', 'On Hold', 'Cancelled'
    technologies_json = db.Column(db.Text, nullable=True)  # JSON list of strings
    outcomes_kpis = db.Column(db.Text, nullable=True)

    # Measurable indicators (0.0 to 100.0 or None)
    milestones_completed_pct = db.Column(db.Float, nullable=True)
    deliverables_accepted_pct = db.Column(db.Float, nullable=True)
    quality_defect_score = db.Column(db.Float, nullable=True)
    timeline_adherence_pct = db.Column(db.Float, nullable=True)
    business_goals_achieved_pct = db.Column(db.Float, nullable=True)

    # Computed or validated success rate (None if un-evaluated)
    success_rate = db.Column(db.Float, nullable=True)

    # Verification status: 'Self-Reported', 'HR-Verified', 'Supervisor-Verified', 'Rejected'
    verification_status = db.Column(db.String(50), default='Self-Reported', nullable=False)
    verified_by = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    verified_at = db.Column(db.DateTime, nullable=True)
    supervisor_feedback = db.Column(db.Text, nullable=True)
    evidence_url = db.Column(db.String(255), nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    verifier = db.relationship('User', foreign_keys=[verified_by])

    def set_technologies(self, tech_list):
        if isinstance(tech_list, list):
            self.technologies_json = json.dumps(tech_list)
        elif isinstance(tech_list, str):
            items = [t.strip() for t in tech_list.split(',') if t.strip()]
            self.technologies_json = json.dumps(items)
        else:
            self.technologies_json = json.dumps([])

    def get_technologies(self):
        if not self.technologies_json:
            return []
        try:
            return json.loads(self.technologies_json)
        except Exception:
            return [t.strip() for t in self.technologies_json.split(',') if t.strip()]

    def calculate_success_rate(self):
        """
        Transparent, documented formula for project success evaluation based on validated indicators.
        Weights:
        - Milestones completed: 25%
        - Deliverables accepted: 25%
        - Timeline adherence: 20%
        - Quality & defect benchmarks achieved: 15%
        - Business/technical objectives achieved: 15%
        Returns computed percentage, or None if no valid metrics exist.
        """
        weights = {
            'milestones_completed_pct': 0.25,
            'deliverables_accepted_pct': 0.25,
            'timeline_adherence_pct': 0.20,
            'quality_defect_score': 0.15,
            'business_goals_achieved_pct': 0.15
        }
        total_weight = 0.0
        weighted_sum = 0.0

        for attr, weight in weights.items():
            val = getattr(self, attr)
            if val is not None:
                total_weight += weight
                weighted_sum += (float(val) * weight)

        if total_weight > 0:
            return round(weighted_sum / total_weight, 1)
        return None

    def to_dict(self):
        return {
            "id": self.id,
            "employee_id": self.employee_id,
            "project_name": self.project_name,
            "description": self.description or "",
            "role_responsibilities": self.role_responsibilities or "",
            "start_date": self.start_date,
            "completion_date": self.completion_date,
            "status": self.status,
            "technologies": self.get_technologies(),
            "outcomes_kpis": self.outcomes_kpis or "",
            "milestones_completed_pct": self.milestones_completed_pct,
            "deliverables_accepted_pct": self.deliverables_accepted_pct,
            "quality_defect_score": self.quality_defect_score,
            "timeline_adherence_pct": self.timeline_adherence_pct,
            "business_goals_achieved_pct": self.business_goals_achieved_pct,
            "success_rate": self.success_rate,
            "has_success_rate": self.success_rate is not None,
            "verification_status": self.verification_status,
            "verified_by": self.verified_by,
            "verified_by_name": self.verifier.name if self.verifier else None,
            "verified_at": self.verified_at.isoformat() if self.verified_at else None,
            "supervisor_feedback": self.supervisor_feedback or "",
            "evidence_url": self.evidence_url or "",
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
