from pydantic import BaseModel, EmailStr, field_validator
from datetime import datetime
from typing import Optional, List
from ..models.support import TicketPriority, TicketStatus, SupportMessageSender

class SupportTicketBase(BaseModel):
    subject: str
    message: str
    priority: TicketPriority = TicketPriority.medium
    contact_email: Optional[EmailStr] = None
    phone: Optional[str] = None
    full_name: Optional[str] = None

    @field_validator('contact_email', mode='before')
    @classmethod
    def validate_contact_email(cls, v):
        if v == "":
            return None
        return v

    @field_validator('priority', mode='before')
    @classmethod
    def validate_priority(cls, v):
        if isinstance(v, str):
            return v.lower()
        return v

class SupportTicketCreate(SupportTicketBase):
    pass

class SupportTicketOut(SupportTicketBase):
    id: int
    tenant_id: Optional[int] = None
    user_email: str
    contact_email: Optional[str] = None
    phone: Optional[str] = None
    full_name: Optional[str] = None
    status: TicketStatus
    admin_response: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class SupportTicketReply(BaseModel):
    admin_response: str
    status: TicketStatus = TicketStatus.resolved

class SupportTicketUpdate(BaseModel):
    status: Optional[TicketStatus] = None
    priority: Optional[TicketPriority] = None


class SupportAttachmentOut(BaseModel):
    id: int
    ticket_id: int
    message_id: int
    original_filename: str
    stored_url: str
    content_type: Optional[str] = None
    file_size: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True


class SupportMessageCreate(BaseModel):
    message: str = ""


class SupportMessageOut(BaseModel):
    id: int
    ticket_id: int
    sender_type: SupportMessageSender
    sender_email: Optional[str] = None
    message: str
    is_internal: bool = False
    created_at: datetime
    attachments: List[SupportAttachmentOut] = []

    class Config:
        from_attributes = True
