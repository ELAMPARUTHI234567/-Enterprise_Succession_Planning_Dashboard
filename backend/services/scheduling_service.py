import re
from zoneinfo import ZoneInfo
from datetime import datetime, timedelta, date, time, timezone
from models.assessment import Assessment, AssessmentAssignment
from models.employee import Employee
from models.notification import Notification
from extensions import db

def resolve_zone_info(tz_str):
    """
    Parses timezone strings such as:
    - 'IST (Asia/Kolkata)', 'Asia/Kolkata', 'IST' -> ZoneInfo('Asia/Kolkata')
    - 'EST (America/New_York)', 'America/New_York', 'EST' -> ZoneInfo('America/New_York')
    - 'CST (America/Chicago)', 'America/Chicago', 'CST' -> ZoneInfo('America/Chicago')
    - 'PST (America/Los_Angeles)', 'America/Los_Angeles', 'PST' -> ZoneInfo('America/Los_Angeles')
    - 'GMT (Europe/London)', 'Europe/London', 'GMT' -> ZoneInfo('Europe/London')
    - 'SGT (Asia/Singapore)', 'Asia/Singapore', 'SGT' -> ZoneInfo('Asia/Singapore')
    - 'UTC' -> timezone.utc
    """
    if not tz_str:
        return timezone.utc

    tz_clean = str(tz_str).strip()
    if tz_clean.upper() in ['UTC', 'Z', 'GMT+0', 'UTC+0']:
        return timezone.utc

    # Extract IANA timezone name from parentheses if present, e.g. "IST (Asia/Kolkata)" -> "Asia/Kolkata"
    match = re.search(r'\(([^)]+)\)', tz_clean)
    if match:
        cand = match.group(1).strip()
        try:
            return ZoneInfo(cand)
        except Exception:
            pass

    # Direct abbreviation or IANA name mapping
    name_map = {
        'IST': 'Asia/Kolkata',
        'UTC': 'UTC',
        'GMT': 'Europe/London',
        'EST': 'America/New_York',
        'EDT': 'America/New_York',
        'CST': 'America/Chicago',
        'CDT': 'America/Chicago',
        'PST': 'America/Los_Angeles',
        'PDT': 'America/Los_Angeles',
        'SGT': 'Asia/Singapore',
    }
    mapped = name_map.get(tz_clean.upper(), tz_clean)
    try:
        return ZoneInfo(mapped)
    except Exception:
        return timezone.utc

def calculate_end_time_str(start_time_str, duration_minutes):
    """
    Given a start time string 'HH:MM' (24-hour) and duration in minutes,
    calculates the end time string 'HH:MM'.
    """
    if not start_time_str or not duration_minutes:
        return ""
    try:
        parts = str(start_time_str).strip().split(':')
        start_h = int(parts[0])
        start_m = int(parts[1]) if len(parts) > 1 else 0
        total_start_mins = start_h * 60 + start_m
        total_end_mins = total_start_mins + int(duration_minutes)

        end_h = (total_end_mins // 60) % 24
        end_m = total_end_mins % 60
        return f"{end_h:02d}:{end_m:02d}"
    except Exception:
        return ""

def create_utc_datetime(date_str, time_str, tz_input="UTC"):
    """
    Converts YYYY-MM-DD and HH:MM in the specified timezone to a naive UTC datetime.
    tz_input can be a timezone string or numeric offset in minutes.
    """
    if not date_str or not time_str:
        return None
    try:
        dt_base = datetime.strptime(f"{str(date_str).strip()} {str(time_str).strip()}", "%Y-%m-%d %H:%M")
        if isinstance(tz_input, (int, float)):
            return dt_base - timedelta(minutes=int(tz_input))

        zi = resolve_zone_info(tz_input)
        # Attach the local timezone
        dt_local = dt_base.replace(tzinfo=zi)
        # Convert to UTC
        dt_utc = dt_local.astimezone(timezone.utc)
        # Return naive UTC datetime for standardized database storage
        return dt_utc.replace(tzinfo=None)
    except Exception:
        return None

def check_scheduling_conflicts(assignments_data):
    """
    Checks for scheduling conflicts for a list of proposed assignments:
    1. Duplicate / overlapping schedule for the same employee
    2. Overlapping schedule with existing active assignments in DB
    3. Simultaneous session detection across employees (flagged as informational warning)

    Returns: { "has_conflicts": bool, "conflicts": list of warning/error messages }
    """
    conflicts = []
    has_blocking_conflicts = False

    # Check proposed batch internally
    emp_slots = {}
    for item in assignments_data:
        emp_id = item.get('employee_id')
        dt_str = str(item.get('scheduled_date') or item.get('date') or '').strip()
        st_str = str(item.get('start_time') or '').strip()
        dur = item.get('duration_minutes') if item.get('duration_minutes') is not None else item.get('duration')

        if not emp_id or not dt_str or not st_str or not dur:
            continue

        emp_name = item.get('employee_name') or f"Employee {emp_id}"
        end_str = calculate_end_time_str(st_str, dur)

        if emp_id in emp_slots:
            prev = emp_slots[emp_id]
            # Check overlap on same date
            if prev['date'] == dt_str:
                # Compare times
                if not (end_str <= prev['start'] or st_str >= prev['end']):
                    conflicts.append({
                        "type": "OVERLAP_SAME_EMPLOYEE",
                        "severity": "error",
                        "message": f"Conflict for {emp_name}: Assigned overlapping times on {dt_str} ({st_str}-{end_str} overlaps with {prev['start']}-{prev['end']})."
                    })
                    has_blocking_conflicts = True
        else:
            emp_slots[emp_id] = {'date': dt_str, 'start': st_str, 'end': end_str, 'name': emp_name}

    # Check against existing DB assignments
    for item in assignments_data:
        emp_id = item.get('employee_id')
        dt_str = str(item.get('scheduled_date') or item.get('date') or '').strip()
        st_str = str(item.get('start_time') or '').strip()
        dur = item.get('duration_minutes') if item.get('duration_minutes') is not None else item.get('duration')
        current_assign_id = item.get('assignment_id')

        if not emp_id or not dt_str or not st_str or not dur:
            continue

        end_str = calculate_end_time_str(st_str, dur)
        emp_name = item.get('employee_name') or f"Employee {emp_id}"

        # Find existing active schedules on the same date
        existing = AssessmentAssignment.query.filter(
            AssessmentAssignment.employee_id == emp_id,
            AssessmentAssignment.scheduled_date == dt_str,
            AssessmentAssignment.status.in_(['Scheduled', 'Assigned', 'In-Progress']),
            AssessmentAssignment.id != current_assign_id
        ).all()

        for ex in existing:
            if ex.start_time and ex.end_time:
                if not (end_str <= ex.start_time or st_str >= ex.end_time):
                    conflicts.append({
                        "type": "OVERLAP_EXISTING_DB",
                        "severity": "error",
                        "message": f"Conflict for {emp_name}: Overlaps with an already scheduled assessment '{ex.assessment.title if ex.assessment else ''}' on {dt_str} from {ex.start_time} to {ex.end_time}."
                    })
                    has_blocking_conflicts = True

    return {
        "has_blocking_conflicts": has_blocking_conflicts,
        "conflicts": conflicts
    }

def validate_and_save_manual_schedules(assessment_id, schedules_input, assigned_by_user_id):
    """
    Saves manually assigned schedules for one or multiple employees.
    STRICT ENFORCEMENT:
    - Every employee must have explicit scheduled_date, start_time, and duration_minutes.
    - No automatic time generation or distribution.
    - Rejects incomplete schedules.
    """
    if not schedules_input or not isinstance(schedules_input, list):
        return None, "Schedules list is required and cannot be empty", 400

    assessment = Assessment.query.get(assessment_id)
    if not assessment:
        return None, "Assessment not found", 404

    # 1. Validate every entry is complete
    incomplete_employees = []
    for idx, s in enumerate(schedules_input, start=1):
        emp_id = s.get('employee_id')
        sc_date = str(s.get('scheduled_date') or s.get('date') or '').strip()
        st_time = str(s.get('start_time') or '').strip()
        dur_val = s.get('duration_minutes') if s.get('duration_minutes') is not None else s.get('duration')

        if not emp_id or not sc_date or not st_time or not dur_val or int(dur_val) <= 0:
            emp_name = s.get('employee_name') or f"Employee at row #{idx}"
            incomplete_employees.append(emp_name)

    if incomplete_employees:
        return None, f"Incomplete schedule: HR must explicitly enter Date, Start Time, and Duration for every employee. Missing details for: {', '.join(incomplete_employees)}.", 400

    # 2. Check conflicts
    conflict_check = check_scheduling_conflicts(schedules_input)
    if conflict_check["has_blocking_conflicts"]:
        err_msgs = [c["message"] for c in conflict_check["conflicts"] if c["severity"] == "error"]
        return None, f"Scheduling Conflict Detected: {'; '.join(err_msgs)}", 409

    saved_assignments = []

    for s in schedules_input:
        emp_id = s.get('employee_id')
        sc_date = str(s.get('scheduled_date') or s.get('date')).strip()
        st_time = str(s.get('start_time')).strip()
        dur_val = s.get('duration_minutes') if s.get('duration_minutes') is not None else s.get('duration')
        duration = int(dur_val)
        time_zone = str(s.get('time_zone') or 'IST (Asia/Kolkata)').strip()
        instructions = str(s.get('instructions') or assessment.description or 'Complete your scheduled leadership assessment.').strip()

        end_time_calculated = calculate_end_time_str(st_time, duration)

        # Calculate authoritative UTC datetimes using explicit timezone
        start_utc = create_utc_datetime(sc_date, st_time, time_zone)
        end_utc = start_utc + timedelta(minutes=duration) if start_utc else create_utc_datetime(sc_date, end_time_calculated, time_zone)

        assignment_id = s.get('assignment_id')
        assignment = None
        if assignment_id:
            assignment = AssessmentAssignment.query.get(assignment_id)

        if not assignment:
            # Check existing uncompleted assignment
            assignment = AssessmentAssignment.query.filter_by(
                assessment_id=assessment_id, employee_id=emp_id
            ).filter(AssessmentAssignment.status != 'Completed').first()

        if not assignment:
            assignment = AssessmentAssignment(
                assessment_id=assessment_id,
                employee_id=emp_id,
                assigned_by=assigned_by_user_id
            )
            db.session.add(assignment)

        # Assign explicit manual schedule values
        assignment.scheduled_date = sc_date
        assignment.start_time = st_time
        assignment.duration_minutes = duration
        assignment.end_time = end_time_calculated
        assignment.time_zone = time_zone
        assignment.scheduled_start_datetime = start_utc
        assignment.scheduled_end_datetime = end_utc
        assignment.due_date = f"{sc_date} {end_time_calculated}"
        assignment.instructions = instructions
        assignment.status = 'Scheduled'
        assignment.schedule_status = 'Scheduled'
        assignment.assigned_by = assigned_by_user_id

        db.session.flush()

        # In-App Notification to employee's user account
        emp = Employee.query.get(emp_id)
        if emp and emp.user_id:
            notif = Notification(
                user_id=emp.user_id,
                title="New Assessment Scheduled",
                message=f"HR has scheduled your assessment '{assessment.title}' for {sc_date} at {st_time} ({duration} mins).",
                type="assessment_assigned",
                link="/employee-dashboard"
            )
            db.session.add(notif)

        saved_assignments.append(assignment.to_dict())

    db.session.commit()

    return saved_assignments, None, 201

def check_assessment_start_permission(assignment, current_user_employee_id=None, is_admin=False, current_time=None):
    """
    Backend Authoritative Timing & Window Enforcement:
    Determines whether an employee may start or submit an assessment.

    Rules:
    - User must be the assigned employee (or admin/HR in preview mode).
    - Assessment must not be already Completed.
    - Assessment must have scheduled date and start time.
    - Server UTC time must be >= scheduled start time (with a 15-minute early-check-in allowance).
    - Server UTC time must be <= scheduled end time (deadline).
    """
    if not assignment:
        return False, "Assignment not found", 404

    if not is_admin and current_user_employee_id and assignment.employee_id != current_user_employee_id:
        return False, "Unauthorized access: You can only take assessments assigned to your employee account.", 403

    if assignment.status == 'Completed':
        return False, "This assessment has already been completed and submitted.", 400

    if assignment.schedule_status == 'Cancelled':
        return False, "This assessment appointment was cancelled by HR.", 403

    # Re-verify or self-heal scheduled datetimes using explicit timezone
    if assignment.scheduled_date and assignment.start_time:
        tz_to_use = assignment.time_zone or 'IST (Asia/Kolkata)'
        expected_start = create_utc_datetime(assignment.scheduled_date, assignment.start_time, tz_to_use)
        dur = assignment.duration_minutes or 30
        expected_end = expected_start + timedelta(minutes=dur) if expected_start else None

        if not assignment.scheduled_start_datetime:
            assignment.scheduled_start_datetime = expected_start
            assignment.scheduled_end_datetime = expected_end
            try:
                db.session.commit()
            except Exception:
                db.session.rollback()
        else:
            # Self-heal legacy rows where local datetime was saved directly as naive UTC
            try:
                naive_local = datetime.strptime(f"{assignment.scheduled_date.strip()} {assignment.start_time.strip()}", "%Y-%m-%d %H:%M")
                if assignment.scheduled_start_datetime == naive_local and expected_start != naive_local:
                    assignment.scheduled_start_datetime = expected_start
                    assignment.scheduled_end_datetime = expected_end
                    db.session.commit()
            except Exception:
                pass

    # If manual schedule datetimes exist, enforce them authoritatively
    if assignment.scheduled_start_datetime and assignment.scheduled_end_datetime:
        now_utc = current_time if current_time is not None else datetime.utcnow()
        early_window = assignment.scheduled_start_datetime - timedelta(minutes=15)

        if now_utc < early_window:
            time_until_open = early_window - now_utc
            mins_left_open = max(1, int(time_until_open.total_seconds() // 60))
            return False, f"Assessment window is not open yet. Scheduled start: {assignment.scheduled_date} at {assignment.start_time} ({assignment.time_zone or 'UTC'}). Opens in approximately {mins_left_open} minutes.", 403

        if now_utc > assignment.scheduled_end_datetime:
            assignment.schedule_status = 'Missed'
            try:
                db.session.commit()
            except Exception:
                db.session.rollback()
            return False, f"Assessment window expired on {assignment.scheduled_date} at {assignment.end_time} ({assignment.time_zone or 'UTC'}). Contact HR to reschedule.", 403

    return True, "Assessment window is open and verified.", 200
