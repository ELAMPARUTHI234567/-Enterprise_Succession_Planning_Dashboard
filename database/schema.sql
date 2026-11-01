-- Enterprise Succession Planning Dashboard Database Schema
-- Database: succession_planning

CREATE DATABASE IF NOT EXISTS succession_planning;
USE succession_planning;

-- 1. Users Table (Authentication & RBAC)
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100),
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'Employee' NOT NULL, -- 'HR', 'Manager', 'Employee'
    status VARCHAR(20) DEFAULT 'Active' NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Employees Table
CREATE TABLE IF NOT EXISTS employees (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    employee_code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    department VARCHAR(50) NOT NULL,
    designation VARCHAR(50) NOT NULL,
    manager_id INT,
    experience_years DECIMAL(4,1) NOT NULL DEFAULT 0.0,
    performance_score DECIMAL(5,2) NOT NULL DEFAULT 0.0,
    leadership_score DECIMAL(5,2) NOT NULL DEFAULT 0.0,
    availability_status VARCHAR(20) DEFAULT 'Available' NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (manager_id) REFERENCES employees(id) ON DELETE SET NULL
);

-- 3. Leadership Roles Table
CREATE TABLE IF NOT EXISTS leadership_roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    role_name VARCHAR(100) NOT NULL UNIQUE,
    department VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Competencies Table
CREATE TABLE IF NOT EXISTS competencies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Role Competencies Table (Target Required Scores)
CREATE TABLE IF NOT EXISTS role_competencies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    role_id INT NOT NULL,
    competency_id INT NOT NULL,
    required_score DECIMAL(5,2) NOT NULL DEFAULT 80.0,
    FOREIGN KEY (role_id) REFERENCES leadership_roles(id) ON DELETE CASCADE,
    FOREIGN KEY (competency_id) REFERENCES competencies(id) ON DELETE CASCADE,
    UNIQUE KEY unique_role_comp (role_id, competency_id)
);

-- 6. Employee Competencies Table (Current Scores 0-100)
CREATE TABLE IF NOT EXISTS employee_competencies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id INT NOT NULL,
    competency_id INT NOT NULL,
    score DECIMAL(5,2) NOT NULL DEFAULT 0.0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (competency_id) REFERENCES competencies(id) ON DELETE CASCADE,
    UNIQUE KEY unique_emp_comp (employee_id, competency_id)
);

-- 7. Assessments Table
CREATE TABLE IF NOT EXISTS assessments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(150) NOT NULL,
    description TEXT,
    created_by INT,
    role_id INT NOT NULL,
    duration INT DEFAULT 30,
    due_date VARCHAR(50),
    passing_threshold DECIMAL(5,2) DEFAULT 70.0,
    status VARCHAR(20) DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (role_id) REFERENCES leadership_roles(id) ON DELETE CASCADE
);

-- 8. Assessment Questions Table
CREATE TABLE IF NOT EXISTS assessment_questions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    assessment_id INT NOT NULL,
    question TEXT NOT NULL,
    question_type VARCHAR(50) DEFAULT 'Multiple Choice',
    competency_id INT,
    max_score DECIMAL(5,2) DEFAULT 10.0,
    options_json TEXT,
    correct_answer TEXT,
    difficulty VARCHAR(20) DEFAULT 'Medium',
    order_index INT DEFAULT 1,
    FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE,
    FOREIGN KEY (competency_id) REFERENCES competencies(id) ON DELETE SET NULL
);

-- 9. Assessment Assignments Table
CREATE TABLE IF NOT EXISTS assessment_assignments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    assessment_id INT NOT NULL,
    employee_id INT NOT NULL,
    assigned_by INT,
    assigned_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    due_date VARCHAR(50),
    status VARCHAR(20) DEFAULT 'Assigned',
    instructions TEXT,
    scheduled_date VARCHAR(20),
    start_time VARCHAR(10),
    duration_minutes INT,
    end_time VARCHAR(10),
    time_zone VARCHAR(50) DEFAULT 'UTC',
    scheduled_start_datetime TIMESTAMP NULL,
    scheduled_end_datetime TIMESTAMP NULL,
    actual_start_time TIMESTAMP NULL,
    submission_deadline TIMESTAMP NULL,
    submitted_at TIMESTAMP NULL,
    schedule_status VARCHAR(30) DEFAULT 'Scheduled',
    attempt_number INT DEFAULT 1,
    FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL
);

-- 9b. Assignment Questions Table (Attempt-Specific Role Questions)
CREATE TABLE IF NOT EXISTS assignment_questions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    assignment_id INT NOT NULL,
    question_bank_id INT,
    question TEXT NOT NULL,
    question_type VARCHAR(50) DEFAULT 'Multiple Choice' NOT NULL,
    competency_id INT,
    max_score DECIMAL(5,2) DEFAULT 10.0 NOT NULL,
    options_json TEXT NOT NULL,
    correct_answer VARCHAR(10) NOT NULL,
    explanation TEXT,
    difficulty VARCHAR(20) DEFAULT 'Medium' NOT NULL,
    order_index INT DEFAULT 1 NOT NULL,
    FOREIGN KEY (assignment_id) REFERENCES assessment_assignments(id) ON DELETE CASCADE,
    FOREIGN KEY (question_bank_id) REFERENCES question_bank(id) ON DELETE SET NULL,
    FOREIGN KEY (competency_id) REFERENCES competencies(id) ON DELETE SET NULL
);

-- 10. Assessment Answers Table
CREATE TABLE IF NOT EXISTS assessment_answers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    assignment_id INT NOT NULL,
    question_id INT NOT NULL,
    assignment_question_id INT,
    answer TEXT NOT NULL,
    score DECIMAL(5,2) DEFAULT 0.0,
    FOREIGN KEY (assignment_id) REFERENCES assessment_assignments(id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES assessment_questions(id) ON DELETE CASCADE,
    FOREIGN KEY (assignment_question_id) REFERENCES assignment_questions(id) ON DELETE CASCADE
);

-- 11. Assessment Results Table
CREATE TABLE IF NOT EXISTS assessment_results (
    id INT AUTO_INCREMENT PRIMARY KEY,
    assignment_id INT NOT NULL,
    overall_score DECIMAL(5,2) NOT NULL,
    readiness_level VARCHAR(20) NOT NULL,
    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    detail_json TEXT,
    FOREIGN KEY (assignment_id) REFERENCES assessment_assignments(id) ON DELETE CASCADE
);

-- 12. Successor Results Table
CREATE TABLE IF NOT EXISTS successor_results (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id INT NOT NULL,
    role_id INT NOT NULL,
    competency_score DECIMAL(5,2) NOT NULL,
    performance_score DECIMAL(5,2) NOT NULL,
    experience_score DECIMAL(5,2) NOT NULL,
    leadership_score DECIMAL(5,2) NOT NULL,
    readiness_score DECIMAL(5,2) NOT NULL,
    readiness_level VARCHAR(20) NOT NULL,
    major_gap VARCHAR(100) DEFAULT 'None',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES leadership_roles(id) ON DELETE CASCADE
);

-- 13. AI Recommendations Table
CREATE TABLE IF NOT EXISTS ai_recommendations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id INT NOT NULL,
    role_id INT NOT NULL,
    recommendation_type VARCHAR(50) DEFAULT 'Competency Analysis',
    recommendation_text TEXT NOT NULL,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES leadership_roles(id) ON DELETE CASCADE
);

-- 14. Team Tasks Table (Dynamic Manager Task & Assignment Tracking)
CREATE TABLE IF NOT EXISTS team_tasks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    manager_id INT NOT NULL,
    employee_id INT NOT NULL,
    project_id INT,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    priority VARCHAR(20) DEFAULT 'Medium' NOT NULL,
    start_date VARCHAR(50),
    due_date VARCHAR(50),
    status VARCHAR(30) DEFAULT 'Pending' NOT NULL,
    completed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (manager_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES employee_projects(id) ON DELETE SET NULL
);

-- 15. Team Goals Table (Measurable Targets & Progress)
CREATE TABLE IF NOT EXISTS team_goals (
    id INT AUTO_INCREMENT PRIMARY KEY,
    manager_id INT NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    target_metric DECIMAL(8,2) DEFAULT 100.0 NOT NULL,
    current_metric DECIMAL(8,2) DEFAULT 0.0 NOT NULL,
    metric_unit VARCHAR(50) DEFAULT '%' NOT NULL,
    target_date VARCHAR(50),
    status VARCHAR(30) DEFAULT 'On Track' NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (manager_id) REFERENCES employees(id) ON DELETE CASCADE
);

-- 16. Team Issues and Blockers Table
CREATE TABLE IF NOT EXISTS team_issues (
    id INT AUTO_INCREMENT PRIMARY KEY,
    manager_id INT NOT NULL,
    employee_id INT,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    severity VARCHAR(20) DEFAULT 'Medium' NOT NULL,
    status VARCHAR(30) DEFAULT 'Open' NOT NULL,
    resolution_notes TEXT,
    resolved_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (manager_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL
);

-- 17. Manager Feedbacks Table (Development & Follow-up Tracking)
CREATE TABLE IF NOT EXISTS manager_feedbacks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    manager_id INT NOT NULL,
    employee_id INT NOT NULL,
    feedback_date VARCHAR(50),
    strengths TEXT,
    improvement_areas TEXT,
    development_plan TEXT,
    follow_up_status VARCHAR(30) DEFAULT 'Scheduled' NOT NULL,
    is_private BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (manager_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

-- 18. Manager Recommendations Table (Submitted to HR for Succession)
CREATE TABLE IF NOT EXISTS manager_recommendations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    manager_id INT NOT NULL,
    employee_id INT NOT NULL,
    role_id INT NOT NULL,
    suitability_score DECIMAL(5,2),
    readiness_level VARCHAR(30),
    strengths_summary TEXT,
    development_needs TEXT,
    recommendation_notes TEXT,
    status VARCHAR(30) DEFAULT 'Submitted' NOT NULL,
    hr_feedback TEXT,
    reviewed_by INT,
    reviewed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (manager_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES leadership_roles(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
);

-- 19. Performance Reviews Table
CREATE TABLE IF NOT EXISTS performance_reviews (
    id INT AUTO_INCREMENT PRIMARY KEY,
    manager_id INT NOT NULL,
    employee_id INT NOT NULL,
    rating DECIMAL(5,2) NOT NULL,
    review_period VARCHAR(50),
    review_notes TEXT,
    review_date VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (manager_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

