from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
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

@router.post("/add")
async def add_stock(adjustment: schemas.StockAdjustmentCreate, db: Session = Depends(get_db), current_user: models.User = Depends(warehouse_or_admin)):
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

    # Capture state BEFORE commit to avoid ObjectDeletedError/SessionExpire
    product_id = product.id
    product_name = product.name
    product_price = float(product.price)
    product_stock = float(product.stock)
    product_er_id = product.exchange_rate_id

    db.commit()
    # db.refresh(product) <- REMOVED
    
    # AUDIT LOG
    from ..audit_utils import log_action
    log_action(db, user_id=current_user.id, action="UPDATE", table_name="products", record_id=product_id, changes=f"Stock Adjustment (IN) [Wh:{adjustment.warehouse_id}]: +{adjustment.quantity}. Reason: {adjustment.reason}")

    await manager.broadcast(WebSocketEvents.PRODUCT_UPDATED, {
        "id": product_id,
        "name": product_name,
        "price": product_price,
        "stock": product_stock,
        "exchange_rate_id": product_er_id
    })
    
    await manager.broadcast(WebSocketEvents.PRODUCT_STOCK_UPDATED, {
        "id": product_id,
        "stock": product_stock
    })
    
    return {"status": "success", "new_stock": product_stock, "product_id": product_id}

@router.post("/remove")
async def remove_stock(adjustment: schemas.StockAdjustmentCreate, db: Session = Depends(get_db), current_user: models.User = Depends(warehouse_or_admin)):
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
    
    # Map Frontend Types to DB Enum
    db_movement_type = adjustment.type
    final_description = adjustment.reason
    
    if adjustment.type == "DAMAGED":
        db_movement_type = "ADJUSTMENT_OUT" # Or "ADJUSTMENT" based on models.py comment, but OUT is safer for logic
        final_description = f"[DAMAGED] {adjustment.reason}"
    elif adjustment.type == "INTERNAL_USE":
        db_movement_type = "ADJUSTMENT_OUT"
        final_description = f"[INTERNAL USE] {adjustment.reason}"
        
    kardex_entry = models.Kardex(
        product_id=product.id,
        warehouse_id=adjustment.warehouse_id, # NEW
        movement_type=db_movement_type,
        quantity=-adjustment.quantity,  # Negative for outgoing
        balance_after=product.stock,
        description=final_description,
        date=datetime.now()
    )
    
    db.add(kardex_entry)

    # Capture state BEFORE commit
    product_id = product.id
    product_name = product.name
    product_price = float(product.price)
    product_stock = float(product.stock)
    product_er_id = product.exchange_rate_id

    db.commit()
    # db.refresh(product) <- REMOVED
    
    # AUDIT LOG
    from ..audit_utils import log_action
    log_action(db, user_id=current_user.id, action="UPDATE", table_name="products", record_id=product_id, changes=f"Stock Adjustment (OUT) [Wh:{adjustment.warehouse_id}]: -{adjustment.quantity}. Reason: {adjustment.reason}")

    await manager.broadcast(WebSocketEvents.PRODUCT_UPDATED, {
        "id": product_id,
        "name": product_name,
        "price": product_price,
        "stock": product_stock,
        "exchange_rate_id": product_er_id
    })
    
    await manager.broadcast(WebSocketEvents.PRODUCT_STOCK_UPDATED, {
        "id": product_id,
        "stock": product_stock
    })
    
    return {"status": "success", "new_stock": product_stock, "product_id": product_id}

from ..dependencies import any_authenticated

@router.get("/kardex", response_model=List[schemas.KardexRead], dependencies=[any_authenticated])
def get_kardex(
    product_id: Optional[int] = None, 
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    limit: int = 100, 
    db: Session = Depends(get_db)
):
    from sqlalchemy.orm import joinedload
    query = db.query(models.Kardex).options(joinedload(models.Kardex.product))
    
    if product_id:
        query = query.filter(models.Kardex.product_id == product_id)
        
    if start_date:
        query = query.filter(models.Kardex.date >= start_date)
        
    if end_date:
        # Include the whole end day by adding time or next day logic if needed. 
        # Assuming format YYYY-MM-DD, strict comparison might miss same-day events if not handled.
        # Simple string compare works if client sends 'YYYY-MM-DD' and DB has 'YYYY-MM-DD HH:MM:SS'
        # To be inclusive of the end date, we generally want <= end_date + " 23:59:59" or < next_day
        query = query.filter(models.Kardex.date <= f"{end_date} 23:59:59")
        
    return query.order_by(models.Kardex.date.desc()).limit(limit).all()

# --- INTER-COMPANY TRANSFER ENDPOINTS ---
from fastapi import UploadFile, File, Body
from ..services.inventory_service import InventoryService
from ..schemas import TransferPackageSchema, TransferResultSchema, TransferPreviewResult, TransferImportV2Request
from pydantic import BaseModel
from typing import Optional

class TransferRequest(BaseModel):
    items: List[Dict[str, Any]]
    source_company: str
    warehouse_id: Optional[int] = None
    photo_urls: Optional[List[str]] = None

@router.post("/transfer/export", response_model=TransferPackageSchema)
def export_transfer_package(
    request: TransferRequest,
    db: Session = Depends(get_db),
    # user: models.User = Depends(get_current_active_user) # Uncomment when security is ready
):
    """
    Generate a JSON package for transfer.
    Deducts stock immediately from this instance.
    """
    try:
        return InventoryService.generate_transfer_package_v2(
            db,
            request.items,
            request.source_company,
            request.warehouse_id,
            request.photo_urls
        )
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred during transfer export: {e}")

@router.post("/transfer/import", response_model=TransferResultSchema)
async def import_transfer_package(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Import a JSON transfer package (legacy - exact SKU match only).
    Adds stock to this instance.
    """
    content = await file.read()
    return InventoryService.process_transfer_package(db, content)

@router.post("/transfer/preview", response_model=TransferPreviewResult)
async def preview_transfer(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Preview a JSON transfer package before importing.
    Returns match results for each item using a 4-step cascade:
    exact SKU, case-insensitive SKU, normalized SKU, name ILIKE.
    """
    content = await file.read()
    return InventoryService.preview_transfer_package(db, content)

@router.post("/transfer/import-mapped")
async def import_transfer_mapped(
    request: TransferImportV2Request = Body(...),
    db: Session = Depends(get_db)
):
    """
    Import a transfer package with explicit product mappings (v2).
    Each item can be mapped to an existing product_id or flagged to create a new product.
    """
    data = request.model_dump()
    return InventoryService.process_transfer_package_v2(db, data, request.warehouse_id)

@router.post("/transfer/upload-photo")
async def upload_transfer_photo(file: UploadFile = File(...)):
    """
    Upload a photo as evidence for a transfer package.
    Photos are stored permanently in /app/media/transfers/.
    Returns the public URL of the uploaded image.
    """
    from ..utils.media_utils import save_upload_file
    url = save_upload_file(file, folder="transfers")
    return {"url": url}

@router.post("/bulk-entry", dependencies=[Depends(warehouse_or_admin)])
def bulk_entry(
    entry_data: schemas.SerializedEntry, 
    db: Session = Depends(get_db)
):
    """
    Mass entry of serialized items (IMEIs).
    Optimized for performance ("Metralleta").
    """
    return InventoryService.process_bulk_entry(db, entry_data)

@router.get("/validate-imei")
def validate_imei(product_id: int, imei: str, db: Session = Depends(get_db)):
    """
    Check if an IMEI is valid and available for a given product.
    """
    return InventoryService.validate_imei_availability(db, product_id, imei)

@router.get("/validate-entry")
def validate_imei_for_entry(imei: str, db: Session = Depends(get_db)):
    """
    Check if an IMEI is ALREADY in the database.
    Used for Reception (Entry) to prevent duplicates.
    Returns: {"exists": bool, "message": str}
    """
    return InventoryService.validate_imei_for_entry(db, imei)


@router.get("/serialized-instances", dependencies=[any_authenticated])
def get_all_serialized_instances(db: Session = Depends(get_db)):
    """
    Get ALL serialized instances (IMEIs) across all products.
    Used for the serialized report PDF.
    """
    instances = db.query(models.ProductInstance).options(
        joinedload(models.ProductInstance.warehouse)
    ).order_by(
        models.ProductInstance.product_id,
        models.ProductInstance.status,
        models.ProductInstance.created_at.desc()
    ).all()
    return instances

@router.get("/product/{product_id}/instances")
def get_product_instances(product_id: int, db: Session = Depends(get_db)):
    """
    Get all serialized instances (IMEIs) for a specific product.
    Includes status, warehouse, and dates.
    """
    instances = db.query(models.ProductInstance).options(
        joinedload(models.ProductInstance.warehouse)
    ).filter(
        models.ProductInstance.product_id == product_id
    ).order_by(models.ProductInstance.status, models.ProductInstance.created_at.desc()).all()

    return instances


@router.delete("/instance/{instance_id}", dependencies=[Depends(warehouse_or_admin)])
def delete_imei_instance(
    instance_id: int,
    reason: str = "Corrección de error",
    db: Session = Depends(get_db),
    current_user: models.User = Depends(warehouse_or_admin)
):
    """
    Eliminar un IMEI/serial ingresado por error.
    - Si está AVAILABLE: descuenta el stock y elimina el registro
    - Si está SOLD: solo elimina el registro (el stock ya salió con la venta)
    """
    instance = db.query(models.ProductInstance).filter(
        models.ProductInstance.id == instance_id
    ).options(
        joinedload(models.ProductInstance.product),
        joinedload(models.ProductInstance.warehouse)
    ).first()

    if not instance:
        raise HTTPException(status_code=404, detail="IMEI no encontrado")

    product = instance.product
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    result = {
        "imei": instance.serial_number,
        "product_name": product.name,
        "status_was": instance.status.value if hasattr(instance.status, 'value') else str(instance.status),
        "stock_adjusted": False
    }

    if str(instance.status) in ("AVAILABLE", "ProductInstanceStatus.AVAILABLE"):
        # Descontar del stock ya que el IMEI estaba disponible
        product.stock = max(0, float(product.stock) - 1)

        # Descontar también del product_stocks del almacén
        if instance.warehouse_id:
            ps = db.query(models.ProductStock).filter(
                models.ProductStock.product_id == product.id,
                models.ProductStock.warehouse_id == instance.warehouse_id
            ).first()
            if ps:
                ps.quantity = max(0, float(ps.quantity) - 1)

        # Kardex de ajuste
        kardex = models.Kardex(
            product_id=product.id,
            warehouse_id=instance.warehouse_id,
            movement_type="ADJUSTMENT_OUT",
            quantity=-1,
            balance_after=product.stock,
            description=f"Eliminación IMEI {instance.serial_number} — {reason}",
            date=datetime.now()
        )
        db.add(kardex)
        result["stock_adjusted"] = True

    # Eliminar el instance
    db.delete(instance)
    db.commit()

    return {"status": "deleted", **result}


@router.patch("/instance/{instance_id}/fix-serial", dependencies=[Depends(warehouse_or_admin)])
def fix_imei_serial(
    instance_id: int,
    body: dict,
    db: Session = Depends(get_db)
):
    """Corregir el número de serial/IMEI de un registro existente"""
    instance = db.query(models.ProductInstance).filter(
        models.ProductInstance.id == instance_id
    ).first()
    if not instance:
        raise HTTPException(status_code=404, detail="IMEI no encontrado")

    new_serial = body.get("serial_number", "").strip()
    if not new_serial:
        raise HTTPException(status_code=400, detail="Serial no puede estar vacío")

    # Verificar que no exista otro con ese serial
    existing = db.query(models.ProductInstance).filter(
        models.ProductInstance.serial_number == new_serial,
        models.ProductInstance.id != instance_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"El serial {new_serial} ya existe en el sistema")

    old_serial = instance.serial_number
    instance.serial_number = new_serial
    db.commit()

    return {
        "status": "updated",
        "old_serial": old_serial,
        "new_serial": new_serial,
        "product_id": instance.product_id
    }


@router.get("/lookup-imei", dependencies=[any_authenticated])
def lookup_imei(imei: str, db: Session = Depends(get_db)):
    """
    Buscar un producto por IMEI/serial.
    Devuelve el producto, almacén y estado del IMEI.
    """
    instance = db.query(models.ProductInstance).filter(
        models.ProductInstance.serial_number.ilike(imei.strip())
    ).options(
        joinedload(models.ProductInstance.product),
        joinedload(models.ProductInstance.warehouse),
    ).first()

    if not instance:
        raise HTTPException(status_code=404, detail="IMEI no encontrado en el inventario")

    product = instance.product
    return {
        "imei": instance.serial_number,
        "status": instance.status,
        "warehouse": instance.warehouse.name if instance.warehouse else None,
        "product": {
            "id": product.id,
            "name": product.name,
            "sku": product.sku,
            "price": float(product.price),
            "cost": float(getattr(product, "cost_price", None) or getattr(product, "cost", None) or 0),
            "stock": float(product.stock),
            "category_name": product.category.name if product.category else None,
            "image_url": product.image_url,
            "description": product.description,
            "has_imei": product.has_imei,
        } if product else None,
        "sold_at": instance.updated_at.isoformat() if instance.status == "SOLD" and instance.updated_at else None,
    }
