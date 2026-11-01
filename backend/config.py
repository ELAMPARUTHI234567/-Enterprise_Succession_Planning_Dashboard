import os
from dotenv import load_dotenv

# Load .env from backend directory if present, otherwise cwd
_backend_dir = os.path.abspath(os.path.dirname(__file__))
_backend_env = os.path.join(_backend_dir, '.env')
if os.path.exists(_backend_env):
    load_dotenv(_backend_env)
else:
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

    # Supabase Configuration
    # Uses environment variables (with fallback to canonical project configuration)
    KNOWN_SUPABASE_URL = "https://livemvqdyupoipuajury.supabase.co"
    KNOWN_SUPABASE_ANON_KEY = "sb_publishable_WrkMC4kfEAQC7dAfpmln-Q_CKfrm6_0"

    SUPABASE_URL = (
        os.getenv("SUPABASE_URL") or 
        os.getenv("VITE_SUPABASE_URL") or 
        KNOWN_SUPABASE_URL
    ).rstrip("/")

    SUPABASE_ANON_KEY = (
        os.getenv("SUPABASE_ANON_KEY") or 
        os.getenv("SUPABASE_KEY") or 
        os.getenv("SUPABASE_PUBLISHABLE_KEY") or 
        os.getenv("VITE_SUPABASE_ANON_KEY") or 
        KNOWN_SUPABASE_ANON_KEY
    ).strip()

    # Authoritative Server-Side Role Mapping & Multi-Role Permissions
    # Maps cryptographically verified identities to organizational roles and portal privileges.
    # NEVER permits role elevation based on unverified client state or user-editable emails.
    TRUSTED_ROLE_MAPPINGS = {
        "elamparuthikp@gmail.com": {
            "default_role": "HR",
            "allowed_roles": ["HR", "Manager"],
            "username": "hr",
            "name": "HR Director",
            "department": "Human Resources",
            "status": "Active",
            "is_admin": True
        },
        "elamparuthikp777@gmail.com": {
            "default_role": "Manager",
            "allowed_roles": ["Manager"],
            "username": "manager",
            "name": "Engineering Manager",
            "department": "Engineering",
            "status": "Active",
            "is_admin": False
        }
    }

    # Dynamically include any extra admin emails configured in environment variables
    _extra_admins = [e.strip().lower() for e in os.getenv("AUTHORIZED_ADMIN_EMAILS", "").split(",") if e.strip()]
    for _ea in _extra_admins:
        if _ea not in TRUSTED_ROLE_MAPPINGS:
            TRUSTED_ROLE_MAPPINGS[_ea] = {
                "default_role": "HR",
                "allowed_roles": ["HR", "Manager"],
                "username": _ea.split("@")[0],
                "name": "Administrator",
                "department": "Administration",
                "status": "Active",
                "is_admin": True
            }

    @classmethod
    def get_trusted_mapping(cls, email):
        """Returns the authoritative role configuration for a verified email, or None if standard employee."""
        if not email or not isinstance(email, str):
            return None
        return cls.TRUSTED_ROLE_MAPPINGS.get(email.strip().lower())

