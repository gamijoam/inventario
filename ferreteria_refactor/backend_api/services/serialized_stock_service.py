from decimal import Decimal
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from ..models import models


def reconcile_serialized_product_stock(db: Session, product_id: int) -> Optional[Decimal]:
    """Keep stock mirrors aligned with AVAILABLE IMEIs for serialized products."""
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product or not getattr(product, "has_imei", False):
        return None

    db.flush()

    rows = (
        db.query(
            models.ProductInstance.warehouse_id,
            func.count(models.ProductInstance.id),
        )
        .filter(
            models.ProductInstance.product_id == product_id,
            models.ProductInstance.status == models.ProductInstanceStatus.AVAILABLE,
        )
        .group_by(models.ProductInstance.warehouse_id)
        .all()
    )
    available_by_warehouse = {
        warehouse_id: Decimal(count or 0)
        for warehouse_id, count in rows
        if warehouse_id is not None
    }

    stock_rows = (
        db.query(models.ProductStock)
        .filter(models.ProductStock.product_id == product_id)
        .all()
    )
    stock_by_warehouse = {row.warehouse_id: row for row in stock_rows}

    for warehouse_id in set(stock_by_warehouse) | set(available_by_warehouse):
        quantity = available_by_warehouse.get(warehouse_id, Decimal("0"))
        stock_row = stock_by_warehouse.get(warehouse_id)
        if stock_row:
            stock_row.quantity = quantity
        elif quantity > 0:
            db.add(models.ProductStock(
                product_id=product_id,
                warehouse_id=warehouse_id,
                quantity=quantity,
            ))

    product.stock = sum(available_by_warehouse.values(), Decimal("0"))
    return product.stock
