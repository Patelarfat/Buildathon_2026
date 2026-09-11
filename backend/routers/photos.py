import os
import uuid
import shutil
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session, joinedload

from database import get_db
import models
import schemas
from validators import validate_hierarchy

router = APIRouter(tags=["Site Photos"])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads", "photos")
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
MAX_FILE_SIZE = 25 * 1024 * 1024  # 25 MB


@router.post("/api/photos", response_model=schemas.SitePhotoResponse, status_code=status.HTTP_201_CREATED)
async def upload_photo(
    file: UploadFile = File(...),
    project_id: int = Form(...),
    site_id: int = Form(...),
    area_id: Optional[int] = Form(None),
    uploaded_by: int = Form(...),
    caption: Optional[str] = Form(None),
    taken_at: Optional[str] = Form(None),
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
    db: Session = Depends(get_db)
):
    # Validate file extension
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type '{ext}'. Allowed extensions: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )

    # Validate relationships & hierarchy
    validate_hierarchy(
        db=db,
        project_id=project_id,
        site_id=site_id,
        area_id=area_id,
        user_id=uploaded_by
    )

    # Generate safe unique filename
    safe_filename = f"{uuid.uuid4().hex}{ext}"
    dest_path = os.path.join(UPLOAD_DIR, safe_filename)

    # Save file to disk
    try:
        with open(dest_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save file: {str(e)}"
        )

    # Web-accessible path
    web_path = f"/uploads/photos/{safe_filename}"

    db_photo = models.SitePhoto(
        project_id=project_id,
        site_id=site_id,
        area_id=area_id,
        uploaded_by=uploaded_by,
        file_name=file.filename or safe_filename,
        file_path=web_path,
        caption=caption,
        taken_at=taken_at,
        latitude=latitude,
        longitude=longitude
    )
    db.add(db_photo)
    db.commit()
    db.refresh(db_photo)
    return db_photo


@router.get("/api/projects/{project_id}/photos", response_model=List[schemas.SitePhotoResponse])
def get_project_photos(project_id: int, db: Session = Depends(get_db)):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Project {project_id} not found")

    return (
        db.query(models.SitePhoto)
        .options(
            joinedload(models.SitePhoto.uploader),
            joinedload(models.SitePhoto.site),
            joinedload(models.SitePhoto.area)
        )
        .filter(models.SitePhoto.project_id == project_id)
        .order_by(models.SitePhoto.id.desc())
        .all()
    )


@router.get("/api/sites/{site_id}/photos", response_model=List[schemas.SitePhotoResponse])
def get_site_photos(site_id: int, db: Session = Depends(get_db)):
    site = db.query(models.Site).filter(models.Site.id == site_id).first()
    if not site:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Site {site_id} not found")

    return (
        db.query(models.SitePhoto)
        .options(
            joinedload(models.SitePhoto.uploader),
            joinedload(models.SitePhoto.site),
            joinedload(models.SitePhoto.area)
        )
        .filter(models.SitePhoto.site_id == site_id)
        .order_by(models.SitePhoto.id.desc())
        .all()
    )


@router.get("/api/photos/{photo_id}", response_model=schemas.SitePhotoResponse)
def get_photo(photo_id: int, db: Session = Depends(get_db)):
    photo = (
        db.query(models.SitePhoto)
        .options(
            joinedload(models.SitePhoto.uploader),
            joinedload(models.SitePhoto.site),
            joinedload(models.SitePhoto.area)
        )
        .filter(models.SitePhoto.id == photo_id)
        .first()
    )
    if not photo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Photo {photo_id} not found")
    return photo


@router.delete("/api/photos/{photo_id}", status_code=status.HTTP_200_OK)
def delete_photo(photo_id: int, db: Session = Depends(get_db)):
    photo = db.query(models.SitePhoto).filter(models.SitePhoto.id == photo_id).first()
    if not photo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Photo {photo_id} not found")

    # Safely remove disk file
    if photo.file_path:
        filename = os.path.basename(photo.file_path)
        disk_path = os.path.join(UPLOAD_DIR, filename)
        if os.path.exists(disk_path):
            try:
                os.remove(disk_path)
            except Exception:
                pass

    db.delete(photo)
    db.commit()
    return {"message": f"Photo {photo_id} deleted successfully"}
