from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from decimal import Decimal
from ...database.db import get_db
from ...models import models
from ...dependencies import admin_only

router = APIRouter(dependencies=[Depends(admin_only)])


@router.get("/low-stock")
def get_low_stock_products(threshold: int = 5, db: Session = Depends(get_db)):
    """Products with stock <= threshold (excludes services that don't track inventory)"""
    products = db.query(models.Product).filter(
        models.Product.stock <= threshold,
        models.Product.is_service == False,
        models.Product.is_active == True
    ).all()
    return products


@router.get("/inventory-valuation")
def get_inventory_valuation(exchange_rate: float = 1.0, db: Session = Depends(get_db)):
    """
    Inventory Financials:
    - Total Cost: Sum(Stock * Cost Price)
    - Potential Revenue: Sum(Stock * Sale Price)
    - Potential Profit: Revenue - Cost
    """
    products = db.query(models.Product).filter(models.Product.is_active == True).all()

    total_cost_usd = Decimal("0.00")
    total_revenue_usd = Decimal("0.00")
    total_stock_units = Decimal("0.00")

    for p in products:
        # Safety check for None and force Decimal conversion
        stock = Decimal(str(p.stock)) if p.stock is not None else Decimal("0")
        cost = Decimal(str(p.cost_price)) if p.cost_price is not None else Decimal("0")
        price = Decimal(str(p.price)) if p.price is not None else Decimal("0")

        # Only count positive stock
        if stock > 0:
            total_stock_units += stock
            total_cost_usd += (stock * cost)
            total_revenue_usd += (stock * price)

    potential_profit = total_revenue_usd - total_cost_usd
    margin_percent = 0
    if total_revenue_usd > 0:
        margin_percent = (potential_profit / total_revenue_usd) * 100

    return {
        "total_products": len(products),
        "total_stock_units": float(total_stock_units),
        "total_cost_usd": float(total_cost_usd),
        "total_revenue_usd": float(total_revenue_usd),
        "potential_profit_usd": float(potential_profit),
        "margin_percent": float(round(margin_percent, 2)),
        # Bs values for display if needed
        "total_cost_bs": float(total_cost_usd) * exchange_rate,
        "total_revenue_bs": float(total_revenue_usd) * exchange_rate
    }
