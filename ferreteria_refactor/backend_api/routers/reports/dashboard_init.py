"""
dashboard_init.py — Endpoint optimizado para carga inicial del Dashboard.
Consolida en 1 request lo que antes eran 6-8 requests separados.
Cacheable en Redis por 60 segundos (datos cambian con cada venta).
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text, func
from datetime import date, timedelta
from typing import Optional
from decimal import Decimal

from ...database.db import get_db
from ...models import models
from ...dependencies import get_current_active_user
from ...cache import get_cached, set_cached

router = APIRouter()

def _float(v):
    try: return float(v or 0)
    except: return 0.0

@router.get("/dashboard-init")
def get_dashboard_init(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_active_user)
):
    """
    Consolida en 1 request todos los datos del Dashboard:
    - Resumen de ventas del período
    - Rentabilidad
    - Top productos (5)
    - Métodos de pago
    - Stock bajo
    - Resumen de créditos
    TTL de caché: 60 segundos
    """
    from ...tenant_context import get_tenant_schema
    schema = get_tenant_schema()
    if schema == 'public':
        return {}

    # Fechas del período
    today = date.today()
    d_from = date.fromisoformat(date_from) if date_from else today.replace(day=1)
    d_to   = date.fromisoformat(date_to)   if date_to   else today

    cache_key = f"dashboard_init:{d_from}:{d_to}"
    cached = get_cached(schema, cache_key)
    if cached:
        return cached

    # ── 1. Resumen de ventas ─────────────────────────────────────────────────
    sales_summary = db.execute(text(f"""
        SELECT
            COUNT(*)                                          AS total_count,
            COALESCE(SUM(total_amount), 0)                   AS total_revenue,
            COALESCE(SUM(total_discount_usd), 0)             AS total_discounts,
            COUNT(*) FILTER (WHERE is_credit = true)         AS credit_count,
            COALESCE(SUM(total_amount) FILTER (WHERE is_credit = true), 0) AS credit_amount
        FROM {schema}.sales
        WHERE date::date BETWEEN :d_from AND :d_to
    """), {"d_from": d_from, "d_to": d_to}).first()

    # ── 2. Rentabilidad (costo vs ingreso) ───────────────────────────────────
    profit = db.execute(text(f"""
        SELECT
            COALESCE(SUM(sd.subtotal), 0)                        AS revenue,
            COALESCE(SUM(sd.cost_at_sale * sd.quantity), 0)      AS cost
        FROM {schema}.sale_details sd
        JOIN {schema}.sales s ON s.id = sd.sale_id
        WHERE s.date::date BETWEEN :d_from AND :d_to
    """), {"d_from": d_from, "d_to": d_to}).first()

    revenue = _float(profit.revenue)
    cost    = _float(profit.cost)
    gross_profit = revenue - cost
    margin_pct   = (gross_profit / revenue * 100) if revenue > 0 else 0

    # ── 3. Top 5 productos ───────────────────────────────────────────────────
    top_products = db.execute(text(f"""
        SELECT p.name, SUM(sd.quantity) AS qty, SUM(sd.subtotal) AS revenue
        FROM {schema}.sale_details sd
        JOIN {schema}.products p ON p.id = sd.product_id
        JOIN {schema}.sales s ON s.id = sd.sale_id
        WHERE s.date::date BETWEEN :d_from AND :d_to
        GROUP BY p.name
        ORDER BY qty DESC
        LIMIT 5
    """), {"d_from": d_from, "d_to": d_to}).all()

    # ── 4. Métodos de pago ───────────────────────────────────────────────────
    payment_methods = db.execute(text(f"""
        SELECT payment_method, COUNT(*) AS count, SUM(total_amount) AS total
        FROM {schema}.sales
        WHERE date::date BETWEEN :d_from AND :d_to
        GROUP BY payment_method
        ORDER BY total DESC
    """), {"d_from": d_from, "d_to": d_to}).all()

    # ── 5. Stock bajo (usa el índice nuevo) ──────────────────────────────────
    low_stock = db.execute(text(f"""
        SELECT p.name, p.stock, p.min_stock, c.name AS category
        FROM {schema}.products p
        LEFT JOIN {schema}.categories c ON c.id = p.category_id
        WHERE p.is_active = true
          AND p.stock <= p.min_stock
          AND p.min_stock > 0
        ORDER BY (p.stock - p.min_stock) ASC
        LIMIT 10
    """)).all()

    # ── 6. Período anterior para comparación ─────────────────────────────────
    days = (d_to - d_from).days or 1
    prev_to   = d_from - timedelta(days=1)
    prev_from = prev_to - timedelta(days=days)

    prev_sales = db.execute(text(f"""
        SELECT COALESCE(COUNT(*), 0) AS count, COALESCE(SUM(total_amount), 0) AS revenue
        FROM {schema}.sales
        WHERE date::date BETWEEN :d_from AND :d_to
    """), {"d_from": prev_from, "d_to": prev_to}).first()

    result = {
        "period": {"from": str(d_from), "to": str(d_to)},
        "sales": {
            "count":          int(sales_summary.total_count or 0),
            "revenue":        _float(sales_summary.total_revenue),
            "discounts":      _float(sales_summary.total_discounts),
            "credit_count":   int(sales_summary.credit_count or 0),
            "credit_amount":  _float(sales_summary.credit_amount),
        },
        "profit": {
            "revenue":        revenue,
            "cost":           cost,
            "gross_profit":   gross_profit,
            "margin_pct":     round(margin_pct, 2),
        },
        "vs_previous": {
            "sales_count":   int(prev_sales.count or 0),
            "sales_revenue": _float(prev_sales.revenue),
            "count_change_pct": round(
                ((int(sales_summary.total_count or 0) - int(prev_sales.count or 0))
                 / max(int(prev_sales.count or 1), 1)) * 100, 1
            ),
            "revenue_change_pct": round(
                ((_float(sales_summary.total_revenue) - _float(prev_sales.revenue))
                 / max(_float(prev_sales.revenue), 0.01)) * 100, 1
            ),
        },
        "top_products": [
            {"name": r.name, "qty": _float(r.qty), "revenue": _float(r.revenue)}
            for r in top_products
        ],
        "payment_methods": [
            {"method": r.payment_method, "count": int(r.count), "total": _float(r.total)}
            for r in payment_methods
        ],
        "low_stock": [
            {"name": r.name, "stock": _float(r.stock), "min_stock": _float(r.min_stock), "category": r.category}
            for r in low_stock
        ],
    }

    # Cachear 60 segundos
    set_cached(schema, cache_key, result, ttl=60)
    return result
