from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from decimal import Decimal
from ..database.db import get_db
from ..models import models
from .. import schemas
from ..websocket.manager import manager
from ..websocket.events import WebSocketEvents

router = APIRouter(
    prefix="/purchases",
    tags=["purchases"]
)

@router.post("", response_model=schemas.PurchaseOrderResponse)
async def create_purchase_order(order_data: schemas.PurchaseOrderCreate, db: Session = Depends(get_db)):
    """
    Create a new purchase order with automatic:
    - Multi-Warehouse Stock updates (ProductStock + Global)
    - Debt generation (if credit)
    - Cost price updates
    """
    try:
        # Get supplier
        supplier = db.query(models.Supplier).filter(models.Supplier.id == order_data.supplier_id).first()
        if not supplier:
            raise HTTPException(status_code=404, detail="Supplier not found")

        # Validate Warehouse
        warehouse = db.query(models.Warehouse).filter(models.Warehouse.id == order_data.warehouse_id).first()
        if not warehouse:
             raise HTTPException(status_code=404, detail="Warehouse not found")
        
        # Calculate due date
        from datetime import datetime, timedelta
        purchase_date = datetime.now()
        due_date = purchase_date + timedelta(days=supplier.payment_terms or 30)
        
        # Create purchase order
        purchase = models.PurchaseOrder(
            supplier_id=order_data.supplier_id,
            warehouse_id=order_data.warehouse_id, # Link to warehouse
            invoice_number=order_data.invoice_number,
            notes=order_data.notes,
            total_amount=order_data.total_amount,
            paid_amount=0.0,
            payment_status=models.PaymentStatus.PENDING,
            purchase_date=purchase_date,
            due_date=due_date
        )
        db.add(purchase)
        db.flush()  # Get purchase ID
        
        updated_products_info = []

        # Process items
        for item in order_data.items:
            product = db.query(models.Product).filter(models.Product.id == item.product_id).first()
            if not product:
                continue
            
            # SAVE PURCHASE ITEM (History)
            purchase_item = models.PurchaseItem(
                purchase_id=purchase.id,
                product_id=product.id,
                quantity=item.quantity,
                unit_cost=item.unit_cost
            )
            db.add(purchase_item)

            # =================================================
            # MULTI-WAREHOUSE STOCK LOGIC
            # =================================================
            # 1. Update Specific Warehouse Stock
            product_stock = db.query(models.ProductStock).filter(
                models.ProductStock.product_id == product.id,
                models.ProductStock.warehouse_id == order_data.warehouse_id
            ).first()

            if not product_stock:
                # Create if not exists
                product_stock = models.ProductStock(
                    product_id=product.id,
                    warehouse_id=order_data.warehouse_id,
                    quantity=0
                )
                db.add(product_stock)
            
            product_stock.quantity += item.quantity

            # 2. Update Global Stock (Cache)
            old_stock = product.stock
            product.stock += item.quantity
            
            # Update cost price (weighted average)
            if item.update_cost:
                if old_stock == 0:
                    product.cost_price = item.unit_cost
                else:
                    total_value = (product.cost_price * old_stock) + (item.unit_cost * item.quantity)
                    product.cost_price = total_value / product.stock
            
            # Update Sale Price (PVP) if requested
            if item.update_price:
                if item.new_sale_price and item.new_sale_price > 0:
                    # Direct update from frontend
                    product.price = item.new_sale_price
                elif item.update_cost and item.unit_cost > 0:
                     # Intelligent auto-update if only "update price" is checked but no value sent
                     # Use Replacment Cost Strategy (Item Unit Cost) to protect margin
                     if product.profit_margin:
                         tax_multiplier = 1 + (product.tax_rate / 100) if product.tax_rate else 1
                         margin_multiplier = 1 + (product.profit_margin / 100)
                         product.price = item.unit_cost * margin_multiplier * tax_multiplier
 
            # Auto-update profit margin (Markup) based on new values
            if product.cost_price > 0 and product.price > 0:
                product.profit_margin = ((product.price - product.cost_price) / product.cost_price) * 100

            # Create Kardex entry LINKED TO WAREHOUSE
            kardex = models.Kardex(
                product_id=product.id,
                warehouse_id=order_data.warehouse_id, # IMPORTANT
                movement_type=models.MovementType.PURCHASE,
                quantity=item.quantity,
                balance_after=product.stock, # Note: Current Kardex balance logic is global, refactor later for per-warehouse balance
                description=f"Compra #{purchase.id} - {supplier.name}",
                date=purchase_date
            )
            db.add(kardex)
            
            # Collect info for broadcast
            updated_products_info.append({
                "id": product.id,
                "name": product.name,
                "price": float(product.price),
                "cost_price": float(product.cost_price), 
                "stock": float(product.stock),
                "profit_margin": float(product.profit_margin) if product.profit_margin else 0,
                "exchange_rate_id": product.exchange_rate_id
            })
        
        # Update supplier balance if credit purchase
        if order_data.payment_type == 'CREDIT':
            supplier.current_balance += order_data.total_amount
        elif order_data.payment_type == 'CASH':
            # Mark as paid immediately
            purchase.paid_amount = order_data.total_amount
            purchase.payment_status = models.PaymentStatus.PAID
        
        db.commit()
        db.refresh(purchase)
        
        # Emission of events
        for p_info in updated_products_info:
            await manager.broadcast(WebSocketEvents.PRODUCT_UPDATED, p_info)
            await manager.broadcast(WebSocketEvents.PRODUCT_STOCK_UPDATED, {
                "id": p_info["id"], 
                "stock": p_info["stock"]
            })

        return purchase
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@router.get("", response_model=List[schemas.PurchaseOrderResponse])
def get_all_purchase_orders(status: Optional[str] = None, db: Session = Depends(get_db)):
    """Get all purchase orders, optionally filtered by status"""
    query = db.query(models.PurchaseOrder).options(
        joinedload(models.PurchaseOrder.supplier),
        joinedload(models.PurchaseOrder.items).joinedload(models.PurchaseItem.product) # Load items and their products
    )
    
    if status:
        # Handle multiple statuses separated by comma
        if ',' in status:
            statuses = [s.strip() for s in status.split(',')]
            query = query.filter(models.PurchaseOrder.payment_status.in_(statuses))
        else:
            query = query.filter(models.PurchaseOrder.payment_status == status)
    
    return query.order_by(models.PurchaseOrder.purchase_date.desc()).all()

@router.get("/pending", response_model=List[schemas.PurchaseOrderResponse])
def get_pending_purchases(db: Session = Depends(get_db)):
    """Get all pending and partially paid purchases"""
    purchases = db.query(models.PurchaseOrder).options(
        joinedload(models.PurchaseOrder.supplier),
        joinedload(models.PurchaseOrder.items).joinedload(models.PurchaseItem.product)
    ).filter(
        models.PurchaseOrder.payment_status.in_([models.PaymentStatus.PENDING, models.PaymentStatus.PARTIAL])
    ).order_by(models.PurchaseOrder.due_date).all()
    
    return purchases

@router.get("/{order_id}", response_model=schemas.PurchaseOrderResponse)
def get_purchase_order(order_id: int, db: Session = Depends(get_db)):
    """Get purchase order by ID"""
    order = db.query(models.PurchaseOrder).options(
        joinedload(models.PurchaseOrder.supplier),
        joinedload(models.PurchaseOrder.items).joinedload(models.PurchaseItem.product)
    ).filter(models.PurchaseOrder.id == order_id).first()
    
    if not order:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    
    return order

# Accounts Payable Endpoints

@router.post("/{purchase_id}/payment", response_model=schemas.PurchasePaymentResponse)
def register_payment(
    purchase_id: int,
    payment_data: schemas.PurchasePaymentCreate,
    db: Session = Depends(get_db)
):
    """Register a payment for a purchase order"""
    purchase = db.query(models.PurchaseOrder).filter(models.PurchaseOrder.id == purchase_id).first()
    
    if not purchase:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    
    if purchase.payment_status == models.PaymentStatus.PAID:
        raise HTTPException(status_code=400, detail="Purchase is already fully paid")
    
    try:
        # Create payment record
        payment = models.PurchasePayment(
            purchase_id=purchase_id,
            amount=payment_data.amount,
            payment_method=payment_data.payment_method,
            reference=payment_data.reference,
            notes=payment_data.notes,
            currency=payment_data.currency,
            exchange_rate=payment_data.exchange_rate
        )
        db.add(payment)
        
        # Calculate Amount in USD (Anchor) for debt reduction
        amount_usd = float(payment_data.amount)
        if payment_data.currency != "USD":
            rate = float(payment_data.exchange_rate) if payment_data.exchange_rate and payment_data.exchange_rate > 0 else 1.0
            amount_usd = amount_usd / rate

        # Update purchase paid amount (in USD)
        purchase.paid_amount += Decimal(amount_usd)
        
        # Update payment status
        # Allow small floating point tolerance
        if purchase.paid_amount >= (purchase.total_amount - Decimal('0.01')):
            purchase.payment_status = models.PaymentStatus.PAID
            purchase.paid_amount = purchase.total_amount # Cap at total
        elif purchase.paid_amount > 0:
            purchase.payment_status = models.PaymentStatus.PARTIAL
        
        # Recalculate supplier balance
        supplier = db.query(models.Supplier).filter(models.Supplier.id == purchase.supplier_id).first()
        if supplier:
            # Recalculate total debt from all pending purchases
            # IMPORTANT: We can't just sum(total - paid) because paid_amount is now updated.
            # Ideally we re-query freely.
            
            pending_purchases = db.query(models.PurchaseOrder).filter(
                models.PurchaseOrder.supplier_id == supplier.id,
                models.PurchaseOrder.payment_status.in_([models.PaymentStatus.PENDING, models.PaymentStatus.PARTIAL])
            ).all()
            
            supplier.current_balance = sum(
                (p.total_amount - p.paid_amount) for p in pending_purchases
            )
        
        db.commit()
        db.refresh(payment)
        return payment
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{purchase_id}/payments", response_model=List[schemas.PurchasePaymentResponse])
def get_purchase_payments(purchase_id: int, db: Session = Depends(get_db)):
    """Get all payments for a purchase order"""
    purchase = db.query(models.PurchaseOrder).filter(models.PurchaseOrder.id == purchase_id).first()
    
    if not purchase:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    
    payments = db.query(models.PurchasePayment).filter(
        models.PurchasePayment.purchase_id == purchase_id
    ).order_by(models.PurchasePayment.payment_date.desc()).all()
    
    return payments


