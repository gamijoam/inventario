from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session, joinedload
from typing import List, Dict, Any
from datetime import datetime
from ..database.db import get_db
from ..models import models
from .. import schemas

router = APIRouter(prefix="/sync", tags=["sync"])

@router.get("/pull/catalog")
def pull_catalog(last_sync: datetime = None, db: Session = Depends(get_db)):
    """
    Download the entire catalog (or changes since last_sync) for the offline client.
    Optimized for SQLite ingestion.
    """
    # 1. Products & Units (The most important part)
    # We fetch everything for now. Future optimization: delta sync using updated_at
    products = db.query(models.Product).options(
        joinedload(models.Product.units),
        joinedload(models.Product.exchange_rate),
        joinedload(models.Product.category)
    ).filter(models.Product.is_active == True).all()

    # 2. Customers (All active customers)
    customers = db.query(models.Customer).filter(models.Customer.is_blocked == False).all()

    # 3. Exchange Rates (Active rates)
    rates = db.query(models.ExchangeRate).filter(models.ExchangeRate.is_active == True).all()

    # 4. Users (Cashiers only)
    users = db.query(models.User).filter(models.User.is_active == True).all()

    # 5. Categories (Critical for FK constraints)
    categories = db.query(models.Category).all()
    
    response_data = {
        "sync_timestamp": datetime.now(),
        "categories": [schemas.CategoryResponse.from_orm(c) for c in categories],
        "products": [schemas.ProductRead.from_orm(p) for p in products],
        "customers": [schemas.CustomerRead.from_orm(c) for c in customers],
        "exchange_rates": [schemas.ExchangeRateSync.from_orm(r) for r in rates],
        "users": [{"id": u.id, "username": u.username, "role": u.role.value, "pin": u.pin} for u in users]
    }
    
    return response_data


@router.post("/push/sales")
def push_sales(sales_batch: List[schemas.SaleCreate], db: Session = Depends(get_db)):
    """
    Receive sales from offline clients.
    Critically uses 'unique_uuid' to prevent duplicate insertions.
    """
    results = {
        "processed": 0,
        "skipped": 0, # Already existed (Idempotency)
        "errors": []
    }
    
    print(f"[SYNC] PUSH RECEIVED: {len(sales_batch)} sales incoming.")
    
    for sale_data in sales_batch:
        print(f"[SYNC] Processing sale UUID: {sale_data.unique_uuid}")
        try:
            # 1. Check IDEMPOTENCY (The Golden Rule)
            if sale_data.unique_uuid:
                existing = db.query(models.Sale).filter(models.Sale.unique_uuid == sale_data.unique_uuid).first()
                if existing:
                    results["skipped"] += 1
                    continue # Skip this sale, we already have it!

            # 2. Create Sale (Standard Logic)
            # We map the SaleCreate schema to the SQLAlchemy model manually 
            # because some fields might need adjustment (like customer_id lookup vs creation)
            
            # TODO: If customer doesn't exist (new offline customer), create them first logic here
            # For this MVP phase, we assume known customers or generic client
            
            new_sale = models.Sale(
                date=datetime.now(), # Use server time or add 'created_at_offline' field later
                total_amount=sale_data.total_amount,
                payment_method=sale_data.payment_method,
                currency=sale_data.currency,
                exchange_rate_used=sale_data.exchange_rate,
                customer_id=sale_data.customer_id,
                is_credit=sale_data.is_credit,
                # user_id=1, # REMOVED: Model does not have user_id column yet.
                notes=sale_data.notes,
                
                # HYBRID FIELDS
                unique_uuid=sale_data.unique_uuid,
                sync_status='SYNCED', # It's now safe in the cloud
                is_offline_sale=True
            )
            
            db.add(new_sale)
            db.flush() # Get ID for details
            
            # 3. Add Items
            for item in sale_data.items:
                detail = models.SaleDetail(
                    sale_id=new_sale.id,
                    product_id=item.product_id,
                    quantity=item.quantity,
                    unit_price=item.unit_price,
                    subtotal=item.subtotal,
                    discount=item.discount,
                    discount_type=item.discount_type,
                    tax_rate=item.tax_rate
                )
                db.add(detail)
                
                # 4. Stock Deduction (CRITICAL)
                # We trust the cloud stock is the master, but we apply the subtraction
                product = db.query(models.Product).get(item.product_id)
                if product:
                    product.stock -= item.quantity
            
            results["processed"] += 1
            print(f"[OK] Sale {sale_data.unique_uuid} processed successfully.")
            
        except Exception as e:
            db.rollback()
            print(f"[ERROR] ERROR PROCESSING SALE {sale_data.unique_uuid}: {e}")
            import traceback
            traceback.print_exc()
            results["errors"].append({"uuid": sale_data.unique_uuid, "error": str(e)})
            continue # Try next sale in batch
            
    db.commit()
    print(f"[SYNC] Sync batch completed. Processed: {results['processed']}, Errors: {len(results['errors'])}")
    return results
