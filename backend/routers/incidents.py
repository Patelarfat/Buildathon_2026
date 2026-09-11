from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from database import get_db
import models
import schemas
from validators import validate_hierarchy

router = APIRouter(tags=["Safety Incidents"])


@router.post("/api/incidents", response_model=schemas.SafetyIncidentResponse, status_code=status.HTTP_201_CREATED)
def create_incident(incident: schemas.SafetyIncidentCreate, db: Session = Depends(get_db)):
    validate_hierarchy(
        db=db,
        project_id=incident.project_id,
        site_id=incident.site_id,
        area_id=incident.area_id,
        user_id=incident.reported_by
    )

    db_incident = models.SafetyIncident(**incident.model_dump())
    db.add(db_incident)
    db.commit()
    db.refresh(db_incident)
    return db_incident


@router.get("/api/projects/{project_id}/incidents", response_model=List[schemas.SafetyIncidentResponse])
def get_project_incidents(project_id: int, db: Session = Depends(get_db)):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Project {project_id} not found")

    return (
        db.query(models.SafetyIncident)
        .options(
            joinedload(models.SafetyIncident.reporter),
            joinedload(models.SafetyIncident.site),
            joinedload(models.SafetyIncident.area)
        )
        .filter(models.SafetyIncident.project_id == project_id)
        .order_by(models.SafetyIncident.id.desc())
        .all()
    )


@router.get("/api/sites/{site_id}/incidents", response_model=List[schemas.SafetyIncidentResponse])
def get_site_incidents(site_id: int, db: Session = Depends(get_db)):
    site = db.query(models.Site).filter(models.Site.id == site_id).first()
    if not site:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Site {site_id} not found")

    return (
        db.query(models.SafetyIncident)
        .options(
            joinedload(models.SafetyIncident.reporter),
            joinedload(models.SafetyIncident.site),
            joinedload(models.SafetyIncident.area)
        )
        .filter(models.SafetyIncident.site_id == site_id)
        .order_by(models.SafetyIncident.id.desc())
        .all()
    )


@router.get("/api/incidents/{incident_id}", response_model=schemas.SafetyIncidentResponse)
def get_incident(incident_id: int, db: Session = Depends(get_db)):
    incident = (
        db.query(models.SafetyIncident)
        .options(
            joinedload(models.SafetyIncident.reporter),
            joinedload(models.SafetyIncident.site),
            joinedload(models.SafetyIncident.area)
        )
        .filter(models.SafetyIncident.id == incident_id)
        .first()
    )
    if not incident:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Safety incident {incident_id} not found")
    return incident


@router.put("/api/incidents/{incident_id}", response_model=schemas.SafetyIncidentResponse)
def update_incident(incident_id: int, update_data: schemas.SafetyIncidentUpdate, db: Session = Depends(get_db)):
    db_incident = db.query(models.SafetyIncident).filter(models.SafetyIncident.id == incident_id).first()
    if not db_incident:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Safety incident {incident_id} not found")

    if update_data.area_id is not None:
        area = db.query(models.Area).filter(models.Area.id == update_data.area_id).first()
        if not area:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Area {update_data.area_id} not found")
        if area.site_id != db_incident.site_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Area {update_data.area_id} does not belong to Site {db_incident.site_id}")

    data = update_data.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(db_incident, field, value)

    db.commit()
    db.refresh(db_incident)
    return db_incident


@router.delete("/api/incidents/{incident_id}", status_code=status.HTTP_200_OK)
def delete_incident(incident_id: int, db: Session = Depends(get_db)):
    incident = db.query(models.SafetyIncident).filter(models.SafetyIncident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Safety incident {incident_id} not found")

    db.delete(incident)
    db.commit()
    return {"message": f"Safety incident {incident_id} deleted successfully"}
