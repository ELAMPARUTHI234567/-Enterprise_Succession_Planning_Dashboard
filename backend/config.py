import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "enterprise_succession_secret_key_2026")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "enterprise_jwt_secret_key_2026")
    
    FLASK_ENV = os.getenv("FLASK_ENV", "development").lower()
    IS_PRODUCTION = (FLASK_ENV == "production") or (os.getenv("RENDER") == "true")
    USE_SQLITE = os.getenv("USE_SQLITE", "false").lower() == "true"
    
    # Raw DATABASE_URL from environment (e.g. Render environment variables)
    RAW_DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
    
    # Obvious placeholder substrings to detect unconfigured environment variables
    PLACEHOLDER_WORDS = [
        "POOLER_HOST",
        "PROJECT_REF",
        "PASSWORD",
        "[YOUR-PASSWORD]",
        "YOUR_PASSWORD",
        "YOUR_PROJECT_REF",
        "[YOUR_PROJECT_REF]",
        "YOUR_SUPABASE_PASSWORD",
        "YOUR_SUPABASE_HOST",
        "<PASSWORD>",
        "YOUR_MYSQL_PASSWORD",
        "YOUR_HOST",
        "YOUR_POSTGRES_HOST",
        "[PASSWORD]",
        "[PROJECT_REF]"
    ]
    
    HAS_PLACEHOLDER = False
    DETECTED_PLACEHOLDER = None

    if RAW_DATABASE_URL:
        for ph in PLACEHOLDER_WORDS:
            if ph.lower() in RAW_DATABASE_URL.lower():
                HAS_PLACEHOLDER = True
                DETECTED_PLACEHOLDER = ph
                break

    VALID_DATABASE_URL = None

    if RAW_DATABASE_URL and not HAS_PLACEHOLDER:
        url = RAW_DATABASE_URL
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+psycopg2://", 1)
        elif url.startswith("postgresql://") and not url.startswith("postgresql+psycopg2://"):
            url = url.replace("postgresql://", "postgresql+psycopg2://", 1)
        VALID_DATABASE_URL = url

    # Default local PostgreSQL connection configuration
    DB_USER = os.getenv("DB_USER", "postgres")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")
    DB_HOST = os.getenv("DB_HOST", "localhost")
    DB_PORT = os.getenv("DB_PORT", "5432")
    DB_NAME = os.getenv("DB_NAME", "postgres")
    
    LOCAL_POSTGRES_URI = f"postgresql+psycopg2://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

    BASE_DIR = os.path.abspath(os.path.dirname(__file__))
    SQLITE_DATABASE_URI = f"sqlite:///{os.path.join(BASE_DIR, 'succession_planning.db')}"

    # Determine default URI for SQLAlchemy initialization
    if VALID_DATABASE_URL:
        SQLALCHEMY_DATABASE_URI = VALID_DATABASE_URL
    elif USE_SQLITE:
        SQLALCHEMY_DATABASE_URI = SQLITE_DATABASE_URI
    else:
        SQLALCHEMY_DATABASE_URI = LOCAL_POSTGRES_URI

    SQLALCHEMY_TRACK_MODIFICATIONS = False
    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*")
    AI_MODEL_PATH = os.getenv("AI_MODEL_PATH", os.path.join(BASE_DIR, "../ml/model.joblib"))

