from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from enum import Enum

class MessageLevel(str, Enum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"

class SystemMessageBase(BaseModel):
    title: str
    content: str
    level: MessageLevel = MessageLevel.INFO
    starts_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    is_active: bool = True

class SystemMessageCreate(SystemMessageBase):
    pass

class SystemMessageUpdate(SystemMessageBase):
    title: Optional[str] = None
    content: Optional[str] = None
    is_active: Optional[bool] = None

class SystemMessageResponse(SystemMessageBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True
