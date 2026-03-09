from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import Optional
from datetime import datetime, date, timedelta
from decimal import Decimal
from ...database.db import get_db
from ...models import models
from ...dependencies import admin_only
from ...utils.payment_utils import normalize_payment_method, get_currency_symbol

router = APIRouter(dependencies=[Depends(admin_only)])


@router.get("/dashboard/cashflow")
def get_dashboard_cashflow(db: Session = Depends(get_db)):
    """
    Calculate physical cash balance by currency in open cash sessions

    Returns real money that should be in the cash drawer:
    - Initial cash from open sessions
    - + Sales income (from SalePayment)
    - + Deposits
    - - Expenses
    - - Withdrawals
    - - Returns/Refunds
    """
    # Get all active currencies from config
    active_currencies = db.query(models.Currency).filter(models.Currency.is_active == True).all()
    currency_codes = [c.symbol for c in active_currencies] if active_currencies else ['USD', 'Bs']

    # Get open cash sessions
    open_sessions = db.query(models.CashSession).filter(models.CashSession.status == "OPEN").all()

    if not open_sessions:
        # No open sessions, return zeros
        return {
            "balances": [{"currency": code, "initial": 0, "sales": 0, "expenses": 0, "net_balance": 0} for code in currency_codes],
            "alerts": ["No hay sesiones de caja abiertas"]
        }

    session_ids = [s.id for s in open_sessions]
    balances = {}
    alerts = []

    # Initialize balances for each currency
    for currency in currency_codes:
        balances[currency] = {
            "currency": currency,
            "initial": 0.0,
            "sales": 0.0,
            "expenses": 0.0,
            "net_balance": 0.0
        }

    # 1. Get initial cash from open sessions
    for session in open_sessions:
        # Check if session has multi-currency support
        if session.currencies:
            for curr in session.currencies:
                if curr.currency_symbol in balances:
                    balances[curr.currency_symbol]["initial"] += curr.initial_amount
        else:
            # Fallback to old dual-currency model
            balances["USD"]["initial"] += session.initial_cash or 0
            if "Bs" in balances:
                balances["Bs"]["initial"] += session.initial_cash_bs or 0

    sales_query = db.query(
        models.SalePayment.currency,
        func.sum(models.SalePayment.amount).label('total')
    ).join(models.Sale).filter(
        models.Sale.date >= open_sessions[0].start_time,  # Since first session opened
        # CRITICAL FIX: Only include payments made within the session window.
        # This handles "Abonos" correctly:
        # - If Abono was made TODAY (after session start), it's included.
        # - If Abono was made YESTERDAY, its payment_date < session_start, so it's EXCLUDED.
        models.SalePayment.payment_date >= open_sessions[0].start_time
    )

    sales_by_currency = sales_query.group_by(models.SalePayment.currency).all()

    for currency, total in sales_by_currency:
        if currency in balances:
            balances[currency]["sales"] += total

    # 3. Get cash movements (expenses, deposits, withdrawals, returns)
    movements = db.query(models.CashMovement).filter(
        models.CashMovement.session_id.in_(session_ids)
    ).all()

    for movement in movements:
        currency = movement.currency or "USD"
        if currency not in balances:
            continue

        if movement.type == "DEPOSIT":
            # Deposits are income
            balances[currency]["sales"] += movement.amount
        elif movement.type in ["EXPENSE", "WITHDRAWAL"]:
            # Expenses and withdrawals reduce cash
            balances[currency]["expenses"] -= movement.amount
        elif movement.type == "RETURN":
            # Returns are refunds (reduce cash)
            balances[currency]["expenses"] -= movement.amount

    # 4. Calculate net balance and check for alerts
    for currency_code, data in balances.items():
        data["net_balance"] = data["initial"] + data["sales"] + data["expenses"]

        # Alert if negative balance
        if data["net_balance"] < 0:
            alerts.append(f"Caja en {currency_code} tiene saldo negativo: {data['net_balance']:.2f} (Revisar)")

        # Round values
        data["initial"] = round(data["initial"], 2)
        data["sales"] = round(data["sales"], 2)
        data["expenses"] = round(data["expenses"], 2)
        data["net_balance"] = round(data["net_balance"], 2)

    # Convert to list and filter out currencies with no activity
    balance_list = [data for data in balances.values() if data["initial"] != 0 or data["sales"] != 0 or data["expenses"] != 0]

    # If no activity, show at least USD
    if not balance_list:
        balance_list = [balances["USD"]]

    return {
        "balances": balance_list,
        "alerts": alerts if alerts else []
    }


@router.get("/cash-flow")
def get_cash_flow_report(
    start_date: date,
    end_date: date,
    db: Session = Depends(get_db)
):
    """All cash movements in period"""
    start_dt = datetime.combine(start_date, datetime.min.time())
    if start_date == end_date:
        end_dt = datetime.combine(end_date + timedelta(days=1), datetime.min.time())
    else:
        end_dt = datetime.combine(end_date, datetime.max.time())

    # Get all cash sessions in period
    sessions = db.query(models.CashSession).filter(
        models.CashSession.start_time >= start_dt,
        models.CashSession.start_time <= end_dt
    ).all()

    movements = []
    for session in sessions:
        for mov in session.movements:
            movements.append({
                "date": mov.date.isoformat(),
                "session_id": session.id,
                "type": mov.type,
                "amount": mov.amount,
                "currency": mov.currency or "USD",
                "description": mov.description
            })

    # Also get sales
    sales = db.query(models.Sale).filter(
        models.Sale.date >= start_dt,
        models.Sale.date <= end_dt,
        models.Sale.is_credit == False
    ).all()

    for sale in sales:
        movements.append({
            "date": sale.date.isoformat(),
            "session_id": None,
            "type": "SALE",
            "amount": sale.total_amount,
            "currency": "USD",
            "description": f"Venta #{sale.id}"
        })

    # Sort by date
    movements.sort(key=lambda x: x["date"], reverse=True)

    return movements


@router.get("/daily-close")
def get_daily_close(
    date: date,
    db: Session = Depends(get_db)
):
    """
    Daily Closing Report (IMPROVED):
    - Normalized payment methods (consolidates variants)
    - Proper currency separation with symbols
    - Structured cash flow data
    - Cash reconciliation
    - Category sales breakdown
    """

    start_dt = datetime.combine(date, datetime.min.time())
    end_dt = datetime.combine(date, datetime.max.time())

    # 1. Query Sales by Payment Method (from SalePayment table for accuracy)
    sales_by_method_raw = db.query(
        models.SalePayment.payment_method,
        models.SalePayment.currency,
        func.sum(models.SalePayment.amount).label('total'),
        func.count(models.SalePayment.id).label('count')
    ).join(models.Sale).filter(
        models.Sale.date >= start_dt,
        models.Sale.date <= end_dt
    ).group_by(
        models.SalePayment.payment_method,
        models.SalePayment.currency
    ).all()

    # 2. Normalize and structure payment breakdown
    payment_breakdown = []
    total_revenue_usd = Decimal("0.00")
    total_revenue_ves = Decimal("0.00")
    total_sales_count = 0

    # Track cash sales for reconciliation
    cash_usd = Decimal("0.00")
    cash_ves = Decimal("0.00")

    for r in sales_by_method_raw:
        raw_method = r[0] or "N/A"
        currency = r[1] or "USD"
        amount = Decimal(str(r[2]))
        count = r[3]

        # Normalize method name
        normalized_method = normalize_payment_method(raw_method)

        # Get currency symbol
        symbol = get_currency_symbol(currency)

        # Normalize currency name
        currency_normalized = "VES" if symbol == "Bs" else "USD"

        payment_breakdown.append({
            "method": normalized_method,
            "currency": currency_normalized,
            "symbol": symbol,
            "amount": float(amount),
            "count": count
        })

        # Track totals
        total_sales_count += count
        if symbol == "Bs":
            total_revenue_ves += amount
            # Track cash for reconciliation
            if normalized_method == "Efectivo":
                cash_ves += amount
        else:
            total_revenue_usd += amount
            # Track cash for reconciliation
            if normalized_method == "Efectivo":
                cash_usd += amount

    # 3. Calculate change given
    total_change_query = db.query(
        func.sum(models.Sale.change_amount)
    ).filter(
        models.Sale.date >= start_dt,
        models.Sale.date <= end_dt
    ).scalar() or Decimal("0.00")

    # 4. Cash Reconciliation (try to get from cash session, otherwise estimate)
    # Find cash session for this date
    cash_session = db.query(models.CashSession).filter(
        models.CashSession.start_time >= start_dt,
        models.CashSession.start_time <= end_dt
    ).first()

    cash_reconciliation = {
        "usd": {
            "inbound": float(cash_usd),
            "outbound": 0.00,
            "expected_in_drawer": float(cash_usd)
        },
        "ves": {
            "inbound": float(cash_ves),
            "outbound": 0.00,
            "expected_in_drawer": float(cash_ves)
        }
    }

    # If we have a cash session, use its data
    if cash_session:
        # Query movements for this session
        movements = db.query(models.CashMovement).filter(
            models.CashMovement.session_id == cash_session.id
        ).all()

        # Calculate movements
        deposits_usd = sum(
            (Decimal(str(m.amount)) for m in movements
             if m.type == "DEPOSIT" and m.currency == "USD"),
            Decimal("0.00")
        )
        expenses_usd = sum(
            (Decimal(str(m.amount)) for m in movements
             if m.type in ["EXPENSE", "WITHDRAWAL", "OUT"] and m.currency == "USD"),
            Decimal("0.00")
        )

        deposits_ves = sum(
            (Decimal(str(m.amount)) for m in movements
             if m.type == "DEPOSIT" and m.currency in ["VES", "Bs", "VEF"]),
            Decimal("0.00")
        )
        expenses_ves = sum(
            (Decimal(str(m.amount)) for m in movements
             if m.type in ["EXPENSE", "WITHDRAWAL", "OUT"] and m.currency in ["VES", "Bs", "VEF"]),
            Decimal("0.00")
        )

        initial_usd = Decimal(str(cash_session.initial_cash or 0))
        initial_ves = Decimal(str(cash_session.initial_cash_bs or 0))

        cash_reconciliation = {
            "usd": {
                "initial": float(initial_usd),
                "inbound": float(cash_usd + deposits_usd),
                "outbound": float(expenses_usd),
                "expected_in_drawer": float(initial_usd + cash_usd + deposits_usd - expenses_usd)
            },
            "ves": {
                "initial": float(initial_ves),
                "inbound": float(cash_ves + deposits_ves),
                "outbound": float(expenses_ves),
                "expected_in_drawer": float(initial_ves + cash_ves + deposits_ves - expenses_ves)
            }
        }

    # 5. Query Category Sales Breakdown
    category_sales = db.query(
        models.Category.name.label('category_name'),
        func.sum(models.SaleDetail.subtotal).label('total_usd'),
        func.count(models.SaleDetail.id).label('count')
    ).join(
        models.Product, models.SaleDetail.product_id == models.Product.id
    ).outerjoin(
        models.Category, models.Product.category_id == models.Category.id
    ).join(
        models.Sale, models.SaleDetail.sale_id == models.Sale.id
    ).filter(
        models.Sale.date >= start_dt,
        models.Sale.date <= end_dt
    ).group_by(
        models.Category.name
    ).all()

    # Build category breakdown
    category_breakdown = []
    for cat in category_sales:
        category_breakdown.append({
            "category": cat.category_name or "Sin Categoría",
            "total_usd": float(cat.total_usd or 0),
            "count": cat.count
        })

    # Sort by revenue (highest first)
    category_breakdown.sort(key=lambda x: x["total_usd"], reverse=True)

    # 6. Build structured response
    return {
        "date": date.isoformat(),
        "summary": {
            "total_sales_count": total_sales_count,
            "total_revenue_usd": float(total_revenue_usd),
            "total_revenue_ves": float(total_revenue_ves)
        },
        "payment_breakdown": payment_breakdown,
        "category_breakdown": category_breakdown,
        "cash_reconciliation": cash_reconciliation,
        "total_change_given": float(total_change_query),
        "system_status": "OK"
    }
