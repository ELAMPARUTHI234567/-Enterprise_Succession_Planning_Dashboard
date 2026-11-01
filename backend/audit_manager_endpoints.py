import requests
import sys

BASE_URL = "http://127.0.0.1:5000/api"

def run_audit():
    print("================================================================================")
    print("STARTING LIVE HTTP ENDPOINT AUDIT (OVER-THE-WIRE TO FLASK SERVER)")
    print("================================================================================")

    # 1. Login as Manager (Sneha Reddy, Employee ID 4)
    res = requests.post(f"{BASE_URL}/login", json={"username": "manager", "password": "manager123"})
    assert res.status_code == 200, f"Manager login failed: {res.text}"
    mgr_data = res.json()["data"]
    mgr_token = mgr_data["token"]
    mgr_headers = {"Authorization": f"Bearer {mgr_token}", "Content-Type": "application/json"}
    print(f"[PASS] 1. Manager login succeeded. User: {mgr_data['user']['username']}, Role: {mgr_data['user']['role']}")

    # 2. Login as HR
    res = requests.post(f"{BASE_URL}/login", json={"username": "hr", "password": "hr123"})
    assert res.status_code == 200, f"HR login failed: {res.text}"
    hr_data = res.json()["data"]
    hr_token = hr_data["token"]
    hr_headers = {"Authorization": f"Bearer {hr_token}", "Content-Type": "application/json"}
    print(f"[PASS] 2. HR login succeeded. User: {hr_data['user']['username']}, Role: {hr_data['user']['role']}")

    # 3. Login as Employee (arun.kumar, Employee ID 1)
    res = requests.post(f"{BASE_URL}/login", json={"username": "arun.kumar", "password": "employee123"})
    assert res.status_code == 200, f"Employee login failed: {res.text}"
    emp_data = res.json()["data"]
    emp_token = emp_data["token"]
    emp_headers = {"Authorization": f"Bearer {emp_token}", "Content-Type": "application/json"}
    print(f"[PASS] 3. Employee login succeeded. User: {emp_data['user']['username']}, Role: {emp_data['user']['role']}")

    # 4. RBAC: Employee attempts GET /api/manager/overview -> 403 Forbidden
    res = requests.get(f"{BASE_URL}/manager/overview", headers=emp_headers)
    assert res.status_code == 403, f"Expected 403 for employee on manager overview, got {res.status_code}"
    print("[PASS] 4. RBAC: Employee blocked with 403 from Manager Overview.")

    # 5. RBAC: Employee attempts POST /api/manager/tasks -> 403 Forbidden
    res = requests.post(f"{BASE_URL}/manager/tasks", headers=emp_headers, json={"title": "Hacked Task"})
    assert res.status_code == 403, f"Expected 403 for employee creating task, got {res.status_code}"
    print("[PASS] 5. RBAC: Employee blocked with 403 from Task creation.")

    # 6. Manager GET /api/manager/overview -> 200 with all 8 metrics and 4 charts
    res = requests.get(f"{BASE_URL}/manager/overview", headers=mgr_headers)
    assert res.status_code == 200, f"Manager overview failed: {res.text}"
    overview = res.json()
    metrics = overview["kpis"]
    charts = overview["charts"]
    required_metric_keys = [
        "total_team_members", "active_tasks", "completed_tasks",
        "overdue_tasks", "projects_in_progress", "open_issues",
        "pending_feedback", "employees_needing_development"
    ]
    for key in required_metric_keys:
        assert key in metrics, f"Missing metric key: {key}"
    assert "task_status" in charts, "Missing task_status chart"
    assert "project_progress" in charts, "Missing project_progress chart"
    assert "competency_gaps" in charts, "Missing competency_gaps chart"
    assert "team_performance" in charts, "Missing team_performance chart"
    print(f"[PASS] 6. Manager Overview verified: 8 KPI cards & 4 charts backed by DB. Metrics: {metrics}")

    # 7. Manager GET /api/manager/team -> only authorized direct reports
    res = requests.get(f"{BASE_URL}/manager/team", headers=mgr_headers)
    assert res.status_code == 200, f"Manager team failed: {res.text}"
    team = res.json()["data"]
    team_ids = [m["id"] for m in team]
    assert 1 in team_ids, "Arun Kumar (ID 1) should be in direct reports"
    assert 5 not in team_ids, "Vikram Singh (ID 5) must NOT be in direct reports of Sneha Reddy"
    print(f"[PASS] 7. Manager Team scope verified: {len(team)} direct reports. IDs: {team_ids}")

    # 8. Manager GET /api/manager/team/1 -> Direct report profile
    res = requests.get(f"{BASE_URL}/manager/team/1", headers=mgr_headers)
    assert res.status_code == 200, f"Direct report profile failed: {res.text}"
    profile = res.json()["data"]
    assert profile["name"] == "Arun Kumar"
    print(f"[PASS] 8. Direct report profile verified: {profile['name']} ({profile['designation']})")

    # 9. Manager GET /api/manager/team/5 (Unauthorized employee) -> 403
    res = requests.get(f"{BASE_URL}/manager/team/5", headers=mgr_headers)
    assert res.status_code == 403, f"Expected 403 for foreign employee, got {res.status_code}"
    print("[PASS] 9. Manager blocked with 403 when requesting foreign employee profile.")

    # 10. Manager PUT /api/manager/team/1 -> update responsibilities
    res = requests.put(f"{BASE_URL}/manager/team/1", headers=mgr_headers, json={"responsibilities": "Lead sprint planning and system architecture audits."})
    assert res.status_code == 200, f"Update responsibilities failed: {res.text}"
    updated_profile = requests.get(f"{BASE_URL}/manager/team/1", headers=mgr_headers).json()["data"]
    assert "sprint planning" in updated_profile["responsibilities"]
    print("[PASS] 10. Direct report responsibilities updated and persisted.")

    # 11. Manager PUT /api/manager/team/5 (Unauthorized) -> 403
    res = requests.put(f"{BASE_URL}/manager/team/5", headers=mgr_headers, json={"responsibilities": "Invalid"})
    assert res.status_code == 403, f"Expected 403 on foreign employee update, got {res.status_code}"
    print("[PASS] 11. Foreign employee responsibilities update blocked with 403.")

    # 12. Task Management: Create Task
    task_payload = {
        "title": "E2E Production Audit Validation Task",
        "description": "Verify all manager API endpoints live.",
        "employee_id": 1,
        "priority": "High",
        "start_date": "2026-10-15",
        "due_date": "2026-10-20",
        "status": "In Progress",
        "project_name": "Succession v2"
    }
    res = requests.post(f"{BASE_URL}/manager/tasks", headers=mgr_headers, json=task_payload)
    assert res.status_code == 201, f"Task creation failed: {res.text}"
    created_task = res.json()["data"]
    task_id = created_task["id"]
    print(f"[PASS] 12. Task created with ID: {task_id}, Status: {created_task['status']}")

    # 13. Task Management: Reject foreign assignment
    bad_task = {
        "title": "Unauthorized Assignment",
        "employee_id": 5, # not direct report
        "due_date": "2026-10-25"
    }
    res = requests.post(f"{BASE_URL}/manager/tasks", headers=mgr_headers, json=bad_task)
    assert res.status_code == 403, f"Expected 403 for assigning task to non-report, got {res.status_code}"
    print("[PASS] 13. Task assignment to non-direct report rejected with 403.")

    # 14. Task Management: Update Task (Status -> Completed)
    res = requests.put(f"{BASE_URL}/manager/tasks/{task_id}", headers=mgr_headers, json={"status": "Completed"})
    assert res.status_code == 200, f"Task update failed: {res.text}"
    updated_task = res.json()["data"]
    assert updated_task["status"] == "Completed"
    assert updated_task["completed_at"] is not None
    print(f"[PASS] 14. Task updated to Completed, auto-assigned completion date: {updated_task['completed_at']}")

    # 15. Task Management: Delete Task
    res = requests.delete(f"{BASE_URL}/manager/tasks/{task_id}", headers=mgr_headers)
    assert res.status_code == 200, f"Task deletion failed: {res.text}"
    # Verify it is deleted
    all_tasks = requests.get(f"{BASE_URL}/manager/tasks", headers=mgr_headers).json()["data"]
    assert all(t["id"] != task_id for t in all_tasks)
    print(f"[PASS] 15. Task {task_id} successfully deleted from database.")

    # 16. Team Goal Management: Create Goal
    goal_payload = {
        "title": "Complete 100% Core Service Test Coverage",
        "description": "Attain zero regression across all endpoints.",
        "target_metric": 100.0,
        "current_metric": 85.0,
        "metric_unit": "%",
        "target_date": "2026-11-01",
        "status": "On Track"
    }
    res = requests.post(f"{BASE_URL}/manager/goals", headers=mgr_headers, json=goal_payload)
    assert res.status_code == 201, f"Goal creation failed: {res.text}"
    created_goal = res.json()["data"]
    goal_id = created_goal["id"]
    assert created_goal["progress_pct"] == 85.0
    print(f"[PASS] 16. Team Goal created with ID: {goal_id}, Progress: {created_goal['progress_pct']}%")

    # 17. Team Goal Management: Update Progress
    res = requests.put(f"{BASE_URL}/manager/goals/{goal_id}", headers=mgr_headers, json={"current_metric": 95.0})
    assert res.status_code == 200, f"Goal update failed: {res.text}"
    updated_goal = res.json()["data"]
    assert updated_goal["progress_pct"] == 95.0
    print(f"[PASS] 17. Goal progress updated to 95.0%.")

    # 18. Team Goal Management: Delete Goal
    res = requests.delete(f"{BASE_URL}/manager/goals/{goal_id}", headers=mgr_headers)
    assert res.status_code == 200, f"Goal deletion failed: {res.text}"
    print(f"[PASS] 18. Goal {goal_id} deleted cleanly.")

    # 19. Team Issue Management: Create Issue
    issue_payload = {
        "title": "API Gateway Latency Spike",
        "description": "Downstream latency higher than 300ms during peak load.",
        "employee_id": 1,
        "severity": "High"
    }
    res = requests.post(f"{BASE_URL}/manager/issues", headers=mgr_headers, json=issue_payload)
    assert res.status_code == 201, f"Issue creation failed: {res.text}"
    created_issue = res.json()["data"]
    issue_id = created_issue["id"]
    assert created_issue["status"] == "Open"
    print(f"[PASS] 19. Team Issue logged with ID: {issue_id}, Severity: {created_issue['severity']}")

    # 20. Team Issue Management: Resolve Issue
    res = requests.put(f"{BASE_URL}/manager/issues/{issue_id}", headers=mgr_headers, json={
        "status": "Resolved",
        "resolution_notes": "Implemented Redis connection pooling and query caching."
    })
    assert res.status_code == 200, f"Issue resolution failed: {res.text}"
    resolved_issue = res.json()["data"]
    assert resolved_issue["status"] == "Resolved"
    assert resolved_issue["resolved_at"] is not None
    print(f"[PASS] 20. Team Issue resolved with notes and timestamp: {resolved_issue['resolved_at']}")

    # 21. Team Issue Management: Delete Issue
    res = requests.delete(f"{BASE_URL}/manager/issues/{issue_id}", headers=mgr_headers)
    assert res.status_code == 200, f"Issue deletion failed: {res.text}"
    print(f"[PASS] 21. Team Issue {issue_id} deleted successfully.")

    # 22. Manager Feedback: Create Feedback
    fb_payload = {
        "employee_id": 1,
        "strengths": "Outstanding architectural discipline and team leadership.",
        "improvement_areas": "Increase cross-functional executive communications.",
        "development_plan": "Executive presentation workshop participation.",
        "is_private": True,
        "follow_up_status": "Scheduled"
    }
    res = requests.post(f"{BASE_URL}/manager/feedback", headers=mgr_headers, json=fb_payload)
    assert res.status_code == 201, f"Feedback submission failed: {res.text}"
    created_fb = res.json()["data"]
    fb_id = created_fb["id"]
    print(f"[PASS] 22. Manager 1-on-1 Feedback logged with ID: {fb_id}")

    # 23. Manager Feedback: Retrieve Feedback
    res = requests.get(f"{BASE_URL}/manager/feedback", headers=mgr_headers)
    assert res.status_code == 200, f"Feedback fetch failed: {res.text}"
    feedbacks = res.json()["data"]
    assert any(f["id"] == fb_id for f in feedbacks)
    print(f"[PASS] 23. Feedback retrieved successfully ({len(feedbacks)} records).")

    # 24. Performance Review: Record Review
    pr_payload = {
        "employee_id": 1,
        "rating": 92.0,
        "review_period": "Q3 2026",
        "review_notes": "Exceeded all sprint deliverables and demonstrated exemplary mentor capabilities.",
        "review_date": "2026-10-15"
    }
    res = requests.post(f"{BASE_URL}/manager/performance-reviews", headers=mgr_headers, json=pr_payload)
    assert res.status_code == 201, f"Performance review failed: {res.text}"
    pr_record = res.json()["data"]
    print(f"[PASS] 24. Performance Review recorded. Rating: {pr_record['rating']}, Period: {pr_record['review_period']}")

    # 25. Manager Recommendation: Submit to HR (with 5-factor suitability calculation)
    rec_payload = {
        "employee_id": 1,
        "role_id": 1, # Project Manager
        "strengths_summary": "Deep technical acumen, proven timeline control, top competency scores.",
        "development_needs": "Advanced stakeholder negotiation.",
        "recommendation_notes": "Ready to assume Technical Project Manager role."
    }
    res = requests.post(f"{BASE_URL}/manager/recommendations", headers=mgr_headers, json=rec_payload)
    assert res.status_code == 201, f"Recommendation submission failed: {res.text}"
    created_rec = res.json()["data"]
    rec_id = created_rec["id"]
    fit_score = created_rec["suitability_score"]
    readiness = created_rec["readiness_level"]
    assert fit_score is not None and fit_score > 0
    print(f"[PASS] 25. Recommendation submitted to HR with 5-factor fit score: {fit_score}%, Readiness: {readiness}")

    # 26. Manager attempts to review/approve own recommendation -> 403 Forbidden (Only HR allowed)
    res = requests.put(f"{BASE_URL}/manager/recommendations/{rec_id}/review", headers=mgr_headers, json={"status": "Approved"})
    assert res.status_code == 403, f"Expected 403 for Manager reviewing recommendation, got {res.status_code}"
    print("[PASS] 26. Manager prevented with 403 from approving own recommendation (Strict HR separation).")

    # 27. HR reviews and approves recommendation
    hr_review_payload = {
        "status": "Approved",
        "hr_feedback": "Approved for succession candidate pool for Q4 2026 review board."
    }
    res = requests.put(f"{BASE_URL}/manager/recommendations/{rec_id}/review", headers=hr_headers, json=hr_review_payload)
    assert res.status_code == 200, f"HR review failed: {res.text}"
    reviewed_rec = res.json()["data"]
    assert reviewed_rec["status"] == "Approved"
    assert reviewed_rec["hr_feedback"] == hr_review_payload["hr_feedback"]
    print(f"[PASS] 27. HR review and approval succeeded. Status: {reviewed_rec['status']}")

    print("================================================================================")
    print("ALL 27 LIVE ENDPOINT & SECURITY CHECKS PASSED WITH 100% SUCCESS!")
    print("================================================================================")

if __name__ == "__main__":
    run_audit()
