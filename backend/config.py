import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "enterprise_succession_secret_key_2026")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "enterprise_jwt_secret_key_2026")
    USE_SQLITE = os.getenv("USE_SQLITE", "false").lower() == "true"
    
    DB_USER = os.getenv("DB_USER", "root")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "root")
    DB_HOST = os.getenv("DB_HOST", "localhost")
    DB_PORT = os.getenv("DB_PORT", "3306")
    DB_NAME = os.getenv("DB_NAME", "succession_planning")

    # Primary DATABASE_URL or MySQL URI
    DATABASE_URL = os.getenv("DATABASE_URL")
    if DATABASE_URL:
        if DATABASE_URL.startswith("postgres://"):
            DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
        MYSQL_DATABASE_URI = DATABASE_URL
    else:
        MYSQL_DATABASE_URI = f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    
    # Fallback SQLite URI
    BASE_DIR = os.path.abspath(os.path.dirname(__file__))
    SQLITE_DATABASE_URI = f"sqlite:///{os.path.join(BASE_DIR, 'succession_planning.db')}"

    SQLALCHEMY_DATABASE_URI = MYSQL_DATABASE_URI
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*")
    AI_MODEL_PATH = os.getenv("AI_MODEL_PATH", os.path.join(BASE_DIR, "../ml/model.joblib"))

