from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime
from enum import Enum

class MessageLevel(str, Enum):
    INFO     = "info"
    WARNING  = "warning"
    CRITICAL = "critical"

class MessageType(str, Enum):
    BANNER       = "banner"
    ANNOUNCEMENT = "announcement"

class SystemMessageBase(BaseModel):
    title        : str
    content      : str
    level        : MessageLevel  = MessageLevel.INFO
    message_type : MessageType   = MessageType.BANNER
    version_tag  : Optional[str] = None
    target_tenant_schema: Optional[str] = None
    starts_at    : Optional[datetime] = None
    expires_at   : Optional[datetime] = None
    is_active    : bool = True

class SystemMessageCreate(SystemMessageBase):
    pass

class SystemMessageUpdate(BaseModel):
    title        : Optional[str]         = None
    content      : Optional[str]         = None
    level        : Optional[MessageLevel] = None
    message_type : Optional[MessageType] = None
    version_tag  : Optional[str]         = None
    target_tenant_schema: Optional[str]  = None
    is_active    : Optional[bool]        = None

class SystemMessageResponse(SystemMessageBase):
    id         : int
    created_by_user_id: Optional[int] = None
    created_at : datetime

    model_config = ConfigDict(from_attributes=True)
