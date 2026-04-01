"""
Onboarding Router — Mi Inventario Fácil
Maneja el estado del wizard de configuración inicial del tenant.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
from typing import Optional

from ..database.db import get_db
from ..dependencies import get_current_active_user, has_role
from ..models.models import UserRole
admin_required = has_role([UserRole.ADMIN])
from ..tenant_context import get_tenant_schema

router = APIRouter(prefix="/onboarding", tags=["onboarding"])


class OnboardingStatus(BaseModel):
    completed: bool
    step: int                  # 0=no iniciado, 1=negocio, 2=productos, 3=completo


class StepUpdate(BaseModel):
    step: int
    completed: Optional[bool] = None


# ── GET /onboarding/status ────────────────────────────────────
@router.get("/status", response_model=OnboardingStatus)
def get_onboarding_status(
    current_user=Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Retorna el estado actual del onboarding para este tenant."""
    schema = get_tenant_schema()
    
    # Si no hay schema de tenant (ej: super admin), marcar como completado
    if not schema or schema == "public":
        return OnboardingStatus(completed=True, step=3)

    row = db.execute(
        text("SELECT onboarding_completed, onboarding_step FROM public.tenants WHERE schema_name = :s"),
        {"s": schema}
    ).fetchone()

    # Si no existe el tenant o faltan columnas, asumir completado (no mostrar wizard)
    if not row:
        return OnboardingStatus(completed=True, step=3)

    return OnboardingStatus(completed=bool(row[0]), step=int(row[1] or 0))


# ── POST /onboarding/step ─────────────────────────────────────
@router.post("/step", response_model=OnboardingStatus)
def update_onboarding_step(
    data: StepUpdate,
    current_user=Depends(admin_required),
    db: Session = Depends(get_db)
):
    """Actualiza el paso actual del onboarding. Solo admin."""
    schema = get_tenant_schema()

    completed = data.completed if data.completed is not None else (data.step >= 3)

    db.execute(
        text("""UPDATE public.tenants
                SET onboarding_step = :step,
                    onboarding_completed = :completed
                WHERE schema_name = :s"""),
        {"step": data.step, "completed": completed, "s": schema}
    )
    db.commit()

    return OnboardingStatus(completed=completed, step=data.step)


# ── POST /onboarding/complete ─────────────────────────────────
@router.post("/complete", response_model=OnboardingStatus)
def complete_onboarding(
    current_user=Depends(admin_required),
    db: Session = Depends(get_db)
):
    """Marca el onboarding como completado definitivamente."""
    schema = get_tenant_schema()
    db.execute(
        text("""UPDATE public.tenants
                SET onboarding_completed = true, onboarding_step = 3
                WHERE schema_name = :s"""),
        {"s": schema}
    )
    db.commit()
    return OnboardingStatus(completed=True, step=3)
