from sqlalchemy.orm import Session
from fastapi import HTTPException
from datetime import datetime
from decimal import Decimal
import uuid

from ..models import models
from .. import schemas

class ServiceCheckoutService:
    @staticmethod
    def get_or_create_service_product(db: Session):
        """
        Ensures a generic service product exists to satisfy FK constraints for manual items.
        """
        SERVICE_SKU = "SRV-GENERIC"
        product = db.query(models.Product).filter(models.Product.sku == SERVICE_SKU).first()
        
        if not product:
            # Create generic service product
            product = models.Product(
                name="SERVICIO TÉCNICO GENERAL",
                sku=SERVICE_SKU,
                description="Item comodín para servicios manuales",
                cost_price=0,
                price=0, # Variable price
                stock=999999, # Infinite stock
                category_id=None, # Or assign a default category if strict
                is_active=True
            )
            db.add(product)
            db.commit()
            db.refresh(product)
            
        return product

    @staticmethod
    def convert_order_to_sale(db: Session, order_id: int, payment_data: schemas.SaleCreate, user_id: int):
        """
        Converts a READY ServiceOrder into a Sale.
        """
        try:
            print(f"[DEBUG] Checkout Service Order ID: {order_id}")
            # 1. Fetch Order
            order = db.query(models.ServiceOrder).get(order_id)
            if not order:
                raise HTTPException(status_code=404, detail="Orden de servicio no encontrada")
            
            print(f"[DEBUG] Order Status: {order.status} (Type: {type(order.status)})")
            
            # Fix Enum Comparison
            is_ready = False
            if isinstance(order.status, models.ServiceOrderStatus):
                 if order.status == models.ServiceOrderStatus.READY:
                     is_ready = True
            elif str(order.status) == "READY":
                 is_ready = True

            if not is_ready:
                raise HTTPException(status_code=400, detail=f"La orden debe estar en estado READY (Estado actual: {order.status})")

            # 2. Prepare Generic Product for Manual Items
            generic_service_product = ServiceCheckoutService.get_or_create_service_product(db)
            print(f"[DEBUG] Generic Product ID: {generic_service_product.id}")

            # 3. Create Sale Header
            new_sale = models.Sale(
                total_amount=payment_data.total_amount,
                currency=payment_data.currency,
                exchange_rate_used=payment_data.exchange_rate,
                total_amount_bs=payment_data.total_amount_bs,
                payment_method=payment_data.payment_method,
                customer_id=order.customer_id, 
                is_credit=False, 
                paid=not payment_data.is_credit,
                notes=f"Orden de Servicio #{order.ticket_number}. {payment_data.notes or ''}",
                warehouse_id=1, 
                # Metadata
                date=datetime.now(),
                unique_uuid=str(uuid.uuid4()),
                is_offline_sale=False 
            )
            
            db.add(new_sale)
            db.flush() 
            print(f"[DEBUG] Sale Header Created ID: {new_sale.id}")
            
            # 4. Process Items (Map ServiceOrderDetail -> SaleDetail)
            total_calculated = Decimal(0)
            
            for item in order.details:
                # Determine Product
                if item.is_manual or not item.product_id:
                    product_id = generic_service_product.id
                    description = item.description 
                    qty = item.quantity
                    cost = item.cost or 0
                    price = item.unit_price
                    deduct_stock = False
                else:
                    product_id = item.product_id
                    description = item.description 
                    qty = item.quantity
                    cost = item.cost or 0 
                    
                    prod = db.query(models.Product).get(product_id)
                    if prod:
                        cost = prod.cost_price
                        deduct_stock = True
                    else:
                        cost = 0
                        deduct_stock = False 
                    
                    price = item.unit_price

                subtotal = price * qty
                total_calculated += subtotal
                
                detail = models.SaleDetail(
                    sale_id=new_sale.id,
                    product_id=product_id,
                    description=description, 
                    quantity=qty,
                    unit_price=price,
                    cost_at_sale=cost,
                    subtotal=subtotal,
                    discount=0, 
                    salesperson_id=item.technician_id
                )
                db.add(detail)
                
                # Stock Logic
                if deduct_stock:
                    stock_record = db.query(models.ProductStock).filter(
                        models.ProductStock.product_id == product_id,
                        models.ProductStock.warehouse_id == 1
                    ).first()
                    
                    if stock_record:
                        stock_record.quantity -= qty
                        
                    prod = db.query(models.Product).get(product_id)
                    if prod:
                        prod.stock -= qty
                        kardex = models.Kardex(
                            product_id=product_id,
                            movement_type=models.MovementType.SALE, # Use Enum
                            quantity=-qty,
                            balance_after=prod.stock,
                            description=f"Service Checkout #{order.ticket_number}"
                        )
                        db.add(kardex)

            # 5. Process Payments
            if payment_data.payments:
                for p in payment_data.payments:
                    pay = models.SalePayment(
                        sale_id=new_sale.id,
                        amount=p.amount,
                        currency=p.currency,
                        payment_method=p.payment_method,
                        exchange_rate=p.exchange_rate
                    )
                    db.add(pay)
            else:
                 pay = models.SalePayment(
                     sale_id=new_sale.id,
                     amount=new_sale.total_amount,
                     currency=new_sale.currency,
                     payment_method=new_sale.payment_method,
                     exchange_rate=new_sale.exchange_rate_used
                 )
                 db.add(pay)

            # 6. Update Order Status
            print("[DEBUG] Updating Order Status to DELIVERED")
            order.status = models.ServiceOrderStatus.DELIVERED
            order.updated_at = datetime.now()
            
            db.commit()
            db.refresh(new_sale)
            
            return new_sale
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            print(f"[CRITICAL ERROR] Checkout Failed: {e}")
            db.rollback()
            raise HTTPException(status_code=500, detail=str(e))
