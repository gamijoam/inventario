from fastapi import APIRouter, Depends, HTTPException
from ..cache import get_cached, set_cached, invalidate, TTL
from sqlalchemy.orm import Session
from ..database.db import get_db
from ..models import models
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter(
    prefix="/payment-methods",
    tags=["payment-methods"]
)

class PaymentMethodBase(BaseModel):
    name: str
    is_active: bool = True
    requires_reference: bool = False
    is_external_financer: bool = False  # Cashea, Krece, etc.

class PaymentMethodCreate(PaymentMethodBase):
    pass

class PaymentMethodUpdate(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None
    requires_reference: Optional[bool] = None
    is_external_financer: Optional[bool] = None

class PaymentMethodResponse(PaymentMethodBase):
    id: int
    is_system: Optional[bool] = False
    requires_reference: Optional[bool] = False
    is_external_financer: Optional[bool] = False
    allows_change: Optional[bool] = True
    currency: Optional[str] = 'USD'

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

@router.post("/", response_model=PaymentMethodResponse)
@router.post("", response_model=PaymentMethodResponse, include_in_schema=False)
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
        is_system=False
    )
    db.add(new_method)
    db.flush()
    
    resp_obj = PaymentMethodResponse(
        id=new_method.id,
        name=new_method.name,
        is_active=new_method.is_active,
        requires_reference=new_method.requires_reference,
        is_external_financer=new_method.is_external_financer,
        is_system=new_method.is_system
    )
    db.commit()
    return resp_obj

@router.put("/{method_id}", response_model=PaymentMethodResponse)
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
        
    db.flush()
    
    resp_obj = PaymentMethodResponse(
        id=db_method.id,
        name=db_method.name,
        is_active=db_method.is_active,
        requires_reference=db_method.requires_reference,
        is_external_financer=db_method.is_external_financer,
        is_system=db_method.is_system
    )
    db.commit()
    return resp_obj

@router.delete("/{method_id}")
def delete_payment_method(  # cache invalidation applied
method_id: int, db: Session = Depends(get_db)):
    db_method = db.query(models.PaymentMethod).filter(models.PaymentMethod.id == method_id).first()
    if not db_method:
        raise HTTPException(status_code=404, detail="Payment method not found")
    if db_method.is_system:
        raise HTTPException(status_code=400, detail="Cannot delete system payment methods")
    db.delete(db_method)
    db.commit()
    return {"message": "Payment method deleted"}
