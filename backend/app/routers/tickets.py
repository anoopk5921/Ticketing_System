import os
import uuid
from datetime import date
from pathlib import Path
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models, schemas

router = APIRouter(prefix="/api/tickets", tags=["Tickets"])


def generate_ticket_no(db: Session) -> str:
    today_str = date.today().strftime("%Y%m%d")
    prefix = f"TKT-{today_str}-"
    last = (
        db.query(models.Ticket)
        .filter(models.Ticket.ticket_no.like(f"{prefix}%"))
        .order_by(models.Ticket.id.desc())
        .first()
    )
    seq = 1
    if last:
        try:
            seq = int(last.ticket_no.rsplit("-", 1)[-1]) + 1
        except ValueError:
            seq = 1
    return f"{prefix}{seq:03d}"

UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "uploads"))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def save_upload(file: UploadFile) -> tuple[str, str]:
    ext = Path(file.filename).suffix
    unique_name = f"{uuid.uuid4().hex}{ext}"
    file_path = UPLOAD_DIR / unique_name
    with open(file_path, "wb") as f:
        f.write(file.file.read())
    # Store web-friendly path for serving via /uploads
    return file.filename, f"uploads/{unique_name}"


def add_attachments(
    ticket_id: int,
    upload_files: List[UploadFile],
    file_type: str,
    uploaded_by: int,
    db: Session,
) -> None:
    for upload_file in upload_files:
        if upload_file.filename:
            orig_name, path = save_upload(upload_file)
            db.add(models.TicketAttachment(
                ticket_id=ticket_id,
                file_name=orig_name,
                file_path=path,
                file_type=file_type,
                uploaded_by=uploaded_by,
            ))


def build_ticket_detail(ticket: models.Ticket) -> schemas.TicketDetail:
    return schemas.TicketDetail(
        id=ticket.id,
        ticket_no=ticket.ticket_no,
        ticket_date=ticket.ticket_date,
        raising_dept_id=ticket.raising_dept_id,
        raising_employee_id=ticket.raising_employee_id,
        complaint_category_id=ticket.complaint_category_id,
        location_id=ticket.location_id,
        ticket_description=ticket.ticket_description,
        details=ticket.details,
        assigned_to=ticket.assigned_to,
        priority=ticket.priority.value,
        status=ticket.status.value,
        created_at=ticket.created_at,
        updated_at=ticket.updated_at,
        raising_dept_name=ticket.raising_department.description if ticket.raising_department else None,
        raising_employee_name=ticket.raising_employee.name if ticket.raising_employee else None,
        category_name=ticket.category.category_description if ticket.category else None,
        location_name=ticket.location.location_name if ticket.location else None,
        assignee_name=ticket.assignee.name if ticket.assignee else None,
        attachments=[schemas.AttachmentOut.model_validate(a) for a in ticket.attachments],
        history=[schemas.HistoryOut.model_validate(h) for h in ticket.history],
    )


@router.get("/", response_model=list[schemas.TicketDetail])
def list_tickets(db: Session = Depends(get_db)):
    tickets = db.query(models.Ticket).order_by(models.Ticket.id.desc()).all()
    return [build_ticket_detail(t) for t in tickets]


@router.get("/next-number")
def get_next_ticket_number(db: Session = Depends(get_db)):
    return {"ticket_no": generate_ticket_no(db)}


@router.get("/{ticket_id}", response_model=schemas.TicketDetail)
def get_ticket(ticket_id: int, db: Session = Depends(get_db)):
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return build_ticket_detail(ticket)


@router.post("/", response_model=schemas.TicketDetail)
async def create_ticket(
    ticket_date: date = Form(...),
    ticket_no: Optional[str] = Form(None),
    raising_dept_id: int = Form(...),
    raising_employee_id: int = Form(...),
    complaint_category_id: int = Form(...),
    location_id: int = Form(...),
    ticket_description: str = Form(...),
    details: Optional[str] = Form(None),
    assigned_to: int = Form(...),
    priority: str = Form("normal"),
    images: List[UploadFile] = File(default=[]),
    files: List[UploadFile] = File(default=[]),
    db: Session = Depends(get_db),
):
    if not any(f.filename for f in files):
        raise HTTPException(status_code=400, detail="At least one document file is required")

    if not ticket_no or not ticket_no.strip():
        ticket_no = generate_ticket_no(db)
    else:
        ticket_no = ticket_no.strip()
        existing = db.query(models.Ticket).filter(models.Ticket.ticket_no == ticket_no).first()
        if existing:
            raise HTTPException(status_code=400, detail="Ticket number already exists")

    try:
        ticket_priority = models.TicketPriority(priority.lower())
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid priority value")

    ticket = models.Ticket(
        ticket_no=ticket_no,
        ticket_date=ticket_date,
        raising_dept_id=raising_dept_id,
        raising_employee_id=raising_employee_id,
        complaint_category_id=complaint_category_id,
        location_id=location_id,
        ticket_description=ticket_description,
        details=details,
        assigned_to=assigned_to,
        priority=ticket_priority,
        status=models.TicketStatus.OPEN,
    )
    db.add(ticket)
    db.flush()

    add_attachments(ticket.id, images, "image", raising_employee_id, db)
    add_attachments(ticket.id, files, "file", raising_employee_id, db)

    db.add(models.TicketHistory(
        ticket_id=ticket.id,
        action="created",
        action_by=raising_employee_id,
        remarks="Ticket created",
    ))

    db.commit()
    db.refresh(ticket)
    return build_ticket_detail(ticket)


@router.put("/{ticket_id}", response_model=schemas.TicketDetail)
async def update_ticket(
    ticket_id: int,
    action_by: int = Form(...),
    ticket_description: Optional[str] = Form(None),
    details: Optional[str] = Form(None),
    complaint_category_id: Optional[int] = Form(None),
    location_id: Optional[int] = Form(None),
    priority: Optional[str] = Form(None),
    remarks: Optional[str] = Form(None),
    images: List[UploadFile] = File(default=[]),
    files: List[UploadFile] = File(default=[]),
    db: Session = Depends(get_db),
):
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if ticket.status == models.TicketStatus.CLOSED:
        raise HTTPException(status_code=400, detail="Cannot update a closed ticket")

    if ticket_description is not None:
        ticket.ticket_description = ticket_description
    if details is not None:
        ticket.details = details
    if complaint_category_id is not None:
        ticket.complaint_category_id = complaint_category_id
    if location_id is not None:
        ticket.location_id = location_id
    if priority is not None:
        try:
            ticket.priority = models.TicketPriority(priority.lower())
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid priority value")

    if ticket.status == models.TicketStatus.OPEN:
        ticket.status = models.TicketStatus.IN_PROGRESS

    for img in images:
        if img.filename:
            add_attachments(ticket.id, [img], "image", action_by, db)

    if any(f.filename for f in files):
        add_attachments(ticket.id, files, "file", action_by, db)

    db.add(models.TicketHistory(
        ticket_id=ticket.id,
        action="updated",
        action_by=action_by,
        remarks=remarks or "Ticket updated",
    ))

    db.commit()
    db.refresh(ticket)
    return build_ticket_detail(ticket)


@router.post("/{ticket_id}/forward", response_model=schemas.TicketDetail)
async def forward_ticket(
    ticket_id: int,
    action_by: int = Form(...),
    forward_to: int = Form(...),
    remarks: Optional[str] = Form(None),
    images: List[UploadFile] = File(default=[]),
    db: Session = Depends(get_db),
):
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if ticket.status == models.TicketStatus.CLOSED:
        raise HTTPException(status_code=400, detail="Cannot forward a closed ticket")

    assignee = db.query(models.Employee).filter(models.Employee.emp_id == forward_to).first()
    if not assignee:
        raise HTTPException(status_code=404, detail="Target employee not found")

    ticket.assigned_to = forward_to
    ticket.status = models.TicketStatus.FORWARDED

    for img in images:
        if img.filename:
            add_attachments(ticket.id, [img], "image", action_by, db)

    db.add(models.TicketHistory(
        ticket_id=ticket.id,
        action="forwarded",
        action_by=action_by,
        forwarded_to=forward_to,
        remarks=remarks or f"Forwarded to {assignee.name}",
    ))

    db.commit()
    db.refresh(ticket)
    return build_ticket_detail(ticket)


@router.post("/{ticket_id}/close", response_model=schemas.TicketDetail)
async def close_ticket(
    ticket_id: int,
    action_by: int = Form(...),
    remarks: Optional[str] = Form(None),
    images: List[UploadFile] = File(default=[]),
    db: Session = Depends(get_db),
):
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if ticket.status == models.TicketStatus.CLOSED:
        raise HTTPException(status_code=400, detail="Ticket is already closed")

    ticket.status = models.TicketStatus.CLOSED

    for img in images:
        if img.filename:
            add_attachments(ticket.id, [img], "image", action_by, db)

    db.add(models.TicketHistory(
        ticket_id=ticket.id,
        action="closed",
        action_by=action_by,
        remarks=remarks or "Ticket closed",
    ))

    db.commit()
    db.refresh(ticket)
    return build_ticket_detail(ticket)
