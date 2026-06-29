from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, UploadFile, File, Query, Response
from ..cache import get_cached, set_cached, invalidate, invalidate_resource
from ..tenant_context import get_tenant_schema
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload, subqueryload, selectinload, with_loader_criteria
from decimal import Decimal
from typing import List, Optional
import json
import asyncio
from datetime import date, datetime, timedelta
from ..database.db import get_db
from ..models import models
from ..models import restaurant as rest_models # NEW
from .. import schemas
from ..dependencies import cashier_or_admin, get_current_active_user, require_permission, require_any_permission
from ..websocket.manager import manager
from ..websocket.events import WebSocketEvents
from ..audit_utils import log_action
from ..services.product_import_service import ProductImportService
from ..services.product_export_service import ProductExportService
from ..utils.media_utils import save_upload_file, save_bytes_as_image
from ..services.bg_remover import remove_background, is_available as bg_is_available
from fastapi.responses import Response

router = APIRouter(prefix="/products", tags=["products"])


def _normalize_sku(value):
    if value is None:
        return None
    sku = str(value).strip()
    return sku or None


def _ensure_product_sku_available(db: Session, sku, product_id: Optional[int] = None):
    normalized = _normalize_sku(sku)
    if not normalized:
        return
    query = db.query(models.Product).filter(models.Product.sku == normalized)
    if product_id is not None:
        query = query.filter(models.Product.id != product_id)
    existing = query.first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f'Ya existe un producto con el SKU "{normalized}". Usa otro codigo o deja el SKU vacio si no aplica.'
        )


def _as_unit_dict(unit):
    return unit if isinstance(unit, dict) else unit.dict()


def _active_product_units(units):
    return [unit for unit in (units or []) if getattr(unit, "is_active", True) is not False]


def _serialize_promotion_item(item):
    child = getattr(item, "child_product", None)
    return {
        "id": item.id,
        "parent_product_id": item.parent_product_id,
        "child_product_id": item.child_product_id,
        "quantity": float(item.quantity),
        "unit_id": item.unit_id,
        "label": item.label,
        "is_active": bool(getattr(item, "is_active", True)),
        "child_product": {
            "id": child.id,
            "name": child.name,
            "sku": child.sku,
            "price": float(child.price or 0),
            "stock": float(child.stock or 0),
            "has_imei": bool(child.has_imei),
            "is_service": bool(child.is_service),
            "is_active": bool(child.is_active),
        } if child else None,
    }


def _create_promotion_items(db: Session, parent_product_id: int, promotion_items):
    created = []
    for promo in promotion_items or []:
        data = promo if isinstance(promo, dict) else promo.dict()
        child_id = data.get("child_product_id")
        if not child_id or int(child_id) == int(parent_product_id):
            raise HTTPException(status_code=400, detail="El producto promocional incluido no puede ser el mismo producto principal.")
        child = db.query(models.Product).filter(
            models.Product.id == child_id,
            models.Product.is_active == True,
        ).first()
        if not child:
            raise HTTPException(status_code=400, detail=f"Producto incluido #{child_id} no existe o esta inactivo.")
        if child.has_imei:
            raise HTTPException(status_code=400, detail=f"'{child.name}' maneja IMEI/serial y no puede incluirse automaticamente como bonificado.")
        db_item = models.ProductPromotionItem(
            parent_product_id=parent_product_id,
            child_product_id=child_id,
            quantity=data.get("quantity") or 1,
            unit_id=data.get("unit_id"),
            label=data.get("label"),
            is_active=data.get("is_active", True),
        )
        db.add(db_item)
        created.append(db_item)
    return created


def _unit_identity_key(unit):
    unit_data = _as_unit_dict(unit)
    unit_name = str(unit_data.get("unit_name") or "").strip().lower()
    try:
        factor = Decimal(str(unit_data.get("conversion_factor") or 0)).quantize(Decimal("0.000001"))
    except Exception:
        factor = Decimal("0")
    return (unit_name, factor)


def _as_gallery_dict(item):
    return item if isinstance(item, dict) else item.dict()


def _sanitize_color_hex(value):
    color = str(value or '').strip()
    if len(color) == 7 and color.startswith('#'):
        try:
            int(color[1:], 16)
            return color.upper()
        except ValueError:
            return None
    return None


def _normalize_gallery_items_for_write(gallery_items, fallback_image_url=None):
    normalized = []
    for index, raw_item in enumerate(gallery_items or []):
        item = _as_gallery_dict(raw_item)
        image_url = str(item.get('image_url') or '').strip()
        if not image_url:
            continue
        normalized.append({
            'image_url': image_url,
            'color_name': str(item.get('color_name') or '').strip() or None,
            'color_hex': _sanitize_color_hex(item.get('color_hex')),
            'sort_order': index,
            'is_primary': bool(item.get('is_primary')),
        })

    fallback = str(fallback_image_url or '').strip()
    if not normalized and fallback:
        normalized.append({
            'image_url': fallback,
            'color_name': None,
            'color_hex': None,
            'sort_order': 0,
            'is_primary': True,
        })

    if normalized:
        primary_index = next((idx for idx, item in enumerate(normalized) if item.get('is_primary')), 0)
        for idx, item in enumerate(normalized):
            item['sort_order'] = idx
            item['is_primary'] = idx == primary_index

    return normalized


def _sync_product_gallery(db: Session, product_id: int, gallery_items, fallback_image_url=None):
    normalized = _normalize_gallery_items_for_write(gallery_items, fallback_image_url=fallback_image_url)
    db.query(models.ProductImage).filter(models.ProductImage.product_id == product_id).delete()
    new_gallery = []
    for item in normalized:
        db_image = models.ProductImage(product_id=product_id, **item)
        db.add(db_image)
        new_gallery.append(db_image)
    return new_gallery


def _available_imei_stock(db: Session, product_id: int, warehouse_id: Optional[int] = None) -> Decimal:
    query = db.query(func.count(models.ProductInstance.id)).filter(
        models.ProductInstance.product_id == product_id,
        models.ProductInstance.status == models.ProductInstanceStatus.AVAILABLE,
    )
    if warehouse_id:
        query = query.filter(models.ProductInstance.warehouse_id == warehouse_id)
    return Decimal(str(query.scalar() or 0))


def _apply_pos_stock(product, db: Session, warehouse_id: Optional[int] = None):
    if not product:
        return product
    if getattr(product, 'has_imei', False):
        product.stock = _available_imei_stock(db, product.id, warehouse_id)
        if warehouse_id and getattr(product, 'stocks', None) is not None:
            product.stocks = [s for s in product.stocks if s.warehouse_id == warehouse_id]
        return product

    if warehouse_id:
        warehouse_stock = sum(float(s.quantity) for s in (product.stocks or []) if s.warehouse_id == warehouse_id)
        product.stock = Decimal(str(warehouse_stock))
        if getattr(product, 'stocks', None) is not None:
            product.stocks = [s for s in product.stocks if s.warehouse_id == warehouse_id]
    elif getattr(product, 'stocks', None):
        product.stock = Decimal(str(sum(float(s.quantity) for s in product.stocks)))
    return product


def _serialize_gallery_image(image):
    return {
        'id': image.id,
        'product_id': image.product_id,
        'image_url': image.image_url,
        'color_name': image.color_name,
        'color_hex': image.color_hex,
        'sort_order': image.sort_order,
        'is_primary': bool(image.is_primary),
        'created_at': image.created_at,
    }


def _sync_primary_image_fields(db_product, gallery_images):
    primary = None
    if gallery_images:
        primary = next((img for img in gallery_images if getattr(img, 'is_primary', False)), gallery_images[0])

    db_product.image_url = primary.image_url if primary else None
    if primary and not getattr(db_product, 'image_url_original', None):
        db_product.image_url_original = primary.image_url


def _ensure_product_units_not_duplicated(units):
    if not units:
        return

    seen_names = set()
    seen_barcodes = set()
    seen_factors = set()

    for raw_unit in units:
        unit = _as_unit_dict(raw_unit)
        unit_name = str(unit.get("unit_name") or "").strip()
        barcode = str(unit.get("barcode") or "").strip()
        try:
            factor = Decimal(str(unit.get("conversion_factor") or 0))
        except Exception:
            factor = Decimal("0")

        if not unit_name:
            raise HTTPException(status_code=400, detail="Cada presentacion debe tener un nombre claro.")
        if factor <= 0:
            raise HTTPException(status_code=400, detail=f'La presentacion "{unit_name}" tiene una conversion invalida.')

        name_key = unit_name.lower()
        barcode_key = barcode.lower()
        factor_key = factor.quantize(Decimal("0.000001"))

        if name_key in seen_names:
            raise HTTPException(status_code=400, detail=f'Ya existe una presentacion llamada "{unit_name}".')
        if barcode_key and barcode_key in seen_barcodes:
            raise HTTPException(status_code=400, detail=f'El codigo de barras "{barcode}" esta repetido en presentaciones.')
        if factor_key in seen_factors:
            raise HTTPException(status_code=400, detail=f'Ya existe una presentacion con la misma conversion que "{unit_name}".')

        seen_names.add(name_key)
        if barcode_key:
            seen_barcodes.add(barcode_key)
        seen_factors.add(factor_key)


@router.post("/upload-image", dependencies=[Depends(require_permission("inventory.products.edit"))])
async def upload_product_image(
    file: UploadFile = File(...),
    current_user: models.User = Depends(require_permission("inventory.products.edit"))
):
    """
    Securely upload a product image.
    Isolation: /media/{tenant_id}/products/{uuid}.webp
    Soporta imágenes con canal alpha (resultado de eliminar fondo).
    """
    image_url = save_upload_file(file, folder="products")
    return {"success": True, "image_url": image_url}


@router.post("/remove-background", dependencies=[Depends(require_permission("inventory.products.edit"))])
async def remove_image_background(
    file: UploadFile = File(...),
    current_user: models.User = Depends(require_permission("inventory.products.edit"))
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
def run_broadcast(event: str, data: dict, tenant_id: Optional[str] = None):
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(manager.broadcast(event, data, tenant_id=tenant_id))
    finally:
        loop.close()

from typing import Optional
from sqlalchemy import or_, and_, func, text
from pydantic import BaseModel

@router.get("/catalog", response_model=schemas.PaginatedCatalog, dependencies=[Depends(get_current_active_user)])
@router.get("/catalog/", response_model=schemas.PaginatedCatalog, include_in_schema=False, dependencies=[Depends(get_current_active_user)])
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

    products = base_query.options(
        selectinload(models.Product.units),
        with_loader_criteria(models.ProductUnit, models.ProductUnit.is_active == True, include_aliases=True),
        selectinload(models.Product.stocks),
        selectinload(models.Product.prices).joinedload(models.ProductPrice.price_list),
    ).order_by(models.Product.name).offset(skip).limit(limit).all()

    def serialize_catalog_product(product):
        if warehouse_id:
            stock = sum(float(s.quantity) for s in product.stocks if s.warehouse_id == warehouse_id)
        else:
            stock = sum(float(s.quantity) for s in product.stocks)

        return {
            "id": product.id,
            "name": product.name,
            "sku": product.sku,
            "price": product.price,
            "price_mayor_1": product.price_mayor_1,
            "price_mayor_2": product.price_mayor_2,
            "stock": Decimal(str(stock)),
            "description": product.description,
            "cost_price": product.cost_price,
            "profit_margin": product.profit_margin,
            "discount_percentage": product.discount_percentage,
            "is_discount_active": bool(product.is_discount_active),
            "tax_rate": product.tax_rate,
            "min_stock": product.min_stock,
            "unit_type": product.unit_type,
            "is_box": bool(product.is_box),
            "conversion_factor": product.conversion_factor,
            "category_id": product.category_id,
            "supplier_id": product.supplier_id,
            "location": product.location,
            "exchange_rate_id": product.exchange_rate_id,
            "is_combo": bool(product.is_combo),
            "has_imei": bool(product.has_imei),
            "is_service": bool(product.is_service),
            "is_commissionable": bool(product.is_commissionable),
            "is_barbershop_service": bool(product.is_barbershop_service),
            "is_menu_item": bool(product.is_menu_item),
            "needs_kitchen": product.needs_kitchen if product.needs_kitchen is not None else True,
            "is_active": bool(product.is_active),
            "image_url": product.image_url,
            "image_url_original": product.image_url_original,
            "updated_at": product.updated_at,
            "warranty_duration": product.warranty_duration,
            "warranty_unit": product.warranty_unit,
            "warranty_notes": product.warranty_notes,
            "warranty_policy_id": product.warranty_policy_id,
            "units": [
                {
                    "id": u.id,
                    "product_id": u.product_id,
                    "unit_name": u.unit_name,
                    "conversion_factor": u.conversion_factor,
                    "barcode": u.barcode,
                    "cost_price": u.cost_price,
                    "price_usd": u.price_usd,
                    "profit_margin": u.profit_margin,
                    "discount_percentage": u.discount_percentage,
                    "is_discount_active": bool(u.is_discount_active),
                    "is_default": bool(u.is_default),
                    "is_active": bool(getattr(u, "is_active", True)),
                    "exchange_rate_id": u.exchange_rate_id,
                }
                for u in _active_product_units(product.units)
            ],
            "prices": [
                {
                    "id": pp.id,
                    "product_id": pp.product_id,
                    "price_list_id": pp.price_list_id,
                    "price": pp.price,
                    "price_list": {
                        "id": pp.price_list.id,
                        "name": pp.price_list.name,
                        "requires_auth": pp.price_list.requires_auth,
                        "is_active": pp.price_list.is_active,
                        "created_at": pp.price_list.created_at,
                    } if pp.price_list else None,
                }
                for pp in product.prices
            ],
        }

    catalog_result = {
        "items": [serialize_catalog_product(p) for p in products],
        "total": total,
        "has_more": (skip + limit) < total,
    }

    # Guardar en Redis si es la primera página sin filtros (60s TTL)
    if not any([search, category_id, warehouse_id, min_price, max_price, is_menu_item]) and skip == 0:
        try:
            from ..tenant_context import get_tenant_schema as _gts
            set_cached(_gts(), f"catalog:{limit}", catalog_result, ttl=60)
        except Exception:
            pass

    return catalog_result

@router.get("/lookup", response_model=schemas.ProductRead, dependencies=[Depends(get_current_active_user)])
@router.get("/lookup/", response_model=schemas.ProductRead, include_in_schema=False, dependencies=[Depends(get_current_active_user)])
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
        with_loader_criteria(models.ProductUnit, models.ProductUnit.is_active == True, include_aliases=True),
        joinedload(models.Product.stocks),
        joinedload(models.Product.prices).joinedload(models.ProductPrice.price_list),
        selectinload(models.Product.gallery_images),
    ).filter(models.Product.is_active == True)

    if sku:
        # 1) Buscar por SKU exacto del producto
        product = query.filter(func.lower(models.Product.sku) == sku.lower()).first()
        # 2) Si no encontró, buscar en el barcode de las unidades (ProductUnit.barcode)
        if not product:
            unit = (
                db.query(models.ProductUnit)
                .filter(func.lower(models.ProductUnit.barcode) == sku.lower())
                .filter(models.ProductUnit.is_active == True)
                .first()
            )
            if unit:
                product = query.filter(models.Product.id == unit.product_id).first()
    else:
        product = query.filter(models.Product.id == product_id).first()

    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    return _apply_pos_stock(product, db)

@router.get("/kpis", dependencies=[Depends(require_permission("inventory.products.view"))])
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

@router.get("/", response_model=schemas.PaginatedProductList, dependencies=[Depends(require_permission("inventory.products.view"))])
@router.get("", response_model=schemas.PaginatedProductList, include_in_schema=False, dependencies=[Depends(require_permission("inventory.products.view"))])
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
            with_loader_criteria(models.ProductUnit, models.ProductUnit.is_active == True, include_aliases=True),
            joinedload(models.Product.stocks),
            joinedload(models.Product.prices).joinedload(models.ProductPrice.price_list),
            selectinload(models.Product.gallery_images),
            joinedload(models.Product.combo_items).joinedload(models.ComboItem.child_product),
            joinedload(models.Product.promotion_items).joinedload(models.ProductPromotionItem.child_product),
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
                _apply_pos_stock(p, db, warehouse_id)

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

@router.post("/", response_model=schemas.ProductRead, dependencies=[Depends(require_permission("inventory.products.create"))])
@router.post("", response_model=schemas.ProductRead, dependencies=[Depends(require_permission("inventory.products.create"))], include_in_schema=False)
async def create_product(product: schemas.ProductCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_user)):
    _ensure_product_sku_available(db, product.sku)
    _ensure_product_units_not_duplicated(product.units)
    # 1. Operaciones DB (Síncronas en Threadpool)
    # 1. Operaciones DB (Transaction Wrapper)
    try:
        # A. Create Base Product
        product_data = product.dict(exclude={"units", "combo_items", "promotion_items", "warehouse_stocks", "prices", "gallery_images"})
        db_product = models.Product(**product_data)
        db.add(db_product)
        db.flush() # Generate ID

        # Prepare lists to capture ORM objects for response construction
        new_units = []
        new_combo_items = []
        new_promotion_items = []
        new_stocks = []
        new_prices = []
        new_gallery = []

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
            
        # C2. Process Promotion Gifts
        if product.promotion_items:
            new_promotion_items = _create_promotion_items(db, db_product.id, product.promotion_items)

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

        # F. Process Product Gallery
        new_gallery = _sync_product_gallery(
            db,
            db_product.id,
            product.gallery_images,
            fallback_image_url=db_product.image_url,
        )
        _sync_primary_image_fields(db_product, new_gallery)

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
            "min_stock": float(db_product.min_stock) if db_product.min_stock is not None else 0.0,
            "unit_type": db_product.unit_type,
            "location": db_product.location,
            "is_active": db_product.is_active,
            "image_url": db_product.image_url,
            "image_url_original": db_product.image_url_original,
            "is_combo": db_product.is_combo,
            "has_imei": db_product.has_imei,
            "is_service": db_product.is_service,
            "is_commissionable": db_product.is_commissionable,
            "is_barbershop_service": db_product.is_barbershop_service,
            "is_menu_item": db_product.is_menu_item,
            "needs_kitchen": db_product.needs_kitchen,
            "barcode": db_product.sku,
            "exchange_rate_id": db_product.exchange_rate_id,
            "tax_rate": float(db_product.tax_rate) if db_product.tax_rate else 0.0,
            "discount_percentage": float(db_product.discount_percentage) if db_product.discount_percentage else 0.0,
            "is_discount_active": bool(db_product.is_discount_active),
            "profit_margin": float(db_product.profit_margin) if db_product.profit_margin is not None else None,
            "updated_at": db_product.updated_at,
            "warranty_duration": db_product.warranty_duration,
            "warranty_unit": db_product.warranty_unit,
            "warranty_notes": db_product.warranty_notes,
            "warranty_policy_id": int(db_product.warranty_policy_id) if db_product.warranty_policy_id else None,
            
            # Lists from captured objects (now with IDs thanks to flush)
            "units": [
                {
                    "id": u.id,
                    "unit_name": u.unit_name,
                    "conversion_factor": float(u.conversion_factor),
                    "barcode": u.barcode,
                    "cost_price": float(u.cost_price) if u.cost_price is not None else None,
                    "price_usd": float(u.price_usd) if u.price_usd else None,
                    "profit_margin": float(u.profit_margin) if u.profit_margin is not None else None,
                    "discount_percentage": float(u.discount_percentage) if u.discount_percentage is not None else 0,
                    "is_discount_active": bool(u.is_discount_active),
                    "product_id": u.product_id,
                    "is_default": u.is_default,
                    "is_active": bool(getattr(u, "is_active", True)),
                    "exchange_rate_id": u.exchange_rate_id
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
            "promotion_items": [_serialize_promotion_item(item) for item in new_promotion_items],
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
            "gallery_images": [_serialize_gallery_image(image) for image in new_gallery],
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
            "combo_items": response_data["combo_items"],
            "promotion_items": response_data.get("promotion_items", [])
        }
        background_tasks.add_task(run_broadcast, WebSocketEvents.PRODUCT_CREATED, payload, get_tenant_schema())

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
             raise HTTPException(status_code=400, detail="Ya existe un producto con ese SKU. Usa otro codigo o deja el SKU vacio si no aplica.")
        print(f"[ERROR] Product Creation Failed: {e}")
        raise HTTPException(status_code=400, detail="No se pudo crear el producto. Revisa los datos e intenta nuevamente.")

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
                "barcode": u.barcode,
                "is_active": bool(getattr(u, "is_active", True))
            } for u in _active_product_units(db_product.units)
        ] if db_product.units else [],
        "combo_items": [
            {
                "id": c.id,
                "child_product_id": c.child_product_id,
                "quantity": float(c.quantity)
            } for c in db_product.combo_items
        ] if db_product.combo_items else []
    }
    background_tasks.add_task(manager.broadcast, WebSocketEvents.PRODUCT_CREATED, payload, tenant_id=get_tenant_schema())
        
    return db_product

@router.put("/{product_id}", response_model=schemas.ProductRead, dependencies=[Depends(require_permission("inventory.products.edit"))])
async def update_product(product_id: int, product_update: schemas.ProductUpdate, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_user)):
    # 1. Eager Load Initial State (Robustness)
    db_product = db.query(models.Product).options(
        joinedload(models.Product.units), 
        joinedload(models.Product.stocks), 
        joinedload(models.Product.prices).joinedload(models.ProductPrice.price_list),
        selectinload(models.Product.gallery_images),
        joinedload(models.Product.combo_items).joinedload(models.ComboItem.child_product), 
        joinedload(models.Product.price_rules)
    ).filter(models.Product.id == product_id).first()
    
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    update_data = product_update.dict(exclude_unset=True)
    if "sku" in update_data:
        _ensure_product_sku_available(db, update_data.get("sku"), product_id=product_id)
    
    # Separate list data if present
    units_data = None
    if "units" in update_data:
        units_data = update_data.pop("units")
        _ensure_product_units_not_duplicated(units_data)
    
    combo_items_data = None
    if "combo_items" in update_data:
        combo_items_data = update_data.pop("combo_items")

    promotion_items_data = None
    if "promotion_items" in update_data:
        promotion_items_data = update_data.pop("promotion_items")

    stocks_data = None
    if "warehouse_stocks" in update_data:
        stocks_data = update_data.pop("warehouse_stocks")

    prices_data = None
    if "prices" in update_data:
        prices_data = update_data.pop("prices")

    gallery_images_data = None
    if "gallery_images" in update_data:
        gallery_images_data = update_data.pop("gallery_images")

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
    
    final_units = _active_product_units(db_product.units)
    final_combo = db_product.combo_items
    final_promotion_items = db_product.promotion_items
    final_stocks = db_product.stocks
    final_prices = db_product.prices
    final_gallery = db_product.gallery_images
    
    # Handle Units Update (soft delete to avoid breaking historical sale_details)
    if units_data is not None:
        incoming_ids = {
            u.get("id")
            for u in units_data
            if u.get("id") and isinstance(u.get("id"), int) and u.get("id") <= 10_000_000
        }
        existing_units = db.query(models.ProductUnit).filter(models.ProductUnit.product_id == product_id).all()
        existing_by_id = {existing_unit.id: existing_unit for existing_unit in existing_units}
        existing_by_key = {}
        for existing_unit in existing_units:
            key = _unit_identity_key({
                "unit_name": existing_unit.unit_name,
                "conversion_factor": existing_unit.conversion_factor,
            })
            existing_by_key.setdefault(key, []).append(existing_unit)
            if existing_unit.id not in incoming_ids:
                existing_unit.is_active = False
        # Upsert: update existing, reactivate archived, insert new
        new_units = []
        for unit in units_data:
            uid = unit.get("id")
            is_real_id = uid and isinstance(uid, int) and uid <= 10_000_000
            db_unit = existing_by_id.get(uid) if is_real_id else None
            if db_unit:
                for k, v in unit.items():
                    if k not in ("id", "_tempId"):
                        setattr(db_unit, k, v)
                db_unit.is_active = True
                new_units.append(db_unit)
                continue

            used_ids = {active_unit.id for active_unit in new_units if getattr(active_unit, "id", None)}
            db_unit = next(
                (
                    candidate
                    for candidate in existing_by_key.get(_unit_identity_key(unit), [])
                    if candidate.id not in used_ids
                ),
                None,
            )
            if db_unit:
                clean = {k: v for k, v in unit.items() if k not in ("id", "_tempId")}
                for k, v in clean.items():
                    setattr(db_unit, k, v)
                db_unit.is_active = True
                new_units.append(db_unit)
                continue

            clean = {k: v for k, v in unit.items() if k not in ("id", "_tempId")}
            clean["is_active"] = True
            db_unit = models.ProductUnit(**clean, product_id=product_id)
            db.add(db_unit)
            new_units.append(db_unit)
        final_units = new_units # Use the active list for response
    
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
            
    # Handle Promotion Gifts Update
    if promotion_items_data is not None:
        db.query(models.ProductPromotionItem).filter(models.ProductPromotionItem.parent_product_id == product_id).delete()
        final_promotion_items = _create_promotion_items(db, product_id, promotion_items_data)

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

    # Handle Gallery Images Update
    if gallery_images_data is not None:
        final_gallery = _sync_product_gallery(
            db,
            product_id,
            gallery_images_data,
            fallback_image_url=update_data.get('image_url') or db_product.image_url,
        )
    elif 'image_url' in update_data:
        if final_gallery:
            primary = next((img for img in final_gallery if getattr(img, 'is_primary', False)), final_gallery[0])
            primary.image_url = db_product.image_url or primary.image_url
        elif db_product.image_url:
            final_gallery = _sync_product_gallery(db, product_id, [], fallback_image_url=db_product.image_url)

    _sync_primary_image_fields(db_product, final_gallery)

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
        "min_stock": float(db_product.min_stock) if db_product.min_stock is not None else 0.0,
        "unit_type": db_product.unit_type,
        "location": db_product.location,
        "is_active": db_product.is_active,
        "image_url": db_product.image_url,
        "image_url_original": db_product.image_url_original,
        "is_combo": db_product.is_combo,
        "has_imei": db_product.has_imei,
        "is_service": db_product.is_service,
        "is_commissionable": db_product.is_commissionable,
        "is_barbershop_service": db_product.is_barbershop_service,
        "is_menu_item": db_product.is_menu_item,
        "needs_kitchen": db_product.needs_kitchen,
        "barcode": db_product.sku,
        "exchange_rate_id": db_product.exchange_rate_id,
        "tax_rate": float(db_product.tax_rate) if db_product.tax_rate else 0.0,
        "discount_percentage": float(db_product.discount_percentage) if db_product.discount_percentage else 0.0,
        "is_discount_active": bool(db_product.is_discount_active),
        "profit_margin": float(db_product.profit_margin) if db_product.profit_margin is not None else None,
        "updated_at": db_product.updated_at,
        "warranty_duration": db_product.warranty_duration,
        "warranty_unit": db_product.warranty_unit,
        "warranty_notes": db_product.warranty_notes,
        "warranty_policy_id": int(db_product.warranty_policy_id) if db_product.warranty_policy_id else None,
        
        # Manually serialize lists
        "units": [
            {
                "id": u.id,
                "unit_name": u.unit_name,
                "conversion_factor": float(u.conversion_factor),
                "barcode": u.barcode,
                "cost_price": float(u.cost_price) if u.cost_price is not None else None,
                "price_usd": float(u.price_usd) if u.price_usd else None,
                "product_id": u.product_id,
                "profit_margin": float(u.profit_margin) if u.profit_margin is not None else None,
                "discount_percentage": float(u.discount_percentage) if u.discount_percentage is not None else 0,
                "is_discount_active": bool(u.is_discount_active),
                "is_default": bool(u.is_default),
                "is_active": bool(getattr(u, "is_active", True)),
                "exchange_rate_id": u.exchange_rate_id,
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
        "promotion_items": [_serialize_promotion_item(item) for item in final_promotion_items],
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
        "gallery_images": [_serialize_gallery_image(image) for image in final_gallery],
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
    background_tasks.add_task(manager.broadcast, WebSocketEvents.PRODUCT_UPDATED, payload, tenant_id=get_tenant_schema())

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

@router.get("/template", dependencies=[Depends(require_permission("inventory.products.view"))])
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

@router.post("/import", dependencies=[Depends(require_permission("inventory.products.create"))])
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


@router.get("/export/excel", dependencies=[Depends(require_permission("inventory.products.view"))])
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

@router.get("/export/pdf", dependencies=[Depends(require_permission("inventory.products.view"))])
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



@router.get("/{product_id}", response_model=schemas.ProductRead, dependencies=[Depends(require_permission("inventory.products.view"))])
def read_product(product_id: int, db: Session = Depends(get_db)):
    product = db.query(models.Product).options(
        joinedload(models.Product.units),
        with_loader_criteria(models.ProductUnit, models.ProductUnit.is_active == True, include_aliases=True),
        joinedload(models.Product.stocks),
        joinedload(models.Product.instances),
        joinedload(models.Product.prices).joinedload(models.ProductPrice.price_list),
        selectinload(models.Product.gallery_images),
        joinedload(models.Product.combo_items).joinedload(models.ComboItem.child_product),
        joinedload(models.Product.promotion_items).joinedload(models.ProductPromotionItem.child_product),
        joinedload(models.Product.price_rules)
    ).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product

@router.delete("/{product_id}", dependencies=[Depends(require_permission("inventory.products.delete"))])
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
    background_tasks.add_task(run_broadcast, WebSocketEvents.PRODUCT_DELETED, payload, get_tenant_schema())

    return {"status": "success", "message": "Product deactivated"}

@router.delete("/{product_id}/image", dependencies=[Depends(require_permission("inventory.products.edit"))])
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
             dependencies=[Depends(require_permission("inventory.products.edit"))])
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
             dependencies=[Depends(require_permission("inventory.products.edit"))])
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

@router.get("/{product_id}/rules", response_model=List[schemas.PriceRuleRead], dependencies=[Depends(require_permission("config.prices.manage"))])
def read_price_rules(product_id: int, db: Session = Depends(get_db)):
    rules = db.query(models.PriceRule).filter(models.PriceRule.product_id == product_id).order_by(models.PriceRule.min_quantity).all()
    return rules

@router.post("/{product_id}/rules", response_model=schemas.PriceRuleRead, dependencies=[Depends(require_permission("config.prices.manage"))])
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



@router.delete("/rules/{rule_id}", dependencies=[Depends(require_permission("config.prices.manage"))])
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


@router.get("/sales/reprintable/recent", dependencies=[Depends(cashier_or_admin)])
def get_recent_reprintable_sales(
    limit: int = Query(25, ge=1, le=100),
    q: Optional[str] = Query(None, description="Buscar por numero de venta, cliente o metodo de pago"),
    session_id: Optional[int] = Query(None, description="Sesion de caja actual"),
    register_id: Optional[int] = Query(None, description="Caja fisica actual"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    """
    POS-safe sale lookup for reprinting tickets/warranties.
    Cashiers and admins can see recent tenant sales so another register can reprint
    a ticket or warranty without granting access to the full reports module.
    """
    role_value = getattr(getattr(current_user, "role", None), "value", getattr(current_user, "role", None))
    role_text = str(role_value).upper()
    is_admin = bool(getattr(current_user, "is_superuser", False)) or role_text == "ADMIN" or str(getattr(current_user, "role", "")).upper() == "USERROLE.ADMIN"

    query = db.query(models.Sale).options(
        joinedload(models.Sale.customer),
        selectinload(models.Sale.details).joinedload(models.SaleDetail.product),
        selectinload(models.Sale.details).selectinload(models.SaleDetail.instances),
        joinedload(models.Sale.cash_session).joinedload(models.CashSession.register),
    )

    search = (q or "").strip()

    # Always keep the POS lookup operational and bounded. We intentionally avoid
    # restricting cashiers to their own session: a cashier at caja 2 may need to
    # reprint a ticket or warranty for a sale completed at caja 1.
    query = query.filter(models.Sale.date >= datetime.now() - timedelta(days=7))

    if session_id and not search:
        query = query.filter(models.Sale.session_id == session_id)
    elif register_id and not search:
        query = query.filter(models.Sale.cash_session.has(models.CashSession.register_id == register_id))

    if search:
        lowered = f"%{search.lower()}%"
        conditions = []
        if search.isdigit():
            conditions.append(models.Sale.id == int(search))
        conditions.extend([
            models.Sale.payment_method.ilike(lowered),
            models.Customer.name.ilike(lowered),
            models.Customer.phone.ilike(lowered),
        ])
        query = query.outerjoin(models.Customer, models.Sale.customer_id == models.Customer.id).filter(or_(*conditions))

    sales = query.order_by(models.Sale.date.desc(), models.Sale.id.desc()).limit(limit).all()

    result = []
    for sale in sales:
        details = list(sale.details or [])
        has_warranty = any(
            bool(getattr(detail, "warranty_expiration_date", None))
            or any(getattr(sdi, "status", "SOLD") != "RETURNED" for sdi in (getattr(detail, "instances", None) or []))
            or (
                bool(detail.product)
                and (
                    bool(getattr(detail.product, "warranty_policy_id", None))
                    or bool(getattr(detail.product, "has_imei", False))
                )
            )
            for detail in details
        )
        item_names = [
            detail.description or (detail.product.name if detail.product else "Producto")
            for detail in details[:3]
        ]
        result.append({
            "id": sale.id,
            "date": sale.date.isoformat() if sale.date else None,
            "total_amount": float(sale.total_amount or 0),
            "total_amount_bs": float(sale.total_amount_bs or 0),
            "currency": sale.currency or "USD",
            "payment_method": sale.payment_method,
            "customer_name": sale.customer.name if sale.customer else "Cliente generico",
            "item_count": len(details),
            "items_preview": item_names,
            "has_warranty": has_warranty,
            "session_id": sale.session_id,
            "register_id": sale.cash_session.register_id if sale.cash_session else None,
            "register_code": sale.cash_session.register.code if sale.cash_session and sale.cash_session.register else None,
            "register_name": sale.cash_session.register.name if sale.cash_session and sale.cash_session.register else None,
        })

    return result

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

def _json_for_print_job(value):
    if value is None:
        return None
    try:
        return json.dumps(value, default=str)
    except Exception:
        return json.dumps({"unserializable": str(value)[:500]})


def _print_jobs_table(tenant_id: str) -> str:
    safe_schema = (tenant_id or "").replace('"', '""')
    return f'"{safe_schema}".print_jobs'


def _create_print_job(
    db: Session,
    tenant_id: str,
    *,
    job_type: str,
    sale_id: Optional[int] = None,
    user_id: Optional[int] = None,
    requested_client_id: Optional[str] = None,
    register_id: Optional[int] = None,
    route: Optional[str] = None,
    request_payload: Optional[dict] = None,
):
    try:
        table = _print_jobs_table(tenant_id)
        result = db.execute(text(f"""
            INSERT INTO {table} (
                job_type, status, sale_id, user_id, requested_client_id,
                register_id, route, request_payload, created_at, updated_at
            ) VALUES (
                :job_type, 'PENDING', :sale_id, :user_id, :requested_client_id,
                :register_id, :route, CAST(:request_payload AS jsonb), NOW(), NOW()
            )
            RETURNING id
        """), {
            "job_type": job_type,
            "sale_id": sale_id,
            "user_id": user_id,
            "requested_client_id": requested_client_id,
            "register_id": register_id,
            "route": route,
            "request_payload": _json_for_print_job(request_payload or {}),
        })
        job_id = result.scalar()
        db.commit()
        return job_id
    except Exception as exc:
        print(f"⚠️ [PRINT JOB] Could not create print_jobs row: {exc}")
        db.rollback()
        return None


def _update_print_job(
    db: Session,
    tenant_id: str,
    job_id: Optional[int],
    *,
    status: str,
    resolved_client_id: Optional[str] = None,
    register_id: Optional[int] = None,
    route: Optional[str] = None,
    response_payload: Optional[dict] = None,
    error_message: Optional[str] = None,
):
    if not job_id:
        return
    try:
        table = _print_jobs_table(tenant_id)
        db.execute(text(f"""
            UPDATE {table}
            SET status = :status,
                resolved_client_id = COALESCE(:resolved_client_id, resolved_client_id),
                register_id = COALESCE(:register_id, register_id),
                route = COALESCE(:route, route),
                response_payload = COALESCE(CAST(:response_payload AS jsonb), response_payload),
                error_message = :error_message,
                sent_at = CASE WHEN :status = 'SENT' THEN NOW() ELSE sent_at END,
                failed_at = CASE WHEN :status = 'FAILED' THEN NOW() ELSE failed_at END,
                updated_at = NOW()
            WHERE id = :job_id
        """), {
            "job_id": job_id,
            "status": status,
            "resolved_client_id": resolved_client_id,
            "register_id": register_id,
            "route": route,
            "response_payload": _json_for_print_job(response_payload) if response_payload is not None else None,
            "error_message": (error_message or None),
        })
        db.commit()
    except Exception as exc:
        print(f"⚠️ [PRINT JOB] Could not update print_jobs row #{job_id}: {exc}")
        db.rollback()


def _normalize_print_client_id(value: Optional[str]) -> Optional[str]:
    normalized = (value or "").strip().lower()
    return normalized or None


def _resolve_print_register(db: Session, register_id: Optional[int]):
    if not register_id:
        return None
    return db.query(models.CashRegister).filter(
        models.CashRegister.id == register_id,
        models.CashRegister.is_active == True
    ).first()


def _resolve_sale_print_register(db: Session, sale_id: int):
    sale = db.query(models.Sale).options(
        joinedload(models.Sale.cash_session).joinedload(models.CashSession.register)
    ).filter(models.Sale.id == sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    return sale.cash_session.register if sale.cash_session else None


def _find_connected_print_client(manager, tenant_id: str, client_id: Optional[str]) -> Optional[str]:
    target_client_id = _normalize_print_client_id(client_id)
    if not target_client_id:
        return None
    for connected_client in manager.active_connections.get(tenant_id, {}).keys():
        if connected_client.strip().lower() == target_client_id:
            return connected_client
    return None


def _connected_print_clients(manager, tenant_id: str) -> List[str]:
    return sorted(
        client_id for client_id in manager.active_connections.get(tenant_id, {}).keys()
        if client_id and not client_id.lower().startswith("web_")
    )


def _infer_print_target_hint(
    db: Session,
    *,
    sale_id: Optional[int] = None,
    request_client_id: Optional[str] = None,
    register_id: Optional[int] = None,
    prefer_sale_register: bool = False,
):
    try:
        register = None
        route = "station"
        if prefer_sale_register and sale_id:
            register = _resolve_sale_print_register(db, sale_id)
            route = "sale_register"
        elif register_id:
            register = _resolve_print_register(db, register_id)
            route = "station_register"
        elif not request_client_id and sale_id:
            register = _resolve_sale_print_register(db, sale_id)
            route = "sale_register_fallback"

        if register:
            return {
                "register_id": register.id,
                "resolved_client_id": _normalize_print_client_id(register.hardware_client_id),
                "route": route,
            }
        return {
            "register_id": register_id,
            "resolved_client_id": _normalize_print_client_id(request_client_id),
            "route": route,
        }
    except Exception:
        return {
            "register_id": register_id,
            "resolved_client_id": _normalize_print_client_id(request_client_id),
            "route": "sale_register" if prefer_sale_register else "station",
        }


def _resolve_print_target(
    db: Session,
    manager,
    tenant_id: str,
    *,
    sale_id: Optional[int] = None,
    request_client_id: Optional[str] = None,
    register_id: Optional[int] = None,
    prefer_sale_register: bool = False,
):
    """Resolve the target bridge deterministically for a print job.

    - New sale auto-print can ask for the sale register, avoiding browser cache drift.
    - Reprints/reports can still use the currently selected station register/client.
    """
    route = "station"
    register = None

    if prefer_sale_register and sale_id:
        register = _resolve_sale_print_register(db, sale_id)
        route = "sale_register"
    elif register_id:
        register = _resolve_print_register(db, register_id)
        route = "station_register"
    elif not request_client_id and sale_id:
        register = _resolve_sale_print_register(db, sale_id)
        route = "sale_register_fallback"

    target_client_id = _normalize_print_client_id(request_client_id)
    if register:
        target_client_id = _normalize_print_client_id(register.hardware_client_id)
        if not target_client_id:
            label = register.code or register.name or f"#{register.id}"
            raise HTTPException(
                status_code=400,
                detail=f"La caja {label} no tiene ID de impresora configurado. Configuralo en Gestion de Cajas."
            )
    elif register_id:
        raise HTTPException(status_code=404, detail="Caja no encontrada o inactiva")

    if tenant_id not in manager.active_connections:
        print(f"❌ [PRINT DEBUG] Active Tenants in Memory: {list(manager.active_connections.keys())}")
        raise HTTPException(
            status_code=503,
            detail=f"Ninguna impresora conectada para la empresa '{tenant_id}'. Verifique que Invensoft Bridge este abierto."
        )

    actual_client_id = _find_connected_print_client(manager, tenant_id, target_client_id)
    if not actual_client_id:
        connected = _connected_print_clients(manager, tenant_id)
        print(f"❌ [PRINT DEBUG] Active Clients in '{tenant_id}': {list(manager.active_connections.get(tenant_id, {}).keys())}")
        print(f"❌ [PRINT] Client '{target_client_id}' NOT connected for Tenant '{tenant_id}'")
        connected_text = ", ".join(connected) if connected else "ninguna"
        raise HTTPException(
            status_code=503,
            detail=(
                f"La impresora '{target_client_id or 'sin ID'}' no esta conectada. "
                f"Bridge(s) conectados: {connected_text}. Verifique que la caja y el ID del puente coincidan."
            )
        )

    return {
        "client_id": actual_client_id,
        "requested_client_id": target_client_id,
        "route": route,
        "register_id": register.id if register else register_id,
        "register_code": register.code if register else None,
    }


@router.post("/print/remote", dependencies=[Depends(cashier_or_admin)])
async def print_remote(
    request: schemas.RemotePrintRequest,
    current_user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Send print command to Hardware Bridge via WebSocket.
    The backend can now route by sale/register instead of trusting only browser cache.
    """
    from ..services.sales_service import SalesService
    from ..tenant_context import get_tenant_schema
    from ..services.websocket_manager import manager

    tenant_id = get_tenant_schema()
    request_payload = {
        "sale_id": request.sale_id,
        "client_id": request.client_id,
        "register_id": request.register_id,
        "prefer_sale_register": request.prefer_sale_register,
    }
    job_id = _create_print_job(
        db,
        tenant_id,
        job_type="ticket",
        sale_id=request.sale_id,
        user_id=getattr(current_user, "id", None),
        requested_client_id=request.client_id,
        register_id=request.register_id,
        route="sale_register" if request.prefer_sale_register else "station",
        request_payload=request_payload,
    )

    try:
        target = _resolve_print_target(
            db,
            manager,
            tenant_id,
            sale_id=request.sale_id,
            request_client_id=request.client_id,
            register_id=request.register_id,
            prefer_sale_register=request.prefer_sale_register,
        )
    except HTTPException as exc:
        hint = _infer_print_target_hint(
            db,
            sale_id=request.sale_id,
            request_client_id=request.client_id,
            register_id=request.register_id,
            prefer_sale_register=request.prefer_sale_register,
        )
        _update_print_job(
            db,
            tenant_id,
            job_id,
            status="FAILED",
            resolved_client_id=hint.get("resolved_client_id"),
            register_id=hint.get("register_id"),
            route=hint.get("route"),
            error_message=str(exc.detail),
        )
        raise

    _update_print_job(
        db,
        tenant_id,
        job_id,
        status="PENDING",
        resolved_client_id=target.get("client_id"),
        register_id=target.get("register_id"),
        route=target.get("route"),
    )

    print(
        f"📡 [PRINT] Remote request sale={request.sale_id} route={target['route']} "
        f"client='{target['client_id']}' tenant='{tenant_id}' job={job_id}"
    )

    try:
        payload = SalesService.get_sale_print_payload(db, request.sale_id)
    except HTTPException as exc:
        _update_print_job(
            db,
            tenant_id,
            job_id,
            status="FAILED",
            resolved_client_id=target.get("client_id"),
            register_id=target.get("register_id"),
            route=target.get("route"),
            error_message=str(exc.detail),
        )
        raise
    except Exception as e:
        _update_print_job(
            db,
            tenant_id,
            job_id,
            status="FAILED",
            resolved_client_id=target.get("client_id"),
            register_id=target.get("register_id"),
            route=target.get("route"),
            error_message=f"Error generando ticket: {str(e)}",
        )
        raise HTTPException(status_code=500, detail=f"Error generando ticket: {str(e)}")

    message = {
        "type": "print",
        "sale_id": request.sale_id,
        "payload": payload
    }

    success = await manager.send_to_client(message, target["client_id"], tenant_id, timeout=2.5)

    if not success:
        detail = f"El bridge '{target['client_id']}' estaba conectado pero no confirmo el envio. Reabra Invensoft Bridge e intente de nuevo."
        _update_print_job(
            db,
            tenant_id,
            job_id,
            status="FAILED",
            resolved_client_id=target.get("client_id"),
            register_id=target.get("register_id"),
            route=target.get("route"),
            error_message=detail,
        )
        raise HTTPException(status_code=500, detail=detail)

    response_payload = {
        "message": f"Comando de impresion enviado a {target['client_id']}",
        "sale_id": request.sale_id,
        "target": target,
    }
    _update_print_job(
        db,
        tenant_id,
        job_id,
        status="SENT",
        resolved_client_id=target.get("client_id"),
        register_id=target.get("register_id"),
        route=target.get("route"),
        response_payload=response_payload,
    )

    return {
        "status": "success",
        **response_payload,
        "print_job_id": job_id,
    }


class RemotePrintPayloadRequest(BaseModel):
    client_id: Optional[str] = None
    register_id: Optional[int] = None
    payload: dict


@router.post("/print/remote/payload", tags=["Print"])
async def print_remote_payload(
    request: RemotePrintPayloadRequest,
    current_user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Send raw print payload to Hardware Bridge via WebSocket.
    Reports can route by register_id to avoid stale browser printer IDs.
    """
    from ..services.websocket_manager import manager
    from ..tenant_context import get_tenant_schema

    tenant_id = get_tenant_schema()
    job_id = _create_print_job(
        db,
        tenant_id,
        job_type="raw_payload",
        user_id=getattr(current_user, "id", None),
        requested_client_id=request.client_id,
        register_id=request.register_id,
        route="station_register" if request.register_id else "station",
        request_payload={
            "client_id": request.client_id,
            "register_id": request.register_id,
            "payload_type": request.payload.get("status") if isinstance(request.payload, dict) else None,
        },
    )

    try:
        target = _resolve_print_target(
            db,
            manager,
            tenant_id,
            request_client_id=request.client_id,
            register_id=request.register_id,
        )
    except HTTPException as exc:
        hint = _infer_print_target_hint(
            db,
            request_client_id=request.client_id,
            register_id=request.register_id,
        )
        _update_print_job(
            db,
            tenant_id,
            job_id,
            status="FAILED",
            resolved_client_id=hint.get("resolved_client_id"),
            register_id=hint.get("register_id"),
            route=hint.get("route"),
            error_message=str(exc.detail),
        )
        raise

    _update_print_job(
        db,
        tenant_id,
        job_id,
        status="PENDING",
        resolved_client_id=target.get("client_id"),
        register_id=target.get("register_id"),
        route=target.get("route"),
    )

    message = {
        "type": "print",
        "payload": request.payload
    }

    success = await manager.send_to_client(message, target["client_id"], tenant_id, timeout=2.5)

    if not success:
        detail = f"El bridge '{target['client_id']}' estaba conectado pero no confirmo el envio."
        _update_print_job(
            db,
            tenant_id,
            job_id,
            status="FAILED",
            resolved_client_id=target.get("client_id"),
            register_id=target.get("register_id"),
            route=target.get("route"),
            error_message=detail,
        )
        raise HTTPException(status_code=500, detail=detail)

    response_payload = {
        "message": f"Reporte enviado a {target['client_id']}",
        "target": target,
    }
    _update_print_job(
        db,
        tenant_id,
        job_id,
        status="SENT",
        resolved_client_id=target.get("client_id"),
        register_id=target.get("register_id"),
        route=target.get("route"),
        response_payload=response_payload,
    )

    return {
        "status": "success",
        **response_payload,
        "print_job_id": job_id,
    }

@router.get("/print/jobs", dependencies=[Depends(cashier_or_admin)])
def list_print_jobs(
    limit: int = Query(50, ge=1, le=200),
    status: Optional[str] = Query(None),
    register_id: Optional[int] = Query(None),
    sale_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    """Recent print attempts for diagnostics and support."""
    tenant_id = get_tenant_schema()
    table = _print_jobs_table(tenant_id)
    where = []
    params = {"limit": limit}
    if status:
        where.append("pj.status = :status")
        params["status"] = status.upper()
    if register_id:
        where.append("pj.register_id = :register_id")
        params["register_id"] = register_id
    if sale_id:
        where.append("pj.sale_id = :sale_id")
        params["sale_id"] = sale_id

    where_sql = "WHERE " + " AND ".join(where) if where else ""
    try:
        rows = db.execute(text(f"""
            SELECT
                pj.id,
                pj.job_uuid::text AS job_uuid,
                pj.job_type,
                pj.status,
                pj.sale_id,
                pj.register_id,
                cr.code AS register_code,
                cr.name AS register_name,
                pj.user_id,
                u.email AS user_email,
                pj.requested_client_id,
                pj.resolved_client_id,
                pj.route,
                pj.error_message,
                pj.created_at,
                pj.sent_at,
                pj.failed_at,
                pj.updated_at
            FROM {table} pj
            LEFT JOIN {_print_jobs_table(tenant_id).rsplit('.', 1)[0]}.cash_registers cr ON cr.id = pj.register_id
            LEFT JOIN public.users u ON u.id = pj.user_id
            {where_sql}
            ORDER BY pj.created_at DESC, pj.id DESC
            LIMIT :limit
        """), params).mappings().all()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"No se pudo leer print_jobs: {str(exc)}")

    return [dict(row) for row in rows]


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

@router.post("/bulk", response_model=schemas.BulkImportResult, dependencies=[Depends(require_permission("inventory.products.create"))])
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
    current_user: models.User = Depends(require_permission("config.prices.manage"))
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
    current_user: models.User = Depends(require_permission("config.prices.manage"))
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
    current_user: models.User = Depends(require_permission("config.prices.manage"))
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
