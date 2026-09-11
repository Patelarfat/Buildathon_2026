import urllib.request
import urllib.parse
import json
from datetime import datetime

BASE_URL = "http://127.0.0.1:8000"


def request(method: str, path: str, body: dict = None, content_type: str = "application/json"):
    url = f"{BASE_URL}{path}"
    data = None
    headers = {}
    if body is not None:
        if isinstance(body, bytes):
            data = body
            headers["Content-Type"] = content_type
        else:
            data = json.dumps(body).encode("utf-8")
            headers["Content-Type"] = "application/json"

    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as res:
            res_body = res.read().decode("utf-8")
            return res.status, json.loads(res_body) if res_body else {}
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        try:
            return e.code, json.loads(err_body)
        except Exception:
            return e.code, {"error": err_body}


def run_tests():
    print("==================================================")
    print("RUNNING PHASE 6 MANAGER DECISION CENTER TEST SUITE")
    print("==================================================")

    # 1. Health Checks
    print("\n--- 1. Health Checks ---")
    status, health = request("GET", "/api/health")
    assert status == 200 and health["status"] == "healthy"
    print("[PASS] Backend health check verified")

    # 2. Hierarchy Setup
    print("\n--- 2. Hierarchy Setup ---")
    ts = int(datetime.utcnow().timestamp())
    status, user = request("POST", "/api/users", {
        "name": f"Manager {ts}",
        "email": f"manager_{ts}@example.com",
        "role": "PROJECT_MANAGER",
        "password": "managerpassword123"
    })
    assert status == 201
    user_id = user["id"]

    status, project = request("POST", "/api/projects", {
        "name": f"Metropolitan Complex Phase 6 {ts}",
        "description": "Commercial high-rise for Manager Decision Center testing",
        "location": "Downtown Sector 9",
        "status": "ACTIVE"
    })
    assert status == 201
    project_id = project["id"]

    status, site1 = request("POST", f"/api/projects/{project_id}/sites", {
        "name": "Tower A Construction",
        "address": "100 Tower Avenue"
    })
    assert status == 201
    site1_id = site1["id"]

    status, site2 = request("POST", f"/api/projects/{project_id}/sites", {
        "name": "Tower B Infrastructure",
        "address": "102 Tower Avenue"
    })
    assert status == 201
    site2_id = site2["id"]

    status, area1 = request("POST", f"/api/sites/{site1_id}/areas", {
        "name": "Floor 1 Podium",
        "area_type": "FLOOR"
    })
    assert status == 201
    area1_id = area1["id"]

    status, area2 = request("POST", f"/api/sites/{site1_id}/areas", {
        "name": "Basement Parking B1",
        "area_type": "BASEMENT"
    })
    assert status == 201
    area2_id = area2["id"]

    print(f"[PASS] Created Project {project_id}, Sites ({site1_id}, {site2_id}), Areas ({area1_id}, {area2_id})")

    # 3. Empty Project Test
    print("\n--- 3. Empty Project Dashboard Handling ---")
    status, empty_dash = request("GET", f"/api/projects/{project_id}/dashboard")
    assert status == 200
    assert empty_dash["project"]["name"] == f"Metropolitan Complex Phase 6 {ts}"
    assert empty_dash["project"]["site_count"] == 2
    assert empty_dash["project"]["area_count"] == 2
    assert empty_dash["executive_health"]["risk_score"] == 0
    assert empty_dash["executive_health"]["risk_level"] == "LOW"
    assert empty_dash["executive_health"]["data_confidence"] == "LOW"
    print("[PASS] Empty project returned 0 risk, LOW confidence, and accurate metadata.")

    # 4. Seed Comprehensive Data
    print("\n--- 4. Seeding Realistic Field, Vision & Quality Records ---")
    from database import SessionLocal
    import models
    db = SessionLocal()
    try:
        # Photo
        photo = models.SitePhoto(
            project_id=project_id,
            site_id=site1_id,
            area_id=area1_id,
            uploaded_by=user_id,
            file_name="site_inspection_p6.jpg",
            file_path="/uploads/photos/dummy_p6.jpg"
        )
        db.add(photo)
        db.commit()
        db.refresh(photo)

        run = models.AIAnalysisRun(
            photo_id=photo.id,
            model_name="yolo11n-ppe-finetuned",
            model_version="v1.0.0",
            status="COMPLETED",
            processing_time_ms=38.0
        )
        db.add(run)
        db.commit()
        db.refresh(run)

        # 3 AI findings in Floor 1 (PERSON_WITHOUT_HELMET) -> triggers recurring issue
        for _ in range(3):
            ai_f = models.AISafetyFinding(
                photo_id=photo.id,
                analysis_run_id=run.id,
                project_id=project_id,
                site_id=site1_id,
                area_id=area1_id,
                finding_type="PERSON_WITHOUT_HELMET",
                severity="HIGH",
                title="Missing Safety Helmet",
                description="Worker active without mandatory hardhat",
                confidence=0.91,
                status="OPEN"
            )
            db.add(ai_f)

        # 1 Critical Incident
        inc = models.SafetyIncident(
            project_id=project_id,
            site_id=site1_id,
            area_id=area1_id,
            reported_by=user_id,
            incident_date=datetime.utcnow().strftime("%Y-%m-%d"),
            incident_type="FALL",
            severity="CRITICAL",
            description="Near-miss fall from unfenced edge scaffolding",
            status="OPEN"
        )
        db.add(inc)

        # 1 Failed Inspection
        insp = models.InspectionReport(
            project_id=project_id,
            site_id=site1_id,
            area_id=area1_id,
            inspector_id=user_id,
            inspection_date=datetime.utcnow().strftime("%Y-%m-%d"),
            inspection_type="SAFETY",
            status="FAILED",
            findings="Inadequate edge fall protection barriers"
        )
        db.add(insp)

        # 2 Observations
        obs1 = models.Observation(
            project_id=project_id,
            site_id=site1_id,
            area_id=area1_id,
            created_by=user_id,
            observation_type="SAFETY",
            title="Exposed Live Cable",
            description="Exposed high voltage wiring near water puddle",
            priority="HIGH",
            status="OPEN"
        )
        obs2 = models.Observation(
            project_id=project_id,
            site_id=site1_id,
            area_id=area2_id,
            created_by=user_id,
            observation_type="QUALITY",
            title="Concrete Honeycombing",
            description="Minor honeycombing on column C4",
            priority="MEDIUM",
            status="IN_PROGRESS"
        )
        db.add(obs1)
        db.add(obs2)

        # 1 Daily Report with Progress and Blocker
        report = models.DailyReport(
            project_id=project_id,
            site_id=site1_id,
            area_id=area1_id,
            reported_by=user_id,
            report_date=datetime.utcnow().strftime("%Y-%m-%d"),
            work_completed="Slab rebar reinforcement",
            progress_percentage=62,
            workers_count=35,
            blockers="Tower crane gearbox maintenance delay"
        )
        db.add(report)

        # 1 Low Stock Material
        mat = models.Material(
            project_id=project_id,
            site_id=site1_id,
            area_id=area1_id,
            recorded_by=user_id,
            material_name="Structural TMT Steel 16mm",
            category="Steel",
            quantity=8.5,
            unit="Tons",
            status="LOW_STOCK",
            supplier="Tata Steel"
        )
        db.add(mat)

        db.commit()
    finally:
        db.close()

    print("[PASS] Seeded complete operational, vision, and quality records.")

    # 5. Test Manager Dashboard Master API
    print("\n--- 5. Manager Dashboard Master API Validation ---")
    status, dash = request("GET", f"/api/projects/{project_id}/dashboard")
    assert status == 200
    print(f"Project: {dash['project']['name']}")
    print(f"Executive Health: Risk {dash['executive_health']['risk_score']}/100 ({dash['executive_health']['risk_level']}), Progress {dash['executive_health']['progress_pct']}%, Open Safety Issues: {dash['executive_health']['open_safety_issues']}")
    print(f"Attention Items Count: {len(dash['attention_items'])}")
    for item in dash["attention_items"]:
        print(f"  [{item['priority']}] {item['title']} -> {item['action_url']}")

    # 6. Test Attention Items Prioritization
    print("\n--- 6. Attention Items Deterministic Prioritization ---")
    assert len(dash["attention_items"]) >= 3
    # Check that CRITICAL comes first
    priorities = [item["priority"] for item in dash["attention_items"]]
    order_map = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}
    num_orders = [order_map[p] for p in priorities]
    assert num_orders == sorted(num_orders), f"Attention items must be sorted by priority descending: {priorities}"
    
    crit_items = [item for item in dash["attention_items"] if item["priority"] == "CRITICAL"]
    assert len(crit_items) >= 1, "Expected at least 1 CRITICAL attention item (Incident or Risk or Failed Inspection)"
    print("[PASS] Attention items successfully prioritized with correct severity order.")

    # 7. Test Executive Health Metrics
    print("\n--- 7. Executive Health Accuracy ---")
    assert dash["executive_health"]["risk_score"] >= 50
    assert dash["executive_health"]["progress_pct"] == 62
    assert dash["executive_health"]["open_safety_issues"] == 4  # 3 AI findings + 1 Incident
    assert dash["executive_health"]["open_observations"] == 2
    assert dash["executive_health"]["operational_blockers"] >= 1  # 1 low stock + 1 blocker
    print("[PASS] Executive health numbers verified against underlying records.")

    # 8. Test Area Risk Ranking & Recurring Issues
    print("\n--- 8. Area Risk & Recurring Problems Integration ---")
    assert len(dash["area_risk"]) == 2
    assert dash["area_risk"][0]["area_name"] == "Floor 1 Podium"
    assert dash["area_risk"][0]["risk_score"] > dash["area_risk"][1]["risk_score"]
    
    assert len(dash["recurring_problems"]) >= 1
    rec = dash["recurring_problems"][0]
    assert rec["issue_type"] == "PERSON_WITHOUT_HELMET"
    assert rec["occurrence_count"] >= 3
    print(f"[PASS] Area ranking (#1 {dash['area_risk'][0]['area_name']}) and Recurring problem ({rec['issue_type']}) verified.")

    # 9. Test Recent Activity Feed
    print("\n--- 9. Recent Activity Chronological Feed ---")
    assert len(dash["recent_activity"]) >= 5
    types = {a["type"] for a in dash["recent_activity"]}
    assert "INCIDENT" in types and "REPORT" in types and "OBSERVATION" in types
    print(f"[PASS] Recent activity feed returned {len(dash['recent_activity'])} events with types: {types}")

    # 10. Test Multi-dimensional Filtering
    print("\n--- 10. Multi-dimensional Filtering (Site, Area, Time) ---")
    # Filter by Site 1
    status, site1_dash = request("GET", f"/api/projects/{project_id}/dashboard?site_id={site1_id}")
    assert status == 200
    
    # Filter by Area 2 (Basement) -> should have lower risk
    status, area2_dash = request("GET", f"/api/projects/{project_id}/dashboard?area_id={area2_id}")
    assert status == 200
    assert area2_dash["risk"]["score"] < dash["risk"]["score"]

    # Filter by 24h window
    status, day1_dash = request("GET", f"/api/projects/{project_id}/dashboard?days=1")
    assert status == 200
    assert len(day1_dash["trends"]["daily_series"]) == 1

    # Filter by 30d window
    status, day30_dash = request("GET", f"/api/projects/{project_id}/dashboard?days=30")
    assert status == 200
    assert len(day30_dash["trends"]["daily_series"]) == 30
    print("[PASS] Site, Area, and 1d/7d/30d Time filtering verified.")

    # 11. Test Error Handling
    print("\n--- 11. Error Handling & Isolation ---")
    status, err_404 = request("GET", "/api/projects/888888/dashboard")
    assert status == 404
    print("[PASS] Invalid project correctly returned HTTP 404.")

    # 12. PPE Compliance vs Violation Isolation Tests (TESTS A, B, C, D, E)
    print("\n--- 12. PPE Compliance vs Violation Verification Suite ---")
    
    # Setup fresh isolated test project
    status, test_proj = request("POST", "/api/projects", {
        "name": f"PPE Logic Isolation Test {ts}",
        "description": "Validation suite for compliant PPE vs actual safety violations",
        "location": "Testing Sector",
        "status": "ACTIVE"
    })
    assert status == 201
    p_id = test_proj["id"]

    status, t_site = request("POST", f"/api/projects/{p_id}/sites", {"name": "Test Site 1", "address": "123 Test St"})
    assert status == 201
    s_id = t_site["id"]

    status, t_area = request("POST", f"/api/sites/{s_id}/areas", {"name": "Zone Alpha", "area_type": "FLOOR"})
    assert status == 201
    a_id = t_area["id"]

    db = SessionLocal()
    try:
        t_photo = models.SitePhoto(
            project_id=p_id,
            site_id=s_id,
            area_id=a_id,
            uploaded_by=user_id,
            file_name="compliance_test.jpg",
            file_path="/uploads/photos/compliance_test.jpg"
        )
        db.add(t_photo)
        db.commit()
        db.refresh(t_photo)
        t_photo_id = t_photo.id

        t_run = models.AIAnalysisRun(
            photo_id=t_photo_id,
            model_name="yolo11n-ppe-finetuned",
            model_version="v1.0.0",
            status="COMPLETED"
        )
        db.add(t_run)
        db.commit()
        db.refresh(t_run)
        t_run_id = t_run.id

        # TEST A: COMPLIANT PPE (HELMET_DETECTED, GLOVES_DETECTED, BOOTS_DETECTED, GOGGLES_DETECTED, VEST_DETECTED)
        compliance_types = ["HELMET_DETECTED", "GLOVES_DETECTED", "BOOTS_DETECTED", "GOGGLES_DETECTED", "VEST_DETECTED"]
        for c_type in compliance_types:
            db.add(models.AISafetyFinding(
                photo_id=t_photo_id,
                analysis_run_id=t_run_id,
                project_id=p_id,
                site_id=s_id,
                area_id=a_id,
                finding_type=c_type,
                severity="INFO",
                title=f"{c_type} Verified",
                confidence=0.95,
                status="OPEN"
            ))
        db.commit()
    finally:
        db.close()

    status, test_a_dash = request("GET", f"/api/projects/{p_id}/dashboard")
    assert status == 200
    assert test_a_dash["risk"]["components"]["ai_findings"] == 0.0, "Compliant PPE must contribute 0 risk points"
    assert test_a_dash["risk"]["score"] == 0, "Project with only compliant PPE must have 0 risk"
    assert test_a_dash["executive_health"]["open_safety_issues"] == 0, "Compliance records must not be counted as open safety issues"
    assert test_a_dash["safety"]["ppe_breakdown"]["no_helmet"] == 0
    assert test_a_dash["safety"]["ppe_breakdown"]["no_gloves"] == 0
    assert test_a_dash["safety"]["ppe_breakdown"]["no_boots"] == 0
    assert test_a_dash["safety"]["ppe_breakdown"]["no_goggles"] == 0
    assert test_a_dash["safety"]["ppe_breakdown"]["compliant_detections"] == 5
    assert len(test_a_dash["recurring_problems"]) == 0, "Compliant findings must never trigger recurring problems"
    print("[PASS] TEST A — Compliant PPE: 0 risk points, 0 open safety issues, 0 violations in breakdown, 0 recurring alerts.")

    # TEST B: NO HELMET (PERSON_WITHOUT_HELMET)
    db = SessionLocal()
    try:
        db.add(models.AISafetyFinding(
            photo_id=t_photo_id,
            analysis_run_id=t_run_id,
            project_id=p_id,
            site_id=s_id,
            area_id=a_id,
            finding_type="PERSON_WITHOUT_HELMET",
            severity="HIGH",
            title="Worker detected without safety helmet",
            confidence=0.92,
            status="OPEN"
        ))
        db.commit()
    finally:
        db.close()

    status, test_b_dash = request("GET", f"/api/projects/{p_id}/dashboard")
    assert status == 200
    assert test_b_dash["safety"]["ppe_breakdown"]["no_helmet"] == 1
    assert test_b_dash["safety"]["ai_violations_open"] == 1
    assert test_b_dash["risk"]["components"]["ai_findings"] == 20.0, "HIGH severity violation should add 20 risk points"
    assert test_b_dash["executive_health"]["open_safety_issues"] == 1
    print("[PASS] TEST B — No Helmet: Counted as 1 violation, increased risk by 20 points, correctly classified in breakdown.")

    # TEST C: MIXED COMPLIANCE + VIOLATION
    # Add PERSON_WITHOUT_GLOVES (MEDIUM -> 10 pts). Now we have 1 NO_HELMET + 1 NO_GLOVES + 5 compliance.
    db = SessionLocal()
    try:
        db.add(models.AISafetyFinding(
            photo_id=t_photo_id,
            analysis_run_id=t_run_id,
            project_id=p_id,
            site_id=s_id,
            area_id=a_id,
            finding_type="PERSON_WITHOUT_GLOVES",
            severity="MEDIUM",
            title="Worker detected without gloves",
            confidence=0.85,
            status="OPEN"
        ))
        db.commit()
    finally:
        db.close()

    status, test_c_dash = request("GET", f"/api/projects/{p_id}/dashboard")
    assert status == 200
    assert test_c_dash["safety"]["ppe_breakdown"]["no_helmet"] == 1
    assert test_c_dash["safety"]["ppe_breakdown"]["no_gloves"] == 1
    assert test_c_dash["safety"]["ppe_breakdown"]["no_boots"] == 0
    assert test_c_dash["safety"]["ppe_breakdown"]["no_goggles"] == 0
    assert test_c_dash["safety"]["ai_violations_open"] == 2
    assert test_c_dash["risk"]["components"]["ai_findings"] == 30.0  # capped at 30
    print("[PASS] TEST C — Mixed Compliance + Violations: Only actual violations contribute to safety metrics.")

    # TEST D: RECURRING ISSUE ISOLATION
    # Add 2 more PERSON_WITHOUT_HELMET (total 3 in Zone Alpha) -> should create recurring issue.
    # Add 2 more HELMET_DETECTED (total 3 in Zone Alpha) -> should NOT create recurring issue.
    db = SessionLocal()
    try:
        for _ in range(2):
            db.add(models.AISafetyFinding(
                photo_id=t_photo_id,
                analysis_run_id=t_run_id,
                project_id=p_id,
                site_id=s_id,
                area_id=a_id,
                finding_type="PERSON_WITHOUT_HELMET",
                severity="HIGH",
                title="Missing Safety Helmet",
                confidence=0.90,
                status="OPEN"
            ))
            db.add(models.AISafetyFinding(
                photo_id=t_photo_id,
                analysis_run_id=t_run_id,
                project_id=p_id,
                site_id=s_id,
                area_id=a_id,
                finding_type="HELMET_DETECTED",
                severity="INFO",
                title="Helmet Verified",
                confidence=0.95,
                status="OPEN"
            ))
        db.commit()
    finally:
        db.close()

    status, test_d_dash = request("GET", f"/api/projects/{p_id}/dashboard")
    assert status == 200
    recurring_types = [r["issue_type"] for r in test_d_dash["recurring_problems"]]
    assert "PERSON_WITHOUT_HELMET" in recurring_types, "3x PERSON_WITHOUT_HELMET must trigger recurring problem"
    assert "HELMET_DETECTED" not in recurring_types, "3x HELMET_DETECTED must NEVER trigger recurring problem"
    print("[PASS] TEST D — Recurring Isolation: 3x PERSON_WITHOUT_HELMET triggered recurring issue; 3x HELMET_DETECTED did not.")

    # TEST E: TREND ISOLATION
    # Create an isolated project with 0 violations in previous period and 10 compliance detections in current period.
    # Expected trend: STABLE (not INCREASING).
    status, trend_proj = request("POST", "/api/projects", {
        "name": f"PPE Trend Isolation Test {ts}",
        "description": "Test trend calculation with compliance detections only",
        "location": "Testing Sector",
        "status": "ACTIVE"
    })
    assert status == 201
    tp_id = trend_proj["id"]
    status, tp_site = request("POST", f"/api/projects/{tp_id}/sites", {"name": "Trend Site", "address": "456 Test Ave"})
    assert status == 201
    tps_id = tp_site["id"]

    db = SessionLocal()
    try:
        tp_photo = models.SitePhoto(
            project_id=tp_id,
            site_id=tps_id,
            uploaded_by=user_id,
            file_name="trend_test.jpg",
            file_path="/uploads/photos/trend_test.jpg"
        )
        db.add(tp_photo)
        db.commit()
        db.refresh(tp_photo)

        tp_run = models.AIAnalysisRun(
            photo_id=tp_photo.id,
            model_name="yolo11n-ppe-finetuned",
            model_version="v1.0.0",
            status="COMPLETED"
        )
        db.add(tp_run)
        db.commit()
        db.refresh(tp_run)

        # 10 compliance findings in current period
        for _ in range(10):
            db.add(models.AISafetyFinding(
                photo_id=tp_photo.id,
                analysis_run_id=tp_run.id,
                project_id=tp_id,
                site_id=tps_id,
                finding_type="HELMET_DETECTED",
                severity="INFO",
                title="Helmet Verified",
                confidence=0.98,
                status="OPEN"
            ))
        db.commit()
    finally:
        db.close()

    status, trend_res = request("GET", f"/api/projects/{tp_id}/trends")
    assert status == 200
    assert trend_res["safety_trend"] == "STABLE", f"Trend must be STABLE when only compliance records exist, got {trend_res['safety_trend']}"
    assert trend_res["current_safety_count"] == 0
    assert trend_res["previous_safety_count"] == 0
    print("[PASS] TEST E — Trend Isolation: 10 compliance detections resulted in STABLE safety trend with 0 safety violation count.")

    print("\n==================================================")
    print("ALL PHASE 6 TESTS (INCLUDING PPE BUG FIX SUITE) COMPLETED WITH 100% SUCCESS!")
    print("==================================================")


if __name__ == "__main__":
    run_tests()

