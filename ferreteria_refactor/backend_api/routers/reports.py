

# ═══════════════════════════════════════════════════════════════════════════
# INTELIGENCIA DE INVENTARIO
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/intelligence/hot-products")
def get_hot_products(
    days: int = 30,
    limit: int = 10,
    db: Session = Depends(get_db),
    user: Any = Depends(any_authenticated)
):
    """Productos más vendidos en los últimos N días con velocidad de rotación."""
    from sqlalchemy import func, text
    from datetime import datetime, timedelta

    since = datetime.now() - timedelta(days=days)

    rows = db.execute(text("""
        SELECT
            p.id,
            p.name,
            p.sku,
            p.stock,
            p.price,
            p.image_url,
            COALESCE(SUM(sd.quantity), 0)::float  AS units_sold,
            COALESCE(SUM(sd.subtotal), 0)::float  AS revenue,
            MAX(s.date)                            AS last_sale,
            COUNT(DISTINCT s.id)                   AS num_orders
        FROM products p
        JOIN sale_details sd ON sd.product_id = p.id
        JOIN sales s ON s.id = sd.sale_id
        WHERE p.is_active = true
          AND s.date >= :since
          AND s.status != 'CANCELLED'
        GROUP BY p.id, p.name, p.sku, p.stock, p.price, p.image_url
        ORDER BY units_sold DESC
        LIMIT :limit
    """), {"since": since, "limit": limit}).fetchall()

    result = []
    for r in rows:
        units = r.units_sold or 0
        velocity = round(units / days, 2)  # unidades/día
        days_of_stock = round(r.stock / velocity, 1) if velocity > 0 else None
        result.append({
            "id": r.id,
            "name": r.name,
            "sku": r.sku,
            "stock": float(r.stock or 0),
            "price": float(r.price or 0),
            "image_url": r.image_url,
            "units_sold": units,
            "revenue": round(r.revenue or 0, 2),
            "num_orders": r.num_orders,
            "velocity_per_day": velocity,
            "days_of_stock": days_of_stock,
            "last_sale": r.last_sale.isoformat() if r.last_sale else None,
        })
    return result


@router.get("/intelligence/dormant-products")
def get_dormant_products(
    days: int = 30,
    limit: int = 20,
    db: Session = Depends(get_db),
    user: Any = Depends(any_authenticated)
):
    """Productos con stock > 0 pero sin ventas en los últimos N días."""
    from sqlalchemy import text
    from datetime import datetime, timedelta

    since = datetime.now() - timedelta(days=days)

    rows = db.execute(text("""
        SELECT
            p.id,
            p.name,
            p.sku,
            p.stock,
            p.price,
            p.image_url,
            MAX(s.date) AS last_sale,
            EXTRACT(DAY FROM NOW() - MAX(s.date))::int AS days_dormant,
            COALESCE(SUM(CASE WHEN s.date >= :since THEN sd.quantity ELSE 0 END), 0)::float AS recent_units
        FROM products p
        LEFT JOIN sale_details sd ON sd.product_id = p.id
        LEFT JOIN sales s ON s.id = sd.sale_id AND s.status != 'CANCELLED'
        WHERE p.is_active = true
          AND p.stock > 0
        GROUP BY p.id, p.name, p.sku, p.stock, p.price, p.image_url
        HAVING COALESCE(SUM(CASE WHEN s.date >= :since THEN sd.quantity ELSE 0 END), 0) = 0
        ORDER BY days_dormant DESC NULLS FIRST, p.stock DESC
        LIMIT :limit
    """), {"since": since, "limit": limit}).fetchall()

    result = []
    for r in rows:
        result.append({
            "id": r.id,
            "name": r.name,
            "sku": r.sku,
            "stock": float(r.stock or 0),
            "price": float(r.price or 0),
            "image_url": r.image_url,
            "last_sale": r.last_sale.isoformat() if r.last_sale else None,
            "days_dormant": r.days_dormant,
            "stock_value": round(float(r.price or 0) * float(r.stock or 0), 2),
        })
    return result


@router.get("/intelligence/transfer-suggestions")
def get_transfer_suggestions(
    days: int = 30,
    db: Session = Depends(get_db),
    user: Any = Depends(any_authenticated)
):
    """
    Sugerencias de traslado: productos dormidos con valor significativo
    que podrían moverse a otro local.
    Combina: sin ventas en N días + stock > 0 + valor total > $20
    """
    from sqlalchemy import text
    from datetime import datetime, timedelta

    since = datetime.now() - timedelta(days=days)

    rows = db.execute(text("""
        SELECT
            p.id,
            p.name,
            p.sku,
            p.stock,
            p.price,
            p.image_url,
            MAX(s.date) AS last_sale,
            EXTRACT(DAY FROM NOW() - MAX(s.date))::int AS days_dormant,
            (p.stock * p.price)::float AS stock_value
        FROM products p
        LEFT JOIN sale_details sd ON sd.product_id = p.id
        LEFT JOIN sales s ON s.id = sd.sale_id AND s.status != 'CANCELLED'
        WHERE p.is_active = true
          AND p.stock > 0
          AND (p.stock * p.price) >= 20
        GROUP BY p.id, p.name, p.sku, p.stock, p.price, p.image_url
        HAVING COALESCE(SUM(CASE WHEN s.date >= :since THEN sd.quantity ELSE 0 END), 0) = 0
        ORDER BY stock_value DESC
        LIMIT 15
    """), {"since": since, "limit": 15}).fetchall()

    result = []
    for r in rows:
        priority = "HIGH" if (r.days_dormant or 0) > 60 else "MEDIUM" if (r.days_dormant or 0) > 30 else "LOW"
        result.append({
            "id": r.id,
            "name": r.name,
            "sku": r.sku,
            "stock": float(r.stock or 0),
            "price": float(r.price or 0),
            "image_url": r.image_url,
            "last_sale": r.last_sale.isoformat() if r.last_sale else None,
            "days_dormant": r.days_dormant,
            "stock_value": round(r.stock_value or 0, 2),
            "priority": priority,
            "reason": f"Sin ventas en {r.days_dormant or '∞'} días · Capital inmovilizado: ${round(r.stock_value or 0, 2)}",
        })
    return result
