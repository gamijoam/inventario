from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ...database.db import get_db
from ...models import models
from ...dependencies import admin_only

router = APIRouter(dependencies=[Depends(admin_only)])


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
