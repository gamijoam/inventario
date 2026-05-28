from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, UploadFile, File, Query, Response
from ..cache import get_cached, set_cached, invalidate, invalidate_resource
from ..tenant_context import get_tenant_schema
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload, subqueryload
from decimal import Decimal
from typing import List
import json
import asyncio
from datetime import date, datetime
from ..database.db import get_db
from ..models import models
from ..models.models import UserRole
from ..models import restaurant as rest_models # NEW
from .. import schemas
from ..dependencies import has_role, cashier_or_admin, get_current_active_user
from ..websocket.manager import manager
from ..websocket.events import WebSocketEvents
from ..audit_utils import log_action
from ..services.product_import_service import ProductImportService
from ..services.product_export_service import ProductExportService
from ..utils.media_utils import save_upload_file, save_bytes_as_image
from ..services.bg_remover import remove_background, is_available as bg_is_available
from fastapi.responses import Response

router = APIRouter(prefix="/products", tags=["products"])

@router.post("/upload-image", dependencies=[Depends(has_role([UserRole.ADMIN, UserRole.WAREHOUSE]))])
async def upload_product_image(
    file: UploadFile = File(...),
    current_user: models.User = Depends(has_role([UserRole.ADMIN, UserRole.WAREHOUSE]))
):
    """
    Securely upload a product image.
    Isolation: /media/{tenant_id}/products/{uuid}.webp
    Soporta imágenes con canal alpha (resultado de eliminar fondo).
    """
    image_url = save_upload_file(file, folder="products")
    return {"success": True, "image_url": image_url}


@router.post("/remove-background", dependencies=[Depends(has_role([UserRole.ADMIN, UserRole.WAREHOUSE]))])
async def remove_image_background(
    file: UploadFile = File(...),
    current_user: models.User = Depends(has_role([UserRole.ADMIN, UserRole.WAREHOUSE]))
):
    """
    Elimina el fondo de una imagen usando AI (rembg/u2netp).
    Recibe imagen multipart, devuelve PNG con fondo transparente como binario.

    El frontend usa este endpoint en el preview ANTES de subir la imagen final.
    Después puede subir el resultado (con alpha) vía /upload-image normal.
    """
    # Validar tipo
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(status_code=400, detail="El archivo debe ser una imagen")

    raw = await file.read()
    if not raw or len(raw) < 50:
        raise HTTPException(status_code=400, detail="Imagen vacía o inválida")

    # Procesar con rembg
    out_bytes = remove_background(raw)

    return Response(
        content=out_bytes,
        media_type="image/png",
        headers={"Cache-Control": "no-store", "X-BG-Removed": "1"}
    )


@router.get("/remove-background/status")
async def remove_background_status():
    """Indica si el servicio de eliminar fondo está disponible."""
    return {"available": bg_is_available()}

# Helper para ejecutar broadcast asíncrono desde contexto síncrono
def run_broadcast(event: str, data: dict):
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(manager.broadcast_all({"type": event, "data": data}))
    finally:
        loop.close()

from typing import Optional
from sqlalchemy import or_, and_, func
from pydantic import BaseModel

@router.get("/catalog", response_model=schemas.PaginatedCatalog)
@router.get("/catalog/", response_model=schemas.PaginatedCatalog, include_in_schema=False)
def read_catalog_products(
    response: Response,
    skip: int = 0,
    limit: int = Query(default=200, le=1000),
    search: Optional[str] = None,
    category_id: Optional[int] = None,
    warehouse_id: Optional[int] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    is_menu_item: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    # Cache 60s en cliente si no hay búsqueda — reduce llamadas repetidas al servidor
    if not search:
        response.headers["Cache-Control"] = "private, max-age=60"
    else:
        response.headers["Cache-Control"] = "no-store"

    # Redis cache para el catálogo sin filtros (el caso más común en el POS)
    if not any([search, category_id, warehouse_id, min_price, max_price, is_menu_item, skip]):
        from ..tenant_context import get_tenant_schema as _gts
        _schema = _gts()
        _cache_key = f"catalog:{limit}"
        _cached = get_cached(_schema, _cache_key)
        if _cached is not None:
            return _cached
    """
    Lightweight product listing for POS/catalog views.
    Only loads essential relationships (category, units, stocks, prices).
    Skips combo_items, price_rules, discount_rules for faster response.
    Returns paginated response with {items, total, has_more}.
    """
    # Base filter query (shared between count and main query)
    base_query = db.query(models.Product).filter(models.Product.is_active == True)

    if warehouse_id:
        # Combos: always include (availability computed from components, not own stock)
        # Non-combos: must have stock > 0 in the selected warehouse
        has_stock_subq = (
            db.query(models.ProductStock.product_id)
            .filter(
                models.ProductStock.warehouse_id == warehouse_id,
                models.ProductStock.quantity > 0,
            )
            .subquery()
        )
        base_query = base_query.filter(
            or_(
                models.Product.is_combo == True,
                models.Product.id.in_(has_stock_subq),
            )
        )

    if category_id:
        base_query = base_query.filter(models.Product.category_id == category_id)

    if is_menu_item is not None:
        base_query = base_query.filter(models.Product.is_menu_item == is_menu_item)

    if search:
        # Split query into tokens and require ALL words to appear in name OR sku
        # This handles: "Redmi 15C 256GB" matching "REDMI 15C 256GB-8RAM"
        tokens = [t for t in search.strip().split() if t]
        if len(tokens) == 1:
            search_term = f"%{tokens[0]}%"
            base_query = base_query.filter(
                or_(
                    models.Product.name.ilike(search_term),
                    models.Product.sku.ilike(search_term),
                )
            )
        else:
            # Multi-word: each token must appear somewhere in name OR sku
            token_conditions = [
                or_(
                    models.Product.name.ilike(f"%{t}%"),
                    models.Product.sku.ilike(f"%{t}%"),
                )
                for t in tokens
            ]
            base_query = base_query.filter(and_(*token_conditions))

    # Price range filter
    if min_price is not None:
        base_query = base_query.filter(models.Product.price >= min_price)
    if max_price is not None:
        base_query = base_query.filter(models.Product.price <= max_price)

    # Count query (before adding joinedload options)
    total = base_query.with_entities(func.count(models.Product.id)).scalar()

    # Main query with eager loading
    products = base_query.options(
        joinedload(models.Product.category),
        joinedload(models.Product.units),
        joinedload(models.Product.stocks),
        joinedload(models.Product.prices).joinedload(models.ProductPrice.price_list),
        # Combos: load components + their stocks to compute effective availability
        subqueryload(models.Product.combo_items)
            .subqueryload(models.ComboItem.child_product)
            .subqueryload(models.Product.stocks),
        # Recipes: load ingredients + their stocks for virtual stock calculation
        subqueryload(models.Product.recipes)
            .subqueryload(rest_models.RestaurantRecipe.ingredient)
            .subqueryload(models.Product.stocks),
    ).order_by(models.Product.name).offset(skip).limit(limit).all()

    # For combo or recipe products, replace stock with the effective quantity
    # from ingredient/component availability: min(floor(child_stock / qty_needed))
    for p in products:
        if p.recipes:
            min_available = float('inf')
            for rec in p.recipes:
                ing = rec.ingredient
                if not ing: continue
                if warehouse_id:
                    ing_stock = next((float(s.quantity) for s in ing.stocks if s.warehouse_id == warehouse_id), 0.0)
                else:
                    ing_stock = sum(float(s.quantity) for s in ing.stocks)
                qty_needed = float(rec.quantity) if rec.quantity else 1.0
                available = ing_stock / qty_needed
                if available < min_available: min_available = available
            p.stock = Decimal(str(int(min_available))) if min_available != float('inf') else Decimal('0')

        elif p.is_combo and p.combo_items:
            min_available = float('inf')
            for ci in p.combo_items:
                child = ci.child_product
                if not child:
                    min_available = 0
                    break
                if warehouse_id:
                    child_stock = next(
                        (float(s.quantity) for s in child.stocks if s.warehouse_id == warehouse_id),
                        0.0
                    )
                else:
                    child_stock = sum(float(s.quantity) for s in child.stocks)
                qty_needed = float(ci.quantity) if ci.quantity else 1.0
                available = child_stock / qty_needed
                if available < min_available:
                    min_available = available
            p.stock = Decimal(str(int(min_available))) if min_available != float('inf') else Decimal('0')
        else:
            if warehouse_id:
                warehouse_stock = sum(
                    float(s.quantity) for s in p.stocks if s.warehouse_id == warehouse_id
                )
                p.stock = Decimal(str(warehouse_stock))
            else:
                warehouse_stock = sum(float(s.quantity) for s in p.stocks)
                p.stock = Decimal(str(warehouse_stock))
            if warehouse_id:
                p.stocks = [s for s in p.stocks if s.warehouse_id == warehouse_id]

    # Conteos globales (sobre base_query sin paginación) para KPIs reales
    min_stock_default = 5
    total_in_stock = base_query.filter(
        models.Product.stock >= func.coalesce(models.Product.min_stock, min_stock_default)
    ).with_entities(func.count(models.Product.id)).scalar() or 0
    total_low_stock = base_query.filter(
        models.Product.stock > 0,
        models.Product.stock < func.coalesce(models.Product.min_stock, min_stock_default)
    ).with_entities(func.count(models.Product.id)).scalar() or 0
    total_out_of_stock = base_query.filter(
        models.Product.stock == 0
    ).with_entities(func.count(models.Product.id)).scalar() or 0

    catalog_result = {
        "items": products,
        "total": total,
        "has_more": (skip + limit) < total,
        "total_in_stock": total_in_stock,
        "total_low_stock": total_low_stock,
        "total_out_of_stock": total_out_of_stock,
    }

    # Guardar en Redis si es la primera página sin filtros (60s TTL)
    if not any([search, category_id, warehouse_id, min_price, max_price, is_menu_item]) and skip == 0:
        try:
            from ..tenant_context import get_tenant_schema as _gts
            set_cached(_gts(), f"catalog:{limit}", catalog_result, ttl=60)
        except Exception:
            pass

    return catalog_result

@router.get("/lookup", response_model=schemas.ProductRead)
@router.get("/lookup/", response_model=schemas.ProductRead, include_in_schema=False)
def lookup_product(
    sku: Optional[str] = None,
    product_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """
    Lightweight single-product lookup by SKU (exact, case-insensitive) or product_id.
    Used for barcode scanning and direct ID lookups in POS.
    """
    if not sku and not product_id:
        raise HTTPException(status_code=400, detail="Provide sku or product_id")

    query = db.query(models.Product).options(
        joinedload(models.Product.category),
        joinedload(models.Product.units),
        joinedload(models.Product.stocks),
        joinedload(models.Product.prices).joinedload(models.ProductPrice.price_list),
    ).filter(models.Product.is_active == True)

    if sku:
        # 1) Buscar por SKU exacto del producto
        product = query.filter(func.lower(models.Product.sku) == sku.lower()).first()
        # 2) Si no encontró, buscar en el barcode de las unidades (ProductUnit.barcode)
        if not product:
            unit = (
                db.query(models.ProductUnit)
                .filter(func.lower(models.ProductUnit.barcode) == sku.lower())
                .first()
            )
            if unit:
                product = query.filter(models.Product.id == unit.product_id).first()
    else:
        product = query.filter(models.Product.id == product_id).first()

    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    return product

@router.get("/kpis")
def get_product_kpis(
    warehouse_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """
    KPIs reales de inventario sobre TODOS los productos activos.
    Usa product_stocks para el stock real por almacén.
    """
    from sqlalchemy import text as _t
    schema = get_tenant_schema()

    if warehouse_id:
        sql = _t("""
            SELECT
                COUNT(DISTINCT p.id) as total,
                COUNT(DISTINCT p.id) FILTER(
                    WHERE COALESCE(ps_sum.qty, 0) > 0
                    AND COALESCE(ps_sum.qty, 0) >= COALESCE(p.min_stock, 5)
                ) as in_stock,
                COUNT(DISTINCT p.id) FILTER(
                    WHERE COALESCE(ps_sum.qty, 0) > 0
                    AND COALESCE(ps_sum.qty, 0) < COALESCE(p.min_stock, 5)
                ) as low_stock,
                COUNT(DISTINCT p.id) FILTER(
                    WHERE COALESCE(ps_sum.qty, 0) <= 0
                ) as out_of_stock
            FROM {schema}.products p
            LEFT JOIN (
                SELECT product_id, SUM(quantity) as qty
                FROM {schema}.product_stocks
                WHERE warehouse_id = :wid
                GROUP BY product_id
            ) ps_sum ON ps_sum.product_id = p.id
            WHERE p.is_active = true
        """.replace("{schema}", schema))
        result = db.execute(sql, {"wid": warehouse_id}).first()
    else:
        sql = _t("""
            SELECT
                COUNT(DISTINCT p.id) as total,
                COUNT(DISTINCT p.id) FILTER(
                    WHERE COALESCE(ps_sum.qty, 0) > 0
                    AND COALESCE(ps_sum.qty, 0) >= COALESCE(p.min_stock, 5)
                ) as in_stock,
                COUNT(DISTINCT p.id) FILTER(
                    WHERE COALESCE(ps_sum.qty, 0) > 0
                    AND COALESCE(ps_sum.qty, 0) < COALESCE(p.min_stock, 5)
                ) as low_stock,
                COUNT(DISTINCT p.id) FILTER(
                    WHERE COALESCE(ps_sum.qty, 0) <= 0
                ) as out_of_stock
            FROM {schema}.products p
            LEFT JOIN (
                SELECT product_id, SUM(quantity) as qty
                FROM {schema}.product_stocks
                GROUP BY product_id
            ) ps_sum ON ps_sum.product_id = p.id
            WHERE p.is_active = true
        """.replace("{schema}", schema))
        result = db.execute(sql).first()

    return {
        "total":        int(result.total or 0),
        "in_stock":     int(result.in_stock or 0),
        "low_stock":    int(result.low_stock or 0),
        "out_of_stock": int(result.out_of_stock or 0),
    }

@router.get("/", response_model=schemas.PaginatedProductList)
@router.get("", response_model=schemas.PaginatedProductList, include_in_schema=False)
def read_products(
    skip: int = 0,
    limit: int = Query(default=50, le=2000),
    search: Optional[str] = None,
    warehouse_id: Optional[int] = None,
    category_id: Optional[int] = None,
    stock_filter: Optional[str] = None,  # in_stock | low_stock | out_of_stock
    is_menu_item: Optional[bool] = None,
    has_imei: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    try:
        base_query = db.query(models.Product).filter(models.Product.is_active == True)

        # FILTER: Warehouse
        if warehouse_id:
            has_stock_subq = (
                db.query(models.ProductStock.product_id)
                .filter(models.ProductStock.warehouse_id == warehouse_id,
                        models.ProductStock.quantity > 0)
                .subquery()
            )
            base_query = base_query.filter(models.Product.id.in_(has_stock_subq))

        if category_id:
            base_query = base_query.filter(models.Product.category_id == category_id)

        if is_menu_item is not None:
            base_query = base_query.filter(models.Product.is_menu_item == is_menu_item)

        if has_imei is not None:
            base_query = base_query.filter(models.Product.has_imei == has_imei)

        if search:
            tokens = [t for t in search.strip().split() if t]
            if len(tokens) == 1:
                base_query = base_query.filter(
                    or_(models.Product.name.ilike(f"%{tokens[0]}%"),
                        models.Product.sku.ilike(f"%{tokens[0]}%"))
                )
            else:
                for t in tokens:
                    base_query = base_query.filter(
                        or_(models.Product.name.ilike(f"%{t}%"),
                            models.Product.sku.ilike(f"%{t}%"))
                    )

        if stock_filter:
            min_stock_default = 5
            if stock_filter == 'out_of_stock':
                base_query = base_query.filter(models.Product.stock <= 0)
            elif stock_filter == 'low_stock':
                base_query = base_query.filter(
                    models.Product.stock > 0,
                    models.Product.stock < func.coalesce(models.Product.min_stock, min_stock_default)
                )
            elif stock_filter == 'in_stock':
                base_query = base_query.filter(
                    models.Product.stock >= func.coalesce(models.Product.min_stock, min_stock_default)
                )

        # Contar total con filtros aplicados
        total = base_query.with_entities(func.count(models.Product.id)).scalar()

        query = base_query.options(
            joinedload(models.Product.category),
            joinedload(models.Product.units),
            joinedload(models.Product.stocks),
            joinedload(models.Product.prices).joinedload(models.ProductPrice.price_list),
            joinedload(models.Product.combo_items).joinedload(models.ComboItem.child_product),
            joinedload(models.Product.price_rules),
            joinedload(models.Product.recipes).subqueryload(rest_models.RestaurantRecipe.ingredient).subqueryload(models.Product.stocks)
        ).order_by(func.lower(models.Product.name))

        products = query.offset(skip).limit(limit).all()

        # Calculate effective stock for combos/recipes
        for p in products:
            if p.recipes:
                min_available = float('inf')
                for rec in p.recipes:
                    ing = rec.ingredient
                    if not ing: continue
                    if warehouse_id:
                        ing_stock = next((float(s.quantity) for s in ing.stocks if s.warehouse_id == warehouse_id), 0.0)
                    else:
                        ing_stock = sum(float(s.quantity) for s in ing.stocks)
                    qty_needed = float(rec.quantity) if rec.quantity else 1.0
                    available = ing_stock / qty_needed
                    if available < min_available: min_available = available
                p.stock = Decimal(str(int(min_available))) if min_available != float('inf') else Decimal('0')
            elif p.is_combo and p.combo_items:
                min_available = float('inf')
                for ci in p.combo_items:
                    child = ci.child_product
                    if not child: continue
                    if warehouse_id:
                        child_stock = next((float(s.quantity) for s in child.stocks if s.warehouse_id == warehouse_id), 0.0)
                    else:
                        child_stock = sum(float(s.quantity) for s in child.stocks)
                    qty_needed = float(ci.quantity) if ci.quantity else 1.0
                    available = child_stock / qty_needed
                    if available < min_available: min_available = available
                p.stock = Decimal(str(int(min_available))) if min_available != float('inf') else Decimal('0')
            else:
                if warehouse_id:
                    warehouse_stock = sum(float(s.quantity) for s in p.stocks if s.warehouse_id == warehouse_id)
                    p.stock = Decimal(str(warehouse_stock))
                else:
                    p.stock = Decimal(str(sum(float(s.quantity) for s in p.stocks)))
                if warehouse_id:
                    p.stocks = [s for s in p.stocks if s.warehouse_id == warehouse_id]

        return {
            "items": products,
            "total": total,
            "has_more": (skip + limit) < total,
        }
    except Exception as e:
        print(f"[ERROR] ERROR loading products: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error loading products: {str(e)}")

@router.post("/", response_model=schemas.ProductRead, dependencies=[Depends(has_role([UserRole.ADMIN, UserRole.WAREHOUSE]))])
@router.post("", response_model=schemas.ProductRead, dependencies=[Depends(has_role([UserRole.ADMIN, UserRole.WAREHOUSE]))], include_in_schema=False)
async def create_product(product: schemas.ProductCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_user)):
    # 1. Operaciones DB (Síncronas en Threadpool)
    # 1. Operaciones DB (Transaction Wrapper)
    try:
        # A. Create Base Product
        product_data = product.dict(exclude={"units", "combo_items", "warehouse_stocks", "prices"})
        db_product = models.Product(**product_data)
        db.add(db_product)
        db.flush() # Generate ID

        # Prepare lists to capture ORM objects for response construction
        new_units = []
        new_combo_items = []
        new_stocks = []
        new_prices = []

        # B. Process Units
        if product.units:
            for unit in product.units:
                db_unit = models.ProductUnit(**unit.dict(), product_id=db_product.id)
                db.add(db_unit)
                new_units.append(db_unit)
        
        # C. Process Combo Items
        if product.combo_items:
            for combo_item in product.combo_items:
                db_combo_item = models.ComboItem(
                    parent_product_id=db_product.id,
                    child_product_id=combo_item.child_product_id,
                    quantity=combo_item.quantity,
                    unit_id=combo_item.unit_id
                )
                db.add(db_combo_item)
                new_combo_items.append(db_combo_item)
            
        # D. Process Warehouse Stocks
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
                new_stocks.append(db_stock)
                total_stock += stock.quantity
            
            # Sync total stock
            db_product.stock = total_stock
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
                    new_stocks.append(db_stock)
    
        # E. Process Price Lists
        if product.prices:
             for p_price in product.prices:
                 # Handle Pydantic model vs dict
                 p_list_id = p_price.price_list_id if hasattr(p_price, 'price_list_id') else p_price['price_list_id']
                 p_val = p_price.price if hasattr(p_price, 'price') else p_price['price']
                 
                 db_price = models.ProductPrice(
                     product_id=db_product.id,
                     price_list_id=p_list_id,
                     price=p_val
                 )
                 db.add(db_price)
                 new_prices.append(db_price)

        # FLUSH to generate IDs for all children
        db.flush()

        # Capture Data for Response (MANUAL CONSTRUCTION)
        # This bypasses the need to re-fetch/refresh the object, avoiding "Instance deleted" or "NoneType" errors.
        response_data = {
            "id": db_product.id,
            "name": db_product.name,
            "sku": db_product.sku,
            "description": db_product.description,
            "category_id": db_product.category_id,
            "supplier_id": db_product.supplier_id,
            "price": float(db_product.price),
            "cost_price": float(getattr(db_product, "cost_price", None) or getattr(db_product, "cost", None) or 0),
            "stock": float(db_product.stock),
            "is_active": db_product.is_active,
            "image_url": db_product.image_url,
            "is_combo": db_product.is_combo,
            "barcode": db_product.sku,
            "exchange_rate_id": db_product.exchange_rate_id,
            "tax_rate": float(db_product.tax_rate) if db_product.tax_rate else 0.0,
            
            # Lists from captured objects (now with IDs thanks to flush)
            "units": [
                {
                    "id": u.id,
                    "unit_name": u.unit_name,
                    "conversion_factor": float(u.conversion_factor),
                    "barcode": u.barcode,
                    "price_usd": float(u.price_usd) if u.price_usd else None,
                    "product_id": u.product_id,
                    "is_default": u.is_default
                } for u in new_units
            ],
            "combo_items": [
                {
                    "id": c.id,
                    "child_product_id": c.child_product_id,
                    "quantity": float(c.quantity),
                    "parent_product_id": c.parent_product_id,
                    "unit_id": c.unit_id
                } for c in new_combo_items
            ],
            "stocks": [
                {
                   "id": s.id,
                   "warehouse_id": s.warehouse_id,
                   "quantity": float(s.quantity),
                   "location": s.location,
                   "product_id": s.product_id
                } for s in new_stocks
            ],
            "prices": [
                {
                    "id": p.id,
                    "price_list_id": p.price_list_id,
                    "price": float(p.price),
                    "product_id": p.product_id
                } for p in new_prices
            ],
            "price_rules": []
        }

        # FINAL COMMIT
        db.commit()

        # Audit log
        log_action(db, user_id=current_user.id, action="CREATE", table_name="products", record_id=db_product.id, changes=None, ip_address=None)

        # 2. WebSocket en Background (Moved inside success path)
        payload = {
            "id": response_data["id"],
            "name": response_data["name"],
            "price": response_data["price"],
            "stock": response_data["stock"],
            "is_combo": response_data["is_combo"],
            "exchange_rate_id": response_data["exchange_rate_id"],
            "warranty_policy_id": int(db_product.warranty_policy_id) if db_product.warranty_policy_id else None,
            "units": response_data["units"],
            "combo_items": response_data["combo_items"]
        }
        background_tasks.add_task(run_broadcast, WebSocketEvents.PRODUCT_CREATED, payload)

        # Invalidar caché del catálogo para que el POS vea el producto/precios nuevos
        try:
            invalidate_resource(get_tenant_schema(), "catalog")
        except Exception:
            pass

        return response_data

    except Exception as e:
        db.rollback()
        error_msg = str(e).lower()
        if "unique" in error_msg or "duplicate" in error_msg:
             raise HTTPException(status_code=400, detail=f"Error: SKU or Name already exists.")
        print(f"[ERROR] Product Creation Failed: {e}")
        raise HTTPException(status_code=400, detail=f"Database error: {str(e)}")

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
    background_tasks.add_task(manager.broadcast, WebSocketEvents.PRODUCT_CREATED, payload)
        
    return db_product

@router.put("/{product_id}", response_model=schemas.ProductRead, dependencies=[Depends(has_role([UserRole.ADMIN, UserRole.WAREHOUSE]))])
async def update_product(product_id: int, product_update: schemas.ProductUpdate, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_user)):
    # 1. Eager Load Initial State (Robustness)
    db_product = db.query(models.Product).options(
        joinedload(models.Product.units), 
        joinedload(models.Product.stocks), 
        joinedload(models.Product.prices).joinedload(models.ProductPrice.price_list),
        joinedload(models.Product.combo_items).joinedload(models.ComboItem.child_product), 
        joinedload(models.Product.price_rules)
    ).filter(models.Product.id == product_id).first()
    
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    update_data = product_update.dict(exclude_unset=True)
    
    # Separate list data if present
    units_data = None
    if "units" in update_data:
        units_data = update_data.pop("units")
    
    combo_items_data = None
    if "combo_items" in update_data:
        combo_items_data = update_data.pop("combo_items")

    stocks_data = None
    if "warehouse_stocks" in update_data:
        stocks_data = update_data.pop("warehouse_stocks")

    prices_data = None
    if "prices" in update_data:
        prices_data = update_data.pop("prices")

    # Capture Current State (Old) for Audit
    old_state = {c.name: getattr(db_product, c.name) for c in db_product.__table__.columns}

    # Apply Scalar Updates — sanitizar campos con límites numéricos estrictos
    for key, value in update_data.items():
        if key == "profit_margin" and value is not None:
            try:
                value = min(float(value), 999.99)
            except (TypeError, ValueError):
                value = None
        if key == "discount_percentage" and value is not None:
            try:
                value = min(float(value), 999.99)
            except (TypeError, ValueError):
                value = 0
        setattr(db_product, key, value)
    
    # --- HANDLING RELATIONSHIP UPDATES ---
    # Strategy: 
    # 1. If data provided (NOT None) -> Delete Old, Add New, Use New List
    # 2. If data NOT provided (None) -> Keep Old (Use db_product.X logic, but be careful with Session)
    #    Since we are in the same active request, db_product.X should remain valid unless we deleted it.

    # Pre-fetch existing lists if we are NOT updating them, 
    # because if we flush/commit later, lazy loading might fail or be weird depending on session state.
    # Since we eager loaded, these are in memory.
    
    final_units = db_product.units
    final_combo = db_product.combo_items
    final_stocks = db_product.stocks
    final_prices = db_product.prices
    
    # Handle Units Update (SAFE: upsert to avoid FK violation with sale_details)
    if units_data is not None:
        incoming_ids = {u["id"] for u in units_data if "id" in u and u["id"]}
        # Delete only units that are NOT referenced by any sale_detail and NOT in the incoming list
        existing_units = db.query(models.ProductUnit).filter(models.ProductUnit.product_id == product_id).all()
        referenced_ids = {
            row[0] for row in db.execute(
                __import__("sqlalchemy").text(
                    "SELECT DISTINCT unit_id FROM sale_details WHERE unit_id IS NOT NULL"
                )
            ).fetchall()
        }
        for eu in existing_units:
            if eu.id not in incoming_ids and eu.id not in referenced_ids:
                db.delete(eu)
        db.flush()
        # Upsert: update existing, insert new
        # IDs reales del backend son pequeños (<= 10_000_000)
        # IDs temporales del frontend son timestamps (> 10_000_000) o strings "_tempId"
        new_units = []
        for unit in units_data:
            uid = unit.get("id")
            # Ignorar _tempId del frontend — siempre crear nuevo
            temp_id = unit.get("_tempId")
            is_real_id = uid and isinstance(uid, int) and uid <= 10_000_000
            if is_real_id:
                db_unit = db.query(models.ProductUnit).filter(
                    models.ProductUnit.id == uid,
                    models.ProductUnit.product_id == product_id
                ).first()
                if db_unit:
                    for k, v in unit.items():
                        if k not in ("id", "_tempId"):
                            setattr(db_unit, k, v)
                    new_units.append(db_unit)
                    continue
            # ID temporal o sin ID — crear nuevo
            clean = {k: v for k, v in unit.items() if k not in ("id", "_tempId")}
            db_unit = models.ProductUnit(**clean, product_id=product_id)
            db.add(db_unit)
            new_units.append(db_unit)
        final_units = new_units # Use the new list for response
    
    # Handle Combo Items Update
    if combo_items_data is not None:
        db.query(models.ComboItem).filter(models.ComboItem.parent_product_id == product_id).delete()
        new_combo = []
        for combo_item in combo_items_data:
            db_combo_item = models.ComboItem(
                parent_product_id=product_id,
                child_product_id=combo_item["child_product_id"],
                quantity=combo_item["quantity"],
                unit_id=combo_item.get("unit_id")
            )
            db.add(db_combo_item)
            new_combo.append(db_combo_item)
        final_combo = new_combo
            
    # Handle Stocks Update
    if stocks_data is not None:
        db.query(models.ProductStock).filter(models.ProductStock.product_id == product_id).delete()
        new_stocks = []
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
            new_stocks.append(db_stock)
            total_stock += qty
        
        db_product.stock = total_stock
        final_stocks = new_stocks

    # Handle Prices Update
    if prices_data is not None:
        try:
            db.query(models.ProductPrice).filter(models.ProductPrice.product_id == product_id).delete()
            new_prices = []
            for p_price in prices_data:
                p_list_id = p_price["price_list_id"] if isinstance(p_price, dict) else p_price.price_list_id
                p_val = p_price["price"] if isinstance(p_price, dict) else p_price.price
                
                db_price = models.ProductPrice(
                    product_id=product_id,
                    price_list_id=p_list_id,
                    price=p_val
                )
                db.add(db_price)
                new_prices.append(db_price)
            final_prices = new_prices
        except Exception as e:
            print(f"[ERROR] Failed to update prices: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to update prices: {str(e)}")

    # FLUSH to ensure new items have IDs and updates are applied in transaction
    db.flush()

    # MANUAL RESPONSE CONSTRUCTION
    # Use 'final_X' lists which contain either ORM objects from initial load or newly added ORM objects.
    # Note: If we didn't update a list, 'final_X' refers to 'db_product.X'. Since we didn't delete them, strict usage is safe.
    
    response_data = {
        "id": db_product.id,
        "name": db_product.name,
        "sku": db_product.sku,
        "description": db_product.description,
        "category_id": db_product.category_id,
        "supplier_id": db_product.supplier_id,
        "price": float(db_product.price),
        "cost_price": float(getattr(db_product, "cost_price", None) or getattr(db_product, "cost", None) or 0),
        "stock": float(db_product.stock),
        "is_active": db_product.is_active,
        "image_url": db_product.image_url,
        "is_combo": db_product.is_combo,
        "barcode": db_product.sku,
        "exchange_rate_id": db_product.exchange_rate_id,
        "tax_rate": float(db_product.tax_rate) if db_product.tax_rate else 0.0,
        "warranty_policy_id": int(db_product.warranty_policy_id) if db_product.warranty_policy_id else None,
        
        # Manually serialize lists
        "units": [
            {
                "id": u.id,
                "unit_name": u.unit_name,
                "conversion_factor": float(u.conversion_factor),
                "barcode": u.barcode,
                "price_usd": float(u.price_usd) if u.price_usd else None,
                "product_id": u.product_id,
                "is_default": u.is_default,
                # Include exchange_rate if needed/present, but ProductUnitRead usually doesn't strictly require full object
                # Update: ProductUnitRead has exchange_rate: Optional[ExchangeRateRead] = None
                # If u is new, u.exchange_rate might be None unless we fetched it. Defaults to None is safe.
            } for u in final_units
        ],
        "combo_items": [
            {
                "id": c.id,
                "child_product_id": c.child_product_id,
                "quantity": float(c.quantity),
                "parent_product_id": c.parent_product_id,
                "unit_id": c.unit_id
            } for c in final_combo
        ],
        "stocks": [
            {
               "id": s.id,
               "warehouse_id": s.warehouse_id,
               "quantity": float(s.quantity),
               "location": s.location,
               "product_id": s.product_id
            } for s in final_stocks
        ],
        "prices": [
            {
                "id": p.id,
                "price_list_id": p.price_list_id,
                "price": float(p.price),
                "product_id": p.product_id
            } for p in final_prices
        ],
        "price_rules": [] # Not handling updates to rules here? Assuming standard
    }

    # Logic Refactor: Audit (Using the fresh object state in memory)
    # We can rely on db_product because we just flushed updates to it.
    new_state = {c.name: getattr(db_product, c.name) for c in db_product.__table__.columns}

    changes = {}
    for k, v in new_state.items():
        if k in old_state and old_state[k] != v:
            changes[k] = {"old": old_state[k], "new": v}

    if changes:
        log_action(db, user_id=current_user.id, action="UPDATE", table_name="products", record_id=db_product.id, changes=json.dumps(changes, default=str))

    # FINAL COMMIT
    db.commit()

    # Broadcast
    payload = {
        "id": response_data["id"],
        "name": response_data["name"],
        "price": response_data["price"],
        "stock": response_data["stock"],
        "is_combo": response_data["is_combo"],
        "exchange_rate_id": response_data["exchange_rate_id"],
        "units": response_data["units"],
        "combo_items": response_data["combo_items"]
    }
    background_tasks.add_task(manager.broadcast, WebSocketEvents.PRODUCT_UPDATED, payload)

    # Invalidar caché del catálogo para que el POS vea cambios de precio/lista al instante
    try:
        invalidate_resource(get_tenant_schema(), "catalog")
    except Exception:
        pass

    return response_data

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
def export_excel(
    search: Optional[str] = None,
    category_id: Optional[int] = None,
    stock_filter: Optional[str] = None,
    warehouse_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Export products to Excel — respeta los filtros activos del inventario"""
    query = db.query(models.Product).filter(models.Product.is_active == True)
    if search:
        tokens = [t for t in search.strip().split() if t]
        for t in tokens:
            query = query.filter(or_(
                models.Product.name.ilike(f"%{t}%"),
                models.Product.sku.ilike(f"%{t}%")
            ))
    if category_id:
        query = query.filter(models.Product.category_id == category_id)
    if stock_filter == 'out_of_stock':
        query = query.filter(models.Product.stock <= 0)
    elif stock_filter == 'low_stock':
        query = query.filter(models.Product.stock > 0,
            models.Product.stock < func.coalesce(models.Product.min_stock, 5))
    elif stock_filter == 'in_stock':
        query = query.filter(
            models.Product.stock >= func.coalesce(models.Product.min_stock, 5))
    products = query.options(
        joinedload(models.Product.category),
        joinedload(models.Product.supplier)
    ).order_by(func.lower(models.Product.name)).all()
    
    buffer = ProductExportService.export_to_excel(products)
    
    filename = f"inventario_{date.today().strftime('%Y-%m-%d')}.xlsx"
    
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.get("/export/pdf")
def export_pdf(
    search: Optional[str] = None,
    category_id: Optional[int] = None,
    stock_filter: Optional[str] = None,
    warehouse_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Export products to PDF — respeta los filtros activos del inventario"""
    business_name = "Inventario"
    query = db.query(models.Product).filter(models.Product.is_active == True)
    if search:
        tokens = [t for t in search.strip().split() if t]
        for t in tokens:
            query = query.filter(or_(
                models.Product.name.ilike(f"%{t}%"),
                models.Product.sku.ilike(f"%{t}%")
            ))
    if category_id:
        query = query.filter(models.Product.category_id == category_id)
    if stock_filter == 'out_of_stock':
        query = query.filter(models.Product.stock <= 0)
    elif stock_filter == 'low_stock':
        query = query.filter(models.Product.stock > 0,
            models.Product.stock < func.coalesce(models.Product.min_stock, 5))
    elif stock_filter == 'in_stock':
        query = query.filter(
            models.Product.stock >= func.coalesce(models.Product.min_stock, 5))
    products = query.options(
        joinedload(models.Product.category),
        joinedload(models.Product.supplier)
    ).order_by(func.lower(models.Product.name)).all()

    # Cargar listas de precios activas del tenant + precios por producto
    price_lists = db.query(models.PriceList).filter(
        models.PriceList.is_active == True
    ).order_by(models.PriceList.id).all()

    prices_by_product = {}
    if price_lists:
        product_ids = [p.id for p in products]
        list_ids = [pl.id for pl in price_lists]
        if product_ids and list_ids:
            pp_rows = db.query(models.ProductPrice).filter(
                models.ProductPrice.product_id.in_(product_ids),
                models.ProductPrice.price_list_id.in_(list_ids)
            ).all()
            for pp in pp_rows:
                prices_by_product.setdefault(pp.product_id, {})[pp.price_list_id] = float(pp.price or 0)

    buffer = ProductExportService.export_to_pdf(
        products, business_name,
        price_lists=price_lists,
        prices_by_product=prices_by_product
    )
    
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
def get_credit_sales(
    skip: int = 0,
    limit: int = Query(default=100, le=5000),
    q: Optional[str] = None,
    status: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Get credit sales (invoices) for Accounts Receivable.
    Used by the CxC module.
    Returns both Pending and Paid to allow history filtering on frontend.
    Includes cashier_name, register_name, register_code from the cash session.
    Supports server-side search by customer name/id_number (q param)
    and status filter (pending, overdue, paid).
    """
    from datetime import date as date_type
    from ..utils.time_utils import get_venezuela_now as _get_vzla_now
    base_query = db.query(models.Sale).filter(
        models.Sale.is_credit == True
    )

    # Server-side search by customer name or id_number
    if q and q.strip():
        search_term = f"%{q.strip()}%"
        base_query = base_query.join(models.Sale.customer).filter(
            or_(
                models.Customer.name.ilike(search_term),
                models.Customer.id_number.ilike(search_term),
            )
        )

    # Server-side status filter
    if status == "pending":
        base_query = base_query.filter(models.Sale.paid == False)
    elif status == "overdue":
        base_query = base_query.filter(
            models.Sale.paid == False,
            models.Sale.due_date < _get_vzla_now().date()
        )
    elif status == "paid":
        base_query = base_query.filter(models.Sale.paid == True)

    # Date range filter
    if start_date:
        try:
            sd = date_type.fromisoformat(start_date)
            base_query = base_query.filter(models.Sale.date >= sd)
        except ValueError:
            pass
    if end_date:
        try:
            from datetime import datetime as dt_cls, timedelta
            ed = date_type.fromisoformat(end_date)
            # Include the entire end date (up to 23:59:59)
            base_query = base_query.filter(models.Sale.date <= ed + timedelta(days=1))
        except ValueError:
            pass

    total = base_query.count()

    sales = base_query.options(
        joinedload(models.Sale.customer),
        joinedload(models.Sale.payments),
        joinedload(models.Sale.cash_session).joinedload(models.CashSession.user),
        joinedload(models.Sale.cash_session).joinedload(models.CashSession.register),
    ).order_by(models.Sale.due_date.asc()).offset(skip).limit(limit).all()

    result = []
    for sale in sales:
        sale_dict = schemas.SaleRead.from_orm(sale).dict()
        sale_dict["cashier_name"] = None
        sale_dict["register_name"] = None
        sale_dict["register_code"] = None
        if sale.cash_session:
            if sale.cash_session.user:
                sale_dict["cashier_name"] = (
                    sale.cash_session.user.full_name or sale.cash_session.user.username
                )
            if sale.cash_session.register:
                sale_dict["register_name"] = sale.cash_session.register.name
                sale_dict["register_code"] = sale.cash_session.register.code
        result.append(sale_dict)
    return {"items": result, "total": total, "has_more": skip + limit < total}

@router.get("/sales/", dependencies=[Depends(cashier_or_admin)])
def get_all_sales(
    limit: int = Query(default=50, le=500),
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
    product = db.query(models.Product).options(
        joinedload(models.Product.units), 
        joinedload(models.Product.stocks),
        joinedload(models.Product.prices).joinedload(models.ProductPrice.price_list),
        joinedload(models.Product.combo_items).joinedload(models.ComboItem.child_product),
        joinedload(models.Product.price_rules)
    ).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product

@router.delete("/{product_id}", dependencies=[Depends(has_role([UserRole.ADMIN]))])
def delete_product(product_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_user)):
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Capture data for broadcast BEFORE deletion (and commit)
    product_id_val = product.id
    product_name_val = product.name

    # Soft delete (set inactive)
    product.is_active = False
    db.commit()

    # Audit log
    log_action(db, user_id=current_user.id, action="DELETE", table_name="products", record_id=product_id_val, changes=None, ip_address=None)

    # Broadcast product deleted/deactivated
    payload = {
        "id": product_id_val,
        "name": product_name_val
    }
    background_tasks.add_task(run_broadcast, WebSocketEvents.PRODUCT_DELETED, payload)

    return {"status": "success", "message": "Product deactivated"}

@router.delete("/{product_id}/image", dependencies=[Depends(has_role([UserRole.ADMIN, UserRole.WAREHOUSE]))])
def delete_product_image(product_id: int, db: Session = Depends(get_db)):
    """
    Remove the product image URL from the database.
    Does not delete the physical file (garbage collection handled elsewhere if needed).
    """
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    product.image_url = None
    product.image_url_original = None
    db.commit()
    return {"success": True, "message": "Imagen eliminada correctamente"}


@router.post("/{product_id}/remove-background-on-existing",
             dependencies=[Depends(has_role([UserRole.ADMIN, UserRole.WAREHOUSE]))])
def remove_bg_on_existing(product_id: int, db: Session = Depends(get_db)):
    """
    Procesa la imagen ACTUAL de un producto: elimina el fondo con rembg
    y guarda el resultado como NUEVA imagen. La imagen original se preserva
    en `image_url_original` para permitir restaurarla.

    Si la imagen actual ya viene del proceso de eliminar fondo (existe
    image_url_original), no la pisa — devuelve 409 para evitar perder
    el original.
    """
    import os as _os
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    if not product.image_url:
        raise HTTPException(status_code=400, detail="El producto no tiene imagen")

    if product.image_url_original:
        raise HTTPException(
            status_code=409,
            detail=("Esta imagen ya tiene su fondo eliminado. "
                    "Restaura primero el original si quieres re-procesar.")
        )

    # Leer archivo físico desde /app/media — la URL es /media/products/<uuid>.webp
    from ..utils.media_utils import BASE_MEDIA_DIR, save_bytes_as_image
    rel = product.image_url.lstrip("/")
    if rel.startswith("media/"):
        rel = rel[len("media/"):]
    file_path = _os.path.join(BASE_MEDIA_DIR, rel)
    if not _os.path.exists(file_path):
        raise HTTPException(
            status_code=404,
            detail=f"El archivo de imagen no se encontró en disco ({file_path})"
        )

    with open(file_path, "rb") as f:
        original_bytes = f.read()

    # Procesar con rembg
    processed = remove_background(original_bytes)

    # Guardar nueva imagen (PNG con alpha -> WebP con alpha)
    new_url = save_bytes_as_image(processed, folder="products", extension="png")

    # Actualizar producto: la URL anterior pasa a ser image_url_original
    old_url = product.image_url
    product.image_url_original = old_url
    product.image_url = new_url
    db.commit()
    db.refresh(product)

    return {
        "success": True,
        "image_url": new_url,
        "image_url_original": old_url,
        "message": "Fondo eliminado correctamente"
    }


@router.post("/{product_id}/restore-background",
             dependencies=[Depends(has_role([UserRole.ADMIN, UserRole.WAREHOUSE]))])
def restore_bg_on_existing(product_id: int, db: Session = Depends(get_db)):
    """
    Restaura la imagen ORIGINAL del producto (deshace remove-background).
    No borra el archivo procesado del disco; si el usuario vuelve a
    pedir remove-background, se regenera.
    """
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    if not product.image_url_original:
        raise HTTPException(
            status_code=400,
            detail="Este producto no tiene imagen original guardada"
        )

    product.image_url = product.image_url_original
    product.image_url_original = None
    db.commit()
    db.refresh(product)

    return {
        "success": True,
        "image_url": product.image_url,
        "message": "Imagen original restaurada"
    }

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
    db.flush()
    
    response_data = {
        "id": db_rule.id,
        "product_id": db_rule.product_id,
        "min_quantity": db_rule.min_quantity,
        "price": db_rule.price,
        "price_list_id": db_rule.price_list_id
    }
    
    db.commit()
    # db.refresh(db_rule)
    return response_data



@router.delete("/rules/{rule_id}")
def delete_price_rule(rule_id: int, db: Session = Depends(get_db)):
    rule = db.query(models.PriceRule).filter(models.PriceRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    db.delete(rule)
    db.commit()
    return {"status": "success"}

@router.post("/sales/", dependencies=[Depends(cashier_or_admin)])
def create_sale(sale_data: schemas.SaleCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_user)):
    from ..services.sales_service import SalesService
    
    # Delegate to Service (Now Sync)
    return SalesService.create_sale(db, sale_data, user_id=current_user.id, background_tasks=background_tasks)

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
    current_user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Send print command to Hardware Bridge via WebSocket
    Strictly isolated by current_user's tenant_id.
    """
    from ..services.sales_service import SalesService
    from ..tenant_context import get_tenant_schema
    from ..services.websocket_manager import manager
    
    # We use the schema name (e.g. "prueba3") as the universal identifier for this business.
    # The bridge registers securely under this tag.
    tenant_id = get_tenant_schema()
    print(f"📡 [PRINT] Remote request: Client '{request.client_id}' for Tenant Context '{tenant_id}'")
    
    # CHECK: Ensure client is actually connected under THIS tenant
    if tenant_id not in manager.active_connections:
        # Dump exactly what is in memory to see the mismatch
        print(f"❌ [PRINT DEBUG] Active Tenants in Memory: {list(manager.active_connections.keys())}")
        raise HTTPException(
            status_code=503,
            detail=f"Ninguna impresora conectada para la empresa '{tenant_id}'. Verifique el puente."
        )

    # Fuzzy matching for client_id to prevent Case-Sensitivity or Trailing spaces bugs
    target_client_id = request.client_id.strip().lower()
    actual_client_id = None
    
    for connected_client in manager.active_connections[tenant_id].keys():
        if connected_client.strip().lower() == target_client_id:
            actual_client_id = connected_client
            break

    if not actual_client_id:
        print(f"❌ [PRINT DEBUG] Active Clients in '{tenant_id}': {list(manager.active_connections[tenant_id].keys())}")
        print(f"❌ [PRINT] Client '{request.client_id}' NOT connected for Tenant '{tenant_id}'")
        raise HTTPException(
            status_code=503,
            detail=f"Impresora '{request.client_id}' no está conectada. Verifique el puente en su computadora."
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
    
    success = await manager.send_to_client(message, actual_client_id, tenant_id)
    
    if not success:
        raise HTTPException(
            status_code=500,
            detail=f"Error enviando comando de impresión a '{actual_client_id}'"
        )
    
    return {
        "status": "success",
        "message": f"Comando de impresión enviado a {actual_client_id}",
        "sale_id": request.sale_id
    }

class RemotePrintPayloadRequest(BaseModel):
    client_id: str
    payload: dict

@router.post("/print/remote/payload", tags=["Print"])
async def print_remote_payload(
    request: RemotePrintPayloadRequest,
    current_user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Send raw print payload to Hardware Bridge via WebSocket
    Strictly isolated by current_user's tenant_id.
    """
    from ..services.websocket_manager import manager
    from ..tenant_context import get_tenant_schema
    
    tenant_id = get_tenant_schema()
    
    if tenant_id not in manager.active_connections:
        raise HTTPException(
            status_code=503,
            detail=f"Ninguna impresora conectada para la empresa '{tenant_id}'."
        )

    # Fuzzy matching for client_id
    target_client_id = request.client_id.strip().lower()
    actual_client_id = None
    
    for connected_client in manager.active_connections[tenant_id].keys():
        if connected_client.strip().lower() == target_client_id:
            actual_client_id = connected_client
            break

    if not actual_client_id:
        raise HTTPException(
            status_code=503,
            detail=f"Impresora '{request.client_id}' no está conectada."
        )

    # Send to Hardware Bridge via WebSocket
    message = {
        "type": "print",
        "payload": request.payload
    }
    
    success = await manager.send_to_client(message, actual_client_id, tenant_id)
    
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
    
    # Capture data
    response_data = {
        "id": sale.id,
        "balance_pending": sale.balance_pending,
        "paid": sale.paid
    }

    db.commit()
    # db.refresh(sale)
    
    print(f"   After: paid={response_data['paid']}, balance={response_data['balance_pending']}")
    
    return {"status": "success", "sale": response_data}

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


# ─────────────────────────────────────────────────────────────────────────────
# Feature 2: Quantity-Based Discount Rules
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/{product_id}/discount-rules", response_model=List[schemas.DiscountRuleRead])
def get_discount_rules(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return db.query(models.DiscountRule).filter(
        models.DiscountRule.product_id == product_id
    ).order_by(models.DiscountRule.min_quantity).all()


@router.post("/{product_id}/discount-rules", response_model=schemas.DiscountRuleRead, status_code=201)
def create_discount_rule(
    product_id: int,
    data: schemas.DiscountRuleBase,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(has_role([models.UserRole.ADMIN, models.UserRole.WAREHOUSE]))
):
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    rule = models.DiscountRule(
        product_id=product_id,
        min_quantity=data.min_quantity,
        discount_percentage=data.discount_percentage,
        is_active=data.is_active
    )
    db.add(rule)
    db.flush()
    db.commit()
    return rule


@router.put("/{product_id}/discount-rules/{rule_id}", response_model=schemas.DiscountRuleRead)
def update_discount_rule(
    product_id: int,
    rule_id: int,
    data: schemas.DiscountRuleUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(has_role([models.UserRole.ADMIN, models.UserRole.WAREHOUSE]))
):
    rule = db.query(models.DiscountRule).filter(
        models.DiscountRule.id == rule_id,
        models.DiscountRule.product_id == product_id
    ).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Regla no encontrada")
    if data.min_quantity is not None:
        rule.min_quantity = data.min_quantity
    if data.discount_percentage is not None:
        rule.discount_percentage = data.discount_percentage
    if data.is_active is not None:
        rule.is_active = data.is_active
    db.commit()
    return rule


@router.delete("/{product_id}/discount-rules/{rule_id}", status_code=204)
def delete_discount_rule(
    product_id: int,
    rule_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(has_role([models.UserRole.ADMIN, models.UserRole.WAREHOUSE]))
):
    rule = db.query(models.DiscountRule).filter(
        models.DiscountRule.id == rule_id,
        models.DiscountRule.product_id == product_id
    ).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Regla no encontrada")
    db.delete(rule)
    db.commit()
    return None
