from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
from sqlalchemy import and_, func
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, EmailStr
from ..database.db import get_db
from ..dependencies import get_current_active_user
from ..models.models import User
from ..models.support import SupportTicket, TicketStatus, TicketPriority
from ..models.tenant import Tenant
from ..tenant_context import get_tenant_schema
from ..schemas.support import SupportTicketCreate, SupportTicketOut

router = APIRouter(
    prefix="/support/tickets",
    tags=["support"]
)


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
            SupportTicket.admin_response.isnot(None),
            SupportTicket.status.notin_([TicketStatus.closed])
        )
    )

    if since:
        try:
            since_dt = datetime.fromisoformat(since.replace("Z", "+00:00"))
            query = query.filter(SupportTicket.updated_at > since_dt)
        except (ValueError, TypeError):
            pass

    count = query.scalar() or 0
    return {"count": count}


@router.post("/", response_model=SupportTicketOut, status_code=status.HTTP_201_CREATED)
def create_ticket(
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
    db.commit()
    return db_ticket

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
    ).order_by(SupportTicket.created_at.desc()).all()

    return tickets


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
