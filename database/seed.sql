-- Enterprise Succession Planning Seed Data
-- DEMO / SAMPLE DATA FOR COLLEGE PROJECT DEMONSTRATION

USE succession_planning;

-- Clear existing data
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE ml_predictions;
TRUNCATE TABLE successor_results;
TRUNCATE TABLE assessments;
TRUNCATE TABLE employee_competencies;
TRUNCATE TABLE role_competencies;
TRUNCATE TABLE competencies;
TRUNCATE TABLE leadership_roles;
TRUNCATE TABLE employees;
TRUNCATE TABLE users;
SET FOREIGN_KEY_CHECKS = 1;

-- 1. Demo User Credentials (admin / admin123 hashed via PBKDF2/Werkzeug)
-- Werkzeug pbkdf2:sha256 hash for 'admin123':
-- pbkdf2:sha256:600000$Wv9g1358$54ed08889c670a45be201654877f1dfef8e3aa7f603c4001dd2293444fb91e0a
INSERT INTO users (id, username, password_hash, role) VALUES 
(1, 'admin', 'pbkdf2:sha256:260000$9j2K8xmL$6b80bc8d488eef0d56b2f7247a34e803c004a2ed7a6c9cf1c65b1b46328bc6e8', 'Admin');

-- 2. Competencies (8 Default Leadership Competencies)
INSERT INTO competencies (id, name, description) VALUES 
(1, 'Leadership', 'Ability to guide, motivate, and direct teams toward organizational goals'),
(2, 'Communication', 'Clear and persuasive expression of ideas across executive and technical teams'),
(3, 'Decision Making', 'Data-driven and decisive action taking in critical business scenarios'),
(4, 'Team Management', 'Effective resource allocation, conflict resolution, and performance mentoring'),
(5, 'Strategic Thinking', 'Long-term planning, vision formulation, and market analysis'),
(6, 'Problem Solving', 'Analytical troubleshooting and innovation under high pressure'),
(7, 'Adaptability', 'Flexibility in adjusting strategies to market changes and agile transformations'),
(8, 'Technical Knowledge', 'Deep operational and technical domain expertise');

-- 3. Leadership Roles (5 Roles)
INSERT INTO leadership_roles (id, role_name, department, description) VALUES 
(1, 'Project Manager', 'Information Technology', 'Oversees delivery of software engineering projects, budget, and scope'),
(2, 'Team Lead', 'Engineering', 'Leads technical team execution, code reviews, and developer growth'),
(3, 'Department Manager', 'Operations', 'Directs operational strategies, resource distribution, and KPI targets'),
(4, 'Technical Lead', 'Information Technology', 'Architects technical solutions and mentors senior engineering staff'),
(5, 'Operations Manager', 'Human Resources', 'Manages HR workflows, succession strategies, and talent pipelines');

-- 4. Role Competency Requirements (Target Scores for Each Role)
-- Role 1: Project Manager
INSERT INTO role_competencies (role_id, competency_id, required_score) VALUES
(1, 1, 90.0), (1, 2, 90.0), (1, 3, 85.0), (1, 4, 85.0),
(1, 5, 85.0), (1, 6, 80.0), (1, 7, 80.0), (1, 8, 75.0);

-- Role 2: Team Lead
INSERT INTO role_competencies (role_id, competency_id, required_score) VALUES
(2, 1, 85.0), (2, 2, 85.0), (2, 3, 80.0), (2, 4, 90.0),
(2, 5, 75.0), (2, 6, 85.0), (2, 7, 80.0), (2, 8, 90.0);

-- Role 3: Department Manager
INSERT INTO role_competencies (role_id, competency_id, required_score) VALUES
(3, 1, 95.0), (3, 2, 90.0), (3, 3, 90.0), (3, 4, 90.0),
(3, 5, 95.0), (3, 6, 85.0), (3, 7, 85.0), (3, 8, 70.0);

-- Role 4: Technical Lead
INSERT INTO role_competencies (role_id, competency_id, required_score) VALUES
(4, 1, 80.0), (4, 2, 80.0), (4, 3, 85.0), (4, 4, 80.0),
(4, 5, 85.0), (4, 6, 95.0), (4, 7, 85.0), (4, 8, 95.0);

-- Role 5: Operations Manager
INSERT INTO role_competencies (role_id, competency_id, required_score) VALUES
(5, 1, 90.0), (5, 2, 95.0), (5, 3, 85.0), (5, 4, 85.0),
(5, 5, 85.0), (5, 6, 80.0), (5, 7, 90.0), (5, 8, 70.0);

-- 5. 20 Sample Employees
INSERT INTO employees (id, employee_code, name, email, department, designation, experience_years, performance_score, leadership_score) VALUES
(1, 'EMP001', 'Arun Kumar', 'arun.kumar@company.com', 'Information Technology', 'Senior Developer', 6.5, 88.0, 82.0),
(2, 'EMP002', 'Priya Sharma', 'priya.sharma@company.com', 'Information Technology', 'Module Lead', 8.0, 92.0, 89.0),
(3, 'EMP003', 'Rajesh Patel', 'rajesh.patel@company.com', 'Engineering', 'Senior Systems Analyst', 9.5, 85.0, 78.0),
(4, 'EMP004', 'Sneha Reddy', 'sneha.reddy@company.com', 'Operations', 'Assistant Manager', 7.0, 90.0, 86.0),
(5, 'EMP005', 'Vikram Singh', 'vikram.singh@company.com', 'Engineering', 'Lead Software Engineer', 10.0, 95.0, 91.0),
(6, 'EMP006', 'Kavita Joshi', 'kavita.joshi@company.com', 'Human Resources', 'HR Specialist', 5.0, 82.0, 75.0),
(7, 'EMP007', 'Suresh Nair', 'suresh.nair@company.com', 'Information Technology', 'Database Administrator', 8.5, 87.0, 76.0),
(8, 'EMP008', 'Ananya Gupta', 'ananya.gupta@company.com', 'Operations', 'Business Analyst', 4.5, 89.0, 80.0),
(9, 'EMP009', 'Karthik Raja', 'karthik.raja@company.com', 'Engineering', 'Senior QA Lead', 7.5, 84.0, 82.0),
(10, 'EMP010', 'Deepa Venkat', 'deepa.venkat@company.com', 'Human Resources', 'Talent Lead', 6.0, 86.0, 84.0),
(11, 'EMP011', 'Manish Verma', 'manish.verma@company.com', 'Information Technology', 'Cloud Specialist', 5.5, 81.0, 72.0),
(12, 'EMP012', 'Ritu Choudhary', 'ritu.choudhary@company.com', 'Operations', 'Operations Analyst', 4.0, 78.0, 70.0),
(13, 'EMP013', 'Ganesh Iyer', 'ganesh.iyer@company.com', 'Engineering', 'DevOps Architect', 11.0, 94.0, 88.0),
(14, 'EMP014', 'Meera Deshmukh', 'meera.deshmukh@company.com', 'Human Resources', 'HR Business Partner', 9.0, 91.0, 87.0),
(15, 'EMP015', 'Nitin Malhotra', 'nitin.malhotra@company.com', 'Information Technology', 'Senior Full Stack Engineer', 6.0, 86.0, 80.0),
(16, 'EMP016', 'Pooja Agarwal', 'pooja.agarwal@company.com', 'Operations', 'Project Coordinator', 3.5, 75.0, 68.0),
(17, 'EMP017', 'Siddharth Rao', 'siddharth.rao@company.com', 'Engineering', 'Principal Architect', 12.0, 96.0, 94.0),
(18, 'EMP018', 'Divya Saxena', 'divya.saxena@company.com', 'Information Technology', 'Scrum Master', 7.0, 88.0, 85.0),
(19, 'EMP019', 'Amitabh Das', 'amitabh.das@company.com', 'Operations', 'Logistics Lead', 8.5, 83.0, 79.0),
(20, 'EMP020', 'Shweta Kulkarni', 'shweta.kulkarni@company.com', 'Human Resources', 'Staff Development Officer', 5.5, 80.0, 74.0);

-- 6. Employee Competency Scores (20 Employees x 8 Competencies = 160 entries)
-- EMP 1: Arun Kumar
INSERT INTO employee_competencies (employee_id, competency_id, score) VALUES
(1, 1, 78.0), (1, 2, 85.0), (1, 3, 72.0), (1, 4, 80.0), (1, 5, 70.0), (1, 6, 82.0), (1, 7, 85.0), (1, 8, 90.0);
-- EMP 2: Priya Sharma
INSERT INTO employee_competencies (employee_id, competency_id, score) VALUES
(2, 1, 88.0), (2, 2, 92.0), (2, 3, 85.0), (2, 4, 88.0), (2, 5, 84.0), (2, 6, 88.0), (2, 7, 86.0), (2, 8, 85.0);
-- EMP 3: Rajesh Patel
INSERT INTO employee_competencies (employee_id, competency_id, score) VALUES
(3, 1, 76.0), (3, 2, 80.0), (3, 3, 78.0), (3, 4, 75.0), (3, 5, 72.0), (3, 6, 85.0), (3, 7, 78.0), (3, 8, 88.0);
-- EMP 4: Sneha Reddy
INSERT INTO employee_competencies (employee_id, competency_id, score) VALUES
(4, 1, 86.0), (4, 2, 88.0), (4, 3, 84.0), (4, 4, 85.0), (4, 5, 82.0), (4, 6, 80.0), (4, 7, 88.0), (4, 8, 75.0);
-- EMP 5: Vikram Singh
INSERT INTO employee_competencies (employee_id, competency_id, score) VALUES
(5, 1, 92.0), (5, 2, 90.0), (5, 3, 88.0), (5, 4, 90.0), (5, 5, 88.0), (5, 6, 94.0), (5, 7, 88.0), (5, 8, 95.0);
-- EMP 6: Kavita Joshi
INSERT INTO employee_competencies (employee_id, competency_id, score) VALUES
(6, 1, 74.0), (6, 2, 82.0), (6, 3, 70.0), (6, 4, 76.0), (6, 5, 68.0), (6, 6, 72.0), (6, 7, 80.0), (6, 8, 65.0);
-- EMP 7: Suresh Nair
INSERT INTO employee_competencies (employee_id, competency_id, score) VALUES
(7, 1, 75.0), (7, 2, 78.0), (7, 3, 76.0), (7, 4, 72.0), (7, 5, 70.0), (7, 6, 86.0), (7, 7, 75.0), (7, 8, 92.0);
-- EMP 8: Ananya Gupta
INSERT INTO employee_competencies (employee_id, competency_id, score) VALUES
(8, 1, 80.0), (8, 2, 86.0), (8, 3, 82.0), (8, 4, 80.0), (8, 5, 78.0), (8, 6, 84.0), (8, 7, 85.0), (8, 8, 72.0);
-- EMP 9: Karthik Raja
INSERT INTO employee_competencies (employee_id, competency_id, score) VALUES
(9, 1, 82.0), (9, 2, 80.0), (9, 3, 78.0), (9, 4, 84.0), (9, 5, 75.0), (9, 6, 88.0), (9, 7, 82.0), (9, 8, 86.0);
-- EMP 10: Deepa Venkat
INSERT INTO employee_competencies (employee_id, competency_id, score) VALUES
(10, 1, 84.0), (10, 2, 88.0), (10, 3, 80.0), (10, 4, 82.0), (10, 5, 80.0), (10, 6, 78.0), (10, 7, 86.0), (10, 8, 70.0);
-- EMP 11: Manish Verma
INSERT INTO employee_competencies (employee_id, competency_id, score) VALUES
(11, 1, 70.0), (11, 2, 75.0), (11, 3, 68.0), (11, 4, 72.0), (11, 5, 65.0), (11, 6, 80.0), (11, 7, 76.0), (11, 8, 88.0);
-- EMP 12: Ritu Choudhary
INSERT INTO employee_competencies (employee_id, competency_id, score) VALUES
(12, 1, 68.0), (12, 2, 74.0), (12, 3, 65.0), (12, 4, 70.0), (12, 5, 62.0), (12, 6, 70.0), (12, 7, 72.0), (12, 8, 68.0);
-- EMP 13: Ganesh Iyer
INSERT INTO employee_competencies (employee_id, competency_id, score) VALUES
(13, 1, 88.0), (13, 2, 85.0), (13, 3, 86.0), (13, 4, 84.0), (13, 5, 82.0), (13, 6, 92.0), (13, 7, 84.0), (13, 8, 94.0);
-- EMP 14: Meera Deshmukh
INSERT INTO employee_competencies (employee_id, competency_id, score) VALUES
(14, 1, 87.0), (14, 2, 92.0), (14, 3, 85.0), (14, 4, 88.0), (14, 5, 86.0), (14, 6, 82.0), (14, 7, 88.0), (14, 8, 72.0);
-- EMP 15: Nitin Malhotra
INSERT INTO employee_competencies (employee_id, competency_id, score) VALUES
(15, 1, 78.0), (15, 2, 80.0), (15, 3, 75.0), (15, 4, 76.0), (15, 5, 72.0), (15, 6, 84.0), (15, 7, 80.0), (15, 8, 90.0);
-- EMP 16: Pooja Agarwal
INSERT INTO employee_competencies (employee_id, competency_id, score) VALUES
(16, 1, 65.0), (16, 2, 72.0), (16, 3, 64.0), (16, 4, 66.0), (16, 5, 60.0), (16, 6, 68.0), (16, 7, 70.0), (16, 8, 65.0);
-- EMP 17: Siddharth Rao
INSERT INTO employee_competencies (employee_id, competency_id, score) VALUES
(17, 1, 94.0), (17, 2, 92.0), (17, 3, 92.0), (17, 4, 90.0), (17, 5, 94.0), (17, 6, 96.0), (17, 7, 90.0), (17, 8, 96.0);
-- EMP 18: Divya Saxena
INSERT INTO employee_competencies (employee_id, competency_id, score) VALUES
(18, 1, 85.0), (18, 2, 90.0), (18, 3, 82.0), (18, 4, 88.0), (18, 5, 80.0), (18, 6, 82.0), (18, 7, 86.0), (18, 8, 78.0);
-- EMP 19: Amitabh Das
INSERT INTO employee_competencies (employee_id, competency_id, score) VALUES
(19, 1, 78.0), (19, 2, 82.0), (19, 3, 76.0), (19, 4, 80.0), (19, 5, 74.0), (19, 6, 78.0), (19, 7, 82.0), (19, 8, 70.0);
-- EMP 20: Shweta Kulkarni
INSERT INTO employee_competencies (employee_id, competency_id, score) VALUES
(20, 1, 74.0), (20, 2, 80.0), (20, 3, 72.0), (20, 4, 75.0), (20, 5, 70.0), (20, 6, 74.0), (20, 7, 78.0), (20, 8, 68.0);

-- 7. Sample Initial Assessments
INSERT INTO assessments (employee_id, role_id, overall_score, readiness_level) VALUES
(1, 1, 80.5, 'High'),
(2, 1, 87.2, 'High'),
(5, 2, 91.8, 'High'),
(17, 3, 93.6, 'High'),
(4, 5, 83.4, 'High');

-- 8. Sample Initial Successor Results
INSERT INTO successor_results (employee_id, role_id, competency_score, performance_score, experience_score, leadership_score, readiness_score, readiness_level, major_gap) VALUES
(2, 1, 87.0, 92.0, 80.0, 89.0, 87.6, 'High', 'Strategic Thinking'),
(1, 1, 79.25, 88.0, 65.0, 82.0, 80.85, 'High', 'Strategic Thinking'),
(5, 2, 90.25, 95.0, 100.0, 91.0, 93.05, 'High', 'Communication'),
(17, 3, 93.75, 96.0, 100.0, 94.0, 95.3, 'High', 'Technical Knowledge'),
(4, 5, 83.75, 90.0, 70.0, 86.0, 83.7, 'High', 'Decision Making');

-- 9. Sample Initial ML Predictions
INSERT INTO ml_predictions (employee_id, role_id, predicted_class, high_probability, medium_probability, low_probability) VALUES
(2, 1, 'High', 0.8800, 0.1000, 0.0200),
(1, 1, 'High', 0.8100, 0.1600, 0.0300),
(5, 2, 'High', 0.9500, 0.0400, 0.0100),
(17, 3, 'High', 0.9700, 0.0200, 0.0100);
