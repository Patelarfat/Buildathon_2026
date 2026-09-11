from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
import models
import schemas

router = APIRouter(prefix="/api/areas", tags=["Areas"])


@router.get("/{area_id}", response_model=schemas.AreaResponse)
def get_area(area_id: int, db: Session = Depends(get_db)):
    area = db.query(models.Area).filter(models.Area.id == area_id).first()
    if not area:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Area with ID {area_id} not found"
        )
    return area


@router.put("/{area_id}", response_model=schemas.AreaResponse)
def update_area(area_id: int, area_update: schemas.AreaUpdate, db: Session = Depends(get_db)):
    db_area = db.query(models.Area).filter(models.Area.id == area_id).first()
    if not db_area:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Area with ID {area_id} not found"
        )

    update_data = area_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_area, field, value)

    db.commit()
    db.refresh(db_area)
    return db_area


@router.delete("/{area_id}", status_code=status.HTTP_200_OK)
def delete_area(area_id: int, db: Session = Depends(get_db)):
    db_area = db.query(models.Area).filter(models.Area.id == area_id).first()
    if not db_area:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Area with ID {area_id} not found"
        )

    db.delete(db_area)
    db.commit()
    return {"message": f"Area {area_id} deleted successfully"}
