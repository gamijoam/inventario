from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import Optional
from datetime import datetime, date, timedelta
from decimal import Decimal
from ...database.db import get_db
from ...models import models
from ...dependencies import require_any_permission
from ...utils.payment_utils import normalize_payment_method, get_currency_symbol

router = APIRouter(dependencies=[Depends(require_any_permission([
    "reports.view",
    "cash.audit.view",
    "sales.credits.view",
]))])


@router.get("/credits/summary")
def get_credits_summary(db: Session = Depends(get_db)):
    """
    Global summary of ALL pending credits (accounts receivable).
    Not date-filtered — returns totals across all time.
    Used by the Dashboard for the KPI and Cuentas por Cobrar widget.
    """
    pending_sales = db.query(models.Sale).filter(
        models.Sale.is_credit == True,
        models.Sale.paid == False,
        models.Sale.balance_pending > 0
    ).all()

    total_pending_usd = sum(float(s.balance_pending or 0) for s in pending_sales)
    pending_count = len(pending_sales)

    # Convert to Bs using default exchange rate
    default_rate = db.query(models.ExchangeRate).filter(
        models.ExchangeRate.is_active == True,
        models.ExchangeRate.is_default == True
    ).first()
    rate_value = float(default_rate.rate) if default_rate else 0.0
    total_pending_bs = total_pending_usd * rate_value

    return {
        "total_pending_usd": round(total_pending_usd, 2),
        "total_pending_bs": round(total_pending_bs, 2),
        "pending_count": pending_count,
        "exchange_rate": rate_value
    }


@router.get("/dashboard/cashflow")
def get_dashboard_cashflow(db: Session = Depends(get_db)):
    """
    Physical cash balance by currency across open cash sessions.
    Uses the same reconciliation rules as cash closing: session-linked cash sales,
    Payment-only CxC cash receipts, deposits, returns, advances and withdrawals.
    """
    active_currencies = db.query(models.Currency).filter(models.Currency.is_active == True).all()
    raw_currency_codes = [c.symbol for c in active_currencies] if active_currencies else ['USD', 'Bs']
    currency_codes = []
    for code in raw_currency_codes:
        normalized = 'VES' if str(code).upper() in ['BS', 'VES', 'VEF'] else (code or 'USD')
        if normalized not in currency_codes:
            currency_codes.append(normalized)

    open_sessions = db.query(models.CashSession).filter(models.CashSession.status == "OPEN").all()
    if not open_sessions:
        return {
            "balances": [{"currency": code, "initial": 0, "sales": 0, "expenses": 0, "net_balance": 0} for code in currency_codes],
            "alerts": ["No hay sesiones de caja abiertas"]
        }

    def _currency_key(value):
        curr = value or "USD"
        if str(curr).upper() in ["BS", "VES", "VEF"]:
            return "VES"
        if curr in ("$", ""):
            return "USD"
        return curr

    def _is_cash_method(method):
        text = (method or "").lower()
        return "efectivo" in text or "cash" in text or "divisa" in text

    def _matching_currencies(currency):
        return ["Bs", "VES", "VEF"] if str(currency or "").upper() in ["BS", "VES", "VEF"] else [currency or "USD"]

    def _has_matching_deposit(session_id, currency, amount):
        return db.query(models.CashMovement.id).filter(
            models.CashMovement.session_id == session_id,
            models.CashMovement.type.in_(["DEPOSIT", "IN"]),
            models.CashMovement.currency.in_(_matching_currencies(currency)),
            models.CashMovement.amount == amount,
            (models.CashMovement.description.ilike("%abono%") |
             models.CashMovement.description.ilike("%cxc%") |
             models.CashMovement.description.ilike("%cuenta%"))
        ).first() is not None

    session_ids = [s.id for s in open_sessions]
    balances = {}
    alerts = []
    for currency in currency_codes:
        balances[currency] = {
            "currency": currency,
            "initial": 0.0,
            "sales": 0.0,
            "expenses": 0.0,
            "net_balance": 0.0
        }
    for session in open_sessions:
        balances.setdefault("USD", {"currency": "USD", "initial": 0.0, "sales": 0.0, "expenses": 0.0, "net_balance": 0.0})
        balances["USD"]["initial"] += float(session.initial_cash or 0)
        if "VES" in balances:
            balances["VES"]["initial"] += float(session.initial_cash_bs or 0)

    sales_rows = db.query(
        models.SalePayment.currency,
        func.sum(models.SalePayment.amount).label('total')
    ).join(models.Sale).filter(
        models.Sale.session_id.in_(session_ids),
        (models.SalePayment.payment_method.ilike("%efectivo%") |
         models.SalePayment.payment_method.ilike("%cash%") |
         models.SalePayment.payment_method.ilike("%divisa%"))
    ).group_by(models.SalePayment.currency).all()

    for currency, total in sales_rows:
        key = _currency_key(currency)
        if key in balances:
            balances[key]["sales"] += float(total or 0)

    debt_payments = db.query(models.Payment).filter(models.Payment.session_id.in_(session_ids)).all()
    for payment in debt_payments:
        if not _is_cash_method(payment.payment_method):
            continue
        key = _currency_key(payment.currency)
        if key not in balances:
            continue
        amount = payment.amount or Decimal("0.00")
        if not _has_matching_deposit(payment.session_id, payment.currency, amount):
            balances[key]["sales"] += float(amount)

    movements = db.query(models.CashMovement).filter(models.CashMovement.session_id.in_(session_ids)).all()
    for movement in movements:
        key = _currency_key(movement.currency)
        if key not in balances:
            continue
        amount = float(movement.amount or 0)
        if movement.type in ["DEPOSIT", "IN"]:
            balances[key]["sales"] += amount
        elif movement.type in ["EXPENSE", "WITHDRAWAL", "OUT", "RETURN", "CASH_ADVANCE"]:
            balances[key]["expenses"] -= amount

    change_rows = db.query(models.Sale.change_currency, func.sum(models.Sale.change_amount)).filter(
        models.Sale.session_id.in_(session_ids),
        models.Sale.change_amount > 0
    ).group_by(models.Sale.change_currency).all()
    for currency, amount in change_rows:
        key = _currency_key(currency)
        if key in balances:
            balances[key]["expenses"] -= float(amount or 0)

    for currency_code, data in balances.items():
        data["net_balance"] = data["initial"] + data["sales"] + data["expenses"]
        if data["net_balance"] < 0:
            alerts.append(f"Caja en {currency_code} tiene saldo negativo: {data['net_balance']:.2f} (Revisar)")
        data["initial"] = round(data["initial"], 2)
        data["sales"] = round(data["sales"], 2)
        data["expenses"] = round(data["expenses"], 2)
        data["net_balance"] = round(data["net_balance"], 2)

    balance_list = [data for data in balances.values() if data["initial"] != 0 or data["sales"] != 0 or data["expenses"] != 0]
    if not balance_list:
        balance_list = [balances.get("USD", {"currency": "USD", "initial": 0, "sales": 0, "expenses": 0, "net_balance": 0})]

    return {"balances": balance_list, "alerts": alerts if alerts else []}


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
    Daily Closing Report aligned with cash-session reconciliation.
    Aggregates all sessions that touch the day and separates physical cash from digital methods.
    """

    start_dt = datetime.combine(date, datetime.min.time())
    end_dt = datetime.combine(date + timedelta(days=1), datetime.min.time())

    def _currency_key(value):
        curr = value or "USD"
        if str(curr).upper() in ["BS", "VES", "VEF"]:
            return "VES"
        if curr in ("$", ""):
            return "USD"
        return curr

    def _is_cash_method(method):
        text = (method or "").lower()
        return "efectivo" in text or "cash" in text or "divisa" in text

    def _matching_currencies(currency):
        return ["Bs", "VES", "VEF"] if str(currency or "").upper() in ["BS", "VES", "VEF"] else [currency or "USD"]

    sales_by_method_raw = db.query(
        models.SalePayment.payment_method,
        models.SalePayment.currency,
        func.sum(models.SalePayment.amount).label('total'),
        func.count(models.SalePayment.id).label('count')
    ).join(models.Sale).filter(
        models.Sale.date >= start_dt,
        models.Sale.date < end_dt
    ).group_by(
        models.SalePayment.payment_method,
        models.SalePayment.currency
    ).all()

    payment_breakdown = []
    total_revenue_usd = Decimal("0.00")
    total_revenue_ves = Decimal("0.00")
    total_sales_count = 0
    cash_by_currency = {"USD": Decimal("0.00"), "VES": Decimal("0.00")}

    for raw_method, raw_currency, raw_total, count in sales_by_method_raw:
        raw_method = raw_method or "N/A"
        currency_key = _currency_key(raw_currency)
        amount = Decimal(str(raw_total or 0))
        normalized_method = normalize_payment_method(raw_method)
        symbol = get_currency_symbol(raw_currency or "USD")

        payment_breakdown.append({
            "method": normalized_method,
            "currency": currency_key,
            "symbol": symbol,
            "amount": float(amount),
            "count": count
        })

        total_sales_count += count
        if currency_key == "VES":
            total_revenue_ves += amount
        elif currency_key == "USD":
            total_revenue_usd += amount

        if _is_cash_method(raw_method):
            cash_by_currency[currency_key] = cash_by_currency.get(currency_key, Decimal("0.00")) + amount

    sessions = db.query(models.CashSession).filter(
        models.CashSession.start_time < end_dt,
        func.coalesce(models.CashSession.end_time, datetime.now()) >= start_dt
    ).all()
    session_ids = [s.id for s in sessions]

    movements = []
    if session_ids:
        movements = db.query(models.CashMovement).filter(models.CashMovement.session_id.in_(session_ids)).all()

    deposits = {"USD": Decimal("0.00"), "VES": Decimal("0.00")}
    outbound = {"USD": Decimal("0.00"), "VES": Decimal("0.00")}
    returns = {"USD": Decimal("0.00"), "VES": Decimal("0.00")}
    cash_advances = {"USD": Decimal("0.00"), "VES": Decimal("0.00")}

    for movement in movements:
        currency_key = _currency_key(movement.currency)
        if currency_key not in deposits:
            deposits[currency_key] = Decimal("0.00")
            outbound[currency_key] = Decimal("0.00")
            returns[currency_key] = Decimal("0.00")
            cash_advances[currency_key] = Decimal("0.00")
        amount = Decimal(str(movement.amount or 0))
        if movement.type in ["DEPOSIT", "IN"]:
            deposits[currency_key] += amount
        elif movement.type in ["EXPENSE", "WITHDRAWAL", "OUT", "RETURN", "CASH_ADVANCE"]:
            outbound[currency_key] += amount
            if movement.type == "RETURN":
                returns[currency_key] += amount
            if movement.type == "CASH_ADVANCE":
                cash_advances[currency_key] += amount

    if session_ids:
        debt_payments = db.query(models.Payment).filter(models.Payment.session_id.in_(session_ids)).all()
        for payment in debt_payments:
            if not _is_cash_method(payment.payment_method):
                continue
            currency_key = _currency_key(payment.currency)
            amount = Decimal(str(payment.amount or 0))
            matching_deposit = db.query(models.CashMovement.id).filter(
                models.CashMovement.session_id == payment.session_id,
                models.CashMovement.type.in_(["DEPOSIT", "IN"]),
                models.CashMovement.currency.in_(_matching_currencies(payment.currency)),
                models.CashMovement.amount == amount,
                (models.CashMovement.description.ilike("%abono%") |
                 models.CashMovement.description.ilike("%cxc%") |
                 models.CashMovement.description.ilike("%cuenta%"))
            ).first()
            if not matching_deposit:
                deposits[currency_key] = deposits.get(currency_key, Decimal("0.00")) + amount

        layaway_payments = db.query(models.LayawayPayment).filter(
            models.LayawayPayment.session_id.in_(session_ids),
            models.LayawayPayment.status == "APPLIED",
        ).all()
        for payment in layaway_payments:
            method = f"{normalize_payment_method(payment.payment_method or 'Sin metodo')} (Apartado)"
            currency_key = _currency_key(payment.currency)
            amount = Decimal(str(payment.amount or 0))
            symbol = get_currency_symbol(payment.currency or "USD")
            payment_breakdown.append({
                "method": method,
                "currency": currency_key,
                "symbol": symbol,
                "amount": float(amount),
                "count": 1,
            })
            if _is_cash_method(payment.payment_method):
                cash_by_currency[currency_key] = cash_by_currency.get(currency_key, Decimal("0.00")) + amount

    change = {"USD": Decimal("0.00"), "VES": Decimal("0.00")}
    change_rows = db.query(models.Sale.change_currency, func.sum(models.Sale.change_amount)).filter(
        models.Sale.date >= start_dt,
        models.Sale.date < end_dt,
        models.Sale.change_amount > 0
    ).group_by(models.Sale.change_currency).all()
    for currency, amount in change_rows:
        change[_currency_key(currency)] = change.get(_currency_key(currency), Decimal("0.00")) + Decimal(str(amount or 0))

    initial = {"USD": Decimal("0.00"), "VES": Decimal("0.00")}
    reported = {"USD": Decimal("0.00"), "VES": Decimal("0.00")}
    for session in sessions:
        initial["USD"] += Decimal(str(session.initial_cash or 0))
        initial["VES"] += Decimal(str(session.initial_cash_bs or 0))
        reported["USD"] += Decimal(str(session.final_cash_reported or 0))
        reported["VES"] += Decimal(str(session.final_cash_reported_bs or 0))

    def _recon(currency_key):
        expected = (
            initial.get(currency_key, Decimal("0.00"))
            + cash_by_currency.get(currency_key, Decimal("0.00"))
            + deposits.get(currency_key, Decimal("0.00"))
            - outbound.get(currency_key, Decimal("0.00"))
            - change.get(currency_key, Decimal("0.00"))
        )
        return {
            "initial": float(initial.get(currency_key, Decimal("0.00"))),
            "cash_sales": float(cash_by_currency.get(currency_key, Decimal("0.00"))),
            "deposits": float(deposits.get(currency_key, Decimal("0.00"))),
            "returns": float(returns.get(currency_key, Decimal("0.00"))),
            "cash_advances": float(cash_advances.get(currency_key, Decimal("0.00"))),
            "outbound": float(outbound.get(currency_key, Decimal("0.00"))),
            "change": float(change.get(currency_key, Decimal("0.00"))),
            "expected_in_drawer": float(expected),
            "reported": float(reported.get(currency_key, Decimal("0.00"))),
            "difference": float(reported.get(currency_key, Decimal("0.00")) - expected),
        }

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
        models.Sale.date < end_dt
    ).group_by(
        models.Category.name
    ).all()

    category_breakdown = [
        {"category": cat.category_name or "Sin Categoría", "total_usd": float(cat.total_usd or 0), "count": cat.count}
        for cat in category_sales
    ]
    category_breakdown.sort(key=lambda x: x["total_usd"], reverse=True)

    return {
        "date": date.isoformat(),
        "summary": {
            "total_sales_count": total_sales_count,
            "total_revenue_usd": float(total_revenue_usd),
            "total_revenue_ves": float(total_revenue_ves),
            "sessions_count": len(sessions),
        },
        "payment_breakdown": payment_breakdown,
        "category_breakdown": category_breakdown,
        "cash_reconciliation": {
            "usd": _recon("USD"),
            "ves": _recon("VES"),
        },
        "total_change_given": float(sum(change.values(), Decimal("0.00"))),
        "system_status": "OK"
    }

