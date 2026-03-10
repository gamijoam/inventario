from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from ..database.db import Base
from ..utils.time_utils import get_venezuela_now


class DesktopLicense(Base):
    """
    Represents a desktop application license key associated with a tenant.
    Each license can have multiple activations (devices), tracked by device_id.
    """
    __tablename__ = "desktop_licenses"
    __table_args__ = {"schema": "public"}

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("public.tenants.id", ondelete="CASCADE"), nullable=False, index=True)

    # License identification
    license_key = Column(String(64), unique=True, nullable=False, index=True)
    plan_name = Column(String(50), nullable=False, default="trial")  # trial, monthly, annual, lifetime

    # Device / activation info
    device_id = Column(String(128), nullable=True, index=True)   # Hardware fingerprint
    device_label = Column(String(255), nullable=True)             # Human-readable label e.g. "PC Caja 1"

    # Timestamps
    activated_at = Column(DateTime, nullable=True)
    last_seen_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=True)  # NULL = lifetime
    created_at = Column(DateTime, default=get_venezuela_now, nullable=False)

    # Status flags
    is_active = Column(Boolean, default=True, nullable=False)
    is_revoked = Column(Boolean, default=False, nullable=False)
    revoked_reason = Column(String(255), nullable=True)
    revoked_at = Column(DateTime, nullable=True)

    # Activation tracking
    activations_count = Column(Integer, default=0, nullable=False)
    max_activations = Column(Integer, default=1, nullable=False)

    # Optional: JWT payload or extra metadata
    notes = Column(Text, nullable=True)

    def __repr__(self):
        return f"<DesktopLicense(key={self.license_key!r}, tenant_id={self.tenant_id}, plan={self.plan_name!r})>"
