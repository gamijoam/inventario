"""
Commission Config Router — CRUD de reglas y configuración del sistema de comisiones.
Endpoints protegidos: solo ADMIN.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
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
    strict_mode: bool
    class Config: from_attributes = True

class CommissionSettingsUpdate(BaseModel):
    global_enabled: Optional[bool] = None
    pos_module_enabled: Optional[bool] = None
    taller_module_enabled: Optional[bool] = None
    strict_mode: Optional[bool] = None

class CommissionRuleRead(BaseModel):
    id: int
    name: str
    category_id: Optional[int]
    category_name: Optional[str] = None
    module: Optional[str]
    percentage: float
    is_active: bool
    priority: int
    class Config: from_attributes = True

class CommissionRuleCreate(BaseModel):
    name: str
    category_id: Optional[int] = None
    module: Optional[str] = None   # 'POS' | 'TALLER' | None
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

# ── Helpers ────────────────────────────────────────────────────────────────

def _get_or_create_settings(db: Session) -> models.CommissionSettings:
    s = db.query(models.CommissionSettings).first()
    if not s:
        s = models.CommissionSettings(global_enabled=False)
        db.add(s)
        db.commit()
        db.refresh(s)
    return s

# ── Settings ───────────────────────────────────────────────────────────────

@router.get("/settings", response_model=CommissionSettingsRead)
def get_settings(
    db: Session = Depends(get_db),
    _=Depends(has_role([UserRole.ADMIN]))
):
    return _get_or_create_settings(db)

@router.patch("/settings", response_model=CommissionSettingsRead)
def update_settings(
    data: CommissionSettingsUpdate,
    db: Session = Depends(get_db),
    _=Depends(has_role([UserRole.ADMIN]))
):
    s = _get_or_create_settings(db)
    if data.global_enabled is not None:
        s.global_enabled = data.global_enabled
    if data.pos_module_enabled is not None:
        s.pos_module_enabled = data.pos_module_enabled
    if data.taller_module_enabled is not None:
        s.taller_module_enabled = data.taller_module_enabled
    if data.strict_mode is not None:
        s.strict_mode = data.strict_mode
    db.commit()
    db.refresh(s)
    return s

# ── Rules ──────────────────────────────────────────────────────────────────

@router.get("/rules", response_model=List[CommissionRuleRead])
def list_rules(
    db: Session = Depends(get_db),
    _=Depends(has_role([UserRole.ADMIN]))
):
    rules = db.query(models.CommissionRule).order_by(
        models.CommissionRule.priority.desc(),
        models.CommissionRule.id
    ).all()
    result = []
    for r in rules:
        cat_name = r.category.name if r.category else None
        result.append(CommissionRuleRead(
            id=r.id, name=r.name, category_id=r.category_id,
            category_name=cat_name, module=r.module,
            percentage=float(r.percentage), is_active=r.is_active,
            priority=r.priority
        ))
    return result

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
        name=data.name, category_id=data.category_id,
        module=data.module, percentage=Decimal(str(data.percentage)),
        is_active=data.is_active, priority=data.priority
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    cat_name = rule.category.name if rule.category else None
    return CommissionRuleRead(
        id=rule.id, name=rule.name, category_id=rule.category_id,
        category_name=cat_name, module=rule.module,
        percentage=float(rule.percentage), is_active=rule.is_active,
        priority=rule.priority
    )

@router.put("/rules/{rule_id}", response_model=CommissionRuleRead)
def update_rule(
    rule_id: int,
    data: CommissionRuleUpdate,
    db: Session = Depends(get_db),
    _=Depends(has_role([UserRole.ADMIN]))
):
    rule = db.query(models.CommissionRule).filter(models.CommissionRule.id == rule_id).first()
    if not rule:
        raise HTTPException(404, "Regla no encontrada")

    if data.name is not None: rule.name = data.name
    if data.category_id is not None: rule.category_id = data.category_id
    if data.module is not None: rule.module = data.module if data.module != "null" else None
    if data.percentage is not None: rule.percentage = Decimal(str(data.percentage))
    if data.is_active is not None: rule.is_active = data.is_active
    if data.priority is not None: rule.priority = data.priority

    db.commit()
    db.refresh(rule)
    cat_name = rule.category.name if rule.category else None
    return CommissionRuleRead(
        id=rule.id, name=rule.name, category_id=rule.category_id,
        category_name=cat_name, module=rule.module,
        percentage=float(rule.percentage), is_active=rule.is_active,
        priority=rule.priority
    )

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

# ── User rates ─────────────────────────────────────────────────────────────

@router.get("/user-rates")
def list_user_rates(
    db: Session = Depends(get_db),
    _=Depends(has_role([UserRole.ADMIN]))
):
    """Retorna todos los usuarios con sus tasas de comisión."""
    users = db.query(models.User).filter(
        models.User.is_active == True,
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
    _=Depends(has_role([UserRole.ADMIN]))
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(404, "Usuario no encontrado")
    user.commission_vendor_pct = Decimal(str(data.commission_vendor_pct))
    user.commission_technician_pct = Decimal(str(data.commission_technician_pct))
    db.commit()
    return {
        "user_id": user.id,
        "username": user.username,
        "commission_vendor_pct": float(user.commission_vendor_pct),
        "commission_technician_pct": float(user.commission_technician_pct),
    }
