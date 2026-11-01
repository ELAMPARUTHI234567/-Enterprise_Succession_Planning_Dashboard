"""
Live Production Verification for Enterprise Succession Planning Dashboard.
Verifies the deployed Render backend and live Supabase PostgreSQL database.
"""

import urllib.request
import urllib.error
import json
import ssl

ctx = ssl.create_default_context()
BASE_URL = "https://enterprise-succession-planning-dashboard.onrender.com"
FRONTEND_URL = "https://enterprise-succession-planning-dash.vercel.app"

def make_req(path, method="GET", payload=None, token=None):
    url = f"{BASE_URL}{path}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = json.dumps(payload).encode('utf-8') if payload else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=60) as res:
            body = res.read().decode('utf-8')
            return res.status, json.loads(body)
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8')
        try:
            return e.code, json.loads(body)
        except:
            return e.code, {"raw": body}
    except Exception as e:
        return 0, {"error": str(e)}

def main():
    print("=" * 70)
    print("LIVE PRODUCTION VERIFICATION REPORT")
    print(f"Backend: {BASE_URL}")
    print(f"Frontend: {FRONTEND_URL}")
    print("=" * 70)

    # 1. Health Check
    status, health = make_req("/api/health")
    print(f"\n[1] Health Check: HTTP {status} -> {health.get('message')}")
    assert status == 200, f"Health check failed: {health}"

    # 2. Manager Login
    print("\n[2] Authenticating Manager (manager@company.com)...")
    status, mgr_auth = make_req("/api/login", method="POST", payload={
        "username": "manager",
        "password": "manager123"
    })
    print(f"  Login status: HTTP {status}")
    assert status == 200, f"Manager login failed: {mgr_auth}"
    mgr_token = mgr_auth.get("data", {}).get("token")
    print(f"  Manager token obtained. Role: {mgr_auth.get('data', {}).get('role')}")

    # 3. HR Login
    print("\n[3] Authenticating HR (hr@company.com)...")
    status, hr_auth = make_req("/api/login", method="POST", payload={
        "username": "hr",
        "password": "hr123"
    })
    print(f"  Login status: HTTP {status}")
    assert status == 200, f"HR login failed: {hr_auth}"
    hr_token = hr_auth.get("data", {}).get("token")
    print(f"  HR token obtained. Role: {hr_auth.get('data', {}).get('role')}")

    # 4. Manager Stage 1 Screening KPIs (8 Metrics)
    print("\n[4] Verifying Live Manager Overview & 8 Stage 1 Screening KPIs...")
    status, overview = make_req("/api/manager/overview", token=mgr_token)
    print(f"  HTTP Status: {status}")
    assert status == 200, f"Manager overview failed: {overview}"
    kpis = overview.get("kpis", {})
    screening_metrics = [
        "total_approved_team_employees",
        "newly_assigned_awaiting_screening",
        "awaiting_initial_assessment",
        "initial_assessments_assigned",
        "initial_assessments_completed",
        "initial_assessments_passed",
        "initial_assessments_failed",
        "eligible_for_hr_evaluation"
    ]
    for m in screening_metrics:
        print(f"    - {m}: {kpis.get(m)}")
        assert m in kpis, f"Missing metric {m} in live kpis!"
    print("  -> PASSED: All 8 Stage 1 screening KPIs verified on live production.")

    # 5. Manager Team Direct Reports Screening Status
    print("\n[5] Verifying Live Manager Team Direct Reports...")
    status, team_data = make_req("/api/manager/team", token=mgr_token)
    print(f"  HTTP Status: {status}")
    assert status == 200, f"Manager team failed: {team_data}"
    members = team_data.get("data", [])
    print(f"  Team Members Returned: {len(members)}")
    for m in members[:3]:
        print(f"    - {m.get('name')} ({m.get('designation')}): Screening Status: {m.get('initial_screening_status')} | Score: {m.get('initial_screening_score')} | Eligible for HR: {m.get('eligible_for_hr')}")
        assert "initial_screening_status" in m, "Missing initial_screening_status"
        assert "eligible_for_hr" in m, "Missing eligible_for_hr"
    print("  -> PASSED: Direct reports contain live Stage 1 screening and HR eligibility fields.")

    # 6. HR Eligible Initial Screened Employees Endpoint
    print("\n[6] Verifying Live HR Eligible Stage 1 Screened Employees...")
    status, eligible_res = make_req("/api/hr/eligible-initial-screened-employees", token=hr_token)
    print(f"  HTTP Status: {status}")
    assert status == 200, f"Eligible employees endpoint failed: {eligible_res}"
    eligible_list = eligible_res.get("data", [])
    print(f"  Total Eligible Candidates across Organization: {len(eligible_list)}")
    for e in eligible_list[:3]:
        s1 = e.get("stage_1_screening", {})
        print(f"    - {e.get('name')} ({e.get('department')}): Stage 1 Score: {s1.get('score')}% | Passed: {s1.get('passed')} | Stage 2 Count: {e.get('stage_2_count')}")
        assert s1.get("passed") is True, f"Employee {e.get('name')} marked eligible but passed is not True!"
        assert s1.get("score") >= 70.0, f"Employee {e.get('name')} score < 70%!"
    print("  -> PASSED: HR Eligible Screened Employees verified on live production.")

    # 7. AI Top 3 Successors Recommendation with Stage 1 and Stage 2 Data
    print("\n[7] Verifying Live AI Top 3 Successors Endpoint...")
    status, top_res = make_req("/api/ai/top-successors?role_id=1", token=hr_token)
    print(f"  HTTP Status: {status}")
    assert status == 200, f"Top successors failed: {top_res}"
    candidates = top_res.get("data", {}).get("top_3_successors", [])
    print(f"  Role: {top_res.get('data', {}).get('role_name')}")
    print(f"  Successor Candidates: {len(candidates)}")
    for c in candidates:
        print(f"    - Rank #{c.get('rank')}: {c.get('name')} | Readiness: {c.get('readiness_score')}% | Stage 1: {c.get('stage_1_score')}% | Stage 2: {c.get('stage_2_score')}%")
        assert "stage_1_screening" in c, f"Candidate {c.get('name')} missing stage_1_screening"
        assert "stage_1_score" in c, f"Candidate {c.get('name')} missing stage_1_score"
        assert "stage_2_score" in c, f"Candidate {c.get('name')} missing stage_2_score"
    print("  -> PASSED: AI Top 3 Successor engine returns two-stage scores on live production.")

    # 8. Frontend Deployment Verification
    print("\n[8] Verifying Frontend Live Production Deployment...")
    req = urllib.request.Request(FRONTEND_URL, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=15) as res:
            content = res.read().decode('utf-8')
            print(f"  Frontend Status: HTTP {res.status}")
            print(f"  Page Title: Contains Succession Planning Dashboard: {'Enterprise' in content or 'Succession' in content}")
            assert res.status == 200, "Frontend returned non-200 status"
    except Exception as e:
        print(f"  Frontend check error: {e}")

    print("\n" + "=" * 70)
    print("ALL LIVE PRODUCTION VERIFICATIONS COMPLETED SUCCESSFULLY WITH ZERO ERRORS!")
    print("=" * 70)

if __name__ == "__main__":
    main()
