from sqlalchemy import inspect, text

def run_schema_migrations(engine):
    """
    Safely and idempotently applies database schema upgrades and missing column migrations
    for both SQLite (local development) and PostgreSQL (production environment).
    """
    try:
        inspector = inspect(engine)
        tables = inspector.get_table_names()

        is_pg = engine.dialect.name == 'postgresql'
        pk_type = "SERIAL PRIMARY KEY" if is_pg else "INTEGER PRIMARY KEY AUTOINCREMENT"
        dt_type = "TIMESTAMP" if is_pg else "DATETIME"
        bool_false = "DEFAULT FALSE" if is_pg else "DEFAULT 0"
        bool_true = "DEFAULT TRUE" if is_pg else "DEFAULT 1"

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
                ('scheduled_start_datetime', dt_type),
                ('scheduled_end_datetime', dt_type),
                ('actual_start_time', dt_type),
                ('submission_deadline', dt_type),
                ('submitted_at', dt_type),
                ('schedule_status', 'VARCHAR(30)'),
                ('attempt_number', 'INTEGER DEFAULT 1')
            ]
            for col_name, col_type in new_aa_cols:
                if col_name not in aa_columns:
                    print(f"[MIGRATION] Adding missing '{col_name}' column to 'assessment_assignments' table...")
                    try:
                        with engine.begin() as conn:
                            conn.execute(text(f"ALTER TABLE assessment_assignments ADD COLUMN {col_name} {col_type}"))
                        print(f"[MIGRATION] Column '{col_name}' added successfully to 'assessment_assignments'.")
                    except Exception as col_err:
                        print(f"[MIGRATION] Notice: Could not add column '{col_name}' to 'assessment_assignments': {str(col_err)}")

        # 5b. Migrate assessment_answers table
        if 'assessment_answers' in tables:
            ans_columns = [c['name'] for c in inspector.get_columns('assessment_answers')]
            if 'assignment_question_id' not in ans_columns:
                print("[MIGRATION] Adding missing 'assignment_question_id' column to 'assessment_answers' table...")
                try:
                    with engine.begin() as conn:
                        conn.execute(text("ALTER TABLE assessment_answers ADD COLUMN assignment_question_id INTEGER"))
                    print("[MIGRATION] Column 'assignment_question_id' added successfully to 'assessment_answers'.")
                except Exception as col_err:
                    print(f"[MIGRATION] Notice: Could not add column 'assignment_question_id' to 'assessment_answers': {str(col_err)}")

        # 6. Migrate role_eligibility_configs table
        if 'role_eligibility_configs' in tables:
            rec_columns = [c['name'] for c in inspector.get_columns('role_eligibility_configs')]
            new_rec_cols = [
                ('min_experience_years', 'FLOAT DEFAULT 2.0'),
                ('min_company_tenure_months', 'FLOAT DEFAULT 6.0'),
                ('min_project_success_rate', 'FLOAT DEFAULT 60.0'),
                ('min_verified_projects', 'INTEGER DEFAULT 1'),
                ('require_verified_projects', f'BOOLEAN {bool_false}'),
                ('min_skill_match_pct', 'FLOAT DEFAULT 50.0'),
                ('require_all_mandatory_skills', f'BOOLEAN {bool_true}'),
                ('min_competency_score', 'FLOAT DEFAULT 60.0'),
                ('min_evidence_coverage_pct', 'FLOAT DEFAULT 40.0'),
                ('updated_by', 'INTEGER'),
                ('created_at', dt_type),
                ('updated_at', dt_type)
            ]
            for col_name, col_type in new_rec_cols:
                if col_name not in rec_columns:
                    print(f"[MIGRATION] Adding missing '{col_name}' column to 'role_eligibility_configs' table...")
                    try:
                        with engine.begin() as conn:
                            conn.execute(text(f"ALTER TABLE role_eligibility_configs ADD COLUMN {col_name} {col_type}"))
                        print(f"[MIGRATION] Column '{col_name}' added successfully to 'role_eligibility_configs'.")
                    except Exception as col_err:
                        print(f"[MIGRATION] Notice: Could not add column '{col_name}' to 'role_eligibility_configs': {str(col_err)}")
        else:
            # Create table if not present
            with engine.begin() as conn:
                conn.execute(text(f"""
                    CREATE TABLE IF NOT EXISTS role_eligibility_configs (
                        id {pk_type},
                        role_id INTEGER UNIQUE NOT NULL,
                        min_experience_years FLOAT DEFAULT 2.0,
                        min_company_tenure_months FLOAT DEFAULT 6.0,
                        min_project_success_rate FLOAT DEFAULT 60.0,
                        min_verified_projects INTEGER DEFAULT 1,
                        require_verified_projects BOOLEAN {bool_false},
                        min_skill_match_pct FLOAT DEFAULT 50.0,
                        require_all_mandatory_skills BOOLEAN {bool_true},
                        min_competency_score FLOAT DEFAULT 60.0,
                        min_evidence_coverage_pct FLOAT DEFAULT 40.0,
                        updated_by INTEGER,
                        created_at {dt_type},
                        updated_at {dt_type},
                        FOREIGN KEY (role_id) REFERENCES leadership_roles (id) ON DELETE CASCADE
                    )
                """))
            print("[MIGRATION] Created 'role_eligibility_configs' table successfully.")

        # 7. Migrate assignment_questions table

        if 'assignment_questions' not in tables:
            with engine.begin() as conn:
                conn.execute(text(f"""
                    CREATE TABLE IF NOT EXISTS assignment_questions (
                        id {pk_type},
                        assignment_id INTEGER NOT NULL,
                        question_bank_id INTEGER,
                        question TEXT NOT NULL,
                        question_type VARCHAR(50) DEFAULT 'Multiple Choice' NOT NULL,
                        competency_id INTEGER,
                        max_score FLOAT DEFAULT 10.0 NOT NULL,
                        options_json TEXT NOT NULL,
                        correct_answer VARCHAR(10) NOT NULL,
                        explanation TEXT,
                        difficulty VARCHAR(20) DEFAULT 'Medium' NOT NULL,
                        order_index INTEGER DEFAULT 1 NOT NULL,
                        FOREIGN KEY (assignment_id) REFERENCES assessment_assignments (id) ON DELETE CASCADE,
                        FOREIGN KEY (question_bank_id) REFERENCES question_bank (id) ON DELETE SET NULL,
                        FOREIGN KEY (competency_id) REFERENCES competencies (id) ON DELETE SET NULL
                    )
                """))
            print("[MIGRATION] Created 'assignment_questions' table successfully.")
        else:
            print("[MIGRATION] Table 'assignment_questions' schema verified.")

        # 8. Migrate employees table for responsibilities column
        if 'employees' in tables:
            emp_columns = [c['name'] for c in inspector.get_columns('employees')]
            if 'responsibilities' not in emp_columns:
                print("[MIGRATION] Adding missing 'responsibilities' column to 'employees' table...")
                with engine.begin() as conn:
                    conn.execute(text("ALTER TABLE employees ADD COLUMN responsibilities TEXT"))
                print("[MIGRATION] Column 'responsibilities' added successfully to 'employees'.")

        # 9. Migrate team_tasks table
        if 'team_tasks' not in tables:
            with engine.begin() as conn:
                conn.execute(text(f"""
                    CREATE TABLE IF NOT EXISTS team_tasks (
                        id {pk_type},
                        manager_id INTEGER NOT NULL,
                        employee_id INTEGER NOT NULL,
                        project_id INTEGER,
                        title VARCHAR(200) NOT NULL,
                        description TEXT,
                        priority VARCHAR(20) DEFAULT 'Medium' NOT NULL,
                        start_date VARCHAR(50),
                        due_date VARCHAR(50),
                        status VARCHAR(30) DEFAULT 'Pending' NOT NULL,
                        completed_at {dt_type},
                        created_at {dt_type},
                        updated_at {dt_type},
                        FOREIGN KEY (manager_id) REFERENCES employees (id) ON DELETE CASCADE,
                        FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE CASCADE,
                        FOREIGN KEY (project_id) REFERENCES employee_projects (id) ON DELETE SET NULL
                    )
                """))
            print("[MIGRATION] Created 'team_tasks' table successfully.")
        else:
            print("[MIGRATION] Table 'team_tasks' schema verified.")

        # 10. Migrate team_goals table
        if 'team_goals' not in tables:
            with engine.begin() as conn:
                conn.execute(text(f"""
                    CREATE TABLE IF NOT EXISTS team_goals (
                        id {pk_type},
                        manager_id INTEGER NOT NULL,
                        title VARCHAR(200) NOT NULL,
                        description TEXT,
                        target_metric FLOAT DEFAULT 100.0 NOT NULL,
                        current_metric FLOAT DEFAULT 0.0 NOT NULL,
                        metric_unit VARCHAR(50) DEFAULT '%' NOT NULL,
                        target_date VARCHAR(50),
                        status VARCHAR(30) DEFAULT 'On Track' NOT NULL,
                        created_at {dt_type},
                        updated_at {dt_type},
                        FOREIGN KEY (manager_id) REFERENCES employees (id) ON DELETE CASCADE
                    )
                """))
            print("[MIGRATION] Created 'team_goals' table successfully.")
        else:
            print("[MIGRATION] Table 'team_goals' schema verified.")

        # 11. Migrate team_issues table
        if 'team_issues' not in tables:
            with engine.begin() as conn:
                conn.execute(text(f"""
                    CREATE TABLE IF NOT EXISTS team_issues (
                        id {pk_type},
                        manager_id INTEGER NOT NULL,
                        employee_id INTEGER,
                        title VARCHAR(200) NOT NULL,
                        description TEXT,
                        severity VARCHAR(20) DEFAULT 'Medium' NOT NULL,
                        status VARCHAR(30) DEFAULT 'Open' NOT NULL,
                        resolution_notes TEXT,
                        resolved_at {dt_type},
                        created_at {dt_type},
                        updated_at {dt_type},
                        FOREIGN KEY (manager_id) REFERENCES employees (id) ON DELETE CASCADE,
                        FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE SET NULL
                    )
                """))
            print("[MIGRATION] Created 'team_issues' table successfully.")
        else:
            print("[MIGRATION] Table 'team_issues' schema verified.")

        # 12. Migrate manager_feedbacks table
        if 'manager_feedbacks' not in tables:
            with engine.begin() as conn:
                conn.execute(text(f"""
                    CREATE TABLE IF NOT EXISTS manager_feedbacks (
                        id {pk_type},
                        manager_id INTEGER NOT NULL,
                        employee_id INTEGER NOT NULL,
                        feedback_date VARCHAR(50),
                        strengths TEXT,
                        improvement_areas TEXT,
                        development_plan TEXT,
                        follow_up_status VARCHAR(30) DEFAULT 'Scheduled' NOT NULL,
                        is_private BOOLEAN {bool_true} NOT NULL,
                        created_at {dt_type},
                        updated_at {dt_type},
                        FOREIGN KEY (manager_id) REFERENCES employees (id) ON DELETE CASCADE,
                        FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE CASCADE
                    )
                """))
            print("[MIGRATION] Created 'manager_feedbacks' table successfully.")
        else:
            print("[MIGRATION] Table 'manager_feedbacks' schema verified.")

        # 13. Migrate manager_recommendations table
        if 'manager_recommendations' not in tables:
            with engine.begin() as conn:
                conn.execute(text(f"""
                    CREATE TABLE IF NOT EXISTS manager_recommendations (
                        id {pk_type},
                        manager_id INTEGER NOT NULL,
                        employee_id INTEGER NOT NULL,
                        role_id INTEGER NOT NULL,
                        suitability_score FLOAT,
                        readiness_level VARCHAR(30),
                        strengths_summary TEXT,
                        development_needs TEXT,
                        recommendation_notes TEXT,
                        status VARCHAR(30) DEFAULT 'Submitted' NOT NULL,
                        hr_feedback TEXT,
                        reviewed_by INTEGER,
                        reviewed_at {dt_type},
                        created_at {dt_type},
                        updated_at {dt_type},
                        FOREIGN KEY (manager_id) REFERENCES employees (id) ON DELETE CASCADE,
                        FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE CASCADE,
                        FOREIGN KEY (role_id) REFERENCES leadership_roles (id) ON DELETE CASCADE,
                        FOREIGN KEY (reviewed_by) REFERENCES users (id) ON DELETE SET NULL
                    )
                """))
            print("[MIGRATION] Created 'manager_recommendations' table successfully.")
        else:
            print("[MIGRATION] Table 'manager_recommendations' schema verified.")

        # 14. Migrate performance_reviews table
        if 'performance_reviews' not in tables:
            with engine.begin() as conn:
                conn.execute(text(f"""
                    CREATE TABLE IF NOT EXISTS performance_reviews (
                        id {pk_type},
                        manager_id INTEGER NOT NULL,
                        employee_id INTEGER NOT NULL,
                        rating FLOAT NOT NULL,
                        review_period VARCHAR(50),
                        review_notes TEXT,
                        review_date VARCHAR(50),
                        created_at {dt_type},
                        FOREIGN KEY (manager_id) REFERENCES employees (id) ON DELETE CASCADE,
                        FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE CASCADE
                    )
                """))
            print("[MIGRATION] Created 'performance_reviews' table successfully.")
        else:
            print("[MIGRATION] Table 'performance_reviews' schema verified.")

        # 15. Migrate manager_vacancies table
        if 'manager_vacancies' not in tables:
            with engine.begin() as conn:
                conn.execute(text(f"""
                    CREATE TABLE IF NOT EXISTS manager_vacancies (
                        id {pk_type},
                        role_id INTEGER NOT NULL,
                        departing_manager_id INTEGER NOT NULL,
                        effective_departure_date VARCHAR(50) NOT NULL,
                        reason VARCHAR(255),
                        status VARCHAR(30) DEFAULT 'Open' NOT NULL,
                        appointed_employee_id INTEGER,
                        appointed_by_user_id INTEGER,
                        appointed_at {dt_type},
                        appointment_notes TEXT,
                        created_at {dt_type},
                        updated_at {dt_type},
                        FOREIGN KEY (role_id) REFERENCES leadership_roles (id),
                        FOREIGN KEY (departing_manager_id) REFERENCES employees (id),
                        FOREIGN KEY (appointed_employee_id) REFERENCES employees (id) ON DELETE SET NULL,
                        FOREIGN KEY (appointed_by_user_id) REFERENCES users (id) ON DELETE SET NULL
                    )
                """))
            print("[MIGRATION] Created 'manager_vacancies' table successfully.")
        else:
            print("[MIGRATION] Table 'manager_vacancies' schema verified.")

        # 16. Migrate vacancy_decisions table
        if 'vacancy_decisions' not in tables:
            with engine.begin() as conn:
                conn.execute(text(f"""
                    CREATE TABLE IF NOT EXISTS vacancy_decisions (
                        id {pk_type},
                        vacancy_id INTEGER NOT NULL,
                        employee_id INTEGER NOT NULL,
                        reviewer_user_id INTEGER,
                        action VARCHAR(50) NOT NULL,
                        comments TEXT,
                        created_at {dt_type},
                        FOREIGN KEY (vacancy_id) REFERENCES manager_vacancies (id) ON DELETE CASCADE,
                        FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE CASCADE,
                        FOREIGN KEY (reviewer_user_id) REFERENCES users (id) ON DELETE SET NULL
                    )
                """))
            print("[MIGRATION] Created 'vacancy_decisions' table successfully.")
        else:
            print("[MIGRATION] Table 'vacancy_decisions' schema verified.")

        # 17. Auditable verification of trusted administrative roles
        audit_and_sync_trusted_users(engine)

        print("[MIGRATION] Database schema migration check completed successfully.")

    except Exception as e:
        print(f"[WARNING] Schema migration check failed or skipped: {str(e)}")

def audit_and_sync_trusted_users(engine):
    """
    Idempotently verifies and audit-corrects trusted administrative and manager accounts
    configured in Config.TRUSTED_ROLE_MAPPINGS across both SQLite and PostgreSQL.
    Ensures pre-authorized accounts are never stuck in 'Pending' status.
    """
    from sqlalchemy import text
    from config import Config
    try:
        with engine.begin() as conn:
            for email, config in Config.TRUSTED_ROLE_MAPPINGS.items():
                target_role = config["default_role"]
                target_username = config.get("username", "")

                # 1. Correct any existing record with this email that is stuck in Pending or wrong role
                conn.execute(text("""
                    UPDATE users 
                    SET status = 'Active', role = :role, oauth_email = :email
                    WHERE (LOWER(TRIM(email)) = :email OR LOWER(TRIM(oauth_email)) = :email)
                      AND (status != 'Active' OR role NOT IN ('HR', 'Manager', 'Admin'))
                """), {"role": target_role, "email": email.lower()})

                # 2. Link demo/standard user by username if oauth_email is unlinked
                if target_username:
                    conn.execute(text("""
                        UPDATE users
                        SET oauth_email = :email, status = 'Active'
                        WHERE LOWER(TRIM(username)) = :uname AND (oauth_email IS NULL OR oauth_email = '')
                    """), {"email": email.lower(), "uname": target_username.lower()})

        print("[MIGRATION] Authoritative trusted role mappings audited and synchronized.")
    except Exception as e:
        print(f"[WARNING] Trusted role audit notice: {str(e)}")


