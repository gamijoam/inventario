from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, cast, String
from typing import List, Optional
from ..database.db import get_db
from ..models import models
from .. import schemas
from datetime import datetime, date

router = APIRouter(
    prefix="/returns",
    tags=["returns"]
)

@router.get("/sales/search", response_model=List[schemas.SaleRead])
def search_sales(
    q: Optional[str] = None,
    limit: int = 100,
    payment_method: Optional[str] = None,
    status: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db)
):
    try:
        """Search sales with filters"""
        query = db.query(models.Sale).options(
            joinedload(models.Sale.customer),
            joinedload(models.Sale.payments),
            joinedload(models.Sale.returns)
        )
        
        # Text Search
        if q:
            query = query.join(models.Customer, isouter=True).filter(
                or_(
                    cast(models.Sale.id, String).ilike(f"%{q}%"),
                    models.Customer.name.ilike(f"%{q}%")
                )
            )
        
        # Filter by Payment Method
        if payment_method:
            query = query.filter(models.Sale.payment_method == payment_method)
        
        # Filter by Status (Derived from existence of Return)
        if status:
            if status == "VOIDED":
                # Show only sales with returns
                query = query.join(models.Return)
            elif status == "COMPLETED":
                # Show only sales WITHOUT returns
                query = query.outerjoin(models.Return).filter(models.Return.id == None)

        # Filter by Date Range
        if start_date:
            start_dt = datetime.combine(start_date, datetime.min.time())
            query = query.filter(models.Sale.date >= start_dt)
        
        if end_date:
            end_dt = datetime.combine(end_date, datetime.max.time())
            query = query.filter(models.Sale.date <= end_dt)
        
        results = query.order_by(models.Sale.date.desc()).limit(limit).all()
        return results
    except Exception as e:
        import traceback
        trace = traceback.format_exc()
        print(f"ERROR IN SEARCH_SALES: {str(e)}\n{trace}")
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)} | {trace}")

@router.get("/sales/{sale_id}")
def get_sale_for_return(sale_id: int, db: Session = Depends(get_db)):
    """Get sale details for processing return"""
    sale = db.query(models.Sale).options(
        joinedload(models.Sale.details).joinedload(models.SaleDetail.product),
        joinedload(models.Sale.customer)
    ).filter(models.Sale.id == sale_id).first()
    
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    
    return sale

@router.post("", response_model=schemas.ReturnRead)
def process_return(return_data: schemas.ReturnCreate, db: Session = Depends(get_db)):
    """Process a return: restore stock, create kardex entries, register cash movement"""
    
    # Find sale
    sale = db.query(models.Sale).filter(models.Sale.id == return_data.sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    
    # Create Return Record
    new_return = models.Return(
        sale_id=sale.id,
        total_refunded=0,  # Will update later
        reason=return_data.reason
    )
    db.add(new_return)
    db.flush()  # Get ID
    
    total_refund = 0
    
    for item in return_data.items:
        if item.quantity <= 0:
            continue
        
        # Find original sale detail
        detail = db.query(models.SaleDetail).filter(
            models.SaleDetail.sale_id == sale.id,
            models.SaleDetail.product_id == item.product_id
        ).first()
        
        if not detail:
            raise HTTPException(
                status_code=400,
                detail=f"Product {item.product_id} not found in this sale"
            )
        
        # Validation: Cannot return more than sold
        if item.quantity > detail.quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot return more than purchased ({detail.quantity})"
            )
        
        # Calculate refund amount
        refund_amount = detail.unit_price * item.quantity
        total_refund += refund_amount
        
        # Determine Cost to Return (Try to use historical, fallback to current)
        cost_to_return = detail.cost_at_sale 
        
        # If historical cost was not recorded (legacy data), use current product cost
        if cost_to_return is None or cost_to_return == 0:
             current_product = db.query(models.Product).get(item.product_id)
             if current_product:
                 cost_to_return = current_product.cost_price
             else:
                 cost_to_return = 0.0000

        # Create Return Detail
        ret_detail = models.ReturnDetail(
            return_id=new_return.id,
            product_id=item.product_id,
            quantity=item.quantity,
            unit_price=detail.unit_price,  # Add unit price from original sale
            unit_cost=cost_to_return # CRITICAL: Record cost of returned item
        )
        db.add(ret_detail)
        
        # Get product
        product = db.query(models.Product).get(item.product_id)
        
        # Handle stock based on condition
        if item.condition == "GOOD":
            # GOOD condition: Simply restore to stock
            product.stock += item.quantity
            
            # Kardex Entry: RETURN (Entrada)
            kardex = models.Kardex(
                product_id=product.id,
                movement_type="RETURN",
                quantity=item.quantity,
                balance_after=product.stock,
                description=f"Devolución Venta #{sale.id} - Buen Estado",
                date=datetime.now()
            )
            db.add(kardex)
            
        else:  # DAMAGED condition
            # Step 1: Register the return (for audit trail)
            old_stock = product.stock
            product.stock += item.quantity
            
            kardex_return = models.Kardex(
                product_id=product.id,
                movement_type="RETURN",
                quantity=item.quantity,
                balance_after=product.stock,
                description=f"Devolución Venta #{sale.id} - Producto Dañado (Entrada)",
                date=datetime.now()
            )
            db.add(kardex_return)
            
            # Step 2: Immediately adjust out (automatic shrinkage)
            product.stock -= item.quantity
            
            kardex_adjustment = models.Kardex(
                product_id=product.id,
                movement_type="ADJUSTMENT_OUT",
                quantity=item.quantity,
                balance_after=product.stock,
                description=f"Auto-merma por devolución dañada - Venta #{sale.id}",
                date=datetime.now()
            )
            db.add(kardex_adjustment)
            
            # Net effect: stock unchanged, but audit trail complete
    
    new_return.total_refunded = total_refund
    
    # CRITICAL: Update balance_pending for credit sales
    if sale.is_credit and sale.balance_pending is not None:
        # Reduce debt by refund amount
        old_balance = sale.balance_pending
        new_balance = sale.balance_pending - total_refund
        
        # Ensure balance doesn't go negative
        if new_balance < 0:
            new_balance = 0
        
        sale.balance_pending = new_balance
        
        # Mark as paid if balance is zero or negative
        if new_balance <= 0.01:
            sale.paid = True
        
        print(f"💳 Credit sale return: Reduced balance from ${old_balance:.2f} to ${new_balance:.2f}, Paid: {sale.paid}")
    
    # Cash Impact (Refund)
    session = db.query(models.CashSession).filter(models.CashSession.status == "OPEN").first()
    if session:
        amount_to_record = total_refund
        if return_data.refund_currency == "Bs":
            amount_to_record = total_refund * return_data.exchange_rate
        
        cash_movement = models.CashMovement(
            session_id=session.id,
            type="RETURN",  # Explicit return type
            amount=amount_to_record,
            currency=return_data.refund_currency,
            exchange_rate=return_data.exchange_rate,
            description=f"Devolución Venta #{sale.id}: {return_data.reason}"
        )
        db.add(cash_movement)
    
    db.commit()
    db.refresh(new_return)

    # AUDIT LOG
    from ..audit_utils import log_action
    log_action(db, user_id=1, action="CREATE", table_name="returns", record_id=new_return.id, changes=f"Return Processed for Sale #{sale.id}. Reason: {return_data.reason}. Refunded: {total_refund}")

    
    return new_return

@router.get("", response_model=List[schemas.ReturnRead])
def get_returns(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """Get list of returns"""
    return db.query(models.Return).options(
        joinedload(models.Return.details).joinedload(models.ReturnDetail.product)
    ).order_by(models.Return.date.desc()).offset(skip).limit(limit).all()

@router.get("/{return_id}", response_model=schemas.ReturnRead)
def get_return(return_id: int, db: Session = Depends(get_db)):
    """Get specific return details"""
    ret = db.query(models.Return).options(
        joinedload(models.Return.details).joinedload(models.ReturnDetail.product)
    ).filter(models.Return.id == return_id).first()
    
    if not ret:
        raise HTTPException(status_code=404, detail="Return not found")
    
    return ret
