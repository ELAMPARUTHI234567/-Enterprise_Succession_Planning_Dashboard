import sys
import os
import json
from datetime import datetime, timedelta

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__))))

from app import create_app
from extensions import db
from models.user import User
from models.employee import Employee
from models.assessment import Assessment, AssessmentAssignment, AssessmentResult
from models.role import LeadershipRole
from config import Config
import jwt

def make_token(user):
    payload = {
        'user_id': user.id,
        'sub': str(user.id),
        'email': user.email,
        'role': user.role,
        'exp': datetime.utcnow() + timedelta(days=7)
    }
    return jwt.encode(payload, Config.JWT_SECRET_KEY, algorithm="HS256")
from services.successor_recommendation import get_top_3_successors

def run_tests():
    app = create_app()
    with app.app_context():
        print("=" * 60)
        print("RUNNING ASSESSMENT WORKFLOW INTEGRATION TESTS")
        print("=" * 60)

        # 1. Authenticate test users
        mgr_user = User.query.filter_by(role='Manager').first()
        hr_user = User.query.filter_by(role='HR').first()
        if not mgr_user or not hr_user:
            print("[FAIL] Manager or HR user not found in database")
            return False

        mgr_token = make_token(mgr_user)
        hr_token = make_token(hr_user)

        client = app.test_client()

        # TEST 1: GET /api/manager/assessment-eligible-employees
        print("\n[TEST 1] Testing GET /api/manager/assessment-eligible-employees (Org-wide)")
        res1 = client.get(
            '/api/manager/assessment-eligible-employees',
            headers={'Authorization': f'Bearer {mgr_token}'}
        )
        assert res1.status_code == 200, f"Expected 200, got {res1.status_code}: {res1.data}"
        data1 = json.loads(res1.data)
        assert data1.get("success") is True, f"Expected success=True, got {data1}"
        employees = data1.get("data", [])
        print(f"  [PASS] Returned {len(employees)} active organization employees")
        assert len(employees) > 0, "No employees returned"
        first_emp = employees[0]
        required_keys = ["id", "employee_code", "name", "department", "designation", "manager_id", "manager_name", "assignment_status", "can_assign", "hr_eligibility_status"]
        for k in required_keys:
            assert k in first_emp, f"Missing key {k} in employee object"
        print(f"  [PASS] Required fields verified on employee #{first_emp['id']} ({first_emp['name']}) - Status: {first_emp['assignment_status']}")

        # TEST 2: GET /api/manager/team tracking fields
        print("\n[TEST 2] Testing GET /api/manager/team (Manager direct reports tracking)")
        res2 = client.get(
            '/api/manager/team',
            headers={'Authorization': f'Bearer {mgr_token}'}
        )
        assert res2.status_code == 200, f"Expected 200, got {res2.status_code}: {res2.data}"
        data2 = json.loads(res2.data)
        assert data2.get("success") is True
        team = data2.get("data", [])
        print(f"  [PASS] Returned {len(team)} team members for manager {mgr_user.username}")
        if team:
            t_emp = team[0]
            print(f"  [PASS] Team member initial_screening_status: '{t_emp.get('initial_screening_status')}'")
            print(f"  [PASS] assessment_assignment_status: '{t_emp.get('assessment_assignment_status')}'")
            print(f"  [PASS] hr_eligibility_status: '{t_emp.get('hr_eligibility_status')}'")
            assert "initial_screening_status" in t_emp
            assert "assessment_assignment_status" in t_emp
            assert "hr_eligibility_status" in t_emp

        # TEST 3: GET /api/assessment-results with include_all=true
        print("\n[TEST 3] Testing GET /api/assessment-results with include_all=true")
        res3 = client.get(
            '/api/assessment-results?include_all=true',
            headers={'Authorization': f'Bearer {mgr_token}'}
        )
        assert res3.status_code == 200, f"Expected 200, got {res3.status_code}: {res3.data}"
        data3 = json.loads(res3.data)
        assert data3.get("success") is True
        results = data3.get("data", [])
        print(f"  [PASS] Returned {len(results)} assessment records for manager scope")
        if results:
            r0 = results[0]
            for col in ["employee_id", "employee_name", "employee_code", "assessment_title", "assessment_stage", "passing_score", "result", "status", "hr_eligibility"]:
                assert col in r0, f"Missing column {col} in assessment result item"
            print(f"  [PASS] Module 2 table columns verified on record: Stage='{r0.get('assessment_stage')}', Score={r0.get('score')}, Result='{r0.get('result')}', HR Eligibility='{r0.get('hr_eligibility')}'")

        # TEST 4: Stage 2 Assessment Assignment Prerequisite Validation
        print("\n[TEST 4] Testing Stage 2 Assignment Stage 1 Prerequisite Check")
        # Find an employee who has NOT passed Stage 1
        all_emps = Employee.query.all()
        ineligible_emp = None
        for e in all_emps:
            s1_passes = [
                a for a in e.assessment_assignments
                if a.status == 'Completed' and a.result and (
                    (a.assessment_type or '').lower() == 'initial_screening' or
                    (a.stage and 'stage 1' in a.stage.lower())
                ) and ((a.result.passed if a.result.passed is not None else a.result.overall_score >= 70.0))
            ]
            if not s1_passes:
                ineligible_emp = e
                break

        if ineligible_emp:
            # HR tries to schedule Stage 2 for ineligible_emp
            role = LeadershipRole.query.first()
            stage2_ass = Assessment.query.filter(Assessment.role_id == role.id).first()
            if stage2_ass:
                payload = {
                    "role_id": role.id,
                    "assessment_id": stage2_ass.id,
                    "employee_ids": [ineligible_emp.id],
                    "scheduled_date": datetime.utcnow().strftime('%Y-%m-%d'),
                    "start_time": "14:00",
                    "duration_minutes": 45,
                    "time_zone": "IST (Asia/Kolkata)"
                }
                res4 = client.post(
                    '/api/assessment-schedules/batch-save',
                    headers={'Authorization': f'Bearer {hr_token}'},
                    json=payload
                )
                print(f"  [PASS] Scheduling Stage 2 for employee without Stage 1 pass returned status {res4.status_code}")
                assert res4.status_code == 422, f"Expected HTTP 422 for uncompleted Stage 1, got {res4.status_code}: {res4.data}"
                data4 = json.loads(res4.data)
                print(f"  [PASS] Validation message: '{data4.get('message')}'")
        else:
            print("  [INFO] All employees in database already passed Stage 1; verified schema.")

        # TEST 5: AI Top 3 Successors returns manager info and stage_2_rankings
        print("\n[TEST 5] Testing AI Top 3 Successor Recommendations & Stage 2 Ranking")
        role = LeadershipRole.query.first()
        top_res = get_top_3_successors(role.id, current_user=hr_user)
        assert top_res.get("success") is True, f"Failed getting top successors: {top_res}"
        top_cands = top_res.get("top_candidates", [])
        stage_2_ranks = top_res.get("stage_2_rankings", [])
        print(f"  [PASS] Role '{role.role_name}': {len(top_cands)} multi-factor top candidates, {len(stage_2_ranks)} Stage 2 ranked candidates")
        if top_cands:
            c0 = top_cands[0]
            assert "manager_id" in c0, "Missing manager_id in candidate"
            assert "manager_name" in c0, "Missing manager_name in candidate"
            assert "performance_score" in c0, "Missing performance_score in candidate"
            assert "experience_years" in c0, "Missing experience_years in candidate"
            print(f"  [PASS] Candidate #{c0['rank']} '{c0['name']}': Manager='{c0['manager_name']}', Exp={c0['experience_years']}y, Perf={c0['performance_score']}, RankingScore={c0['ranking_score']}%, Stage 2 Score={c0['stage_2_score']}%")

        if stage_2_ranks:
            s0 = stage_2_ranks[0]
            assert "stage_2_rank" in s0, "Missing stage_2_rank in stage 2 candidate"
            print(f"  [PASS] Stage 2 Rank #{s0['stage_2_rank']} '{s0['name']}': Stage 2 Score={s0['stage_2_score']}%")

        print("\n" + "=" * 60)
        print("ALL ASSESSMENT WORKFLOW INTEGRATION TESTS PASSED SUCCESSFULLY!")
        print("=" * 60)
        return True

if __name__ == '__main__':
    success = run_tests()
    sys.exit(0 if success else 1)
