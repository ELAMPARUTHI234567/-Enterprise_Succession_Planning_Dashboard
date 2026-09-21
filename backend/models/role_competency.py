from extensions import db

class RoleCompetency(db.Model):
    __tablename__ = 'role_competencies'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    role_id = db.Column(db.Integer, db.ForeignKey('leadership_roles.id', ondelete='CASCADE'), nullable=False)
    competency_id = db.Column(db.Integer, db.ForeignKey('competencies.id', ondelete='CASCADE'), nullable=False)
    required_score = db.Column(db.Float, nullable=False, default=80.0)

    competency = db.relationship('Competency', backref='role_mappings')

    def to_dict(self):
        return {
            "id": self.id,
            "role_id": self.role_id,
            "competency_id": self.competency_id,
            "competency_name": self.competency.name if self.competency else "",
            "required_score": self.required_score
        }
