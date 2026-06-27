from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models, schemas

router = APIRouter(prefix="/api/categories", tags=["Categories"])


@router.get("/", response_model=list[schemas.CategoryOut])
def list_categories(db: Session = Depends(get_db)):
    return db.query(models.ComplaintCategory).order_by(models.ComplaintCategory.id).all()


@router.post("/", response_model=schemas.CategoryOut)
def create_category(data: schemas.CategoryCreate, db: Session = Depends(get_db)):
    cat = models.ComplaintCategory(**data.model_dump())
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


@router.put("/{cat_id}", response_model=schemas.CategoryOut)
def update_category(cat_id: int, data: schemas.CategoryCreate, db: Session = Depends(get_db)):
    cat = db.query(models.ComplaintCategory).filter(models.ComplaintCategory.id == cat_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    cat.category_description = data.category_description
    db.commit()
    db.refresh(cat)
    return cat


@router.delete("/{cat_id}")
def delete_category(cat_id: int, db: Session = Depends(get_db)):
    cat = db.query(models.ComplaintCategory).filter(models.ComplaintCategory.id == cat_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    db.delete(cat)
    db.commit()
    return {"message": "Category deleted"}
