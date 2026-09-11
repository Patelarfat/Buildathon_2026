import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from database import get_db
import models
import schemas
from services.dashboard_service import DashboardService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Manager Decision Center (Phase 6)"])


@router.get("/api/projects/{project_id}/dashboard", response_model=schemas.ManagerDashboardResponse)
def get_manager_dashboard(
    project_id: int,
    days: int = Query(7, ge=1, le=90, description="Time window in days (1, 7, 30)"),
    site_id: Optional[int] = Query(None, description="Optional site filter"),
    area_id: Optional[int] = Query(None, description="Optional area filter"),
    db: Session = Depends(get_db)
):
    """
    Manager Decision Center Master Endpoint.
    Returns complete, consolidated dashboard payload for a project manager in a single round-trip.
    """
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with ID {project_id} not found."
        )

    dashboard_data = DashboardService.get_manager_dashboard(
        db=db,
        project_id=project_id,
        days=days,
        site_id=site_id,
        area_id=area_id
    )

    if not dashboard_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Unable to generate dashboard for project {project_id}"
        )

    return dashboard_data
