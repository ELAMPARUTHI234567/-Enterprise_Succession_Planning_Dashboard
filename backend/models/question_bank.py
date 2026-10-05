from extensions import db
from datetime import datetime
import json

class QuestionBank(db.Model):
    __tablename__ = 'question_bank'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    role_id = db.Column(db.Integer, db.ForeignKey('leadership_roles.id', ondelete='CASCADE'), nullable=False)
    competency_id = db.Column(db.Integer, db.ForeignKey('competencies.id', ondelete='SET NULL'), nullable=True)
    question_text = db.Column(db.Text, nullable=False)
    question_type = db.Column(db.String(50), default='Multiple Choice', nullable=False)
    options_json = db.Column(db.Text, nullable=False) # JSON list e.g. ["A. ...", "B. ...", "C. ...", "D. ..."]
    correct_answer = db.Column(db.String(10), nullable=False) # e.g. "A", "B", "C", "D"
    explanation = db.Column(db.Text, nullable=True)
    difficulty = db.Column(db.String(20), default='Medium', nullable=False) # Easy, Medium, Hard
    max_score = db.Column(db.Float, default=1.0, nullable=False)
    stable_code = db.Column(db.String(100), unique=True, nullable=True) # for idempotent duplicate prevention
    is_custom = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    role = db.relationship('LeadershipRole', backref=db.backref('question_bank', cascade="all, delete-orphan"))
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

    def to_dict(self, include_correct=False):
        is_custom_val = bool(getattr(self, 'is_custom', False))
        if self.stable_code and "CUSTOM" in self.stable_code:
            is_custom_val = True

        d = {
            "id": self.id,
            "role_id": self.role_id,
            "role_name": self.role.role_name if self.role else "",
            "competency_id": self.competency_id,
            "competency_name": self.competency.name if self.competency else "Leadership",
            "question_text": self.question_text,
            "question": self.question_text, # UI alias
            "question_type": self.question_type,
            "options": self.get_options(),
            "difficulty": self.difficulty,
            "max_score": self.max_score,
            "stable_code": self.stable_code,
            "is_custom": is_custom_val,
            "is_builtin": not is_custom_val,
            "source": "Custom" if is_custom_val else "Built-in",
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
        if include_correct:
            d["correct_answer"] = self.correct_answer or ""
            d["explanation"] = self.explanation or ""
        return d
