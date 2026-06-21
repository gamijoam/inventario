from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, func
from decimal import Decimal
from ..models import models
from datetime import datetime

def get_session_payment_breakdown(db: Session, session: models.CashSession):
    """
    Calculates detailed payment breakdown for a cash session.
    Includes both Direct Sales payments and Debt Payments (Abonos).
    Returns a dictionary grouped by Payment Method.
    """
    
    # Structure: {"Efectivo": {"USD": 100, "Bs": 5000}, "Zelle": {"USD": 50}}
    breakdown = {}
    
    # 1. Fetch Sales Payments for this session.
    # Prefer session_id isolation for multicaja; date-range fallback is only for legacy sales without session_id.
    sales_payments = db.query(models.SalePayment).\
        join(models.Sale).\
        filter(
            or_(
                models.Sale.session_id == session.id,
                and_(
                    models.Sale.session_id.is_(None),
                    models.Sale.date >= session.start_time,
                    models.Sale.date <= (session.end_time or datetime.now())
                )
            )
        ).all()

    for p in sales_payments:
        method = p.payment_method
        curr = p.currency or "USD"
        amt = p.amount
        
        if method not in breakdown:
            breakdown[method] = {}
        if curr not in breakdown[method]:
            breakdown[method][curr] = Decimal("0.00")
            
        breakdown[method][curr] += amt

    def _currency_key(value):
        curr = value or "USD"
        if str(curr).upper() in ["BS", "VES", "VEF"]:
            return "Bs"
        if curr in ("$", ""):
            return "USD"
        return curr

    def _has_matching_debt_deposit(payment):
        payment_amount = Decimal(str(payment.amount or 0))
        payment_currency = _currency_key(payment.currency)
        return db.query(models.CashMovement).filter(
            models.CashMovement.session_id == session.id,
            models.CashMovement.type.in_(["DEPOSIT", "IN"]),
            models.CashMovement.amount == payment_amount,
            models.CashMovement.currency.in_([payment.currency, payment_currency]),
            or_(
                models.CashMovement.description.ilike("%abono%"),
                models.CashMovement.description.ilike("%cxc%"),
                models.CashMovement.description.ilike("%cuenta%"),
            )
        ).first() is not None

    # 2. Fetch Debt Payments (Abonos) linked to Session.
    # Count only legacy payments without matching CashMovement(DEPOSIT); otherwise the report doubles CxC.
    debt_payments = db.query(models.Payment).filter(models.Payment.session_id == session.id).all()
    
    for p in debt_payments:
        if _has_matching_debt_deposit(p):
            continue
        method = f"{p.payment_method} (Abono)" # Distinguish Abonos
        curr = p.currency or "USD"
        amt = p.amount
        
        if method not in breakdown:
            breakdown[method] = {}
        if curr not in breakdown[method]:
            breakdown[method][curr] = Decimal("0.00")
            
        breakdown[method][curr] += amt
        
    # 3. Fetch Cash Advance Dual Transactions (Digital Inflows)
    advances = db.query(models.CashMovement).filter(
        models.CashMovement.session_id == session.id,
        models.CashMovement.type == 'CASH_ADVANCE',
        models.CashMovement.incoming_amount > 0
    ).all()
    
    for adv in advances:
        if adv.incoming_method:
            method = adv.incoming_method
            curr = adv.incoming_currency or "USD"
            amt = adv.incoming_amount
            
            if method not in breakdown:
                breakdown[method] = {}
            if curr not in breakdown[method]:
                breakdown[method][curr] = Decimal("0.00")
            
            breakdown[method][curr] += amt
        
    return breakdown
