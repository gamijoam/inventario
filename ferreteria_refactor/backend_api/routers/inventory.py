from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from ..database.db import get_db
from ..models import models
from .. import schemas
from datetime import datetime
from ..dependencies import warehouse_or_admin
from ..websocket.manager import manager
from ..websocket.events import WebSocketEvents

router = APIRouter(
    prefix="/inventory",
    tags=["inventory"],
    dependencies=[]  # Dependencies moved to individual endpoints
)

@router.post("/add", dependencies=[Depends(warehouse_or_admin)])
async def add_stock(adjustment: schemas.StockAdjustmentCreate, db: Session = Depends(get_db)):
    """Add stock (Purchase/Entry)"""
    product = db.query(models.Product).filter(models.Product.id == adjustment.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Update Stock (quantity already in base units from frontend)
    product.stock += adjustment.quantity
    
    # Create Kardex
    kardex_entry = models.Kardex(
        product_id=product.id,
        movement_type=adjustment.type,
        quantity=adjustment.quantity,
        balance_after=product.stock,
        description=adjustment.reason,
        date=datetime.now()
    )
    
    db.add(kardex_entry)
    db.commit()
    db.refresh(product)
    
    # AUDIT LOG
    from ..audit_utils import log_action
    log_action(db, user_id=1, action="UPDATE", table_name="products", record_id=product.id, changes=f"Stock Adjustment (IN): +{adjustment.quantity}. Reason: {adjustment.reason}")

    await manager.broadcast(WebSocketEvents.PRODUCT_UPDATED, {
        "id": product.id,
        "name": product.name,
        "price": product.price,
        "stock": product.stock,
        "exchange_rate_id": product.exchange_rate_id
    })
    
    await manager.broadcast(WebSocketEvents.PRODUCT_STOCK_UPDATED, {
        "id": product.id,
        "stock": product.stock
    })
    
    return {"status": "success", "new_stock": product.stock, "product_id": product.id}

@router.post("/remove", dependencies=[Depends(warehouse_or_admin)])
async def remove_stock(adjustment: schemas.StockAdjustmentCreate, db: Session = Depends(get_db)):
    """Remove stock (Adjustment/Loss)"""
    product = db.query(models.Product).filter(models.Product.id == adjustment.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    if product.stock < adjustment.quantity:
        raise HTTPException(status_code=400, detail=f"Insufficient stock. Current: {product.stock}")

    # Update Stock (quantity already in base units)
    product.stock -= adjustment.quantity
    
    # Create Kardex
    kardex_entry = models.Kardex(
        product_id=product.id,
        movement_type=adjustment.type,
        quantity=-adjustment.quantity,  # Negative for outgoing
        balance_after=product.stock,
        description=adjustment.reason,
        date=datetime.now()
    )
    
    db.add(kardex_entry)
    db.commit()
    db.refresh(product)
    
    # AUDIT LOG
    from ..audit_utils import log_action
    log_action(db, user_id=1, action="UPDATE", table_name="products", record_id=product.id, changes=f"Stock Adjustment (OUT): -{adjustment.quantity}. Reason: {adjustment.reason}")

    await manager.broadcast(WebSocketEvents.PRODUCT_UPDATED, {
        "id": product.id,
        "name": product.name,
        "price": product.price,
        "stock": product.stock,
        "exchange_rate_id": product.exchange_rate_id
    })
    
    await manager.broadcast(WebSocketEvents.PRODUCT_STOCK_UPDATED, {
        "id": product.id,
        "stock": product.stock
    })
    
    return {"status": "success", "new_stock": product.stock, "product_id": product.id}

from ..dependencies import any_authenticated

@router.get("/kardex", response_model=List[schemas.KardexRead], dependencies=[any_authenticated])
def get_kardex(product_id: Optional[int] = None, limit: int = 100, db: Session = Depends(get_db)):
    from sqlalchemy.orm import joinedload
    query = db.query(models.Kardex).options(joinedload(models.Kardex.product))
    if product_id:
        query = query.filter(models.Kardex.product_id == product_id)
    return query.order_by(models.Kardex.date.desc()).limit(limit).all()
