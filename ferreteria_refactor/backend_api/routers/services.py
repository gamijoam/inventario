from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from .. import schemas
from ..models import models # FIXED: explicit import of models module
from ..database.db import get_db
from ..utils.time_utils import get_venezuela_now
from typing import List, Optional
from sqlalchemy import desc
import traceback

router = APIRouter(
    prefix="/services",
    tags=["services"]
)

@router.post("/orders", response_model=schemas.ServiceOrderRead)
def create_service_order(order_data: schemas.ServiceOrderCreate, db: Session = Depends(get_db)):
    """Create a new service order with auto-generated Ticket Number"""
    try:
        # 1. Generate Ticket Number
        last_order = db.query(models.ServiceOrder).order_by(desc(models.ServiceOrder.id)).first()
        
        if last_order and last_order.ticket_number:
            try:
                # Extract number from "SRV-0001"
                last_num = int(last_order.ticket_number.split("-")[1])
                new_num = last_num + 1
            except:
                new_num = 1
        else:
            new_num = 1
            
        ticket_number = f"SRV-{new_num:05d}"
        
        # 2. Create Order
        new_order = models.ServiceOrder(
            ticket_number=ticket_number,
            customer_id=order_data.customer_id,
            technician_id=order_data.technician_id,
            status=models.ServiceOrderStatus.RECEIVED,
            service_type=order_data.service_type, # Ensure type is saved
            
            device_type=order_data.device_type,
            brand=order_data.brand,
            model=order_data.model,
            serial_imei=order_data.serial_imei,
            passcode_pattern=order_data.passcode_pattern,
            
            problem_description=order_data.problem_description,
            physical_condition=order_data.physical_condition,
            diagnosis_notes=order_data.diagnosis_notes,
            estimated_delivery=order_data.estimated_delivery,
            order_metadata=order_data.order_metadata # FIX: Save Metadata
        )
        
        db.add(new_order)
        db.commit()
        db.refresh(new_order)
        return new_order
    except Exception as e:
        print(f"[ERROR] Create Service Order Failed: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Server Error: {str(e)}")

@router.get("/orders", response_model=List[schemas.ServiceOrderRead])
def get_service_orders(
    skip: int = 0, 
    limit: int = 100, 
    status: Optional[str] = None,
    customer_id: Optional[int] = None,
    service_type: Optional[str] = None, # NEW PARAM
    db: Session = Depends(get_db)
):
    """List service orders with filters"""
    query = db.query(models.ServiceOrder)
    
    if status:
        query = query.filter(models.ServiceOrder.status == status)
    
    if service_type:
        query = query.filter(models.ServiceOrder.service_type == service_type)
    
    if customer_id:
        query = query.filter(models.ServiceOrder.customer_id == customer_id)
        
    # Order by newest first
    query = query.order_by(desc(models.ServiceOrder.created_at))
    
    return query.offset(skip).limit(limit).all()

@router.get("/orders/{order_id}", response_model=schemas.ServiceOrderRead)
def get_service_order(order_id: int, db: Session = Depends(get_db)):
    """Get service order details"""
    order = db.query(models.ServiceOrder).get(order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Service Order not found")
    return order
    return order

# NEW: Add Item to Order
@router.post("/orders/{order_id}/items", response_model=schemas.ServiceOrderRead)
def add_service_order_item(
    order_id: int, 
    item_data: schemas.ServiceOrderDetailCreate, 
    db: Session = Depends(get_db)
):
    """Add a product/service/spare part to the service order"""
    order = db.query(models.ServiceOrder).get(order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Service Order not found")
        
    # Logic for Manual vs Product Item
    if item_data.product_id:
        # PRODUCT ITEM
        product = db.query(models.Product).get(item_data.product_id)
        if not product:
            raise HTTPException(status_code=400, detail="Product not found")
            
        description = product.name
        cost = product.cost_price
        is_manual = False
    else:
        # MANUAL ITEM
        if not item_data.description:
             raise HTTPException(status_code=400, detail="Description is required for manual items")
             
        description = item_data.description
        cost = 0 # Manual services usually have 0 direct cost unless specified otherwise
        is_manual = True
        
    # Create Detail
    new_detail = models.ServiceOrderDetail(
        service_order_id=order_id,
        product_id=item_data.product_id,
        description=description,
        is_manual=is_manual,
        quantity=item_data.quantity,
        unit_price=item_data.unit_price,
        cost=cost, 
        technician_id=item_data.technician_id
    )
    
    db.add(new_detail)
    db.commit()
    db.refresh(order)
    return order

@router.delete("/orders/{order_id}/items/{item_id}", response_model=schemas.ServiceOrderRead)
def delete_service_order_item(
    order_id: int,
    item_id: int,
    db: Session = Depends(get_db)
):
    """Remove an item from the service order"""
    order = db.query(models.ServiceOrder).get(order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Service Order not found")
        
    item = db.query(models.ServiceOrderDetail).filter(
        models.ServiceOrderDetail.id == item_id,
        models.ServiceOrderDetail.service_order_id == order_id
    ).first()
    
    if not item:
        raise HTTPException(status_code=404, detail="Item not found in this order")
        
    db.delete(item)
    db.commit()
    db.refresh(order)
    return order

# NEW: Update Status & Notes
@router.patch("/orders/{order_id}/status", response_model=schemas.ServiceOrderRead)
def update_service_order_status(
    order_id: int, 
    update_data: schemas.ServiceOrderUpdate,
    db: Session = Depends(get_db)
):
    """Update order status, diagnosis notes, and metadata"""
    order = db.query(models.ServiceOrder).get(order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Service Order not found")
        
    # Validate Status Enum if provided
    if update_data.status:
        if update_data.status not in models.ServiceOrderStatus.__members__:
             raise HTTPException(status_code=400, detail=f"Invalid status. Options: {list(models.ServiceOrderStatus.__members__.keys())}")
        order.status = models.ServiceOrderStatus[update_data.status]
    
    if update_data.diagnosis_notes:
        order.diagnosis_notes = update_data.diagnosis_notes
        
    if update_data.order_metadata:
        # Merge or Replace? Using Replace for simplicity as frontend sends full object usually
        # But safer to merge if needed. For now, replace as per Pydantic model.
        # Ensure we don't lose existing metadata if we only send partial? 
        # Frontend should send the merged dict.
        # But wait, SQLAlchemy JSON type:
        if order.order_metadata:
             # Merge logic: {**old, **new}
             order.order_metadata = {**order.order_metadata, **update_data.order_metadata}
        else:
             order.order_metadata = update_data.order_metadata
             
    if update_data.technician_id:
        order.technician_id = update_data.technician_id
        
    if update_data.priority:
        order.priority = update_data.priority
        
    db.commit()
    db.refresh(order)
    return order

# CHECKOUT ENDPOINTS

from ..services.service_checkout_service import ServiceCheckoutService

@router.get("/orders/status/ready", response_model=List[schemas.ServiceOrderRead])
def get_ready_service_orders(db: Session = Depends(get_db)):
    """Get all service orders ready for checkout/delivery"""
    return db.query(models.ServiceOrder).filter(models.ServiceOrder.status == models.ServiceOrderStatus.READY).all()

@router.post("/orders/{order_id}/checkout")
def checkout_service_order(
    order_id: int, 
    payment_data: schemas.ServiceCheckoutPayment,
    db: Session = Depends(get_db)
):
    """
    Convert a Service Order into a Sale (Process Payment).
    Ignores items in payload; uses items from the Service Order to ensure integrity.
    """
    # TODO: Add User ID from auth dependency
    user_id = 1 
    
    sale = ServiceCheckoutService.convert_order_to_sale(db, order_id, payment_data, user_id)
    return {"status": "success", "sale_id": sale.id, "ticket_number": sale.id}
