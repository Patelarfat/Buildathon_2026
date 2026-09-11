import os
import json
import urllib.request
import urllib.error
import io
import uuid

BASE_URL = "http://127.0.0.1:8000"

def request(method, path, body=None, content_type="application/json"):
    url = f"{BASE_URL}{path}"
    data = None
    headers = {}
    if body is not None:
        if content_type == "application/json":
            data = json.dumps(body).encode("utf-8")
            headers["Content-Type"] = "application/json"
        else:
            data = body
            headers["Content-Type"] = content_type
    
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            resp_body = resp.read()
            if resp.headers.get_content_type() == "application/json":
                return resp.status, json.loads(resp_body.decode("utf-8"))
            return resp.status, resp_body
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        try:
            return e.code, json.loads(err_body)
        except Exception:
            return e.code, err_body

def multipart_encode(fields, files):
    boundary = uuid.uuid4().hex
    body = io.BytesIO()
    
    for name, value in fields.items():
        body.write(f"--{boundary}\r\n".encode("utf-8"))
        body.write(f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode("utf-8"))
        body.write(f"{value}\r\n".encode("utf-8"))
        
    for name, (filename, data, content_type) in files.items():
        body.write(f"--{boundary}\r\n".encode("utf-8"))
        body.write(f'Content-Disposition: form-data; name="{name}"; filename="{filename}"\r\n'.encode("utf-8"))
        body.write(f"Content-Type: {content_type}\r\n\r\n".encode("utf-8"))
        body.write(data)
        body.write(b"\r\n")
        
    body.write(f"--{boundary}--\r\n".encode("utf-8"))
    return f"multipart/form-data; boundary={boundary}", body.getvalue()

def run_tests():
    print("==================================================")
    print("RUNNING PHASE 3 AUTOMATED VERIFICATION TEST SUITE")
    print("==================================================")
    
    # 1. System Health & DB
    print("\n--- 1. Health Checks ---")
    status, res = request("GET", "/api/health")
    assert status == 200 and res["status"] == "healthy", f"Health failed: {res}"
    print("[PASS] GET /api/health passed")
    
    status, res = request("GET", "/api/db-health")
    assert status == 200 and res["status"] == "database connected", f"DB Health failed: {res}"
    print("[PASS] GET /api/db-health passed")
    
    # 2. Setup Test Data (User, Project, Site, Area)
    print("\n--- 2. Hierarchy Setup ---")
    user_email = f"field_worker_{uuid.uuid4().hex[:6]}@example.com"
    status, user = request("POST", "/api/users", {
        "name": "Field Worker Bob",
        "email": user_email,
        "role": "Site Supervisor",
        "phone": "+1234567890"
    })
    assert status == 201, f"Create user failed: {user}"
    user_id = user["id"]
    print(f"[PASS] Created User ID: {user_id}")
    
    status, proj = request("POST", "/api/projects", {
        "name": f"Test Intelligence Tower {uuid.uuid4().hex[:4]}",
        "code": f"TIT-{uuid.uuid4().hex[:4].upper()}",
        "description": "Field test project",
        "status": "ACTIVE"
    })
    assert status == 201, f"Create project failed: {proj}"
    project_id = proj["id"]
    print(f"[PASS] Created Project ID: {project_id}")
    
    status, site = request("POST", f"/api/projects/{project_id}/sites", {
        "name": "North Tower Site",
        "location": "Sector 4B",
        "status": "ACTIVE"
    })
    assert status == 201, f"Create site failed: {site}"
    site_id = site["id"]
    print(f"[PASS] Created Site ID: {site_id}")
    
    status, area = request("POST", f"/api/sites/{site_id}/areas", {
        "name": "Basement Level B1",
        "floor_level": "-1",
        "description": "Parking and foundation zone"
    })
    assert status == 201, f"Create area failed: {area}"
    area_id = area["id"]
    print(f"[PASS] Created Area ID: {area_id}")
    
    # Another project and site for mismatch validation tests
    status, proj2 = request("POST", "/api/projects", {
        "name": "Different Project",
        "code": f"DIF-{uuid.uuid4().hex[:4].upper()}",
        "status": "PLANNING"
    })
    proj2_id = proj2["id"]
    
    status, site2 = request("POST", f"/api/projects/{proj2_id}/sites", {
        "name": "Different Site",
        "status": "ACTIVE"
    })
    site2_id = site2["id"]

    # 3. Hierarchy Validation (Mismatched site vs project -> 400)
    print("\n--- 3. Hierarchy Validation Tests ---")
    status, res = request("POST", "/api/daily-reports", {
        "project_id": project_id,
        "site_id": site2_id,
        "reported_by": user_id,
        "report_date": "2026-09-11",
        "work_completed": "Mismatch test"
    })
    assert status == 400, f"Expected 400 for mismatched site-project, got {status}: {res}"
    print("[PASS] Correctly rejected mismatched site-project with HTTP 400")

    # 4. Site Photos (Upload, Download static, List, Retrieve, Delete)
    print("\n--- 4. Site Photos Tests ---")
    fake_img_bytes = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
    ctype, body = multipart_encode(
        fields={
            "project_id": str(project_id),
            "site_id": str(site_id),
            "area_id": str(area_id),
            "uploaded_by": str(user_id),
            "caption": "Rebar inspection basement"
        },
        files={
            "file": ("test_foundation.png", fake_img_bytes, "image/png")
        }
    )
    status, photo = request("POST", "/api/photos", body=body, content_type=ctype)
    assert status == 201, f"Photo upload failed: {photo}"
    photo_id = photo["id"]
    file_path = photo["file_path"]
    print(f"[PASS] Uploaded photo ID: {photo_id}, path: {file_path}")
    
    # Check on disk
    disk_path = os.path.join(os.path.dirname(__file__), "uploads", "photos", os.path.basename(file_path))
    assert os.path.exists(disk_path), f"File was not saved on disk at: {disk_path}"
    print(f"[PASS] File confirmed on disk: {disk_path}")
    
    # Verify static file serving via direct GET
    static_url = file_path
    status, fetched_img = request("GET", static_url)
    assert status == 200 and len(fetched_img) == len(fake_img_bytes), f"Static image download failed from {static_url}"
    print(f"[PASS] Static image served correctly at {static_url}")
    
    # List photos
    status, photos_list = request("GET", f"/api/projects/{project_id}/photos")
    assert status == 200 and len(photos_list) >= 1, "Photo list failed"
    print(f"[PASS] Listed {len(photos_list)} photo(s)")
    
    # 5. Daily Site Reports
    print("\n--- 5. Daily Site Reports Tests ---")
    status, report = request("POST", "/api/daily-reports", {
        "project_id": project_id,
        "site_id": site_id,
        "area_id": area_id,
        "reported_by": user_id,
        "report_date": "2026-09-11",
        "weather": "Sunny 28C",
        "workers_count": 45,
        "work_completed": "Foundation concrete pouring and rebar placement completed.",
        "work_planned": "Begin column formwork setup.",
        "progress_percentage": 25,
        "issues": "None"
    })
    assert status == 201, f"Daily report creation failed: {report}"
    report_id = report["id"]
    print(f"[PASS] Created Daily Report ID: {report_id}")
    
    status, report_get = request("GET", f"/api/daily-reports/{report_id}")
    assert status == 200 and report_get["workers_count"] == 45, f"Daily report get failed: {report_get}"
    
    status, report_up = request("PUT", f"/api/daily-reports/{report_id}", {
        "progress_percentage": 30,
        "workers_count": 48
    })
    assert status == 200 and report_up["progress_percentage"] == 30
    print("[PASS] Updated Daily Report progress to 30%")
    
    # 6. Safety Incidents
    print("\n--- 6. Safety Incidents Tests ---")
    status, incident = request("POST", "/api/incidents", {
        "project_id": project_id,
        "site_id": site_id,
        "area_id": area_id,
        "reported_by": user_id,
        "incident_date": "2026-09-11",
        "incident_type": "UNSAFE_CONDITION",
        "severity": "MEDIUM",
        "description": "Loose cabling was left unsecured near the trench boundary.",
        "action_taken": "Cable rerouted and marked with high-visibility warning flags.",
        "status": "OPEN"
    })
    assert status == 201, f"Safety incident creation failed: {incident}"
    incident_id = incident["id"]
    print(f"[PASS] Created Safety Incident ID: {incident_id}")
    
    status, inc_up = request("PUT", f"/api/incidents/{incident_id}", {
        "status": "RESOLVED",
        "action_taken": "Permanent cable tray installed and safety clearance granted."
    })
    assert status == 200 and inc_up["status"] == "RESOLVED"
    print("[PASS] Updated Safety Incident status to RESOLVED")

    # 7. Inspection Reports
    print("\n--- 7. Inspection Reports Tests ---")
    status, insp = request("POST", "/api/inspections", {
        "project_id": project_id,
        "site_id": site_id,
        "area_id": area_id,
        "inspector_id": user_id,
        "inspection_date": "2026-09-11",
        "inspection_type": "SAFETY",
        "status": "PASSED",
        "findings": "Perimeter safety netting in place. Fire extinguishers inspected.",
        "recommendations": "Maintain daily safety log."
    })
    assert status == 201, f"Inspection report creation failed: {insp}"
    insp_id = insp["id"]
    print(f"[PASS] Created Inspection Report ID: {insp_id}")

    # 8. Observations / Issues
    print("\n--- 8. Observations / Issues Tests ---")
    status, obs = request("POST", "/api/observations", {
        "project_id": project_id,
        "site_id": site_id,
        "area_id": area_id,
        "created_by": user_id,
        "observation_type": "SAFETY",
        "title": "Missing Guardrail at Ramp Entrance",
        "description": "Temporary wooden guardrail dislodged during material delivery.",
        "priority": "HIGH",
        "status": "OPEN",
        "assigned_to": user_id
    })
    assert status == 201, f"Observation creation failed: {obs}"
    obs_id = obs["id"]
    print(f"[PASS] Created Observation ID: {obs_id}")
    
    status, obs_up = request("PUT", f"/api/observations/{obs_id}", {
        "status": "RESOLVED"
    })
    assert status == 200 and obs_up["status"] == "RESOLVED"
    print("[PASS] Updated Observation status to RESOLVED")

    # 9. Materials Tracking
    print("\n--- 9. Materials Tracking Tests ---")
    status, mat = request("POST", "/api/materials", {
        "project_id": project_id,
        "site_id": site_id,
        "area_id": area_id,
        "recorded_by": user_id,
        "material_name": "TMT Rebar 16mm Fe500D",
        "category": "Steel",
        "quantity": 120.5,
        "unit": "Metric Tons",
        "supplier": "Apex Steel Industries",
        "delivery_date": "2026-09-11",
        "status": "DELIVERED",
        "notes": "Delivered with mill test certificates."
    })
    assert status == 201, f"Material creation failed: {mat}"
    mat_id = mat["id"]
    print(f"[PASS] Created Material ID: {mat_id}")
    
    status, mat_up = request("PUT", f"/api/materials/{mat_id}", {
        "quantity": 80.0,
        "status": "IN_USE",
        "notes": "40.5 tons consumed for foundation slab."
    })
    assert status == 200 and mat_up["status"] == "IN_USE"
    print("[PASS] Updated Material status to IN_USE")

    # 10. Project Activity Stream
    print("\n--- 10. Project Activity Stream Tests ---")
    status, activities = request("GET", f"/api/projects/{project_id}/activity?limit=20")
    assert status == 200 and len(activities) >= 5, f"Expected at least 5 activity items, got {len(activities)}"
    print(f"[PASS] Retrieved {len(activities)} activity items for Project {project_id}")
    types_found = {a["type"] for a in activities}
    print(f"  Activity types present: {types_found}")
    assert "PHOTO" in types_found or "REPORT" in types_found or "INCIDENT" in types_found

    # 11. Photo Deletion & File Cleanup Test
    print("\n--- 11. Photo Deletion Disk Cleanup Test ---")
    ctype, body = multipart_encode(
        fields={"project_id": str(project_id), "site_id": str(site_id), "uploaded_by": str(user_id)},
        files={"file": ("del_test.png", fake_img_bytes, "image/png")}
    )
    status, del_photo = request("POST", "/api/photos", body=body, content_type=ctype)
    del_photo_id = del_photo["id"]
    del_file_rel = del_photo["file_path"]
    del_disk_path = os.path.join(os.path.dirname(__file__), "uploads", "photos", os.path.basename(del_file_rel))
    assert os.path.exists(del_disk_path), "File to be deleted does not exist on disk"
    
    status, del_res = request("DELETE", f"/api/photos/{del_photo_id}")
    assert status == 200, f"Delete photo failed: {del_res}"
    assert not os.path.exists(del_disk_path), f"File {del_disk_path} was NOT removed from disk after deletion"
    print(f"[PASS] Successfully deleted photo {del_photo_id} and verified disk file was removed.")

    print("\n==================================================")
    print("ALL PHASE 3 AUTOMATED TESTS COMPLETED WITH 100% SUCCESS!")
    print("==================================================")

if __name__ == "__main__":
    run_tests()
