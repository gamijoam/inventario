"""
backend_api/models/desktop_license.py

Modelo para las licencias del producto Invensoft Desktop.
Vive en el schema public (tabla compartida, gestionada por el SaaS).

Flujo:
  1. Admin SaaS crea una licencia con POST /api/v1/desktop/licenses
  2. Cliente recibe la clave (XXXX-XXXX-XXXX-XXXX) al comprar
  3. Cliente activa con POST /api/v1/desktop/license/activate
  4. El desktop recibe los módulos habilitados y expiry
"""
import datetime
from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, Text, Numeric
)
from ..database.db import Base
from ..utils.time_utils import get_venezuela_now


class DesktopLicense(Base):
    """
    Licencia para la versión de escritorio (Tauri).
    Cada registro es una clave vendida a un cliente.
    """
    __tablename__ = "desktop_licenses"
    __table_args__ = {"schema": "public"}

    id          = Column(Integer, primary_key=True, index=True)

    # Clave de activación: formato XXXX-XXXX-XXXX-XXXX
    license_key = Column(String(20), unique=True, nullable=False, index=True)

    # Nombre del plan (informativo, para la UI del SaaS admin)
    plan_name   = Column(String(50), nullable=False, default="basic")
    # Ej: "basic", "restaurant", "laundry", "barbershop", "full"

    # ── Módulos habilitados ───────────────────────────────────────────────────
    has_restaurant_module = Column(Boolean, default=False, nullable=False)
    has_laundry_module    = Column(Boolean, default=False, nullable=False)
    has_hardware_module   = Column(Boolean, default=True,  nullable=False)
    has_services_module   = Column(Boolean, default=False, nullable=False)
    has_barbershop_module = Column(Boolean, default=False, nullable=False)

    # ── Control de activaciones ───────────────────────────────────────────────
    max_devices        = Column(Integer, default=1, nullable=False)
    activations_count  = Column(Integer, default=0, nullable=False)

    # ── Vigencia ──────────────────────────────────────────────────────────────
    # None = licencia perpetua
    expires_at = Column(DateTime, nullable=True)

    # ── Estado ───────────────────────────────────────────────────────────────
    is_active = Column(Boolean, default=True, nullable=False)

    # ── Datos del cliente (referencia) ────────────────────────────────────────
    customer_name  = Column(String(200), nullable=True)
    customer_email = Column(String(200), nullable=True)
    notes          = Column(Text, nullable=True)

    # ── Auditoría ─────────────────────────────────────────────────────────────
    created_at = Column(DateTime, default=get_venezuela_now)
    updated_at = Column(DateTime, default=get_venezuela_now,
                        onupdate=datetime.datetime.now)

    def __repr__(self):
        return (
            f"<DesktopLicense(key='{self.license_key}', "
            f"plan='{self.plan_name}', active={self.is_active})>"
        )

    def modules_dict(self) -> dict:
        """Devuelve los módulos como dict para la respuesta JSON."""
        return {
            "restaurant": self.has_restaurant_module,
            "laundry":    self.has_laundry_module,
            "hardware":   self.has_hardware_module,
            "services":   self.has_services_module,
            "barbershop": self.has_barbershop_module,
        }

    @property
    def is_expired(self) -> bool:
        if self.expires_at is None:
            return False
        return datetime.datetime.utcnow() > self.expires_at

    @property
    def is_valid(self) -> bool:
        return self.is_active and not self.is_expired
