from sqlalchemy.orm import Session
from fastapi import HTTPException
from datetime import datetime
from decimal import Decimal
import uuid

from ..models import models
from ..models.tenant import Tenant
from .. import schemas
from ..commission_engine import CommissionEngine


class ServiceCheckoutService:
    @staticmethod
    def get_or_create_service_product(db: Session):
        SERVICE_SKU = "GENERIC-SERVICE"
        product = db.query(models.Product).filter(models.Product.sku == SERVICE_SKU).first()
        if not product:
            product = models.Product(
                name="SERVICIO TÉCNICO GENERAL",
                sku=SERVICE_SKU,
                description="Item comodín para servicios manuales",
                cost_price=0, price=0, stock=999999,
                category_id=None, is_active=True
            )
            db.add(product)
            db.commit()
            db.refresh(product)
        return product

    @staticmethod
    def convert_order_to_sale(db: Session, order_id: int, payment_data: schemas.SaleCreate, user_id: int):
        try:
            print(f"[DEBUG] Checkout Service Order ID: {order_id}")

            # ── Commission Engine ─────────────────────────────────────────
            _user_obj = db.query(models.User).filter(models.User.id == user_id).first()
            _tenant_flags = {}
            if _user_obj and _user_obj.tenant_id:
                _tenant = db.query(Tenant).filter(Tenant.id == _user_obj.tenant_id).first()
                _tenant_flags = _tenant.feature_flags or {} if _tenant else {}
            commission_engine = CommissionEngine(db, _tenant_flags)
            # ─────────────────────────────────────────────────────────────

            # 1. Fetch Order
            order = db.query(models.ServiceOrder).filter(models.ServiceOrder.id == order_id).first()
            if not order:
                raise HTTPException(status_code=404, detail="Orden de servicio no encontrada")

            is_ready = (
                order.status == models.ServiceOrderStatus.READY
                or str(order.status) == "READY"
            )
            if not is_ready:
                raise HTTPException(status_code=400, detail=f"La orden debe estar en estado READY (Estado actual: {order.status})")

            generic_service_product = ServiceCheckoutService.get_or_create_service_product(db)

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
                date=datetime.now(),
                unique_uuid=str(uuid.uuid4()),
                is_offline_sale=False
            )
            db.add(new_sale)
            db.flush()

            # 4. Process Items
            total_calculated = Decimal(0)
            order_total_for_vendor = Decimal(0)

            for item in order.details:
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
                    prod = db.query(models.Product).filter(models.Product.id == product_id).first()
                    cost = prod.cost_price if prod else 0
                    price = item.unit_price
                    deduct_stock = bool(prod)

                subtotal = price * qty
                total_calculated += subtotal
                order_total_for_vendor += subtotal

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

                # ── COMISIÓN TÉCNICO (todos los ítems, no solo manuales) ──
                if item.technician_id:
                    technician = db.query(models.User).filter(
                        models.User.id == item.technician_id
                    ).first()
                    if technician:
                        commission_engine.record_technician_commission(
                            service_order_id=order_id,
                            sale_detail=detail,
                            technician=technician,
                            ticket_number=order.ticket_number,
                        )
                # ─────────────────────────────────────────────────────────

                if deduct_stock:
                    stock_record = db.query(models.ProductStock).filter(
                        models.ProductStock.product_id == product_id,
                        models.ProductStock.warehouse_id == 1
                    ).first()
                    if stock_record:
                        stock_record.quantity -= qty
                    prod = db.query(models.Product).filter(models.Product.id == product_id).first()
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

            # ── COMISIÓN VENDEDOR (quien creó la orden, si es distinto al técnico) ──
            if order.technician_id != user_id and _user_obj:
                commission_engine.record_taller_vendor_commission(
                    service_order_id=order_id,
                    sale_id=new_sale.id,
                    total_amount=order_total_for_vendor,
                    vendor=_user_obj,
                    ticket_number=order.ticket_number,
                )
            # ─────────────────────────────────────────────────────────────────

            # 5. Procesar pagos
            previous_payments = db.query(models.ServicePayment).filter(
                models.ServicePayment.service_order_id == order_id
            ).all()

            for pp in previous_payments:
                db.add(models.SalePayment(
                    sale_id=new_sale.id,
                    amount=pp.amount,
                    currency=pp.currency,
                    payment_method=f"ABONO ({pp.payment_method})",
                    exchange_rate=1.0,
                    reference=pp.reference,
                    payment_date=pp.created_at
                ))

            if payment_data.payments:
                for p in payment_data.payments:
                    db.add(models.SalePayment(
                        sale_id=new_sale.id,
                        amount=p.amount,
                        currency=p.currency,
                        payment_method=p.payment_method,
                        exchange_rate=p.exchange_rate,
                        reference=p.reference,
                        payment_date=p.payment_date
                    ))

            # 6. Actualizar orden
            order.status = models.ServiceOrderStatus.DELIVERED
            metadata = dict(order.order_metadata or {})
            metadata["payment_status"] = "PAID"
            order.order_metadata = metadata
            order.updated_at = datetime.now()

            db.commit()

            # ── Re-setear search_path después del commit ───────────────
            # db.commit() puede resetear el search_path al default (public)
            # lo que causa "relation sales does not exist" en el refresh
            try:
                from ..tenant_context import get_tenant_schema as _gts
                _schema = _gts()
                if _schema and _schema != "public":
                    from sqlalchemy import text as _text
                    db.execute(_text(f'SET search_path TO "{_schema}", public'))
            except Exception:
                pass

            db.refresh(new_sale)
            return new_sale

        except Exception as e:
            import traceback
            traceback.print_exc()
            print(f"[CRITICAL ERROR] Checkout Failed: {e}")
            db.rollback()
            raise HTTPException(status_code=500, detail=str(e))
