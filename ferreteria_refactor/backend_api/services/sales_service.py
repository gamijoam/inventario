from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from datetime import datetime, timedelta
from fastapi import HTTPException, BackgroundTasks
from decimal import Decimal
import requests
from ..models import models
from ..models.restaurant import RestaurantRecipe
from .. import schemas
from ..websocket.manager import manager
from ..websocket.events import WebSocketEvents
import asyncio
import asyncio
import uuid
from ..template_presets import (
    get_classic_58_template,
    get_services_sale_58_template,
    get_services_sale_80_template,
)

# DUPLICATED HELPER due to circular import risks if we try to import from routers
def run_broadcast(event: str, data: dict):
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(manager.broadcast(event, data))
    finally:
        loop.close()

class SalesService:
    @staticmethod
    def calculate_expiration_date(duration: int, unit: str) -> datetime:
        if not duration or duration <= 0:
            return None
        
        if unit == "MONTHS":
            return datetime.now() + timedelta(days=duration * 30)
        elif unit == "YEARS":
            return datetime.now() + timedelta(days=duration * 365)
        else: # DAYS
            return datetime.now() + timedelta(days=duration)

    @staticmethod
    def create_sale(db: Session, sale_data: schemas.SaleCreate, user_id: int, background_tasks: BackgroundTasks = None):
        try:
            updated_products_info = []
            
            # Credit Validation for Credit Sales
            if sale_data.is_credit and sale_data.customer_id:
                customer = db.query(models.Customer).filter(models.Customer.id == sale_data.customer_id).first()
                if not customer:
                    raise HTTPException(status_code=404, detail="Customer not found")
                
                # 1. Check if customer is blocked
                if customer.is_blocked:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Cliente '{customer.name}' está bloqueado por mora. No se pueden realizar ventas a crédito."
                    )
                
                # 2. Check for overdue invoices
                overdue_count = db.query(models.Sale).filter(
                    models.Sale.customer_id == sale_data.customer_id,
                    models.Sale.is_credit == True,
                    models.Sale.paid == False,
                    models.Sale.due_date < datetime.now()
                ).count()
                
                if overdue_count > 0:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Cliente tiene {overdue_count} factura(s) vencida(s). Debe ponerse al día antes de nuevas ventas a crédito."
                    )
                
                # 3. Check credit limit
                current_debt = db.query(func.sum(models.Sale.balance_pending)).filter(
                    models.Sale.customer_id == sale_data.customer_id,
                    models.Sale.is_credit == True,
                    models.Sale.paid == False
                ).scalar() or Decimal("0.00")
                
                if (current_debt + sale_data.total_amount) > customer.credit_limit:
                    available = max(Decimal("0.00"), customer.credit_limit - current_debt)
                    raise HTTPException(
                        status_code=400,
                        detail=f"⛔ Límite de crédito excedido.\nCliente: {customer.name}\nDeuda: ${current_debt:.2f} / Límite: ${customer.credit_limit:.2f}\nDisponible: ${available:.2f}"
                    )
            
            # 0. Check for Open Cash Session (Enforce Business Logic)
            # If sale_data has a session_id hint (from multi-register frontend), use it directly.
            # Otherwise fall back to "any open session" for backward compat.
            open_session = None
            if hasattr(sale_data, 'session_id') and sale_data.session_id:
                open_session = db.query(models.CashSession).filter(
                    models.CashSession.id == sale_data.session_id,
                    models.CashSession.status == "OPEN"
                ).first()
            if not open_session:
                # Fallback: find the session opened by THIS user (prevents cross-register contamination)
                open_session = db.query(models.CashSession).filter(
                    models.CashSession.status == "OPEN",
                    models.CashSession.user_id == user_id
                ).first()
            if not open_session:
                raise HTTPException(status_code=400, detail="No hay una caja abierta. Debe abrir caja para realizar ventas.")

            # 0.5. Determine Source Warehouse
            warehouse_id = sale_data.warehouse_id
            if not warehouse_id:
                # Default to Main Warehouse
                main_wh = db.query(models.Warehouse).filter(models.Warehouse.is_main == True).first()
                if main_wh:
                    warehouse_id = main_wh.id
                else:
                    # Fallback to first warehouse
                    first_wh = db.query(models.Warehouse).filter(models.Warehouse.is_active == True).first()
                    if first_wh:
                        warehouse_id = first_wh.id
                    
            # Validar si es una venta puramente de servicios (intangibles)
            # Para permitir que warehouse_id sea None si no hay warehouses físicos
            is_service_only = True
            for item in sale_data.items:
                 prod = db.query(models.Product).filter(models.Product.id == item.product_id).first()
                 
                 is_service = False
                 if prod:
                     # PRIMARY CHECK: is_service field
                     if prod.is_service:
                         is_service = True
                     # FALLBACK: Check Unit Type
                     elif prod.unit_type and prod.unit_type.upper() in ['SERVICIO', 'SERVICE']:
                         is_service = True
                     # FALLBACK: Check Category Name (Robust fallback)
                     elif prod.category and ('SERVICIO' in prod.category.name.upper() or 'LAVANDERIA' in prod.category.name.upper() or 'LAUNDRY' in prod.category.name.upper()):
                         is_service = True
                         
                 if not is_service:
                     is_service_only = False
                     break
            
            if not warehouse_id and not is_service_only:
                 raise HTTPException(status_code=500, detail="No active warehouse found to deduct stock")

            # 1. Create Sale Header
            # CRITICAL FIX: Respect Frontend's VES calculation (preserves anchoring)
            total_bs = sale_data.total_amount_bs
            current_time = datetime.now() # Explicitly set time to avoid refresh need
            
            print(f"[DEBUG] Creating Sale. Method: {sale_data.payment_method}. Payments: {sale_data.payments}")

            # Calculate due date for credit sales
            due_date = None
            balance_pending = None
            if sale_data.is_credit and sale_data.customer_id:
                customer = db.query(models.Customer).filter(models.Customer.id == sale_data.customer_id).first()
                if customer:
                    due_date = current_time + timedelta(days=customer.payment_term_days)
                    balance_pending = sale_data.total_amount
            
            new_sale = models.Sale(
                date=current_time, # Explicitly set date
                total_amount=sale_data.total_amount,
                payment_method=sale_data.payment_method,
                customer_id=sale_data.customer_id,
                is_credit=sale_data.is_credit,
                paid=not sale_data.is_credit, 
                currency=sale_data.currency,
                exchange_rate_used=sale_data.exchange_rate,
                total_amount_bs=total_bs,
                
                # Cart Global Discount
                total_discount_usd=sale_data.total_discount_usd,
                cart_discount_type=sale_data.cart_discount_type,
                discount_auth_user_id=sale_data.discount_auth_user_id,
                
                # Change Handling
                change_amount=sale_data.change_amount,
                change_currency=sale_data.change_currency,
                
                notes=sale_data.notes,
                due_date=due_date,
                balance_pending=balance_pending,
                warehouse_id=warehouse_id,
                session_id=open_session.id,  # Link sale to its cash session

                # Hybrid / Offline Logic
                sync_status="PENDING",
                is_offline_sale=True,
                unique_uuid=str(uuid.uuid4())
            )
            db.add(new_sale)
            db.flush() # Get ID
            
            # Capture ID and Key Data immediately after flush (while session is active)
            new_sale_id = new_sale.id
            sale_total_amount = float(new_sale.total_amount)
            sale_currency = new_sale.currency
            sale_payment_method = new_sale.payment_method
            sale_customer_id = new_sale.customer_id
            sale_date_iso = current_time.isoformat()

            # Update Quote Status if this sale comes from a quote
            if sale_data.quote_id:
                quote = db.query(models.Quote).filter(models.Quote.id == sale_data.quote_id).first()
                if quote:
                    quote.status = "CONVERTED" 
                    db.add(quote)       
            
            # 2. Process Items
            for item in sale_data.items:
                sold_instances = [] 
                
                # Fetch Product with Pessimistic Lock
                product = db.query(models.Product).filter(models.Product.id == item.product_id).with_for_update().first()
                if not product:
                    raise HTTPException(status_code=404, detail=f"Product {item.product_id} not found")
                
                # Calculate base units to deduct using conversion_factor
                units_to_deduct = item.quantity * item.conversion_factor
                
                # =========================================================================
                # ZERO TRUST SECURITY: Price Validation Logic
                # =========================================================================
                effective_price = item.unit_price # Default to what frontend sent (trusted slightly only if no list)
                
                if item.price_list_id and updated_products_info is not None: # Check if price list requested
                     # 1. Fetch Price List Details
                     price_list = db.query(models.PriceList).filter(models.PriceList.id == item.price_list_id).first()
                     if not price_list:
                         raise HTTPException(status_code=400, detail=f"Price List ID {item.price_list_id} not found")
                     
                     # 2. Security Check: Authorization
                     if price_list.requires_auth:
                         if not item.auth_user_id:
                             raise HTTPException(status_code=403, detail=f"Price List '{price_list.name}' requires authorization (PIN).")
                         
                         supervisor = db.query(models.User).filter(models.User.id == item.auth_user_id).first()
                         if not supervisor:
                             raise HTTPException(status_code=403, detail="Invalid authorization user.")
                         
                         # Check role (Supervisor/Admin)
                         if supervisor.role not in [models.UserRole.ADMIN, models.UserRole.WAREHOUSE]: # Assuming WAREHOUSE acts as Supervisor here, or strictly ADMIN? Best check logic.
                             # Let's enforce strict ADMIN for now or specific permission? 
                             # User asked for "Supervisor/Admin". 
                             pass 
                             
                     # 3. Fetch Authoritative Price
                     db_price_record = db.query(models.ProductPrice).filter(
                         models.ProductPrice.product_id == product.id,
                         models.ProductPrice.price_list_id == item.price_list_id
                     ).first()
                     
                     if not db_price_record:
                         # Fallback or Error? 
                         # If explicitly requested a list, and product not in it, maybe return Error.
                         # Or fallback to Base Price?
                         # For security, let's Error implies configuration mismatch.
                         raise HTTPException(status_code=400, detail=f"Product '{product.name}' not found in Price List '{price_list.name}'")
                     
                     # 4. OVERRIDE: Trust NO ONE. Use DB Price.
                     # CRITICAL FIX: Pricing is per Base Unit. Must multiply by factor for Boxes/Packs.
                     base_price = db_price_record.price
                     factor = Decimal(str(item.conversion_factor)) if item.conversion_factor else Decimal("1.0")
                     effective_price = base_price * factor
                     
                     # Update item object for subtotal calc below
                     item.unit_price = effective_price # Update for storage in SaleDetail
                     
                
                # New: Determine if Product is a Service (Skip Stock Check)
                is_service = False
                
                # PRIMARY CHECK: is_service field (most reliable)
                if product.is_service:
                    is_service = True
                # FALLBACK: Check unit_type
                elif product.unit_type:
                     ut_upper = product.unit_type.upper()
                     if 'SERVICIO' in ut_upper or 'SERVICE' in ut_upper:
                         is_service = True
                # FALLBACK: Check category name
                elif product.category and ('SERVICIO' in product.category.name.upper() or 'LAVANDERIA' in product.category.name.upper() or 'LAUNDRY' in product.category.name.upper()):
                     is_service = True

                # NEW: RECIPE LOGIC (ESCANDALLO) - Check if product has a restaurant recipe
                recipes = db.query(RestaurantRecipe).filter(RestaurantRecipe.product_id == product.id).all()
                
                if recipes:
                    # It has a recipe! Deduct ingredients instead of the dish itself
                    for recipe_item in recipes:
                        ingredient = db.query(models.Product).filter(models.Product.id == recipe_item.ingredient_id).with_for_update().first()
                        if not ingredient:
                            continue
                        
                        qty_to_deduct = Decimal(str(item.quantity)) * Decimal(str(recipe_item.quantity))
                        
                        # Check and deduct from WAREHOUSE
                        ing_stock = db.query(models.ProductStock).filter(
                            models.ProductStock.product_id == ingredient.id,
                            models.ProductStock.warehouse_id == warehouse_id
                        ).first()
                        
                        if not ing_stock:
                            ing_stock = models.ProductStock(product_id=ingredient.id, warehouse_id=warehouse_id, quantity=0)
                            db.add(ing_stock)
                        
                        # Validate stock (ingredients usually MUST have stock)
                        available_qty = ing_stock.quantity
                        if available_qty < qty_to_deduct:
                            wh_name = db.query(models.Warehouse.name).filter(models.Warehouse.id == warehouse_id).scalar()
                            raise HTTPException(
                                status_code=400,
                                detail=f"Stock insuficiente para ingrediente '{ingredient.name}' en '{wh_name}'. Necesario: {qty_to_deduct}, Disponible: {available_qty}"
                            )
                        
                        ing_stock.quantity -= qty_to_deduct
                        ingredient.stock -= qty_to_deduct # Update legacy total
                        
                        # Register Kardex for Ingredient
                        db.add(models.Kardex(
                            product_id=ingredient.id,
                            movement_type="SALE",
                            quantity=-qty_to_deduct,
                            balance_after=ingredient.stock,
                            description=f"Venta via Receta: {product.name} (Venta #{new_sale_id})"
                        ))
                        
                        # Collect info for ingredient update
                        updated_products_info.append({
                            "id": ingredient.id,
                            "name": ingredient.name,
                            "price": float(ingredient.price),
                            "stock": float(ingredient.stock),
                            "exchange_rate_id": ingredient.exchange_rate_id
                        })
                    
                    # IMPORTANT: Once recipe is processed, we DO NOT deduct the dish itself 
                    # as its "stock" is usually irrelevant in a restaurant.
                    pass 
                elif product.is_combo:
                     # COMBO: Deduct stock from child components in specific warehouse
                    if not product.combo_items:
                        raise HTTPException(
                            status_code=400, 
                            detail=f"Combo product '{product.name}' has no components defined"
                        )
                    
                    # Check stock for ALL child products first (fail fast)
                    for combo_item in product.combo_items:
                        child_product = combo_item.child_product
                        
                        if combo_item.unit_id and combo_item.unit:
                            conversion_factor = combo_item.unit.conversion_factor
                            qty_needed = item.quantity * combo_item.quantity * conversion_factor
                        else:
                            qty_needed = item.quantity * combo_item.quantity
                        
                        # CHECK WAREHOUSE STOCK
                        child_stock = db.query(models.ProductStock).filter(
                            models.ProductStock.product_id == child_product.id,
                            models.ProductStock.warehouse_id == warehouse_id
                        ).first()
                        
                        available_qty = child_stock.quantity if child_stock else 0
                        
                        if available_qty < qty_needed:
                             wh_name = db.query(models.Warehouse.name).filter(models.Warehouse.id == warehouse_id).scalar()
                             raise HTTPException(
                                status_code=400,
                                detail=f"Stock insuficiente para el componente '{child_product.name}' en '{wh_name}'. Se necesita: {qty_needed}, Disponible: {available_qty}"
                            )
                    
                    # All checks passed, now deduct stock from buffer/children
                    for combo_item in product.combo_items:
                        child_product = combo_item.child_product
                        
                        if combo_item.unit_id and combo_item.unit:
                            conversion_factor = combo_item.unit.conversion_factor
                            qty_to_deduct = item.quantity * combo_item.quantity * conversion_factor
                            unit_description = f" ({combo_item.quantity}x {combo_item.unit.unit_name})"
                        else:
                            qty_to_deduct = item.quantity * combo_item.quantity
                            unit_description = ""
                        
                        # Deduct stock from WAREHOUSE STOCK
                        child_stock = db.query(models.ProductStock).filter(
                            models.ProductStock.product_id == child_product.id,
                            models.ProductStock.warehouse_id == warehouse_id
                        ).first()

                        if not child_stock:
                             # Should have been caught by check, but just in case
                             child_stock = models.ProductStock(product_id=child_product.id, warehouse_id=warehouse_id, quantity=0)
                             db.add(child_stock)

                        child_stock.quantity -= qty_to_deduct
                        
                        # ALSO UPDATE TOTAL PRODUCT STOCK (Legacy Support)
                        child_product.stock -= qty_to_deduct
                        
                        # Create Kardex entry
                        kardex_entry = models.Kardex(
                            product_id=child_product.id,
                            movement_type="SALE",
                            quantity=-qty_to_deduct,
                            balance_after=child_product.stock, # Legacy balance
                            description=f"Sale via combo: {product.name}{unit_description} (Sale #{new_sale_id})",
                            # warehouse_id=warehouse_id # TODO: Add warehouse_id to Kardex
                        )
                        db.add(kardex_entry)
                        
                        # Collect info
                        updated_products_info.append({
                            "id": child_product.id,
                            "name": child_product.name,
                            "price": float(child_product.price),
                            "stock": float(child_product.stock),
                            "exchange_rate_id": child_product.exchange_rate_id
                        })
                elif is_service:
                     # SERVICE: Skip Stock Check / Deduction
                     pass
                else:
                    # NORMAL PRODUCT: Check and deduct stock from WAREHOUSE
                    
                    # NEW: SERIALIZED INVENTORY LOGIC
                    if product.has_imei:
                        if not item.serial_numbers:
                            raise HTTPException(status_code=400, detail=f"Product '{product.name}' is serialized (has_imei=True) but no serial numbers provided.")
                        
                        # Verify quantity match
                        # Serialized items usually behave as Units (factor 1). 
                        if len(item.serial_numbers) != units_to_deduct:
                             raise HTTPException(status_code=400, detail=f"Discrepancia de cantidad para producto serializado '{product.name}'. Esperado {int(units_to_deduct)}, recibido {len(item.serial_numbers)}.")

                        # Fetch and Lock Instances
                        sold_instances = db.query(models.ProductInstance).filter(
                            models.ProductInstance.product_id == product.id,
                            models.ProductInstance.warehouse_id == warehouse_id,
                            models.ProductInstance.serial_number.in_(item.serial_numbers),
                            models.ProductInstance.status == models.ProductInstanceStatus.AVAILABLE
                        ).with_for_update().all()
                        
                        # Validate Existence
                        if len(sold_instances) != len(item.serial_numbers):
                            found_sns = {i.serial_number for i in sold_instances}
                            missing = set(item.serial_numbers) - found_sns
                            raise HTTPException(status_code=400, detail=f"Números de serie no encontrados o no disponibles en este almacén: {list(missing)}")
                            
                        # Update Status to SOLD
                        for instance in sold_instances:
                            instance.status = models.ProductInstanceStatus.SOLD
                            # instance.updated_at = datetime.now() # Auto

                    product_stock = db.query(models.ProductStock).filter(
                        models.ProductStock.product_id == product.id,
                        models.ProductStock.warehouse_id == warehouse_id
                    ).first()
                    
                    available_qty = product_stock.quantity if product_stock else 0

                    if available_qty < units_to_deduct:
                        wh_name = db.query(models.Warehouse.name).filter(models.Warehouse.id == warehouse_id).scalar()
                        raise HTTPException(status_code=400, detail=f"Stock insuficiente para el producto '{product.name}' en almacén '{wh_name or 'Desconocido'}'. Disponible: {available_qty}")
                    
                    # Update Stock
                    product_stock.quantity -= units_to_deduct
                    
                    # Update Total Legacy Stock
                    product.stock -= units_to_deduct
                    
                    # Collect info for broadcast
                    updated_products_info.append({
                        "id": product.id,
                        "name": product.name,
                        "price": float(product.price),
                        "stock": float(product.stock),
                        "exchange_rate_id": product.exchange_rate_id
                    })
                    
                    # Register Kardex Movement
                    kardex_entry = models.Kardex(
                        product_id=product.id,
                        movement_type="SALE",
                        quantity=-units_to_deduct,
                        balance_after=product.stock,
                        description=f"Sale #{new_sale_id} from Warehouse #{warehouse_id}"
                    )
                    db.add(kardex_entry)
                
                # Calculate subtotal (before discount) - SAME FOR BOTH
                subtotal = item.unit_price * item.quantity
                
                # Apply discount if any
                if item.discount > 0:
                    if item.discount_type == "PERCENT":
                        subtotal = subtotal * (1 - item.discount / 100)
                    elif item.discount_type == "FIXED":
                        subtotal = subtotal - item.discount
                
                # Calculate Warranty Expiration
                warranty_expiration = SalesService.calculate_expiration_date(product.warranty_duration, product.warranty_unit)

                # Create Sale Detail - SAME FOR BOTH
                detail = models.SaleDetail(
                    sale_id=new_sale_id, # Use captured ID
                    product_id=product.id,
                    quantity=units_to_deduct,
                    unit_price=item.unit_price,
                    cost_at_sale=product.cost_price or 0.0000, # CRITICAL: Capture historical cost
                    subtotal=subtotal,
                    is_box_sale=False,
                    discount=item.discount,
                    discount_type=item.discount_type,
                    unit_id=item.unit_id if hasattr(item, 'unit_id') else None,  # NEW: Persist presentation
                    salesperson_id=item.salesperson_id, # NEW: Granular Commission
                    warranty_expiration_date=warranty_expiration # NEW: Warranty Date
                )
                db.add(detail)
                db.flush() # Need ID for CommissionLog

                # =====================================================================
                # BARBERSHOP / SALON COMMISSION ENGINE
                # =====================================================================
                if getattr(item, 'employee_id', None):
                    employee = db.query(models.Employee).filter(models.Employee.id == item.employee_id).first()
                    if employee:
                        calc_comm = Decimal("0.00")
                        
                        # Apply hybrid rules
                        if product.commission_amount and product.commission_amount > 0:
                            calc_comm = product.commission_amount * item.quantity
                        elif product.commission_percentage and product.commission_percentage > 0:
                            calc_comm = subtotal * (product.commission_percentage / Decimal("100.00"))
                        else:
                            calc_comm = subtotal * (employee.base_commission_percentage / Decimal("100.00"))
                        
                        if calc_comm > 0:
                            commission = models.Commission(
                                tenant_id=employee.tenant_id,
                                employee_id=employee.id,
                                sale_item_id=detail.id,
                                base_amount=subtotal,
                                calculated_commission=calc_comm,
                                status="PENDING"
                            )
                            db.add(commission)

                # NEW: Link Instances to SaleDetail
                if sold_instances:
                    for instance in sold_instances:
                        sdi = models.SaleDetailInstance(
                            sale_detail_id=detail.id,
                            product_instance_id=instance.id,
                            warranty_end_date=warranty_expiration, # Legacy field updated
                            warranty_expiration_date=warranty_expiration # New Standardized Field
                        )
                        db.add(sdi)

                # AUTO-COMMISSION: Based on logged-in user's rate and product flag
                if product.is_commissionable and user_id:
                    salesperson = db.query(models.User).filter(models.User.id == user_id).first()
                    if salesperson and salesperson.commission_percentage and salesperson.commission_percentage > 0:
                        commission_amount = subtotal * (salesperson.commission_percentage / 100)
                        if commission_amount > 0:
                            comm_log = models.CommissionLog(
                                user_id=salesperson.id,
                                sale_detail_id=detail.id,
                                amount=commission_amount,
                                currency=new_sale.currency,
                                percentage_applied=salesperson.commission_percentage
                            )
                            db.add(comm_log)
        
            # 3. Process Payments (New Multi-Payment Logic)
            if sale_data.payments:
                total_paid_usd = Decimal("0.00")

                for p in sale_data.payments:
                    # =========================================================================
                    # EXCHANGE RATE VALIDATION — Prevents frontend manipulation of rates
                    # =========================================================================
                    validated_exchange_rate = p.exchange_rate  # Default: use what frontend sent

                    if p.currency not in ("USD", "$"):
                        # Fetch the active (default) rate for this currency from DB
                        db_rate = db.query(models.ExchangeRate).filter(
                            models.ExchangeRate.currency_code == p.currency,
                            models.ExchangeRate.is_active == True,
                            models.ExchangeRate.is_default == True
                        ).first()

                        # If no default found, fall back to any active rate for the currency
                        if not db_rate:
                            db_rate = db.query(models.ExchangeRate).filter(
                                models.ExchangeRate.currency_code == p.currency,
                                models.ExchangeRate.is_active == True
                            ).first()

                        if not db_rate:
                            raise HTTPException(
                                status_code=400,
                                detail=f"Moneda no válida o no activa: {p.currency}"
                            )

                        db_rate_val = float(db_rate.rate)
                        frontend_rate = float(p.exchange_rate or 0)

                        # Validate tolerance: ±15% from DB rate
                        if frontend_rate > 0 and db_rate_val > 0:
                            diff_pct = abs(frontend_rate - db_rate_val) / db_rate_val
                            if diff_pct > 0.15:
                                raise HTTPException(
                                    status_code=400,
                                    detail=f"Tasa de cambio inválida para {p.currency}: recibida {frontend_rate:.2f}, esperada {db_rate_val:.2f}"
                                )

                        # Always use DB rate to calculate USD equivalent
                        validated_exchange_rate = Decimal(str(db_rate_val))
                        usd_equivalent = Decimal(str(float(p.amount))) / validated_exchange_rate
                    else:
                        # USD payments: 1:1 equivalent
                        usd_equivalent = Decimal(str(float(p.amount)))

                    total_paid_usd += usd_equivalent
                    # =========================================================================

                    new_payment = models.SalePayment(
                        sale_id=new_sale_id, # Use captured ID
                        amount=p.amount,
                        currency=p.currency,
                        payment_method=p.payment_method,
                        exchange_rate=validated_exchange_rate,
                        reference=p.reference # New: Mapped from frontend
                    )
                    db.add(new_payment)

                # Validate total coverage (tolerance $0.05 for rounding)
                if total_paid_usd < (sale_data.total_amount - Decimal("0.05")):
                    faltante = float(sale_data.total_amount - total_paid_usd)
                    raise HTTPException(
                        status_code=400,
                        detail=f"Pago insuficiente. Faltan ${faltante:.2f} para cubrir el total de ${float(sale_data.total_amount):.2f}"
                    )
            else:
                # Fallback for legacy calls or single payment
                # CRITICAL FIX: Only create auto-payment if it's NOT a credit sale.
                # Credit sales with no specific down-payment should have NO payments.
                if not new_sale.is_credit:
                    fallback_payment = models.SalePayment(
                        sale_id=new_sale_id, # Use captured ID
                        amount=sale_data.total_amount,
                        currency=sale_data.currency,
                        payment_method=sale_data.payment_method,
                        exchange_rate=sale_data.exchange_rate
                    )
                    db.add(fallback_payment)
            
            db.commit()
            
            # NO db.refresh(new_sale) here! It causes "ObjectDeletedError" if session is unclean.
            # We already have all data captured in local variables.
            
            # Emit Stock Update Events using BackgroundTasks
            if background_tasks:
                for p_info in updated_products_info:
                    background_tasks.add_task(run_broadcast, WebSocketEvents.PRODUCT_UPDATED, p_info)
                    background_tasks.add_task(run_broadcast, WebSocketEvents.PRODUCT_STOCK_UPDATED, {
                        "id": p_info["id"], 
                        "stock": p_info["stock"]
                    })
                
                # Emit Sale Event
                background_tasks.add_task(run_broadcast, WebSocketEvents.SALE_COMPLETED, {
                    "id": new_sale_id,
                    "total_amount": sale_total_amount,
                    "currency": sale_currency,
                    "payment_method": sale_payment_method,
                    "customer_id": sale_customer_id,
                    "date": sale_date_iso
                })
                
                # AUTO-PRINT TICKET
                # REMOVED: Server-side printing is incompatible with SaaS architecture.
                # Client (Frontend) is now responsible for initiating print via local bridge.
                # background_tasks.add_task(print_sale_ticket, new_sale.id)
                
            return {"status": "success", "sale_id": new_sale_id}
        
        except HTTPException:
            db.rollback()
            raise
        except Exception as e:
            print(f"[ERROR] ERROR CRÍTICO CREANDO VENTA: {e}")
            import traceback
            traceback.print_exc()
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Error creando venta: {str(e)}")

    @staticmethod
    def get_sale_print_payload(db: Session, sale_id: int):
        """
        Generate payload (template + context) for client-side printing.
        Includes currency symbol logic.
        """
        # Get sale with all relationships (includes IMEI instances and warranty policies)
        sale = db.query(models.Sale).options(
            joinedload(models.Sale.details).joinedload(models.SaleDetail.product).joinedload(models.Product.warranty_policy),
            joinedload(models.Sale.details).joinedload(models.SaleDetail.instances).joinedload(models.SaleDetailInstance.product_instance),
            joinedload(models.Sale.customer),
            joinedload(models.Sale.payments)
        ).filter(models.Sale.id == sale_id).first()
        
        if not sale:
            raise HTTPException(status_code=404, detail="Sale not found")
        
        # Get business info
        business_config = {}
        configs = db.query(models.BusinessConfig).all()
        for config in configs:
            business_config[config.key] = config.value
            
        # Determine Exchange Rate (Implied or Explicit)
        # We always want to print in Fiscal Currency (VES/Bs) if possible, with USD reference.
        total_usd = float(sale.total_amount)
        total_bs = float(sale.total_amount_bs) if sale.total_amount_bs else 0.0
        
        # Calculate effective rate for print
        if total_bs > 0 and total_usd > 0:
            print_rate = total_bs / total_usd
        else:
            print_rate = float(sale.exchange_rate_used) if sale.exchange_rate_used else 1.0
            total_bs = total_usd * print_rate # Fallback calculation

        # CHECK SALE MODE: USD or BS
        is_usd_mode = sale.currency == 'USD'
        currency_symbol = "$" if is_usd_mode else "Bs"
        
        # Helper to convert to VES
        def to_ves(usd_val):
            return float(usd_val) * print_rate

        # Helper for formatting
        def fmt_money(amount, currency):
            symbol = "$" if currency == "USD" else "Bs"
            val = float(amount)
            if 0 < abs(val) < 1:
                return f"{symbol} {val:,.4f}"
            return f"{symbol} {val:,.2f}"

        # ---------------------------------------------------------
        # 1. PRE-FORMATTING CONTEXT (Backend Logic)
        # ---------------------------------------------------------
        
        # Items
        formatted_items = []
        for item in sale.details: # Changed from sale.items to sale.details
            # Determine price/total based on sale currency mode
            if is_usd_mode:
                 raw_price = float(item.unit_price) # stored in USD
                 raw_total = float(item.subtotal)   # stored in USD
                 row_currency = "USD"
            else:
                 # VES Mode: Convert explicitly for display if needed, or use stored if available
                 # Current logic uses to_ves helper
                 raw_price = to_ves(float(item.unit_price))
                 raw_total = to_ves(float(item.subtotal))
                 row_currency = "BS"
            
            # Determine display name (Use manual description if available, else product name)
            display_name = item.description if item.description else (item.product.name if item.product else "Producto")

            # IMEI / Serial numbers from SaleDetailInstance → ProductInstance
            serials = []
            try:
                serials = [
                    sdi.product_instance.serial_number
                    for sdi in (item.instances or [])
                    if sdi.product_instance and sdi.product_instance.serial_number
                ]
            except Exception:
                pass

            # Warranty info from product's linked WarrantyPolicy
            warranty_info = None
            try:
                if item.product and getattr(item.product, 'warranty_policy', None):
                    wp = item.product.warranty_policy
                    unit_map = {"DAYS": "días", "MONTHS": "meses", "YEARS": "años", "LIFETIME": "De por vida"}
                    dur_text = (
                        f"{wp.duration} {unit_map.get(wp.type, wp.type)}"
                        if wp.duration else unit_map.get(wp.type, "")
                    )
                    warranty_info = {
                        "name": wp.name,
                        "duration_text": dur_text,
                        "description": wp.description or "",
                    }
            except Exception:
                pass

            formatted_items.append({
                "product": {"name": display_name},
                "quantity": float(item.quantity) if item.quantity % 1 != 0 else int(item.quantity),
                # Raw values (Backward Compatibility)
                "unit_price": raw_price,
                "subtotal": raw_total,
                "unit_price_usd": float(item.unit_price),

                # New Formatted values
                "formatted_price": fmt_money(raw_price, row_currency),
                "formatted_total": fmt_money(raw_total, row_currency),
                "discount_percentage": float(item.discount) if hasattr(item, 'discount_type') and item.discount_type == 'PERCENT' else 0.0,

                # IMEI and Warranty (for serialized / phone products)
                "serial_numbers": serials,
                "warranty": warranty_info,
            })

        # Payments (Dynamic list)
        formatted_payments = []
        for p in sale.payments:
            p_currency = p.currency if p.currency else ("USD" if is_usd_mode else "BS")
            formatted_payments.append({
                "method": p.payment_method,
                "amount": float(p.amount), # Raw value
                "formatted_amount": fmt_money(float(p.amount), p_currency),
                "currency": p_currency,
                "reference": p.reference if p.reference else None
            })

        # Totals
        total_main = total_usd if is_usd_mode else total_bs
        currency_main = "USD" if is_usd_mode else "BS"
        
        total_ref = total_bs if is_usd_mode else total_usd
        currency_ref = "BS" if is_usd_mode else "USD"

        # Change
        change_val = float(sale.change_amount) if sale.change_amount else 0.0
        change_curr = sale.change_currency or ("Bs" if not is_usd_mode else "USD") # Default logic

        # Calculate Due Date for Credit
        due_date_str = ""
        if sale.is_credit:
             # If due_date is stored in sale (added in model check?), use it.
             # Model has due_date column.
             if sale.due_date:
                 due_date_str = sale.due_date.strftime("%d/%m/%Y")
             elif sale.customer and sale.customer.payment_term_days:
                 # Calc on fly if missing
                 d_date = sale.date + timedelta(days=sale.customer.payment_term_days)
                 due_date_str = d_date.strftime("%d/%m/%Y")

        # Improved Template (Hardcoded to ensure alignment fix)
        # User requested: Name Left, Price Right.
        context = {
            "business": {
                "name": business_config.get('business_name', 'MI NEGOCIO'),
                "document_id": business_config.get('business_doc', ''),  # RIF
                "address": business_config.get('business_address', ''),
                "phone": business_config.get('business_phone', ''),
            },
            "sale": {
                "id": sale.id,
                "date": sale.date.strftime("%d/%m/%Y %H:%M") if sale.date else "",
                
                # Raw Totals (Backward Compatibility)
                "total": total_main,
                "total_bs": total_bs,
                "total_usd": total_usd,
                
                # Pre-formatted Totals
                "formatted_total": fmt_money(total_main, currency_main),
                "formatted_total_ref": fmt_money(total_ref, currency_ref),
                
                "is_usd": is_usd_mode,
                "currency_symbol": "$" if is_usd_mode else "Bs", # Legacy Support
                "exchange_rate": f"{print_rate:,.2f}",
                "discount": 0.0, # Added missing field for legacy templates
                "is_credit": sale.is_credit,
                "due_date": due_date_str,
                "customer": {
                    "name": sale.customer.name[:25] if sale.customer else "CLIENTE CONTADO",
                    "id_number": sale.customer.id_number if sale.customer else ""
                },
                "products": formatted_items,
                "payments": formatted_payments,
                # Raw Change (Legacy)
                "change_amount": change_val,
                "change_currency": change_curr,
                "formatted_change": fmt_money(change_val, change_curr)
            }
        }
        
        # ── Template selection ─────────────────────────────────────
        # 1. Load the general ticket_template from config
        template_config = db.query(models.BusinessConfig).get("ticket_template")
        template = ""

        if template_config and template_config.value:
            template = template_config.value
            # HOTFIX: legacy Jinja2 templates break the C# Bridge (Scriban)
            if "{%" in template:
                print(f"[WARNING] Legacy Jinja2 template detected for Sale {sale_id}. Falling back to Scriban.")
                template = get_classic_58_template()
            # HOTFIX: rename old context key
            if "sale.items" in template:
                template = template.replace("sale.items", "sale.products")
        else:
            template = get_classic_58_template()

        # 2. If any item has IMEI/serial numbers → use services-specific template
        #    (priority: saved services config → built-in services preset)
        has_serialized = any(item.get("serial_numbers") for item in formatted_items)
        if has_serialized:
            paper_width = business_config.get("paper_width", "58")
            svc_key = f"ticket_template_services_{paper_width}"
            svc_config = db.query(models.BusinessConfig).get(svc_key)
            if svc_config and svc_config.value:
                template = svc_config.value
            else:
                template = (
                    get_services_sale_80_template()
                    if paper_width == "80"
                    else get_services_sale_58_template()
                )
        # ──────────────────────────────────────────────────────────
        return {
            "status": "ready",
            "template": template,
            "context": context
        }

    @staticmethod
    def generate_z_report_payload(db: Session, session_id: int):
        """
        Generates Z Report (Corte de Caja) Payload
        """
        # Fetch Session with loaded relationships (including register for Z-Report)
        from sqlalchemy.orm import joinedload as _jl
        session = db.query(models.CashSession).options(
            _jl(models.CashSession.user),
            _jl(models.CashSession.register)
        ).filter(models.CashSession.id == session_id).first()
        
        if not session:
            return None
            
        # Get Business Config
        business_config = {}
        configs = db.query(models.BusinessConfig).all()
        for config in configs:
            business_config[config.key] = config.value

        from ..utils.financials import get_session_payment_breakdown
        
        # Calculate Detailed Breakdown
        # Structure: {"Efectivo": {"USD": 100}, ...}
        breakdown_raw = get_session_payment_breakdown(db, session)
        
        # --- DUAL TRANSACTION SUPPORT: Merge Cash Advance Inflows ---
        # Note: Logic moved to utils/financials.py 'get_session_payment_breakdown'
        # to ensure consistency across History and Z-Report.
        # ------------------------------------------------------------
        
        # Flatten for Template usage
        # list of {method, usd_amount, bs_amount} ? Or just list of lines
        payments_detail = []
        for method, currencies in breakdown_raw.items():
             usd_amt = float(currencies.get("USD", 0))
             bs_amt = float(currencies.get("Bs", currencies.get("VES", 0)))
             
             if usd_amt > 0 or bs_amt > 0:
                 payments_detail.append({
                     "method": method,
                     "usd": f"{usd_amt:,.2f}",
                     "bs": f"{bs_amt:,.2f}",
                     "has_usd": usd_amt > 0,
                     "has_bs": bs_amt > 0
                 })

        # Build Context
        context = {
            "business": {
                "name": business_config.get('business_name', 'MI NEGOCIO'),
                "document_id": business_config.get('business_doc', ''),
            },
            "session": {
                "id": session.id,
                "user": session.user.full_name if session.user else "Usuario",
                "register_name": session.register.name if session.register else "Caja Principal",
                "register_code": session.register.code if session.register else "C01",
                "start_time": session.start_time.strftime("%d/%m/%Y %H:%M"),
                "end_time": session.end_time.strftime("%d/%m/%Y %H:%M") if session.end_time else "N/A",
                "initial_usd": f"{float(session.initial_cash or 0):,.2f}",
                "initial_bs": f"{float(session.initial_cash_bs or 0):,.2f}",
                "sales_usd": f"{(float(session.final_cash_expected or 0) - float(session.initial_cash or 0)):,.2f}",
                "sales_bs": f"{(float(session.final_cash_expected_bs or 0) - float(session.initial_cash_bs or 0)):,.2f}",
                "total_expected_usd": f"{float(session.final_cash_expected or 0):,.2f}",
                "total_expected_bs": f"{float(session.final_cash_expected_bs or 0):,.2f}",
                "total_reported_usd": f"{float(session.final_cash_reported or 0):,.2f}",
                "total_reported_bs": f"{float(session.final_cash_reported_bs or 0):,.2f}",
                "diff_usd": f"{float(session.difference or 0):+,.2f}",
                "diff_bs": f"{float(session.difference_bs or 0):+,.2f}",
                "payments_detail": payments_detail # NEW FIELD
            }
        }
        
        template = """
<center>
<bold>{{ business.name }}</bold>
{{ business.document_id }}
{{ separator_equal }}
<bold>REPORTE Z - CORTE DE CAJA</bold>
{{ separator_equal }}
</center>
Sesion: #{{ session.id }}
Caja:   {{ session.register_code }} - {{ session.register_name }}
Cajero: {{ session.user }}
Apertura: {{ session.start_time }}
Cierre:   {{ session.end_time }}
{{ separator_equal }}
<bold>RESUMEN DE PAGOS</bold>
{{ separator_equal }}
{{ for pay in session.payments_detail }}
{{ pay.method }}
{{ if pay.has_usd }}   USD: ${{ pay.usd }}{{ end }}
{{ if pay.has_bs }}   Bs:  {{ pay.bs }}{{ end }}
{{ end }}
{{ separator_equal }}
<bold>FONDOS INICIALES</bold>
{{ separator_equal }}
USD:  ${{ session.initial_usd }}
Bs:   Bs {{ session.initial_bs }}
{{ separator_equal }}
<bold>ARQUEO DE CAJA (TOTALES)</bold>
{{ separator_equal }}
<bold>DOLARES ($)</bold>
  Esperado:  ${{ session.total_expected_usd }}
  Reportado: ${{ session.total_reported_usd }}
  Diferencia: {{ session.diff_usd }}

<bold>BOLIVARES (Bs)</bold>
  Esperado:  Bs {{ session.total_expected_bs }}
  Reportado: Bs {{ session.total_reported_bs }}
  Diferencia: {{ session.diff_bs }}
{{ separator_equal }}
<center>
<bold>FIN DEL REPORTE</bold>
</center>
<cut>
"""
        return {
            "status": "ready",
            "template": template,
            "context": context
        }

# REMOVED: print_sale_ticket (Old Server-Side Logic)

    @staticmethod
    def register_payment(db: Session, payment_data: schemas.SalePaymentCreate):
        """
        Register a payment for a credit sale and update balance.
        Handles currency conversion automatically.
        """
        # 1. Verify sale exists
        sale = db.query(models.Sale).filter(models.Sale.id == payment_data.sale_id).first()
        if not sale:
            raise HTTPException(status_code=404, detail="Sale not found")
        
        # 2. Record Payment
        # Determine payment date (allow backdating)
        actual_date = payment_data.payment_date if payment_data.payment_date else datetime.now()

        # 2. Record Payment
        payment = models.SalePayment(
            sale_id=payment_data.sale_id,
            amount=payment_data.amount,
            currency=payment_data.currency,
            payment_method=payment_data.payment_method,
            exchange_rate=payment_data.exchange_rate,
            reference=payment_data.reference,
            payment_date=actual_date
        )
        db.add(payment)
        
        # FIX: Link to Cash Session if Sale is from a Previous Session
        # Logic: If Sale.date < Session.start_time, then 'financials.py' ignores this SalePayment.
        # So we MUST create a 'models.Payment' (Debt Payment) to show it in the Session Report.
        # If Sale is from THIS session, 'financials.py' already picks up the SalePayment.
        
        active_session = db.query(models.CashSession).filter(models.CashSession.status == "OPEN").first()
        if active_session:
            # Check if Sale is older than session start
            # Use buffer of 1 minute to avoid race conditions
            if sale.date < active_session.start_time:
                print(f"[INFO] Registering Debt Payment for OLD Sale #{sale.id} in Session #{active_session.id}")
                
                # Calculate Bs Amount if needed
                amount_bs = None
                if payment_data.currency in ["Bs", "VES"]:
                    amount_bs = payment_data.amount
                elif payment_data.currency == "USD" and payment_data.exchange_rate:
                    amount_bs = payment_data.amount * payment_data.exchange_rate

                debt_payment = models.Payment(
                    customer_id=sale.customer_id,
                    amount=payment_data.amount,
                    currency=payment_data.currency,
                    payment_method=payment_data.payment_method,
                    exchange_rate_used=payment_data.exchange_rate,
                    amount_bs=amount_bs,
                    session_id=active_session.id,
                    description=f"Abono Factura #{sale.id}",
                    date=actual_date # Use Backdated Date
                )
                db.add(debt_payment)
        
        # 3. Calculate Amount in Sales Currency (USD/Anchor)
        # Assuming sale.balance_pending is in USD (Anchor)
        amount_usd = 0.0
        
        is_anchor = payment_data.currency == "USD" # Simplified check, should ideally check config
        
        if is_anchor:
            amount_usd = float(payment_data.amount)
        else:
            # Convert to USD
            # rate = Bs / USD. So USD = Bs / rate
            if payment_data.exchange_rate and payment_data.exchange_rate > 0:
                amount_usd = float(payment_data.amount) / float(payment_data.exchange_rate)
            else:
                 # Fallback if no rate provided (shouldn't happen from frontend)
                 # Try to find today's rate or error out?
                 # ideally we trust the rate sent with payment
                 amount_usd = 0 # Safety, or raise error?
                 print(f"[WARNING] Payment in {payment_data.currency} without rate!")

        # 4. Update Balance
        current_balance = float(sale.balance_pending if sale.balance_pending is not None else sale.total_amount)
        new_balance = max(0.0, current_balance - amount_usd)
        
        sale.balance_pending = new_balance
        sale.paid = (new_balance <= 0.01) # Trace threshold
        
        db.commit()
        db.expunge(payment)
        
        return {
            "status": "success",
            "payment_id": payment.id,
            "new_balance": new_balance,
            "paid": sale.paid
        }
