from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum, Boolean
import enum
from ..database.db import Base
from ..utils.time_utils import get_venezuela_now
import datetime

class TaskPriority(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"

class AdminTask(Base):
    __tablename__ = "admin_tasks"
    __table_args__ = {"schema": "public"}

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    is_completed = Column(Boolean, default=False)
    
    priority = Column(Enum(TaskPriority), default=TaskPriority.MEDIUM)
    due_date = Column(DateTime, nullable=True)
    
    # Optional: Link to who created it.
    created_by_id = Column(Integer, ForeignKey("public.users.id"), nullable=True)
    
    created_at = Column(DateTime, default=get_venezuela_now)
    updated_at = Column(DateTime, default=get_venezuela_now, onupdate=datetime.datetime.now)

    def __repr__(self):
        return f"<AdminTask(id={self.id}, title='{self.title}', completed={self.is_completed})>"
