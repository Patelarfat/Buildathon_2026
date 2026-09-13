"""
Seed script for Pune Metro Commercial Hub – Phase 1 Demo Project.
Strictly creates ONLY the new project and related records.
Does NOT modify or delete any existing project data.
"""

import sys
import os

# Ensure backend directory is in path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal
import models
from services.rag.indexer import RAGIndexer

def seed_pune_metro():
    db = SessionLocal()
    try:
        # Check if project already exists to avoid duplicate seeding
        existing = db.query(models.Project).filter(models.Project.name == "Pune Metro Commercial Hub – Phase 1").first()
        if existing:
            print(f"[INFO] Project 'Pune Metro Commercial Hub – Phase 1' already exists with ID: {existing.id}")
            rag_res = RAGIndexer.index_project_backfill(db, existing.id)
            print(f"[INFO] RAG Documents Synced: {rag_res}")
            return existing.id

        print("[1/9] Creating Project Members / Users...")
        def get_or_create_user(email, name, role):
            u = db.query(models.User).filter(models.User.email == email).first()
            if not u:
                u = models.User(
                    name=name,
                    email=email,
                    role=role,
                    password_hash="demo_password_hash_pune"
                )
                db.add(u)
                db.flush()
            return u

        u_pm = get_or_create_user("pune_pm@metro.com", "Rajesh Sharma", "PROJECT_MANAGER")
        u_sup = get_or_create_user("pune_supervisor@metro.com", "Amit Patil", "SITE_SUPERVISOR")
        u_safety = get_or_create_user("pune_safety@metro.com", "Pooja Deshmukh", "SAFETY_OFFICER")
        u_contractor = get_or_create_user("pune_contractor@metro.com", "Vikas Shinde", "CONTRACTOR")
        u_admin = get_or_create_user("pune_admin@metro.com", "Sunil Kulkarni", "ADMIN")

        print("[2/9] Creating Project...")
        project = models.Project(
            name="Pune Metro Commercial Hub – Phase 1",
            description="Construction of a large mixed-use commercial and transit-oriented development consisting of a basement parking structure, retail podium, office tower, and supporting infrastructure.",
            location="Hinjewadi, Pune, Maharashtra, India",
            status="ACTIVE",
            start_date="2026-01-15",
            end_date="2027-12-31"
        )
        db.add(project)
        db.flush()
        project_id = project.id

        for user, role in [
            (u_pm, "PROJECT_MANAGER"),
            (u_sup, "SITE_SUPERVISOR"),
            (u_safety, "SAFETY_OFFICER"),
            (u_contractor, "CONTRACTOR"),
            (u_admin, "ADMIN")
        ]:
            db.add(models.ProjectMember(project_id=project_id, user_id=user.id, role=role))
        db.flush()

        print("[3/9] Creating Primary Site & 6 Areas...")
        site = models.Site(
            project_id=project_id,
            name="Pune Metro Commercial Hub – Main Site",
            address="Hinjewadi Phase 2, Pune, Maharashtra",
            description="Main construction site containing basement works, podium construction, office tower structure, material yard, and site access infrastructure."
        )
        db.add(site)
        db.flush()
        site_id = site.id

        area_defs = [
            ("Basement B2 Parking", "FLOOR", "Second-level basement parking and MEP installation zone."),
            ("Podium Level 1", "FLOOR", "Retail podium structural and finishing work area."),
            ("Office Tower – Level 8", "FLOOR", "Active structural and facade construction zone."),
            ("Tower Crane Zone", "ZONE", "Heavy lifting and crane operation area serving the office tower."),
            ("Material Storage Yard", "ZONE", "Storage and receiving area for cement, steel, tiles, electrical materials and other construction supplies."),
            ("Main Site Access Road", "ZONE", "Vehicle movement, concrete truck access and worker entry/exit area.")
        ]
        areas_map = {}
        for name, a_type, desc in area_defs:
            a = models.Area(site_id=site_id, name=name, area_type=a_type, description=desc)
            db.add(a)
            db.flush()
            areas_map[name] = a.id

        print("[4/9] Creating Daily Reports...")
        daily_reports_data = [
            {
                "area_name": "Office Tower – Level 8",
                "report_date": "2026-09-05",
                "work_planned": "Column reinforcement and slab preparation",
                "work_completed": "Reinforcement completed for approximately 80% of planned zone",
                "progress_percentage": 72,
                "workers_count": 38,
                "weather": "Partly cloudy",
                "issues": "Minor delay due to steel delivery timing.",
                "blockers": "Waiting for additional reinforcement steel."
            },
            {
                "area_name": "Tower Crane Zone",
                "report_date": "2026-09-07",
                "work_planned": "Tower crane lifting operations and material transfer",
                "work_completed": "Lifting completed for scheduled morning operations",
                "progress_percentage": 68,
                "workers_count": 21,
                "weather": "Clear",
                "issues": "Wind gusts temporarily stopped lifting operations.",
                "blockers": "High wind during afternoon period."
            },
            {
                "area_name": "Podium Level 1",
                "report_date": "2026-09-09",
                "work_planned": "Concrete pouring and formwork",
                "work_completed": "Concrete pouring completed for planned section",
                "progress_percentage": 76,
                "workers_count": 44,
                "weather": "Clear",
                "issues": "Concrete pump arrived late.",
                "blockers": "None."
            },
            {
                "area_name": "Basement B2 Parking",
                "report_date": "2026-09-11",
                "work_planned": "MEP cable tray installation",
                "work_completed": "Approximately 60% completed",
                "progress_percentage": 58,
                "workers_count": 27,
                "weather": "Rain",
                "issues": "Water accumulation slowed work.",
                "blockers": "Drainage pumping required."
            },
            {
                "area_name": "Office Tower – Level 8",
                "report_date": "2026-09-12",
                "work_planned": "Facade frame installation",
                "work_completed": "Only 55% of planned work completed",
                "progress_percentage": 55,
                "workers_count": 34,
                "weather": "Rain",
                "issues": "Facade material delivery arrived late.",
                "blockers": "Aluminium facade frames pending."
            }
        ]

        for dr in daily_reports_data:
            rep = models.DailyReport(
                project_id=project_id,
                site_id=site_id,
                area_id=areas_map[dr["area_name"]],
                reported_by=u_sup.id,
                report_date=dr["report_date"],
                work_planned=dr["work_planned"],
                work_completed=dr["work_completed"],
                progress_percentage=dr["progress_percentage"],
                workers_count=dr["workers_count"],
                weather=dr["weather"],
                issues=dr["issues"],
                blockers=dr["blockers"]
            )
            db.add(rep)
        db.flush()

        print("[5/9] Creating Safety Incidents...")
        incidents_data = [
            {
                "incident_type": "EQUIPMENT_ACCIDENT",
                "severity": "HIGH",
                "status": "OPEN",
                "incident_date": "2026-09-12",
                "area_name": "Tower Crane Zone",
                "description": "During a material lifting operation, the crane load shifted unexpectedly and the lifting operation was stopped immediately. No worker was injured, but the incident indicates a potential lifting safety hazard.",
                "action_taken": "Lifting operations temporarily suspended.",
                "resolved_at": None
            },
            {
                "incident_type": "PPE_VIOLATION",
                "severity": "MEDIUM",
                "status": "UNDER_REVIEW",
                "incident_date": "2026-09-10",
                "area_name": "Office Tower – Level 8",
                "description": "Two workers were observed entering the active work zone without required safety goggles.",
                "action_taken": "Workers removed from work area and instructed to wear required PPE.",
                "resolved_at": None
            },
            {
                "incident_type": "SLIP_TRIP",
                "severity": "LOW",
                "status": "RESOLVED",
                "incident_date": "2026-09-08",
                "area_name": "Basement B2 Parking",
                "description": "Worker slipped near a temporary water accumulation area. No serious injury occurred.",
                "action_taken": "Area cleaned and warning signage installed.",
                "resolved_at": "2026-09-08 17:00:00"
            },
            {
                "incident_type": "FALL_HAZARD",
                "severity": "HIGH",
                "status": "OPEN",
                "incident_date": "2026-09-11",
                "area_name": "Podium Level 1",
                "description": "Temporary edge protection was found incomplete near an active work zone.",
                "action_taken": "Area barricaded.",
                "resolved_at": None
            }
        ]

        for inc in incidents_data:
            incident = models.SafetyIncident(
                project_id=project_id,
                site_id=site_id,
                area_id=areas_map[inc["area_name"]],
                reported_by=u_safety.id,
                incident_date=inc["incident_date"],
                incident_type=inc["incident_type"],
                severity=inc["severity"],
                status=inc["status"],
                description=inc["description"],
                action_taken=inc["action_taken"],
                resolved_at=inc["resolved_at"]
            )
            db.add(incident)
        db.flush()

        print("[6/9] Creating Inspections...")
        inspections_data = [
            {
                "inspection_type": "Safety Inspection",
                "area_name": "Tower Crane Zone",
                "status": "FAILED",
                "inspection_date": "2026-09-12",
                "findings": "Crane operating zone requires improved barricading and lifting procedure verification.",
                "recommendations": "Verify lifting plan and strengthen exclusion-zone controls."
            },
            {
                "inspection_type": "PPE Inspection",
                "area_name": "Office Tower – Level 8",
                "status": "PASSED",
                "inspection_date": "2026-09-10",
                "findings": "Most workers compliant with required PPE.",
                "recommendations": "Continue spot checks."
            },
            {
                "inspection_type": "Quality Inspection",
                "area_name": "Podium Level 1",
                "status": "FAILED",
                "inspection_date": "2026-09-09",
                "findings": "Minor concrete surface defects found in one structural section.",
                "recommendations": "Repair affected section and conduct reinspection."
            },
            {
                "inspection_type": "Housekeeping Inspection",
                "area_name": "Basement B2 Parking",
                "status": "PASSED",
                "inspection_date": "2026-09-11",
                "findings": "Housekeeping acceptable after drainage cleanup.",
                "recommendations": "Maintain daily housekeeping checks."
            }
        ]

        for insp in inspections_data:
            inspection = models.InspectionReport(
                project_id=project_id,
                site_id=site_id,
                area_id=areas_map[insp["area_name"]],
                inspector_id=u_safety.id,
                inspection_date=insp["inspection_date"],
                inspection_type=insp["inspection_type"],
                status=insp["status"],
                findings=insp["findings"],
                recommendations=insp["recommendations"]
            )
            db.add(inspection)
        db.flush()

        print("[7/9] Creating Observations...")
        observations_data = [
            {
                "title": "Incomplete Edge Protection",
                "observation_type": "SAFETY",
                "area_name": "Podium Level 1",
                "priority": "HIGH",
                "status": "OPEN",
                "description": "Temporary edge protection is incomplete near active construction work."
            },
            {
                "title": "Poor Material Stacking",
                "observation_type": "STORAGE",
                "area_name": "Material Storage Yard",
                "priority": "MEDIUM",
                "status": "OPEN",
                "description": "Steel bundles are stacked without sufficient separation between pedestrian and vehicle movement paths."
            },
            {
                "title": "Water Accumulation",
                "observation_type": "ENVIRONMENT",
                "area_name": "Basement B2 Parking",
                "priority": "MEDIUM",
                "status": "OPEN",
                "description": "Rainwater accumulation observed near the eastern drainage channel."
            },
            {
                "title": "Missing Warning Sign",
                "observation_type": "SAFETY",
                "area_name": "Main Site Access Road",
                "priority": "LOW",
                "status": "RESOLVED",
                "description": "Temporary vehicle movement warning sign was missing near the site entrance."
            },
            {
                "title": "Unsafe Lifting Exclusion Zone",
                "observation_type": "SAFETY",
                "area_name": "Tower Crane Zone",
                "priority": "HIGH",
                "status": "OPEN",
                "description": "Pedestrian exclusion zone around crane lifting operations needs improvement."
            }
        ]

        for obs in observations_data:
            observation = models.Observation(
                project_id=project_id,
                site_id=site_id,
                area_id=areas_map[obs["area_name"]],
                created_by=u_sup.id,
                observation_type=obs["observation_type"],
                title=obs["title"],
                description=obs["description"],
                priority=obs["priority"],
                status=obs["status"],
                observed_at="2026-09-12 10:00:00"
            )
            db.add(observation)
        db.flush()

        print("[8/9] Creating Materials...")
        materials_data = [
            {
                "material_name": "TMT Reinforcement Steel",
                "category": "STRUCTURAL",
                "quantity": 18.0,
                "unit": "TON",
                "status": "AVAILABLE",
                "supplier": "Tata Steel",
                "delivery_date": "2026-09-08",
                "area_name": "Material Storage Yard",
                "notes": "Verified test certificate received."
            },
            {
                "material_name": "M25 Ready Mix Concrete",
                "category": "CONCRETE",
                "quantity": 120.0,
                "unit": "CUBIC_METER",
                "status": "AVAILABLE",
                "supplier": "Local RMC Supplier",
                "delivery_date": "2026-09-12",
                "area_name": "Podium Level 1",
                "notes": "Slump test passed."
            },
            {
                "material_name": "Aluminium Facade Frames",
                "category": "FACADE",
                "quantity": 35.0,
                "unit": "SETS",
                "status": "DELAYED",
                "supplier": "ABC Facades Pvt Ltd",
                "delivery_date": "2026-09-15",
                "area_name": "Office Tower – Level 8",
                "notes": "Delivery delayed and currently affecting facade installation."
            },
            {
                "material_name": "Electrical Cable Trays",
                "category": "ELECTRICAL",
                "quantity": 140.0,
                "unit": "METERS",
                "status": "AVAILABLE",
                "supplier": "KEI Industries",
                "delivery_date": "2026-09-10",
                "area_name": "Basement B2 Parking",
                "notes": "Standard galvanised grade."
            },
            {
                "material_name": "Ceramic Floor Tiles",
                "category": "FINISHING",
                "quantity": 450.0,
                "unit": "BOXES",
                "status": "LOW_STOCK",
                "supplier": "Kajaria",
                "delivery_date": "2026-09-14",
                "area_name": "Podium Level 1",
                "notes": "Reserve stock running low."
            },
            {
                "material_name": "Safety Barricade Panels",
                "category": "SAFETY",
                "quantity": 12.0,
                "unit": "UNITS",
                "status": "LOW_STOCK",
                "supplier": "Site Safety Supplier",
                "delivery_date": "2026-09-16",
                "area_name": "Tower Crane Zone",
                "notes": "Additional units ordered for perimeter."
            },
            {
                "material_name": "Cement",
                "category": "CONCRETE",
                "quantity": 85.0,
                "unit": "BAGS",
                "status": "AVAILABLE",
                "supplier": "UltraTech",
                "delivery_date": "2026-09-12",
                "area_name": "Material Storage Yard",
                "notes": "OPC 53 Grade stored in dry shelter."
            },
            {
                "material_name": "Fire-Rated Electrical Cable",
                "category": "ELECTRICAL",
                "quantity": 0.0,
                "unit": "METERS",
                "status": "OUT_OF_STOCK",
                "supplier": "Electrical Supplier",
                "delivery_date": "2026-09-18",
                "area_name": "Basement B2 Parking",
                "notes": "Current stock unavailable and MEP installation may be affected."
            }
        ]

        for mat in materials_data:
            material = models.Material(
                project_id=project_id,
                site_id=site_id,
                area_id=areas_map[mat["area_name"]],
                recorded_by=u_contractor.id,
                material_name=mat["material_name"],
                category=mat["category"],
                quantity=mat["quantity"],
                unit=mat["unit"],
                status=mat["status"],
                supplier=mat["supplier"],
                delivery_date=mat["delivery_date"],
                notes=mat["notes"]
            )
            db.add(material)
        db.flush()

        print("[9/9] Creating AI PPE Vision Findings...")
        # Photo 1: Office Tower – Level 8 (12 workers: 10 compliant, 2 violations)
        p1 = models.SitePhoto(
            project_id=project_id,
            site_id=site_id,
            area_id=areas_map["Office Tower – Level 8"],
            uploaded_by=u_sup.id,
            file_name="pune_office_level8_ppe.jpg",
            file_path="/uploads/photos/pune_office_level8_ppe.jpg",
            caption="AI Vision Safety Scan: Office Tower Level 8 Work Zone",
            taken_at="2026-09-12 11:30:00"
        )
        db.add(p1)
        db.flush()

        run1 = models.AIAnalysisRun(
            photo_id=p1.id,
            model_name="construction-ppe-yolo",
            model_version="v2",
            status="COMPLETED",
            processing_time_ms=1420.0
        )
        db.add(run1)
        db.flush()

        # 10 Compliance findings for Photo 1
        for i in range(10):
            db.add(models.AISafetyFinding(
                photo_id=p1.id,
                analysis_run_id=run1.id,
                project_id=project_id,
                site_id=site_id,
                area_id=areas_map["Office Tower – Level 8"],
                finding_type="HELMET_DETECTED",
                severity="INFO",
                title=f"PPE Compliant: Hard hat verified (Worker {i+1})",
                description="Worker wearing approved safety helmet in active zone.",
                confidence=0.96,
                status="REVIEWED"
            ))

        # 2 Violations for Photo 1
        db.add(models.AISafetyFinding(
            photo_id=p1.id,
            analysis_run_id=run1.id,
            project_id=project_id,
            site_id=site_id,
            area_id=areas_map["Office Tower – Level 8"],
            finding_type="PERSON_WITHOUT_HELMET",
            severity="HIGH",
            title="PPE Violation: Person without helmet",
            description="Worker detected without required hard hat near structural facade edge.",
            confidence=0.91,
            status="OPEN"
        ))
        db.add(models.AISafetyFinding(
            photo_id=p1.id,
            analysis_run_id=run1.id,
            project_id=project_id,
            site_id=site_id,
            area_id=areas_map["Office Tower – Level 8"],
            finding_type="PERSON_WITHOUT_GOGGLES",
            severity="MEDIUM",
            title="PPE Violation: Person without eye protection",
            description="Worker observed cutting metal studs without safety goggles.",
            confidence=0.88,
            status="OPEN"
        ))

        # Photo 2: Tower Crane Zone (8 workers: 7 compliant, 1 violation)
        p2 = models.SitePhoto(
            project_id=project_id,
            site_id=site_id,
            area_id=areas_map["Tower Crane Zone"],
            uploaded_by=u_sup.id,
            file_name="pune_crane_zone_ppe.jpg",
            file_path="/uploads/photos/pune_crane_zone_ppe.jpg",
            caption="AI Vision Safety Scan: Tower Crane Lifting Zone",
            taken_at="2026-09-12 14:00:00"
        )
        db.add(p2)
        db.flush()

        run2 = models.AIAnalysisRun(
            photo_id=p2.id,
            model_name="construction-ppe-yolo",
            model_version="v2",
            status="COMPLETED",
            processing_time_ms=1380.0
        )
        db.add(run2)
        db.flush()

        for i in range(7):
            db.add(models.AISafetyFinding(
                photo_id=p2.id,
                analysis_run_id=run2.id,
                project_id=project_id,
                site_id=site_id,
                area_id=areas_map["Tower Crane Zone"],
                finding_type="VEST_DETECTED",
                severity="INFO",
                title=f"PPE Compliant: High-vis vest verified (Rigger {i+1})",
                description="Worker wearing high-visibility safety vest in crane operating zone.",
                confidence=0.97,
                status="REVIEWED"
            ))

        db.add(models.AISafetyFinding(
            photo_id=p2.id,
            analysis_run_id=run2.id,
            project_id=project_id,
            site_id=site_id,
            area_id=areas_map["Tower Crane Zone"],
            finding_type="PERSON_WITHOUT_VEST",
            severity="HIGH",
            title="PPE Violation: Person without high-vis vest",
            description="Worker in crane landing radius without high-visibility vest.",
            confidence=0.93,
            status="OPEN"
        ))

        # Photo 3: Podium Level 1 (9 workers: 9 compliant, 0 violations)
        p3 = models.SitePhoto(
            project_id=project_id,
            site_id=site_id,
            area_id=areas_map["Podium Level 1"],
            uploaded_by=u_sup.id,
            file_name="pune_podium_ppe.jpg",
            file_path="/uploads/photos/pune_podium_ppe.jpg",
            caption="AI Vision Safety Scan: Podium Concreting Area",
            taken_at="2026-09-12 16:15:00"
        )
        db.add(p3)
        db.flush()

        run3 = models.AIAnalysisRun(
            photo_id=p3.id,
            model_name="construction-ppe-yolo",
            model_version="v2",
            status="COMPLETED",
            processing_time_ms=1290.0
        )
        db.add(run3)
        db.flush()

        for i in range(9):
            db.add(models.AISafetyFinding(
                photo_id=p3.id,
                analysis_run_id=run3.id,
                project_id=project_id,
                site_id=site_id,
                area_id=areas_map["Podium Level 1"],
                finding_type="HELMET_DETECTED",
                severity="INFO",
                title=f"PPE Compliant: Full safety gear verified (Worker {i+1})",
                description="Worker fully compliant with helmet, vest and safety boots.",
                confidence=0.98,
                status="REVIEWED"
            ))

        db.commit()
        print(f"[SUCCESS] Project successfully created with ID: {project_id}")

        print(f"[RAG] Indexing Hybrid RAG knowledge base for Project {project_id}...")
        rag_res = RAGIndexer.index_project_backfill(db, project_id)
        print(f"[RAG] Successfully indexed documents for Project {project_id}: {rag_res}")

        return project_id

    except Exception as e:
        db.rollback()
        print(f"[ERROR] Failed to seed demo project: {e}")
        raise e
    finally:
        db.close()


if __name__ == "__main__":
    new_pid = seed_pune_metro()
    print(f"\nDEMO PROJECT ID: {new_pid}")
