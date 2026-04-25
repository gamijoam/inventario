"""
Commission Config Router — CRUD de reglas y configuración del sistema de comisiones.
Endpoints protegidos: solo ADMIN.

PATRÓN OBLIGATORIO para este proyecto (multi-tenant con search_path):
  db.flush()   → obtiene IDs y hace relaciones visibles dentro de la sesión
  [queries]    → todas las lecturas ANTES del commit (search_path aún válido)
  db.commit()  → siempre AL FINAL, nunca en el medio
  return datos → construidos ANTES del commit, sin re-query post-commit
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel
from typing import Optional, List
from decimal import Decimal
from ..database.db import get_db
from ..dependencies import has_role
from ..models import models
from ..models.models import UserRole

router = APIRouter(prefix="/commission-config", tags=["Comisiones - Configuración"])

# ── Schemas ────────────────────────────────────────────────────────────────

class CommissionSettingsRead(BaseModel):
    id: int
    global_enabled: bool
    pos_module_enabled: bool
    taller_module_enabled: bool
    taller_vendor_commission_enabled: bool
    strict_mode: bool
    class Config: from_attributes = True

class CommissionSettingsUpdate(BaseModel):
    global_enabled: Optional[bool] = None
    pos_module_enabled: Optional[bool] = None
    taller_module_enabled: Optional[bool] = None
    taller_vendor_commission_enabled: Optional[bool] = None
    strict_mode: Optional[bool] = None

class CommissionRuleRead(BaseModel):
    id: int
    name: str
    category_id: Optional[int] = None
    category_name: Optional[str] = None
    module: Optional[str] = None
    percentage: float
    is_active: bool
    priority: int

class CommissionRuleCreate(BaseModel):
    name: str
    category_id: Optional[int] = None
    module: Optional[str] = None
    percentage: float
    is_active: bool = True
    priority: int = 0

class CommissionRuleUpdate(BaseModel):
    name: Optional[str] = None
    category_id: Optional[int] = None
    module: Optional[str] = None
    percentage: Optional[float] = None
    is_active: Optional[bool] = None
    priority: Optional[int] = None

class UserCommissionRates(BaseModel):
    user_id: int
    commission_vendor_pct: float
    commission_technician_pct: float

# ── Helper: construir dict de regla dentro de la misma sesión ──────────────

def _rule_to_dict(rule: models.CommissionRule) -> CommissionRuleRead:
    cat_name = rule.category.name if rule.category else None
    return CommissionRuleRead(
        id=rule.id, name=rule.name,
        category_id=rule.category_id, category_name=cat_name,
        module=rule.module, percentage=float(rule.percentage),
        is_active=rule.is_active, priority=rule.priority,
    )

# ── Helper: obtener o crear settings (SOLO flush, nunca commit aquí) ───────

def _get_or_create_settings(db: Session) -> models.CommissionSettings:
    s = db.query(models.CommissionSettings).first()
    if not s:
        s = models.CommissionSettings(global_enabled=False)
        db.add(s)
        db.flush()   # obtiene ID sin romper el search_path del tenant
    return s

# ── SETTINGS ───────────────────────────────────────────────────────────────

@router.get("/settings", response_model=CommissionSettingsRead)
def get_settings(
    db: Session = Depends(get_db),
    _=Depends(has_role([UserRole.ADMIN]))
):
    s = _get_or_create_settings(db)
    result = CommissionSettingsRead(
        id=s.id,
        global_enabled=bool(s.global_enabled),
        pos_module_enabled=bool(s.pos_module_enabled),
        taller_module_enabled=bool(s.taller_module_enabled),
        taller_vendor_commission_enabled=bool(s.taller_vendor_commission_enabled or False),
        strict_mode=bool(s.strict_mode),
    )
    db.commit()
    return result

@router.patch("/settings", response_model=CommissionSettingsRead)
def update_settings(
    data: CommissionSettingsUpdate,
    db: Session = Depends(get_db),
    _=Depends(has_role([UserRole.ADMIN]))
):
    s = _get_or_create_settings(db)
    if data.global_enabled is not None:                     s.global_enabled = data.global_enabled
    if data.pos_module_enabled is not None:                 s.pos_module_enabled = data.pos_module_enabled
    if data.taller_module_enabled is not None:              s.taller_module_enabled = data.taller_module_enabled
    if data.taller_vendor_commission_enabled is not None:   s.taller_vendor_commission_enabled = data.taller_vendor_commission_enabled
    if data.strict_mode is not None:                        s.strict_mode = data.strict_mode

    result = CommissionSettingsRead(
        id=s.id,
        global_enabled=bool(s.global_enabled),
        pos_module_enabled=bool(s.pos_module_enabled),
        taller_module_enabled=bool(s.taller_module_enabled),
        taller_vendor_commission_enabled=bool(s.taller_vendor_commission_enabled or False),
        strict_mode=bool(s.strict_mode),
    )
    db.commit()
    return result

# ── RULES ──────────────────────────────────────────────────────────────────

@router.get("/rules", response_model=List[CommissionRuleRead])
def list_rules(
    db: Session = Depends(get_db),
    _=Depends(has_role([UserRole.ADMIN]))
):
    rules = (
        db.query(models.CommissionRule)
        .options(joinedload(models.CommissionRule.category))
        .order_by(models.CommissionRule.priority.desc(), models.CommissionRule.id)
        .all()
    )
    return [_rule_to_dict(r) for r in rules]

@router.post("/rules", response_model=CommissionRuleRead, status_code=201)
def create_rule(
    data: CommissionRuleCreate,
    db: Session = Depends(get_db),
    _=Depends(has_role([UserRole.ADMIN]))
):
    if data.category_id:
        cat = db.query(models.Category).filter(models.Category.id == data.category_id).first()
        if not cat:
            raise HTTPException(404, "Categoría no encontrada")

    rule = models.CommissionRule(
        name=data.name,
        category_id=data.category_id,
        module=data.module or None,
        percentage=Decimal(str(data.percentage)),
        is_active=data.is_active,
        priority=data.priority,
    )
    db.add(rule)
    db.flush()  # obtiene rule.id y hace visible la regla en la sesión

    # Leer categoría DENTRO de la misma sesión (antes del commit)
    rule_with_cat = (
        db.query(models.CommissionRule)
        .options(joinedload(models.CommissionRule.category))
        .filter(models.CommissionRule.id == rule.id)
        .first()
    )
    result = _rule_to_dict(rule_with_cat)
    db.commit()   # commit AL FINAL
    return result

@router.put("/rules/{rule_id}", response_model=CommissionRuleRead)
def update_rule(
    rule_id: int,
    data: CommissionRuleUpdate,
    db: Session = Depends(get_db),
    _=Depends(has_role([UserRole.ADMIN]))
):
    rule = (
        db.query(models.CommissionRule)
        .options(joinedload(models.CommissionRule.category))
        .filter(models.CommissionRule.id == rule_id)
        .first()
    )
    if not rule:
        raise HTTPException(404, "Regla no encontrada")

    if data.name is not None:       rule.name = data.name
    if data.category_id is not None:
        rule.category_id = data.category_id
        # Refrescar categoría en memoria si cambió
        rule.category = db.query(models.Category).filter(
            models.Category.id == data.category_id
        ).first() if data.category_id else None
    if data.module is not None:     rule.module = data.module if data.module not in ("null", "") else None
    if data.percentage is not None: rule.percentage = Decimal(str(data.percentage))
    if data.is_active is not None:  rule.is_active = data.is_active
    if data.priority is not None:   rule.priority = data.priority

    db.flush()
    result = _rule_to_dict(rule)  # capturar ANTES del commit
    db.commit()
    return result

@router.delete("/rules/{rule_id}", status_code=204)
def delete_rule(
    rule_id: int,
    db: Session = Depends(get_db),
    _=Depends(has_role([UserRole.ADMIN]))
):
    rule = db.query(models.CommissionRule).filter(models.CommissionRule.id == rule_id).first()
    if not rule:
        raise HTTPException(404, "Regla no encontrada")
    db.delete(rule)
    db.commit()

# ── USER RATES ─────────────────────────────────────────────────────────────

@router.get("/user-rates")
def list_user_rates(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(has_role([UserRole.ADMIN]))
):
    users = db.query(models.User).filter(
        models.User.is_active == True,
        models.User.tenant_id == current_user.tenant_id,
        models.User.role.in_([UserRole.ADMIN, UserRole.CASHIER])
    ).all()
    return [
        {
            "user_id": u.id,
            "username": u.username,
            "full_name": u.full_name,
            "role": u.role.value,
            "commission_vendor_pct": float(u.commission_vendor_pct or 0),
            "commission_technician_pct": float(u.commission_technician_pct or 0),
        }
        for u in users
    ]

@router.patch("/user-rates/{user_id}")
def update_user_rates(
    user_id: int,
    data: UserCommissionRates,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(has_role([UserRole.ADMIN]))
):
    user = db.query(models.User).filter(
        models.User.id == user_id,
        models.User.tenant_id == current_user.tenant_id,
    ).first()
    if not user:
        raise HTTPException(404, "Usuario no encontrado o no pertenece a tu cuenta")

    user.commission_vendor_pct = Decimal(str(data.commission_vendor_pct))
    user.commission_technician_pct = Decimal(str(data.commission_technician_pct))

    # Capturar antes del commit
    result = {
        "user_id": user.id,
        "username": user.username,
        "commission_vendor_pct": float(user.commission_vendor_pct),
        "commission_technician_pct": float(user.commission_technician_pct),
    }
    db.commit()
    return result
