"""
Catálogo Público — Mi Inventario Fácil
Endpoint sin autenticación.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional
from pydantic import BaseModel
from decimal import Decimal
import re

from ..database.db import get_db
from ..tenant_context import get_tenant_schema

router = APIRouter(prefix="/public", tags=["Catálogo Público"])

SAFE = re.compile(r'^[a-z0-9_-]+$')


def resolve_schema(middleware_schema: str, tenant_param: Optional[str]) -> Optional[str]:
    if middleware_schema and middleware_schema != "public":
        return middleware_schema
    if tenant_param and SAFE.match(tenant_param):
        return tenant_param
    return None


class CatalogProduct(BaseModel):
    id: int
    name: str
    price: Decimal
    stock: int
    sku: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    image_url: Optional[str] = None
    featured: bool = False

    class Config:
        from_attributes = True


class BusinessHour(BaseModel):
    day: str
    open: str
    close: str
    closed: bool = False


class CatalogBusiness(BaseModel):
    name: str
    phone: Optional[str] = None
    logo_url: Optional[str] = None
    whatsapp: Optional[str] = None
    hours: Optional[str] = None
    show_out_of_stock: bool = False
    whatsapp_cart: bool = True


class CatalogResponse(BaseModel):
    business: CatalogBusiness
    products: list[CatalogProduct]
    total: int


@router.get("/catalog", response_model=CatalogResponse)
def get_public_catalog(
    db: Session = Depends(get_db),
    search:   Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    limit:    int = Query(100, le=200),
    offset:   int = Query(0, ge=0),
    _tenant:  Optional[str] = Query(None),
):
    schema = resolve_schema(get_tenant_schema(), _tenant)
    if not schema:
        return CatalogResponse(
            business=CatalogBusiness(name="Mi Inventario"),
            products=[], total=0
        )

    # ── Config del negocio ─────────────────────────────────
    keys = (
        "'business_name','business_phone','logo_url',"
        "'whatsapp_admin_phone','catalog_show_out_of_stock',"
        "'catalog_business_hours','catalog_whatsapp_cart'"
    )
    biz_rows = db.execute(
        text(f'SELECT key, value FROM "{schema}".business_config WHERE key IN ({keys})')
    ).fetchall()
    biz = {r[0]: r[1] for r in biz_rows}

    show_oos   = biz.get("catalog_show_out_of_stock", "false") == "true"
    wa_cart    = biz.get("catalog_whatsapp_cart", "true") != "false"
    wa_phone   = biz.get("whatsapp_admin_phone") or biz.get("business_phone")

    business = CatalogBusiness(
        name=biz.get("business_name") or schema,
        phone=biz.get("business_phone"),
        logo_url=biz.get("logo_url"),
        whatsapp=wa_phone,
        hours=biz.get("catalog_business_hours") or None,
        show_out_of_stock=show_oos,
        whatsapp_cart=wa_cart,
    )

    # ── Productos ──────────────────────────────────────────
    where = ['p.is_active = true', 'p.price > 0']
    if not show_oos:
        where.append('p.stock > 0')

    params: dict = {"limit": limit, "offset": offset}

    if search:
        where.append("(LOWER(p.name) LIKE :search OR LOWER(COALESCE(p.sku,'')) LIKE :search)")
        params["search"] = f"%{search.lower()}%"

    if category:
        where.append("LOWER(c.name) = LOWER(:category)")
        params["category"] = category

    w = " AND ".join(where)

    rows = db.execute(text(f"""
        SELECT p.id, p.name, p.price, p.stock,
               p.sku, p.description,
               c.name AS category, p.image_url,
               COALESCE(p.featured, false) AS featured
        FROM "{schema}".products p
        LEFT JOIN "{schema}".categories c ON c.id = p.category_id
        WHERE {w}
        ORDER BY COALESCE(p.featured, false) DESC, p.name ASC
        LIMIT :limit OFFSET :offset
    """), params).fetchall()

    total = db.execute(text(f"""
        SELECT COUNT(*) FROM "{schema}".products p
        LEFT JOIN "{schema}".categories c ON c.id = p.category_id
        WHERE {w}
    """), {k: v for k, v in params.items() if k not in ("limit","offset")}).scalar()

    products = [
        CatalogProduct(
            id=r[0], name=r[1], price=r[2], stock=int(r[3]),
            sku=r[4], description=r[5], category=r[6],
            image_url=r[7], featured=bool(r[8]),
        )
        for r in rows
    ]

    return CatalogResponse(business=business, products=products, total=total or 0)


@router.get("/catalog/categories")
def get_catalog_categories(
    db: Session = Depends(get_db),
    _tenant: Optional[str] = Query(None),
):
    schema = resolve_schema(get_tenant_schema(), _tenant)
    if not schema:
        return []
    rows = db.execute(text(f"""
        SELECT DISTINCT c.name
        FROM "{schema}".products p
        JOIN "{schema}".categories c ON c.id = p.category_id
        WHERE p.is_active = true AND p.price > 0
        ORDER BY c.name
    """)).fetchall()
    return [r[0] for r in rows if r[0]]


@router.post("/catalog/config")
def update_catalog_config(
    config: dict,
    db: Session = Depends(get_db),
    _tenant: Optional[str] = Query(None),
):
    """Actualiza la configuración del catálogo del tenant."""
    from ..dependencies import get_current_active_user
    schema = resolve_schema(get_tenant_schema(), _tenant)
    if not schema:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Tenant no encontrado")

    allowed = {
        "catalog_show_out_of_stock", "catalog_business_hours", "catalog_whatsapp_cart"
    }
    for key, value in config.items():
        if key in allowed:
            existing = db.execute(
                text(f'SELECT 1 FROM "{schema}".business_config WHERE key=:k'),
                {"k": key}
            ).fetchone()
            if existing:
                db.execute(
                    text(f'UPDATE "{schema}".business_config SET value=:v WHERE key=:k'),
                    {"k": key, "v": str(value)}
                )
            else:
                db.execute(
                    text(f'INSERT INTO "{schema}".business_config (key,value) VALUES (:k,:v)'),
                    {"k": key, "v": str(value)}
                )
    db.commit()
    return {"ok": True}
