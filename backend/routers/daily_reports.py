from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from database import get_db
import models
import schemas
from validators import validate_hierarchy

router = APIRouter(tags=["Daily Reports"])


@router.post("/api/daily-reports", response_model=schemas.DailyReportResponse, status_code=status.HTTP_201_CREATED)
def create_daily_report(report: schemas.DailyReportCreate, db: Session = Depends(get_db)):
    validate_hierarchy(
        db=db,
        project_id=report.project_id,
        site_id=report.site_id,
        area_id=report.area_id,
        user_id=report.reported_by
    )

    db_report = models.DailyReport(**report.model_dump())
    db.add(db_report)
    db.commit()
    db.refresh(db_report)
    return db_report


@router.get("/api/projects/{project_id}/daily-reports", response_model=List[schemas.DailyReportResponse])
def get_project_daily_reports(project_id: int, db: Session = Depends(get_db)):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Project {project_id} not found")

    return (
        db.query(models.DailyReport)
        .options(
            joinedload(models.DailyReport.reporter),
            joinedload(models.DailyReport.site),
            joinedload(models.DailyReport.area)
        )
        .filter(models.DailyReport.project_id == project_id)
        .order_by(models.DailyReport.id.desc())
        .all()
    )


@router.get("/api/daily-reports/{report_id}", response_model=schemas.DailyReportResponse)
def get_daily_report(report_id: int, db: Session = Depends(get_db)):
    report = (
        db.query(models.DailyReport)
        .options(
            joinedload(models.DailyReport.reporter),
            joinedload(models.DailyReport.site),
            joinedload(models.DailyReport.area)
        )
        .filter(models.DailyReport.id == report_id)
        .first()
    )
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Daily report {report_id} not found")
    return report


@router.put("/api/daily-reports/{report_id}", response_model=schemas.DailyReportResponse)
def update_daily_report(report_id: int, update_data: schemas.DailyReportUpdate, db: Session = Depends(get_db)):
    db_report = db.query(models.DailyReport).filter(models.DailyReport.id == report_id).first()
    if not db_report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Daily report {report_id} not found")

    # If area_id is changing, validate it belongs to the report's site
    if update_data.area_id is not None:
        area = db.query(models.Area).filter(models.Area.id == update_data.area_id).first()
        if not area:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Area {update_data.area_id} not found")
        if area.site_id != db_report.site_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Area {update_data.area_id} does not belong to Site {db_report.site_id}")

    data = update_data.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(db_report, field, value)

    db.commit()
    db.refresh(db_report)
    return db_report


@router.delete("/api/daily-reports/{report_id}", status_code=status.HTTP_200_OK)
def delete_daily_report(report_id: int, db: Session = Depends(get_db)):
    report = db.query(models.DailyReport).filter(models.DailyReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Daily report {report_id} not found")

    db.delete(report)
    db.commit()
    return {"message": f"Daily report {report_id} deleted successfully"}
