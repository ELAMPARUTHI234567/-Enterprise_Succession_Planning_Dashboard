import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "enterprise_succession_secret_key_2026")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "enterprise_jwt_secret_key_2026")
    USE_SQLITE = os.getenv("USE_SQLITE", "false").lower() == "true"
    
    # Default local PostgreSQL connection fallback
    DB_USER = os.getenv("DB_USER", "postgres")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")
    DB_HOST = os.getenv("DB_HOST", "localhost")
    DB_PORT = os.getenv("DB_PORT", "5432")
    DB_NAME = os.getenv("DB_NAME", "postgres")

    # Primary DATABASE_URL handling (PostgreSQL / Supabase compatible)
    DATABASE_URL = os.getenv("DATABASE_URL")
    if DATABASE_URL:
        # Standardize URL prefix for SQLAlchemy + psycopg2
        if DATABASE_URL.startswith("postgres://"):
            DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg2://", 1)
        elif DATABASE_URL.startswith("postgresql://") and not DATABASE_URL.startswith("postgresql+psycopg2://"):
            DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg2://", 1)
        PRIMARY_DATABASE_URI = DATABASE_URL
    else:
        PRIMARY_DATABASE_URI = f"postgresql+psycopg2://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    
    # Fallback SQLite URI
    BASE_DIR = os.path.abspath(os.path.dirname(__file__))
    SQLITE_DATABASE_URI = f"sqlite:///{os.path.join(BASE_DIR, 'succession_planning.db')}"

    SQLALCHEMY_DATABASE_URI = PRIMARY_DATABASE_URI
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*")
    AI_MODEL_PATH = os.getenv("AI_MODEL_PATH", os.path.join(BASE_DIR, "../ml/model.joblib"))
