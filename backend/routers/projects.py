from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import IntegrityError

from database import get_db
import models
import schemas

router = APIRouter(prefix="/api/projects", tags=["Projects"])


@router.post("", response_model=schemas.ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(project: schemas.ProjectCreate, db: Session = Depends(get_db)):
    db_project = models.Project(**project.model_dump())
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    return db_project


@router.get("", response_model=List[schemas.ProjectResponse])
def get_projects(db: Session = Depends(get_db)):
    return db.query(models.Project).order_by(models.Project.id.desc()).all()


@router.get("/{project_id}", response_model=schemas.ProjectDetailResponse)
def get_project(project_id: int, db: Session = Depends(get_db)):
    project = (
        db.query(models.Project)
        .options(
            joinedload(models.Project.sites).joinedload(models.Site.areas),
            joinedload(models.Project.members).joinedload(models.ProjectMember.user)
        )
        .filter(models.Project.id == project_id)
        .first()
    )
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with ID {project_id} not found"
        )
    return project


@router.put("/{project_id}", response_model=schemas.ProjectResponse)
def update_project(project_id: int, project_update: schemas.ProjectUpdate, db: Session = Depends(get_db)):
    db_project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not db_project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with ID {project_id} not found"
        )

    update_data = project_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_project, field, value)

    db.commit()
    db.refresh(db_project)
    return db_project


@router.delete("/{project_id}", status_code=status.HTTP_200_OK)
def delete_project(project_id: int, db: Session = Depends(get_db)):
    db_project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not db_project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with ID {project_id} not found"
        )

    db.delete(db_project)
    db.commit()
    return {"message": f"Project {project_id} deleted successfully"}


# --- Sub-endpoints: Sites under Project ---

@router.post("/{project_id}/sites", response_model=schemas.SiteResponse, status_code=status.HTTP_201_CREATED)
def create_site_for_project(project_id: int, site: schemas.SiteCreate, db: Session = Depends(get_db)):
    db_project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not db_project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with ID {project_id} not found"
        )

    db_site = models.Site(project_id=project_id, **site.model_dump())
    db.add(db_site)
    db.commit()
    db.refresh(db_site)
    return db_site


@router.get("/{project_id}/sites", response_model=List[schemas.SiteDetailResponse])
def get_sites_for_project(project_id: int, db: Session = Depends(get_db)):
    db_project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not db_project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with ID {project_id} not found"
        )

    return (
        db.query(models.Site)
        .options(joinedload(models.Site.areas))
        .filter(models.Site.project_id == project_id)
        .order_by(models.Site.id.asc())
        .all()
    )


# --- Sub-endpoints: Members under Project ---

@router.post("/{project_id}/members", response_model=schemas.ProjectMemberResponse, status_code=status.HTTP_201_CREATED)
def add_project_member(project_id: int, member: schemas.ProjectMemberCreate, db: Session = Depends(get_db)):
    # Check project exists
    db_project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not db_project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with ID {project_id} not found"
        )

    # Check user exists
    db_user = db.query(models.User).filter(models.User.id == member.user_id).first()
    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {member.user_id} not found"
        )

    # Check duplicate membership
    existing = db.query(models.ProjectMember).filter(
        models.ProjectMember.project_id == project_id,
        models.ProjectMember.user_id == member.user_id
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"User {member.user_id} is already a member of Project {project_id}"
        )

    db_member = models.ProjectMember(
        project_id=project_id,
        user_id=member.user_id,
        role=member.role
    )
    db.add(db_member)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Duplicate project membership"
        )

    db.refresh(db_member)
    return db_member


@router.get("/{project_id}/members", response_model=List[schemas.ProjectMemberResponse])
def get_project_members(project_id: int, db: Session = Depends(get_db)):
    db_project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not db_project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with ID {project_id} not found"
        )

    return (
        db.query(models.ProjectMember)
        .options(joinedload(models.ProjectMember.user))
        .filter(models.ProjectMember.project_id == project_id)
        .all()
    )


@router.put("/{project_id}/members/{user_id}", response_model=schemas.ProjectMemberResponse)
def update_project_member_role(
    project_id: int,
    user_id: int,
    member_update: schemas.ProjectMemberUpdate,
    db: Session = Depends(get_db)
):
    db_member = db.query(models.ProjectMember).filter(
        models.ProjectMember.project_id == project_id,
        models.ProjectMember.user_id == user_id
    ).first()

    if not db_member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User {user_id} is not a member of Project {project_id}"
        )

    db_member.role = member_update.role
    db.commit()
    db.refresh(db_member)
    return db_member


@router.delete("/{project_id}/members/{user_id}", status_code=status.HTTP_200_OK)
def remove_project_member(project_id: int, user_id: int, db: Session = Depends(get_db)):
    db_member = db.query(models.ProjectMember).filter(
        models.ProjectMember.project_id == project_id,
        models.ProjectMember.user_id == user_id
    ).first()

    if not db_member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User {user_id} is not a member of Project {project_id}"
        )

    db.delete(db_member)
    db.commit()
    return {"message": f"User {user_id} removed from Project {project_id}"}


# --- Unified Project Activity Feed (Phase 3) ---

@router.get("/{project_id}/activity", response_model=List[schemas.ActivityItemResponse])
def get_project_activity(project_id: int, db: Session = Depends(get_db)):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Project {project_id} not found")

    activities = []

    # 1. Photos
    photos = db.query(models.SitePhoto).options(
        joinedload(models.SitePhoto.site),
        joinedload(models.SitePhoto.area),
        joinedload(models.SitePhoto.uploader)
    ).filter(models.SitePhoto.project_id == project_id).all()
    for p in photos:
        activities.append(schemas.ActivityItemResponse(
            id=p.id,
            type="PHOTO",
            title=p.caption or p.file_name,
            description=p.caption,
            status=None,
            severity_or_priority=None,
            site_name=p.site.name if p.site else None,
            area_name=p.area.name if p.area else None,
            user_name=p.uploader.name if p.uploader else None,
            date=p.taken_at or p.created_at.strftime("%Y-%m-%d"),
            created_at=p.created_at
        ))

    # 2. Daily Reports
    reports = db.query(models.DailyReport).options(
        joinedload(models.DailyReport.site),
        joinedload(models.DailyReport.area),
        joinedload(models.DailyReport.reporter)
    ).filter(models.DailyReport.project_id == project_id).all()
    for r in reports:
        activities.append(schemas.ActivityItemResponse(
            id=r.id,
            type="REPORT",
            title=f"Daily Report ({r.report_date})",
            description=r.work_completed or r.notes,
            status=f"{r.progress_percentage}%" if r.progress_percentage is not None else None,
            severity_or_priority=None,
            site_name=r.site.name if r.site else None,
            area_name=r.area.name if r.area else None,
            user_name=r.reporter.name if r.reporter else None,
            date=r.report_date,
            created_at=r.created_at
        ))

    # 3. Incidents
    incidents = db.query(models.SafetyIncident).options(
        joinedload(models.SafetyIncident.site),
        joinedload(models.SafetyIncident.area),
        joinedload(models.SafetyIncident.reporter)
    ).filter(models.SafetyIncident.project_id == project_id).all()
    for inc in incidents:
        activities.append(schemas.ActivityItemResponse(
            id=inc.id,
            type="INCIDENT",
            title=f"{inc.incident_type.replace('_', ' ').title()} Incident",
            description=inc.description,
            status=inc.status,
            severity_or_priority=inc.severity,
            site_name=inc.site.name if inc.site else None,
            area_name=inc.area.name if inc.area else None,
            user_name=inc.reporter.name if inc.reporter else None,
            date=inc.incident_date,
            created_at=inc.created_at
        ))

    # 4. Inspections
    inspections = db.query(models.InspectionReport).options(
        joinedload(models.InspectionReport.site),
        joinedload(models.InspectionReport.area),
        joinedload(models.InspectionReport.inspector)
    ).filter(models.InspectionReport.project_id == project_id).all()
    for insp in inspections:
        activities.append(schemas.ActivityItemResponse(
            id=insp.id,
            type="INSPECTION",
            title=f"{insp.inspection_type.title()} Inspection",
            description=insp.findings or insp.notes,
            status=insp.status,
            severity_or_priority=None,
            site_name=insp.site.name if insp.site else None,
            area_name=insp.area.name if insp.area else None,
            user_name=insp.inspector.name if insp.inspector else None,
            date=insp.inspection_date,
            created_at=insp.created_at
        ))

    # 5. Observations
    observations = db.query(models.Observation).options(
        joinedload(models.Observation.site),
        joinedload(models.Observation.area),
        joinedload(models.Observation.creator)
    ).filter(models.Observation.project_id == project_id).all()
    for obs in observations:
        activities.append(schemas.ActivityItemResponse(
            id=obs.id,
            type="OBSERVATION",
            title=obs.title,
            description=obs.description,
            status=obs.status,
            severity_or_priority=obs.priority,
            site_name=obs.site.name if obs.site else None,
            area_name=obs.area.name if obs.area else None,
            user_name=obs.creator.name if obs.creator else None,
            date=obs.observed_at or obs.created_at.strftime("%Y-%m-%d"),
            created_at=obs.created_at
        ))

    # 6. Materials
    materials = db.query(models.Material).options(
        joinedload(models.Material.site),
        joinedload(models.Material.area),
        joinedload(models.Material.recorder)
    ).filter(models.Material.project_id == project_id).all()
    for m in materials:
        activities.append(schemas.ActivityItemResponse(
            id=m.id,
            type="MATERIAL",
            title=f"{m.material_name} ({m.quantity} {m.unit})",
            description=m.notes or f"Supplier: {m.supplier or 'N/A'}",
            status=m.status,
            severity_or_priority=None,
            site_name=m.site.name if m.site else None,
            area_name=m.area.name if m.area else None,
            user_name=m.recorder.name if m.recorder else None,
            date=m.delivery_date or m.created_at.strftime("%Y-%m-%d"),
            created_at=m.created_at
        ))

    # Sort all by created_at descending
    activities.sort(key=lambda x: x.created_at, reverse=True)
    return activities

