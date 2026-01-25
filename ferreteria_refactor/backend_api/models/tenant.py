from sqlalchemy import Column, Integer, String, Boolean, DateTime, JSON
from ..database.db import Base
from ..utils.time_utils import get_venezuela_now

class Tenant(Base):
    __tablename__ = "tenants"
    __table_args__ = {"schema": "public"}  # Always resides in public schema

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    schema_name = Column(String, unique=True, index=True, nullable=False)
    domain = Column(String, nullable=True, unique=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=get_venezuela_now)
    
    # Stores feature flags: {"restaurant": true, "laundry": false}
    config = Column(JSON, default=dict)

    def __repr__(self):
        return f"<Tenant(name={self.name}, schema={self.schema_name})>"
