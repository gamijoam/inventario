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
        SERVICE_SKU = "GENERIC-SERVICE"
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
        Subtracts any initial down-payments (ServicePayment) from the final SalePayment required.
        """
        try:
            print(f"[DEBUG] Checkout Service Order ID: {order_id}")
            # 1. Fetch Order with Payments
            order = db.query(models.ServiceOrder).get(order_id)
            if not order:
                raise HTTPException(status_code=404, detail="Orden de servicio no encontrada")
            
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

            # 🔍 Determine if order contains physical products (not services)
            has_physical_products = False
            for item in order.details:
                if not item.is_manual and item.product_id:
                    prod = db.query(models.Product).filter(
                        models.Product.id == item.product_id,
                        models.Product.is_service == False
                    ).first()
                    if prod:
                        has_physical_products = True
                        break

            # 3. Create Sale Header
            # NOTE: payment_data.total_amount comes from frontend. We should re-calculate it to be safe, 
            # but for now we trust the POS frontend math or validates later.
            
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
                warehouse_id=1 if has_physical_products else None,
                # Metadata
                date=datetime.now(),
                unique_uuid=str(uuid.uuid4()),
                is_offline_sale=False 
            )
            
            db.add(new_sale)
            db.flush() 
            
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
                db.flush()

                # COMMISSION LOGIC
                if item.technician_id and item.is_manual:
                    technician = db.query(models.User).get(item.technician_id)
                    if technician and technician.commission_percentage and technician.commission_percentage > 0:
                        commission_amount = subtotal * (technician.commission_percentage / 100)
                        
                        if commission_amount > 0:
                            comm_log = models.CommissionLog(
                                user_id=technician.id,
                                sale_detail_id=detail.id,
                                amount=commission_amount,
                                currency=new_sale.currency,
                                percentage_applied=technician.commission_percentage
                            )
                            db.add(comm_log)
                
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
                            movement_type=models.MovementType.SALE, 
                            quantity=-qty,
                            balance_after=prod.stock,
                            description=f"Service Checkout #{order.ticket_number}"
                        )
                        db.add(kardex)

            # 5. Process Payments (Handling Abonos/Down Payments)
            
            # Fetch previous payments (Abonos)
            previous_payments = db.query(models.ServicePayment).filter(
                models.ServicePayment.service_order_id == order_id
            ).all()

            total_prepaid = sum(p.amount for p in previous_payments)
            
            # Log Previous Payments as SalePayments (for accounting match)
            for pp in previous_payments:
                 migrated_payment = models.SalePayment(
                    sale_id=new_sale.id,
                     amount=pp.amount,
                     currency=pp.currency,
                     payment_method=f"ABONO ({pp.payment_method})",
                     exchange_rate=1.0, # Assuming 1.0 or track historical?
                     reference=pp.reference, 
                     payment_date=pp.created_at
                 )
                 db.add(migrated_payment)

            # Log CURRENT Payment (The Balance Due)
            # payment_data.payments contains the New payments made at checkout
            if payment_data.payments:
                for p in payment_data.payments:
                    pay = models.SalePayment(
                        sale_id=new_sale.id,
                        amount=p.amount,
                        currency=p.currency,
                        payment_method=p.payment_method,
                        exchange_rate=p.exchange_rate,
                        reference=p.reference, 
                        payment_date=p.payment_date 
                    )
                    db.add(pay)
            else:
                 # Should not ideally happen if balance > 0 in POS
                 pass

            # 6. Update Order Status
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
