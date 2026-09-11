from typing import Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
import models


def validate_hierarchy(
    db: Session,
    project_id: int,
    site_id: int,
    area_id: Optional[int] = None,
    user_id: Optional[int] = None,
    assigned_to: Optional[int] = None,
):
    """
    Validates that:
    1. Project exists.
    2. Site exists and belongs to the Project.
    3. Area (if provided) exists and belongs to the Site.
    4. User (if provided) exists.
    5. Assigned User (if provided) exists.
    """
    # 1. Project check
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with ID {project_id} not found"
        )

    # 2. Site check
    site = db.query(models.Site).filter(models.Site.id == site_id).first()
    if not site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Site with ID {site_id} not found"
        )
    if site.project_id != project_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Site ID {site_id} does not belong to Project ID {project_id}"
        )

    # 3. Area check
    if area_id is not None:
        area = db.query(models.Area).filter(models.Area.id == area_id).first()
        if not area:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Area with ID {area_id} not found"
            )
        if area.site_id != site_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Area ID {area_id} does not belong to Site ID {site_id}"
            )

    # 4. User check
    if user_id is not None:
        user = db.query(models.User).filter(models.User.id == user_id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with ID {user_id} not found"
            )

    # 5. Assigned user check
    if assigned_to is not None:
        assigned_user = db.query(models.User).filter(models.User.id == assigned_to).first()
        if not assigned_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Assigned User with ID {assigned_to} not found"
            )

    return project, site
