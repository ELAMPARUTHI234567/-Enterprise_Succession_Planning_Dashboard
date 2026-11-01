import logging
from extensions import db
from models.employee import Employee
from models.role import LeadershipRole
from models.assessment import AssessmentAssignment
from models.manager_dashboard import TeamTask, TeamGoal, TeamIssue
from services.readiness_service import calculate_successor_readiness
from services.gap_service import calculate_competency_gaps

logger = logging.getLogger(__name__)

def get_team_intelligence(manager_emp_id):
    """
    Modules 6 & 7: Manager Portal AI Team Performance Summary, Employee Development Advisor,
    and Real-Time Team Risk Analysis (Burnout, Retention, Stagnation).
    Strictly isolated to direct reports of manager_emp_id.
    """
    team_members = Employee.query.filter_by(
        manager_id=manager_emp_id
    ).filter(
        Employee.availability_status != 'Unavailable'
    ).all()

    if not team_members:
        return {
            "success": True,
            "team_size": 0,
            "team_readiness_avg": 0.0,
            "team_performance_avg": 0.0,
            "assessment_completion_rate": 0.0,
            "high_performers_count": 0,
            "risk_summary": {"burnout_count": 0, "retention_count": 0, "stagnation_count": 0},
            "members": [],
            "ai_team_summary": "No active team members registered under this manager account."
        }

    # Find the most relevant leadership role for team bench evaluation (e.g., Team Lead or Project Manager)
    default_role = LeadershipRole.query.filter(
        (LeadershipRole.role_name.ilike('%team lead%')) | (LeadershipRole.role_name.ilike('%manager%'))
    ).first()
    target_role_id = default_role.id if default_role else 1

    members_data = []
    total_readiness = 0.0
    total_perf = 0.0
    total_assigned = 0
    total_completed = 0
    high_performers_count = 0

    burnout_count = 0
    retention_count = 0
    stagnation_count = 0

    for emp in team_members:
        # 1. Readiness & Competency
        try:
            readiness_info = calculate_successor_readiness(emp.id, target_role_id)
            readiness_score = round(float(readiness_info.get("readiness_score", 0.0)), 1)
            readiness_lvl = readiness_info.get("readiness_level", "Developing")
        except Exception:
            readiness_score = 50.0
            readiness_lvl = "Developing"

        # 2. Performance
        perf = float(emp.performance_score or 3.5)
        total_readiness += readiness_score
        total_perf += perf

        if readiness_score >= 75.0 or perf >= 4.2:
            high_performers_count += 1

        # 3. Assessment History
        assignments = AssessmentAssignment.query.filter_by(employee_id=emp.id).all()
        emp_assigned = len(assignments)
        emp_completed = len([a for a in assignments if a.status == 'Completed'])
        total_assigned += emp_assigned
        total_completed += emp_completed

        # 4. Workload: Tasks & Issues
        active_tasks = TeamTask.query.filter(
            TeamTask.employee_id == emp.id,
            TeamTask.status.in_(['Pending', 'In Progress'])
        ).all()
        urgent_tasks = [t for t in active_tasks if t.priority in ['High', 'Critical', 'Urgent']]

        active_issues = TeamIssue.query.filter(
            TeamIssue.employee_id == emp.id,
            TeamIssue.status.in_(['Open', 'In Progress', 'Investigating'])
        ).all()
        critical_issues = [i for i in active_issues if i.severity in ['High', 'Critical']]

        # 5. Risk Calculation
        # Burnout Risk: heavy task load or critical issues
        burnout_score = len(active_tasks) * 15 + len(urgent_tasks) * 25 + len(critical_issues) * 30
        if burnout_score >= 60 or len(active_tasks) >= 4 or len(critical_issues) >= 2:
            burnout_level = "High"
            burnout_count += 1
            burnout_reason = f"High workload ({len(active_tasks)} active tasks, {len(urgent_tasks)} urgent, {len(critical_issues)} open issues)"
        elif burnout_score >= 30 or len(active_tasks) >= 2:
            burnout_level = "Medium"
            burnout_reason = f"Moderate workload ({len(active_tasks)} tasks active)"
        else:
            burnout_level = "Low"
            burnout_reason = "Balanced workload"

        # Retention Risk: high performers who may seek external advancement
        if (perf >= 4.0 or readiness_score >= 70.0) and (emp.experience_years or 0) >= 2:
            retention_level = "High"
            retention_count += 1
            retention_reason = "High readiness talent without formal succession promotion path"
        elif perf >= 3.8:
            retention_level = "Medium"
            retention_reason = "Consistent contributor requiring growth recognition"
        else:
            retention_level = "Low"
            retention_reason = "Stable tenure profile"

        # Stagnation Risk: lack of assessment engagement or training
        if emp_completed == 0 and emp_assigned > 0:
            stagnation_level = "High"
            stagnation_count += 1
            stagnation_reason = f"{emp_assigned} assigned assessment(s) uncompleted"
        elif emp_completed == 0:
            stagnation_level = "Medium"
            stagnation_reason = "No leadership assessments assigned yet"
        else:
            stagnation_level = "Low"
            stagnation_reason = "Active continuous assessment engagement"

        # 6. Tailored Development Advisor
        if readiness_score >= 80.0:
            dev_action = "Fast-track for leadership vacancy nomination; assign strategic project lead responsibilities."
        elif burnout_level == "High":
            dev_action = "Immediate workload rebalancing required; redistribute active tasks to prevent fatigue."
        elif stagnation_level == "High":
            dev_action = "Schedule 1-on-1 coaching and complete pending role readiness assessments."
        elif readiness_score >= 60.0:
            dev_action = "Enroll in advanced decision-making and cross-functional mentorship."
        else:
            dev_action = "Strengthen core technical and domain skills through structured skill modules."

        members_data.append({
            "employee_id": emp.id,
            "employee_code": emp.employee_code,
            "name": emp.name,
            "email": emp.email,
            "designation": emp.designation,
            "department": emp.department,
            "experience_years": emp.experience_years,
            "performance_score": perf,
            "readiness_score": readiness_score,
            "readiness_level": readiness_lvl,
            "assessments_completed": emp_completed,
            "assessments_assigned": emp_assigned,
            "active_tasks_count": len(active_tasks),
            "urgent_tasks_count": len(urgent_tasks),
            "active_issues_count": len(active_issues),
            "critical_issues_count": len(critical_issues),
            "risks": {
                "burnout": {"level": burnout_level, "reason": burnout_reason},
                "retention": {"level": retention_level, "reason": retention_reason},
                "stagnation": {"level": stagnation_level, "reason": stagnation_reason}
            },
            "development_advice": dev_action
        })

    # Sort members by readiness score descending
    members_data.sort(key=lambda m: m["readiness_score"], reverse=True)

    n = len(team_members)
    avg_readiness = round(total_readiness / n, 1)
    avg_perf = round(total_perf / n, 2)
    completion_rate = round((total_completed / total_assigned * 100.0), 1) if total_assigned > 0 else 0.0

    # Overall AI Synthesis
    ai_summary = (
        f"Team of {n} members maintains an average readiness of {avg_readiness}% and average performance of {avg_perf}/5.0. "
        f"{high_performers_count} team member(s) qualify as strong succession candidates. "
        f"Watch points: {burnout_count} member(s) flagged for workload rebalancing, and {retention_count} key contributor(s) "
        f"require leadership advancement planning."
    )

    return {
        "success": True,
        "team_size": n,
        "target_bench_role": default_role.role_name if default_role else "Leadership Role",
        "team_readiness_avg": avg_readiness,
        "team_performance_avg": avg_perf,
        "assessment_completion_rate": completion_rate,
        "total_assessments_assigned": total_assigned,
        "total_assessments_completed": total_completed,
        "high_performers_count": high_performers_count,
        "risk_summary": {
            "burnout_count": burnout_count,
            "retention_count": retention_count,
            "stagnation_count": stagnation_count
        },
        "members": members_data,
        "ai_team_summary": ai_summary
    }

