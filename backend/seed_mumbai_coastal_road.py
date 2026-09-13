"""
Seed script for Mumbai Coastal Road Project (South) — Phase 1.
Real-world Mega Infrastructure Engineering Project.
Populates complete, realistic data across all platform modules:
- Project, 2 Sites, 6 Operational Areas
- 5 Team Members across all canonical roles
- Real site photos with YOLO PPE detections and AI safety findings
- 5 Daily Progress Reports with realistic workforce, equipment, weather, and blockers
- 4 Safety Incidents (Fall hazard, TBM hydraulic leak, missing PPE, barricade issue)
- 4 Inspection Reports (Ultrasonic flaw test, load deflection test, effluent audit, crane rigging)
- 5 Site Observations & Snags with assigned team members
- 6 Construction Materials (Marine Concrete M60, TMT Fe550D Rebar, Tunnel Rings, Thermal Boards, etc.)
- Deterministic Risk Evaluation & Signal Attribution
- Hybrid Vector RAG Knowledge Indexing via RAGIndexer
"""

import sys
import os
import shutil
from datetime import datetime, timedelta

# Ensure backend directory is in path
backend_dir = r"c:\Users\arfat\Buldathon_ps1_2026\backend"
sys.path.insert(0, backend_dir)

from database import SessionLocal
import models
from services.rag.indexer import RAGIndexer
from services.risk_engine import RiskEngine


def seed_mumbai_coastal_road():
    db = SessionLocal()
    try:
        project_name = "Mumbai Coastal Road Project (South) — Phase 1"
        existing = db.query(models.Project).filter(models.Project.name == project_name).first()
        if existing:
            print(f"[INFO] Project '{project_name}' already exists with ID: {existing.id}")
            rag_res = RAGIndexer.index_project_backfill(db, existing.id)
            print(f"[INFO] RAG Documents Re-indexed: {rag_res}")
            return existing.id

        print("================================================================")
        print("SEEDING: Mumbai Coastal Road Project (South) — Phase 1")
        print("================================================================")

        # ---------------------------------------------------------------------
        # 1. Project Team Members / Users
        # ---------------------------------------------------------------------
        print("[1/10] Registering Project Team Members...")
        def get_or_create_user(email, name, role):
            u = db.query(models.User).filter(models.User.email == email).first()
            if not u:
                u = models.User(
                    name=name,
                    email=email,
                    role=role,
                    password_hash="coastal_demo_pw_hash"
                )
                db.add(u)
                db.flush()
            return u

        u_pm = get_or_create_user("mumbai_pm@coastalroad.gov.in", "Sanjay Mukherjee", "PROJECT_MANAGER")
        u_sup = get_or_create_user("mumbai_supervisor@coastalroad.gov.in", "Capt. Pradeep Patil", "SITE_SUPERVISOR")
        u_safety = get_or_create_user("mumbai_safety@coastalroad.gov.in", "Dr. Ananya Sen", "SAFETY_OFFICER")
        u_contractor = get_or_create_user("mumbai_contractor@ltinfra.com", "Vikramaditya Nair", "CONTRACTOR")
        u_admin = get_or_create_user("mumbai_admin@mcgm.gov.in", "Sunil Deshpande", "ADMIN")

        # ---------------------------------------------------------------------
        # 2. Project Metadata
        # ---------------------------------------------------------------------
        print("[2/10] Creating Project Record...")
        project = models.Project(
            name=project_name,
            description=(
                "Construction of the 10.58 km high-speed 8-lane coastal highway from Marine Drive "
                "(Princess Street Flyover) to the Worli end of the Bandra-Worli Sea Link. Featuring India's "
                "first undersea twin road tunnels (12.19m diameter) bored by Slurry TBM Mavali, 111 hectares "
                "of coastal land reclamation, multi-level sea bridge interchanges, and rock armor seawalls."
            ),
            location="Marine Drive to Worli Coastal Corridor, Mumbai, Maharashtra, India",
            status="ACTIVE",
            start_date="2025-06-01",
            end_date="2027-11-30"
        )
        db.add(project)
        db.flush()
        project_id = project.id

        # Assign project team members
        for user, role in [
            (u_pm, "PROJECT_MANAGER"),
            (u_sup, "SITE_SUPERVISOR"),
            (u_safety, "SAFETY_OFFICER"),
            (u_contractor, "CONTRACTOR"),
            (u_admin, "ADMIN"),
        ]:
            db.add(models.ProjectMember(project_id=project_id, user_id=user.id, role=role))
        db.flush()

        # ---------------------------------------------------------------------
        # 3. Construction Sites & Operational Areas
        # ---------------------------------------------------------------------
        print("[3/10] Creating 2 Construction Sites and 6 Operational Areas...")
        site1 = models.Site(
            project_id=project_id,
            name="Package 4: Undersea Twin Tunnels & South Interchange",
            address="Marine Drive (Princess Street) to Priyadarshini Park (PDP), Mumbai",
            description="Undersea twin tunnels 2.07 km each beneath Girgaon Chowpatty and Malabar Hill, southern portal ramps and ventilation shafts."
        )
        site2 = models.Site(
            project_id=project_id,
            name="Package 1: Priyadarshini Park to Baroda Palace Marine Works",
            address="PDP to Worli Sea Face Promenade, Mumbai",
            description="Coastal road viaduct bridge spans, seawall revetment, coastal reclamation, and interchange arms."
        )
        db.add_all([site1, site2])
        db.flush()

        area_defs = [
            (site1.id, "Undersea Twin Tunnel — Northbound Ch 2+450", "ZONE", "Active undersea road tunnel tube bored by TBM Mavali, fire-board lining & MEP works."),
            (site1.id, "Marine Drive Promenade Interchange (Princess St)", "ZONE", "South portal entry/exit ramps, box culvert pedestrian underpass and seawall tie-in."),
            (site2.id, "Worli Sea Face Coastal Bridge Viaduct (Pier 14-22)", "ZONE", "Precast segmental sea bridge viaduct connecting to Bandra-Worli Sea Link."),
            (site2.id, "Amarsons Garden Coastal Reclamation & Seawall", "ZONE", "Reclaimed promenade area with multi-layer rock armor tetrapods and geo-composite revetment."),
            (site2.id, "Casting Yard & Precast Segment Facility", "ZONE", "Precasting and steam-curing yard for 12.2m diameter steel-fibre reinforced tunnel segment rings."),
            (site1.id, "Haji Ali Central Materials & Batching Plant", "ZONE", "Central computerized marine-grade RMC batching plant (M60/M70) and material stockpiles.")
        ]

        areas_map = {}
        for s_id, a_name, a_type, a_desc in area_defs:
            area_obj = models.Area(site_id=s_id, name=a_name, area_type=a_type, description=a_desc)
            db.add(area_obj)
            db.flush()
            areas_map[a_name] = area_obj.id

        # ---------------------------------------------------------------------
        # 4. Daily Progress Reports
        # ---------------------------------------------------------------------
        print("[4/10] Creating Daily Progress Reports...")
        daily_reports_data = [
            {
                "site_id": site1.id,
                "area_name": "Undersea Twin Tunnel — Northbound Ch 2+450",
                "report_date": "2026-09-13",
                "work_completed": "Installed 18 precast segment rings (Ring #384 to #401) using TBM erector arm. Commenced calcium-silicate thermal fire-board insulation on tunnel crown. Slurry treatment plant processed 2,400 m³ of bentonite.",
                "work_planned": "Complete remaining 12 rings up to cross-passage 3. Pressure-grouting of annular gap with fast-setting polymer grout.",
                "progress_percentage": 78.5,
                "workers_count": 210,
                "weather": "Sunny, Sea Breeze, 31°C",
                "equipment_used": "Slurry TBM Mavali (12.19m), Slurry Separation Plant, Multi-Service Vehicle (MSV), Grout Injection Pump",
                "materials_used": "18 Tunnel Segment Rings, 65 m³ Annular Polymer Grout, 120 Fire-Rated Boards",
                "issues": "Bentonite slurry viscosity required chemical recalibration due to high marine clay content.",
                "blockers": "None",
                "notes": "Night shift operations fully manned. Tunnel ventilation fan running at 100% capacity."
            },
            {
                "site_id": site2.id,
                "area_name": "Worli Sea Face Coastal Bridge Viaduct (Pier 14-22)",
                "report_date": "2026-09-12",
                "work_completed": "Completed launching of 14 precast box girder segments on Span 16-17. Carried out longitudinal prestressing strand stressing to 1,250 kN per tendon.",
                "work_planned": "Grouting of tendon ducts on Span 16-17. Shift launching gantry to Span 17-18.",
                "progress_percentage": 71.0,
                "workers_count": 185,
                "weather": "Partly Cloudy, High Tide Surge, 30°C",
                "equipment_used": "150T Segment Launching Gantry, 250T Hydraulic Jacking System, 75T Mobile Crane",
                "materials_used": "14 Precast Box Girder Segments, 18 MT High-Tensile Prestressing Strands, Epoxy Bonding Agent",
                "issues": "Launching operations temporarily suspended for 45 minutes during peak tidal swell for safety.",
                "blockers": "Low stock of high-tensile prestressing strand anchors.",
                "notes": "Marine wind anemometer logged peak gusts at 34 km/h."
            },
            {
                "site_id": site2.id,
                "area_name": "Amarsons Garden Coastal Reclamation & Seawall",
                "report_date": "2026-09-11",
                "work_completed": "Placed 450 metric tonnes of 2-4 tonne rock armor core boulders along outer seawall revetment. Installed 1,200 m² of non-woven needle-punched geotextile membrane.",
                "work_planned": "Continue interlocking concrete tetrapod placement on seawall slope. Grade reclamation platform.",
                "progress_percentage": 84.0,
                "workers_count": 140,
                "weather": "Clear Sky, 29°C",
                "equipment_used": "3x CAT 349 Excavators with rock grabs, 12 Dump Trucks (32T), Vibro-roller 20T",
                "materials_used": "450 MT Granite Armour Rock, 1,200 m² Geotextile Membrane",
                "issues": "None",
                "blockers": "None",
                "notes": "Bathymetric survey confirmed zero seabed scour at seawall toe."
            },
            {
                "site_id": site1.id,
                "area_name": "Marine Drive Promenade Interchange (Princess St)",
                "report_date": "2026-09-10",
                "work_completed": "Cast Ramp B deck slab section 4 (180 m³ M60 concrete). Completed waterproofing membrane application on pedestrian underpass roof.",
                "work_planned": "Curing of Ramp B deck slab. Commence formwork erection for southern portal approach retaining wall.",
                "progress_percentage": 65.5,
                "workers_count": 160,
                "weather": "Humid, 32°C",
                "equipment_used": "Schwing Stetter Boom Placer (36m), 8 Transit Concrete Mixers (7m³), Tower Crane 1",
                "materials_used": "180 m³ Ready-Mix Concrete M60, 24 MT Fe550D TMT Rebar, SBS Waterproofing Membrane",
                "issues": "Concrete truck arrival delayed by 25 minutes due to south Mumbai peak evening traffic.",
                "blockers": "Delayed customs clearance for imported expansion joint assemblies.",
                "notes": "Concrete cube test specimens cast for 7-day and 28-day compressive strength verification."
            },
            {
                "site_id": site2.id,
                "area_name": "Casting Yard & Precast Segment Facility",
                "report_date": "2026-09-09",
                "work_completed": "Cast 24 curved tunnel lining segments using precision CNC hydraulic steel moulds. Steam-cured 24 segments from previous cycle. Dimensional laser scanning verified tolerance within ±1.0 mm.",
                "work_planned": "Demoulding and transfer to water curing immersion tanks. Prepare rebar cages for next 24 segments.",
                "progress_percentage": 92.0,
                "workers_count": 95,
                "weather": "Sunny, 30°C",
                "equipment_used": "40T Overhead Gantry Crane, Automated Rebar Bending Machine, Steam Curing Boilers",
                "materials_used": "120 m³ Self-Compacting High-Performance Concrete, 18 MT Rebar cages, DRAMIX Steel Fibres",
                "issues": "None",
                "blockers": "None",
                "notes": "100% of cured segments passed ultrasonic non-destructive testing."
            }
        ]

        for rep in daily_reports_data:
            report_obj = models.DailyReport(
                project_id=project_id,
                site_id=rep["site_id"],
                area_id=areas_map[rep["area_name"]],
                reported_by=u_sup.id,
                report_date=rep["report_date"],
                work_completed=rep["work_completed"],
                work_planned=rep["work_planned"],
                progress_percentage=rep["progress_percentage"],
                workers_count=rep["workers_count"],
                weather=rep["weather"],
                equipment_used=rep["equipment_used"],
                materials_used=rep["materials_used"],
                issues=rep["issues"],
                blockers=rep["blockers"],
                notes=rep["notes"]
            )
            db.add(report_obj)
        db.flush()

        # ---------------------------------------------------------------------
        # 5. Safety Incidents & Hazards
        # ---------------------------------------------------------------------
        print("[5/10] Creating Safety Incidents...")
        incidents_data = [
            {
                "site_id": site1.id,
                "area_name": "Undersea Twin Tunnel — Northbound Ch 2+450",
                "incident_date": "2026-09-13",
                "incident_type": "EQUIPMENT_ACCIDENT",
                "severity": "HIGH",
                "status": "OPEN",
                "description": "High-pressure hydraulic hose on TBM Mavali segment erector arm ruptured during ring installation, spraying non-toxic biodegradable hydraulic fluid. Emergency stop was activated immediately.",
                "action_taken": "TBM erector power isolated. Pressure relieved from manifold. Maintenance crew mobilized with replacement OEM hydraulic line and spill containment mats."
            },
            {
                "site_id": site2.id,
                "area_name": "Worli Sea Face Coastal Bridge Viaduct (Pier 14-22)",
                "incident_date": "2026-09-12",
                "incident_type": "FALL",
                "severity": "CRITICAL",
                "status": "OPEN",
                "description": "Near-miss fall hazard detected: 12-meter section of perimeter safety debris netting on Coastal Viaduct Pier 18 cantilever gantry was dislodged by strong coastal crosswinds, exposing edge workers to fall risk.",
                "action_taken": "Immediate red-tag work stoppage ordered on Pier 18 cantilever deck. Workers tethered to 100% tie-off lifeline cables until perimeter netting re-anchored."
            },
            {
                "site_id": site2.id,
                "area_name": "Amarsons Garden Coastal Reclamation & Seawall",
                "incident_date": "2026-09-11",
                "incident_type": "PPE_VIOLATION",
                "severity": "MEDIUM",
                "status": "UNDER_REVIEW",
                "description": "Subcontractor riggers observed working without puncture-resistant safety boots and protective leather gloves during heavy rock armor boulder handling.",
                "action_taken": "Rigging team stood down for 30 minutes. Mandatory PPE re-inspection conducted and correct Class-1 safety boots and anti-abrasion gloves issued."
            },
            {
                "site_id": site1.id,
                "area_name": "Marine Drive Promenade Interchange (Princess St)",
                "incident_date": "2026-09-08",
                "incident_type": "UNSAFE_CONDITION",
                "severity": "LOW",
                "status": "RESOLVED",
                "description": "High spring-tide surge displaced water-filled plastic safety barricades along the southern pedestrian diversion pathway adjacent to Marine Drive promenade.",
                "action_taken": "Plastic barricades replaced with precast interlocking concrete Jersey crash barriers with reflective warning tape."
            }
        ]

        for inc in incidents_data:
            incident_obj = models.SafetyIncident(
                project_id=project_id,
                site_id=inc["site_id"],
                area_id=areas_map[inc["area_name"]],
                reported_by=u_safety.id,
                incident_date=inc["incident_date"],
                incident_type=inc["incident_type"],
                severity=inc["severity"],
                status=inc["status"],
                description=inc["description"],
                action_taken=inc["action_taken"],
                resolved_at=inc["incident_date"] if inc["status"] == "RESOLVED" else None
            )
            db.add(incident_obj)
        db.flush()

        # ---------------------------------------------------------------------
        # 6. Site Inspections & Quality Audits
        # ---------------------------------------------------------------------
        print("[6/10] Creating Site Inspections & Quality Audits...")
        inspections_data = [
            {
                "site_id": site1.id,
                "area_name": "Undersea Twin Tunnel — Northbound Ch 2+450",
                "inspection_date": "2026-09-13",
                "inspection_type": "SAFETY",
                "status": "PASSED",
                "findings": "Inspected emergency escape cross-passage doors, secondary backup power generator, and air-scrubbing ventilation units in undersea tunnel tube.",
                "recommendations": "Verify emergency fire suppression water mist nozzles quarterly."
            },
            {
                "site_id": site2.id,
                "area_name": "Worli Sea Face Coastal Bridge Viaduct (Pier 14-22)",
                "inspection_date": "2026-09-12",
                "inspection_type": "QUALITY",
                "status": "PASSED",
                "findings": "Hydraulic jack calibration and tendon elongation measurements verified on Span 16-17. Prestressing forces within 1.5% of structural design specifications.",
                "recommendations": "Proceed with high-performance non-shrink cementitious grout injection into post-tensioning ducts."
            },
            {
                "site_id": site1.id,
                "area_name": "Haji Ali Central Materials & Batching Plant",
                "inspection_date": "2026-09-11",
                "inspection_type": "ENVIRONMENTAL",
                "status": "FAILED",
                "findings": "Slurry treatment water discharge effluent analysis detected pH value of 9.4 and total suspended solids (TSS) exceeding marine environmental discharge limit of 50 mg/L.",
                "recommendations": "Recalibrate acid-neutralization dosing unit immediately. Retain all recycled slurry water inside closed holding lagoons until TSS is verified below 30 mg/L."
            },
            {
                "site_id": site2.id,
                "area_name": "Amarsons Garden Coastal Reclamation & Seawall",
                "inspection_date": "2026-09-10",
                "inspection_type": "EQUIPMENT",
                "status": "REQUIRES_ACTION",
                "findings": "300T barge-mounted floating derrick crane wire hoist rope showed superficial sea-spray surface corrosion and 2 broken outer strands near boom head pulley.",
                "recommendations": "Replace the 38mm hoist wire rope segment before lifting 40T seawall concrete blocks. Inspect all boom sheaves."
            }
        ]

        for insp in inspections_data:
            insp_obj = models.InspectionReport(
                project_id=project_id,
                site_id=insp["site_id"],
                area_id=areas_map[insp["area_name"]],
                inspector_id=u_safety.id,
                inspection_date=insp["inspection_date"],
                inspection_type=insp["inspection_type"],
                status=insp["status"],
                findings=insp["findings"],
                recommendations=insp["recommendations"]
            )
            db.add(insp_obj)
        db.flush()

        # ---------------------------------------------------------------------
        # 7. Site Observations & Snags
        # ---------------------------------------------------------------------
        print("[7/10] Creating Field Observations & Snags...")
        observations_data = [
            {
                "site_id": site1.id,
                "area_name": "Undersea Twin Tunnel — Northbound Ch 2+450",
                "created_by": u_sup.id,
                "assigned_to": u_contractor.id,
                "observation_type": "SAFETY",
                "priority": "HIGH",
                "status": "OPEN",
                "title": "Minor seawater seepage through segment EPDM gasket at Ring #412",
                "description": "Moisture seepage observed at longitudinal joint between segment key and standard block at 4 o'clock position. Hydrophilic gasket activation incomplete.",
                "observed_at": "2026-09-13 09:30:00"
            },
            {
                "site_id": site1.id,
                "area_name": "Haji Ali Central Materials & Batching Plant",
                "created_by": u_safety.id,
                "assigned_to": u_contractor.id,
                "observation_type": "MATERIAL",
                "priority": "MEDIUM",
                "status": "OPEN",
                "title": "Chemical concrete admixtures stored without secondary spill containment berm",
                "description": "Six 200-litre drums of polycarboxylate superplasticizer stored on bare ground near marine drainage canal without secondary containment tray.",
                "observed_at": "2026-09-12 14:15:00"
            },
            {
                "site_id": site2.id,
                "area_name": "Worli Sea Face Coastal Bridge Viaduct (Pier 14-22)",
                "created_by": u_safety.id,
                "assigned_to": u_sup.id,
                "observation_type": "SAFETY",
                "priority": "HIGH",
                "status": "IN_PROGRESS",
                "title": "Gantry scaffolding tie-back clamp loose on marine-side cantilever",
                "description": "Scaffold clamp holding outer work platform on Pier 16 cantilever showed 15mm displacement under wave-induced vibration.",
                "observed_at": "2026-09-12 11:00:00"
            },
            {
                "site_id": site1.id,
                "area_name": "Marine Drive Promenade Interchange (Princess St)",
                "created_by": u_sup.id,
                "assigned_to": u_contractor.id,
                "observation_type": "PROGRESS",
                "priority": "MEDIUM",
                "status": "OPEN",
                "title": "Trench dewatering submersible pump intake choked with coastal sand",
                "description": "Submersible dewatering pump in box culvert excavation experienced impeller cavitation due to fine marine sand sediment accumulation.",
                "observed_at": "2026-09-11 16:45:00"
            },
            {
                "site_id": site2.id,
                "area_name": "Casting Yard & Precast Segment Facility",
                "created_by": u_sup.id,
                "assigned_to": u_contractor.id,
                "observation_type": "QUALITY",
                "priority": "LOW",
                "status": "RESOLVED",
                "title": "Thermocouple sensor #4 recalibration completed",
                "description": "Steam curing temperature recording thermocouple sensor #4 required recalibration.",
                "observed_at": "2026-09-09 10:00:00"
            }
        ]

        for obs in observations_data:
            obs_obj = models.Observation(
                project_id=project_id,
                site_id=obs["site_id"],
                area_id=areas_map[obs["area_name"]],
                created_by=obs["created_by"],
                assigned_to=obs["assigned_to"],
                observation_type=obs["observation_type"],
                priority=obs["priority"],
                status=obs["status"],
                title=obs["title"],
                description=obs["description"],
                observed_at=obs["observed_at"]
            )
            db.add(obs_obj)
        db.flush()

        # ---------------------------------------------------------------------
        # 8. Construction Materials & Inventory
        # ---------------------------------------------------------------------
        print("[8/10] Registering Materials Inventory...")
        materials_data = [
            {
                "site_id": site1.id,
                "area_name": "Haji Ali Central Materials & Batching Plant",
                "material_name": "Marine Grade Ready-Mix Concrete M60",
                "category": "CONCRETE",
                "quantity": 4500.0,
                "unit": "CUBIC_METERS",
                "status": "IN_USE",
                "supplier": "ACC Concrete Special Infrastructure Division",
                "delivery_date": "2026-09-13",
                "notes": "Microsilica blended high-performance mix with low permeability for marine chloride resistance."
            },
            {
                "site_id": site2.id,
                "area_name": "Worli Sea Face Coastal Bridge Viaduct (Pier 14-22)",
                "material_name": "Corrosion-Resistant TMT Rebar Fe550D (Epoxy Coated)",
                "category": "STEEL",
                "quantity": 110.0,
                "unit": "METRIC_TONNES",
                "status": "LOW_STOCK",
                "supplier": "Tata Steel Infrastructure Projects",
                "delivery_date": "2026-09-17",
                "notes": "Critical stock running low due to rapid pier cap reinforcement fabrication. Next barge consignment expected in 4 days."
            },
            {
                "site_id": site2.id,
                "area_name": "Casting Yard & Precast Segment Facility",
                "material_name": "Steel-Fibre Reinforced Precast Tunnel Segment Rings",
                "category": "PRECAST",
                "quantity": 420.0,
                "unit": "RINGS",
                "status": "DELIVERED",
                "supplier": "L&T Precast Facility Mumbai",
                "delivery_date": "2026-09-12",
                "notes": "Fully cured 12.2m diameter rings inspected and tagged with RFID tracking chips for TBM erection."
            },
            {
                "site_id": site2.id,
                "area_name": "Amarsons Garden Coastal Reclamation & Seawall",
                "material_name": "High-Density Geotextile Coastal Filter Fabric",
                "category": "GEOTECHNICAL",
                "quantity": 15000.0,
                "unit": "SQUARE_METERS",
                "status": "ORDERED",
                "supplier": "Maccaferri Environmental Solutions",
                "delivery_date": "2026-09-20",
                "notes": "Specified for seawall core filtration to prevent fine subgrade migration under tidal wash."
            },
            {
                "site_id": site1.id,
                "area_name": "Undersea Twin Tunnel — Northbound Ch 2+450",
                "material_name": "Fire-Rated Calcium Silicate Thermal Insulation Panels",
                "category": "FIRE_SAFETY",
                "quantity": 0.0,
                "unit": "SQUARE_METERS",
                "status": "DELAYED",
                "supplier": "Promat International MEP Solutions",
                "delivery_date": "2026-09-24",
                "notes": "Customs clearance delay at Nhava Sheva port. Required for tunnel crown fire protection (RWS curve 2-hour rating)."
            },
            {
                "site_id": site2.id,
                "area_name": "Amarsons Garden Coastal Reclamation & Seawall",
                "material_name": "Granite Armour Core Boulders (2-4 Tonne)",
                "category": "AGGREGATE",
                "quantity": 3800.0,
                "unit": "METRIC_TONNES",
                "status": "AVAILABLE",
                "supplier": "Navi Mumbai Quarry Consortia",
                "delivery_date": "2026-09-13",
                "notes": "Dense basalt/granite rock with specific gravity > 2.65 for seawall breakwater core."
            }
        ]

        for mat in materials_data:
            mat_obj = models.Material(
                project_id=project_id,
                site_id=mat["site_id"],
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
            db.add(mat_obj)
        db.flush()

        # ---------------------------------------------------------------------
        # 9. Site Photos & AI Computer Vision PPE Findings
        # ---------------------------------------------------------------------
        print("[9/10] Linking Site Photos and Running AI PPE Vision Analysis...")
        uploads_dir = os.path.join(backend_dir, "uploads", "photos")
        ai_uploads_dir = os.path.join(backend_dir, "uploads", "ai")
        os.makedirs(uploads_dir, exist_ok=True)
        os.makedirs(ai_uploads_dir, exist_ok=True)

        existing_sample_photos = [
            f for f in os.listdir(uploads_dir)
            if f.endswith((".jpg", ".jpeg", ".png")) and not f.startswith(".") and os.path.getsize(os.path.join(uploads_dir, f)) > 10000
        ]
        sample_src = os.path.join(uploads_dir, existing_sample_photos[0]) if existing_sample_photos else None

        def create_photo_file(target_filename):
            target_path = os.path.join(uploads_dir, target_filename)
            if sample_src and os.path.exists(sample_src):
                shutil.copyfile(sample_src, target_path)
            else:
                with open(target_path, "wb") as f:
                    f.write(b"\xFF\xD8\xFF\xE0\x00\x10JFIF\x00\x01\x01\x01\x00H\x00H\x00\x00\xFF\xDB\x00C\x00" + b"\x00" * 500)
            return target_path

        # Photo 1: Undersea Tunnel TBM Mavali Work Zone
        p1_fn = f"mumbai_coastal_tunnel_tbm_{project_id}.jpg"
        create_photo_file(p1_fn)
        photo1 = models.SitePhoto(
            project_id=project_id,
            site_id=site1.id,
            area_id=areas_map["Undersea Twin Tunnel — Northbound Ch 2+450"],
            uploaded_by=u_sup.id,
            file_name=p1_fn,
            file_path=f"/uploads/photos/{p1_fn}",
            caption="AI Vision Safety Audit: TBM Mavali Tunnel Boring Ring Installation Zone",
            taken_at="2026-09-13 10:15:00",
            latitude=18.9548,
            longitude=72.8124
        )
        db.add(photo1)
        db.flush()

        run1 = models.AIAnalysisRun(
            photo_id=photo1.id,
            model_name="construction-ppe-yolo",
            model_version="v2-yolo11n",
            status="COMPLETED",
            processing_time_ms=1340.0
        )
        db.add(run1)
        db.flush()

        for i in range(8):
            db.add(models.AISafetyFinding(
                photo_id=photo1.id,
                analysis_run_id=run1.id,
                project_id=project_id,
                site_id=site1.id,
                area_id=areas_map["Undersea Twin Tunnel — Northbound Ch 2+450"],
                finding_type="HELMET_DETECTED",
                severity="INFO",
                title=f"PPE Compliant: Hard hat verified (Tunnel Miner {i+1})",
                description="Worker verified with approved safety helmet and headlamp inside tunnel tube.",
                confidence=0.97,
                status="REVIEWED"
            ))

        db.add(models.AISafetyFinding(
            photo_id=photo1.id,
            analysis_run_id=run1.id,
            project_id=project_id,
            site_id=site1.id,
            area_id=areas_map["Undersea Twin Tunnel — Northbound Ch 2+450"],
            finding_type="PERSON_WITHOUT_HELMET",
            severity="HIGH",
            title="PPE Violation: Person without hard hat near TBM cutterhead",
            description="Worker observed without safety helmet in active rotating cutterhead clearance zone.",
            confidence=0.93,
            status="OPEN"
        ))
        db.add(models.AISafetyFinding(
            photo_id=photo1.id,
            analysis_run_id=run1.id,
            project_id=project_id,
            site_id=site1.id,
            area_id=areas_map["Undersea Twin Tunnel — Northbound Ch 2+450"],
            finding_type="PERSON_WITHOUT_BOOTS",
            severity="MEDIUM",
            title="PPE Violation: Person without steel-toe boots in slurry track zone",
            description="Worker detected wearing regular athletic shoes in wet slurry rail transport corridor.",
            confidence=0.89,
            status="OPEN"
        ))

        # Photo 2: Coastal Viaduct Pier 16 Cantilever Gantry
        p2_fn = f"mumbai_coastal_viaduct_pier16_{project_id}.jpg"
        create_photo_file(p2_fn)
        photo2 = models.SitePhoto(
            project_id=project_id,
            site_id=site2.id,
            area_id=areas_map["Worli Sea Face Coastal Bridge Viaduct (Pier 14-22)"],
            uploaded_by=u_sup.id,
            file_name=p2_fn,
            file_path=f"/uploads/photos/{p2_fn}",
            caption="AI Vision Safety Audit: Coastal Viaduct Pier 16 Precast Segment Launching Gantry",
            taken_at="2026-09-12 15:30:00",
            latitude=19.0112,
            longitude=72.8156
        )
        db.add(photo2)
        db.flush()

        run2 = models.AIAnalysisRun(
            photo_id=photo2.id,
            model_name="construction-ppe-yolo",
            model_version="v2-yolo11n",
            status="COMPLETED",
            processing_time_ms=1280.0
        )
        db.add(run2)
        db.flush()

        for i in range(6):
            db.add(models.AISafetyFinding(
                photo_id=photo2.id,
                analysis_run_id=run2.id,
                project_id=project_id,
                site_id=site2.id,
                area_id=areas_map["Worli Sea Face Coastal Bridge Viaduct (Pier 14-22)"],
                finding_type="VEST_DETECTED",
                severity="INFO",
                title=f"PPE Compliant: High-vis vest verified (Rigger {i+1})",
                description="Worker wearing reflective high-visibility safety vest on marine bridge gantry.",
                confidence=0.98,
                status="REVIEWED"
            ))

        db.add(models.AISafetyFinding(
            photo_id=photo2.id,
            analysis_run_id=run2.id,
            project_id=project_id,
            site_id=site2.id,
            area_id=areas_map["Worli Sea Face Coastal Bridge Viaduct (Pier 14-22)"],
            finding_type="PERSON_WITHOUT_GLOVES",
            severity="MEDIUM",
            title="PPE Violation: Person handling post-tensioning strands without protective gloves",
            description="Worker handling sharp high-tensile steel tendon wire strands with bare hands.",
            confidence=0.91,
            status="OPEN"
        ))

        # Photo 3: Marine Drive Promenade Deck Concreting
        p3_fn = f"mumbai_coastal_promenade_deck_{project_id}.jpg"
        create_photo_file(p3_fn)
        photo3 = models.SitePhoto(
            project_id=project_id,
            site_id=site1.id,
            area_id=areas_map["Marine Drive Promenade Interchange (Princess St)"],
            uploaded_by=u_sup.id,
            file_name=p3_fn,
            file_path=f"/uploads/photos/{p3_fn}",
            caption="AI Vision Safety Audit: Marine Drive Ramp B Concrete Placement",
            taken_at="2026-09-11 11:00:00",
            latitude=18.9421,
            longitude=72.8229
        )
        db.add(photo3)
        db.flush()

        run3 = models.AIAnalysisRun(
            photo_id=photo3.id,
            model_name="construction-ppe-yolo",
            model_version="v2-yolo11n",
            status="COMPLETED",
            processing_time_ms=1210.0
        )
        db.add(run3)
        db.flush()

        for i in range(7):
            db.add(models.AISafetyFinding(
                photo_id=photo3.id,
                analysis_run_id=run3.id,
                project_id=project_id,
                site_id=site1.id,
                area_id=areas_map["Marine Drive Promenade Interchange (Princess St)"],
                finding_type="HELMET_DETECTED",
                severity="INFO",
                title=f"PPE Compliant: Hard hat and boots verified (Concreter {i+1})",
                description="Worker fully compliant with helmet, high-vis vest and rubber boots during pour.",
                confidence=0.96,
                status="REVIEWED"
            ))

        db.commit()
        print(f"[SUCCESS] Database entities committed successfully for Project ID: {project_id}")

        # ---------------------------------------------------------------------
        # 10. Hybrid RAG Backfill & Risk Evaluation
        # ---------------------------------------------------------------------
        print("[10/10] Evaluating Authoritative Risk Engine & Indexing Hybrid RAG...")
        risk_result = RiskEngine.evaluate_risk(db, project_id)
        print(f"[RISK ENGINE] Score: {risk_result.get('score')}/100 | Level: {risk_result.get('level')} | Confidence: {risk_result.get('confidence')}")

        rag_count = RAGIndexer.index_project_backfill(db, project_id)
        print(f"[HYBRID RAG] Indexed {rag_count} knowledge records into pgvector table for Project {project_id}!")

        print("\n================================================================")
        print(f"🎉 PROJECT SEEDING COMPLETE!")
        print(f"   Project Name: {project_name}")
        print(f"   Project ID:   {project_id}")
        print(f"   Dashboard:    http://localhost:3000/projects/{project_id}/dashboard")
        print(f"   AI Assistant: http://localhost:3000/projects/{project_id}/assistant")
        print(f"   Incidents:    http://localhost:3000/projects/{project_id}/incidents")
        print(f"   Site Photos:  http://localhost:3000/projects/{project_id}/photos")
        print(f"   Materials:    http://localhost:3000/projects/{project_id}/materials")
        print("================================================================")

        return project_id

    except Exception as e:
        db.rollback()
        print(f"[ERROR] Failed to seed Mumbai Coastal Road Project: {e}")
        import traceback
        traceback.print_exc()
        raise e
    finally:
        db.close()


if __name__ == "__main__":
    new_pid = seed_mumbai_coastal_road()
