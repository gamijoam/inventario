from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from decimal import Decimal
from collections import Counter
from ..database.db import get_db
from ..models import models
from .. import schemas
from ..dependencies import get_current_user
from ..websocket.manager import manager
from ..websocket.events import WebSocketEvents

router = APIRouter(
    prefix="/purchases",
    tags=["purchases"]
)

@router.post("", response_model=schemas.PurchaseOrderResponse)
async def create_purchase_order(order_data: schemas.PurchaseOrderCreate, db: Session = Depends(get_db)):
    """
    Create a new purchase order with automatic:
    - Multi-Warehouse Stock updates (ProductStock + Global)
    - Debt generation (if credit)
    - Cost price updates
    """
    try:
        if not order_data.items:
            raise HTTPException(status_code=400, detail="Agrega al menos un producto a la compra")

        valid_payment_types = {"CASH", "CREDIT"}
        if order_data.payment_type not in valid_payment_types:
            raise HTTPException(status_code=400, detail="Tipo de pago invalido. Usa contado o credito.")

        # Get supplier
        supplier = db.query(models.Supplier).filter(models.Supplier.id == order_data.supplier_id).first()
        if not supplier:
            raise HTTPException(status_code=404, detail="Proveedor no encontrado")

        # Validate Warehouse
        warehouse = db.query(models.Warehouse).filter(models.Warehouse.id == order_data.warehouse_id).first()
        if not warehouse:
             raise HTTPException(status_code=404, detail="Almacen destino no encontrado")
        
        # Calculate dates — prefer frontend-provided values, fall back to server defaults
        from datetime import datetime, timedelta
        purchase_date = order_data.purchase_date if order_data.purchase_date else datetime.now()
        if order_data.due_date:
            due_date = order_data.due_date
        else:
            due_date = purchase_date + timedelta(days=supplier.payment_terms or 30)

        # Create purchase order
        purchase = models.PurchaseOrder(
            supplier_id=order_data.supplier_id,
            warehouse_id=order_data.warehouse_id,
            invoice_number=order_data.invoice_number,
            notes=order_data.notes,
            total_amount=Decimal("0.00"),
            paid_amount=0.0,
            payment_status=models.PaymentStatus.PENDING,
            purchase_date=purchase_date,
            due_date=due_date,
            discount_amount=Decimal("0.00"),
            discount_type=order_data.discount_type or "NONE",
            discount_notes=order_data.discount_notes,
        )
        db.add(purchase)
        db.flush()  # Get purchase ID
        
        updated_products_info = []
        calculated_items_total = Decimal("0.00")

        # Process items
        for item in order_data.items:
            product_id = item.product_id

            # ── Herramienta 1: Producto rápido al vuelo ──────────
            if not product_id and item.quick_product:
                qp = item.quick_product
                new_prod = models.Product(
                    name=qp.name.strip(),
                    sku=qp.sku.strip() if qp.sku else None,
                    price=Decimal(str(qp.sale_price or item.unit_cost)),
                    cost_price=Decimal(str(item.unit_cost)),
                    stock=0,
                    is_active=True,
                    is_discount_active=False,
                    is_box=False,
                    is_combo=False,
                    is_service=False,
                    has_imei=bool(qp.has_imei),
                    category_id=qp.category_id,
                )
                db.add(new_prod)
                db.flush()
                product_id = new_prod.id

            if not product_id:
                raise HTTPException(status_code=400, detail="Cada linea de compra debe tener un producto o un producto rapido valido")

            product = db.query(models.Product).filter(models.Product.id == product_id).first()
            if not product:
                raise HTTPException(status_code=404, detail=f"Producto #{product_id} no encontrado")

            quantity = Decimal(str(item.quantity or 0))
            unit_cost = Decimal(str(item.unit_cost or 0))
            if quantity <= 0:
                raise HTTPException(status_code=400, detail=f"La cantidad de {product.name} debe ser mayor a cero")
            if unit_cost < 0:
                raise HTTPException(status_code=400, detail=f"El costo de {product.name} no puede ser negativo")

            serial_numbers = [str(sn).strip().upper() for sn in (item.serial_numbers or []) if str(sn).strip()]
            is_serialized = bool(getattr(product, 'has_imei', False))
            if is_serialized:
                if Decimal(str(item.quantity)) != Decimal(int(item.quantity)):
                    raise HTTPException(status_code=400, detail=f"El producto {product.name} maneja IMEI y requiere cantidad entera.")
                expected_serials = int(item.quantity)
                if not serial_numbers:
                    raise HTTPException(status_code=400, detail=f"El producto {product.name} maneja IMEI/Serial. Ingresa {expected_serials} IMEI(s) para registrar la compra.")
                if len(serial_numbers) != expected_serials:
                    raise HTTPException(status_code=400, detail=f"El producto {product.name} requiere {expected_serials} IMEI(s), pero recibio {len(serial_numbers)}.")
                repeated = sorted([serial for serial, count in Counter(serial_numbers).items() if count > 1])
                if repeated:
                    raise HTTPException(status_code=400, detail=f"{product.name}: hay IMEIs/seriales repetidos en esta linea: {', '.join(repeated[:5])}")
                existing_serials = db.query(models.ProductInstance.serial_number).filter(models.ProductInstance.serial_number.in_(serial_numbers)).all()
                if existing_serials:
                    existing = [row[0] for row in existing_serials]
                    raise HTTPException(status_code=400, detail=f"{product.name}: estos IMEIs/seriales ya existen en inventario: {', '.join(existing[:5])}")
            elif serial_numbers:
                raise HTTPException(status_code=400, detail=f"El producto {product.name} no maneja IMEI/Serial. Quita los seriales de esa linea.")

            # ── Herramienta 2: Descuento por ítem ────────────────
            disc_pct = Decimal(str(item.discount_pct or 0))
            disc_amount = Decimal(str(item.discount_amount or 0))
            if disc_pct < 0 or disc_pct > 100:
                raise HTTPException(status_code=400, detail=f"El descuento porcentual de {product.name} debe estar entre 0 y 100")
            if disc_amount < 0:
                raise HTTPException(status_code=400, detail=f"El descuento de {product.name} no puede ser negativo")
            gross_line_total = Decimal(str(item.unit_cost)) * Decimal(str(item.quantity))
            if disc_pct > 0:
                disc_amount = (gross_line_total * disc_pct / Decimal("100")).quantize(Decimal("0.0001"))
            disc_amount = max(Decimal("0.00"), min(disc_amount, gross_line_total))
            subtotal = (gross_line_total - disc_amount).quantize(Decimal("0.0001"))
            calculated_items_total += subtotal

            # SAVE PURCHASE ITEM (History)
            purchase_item = models.PurchaseItem(
                purchase_id=purchase.id,
                product_id=product.id,
                quantity=item.quantity,
                unit_cost=item.unit_cost,
                discount_pct=disc_pct,
                discount_amount=disc_amount,
                subtotal=subtotal,
                serial_numbers='\n'.join(serial_numbers) if serial_numbers else None,
            )
            db.add(purchase_item)

            # =================================================
            # MULTI-WAREHOUSE STOCK LOGIC
            # =================================================
            # 1. Update Specific Warehouse Stock
            product_stock = db.query(models.ProductStock).filter(
                models.ProductStock.product_id == product.id,
                models.ProductStock.warehouse_id == order_data.warehouse_id
            ).first()

            if not product_stock:
                # Create if not exists
                product_stock = models.ProductStock(
                    product_id=product.id,
                    warehouse_id=order_data.warehouse_id,
                    quantity=0
                )
                db.add(product_stock)
            
            product_stock.quantity += item.quantity

            # 2. Update Global Stock (Cache)
            old_stock = product.stock
            old_cost_price = product.cost_price # Capture old cost for margin calc
            product.stock += item.quantity
            
            # Update cost price (Last Cost / Replacement Cost Strategy)
            # User Preference: Newest purchase price overrides historical average
            if item.update_cost and item.unit_cost > 0:
                 product.cost_price = item.unit_cost
            
            # Update Sale Price (PVP) if requested
            if item.update_price:
                if item.new_sale_price and item.new_sale_price > 0:
                    # Direct update from frontend
                    product.price = item.new_sale_price
                elif item.update_cost and item.unit_cost > 0:
                     # Intelligent auto-update if only "update price" is checked but no value sent
                     # Use Replacment Cost Strategy (Item Unit Cost) to protect margin
                     tax_multiplier = Decimal(1) + (product.tax_rate / 100) if product.tax_rate else Decimal(1)
                     
                     # 1. Try to use stored profit margin
                     if product.profit_margin and product.profit_margin > 0:
                         margin_multiplier = Decimal(1) + (product.profit_margin / 100)
                         product.price = item.unit_cost * margin_multiplier * tax_multiplier
                     
                     # 2. Fallback: Calculate margin on-the-fly from current price/cost
                     # BUGFIX: Must use OLD cost to infer margin, not the new one we just set!
                     elif product.price > 0 and old_cost_price > 0:
                         # Reverse engineer current margin based on OLD dynamic
                         # Price = OldCost * (1+Margin) * (1+Tax) -> Margin = (Price / (OldCost * Tax)) - 1
                         current_base_price = product.price / tax_multiplier
                         current_margin = ((current_base_price / old_cost_price) - 1) * 100
                         
                         # Apply this historical margin to new cost
                         margin_multiplier = Decimal(1) + (current_margin / 100)
                         product.price = item.unit_cost * margin_multiplier * tax_multiplier
                         
                         # Update stored margin for consistency
                         product.profit_margin = current_margin
                     
                     # 3. Last Resort: Keep existing price (margin shrinks)
                     else:
                         pass # Price stays same, margin will be updated below automatically
 
            # Auto-update profit margin (Markup) based on new values
            cost_value = Decimal(str(product.cost_price or 0))
            price_value = Decimal(str(product.price or 0))
            if cost_value > 0 and price_value > 0:
                product.profit_margin = ((price_value - cost_value) / cost_value) * Decimal("100")

            if serial_numbers:
                for serial in serial_numbers:
                    db.add(models.ProductInstance(product_id=product.id, warehouse_id=order_data.warehouse_id, serial_number=serial, status=models.ProductInstanceStatus.AVAILABLE, cost=item.unit_cost, created_at=purchase_date))

            # Create Kardex entry LINKED TO WAREHOUSE
            kardex = models.Kardex(
                product_id=product.id,
                warehouse_id=order_data.warehouse_id, # IMPORTANT
                movement_type=models.MovementType.PURCHASE,
                quantity=item.quantity,
                balance_after=product.stock, # Note: Current Kardex balance logic is global, refactor later for per-warehouse balance
                description=f"Compra #{purchase.id} - {supplier.name}",
                date=purchase_date
            )
            db.add(kardex)
            
            # Collect info for broadcast
            updated_products_info.append({
                "id": product.id,
                "name": product.name,
                "price": float(product.price),
                "cost_price": float(product.cost_price), 
                "stock": float(product.stock),
                "profit_margin": float(product.profit_margin) if product.profit_margin else 0,
                "exchange_rate_id": product.exchange_rate_id
            })
        
        global_discount = Decimal(str(order_data.discount_amount or 0))
        global_discount = max(Decimal("0.00"), min(global_discount, calculated_items_total))
        purchase.discount_amount = global_discount
        if calculated_items_total <= 0:
            raise HTTPException(status_code=400, detail="El total de la compra debe ser mayor a cero")
        purchase.total_amount = (calculated_items_total - global_discount).quantize(Decimal("0.01"))

        # Update supplier balance if credit purchase
        if order_data.payment_type == 'CREDIT':
            supplier.current_balance += purchase.total_amount
        elif order_data.payment_type == 'CASH':
            # Mark as paid immediately
            purchase.paid_amount = purchase.total_amount
            purchase.payment_status = models.PaymentStatus.PAID
        
        # Flush all pending items/stock/kardex writes so the re-query below sees them
        db.flush()

        # 🔒 SECURITY: Eager Load relations BEFORE commit (v44)
        captured_id = purchase.id
        purchase = db.query(models.PurchaseOrder).options(
            joinedload(models.PurchaseOrder.supplier),
            joinedload(models.PurchaseOrder.warehouse),
            joinedload(models.PurchaseOrder.items).joinedload(models.PurchaseItem.product)
        ).filter(models.PurchaseOrder.id == captured_id).first()
        
        db.commit()
        
        # Final Event Emission (safe after commit)
        for p_info in updated_products_info:
            await manager.broadcast(WebSocketEvents.PRODUCT_UPDATED, p_info)
            await manager.broadcast(WebSocketEvents.PRODUCT_STOCK_UPDATED, {
                "id": p_info["id"], 
                "stock": p_info["stock"]
            })

        return schemas.PurchaseOrderResponse.model_validate(purchase)
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@router.get("", response_model=List[schemas.PurchaseOrderResponse])
def get_all_purchase_orders(status: Optional[str] = None, db: Session = Depends(get_db)):
    """Get all purchase orders, optionally filtered by status"""
    query = db.query(models.PurchaseOrder).options(
        joinedload(models.PurchaseOrder.supplier),
        joinedload(models.PurchaseOrder.warehouse),
        joinedload(models.PurchaseOrder.items).joinedload(models.PurchaseItem.product) # Load items and their products
    )
    
    if status:
        # Handle multiple statuses separated by comma
        if ',' in status:
            statuses = [s.strip() for s in status.split(',')]
            query = query.filter(models.PurchaseOrder.payment_status.in_(statuses))
        else:
            query = query.filter(models.PurchaseOrder.payment_status == status)
    
    return query.order_by(models.PurchaseOrder.purchase_date.desc()).all()

@router.get("/pending", response_model=List[schemas.PurchaseOrderResponse])
def get_pending_purchases(db: Session = Depends(get_db)):
    """Get all pending and partially paid purchases"""
    purchases = db.query(models.PurchaseOrder).options(
        joinedload(models.PurchaseOrder.supplier),
        joinedload(models.PurchaseOrder.warehouse),
        joinedload(models.PurchaseOrder.items).joinedload(models.PurchaseItem.product)
    ).filter(
        models.PurchaseOrder.payment_status.in_([models.PaymentStatus.PENDING, models.PaymentStatus.PARTIAL])
    ).order_by(models.PurchaseOrder.due_date).all()
    
    return purchases

@router.get("/{order_id}", response_model=schemas.PurchaseOrderResponse)
def get_purchase_order(order_id: int, db: Session = Depends(get_db)):
    """Get purchase order by ID"""
    order = db.query(models.PurchaseOrder).options(
        joinedload(models.PurchaseOrder.supplier),
        joinedload(models.PurchaseOrder.warehouse),
        joinedload(models.PurchaseOrder.items).joinedload(models.PurchaseItem.product)
    ).filter(models.PurchaseOrder.id == order_id).first()
    
    if not order:
        raise HTTPException(status_code=404, detail="Compra no encontrada")
    
    return order

@router.delete("/{purchase_id}", status_code=200)
async def void_purchase_order(
    purchase_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Void/delete a purchase order and reverse all stock movements.
    - Subtracts quantity from ProductStock and product.stock (global)
    - Creates a Kardex REVERSAL entry per item
    - Deletes the PurchaseOrder (cascade deletes items + payments)
    - Only ADMIN can void purchases
    """
    if current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Solo administradores pueden anular facturas de compra")

    purchase = db.query(models.PurchaseOrder).options(
        joinedload(models.PurchaseOrder.items).joinedload(models.PurchaseItem.product)
    ).filter(models.PurchaseOrder.id == purchase_id).first()

    if not purchase:
        raise HTTPException(status_code=404, detail="Factura de compra no encontrada")

    # Block only if there are explicit manual payment records registered after creation
    # Cash purchases (PAID at creation with no payment records) are allowed to be voided
    payment_count = db.query(models.PurchasePayment).filter(
        models.PurchasePayment.purchase_id == purchase_id
    ).count()
    if payment_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"No se puede anular: tiene {payment_count} pago(s) registrado(s). Revierta los pagos primero."
        )

    reversed_items = []
    updated_products_info = []
    for item in purchase.items:
        product = item.product
        if not product:
            continue

        qty = float(item.quantity)
        item_serials = [s.strip().upper() for s in (item.serial_numbers or '').replace(',', '\n').split() if s.strip()]
        if item_serials:
            instances = db.query(models.ProductInstance).filter(
                models.ProductInstance.product_id == product.id,
                models.ProductInstance.warehouse_id == purchase.warehouse_id,
                models.ProductInstance.serial_number.in_(item_serials)
            ).all()
            found = {inst.serial_number for inst in instances}
            missing = sorted(set(item_serials) - found)
            if missing:
                raise HTTPException(status_code=400, detail=f"No se puede anular: faltan IMEIs de la compra {', '.join(missing[:5])}")
            blocked = [inst.serial_number for inst in instances if inst.status != models.ProductInstanceStatus.AVAILABLE]
            if blocked:
                raise HTTPException(status_code=400, detail=f"No se puede anular: IMEIs ya no disponibles {', '.join(blocked[:5])}")
            for inst in instances:
                db.delete(inst)

        # Reverse warehouse stock
        qty_decimal = Decimal(str(item.quantity or 0))
        if purchase.warehouse_id:
            product_stock = db.query(models.ProductStock).filter(
                models.ProductStock.product_id == product.id,
                models.ProductStock.warehouse_id == purchase.warehouse_id
            ).first()
            if product_stock:
                product_stock.quantity = max(Decimal("0"), Decimal(str(product_stock.quantity or 0)) - qty_decimal)

        # Reverse global stock
        product.stock = max(Decimal("0"), Decimal(str(product.stock or 0)) - qty_decimal)

        # Kardex reversal entry
        kardex = models.Kardex(
            product_id=product.id,
            movement_type="ADJUSTMENT_OUT",
            quantity=-qty_decimal,
            balance_after=product.stock,
            description=f"ANULACION factura compra #{purchase.invoice_number or purchase.id}",
            warehouse_id=purchase.warehouse_id
        )
        db.add(kardex)
        reversed_items.append({"product_id": product.id, "name": product.name, "quantity": qty})
        updated_products_info.append({
            "id": product.id,
            "name": product.name,
            "price": float(product.price or 0),
            "cost_price": float(product.cost_price or 0),
            "stock": float(product.stock or 0),
            "profit_margin": float(product.profit_margin or 0),
            "exchange_rate_id": product.exchange_rate_id,
        })

    invoice_ref = purchase.invoice_number or f"#{purchase.id}"
    supplier = db.query(models.Supplier).filter(models.Supplier.id == purchase.supplier_id).first()
    if supplier:
        outstanding = max(
            Decimal("0.00"),
            Decimal(str(purchase.total_amount or 0)) - Decimal(str(purchase.paid_amount or 0))
        )
        if outstanding > 0:
            supplier.current_balance = max(Decimal("0.00"), Decimal(str(supplier.current_balance or 0)) - outstanding)

    db.delete(purchase)
    db.commit()

    for p_info in updated_products_info:
        await manager.broadcast(WebSocketEvents.PRODUCT_UPDATED, p_info)
        await manager.broadcast(WebSocketEvents.PRODUCT_STOCK_UPDATED, {
            "id": p_info["id"],
            "stock": p_info["stock"],
        })

    return {
        "message": f"Factura {invoice_ref} anulada correctamente",
        "reversed_items": reversed_items
    }

# Accounts Payable Endpoints

@router.post("/{purchase_id}/payment", response_model=schemas.PurchasePaymentResponse)
def register_payment(
    purchase_id: int,
    payment_data: schemas.PurchasePaymentCreate,
    db: Session = Depends(get_db)
):
    """Register a payment for a purchase order"""
    purchase = db.query(models.PurchaseOrder).filter(models.PurchaseOrder.id == purchase_id).first()
    
    if not purchase:
        raise HTTPException(status_code=404, detail="Compra no encontrada")
    
    if purchase.payment_status == models.PaymentStatus.PAID:
        raise HTTPException(status_code=400, detail="La compra ya esta pagada por completo")
    
    try:
        # Create payment record
        payment = models.PurchasePayment(
            purchase_id=purchase_id,
            amount=payment_data.amount,
            payment_method=payment_data.payment_method,
            reference=payment_data.reference,
            notes=payment_data.notes,
            currency=payment_data.currency,
            exchange_rate=payment_data.exchange_rate
        )
        db.add(payment)
        
        # Calculate Amount in USD (Anchor) for debt reduction
        amount_usd = float(payment_data.amount)
        if payment_data.currency != "USD":
            rate = float(payment_data.exchange_rate) if payment_data.exchange_rate and payment_data.exchange_rate > 0 else 1.0
            amount_usd = amount_usd / rate

        # Update purchase paid amount (in USD)
        purchase.paid_amount += Decimal(amount_usd)
        
        # Update payment status
        # Allow small floating point tolerance
        if purchase.paid_amount >= (purchase.total_amount - Decimal('0.01')):
            purchase.payment_status = models.PaymentStatus.PAID
            purchase.paid_amount = purchase.total_amount # Cap at total
        elif purchase.paid_amount > 0:
            purchase.payment_status = models.PaymentStatus.PARTIAL
        
        # Recalculate supplier balance
        supplier = db.query(models.Supplier).filter(models.Supplier.id == purchase.supplier_id).first()
        if supplier:
            # Recalculate total debt from all pending purchases
            # IMPORTANT: We can't just sum(total - paid) because paid_amount is now updated.
            # Ideally we re-query freely.
            
            pending_purchases = db.query(models.PurchaseOrder).filter(
                models.PurchaseOrder.supplier_id == supplier.id,
                models.PurchaseOrder.payment_status.in_([models.PaymentStatus.PENDING, models.PaymentStatus.PARTIAL])
            ).all()
            
            supplier.current_balance = sum(
                (p.total_amount - p.paid_amount) for p in pending_purchases
            )
        
        # Eager Load payment BEFORE commit (v44)
        captured_id = payment.id
        payment = db.query(models.PurchasePayment).options(
            joinedload(models.PurchasePayment.purchase)
        ).filter(models.PurchasePayment.id == captured_id).first()

        db.commit()

        return schemas.PurchasePaymentResponse.model_validate(payment)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{purchase_id}/payments", response_model=List[schemas.PurchasePaymentResponse])
def get_purchase_payments(purchase_id: int, db: Session = Depends(get_db)):
    """Get all payments for a purchase order"""
    purchase = db.query(models.PurchaseOrder).filter(models.PurchaseOrder.id == purchase_id).first()
    
    if not purchase:
        raise HTTPException(status_code=404, detail="Compra no encontrada")
    
    payments = db.query(models.PurchasePayment).filter(
        models.PurchasePayment.purchase_id == purchase_id
    ).order_by(models.PurchasePayment.payment_date.desc()).all()
    
    return payments


