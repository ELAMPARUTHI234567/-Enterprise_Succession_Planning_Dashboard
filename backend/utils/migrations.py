from sqlalchemy import inspect, text

def run_schema_migrations(engine):
    """
    Safely and idempotently applies database schema upgrades and missing column migrations
    for both SQLite (local development) and PostgreSQL (production environment).
    """
    try:
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        
        # 1. Migrate assessment_questions table
        if 'assessment_questions' in tables:
            columns = [c['name'] for c in inspector.get_columns('assessment_questions')]
            if 'explanation' not in columns:
                print("[MIGRATION] Adding missing 'explanation' column to 'assessment_questions' table...")
                with engine.begin() as conn:
                    conn.execute(text("ALTER TABLE assessment_questions ADD COLUMN explanation TEXT"))
                print("[MIGRATION] Column 'explanation' added successfully to 'assessment_questions'.")
            else:
                print("[MIGRATION] Table 'assessment_questions' schema verified (column 'explanation' present).")

        # 2. Migrate question_bank table if present
        if 'question_bank' in tables:
            qb_columns = [c['name'] for c in inspector.get_columns('question_bank')]
            
            if 'explanation' not in qb_columns:
                print("[MIGRATION] Adding missing 'explanation' column to 'question_bank' table...")
                with engine.begin() as conn:
                    conn.execute(text("ALTER TABLE question_bank ADD COLUMN explanation TEXT"))
                print("[MIGRATION] Column 'explanation' added successfully to 'question_bank'.")

            if 'stable_code' not in qb_columns:
                print("[MIGRATION] Adding missing 'stable_code' column to 'question_bank' table...")
                with engine.begin() as conn:
                    conn.execute(text("ALTER TABLE question_bank ADD COLUMN stable_code VARCHAR(100)"))
                print("[MIGRATION] Column 'stable_code' added successfully to 'question_bank'.")

        print("[MIGRATION] Database schema migration check completed successfully.")

    except Exception as e:
        print(f"[WARNING] Schema migration check failed or skipped: {str(e)}")
