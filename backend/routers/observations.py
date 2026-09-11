from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from database import get_db
import models
import schemas
from validators import validate_hierarchy

router = APIRouter(tags=["Observations"])


@router.post("/api/observations", response_model=schemas.ObservationResponse, status_code=status.HTTP_201_CREATED)
def create_observation(observation: schemas.ObservationCreate, db: Session = Depends(get_db)):
    validate_hierarchy(
        db=db,
        project_id=observation.project_id,
        site_id=observation.site_id,
        area_id=observation.area_id,
        user_id=observation.created_by,
        assigned_to=observation.assigned_to
    )

    db_obs = models.Observation(**observation.model_dump())
    db.add(db_obs)
    db.commit()
    db.refresh(db_obs)
    return db_obs


@router.get("/api/projects/{project_id}/observations", response_model=List[schemas.ObservationResponse])
def get_project_observations(project_id: int, db: Session = Depends(get_db)):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Project {project_id} not found")

    return (
        db.query(models.Observation)
        .options(
            joinedload(models.Observation.creator),
            joinedload(models.Observation.assignee),
            joinedload(models.Observation.site),
            joinedload(models.Observation.area)
        )
        .filter(models.Observation.project_id == project_id)
        .order_by(models.Observation.id.desc())
        .all()
    )


@router.get("/api/sites/{site_id}/observations", response_model=List[schemas.ObservationResponse])
def get_site_observations(site_id: int, db: Session = Depends(get_db)):
    site = db.query(models.Site).filter(models.Site.id == site_id).first()
    if not site:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Site {site_id} not found")

    return (
        db.query(models.Observation)
        .options(
            joinedload(models.Observation.creator),
            joinedload(models.Observation.assignee),
            joinedload(models.Observation.site),
            joinedload(models.Observation.area)
        )
        .filter(models.Observation.site_id == site_id)
        .order_by(models.Observation.id.desc())
        .all()
    )


@router.get("/api/observations/{observation_id}", response_model=schemas.ObservationResponse)
def get_observation(observation_id: int, db: Session = Depends(get_db)):
    obs = (
        db.query(models.Observation)
        .options(
            joinedload(models.Observation.creator),
            joinedload(models.Observation.assignee),
            joinedload(models.Observation.site),
            joinedload(models.Observation.area)
        )
        .filter(models.Observation.id == observation_id)
        .first()
    )
    if not obs:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Observation {observation_id} not found")
    return obs


@router.put("/api/observations/{observation_id}", response_model=schemas.ObservationResponse)
def update_observation(observation_id: int, update_data: schemas.ObservationUpdate, db: Session = Depends(get_db)):
    db_obs = db.query(models.Observation).filter(models.Observation.id == observation_id).first()
    if not db_obs:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Observation {observation_id} not found")

    if update_data.area_id is not None:
        area = db.query(models.Area).filter(models.Area.id == update_data.area_id).first()
        if not area:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Area {update_data.area_id} not found")
        if area.site_id != db_obs.site_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Area {update_data.area_id} does not belong to Site {db_obs.site_id}")

    if update_data.assigned_to is not None:
        assigned_user = db.query(models.User).filter(models.User.id == update_data.assigned_to).first()
        if not assigned_user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Assigned User {update_data.assigned_to} not found")

    data = update_data.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(db_obs, field, value)

    db.commit()
    db.refresh(db_obs)
    return db_obs


@router.delete("/api/observations/{observation_id}", status_code=status.HTTP_200_OK)
def delete_observation(observation_id: int, db: Session = Depends(get_db)):
    obs = db.query(models.Observation).filter(models.Observation.id == observation_id).first()
    if not obs:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Observation {observation_id} not found")

    db.delete(obs)
    db.commit()
    return {"message": f"Observation {observation_id} deleted successfully"}
