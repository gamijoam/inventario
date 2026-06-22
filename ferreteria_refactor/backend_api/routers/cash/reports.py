"""
cash/reports.py — Reportes, historial y cierre Z de caja.

Responsabilidades:
  - Historial de sesiones con fechas y desglose — GET /sessions/history
  - Detalles de sesión (pre-cierre Z) — GET /sessions/{id}/details
  - Payload para reimpresión del reporte Z — GET /sessions/{id}/z-report-payload
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, or_, and_
from typing import Optional
from datetime import datetime, date, timedelta
from decimal import Decimal
import logging

from ...database.db import get_db
from ...dependencies import get_current_active_user, require_permission, require_any_permission
from ...models import models
from ... import schemas
from ...services.cash_reconciliation_service import CashReconciliationService

logger = logging.getLogger(__name__)

router = APIRouter()


# ============================================================
#  ENDPOINTS
# ============================================================

@router.get("/sessions/history", dependencies=[Depends(require_permission("cash.audit.view"))])
def get_sessions_history(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """
    Get cash session history with optional date filtering.
    Returns all sessions (OPEN and CLOSED) with their closure details and multi-currency info.
    """
    query = db.query(models.CashSession).options(
        joinedload(models.CashSession.currencies),
        joinedload(models.CashSession.user),
        joinedload(models.CashSession.register)
    )

    # Apply date filters if provided
    if start_date:
        start_dt = datetime.combine(start_date, datetime.min.time())
        query = query.filter(models.CashSession.start_time >= start_dt)

    if end_date:
        # Extend end_date by +1 day for same-day queries (consistent with sales_report)
        if start_date and end_date and start_date == end_date:
            end_dt = datetime.combine(end_date + timedelta(days=1), datetime.min.time())
        else:
            end_dt = datetime.combine(end_date, datetime.max.time())
        query = query.filter(models.CashSession.start_time <= end_dt)

    # Order by most recent first
    sessions = query.order_by(models.CashSession.start_time.desc()).all()

    # Format response with calculated fields
    result = []

    # Pre-fetch anchor currency symbol for is_anchor flag in response
    anchor_currency = db.query(models.Currency).filter(
        models.Currency.is_anchor == True,
        models.Currency.is_active == True
    ).first()
    anchor_symbol = anchor_currency.symbol if anchor_currency else "$"

    # Pre-fetch for performance?
    # For now, we do it in loop (30 queries max usually). Optimize later if needed.
    from ...utils.financials import get_session_payment_breakdown

    for session in sessions:
        # Calculate Breakdown
        breakdown_raw = get_session_payment_breakdown(db, session)

        # Format breakdown for JSON (Decimal -> float)
        breakdown_formatted = []
        for method, currencies in breakdown_raw.items():
            for curr, amt in currencies.items():
                if amt > 0:
                    breakdown_formatted.append({
                        "method": method,
                        "currency": curr,
                        "amount": float(amt)
                    })

        session_dict = {
            "id": session.id,
            "user_id": session.user_id,
            "start_time": session.start_time.isoformat() if session.start_time else None,
            "end_time": session.end_time.isoformat() if session.end_time else None,
            "opened_at": session.start_time.isoformat() if session.start_time else None,  # Alias
            "closed_at": session.end_time.isoformat() if session.end_time else None,  # Alias
            "status": session.status,
            "initial_cash": float(session.initial_cash) if session.initial_cash else 0.0,
            "initial_cash_bs": float(session.initial_cash_bs) if session.initial_cash_bs else 0.0,
            "final_cash_reported": float(session.final_cash_reported) if session.final_cash_reported else 0.0,
            "final_cash_reported_bs": float(session.final_cash_reported_bs) if session.final_cash_reported_bs else 0.0,
            "final_cash_expected": float(session.final_cash_expected) if session.final_cash_expected else 0.0,
            "final_cash_expected_bs": float(session.final_cash_expected_bs) if session.final_cash_expected_bs else 0.0,
            "difference": float(session.difference) if session.difference else 0.0,
            "difference_bs": float(session.difference_bs) if session.difference_bs else 0.0,
            "user": {
                "id": session.user.id,
                "username": session.user.username,
                "full_name": session.user.full_name
            } if session.user else None,
            "register": {
                "id": session.register.id,
                "name": session.register.name,
                "code": session.register.code
            } if session.register else None,
            "currencies": [
                {
                    "id": curr.id,
                    "currency_symbol": curr.currency_symbol,
                    "is_anchor": curr.currency_symbol == anchor_symbol,
                    "initial_amount": float(curr.initial_amount) if curr.initial_amount else 0.0,
                    "final_reported": float(curr.final_reported) if curr.final_reported else 0.0,
                    "final_expected": float(curr.final_expected) if curr.final_expected else 0.0,
                    "difference": float(curr.difference) if curr.difference else 0.0
                }
                for curr in session.currencies
            ] if session.currencies else [],

            # THE NEW FIELD
            "payment_breakdown": breakdown_formatted
        }
        result.append(session_dict)

    return result


@router.get("/sessions/{session_id}/audit-report", dependencies=[Depends(require_permission("cash.audit.view"))])
def get_session_audit_report(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """
    Read-only transaction ledger for a cash session.

    This endpoint does not mutate close totals. It centralizes the cash audit
    source of truth for the future closing UI and PDF report.
    """
    report = CashReconciliationService.build_session_audit(db, session_id)
    if not report:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")
    return report


@router.get("/sessions/{session_id}/details", response_model=schemas.CashSessionCloseResponse, dependencies=[Depends(require_any_permission(["cash.audit.view", "cash.close.blind"]))])
def get_session_details(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    session = db.query(models.CashSession).filter(models.CashSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")

    # 1. Calculate Sales Totals
    sales_query = db.query(models.SalePayment).join(models.Sale).filter(
        or_(
            models.Sale.session_id == session.id,
            and_(
                models.Sale.session_id.is_(None),
                models.Sale.date >= session.start_time,
                models.Sale.date <= (session.end_time or datetime.now()),
            )
        )
    )

    # 2. Get Movements
    movements = db.query(models.CashMovement).filter(models.CashMovement.session_id == session.id).all()

    # Initialize totals
    sales_total_usd = Decimal("0.00")
    sales_total_bs = Decimal("0.00")

    sales_by_method = {}  # e.g. {"CASH": {"USD": 10, "BS": 500}, "CARD": ...}

    payments = sales_query.all()

    for p in payments:
        curr = p.currency
        method = p.payment_method
        amt = p.amount  # Already Decimal from DB

        if method not in sales_by_method:
            sales_by_method[method] = {}

        # Initialize currency in method if not exists
        if curr not in sales_by_method[method]:
            sales_by_method[method][curr] = Decimal("0.00")

        # Accumulate by actual currency
        sales_by_method[method][curr] += amt

        # Also track total by currency (for backward compatibility)
        if curr and curr.upper() in ["BS", "VES", "VEF"]:
            sales_total_bs += amt
        elif curr in ("USD", "$", None, ""):
            sales_total_usd += amt
        # Other currencies (COP, etc.) are intentionally excluded from legacy USD/Bs buckets

    # 1.5 Get Debt Payments (Abonos) linked to this session
    debt_payments = db.query(models.Payment).filter(models.Payment.session_id == session.id).all()
    debt_payments_total_usd = Decimal("0.00")
    debt_payments_total_bs = Decimal("0.00")

    def _currency_key(value):
        curr = value or "USD"
        if curr.upper() in ["BS", "VES", "VEF"]:
            return "Bs"
        if curr in ("$", ""):
            return "USD"
        return curr

    def _has_matching_debt_deposit(dp):
        dp_amount = Decimal(str(dp.amount or 0))
        dp_currency = _currency_key(dp.currency)
        for movement in movements:
            if movement.type not in ["DEPOSIT", "IN"]:
                continue
            if _currency_key(movement.currency) != dp_currency:
                continue
            if Decimal(str(movement.amount or 0)) != dp_amount:
                continue
            description = (movement.description or "").lower()
            if "abono" in description or "cxc" in description or "cuenta" in description:
                return True
        return False

    # Add Debt Payments only if they don't already have a cash movement.
    # Newer CxC flow writes Payment + CashMovement(DEPOSIT); counting both doubles caja.
    for dp in debt_payments:
        if _has_matching_debt_deposit(dp):
            continue
        curr = dp.currency
        method = dp.payment_method  # "Efectivo", "Zelle", etc.
        amt = dp.amount

        # Normalize method name for consistency
        method_key = f"{method} (Abono)"

        if method_key not in sales_by_method:
            sales_by_method[method_key] = {}

        if curr not in sales_by_method[method_key]:
            sales_by_method[method_key][curr] = Decimal("0.00")

        sales_by_method[method_key][curr] += amt

        # For legacy totals, we might want to separate or merge?
        # Merging ensures "Total IN" is correct.
        if curr and curr.upper() in ["BS", "VES", "VEF"]:
            debt_payments_total_bs += amt
            sales_total_bs += amt  # Add to global total for simplicity
        else:
            debt_payments_total_usd += amt
            sales_total_usd += amt

    # 1.6 Get Layaway Payments (Apartados) linked to this session.
    layaway_payments = db.query(models.LayawayPayment).filter(
        models.LayawayPayment.session_id == session.id,
        models.LayawayPayment.status == "APPLIED",
    ).all()
    layaway_payments_total_usd = Decimal("0.00")
    layaway_payments_total_bs = Decimal("0.00")

    for lp in layaway_payments:
        curr = lp.currency
        method = lp.payment_method or "Sin metodo"
        amt = lp.amount or Decimal("0.00")
        method_key = f"{method} (Apartado)"

        if method_key not in sales_by_method:
            sales_by_method[method_key] = {}
        if curr not in sales_by_method[method_key]:
            sales_by_method[method_key][curr] = Decimal("0.00")
        sales_by_method[method_key][curr] += amt

        if curr and curr.upper() in ["BS", "VES", "VEF"]:
            layaway_payments_total_bs += amt
            sales_total_bs += amt
        else:
            layaway_payments_total_usd += amt
            sales_total_usd += amt

    # Calculate Movements
    # Separate Expenses from Cash Advances and Returns
    expenses_usd = sum((m.amount for m in movements if m.type in ["EXPENSE", "WITHDRAWAL", "OUT"] and (m.currency or "USD") == "USD"), Decimal("0.00"))
    expenses_bs = sum((m.amount for m in movements if m.type in ["EXPENSE", "WITHDRAWAL", "OUT"] and ((m.currency or "USD").upper() in ["BS", "VES", "VEF"])), Decimal("0.00"))

    returns_usd = sum((m.amount for m in movements if m.type == "RETURN" and (m.currency or "USD") == "USD"), Decimal("0.00"))
    returns_bs = sum((m.amount for m in movements if m.type == "RETURN" and ((m.currency or "USD").upper() in ["BS", "VES", "VEF"])), Decimal("0.00"))

    cash_advances_usd = sum((m.amount for m in movements if m.type == "CASH_ADVANCE" and (m.currency or "USD") == "USD"), Decimal("0.00"))
    cash_advances_bs = sum((m.amount for m in movements if m.type == "CASH_ADVANCE" and ((m.currency or "USD").upper() in ["BS", "VES", "VEF"])), Decimal("0.00"))

    deposits_usd = sum((m.amount for m in movements if m.type in ["DEPOSIT", "IN"] and (m.currency or "USD") == "USD"), Decimal("0.00"))
    deposits_bs = sum((m.amount for m in movements if m.type in ["DEPOSIT", "IN"] and ((m.currency or "USD").upper() in ["BS", "VES", "VEF"])), Decimal("0.00"))

    # Calculate Expected Cash (Only Cash payments affect the drawer)
    # Load external financer method names to EXCLUDE them from cash calculation
    external_financer_names = set(
        m.name.lower() for m in db.query(models.PaymentMethod).filter(
            models.PaymentMethod.is_external_financer == True
        ).all()
    )

    cash_by_currency = {}  # Track cash sales by currency

    for method_name in sales_by_method:
        # Exclude external financers (Cashea, Krece, etc.) even if name contains "cash"
        if method_name.lower() in external_financer_names:
            continue
        # Flexible check: if "efectivo", "cash" or "divisa" is in the name (case-insensitive)
        if "efectivo" in method_name.lower() or "cash" in method_name.lower() or "divisa" in method_name.lower():
            for curr, amt in sales_by_method[method_name].items():
                # Normalize currency key: Bs/VES/VEF → "Bs", USD/$/<empty> → "USD", others (COP…) → own key
                curr_key = (
                    "Bs" if curr and curr.upper() in ["BS", "VES", "VEF"]
                    else "USD" if curr in ("USD", "$", None, "")
                    else curr
                )
                cash_by_currency[curr_key] = cash_by_currency.get(curr_key, Decimal("0.00")) + amt

    # Legacy USD/Bs for backward compatibility
    cash_sales_usd = cash_by_currency.get("USD", Decimal("0.00"))
    cash_sales_bs = Decimal("0.00")
    for curr in ["Bs", "VES", "VEF"]:
        cash_sales_bs += cash_by_currency.get(curr, Decimal("0.00"))

    # Calculate Change (Vuelto) totals

    total_change_usd = db.query(func.sum(models.Sale.change_amount)).filter(
        or_(
            models.Sale.session_id == session.id,
            and_(models.Sale.session_id.is_(None), models.Sale.date >= session.start_time, models.Sale.date <= (session.end_time or datetime.now()))
        ),
        models.Sale.change_currency == "USD"
    ).scalar() or Decimal("0.00")

    total_change_bs = db.query(func.sum(models.Sale.change_amount)).filter(
        or_(
            models.Sale.session_id == session.id,
            and_(models.Sale.session_id.is_(None), models.Sale.date >= session.start_time, models.Sale.date <= (session.end_time or datetime.now()))
        ),
        models.Sale.change_currency.in_(["Bs", "VES", "VEF"])
    ).scalar() or Decimal("0.00")

    # Expenses, Returns AND Cash Advances reduce expected cash
    expected_usd = session.initial_cash + cash_sales_usd + deposits_usd - expenses_usd - returns_usd - cash_advances_usd - total_change_usd
    expected_bs = session.initial_cash_bs + cash_sales_bs + deposits_bs - expenses_bs - returns_bs - cash_advances_bs - total_change_bs

    final_reported_usd = session.final_cash_reported or Decimal("0.00")
    final_reported_bs = session.final_cash_reported_bs or Decimal("0.00")

    # Build per-currency movement dicts for non-USD/Bs currencies (e.g. COP)
    def _norm_key(c):
        """Return normalized currency key matching cash_by_currency keys."""
        if c and c.upper() in ["BS", "VES", "VEF"]:
            return "Bs"
        if c in ("USD", "$", None, ""):
            return "USD"
        return c

    initial_by_currency = {"USD": session.initial_cash or Decimal("0.00"), "Bs": session.initial_cash_bs or Decimal("0.00")}
    # Multi-currency initial amounts from CashSessionCurrency rows (if present)
    if session.currencies:
        for sc in session.currencies:
            k = _norm_key(sc.currency_symbol)
            initial_by_currency[k] = initial_by_currency.get(k, Decimal("0.00")) + (sc.initial_amount or Decimal("0.00"))

    change_by_currency = {"USD": total_change_usd, "Bs": total_change_bs}
    deposits_by_currency = {"USD": deposits_usd, "Bs": deposits_bs}
    expenses_by_currency = {"USD": expenses_usd + returns_usd + cash_advances_usd,
                             "Bs": expenses_bs + returns_bs + cash_advances_bs}

    for m in movements:
        k = _norm_key(m.currency)
        if k in ("USD", "Bs"):
            continue  # Already handled in legacy buckets
        if m.type in ["DEPOSIT", "IN"]:
            deposits_by_currency[k] = deposits_by_currency.get(k, Decimal("0.00")) + m.amount
        elif m.type in ["EXPENSE", "WITHDRAWAL", "OUT", "RETURN", "CASH_ADVANCE"]:
            expenses_by_currency[k] = expenses_by_currency.get(k, Decimal("0.00")) + m.amount

    # Build expected_by_currency dict for frontend — covers ALL currencies in cash_by_currency
    expected_by_currency = {
        "USD": float(expected_usd),
        "Bs": float(expected_bs)
    }
    for currency, sales_amount in cash_by_currency.items():
        if currency in ("USD", "Bs"):
            continue  # Already populated above
        initial = initial_by_currency.get(currency, Decimal("0.00"))
        change = change_by_currency.get(currency, Decimal("0.00"))
        deposits = deposits_by_currency.get(currency, Decimal("0.00"))
        expenses = expenses_by_currency.get(currency, Decimal("0.00"))
        expected_by_currency[currency] = float(initial + sales_amount - change + deposits - expenses)

    # Build cash_by_currency (only cash payments) - convert to float for JSON
    cash_by_currency_response = {curr: float(amt) for curr, amt in cash_by_currency.items()}

    # Build transfers_by_currency (non-cash payments) and CONSOLIDATE with Cash Advance Incomings
    transfers_by_currency = {}

    # 1. Sales Transfers
    for method, currencies in sales_by_method.items():
        is_cash = "efectivo" in method.lower() or "cash" in method.lower() or "divisa" in method.lower()
        if not is_cash:  # Exclude cash
            for curr, amt in currencies.items():
                if amt > 0:
                    if curr not in transfers_by_currency:
                        transfers_by_currency[curr] = {}
                    transfers_by_currency[curr][method] = float(amt)

    # 2. Cash Advance Incomings (Dual Transaction Consolidation)
    advance_movements = [m for m in movements if m.type == "CASH_ADVANCE" and m.incoming_amount and m.incoming_amount > 0]

    for adv in advance_movements:
        if not adv.incoming_method: continue

        inc_curr = adv.incoming_currency or "USD"
        inc_amt = float(adv.incoming_amount)
        inc_method = adv.incoming_method

        if inc_curr not in transfers_by_currency:
            transfers_by_currency[inc_curr] = {}

        # Consolidate: Add to existing sales total or create new entry
        current_val = transfers_by_currency[inc_curr].get(inc_method, 0.0)
        transfers_by_currency[inc_curr][inc_method] = current_val + inc_amt

    # Calculate credit sales (only unpaid ones)
    credit_sales = db.query(models.Sale).filter(
        or_(
            models.Sale.session_id == session.id,
            and_(models.Sale.session_id.is_(None), models.Sale.date >= session.start_time, models.Sale.date <= (session.end_time or datetime.now()))
        ),
        models.Sale.is_credit == True,
        models.Sale.balance_pending > 0  # Only unpaid credits
    ).all()

    total_credit_pending = sum(float(sale.balance_pending or 0) for sale in credit_sales)
    credit_count = len(credit_sales)

    return {
        "session": session,
        "details": {
            "initial_usd": session.initial_cash,
            "initial_bs": session.initial_cash_bs,
            "sales_total": sales_total_usd,
            "sales_by_method": {k: {curr: float(amt) for curr, amt in v.items()} for k, v in sales_by_method.items()},
            "transfers_by_currency": transfers_by_currency,  # NEW: Consolidated transfers (Sales + Cash Advances)
            "expenses_usd": expenses_usd,
            "expenses_bs": expenses_bs,
            "returns_usd": returns_usd,       # NEW: Separated Refunds
            "returns_bs": returns_bs,         # NEW: Separated Refunds
            "cash_advances_usd": cash_advances_usd,
            "cash_advances_bs": cash_advances_bs,
            "deposits_usd": deposits_usd,
            "deposits_bs": deposits_bs,
            "layaway_payments_usd": layaway_payments_total_usd,
            "layaway_payments_bs": layaway_payments_total_bs,
            "cash_by_currency": cash_by_currency_response,
            "credit_pending": total_credit_pending,  # NEW: Total unpaid credits
            "credit_count": credit_count  # NEW: Number of unpaid credit sales
        },
        "expected_usd": expected_usd,
        "expected_bs": expected_bs,
        "expected_by_currency": expected_by_currency,
        "diff_usd": final_reported_usd - expected_usd,
        "diff_bs": final_reported_bs - expected_bs
    }


@router.get("/sessions/{session_id}/z-report-payload", dependencies=[Depends(require_any_permission(["cash.audit.pdf", "cash.audit.view"]))])
def get_z_report_payload(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """Get Z-Report print payload for reprinting"""
    from ...services.sales_service import SalesService

    payload = SalesService.generate_z_report_payload(db, session_id)
    if not payload:
        raise HTTPException(status_code=404, detail="Session not found")
    return payload
