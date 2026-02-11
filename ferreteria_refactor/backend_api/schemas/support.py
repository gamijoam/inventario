from pydantic import BaseModel, EmailStr, field_validator
from datetime import datetime
from typing import Optional
from ..models.support import TicketPriority, TicketStatus

class SupportTicketBase(BaseModel):
    subject: str
    message: str
    priority: TicketPriority = TicketPriority.medium
    contact_email: Optional[EmailStr] = None

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
    tenant_id: int
    user_email: str
    contact_email: Optional[str] = None
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
