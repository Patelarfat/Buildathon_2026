from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from database import get_db
import models
import schemas

router = APIRouter(prefix="/api/sites", tags=["Sites"])


@router.get("/{site_id}", response_model=schemas.SiteDetailResponse)
def get_site(site_id: int, db: Session = Depends(get_db)):
    site = (
        db.query(models.Site)
        .options(joinedload(models.Site.areas))
        .filter(models.Site.id == site_id)
        .first()
    )
    if not site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Site with ID {site_id} not found"
        )
    return site


@router.put("/{site_id}", response_model=schemas.SiteResponse)
def update_site(site_id: int, site_update: schemas.SiteUpdate, db: Session = Depends(get_db)):
    db_site = db.query(models.Site).filter(models.Site.id == site_id).first()
    if not db_site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Site with ID {site_id} not found"
        )

    update_data = site_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_site, field, value)

    db.commit()
    db.refresh(db_site)
    return db_site


@router.delete("/{site_id}", status_code=status.HTTP_200_OK)
def delete_site(site_id: int, db: Session = Depends(get_db)):
    db_site = db.query(models.Site).filter(models.Site.id == site_id).first()
    if not db_site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Site with ID {site_id} not found"
        )

    db.delete(db_site)
    db.commit()
    return {"message": f"Site {site_id} deleted successfully"}


# --- Sub-endpoints: Areas under Site ---

@router.post("/{site_id}/areas", response_model=schemas.AreaResponse, status_code=status.HTTP_201_CREATED)
def create_area_for_site(site_id: int, area: schemas.AreaCreate, db: Session = Depends(get_db)):
    db_site = db.query(models.Site).filter(models.Site.id == site_id).first()
    if not db_site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Site with ID {site_id} not found"
        )

    db_area = models.Area(site_id=site_id, **area.model_dump())
    db.add(db_area)
    db.commit()
    db.refresh(db_area)
    return db_area


@router.get("/{site_id}/areas", response_model=List[schemas.AreaResponse])
def get_areas_for_site(site_id: int, db: Session = Depends(get_db)):
    db_site = db.query(models.Site).filter(models.Site.id == site_id).first()
    if not db_site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Site with ID {site_id} not found"
        )

    return (
        db.query(models.Area)
        .filter(models.Area.site_id == site_id)
        .order_by(models.Area.id.asc())
        .all()
    )
