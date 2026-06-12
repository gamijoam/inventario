from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, Enum
from ..database.db import Base
from ..utils.time_utils import get_venezuela_now
import enum

class MessageLevel(str, enum.Enum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"

class MessageType(str, enum.Enum):
    BANNER       = "banner"        # Top-right notification (current behavior)
    ANNOUNCEMENT = "announcement"  # Centered modal, shown once per user

class SystemMessage(Base):
    __tablename__ = "system_messages"
    __table_args__ = {"schema": "public"}  # Global table

    id           = Column(Integer, primary_key=True, index=True)
    title        = Column(String, nullable=False)
    content      = Column(Text, nullable=False)
    level        = Column(Enum(MessageLevel), default=MessageLevel.INFO)
    message_type = Column(String(20), nullable=False, default="banner")
    version_tag  = Column(String(20), nullable=True)   # e.g. "v2.5"
    target_tenant_schema = Column(String(120), nullable=True, index=True)  # Null = global SaaS message
    created_by_user_id   = Column(Integer, nullable=True)

    starts_at  = Column(DateTime, default=get_venezuela_now)
    expires_at = Column(DateTime, nullable=True)  # Null means indefinite
    is_active  = Column(Boolean, default=True)

    created_at = Column(DateTime, default=get_venezuela_now)

    def __repr__(self):
        return f"<SystemMessage(title='{self.title}', type='{self.message_type}', level='{self.level}')>"
