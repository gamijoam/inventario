from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime, timedelta
from ...database.db import get_db
from ...dependencies import admin_only

router = APIRouter()


@router.get("/intelligence/hot-products")
def get_hot_products(
    days: int = 30,
    limit: int = 10,
    db: Session = Depends(get_db),
    _=Depends(admin_only),
):
    since = datetime.now() - timedelta(days=days)
    rows = db.execute(text("""
        SELECT p.id, p.name, p.sku, p.stock, p.price, p.image_url,
               COALESCE(SUM(sd.quantity), 0)::float  AS units_sold,
               COALESCE(SUM(sd.subtotal), 0)::float  AS revenue,
               MAX(s.date)                            AS last_sale,
               COUNT(DISTINCT s.id)                   AS num_orders
        FROM products p
        JOIN sale_details sd ON sd.product_id = p.id
        JOIN sales s ON s.id = sd.sale_id
        WHERE p.is_active = true
          AND s.date >= :since
          
        GROUP BY p.id, p.name, p.sku, p.stock, p.price, p.image_url
        ORDER BY units_sold DESC
        LIMIT :limit
    """), {"since": since, "limit": limit}).fetchall()

    result = []
    for r in rows:
        units = r.units_sold or 0
        velocity = round(units / days, 2)
        days_of_stock = round(float(r.stock) / velocity, 1) if velocity > 0 and r.stock else None
        result.append({
            "id": r.id, "name": r.name, "sku": r.sku,
            "stock": float(r.stock or 0), "price": float(r.price or 0),
            "image_url": r.image_url, "units_sold": units,
            "revenue": round(r.revenue or 0, 2), "num_orders": r.num_orders,
            "velocity_per_day": velocity, "days_of_stock": days_of_stock,
            "last_sale": r.last_sale.isoformat() if r.last_sale else None,
        })
    return result


@router.get("/intelligence/dormant-products")
def get_dormant_products(
    days: int = 30,
    limit: int = 20,
    db: Session = Depends(get_db),
    _=Depends(admin_only),
):
    since = datetime.now() - timedelta(days=days)
    rows = db.execute(text("""
        SELECT p.id, p.name, p.sku, p.stock, p.price, p.image_url,
               MAX(s.date) AS last_sale,
               EXTRACT(DAY FROM NOW() - MAX(s.date))::int AS days_dormant,
               (p.stock * p.price)::float AS stock_value
        FROM products p
        LEFT JOIN sale_details sd ON sd.product_id = p.id
        LEFT JOIN sales s ON s.id = sd.sale_id 
        WHERE p.is_active = true AND p.stock > 0
        GROUP BY p.id, p.name, p.sku, p.stock, p.price, p.image_url
        HAVING COALESCE(SUM(CASE WHEN s.date >= :since THEN sd.quantity ELSE 0 END), 0) = 0
        ORDER BY days_dormant DESC NULLS FIRST, p.stock DESC
        LIMIT :limit
    """), {"since": since, "limit": limit}).fetchall()

    return [{
        "id": r.id, "name": r.name, "sku": r.sku,
        "stock": float(r.stock or 0), "price": float(r.price or 0),
        "image_url": r.image_url,
        "last_sale": r.last_sale.isoformat() if r.last_sale else None,
        "days_dormant": r.days_dormant,
        "stock_value": round(r.stock_value or 0, 2),
    } for r in rows]


@router.get("/intelligence/transfer-suggestions")
def get_transfer_suggestions(
    days: int = 30,
    db: Session = Depends(get_db),
    _=Depends(admin_only),
):
    since = datetime.now() - timedelta(days=days)
    rows = db.execute(text("""
        SELECT p.id, p.name, p.sku, p.stock, p.price, p.image_url,
               MAX(s.date) AS last_sale,
               EXTRACT(DAY FROM NOW() - MAX(s.date))::int AS days_dormant,
               (p.stock * p.price)::float AS stock_value
        FROM products p
        LEFT JOIN sale_details sd ON sd.product_id = p.id
        LEFT JOIN sales s ON s.id = sd.sale_id 
        WHERE p.is_active = true AND p.stock > 0 AND (p.stock * p.price) >= 20
        GROUP BY p.id, p.name, p.sku, p.stock, p.price, p.image_url
        HAVING COALESCE(SUM(CASE WHEN s.date >= :since THEN sd.quantity ELSE 0 END), 0) = 0
        ORDER BY stock_value DESC
        LIMIT 15
    """), {"since": since, "limit": 15}).fetchall()

    result = []
    for r in rows:
        d = r.days_dormant or 0
        priority = "HIGH" if d > 60 else "MEDIUM" if d > 30 else "LOW"
        result.append({
            "id": r.id, "name": r.name, "sku": r.sku,
            "stock": float(r.stock or 0), "price": float(r.price or 0),
            "image_url": r.image_url,
            "last_sale": r.last_sale.isoformat() if r.last_sale else None,
            "days_dormant": r.days_dormant,
            "stock_value": round(r.stock_value or 0, 2),
            "priority": priority,
            "reason": f"Sin ventas en {r.days_dormant or '∞'} días · Capital inmovilizado: ${round(r.stock_value or 0, 2)}",
        })
    return result
