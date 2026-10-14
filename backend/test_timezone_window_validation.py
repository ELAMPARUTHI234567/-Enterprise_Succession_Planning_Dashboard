import unittest
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from app import create_app
from extensions import db
from models.user import User
from models.employee import Employee
from models.assessment import Assessment, AssessmentAssignment
from services.scheduling_service import (
    resolve_zone_info,
    create_utc_datetime,
    check_assessment_start_permission,
    calculate_end_time_str
)

class TestTimezoneWindowValidation(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = create_app()
        cls.app.config['TESTING'] = True
        cls.client = cls.app.test_client()

    def setUp(self):
        self.ctx = self.app.app_context()
        self.ctx.push()

    def tearDown(self):
        self.ctx.pop()

    def test_01_timezone_resolution(self):
        """Test parsing of various timezone strings into valid ZoneInfo objects"""
        self.assertEqual(resolve_zone_info('IST (Asia/Kolkata)'), ZoneInfo('Asia/Kolkata'))
        self.assertEqual(resolve_zone_info('Asia/Kolkata'), ZoneInfo('Asia/Kolkata'))
        self.assertEqual(resolve_zone_info('IST'), ZoneInfo('Asia/Kolkata'))
        self.assertEqual(resolve_zone_info('EST (America/New_York)'), ZoneInfo('America/New_York'))
        self.assertEqual(resolve_zone_info('UTC'), timezone.utc)
        self.assertEqual(resolve_zone_info('GMT (Europe/London)'), ZoneInfo('Europe/London'))
        self.assertEqual(resolve_zone_info(''), timezone.utc)

    def test_02_create_utc_datetime_single_conversion(self):
        """Test conversion of local date/time into naive UTC datetime without double conversion"""
        # 2026-10-14 01:10 IST -> UTC is 2026-10-13 19:40:00 (5 hours 30 mins earlier)
        dt_utc = create_utc_datetime("2026-10-14", "01:10", "IST (Asia/Kolkata)")
        self.assertEqual(dt_utc, datetime(2026, 10, 13, 19, 40, 0))

        # UTC input stays unchanged
        dt_utc_pure = create_utc_datetime("2026-10-14", "12:00", "UTC")
        self.assertEqual(dt_utc_pure, datetime(2026, 10, 14, 12, 0, 0))

        # EST / New York (October EDT is UTC-4): 2026-10-14 10:00 EDT -> 2026-10-14 14:00:00 UTC
        dt_est = create_utc_datetime("2026-10-14", "10:00", "EST (America/New_York)")
        self.assertEqual(dt_est, datetime(2026, 10, 14, 14, 0, 0))

    def test_03_boundary_scheduled_one_minute_in_future(self):
        """
        Boundary 1: Scheduled 1 minute in the future.
        Since early start allowance is 15 minutes, current time is well inside permitted window.
        Result: can_start=True, window_status='open'.
        """
        assess = Assessment.query.first()
        emp = Employee.query.first()

        # Scheduled start is 1 minute in the future
        simulated_now = datetime(2026, 10, 13, 19, 39, 0) # 01:09 AM IST
        start_utc = datetime(2026, 10, 13, 19, 40, 0)     # 01:10 AM IST (1 minute future)
        end_utc = datetime(2026, 10, 13, 20, 0, 0)        # 01:30 AM IST (20 mins duration)

        assignment = AssessmentAssignment(
            assessment_id=assess.id,
            employee_id=emp.id,
            scheduled_date="2026-10-14",
            start_time="01:10",
            end_time="01:30",
            duration_minutes=20,
            time_zone="IST (Asia/Kolkata)",
            scheduled_start_datetime=start_utc,
            scheduled_end_datetime=end_utc,
            status="Scheduled",
            schedule_status="Scheduled"
        )

        can_start, msg, code = check_assessment_start_permission(
            assignment, current_user_employee_id=emp.id, current_time=simulated_now
        )
        self.assertTrue(can_start, f"Expected can_start=True 1 min before start, got: {msg}")
        self.assertEqual(code, 200)

    def test_04_boundary_exactly_at_permitted_start_boundary(self):
        """
        Boundary 2: Exactly at permitted start boundary (15 mins before scheduled start).
        At exact early_window boundary, can_start=True.
        1 second before boundary, can_start=False (window not open yet).
        """
        assess = Assessment.query.first()
        emp = Employee.query.first()

        start_utc = datetime(2026, 10, 13, 19, 40, 0)
        end_utc = start_utc + timedelta(minutes=20)
        early_window = start_utc - timedelta(minutes=15) # 19:25:00 UTC

        assignment = AssessmentAssignment(
            assessment_id=assess.id,
            employee_id=emp.id,
            scheduled_date="2026-10-14",
            start_time="01:10",
            end_time="01:30",
            duration_minutes=20,
            time_zone="IST (Asia/Kolkata)",
            scheduled_start_datetime=start_utc,
            scheduled_end_datetime=end_utc,
            status="Scheduled",
            schedule_status="Scheduled"
        )

        # 1. Exactly AT the permitted boundary: 19:25:00 UTC
        can_start, msg, code = check_assessment_start_permission(
            assignment, current_user_employee_id=emp.id, current_time=early_window
        )
        self.assertTrue(can_start, f"Expected can_start=True at exact boundary, got: {msg}")
        self.assertEqual(code, 200)

        # 2. 1 second BEFORE the permitted boundary: 19:24:59 UTC -> Rejected
        before_window = early_window - timedelta(seconds=1)
        can_start_early, msg_early, code_early = check_assessment_start_permission(
            assignment, current_user_employee_id=emp.id, current_time=before_window
        )
        self.assertFalse(can_start_early)
        self.assertEqual(code_early, 403)
        self.assertIn("Assessment window is not open yet", msg_early)

    def test_05_boundary_during_allowed_window(self):
        """
        Boundary 3: During allowed window (e.g. 5 minutes after scheduled start).
        can_start=True, code=200.
        """
        assess = Assessment.query.first()
        emp = Employee.query.first()

        start_utc = datetime(2026, 10, 13, 19, 40, 0)
        end_utc = start_utc + timedelta(minutes=20)
        during_window = start_utc + timedelta(minutes=5) # 19:45:00 UTC

        assignment = AssessmentAssignment(
            assessment_id=assess.id,
            employee_id=emp.id,
            scheduled_date="2026-10-14",
            start_time="01:10",
            end_time="01:30",
            duration_minutes=20,
            time_zone="IST (Asia/Kolkata)",
            scheduled_start_datetime=start_utc,
            scheduled_end_datetime=end_utc,
            status="Scheduled",
            schedule_status="Scheduled"
        )

        can_start, msg, code = check_assessment_start_permission(
            assignment, current_user_employee_id=emp.id, current_time=during_window
        )
        self.assertTrue(can_start)
        self.assertEqual(code, 200)

    def test_06_boundary_at_scheduled_end(self):
        """
        Boundary 4: Exactly at scheduled end (deadline to start).
        can_start=True, code=200.
        """
        assess = Assessment.query.first()
        emp = Employee.query.first()

        start_utc = datetime(2026, 10, 13, 19, 40, 0)
        end_utc = start_utc + timedelta(minutes=20) # 20:00:00 UTC

        assignment = AssessmentAssignment(
            assessment_id=assess.id,
            employee_id=emp.id,
            scheduled_date="2026-10-14",
            start_time="01:10",
            end_time="01:30",
            duration_minutes=20,
            time_zone="IST (Asia/Kolkata)",
            scheduled_start_datetime=start_utc,
            scheduled_end_datetime=end_utc,
            status="Scheduled",
            schedule_status="Scheduled"
        )

        can_start, msg, code = check_assessment_start_permission(
            assignment, current_user_employee_id=emp.id, current_time=end_utc
        )
        self.assertTrue(can_start)
        self.assertEqual(code, 200)

    def test_07_boundary_after_expiry(self):
        """
        Boundary 5: 1 second after scheduled end.
        can_start=False, code=403, window expired.
        """
        assess = Assessment.query.first()
        emp = Employee.query.first()

        start_utc = datetime(2026, 10, 13, 19, 40, 0)
        end_utc = start_utc + timedelta(minutes=20) # 20:00:00 UTC
        after_expiry = end_utc + timedelta(seconds=1)

        assignment = AssessmentAssignment(
            assessment_id=assess.id,
            employee_id=emp.id,
            scheduled_date="2026-10-14",
            start_time="01:10",
            end_time="01:30",
            duration_minutes=20,
            time_zone="IST (Asia/Kolkata)",
            scheduled_start_datetime=start_utc,
            scheduled_end_datetime=end_utc,
            status="Scheduled",
            schedule_status="Scheduled"
        )

        can_start, msg, code = check_assessment_start_permission(
            assignment, current_user_employee_id=emp.id, current_time=after_expiry
        )
        self.assertFalse(can_start)
        self.assertEqual(code, 403)
        self.assertIn("expired", msg.lower())

    def test_08_browser_timezone_instant_equivalence(self):
        """
        Verify that configured timezone (Asia/Kolkata) and browser client timezone (e.g. UTC, EDT)
        represent the exact same epoch instant.
        """
        # HR scheduled date and time in IST
        date_str = "2026-10-14"
        time_str = "01:10"
        tz_str = "IST (Asia/Kolkata)"

        # Backend authoritative UTC calculation
        utc_dt = create_utc_datetime(date_str, time_str, tz_str)
        aware_utc = utc_dt.replace(tzinfo=timezone.utc)

        # Candidate in IST
        aware_ist = aware_utc.astimezone(ZoneInfo("Asia/Kolkata"))
        self.assertEqual(aware_ist.strftime("%Y-%m-%d %H:%M"), "2026-10-14 01:10")

        # Candidate or HR in London (BST, UTC+1 in October)
        aware_bst = aware_utc.astimezone(ZoneInfo("Europe/London"))
        self.assertEqual(aware_bst.strftime("%Y-%m-%d %H:%M"), "2026-10-13 20:40")

        # Candidate or HR in New York (EDT, UTC-4 in October)
        aware_edt = aware_utc.astimezone(ZoneInfo("America/New_York"))
        self.assertEqual(aware_edt.strftime("%Y-%m-%d %H:%M"), "2026-10-13 15:40")

        # All represent the exact same POSIX timestamp
        self.assertEqual(aware_utc.timestamp(), aware_ist.timestamp())
        self.assertEqual(aware_utc.timestamp(), aware_bst.timestamp())
        self.assertEqual(aware_utc.timestamp(), aware_edt.timestamp())

    def test_09_window_status_and_start_endpoints(self):
        """
        Verify GET /api/assessment-assignments/<id>/window-status and
        POST /api/assessment-assignments/<id>/start endpoints.
        """
        import jwt
        from config import Config

        emp = Employee.query.filter(Employee.user_id.isnot(None)).first()
        user = User.query.get(emp.user_id)
        assess = Assessment.query.first()

        token = jwt.encode(
            {"sub": str(user.id), "user_id": user.id, "role": user.role, "exp": datetime.utcnow() + timedelta(hours=2)},
            Config.JWT_SECRET_KEY,
            algorithm="HS256"
        )
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Assignment currently in open window (starts in 2 mins, inside 15-min early window)
        now_utc = datetime.utcnow()
        open_start = now_utc + timedelta(minutes=2)
        open_end = open_start + timedelta(minutes=20)

        assign_open = AssessmentAssignment(
            assessment_id=assess.id,
            employee_id=emp.id,
            scheduled_date=open_start.strftime("%Y-%m-%d"),
            start_time=open_start.strftime("%H:%M"),
            end_time=open_end.strftime("%H:%M"),
            duration_minutes=20,
            time_zone="UTC",
            scheduled_start_datetime=open_start,
            scheduled_end_datetime=open_end,
            status="Scheduled",
            schedule_status="Scheduled"
        )
        db.session.add(assign_open)
        db.session.commit()

        res_open = self.client.get(f"/api/assessment-assignments/{assign_open.id}/window-status", headers=headers)
        self.assertEqual(res_open.status_code, 200)
        data_open = res_open.get_json()["data"]
        self.assertEqual(data_open["window_status"], "open")
        self.assertTrue(data_open["can_start"])
        self.assertTrue(data_open["window_open"])
        self.assertEqual(data_open["seconds_until_open"], 0)
        self.assertTrue(data_open["scheduled_start_utc"].endswith("Z"))
        self.assertTrue(data_open["current_server_time_utc"].endswith("Z"))

        # Test POST /start on open assignment -> 200 OK
        res_start = self.client.post(f"/api/assessment-assignments/{assign_open.id}/start", headers=headers)
        self.assertEqual(res_start.status_code, 200)
        data_start = res_start.get_json()["data"]
        self.assertIn("submission_deadline", data_start)
        self.assertTrue(data_start["submission_deadline"].endswith("Z"))

        # 2. Assignment scheduled 2 days in the future (early window not reached)
        future_start = now_utc + timedelta(days=2)
        future_end = future_start + timedelta(minutes=20)

        assign_future = AssessmentAssignment(
            assessment_id=assess.id,
            employee_id=emp.id,
            scheduled_date=future_start.strftime("%Y-%m-%d"),
            start_time=future_start.strftime("%H:%M"),
            end_time=future_end.strftime("%H:%M"),
            duration_minutes=20,
            time_zone="UTC",
            scheduled_start_datetime=future_start,
            scheduled_end_datetime=future_end,
            status="Scheduled",
            schedule_status="Scheduled"
        )
        db.session.add(assign_future)
        db.session.commit()

        res_future = self.client.get(f"/api/assessment-assignments/{assign_future.id}/window-status", headers=headers)
        self.assertEqual(res_future.status_code, 200)
        data_future = res_future.get_json()["data"]
        self.assertEqual(data_future["window_status"], "early")
        self.assertFalse(data_future["can_start"])
        self.assertFalse(data_future["window_open"])
        self.assertTrue(data_future["is_early"])
        self.assertGreater(data_future["seconds_until_open"], 0)

        # Test POST /start on future assignment -> 403 Forbidden
        res_start_future = self.client.post(f"/api/assessment-assignments/{assign_future.id}/start", headers=headers)
        self.assertEqual(res_start_future.status_code, 403)
        self.assertIn("Assessment window is not open yet", res_start_future.get_json()["message"])

        # Clean up
        db.session.delete(assign_open)
        db.session.delete(assign_future)
        db.session.commit()

if __name__ == '__main__':
    unittest.main()
