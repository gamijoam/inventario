from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from ..database.db import get_db
from ..models import models
from .. import schemas
from ..models.models import UserRole
from ..dependencies import has_role

router = APIRouter(prefix="/warehouses", tags=["warehouses"])

@router.get("", response_model=List[schemas.WarehouseRead])
def read_warehouses(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """List all warehouses."""
    warehouses = db.query(models.Warehouse).offset(skip).limit(limit).all()
    # Populate stocks_count manually or via hybrid property if defined. 
    # For now, simplistic approach or just don't return it if not needed yet.
    return warehouses

@router.post("", response_model=schemas.WarehouseRead, dependencies=[Depends(has_role([UserRole.ADMIN]))])
def create_warehouse(warehouse: schemas.WarehouseCreate, db: Session = Depends(get_db)):
    """Create a new warehouse."""
    db_warehouse = models.Warehouse(**warehouse.dict())
    if warehouse.is_main:
        # Ensure only one main warehouse exists
        db.query(models.Warehouse).filter(models.Warehouse.is_main == True).update({"is_main": False})
    
    db.add(db_warehouse)
    try:
        db.commit()
        db.refresh(db_warehouse)
        return db_warehouse
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/{warehouse_id}", response_model=schemas.WarehouseRead, dependencies=[Depends(has_role([UserRole.ADMIN]))])
def update_warehouse(warehouse_id: int, warehouse: schemas.WarehouseUpdate, db: Session = Depends(get_db)):
    """Update a warehouse."""
    db_warehouse = db.query(models.Warehouse).filter(models.Warehouse.id == warehouse_id).first()
    if not db_warehouse:
        raise HTTPException(status_code=404, detail="Warehouse not found")

    update_data = warehouse.dict(exclude_unset=True)
    
    if update_data.get('is_main'):
        # Ensure only one main warehouse exists
        db.query(models.Warehouse).filter(models.Warehouse.is_main == True).update({"is_main": False})

    for key, value in update_data.items():
        setattr(db_warehouse, key, value)

    try:
        db.commit()
        db.refresh(db_warehouse)
        return db_warehouse
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/{warehouse_id}", dependencies=[Depends(has_role([UserRole.ADMIN]))])
def delete_warehouse(warehouse_id: int, db: Session = Depends(get_db)):
    """Delete a warehouse."""
    db_warehouse = db.query(models.Warehouse).filter(models.Warehouse.id == warehouse_id).first()
    if not db_warehouse:
        raise HTTPException(status_code=404, detail="Warehouse not found")
    
    # Check for stock
    stock_count = db.query(models.ProductStock).filter(
        models.ProductStock.warehouse_id == warehouse_id, 
        models.ProductStock.quantity > 0
    ).count()

    if stock_count > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete warehouse with active stock ({stock_count} products)")

    db.delete(db_warehouse)
    db.commit()
    return {"status": "success", "message": "Warehouse deleted"}

@router.get("/{warehouse_id}/inventory", response_model=List[schemas.WarehouseInventoryItem])
def get_warehouse_inventory(warehouse_id: int, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """List inventory for a specific warehouse with product details."""
    # Verify warehouse exists
    wh = db.query(models.Warehouse).filter(models.Warehouse.id == warehouse_id).first()
    if not wh:
        raise HTTPException(status_code=404, detail="Warehouse not found")
        
    stocks = db.query(models.ProductStock).join(models.Product).filter(
        models.ProductStock.warehouse_id == warehouse_id,
        models.ProductStock.quantity > 0
    ).offset(skip).limit(limit).all()
    
    # Transform to schema
    result = []
    for stock in stocks:
        result.append({
            "product_id": stock.product_id,
            "product_name": stock.product.name,
            "sku": stock.product.sku,
            "quantity": stock.quantity,
            "location": stock.location
        })
        
    return result
