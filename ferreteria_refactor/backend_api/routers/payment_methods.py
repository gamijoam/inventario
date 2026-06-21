from fastapi import APIRouter, Depends, HTTPException
from ..cache import invalidate_resource
from sqlalchemy.orm import Session
from ..database.db import get_db
from ..models import models
from pydantic import BaseModel
from typing import List, Optional
from ..dependencies import require_permission

router = APIRouter(
    prefix="/payment-methods",
    tags=["payment-methods"]
)


def _normalize_currency_code(value: Optional[str]) -> str:
    raw = (value or "FLEX").strip().upper()
    if raw in {"", "ALL", "ANY", "*", "FLEXIBLE"}:
        return "FLEX"
    if raw in {"$", "DOLLAR", "DOLAR", "DÓLAR"}:
        return "USD"
    if raw in {"BS", "BSS", "VEF", "BOLIVAR", "BOLÍVAR"}:
        return "VES"
    return raw


def _invalidate_payment_cache():
    try:
        from ..tenant_context import get_tenant_schema
        schema = get_tenant_schema()
        for resource in ("pos_init", "pos-init", "payment_methods"):
            invalidate_resource(schema, resource)
    except Exception:
        pass

class PaymentMethodBase(BaseModel):
    name: str
    is_active: bool = True
    requires_reference: bool = False
    is_external_financer: bool = False  # Cashea, Krece, etc.
    currency_code: str = "FLEX"
    allows_change: bool = True

class PaymentMethodCreate(PaymentMethodBase):
    pass

class PaymentMethodUpdate(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None
    requires_reference: Optional[bool] = None
    is_external_financer: Optional[bool] = None
    currency_code: Optional[str] = None
    allows_change: Optional[bool] = None

class PaymentMethodResponse(PaymentMethodBase):
    id: int
    is_system: Optional[bool] = False
    requires_reference: Optional[bool] = False
    is_external_financer: Optional[bool] = False
    allows_change: Optional[bool] = True
    currency_code: Optional[str] = 'FLEX'
    currency: Optional[str] = 'FLEX'

    class Config:
        from_attributes = True

@router.get("/", response_model=List[PaymentMethodResponse])
@router.get("", response_model=List[PaymentMethodResponse], include_in_schema=False)
def get_payment_methods(db: Session = Depends(get_db)):
    from ..tenant_context import get_tenant_schema
    current_schema = get_tenant_schema()
    if current_schema == 'public':
        return []
    return db.query(models.PaymentMethod).all()

@router.post("/", response_model=PaymentMethodResponse, dependencies=[Depends(require_permission("config.payment_methods.manage"))])
@router.post("", response_model=PaymentMethodResponse, include_in_schema=False, dependencies=[Depends(require_permission("config.payment_methods.manage"))])
def create_payment_method(  # cache invalidation applied
method: PaymentMethodCreate, db: Session = Depends(get_db)):
    existing = db.query(models.PaymentMethod).filter(models.PaymentMethod.name == method.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Payment method already exists")
    
    new_method = models.PaymentMethod(
        name=method.name,
        is_active=method.is_active,
        requires_reference=method.requires_reference,
        is_external_financer=method.is_external_financer,
        is_system=False,
        currency_code=_normalize_currency_code(method.currency_code),
        allows_change=method.allows_change
    )
    db.add(new_method)
    db.flush()
    
    resp_obj = PaymentMethodResponse(
        id=new_method.id,
        name=new_method.name,
        is_active=new_method.is_active,
        requires_reference=new_method.requires_reference,
        is_external_financer=new_method.is_external_financer,
        is_system=new_method.is_system,
        currency_code=new_method.currency_code,
        currency=new_method.currency_code,
        allows_change=new_method.allows_change
    )
    db.commit()
    _invalidate_payment_cache()
    return resp_obj

@router.put("/{method_id}", response_model=PaymentMethodResponse, dependencies=[Depends(require_permission("config.payment_methods.manage"))])
def update_payment_method(  # cache invalidation applied
method_id: int, method: PaymentMethodUpdate, db: Session = Depends(get_db)):
    db_method = db.query(models.PaymentMethod).filter(models.PaymentMethod.id == method_id).first()
    if not db_method:
        raise HTTPException(status_code=404, detail="Payment method not found")
    
    if method.name:
        if method.name != db_method.name:
            existing = db.query(models.PaymentMethod).filter(models.PaymentMethod.name == method.name).first()
            if existing:
                raise HTTPException(status_code=400, detail="Name already exists")
        db_method.name = method.name
        
    if method.is_active is not None:
        db_method.is_active = method.is_active

    if method.requires_reference is not None:
        db_method.requires_reference = method.requires_reference

    if method.is_external_financer is not None:
        db_method.is_external_financer = method.is_external_financer

    if method.currency_code is not None:
        db_method.currency_code = _normalize_currency_code(method.currency_code)

    if method.allows_change is not None:
        db_method.allows_change = method.allows_change
        
    db.flush()
    
    resp_obj = PaymentMethodResponse(
        id=db_method.id,
        name=db_method.name,
        is_active=db_method.is_active,
        requires_reference=db_method.requires_reference,
        is_external_financer=db_method.is_external_financer,
        is_system=db_method.is_system,
        currency_code=db_method.currency_code,
        currency=db_method.currency_code,
        allows_change=db_method.allows_change
    )
    db.commit()
    _invalidate_payment_cache()
    return resp_obj

@router.delete("/{method_id}", dependencies=[Depends(require_permission("config.payment_methods.manage"))])
def delete_payment_method(  # cache invalidation applied
method_id: int, db: Session = Depends(get_db)):
    db_method = db.query(models.PaymentMethod).filter(models.PaymentMethod.id == method_id).first()
    if not db_method:
        raise HTTPException(status_code=404, detail="Payment method not found")
    if db_method.is_system:
        raise HTTPException(status_code=400, detail="Cannot delete system payment methods")
    db.delete(db_method)
    db.commit()
    _invalidate_payment_cache()
    return {"message": "Payment method deleted"}
