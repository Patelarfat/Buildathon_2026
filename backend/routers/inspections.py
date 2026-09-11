from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from database import get_db
import models
import schemas
from validators import validate_hierarchy

router = APIRouter(tags=["Inspections"])


@router.post("/api/inspections", response_model=schemas.InspectionReportResponse, status_code=status.HTTP_201_CREATED)
def create_inspection(inspection: schemas.InspectionReportCreate, db: Session = Depends(get_db)):
    validate_hierarchy(
        db=db,
        project_id=inspection.project_id,
        site_id=inspection.site_id,
        area_id=inspection.area_id,
        user_id=inspection.inspector_id
    )

    db_inspection = models.InspectionReport(**inspection.model_dump())
    db.add(db_inspection)
    db.commit()
    db.refresh(db_inspection)
    return db_inspection


@router.get("/api/projects/{project_id}/inspections", response_model=List[schemas.InspectionReportResponse])
def get_project_inspections(project_id: int, db: Session = Depends(get_db)):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Project {project_id} not found")

    return (
        db.query(models.InspectionReport)
        .options(
            joinedload(models.InspectionReport.inspector),
            joinedload(models.InspectionReport.site),
            joinedload(models.InspectionReport.area)
        )
        .filter(models.InspectionReport.project_id == project_id)
        .order_by(models.InspectionReport.id.desc())
        .all()
    )


@router.get("/api/inspections/{inspection_id}", response_model=schemas.InspectionReportResponse)
def get_inspection(inspection_id: int, db: Session = Depends(get_db)):
    inspection = (
        db.query(models.InspectionReport)
        .options(
            joinedload(models.InspectionReport.inspector),
            joinedload(models.InspectionReport.site),
            joinedload(models.InspectionReport.area)
        )
        .filter(models.InspectionReport.id == inspection_id)
        .first()
    )
    if not inspection:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Inspection report {inspection_id} not found")
    return inspection


@router.put("/api/inspections/{inspection_id}", response_model=schemas.InspectionReportResponse)
def update_inspection(inspection_id: int, update_data: schemas.InspectionReportUpdate, db: Session = Depends(get_db)):
    db_inspection = db.query(models.InspectionReport).filter(models.InspectionReport.id == inspection_id).first()
    if not db_inspection:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Inspection report {inspection_id} not found")

    if update_data.area_id is not None:
        area = db.query(models.Area).filter(models.Area.id == update_data.area_id).first()
        if not area:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Area {update_data.area_id} not found")
        if area.site_id != db_inspection.site_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Area {update_data.area_id} does not belong to Site {db_inspection.site_id}")

    data = update_data.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(db_inspection, field, value)

    db.commit()
    db.refresh(db_inspection)
    return db_inspection


@router.delete("/api/inspections/{inspection_id}", status_code=status.HTTP_200_OK)
def delete_inspection(inspection_id: int, db: Session = Depends(get_db)):
    inspection = db.query(models.InspectionReport).filter(models.InspectionReport.id == inspection_id).first()
    if not inspection:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Inspection report {inspection_id} not found")

    db.delete(inspection)
    db.commit()
    return {"message": f"Inspection report {inspection_id} deleted successfully"}
