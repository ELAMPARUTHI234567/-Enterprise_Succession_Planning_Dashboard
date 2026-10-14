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

        # 3. Migrate users table if present
        if 'users' in tables:
            user_columns = [c['name'] for c in inspector.get_columns('users')]
            if 'oauth_email' not in user_columns:
                print("[MIGRATION] Adding missing 'oauth_email' column to 'users' table...")
                with engine.begin() as conn:
                    conn.execute(text("ALTER TABLE users ADD COLUMN oauth_email VARCHAR(100)"))
                print("[MIGRATION] Column 'oauth_email' added successfully to 'users'.")
            else:
                print("[MIGRATION] Table 'users' schema verified (column 'oauth_email' present).")

        # 4. Migrate employees table if present
        if 'employees' in tables:
            emp_columns = [c['name'] for c in inspector.get_columns('employees')]
            if 'company_joining_date' not in emp_columns:
                print("[MIGRATION] Adding missing 'company_joining_date' column to 'employees' table...")
                with engine.begin() as conn:
                    conn.execute(text("ALTER TABLE employees ADD COLUMN company_joining_date VARCHAR(50)"))
                print("[MIGRATION] Column 'company_joining_date' added successfully to 'employees'.")
            else:
                print("[MIGRATION] Table 'employees' schema verified (column 'company_joining_date' present).")

        # 5. Migrate assessment_assignments table for manual scheduling
        if 'assessment_assignments' in tables:
            aa_columns = [c['name'] for c in inspector.get_columns('assessment_assignments')]
            new_aa_cols = [
                ('scheduled_date', 'VARCHAR(20)'),
                ('start_time', 'VARCHAR(10)'),
                ('duration_minutes', 'INTEGER'),
                ('end_time', 'VARCHAR(10)'),
                ('time_zone', 'VARCHAR(50)'),
                ('scheduled_start_datetime', 'DATETIME'),
                ('scheduled_end_datetime', 'DATETIME'),
                ('actual_start_time', 'DATETIME'),
                ('submission_deadline', 'DATETIME'),
                ('submitted_at', 'DATETIME'),
                ('schedule_status', 'VARCHAR(30)')
            ]
            for col_name, col_type in new_aa_cols:
                if col_name not in aa_columns:
                    print(f"[MIGRATION] Adding missing '{col_name}' column to 'assessment_assignments' table...")
                    with engine.begin() as conn:
                        conn.execute(text(f"ALTER TABLE assessment_assignments ADD COLUMN {col_name} {col_type}"))
                    print(f"[MIGRATION] Column '{col_name}' added successfully to 'assessment_assignments'.")

        print("[MIGRATION] Database schema migration check completed successfully.")

    except Exception as e:
        print(f"[WARNING] Schema migration check failed or skipped: {str(e)}")
