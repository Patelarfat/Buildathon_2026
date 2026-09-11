import urllib.request
import urllib.parse
import json
import os
from datetime import datetime, timedelta

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


def run_full_audit():
    print("================================================================")
    print("STARTING FULL SYSTEM AUDIT (PHASES 1 - 6)")
    print("================================================================")

    # 1. Health Checks
    print("\n--- 1. Service Health Checks ---")
    status, health = request("GET", "/api/health")
    assert status == 200 and health["status"] == "healthy"
    status, db_health = request("GET", "/api/db-health")
    assert status == 200 and db_health["status"] == "database connected"
    print("[PASS] FastAPI backend and PostgreSQL database are healthy.")

    ts = int(datetime.utcnow().timestamp())

    # 2. Hierarchy Validation & Mismatch Protection
    print("\n--- 2. Hierarchy & Relationship Integrity Audit ---")
    status, user = request("POST", "/api/users", {
        "name": f"Auditor {ts}",
        "email": f"auditor_{ts}@example.com",
        "role": "PROJECT_MANAGER",
        "password": "auditpassword123"
    })
    assert status == 201
    user_id = user["id"]

    # Create Project 1 & Site 1 & Area 1
    status, p1 = request("POST", "/api/projects", {"name": f"Project One {ts}", "status": "ACTIVE"})
    assert status == 201
    p1_id = p1["id"]

    status, s1 = request("POST", f"/api/projects/{p1_id}/sites", {"name": "P1 Site 1"})
    assert status == 201
    s1_id = s1["id"]

    status, a1 = request("POST", f"/api/sites/{s1_id}/areas", {"name": "P1 S1 Area 1"})
    assert status == 201
    a1_id = a1["id"]

    # Create Project 2 & Site 2 & Area 2
    status, p2 = request("POST", "/api/projects", {"name": f"Project Two {ts}", "status": "ACTIVE"})
    assert status == 201
    p2_id = p2["id"]

    status, s2 = request("POST", f"/api/projects/{p2_id}/sites", {"name": "P2 Site 2"})
    assert status == 201
    s2_id = s2["id"]

    status, a2 = request("POST", f"/api/sites/{s2_id}/areas", {"name": "P2 S2 Area 2"})
    assert status == 201
    a2_id = a2["id"]

    # Try to create an Incident in Project 1 with Site 2 (belongs to Project 2) -> Must be rejected HTTP 400
    status, err_inc = request("POST", "/api/incidents", {
        "project_id": p1_id,
        "site_id": s2_id,
        "reported_by": user_id,
        "incident_date": "2026-03-12",
        "incident_type": "FALL",
        "severity": "HIGH",
        "description": "Cross-project injection test"
    })
    assert status == 400, f"Expected 400 on cross-project site mismatch, got {status}"

    # Try to create an Observation in Site 1 with Area 2 (belongs to Site 2) -> Must be rejected HTTP 400
    status, err_obs = request("POST", "/api/observations", {
        "project_id": p1_id,
        "site_id": s1_id,
        "area_id": a2_id,
        "created_by": user_id,
        "observation_type": "SAFETY",
        "title": "Cross-site area test",
        "description": "Testing invalid area"
    })
    assert status == 400, f"Expected 400 on cross-site area mismatch, got {status}"
    print("[PASS] Hierarchy validation successfully rejects mismatched project/site/area relationships.")

    # 3. Project Isolation Audit
    print("\n--- 3. Project Isolation Audit ---")
    from database import SessionLocal
    import models
    db = SessionLocal()
    try:
        # Seed 3 critical incidents in Project 1
        for i in range(3):
            db.add(models.SafetyIncident(
                project_id=p1_id,
                site_id=s1_id,
                area_id=a1_id,
                reported_by=user_id,
                incident_date="2026-03-12",
                incident_type="EQUIPMENT_FAILURE",
                severity="CRITICAL",
                description=f"P1 Critical Incident {i+1}",
                status="OPEN"
            ))
        # Seed 0 incidents in Project 2
        db.commit()
    finally:
        db.close()

    status, p1_dash = request("GET", f"/api/projects/{p1_id}/dashboard")
    assert status == 200
    assert p1_dash["executive_health"]["risk_score"] >= 30
    assert p1_dash["executive_health"]["open_safety_issues"] == 3

    status, p2_dash = request("GET", f"/api/projects/{p2_id}/dashboard")
    assert status == 200
    assert p2_dash["executive_health"]["risk_score"] == 0
    assert p2_dash["executive_health"]["open_safety_issues"] == 0
    assert len(p2_dash["attention_items"]) == 0
    print("[PASS] Project isolation verified: Project 1 severe hazards do not leak to Project 2.")

    # 4. Site Isolation Audit
    print("\n--- 4. Site Isolation Audit ---")
    # Add Site 1B to Project 1
    status, s1b = request("POST", f"/api/projects/{p1_id}/sites", {"name": "P1 Site 1B"})
    assert status == 201
    s1b_id = s1b["id"]

    db = SessionLocal()
    try:
        db.add(models.Observation(
            project_id=p1_id,
            site_id=s1b_id,
            created_by=user_id,
            observation_type="SAFETY",
            title="Site 1B Hazard",
            description="Hazard exclusive to Site 1B",
            priority="HIGH",
            status="OPEN"
        ))
        db.commit()
    finally:
        db.close()

    # Filter dashboard to Site 1 (s1_id) -> should have 3 incidents, 0 observations
    status, s1_dash = request("GET", f"/api/projects/{p1_id}/dashboard?site_id={s1_id}")
    assert status == 200
    assert s1_dash["executive_health"]["open_safety_issues"] == 3
    assert s1_dash["executive_health"]["open_observations"] == 0

    # Filter dashboard to Site 1B (s1b_id) -> should have 0 incidents, 1 observation
    status, s1b_dash = request("GET", f"/api/projects/{p1_id}/dashboard?site_id={s1b_id}")
    assert status == 200
    assert s1b_dash["executive_health"]["open_safety_issues"] == 0
    assert s1b_dash["executive_health"]["open_observations"] == 1
    print("[PASS] Site isolation verified: Filtering by site isolates metrics, observations, and incidents.")

    # 5. Area Isolation & Pipeline Traceability Audit
    print("\n--- 5. Area Isolation & Pipeline Traceability Audit ---")
    status, a1b = request("POST", f"/api/sites/{s1_id}/areas", {"name": "P1 S1 Area 1B"})
    assert status == 201
    a1b_id = a1b["id"]

    db = SessionLocal()
    try:
        photo_a = models.SitePhoto(
            project_id=p1_id,
            site_id=s1_id,
            area_id=a1_id,
            uploaded_by=user_id,
            file_name="zone_alpha_photo.jpg",
            file_path="/uploads/photos/zone_alpha.jpg"
        )
        db.add(photo_a)
        db.commit()
        db.refresh(photo_a)

        run_a = models.AIAnalysisRun(
            photo_id=photo_a.id,
            model_name="yolo11n-ppe-finetuned",
            model_version="v1.0.0",
            status="COMPLETED"
        )
        db.add(run_a)
        db.commit()
        db.refresh(run_a)

        # Add 3x PERSON_WITHOUT_HELMET in Area 1
        for _ in range(3):
            db.add(models.AISafetyFinding(
                photo_id=photo_a.id,
                analysis_run_id=run_a.id,
                project_id=p1_id,
                site_id=s1_id,
                area_id=a1_id,
                finding_type="PERSON_WITHOUT_HELMET",
                severity="HIGH",
                title="Missing Safety Helmet",
                confidence=0.92,
                status="OPEN"
            ))
        db.commit()
    finally:
        db.close()

    # Query Area Risk Rankings
    status, area_ranks = request("GET", f"/api/projects/{p1_id}/risk/areas")
    assert status == 200
    assert len(area_ranks) >= 2
    rank_a1 = next((ar for ar in area_ranks if ar["area_id"] == a1_id), None)
    rank_a1b = next((ar for ar in area_ranks if ar["area_id"] == a1b_id), None)
    assert rank_a1 is not None and rank_a1["risk_score"] > 0
    assert rank_a1b is not None and rank_a1b["risk_score"] == 0

    # Query Recurring Issues
    status, recs = request("GET", f"/api/projects/{p1_id}/recurring-issues")
    assert status == 200
    rec_a1 = next((r for r in recs if r["area_id"] == a1_id), None)
    rec_a1b = next((r for r in recs if r["area_id"] == a1b_id), None)
    assert rec_a1 is not None and rec_a1["occurrence_count"] >= 3
    assert rec_a1b is None, "Area 1B must have zero recurring issues"
    print("[PASS] Area isolation & pipeline traceability verified: Zone Alpha hazard does not leak to Zone 1B.")

    # 6. AI Status Semantics & False Positive Isolation
    print("\n--- 6. AI Status Semantics & False Positive Audit ---")
    db = SessionLocal()
    try:
        # Create an isolated project for status testing
        status, p_status = request("POST", "/api/projects", {"name": f"Status Audit {ts}", "status": "ACTIVE"})
        p_st_id = p_status["id"]
        status, s_st = request("POST", f"/api/projects/{p_st_id}/sites", {"name": "Status Site"})
        s_st_id = s_st["id"]

        st_photo = models.SitePhoto(
            project_id=p_st_id,
            site_id=s_st_id,
            uploaded_by=user_id,
            file_name="status_test.jpg",
            file_path="/uploads/photos/status_test.jpg"
        )
        db.add(st_photo)
        db.commit()
        db.refresh(st_photo)

        st_run = models.AIAnalysisRun(
            photo_id=st_photo.id,
            model_name="yolo11n-ppe-finetuned",
            model_version="v1.0.0",
            status="COMPLETED"
        )
        db.add(st_run)
        db.commit()
        db.refresh(st_run)

        # Add 1 FALSE_POSITIVE finding and 1 RESOLVED finding
        db.add(models.AISafetyFinding(
            photo_id=st_photo.id,
            analysis_run_id=st_run.id,
            project_id=p_st_id,
            site_id=s_st_id,
            finding_type="PERSON_WITHOUT_HELMET",
            severity="HIGH",
            title="False positive violation",
            confidence=0.55,
            status="FALSE_POSITIVE"
        ))
        db.add(models.AISafetyFinding(
            photo_id=st_photo.id,
            analysis_run_id=st_run.id,
            project_id=p_st_id,
            site_id=s_st_id,
            finding_type="PERSON_WITHOUT_GLOVES",
            severity="MEDIUM",
            title="Resolved violation",
            confidence=0.88,
            status="RESOLVED"
        ))
        db.commit()
    finally:
        db.close()

    status, st_dash = request("GET", f"/api/projects/{p_st_id}/dashboard")
    assert status == 200
    assert st_dash["risk"]["score"] == 0, "FALSE_POSITIVE and RESOLVED findings must contribute 0 active risk"
    assert st_dash["executive_health"]["open_safety_issues"] == 0
    assert st_dash["safety"]["ai_violations_open"] == 0
    print("[PASS] AI status semantics verified: FALSE_POSITIVE and RESOLVED findings contribute 0 active risk.")

    # 7. Mathematical Model & Component Caps Audit
    print("\n--- 7. Mathematical Model & Component Caps Audit ---")
    status, p_math = request("POST", "/api/projects", {"name": f"Math Audit {ts}", "status": "ACTIVE"})
    p_m_id = p_math["id"]
    status, s_m = request("POST", f"/api/projects/{p_m_id}/sites", {"name": "Math Site"})
    s_m_id = s_m["id"]

    db = SessionLocal()
    try:
        # Overload AI violations: 5 CRITICAL findings (5 x 30 = 150 pts -> cap is 30)
        ph = models.SitePhoto(
            project_id=p_m_id,
            site_id=s_m_id,
            uploaded_by=user_id,
            file_name="ph.jpg",
            file_path="/uploads/photos/ph.jpg"
        )
        db.add(ph)
        db.commit()
        db.refresh(ph)
        rn = models.AIAnalysisRun(photo_id=ph.id, status="COMPLETED")
        db.add(rn)
        db.commit()
        db.refresh(rn)

        for _ in range(5):
            db.add(models.AISafetyFinding(
                photo_id=ph.id,
                analysis_run_id=rn.id,
                project_id=p_m_id,
                site_id=s_m_id,
                finding_type="PERSON_WITHOUT_HELMET",
                severity="CRITICAL",
                title="Critical PPE",
                confidence=0.99,
                status="OPEN"
            ))

        # Overload Incidents: 5 CRITICAL incidents (5 x 35 = 175 pts -> cap is 30)
        for i in range(5):
            db.add(models.SafetyIncident(
                project_id=p_m_id,
                site_id=s_m_id,
                reported_by=user_id,
                incident_date="2026-03-12",
                incident_type="COLLAPSE",
                severity="CRITICAL",
                description=f"Critical Incident {i}",
                status="OPEN"
            ))

        # Overload Observations: 5 HIGH observations (5 x 10 = 50 pts -> cap is 15)
        for i in range(5):
            db.add(models.Observation(
                project_id=p_m_id,
                site_id=s_m_id,
                created_by=user_id,
                observation_type="SAFETY",
                title=f"Observation {i}",
                description="High hazard",
                priority="HIGH",
                status="OPEN"
            ))

        # Overload Inspections: 5 FAILED inspections (5 x 10 = 50 pts -> cap is 15)
        for i in range(5):
            db.add(models.InspectionReport(
                project_id=p_m_id,
                site_id=s_m_id,
                inspector_id=user_id,
                inspection_date="2026-03-12",
                inspection_type="SAFETY",
                status="FAILED",
                findings=f"Failed {i}"
            ))
        db.commit()
    finally:
        db.close()

    status, math_risk = request("GET", f"/api/projects/{p_m_id}/risk")
    assert status == 200
    comps = math_risk["components"]
    assert comps["ai_findings"] == 30.0, f"AI cap failed: expected 30.0, got {comps['ai_findings']}"
    assert comps["incidents"] == 30.0, f"Incidents cap failed: expected 30.0, got {comps['incidents']}"
    assert comps["observations"] == 15.0, f"Observations cap failed: expected 15.0, got {comps['observations']}"
    assert comps["inspections"] == 15.0, f"Inspections cap failed: expected 15.0, got {comps['inspections']}"
    assert math_risk["score"] == 100, f"Expected total clamped score 100, got {math_risk['score']}"
    assert math_risk["level"] == "CRITICAL"
    print("[PASS] Risk calculation mathematical model & component caps strictly enforced.")

    # 8. Operational Risk vs Safety Risk Separation Audit
    print("\n--- 8. Operational vs Safety Risk Separation Audit ---")
    status, p_ops = request("POST", "/api/projects", {"name": f"Ops Audit {ts}", "status": "ACTIVE"})
    p_op_id = p_ops["id"]
    status, s_op = request("POST", f"/api/projects/{p_op_id}/sites", {"name": "Ops Site"})
    s_op_id = s_op["id"]

    db = SessionLocal()
    try:
        # Add 3 LOW_STOCK materials and 2 daily blockers, but 0 safety violations/incidents
        for i in range(3):
            db.add(models.Material(
                project_id=p_op_id,
                site_id=s_op_id,
                recorded_by=user_id,
                material_name=f"Cement Grade {i}",
                quantity=2.0,
                unit="Bags",
                status="LOW_STOCK"
            ))
        db.add(models.DailyReport(
            project_id=p_op_id,
            site_id=s_op_id,
            reported_by=user_id,
            report_date="2026-03-12",
            progress_percentage=40,
            blockers="Heavy rainfall preventing concrete pour"
        ))
        db.commit()
    finally:
        db.close()

    status, op_dash = request("GET", f"/api/projects/{p_op_id}/dashboard")
    assert status == 200
    assert op_dash["risk"]["score"] == 0, "Operational shortages must NOT contribute to safety risk score"
    assert op_dash["executive_health"]["risk_level"] == "LOW"
    assert op_dash["executive_health"]["operational_blockers"] >= 3
    assert op_dash["materials"]["operational_risk_level"] == "HIGH"
    print("[PASS] Operational risk (material shortages & blockers) strictly separated from safety risk.")

    print("\n================================================================")
    print("ALL FULL SYSTEM AUDIT VERIFICATION CHECKS PASSED (100% SUCCESS)!")
    print("================================================================")


if __name__ == "__main__":
    run_full_audit()
