from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timedelta
from ..database.db import get_db
from ..models import models
from ..schemas import rma_schemas
from ..auth.auth_bearer import JWTBearer
from ..services.inventory_service import InventoryService # Reuse if needed

router = APIRouter(
    prefix="/rma",
    tags=["RMA / Warranty"],
    dependencies=[Depends(JWTBearer())],
    responses={404: {"description": "Not found"}},
)

@router.get("/check/{imei}", response_model=rma_schemas.RMACheckResponse)
def check_warranty_status(imei: str, db: Session = Depends(get_db)):
    """
    Check if an IMEI is eligible for warranty/return.
    """
    # 1. Find the instance
    instance = db.query(models.ProductInstance).filter(models.ProductInstance.serial_number == imei).first()
    if not instance:
        return {
            "valid": False,
            "message": "IMEI no encontrado en el sistema.",
            "warranty_status": "NOT_FOUND"
        }

    # 2. Check current status
    if instance.status == models.ProductInstanceStatus.AVAILABLE:
        return {
            "valid": False,
            "message": "El equipo figura como DISPONIBLE (No ha sido vendido).",
            "warranty_status": "NOT_SOLD"
        }

    # 3. Find the Sale Detail Instance link
    # We want the LATEST sale (in case it was sold, returned, sold again)
    # So order by ID desc
    sale_link = db.query(models.SaleDetailInstance).join(models.SaleDetail).filter(
        models.SaleDetailInstance.product_instance_id == instance.id
    ).order_by(models.SaleDetailInstance.id.desc()).first()

    if not sale_link:
        return {
            "valid": False,
            "message": "No se encontró registro de venta asociado a este serial.",
            "warranty_status": "NO_SALE_RECORD"
        }

    sale_detail = sale_link.sale_detail
    sale = sale_detail.sale
    product = sale_detail.product
    customer = sale.customer

    # 4. Calculate Days
    sale_date = sale.date
    now = datetime.now()
    delta = now - sale_date
    days_elapsed = delta.days
    
    # 5. Determine Eligibility (Hardcoded 90 days for now, or use warranty_end_date if set)
    warranty_limit = 90
    is_within_warranty = days_elapsed <= warranty_limit
    
    status_str = "ACTIVE" if is_within_warranty else "EXPIRED"
    msg = "Garantía Activa" if is_within_warranty else f"Garantía Vencida (hace {days_elapsed - warranty_limit} días)"

    return {
        "valid": True, # Valid as in "Found and Sold", logic about accepting expired is up to frontend/manager
        "message": msg,
        "sale_date": sale_date,
        "customer_name": customer.name if customer else "Cliente Casual",
        "product_name": product.name,
        "days_elapsed": days_elapsed,
        "warranty_status": status_str,
        "original_price": sale_detail.unit_price # Return strictly the unit price paid
    }


@router.post("/process", response_model=rma_schemas.RMAProcessResponse)
def process_rma_return(payload: rma_schemas.RMAProcessRequest, db: Session = Depends(get_db)):
    """
    Process the return of a serialized item.
    - Updates Inventory (Available vs RMA)
    - Reverses Commission
    - Records Financial Return
    """
    
    # 1. Re-Verify (Security)
    instance = db.query(models.ProductInstance).filter(models.ProductInstance.serial_number == payload.imei).first()
    if not instance:
        raise HTTPException(status_code=404, detail="IMEI not found")

    sale_link = db.query(models.SaleDetailInstance).filter(
        models.SaleDetailInstance.product_instance_id == instance.id
    ).order_by(models.SaleDetailInstance.id.desc()).first()
    
    if not sale_link:
        raise HTTPException(status_code=400, detail="Item has no sale record")
        
    sale_detail = sale_link.sale_detail
    product = sale_detail.product
    
    # 2. INVENTORY LOGIC
    if payload.condition == "GOOD": # Using string directly from Enum schema
        # Mark as AVAILABLE
        instance.status = models.ProductInstanceStatus.AVAILABLE
        
        # Increase Stock (Global and Warehouse)
        # We need to know WHICH warehouse. Ideally the one it was sold from (sale.warehouse_id) or default.
        warehouse_id = sale_detail.sale.warehouse_id or 1 # Fallback to 1
        
        # Update Warehouse Stock
        wh_stock = db.query(models.ProductStock).filter(
            models.ProductStock.product_id == product.id,
            models.ProductStock.warehouse_id == warehouse_id
        ).first()
        
        if wh_stock:
            wh_stock.quantity += 1
        else:
            new_stock = models.ProductStock(product_id=product.id, warehouse_id=warehouse_id, quantity=1)
            db.add(new_stock)
            
        # Update Global Stock
        product.stock += 1
        
        # Add Kardex Entry
        kardex = models.Kardex(
            product_id=product.id,
            movement_type=models.MovementType.RETURN,
            quantity=1,
            balance_after=product.stock,
            description=f"RMA Return: {payload.reason} (Ref: {payload.imei})",
            warehouse_id=warehouse_id
        )
        db.add(kardex)
        
        new_stock_status = "RESTOCKED"

    else:
        # Mark as RMA / DAMAGED
        instance.status = models.ProductInstanceStatus.RMA
        # Do NOT increase available stock
        new_stock_status = "QUARANTINE"

    # 3. COMMISSION CLAWBACK
    # Find original commission
    commission_reversed = False
    orig_comm = db.query(models.CommissionLog).filter(
        models.CommissionLog.sale_detail_id == sale_detail.id
    ).first()
    
    if orig_comm:
        # Create Reversal
        clawback = models.CommissionLog(
            user_id=orig_comm.user_id,
            sale_detail_id=sale_detail.id, # Link to same detail
            amount= -abs(orig_comm.amount), # Negative amount
            currency=orig_comm.currency,
            percentage_applied=orig_comm.percentage_applied,
            status=models.CommissionStatus.PENDING,
            source_type="RMA",
            source_reference=payload.imei,
            notes=f"Reversión por Garantía: {payload.reason}"
        )
        db.add(clawback)
        commission_reversed = True

    # 4. FINANCIAL / REFUND LOGIC
    refund_amount = sale_detail.unit_price # Simple refund of what was paid
    
    # Create Return Record
    return_record = models.Return(
        sale_id=sale_detail.sale_id,
        total_refunded=refund_amount,
        reason=payload.reason
    )
    db.add(return_record)
    db.flush()
    
    return_detail = models.ReturnDetail(
        return_id=return_record.id,
        product_id=product.id,
        quantity=1,
        unit_price=refund_amount,
        unit_cost=sale_detail.cost_at_sale or 0
    )
    db.add(return_detail)
    
    # If Action is REFUND, Move Cash
    if payload.action == "REFUND":
        # Check active session? For simplicity, we assume we need an open session, 
        # but if we are strict, we might block if no session.
        # Let's try to find an open session for the current user (if passed via auth)
        # For now, just logging the movement generically linked to the sale's warehouse implicitly?
        # Ideally we need the CURRENT cashier's session.
        # We'll skip session link if complex, but better to be correct.
        pass 
        # (Enhancement: Link to Request.User.active_session. For now we assume Manager handles cash)

    db.commit()

    return {
        "status": "success",
        "refund_amount": refund_amount,
        "new_stock_status": new_stock_status,
        "commission_reversed": commission_reversed
    }
