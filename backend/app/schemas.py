from datetime import date, datetime
from typing import Optional, List

from pydantic import BaseModel, ConfigDict, Field


# --- Department ---
class DepartmentBase(BaseModel):
    description: str = Field(min_length=1)


class DepartmentCreate(DepartmentBase):
    pass


class DepartmentOut(DepartmentBase):
    dept_id: int
    model_config = ConfigDict(from_attributes=True)


# --- Role ---
class RoleBase(BaseModel):
    role_name: str = Field(min_length=1)


class RoleCreate(RoleBase):
    pass


class RoleOut(RoleBase):
    role_id: int
    model_config = ConfigDict(from_attributes=True)


# --- Employee ---
class EmployeeBase(BaseModel):
    name: str = Field(min_length=1)
    user_id: str = Field(min_length=1)
    dept_id: int
    role_id: int


class EmployeeCreate(EmployeeBase):
    password: str = Field(min_length=1)


class EmployeeUpdate(EmployeeBase):
    password: Optional[str] = None


class EmployeeOut(EmployeeBase):
    emp_id: int
    model_config = ConfigDict(from_attributes=True)


class EmployeeDetail(EmployeeOut):
    department_name: Optional[str] = None
    role_name: Optional[str] = None


# --- Complaint Category ---
class CategoryBase(BaseModel):
    category_description: str = Field(min_length=1)


class CategoryCreate(CategoryBase):
    pass


class CategoryOut(CategoryBase):
    id: int
    model_config = ConfigDict(from_attributes=True)


# --- Location ---
class LocationBase(BaseModel):
    location_name: str = Field(min_length=1)


class LocationCreate(LocationBase):
    pass


class LocationOut(LocationBase):
    id: int
    model_config = ConfigDict(from_attributes=True)


# --- Ticket Attachment ---
class AttachmentOut(BaseModel):
    id: int
    file_name: str
    file_path: str
    file_type: str = "image"
    uploaded_at: datetime
    model_config = ConfigDict(from_attributes=True)


# --- Ticket History ---
class HistoryOut(BaseModel):
    id: int
    action: str
    action_by: int
    remarks: Optional[str] = None
    forwarded_to: Optional[int] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# --- Ticket ---
class TicketCreate(BaseModel):
    ticket_no: str
    ticket_date: date
    raising_dept_id: int
    raising_employee_id: int
    complaint_category_id: int
    location_id: int
    ticket_description: str
    details: Optional[str] = None
    assigned_to: int
    priority: str = "normal"


class TicketUpdate(BaseModel):
    ticket_description: Optional[str] = None
    details: Optional[str] = None
    complaint_category_id: Optional[int] = None
    location_id: Optional[int] = None
    priority: Optional[str] = None
    remarks: Optional[str] = None


class TicketForward(BaseModel):
    forward_to: int
    remarks: Optional[str] = None


class TicketClose(BaseModel):
    remarks: Optional[str] = None


class TicketOut(BaseModel):
    id: int
    ticket_no: str
    ticket_date: date
    raising_dept_id: int
    raising_employee_id: int
    complaint_category_id: int
    location_id: int
    ticket_description: str
    details: Optional[str] = None
    assigned_to: int
    priority: str
    status: str
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class TicketDetail(TicketOut):
    raising_dept_name: Optional[str] = None
    raising_employee_name: Optional[str] = None
    category_name: Optional[str] = None
    location_name: Optional[str] = None
    assignee_name: Optional[str] = None
    attachments: List[AttachmentOut] = []
    history: List[HistoryOut] = []
