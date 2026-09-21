from routes.auth import auth_bp
from routes.employees import employees_bp
from routes.roles import roles_bp
from routes.competencies import competencies_bp
from routes.assessments import assessments_bp
from routes.gap_analysis import gap_analysis_bp
from routes.successors import successors_bp
from routes.dashboard import dashboard_bp
from routes.analytics import analytics_bp
from routes.ml import ml_bp
from routes.reports import reports_bp

__all__ = [
    "auth_bp",
    "employees_bp",
    "roles_bp",
    "competencies_bp",
    "assessments_bp",
    "gap_analysis_bp",
    "successors_bp",
    "dashboard_bp",
    "analytics_bp",
    "ml_bp",
    "reports_bp"
]
