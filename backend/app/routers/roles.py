from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models, schemas

router = APIRouter(prefix="/api/roles", tags=["Roles"])


@router.get("/", response_model=list[schemas.RoleOut])
def list_roles(db: Session = Depends(get_db)):
    return db.query(models.Role).order_by(models.Role.role_id).all()


@router.post("/", response_model=schemas.RoleOut)
def create_role(data: schemas.RoleCreate, db: Session = Depends(get_db)):
    role = models.Role(**data.model_dump())
    db.add(role)
    db.commit()
    db.refresh(role)
    return role


@router.put("/{role_id}", response_model=schemas.RoleOut)
def update_role(role_id: int, data: schemas.RoleCreate, db: Session = Depends(get_db)):
    role = db.query(models.Role).filter(models.Role.role_id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    role.role_name = data.role_name
    db.commit()
    db.refresh(role)
    return role


@router.delete("/{role_id}")
def delete_role(role_id: int, db: Session = Depends(get_db)):
    role = db.query(models.Role).filter(models.Role.role_id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    db.delete(role)
    db.commit()
    return {"message": "Role deleted"}
