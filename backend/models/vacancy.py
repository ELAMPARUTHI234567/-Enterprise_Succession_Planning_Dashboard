from extensions import db
from datetime import datetime

class ManagerVacancy(db.Model):
    __tablename__ = 'manager_vacancies'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    role_id = db.Column(db.Integer, db.ForeignKey('leadership_roles.id'), nullable=False)
    departing_manager_id = db.Column(db.Integer, db.ForeignKey('employees.id'), nullable=False)
    effective_departure_date = db.Column(db.String(50), nullable=False) # 'YYYY-MM-DD'
    reason = db.Column(db.String(255), nullable=True)
    status = db.Column(db.String(30), default='Open', nullable=False) # 'Open', 'Under Review', 'Appointed', 'Cancelled'
    
    # Final Appointment Details
    appointed_employee_id = db.Column(db.Integer, db.ForeignKey('employees.id', ondelete='SET NULL'), nullable=True)
    appointed_by_user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    appointed_at = db.Column(db.DateTime, nullable=True)
    appointment_notes = db.Column(db.Text, nullable=True)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    role = db.relationship('LeadershipRole', foreign_keys=[role_id])
    departing_manager = db.relationship('Employee', foreign_keys=[departing_manager_id])
    appointed_employee = db.relationship('Employee', foreign_keys=[appointed_employee_id])
    appointed_by = db.relationship('User', foreign_keys=[appointed_by_user_id])
    decisions = db.relationship('VacancyDecision', backref='vacancy', cascade="all, delete-orphan", order_by="VacancyDecision.created_at.desc()")

    def to_dict(self):
        return {
            "id": self.id,
            "role_id": self.role_id,
            "role_name": self.role.role_name if self.role else None,
            "department": self.role.department if self.role else (self.departing_manager.department if self.departing_manager else None),
            "departing_manager_id": self.departing_manager_id,
            "departing_manager_name": self.departing_manager.name if self.departing_manager else None,
            "departing_manager_code": self.departing_manager.employee_code if self.departing_manager else None,
            "departing_manager_designation": self.departing_manager.designation if self.departing_manager else None,
            "effective_departure_date": self.effective_departure_date,
            "reason": self.reason or "",
            "status": self.status,
            "appointed_employee_id": self.appointed_employee_id,
            "appointed_employee_name": self.appointed_employee.name if self.appointed_employee else None,
            "appointed_employee_code": self.appointed_employee.employee_code if self.appointed_employee else None,
            "appointed_by_user_id": self.appointed_by_user_id,
            "appointed_by_name": self.appointed_by.name if self.appointed_by else None,
            "appointed_at": self.appointed_at.isoformat() if self.appointed_at else None,
            "appointment_notes": self.appointment_notes or "",
            "decisions_count": len(self.decisions) if self.decisions else 0,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }


class VacancyDecision(db.Model):
    __tablename__ = 'vacancy_decisions'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    vacancy_id = db.Column(db.Integer, db.ForeignKey('manager_vacancies.id', ondelete='CASCADE'), nullable=False)
    employee_id = db.Column(db.Integer, db.ForeignKey('employees.id', ondelete='CASCADE'), nullable=False)
    reviewer_user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    action = db.Column(db.String(50), nullable=False) # 'Shortlist', 'Approve', 'Decline', 'Request Assessment'
    comments = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    employee = db.relationship('Employee', foreign_keys=[employee_id])
    reviewer = db.relationship('User', foreign_keys=[reviewer_user_id])

    def to_dict(self):
        return {
            "id": self.id,
            "vacancy_id": self.vacancy_id,
            "employee_id": self.employee_id,
            "employee_name": self.employee.name if self.employee else None,
            "employee_code": self.employee.employee_code if self.employee else None,
            "reviewer_user_id": self.reviewer_user_id,
            "reviewer_name": self.reviewer.name if self.reviewer else "HR Reviewer",
            "action": self.action,
            "comments": self.comments or "",
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
