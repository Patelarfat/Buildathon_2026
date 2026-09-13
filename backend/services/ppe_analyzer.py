import logging
from typing import List, Dict, Any, Optional, Tuple

logger = logging.getLogger(__name__)

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


def _box_intersection_ratio(box_a: Tuple[float, float, float, float], box_b: Tuple[float, float, float, float]) -> float:
    """Calculates intersection area over box_b area."""
    ix1 = max(box_a[0], box_b[0])
    iy1 = max(box_a[1], box_b[1])
    ix2 = min(box_a[2], box_b[2])
    iy2 = min(box_a[3], box_b[3])
    
    inter_w = max(0.0, ix2 - ix1)
    inter_h = max(0.0, iy2 - iy1)
    inter_area = inter_w * inter_h
    
    box_b_area = max(1.0, (box_b[2] - box_b[0]) * (box_b[3] - box_b[1]))
    return inter_area / box_b_area


def _is_associated_with_person(ppe_det: Dict[str, Any], person_det: Dict[str, Any]) -> bool:
    """
    Determines if a PPE detection anatomically associates with a detected Person bounding box.
    Uses target anatomical regions:
    - Head/Face (upper 35%): helmet, no_helmet, goggles, no_goggle
    - Torso (middle 20%-70%): vest
    - Hands/Arms (sides/mid-lower): gloves, no_gloves
    - Lower body / feet (bottom 30%): boots, no_boots
    """
    px1 = float(person_det.get("x1", 0))
    py1 = float(person_det.get("y1", 0))
    px2 = float(person_det.get("x2", 0))
    py2 = float(person_det.get("y2", 0))
    
    pw = max(1.0, px2 - px1)
    ph = max(1.0, py2 - py1)
    
    bx1 = float(ppe_det.get("x1", 0))
    by1 = float(ppe_det.get("y1", 0))
    bx2 = float(ppe_det.get("x2", 0))
    by2 = float(ppe_det.get("y2", 0))
    
    ppe_box = (bx1, by1, bx2, by2)
    person_box = (px1, py1, px2, py2)
    
    cx = (bx1 + bx2) / 2.0
    cy = (by1 + by2) / 2.0
    
    # Check general containment in full person box
    is_center_in_person = (px1 <= cx <= px2) and (py1 <= cy <= py2)
    full_overlap = _box_intersection_ratio(person_box, ppe_box)
    
    cls_name = str(ppe_det.get("class_name", "")).lower()
    
    # 1. Head / Face items: helmet, no_helmet, goggles, no_goggle
    if cls_name in ["helmet", "no_helmet", "goggles", "no_goggle"]:
        head_region = (
            px1 - 0.15 * pw,
            py1 - 0.20 * ph,
            px2 + 0.15 * pw,
            py1 + 0.38 * ph
        )
        if (head_region[0] <= cx <= head_region[2]) and (head_region[1] <= cy <= head_region[3]):
            return True
        if _box_intersection_ratio(head_region, ppe_box) >= 0.20:
            return True
        # If center is in upper half of person
        if is_center_in_person and cy <= (py1 + 0.45 * ph):
            return True
        return False
        
    # 2. Torso items: vest
    elif cls_name in ["vest"]:
        torso_region = (
            px1 - 0.10 * pw,
            py1 + 0.15 * ph,
            px2 + 0.10 * pw,
            py1 + 0.75 * ph
        )
        if (torso_region[0] <= cx <= torso_region[2]) and (torso_region[1] <= cy <= torso_region[3]):
            return True
        if _box_intersection_ratio(torso_region, ppe_box) >= 0.20:
            return True
        if is_center_in_person and (py1 + 0.10 * ph <= cy <= py1 + 0.80 * ph):
            return True
        return False
        
    # 3. Hand items: gloves, no_gloves
    elif cls_name in ["gloves", "no_gloves"]:
        hands_region = (
            px1 - 0.25 * pw,
            py1 + 0.30 * ph,
            px2 + 0.25 * pw,
            py1 + 0.90 * ph
        )
        if (hands_region[0] <= cx <= hands_region[2]) and (hands_region[1] <= cy <= hands_region[3]):
            return True
        if _box_intersection_ratio(hands_region, ppe_box) >= 0.15:
            return True
        if is_center_in_person:
            return True
        return False
        
    # 4. Feet items: boots, no_boots
    elif cls_name in ["boots", "no_boots"]:
        boots_region = (
            px1 - 0.15 * pw,
            py1 + 0.60 * ph,
            px2 + 0.15 * pw,
            py2 + 0.15 * ph
        )
        if (boots_region[0] <= cx <= boots_region[2]) and (boots_region[1] <= cy <= boots_region[3]):
            return True
        if _box_intersection_ratio(boots_region, ppe_box) >= 0.20:
            return True
        if is_center_in_person and cy >= (py1 + 0.55 * ph):
            return True
        return False
        
    # 5. none or other detections
    else:
        if is_center_in_person or full_overlap >= 0.25:
            return True
        return False


def _review_findings_for_people(
    detections: List[Dict[str, Any]],
    photo_id: int,
    analysis_run_id: int,
    project_id: int,
    site_id: int,
    area_id: Optional[int],
) -> List[Dict[str, Any]]:
    """Create cautious review findings for PPE that was not positively detected.

    Absence of a model detection is not proof that a worker is missing PPE. The
    resulting finding is deliberately a LOW-severity human-review task, while a
    direct no_* detection remains the only automated violation evidence.
    """
    people = [d for d in detections if str(d.get("class_name", "")).lower() == "person"]
    positive_ppe = [
        d for d in detections
        if str(d.get("class_name", "")).lower() in REQUIRED_PPE_CLASSES
    ]
    direct_negative_dets = [
        d for d in detections
        if str(d.get("class_name", "")).lower().startswith("no_")
    ]
    
    findings: List[Dict[str, Any]] = []

    for worker_number, person in enumerate(people, start=1):
        associated_positive = set()
        associated_negative = set()
        
        # Check associated positive PPE
        for item in positive_ppe:
            if _is_associated_with_person(item, person):
                associated_positive.add(str(item["class_name"]).lower())
                
        # Check associated direct negative PPE
        for item in direct_negative_dets:
            if _is_associated_with_person(item, person):
                associated_negative.add(str(item["class_name"]).lower())

        # Determine missing required PPE for this person
        missing = [ppe for ppe in REQUIRED_PPE_CLASSES if ppe not in associated_positive]
        
        # A direct negative detection already creates an explicit confirmed violation.
        # Do not add a second generic review item for that same PPE category.
        missing = [
            ppe for ppe in missing
            if f"no_{'goggle' if ppe == 'goggles' else ppe}" not in associated_negative
        ]

        review_created = False
        if missing:
            review_created = True
            findings.append({
                "photo_id": photo_id,
                "analysis_run_id": analysis_run_id,
                "project_id": project_id,
                "site_id": site_id,
                "area_id": area_id,
                "finding_type": "PPE_NOT_DETECTED_REVIEW",
                "severity": "LOW",
                "title": f"Worker {worker_number}: PPE review required",
                "description": "Required PPE was not confidently detected for this worker. This is not a confirmed violation; Safety Officer visual verification is required.",
                "confidence": float(person.get("confidence", 0.0)),
                "status": "OPEN",
            })

        logger.info(
            f"PPE REVIEW WORKER DEBUG: worker_number={worker_number}, "
            f"person_bbox=[{person.get('x1')}, {person.get('y1')}, {person.get('x2')}, {person.get('y2')}], "
            f"associated_ppe={sorted(list(associated_positive))}, "
            f"missing_ppe={missing}, "
            f"review_created={review_created}"
        )

    logger.info(
        f"PPE REVIEW DEBUG\n"
        f"person_count={len(people)}\n"
        f"positive_ppe_count={len(positive_ppe)}\n"
        f"direct_negative_count={len(direct_negative_dets)}\n"
        f"review_findings_count={len(findings)}"
    )

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

    findings.extend(_review_findings_for_people(
        detections, photo_id, analysis_run_id, project_id, site_id, area_id
    ))
    return findings
