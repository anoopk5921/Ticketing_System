from datetime import datetime, date

from sqlalchemy import (
    Column, Integer, String, Text, Date, DateTime,
    ForeignKey, Enum as SAEnum
)
from sqlalchemy.orm import relationship
import enum

from .database import Base


class TicketStatus(str, enum.Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    CLOSED = "closed"
    FORWARDED = "forwarded"


class TicketPriority(str, enum.Enum):
    NORMAL = "normal"
    MODERATE = "moderate"
    URGENT = "urgent"
    CRITICAL = "critical"


class Department(Base):
    __tablename__ = "departments"

    dept_id = Column(Integer, primary_key=True, autoincrement=True)
    description = Column(String(200), nullable=False)

    employees = relationship("Employee", back_populates="department")


class Role(Base):
    __tablename__ = "roles"

    role_id = Column(Integer, primary_key=True, autoincrement=True)
    role_name = Column(String(100), nullable=False, unique=True)

    employees = relationship("Employee", back_populates="role")


class Employee(Base):
    __tablename__ = "employees"

    emp_id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(150), nullable=False)
    user_id = Column(String(50), nullable=False, unique=True)
    password = Column(String(255), nullable=False)
    dept_id = Column(Integer, ForeignKey("departments.dept_id"), nullable=False)
    role_id = Column(Integer, ForeignKey("roles.role_id"), nullable=False)

    department = relationship("Department", back_populates="employees")
    role = relationship("Role", back_populates="employees")


class ComplaintCategory(Base):
    __tablename__ = "complaint_categories"

    id = Column(Integer, primary_key=True, autoincrement=True)
    category_description = Column(String(200), nullable=False)


class Location(Base):
    __tablename__ = "locations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    location_name = Column(String(150), nullable=False, unique=True)


class Ticket(Base):
    __tablename__ = "tickets"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ticket_no = Column(String(50), nullable=False, unique=True)
    ticket_date = Column(Date, nullable=False, default=date.today)
    raising_dept_id = Column(Integer, ForeignKey("departments.dept_id"), nullable=False)
    raising_employee_id = Column(Integer, ForeignKey("employees.emp_id"), nullable=False)
    complaint_category_id = Column(Integer, ForeignKey("complaint_categories.id"), nullable=False)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=False)
    ticket_description = Column(String(300), nullable=False)
    details = Column(Text, nullable=True)
    assigned_to = Column(Integer, ForeignKey("employees.emp_id"), nullable=False)
    priority = Column(SAEnum(TicketPriority), default=TicketPriority.NORMAL, nullable=False)
    status = Column(SAEnum(TicketStatus), default=TicketStatus.OPEN, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    raising_department = relationship("Department", foreign_keys=[raising_dept_id])
    raising_employee = relationship("Employee", foreign_keys=[raising_employee_id])
    category = relationship("ComplaintCategory")
    location = relationship("Location")
    assignee = relationship("Employee", foreign_keys=[assigned_to])
    attachments = relationship("TicketAttachment", back_populates="ticket", cascade="all, delete-orphan")
    history = relationship("TicketHistory", back_populates="ticket", cascade="all, delete-orphan")


class TicketAttachment(Base):
    __tablename__ = "ticket_attachments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id"), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_type = Column(String(20), nullable=False, default="image")
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    uploaded_by = Column(Integer, ForeignKey("employees.emp_id"), nullable=True)

    ticket = relationship("Ticket", back_populates="attachments")


class TicketHistory(Base):
    __tablename__ = "ticket_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id"), nullable=False)
    action = Column(String(50), nullable=False)  # created, updated, forwarded, closed
    action_by = Column(Integer, ForeignKey("employees.emp_id"), nullable=False)
    remarks = Column(Text, nullable=True)
    forwarded_to = Column(Integer, ForeignKey("employees.emp_id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    ticket = relationship("Ticket", back_populates="history")
