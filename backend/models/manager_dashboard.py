from extensions import db
from datetime import datetime, date

class TeamTask(db.Model):
    __tablename__ = 'team_tasks'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    manager_id = db.Column(db.Integer, db.ForeignKey('employees.id', ondelete='CASCADE'), nullable=False)
    employee_id = db.Column(db.Integer, db.ForeignKey('employees.id', ondelete='CASCADE'), nullable=False)
    project_id = db.Column(db.Integer, db.ForeignKey('employee_projects.id', ondelete='SET NULL'), nullable=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    priority = db.Column(db.String(20), default='Medium', nullable=False)  # 'Low', 'Medium', 'High', 'Urgent'
    start_date = db.Column(db.String(50), nullable=True)  # 'YYYY-MM-DD'
    due_date = db.Column(db.String(50), nullable=True)    # 'YYYY-MM-DD'
    status = db.Column(db.String(30), default='Pending', nullable=False)  # 'Pending', 'In Progress', 'Completed', 'Overdue'
    completed_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    manager = db.relationship('Employee', foreign_keys=[manager_id])
    assignee = db.relationship('Employee', foreign_keys=[employee_id])
    project = db.relationship('EmployeeProject', foreign_keys=[project_id])

    def get_effective_status(self):
        """
        Derives real-time overdue status from due date and completion status,
        using consistent server-side logic.
        """
        if self.status == 'Completed':
            return 'Completed'
        if self.due_date:
            try:
                due = datetime.strptime(str(self.due_date)[:10], '%Y-%m-%d').date()
                if due < date.today():
                    return 'Overdue'
            except Exception:
                pass
        return self.status

    def to_dict(self):
        eff_status = self.get_effective_status()
        return {
            "id": self.id,
            "manager_id": self.manager_id,
            "employee_id": self.employee_id,
            "employee_name": self.assignee.name if self.assignee else None,
            "employee_code": self.assignee.employee_code if self.assignee else None,
            "employee_designation": self.assignee.designation if self.assignee else None,
            "project_id": self.project_id,
            "project_name": self.project.project_name if self.project else None,
            "title": self.title,
            "description": self.description or "",
            "priority": self.priority,
            "start_date": self.start_date,
            "due_date": self.due_date,
            "status": eff_status,
            "raw_status": self.status,
            "is_overdue": eff_status == 'Overdue',
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }


class TeamGoal(db.Model):
    __tablename__ = 'team_goals'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    manager_id = db.Column(db.Integer, db.ForeignKey('employees.id', ondelete='CASCADE'), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    target_metric = db.Column(db.Float, default=100.0, nullable=False)
    current_metric = db.Column(db.Float, default=0.0, nullable=False)
    metric_unit = db.Column(db.String(50), default='%', nullable=False)
    target_date = db.Column(db.String(50), nullable=True)  # 'YYYY-MM-DD'
    status = db.Column(db.String(30), default='On Track', nullable=False)  # 'On Track', 'At Risk', 'Completed', 'Overdue'
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    manager = db.relationship('Employee', foreign_keys=[manager_id])

    def get_progress_pct(self):
        if not self.target_metric or self.target_metric <= 0:
            return 100.0 if self.current_metric > 0 else 0.0
        return min(100.0, max(0.0, round((self.current_metric / self.target_metric) * 100.0, 1)))

    def get_effective_status(self):
        progress = self.get_progress_pct()
        if progress >= 100.0:
            return 'Completed'
        if self.target_date:
            try:
                target_d = datetime.strptime(str(self.target_date)[:10], '%Y-%m-%d').date()
                if target_d < date.today():
                    return 'Overdue'
                days_left = (target_d - date.today()).days
                if days_left <= 7 and progress < 60.0:
                    return 'At Risk'
            except Exception:
                pass
        return self.status

    def to_dict(self):
        eff_status = self.get_effective_status()
        return {
            "id": self.id,
            "manager_id": self.manager_id,
            "title": self.title,
            "description": self.description or "",
            "target_metric": self.target_metric,
            "current_metric": self.current_metric,
            "metric_unit": self.metric_unit,
            "progress_pct": self.get_progress_pct(),
            "target_date": self.target_date,
            "status": eff_status,
            "raw_status": self.status,
            "is_overdue": eff_status == 'Overdue',
            "is_at_risk": eff_status == 'At Risk',
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }


class TeamIssue(db.Model):
    __tablename__ = 'team_issues'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    manager_id = db.Column(db.Integer, db.ForeignKey('employees.id', ondelete='CASCADE'), nullable=False)
    employee_id = db.Column(db.Integer, db.ForeignKey('employees.id', ondelete='SET NULL'), nullable=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    severity = db.Column(db.String(20), default='Medium', nullable=False)  # 'Low', 'Medium', 'High', 'Critical'
    status = db.Column(db.String(30), default='Open', nullable=False)  # 'Open', 'Investigating', 'Resolved'
    resolution_notes = db.Column(db.Text, nullable=True)
    resolved_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    manager = db.relationship('Employee', foreign_keys=[manager_id])
    employee = db.relationship('Employee', foreign_keys=[employee_id])

    def to_dict(self):
        return {
            "id": self.id,
            "manager_id": self.manager_id,
            "employee_id": self.employee_id,
            "employee_name": self.employee.name if self.employee else 'All Team',
            "title": self.title,
            "description": self.description or "",
            "severity": self.severity,
            "status": self.status,
            "resolution_notes": self.resolution_notes or "",
            "resolved_at": self.resolved_at.isoformat() if self.resolved_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }


class ManagerFeedback(db.Model):
    __tablename__ = 'manager_feedbacks'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    manager_id = db.Column(db.Integer, db.ForeignKey('employees.id', ondelete='CASCADE'), nullable=False)
    employee_id = db.Column(db.Integer, db.ForeignKey('employees.id', ondelete='CASCADE'), nullable=False)
    feedback_date = db.Column(db.String(50), nullable=True)
    strengths = db.Column(db.Text, nullable=True)
    improvement_areas = db.Column(db.Text, nullable=True)
    development_plan = db.Column(db.Text, nullable=True)
    follow_up_status = db.Column(db.String(30), default='Scheduled', nullable=False)  # 'Scheduled', 'In Progress', 'Completed'
    is_private = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    manager = db.relationship('Employee', foreign_keys=[manager_id])
    employee = db.relationship('Employee', foreign_keys=[employee_id])

    def to_dict(self):
        return {
            "id": self.id,
            "manager_id": self.manager_id,
            "manager_name": self.manager.name if self.manager else None,
            "employee_id": self.employee_id,
            "employee_name": self.employee.name if self.employee else None,
            "employee_code": self.employee.employee_code if self.employee else None,
            "feedback_date": self.feedback_date or (self.created_at.strftime('%Y-%m-%d') if self.created_at else None),
            "strengths": self.strengths or "",
            "improvement_areas": self.improvement_areas or "",
            "development_plan": self.development_plan or "",
            "follow_up_status": self.follow_up_status,
            "is_private": self.is_private,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }


class ManagerRecommendation(db.Model):
    __tablename__ = 'manager_recommendations'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    manager_id = db.Column(db.Integer, db.ForeignKey('employees.id', ondelete='CASCADE'), nullable=False)
    employee_id = db.Column(db.Integer, db.ForeignKey('employees.id', ondelete='CASCADE'), nullable=False)
    role_id = db.Column(db.Integer, db.ForeignKey('leadership_roles.id', ondelete='CASCADE'), nullable=False)
    suitability_score = db.Column(db.Float, nullable=True)
    readiness_level = db.Column(db.String(30), nullable=True)
    strengths_summary = db.Column(db.Text, nullable=True)
    development_needs = db.Column(db.Text, nullable=True)
    recommendation_notes = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(30), default='Submitted', nullable=False)  # 'Submitted', 'Under Review', 'Approved', 'Declined'
    hr_feedback = db.Column(db.Text, nullable=True)
    reviewed_by = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    reviewed_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    manager = db.relationship('Employee', foreign_keys=[manager_id])
    employee = db.relationship('Employee', foreign_keys=[employee_id])
    role = db.relationship('LeadershipRole', foreign_keys=[role_id])
    reviewer = db.relationship('User', foreign_keys=[reviewed_by])

    def to_dict(self):
        return {
            "id": self.id,
            "manager_id": self.manager_id,
            "manager_name": self.manager.name if self.manager else None,
            "employee_id": self.employee_id,
            "employee_name": self.employee.name if self.employee else None,
            "employee_code": self.employee.employee_code if self.employee else None,
            "role_id": self.role_id,
            "role_name": self.role.role_name if self.role else None,
            "suitability_score": self.suitability_score,
            "readiness_level": self.readiness_level,
            "strengths_summary": self.strengths_summary or "",
            "development_needs": self.development_needs or "",
            "recommendation_notes": self.recommendation_notes or "",
            "status": self.status,
            "hr_feedback": self.hr_feedback or "",
            "reviewed_by": self.reviewed_by,
            "reviewer_name": self.reviewer.name if self.reviewer else None,
            "reviewed_at": self.reviewed_at.isoformat() if self.reviewed_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }


class PerformanceReview(db.Model):
    __tablename__ = 'performance_reviews'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    manager_id = db.Column(db.Integer, db.ForeignKey('employees.id', ondelete='CASCADE'), nullable=False)
    employee_id = db.Column(db.Integer, db.ForeignKey('employees.id', ondelete='CASCADE'), nullable=False)
    rating = db.Column(db.Float, nullable=False)  # 0.0 - 100.0
    review_period = db.Column(db.String(50), nullable=True)  # e.g., 'Q3 2026', 'Annual 2026'
    review_notes = db.Column(db.Text, nullable=True)
    review_date = db.Column(db.String(50), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    manager = db.relationship('Employee', foreign_keys=[manager_id])
    employee = db.relationship('Employee', foreign_keys=[employee_id])

    def to_dict(self):
        return {
            "id": self.id,
            "manager_id": self.manager_id,
            "manager_name": self.manager.name if self.manager else None,
            "employee_id": self.employee_id,
            "employee_name": self.employee.name if self.employee else None,
            "rating": self.rating,
            "review_period": self.review_period or "",
            "review_notes": self.review_notes or "",
            "review_date": self.review_date or (self.created_at.strftime('%Y-%m-%d') if self.created_at else None),
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
