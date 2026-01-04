from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from typing import List
import json
import asyncio
from datetime import date, datetime
from ..database.db import get_db
from ..models import models
from ..models.models import UserRole
from .. import schemas
from ..dependencies import has_role, cashier_or_admin
from ..websocket.manager import manager
from ..websocket.events import WebSocketEvents
from ..audit_utils import log_action
from ..services.product_import_service import ProductImportService
from ..services.product_export_service import ProductExportService

router = APIRouter(prefix="/products", tags=["products"])

# Helper para ejecutar broadcast asíncrono desde contexto síncrono
def run_broadcast(event: str, data: dict):
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(manager.broadcast(event, data))
    finally:
        loop.close()

from typing import Optional
from sqlalchemy import or_
from pydantic import BaseModel

@router.get("/", response_model=List[schemas.ProductRead])
@router.get("", response_model=List[schemas.ProductRead], include_in_schema=False)
def read_products(
    skip: int = 0, 
    limit: int = 5000, 
    search: Optional[str] = None, 
    warehouse_id: Optional[int] = None,  # NEW PARAM
    db: Session = Depends(get_db)
):
    try:
        query = db.query(models.Product).options(joinedload(models.Product.units), joinedload(models.Product.stocks)).filter(models.Product.is_active == True)
        
        # FILTER: Warehouse
        if warehouse_id:
            # Only return products that have POSITIVE stock in the selected warehouse
            query = query.join(models.ProductStock).filter(
                models.ProductStock.warehouse_id == warehouse_id,
                models.ProductStock.quantity > 0
            )

        if search:
            search_term = f"%{search}%"
            query = query.filter(
                or_(
                    models.Product.name.ilike(search_term),
                    models.Product.sku.ilike(search_term)
                )
            )
            
        products = query.offset(skip).limit(limit).all()
        print(f"[OK] Loaded {len(products)} products successfully (Search: {search}, Warehouse: {warehouse_id})")
        return products
    except Exception as e:
        print(f"[ERROR] ERROR loading products: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error loading products: {str(e)}")

@router.post("/", response_model=schemas.ProductRead, dependencies=[Depends(has_role([UserRole.ADMIN, UserRole.WAREHOUSE]))])
@router.post("", response_model=schemas.ProductRead, dependencies=[Depends(has_role([UserRole.ADMIN, UserRole.WAREHOUSE]))], include_in_schema=False)
def create_product(product: schemas.ProductCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    # 1. Operaciones DB (Síncronas en Threadpool)
    product_data = product.dict(exclude={"units", "combo_items", "warehouse_stocks"})
    db_product = models.Product(**product_data)
    db.add(db_product)
    try:
        db.commit()
        db.refresh(db_product)
    except Exception as e:
        db.rollback()
        if "unique" in str(e).lower() or "duplicate" in str(e).lower():
            raise HTTPException(status_code=400, detail="Product with this SKU or Name already exists")
        raise HTTPException(status_code=500, detail=f"Database Error: {str(e)}")

    # Process Units
    if product.units:
        for unit in product.units:
            db_unit = models.ProductUnit(**unit.dict(), product_id=db_product.id)
            db.add(db_unit)
    
    try:
        db.commit()
        db.refresh(db_product)
    except Exception as e:
        db.rollback()
        error_msg = str(e).lower()
        if "unique" in error_msg or "duplicate" in error_msg:
             raise HTTPException(status_code=400, detail=f"Error: SKU or Name already exists. ({str(e)})")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    
    # NEW: Process Combo Items
    if product.combo_items:
        for combo_item in product.combo_items:
            db_combo_item = models.ComboItem(
                parent_product_id=db_product.id,
                child_product_id=combo_item.child_product_id,
                quantity=combo_item.quantity,
                unit_id=combo_item.unit_id  # NEW: Include unit_id
            )
            db.add(db_combo_item)
        db.commit()
        db.refresh(db_product)
        
    # NEW: Process Warehouse Stocks
    total_stock = 0
    if product.warehouse_stocks:
        for stock in product.warehouse_stocks:
            db_stock = models.ProductStock(
                product_id=db_product.id,
                warehouse_id=stock.warehouse_id,
                quantity=stock.quantity,
                location=stock.location
            )
            db.add(db_stock)
            total_stock += stock.quantity
        
        # Sync total stock
        db_product.stock = total_stock
        db.commit()
        db.refresh(db_product)
    else:
        # If no stocks provided but total stock is > 0, assign to MAIN warehouse (ID 1 default)
        if product.stock > 0:
            main_wh = db.query(models.Warehouse).filter(models.Warehouse.is_main == True).first()
            if main_wh:
                db_stock = models.ProductStock(
                    product_id=db_product.id,
                    warehouse_id=main_wh.id,
                    quantity=product.stock,
                    location=product.location
                )
                db.add(db_stock)
                db.commit()
                db.refresh(db_product)

    # 2. WebSocket en Background
    payload = {
        "id": db_product.id,
        "name": db_product.name,
        "price": float(db_product.price),
        "stock": float(db_product.stock),
        "is_combo": db_product.is_combo,
        "exchange_rate_id": db_product.exchange_rate_id,
        "units": [
            {
                "id": u.id,
                "unit_name": u.unit_name,
                "conversion_factor": float(u.conversion_factor),
                "price_usd": float(u.price_usd) if u.price_usd else None,
                "barcode": u.barcode
            } for u in db_product.units
        ] if db_product.units else [],
        "combo_items": [
            {
                "id": c.id,
                "child_product_id": c.child_product_id,
                "quantity": float(c.quantity)
            } for c in db_product.combo_items
        ] if db_product.combo_items else []
    }
    background_tasks.add_task(run_broadcast, WebSocketEvents.PRODUCT_CREATED, payload)
        
    return db_product

@router.put("/{product_id}", response_model=schemas.ProductRead, dependencies=[Depends(has_role([UserRole.ADMIN, UserRole.WAREHOUSE]))])
def update_product(product_id: int, product_update: schemas.ProductUpdate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    db_product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    update_data = product_update.dict(exclude_unset=True)
    
    # Separate units data if present
    units_data = None
    if "units" in update_data:
        units_data = update_data.pop("units")
    
    # NEW: Separate combo_items data if present
    combo_items_data = None
    if "combo_items" in update_data:
        combo_items_data = update_data.pop("combo_items")

    # NEW: Separate warehouse_stocks data if present
    stocks_data = None
    if "warehouse_stocks" in update_data:
        stocks_data = update_data.pop("warehouse_stocks")

    # Capture Current State (Old)
    old_state = {c.name: getattr(db_product, c.name) for c in db_product.__table__.columns}

    # Apply Updates
    for key, value in update_data.items():
        setattr(db_product, key, value)
    
    # Handle Units Update (Snapshot Strategy: Delete all old, create new)
    if units_data is not None:
        # Delete existing units
        db.query(models.ProductUnit).filter(models.ProductUnit.product_id == product_id).delete()
        
        # Add new units
        for unit in units_data:
            db_unit = models.ProductUnit(**unit, product_id=product_id)
            db.add(db_unit)
    
    # NEW: Handle Combo Items Update (Snapshot Strategy)
    if combo_items_data is not None:
        # Delete existing combo items
        db.query(models.ComboItem).filter(
            models.ComboItem.parent_product_id == product_id
        ).delete()
        
        # Add new combo items
        for combo_item in combo_items_data:
            db_combo_item = models.ComboItem(
                parent_product_id=product_id,
                child_product_id=combo_item["child_product_id"],
                quantity=combo_item["quantity"],
                unit_id=combo_item.get("unit_id")  # NEW: Include unit_id
            )
            db.add(db_combo_item)
            
    # NEW: Handle Stocks Update (Snapshot Strategy)
    if stocks_data is not None:
        # Delete existing stocks
        db.query(models.ProductStock).filter(models.ProductStock.product_id == product_id).delete()
        
        total_stock = 0
        for stock in stocks_data:
            # Pydantic model vs dict check
            w_id = stock["warehouse_id"] if isinstance(stock, dict) else stock.warehouse_id
            qty = stock["quantity"] if isinstance(stock, dict) else stock.quantity
            loc = stock.get("location") if isinstance(stock, dict) else stock.location

            db_stock = models.ProductStock(
                product_id=product_id,
                warehouse_id=w_id,
                quantity=qty,
                location=loc
            )
            db.add(db_stock)
            total_stock += qty
        
        # Sync total
        db_product.stock = total_stock

    db.commit()
    db.refresh(db_product)
    
    # Logic Refactor: Audit (Simplified)
    user_id = 1 # TODO: Get from current_user
    new_state = {c.name: getattr(db_product, c.name) for c in db_product.__table__.columns}
    
    changes = {}
    for k, v in new_state.items():
        if k in old_state and old_state[k] != v:
            changes[k] = {"old": old_state[k], "new": v}
            
    if changes:
        log_action(db, user_id=user_id, action="UPDATE", table_name="products", record_id=db_product.id, changes=json.dumps(changes, default=str))

    # Broadcast
    payload = {
        "id": db_product.id,
        "name": db_product.name,
        "price": float(db_product.price),
        "stock": float(db_product.stock),
        "is_combo": db_product.is_combo,
        "exchange_rate_id": db_product.exchange_rate_id,
        "units": [
            {
                "id": u.id,
                "unit_name": u.unit_name,
                "conversion_factor": float(u.conversion_factor),
                "price_usd": float(u.price_usd) if u.price_usd else None,
                "barcode": u.barcode
            } for u in db_product.units
        ] if db_product.units else [],
        "combo_items": [
            {
                "id": c.id,
                "child_product_id": c.child_product_id,
                "quantity": float(c.quantity)
            } for c in db_product.combo_items
        ] if db_product.combo_items else []
    }
    background_tasks.add_task(run_broadcast, WebSocketEvents.PRODUCT_UPDATED, payload)
    
    return db_product

# ========================================
# BULK IMPORT/EXPORT ENDPOINTS
# (Must be BEFORE /{product_id} to avoid route conflicts)
# ========================================

@router.get("/template")
def download_template():
    """
    Download Excel template for bulk product import
    """
    buffer = ProductExportService.generate_template()
    
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=plantilla_productos.xlsx"}
    )

@router.post("/import", dependencies=[Depends(has_role([UserRole.ADMIN, UserRole.WAREHOUSE]))])
async def import_products(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Import products from Excel file
    
    Returns:
        {
            "success": true,
            "created": 45,
            "errors": []
        }
    """
    # Validate file type
    if not file.filename.endswith('.xlsx'):
        raise HTTPException(
            status_code=400,
            detail="Solo se permiten archivos .xlsx"
        )
    
    # Read file
    try:
        contents = await file.read()
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Error leyendo archivo: {str(e)}"
        )
    
    # Parse and validate
    products_to_create, errors = ProductImportService.parse_excel_to_products(contents, db)
    
    # If there are validation errors, return them
    if errors:
        return {
            "success": False,
            "created": 0,
            "errors": errors
        }
    
    # Create products
    try:
        created_count = ProductImportService.bulk_create_products(products_to_create, db)
        
        return {
            "success": True,
            "created": created_count,
            "errors": []
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error creando productos: {str(e)}"
        )

@router.get("/export/excel")
def export_excel(db: Session = Depends(get_db)):
    """
    Export all active products to Excel
    """
    products = db.query(models.Product).filter(
        models.Product.is_active == True
    ).options(
        joinedload(models.Product.category),
        joinedload(models.Product.supplier)
    ).all()
    
    buffer = ProductExportService.export_to_excel(products)
    
    filename = f"inventario_{date.today().strftime('%Y-%m-%d')}.xlsx"
    
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.get("/export/pdf")
def export_pdf(db: Session = Depends(get_db)):
    """
    Export all active products to PDF
    """
    # Get business name from config if available
    business_name = "Inventario"
    
    products = db.query(models.Product).filter(
        models.Product.is_active == True
    ).options(
        joinedload(models.Product.category),
        joinedload(models.Product.supplier)
    ).all()
    
    buffer = ProductExportService.export_to_pdf(products, business_name)
    
    filename = f"inventario_{date.today().strftime('%Y-%m-%d')}.pdf"
    
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

# ========================================
# PRODUCT CRUD ENDPOINTS (with dynamic routes)
# ========================================

@router.get("/credits", dependencies=[Depends(cashier_or_admin)])
def get_credit_sales(db: Session = Depends(get_db)):
    """
    Get all credit sales (invoices) for Accounts Receivable.
    Used by the CxC module.
    Returns both Pending and Paid to allow history filtering on frontend.
    """
    query = db.query(models.Sale).filter(
        models.Sale.is_credit == True
    ).options(
        joinedload(models.Sale.customer),
        joinedload(models.Sale.payments),
        joinedload(models.Sale.details).joinedload(models.SaleDetail.product),
        joinedload(models.Sale.returns)
    ).order_by(models.Sale.due_date.asc())
    
    return query.all()

@router.get("/sales/", dependencies=[Depends(cashier_or_admin)])
def get_all_sales(
    limit: int = 50,
    offset: int = 0,
    sort: str = "date",
    order: str = "desc",
    db: Session = Depends(get_db)
):
    """
    Get all sales (cash, credit, card, etc.) with pagination and sorting.
    Used by Dashboard and reports.
    
    Query params:
    - limit: Max number of results (default 50)
    - offset: Pagination offset (default 0)
    - sort: Field to sort by (default 'date')
    - order: 'asc' or 'desc' (default 'desc')
    """
    query = db.query(models.Sale).options(
        joinedload(models.Sale.customer),
        joinedload(models.Sale.payments),
        joinedload(models.Sale.details).joinedload(models.SaleDetail.product),
        joinedload(models.Sale.returns)
    )
    
    # Apply sorting
    if sort == "date":
        if order == "desc":
            query = query.order_by(models.Sale.date.desc())
        else:
            query = query.order_by(models.Sale.date.asc())
    elif sort == "total_amount":
        if order == "desc":
            query = query.order_by(models.Sale.total_amount.desc())
        else:
            query = query.order_by(models.Sale.total_amount.asc())
    else:
        # Default to date desc
        query = query.order_by(models.Sale.date.desc())
    
    # Apply pagination
    query = query.offset(offset).limit(limit)
    
    return query.all()



@router.get("/{product_id}", response_model=schemas.ProductRead)
def read_product(product_id: int, db: Session = Depends(get_db)):
    product = db.query(models.Product).options(joinedload(models.Product.units), joinedload(models.Product.stocks)).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product

@router.delete("/{product_id}", dependencies=[Depends(has_role([UserRole.ADMIN]))])
def delete_product(product_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Soft delete (set inactive)
    product.is_active = False
    db.commit()
    
    # Broadcast product deleted/deactivated
    payload = {
        "id": product.id,
        "name": product.name
    }
    background_tasks.add_task(run_broadcast, WebSocketEvents.PRODUCT_DELETED, payload)
    
    return {"status": "success", "message": "Product deactivated"}

# ========================================
# PRICE CALCULATION UTILITY
# ========================================

@router.post("/calculate-price")
def calculate_price(
    price_usd: float,
    exchange_rate_id: int = None,
    db: Session = Depends(get_db)
):
    """
    Calculate prices in all currencies using a specific exchange rate.
    If exchange_rate_id is provided, use that rate.
    Otherwise, use default rates for each currency.
    """
    if exchange_rate_id:
        # Use specific rate
        rate = db.query(models.ExchangeRate).get(exchange_rate_id)
        if not rate or not rate.is_active:
            raise HTTPException(status_code=404, detail="Exchange rate not found or inactive")
        
        return {
            "price_usd": price_usd,
            "exchange_rate": {
                "id": rate.id,
                "name": rate.name,
                "currency_code": rate.currency_code,
                "rate": rate.rate
            },
            "converted_price": price_usd * rate.rate,
            "currency_symbol": rate.currency_symbol
        }
    else:
        # Calculate for all active default rates
        default_rates = db.query(models.ExchangeRate).filter(
            models.ExchangeRate.is_default == True,
            models.ExchangeRate.is_active == True
        ).all()
        
        results = []
        for rate in default_rates:
            results.append({
                "currency_code": rate.currency_code,
                "currency_symbol": rate.currency_symbol,
                "rate_name": rate.name,
                "exchange_rate": rate.rate,
                "converted_price": price_usd * rate.rate
            })
        
        return {
            "price_usd": price_usd,
            "conversions": results
        }

@router.get("/{product_id}/rules", response_model=List[schemas.PriceRuleRead])
def read_price_rules(product_id: int, db: Session = Depends(get_db)):
    rules = db.query(models.PriceRule).filter(models.PriceRule.product_id == product_id).order_by(models.PriceRule.min_quantity).all()
    return rules

@router.post("/{product_id}/rules", response_model=schemas.PriceRuleRead)
def create_price_rule(product_id: int, rule: schemas.PriceRuleCreate, db: Session = Depends(get_db)):
    db_rule = models.PriceRule(**rule.dict())
    db_rule.product_id = product_id # Override with path param
    db.add(db_rule)
    db.commit()
    db.refresh(db_rule)
    return db_rule

@router.delete("/rules/{rule_id}")
def delete_price_rule(rule_id: int, db: Session = Depends(get_db)):
    rule = db.query(models.PriceRule).filter(models.PriceRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    db.delete(rule)
    db.commit()
    return {"status": "success"}

@router.post("/sales/", dependencies=[Depends(cashier_or_admin)])
def create_sale(sale_data: schemas.SaleCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    from ..services.sales_service import SalesService
    
    # Delegate to Service (Now Sync)
    # TODO: Get actual user_id from dependency
    return SalesService.create_sale(db, sale_data, user_id=1, background_tasks=background_tasks)

# NEW: Get sale detail with items (for invoice detail view)
@router.get("/sales/{sale_id}", response_model=schemas.SaleRead, dependencies=[Depends(cashier_or_admin)])
def get_sale_detail(sale_id: int, db: Session = Depends(get_db)):
    """Get sale with details (items/products) for invoice view"""
    sale = db.query(models.Sale).options(
        joinedload(models.Sale.details).joinedload(models.SaleDetail.product),
        joinedload(models.Sale.customer),
        joinedload(models.Sale.payments)
    ).filter(models.Sale.id == sale_id).first()
    
    
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    
    return sale

@router.post("/sales/{sale_id}/print", dependencies=[Depends(cashier_or_admin)])
def print_sale_endpoint(sale_id: int, db: Session = Depends(get_db)):
    """
    Get print payload for client-side printing.
    Returns template and context for the Hardware Bridge.
    """
    from ..services.sales_service import SalesService
    
    # Now returns JSON { template, context, status }
    return SalesService.get_sale_print_payload(db, sale_id)

@router.post("/print/remote", dependencies=[Depends(cashier_or_admin)])
async def print_remote(
    request: schemas.RemotePrintRequest,
    db: Session = Depends(get_db)
):
    """
    Send print command to Hardware Bridge via WebSocket
    
    Args:
        request: RemotePrintRequest with client_id and sale_id
    
    Returns:
        Success/failure status
    """
    from ..services.sales_service import SalesService
    from ..services.websocket_manager import manager
    
    # Check if Hardware Bridge is connected
    if not manager.is_client_connected(request.client_id):
        raise HTTPException(
            status_code=503,
            detail=f"Hardware Bridge '{request.client_id}' no está conectado. Verifique que BridgeInvensoft.exe esté ejecutándose."
        )
    
    # Get print payload
    try:
        payload = SalesService.get_sale_print_payload(db, request.sale_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generando ticket: {str(e)}")
    
    # Send to Hardware Bridge via WebSocket
    message = {
        "type": "print",
        "sale_id": request.sale_id,
        "payload": payload
    }
    
    success = await manager.send_to_client(request.client_id, message)
    
    if not success:
        raise HTTPException(
            status_code=500,
            detail=f"Error enviando comando de impresión a '{request.client_id}'"
        )
    
    return {
        "status": "success",
        "message": f"Comando de impresión enviado a {request.client_id}",
        "sale_id": request.sale_id
    }

class RemotePrintPayloadRequest(BaseModel):
    client_id: str
    payload: dict

@router.post("/print/remote/payload", dependencies=[Depends(cashier_or_admin)])
async def print_remote_payload(
    request: RemotePrintPayloadRequest,
    db: Session = Depends(get_db)
):
    """
    Send raw print payload to Hardware Bridge via WebSocket
    """
    from ..services.websocket_manager import manager
    
    # Check if Hardware Bridge is connected
    if not manager.is_client_connected(request.client_id):
        raise HTTPException(
            status_code=503,
            detail=f"Hardware Bridge '{request.client_id}' no está conectado."
        )
    
    # Send to Hardware Bridge via WebSocket
    message = {
        "type": "print",
        "payload": request.payload
    }
    
    success = await manager.send_to_client(request.client_id, message)
    
    if not success:
        raise HTTPException(
            status_code=500,
            detail=f"Error enviando comando de impresión a '{request.client_id}'"
        )
    
    return {
        "status": "success",
        "message": f"Reporte enviado a {request.client_id}"
    }

@router.post("/sales/payments", dependencies=[Depends(cashier_or_admin)])
def register_sale_payment(
    payment_data: schemas.SalePaymentCreate,
    db: Session = Depends(get_db)
):
    """Register a payment (abono) for a credit sale"""
    from ..services.sales_service import SalesService
    return SalesService.register_payment(db, payment_data)

@router.put("/sales/{sale_id}", dependencies=[Depends(cashier_or_admin)])
def update_sale(
    sale_id: int,
    balance_pending: float = None,
    paid: bool = None,
    db: Session = Depends(get_db)
):
    """Update sale balance and paid status"""
    print(f"[UPDATE] UPDATE SALE {sale_id}: balance_pending={balance_pending}, paid={paid}")
    
    sale = db.query(models.Sale).filter(models.Sale.id == sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    
    print(f"   Before: paid={sale.paid}, balance={sale.balance_pending}")
    
    if balance_pending is not None:
        sale.balance_pending = balance_pending
    
    if paid is not None:
        sale.paid = paid
    
    db.commit()
    db.refresh(sale)
    
    print(f"   After: paid={sale.paid}, balance={sale.balance_pending}")
    
    return {"status": "success", "sale": sale}

@router.post("/bulk", response_model=schemas.BulkImportResult)
def bulk_create_products(products: List[schemas.ProductCreate], db: Session = Depends(get_db)):
    # Initialize result using Pydantic model
    result = schemas.BulkImportResult(success_count=0, failed_count=0, errors=[])
    
    for p in products:
        try:
            # Use nested transaction (savepoint) to isolate each insertion
            with db.begin_nested():
                db_product = models.Product(
                    name=p.name,
                    sku=p.sku,
                    price=p.price,
                    cost_price=p.cost_price,
                    stock=p.stock,
                    description=p.description,
                    min_stock=p.min_stock,
                    is_box=p.is_box,
                    conversion_factor=p.conversion_factor,
                    category_id=p.category_id,
                    supplier_id=p.supplier_id,
                    is_active=True # Default true for imports
                )
                db.add(db_product)
                db.flush() # Force SQL execution to catch constraints
            
            result.success_count += 1
        except Exception as e:
            result.failed_count += 1
            msg = str(e)
            if "UNIQUE constraint failed" in msg or "Duplicate entry" in msg:
                msg = f"SKU '{p.sku}' ya existe."
            result.errors.append(f"Producto '{p.name}': {msg}")
            
    db.commit()
    return result


# ============================================
# IMAGE MANAGEMENT ENDPOINTS
# ============================================

from fastapi.responses import FileResponse
from PIL import Image
import os
import io

# Image storage directory - environment aware
IS_DOCKER = os.getenv('DOCKER_CONTAINER', 'false').lower() == 'true'
if IS_DOCKER:
    IMAGES_DIR = "/app/data/images/products"
    PLACEHOLDER_PATH = "/app/ferreteria_refactor/backend_api/assets/placeholder.webp"
else:
    # Local development paths
    # __file__ is in: ferreteria_refactor/backend_api/routers/products.py
    # We need: ferreteria_refactor/backend_api/data/images/products
    current_file = os.path.abspath(__file__)  # .../routers/products.py
    routers_dir = os.path.dirname(current_file)  # .../routers
    backend_api_dir = os.path.dirname(routers_dir)  # .../backend_api
    IMAGES_DIR = os.path.join(backend_api_dir, "data", "images", "products")
    PLACEHOLDER_PATH = os.path.join(backend_api_dir, "assets", "placeholder.webp")

# Ensure directory exists
os.makedirs(IMAGES_DIR, exist_ok=True)

@router.post("/{product_id}/image")
async def upload_product_image(
    product_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Upload or replace product image.
    - Validates file size (max 2MB)
    - Converts to WebP format
    - Resizes to max 800x800px
    - Updates product.updated_at automatically
    """
    # 1. Verify product exists
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    
    # 2. Validate file size (max 2MB)
    contents = await file.read()
    file_size = len(contents)
    if file_size > 2 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Imagen muy pesada (máximo 2MB)")
    
    # 3. Validate file type and process with Pillow
    try:
        img = Image.open(io.BytesIO(contents))
        
        # Convert to RGB if necessary (for WebP compatibility)
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        
        # Resize maintaining aspect ratio
        img.thumbnail((800, 800), Image.Resampling.LANCZOS)
        
        # Save as WebP
        image_filename = f"{product_id}.webp"
        image_path = os.path.join(IMAGES_DIR, image_filename)
        img.save(image_path, "WEBP", quality=80)
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error procesando imagen: {str(e)}")
    
    # 4. Update database
    product.image_url = f"/images/products/{image_filename}"
    product.updated_at = datetime.now() # Force update to bust cache
    db.commit()
    
    return {
        "success": True,
        "image_url": product.image_url,
        "message": "Imagen subida correctamente"
    }


@router.get("/{product_id}/image")
def get_product_image(product_id: int, db: Session = Depends(get_db)):
    """
    Get product image file.
    Returns placeholder if product has no image.
    """
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    
    if not product or not product.image_url:
        # Return placeholder
        if os.path.exists(PLACEHOLDER_PATH):
            return FileResponse(PLACEHOLDER_PATH, media_type="image/webp")
        raise HTTPException(status_code=404, detail="Imagen no encontrada")
    
    # Build full path
    image_path = os.path.join(IMAGES_DIR, f"{product_id}.webp")
    
    if not os.path.exists(image_path):
        # Fallback to placeholder
        if os.path.exists(PLACEHOLDER_PATH):
            return FileResponse(PLACEHOLDER_PATH, media_type="image/webp")
        raise HTTPException(status_code=404, detail="Imagen no encontrada")
    
    return FileResponse(image_path, media_type="image/webp")


@router.delete("/{product_id}/image")
def delete_product_image(product_id: int, db: Session = Depends(get_db)):
    """
    Delete product image.
    Removes file from disk and clears image_url in database.
    """
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    
    if not product.image_url:
        raise HTTPException(status_code=404, detail="El producto no tiene imagen")
    
    # Delete file from disk
    image_path = os.path.join(IMAGES_DIR, f"{product_id}.webp")
    if os.path.exists(image_path):
        os.remove(image_path)
    
    # Clear database reference
    product.image_url = None
    # updated_at is auto-updated by SQLAlchemy onupdate
    db.commit()
    
    return {
        "success": True,
        "message": "Imagen eliminada correctamente"
    }

