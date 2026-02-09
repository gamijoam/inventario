from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Numeric, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from .models import Base  # Assuming Base is in models.py or similar

class TenantPayment(Base):
    __tablename__ = "tenant_payments"
    __table_args__ = {"schema": "public"}  # Shared table

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("public.tenants.id"), nullable=False)
    
    amount = Column(Numeric(10, 2), nullable=False)
    currency = Column(String(3), nullable=False) # USD, VES
    payment_method = Column(String(50), nullable=False) # zelle, transfer, cash, etc.
    reference = Column(String(100), nullable=True)
    status = Column(String(20), default="completed") # completed, pending
    notes = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    tenant = relationship("Tenant", backref="tenant_payments")
