from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, Enum
from ..database.db import Base
from ..utils.time_utils import get_venezuela_now
import enum

class MessageLevel(str, enum.Enum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"

class SystemMessage(Base):
    __tablename__ = "system_messages"
    __table_args__ = {"schema": "public"}  # Global table

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    level = Column(Enum(MessageLevel), default=MessageLevel.INFO)
    
    starts_at = Column(DateTime, default=get_venezuela_now)
    expires_at = Column(DateTime, nullable=True) # Null means indefinite (until manually deactivated)
    is_active = Column(Boolean, default=True)
    
    created_at = Column(DateTime, default=get_venezuela_now)
    
    def __repr__(self):
        return f"<SystemMessage(title='{self.title}', level='{self.level}')>"
