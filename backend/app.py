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
    cors.init_app(app, resources={r"/api/*": {
        "origins": origins,
        "allow_headers": ["Content-Type", "Authorization"],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    }})

    # Validate DATABASE_URL configuration
    if Config.HAS_PLACEHOLDER:
        err_msg = (
            f"\n======================================================================\n"
            f"[CONFIGURATION ERROR] Invalid DATABASE_URL detected!\n"
            f"The environment variable DATABASE_URL contains placeholder text ('{Config.DETECTED_PLACEHOLDER}').\n"
            f"Received DATABASE_URL value: '{mask_db_uri(Config.RAW_DATABASE_URL)}'\n"
            f"Action Required: Update DATABASE_URL in Render Dashboard (enterprise-succession-backend -> Environment).\n"
            f"Example format:\n"
            f"postgresql://postgres.[ref]:[password]@[host].pooler.supabase.com:5432/postgres\n"
            f"======================================================================\n"
        )
        print(err_msg, file=sys.stderr)
        raise RuntimeError(f"Invalid DATABASE_URL: contains placeholder text '{Config.DETECTED_PLACEHOLDER}'. Configure the real Supabase PostgreSQL DATABASE_URL in Render Environment Variables.")

    if Config.IS_PRODUCTION:
        if not Config.VALID_DATABASE_URL:
            err_msg = (
                f"\n======================================================================\n"
                f"[CONFIGURATION ERROR] Missing DATABASE_URL in Production!\n"
                f"Production environment requires a valid DATABASE_URL (Supabase PostgreSQL using psycopg2).\n"
                f"SQLite fallback is disabled in production.\n"
                f"Action Required: Configure the real Supabase PostgreSQL DATABASE_URL in Render Environment Variables.\n"
                f"======================================================================\n"
            )
            print(err_msg, file=sys.stderr)
            raise RuntimeError("Missing or unconfigured DATABASE_URL in production environment. Configure the real Supabase PostgreSQL DATABASE_URL in Render Environment Variables.")
        
        app.config["SQLALCHEMY_DATABASE_URI"] = Config.VALID_DATABASE_URL
        print(f"[SUCCESS] Production PostgreSQL configured: {mask_db_uri(Config.VALID_DATABASE_URL)}")
    else:
        if Config.VALID_DATABASE_URL:
            app.config["SQLALCHEMY_DATABASE_URI"] = Config.VALID_DATABASE_URL
            print(f"[SUCCESS] Configured PostgreSQL connection: {mask_db_uri(Config.VALID_DATABASE_URL)}")
        elif Config.USE_SQLITE:
            app.config["SQLALCHEMY_DATABASE_URI"] = Config.SQLITE_DATABASE_URI
            print(f"[INFO] Using SQLite database engine: {Config.SQLITE_DATABASE_URI}")
        else:
            app.config["SQLALCHEMY_DATABASE_URI"] = Config.LOCAL_POSTGRES_URI
            print(f"[INFO] Using local PostgreSQL database connection: {mask_db_uri(Config.LOCAL_POSTGRES_URI)}")

    # Initialize SQLAlchemy ONCE with finalized database URI
    db.init_app(app)

    with app.app_context():
        try:
            db.create_all()
            seed_database_if_empty()
            print(f"[SUCCESS] Database tables verified & seeded cleanly.")
        except Exception as e:
            print(f"[WARNING] Primary database connection failed ({str(e)}).")
            if not Config.IS_PRODUCTION and not Config.VALID_DATABASE_URL and not Config.USE_SQLITE:
                print("[INFO] Local PostgreSQL connection failed. Falling back to SQLite for local development.")
                app.config["SQLALCHEMY_DATABASE_URI"] = Config.SQLITE_DATABASE_URI
                try:
                    db.engine.dispose()
                    db.create_all()
                    seed_database_if_empty()
                    print(f"[SUCCESS] Local SQLite database fallback initialized.")
                except Exception as sqlite_err:
                    print(f"[WARNING] SQLite local fallback init error: {sqlite_err}")

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
        return jsonify({
            "status": "ok",
            "message": "Enterprise Succession Planning API is running"
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
