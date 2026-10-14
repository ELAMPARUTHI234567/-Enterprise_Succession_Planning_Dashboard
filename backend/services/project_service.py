from models.employee_project import EmployeeProject
from extensions import db

def calculate_project_success_rate(project_data):
    """
    Transparent, documented, configurable formula for project success evaluation.
    Evaluates project outcomes using documented indicators:
    - Milestones completed (weight 25%)
    - Deliverables accepted (weight 25%)
    - Timeline adherence (weight 20%)
    - Quality and defect targets achieved (weight 15%)
    - Defined business or technical objectives (weight 15%)

    Rules:
    - Does NOT automatically assign 100% just because project is marked Completed.
    - If valid success metrics are unavailable, returns None (displays 'Not evaluated').
    - Returns normalized percentage score (0.0 to 100.0) rounded to 1 decimal place.
    """
    indicator_weights = {
        'milestones_completed_pct': 0.25,
        'deliverables_accepted_pct': 0.25,
        'timeline_adherence_pct': 0.20,
        'quality_defect_score': 0.15,
        'business_goals_achieved_pct': 0.15
    }

    weighted_sum = 0.0
    accumulated_weight = 0.0

    for field, weight in indicator_weights.items():
        val = project_data.get(field)
        if val is not None and val != "":
            try:
                num_val = float(val)
                # Clamp between 0.0 and 100.0
                clamped_val = max(0.0, min(100.0, num_val))
                weighted_sum += clamped_val * weight
                accumulated_weight += weight
            except (ValueError, TypeError):
                continue

    if accumulated_weight > 0:
        return round(weighted_sum / accumulated_weight, 1)

    return None

def get_employee_projects_summary(employee_id):
    """
    Summarizes all projects for an employee, distinguishing self-reported
    from HR/Supervisor-verified outcomes and calculating composite project metrics.
    """
    projects = EmployeeProject.query.filter_by(employee_id=employee_id).order_by(EmployeeProject.id.desc()).all()
    if not projects:
        return {
            "total_projects": 0,
            "completed_projects": 0,
            "in_progress_projects": 0,
            "verified_projects_count": 0,
            "average_verified_success_rate": None,
            "average_overall_success_rate": None,
            "evaluated_projects_count": 0,
            "technologies_used": [],
            "projects": [],
            "has_evaluated_projects": False
        }

    total = len(projects)
    completed = 0
    in_progress = 0
    verified_count = 0
    all_techs = set()

    evaluated_rates = []
    verified_rates = []

    project_list = []
    for p in projects:
        p_dict = p.to_dict()
        project_list.append(p_dict)

        if p.status == 'Completed':
            completed += 1
        elif p.status == 'In Progress':
            in_progress += 1

        is_verified = p.verification_status in ['HR-Verified', 'Supervisor-Verified']
        if is_verified:
            verified_count += 1

        for t in p.get_technologies():
            if t:
                all_techs.add(t.strip())

        if p.success_rate is not None:
            evaluated_rates.append(p.success_rate)
            if is_verified:
                verified_rates.append(p.success_rate)

    avg_overall = round(sum(evaluated_rates) / len(evaluated_rates), 1) if evaluated_rates else None
    avg_verified = round(sum(verified_rates) / len(verified_rates), 1) if verified_rates else None

    return {
        "total_projects": total,
        "completed_projects": completed,
        "in_progress_projects": in_progress,
        "verified_projects_count": verified_count,
        "average_verified_success_rate": avg_verified,
        "average_overall_success_rate": avg_overall,
        "evaluated_projects_count": len(evaluated_rates),
        "technologies_used": sorted(list(all_techs)),
        "projects": project_list,
        "has_evaluated_projects": len(evaluated_rates) > 0
    }
