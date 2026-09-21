import os
import sys
from flask import Flask, jsonify
from config import Config
from extensions import db, cors
from utils.seed_data import seed_database_if_empty

# Imports blueprints
from routes import (
    auth_bp, employees_bp, roles_bp, competencies_bp,
    assessments_bp, gap_analysis_bp, successors_bp,
    dashboard_bp, analytics_bp, ml_bp, reports_bp
)

def mask_db_uri(uri):
    """Utility to mask credentials in database logs"""
    if not uri:
        return ""
    try:
        if "@" in uri and "://" in uri:
            prefix, rest = uri.split("://", 1)
            user_pass, host_db = rest.split("@", 1)
            if ":" in user_pass:
                user = user_pass.split(":")[0]
                return f"{prefix}://{user}:****@{host_db}"
        return uri
    except Exception:
        return "configured_db_uri"

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    # Enable CORS
    origins = [o.strip() for o in Config.CORS_ORIGINS.split(',')] if Config.CORS_ORIGINS != "*" else "*"
    cors.init_app(app, resources={r"/api/*": {"origins": origins}})

    use_sqlite = os.getenv("USE_SQLITE", "false").lower() == "true"
    
    if not use_sqlite:
        try:
            target_uri = Config.PRIMARY_DATABASE_URI
            app.config["SQLALCHEMY_DATABASE_URI"] = target_uri
            print(f"[INFO] Initializing PostgreSQL / Supabase database connection: {mask_db_uri(target_uri)}")
        except Exception as e:
            print(f"[WARNING] Primary database configuration error ({str(e)}). Using SQLite database fallback...")
            app.config["SQLALCHEMY_DATABASE_URI"] = Config.SQLITE_DATABASE_URI
    else:
        app.config["SQLALCHEMY_DATABASE_URI"] = Config.SQLITE_DATABASE_URI

    # Initialize SQLAlchemy ONCE
    db.init_app(app)

    with app.app_context():
        try:
            db.create_all()
            seed_database_if_empty()
            print(f"[SUCCESS] Database tables verified & seeded with URI: {mask_db_uri(app.config['SQLALCHEMY_DATABASE_URI'])}")
        except Exception as e:
            print(f"[WARNING] Primary database connection failed ({str(e)}). Switching to SQLite fallback...")
            app.config["SQLALCHEMY_DATABASE_URI"] = Config.SQLITE_DATABASE_URI
            db.create_all()
            seed_database_if_empty()

    # Register API Blueprints
    app.register_blueprint(auth_bp, url_prefix='/api')
    app.register_blueprint(employees_bp, url_prefix='/api')
    app.register_blueprint(roles_bp, url_prefix='/api')
    app.register_blueprint(competencies_bp, url_prefix='/api')
    app.register_blueprint(assessments_bp, url_prefix='/api')
    app.register_blueprint(gap_analysis_bp, url_prefix='/api')
    app.register_blueprint(successors_bp, url_prefix='/api')
    app.register_blueprint(dashboard_bp, url_prefix='/api')
    app.register_blueprint(analytics_bp, url_prefix='/api')
    app.register_blueprint(ml_bp, url_prefix='/api')
    app.register_blueprint(reports_bp, url_prefix='/api')

    @app.route('/api/health', methods=['GET'])
    def health_check():
        db_status = "connected"
        try:
            with app.app_context():
                db.session.execute(db.text("SELECT 1"))
        except Exception:
            db_status = "fallback"

        return jsonify({
            "status": "ok",
            "message": "Enterprise Succession Planning API is running",
            "database_status": db_status
        }), 200

    return app

app = create_app()

if __name__ == '__main__':
    port = int(os.getenv("PORT", 5000))
    debug_mode = os.getenv("FLASK_DEBUG", "false").lower() == "true"
    print(f"\n=======================================================")
    print(f" Enterprise Succession Planning Backend API Running ")
    print(f" URL: http://localhost:{port}/api/health ")
    print(f"=======================================================\n")
    app.run(host='0.0.0.0', port=port, debug=debug_mode)
