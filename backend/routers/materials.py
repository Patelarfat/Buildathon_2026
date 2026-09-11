from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from database import get_db
import models
import schemas
from validators import validate_hierarchy

router = APIRouter(tags=["Materials"])


@router.post("/api/materials", response_model=schemas.MaterialResponse, status_code=status.HTTP_201_CREATED)
def create_material(material: schemas.MaterialCreate, db: Session = Depends(get_db)):
    validate_hierarchy(
        db=db,
        project_id=material.project_id,
        site_id=material.site_id,
        area_id=material.area_id,
        user_id=material.recorded_by
    )

    db_mat = models.Material(**material.model_dump())
    db.add(db_mat)
    db.commit()
    db.refresh(db_mat)
    return db_mat


@router.get("/api/projects/{project_id}/materials", response_model=List[schemas.MaterialResponse])
def get_project_materials(project_id: int, db: Session = Depends(get_db)):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Project {project_id} not found")

    return (
        db.query(models.Material)
        .options(
            joinedload(models.Material.recorder),
            joinedload(models.Material.site),
            joinedload(models.Material.area)
        )
        .filter(models.Material.project_id == project_id)
        .order_by(models.Material.id.desc())
        .all()
    )


@router.get("/api/sites/{site_id}/materials", response_model=List[schemas.MaterialResponse])
def get_site_materials(site_id: int, db: Session = Depends(get_db)):
    site = db.query(models.Site).filter(models.Site.id == site_id).first()
    if not site:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Site {site_id} not found")

    return (
        db.query(models.Material)
        .options(
            joinedload(models.Material.recorder),
            joinedload(models.Material.site),
            joinedload(models.Material.area)
        )
        .filter(models.Material.site_id == site_id)
        .order_by(models.Material.id.desc())
        .all()
    )


@router.get("/api/materials/{material_id}", response_model=schemas.MaterialResponse)
def get_material(material_id: int, db: Session = Depends(get_db)):
    mat = (
        db.query(models.Material)
        .options(
            joinedload(models.Material.recorder),
            joinedload(models.Material.site),
            joinedload(models.Material.area)
        )
        .filter(models.Material.id == material_id)
        .first()
    )
    if not mat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Material {material_id} not found")
    return mat


@router.put("/api/materials/{material_id}", response_model=schemas.MaterialResponse)
def update_material(material_id: int, update_data: schemas.MaterialUpdate, db: Session = Depends(get_db)):
    db_mat = db.query(models.Material).filter(models.Material.id == material_id).first()
    if not db_mat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Material {material_id} not found")

    if update_data.area_id is not None:
        area = db.query(models.Area).filter(models.Area.id == update_data.area_id).first()
        if not area:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Area {update_data.area_id} not found")
        if area.site_id != db_mat.site_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Area {update_data.area_id} does not belong to Site {db_mat.site_id}")

    data = update_data.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(db_mat, field, value)

    db.commit()
    db.refresh(db_mat)
    return db_mat


@router.delete("/api/materials/{material_id}", status_code=status.HTTP_200_OK)
def delete_material(material_id: int, db: Session = Depends(get_db)):
    mat = db.query(models.Material).filter(models.Material.id == material_id).first()
    if not mat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Material {material_id} not found")

    db.delete(mat)
    db.commit()
    return {"message": f"Material {material_id} deleted successfully"}
