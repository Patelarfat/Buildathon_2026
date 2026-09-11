import os
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func

from database import get_db
import models
import schemas
from services.yolo_service import YOLOService
from services.ppe_analyzer import analyze_detections

logger = logging.getLogger(__name__)

router = APIRouter(tags=["AI Computer Vision & Safety"])

UPLOAD_ROOT = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")


@router.post("/api/photos/{photo_id}/analyze", response_model=schemas.AnalysisResultResponse, status_code=status.HTTP_200_OK)
def analyze_photo(
    photo_id: int,
    force: bool = Query(False, description="Re-run analysis even if completed analysis already exists"),
    confidence: Optional[float] = Query(None, description="Custom confidence threshold override"),
    db: Session = Depends(get_db)
):
    # Clean parameter defaults when called internally vs via route
    force_val = bool(force) if isinstance(force, bool) else False
    conf_val = float(confidence) if isinstance(confidence, (int, float)) else None

    # 1. Verify photo exists
    photo = db.query(models.SitePhoto).filter(models.SitePhoto.id == photo_id).first()
    if not photo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Site photo with ID {photo_id} not found."
        )

    yolo = YOLOService.get_instance()
    model_name = yolo.model_name
    model_version = yolo.model_version

    # 2. Duplicate protection: Check existing completed run
    if not force_val:
        existing_run = (
            db.query(models.AIAnalysisRun)
            .options(
                joinedload(models.AIAnalysisRun.detections),
                joinedload(models.AIAnalysisRun.safety_findings)
            )
            .filter(
                models.AIAnalysisRun.photo_id == photo_id,
                models.AIAnalysisRun.model_version == model_version,
                models.AIAnalysisRun.status == "COMPLETED"
            )
            .order_by(models.AIAnalysisRun.id.desc())
            .first()
        )
        if existing_run:
            return schemas.AnalysisResultResponse(
                photo_id=photo.id,
                analysis_run_id=existing_run.id,
                status=existing_run.status,
                model_name=existing_run.model_name,
                model_version=existing_run.model_version,
                processing_time_ms=existing_run.processing_time_ms,
                detections=existing_run.detections,
                safety_findings=existing_run.safety_findings,
                annotated_image_url=existing_run.annotated_file_path
            )

    # 3. Locate physical image file on disk
    rel_path = photo.file_path.lstrip("/").replace("/", os.sep)
    # Could be in backend/uploads/photos/... or uploads/photos/...
    disk_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), rel_path)
    if not os.path.exists(disk_path):
        # Also check relative to uploads dir directly
        disk_path = os.path.join(UPLOAD_ROOT, os.path.basename(photo.file_path))

    if not os.path.exists(disk_path):
        failed_run = models.AIAnalysisRun(
            photo_id=photo.id,
            model_name=model_name,
            model_version=model_version,
            status="FAILED",
            error_message=f"Image file missing on disk at: {photo.file_path}"
        )
        db.add(failed_run)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Image file not found on server disk at {photo.file_path}"
        )

    # If force re-analysis, clean up old analysis runs for this photo so findings don't duplicate
    if force_val:
        old_runs = db.query(models.AIAnalysisRun).filter(models.AIAnalysisRun.photo_id == photo_id).all()
        for old_run in old_runs:
            if old_run.annotated_file_path:
                ann_file = os.path.basename(old_run.annotated_file_path)
                ann_disk = os.path.join(UPLOAD_ROOT, "ai", ann_file)
                if os.path.exists(ann_disk):
                    try:
                        os.remove(ann_disk)
                    except Exception:
                        pass
            db.delete(old_run)
        db.commit()

    # 4. Create analysis run in PROCESSING status
    analysis_run = models.AIAnalysisRun(
        photo_id=photo.id,
        model_name=model_name,
        model_version=model_version,
        status="PROCESSING"
    )
    db.add(analysis_run)
    db.commit()
    db.refresh(analysis_run)

    # 5. Execute inference & annotation
    try:
        raw_detections, proc_time, annotated_disk, annotated_web = yolo.analyze_image(
            image_path=disk_path,
            confidence_threshold=conf_val
        )
    except Exception as e:
        logger.error(f"AI Inference failed for photo {photo_id}: {e}")
        analysis_run.status = "FAILED"
        analysis_run.error_message = str(e)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI Vision Analysis failed: {str(e)}"
        )

    # 6. Save detections with strict relationship integrity
    db_detections: List[models.AIDetection] = []
    for det in raw_detections:
        db_det = models.AIDetection(
            photo_id=photo.id,
            analysis_run_id=analysis_run.id,
            project_id=photo.project_id,
            site_id=photo.site_id,
            area_id=photo.area_id,
            class_name=det["class_name"],
            confidence=det["confidence"],
            x1=det["x1"],
            y1=det["y1"],
            x2=det["x2"],
            y2=det["y2"]
        )
        db.add(db_det)
        db_detections.append(db_det)

    # 7. Generate safety findings
    raw_findings = analyze_detections(
        detections=raw_detections,
        photo_id=photo.id,
        analysis_run_id=analysis_run.id,
        project_id=photo.project_id,
        site_id=photo.site_id,
        area_id=photo.area_id
    )

    db_findings: List[models.AISafetyFinding] = []
    for f in raw_findings:
        db_finding = models.AISafetyFinding(
            photo_id=f["photo_id"],
            analysis_run_id=f["analysis_run_id"],
            project_id=f["project_id"],
            site_id=f["site_id"],
            area_id=f["area_id"],
            finding_type=f["finding_type"],
            severity=f["severity"],
            title=f["title"],
            description=f["description"],
            confidence=f["confidence"],
            status=f["status"]
        )
        db.add(db_finding)
        db_findings.append(db_finding)

    # 8. Mark analysis COMPLETED
    analysis_run.status = "COMPLETED"
    analysis_run.processing_time_ms = proc_time
    analysis_run.annotated_file_path = annotated_web
    db.commit()
    db.refresh(analysis_run)

    return schemas.AnalysisResultResponse(
        photo_id=photo.id,
        analysis_run_id=analysis_run.id,
        status=analysis_run.status,
        model_name=analysis_run.model_name,
        model_version=analysis_run.model_version,
        processing_time_ms=analysis_run.processing_time_ms,
        detections=db_detections,
        safety_findings=db_findings,
        annotated_image_url=analysis_run.annotated_file_path
    )


@router.get("/api/photos/{photo_id}/analysis", response_model=schemas.AIAnalysisRunResponse)
def get_photo_analysis(photo_id: int, db: Session = Depends(get_db)):
    photo = db.query(models.SitePhoto).filter(models.SitePhoto.id == photo_id).first()
    if not photo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Photo {photo_id} not found")

    run = (
        db.query(models.AIAnalysisRun)
        .options(
            joinedload(models.AIAnalysisRun.detections),
            joinedload(models.AIAnalysisRun.safety_findings)
        )
        .filter(models.AIAnalysisRun.photo_id == photo_id)
        .order_by(models.AIAnalysisRun.id.desc())
        .first()
    )
    if not run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No AI analysis found for photo {photo_id}"
        )
    return run


@router.get("/api/photos/{photo_id}/detections", response_model=List[schemas.AIDetectionResponse])
def get_photo_detections(photo_id: int, db: Session = Depends(get_db)):
    photo = db.query(models.SitePhoto).filter(models.SitePhoto.id == photo_id).first()
    if not photo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Photo {photo_id} not found")

    return (
        db.query(models.AIDetection)
        .filter(models.AIDetection.photo_id == photo_id)
        .order_by(models.AIDetection.id.asc())
        .all()
    )


@router.get("/api/projects/{project_id}/ai-findings", response_model=List[schemas.AISafetyFindingResponse])
def get_project_ai_findings(
    project_id: int,
    site_id: Optional[int] = Query(None),
    area_id: Optional[int] = Query(None),
    severity: Optional[str] = Query(None),
    finding_type: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db)
):
    query = db.query(models.AISafetyFinding).filter(models.AISafetyFinding.project_id == project_id)

    if site_id:
        query = query.filter(models.AISafetyFinding.site_id == site_id)
    if area_id:
        query = query.filter(models.AISafetyFinding.area_id == area_id)
    if severity:
        query = query.filter(models.AISafetyFinding.severity == severity.upper())
    if finding_type:
        query = query.filter(models.AISafetyFinding.finding_type == finding_type)
    if status_filter:
        query = query.filter(models.AISafetyFinding.status == status_filter.upper())

    return query.order_by(models.AISafetyFinding.id.desc()).all()


@router.get("/api/projects/{project_id}/ai-summary", response_model=schemas.AISummaryResponse)
def get_project_ai_summary(project_id: int, db: Session = Depends(get_db)):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Project {project_id} not found")

    total_photos = db.query(models.SitePhoto).filter(models.SitePhoto.project_id == project_id).count()

    photos_analyzed = (
        db.query(func.count(func.distinct(models.AIAnalysisRun.photo_id)))
        .join(models.SitePhoto, models.AIAnalysisRun.photo_id == models.SitePhoto.id)
        .filter(models.SitePhoto.project_id == project_id, models.AIAnalysisRun.status == "COMPLETED")
        .scalar()
        or 0
    )

    findings = db.query(models.AISafetyFinding).filter(models.AISafetyFinding.project_id == project_id).all()
    total_findings = len(findings)
    open_findings = sum(1 for f in findings if f.status == "OPEN")
    high_sev = sum(1 for f in findings if f.severity == "HIGH")
    med_sev = sum(1 for f in findings if f.severity == "MEDIUM")
    low_sev = sum(1 for f in findings if f.severity in ("LOW", "INFO"))
    resolved = sum(1 for f in findings if f.status == "RESOLVED")
    false_pos = sum(1 for f in findings if f.status == "FALSE_POSITIVE")

    return schemas.AISummaryResponse(
        project_id=project_id,
        total_photos=total_photos,
        photos_analyzed=photos_analyzed,
        total_findings=total_findings,
        open_findings=open_findings,
        high_severity=high_sev,
        medium_severity=med_sev,
        low_severity=low_sev,
        resolved_findings=resolved,
        false_positive_findings=false_pos
    )


@router.patch("/api/ai-findings/{finding_id}", response_model=schemas.AISafetyFindingResponse)
def update_ai_finding_status(
    finding_id: int,
    payload: schemas.AISafetyFindingUpdate,
    db: Session = Depends(get_db)
):
    finding = db.query(models.AISafetyFinding).filter(models.AISafetyFinding.id == finding_id).first()
    if not finding:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"AI Safety finding {finding_id} not found"
        )

    finding.status = payload.status
    db.commit()
    db.refresh(finding)
    return finding


@router.post("/api/projects/{project_id}/ai/analyze-pending", response_model=schemas.BulkAnalysisResponse)
def bulk_analyze_pending_photos(
    project_id: int,
    limit: int = Query(20, ge=1, le=20),
    db: Session = Depends(get_db)
):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Project {project_id} not found")

    yolo = YOLOService.get_instance()
    version = yolo.model_version

    # Find photos that have no completed run with current version
    analyzed_photo_ids = (
        db.query(models.AIAnalysisRun.photo_id)
        .join(models.SitePhoto, models.AIAnalysisRun.photo_id == models.SitePhoto.id)
        .filter(
            models.SitePhoto.project_id == project_id,
            models.AIAnalysisRun.model_version == version,
            models.AIAnalysisRun.status == "COMPLETED"
        )
        .all()
    )
    analyzed_ids_set = {r[0] for r in analyzed_photo_ids}

    pending_photos = (
        db.query(models.SitePhoto)
        .filter(models.SitePhoto.project_id == project_id)
        .order_by(models.SitePhoto.id.desc())
        .all()
    )
    pending_to_process = [p for p in pending_photos if p.id not in analyzed_ids_set][:limit]

    successful = 0
    failed = 0
    results: List[schemas.AnalysisResultResponse] = []

    for photo in pending_to_process:
        try:
            res = analyze_photo(photo_id=photo.id, force=False, db=db)
            results.append(res)
            successful += 1
        except Exception as e:
            logger.error(f"Bulk analysis failed for photo {photo.id}: {e}")
            failed += 1

    return schemas.BulkAnalysisResponse(
        project_id=project_id,
        total=len(pending_photos),
        processed=len(pending_to_process),
        successful=successful,
        failed=failed,
        runs=results
    )
