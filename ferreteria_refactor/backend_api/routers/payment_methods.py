from fastapi import APIRouter, Depends, HTTPException
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

class PaymentMethodCreate(PaymentMethodBase):
    pass

class PaymentMethodUpdate(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None

class PaymentMethodResponse(PaymentMethodBase):
    id: int
    is_system: bool

    class Config:
        from_attributes = True

@router.get("/", response_model=List[PaymentMethodResponse])
@router.get("", response_model=List[PaymentMethodResponse], include_in_schema=False)
def get_payment_methods(db: Session = Depends(get_db)):
    """Get all payment methods"""
    return db.query(models.PaymentMethod).all()

@router.post("/", response_model=PaymentMethodResponse)
@router.post("", response_model=PaymentMethodResponse, include_in_schema=False)
def create_payment_method(method: PaymentMethodCreate, db: Session = Depends(get_db)):
    """Create a new payment method"""
    existing = db.query(models.PaymentMethod).filter(models.PaymentMethod.name == method.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Payment method already exists")
    
    new_method = models.PaymentMethod(
        name=method.name,
        is_active=method.is_active,
        is_system=False
    )
    db.add(new_method)
    db.commit()
    db.refresh(new_method)
    return new_method

@router.put("/{method_id}", response_model=PaymentMethodResponse)
def update_payment_method(method_id: int, method: PaymentMethodUpdate, db: Session = Depends(get_db)):
    """Update a payment method"""
    db_method = db.query(models.PaymentMethod).filter(models.PaymentMethod.id == method_id).first()
    if not db_method:
        raise HTTPException(status_code=404, detail="Payment method not found")
    
    if method.name:
        # Check name uniqueness if changing name
        if method.name != db_method.name:
            existing = db.query(models.PaymentMethod).filter(models.PaymentMethod.name == method.name).first()
            if existing:
                raise HTTPException(status_code=400, detail="Name already exists")
        db_method.name = method.name
        
    if method.is_active is not None:
        db_method.is_active = method.is_active
        
    db.commit()
    db.refresh(db_method)
    return db_method

@router.delete("/{method_id}")
def delete_payment_method(method_id: int, db: Session = Depends(get_db)):
    """Delete (or deactivate) a payment method"""
    db_method = db.query(models.PaymentMethod).filter(models.PaymentMethod.id == method_id).first()
    if not db_method:
        raise HTTPException(status_code=404, detail="Payment method not found")
    
    if db_method.is_system:
        raise HTTPException(status_code=400, detail="Cannot delete system payment methods")
        
    db.delete(db_method)
    db.commit()
    return {"message": "Payment method deleted"}
