"""
backend_api/routers/desktop_licenses.py

Endpoints para el sistema de licencias de Invensoft Desktop.

Públicos (sin auth):
  POST /desktop/license/activate   — el cliente activa su licencia

Admin SaaS (requiere is_superuser):
  GET  /desktop/licenses           — listar todas las licencias
  POST /desktop/licenses           — crear nueva licencia
  PUT  /desktop/licenses/{id}      — editar licencia
  DELETE /desktop/licenses/{id}    — desactivar licencia
"""
import secrets
import string
import datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from sqlalchemy import text

from ..database.db import get_db
from ..dependencies import get_current_superuser
from ..models.desktop_license import DesktopLicense
from ..utils.time_utils import get_venezuela_now

router = APIRouter(prefix="/desktop")


# ── Schemas ───────────────────────────────────────────────────────────────────

class LicenseActivateRequest(BaseModel):
    license_key: str


class LicenseActivateResponse(BaseModel):
    valid:      bool
    token:      str
    expires_at: Optional[str]   # ISO 8601 o null (perpetua)
    plan:       str
    modules:    dict


class LicenseCreate(BaseModel):
    customer_name:  str
    customer_email: Optional[str] = None
    plan_name:      str = "basic"
    # Módulos
    has_restaurant_module: bool = False
    has_laundry_module:    bool = False
    has_hardware_module:   bool = True
    has_services_module:   bool = False
    has_barbershop_module: bool = False
    # Control
    max_devices: int = 1
    expires_at:  Optional[datetime.datetime] = None   # None = perpetua
    notes:       Optional[str] = None


class LicenseUpdate(BaseModel):
    customer_name:  Optional[str] = None
    customer_email: Optional[str] = None
    plan_name:      Optional[str] = None
    has_restaurant_module: Optional[bool] = None
    has_laundry_module:    Optional[bool] = None
    has_hardware_module:   Optional[bool] = None
    has_services_module:   Optional[bool] = None
    has_barbershop_module: Optional[bool] = None
    max_devices:  Optional[int] = None
    expires_at:   Optional[datetime.datetime] = None
    is_active:    Optional[bool] = None
    notes:        Optional[str] = None


class LicenseOut(BaseModel):
    id:           int
    license_key:  str
    plan_name:    str
    customer_name:  Optional[str]
    customer_email: Optional[str]
    has_restaurant_module: bool
    has_laundry_module:    bool
    has_hardware_module:   bool
    has_services_module:   bool
    has_barbershop_module: bool
    max_devices:       int
    activations_count: int
    expires_at:  Optional[datetime.datetime]
    is_active:   bool
    notes:       Optional[str]
    created_at:  Optional[datetime.datetime]

    class Config:
        from_attributes = True


# ── Helpers ───────────────────────────────────────────────────────────────────

def _generate_license_key() -> str:
    """Genera una clave con formato XXXX-XXXX-XXXX-XXXX (A-Z0-9)."""
    chars = string.ascii_uppercase + string.digits
    groups = [''.join(secrets.choice(chars) for _ in range(4)) for _ in range(4)]
    return '-'.join(groups)


def _use_public_schema(db: Session):
    """Fuerza el schema public para queries de esta tabla."""
    db.execute(text("SET search_path TO public"))


# ── Endpoint público: activación de licencia ──────────────────────────────────

@router.post("/license/activate", response_model=LicenseActivateResponse,
             summary="Activar licencia desktop (público)")
def activate_license(
    payload: LicenseActivateRequest,
    db: Session = Depends(get_db),
):
    """
    El cliente envía su clave de licencia.
    Retorna los módulos habilitados y la fecha de expiración.
    No requiere autenticación.
    """
    _use_public_schema(db)
    key = payload.license_key.strip().upper()

    lic: DesktopLicense = (
        db.query(DesktopLicense)
        .filter(DesktopLicense.license_key == key)
        .first()
    )

    if not lic:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Código de licencia no encontrado.",
        )

    if not lic.is_active:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Licencia suspendida. Contacta al soporte en miinventariofacil.com",
        )

    if lic.is_expired:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Licencia vencida. Renuévala en miinventariofacil.com",
        )

    if lic.activations_count >= lic.max_devices:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Límite de dispositivos alcanzado ({lic.max_devices}). "
                "Contacta al soporte para ampliar tu licencia."
            ),
        )

    # Incrementar contador de activaciones
    lic.activations_count += 1
    lic.updated_at = get_venezuela_now()
    db.commit()

    return LicenseActivateResponse(
        valid=True,
        token=lic.license_key,          # El token ES la misma clave
        expires_at=lic.expires_at.isoformat() if lic.expires_at else None,
        plan=lic.plan_name,
        modules=lic.modules_dict(),
    )


# ── Endpoints admin SaaS (solo superusuarios) ─────────────────────────────────

@router.get("/licenses", response_model=List[LicenseOut],
            summary="Listar licencias desktop [Admin]")
def list_licenses(
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_superuser),
):
    _use_public_schema(db)
    return db.query(DesktopLicense).order_by(DesktopLicense.created_at.desc()).all()


@router.post("/licenses", response_model=LicenseOut, status_code=201,
             summary="Crear licencia desktop [Admin]")
def create_license(
    data: LicenseCreate,
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_superuser),
):
    _use_public_schema(db)

    # Generar clave única
    for _ in range(10):
        key = _generate_license_key()
        if not db.query(DesktopLicense).filter(DesktopLicense.license_key == key).first():
            break
    else:
        raise HTTPException(status_code=500, detail="No se pudo generar clave única.")

    lic = DesktopLicense(
        license_key=key,
        plan_name=data.plan_name,
        customer_name=data.customer_name,
        customer_email=data.customer_email,
        has_restaurant_module=data.has_restaurant_module,
        has_laundry_module=data.has_laundry_module,
        has_hardware_module=data.has_hardware_module,
        has_services_module=data.has_services_module,
        has_barbershop_module=data.has_barbershop_module,
        max_devices=data.max_devices,
        expires_at=data.expires_at,
        notes=data.notes,
    )
    db.add(lic)
    db.commit()
    db.refresh(lic)
    return lic


@router.put("/licenses/{license_id}", response_model=LicenseOut,
            summary="Editar licencia desktop [Admin]")
def update_license(
    license_id: int,
    data: LicenseUpdate,
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_superuser),
):
    _use_public_schema(db)
    lic = db.query(DesktopLicense).filter(DesktopLicense.id == license_id).first()
    if not lic:
        raise HTTPException(status_code=404, detail="Licencia no encontrada.")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(lic, field, value)
    lic.updated_at = get_venezuela_now()
    db.commit()
    db.refresh(lic)
    return lic


@router.delete("/licenses/{license_id}", status_code=204,
               summary="Desactivar licencia desktop [Admin]")
def deactivate_license(
    license_id: int,
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_superuser),
):
    _use_public_schema(db)
    lic = db.query(DesktopLicense).filter(DesktopLicense.id == license_id).first()
    if not lic:
        raise HTTPException(status_code=404, detail="Licencia no encontrada.")
    lic.is_active = False
    lic.updated_at = get_venezuela_now()
    db.commit()
