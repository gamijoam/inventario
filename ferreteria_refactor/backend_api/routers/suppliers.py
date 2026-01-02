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

@router.get("/{supplier_id}/ledger")
def get_supplier_ledger(supplier_id: int, db: Session = Depends(get_db)):
    """
    Returns a chronological ledger of purchases and payments for a supplier.
    """
    # 1. Get Supplier
    supplier = db.query(models.Supplier).filter(models.Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")
        
    # 2. Get Purchases (Credits for Supplier / Debits for Us)
    # Careful with terms: "Credit" usually means we owe them.
    purchases = db.query(models.PurchaseOrder).filter(
        models.PurchaseOrder.supplier_id == supplier_id,
        # Only unpaid? No, History should be EVERYTHING.
        # models.PurchaseOrder.payment_status.in_([models.PaymentStatus.PENDING, models.PaymentStatus.PARTIAL])
    ).all()
    
    ledger_entries = []
    
    # Process Purchases (We incur debt)
    for purchase in purchases:
        ledger_entries.append({
            "date": purchase.purchase_date,
            "type": "COMPRA", # Purchase Order
            "ref": f"Factura {purchase.invoice_number or '#' + str(purchase.id)}",
            "debit": 0.0, # We owe (Liability increases) -> Credit in Accounting terms, but let's stick to "User perspective":
                          # Let's use: "Debt Increase" vs "Debt Decrease"
                          # For Client Ledger: Debit = Debt Increase (Sale), Credit = Debt Decrease (Payment).
                          # For Supplier Ledger: Credit = Debt Increase (Purchase), Debit = Debt Decrease (Payment).
                          # BUT reusing the FE component "ClientLedger" expects "debit" and "credit" columns.
                          # Let's map: 
                          # "debit" (Left col) = Purchase (Debt +)
                          # "credit" (Right col) = Payment (Debt -)
                          # This matches the Client Ledger visual layout.
            "debit": float(purchase.total_amount), 
            "credit": 0.0,
            "original_obj": purchase
        })
        
        # Process Payments linked to this purchase
        for payment in purchase.payments:
            amount_usd = float(payment.amount)
            details_str = f"Pago a Fact. {purchase.invoice_number or '#' + str(purchase.id)}"
            
            # Normalize to USD if needed
            if payment.currency and payment.currency != "USD":
                rate = float(payment.exchange_rate) if payment.exchange_rate else 1.0
                if rate > 0:
                    amount_usd = float(payment.amount) / rate
                details_str += f" ({payment.amount} {payment.currency} @ {rate})"

            ledger_entries.append({
                "date": payment.payment_date if payment.payment_date else purchase.purchase_date,
                "type": "PAGO",
                "ref": details_str,
                "debit": 0.0,
                "credit": round(amount_usd, 2), # Reduces debt
                "original_obj": payment
            })
            
    # Sort by Date
    ledger_entries.sort(key=lambda x: x["date"])
    
    # Calculate Balance
    balance = 0.0
    final_output = []
    
    for entry in ledger_entries:
        balance += entry["debit"]
        balance -= entry["credit"]
        final_output.append({
            "date": entry["date"].isoformat() if entry["date"] else None,
            "type": entry["type"],
            "ref": entry["ref"],
            "debit": entry["debit"],
            "credit": entry["credit"],
            "balance": round(balance, 2)
        })
        
    return {
        "supplier": {
            "id": supplier.id,
            "name": supplier.name,
            "limit": float(supplier.credit_limit or 0)
        },
        "ledger": final_output,
        "current_balance": round(balance, 2)
    }
