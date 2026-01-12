from sqlalchemy.orm import Session
from sqlalchemy import or_, func
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
    
    # 1. Fetch Sales Payments within Session Window
    # Note: We use the same filtering logic as get_available_cash
    sales_payments = db.query(models.SalePayment).\
        join(models.Sale).\
        filter(
            models.Sale.date >= session.start_time,
            models.Sale.date <= (session.end_time or datetime.now())
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

    # 2. Fetch Debt Payments (Abonos) linked to Session
    # Fix from previous step: We use session_id
    debt_payments = db.query(models.Payment).filter(models.Payment.session_id == session.id).all()
    
    for p in debt_payments:
        method = f"{p.payment_method} (Abono)" # Distinguish Abonos
        curr = p.currency or "USD"
        amt = p.amount
        
        if method not in breakdown:
            breakdown[method] = {}
        if curr not in breakdown[method]:
            breakdown[method][curr] = Decimal("0.00")
            
        breakdown[method][curr] += amt
        
    return breakdown
