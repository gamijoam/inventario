from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
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
    """Add stock (Purchase/Entry) - Multi-Warehouse Support"""
    product = db.query(models.Product).filter(models.Product.id == adjustment.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # 1. Update/Create Specific Warehouse Stock
    product_stock = db.query(models.ProductStock).filter(
        models.ProductStock.product_id == product.id,
        models.ProductStock.warehouse_id == adjustment.warehouse_id
    ).first()

    if not product_stock:
        # Check if warehouse exists first
        warehouse = db.query(models.Warehouse).filter(models.Warehouse.id == adjustment.warehouse_id).first()
        if not warehouse:
             raise HTTPException(status_code=404, detail="Warehouse not found")

        product_stock = models.ProductStock(
            product_id=product.id,
            warehouse_id=adjustment.warehouse_id,
            quantity=0
        )
        db.add(product_stock)
    
    product_stock.quantity += adjustment.quantity

    # 2. Update Global Stock (Cache)
    product.stock += adjustment.quantity
    
    # Create Kardex
    kardex_entry = models.Kardex(
        product_id=product.id,
        warehouse_id=adjustment.warehouse_id, # NEW
        movement_type=adjustment.type,
        quantity=adjustment.quantity,
        balance_after=product.stock, # Keeping global balance for now
        description=adjustment.reason,
        date=datetime.now()
    )
    
    db.add(kardex_entry)
    db.commit()
    db.refresh(product)
    
    # AUDIT LOG
    from ..audit_utils import log_action
    log_action(db, user_id=1, action="UPDATE", table_name="products", record_id=product.id, changes=f"Stock Adjustment (IN) [Wh:{adjustment.warehouse_id}]: +{adjustment.quantity}. Reason: {adjustment.reason}")

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
    """Remove stock (Adjustment/Loss) - Multi-Warehouse Support"""
    product = db.query(models.Product).filter(models.Product.id == adjustment.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # 1. Validate Specific Warehouse Stock
    product_stock = db.query(models.ProductStock).filter(
        models.ProductStock.product_id == product.id,
        models.ProductStock.warehouse_id == adjustment.warehouse_id
    ).first()

    if not product_stock:
         raise HTTPException(status_code=400, detail="Producto no tiene stock en esta bodega")
    
    if product_stock.quantity < adjustment.quantity:
        raise HTTPException(status_code=400, detail=f"Stock insuficiente en bodega (Disponible: {product_stock.quantity})")

    # 2. Update Specific Stock
    product_stock.quantity -= adjustment.quantity

    # 3. Update Global Stock (Cache)
    product.stock -= adjustment.quantity
    
    # Create Kardex
    kardex_entry = models.Kardex(
        product_id=product.id,
        warehouse_id=adjustment.warehouse_id, # NEW
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
    log_action(db, user_id=1, action="UPDATE", table_name="products", record_id=product.id, changes=f"Stock Adjustment (OUT) [Wh:{adjustment.warehouse_id}]: -{adjustment.quantity}. Reason: {adjustment.reason}")

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

# --- INTER-COMPANY TRANSFER ENDPOINTS ---
from fastapi import UploadFile, File, Body
from ..services.inventory_service import InventoryService
from ..schemas import TransferPackageSchema, TransferResultSchema
from pydantic import BaseModel

class TransferRequest(BaseModel):
    items: List[Dict[str, Any]]
    source_company: str

@router.post("/transfer/export", response_model=TransferPackageSchema)
def export_transfer_package(
    request: TransferRequest,
    db: Session = Depends(get_db),
    # user: models.User = Depends(get_current_active_user) # Optional security
):
    """
    Generate a JSON package for transfer.
    Deducts stock immediately from this instance.
    """
    return InventoryService.generate_transfer_package_v2(db, request.items, request.source_company)

@router.post("/transfer/import", response_model=TransferResultSchema)
async def import_transfer_package(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Import a JSON transfer package.
    Adds stock to this instance.
    """
    content = await file.read()
    return InventoryService.process_transfer_package(db, content)
