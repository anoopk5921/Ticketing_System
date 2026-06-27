from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models, schemas

router = APIRouter(prefix="/api/departments", tags=["Departments"])


@router.get("/", response_model=list[schemas.DepartmentOut])
def list_departments(db: Session = Depends(get_db)):
    return db.query(models.Department).order_by(models.Department.dept_id).all()


@router.post("/", response_model=schemas.DepartmentOut)
def create_department(data: schemas.DepartmentCreate, db: Session = Depends(get_db)):
    dept = models.Department(**data.model_dump())
    db.add(dept)
    db.commit()
    db.refresh(dept)
    return dept


@router.put("/{dept_id}", response_model=schemas.DepartmentOut)
def update_department(dept_id: int, data: schemas.DepartmentCreate, db: Session = Depends(get_db)):
    dept = db.query(models.Department).filter(models.Department.dept_id == dept_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    dept.description = data.description
    db.commit()
    db.refresh(dept)
    return dept


@router.delete("/{dept_id}")
def delete_department(dept_id: int, db: Session = Depends(get_db)):
    dept = db.query(models.Department).filter(models.Department.dept_id == dept_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    db.delete(dept)
    db.commit()
    return {"message": "Department deleted"}
