from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models, schemas

router = APIRouter(prefix="/api/employees", tags=["Employees"])


@router.get("/", response_model=list[schemas.EmployeeDetail])
def list_employees(db: Session = Depends(get_db)):
    employees = db.query(models.Employee).order_by(models.Employee.emp_id).all()
    result = []
    for emp in employees:
        result.append(schemas.EmployeeDetail(
            emp_id=emp.emp_id,
            name=emp.name,
            user_id=emp.user_id,
            dept_id=emp.dept_id,
            role_id=emp.role_id,
            department_name=emp.department.description if emp.department else None,
            role_name=emp.role.role_name if emp.role else None,
        ))
    return result


@router.post("/", response_model=schemas.EmployeeOut)
def create_employee(data: schemas.EmployeeCreate, db: Session = Depends(get_db)):
    emp = models.Employee(**data.model_dump())
    db.add(emp)
    db.commit()
    db.refresh(emp)
    return emp


@router.put("/{emp_id}", response_model=schemas.EmployeeOut)
def update_employee(emp_id: int, data: schemas.EmployeeUpdate, db: Session = Depends(get_db)):
    emp = db.query(models.Employee).filter(models.Employee.emp_id == emp_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    emp.name = data.name
    emp.user_id = data.user_id
    emp.dept_id = data.dept_id
    emp.role_id = data.role_id
    if data.password:
        emp.password = data.password
    db.commit()
    db.refresh(emp)
    return emp


@router.delete("/{emp_id}")
def delete_employee(emp_id: int, db: Session = Depends(get_db)):
    emp = db.query(models.Employee).filter(models.Employee.emp_id == emp_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    db.delete(emp)
    db.commit()
    return {"message": "Employee deleted"}
