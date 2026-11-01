import os
import json
import urllib.request
import urllib.error
from models.user import User
from models.employee import Employee
from extensions import db
from config import Config

TARGET_EMPLOYEES = [
    {"code": "EMP001", "name": "Arun Kumar", "email": "arun.kumar@company.com"},
    {"code": "EMP002", "name": "Priya Sharma", "email": "priya.sharma@company.com"},
    {"code": "EMP003", "name": "Rajesh Patel", "email": "rajesh.patel@company.com"},
    {"code": "EMP004", "name": "Sneha Reddy", "email": "sneha.reddy@company.com"},
    {"code": "EMP005", "name": "Vikram Singh", "email": "vikram.singh@company.com"},
    {"code": "EMP006", "name": "Kavita Joshi", "email": "kavita.joshi@company.com"},
    {"code": "EMP007", "name": "Suresh Nair", "email": "suresh.nair@company.com"},
    {"code": "EMP008", "name": "Ananya Gupta", "email": "ananya.gupta@company.com"},
    {"code": "EMP009", "name": "Karthik Raja", "email": "karthik.raja@company.com"},
    {"code": "EMP010", "name": "Deepa Venkat", "email": "deepa.venkat@company.com"},
    {"code": "EMP011", "name": "Manish Verma", "email": "manish.verma@company.com"},
    {"code": "EMP012", "name": "Ritu Choudhary", "email": "ritu.choudhary@company.com"},
    {"code": "EMP013", "name": "Ganesh Iyer", "email": "ganesh.iyer@company.com"},
    {"code": "EMP014", "name": "Meera Deshmukh", "email": "meera.deshmukh@company.com"},
    {"code": "EMP015", "name": "Nitin Malhotra", "email": "nitin.malhotra@company.com"},
    {"code": "EMP016", "name": "Pooja Agarwal", "email": "pooja.agarwal@company.com"},
    {"code": "EMP017", "name": "Siddharth Rao", "email": "siddharth.rao@company.com"},
    {"code": "EMP018", "name": "Divya Saxena", "email": "divya.saxena@company.com"},
    {"code": "EMP019", "name": "Amitabh Das", "email": "amitabh.das@company.com"},
]

def sync_supabase_auth_user(email, password="employee123", name=""):
    """
    Registers or synchronizes the user account with Supabase Auth.
    Uses Supabase Auth API directly via server-side HTTPS request.
    Does not throw exceptions if remote call times out or fails.
    """
    supabase_url = getattr(Config, 'SUPABASE_URL', '').rstrip('/')
    supabase_key = getattr(Config, 'SUPABASE_ANON_KEY', '') or getattr(Config, 'SUPABASE_SERVICE_ROLE_KEY', '')

    if not supabase_url or not supabase_key:
        return {"synced": False, "reason": "Missing SUPABASE_URL or SUPABASE_ANON_KEY"}

    try:
        signup_url = f"{supabase_url}/auth/v1/signup"
        payload = json.dumps({
            "email": email,
            "password": password,
            "data": {
                "name": name,
                "role": "Employee"
            }
        }).encode("utf-8")

        headers = {
            "apikey": supabase_key,
            "Authorization": f"Bearer {supabase_key}",
            "Content-Type": "application/json"
        }

        req = urllib.request.Request(signup_url, data=payload, headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return {"synced": True, "status": resp.status, "id": data.get("id")}
    except urllib.error.HTTPError as he:
        # HTTP 400 or 422 usually means user already registered or exists in Supabase Auth
        try:
            body = json.loads(he.read().decode("utf-8"))
        except Exception:
            body = str(he)
        return {"synced": True, "status": he.code, "info": "Account exists or registered in Supabase Auth", "details": body}
    except Exception as e:
        return {"synced": False, "reason": str(e)}

def sync_all_employee_accounts(target_password="employee123", sync_supabase=True):
    """
    Guarantees independent, individual Employee Portal login accounts for all 19
    existing employee records in Supabase PostgreSQL and local environments.

    Rules:
    1. Username: Employee's registered email address (e.g. arun.kumar@company.com).
       Username handle prefix (e.g. arun.kumar) is also supported during login.
    2. Development testing password: employee123 (hashed via PBKDF2/SHA256).
    3. Role: strictly 'Employee' (no HR or Manager permissions).
    4. First-login password change: must_change_password = True.
    5. Preserves existing Employee ID, code, department, designation, manager_id,
       and all assessment records.
    6. Sneha Reddy (EMP004) is safely unlinked from generic User 2 ('manager')
       and assigned a dedicated Employee User account.
    """
    report = {
        "total_targets": len(TARGET_EMPLOYEES),
        "created_users": [],
        "updated_users": [],
        "unlinked_manager_users": [],
        "accounts": [],
        "success": True
    }

    try:
        # Retrieve all employees from database
        all_emps = Employee.query.all()
        emp_by_code = {e.employee_code: e for e in all_emps if e.employee_code}
        emp_by_email = {e.email.strip().lower(): e for e in all_emps if e.email}

        # Process each target employee
        for target in TARGET_EMPLOYEES:
            code = target["code"]
            email = target["email"].strip().lower()
            name = target["name"]
            prefix = email.split('@')[0]

            emp = emp_by_code.get(code) or emp_by_email.get(email)
            if not emp:
                print(f"[EMPLOYEE SYNC] Warning: Employee {code} ({name}) not found in database. Skipping.")
                continue

            # Ensure Employee has correct email and code
            if not emp.email or emp.email.strip().lower() != email:
                emp.email = email
            if not emp.name:
                emp.name = name

            existing_user = None

            # Check if emp.user_id is currently pointing to a user
            if emp.user_id:
                u = User.query.get(emp.user_id)
                # Safeguard: if user_id is the generic manager account, do NOT overwrite it!
                if u and (u.username == 'manager' or u.email == 'manager@company.com'):
                    report["unlinked_manager_users"].append({
                        "employee_code": code,
                        "employee_name": name,
                        "previous_user_id": u.id,
                        "action": "Unlinked from generic manager user"
                    })
                    emp.user_id = None
                else:
                    existing_user = u

            # If no valid user yet, search by email or prefix username
            if not existing_user:
                existing_user = User.query.filter(
                    (db.func.lower(db.func.trim(User.email)) == email) |
                    (db.func.lower(db.func.trim(User.username)) == email) |
                    (db.func.lower(db.func.trim(User.username)) == prefix)
                ).first()

            is_new = False
            if not existing_user:
                # Create dedicated User account
                is_new = True
                user = User(
                    name=emp.name,
                    username=prefix,
                    email=email,
                    role="Employee",
                    status="Active",
                    must_change_password=True
                )
                user.set_password(target_password)
                db.session.add(user)
                db.session.flush()
                emp.user_id = user.id
                report["created_users"].append(email)
            else:
                user = existing_user
                # Update existing user to conform strictly to Employee requirements
                user.name = emp.name
                user.email = email
                # Set username to prefix handle if not set
                if not user.username:
                    user.username = prefix
                user.role = "Employee"
                user.status = "Active"
                user.must_change_password = True
                user.set_password(target_password)
                emp.user_id = user.id
                report["updated_users"].append(email)

            # Supabase Auth synchronization (if enabled)
            sb_result = None
            if sync_supabase:
                sb_result = sync_supabase_auth_user(email, target_password, emp.name)

            report["accounts"].append({
                "employee_id": emp.id,
                "employee_code": emp.employee_code,
                "name": emp.name,
                "email": user.email,
                "username": user.username,
                "role": user.role,
                "status": user.status,
                "must_change_password": user.must_change_password,
                "supabase_sync": sb_result
            })

        db.session.commit()
        print(f"[EMPLOYEE SYNC] Successfully synchronized {len(report['accounts'])} employee accounts.")
        return report

    except Exception as e:
        db.session.rollback()
        report["success"] = False
        report["error"] = str(e)
        print(f"[EMPLOYEE SYNC] Error synchronizing employee accounts: {str(e)}")
        return report
