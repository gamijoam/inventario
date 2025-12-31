from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from ..database.db import get_db
from ..models import models
from .. import schemas
from ..websocket.manager import manager
from ..websocket.events import WebSocketEvents

router = APIRouter(
    prefix="/suppliers",
    tags=["suppliers"]
)

@router.get("/", response_model=List[schemas.SupplierRead])
@router.get("", response_model=List[schemas.SupplierRead], include_in_schema=False)
def read_suppliers(
    skip: int = 0, 
    limit: int = 100, 
    active_only: bool = True,
    q: Optional[str] = None,
    db: Session = Depends(get_db)
):
    try:
        query = db.query(models.Supplier)
        
        if active_only:
            query = query.filter(models.Supplier.is_active == True)
            
        if q:
            search = f"%{q}%"
            query = query.filter(models.Supplier.name.ilike(search))
            
        return query.order_by(models.Supplier.name).offset(skip).limit(limit).all()
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error al listar proveedores: {str(e)}")

@router.post("/", response_model=schemas.SupplierRead)
@router.post("", response_model=schemas.SupplierRead, include_in_schema=False)
async def create_supplier(supplier: schemas.SupplierCreate, db: Session = Depends(get_db)):
    # Check duplicate name
    exists = db.query(models.Supplier).filter(models.Supplier.name.ilike(supplier.name)).first()
    if exists:
        raise HTTPException(status_code=400, detail="Supplier with this name already exists")
        
    db_supplier = models.Supplier(**supplier.model_dump())
    db.add(db_supplier)
    db.commit()
    db.refresh(db_supplier)
    
    # Broadcast supplier created
    await manager.broadcast(WebSocketEvents.SUPPLIER_CREATED, {
        "id": db_supplier.id,
        "name": db_supplier.name,
        "credit_limit": float(db_supplier.credit_limit) if db_supplier.credit_limit else 0.0
    })
    
    return db_supplier

@router.get("/{supplier_id}", response_model=schemas.SupplierRead)
def read_supplier(supplier_id: int, db: Session = Depends(get_db)):
    supplier = db.query(models.Supplier).filter(models.Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return supplier

@router.put("/{supplier_id}", response_model=schemas.SupplierRead)
async def update_supplier(supplier_id: int, supplier_update: schemas.SupplierCreate, db: Session = Depends(get_db)):
    db_supplier = db.query(models.Supplier).filter(models.Supplier.id == supplier_id).first()
    if not db_supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
        
    for key, value in supplier_update.model_dump(exclude_unset=True).items():
        setattr(db_supplier, key, value)
        
    db.commit()
    db.refresh(db_supplier)
    
    # Broadcast supplier updated
    await manager.broadcast(WebSocketEvents.SUPPLIER_UPDATED, {
        "id": db_supplier.id,
        "name": db_supplier.name,
        "credit_limit": float(db_supplier.credit_limit) if db_supplier.credit_limit else 0.0
    })
    
    return db_supplier

# Accounts Payable Endpoints

@router.get("/{supplier_id}/stats", response_model=schemas.SupplierStatsResponse)
def get_supplier_stats(supplier_id: int, db: Session = Depends(get_db)):
    """Get supplier debt statistics and pending invoices"""
    supplier = db.query(models.Supplier).filter(models.Supplier.id == supplier_id).first()
    
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    
    # Count pending purchases
    pending_count = db.query(models.PurchaseOrder).filter(
        models.PurchaseOrder.supplier_id == supplier_id,
        models.PurchaseOrder.payment_status.in_([models.PaymentStatus.PENDING, models.PaymentStatus.PARTIAL])
    ).count()
    
    # Count total purchases
    total_count = db.query(models.PurchaseOrder).filter(
        models.PurchaseOrder.supplier_id == supplier_id
    ).count()
    
    return {
        "supplier_id": supplier.id,
        "supplier_name": supplier.name,
        "current_balance": supplier.current_balance,
        "credit_limit": supplier.credit_limit,
        "pending_purchases": pending_count,
        "total_purchases": total_count
    }

@router.get("/{supplier_id}/purchases", response_model=List[schemas.PurchaseOrderResponse])
def get_supplier_purchases(
    supplier_id: int,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get purchase history for a supplier"""
    supplier = db.query(models.Supplier).filter(models.Supplier.id == supplier_id).first()
    
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    
    query = db.query(models.PurchaseOrder).filter(
        models.PurchaseOrder.supplier_id == supplier_id
    )
    
    if status:
        # Handle multiple statuses separated by comma
        if ',' in status:
            statuses = [s.strip() for s in status.split(',')]
            query = query.filter(models.PurchaseOrder.payment_status.in_(statuses))
        else:
            query = query.filter(models.PurchaseOrder.payment_status == status)
    
    return query.order_by(models.PurchaseOrder.purchase_date.desc()).all()
