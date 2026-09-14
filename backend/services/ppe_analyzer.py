from typing import List, Dict, Any, Optional, Tuple
import json

# Official Construction-PPE dataset classes (11 classes):
# 0 helmet, 1 gloves, 2 vest, 3 boots, 4 goggles, 5 none, 6 Person, 7 no_helmet, 8 no_goggle, 9 no_gloves, 10 no_boots

# Deterministic safety finding mappings
# Violation detection rules:
VIOLATION_RULES = {
    "no_helmet": {
        "finding_type": "PERSON_WITHOUT_HELMET",
        "severity": "HIGH",
        "title": "Worker detected without safety helmet",
        "description": "Visual detection identified on-site personnel without required head protection (hard hat)."
    },
    "no_gloves": {
        "finding_type": "PERSON_WITHOUT_GLOVES",
        "severity": "MEDIUM",
        "title": "Worker detected without protective gloves",
        "description": "Visual detection identified on-site personnel without required hand protection."
    },
    "no_boots": {
        "finding_type": "PERSON_WITHOUT_BOOTS",
        "severity": "MEDIUM",
        "title": "Worker detected without safety boots",
        "description": "Visual detection identified on-site personnel without required safety footwear."
    },
    "no_goggle": {
        "finding_type": "PERSON_WITHOUT_GOGGLES",
        "severity": "MEDIUM",
        "title": "Worker detected without safety goggles",
        "description": "Visual detection identified on-site personnel without required eye protection."
    }
}

# Compliant PPE detection rules (for safety audit records):
COMPLIANCE_RULES = {
    "helmet": {
        "finding_type": "HELMET_DETECTED",
        "severity": "INFO",
        "title": "Safety helmet verified",
        "description": "Protective hard hat / helmet verified on personnel."
    },
    "vest": {
        "finding_type": "VEST_DETECTED",
        "severity": "INFO",
        "title": "High-visibility vest verified",
        "description": "High-visibility safety vest verified on personnel."
    },
    "gloves": {
        "finding_type": "GLOVES_DETECTED",
        "severity": "INFO",
        "title": "Protective gloves verified",
        "description": "Protective gloves verified on personnel."
    },
    "boots": {
        "finding_type": "BOOTS_DETECTED",
        "severity": "INFO",
        "title": "Safety boots verified",
        "description": "Safety boots verified on personnel."
    },
    "goggles": {
        "finding_type": "GOGGLES_DETECTED",
        "severity": "INFO",
        "title": "Safety goggles verified",
        "description": "Eye protection goggles verified on personnel."
    }
}


def analyze_detections(
    detections: List[Dict[str, Any]],
    photo_id: int,
    analysis_run_id: int,
    project_id: int,
    site_id: int,
    area_id: Optional[int] = None
) -> List[Dict[str, Any]]:
    """
    Translates raw bounding box detections from YOLO into structured safety findings.
    
    IMPORTANT RULES:
    1. Model Confidence is strictly separated from Safety Severity (Severity is deterministic).
    2. 'no_vest' is NOT supported because the official Ultralytics Construction-PPE dataset
       does not have a no_vest class. We NEVER invent a no_vest class.
    3. AI findings are created with status='OPEN' for human safety officer review.
    """
    findings: List[Dict[str, Any]] = []

    for det in detections:
        class_name = det.get("class_name", "").lower()
        confidence = float(det.get("confidence", 0.0))

        # Check violations first
        if class_name in VIOLATION_RULES:
            rule = VIOLATION_RULES[class_name]
            findings.append({
                "photo_id": photo_id,
                "analysis_run_id": analysis_run_id,
                "project_id": project_id,
                "site_id": site_id,
                "area_id": area_id,
                "finding_type": rule["finding_type"],
                "severity": rule["severity"],
                "title": rule["title"],
                "description": rule["description"],
                "confidence": confidence,
                "status": "OPEN"
            })
        elif class_name in COMPLIANCE_RULES:
            rule = COMPLIANCE_RULES[class_name]
            findings.append({
                "photo_id": photo_id,
                "analysis_run_id": analysis_run_id,
                "project_id": project_id,
                "site_id": site_id,
                "area_id": area_id,
                "finding_type": rule["finding_type"],
                "severity": rule["severity"],
                "title": rule["title"],
                "description": rule["description"],
                "confidence": confidence,
                "status": "OPEN"
            })
        # Note: 'Person' and 'none' classes are kept in detections but don't generate standalone findings.

    return findings


def build_person_ppe_report(detections: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """
    Groups YOLO detections by person and evaluates compliance for each worker.
    
    Returns:
        (people_list, summary_dict)
    """
    person_dets = []
    item_dets = []
    
    for det in detections:
        cls_name = str(det.get("class_name", "")).strip().lower()
        if cls_name in ("person", "worker"):
            person_dets.append(det)
        elif cls_name != "none":
            item_dets.append(det)
            
    # Sort person detections left-to-right by x1 coordinate so Person 1 is leftmost
    person_dets.sort(key=lambda d: d.get("x1", 0.0))
    
    # If no explicit Person box was detected, group item detections into x-center clusters
    if not person_dets and item_dets:
        x_centers = [(d.get("x1", 0) + d.get("x2", 0)) / 2.0 for d in item_dets]
        x_centers.sort()
        clusters = []
        for xc in x_centers:
            if not clusters or (xc - clusters[-1][-1]) > 150:
                clusters.append([xc])
            else:
                clusters[-1].append(xc)
        
        for idx, cl in enumerate(clusters):
            avg_x = sum(cl) / len(cl)
            person_dets.append({
                "class_name": "person",
                "confidence": 0.90,
                "x1": max(0.0, avg_x - 100),
                "y1": 0.0,
                "x2": avg_x + 100,
                "y2": 1000.0
            })

    people: List[Dict[str, Any]] = []
    
    p_info = []
    for idx, p_box in enumerate(person_dets, start=1):
        x1 = float(p_box.get("x1", 0.0))
        y1 = float(p_box.get("y1", 0.0))
        x2 = float(p_box.get("x2", 0.0))
        y2 = float(p_box.get("y2", 0.0))
        width = max(1.0, x2 - x1)
        height = max(1.0, y2 - y1)
        cx = (x1 + x2) / 2.0
        cy = (y1 + y2) / 2.0
        conf = round(float(p_box.get("confidence", 0.90)), 2)
        
        p_info.append({
            "person_id": idx,
            "confidence": conf,
            "x1": x1, "y1": y1, "x2": x2, "y2": y2,
            "cx": cx, "cy": cy,
            "width": width, "height": height,
            "items": {"helmet": [], "vest": [], "gloves": [], "boots": []},
            "negatives": {"no_helmet": False, "no_gloves": False, "no_boots": False}
        })
        
    # Assign each item to the single best matching person
    for item in item_dets:
        cls = str(item.get("class_name", "")).strip().lower()
        ix1 = float(item.get("x1", 0.0))
        iy1 = float(item.get("y1", 0.0))
        ix2 = float(item.get("x2", 0.0))
        iy2 = float(item.get("y2", 0.0))
        icx = (ix1 + ix2) / 2.0
        icy = (iy1 + iy2) / 2.0
        iconf = round(float(item.get("confidence", 0.0)), 2)
        
        if not p_info:
            continue
            
        best_p = None
        best_score = -1.0
        
        for p in p_info:
            margin = p["width"] * 0.40
            if not (p["x1"] - margin <= icx <= p["x2"] + margin):
                continue
                
            dist_x = abs(icx - p["cx"]) / p["width"]
            rel_y = (icy - p["y1"]) / p["height"] if p["height"] > 0 else 0.5
            
            vertical_fit = 1.0
            if cls in ("helmet", "no_helmet") and rel_y > 0.45:
                vertical_fit = 0.5
            elif cls in ("boots", "no_boots") and rel_y < 0.55:
                vertical_fit = 0.5
            elif cls == "vest" and (rel_y < 0.15 or rel_y > 0.85):
                vertical_fit = 0.5
                
            score = (1.0 - dist_x) * vertical_fit
            if score > best_score:
                best_score = score
                best_p = p
                
        if not best_p:
            best_p = min(p_info, key=lambda p: abs(icx - p["cx"]))
            
        if cls == "helmet":
            best_p["items"]["helmet"].append(iconf)
        elif cls == "no_helmet":
            best_p["negatives"]["no_helmet"] = True
        elif cls == "vest":
            best_p["items"]["vest"].append(iconf)
        elif cls == "gloves":
            best_p["items"]["gloves"].append(iconf)
        elif cls == "no_gloves":
            best_p["negatives"]["no_gloves"] = True
        elif cls == "boots":
            best_p["items"]["boots"].append(iconf)
        elif cls == "no_boots":
            best_p["negatives"]["no_boots"] = True

    for p in p_info:
        helmet_det = len(p["items"]["helmet"]) > 0 and not p["negatives"]["no_helmet"]
        helmet_conf = max(p["items"]["helmet"]) if helmet_det else None
        
        vest_det = len(p["items"]["vest"]) > 0
        vest_conf = max(p["items"]["vest"]) if vest_det else None
        
        gloves_det = len(p["items"]["gloves"]) > 0 and not p["negatives"]["no_gloves"]
        gloves_conf = max(p["items"]["gloves"]) if gloves_det else None
        
        boots_det = len(p["items"]["boots"]) > 0 and not p["negatives"]["no_boots"]
        boots_conf = max(p["items"]["boots"]) if boots_det else None
        
        violations = []
        if not helmet_det:
            violations.append("Safety Helmet Missing")
        if not vest_det:
            violations.append("High-Visibility Vest Missing")
        if not gloves_det:
            violations.append("Protective Gloves Missing")
        if not boots_det:
            violations.append("Safety Boots Missing")
            
        compliant = (len(violations) == 0)
        
        people.append({
            "person_id": p["person_id"],
            "confidence": p["confidence"],
            "x1": p["x1"],
            "y1": p["y1"],
            "x2": p["x2"],
            "y2": p["y2"],
            "helmet": {"detected": helmet_det, "confidence": helmet_conf},
            "vest": {"detected": vest_det, "confidence": vest_conf},
            "gloves": {"detected": gloves_det, "confidence": gloves_conf},
            "boots": {"detected": boots_det, "confidence": boots_conf},
            "violations": violations,
            "compliant": compliant
        })
        
    workers_detected = len(people)
    fully_compliant = sum(1 for p in people if p["compliant"])
    workers_with_violations = sum(1 for p in people if not p["compliant"])
    overall_compliance = round((fully_compliant / workers_detected) * 100, 1) if workers_detected > 0 else 100.0
    
    summary = {
        "workers_detected": workers_detected,
        "fully_compliant": fully_compliant,
        "workers_with_violations": workers_with_violations,
        "overall_compliance": overall_compliance
    }
    
    return people, summary


def get_project_ppe_summary(
    db: Any,
    project_id: int,
    site_id: Optional[int] = None,
    area_id: Optional[int] = None
) -> Dict[str, Any]:
    """
    Calculates project-level PPE compliance metrics aggregated across the LATEST
    completed photo analysis runs for all site photos in the project/site/area.
    
    SINGLE SOURCE OF TRUTH for Project Intelligence, AI Findings summary,
    and GenAI Assistant retrieval.
    """
    import models
    
    photo_q = db.query(models.SitePhoto).filter(models.SitePhoto.project_id == project_id)
    if site_id:
        photo_q = photo_q.filter(models.SitePhoto.site_id == site_id)
    if area_id:
        photo_q = photo_q.filter(models.SitePhoto.area_id == area_id)
        
    photos = photo_q.all()
    
    total_photos = len(photos)
    photos_analyzed = 0
    
    total_workers = 0
    total_compliant = 0
    total_violations = 0
    all_people = []
    violations_summary_list = []
    compliance_summary_list = []
    photos_list = []
    
    for photo in photos:
        latest_run = (
            db.query(models.AIAnalysisRun)
            .filter(
                models.AIAnalysisRun.photo_id == photo.id,
                models.AIAnalysisRun.status == "COMPLETED"
            )
            .order_by(models.AIAnalysisRun.id.desc())
            .first()
        )
        
        if not latest_run:
            continue
            
        photos_analyzed += 1
        
        people = []
        summary = None
        
        if getattr(latest_run, "people_json", None) and getattr(latest_run, "summary_json", None):
            try:
                people = json.loads(latest_run.people_json)
                summary = json.loads(latest_run.summary_json)
            except Exception:
                pass
                
        if not people or not summary:
            dets_dicts = [
                {"class_name": d.class_name, "confidence": d.confidence, "x1": d.x1, "y1": d.y1, "x2": d.x2, "y2": d.y2}
                for d in latest_run.detections
            ]
            people, summary = build_person_ppe_report(dets_dicts)

        person_dets = [d for d in (latest_run.detections or []) if d.class_name.lower() in ('person', 'worker')]
        person_dets.sort(key=lambda d: d.x1)
        for idx, p in enumerate(people):
            if "x1" not in p and idx < len(person_dets):
                p["x1"] = person_dets[idx].x1
                p["y1"] = person_dets[idx].y1
                p["x2"] = person_dets[idx].x2
                p["y2"] = person_dets[idx].y2
            
        workers_cnt = summary.get("workers_detected", 0)
        compliant_cnt = summary.get("fully_compliant", 0)
        violating_cnt = summary.get("workers_with_violations", 0)
        
        total_workers += workers_cnt
        total_compliant += compliant_cnt
        total_violations += violating_cnt
        
        for p in people:
            p_copy = dict(p)
            p_copy["photo_id"] = photo.id
            all_people.append(p_copy)
            
            p_id = p.get("person_id")
            if p.get("compliant"):
                compliance_summary_list.append(f"Photo #{photo.id} - Person {p_id}: Fully PPE Compliant")
            else:
                viols = p.get("violations", [])
                viols_str = ", ".join(viols) if viols else "Unspecified PPE Violation"
                violations_summary_list.append(f"Photo #{photo.id} - Person {p_id}: {viols_str}")

        img_url = photo.file_path
        if img_url and not img_url.startswith("/") and not img_url.startswith("http"):
            img_url = "/" + img_url

        viol_counts = {}
        for p in people:
            for v in p.get("violations", []):
                viol_counts[v] = viol_counts.get(v, 0) + 1
        missing_parts = [f"{k}: {v} workers" for k, v in viol_counts.items()]
        missing_summary = ", ".join(missing_parts) if missing_parts else "All workers fully compliant"

        photos_list.append({
            "photo_id": photo.id,
            "title": f"PHOTO #{photo.id}",
            "image_url": img_url,
            "created_at": photo.created_at.strftime("%d %b %Y, %I:%M %p") if photo.created_at else None,
            "workers_count": workers_cnt,
            "compliant_count": compliant_cnt,
            "violations_count": violating_cnt,
            "compliance_pct": summary.get("overall_compliance", 100.0 if workers_cnt == 0 else round((compliant_cnt / max(1, workers_cnt)) * 100, 1)),
            "missing_summary": missing_summary,
            "people": people,
            "detections": [
                {
                    "class_name": d.class_name,
                    "confidence": d.confidence,
                    "x1": d.x1,
                    "y1": d.y1,
                    "x2": d.x2,
                    "y2": d.y2
                } for d in latest_run.detections
            ] if hasattr(latest_run, "detections") and latest_run.detections else []
        })

    overall_compliance = round((total_compliant / total_workers * 100), 1) if total_workers > 0 else 100.0

    return {
        "project_id": project_id,
        "site_id": site_id,
        "area_id": area_id,
        "total_photos": total_photos,
        "photos_analyzed": photos_analyzed,
        "workers_detected": total_workers,
        "fully_compliant": total_compliant,
        "workers_with_violations": total_violations,
        "overall_compliance": overall_compliance,
        "violations_list": violations_summary_list,
        "compliance_list": compliance_summary_list,
        "people": all_people,
        "photos": photos_list
    }

