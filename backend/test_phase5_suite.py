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
    print("RUNNING PHASE 5 CONSTRUCTION INTELLIGENCE TEST SUITE")
    print("==================================================")

    # 1. Health Checks
    print("\n--- 1. Health Checks ---")
    status, health = request("GET", "/api/health")
    assert status == 200 and health["status"] == "healthy"
    print("[PASS] GET /api/health passed")

    status, db_health = request("GET", "/api/db-health")
    assert status == 200 and db_health["status"] == "database connected"
    print("[PASS] GET /api/db-health passed")

    # 2. Hierarchy Setup
    print("\n--- 2. Hierarchy Setup ---")
    ts = int(datetime.utcnow().timestamp())
    status, user = request("POST", "/api/users", {
        "name": f"PM User {ts}",
        "email": f"pm_{ts}@example.com",
        "role": "PROJECT_MANAGER",
        "password": "securepassword123"
    })
    assert status == 201
    user_id = user["id"]

    status, project = request("POST", "/api/projects", {
        "name": f"Phase 5 Intelligence Tower {ts}",
        "description": "Multi-story complex for testing Phase 5 Intelligence Engine",
        "location": "Metro Site Zone 4",
        "status": "ACTIVE"
    })
    assert status == 201
    project_id = project["id"]

    status, site = request("POST", f"/api/projects/{project_id}/sites", {
        "name": "Main Construction Site",
        "address": "456 Intelligence Way"
    })
    assert status == 201
    site_id = site["id"]

    status, area1 = request("POST", f"/api/sites/{site_id}/areas", {
        "name": "Floor 1",
        "area_type": "FLOOR"
    })
    assert status == 201
    area1_id = area1["id"]

    status, area2 = request("POST", f"/api/sites/{site_id}/areas", {
        "name": "Basement B1",
        "area_type": "BASEMENT"
    })
    assert status == 201
    area2_id = area2["id"]

    print(f"[PASS] Hierarchy created: User {user_id}, Project {project_id}, Site {site_id}, Area1 {area1_id}, Area2 {area2_id}")

    # 3. Test Empty Project Intelligence
    print("\n--- 3. Empty Project Intelligence & Low Data Confidence ---")
    status, empty_risk = request("GET", f"/api/projects/{project_id}/risk")
    assert status == 200
    assert empty_risk["score"] == 0
    assert empty_risk["level"] == "LOW"
    assert empty_risk["data_confidence"] == "LOW"
    assert len(empty_risk["reasons"]) > 0
    print(f"[PASS] Empty Project correctly returned 0 risk, LOW confidence, and explanatory reason: '{empty_risk['reasons'][0]}'")

    # 4. Populate Realistic Field Data
    print("\n--- 4. Populating Safety & Field Data ---")
    
    # 4a. Photo & 3 AI Safety Findings in Floor 1 (NO_HELMET x3)
    # Upload photo first
    photo_payload = {
        "project_id": project_id,
        "site_id": site_id,
        "area_id": area1_id,
        "uploaded_by": user_id,
        "file_name": "worker_scene.jpg",
        "file_path": "/uploads/photos/dummy_p5.jpg"
    }
    # Direct DB injection or through AI / photos router
    from database import SessionLocal
    import models
    db = SessionLocal()
    try:
        photo_record = models.SitePhoto(
            project_id=project_id,
            site_id=site_id,
            area_id=area1_id,
            uploaded_by=user_id,
            file_name="worker_scene.jpg",
            file_path="/uploads/photos/dummy_p5.jpg"
        )
        db.add(photo_record)
        db.commit()
        db.refresh(photo_record)

        analysis_run = models.AIAnalysisRun(
            photo_id=photo_record.id,
            model_name="yolo11n-ppe-finetuned",
            model_version="v1.0.0",
            status="COMPLETED",
            processing_time_ms=45.0
        )
        db.add(analysis_run)
        db.commit()
        db.refresh(analysis_run)

        # 3 AI PPE findings in Floor 1
        for i in range(3):
            ai_f = models.AISafetyFinding(
                photo_id=photo_record.id,
                analysis_run_id=analysis_run.id,
                project_id=project_id,
                site_id=site_id,
                area_id=area1_id,
                finding_type="PERSON_WITHOUT_HELMET",
                severity="HIGH",
                title="Missing Safety Helmet",
                description="Worker observed in Floor 1 without protective headgear",
                confidence=0.88,
                status="OPEN"
            )
            db.add(ai_f)

        # 1 AI finding in Basement B1 (LOW severity)
        ai_f2 = models.AISafetyFinding(
            photo_id=photo_record.id,
            analysis_run_id=analysis_run.id,
            project_id=project_id,
            site_id=site_id,
            area_id=area2_id,
            finding_type="PERSON_WITHOUT_GLOVES",
            severity="LOW",
            title="Missing Gloves",
            description="Worker handling materials without gloves",
            confidence=0.75,
            status="OPEN"
        )
        db.add(ai_f2)

        # 2 Human Incidents in Floor 1
        inc1 = models.SafetyIncident(
            project_id=project_id,
            site_id=site_id,
            area_id=area1_id,
            reported_by=user_id,
            incident_date=datetime.utcnow().strftime("%Y-%m-%d"),
            incident_type="PPE_VIOLATION",
            severity="HIGH",
            description="Repeated failure to wear safety harness and helmet near edge",
            status="OPEN"
        )
        inc2 = models.SafetyIncident(
            project_id=project_id,
            site_id=site_id,
            area_id=area1_id,
            reported_by=user_id,
            incident_date=datetime.utcnow().strftime("%Y-%m-%d"),
            incident_type="UNSAFE_CONDITION",
            severity="MEDIUM",
            description="Scaffolding plank unfastened",
            status="OPEN"
        )
        db.add(inc1)
        db.add(inc2)

        # 3 Open Observations in Floor 1
        for j in range(3):
            obs = models.Observation(
                project_id=project_id,
                site_id=site_id,
                area_id=area1_id,
                created_by=user_id,
                observation_type="SAFETY",
                title=f"Tripping Hazard {j+1}",
                description="Exposed electrical cables across main walkway",
                priority="HIGH",
                status="OPEN"
            )
            db.add(obs)

        # 1 Failed Inspection in Floor 1
        insp = models.InspectionReport(
            project_id=project_id,
            site_id=site_id,
            area_id=area1_id,
            inspector_id=user_id,
            inspection_date=datetime.utcnow().strftime("%Y-%m-%d"),
            inspection_type="SAFETY",
            status="FAILED",
            findings="Critical perimeter safety barriers missing on upper level"
        )
        db.add(insp)

        # 1 Daily Report with Blocker
        drep = models.DailyReport(
            project_id=project_id,
            site_id=site_id,
            area_id=area1_id,
            reported_by=user_id,
            report_date=datetime.utcnow().strftime("%Y-%m-%d"),
            work_completed="Formwork installation on Level 1",
            progress_percentage=45,
            workers_count=28,
            blockers="Heavy wind delayed tower crane operations"
        )
        db.add(drep)

        # 1 Material in LOW_STOCK
        mat = models.Material(
            project_id=project_id,
            site_id=site_id,
            area_id=area1_id,
            recorded_by=user_id,
            material_name="Grade 53 Portland Cement",
            category="Cement",
            quantity=15.0,
            unit="Bags",
            status="LOW_STOCK",
            supplier="UltraTech Cement"
        )
        db.add(mat)

        db.commit()
    finally:
        db.close()

    print("[PASS] Seeded test records successfully into PostgreSQL.")

    # 5. Test Risk Engine & Explainability
    print("\n--- 5. Risk Engine & Explainability Evaluation ---")
    status, risk = request("GET", f"/api/projects/{project_id}/risk")
    assert status == 200
    print(f"Project Risk: Score = {risk['score']}/100, Level = {risk['level']}, Data Confidence = {risk['data_confidence']}")
    print(f"Components: {risk['components']}")
    print(f"Reasons count: {len(risk['reasons'])}")
    for r in risk["reasons"]:
        print(f"  • {r}")

    assert risk["score"] >= 50, f"Expected risk score >= 50 for project with multiple severe hazards, got {risk['score']}"
    assert risk["level"] in ["HIGH", "CRITICAL"]
    assert risk["components"]["ai_findings"] <= 30.0
    assert risk["components"]["incidents"] <= 30.0
    assert risk["components"]["observations"] <= 15.0
    assert risk["components"]["inspections"] <= 15.0
    assert risk["components"]["recurring"] <= 15.0
    assert any("AI PPE" in r for r in risk["reasons"])
    assert any("human-reported" in r for r in risk["reasons"])
    assert any("Recurring" in r or "recurring" in r for r in risk["reasons"])
    print("[PASS] Risk calculation, components capping, and reason generation verified.")

    # 6. Test Recurring Issues Endpoint
    print("\n--- 6. Recurring Issue Detection ---")
    status, rec_issues = request("GET", f"/api/projects/{project_id}/recurring-issues")
    assert status == 200
    assert len(rec_issues) >= 1
    no_helmet_rec = next((ri for ri in rec_issues if ri["issue_type"] == "PERSON_WITHOUT_HELMET"), None)
    assert no_helmet_rec is not None
    assert no_helmet_rec["occurrence_count"] >= 3
    assert no_helmet_rec["area_name"] == "Floor 1"
    print(f"[PASS] Successfully detected recurring issue: {no_helmet_rec['issue_type']} in {no_helmet_rec['area_name']} ({no_helmet_rec['occurrence_count']} occurrences)")

    # 7. Test Area Risk Ranking
    print("\n--- 7. Area Risk Ranking ---")
    status, area_ranks = request("GET", f"/api/projects/{project_id}/risk/areas")
    assert status == 200
    assert len(area_ranks) >= 2
    assert area_ranks[0]["area_name"] == "Floor 1", "Floor 1 should be ranked #1 highest risk"
    assert area_ranks[0]["risk_score"] > area_ranks[1]["risk_score"], "Floor 1 score must be higher than Basement B1"
    print(f"[PASS] Area ranking verified: #1 {area_ranks[0]['area_name']} (Score {area_ranks[0]['risk_score']}) > #2 {area_ranks[1]['area_name']} (Score {area_ranks[1]['risk_score']})")

    # 8. Test Trends Endpoint
    print("\n--- 8. Trend Detection ---")
    status, trends = request("GET", f"/api/projects/{project_id}/trends")
    assert status == 200
    assert trends["safety_trend"] == "INCREASING"
    assert len(trends["daily_series"]) == 7
    print(f"[PASS] Trend correctly computed as INCREASING (+{trends['safety_change_pct']}%) with 7-day daily series.")

    # 9. Test Safety Summary & PPE Breakdown
    print("\n--- 9. Safety Summary & PPE Analytics ---")
    status, summary = request("GET", f"/api/projects/{project_id}/safety-summary")
    assert status == 200
    assert summary["ai_findings_total"] == 4
    assert summary["ai_findings_open"] == 4
    assert summary["human_incidents_total"] == 2
    assert summary["observations_total"] == 3
    assert summary["inspections_failed"] == 1
    assert summary["ppe_breakdown"]["no_helmet"] == 3
    assert summary["ppe_breakdown"]["no_gloves"] == 1
    print(f"[PASS] Safety summary verified: {summary['human_vs_ai_ratio']}, PPE: No Helmet = {summary['ppe_breakdown']['no_helmet']}")

    # 10. Test Operational Risk
    print("\n--- 10. Operational Risk Separation ---")
    status, op_risk = request("GET", f"/api/projects/{project_id}/operational-risk")
    assert status == 200
    assert len(op_risk["low_stock_materials"]) >= 1
    assert len(op_risk["open_blockers"]) >= 1
    print(f"[PASS] Operational risk correctly detected: {len(op_risk['low_stock_materials'])} low-stock item(s), {len(op_risk['open_blockers'])} blocker(s), Level: {op_risk['operational_risk_level']}")

    # 11. Test Full Master Intelligence Endpoint
    print("\n--- 11. Consolidated Project Intelligence ---")
    status, intel = request("GET", f"/api/projects/{project_id}/intelligence")
    assert status == 200
    assert "project_risk" in intel
    assert "area_risks" in intel
    assert "recurring_issues" in intel
    assert "trends" in intel
    assert "safety_summary" in intel
    assert "progress" in intel
    assert "operational_risk" in intel
    assert "Floor 1" in intel["highest_risk_area"]
    print(f"[PASS] Full Master Intelligence endpoint returned complete structured report with highest risk area: '{intel['highest_risk_area']}'")

    # 12. Error Handling Test
    print("\n--- 12. Error Handling & Validation ---")
    status, err_404 = request("GET", "/api/projects/999999/intelligence")
    assert status == 404
    print("[PASS] Non-existent project correctly returned HTTP 404")

    print("\n==================================================")
    print("ALL PHASE 5 TESTS COMPLETED WITH 100% SUCCESS!")
    print("==================================================")


if __name__ == "__main__":
    run_tests()
