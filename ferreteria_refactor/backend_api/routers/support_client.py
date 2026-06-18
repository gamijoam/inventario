from fastapi import APIRouter, Depends, HTTPException, status, Query, Request, UploadFile, File, Form
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, func
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, EmailStr
from ..database.db import get_db
from ..dependencies import get_current_active_user
from ..models.models import User
from ..models.support import SupportTicket, TicketStatus, TicketPriority, SupportMessage, SupportAttachment, SupportMessageSender
from ..models.tenant import Tenant
from ..tenant_context import get_tenant_schema
from ..schemas.support import SupportTicketCreate, SupportTicketOut, SupportMessageOut

router = APIRouter(
    prefix="/support/tickets",
    tags=["support"]
)


ALLOWED_SUPPORT_UPLOAD_EXTENSIONS = {"json", "xlsx", "xls", "csv", "txt", "pdf", "png", "jpg", "jpeg", "webp"}
MAX_SUPPORT_UPLOAD_BYTES = 10 * 1024 * 1024


def _tenant_schema_from_id(db: Session, tenant_id: Optional[int]) -> str:
    if not tenant_id:
        return "public"
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    return tenant.schema_name if tenant else "public"


def _ticket_for_user(ticket_id: int, db: Session, current_user: User) -> SupportTicket:
    effective_tenant_id = _resolve_tenant_id(current_user, db)
    ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
    if not ticket or ticket.tenant_id != effective_tenant_id:
        raise HTTPException(status_code=404, detail="Ticket no encontrado")
    return ticket


def _attachment_payload(attachment: SupportAttachment) -> dict:
    return {
        "id": attachment.id,
        "ticket_id": attachment.ticket_id,
        "message_id": attachment.message_id,
        "original_filename": attachment.original_filename,
        "stored_url": attachment.stored_url,
        "content_type": attachment.content_type,
        "file_size": attachment.file_size,
        "created_at": attachment.created_at.isoformat() if attachment.created_at else None,
    }


def _decorate_ticket(ticket: SupportTicket, viewer: str = "user") -> SupportTicket:
    last_at = ticket.last_message_at or ticket.updated_at or ticket.created_at
    if viewer == "admin":
        ticket.unread_for_admin = bool(ticket.last_message_sender == "user" and (not ticket.admin_last_read_at or (last_at and ticket.admin_last_read_at < last_at)))
        ticket.unread_for_user = False
    else:
        ticket.unread_for_user = bool(ticket.last_message_sender == "admin" and (not ticket.user_last_read_at or (last_at and ticket.user_last_read_at < last_at)))
        ticket.unread_for_admin = False
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
        "attachments": [_attachment_payload(a) for a in getattr(message, "attachments", [])],
    }


def _save_support_upload(file: UploadFile, tenant_schema: str, ticket_id: int) -> tuple[str, int]:
    import os
    import uuid
    import shutil
    from ..utils.media_utils import BASE_MEDIA_DIR

    original = file.filename or "archivo"
    extension = original.rsplit('.', 1)[-1].lower() if '.' in original else ''
    if extension not in ALLOWED_SUPPORT_UPLOAD_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Tipo de archivo no permitido para soporte")

    target_dir = os.path.join(BASE_MEDIA_DIR, tenant_schema, "support", str(ticket_id))
    os.makedirs(target_dir, exist_ok=True)
    stored_name = f"{uuid.uuid4().hex}.{extension}"
    target_path = os.path.join(target_dir, stored_name)

    size = 0
    with open(target_path, "wb") as out:
        while True:
            chunk = file.file.read(1024 * 1024)
            if not chunk:
                break
            size += len(chunk)
            if size > MAX_SUPPORT_UPLOAD_BYTES:
                out.close()
                try:
                    os.remove(target_path)
                except OSError:
                    pass
                raise HTTPException(status_code=400, detail="El archivo supera el limite de 10 MB")
            out.write(chunk)

    return f"/media/{tenant_schema}/support/{ticket_id}/{stored_name}", size


def _resolve_tenant_id(current_user: User, db: Session) -> Optional[int]:
    """Resolve effective tenant ID from user or context."""
    effective_tenant_id = current_user.tenant_id
    if not effective_tenant_id and current_user.is_superuser:
        schema_name = get_tenant_schema()
        if schema_name != "public":
            tenant = db.query(Tenant).filter(Tenant.schema_name == schema_name).first()
            if tenant:
                effective_tenant_id = tenant.id
    return effective_tenant_id


@router.get("/unread-count")
def get_unread_count(
    since: Optional[str] = Query(None, description="ISO timestamp of last visit"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Count tickets with admin responses updated after 'since' timestamp.
    Used by the frontend to show a notification badge.
    """
    effective_tenant_id = _resolve_tenant_id(current_user, db)
    if not effective_tenant_id:
        return {"count": 0}

    query = db.query(func.count(SupportTicket.id)).filter(
        and_(
            SupportTicket.tenant_id == effective_tenant_id,
            SupportTicket.user_email == current_user.email,
            SupportTicket.status.notin_([TicketStatus.closed]),
            SupportTicket.last_message_sender == "admin",
            SupportTicket.last_message_at.isnot(None),
        )
    ).filter(
        (SupportTicket.user_last_read_at.is_(None)) |
        (SupportTicket.user_last_read_at < SupportTicket.last_message_at)
    )

    count = query.scalar() or 0
    return {"count": count}


@router.post("/", response_model=SupportTicketOut, status_code=status.HTTP_201_CREATED)
async def create_ticket(
    ticket_in: SupportTicketCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Create a new support ticket.
    Tenant ID and User Email are extracted from the token.
    """
    effective_tenant_id = _resolve_tenant_id(current_user, db)

    if not effective_tenant_id:
        raise HTTPException(
            status_code=400,
            detail=f"El sistema no pudo determinar el tenant para el usuario {current_user.email}. Por favor, verifique el contexto de la empresa."
        )

    db_ticket = SupportTicket(
        tenant_id=effective_tenant_id,
        user_email=current_user.email,
        contact_email=ticket_in.contact_email,
        subject=ticket_in.subject,
        message=ticket_in.message,
        priority=ticket_in.priority
    )
    db.add(db_ticket)
    db.flush()

    initial_message = SupportMessage(
        ticket_id=db_ticket.id,
        sender_type=SupportMessageSender.user,
        sender_email=current_user.email,
        message=ticket_in.message,
    )
    db.add(initial_message)
    db.flush()
    _touch_ticket_for_message(db_ticket, SupportMessageSender.user, initial_message.created_at or datetime.now())
    db.commit()

    try:
        from ..websocket.manager import manager
        from ..websocket.events import WebSocketEvents
        tenant_schema = _tenant_schema_from_id(db, effective_tenant_id)
        await manager.broadcast(WebSocketEvents.SUPPORT_TICKET_CREATED, {
            "ticket_id": db_ticket.id,
            "subject": db_ticket.subject,
            "status": db_ticket.status.value if hasattr(db_ticket.status, "value") else db_ticket.status,
        }, tenant_id=tenant_schema)
        await manager.broadcast(WebSocketEvents.SUPPORT_TICKET_CREATED, {
            "ticket_id": db_ticket.id,
            "subject": db_ticket.subject,
            "status": db_ticket.status.value if hasattr(db_ticket.status, "value") else db_ticket.status,
            "tenant": tenant_schema,
        }, tenant_id="public")
    except Exception:
        pass

    return _decorate_ticket(db_ticket, "user")

@router.get("/", response_model=List[SupportTicketOut])
def list_my_tickets(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get all tickets reported by the current tenant.
    """
    effective_tenant_id = _resolve_tenant_id(current_user, db)

    if not effective_tenant_id:
        return []

    tickets = db.query(SupportTicket).filter(
        SupportTicket.tenant_id == effective_tenant_id
    ).order_by(SupportTicket.last_message_at.desc().nullslast(), SupportTicket.created_at.desc()).all()

    return [_decorate_ticket(ticket, "user") for ticket in tickets]


# ─── CONTACTO PÚBLICO (sin autenticación) ────────────────────────────────────

class PublicContactRequest(BaseModel):
    full_name: str
    email: EmailStr
    phone: str
    message: str
    source: str = "login"  # "login" | "landing"


@router.post("/public-contact", status_code=201)
def public_contact(
    request: Request,
    body: PublicContactRequest,
    db: Session = Depends(get_db)
):
    """
    Endpoint público (sin auth) para que usuarios o prospectos
    envíen un mensaje de contacto desde el login o la landing page.
    Se crea como ticket en el HelpDesk del panel SaaS.
    """
    # Intentar resolver tenant desde el subdominio (si viene del login)
    tenant_id = None
    tenant_schema = getattr(request.state, "tenant_schema", "public")
    if tenant_schema and tenant_schema != "public":
        tenant = db.query(Tenant).filter(Tenant.schema_name == tenant_schema).first()
        if tenant:
            tenant_id = tenant.id

    origin = "🌐 Landing Page" if body.source == "landing" else "🔐 Página de Login"
    subject = f"[{origin}] Contacto de {body.full_name}"

    ticket = SupportTicket(
        tenant_id=tenant_id,
        user_email=body.email,
        contact_email=body.email,
        phone=body.phone,
        full_name=body.full_name,
        subject=subject,
        message=body.message,
        priority=TicketPriority.medium,
        status=TicketStatus.open,
    )
    db.add(ticket)
    db.commit()

    return {"message": "Tu mensaje fue enviado. Te contactaremos pronto."}


@router.get("/{ticket_id}/messages", response_model=List[SupportMessageOut])
def list_ticket_messages(
    ticket_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    ticket = _ticket_for_user(ticket_id, db, current_user)
    ticket.user_last_read_at = datetime.now()
    db.commit()

    messages = (
        db.query(SupportMessage)
        .options(joinedload(SupportMessage.attachments))
        .filter(SupportMessage.ticket_id == ticket.id, SupportMessage.is_internal == False)
        .order_by(SupportMessage.created_at.asc(), SupportMessage.id.asc())
        .all()
    )
    return messages


@router.post("/{ticket_id}/messages", response_model=SupportMessageOut, status_code=status.HTTP_201_CREATED)
async def send_ticket_message(
    ticket_id: int,
    message: str = Form(""),
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    ticket = _ticket_for_user(ticket_id, db, current_user)
    clean_message = (message or "").strip()
    if not clean_message and not file:
        raise HTTPException(status_code=400, detail="Escribe un mensaje o adjunta un archivo")

    chat_message = SupportMessage(
        ticket_id=ticket.id,
        sender_type=SupportMessageSender.user,
        sender_email=current_user.email,
        message=clean_message,
    )
    db.add(chat_message)
    db.flush()

    if file:
        tenant_schema = _tenant_schema_from_id(db, ticket.tenant_id)
        stored_url, size = _save_support_upload(file, tenant_schema, ticket.id)
        attachment = SupportAttachment(
            ticket_id=ticket.id,
            message_id=chat_message.id,
            original_filename=file.filename or "archivo",
            stored_url=stored_url,
            content_type=file.content_type,
            file_size=size,
        )
        db.add(attachment)
        db.flush()

    now = chat_message.created_at or datetime.now()
    if ticket.status in [TicketStatus.resolved, TicketStatus.closed]:
        ticket.status = TicketStatus.in_progress
    _touch_ticket_for_message(ticket, SupportMessageSender.user, now)

    db.commit()
    db.refresh(chat_message)

    payload = _message_payload(chat_message)
    try:
        from ..websocket.manager import manager
        from ..websocket.events import WebSocketEvents
        tenant_schema = _tenant_schema_from_id(db, ticket.tenant_id)
        await manager.broadcast(WebSocketEvents.SUPPORT_MESSAGE_CREATED, payload, tenant_id=tenant_schema)
        await manager.broadcast(WebSocketEvents.SUPPORT_MESSAGE_CREATED, {**payload, "tenant": tenant_schema}, tenant_id="public")
    except Exception:
        pass

    return chat_message
