from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from ..database.db import get_db
from ..dependencies import get_current_superuser
from ..models.support import SupportTicket, TicketStatus, TicketPriority
from ..schemas.support import SupportTicketOut, SupportTicketReply, SupportTicketUpdate

router = APIRouter(
    prefix="/admin/support/tickets",
    tags=["admin-support"]
)

@router.get("/", response_model=List[SupportTicketOut])
def list_all_tickets(
    status: Optional[TicketStatus] = None,
    priority: Optional[TicketPriority] = None,
    db: Session = Depends(get_db),
    current_user: Session = Depends(get_current_superuser)
):
    """
    List all support tickets across all tenants.
    """
    query = db.query(SupportTicket)
    
    if status:
        query = query.filter(SupportTicket.status == status)
    if priority:
        query = query.filter(SupportTicket.priority == priority)
        
    tickets = query.order_by(SupportTicket.created_at.desc()).all()
    return tickets

@router.patch("/{ticket_id}/reply", response_model=SupportTicketOut)
def reply_to_ticket(
    ticket_id: int,
    reply_in: SupportTicketReply,
    db: Session = Depends(get_db),
    current_user: Session = Depends(get_current_superuser)
):
    """
    Add a response to a ticket and update its status.
    """
    db_ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
    
    if not db_ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    db_ticket.admin_response = reply_in.admin_response
    db_ticket.status = reply_in.status
    
    db.commit()
    db.refresh(db_ticket)
    return db_ticket

@router.patch("/{ticket_id}", response_model=SupportTicketOut)
def update_ticket_status(
    ticket_id: int,
    update_in: SupportTicketUpdate,
    db: Session = Depends(get_db),
    current_user: Session = Depends(get_current_superuser)
):
    """
    Update ticket status or priority without necessarily replying.
    """
    db_ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
    
    if not db_ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    if update_in.status:
        db_ticket.status = update_in.status
    if update_in.priority:
        db_ticket.priority = update_in.priority
        
    db.commit()
    db.refresh(db_ticket)
    return db_ticket
