import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from database import get_db
import models
import schemas
from services.risk_engine import RiskEngine
from services.recurring_issue_service import RecurringIssueService
from services.trend_service import TrendService
from services.intelligence_service import IntelligenceService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Construction Intelligence Engine (Phase 5)"])


def verify_project_exists(project_id: int, db: Session) -> models.Project:
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with ID {project_id} not found."
        )
    return project


@router.get("/api/projects/{project_id}/intelligence", response_model=schemas.ProjectIntelligenceResponse)
def get_project_intelligence(
    project_id: int,
    days: int = Query(7, ge=1, le=90, description="Time window in days (e.g. 1, 7, 30)"),
    db: Session = Depends(get_db)
):
    """
    Returns full consolidated construction intelligence report for Project Manager.
    Includes project risk, area ranking, recurring issues, trends, safety summary, progress, and operational risk.
    """
    verify_project_exists(project_id, db)
    return IntelligenceService.get_full_project_intelligence(db=db, project_id=project_id, days=days)


@router.get("/api/projects/{project_id}/risk", response_model=schemas.RiskExplanationResponse)
def get_project_risk(
    project_id: int,
    days: int = Query(7, ge=1, le=90),
    site_id: Optional[int] = Query(None),
    area_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Returns explainable 0-100 safety risk score, level, components, confidence rating, and reasons.
    """
    verify_project_exists(project_id, db)
    return RiskEngine.evaluate_risk(
        db=db,
        project_id=project_id,
        site_id=site_id,
        area_id=area_id,
        days=days
    )


@router.get("/api/projects/{project_id}/risk/explanation", response_model=schemas.RiskExplanationResponse)
def get_project_risk_explanation(
    project_id: int,
    days: int = Query(7, ge=1, le=90),
    site_id: Optional[int] = Query(None),
    area_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Returns granular risk explainability breakdown with human-readable rationale.
    """
    verify_project_exists(project_id, db)
    return RiskEngine.evaluate_risk(
        db=db,
        project_id=project_id,
        site_id=site_id,
        area_id=area_id,
        days=days
    )


@router.get("/api/projects/{project_id}/risk/areas", response_model=List[schemas.AreaRiskRankingItem])
def get_area_risk_ranking(
    project_id: int,
    days: int = Query(7, ge=1, le=90),
    db: Session = Depends(get_db)
):
    """
    Returns ranking of all areas under project ordered from highest risk to lowest risk.
    """
    verify_project_exists(project_id, db)
    return IntelligenceService.get_area_risk_ranking(db=db, project_id=project_id, days=days)


@router.get("/api/projects/{project_id}/recurring-issues", response_model=List[schemas.RecurringIssueResponse])
def get_recurring_issues(
    project_id: int,
    days: int = Query(7, ge=1, le=90),
    site_id: Optional[int] = Query(None),
    area_id: Optional[int] = Query(None),
    threshold: int = Query(3, ge=2, le=20),
    db: Session = Depends(get_db)
):
    """
    Detects recurring problems (>= threshold occurrences in same area within time window).
    """
    verify_project_exists(project_id, db)
    return RecurringIssueService.detect_recurring_issues(
        db=db,
        project_id=project_id,
        site_id=site_id,
        area_id=area_id,
        days=days,
        threshold=threshold
    )


@router.get("/api/projects/{project_id}/trends", response_model=schemas.ProjectTrendsResponse)
def get_project_trends(
    project_id: int,
    days: int = Query(7, ge=1, le=90),
    site_id: Optional[int] = Query(None),
    area_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Compares current period vs preceding period to report safety, PPE, incident, and observation trends.
    """
    verify_project_exists(project_id, db)
    return TrendService.calculate_project_trends(
        db=db,
        project_id=project_id,
        site_id=site_id,
        area_id=area_id,
        days=days
    )


@router.get("/api/projects/{project_id}/safety-summary", response_model=schemas.SafetySummaryResponse)
def get_safety_summary(
    project_id: int,
    days: int = Query(7, ge=1, le=90),
    site_id: Optional[int] = Query(None),
    area_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Consolidates AI safety findings vs human safety incidents vs observations and PPE breakdown.
    """
    verify_project_exists(project_id, db)
    return IntelligenceService.get_safety_summary(
        db=db,
        project_id=project_id,
        site_id=site_id,
        area_id=area_id,
        days=days
    )


@router.get("/api/projects/{project_id}/operational-risk", response_model=schemas.OperationalRiskResponse)
def get_operational_risk(
    project_id: int,
    days: int = Query(7, ge=1, le=90),
    site_id: Optional[int] = Query(None),
    area_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Returns operational risks (low stock materials, delivery delays, daily report blockers).
    """
    verify_project_exists(project_id, db)
    return IntelligenceService.get_operational_risk(
        db=db,
        project_id=project_id,
        site_id=site_id,
        area_id=area_id,
        days=days
    )
