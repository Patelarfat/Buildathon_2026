from typing import List, Dict, Any, Optional

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

REQUIRED_PPE_CLASSES = ("helmet", "vest", "gloves", "boots", "goggles")


def _contains_point(det: Dict[str, Any], x: float, y: float) -> bool:
    """Whether a PPE detection's centre lies within a person's bounding box."""
    return (
        float(det.get("x1", 0)) <= x <= float(det.get("x2", 0))
        and float(det.get("y1", 0)) <= y <= float(det.get("y2", 0))
    )


def _review_findings_for_people(
    detections: List[Dict[str, Any]],
    photo_id: int,
    analysis_run_id: int,
    project_id: int,
    site_id: int,
    area_id: Optional[int],
) -> List[Dict[str, Any]]:
    """Create cautious review findings for PPE that was not positively detected.

    Absence of a model detection is not proof that a worker is missing PPE.  The
    resulting finding is deliberately a LOW-severity human-review task, while a
    direct ``no_*`` detection remains the only automated violation evidence.
    """
    people = [d for d in detections if str(d.get("class_name", "")).lower() == "person"]
    positive_ppe = [
        d for d in detections
        if str(d.get("class_name", "")).lower() in REQUIRED_PPE_CLASSES
    ]
    direct_negative_classes = {
        str(d.get("class_name", "")).lower() for d in detections
        if str(d.get("class_name", "")).lower().startswith("no_")
    }
    findings: List[Dict[str, Any]] = []

    for worker_number, person in enumerate(people, start=1):
        associated_classes = set()
        for item in positive_ppe:
            centre_x = (float(item["x1"]) + float(item["x2"])) / 2
            centre_y = (float(item["y1"]) + float(item["y2"])) / 2
            if _contains_point(person, centre_x, centre_y):
                associated_classes.add(str(item["class_name"]).lower())

        missing = [ppe for ppe in REQUIRED_PPE_CLASSES if ppe not in associated_classes]
        # A direct negative detection already creates an explicit violation.
        # Do not add a second generic review item for that same PPE category.
        missing = [
            ppe for ppe in missing
            if f"no_{'goggle' if ppe == 'goggles' else ppe}" not in direct_negative_classes
        ]
        if not missing:
            continue

        findings.append({
            "photo_id": photo_id,
            "analysis_run_id": analysis_run_id,
            "project_id": project_id,
            "site_id": site_id,
            "area_id": area_id,
            "finding_type": "PPE_NOT_DETECTED_REVIEW",
            "severity": "LOW",
            "title": f"Worker {worker_number}: PPE review required",
            "description": (
                f"{', '.join(missing)} not detected for this person. This is not "
                "a confirmed violation; verify PPE visually before taking action."
            ),
            "confidence": float(person.get("confidence", 0.0)),
            "status": "OPEN",
        })
    return findings


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

    findings.extend(_review_findings_for_people(
        detections, photo_id, analysis_run_id, project_id, site_id, area_id
    ))
    return findings
