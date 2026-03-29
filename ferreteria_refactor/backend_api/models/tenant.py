from sqlalchemy import Column, Integer, String, Boolean, DateTime, JSON
from sqlalchemy.dialects.postgresql import JSONB
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
    
    # Subscription / License Logic
    is_demo = Column(Boolean, default=True) # New tenants are Demo by default usually
    license_type = Column(String(20), default="trial", nullable=False, server_default="lifetime")
    trial_days = Column(Integer, default=2, nullable=False, server_default="2")
    trial_ends_at = Column(DateTime, nullable=True)
    subscription_expires_at = Column(DateTime, nullable=True) # NULL means forever or undefined
    license_blocked_reason = Column(String(50), nullable=True)

    # Stores feature flags: {"restaurant": true, "laundry": false}
    config = Column(JSON, default=dict)
    
    # NEW: Specific Sector/Rubro Label
    business_type = Column(String, nullable=True) # e.g. "Abasto", "Ferretería"

    # Module Flags (NEW System)
    has_restaurant_module = Column(Boolean, default=False)
    has_laundry_module = Column(Boolean, default=False)
    has_hardware_module = Column(Boolean, default=False)
    has_services_module = Column(Boolean, default=False)
    has_barbershop_module = Column(Boolean, default=False)
    has_pharmacy_module = Column(Boolean, default=False)

    # Feature flags a la carta — activadas individualmente por tenant desde el panel admin
    # Ejemplo: {"descuento_especial": true, "reporte_avanzado": false}
    feature_flags = Column(JSONB, nullable=False, server_default='{}')

    def __repr__(self):
        return f"<Tenant(name={self.name}, schema={self.schema_name})>"
