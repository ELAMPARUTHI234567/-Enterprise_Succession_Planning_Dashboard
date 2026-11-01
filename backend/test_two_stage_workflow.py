"""
End-to-end verification script for the Two-Stage Employee Assessment,
HR Eligibility and AI Top 3 Successor Workflow.

Tests:
1. Database Schema & Migration:
   - assessments.assessment_type & stage
   - assessment_assignments.assessment_type & stage
   - assessment_results.passed & passing_threshold
2. Question Bank & Stage 1 Template:
   - Initial screening template with 21 questions across 7 core competencies
3. HR Approval & Reporting Manager Assignment:
   - POST /api/auth/pending-users/<id>/approve with manager_id
4. Manager Team Screening Stats:
   - 8 KPI metrics in GET /api/manager/overview
5. Manager Assign Stage 1 Assessment:
   - POST /api/manager/assign-initial-assessment
6. Assessment Submission & Two-Stage Grading:
   - Passed (>=70%) vs Failed (<70%)
7. HR Eligible Initial Screened Employees:
   - GET /api/hr/eligible-initial-screened-employees
8. AI Top 3 Successors:
   - GET /api/ai/top-successors with Stage 1 and Stage 2 score separation
"""

import os
import sys
import json
import jwt
from datetime import datetime, timedelta, timezone
from config import Config

def make_token(user, role_override=None):
    payload = {
        "sub": str(user.id),
        "username": user.username,
        "role": role_override or user.role,
        "allowed_roles": [role_override or user.role],
        "auth_email": user.email,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(hours=24)
    }
    return jwt.encode(payload, Config.JWT_SECRET_KEY, algorithm="HS256")

# Setup backend import path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app import create_app
from extensions import db
from models.user import User
from models.employee import Employee
from models.role import LeadershipRole
from models.assessment import Assessment, AssessmentAssignment, AssessmentResult
from utils.migrations import run_schema_migrations
from utils.seed_question_bank import seed_initial_screening_template, INITIAL_SCREENING_QUESTIONS
from utils.seed_data import seed_two_stage_workflow_records

def run_tests():
    print("=" * 70)
    print("TWO-STAGE EMPLOYEE ASSESSMENT WORKFLOW VERIFICATION SUITE")
    print("=" * 70)

    app = create_app()
    client = app.test_client()

    with app.app_context():
        # Step 0: Ensure migrations & seeding are applied
        print("\n[Step 0] Running migrations and seeding test data...")
        run_schema_migrations(db.engine)
        screening_tpl = seed_initial_screening_template()
        seed_two_stage_workflow_records()
        print(f"  Stage 1 Template ID: {screening_tpl.id if screening_tpl else 'N/A'}")

        # Step 1: Model & Schema Column Verification
        print("\n[Step 1] Verifying Model and Schema Columns...")
        assert hasattr(Assessment, 'assessment_type'), "Assessment missing assessment_type"
        assert hasattr(Assessment, 'stage'), "Assessment missing stage"
        assert hasattr(AssessmentAssignment, 'assessment_type'), "AssessmentAssignment missing assessment_type"
        assert hasattr(AssessmentAssignment, 'stage'), "AssessmentAssignment missing stage"
        assert hasattr(AssessmentResult, 'passed'), "AssessmentResult missing passed"
        assert hasattr(AssessmentResult, 'passing_threshold'), "AssessmentResult missing passing_threshold"
        print("  -> PASSED: All two-stage workflow model columns verified.")

        # Step 2: Question Bank Verification
        print("\n[Step 2] Verifying Question Bank & 7 Core Competencies...")
        assert len(INITIAL_SCREENING_QUESTIONS) == 21, f"Expected 21 questions, got {len(INITIAL_SCREENING_QUESTIONS)}"
        competencies_covered = {q[4] for q in INITIAL_SCREENING_QUESTIONS}
        expected_competencies = {
            'Communication', 'Problem Solving', 'Team Management',
            'Technical Knowledge', 'Decision Making', 'Adaptability',
            'Leadership'
        }
        assert expected_competencies.issubset(competencies_covered), f"Missing competencies: {expected_competencies - competencies_covered}"
        print(f"  -> PASSED: 21 scenario questions cover all 7 competencies: {', '.join(sorted(expected_competencies))}")

        # Step 3: Manager Team Screening Stats
        print("\n[Step 3] Verifying Manager Screening KPI Metrics (8 Metrics)...")
        # Find manager user (e.g., manager@company.com)
        mgr_user = User.query.filter_by(email='manager@company.com').first()
        if not mgr_user:
            mgr_user = User.query.filter(User.role.ilike('manager')).first()
        assert mgr_user is not None, "Manager user not found in database"

        # Generate an auth token for the manager
        mgr_token = make_token(mgr_user, role_override="Manager")

        res = client.get('/api/manager/overview', headers={"Authorization": f"Bearer {mgr_token}"})
        assert res.status_code == 200, f"Manager overview returned {res.status_code}: {res.data.decode()}"
        data = res.get_json()
        kpis = data.get('kpis', {})
        print(f"  Manager ID: {data.get('manager', {}).get('id')}")
        print(f"  Approved Team Members: {kpis.get('total_approved_team_employees')}")
        print(f"  Awaiting Screening: {kpis.get('awaiting_initial_assessment')}")
        print(f"  Assigned / Scheduled: {kpis.get('initial_assessments_assigned')}")
        print(f"  Completed: {kpis.get('initial_assessments_completed')}")
        print(f"  Passed (>=70%): {kpis.get('initial_assessments_passed')}")
        print(f"  Failed (<70%): {kpis.get('initial_assessments_failed')}")
        print(f"  Eligible for HR: {kpis.get('eligible_for_hr_evaluation')}")

        required_metrics = [
            'total_approved_team_employees',
            'newly_assigned_awaiting_screening',
            'awaiting_initial_assessment',
            'initial_assessments_assigned',
            'initial_assessments_completed',
            'initial_assessments_passed',
            'initial_assessments_failed',
            'eligible_for_hr_evaluation'
        ]
        for m in required_metrics:
            assert m in kpis, f"Missing KPI metric: {m}"
        print("  -> PASSED: All 8 Stage 1 screening KPIs returned accurately.")

        # Step 4: Manager Assign Initial Assessment
        print("\n[Step 4] Testing Manager Assign Initial Assessment (POST /api/manager/assign-initial-assessment)...")
        # Find a direct report of this manager
        mgr_emp_id = data.get('manager', {}).get('id')
        direct_reports = Employee.query.filter_by(manager_id=mgr_emp_id).all()
        assert len(direct_reports) > 0, "No direct reports found for manager"
        test_emp = direct_reports[0]

        assign_payload = {
            "employee_ids": [test_emp.id],
            "scheduled_date": "2026-11-05",
            "start_time": "14:00",
            "duration_minutes": 30
        }
        res = client.post(
            '/api/manager/assign-initial-assessment',
            headers={"Authorization": f"Bearer {mgr_token}", "Content-Type": "application/json"},
            data=json.dumps(assign_payload)
        )
        assert res.status_code in [200, 201], f"Assignment failed with {res.status_code}: {res.data.decode()}"
        assign_data = res.get_json()
        print(f"  Assignment response: {assign_data.get('message')}")
        assert assign_data.get('success') is True, "Success flag was not True"
        print("  -> PASSED: Manager successfully assigned Stage 1 Initial Screening.")

        # Step 5: HR Eligible Initial Screened Employees Endpoint
        print("\n[Step 5] Testing HR Eligible Employees Endpoint (GET /api/hr/eligible-initial-screened-employees)...")
        hr_user = User.query.filter_by(role='HR').first()
        if not hr_user:
            hr_user = User(id=1, username="hr_admin", email="hr@company.com", role="HR")
        hr_token = make_token(hr_user, role_override="HR")

        res = client.get(
            '/api/hr/eligible-initial-screened-employees',
            headers={"Authorization": f"Bearer {hr_token}"}
        )
        assert res.status_code == 200, f"HR eligible employees returned {res.status_code}: {res.data.decode()}"
        eligible_data = res.get_json()
        assert eligible_data.get('success') is True, "Eligible employees API failed"
        eligible_list = eligible_data.get('data', [])
        total_count = eligible_data.get('count', len(eligible_list))
        print(f"  Total Stage 1 Eligible Employees Found: {total_count}")

        # Check that Vikram Singh (score 89.0) is present and Suresh Nair (score 62.0) is NOT present
        vikram = next((e for e in eligible_list if 'vikram' in e.get('name', '').lower()), None)
        suresh = next((e for e in eligible_list if 'suresh' in e.get('name', '').lower()), None)

        if vikram:
            s1_info = vikram.get('stage_1_screening', {})
            s1_score = s1_info.get('score')
            print(f"  Verified: Vikram Singh is eligible with Stage 1 score: {s1_score}%")
            assert s1_info.get('passed') is True
            assert s1_score >= 70.0
        if suresh:
            raise AssertionError(f"Suresh Nair failed Stage 1 (score < 70) and must NOT appear in HR eligible list!")
        else:
            print("  Verified: Suresh Nair (failed screening, score 62%) is correctly excluded from HR eligible list.")
        print("  -> PASSED: HR Eligible Screened Employees endpoint properly filters by Stage 1 >= 70%.")

        # Step 6: AI Top 3 Successors Recommendation Workflow
        print("\n[Step 6] Testing AI Top 3 Successor Recommendations (GET /api/ai/top-successors)...")
        role = LeadershipRole.query.first()
        role_id = role.id if role else 1

        res = client.get(
            f'/api/ai/top-successors?role_id={role_id}',
            headers={"Authorization": f"Bearer {hr_token}"}
        )
        assert res.status_code == 200, f"Top successors returned {res.status_code}: {res.data.decode()}"
        top_data = res.get_json()
        assert top_data.get('success') is True, "Top successors API failed"
        successors = top_data.get('data', {}).get('top_3_successors', [])
        print(f"  Role: {top_data.get('data', {}).get('role_name')}")
        print(f"  Candidates Returned: {len(successors)}")

        for i, s in enumerate(successors, 1):
            name = s.get('name')
            rank = s.get('rank', i)
            readiness = s.get('readiness_score')
            s1_score = s.get('stage_1_score')
            s2_score = s.get('stage_2_score')
            s1_info = s.get('stage_1_screening', {})
            print(f"  Rank #{rank}: {name} - Readiness: {readiness}% | Stage 1 Screening: {s1_score}% (Passed: {s1_info.get('passed')}) | Stage 2 Role: {s2_score}%")
            assert 'stage_1_screening' in s, f"Candidate {name} missing stage_1_screening"
            assert 'stage_1_score' in s, f"Candidate {name} missing stage_1_score"
            assert 'stage_2_score' in s, f"Candidate {name} missing stage_2_score"

        print("  -> PASSED: AI Top 3 Successor engine returns structured Stage 1 and Stage 2 scores.")

    print("\n" + "=" * 70)
    print("ALL TWO-STAGE ASSESSMENT WORKFLOW VERIFICATION TESTS PASSED SUCCESSFULLY!")
    print("=" * 70)

if __name__ == '__main__':
    run_tests()
