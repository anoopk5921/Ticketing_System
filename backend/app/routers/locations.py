from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models, schemas

router = APIRouter(prefix="/api/locations", tags=["Locations"])


@router.get("/", response_model=list[schemas.LocationOut])
def list_locations(db: Session = Depends(get_db)):
    return db.query(models.Location).order_by(models.Location.id).all()


@router.post("/", response_model=schemas.LocationOut)
def create_location(data: schemas.LocationCreate, db: Session = Depends(get_db)):
    loc = models.Location(**data.model_dump())
    db.add(loc)
    db.commit()
    db.refresh(loc)
    return loc


@router.put("/{loc_id}", response_model=schemas.LocationOut)
def update_location(loc_id: int, data: schemas.LocationCreate, db: Session = Depends(get_db)):
    loc = db.query(models.Location).filter(models.Location.id == loc_id).first()
    if not loc:
        raise HTTPException(status_code=404, detail="Location not found")
    loc.location_name = data.location_name
    db.commit()
    db.refresh(loc)
    return loc


@router.delete("/{loc_id}")
def delete_location(loc_id: int, db: Session = Depends(get_db)):
    loc = db.query(models.Location).filter(models.Location.id == loc_id).first()
    if not loc:
        raise HTTPException(status_code=404, detail="Location not found")
    db.delete(loc)
    db.commit()
    return {"message": "Location deleted"}
