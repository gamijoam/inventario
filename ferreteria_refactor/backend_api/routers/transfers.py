from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from typing import List
from ..database.db import get_db
from ..models import models
from .. import schemas
from ..models.models import UserRole
from ..dependencies import has_role

router = APIRouter(prefix="/transfers", tags=["transfers"])

@router.get("", response_model=List[schemas.InventoryTransferRead])
def read_transfers(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """List all inventory transfers."""
    transfers = db.query(models.InventoryTransfer)\
        .options(
            joinedload(models.InventoryTransfer.source_warehouse),
            joinedload(models.InventoryTransfer.target_warehouse),
            joinedload(models.InventoryTransfer.details).joinedload(models.TransferDetail.product)
        )\
        .order_by(models.InventoryTransfer.date.desc())\
        .offset(skip).limit(limit).all()
    return transfers

@router.post("", response_model=schemas.InventoryTransferRead, dependencies=[Depends(has_role([UserRole.ADMIN, UserRole.WAREHOUSE]))])
def create_transfer(transfer_data: schemas.InventoryTransferCreate, db: Session = Depends(get_db)):
    """Create and execute an inventory transfer."""
    
    # 1. Validation
    source_wh = db.query(models.Warehouse).filter(models.Warehouse.id == transfer_data.source_warehouse_id).first()
    target_wh = db.query(models.Warehouse).filter(models.Warehouse.id == transfer_data.target_warehouse_id).first()
    
    if not source_wh or not target_wh:
        raise HTTPException(status_code=404, detail="Source or Target Warehouse not found")
    
    if source_wh.id == target_wh.id:
        raise HTTPException(status_code=400, detail="Cannot transfer to the same warehouse")

    # 2. Check Stock Availability
    for item in transfer_data.items:
        stock_record = db.query(models.ProductStock).filter(
            models.ProductStock.warehouse_id == source_wh.id,
            models.ProductStock.product_id == item.product_id
        ).first()

        current_qty = stock_record.quantity if stock_record else 0
        if current_qty < item.quantity:
            product = db.query(models.Product).get(item.product_id)
            raise HTTPException(
                status_code=400, 
                detail=f"Insufficient stock for product '{product.name}'. Available: {current_qty}, Requested: {item.quantity}"
            )

    # 3. Create Transfer Record
    new_transfer = models.InventoryTransfer(
        source_warehouse_id=transfer_data.source_warehouse_id,
        target_warehouse_id=transfer_data.target_warehouse_id,
        date=transfer_data.date,
        notes=transfer_data.notes,
        status="COMPLETED" # Auto-complete for now, can be PENDING later
    )
    db.add(new_transfer)
    db.flush() # Get ID

    # 4. Execute Movement and Create Details
    for item in transfer_data.items:
        # Create Detail
        detail = models.TransferDetail(
            transfer_id=new_transfer.id,
            product_id=item.product_id,
            quantity=item.quantity
        )
        db.add(detail)

        # DECREASE Source
        source_stock = db.query(models.ProductStock).filter(
            models.ProductStock.warehouse_id == source_wh.id,
            models.ProductStock.product_id == item.product_id
        ).first()
        source_stock.quantity -= item.quantity

        # INCREASE Target
        target_stock = db.query(models.ProductStock).filter(
            models.ProductStock.warehouse_id == target_wh.id,
            models.ProductStock.product_id == item.product_id
        ).first()

        if not target_stock:
            target_stock = models.ProductStock(
                warehouse_id=target_wh.id,
                product_id=item.product_id,
                quantity=0
            )
            db.add(target_stock)
        
        target_stock.quantity += item.quantity

    try:
        db.commit()
        db.refresh(new_transfer)
        # Eager load for response
        return db.query(models.InventoryTransfer).options(
            joinedload(models.InventoryTransfer.source_warehouse),
            joinedload(models.InventoryTransfer.target_warehouse),
            joinedload(models.InventoryTransfer.details).joinedload(models.TransferDetail.product)
        ).get(new_transfer.id)

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Transfer failed: {str(e)}")
