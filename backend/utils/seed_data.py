from extensions import db
from models.user import User
from models.employee import Employee
from models.role import LeadershipRole
from models.competency import Competency
from models.role_competency import RoleCompetency
from models.employee_competency import EmployeeCompetency
from models.assessment import Assessment, AssessmentQuestion, AssessmentAssignment, AssessmentAnswer, AssessmentResult
from models.successor_result import SuccessorResult
from models.ml_prediction import MLPrediction
import os
from config import Config
from utils.seed_question_bank import seed_question_bank

def seed_database_if_empty():
    """
    Populates database with initial demonstration accounts (HR, Manager, Employee),
    20 sample employees, leadership roles, competencies, sample assessments, questions, and assignments.
    Only runs in local development environment when empty. Never in production.
    """
    if Config.IS_PRODUCTION or os.getenv("DISABLE_DEMO_SEEDING", "false").lower() == "true":
        print("[INFO] Production mode detected or demo seeding disabled. Skipping demo data creation.")
        seed_question_bank()
        return

    if User.query.first() is not None:
        print("[INFO] Database already contains data. Verifying built-in Question Bank & enhanced modules...")
        seed_question_bank()
        seed_enhanced_modules_baseline()
        return

    print("[INFO] Seeding initial demonstration data into database...")

    # 1. Demo User Accounts (HR, Manager, Employee, Admin)
    hr_user = User(name="Sarah Jenkins (HR Director)", username="hr", email="hr@company.com", role="HR", status="Active")
    hr_user.set_password("hr123")
    
    mgr_user = User(name="Sneha Reddy (Engineering Manager)", username="manager", email="manager@company.com", role="Manager", status="Active")
    mgr_user.set_password("manager123")

    emp_user = User(name="Arun Kumar (Senior Developer)", username="employee", email="employee@company.com", role="Employee", status="Active")
    emp_user.set_password("employee123")

    admin_user = User(name="System Administrator", username="admin", email="admin@company.com", role="HR", status="Active")
    admin_user.set_password("admin123")

    db.session.add_all([hr_user, mgr_user, emp_user, admin_user])
    db.session.commit()

    # 2. Competencies
    comp_data = [
        ("Leadership", "Ability to guide, motivate, and direct teams toward organizational goals"),
        ("Communication", "Clear and persuasive expression of ideas across executive and technical teams"),
        ("Decision Making", "Data-driven and decisive action taking in critical business scenarios"),
        ("Team Management", "Effective resource allocation, conflict resolution, and performance mentoring"),
        ("Strategic Thinking", "Long-term planning, vision formulation, and market analysis"),
        ("Problem Solving", "Analytical troubleshooting and innovation under high pressure"),
        ("Adaptability", "Flexibility in adjusting strategies to market changes and agile transformations"),
        ("Technical Knowledge", "Deep operational and technical domain expertise")
    ]
    competencies = []
    for name, desc in comp_data:
        c = Competency(name=name, description=desc)
        db.session.add(c)
        competencies.append(c)
    
    db.session.commit()

    # 3. Leadership Roles
    role_data = [
        ("Project Manager", "Information Technology", "Oversees delivery of software engineering projects, budget, and scope"),
        ("Team Lead", "Engineering", "Leads technical team execution, code reviews, and developer growth"),
        ("Department Manager", "Operations", "Directs operational strategies, resource distribution, and KPI targets"),
        ("Technical Lead", "Information Technology", "Architects technical solutions and mentors senior engineering staff"),
        ("Operations Manager", "Human Resources", "Manages HR workflows, succession strategies, and talent pipelines")
    ]
    roles = []
    for rname, rdept, rdesc in role_data:
        r = LeadershipRole(role_name=rname, department=rdept, description=rdesc)
        db.session.add(r)
        roles.append(r)

    db.session.commit()

    # 4. Role Competencies Requirements
    # Project Manager (Role 1)
    pm_reqs = [90, 90, 85, 85, 85, 80, 80, 75]
    for cid, req in enumerate(pm_reqs, start=1):
        db.session.add(RoleCompetency(role_id=1, competency_id=cid, required_score=req))

    # Team Lead (Role 2)
    tl_reqs = [85, 85, 80, 90, 75, 85, 80, 90]
    for cid, req in enumerate(tl_reqs, start=1):
        db.session.add(RoleCompetency(role_id=2, competency_id=cid, required_score=req))

    # Dept Manager (Role 3)
    dm_reqs = [95, 90, 90, 90, 95, 85, 85, 70]
    for cid, req in enumerate(dm_reqs, start=1):
        db.session.add(RoleCompetency(role_id=3, competency_id=cid, required_score=req))

    # Tech Lead (Role 4)
    tech_reqs = [80, 80, 85, 80, 85, 95, 85, 95]
    for cid, req in enumerate(tech_reqs, start=1):
        db.session.add(RoleCompetency(role_id=4, competency_id=cid, required_score=req))

    # Operations Manager (Role 5)
    ops_reqs = [90, 95, 85, 85, 85, 80, 90, 70]
    for cid, req in enumerate(ops_reqs, start=1):
        db.session.add(RoleCompetency(role_id=5, competency_id=cid, required_score=req))

    db.session.commit()

    # 5. Employees & Competency Scores
    emp_list = [
        ("EMP001", "Arun Kumar", "arun.kumar@company.com", "Information Technology", "Senior Developer", 6.5, 88.0, 82.0, 'Available', [78, 85, 72, 80, 70, 82, 85, 90], emp_user.id),
        ("EMP002", "Priya Sharma", "priya.sharma@company.com", "Information Technology", "Module Lead", 8.0, 92.0, 89.0, 'Available', [88, 92, 85, 88, 84, 88, 86, 85], None),
        ("EMP003", "Rajesh Patel", "rajesh.patel@company.com", "Engineering", "Senior Systems Analyst", 9.5, 85.0, 78.0, 'Available', [76, 80, 78, 75, 72, 85, 78, 88], None),
        ("EMP004", "Sneha Reddy", "sneha.reddy@company.com", "Operations", "Assistant Manager", 7.0, 90.0, 86.0, 'Available', [86, 88, 84, 85, 82, 80, 88, 75], mgr_user.id),
        ("EMP005", "Vikram Singh", "vikram.singh@company.com", "Engineering", "Lead Software Engineer", 10.0, 95.0, 91.0, 'Available', [92, 90, 88, 90, 88, 94, 88, 95], None),
        ("EMP006", "Kavita Joshi", "kavita.joshi@company.com", "Human Resources", "HR Specialist", 5.0, 82.0, 75.0, 'Available', [74, 82, 70, 76, 68, 72, 80, 65], None),
        ("EMP007", "Suresh Nair", "suresh.nair@company.com", "Information Technology", "Database Administrator", 8.5, 87.0, 76.0, 'Available', [75, 78, 76, 72, 70, 86, 75, 92], None),
        ("EMP008", "Ananya Gupta", "ananya.gupta@company.com", "Operations", "Business Analyst", 4.5, 89.0, 80.0, 'Available', [80, 86, 82, 80, 78, 84, 85, 72], None),
        ("EMP009", "Karthik Raja", "karthik.raja@company.com", "Engineering", "Senior QA Lead", 7.5, 84.0, 82.0, 'Available', [82, 80, 78, 84, 75, 88, 82, 86], None),
        ("EMP010", "Deepa Venkat", "deepa.venkat@company.com", "Human Resources", "Talent Lead", 6.0, 86.0, 84.0, 'Available', [84, 88, 80, 82, 80, 78, 86, 70], None),
        ("EMP011", "Manish Verma", "manish.verma@company.com", "Information Technology", "Cloud Specialist", 5.5, 81.0, 72.0, 'Available', [70, 75, 68, 72, 65, 80, 76, 88], None),
        ("EMP012", "Ritu Choudhary", "ritu.choudhary@company.com", "Operations", "Operations Analyst", 4.0, 78.0, 70.0, 'Available', [68, 74, 65, 70, 62, 70, 72, 68], None),
        ("EMP013", "Ganesh Iyer", "ganesh.iyer@company.com", "Engineering", "DevOps Architect", 11.0, 94.0, 88.0, 'Available', [88, 85, 86, 84, 82, 92, 84, 94], None),
        ("EMP014", "Meera Deshmukh", "meera.deshmukh@company.com", "Human Resources", "HR Business Partner", 9.0, 91.0, 87.0, 'Available', [87, 92, 85, 88, 86, 82, 88, 72], None),
        ("EMP015", "Nitin Malhotra", "nitin.malhotra@company.com", "Information Technology", "Senior Full Stack Engineer", 6.0, 86.0, 80.0, 'Available', [78, 80, 75, 76, 72, 84, 80, 90], None),
        ("EMP016", "Pooja Agarwal", "pooja.agarwal@company.com", "Operations", "Project Coordinator", 3.5, 75.0, 68.0, 'Available', [65, 72, 64, 66, 60, 68, 70, 65], None),
        ("EMP017", "Siddharth Rao", "siddharth.rao@company.com", "Engineering", "Principal Architect", 12.0, 96.0, 94.0, 'Available', [94, 92, 92, 90, 94, 96, 90, 96], None),
        ("EMP018", "Divya Saxena", "divya.saxena@company.com", "Information Technology", "Scrum Master", 7.0, 88.0, 85.0, 'Available', [85, 90, 82, 88, 80, 82, 86, 78], None),
        ("EMP019", "Amitabh Das", "amitabh.das@company.com", "Operations", "Logistics Lead", 8.5, 83.0, 79.0, 'Available', [78, 82, 76, 80, 74, 78, 82, 70], None),
        ("EMP020", "Shweta Kulkarni", "shweta.kulkarni@company.com", "Human Resources", "Staff Development Officer", 5.5, 80.0, 74.0, 'Available', [74, 80, 72, 75, 70, 74, 78, 68], None)
    ]

    emp_objects = []
    for code, name, email, dept, desig, exp, perf, lead, avail, scores, uid in emp_list:
        emp = Employee(
            employee_code=code,
            name=name,
            email=email,
            department=dept,
            designation=desig,
            experience_years=exp,
            performance_score=perf,
            leadership_score=lead,
            availability_status=avail,
            user_id=uid
        )
        db.session.add(emp)
        db.session.flush()
        emp_objects.append(emp)

        for cid, sc in enumerate(scores, start=1):
            db.session.add(EmployeeCompetency(employee_id=emp.id, competency_id=cid, score=sc))

    db.session.commit()

    # Assign Sneha Reddy (EMP004, ID 4) as Manager for EMP001, EMP002, EMP003, EMP008
    manager_emp_id = emp_objects[3].id # Sneha Reddy
    for idx in [0, 1, 2, 7]:
        emp_objects[idx].manager_id = manager_emp_id

    db.session.commit()

    # 6. Sample Assessments & Questions
    ass1 = Assessment(
        title="Leadership & Conflict Resolution Competency Evaluation",
        description="Comprehensive evaluation assessing decision making, team conflict management, and strategic direction.",
        created_by=hr_user.id,
        role_id=1, # Project Manager
        duration=30,
        due_date="2026-10-15",
        passing_threshold=75.0,
        status="Active"
    )
    db.session.add(ass1)
    db.session.flush()

    q1 = AssessmentQuestion(
        assessment_id=ass1.id,
        question="How would you handle a conflict between two key technical team members over architectural choices?",
        question_type="Multiple Choice",
        competency_id=4, # Team Management
        max_score=10.0,
        correct_answer="B",
        difficulty="Medium",
        order_index=1
    )
    q1.set_options([
        "A. Ignore the issue and let them solve it themselves",
        "B. Facilitate a collaborative discussion, evaluate trade-offs, and reach a data-driven consensus",
        "C. Immediately escalate to executive management without team discussion",
        "D. Reassign the project module to a third employee to avoid conflict"
    ])

    q2 = AssessmentQuestion(
        assessment_id=ass1.id,
        question="When faced with a sudden 20% budget reduction mid-project, what is your primary strategic action?",
        question_type="Multiple Choice",
        competency_id=5, # Strategic Thinking
        max_score=10.0,
        correct_answer="B",
        difficulty="Hard",
        order_index=2
    )
    q2.set_options([
        "A. Immediately halt all ongoing development and wait for new funds",
        "B. Re-prioritize project backlog with stakeholders, focusing on high-ROI core features",
        "C. Reduce quality assurance testing to meet budget constraints",
        "D. Ask team members to work unpaid overtime to deliver the full scope"
    ])

    q3 = AssessmentQuestion(
        assessment_id=ass1.id,
        question="A key milestone is at risk of missing the deadline due to unforeseen technical debt. How do you communicate this to executive leadership?",
        question_type="Multiple Choice",
        competency_id=2, # Communication
        max_score=10.0,
        correct_answer="A",
        difficulty="Medium",
        order_index=3
    )
    q3.set_options([
        "A. Provide early notice with an objective risk analysis, impact assessment, and proposed mitigation plan",
        "B. Wait until the deadline passes and explain why the technical debt caused the delay",
        "C. Downplay the risk and assure stakeholders that everything will be on time regardless",
        "D. Blame the engineering team for underestimated estimates"
    ])

    q4 = AssessmentQuestion(
        assessment_id=ass1.id,
        question="How do you balance technical excellence with team morale and burnout prevention during critical project phases?",
        question_type="Multiple Choice",
        competency_id=1, # Leadership
        max_score=10.0,
        correct_answer="A",
        difficulty="Medium",
        order_index=4
    )
    q4.set_options([
        "A. Establish clear priorities, enable continuous feedback, and provide realistic milestone targets",
        "B. Enforce strict mandatory weekend overtime without workload adjustments",
        "C. Lower code quality standards permanently to eliminate delivery pressure",
        "D. Avoid monitoring team workload and let individuals manage burnout on their own"
    ])

    db.session.add_all([q1, q2, q3, q4])
    db.session.commit()

    # 7. Assign Assessment to Employee 1 (Arun Kumar)
    assignment1 = AssessmentAssignment(
        assessment_id=ass1.id,
        employee_id=emp_objects[0].id, # Arun Kumar
        assigned_by=mgr_user.id,
        due_date="2026-10-15",
        status="Assigned",
        instructions="Complete this assessment to evaluate your readiness for the Project Manager leadership role."
    )

    # Completed assignment example for employee 2 (Priya Sharma)
    assignment2 = AssessmentAssignment(
        assessment_id=ass1.id,
        employee_id=emp_objects[1].id, # Priya Sharma
        assigned_by=hr_user.id,
        due_date="2026-09-30",
        status="Completed",
        instructions="Complete assessment for readiness pipeline evaluation."
    )
    db.session.add_all([assignment1, assignment2])
    db.session.flush()

    res2 = AssessmentResult(
        assignment_id=assignment2.id,
        overall_score=87.5,
        readiness_level="High",
        detail_json='{"Leadership": 90, "Communication": 92, "Decision Making": 85, "Team Management": 88}'
    )
    db.session.add(res2)

    db.session.commit()
    print("[SUCCESS] Initial demonstration database seed completed successfully!")

    # Auto-sync all employee user accounts
    sync_employee_users()
    # Seed built-in question bank for all leadership roles
    seed_question_bank()

def sync_employee_users():
    """
    Ensures every Employee in the database has an associated User account
    for individual authentication (e.g. arun.kumar, priya.sharma, sneha.reddy).
    Disabled in production to avoid resetting user credentials or generating mock accounts.
    """
    if Config.IS_PRODUCTION or os.getenv("DISABLE_DEMO_SEEDING", "false").lower() == "true":
        print("[INFO] Production mode detected or demo sync disabled. Skipping sync_employee_users.")
        return

    try:
        employees = Employee.query.all()
        created_count = 0

        for emp in employees:
            clean_name = emp.name.lower().strip()
            individual_username = clean_name.replace(' ', '.')
            role = 'Manager' if 'manager' in emp.designation.lower() or 'lead' in emp.designation.lower() else 'Employee'
            pwd = 'manager123' if role == 'Manager' else 'employee123'

            existing_user = None
            if emp.user_id:
                existing_user = User.query.get(emp.user_id)

            if not existing_user:
                existing_user = User.query.filter(
                    (User.username == individual_username) | (User.email == emp.email)
                ).first()

            if existing_user:
                # Synchronize linked account info and ensure status is active without touching existing passwords
                emp.user_id = existing_user.id
                if existing_user.username == 'employee' and emp.name == 'Arun Kumar':
                    existing_user.username = 'arun.kumar'
                    existing_user.email = 'arun.kumar@company.com'
                existing_user.status = 'Active'
                continue

            # Create new individual user account for employee
            user = User(
                name=emp.name,
                username=individual_username,
                email=emp.email,
                role=role,
                status='Active'
            )
            user.set_password(pwd)
            db.session.add(user)
            db.session.flush()

            emp.user_id = user.id
            created_count += 1

        # Also ensure 'arun.kumar' user exists explicitly if not created yet
        arun_user = User.query.filter((User.username == 'arun.kumar') | (User.username == 'employee')).first()
        if arun_user:
            arun_user.status = 'Active'
        else:
            arun_user = User(name="Arun Kumar", username="arun.kumar", email="arun.kumar@company.com", role="Employee", status="Active")
            arun_user.set_password("employee123")
            db.session.add(arun_user)
            created_count += 1

        db.session.commit()
        if created_count > 0:
            print(f"[SUCCESS] Linked/created {created_count} individual employee user accounts.")
    except Exception as e:
        db.session.rollback()
        print(f"[WARNING] Error in sync_employee_users: {str(e)}")

def seed_enhanced_modules_baseline():
    """
    Safely and idempotently populates baseline records for:
    - SuitabilityConfig
    - RoleRequiredSkills
    - Sample EmployeeSkills, EmployeeProjects, EmploymentHistory, and company_joining_date
    """
    try:
        from models.suitability_config import SuitabilityConfig
        from models.role_required_skill import RoleRequiredSkill
        from models.employee_project import EmployeeProject
        from models.employment_history import EmploymentHistory
        from models.employee_skill import EmployeeSkill
        from models.role import LeadershipRole
        from models.employee import Employee

        # 1. Ensure SuitabilityConfig exists
        SuitabilityConfig.get_active_config()

        # 2. Seed RoleRequiredSkills if empty
        if RoleRequiredSkill.query.count() == 0:
            roles = LeadershipRole.query.all()
            role_map = {r.role_name.lower(): r.id for r in roles}

            default_requirements = [
                # Project Manager
                ("project manager", "Project Management", "Leadership & Management", 4, True, 1.2),
                ("project manager", "Communication", "Communication & Soft Skills", 4, True, 1.0),
                ("project manager", "Problem Solving", "Domain Specific", 3, True, 1.0),
                ("project manager", "Agile / Scrum", "Tools & Platforms", 4, False, 0.8),

                # Technical Lead
                ("technical lead", "Python", "Programming Language", 4, True, 1.2),
                ("technical lead", "React.js", "Framework / Library", 3, True, 1.0),
                ("technical lead", "SQL", "Databases", 4, True, 1.0),
                ("technical lead", "Cloud Platforms", "Cloud & DevOps", 3, True, 1.0),
                ("technical lead", "Leadership", "Leadership & Management", 3, False, 0.8),

                # Team Lead
                ("team lead", "Java", "Programming Language", 3, True, 1.0),
                ("team lead", "Team Management", "Leadership & Management", 4, True, 1.2),
                ("team lead", "Communication", "Communication & Soft Skills", 4, True, 1.0),
                ("team lead", "Problem Solving", "Domain Specific", 3, False, 0.8),

                # Department Manager
                ("department manager", "Strategic Thinking", "Leadership & Management", 4, True, 1.2),
                ("department manager", "Budgeting & Operations", "Domain Specific", 3, True, 1.0),
                ("department manager", "Communication", "Communication & Soft Skills", 5, True, 1.0),

                # Operations Manager
                ("operations manager", "Process Optimization", "Domain Specific", 4, True, 1.2),
                ("operations manager", "Team Management", "Leadership & Management", 4, True, 1.0),
                ("operations manager", "Communication", "Communication & Soft Skills", 3, False, 0.8),

                # Frontend developer
                ("frontend developer", "JavaScript", "Programming Language", 4, True, 1.2),
                ("frontend developer", "React.js", "Framework / Library", 4, True, 1.2),
                ("frontend developer", "CSS & Responsive Design", "Framework / Library", 3, True, 1.0),
                ("frontend developer", "Problem Solving", "Domain Specific", 3, False, 0.8),
            ]

            added_skills = 0
            for role_name_key, s_name, cat, min_lvl, is_mand, wt in default_requirements:
                r_id = role_map.get(role_name_key)
                if r_id:
                    db.session.add(RoleRequiredSkill(
                        role_id=r_id,
                        skill_name=s_name,
                        category=cat,
                        min_proficiency_level=min_lvl,
                        is_mandatory=is_mand,
                        weight=wt
                    ))
                    added_skills += 1
            if added_skills > 0:
                db.session.commit()
                print(f"[SUCCESS] Seeded {added_skills} leadership role skill standards.")

        # 3. Seed Employee Joining Dates & Baseline Skills/Projects/History if missing
        employees = Employee.query.all()
        for emp in employees:
            if not emp.company_joining_date:
                offset_years = (emp.id % 4) + 1
                emp.company_joining_date = f"{2025 - offset_years}-03-15"

        db.session.commit()

        # Seed baseline skills for employees if EmployeeSkill is empty
        if EmployeeSkill.query.count() == 0 and employees:
            skills_to_seed = [
                ("Python", "Programming Language", 4, 3.5, 88.0, "Assessment-Verified"),
                ("JavaScript", "Programming Language", 4, 4.0, 92.0, "Assessment-Verified"),
                ("React.js", "Framework / Library", 4, 3.0, 85.0, "Assessment-Verified"),
                ("SQL", "Databases", 4, 4.0, 80.0, "Assessment-Verified"),
                ("Flask", "Framework / Library", 3, 2.5, 75.0, "Self-Reported"),
                ("Project Management", "Leadership & Management", 3, 2.0, None, "Self-Reported"),
                ("Leadership", "Leadership & Management", 3, 2.0, 78.0, "Reviewer-Verified"),
                ("Communication", "Communication & Soft Skills", 4, 4.0, 85.0, "Reviewer-Verified"),
                ("Problem Solving", "Domain Specific", 4, 4.0, 90.0, "Assessment-Verified"),
            ]
            for emp in employees[:10]:
                for s_name, cat, prof, yrs, sc, ver in skills_to_seed:
                    db.session.add(EmployeeSkill(
                        employee_id=emp.id,
                        skill_name=s_name,
                        category=cat,
                        proficiency_level=prof,
                        years_of_experience=yrs,
                        assessment_score=sc,
                        verification_status=ver,
                        evidence_notes="Verified during baseline competency onboarding" if "Verified" in ver else "Self-declared on profile"
                    ))
            db.session.commit()
            print("[SUCCESS] Seeded baseline employee skills.")

        # Seed baseline projects if EmployeeProject is empty
        if EmployeeProject.query.count() == 0 and employees:
            for emp in employees[:8]:
                p1 = EmployeeProject(
                    employee_id=emp.id,
                    project_name="Core Cloud Platform Modernization",
                    description="Migrated monolith workflows to scalable containerized microservices architecture with high availability.",
                    role_responsibilities="Lead architect and technical executor. Designed API gateways and data pipelines.",
                    start_date="2023-01-10",
                    completion_date="2023-11-20",
                    status="Completed",
                    outcomes_kpis="Reduced latency by 35% and infrastructure cost by 22%. 100% SLA maintained.",
                    milestones_completed_pct=95.0,
                    deliverables_accepted_pct=98.0,
                    quality_defect_score=90.0,
                    timeline_adherence_pct=92.0,
                    business_goals_achieved_pct=96.0,
                    success_rate=94.5,
                    verification_status="HR-Verified",
                    supervisor_feedback="Exemplary execution and delivery against tight architectural schedules."
                )
                p1.set_technologies(["Python", "Flask", "Docker", "PostgreSQL", "AWS"])

                p2 = EmployeeProject(
                    employee_id=emp.id,
                    project_name="Real-Time Analytics & Reporting Engine",
                    description="Engineered streaming event pipeline and executive dashboard analytics.",
                    role_responsibilities="Full-stack development, database query optimization, and UI charting.",
                    start_date="2024-02-01",
                    completion_date=None,
                    status="In Progress",
                    outcomes_kpis="Initial milestone delivered. Beta testing with 50 internal stakeholders.",
                    milestones_completed_pct=75.0,
                    deliverables_accepted_pct=80.0,
                    quality_defect_score=85.0,
                    timeline_adherence_pct=80.0,
                    business_goals_achieved_pct=78.0,
                    success_rate=79.5,
                    verification_status="Self-Reported"
                )
                p2.set_technologies(["React.js", "Tailwind CSS", "JavaScript", "Redis"])

                db.session.add_all([p1, p2])
            db.session.commit()
            print("[SUCCESS] Seeded baseline employee project experiences.")

        # Seed baseline employment history if EmploymentHistory is empty
        if EmploymentHistory.query.count() == 0 and employees:
            for emp in employees[:8]:
                h1 = EmploymentHistory(
                    employee_id=emp.id,
                    company_name="Apex Global Technologies",
                    designation="Software Engineer",
                    start_date="2019-06-01",
                    end_date="2022-02-28",
                    responsibilities="Developed high-throughput data processing services and enterprise client integrations.",
                    domain="Enterprise SaaS",
                    leadership_experience_years=1.0,
                    is_leadership_role=False,
                    verification_status="HR-Verified"
                )
                db.session.add(h1)
            db.session.commit()
            print("[SUCCESS] Seeded baseline employment history.")

    except Exception as e:
        db.session.rollback()
        print(f"[WARNING] Error in seed_enhanced_modules_baseline: {str(e)}")

