from fastapi import APIRouter, Depends, HTTPException, status, Form, UploadFile, File
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime
from ..database.db import get_db
from ..dependencies import get_current_superuser
from ..models.support import SupportTicket, TicketStatus, TicketPriority, SupportMessage, SupportAttachment, SupportMessageSender
from ..schemas.support import SupportTicketOut, SupportTicketReply, SupportTicketUpdate, SupportMessageOut

router = APIRouter(
    prefix="/admin/support/tickets",
    tags=["admin-support"]
)


def _tenant_schema_from_ticket(db: Session, ticket: SupportTicket) -> str:
    if not ticket.tenant_id:
        return "public"
    from ..models.tenant import Tenant
    tenant = db.query(Tenant).filter(Tenant.id == ticket.tenant_id).first()
    return tenant.schema_name if tenant else "public"


def _decorate_ticket(ticket: SupportTicket) -> SupportTicket:
    last_at = ticket.last_message_at or ticket.updated_at or ticket.created_at
    ticket.unread_for_admin = bool(ticket.last_message_sender == "user" and (not ticket.admin_last_read_at or (last_at and ticket.admin_last_read_at < last_at)))
    ticket.unread_for_user = False
    return ticket


def _touch_ticket_for_message(ticket: SupportTicket, sender: SupportMessageSender, when: datetime):
    ticket.last_message_at = when
    ticket.last_message_sender = sender.value if hasattr(sender, "value") else sender
    ticket.updated_at = when
    if sender == SupportMessageSender.user:
        ticket.user_last_read_at = when
    elif sender == SupportMessageSender.admin:
        ticket.admin_last_read_at = when


def _message_payload(message: SupportMessage) -> dict:
    return {
        "id": message.id,
        "ticket_id": message.ticket_id,
        "sender_type": message.sender_type.value if hasattr(message.sender_type, "value") else message.sender_type,
        "sender_email": message.sender_email,
        "message": message.message,
        "is_internal": message.is_internal,
        "created_at": message.created_at.isoformat() if message.created_at else None,
        "attachments": [
            {
                "id": a.id,
                "ticket_id": a.ticket_id,
                "message_id": a.message_id,
                "original_filename": a.original_filename,
                "stored_url": a.stored_url,
                "content_type": a.content_type,
                "file_size": a.file_size,
                "created_at": a.created_at.isoformat() if a.created_at else None,
            } for a in getattr(message, "attachments", [])
        ],
    }



@router.get("/pending-count")
def get_pending_count(
    db: Session = Depends(get_db),
    current_user: Session = Depends(get_current_superuser)
):
    """
    Count tickets that need admin attention (open or in_progress).
    Used by the SaaS admin panel to show a notification badge.
    """
    count = db.query(func.count(SupportTicket.id)).filter(
        SupportTicket.status.notin_([TicketStatus.closed]),
        SupportTicket.last_message_sender == "user",
        SupportTicket.last_message_at.isnot(None),
    ).filter(
        (SupportTicket.admin_last_read_at.is_(None)) |
        (SupportTicket.admin_last_read_at < SupportTicket.last_message_at)
    ).scalar() or 0
    return {"count": count}


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
        
    tickets = query.order_by(SupportTicket.last_message_at.desc().nullslast(), SupportTicket.created_at.desc()).all()
    return [_decorate_ticket(ticket) for ticket in tickets]

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

    chat_message = SupportMessage(
        ticket_id=db_ticket.id,
        sender_type=SupportMessageSender.admin,
        sender_email=getattr(current_user, 'email', None),
        message=reply_in.admin_response,
    )
    db.add(chat_message)
    db.flush()
    _touch_ticket_for_message(db_ticket, SupportMessageSender.admin, chat_message.created_at or datetime.now())
    
    db.commit()
    try:
        from ..websocket.manager import manager
        from ..websocket.events import WebSocketEvents
        import asyncio
        payload = _message_payload(chat_message)
        tenant_schema = _tenant_schema_from_ticket(db, db_ticket)
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(manager.broadcast(WebSocketEvents.SUPPORT_MESSAGE_CREATED, payload, tenant_id=tenant_schema))
        except RuntimeError:
            pass
    except Exception:
        pass
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
    return _decorate_ticket(db_ticket)


@router.get("/{ticket_id}/messages", response_model=List[SupportMessageOut])
def list_ticket_messages_admin(
    ticket_id: int,
    db: Session = Depends(get_db),
    current_user: Session = Depends(get_current_superuser)
):
    ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    ticket.admin_last_read_at = datetime.now()
    db.commit()
    return (
        db.query(SupportMessage)
        .options(joinedload(SupportMessage.attachments))
        .filter(SupportMessage.ticket_id == ticket_id)
        .order_by(SupportMessage.created_at.asc(), SupportMessage.id.asc())
        .all()
    )


@router.post("/{ticket_id}/messages", response_model=SupportMessageOut, status_code=status.HTTP_201_CREATED)
async def send_ticket_message_admin(
    ticket_id: int,
    message: str = Form(""),
    db: Session = Depends(get_db),
    current_user: Session = Depends(get_current_superuser)
):
    ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    clean_message = (message or "").strip()
    if not clean_message:
        raise HTTPException(status_code=400, detail="Escribe un mensaje")

    chat_message = SupportMessage(
        ticket_id=ticket.id,
        sender_type=SupportMessageSender.admin,
        sender_email=getattr(current_user, 'email', None),
        message=clean_message,
    )
    db.add(chat_message)
    ticket.admin_response = clean_message
    ticket.status = TicketStatus.in_progress if ticket.status == TicketStatus.open else ticket.status
    db.flush()
    _touch_ticket_for_message(ticket, SupportMessageSender.admin, chat_message.created_at or datetime.now())
    db.commit()
    db.refresh(chat_message)

    payload = _message_payload(chat_message)
    try:
        from ..websocket.manager import manager
        from ..websocket.events import WebSocketEvents
        tenant_schema = _tenant_schema_from_ticket(db, ticket)
        await manager.broadcast(WebSocketEvents.SUPPORT_MESSAGE_CREATED, payload, tenant_id=tenant_schema)
        await manager.broadcast(WebSocketEvents.SUPPORT_MESSAGE_CREATED, {**payload, "tenant": tenant_schema}, tenant_id="public")
    except Exception:
        pass
    return chat_message
