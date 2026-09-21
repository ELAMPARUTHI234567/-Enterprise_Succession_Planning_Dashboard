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

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    # Enable CORS
    origins = [o.strip() for o in Config.CORS_ORIGINS.split(',')] if Config.CORS_ORIGINS != "*" else "*"
    cors.init_app(app, resources={r"/api/*": {"origins": origins}})

    use_sqlite = os.getenv("USE_SQLITE", "false").lower() == "true"
    
    if not use_sqlite:
        # Test MySQL / DATABASE_URL connection first
        try:
            if Config.DATABASE_URL:
                app.config["SQLALCHEMY_DATABASE_URI"] = Config.DATABASE_URL
                print(f"[SUCCESS] Using production DATABASE_URL")
            else:
                import pymysql
                conn = pymysql.connect(
                    host=Config.DB_HOST,
                    user=Config.DB_USER,
                    password=Config.DB_PASSWORD,
                    port=int(Config.DB_PORT),
                    connect_timeout=2
                )
                # Create DB if not exists
                with conn.cursor() as cursor:
                    cursor.execute(f"CREATE DATABASE IF NOT EXISTS {Config.DB_NAME};")
                conn.close()
                print(f"[SUCCESS] Connected to MySQL server! Using database '{Config.DB_NAME}'")
                app.config["SQLALCHEMY_DATABASE_URI"] = Config.MYSQL_DATABASE_URI
        except Exception as e:
            print(f"[WARNING] Primary database connection failed ({str(e)}). Using SQLite database fallback...")
            app.config["SQLALCHEMY_DATABASE_URI"] = Config.SQLITE_DATABASE_URI
    else:
        app.config["SQLALCHEMY_DATABASE_URI"] = Config.SQLITE_DATABASE_URI

    # Initialize SQLAlchemy ONCE
    db.init_app(app)

    with app.app_context():
        db.create_all()
        seed_database_if_empty()

    print(f"[SUCCESS] Database initialized with URI: {app.config['SQLALCHEMY_DATABASE_URI']}")

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

