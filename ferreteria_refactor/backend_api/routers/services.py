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
            
            device_type=order_data.device_type,
            brand=order_data.brand,
            model=order_data.model,
            serial_imei=order_data.serial_imei,
            passcode_pattern=order_data.passcode_pattern,
            
            problem_description=order_data.problem_description,
            physical_condition=order_data.physical_condition,
            diagnosis_notes=order_data.diagnosis_notes,
            estimated_delivery=order_data.estimated_delivery
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
    db: Session = Depends(get_db)
):
    """List service orders with filters"""
    query = db.query(models.ServiceOrder)
    
    if status:
        query = query.filter(models.ServiceOrder.status == status)
    
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
