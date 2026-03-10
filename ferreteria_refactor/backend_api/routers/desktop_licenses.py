"""
Router: Desktop License Management (Superuser only)
Prefix: /admin/desktop-licenses
Tag:    Admin - Desktop Licenses
"""
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database.db import get_db
from ..dependencies import get_current_superuser
from ..models.models import User
from ..models.desktop_license import DesktopLicense

router = APIRouter(
    prefix="/admin/desktop-licenses",
    tags=["Admin - Desktop Licenses"],
    dependencies=[Depends(get_current_superuser)],
)


# ─── Schemas ─────────────────────────────────────────────────────────────────

class DesktopLicenseOut(BaseModel):
    id: int
    tenant_id: int
    license_key: str
    plan_name: str
    device_id: Optional[str] = None
    device_label: Optional[str] = None
    activated_at: Optional[datetime] = None
    last_seen_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    created_at: datetime
    is_active: bool
    is_revoked: bool
    revoked_reason: Optional[str] = None
    revoked_at: Optional[datetime] = None
    activations_count: int
    max_activations: int
    notes: Optional[str] = None

    model_config = {"from_attributes": True}


class RevokeRequest(BaseModel):
    reason: Optional[str] = "manual"


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("/", response_model=List[DesktopLicenseOut])
def list_desktop_licenses(
    tenant_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
):
    """
    List all desktop licenses.
    Optionally filter by tenant_id (e.g. GET /admin/desktop-licenses/?tenant_id=3).
    """
    q = db.query(DesktopLicense)
    if tenant_id is not None:
        q = q.filter(DesktopLicense.tenant_id == tenant_id)
    return q.order_by(DesktopLicense.created_at.desc()).all()


@router.get("/{license_id}", response_model=DesktopLicenseOut)
def get_desktop_license(
    license_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
):
    """Get a single desktop license by ID."""
    lic = db.query(DesktopLicense).filter(DesktopLicense.id == license_id).first()
    if not lic:
        raise HTTPException(status_code=404, detail="Desktop license not found")
    return lic


@router.patch("/{license_id}/revoke", response_model=DesktopLicenseOut)
def revoke_desktop_license(
    license_id: int,
    body: RevokeRequest = RevokeRequest(),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
):
    """
    Revoke a desktop license.
    Sets is_revoked=True, is_active=False, records reason and timestamp.
    """
    lic = db.query(DesktopLicense).filter(DesktopLicense.id == license_id).first()
    if not lic:
        raise HTTPException(status_code=404, detail="Desktop license not found")
    if lic.is_revoked:
        raise HTTPException(status_code=400, detail="License is already revoked")

    lic.is_revoked = True
    lic.is_active = False
    lic.revoked_reason = body.reason or "manual"
    lic.revoked_at = datetime.utcnow()

    db.commit()
    db.refresh(lic)
    return lic


@router.patch("/{license_id}/reactivate", response_model=DesktopLicenseOut)
def reactivate_desktop_license(
    license_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
):
    """Reactivate a previously revoked desktop license."""
    lic = db.query(DesktopLicense).filter(DesktopLicense.id == license_id).first()
    if not lic:
        raise HTTPException(status_code=404, detail="Desktop license not found")
    if not lic.is_revoked:
        raise HTTPException(status_code=400, detail="License is not revoked")

    lic.is_revoked = False
    lic.is_active = True
    lic.revoked_reason = None
    lic.revoked_at = None

    db.commit()
    db.refresh(lic)
    return lic


@router.delete("/{license_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_desktop_license(
    license_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
):
    """Hard-delete a desktop license record."""
    lic = db.query(DesktopLicense).filter(DesktopLicense.id == license_id).first()
    if not lic:
        raise HTTPException(status_code=404, detail="Desktop license not found")
    db.delete(lic)
    db.commit()
    return None
