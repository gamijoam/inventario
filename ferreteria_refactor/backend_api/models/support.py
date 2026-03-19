from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum
import enum
from ..database.db import Base
from ..utils.time_utils import get_venezuela_now
import datetime

class TicketPriority(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"

class TicketStatus(str, enum.Enum):
    open = "open"
    in_progress = "in_progress"
    resolved = "resolved"
    closed = "closed"

class SupportTicket(Base):
    __tablename__ = "support_tickets"
    __table_args__ = {"schema": "public"} # Centralized in public schema

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("public.tenants.id"), nullable=True)  # Nullable para contactos desde landing
    user_email = Column(String, nullable=False, index=True)
    contact_email = Column(String, nullable=True)
    phone = Column(String, nullable=True)  # Teléfono de contacto
    full_name = Column(String, nullable=True)  # Nombre completo
    subject = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    
    priority = Column(Enum(TicketPriority), default=TicketPriority.medium)
    status = Column(Enum(TicketStatus), default=TicketStatus.open)
    
    admin_response = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=get_venezuela_now)
    updated_at = Column(DateTime, default=get_venezuela_now, onupdate=datetime.datetime.now)

    def __repr__(self):
        return f"<SupportTicket(id={self.id}, subject='{self.subject}', status='{self.status}')>"
