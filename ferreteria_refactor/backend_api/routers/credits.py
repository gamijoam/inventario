from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from ..database.db import get_db
from ..models import models
from typing import List, Optional
from pydantic import BaseModel

router = APIRouter(prefix="/credits", tags=["credits"])

class ValuationResponse(BaseModel):
    sale_id: int
    total_usd: float
    current_valuation_ves: float
    breakdown: str
    exchange_rate_used: float  # Weighted average or effective rate

@router.get("/sales/{sale_id}/valuation", response_model=ValuationResponse)
def get_sale_valuation(sale_id: int, db: Session = Depends(get_db)):
    """
    Calculate the current valuation of a credit sale in VES (Bs),
    considering the specific exchange rate type (BCV, Paralelo) 
    associated with each product in the sale.
    """
    sale = db.query(models.Sale).options(
        joinedload(models.Sale.details).joinedload(models.SaleDetail.product)
    ).filter(models.Sale.id == sale_id).first()

    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")

    total_usd = float(sale.balance_pending if sale.balance_pending is not None else sale.total_amount)
    
    # If balance is 0, valuation is 0
    if total_usd <= 0.01:
        return {
            "sale_id": sale.id,
            "total_usd": 0.0,
            "current_valuation_ves": 0.0,
            "breakdown": "Pagado",
            "exchange_rate_used": 0.0
        }

    # Fetch all active exchange rates mapped by ID
    rates = db.query(models.ExchangeRate).filter(models.ExchangeRate.is_active == True).all()
    rates_map = {r.id: float(r.rate) for r in rates}
    
    # Default rate (System default or highest?)
    # Usually we want the default rate for products without specific rate
    default_rate_obj = next((r for r in rates if r.is_default), None)
    default_rate = float(default_rate_obj.rate) if default_rate_obj else 0.0
    if default_rate == 0 and rates:
        default_rate = float(rates[0].rate) # Fallback

    total_valuation_ves = 0.0
    breakdown_parts = []
    
    # We need to calculate the WEIGHTED valuation based on the contents of the sale,
    # PROPORTIONAL to the remaining balance.
    # Logic:
    # 1. Calculate Original Total USD of the sale.
    # 2. Calculate Current Valuation VES of the ENTIRE sale content.
    # 3. Apply the ratio (Balance / Total) to find the Valuation of the Balance.
    
    # Why? Because we don't know WHICH items were paid off. 
    # Valid assumption: Payments cover the debt proportionally or FIFO. 
    # Proportional is unmatched fair for "Current Valuation".
    
    sale_total_usd = 0.0
    sale_valuation_ves = 0.0
    
    rate_totals = {} # id -> amount_usd
    
    for item in sale.details:
        # Item USD Value
        # Note: Use values from SaleDetail (fixed at sale time) or Product (current price)?
        # Valuation usually means "What is the debt worth NOW in Bs".
        # Debt is fixed in USD.
        # So we use the USD price from the SALE DETAIL.
        item_total_usd = float(item.subtotal) # Quantity * Unit Price
        sale_total_usd += item_total_usd
        
        # Determine Rate for this item
        # We need to check the PRODUCT's current exchange rate setting.
        # item.product might have changed, but it's the best link we have.
        product = item.product
        rate_id = product.exchange_rate_id if product else None
        
        rate_val = default_rate
        rate_name = "Default"
        
        if rate_id and rate_id in rates_map:
            rate_val = rates_map[rate_id]
            # Find name
            r_obj = next((r for r in rates if r.id == rate_id), None)
            rate_name = r_obj.name if r_obj else "Special"
        
        item_valuation = item_total_usd * rate_val
        sale_valuation_ves += item_valuation
        
        # Accumulate for breakdown
        if rate_name not in rate_totals:
            rate_totals[rate_name] = 0.0
        rate_totals[rate_name] += item_total_usd

    # Calculate Effective Rate for the whole sale
    if sale_total_usd > 0:
        effective_rate = sale_valuation_ves / sale_total_usd
    else:
        effective_rate = default_rate

    # Now apply to Balance
    balance_valuation_ves = total_usd * effective_rate
    
    # Breakdown String
    breakdown_strs = []
    for name, amount in rate_totals.items():
        pct = (amount / sale_total_usd * 100) if sale_total_usd > 0 else 0
        breakdown_strs.append(f"{name}: {pct:.1f}%")
        
    final_breakdown = " | ".join(breakdown_strs)
    
    return {
        "sale_id": sale.id,
        "total_usd": total_usd,
        "current_valuation_ves": round(balance_valuation_ves, 2),
        "breakdown": final_breakdown,
        "exchange_rate_used": round(effective_rate, 4)
    }
