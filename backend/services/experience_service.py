from datetime import datetime, date
from models.employee import Employee
from models.employment_history import EmploymentHistory

def parse_date_safe(date_str, is_end=False):
    """
    Parses date string in 'YYYY-MM-DD' or 'YYYY-MM' format.
    Returns datetime.date object.
    """
    if not date_str:
        return datetime.utcnow().date() if is_end else date(2020, 1, 1)

    s = str(date_str).strip()
    if s.lower() in ['present', 'current', 'now', 'ongoing']:
        return datetime.utcnow().date()

    try:
        if len(s) == 7:  # YYYY-MM
            parts = s.split('-')
            year = int(parts[0])
            month = int(parts[1])
            if is_end:
                # Last day of month approximation (or 28th)
                return date(year, month, 28)
            return date(year, month, 1)
        return datetime.strptime(s[:10], "%Y-%m-%d").date()
    except Exception:
        return datetime.utcnow().date() if is_end else date(2020, 1, 1)

def merge_overlapping_intervals(intervals):
    """
    Takes a list of (start_date, end_date) tuples, sorts and merges any overlapping
    or contiguous intervals so no period is double-counted.
    Returns list of merged disjoint (start, end) tuples.
    """
    if not intervals:
        return []

    # Filter invalid intervals where start > end
    valid_intervals = []
    for start, end in intervals:
        if start <= end:
            valid_intervals.append((start, end))

    if not valid_intervals:
        return []

    # Sort intervals by start date
    valid_intervals.sort(key=lambda x: x[0])

    merged = [valid_intervals[0]]
    for current_start, current_end in valid_intervals[1:]:
        prev_start, prev_end = merged[-1]
        if current_start <= prev_end:
            # Overlapping or adjacent interval -> merge
            merged[-1] = (prev_start, max(prev_end, current_end))
        else:
            merged.append((current_start, current_end))

    return merged

def calculate_employee_experience(employee_id):
    """
    Calculates detailed employment experience:
    1. Current company tenure (joining date to current date)
    2. Total professional experience WITHOUT double-counting overlapping periods
    3. Leadership experience years
    4. Domain experience breakdown
    5. Verified vs Self-Reported experience tracking
    """
    employee = Employee.query.get(employee_id)
    if not employee:
        return None

    today = datetime.utcnow().date()

    # 1. Current Company Tenure
    current_company_interval = None
    tenure_years = 0.0
    if employee.company_joining_date:
        join_date = parse_date_safe(employee.company_joining_date, is_end=False)
        if join_date <= today:
            current_company_interval = (join_date, today)
            tenure_days = (today - join_date).days
            tenure_years = max(0.0, round(tenure_days / 365.25, 2))

    # 2. Previous Employment History
    histories = EmploymentHistory.query.filter_by(employee_id=employee_id).all()

    all_intervals = []
    verified_intervals = []
    leadership_years_sum = 0.0
    domain_map = {}

    history_list = []
    for h in histories:
        h_dict = h.to_dict()
        history_list.append(h_dict)

        s_dt = parse_date_safe(h.start_date, is_end=False)
        e_dt = parse_date_safe(h.end_date, is_end=True)

        if s_dt <= e_dt:
            interval = (s_dt, e_dt)
            all_intervals.append(interval)
            if h.verification_status == 'HR-Verified':
                verified_intervals.append(interval)

        # Leadership experience
        if h.leadership_experience_years > 0:
            leadership_years_sum += h.leadership_experience_years
        elif h.is_leadership_role:
            dur_days = max(0, (e_dt - s_dt).days)
            leadership_years_sum += round(dur_days / 365.25, 2)

        # Domain experience
        if h.domain:
            dom_name = h.domain.strip()
            dur_yrs = round(max(0, (e_dt - s_dt).days) / 365.25, 2)
            domain_map[dom_name] = round(domain_map.get(dom_name, 0.0) + dur_yrs, 2)

    # Include current company interval in total intervals
    if current_company_interval:
        all_intervals.append(current_company_interval)
        # Current company experience is by default verified by current tenure
        verified_intervals.append(current_company_interval)

    # 3. Calculate Total Professional Experience without double counting
    merged_all = merge_overlapping_intervals(all_intervals)
    total_days = sum((end - start).days for start, end in merged_all)
    calculated_total_years = max(0.0, round(total_days / 365.25, 2))

    # Fallback to employee.experience_years if no detailed history entered yet
    final_total_experience = max(calculated_total_years, float(employee.experience_years or 0.0))

    # 4. Verified Professional Experience
    merged_verified = merge_overlapping_intervals(verified_intervals)
    verified_days = sum((end - start).days for start, end in merged_verified)
    verified_total_years = max(0.0, round(verified_days / 365.25, 2))

    return {
        "employee_id": employee.id,
        "employee_name": employee.name,
        "company_joining_date": employee.company_joining_date,
        "current_company_tenure_years": tenure_years,
        "total_professional_experience_years": final_total_experience,
        "calculated_non_overlapping_years": calculated_total_years,
        "verified_experience_years": verified_total_years,
        "leadership_experience_years": round(leadership_years_sum, 2),
        "domain_experience": domain_map,
        "previous_employers_count": len(histories),
        "employment_histories": history_list,
        "has_employment_history": len(histories) > 0
    }
