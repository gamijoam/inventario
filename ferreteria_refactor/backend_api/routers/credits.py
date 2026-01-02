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

from datetime import datetime, timedelta

@router.get("/aging-report")
def get_aging_report(db: Session = Depends(get_db)):
    """
    Generates a breakdown of Accounts Receivable by age of debt.
    Buckets: Current (0-15), 15-30, 30-60, 60+ days.
    """
    # Get all customers with 'credit' sales pending
    # We fetch ALL customers to ensure we don't miss anyone, but filtering by Sales is better
    
    # 1. Fetch all pending credit sales
    pending_sales = db.query(models.Sale).filter(
        models.Sale.is_credit == True,
        models.Sale.paid == False,
        models.Sale.balance_pending > 0
    ).options(joinedload(models.Sale.customer)).all()
    
    report = {}
    
    now = datetime.now()
    
    for sale in pending_sales:
        client_id = sale.customer_id
        client_name = sale.customer.name if sale.customer else "Unknown"
        
        if client_id not in report:
            report[client_id] = {
                "client_id": client_id,
                "client_name": client_name,
                "total_debt": 0.0,
                "current": 0.0,   # 0-15 days
                "days_15_30": 0.0,
                "days_30_60": 0.0,
                "days_60_plus": 0.0
            }
            
        debt = float(sale.balance_pending)
        report[client_id]["total_debt"] += debt
        
        # Calculate Age
        # Using Sale Date as reference for Age (Invoice Age)
        age_days = (now - sale.date).days
        
        if age_days <= 15:
            report[client_id]["current"] += debt
        elif age_days <= 30:
            report[client_id]["days_15_30"] += debt
        elif age_days <= 60:
            report[client_id]["days_30_60"] += debt
        else:
            report[client_id]["days_60_plus"] += debt

    # Convert to list
    return list(report.values())

@router.get("/client/{client_id}/ledger")
def get_client_ledger(client_id: int, db: Session = Depends(get_db)):
    """
    Returns a chronological ledger of sales and payments for a client.
    Equivalent to a "Statement of Account".
    """
    # 1. Get Client to ensure exists
    client = db.query(models.Customer).filter(models.Customer.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
        
    # 2. Get Sales (Debits)
    sales = db.query(models.Sale).filter(
        models.Sale.customer_id == client_id,
        models.Sale.is_credit == True
    ).all()
    
    # 3. Get Payments (Credits) is TRICKY because payments are linked to SALES in SalePayment
    # OR linked to Customer in Payment model (legacy/general).
    # We should look at BOTH or strictly SalePayment?
    # The current system uses SalePayment for credit payments.
    
    ledger_entries = []
    
    # Process Sales
    for sale in sales:
        ledger_entries.append({
            "date": sale.date,
            "type": "VENTA",
            "ref": f"Factura #{sale.id}",
            "debit": float(sale.total_amount),
            "credit": 0.0,
            "original_obj": sale
        })
        
        # Process Payments linked to this sale
        for payment in sale.payments:
            amount_usd = float(payment.amount)
            details_str = f"Abono a Fact. #{sale.id}"
            
            # Normalize to USD if needed
            if payment.currency != "USD":
                rate = float(payment.exchange_rate) if payment.exchange_rate else 1.0
                if rate > 0:
                    amount_usd = amount_usd / rate
                details_str += f" ({payment.amount} {payment.currency} @ {rate})"

            ledger_entries.append({
                "date": payment.created_at if hasattr(payment, 'created_at') and payment.created_at else sale.date,
                "type": "ABONO",
                "ref": details_str, # Updated to include details
                "debit": 0.0,
                "credit": round(amount_usd, 2), # Normalized to USD for balance math
                "original_obj": payment,
                "original_currency": payment.currency,
                "original_amount": float(payment.amount)
            })
            
    # Sort by Date
    ledger_entries.sort(key=lambda x: x["date"])
    
    # Calculate Balance
    balance = 0.0
    final_output = []
    
    for entry in ledger_entries:
        balance += entry["debit"]
        balance -= entry["credit"]
        final_output.append({
            "date": entry["date"].isoformat() if entry["date"] else None,
            "type": entry["type"],
            "ref": entry["ref"],
            "debit": entry["debit"],
            "credit": entry["credit"],
            "balance": round(balance, 2)
        })
        
    return {
        "client": {
            "id": client.id,
            "name": client.name,
            "limit": float(client.credit_limit or 0)
        },
        "ledger": final_output,
        "current_balance": round(balance, 2)
    }
