from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum, Boolean
import enum
from ..database.db import Base
from sqlalchemy.orm import relationship
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
    last_message_at = Column(DateTime, nullable=True)
    last_message_sender = Column(String, default="user")
    user_last_read_at = Column(DateTime, nullable=True)
    admin_last_read_at = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, default=get_venezuela_now)
    updated_at = Column(DateTime, default=get_venezuela_now, onupdate=datetime.datetime.now)

    messages = relationship("SupportMessage", back_populates="ticket", cascade="all, delete-orphan", order_by="SupportMessage.created_at")
    attachments = relationship("SupportAttachment", back_populates="ticket", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<SupportTicket(id={self.id}, subject='{self.subject}', status='{self.status}')>"


class SupportMessageSender(str, enum.Enum):
    user = "user"
    admin = "admin"
    system = "system"


class SupportMessage(Base):
    __tablename__ = "support_messages"
    __table_args__ = {"schema": "public"}

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("public.support_tickets.id", ondelete="CASCADE"), nullable=False, index=True)
    sender_type = Column(Enum(SupportMessageSender), default=SupportMessageSender.user, nullable=False)
    sender_email = Column(String, nullable=True, index=True)
    message = Column(Text, nullable=False, default="")
    is_internal = Column(Boolean, default=False)
    created_at = Column(DateTime, default=get_venezuela_now)

    ticket = relationship("SupportTicket", back_populates="messages")
    attachments = relationship("SupportAttachment", back_populates="message", cascade="all, delete-orphan")


class SupportAttachment(Base):
    __tablename__ = "support_attachments"
    __table_args__ = {"schema": "public"}

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("public.support_tickets.id", ondelete="CASCADE"), nullable=False, index=True)
    message_id = Column(Integer, ForeignKey("public.support_messages.id", ondelete="CASCADE"), nullable=False, index=True)
    original_filename = Column(String, nullable=False)
    stored_url = Column(String, nullable=False)
    content_type = Column(String, nullable=True)
    file_size = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=get_venezuela_now)

    ticket = relationship("SupportTicket", back_populates="attachments")
    message = relationship("SupportMessage", back_populates="attachments")
