"""
Catálogo Público — Mi Inventario Fácil
Endpoint sin autenticación que devuelve los productos activos del tenant.
El tenant se identifica por el schema actual (subdominio).
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional
from pydantic import BaseModel
from decimal import Decimal

from ..database.db import get_db
from ..tenant_context import get_tenant_schema

router = APIRouter(prefix="/public", tags=["Catálogo Público"])


class CatalogProduct(BaseModel):
    id: int
    name: str
    price: Decimal
    stock: int
    sku: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    image_url: Optional[str] = None

    class Config:
        from_attributes = True


class CatalogBusiness(BaseModel):
    name: str
    phone: Optional[str] = None
    logo_url: Optional[str] = None
    whatsapp: Optional[str] = None


class CatalogResponse(BaseModel):
    business: CatalogBusiness
    products: list[CatalogProduct]
    total: int


@router.get("/catalog", response_model=CatalogResponse)
def get_public_catalog(
    db: Session = Depends(get_db),
    search: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    limit: int = Query(100, le=200),
    offset: int = Query(0, ge=0),
    _tenant: Optional[str] = Query(None, description="Schema del tenant (fallback si el middleware no lo detecta)"),
):
    """
    Catálogo público del tenant — sin autenticación requerida.
    El tenant se determina por el subdominio de la petición.
    """
    schema = get_tenant_schema()
    # Si el middleware no detectó el tenant (ej: request via api.dominio.com),
    # usar el parámetro _tenant como fallback
    if (not schema or schema == "public") and _tenant:
        import re
        if re.match(r'^[a-z0-9_-]+$', _tenant):
            schema = _tenant

    if not schema or schema == "public":
        return CatalogResponse(
            business=CatalogBusiness(name="Mi Inventario"),
            products=[],
            total=0
        )

    # ── Info del negocio ──────────────────────────────────────
    biz_rows = db.execute(
        text(f"""
            SELECT key, value FROM "{schema}".business_config
            WHERE key IN (
                'business_name','business_phone','logo_url',
                'whatsapp_admin_phone','whatsapp_instance_name'
            )
        """)
    ).fetchall()
    biz = {r[0]: r[1] for r in biz_rows}

    business = CatalogBusiness(
        name=biz.get("business_name") or schema,
        phone=biz.get("business_phone"),
        logo_url=biz.get("logo_url"),
        whatsapp=biz.get("whatsapp_admin_phone"),
    )

    # ── Productos activos ─────────────────────────────────────
    where_clauses = [
        f'p.is_active = true',
        f'p.price > 0',
        f'p.stock > 0',
    ]
    params: dict = {"limit": limit, "offset": offset}

    if search:
        where_clauses.append(
            "(LOWER(p.name) LIKE :search OR LOWER(p.sku) LIKE :search)"
        )
        params["search"] = f"%{search.lower()}%"

    if category:
        where_clauses.append("LOWER(c.name) = LOWER(:category)")
        params["category"] = category

    where_sql = " AND ".join(where_clauses)

    products_sql = text(f"""
        SELECT
            p.id, p.name, p.price, p.stock,
            p.sku, p.description,
            c.name AS category,
            p.image_url
        FROM "{schema}".products p
        LEFT JOIN "{schema}".categories c ON c.id = p.category_id
        WHERE {where_sql}
        ORDER BY p.name ASC
        LIMIT :limit OFFSET :offset
    """)

    count_sql = text(f"""
        SELECT COUNT(*) FROM "{schema}".products p
        LEFT JOIN "{schema}".categories c ON c.id = p.category_id
        WHERE {where_sql}
    """)

    rows = db.execute(products_sql, params).fetchall()
    total = db.execute(count_sql, {k: v for k, v in params.items()
                                   if k not in ("limit", "offset")}).scalar()

    products = [
        CatalogProduct(
            id=r[0], name=r[1], price=r[2], stock=r[3],
            sku=r[4], description=r[5], category=r[6],
            image_url=r[7],
        )
        for r in rows
    ]

    return CatalogResponse(business=business, products=products, total=total or 0)


@router.get("/catalog/categories")
def get_catalog_categories(
    db: Session = Depends(get_db),
    _tenant: Optional[str] = Query(None),
):
    """Categorías disponibles en el catálogo del tenant."""
    schema = get_tenant_schema()
    if (not schema or schema == "public") and _tenant:
        import re
        if re.match(r'^[a-z0-9_-]+$', _tenant):
            schema = _tenant
    if not schema or schema == "public":
        return []

    rows = db.execute(text(f"""
        SELECT DISTINCT c.name
        FROM "{schema}".products p
        JOIN "{schema}".categories c ON c.id = p.category_id
        WHERE p.is_active = true AND p.price > 0 AND p.stock > 0
        ORDER BY c.name
    """)).fetchall()

    return [r[0] for r in rows if r[0]]
