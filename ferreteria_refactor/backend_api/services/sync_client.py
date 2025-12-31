import httpx
import os
from decimal import Decimal
from sqlalchemy.orm import Session
from fastapi.encoders import jsonable_encoder
from ..models import models
from .. import schemas
from ..database.db import SessionLocal
import datetime

# ... (rest of imports/code unchanged until push_sales_to_cloud payload construction) ...


# Configuration - In a real app, this should be in the DB or Env
VPS_BASE_URL = os.getenv("VPS_URL", "https://ferreteria-vps.gamijoam.com/api/v1") # Placeholder
# AUTH_TOKEN = ... # We might need a machine token

async def pull_catalog_from_cloud(db: Session, vps_url: str = None):
    """
    Connects to the VPS and downloads the catalog (Products, Customers, etc.)
    """
    target_url = vps_url or VPS_BASE_URL  # Use environment variable
    
    # Remove frontend hash if present (e.g., https://site.com/#/dashboard -> https://site.com)
    if "/#" in target_url:
        target_url = target_url.split("/#")[0]

    # Ensure /api/v1 is present
    # Remove trailing slash first to avoid double slash
    target_url = target_url.rstrip('/')
    
    if not target_url.endswith("/api/v1"):
         target_url = f"{target_url}/api/v1"

    # Use a hardcoded token or a specific 'sync' user token for now
    # In production, we'd do a proper handshake
    headers = {
        "Authorization": f"Bearer {os.getenv('SYNC_API_KEY', 'dev-sync-key')}" 
    }

    try:
        print(f"[SYNC] Downloading catalog from {target_url}/sync/pull/catalog...")
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(f"{target_url}/sync/pull/catalog", headers=headers)
            
            if response.status_code != 200:
                print(f"[ERROR] Sync failed with status: {response.status_code}")
                # Try to print body to see what happened (HTML error page?)
                print(f"[ERROR] Body: {response.text[:200]}...") 
                return {"success": False, "error": f"Status {response.status_code}"}
            
            data = response.json()

            # --- PROCESS CATEGORIES FIRST (FK Constraint) ---
            categories_data = data.get("categories", [])
            print(f"[SYNC] Processing {len(categories_data)} categories...")
            for cat_data in categories_data:
                category = db.query(models.Category).filter(models.Category.id == cat_data['id']).first()
                if not category:
                    category = models.Category(id=cat_data['id'])
                    db.add(category)
                category.name = cat_data['name']
                # category.description = cat_data.get('description') 

            # --- PROCESS EXCHANGE RATES FIRST (FK Constraint) ---
            rates_data = data.get("exchange_rates", [])
            print(f"[SYNC] Processing {len(rates_data)} exchange rates...")
            for r_data in rates_data:
                rate = db.query(models.ExchangeRate).filter(models.ExchangeRate.id == r_data['id']).first()
                if not rate:
                    rate = models.ExchangeRate(id=r_data['id'])
                    db.add(rate)
                rate.name = r_data['name']
                rate.currency_code = r_data['currency_code']
                rate.currency_symbol = r_data['currency_symbol']
                rate.rate = r_data['rate']
                rate.is_default = r_data['is_default']
                rate.is_active = r_data['is_active']
                rate.updated_at = datetime.datetime.fromisoformat(r_data['updated_at']) if r_data.get('updated_at') else datetime.datetime.now()

            # --- PROCESS PRODUCTS ---
            products_data = data.get("products", [])
            print(f"[SYNC] Processing {len(products_data)} products...")
            
            for p_data in products_data:
                # Upsert Product
                product = db.query(models.Product).filter(models.Product.id == p_data['id']).first()
                if not product:
                    product = models.Product(id=p_data['id']) # Preserve ID
                    db.add(product)
                
                
                # Update fields (use .get() for optional fields)
                product.name = p_data.get('name', 'Unknown')
                product.description = p_data.get('description')
                product.price = p_data.get('price', 0)
                product.stock = p_data.get('stock', 0)
                product.category_id = p_data.get('category_id')
                product.exchange_rate_id = p_data.get('exchange_rate_id') # Crucial FK
                product.sku = p_data.get('sku')
                product.is_active = p_data.get('is_active', True)
                product.image_url = p_data.get('image_url')
                
                # --- PROCESS UNITS (Nested) ---
                # We delete existing units and re-add to sync state purely
                # Or we can upsert. For simplicity, we skip delete for now and just upsert based on unit_id
                if 'units' in p_data and p_data['units']:
                    for u_data in p_data['units']:
                        unit = db.query(models.ProductUnit).filter(models.ProductUnit.id == u_data['id']).first()
                        if not unit:
                            unit = models.ProductUnit(id=u_data['id'])
                            db.add(unit)
                        
                        unit.product_id = p_data['id']
                        unit.unit_name = u_data.get('unit_name', 'Unit')
                        unit.conversion_factor = u_data.get('conversion_factor', 1)
                        unit.price = u_data.get('price', 0)
                        unit.barcode = u_data.get('barcode')
                        unit.is_default = u_data.get('is_default', False)
                        
            # --- PROCESS CUSTOMERS ---
            customers_data = data.get("customers", [])
            print(f"busts Processing {len(customers_data)} customers...")
            for c_data in customers_data:
                customer = db.query(models.Customer).filter(models.Customer.id == c_data['id']).first()
                if not customer:
                    customer = models.Customer(id=c_data['id'])
                    db.add(customer)
                
                
                customer.name = c_data.get('name', 'Unknown')
                customer.email = c_data.get('email')
                customer.phone = c_data.get('phone')
                customer.nit = c_data.get('nit')
                customer.address = c_data.get('address')
                customer.unique_uuid = c_data.get('unique_uuid')

            db.commit()
            return {"status": "success", "products": len(products_data), "customers": len(customers_data)}

    except Exception as e:
        db.rollback()
        print(f"[ERROR] Sync Error: {e}")
        raise e

async def push_sales_to_cloud(db: Session, vps_url: str = None):
    """
    Uploads pending sales to the VPS.
    """
    target_url = vps_url or VPS_BASE_URL
    
    # Ensure /api/v1 is present
    if not target_url.endswith("/api/v1"):
         target_url = f"{target_url.rstrip('/')}/api/v1"
    
    headers = {
        "Authorization": f"Bearer {os.getenv('SYNC_API_KEY', 'dev-sync-key')}"
    }

    try:
        # 1. Get offline sales that haven't been synced
        pending_sales = db.query(models.Sale).filter(
            models.Sale.sync_status == 'PENDING',
            models.Sale.is_offline_sale == True  # Only push sales created offline
        ).all()
        
        if not pending_sales:
            print("[SYNC] No pending sales to push.")
            return {"synced_count": 0}

        print(f"[SYNC] Push: Found {len(pending_sales)} pending sales to push to {target_url}...")
        
        sales_payload = []
        for sale in pending_sales:
            # Manual Construction to avoid 'items' vs 'details' alias issues and ensure safety
            sale_items = []
            for detail in sale.details:
                sale_items.append(schemas.SaleDetailCreate(
                    product_id=detail.product_id,
                    quantity=detail.quantity,
                    unit_price=detail.unit_price,
                    subtotal=detail.subtotal,
                    conversion_factor=Decimal("1.0"), # Default as it might not be stored
                    discount=detail.discount,
                    discount_type=detail.discount_type,
                    tax_rate=detail.tax_rate
                ))

            sale_payments = []
            for payment in sale.payments:
                sale_payments.append(schemas.SalePaymentCreate(
                    sale_id=sale.id,
                    amount=payment.amount,
                    currency=payment.currency,
                    payment_method=payment.payment_method,
                    exchange_rate=payment.exchange_rate
                ))

            sale_schema = schemas.SaleCreate(
                customer_id=sale.customer_id,
                payment_method=sale.payment_method,
                payments=sale_payments,
                items=sale_items, # Mapped from details
                total_amount=sale.total_amount,
                currency=sale.currency,
                exchange_rate=sale.exchange_rate_used,
                notes=sale.notes,
                is_credit=sale.is_credit,
                unique_uuid=sale.unique_uuid,
                is_offline_sale=sale.is_offline_sale
            )
            
            # Use jsonable_encoder to handle Decimal -> str/float conversion automatically and safely
            sales_payload.append(jsonable_encoder(sale_schema, exclude_none=True))

        # 3. Send to Cloud
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{target_url}/sync/push/sales", 
                json=sales_payload, # httpx handles JSON serialization
                headers=headers, 
                timeout=60.0
            )
            response.raise_for_status()
            
            # 4. Check for Application-Level Errors (Cloud API catches exceptions and returns them in 'errors' list)
            result_data = response.json()
            if result_data.get("errors"):
                print(f"[ERROR] Cloud Sync Returned Errors: {result_data['errors']}")
                raise Exception(f"Cloud reported errors: {result_data['errors']}")
            
            # 5. If success, mark as SYNCHED
            for sale in pending_sales:
                sale.sync_status = "SYNCED"
            
            db.commit()
            print(f"[OK] Successfully pushed {len(pending_sales)} sales. (Processed: {result_data.get('processed')})")
            return {"status": "success", "pushed": len(pending_sales)}

    except Exception as e:
        print(f"[ERROR] Push Error: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
        raise e
