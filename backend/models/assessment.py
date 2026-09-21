from extensions import db
from datetime import datetime
import json

class Assessment(db.Model):
    __tablename__ = 'assessments'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    title = db.Column(db.String(150), nullable=False)
    description = db.Column(db.Text, nullable=True)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    role_id = db.Column(db.Integer, db.ForeignKey('leadership_roles.id', ondelete='CASCADE'), nullable=False)
    employee_id = db.Column(db.Integer, db.ForeignKey('employees.id', ondelete='CASCADE'), nullable=True) # Optional specific target
    duration = db.Column(db.Integer, default=30, nullable=False) # Duration in minutes
    due_date = db.Column(db.String(50), nullable=True)
    passing_threshold = db.Column(db.Float, default=70.0, nullable=False)
    status = db.Column(db.String(20), default='Active', nullable=False) # 'Active', 'Draft', 'Archived'
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    role = db.relationship('LeadershipRole', backref='assessments')
    creator = db.relationship('User', foreign_keys=[created_by])
    questions = db.relationship('AssessmentQuestion', backref='assessment', cascade="all, delete-orphan", order_by="AssessmentQuestion.order_index")
    assignments = db.relationship('AssessmentAssignment', backref='assessment', cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description or "",
            "created_by": self.created_by,
            "creator_name": self.creator.name if self.creator else "HR Admin",
            "role_id": self.role_id,
            "role_name": self.role.role_name if self.role else "",
            "employee_id": self.employee_id,
            "employee_name": self.employee.name if hasattr(self, 'employee') and self.employee else None,
            "duration": self.duration,
            "due_date": self.due_date,
            "passing_threshold": self.passing_threshold,
            "status": self.status,
            "question_count": len(self.questions) if self.questions else 0,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }

class AssessmentQuestion(db.Model):
    __tablename__ = 'assessment_questions'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    assessment_id = db.Column(db.Integer, db.ForeignKey('assessments.id', ondelete='CASCADE'), nullable=False)
    question = db.Column(db.Text, nullable=False)
    question_type = db.Column(db.String(50), default='Multiple Choice', nullable=False)
    # Types: 'Multiple Choice', 'Rating Scale', 'Scenario-Based Question', 'Yes/No', 'Short Answer'
    competency_id = db.Column(db.Integer, db.ForeignKey('competencies.id', ondelete='SET NULL'), nullable=True)
    max_score = db.Column(db.Float, default=10.0, nullable=False)
    options_json = db.Column(db.Text, nullable=True) # JSON array of options e.g. ["Option A", "Option B"]
    correct_answer = db.Column(db.Text, nullable=True) # Correct option string or code e.g. "B" or "Discuss with both..."
    difficulty = db.Column(db.String(20), default='Medium', nullable=False) # 'Easy', 'Medium', 'Hard'
    order_index = db.Column(db.Integer, default=1, nullable=False)

    competency = db.relationship('Competency')

    def set_options(self, options_list):
        self.options_json = json.dumps(options_list or [])

    def get_options(self):
        if not self.options_json:
            return []
        try:
            return json.loads(self.options_json)
        except Exception:
            return []

    def to_dict(self):
        return {
            "id": self.id,
            "assessment_id": self.assessment_id,
            "question": self.question,
            "question_type": self.question_type,
            "competency_id": self.competency_id,
            "competency_name": self.competency.name if self.competency else "General Leadership",
            "max_score": self.max_score,
            "options": self.get_options(),
            "correct_answer": self.correct_answer or "",
            "difficulty": self.difficulty,
            "order_index": self.order_index
        }

class AssessmentAssignment(db.Model):
    __tablename__ = 'assessment_assignments'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    assessment_id = db.Column(db.Integer, db.ForeignKey('assessments.id', ondelete='CASCADE'), nullable=False)
    employee_id = db.Column(db.Integer, db.ForeignKey('employees.id', ondelete='CASCADE'), nullable=False)
    assigned_by = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    assigned_date = db.Column(db.DateTime, default=datetime.utcnow)
    due_date = db.Column(db.String(50), nullable=True)
    status = db.Column(db.String(20), default='Assigned', nullable=False) 
    # Statuses: 'Assigned', 'Started', 'In Progress', 'Completed', 'Overdue'
    instructions = db.Column(db.Text, nullable=True)
    
    assigner = db.relationship('User', foreign_keys=[assigned_by])
    employee = db.relationship('Employee', backref='assessment_assignments')
    answers = db.relationship('AssessmentAnswer', backref='assignment', cascade="all, delete-orphan")
    result = db.relationship('AssessmentResult', backref='assignment', uselist=False, cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "assessment_id": self.assessment_id,
            "assessment_title": self.assessment.title if self.assessment else "",
            "assessment_description": self.assessment.description if self.assessment else "",
            "duration": self.assessment.duration if self.assessment else 30,
            "passing_threshold": self.assessment.passing_threshold if self.assessment else 70.0,
            "role_id": self.assessment.role_id if self.assessment else None,
            "role_name": self.assessment.role.role_name if self.assessment and self.assessment.role else "",
            "employee_id": self.employee_id,
            "employee_name": self.employee.name if self.employee else "",
            "employee_code": self.employee.employee_code if self.employee else "",
            "assigned_by": self.assigned_by,
            "assigned_by_name": self.assigner.name if self.assigner else "HR Manager",
            "assigned_date": self.assigned_date.isoformat() if self.assigned_date else None,
            "due_date": self.due_date or (self.assessment.due_date if self.assessment else "N/A"),
            "status": self.status,
            "instructions": self.instructions or "Please complete all scenario and competency questions before the due date.",
            "question_count": len(self.assessment.questions) if self.assessment and self.assessment.questions else 0,
            "result": self.result.to_dict() if self.result else None
        }

class AssessmentAnswer(db.Model):
    __tablename__ = 'assessment_answers'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    assignment_id = db.Column(db.Integer, db.ForeignKey('assessment_assignments.id', ondelete='CASCADE'), nullable=False)
    question_id = db.Column(db.Integer, db.ForeignKey('assessment_questions.id', ondelete='CASCADE'), nullable=False)
    answer = db.Column(db.Text, nullable=False)
    score = db.Column(db.Float, default=0.0, nullable=False)

    question = db.relationship('AssessmentQuestion')

    def to_dict(self):
        return {
            "id": self.id,
            "assignment_id": self.assignment_id,
            "question_id": self.question_id,
            "question_text": self.question.question if self.question else "",
            "competency_id": self.question.competency_id if self.question else None,
            "competency_name": self.question.competency.name if self.question and self.question.competency else "",
            "answer": self.answer,
            "score": self.score,
            "max_score": self.question.max_score if self.question else 10.0
        }

class AssessmentResult(db.Model):
    __tablename__ = 'assessment_results'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    assignment_id = db.Column(db.Integer, db.ForeignKey('assessment_assignments.id', ondelete='CASCADE'), nullable=False)
    overall_score = db.Column(db.Float, nullable=False, default=0.0)
    readiness_level = db.Column(db.String(20), nullable=False, default='Low')
    completed_at = db.Column(db.DateTime, default=datetime.utcnow)
    detail_json = db.Column(db.Text, nullable=True)

    def set_detail(self, detail_obj):
        self.detail_json = json.dumps(detail_obj or {})

    def get_detail(self):
        if not self.detail_json:
            return {}
        try:
            return json.loads(self.detail_json)
        except Exception:
            return {}

    def to_dict(self):
        return {
            "id": self.id,
            "assignment_id": self.assignment_id,
            "overall_score": round(self.overall_score, 2),
            "readiness_level": self.readiness_level,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "detail": self.get_detail()
        }
