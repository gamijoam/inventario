"""
dashboard_init.py — Endpoint optimizado para carga inicial del Dashboard.
Consolida en 1 request lo que antes eran 6-8 requests separados.
Cacheable en Redis por 30 segundos (datos cambian con cada venta).
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text, func
from datetime import date, datetime, timedelta
from typing import Optional
from decimal import Decimal

from ...database.db import get_db
from ...models import models
from ...dependencies import require_any_permission
from ...cache import get_cached, set_cached

router = APIRouter()

def _float(v):
    try: return float(v or 0)
    except: return 0.0

@router.get("/dashboard-init")
def get_dashboard_init(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    refresh: bool = False,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_any_permission(["dashboard.view", "reports.view"]))
):
    """
    Consolida en 1 request todos los datos del Dashboard:
    - Resumen de ventas del período
    - Rentabilidad
    - Top productos (5)
    - Métodos de pago
    - Stock bajo
    - Resumen de créditos
    TTL de cache: 30 segundos
    """
    from ...tenant_context import get_tenant_schema
    schema = get_tenant_schema()
    if schema == 'public':
        return {}

    # Fechas del período
    today = date.today()
    d_from = date.fromisoformat(date_from) if date_from else today.replace(day=1)
    d_to   = date.fromisoformat(date_to)   if date_to   else today
    start_dt = datetime.combine(d_from, datetime.min.time())
    end_next = datetime.combine(d_to + timedelta(days=1), datetime.min.time())

    cache_key = f"dashboard_init:v2:{d_from}:{d_to}"
    cached = get_cached(schema, cache_key)
    if cached and not refresh:
        return cached

    import logging
    log = logging.getLogger(__name__)
    log.info(f"[dashboard-init] schema={schema} from={d_from} to={d_to}")

    # ── 1. Resumen neto de ventas ────────────────────────────────────────────
    sales_summary = db.execute(text(f"""
        WITH sales_period AS (
            SELECT
                COUNT(*)::numeric AS sale_count,
                COALESCE(SUM(total_amount), 0)::numeric AS gross_revenue,
                COALESCE(SUM(total_discount_usd), 0)::numeric AS discounts,
                COUNT(*) FILTER (WHERE is_credit = true)::numeric AS credit_count,
                COALESCE(SUM(total_amount) FILTER (WHERE is_credit = true), 0)::numeric AS credit_amount
            FROM {schema}.sales
            WHERE date >= :start_dt AND date < :end_next
        ), returns_period AS (
            SELECT
                COUNT(*)::numeric AS return_count,
                COALESCE(SUM(total_refunded), 0)::numeric AS refunds
            FROM {schema}.returns
            WHERE date >= :start_dt AND date < :end_next
        )
        SELECT
            (sp.sale_count - rp.return_count) AS total_count,
            sp.gross_revenue AS gross_revenue,
            rp.refunds AS returns_amount,
            (sp.gross_revenue - rp.refunds) AS total_revenue,
            sp.discounts AS total_discounts,
            sp.credit_count AS credit_count,
            sp.credit_amount AS credit_amount,
            rp.return_count AS return_count
        FROM sales_period sp CROSS JOIN returns_period rp
    """), {"start_dt": start_dt, "end_next": end_next}).first()

    # ── 2. Rentabilidad neta (ingreso/costo devuelto se reversa) ─────────────
    try:
        profit = db.execute(text(f"""
            WITH sales_profit AS (
                SELECT
                    COALESCE(SUM(sd.subtotal), 0)::numeric AS revenue,
                    COALESCE(SUM(sd.cost_at_sale * sd.quantity), 0)::numeric AS cost
                FROM {schema}.sale_details sd
                JOIN {schema}.sales s ON s.id = sd.sale_id
                WHERE s.date >= :start_dt AND s.date < :end_next
            ), return_profit AS (
                SELECT
                    COALESCE(SUM(rd.unit_price * rd.quantity), 0)::numeric AS refunds,
                    COALESCE(SUM(COALESCE(NULLIF(rd.unit_cost, 0), p.cost_price, 0) * rd.quantity), 0)::numeric AS returned_cost
                FROM {schema}.return_details rd
                JOIN {schema}.returns r ON r.id = rd.return_id
                LEFT JOIN {schema}.products p ON p.id = rd.product_id
                WHERE r.date >= :start_dt AND r.date < :end_next
            )
            SELECT
                (sp.revenue - rp.refunds) AS revenue,
                (sp.cost - rp.returned_cost) AS cost,
                sp.revenue AS gross_revenue,
                rp.refunds AS returns_amount,
                rp.returned_cost AS returned_cost
            FROM sales_profit sp CROSS JOIN return_profit rp
        """), {"start_dt": start_dt, "end_next": end_next}).first()
    except Exception as e:
        log.error(f"[dashboard-init] ERROR en profit query: {e}")
        profit = type('obj', (object,), {'revenue': 0, 'cost': 0, 'gross_revenue': 0, 'returns_amount': 0, 'returned_cost': 0})()

    revenue = _float(profit.revenue)
    cost    = _float(profit.cost)
    gross_profit = revenue - cost
    margin_pct   = (gross_profit / revenue * 100) if revenue > 0 else 0

    # ── 3. Top 5 productos netos ─────────────────────────────────────────────
    top_products = db.execute(text(f"""
        WITH sales_by_product AS (
            SELECT p.id AS product_id, p.name, SUM(sd.quantity)::numeric AS qty, SUM(sd.subtotal)::numeric AS revenue
            FROM {schema}.sale_details sd
            JOIN {schema}.products p ON p.id = sd.product_id
            JOIN {schema}.sales s ON s.id = sd.sale_id
            WHERE s.date >= :start_dt AND s.date < :end_next
            GROUP BY p.id, p.name
        ), returns_by_product AS (
            SELECT p.id AS product_id, p.name, SUM(rd.quantity)::numeric AS qty, SUM(rd.unit_price * rd.quantity)::numeric AS revenue
            FROM {schema}.return_details rd
            JOIN {schema}.returns r ON r.id = rd.return_id
            JOIN {schema}.products p ON p.id = rd.product_id
            WHERE r.date >= :start_dt AND r.date < :end_next
            GROUP BY p.id, p.name
        )
        SELECT
            COALESCE(s.product_id, r.product_id) AS product_id,
            COALESCE(s.name, r.name) AS name,
            COALESCE(s.qty, 0) - COALESCE(r.qty, 0) AS qty,
            COALESCE(s.revenue, 0) - COALESCE(r.revenue, 0) AS revenue
        FROM sales_by_product s
        FULL OUTER JOIN returns_by_product r ON r.product_id = s.product_id
        WHERE COALESCE(s.qty, 0) - COALESCE(r.qty, 0) <> 0
           OR COALESCE(s.revenue, 0) - COALESCE(r.revenue, 0) <> 0
        ORDER BY revenue DESC, qty DESC
        LIMIT 5
    """), {"start_dt": start_dt, "end_next": end_next}).all()

    # ── 4. Métodos de pago netos ─────────────────────────────────────────────
    payment_methods = db.execute(text(f"""
        WITH sales_methods AS (
            SELECT payment_method, COUNT(*)::numeric AS count, COALESCE(SUM(total_amount), 0)::numeric AS total
            FROM {schema}.sales
            WHERE date >= :start_dt AND date < :end_next
            GROUP BY payment_method
        ), return_methods AS (
            SELECT s.payment_method, COUNT(r.id)::numeric AS count, COALESCE(SUM(r.total_refunded), 0)::numeric AS total
            FROM {schema}.returns r
            JOIN {schema}.sales s ON s.id = r.sale_id
            WHERE r.date >= :start_dt AND r.date < :end_next
            GROUP BY s.payment_method
        )
        SELECT
            COALESCE(sm.payment_method, rm.payment_method, 'Sin método') AS payment_method,
            COALESCE(sm.count, 0) - COALESCE(rm.count, 0) AS count,
            COALESCE(sm.total, 0) - COALESCE(rm.total, 0) AS total,
            COALESCE(rm.total, 0) AS returns
        FROM sales_methods sm
        FULL OUTER JOIN return_methods rm ON COALESCE(rm.payment_method, '__NULL__') = COALESCE(sm.payment_method, '__NULL__')
        WHERE COALESCE(sm.total, 0) <> 0 OR COALESCE(rm.total, 0) <> 0
        ORDER BY total DESC
    """), {"start_dt": start_dt, "end_next": end_next}).all()

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
    prev_start_dt = datetime.combine(prev_from, datetime.min.time())
    prev_end_next = datetime.combine(prev_to + timedelta(days=1), datetime.min.time())

    prev_sales = db.execute(text(f"""
        WITH sales_period AS (
            SELECT COALESCE(COUNT(*), 0)::numeric AS count, COALESCE(SUM(total_amount), 0)::numeric AS revenue
            FROM {schema}.sales
            WHERE date >= :start_dt AND date < :end_next
        ), returns_period AS (
            SELECT COALESCE(COUNT(*), 0)::numeric AS count, COALESCE(SUM(total_refunded), 0)::numeric AS refunds
            FROM {schema}.returns
            WHERE date >= :start_dt AND date < :end_next
        )
        SELECT sp.count - rp.count AS count, sp.revenue - rp.refunds AS revenue
        FROM sales_period sp CROSS JOIN returns_period rp
    """), {"start_dt": prev_start_dt, "end_next": prev_end_next}).first()

    try:
        prev_profit = db.execute(text(f"""
            WITH sales_profit AS (
                SELECT
                    COALESCE(SUM(sd.subtotal), 0)::numeric AS revenue,
                    COALESCE(SUM(sd.cost_at_sale * sd.quantity), 0)::numeric AS cost
                FROM {schema}.sale_details sd
                JOIN {schema}.sales s ON s.id = sd.sale_id
                WHERE s.date >= :start_dt AND s.date < :end_next
            ), return_profit AS (
                SELECT
                    COALESCE(SUM(rd.unit_price * rd.quantity), 0)::numeric AS refunds,
                    COALESCE(SUM(COALESCE(NULLIF(rd.unit_cost, 0), p.cost_price, 0) * rd.quantity), 0)::numeric AS returned_cost
                FROM {schema}.return_details rd
                JOIN {schema}.returns r ON r.id = rd.return_id
                LEFT JOIN {schema}.products p ON p.id = rd.product_id
                WHERE r.date >= :start_dt AND r.date < :end_next
            )
            SELECT (sp.revenue - rp.refunds) AS revenue, (sp.cost - rp.returned_cost) AS cost
            FROM sales_profit sp CROSS JOIN return_profit rp
        """), {"start_dt": prev_start_dt, "end_next": prev_end_next}).first()
    except Exception as e:
        log.error(f"[dashboard-init] ERROR en previous profit query: {e}")
        prev_profit = type('obj', (object,), {'revenue': 0, 'cost': 0})()

    daily_rows = db.execute(text(f"""
        WITH sales_daily AS (
            SELECT s.date::date AS day,
                   COALESCE(SUM(s.total_amount), 0)::numeric AS revenue,
                   COALESCE(SUM(sc.cost), 0)::numeric AS cost
            FROM {schema}.sales s
            LEFT JOIN (
                SELECT sale_id, COALESCE(SUM(cost_at_sale * quantity), 0)::numeric AS cost
                FROM {schema}.sale_details
                GROUP BY sale_id
            ) sc ON sc.sale_id = s.id
            WHERE s.date >= :start_dt AND s.date < :end_next
            GROUP BY s.date::date
        ), returns_daily AS (
            SELECT r.date::date AS day,
                   COALESCE(SUM(r.total_refunded), 0)::numeric AS refunds,
                   COALESCE(SUM(rc.returned_cost), 0)::numeric AS returned_cost
            FROM {schema}.returns r
            LEFT JOIN (
                SELECT rd.return_id,
                       COALESCE(SUM(COALESCE(NULLIF(rd.unit_cost, 0), p.cost_price, 0) * rd.quantity), 0)::numeric AS returned_cost
                FROM {schema}.return_details rd
                LEFT JOIN {schema}.products p ON p.id = rd.product_id
                GROUP BY rd.return_id
            ) rc ON rc.return_id = r.id
            WHERE r.date >= :start_dt AND r.date < :end_next
            GROUP BY r.date::date
        )
        SELECT
            COALESCE(sd.day, rd.day) AS day,
            COALESCE(sd.revenue, 0) - COALESCE(rd.refunds, 0) AS revenue,
            COALESCE(sd.cost, 0) - COALESCE(rd.returned_cost, 0) AS cost
        FROM sales_daily sd
        FULL OUTER JOIN returns_daily rd ON rd.day = sd.day
        ORDER BY day
    """), {"start_dt": start_dt, "end_next": end_next}).all()

    result = {
        "period": {"from": str(d_from), "to": str(d_to)},
        "sales": {
            "count":          int(sales_summary.total_count or 0),
            "revenue":        _float(sales_summary.total_revenue),
            "gross_revenue":  _float(sales_summary.gross_revenue),
            "returns":        _float(sales_summary.returns_amount),
            "return_count":   int(sales_summary.return_count or 0),
            "discounts":      _float(sales_summary.total_discounts),
            "credit_count":   int(sales_summary.credit_count or 0),
            "credit_amount":  _float(sales_summary.credit_amount),
        },
        "profit": {
            "revenue":        revenue,
            "cost":           cost,
            "gross_profit":   gross_profit,
            "margin_pct":     round(margin_pct, 2),
            "gross_revenue":  _float(getattr(profit, "gross_revenue", revenue)),
            "returns":        _float(getattr(profit, "returns_amount", 0)),
            "returned_cost":  _float(getattr(profit, "returned_cost", 0)),
        },
        "vs_previous": {
            "sales_count":   int(prev_sales.count or 0),
            "sales_revenue": _float(prev_sales.revenue),
            "profit_revenue": _float(prev_profit.revenue),
            "profit_cost": _float(prev_profit.cost),
            "gross_profit": _float(prev_profit.revenue) - _float(prev_profit.cost),
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
            {"product_id": r.product_id, "name": r.name, "qty": _float(r.qty), "revenue": _float(r.revenue)}
            for r in top_products
        ],
        "payment_methods": [
            {"method": r.payment_method, "count": int(r.count or 0), "total": _float(r.total), "returns": _float(getattr(r, "returns", 0))}
            for r in payment_methods
        ],
        "low_stock": [
            {"name": r.name, "stock": _float(r.stock), "min_stock": _float(r.min_stock), "category": r.category}
            for r in low_stock
        ],
        "daily": [
            {
                "date": str(r.day),
                "revenue": _float(r.revenue),
                "gross_profit": _float(r.revenue) - _float(r.cost),
            }
            for r in daily_rows
        ],
    }

    # Cachear 30 segundos
    set_cached(schema, cache_key, result, ttl=30)
    return result
