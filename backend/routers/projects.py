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
