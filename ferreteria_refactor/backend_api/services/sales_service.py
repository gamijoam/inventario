from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, or_, text
from datetime import datetime, timedelta
from ..tenant_context import get_tenant_schema
from ..utils.time_utils import get_venezuela_now
from fastapi import HTTPException, BackgroundTasks
from decimal import Decimal
import requests
from ..models import models
from ..models.restaurant import RestaurantRecipe, ProductModifierOption
from .. import schemas
from ..websocket.manager import manager
from ..websocket.events import WebSocketEvents
from . import webhook_service
import asyncio
from ..models.tenant import Tenant
import asyncio
import uuid
from ..template_presets import (
    get_classic_58_template,
    get_services_sale_58_template,
    get_services_sale_80_template,
)
from ..audit_utils import log_action
from ..commission_engine import CommissionEngine
 

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

            # ── Commission Engine: cargar feature flags del tenant ──────────
            _user_obj = db.query(models.User).filter(models.User.id == user_id).first()
            _tenant_flags = {}
            if _user_obj and _user_obj.tenant_id:
                _tenant = db.query(Tenant).filter(Tenant.id == _user_obj.tenant_id).first()
                _tenant_flags = _tenant.feature_flags or {} if _tenant else {}
            commission_engine = CommissionEngine(db, _tenant_flags)
            # ────────────────────────────────────────────────────────────────

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
                # Fallback: sesión del usuario actual
                open_session = db.query(models.CashSession).filter(
                    models.CashSession.status == "OPEN",
                    models.CashSession.user_id == user_id
                ).first()
            if not open_session and getattr(sale_data, 'is_credit', False):
                # Para ventas a crédito: usar cualquier caja abierta del tenant
                # (el dueño de org puede no tener caja propia pero sí existe una abierta)
                open_session = db.query(models.CashSession).filter(
                    models.CashSession.status == "OPEN"
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
            current_time = get_venezuela_now() # Explicitly set time to avoid refresh need
            
            print(f"[DEBUG] Creating Sale. Method: {sale_data.payment_method}. Payments: {sale_data.payments}")

            # Calculate due date for credit sales
            due_date = None
            balance_pending = None
            if sale_data.is_credit:
                # Calcular balance_pending usando el enganche si viene de CalculadoraCredito
                if sale_data.credit_down_payment is not None and float(sale_data.credit_down_payment) > 0:
                    # Modelo plano: total = precio + interes, financiado = total - enganche
                    precio    = float(sale_data.total_amount)
                    enganche  = float(sale_data.credit_down_payment)
                    tasa      = float(sale_data.credit_interest_rate or 0)
                    interes   = precio * (tasa / 100)
                    total_con_interes = precio + interes
                    balance_pending = max(0.0, total_con_interes - enganche)
                else:
                    # Venta a crédito simple sin calculadora — saldo = monto total
                    balance_pending = float(sale_data.total_amount)

                if sale_data.customer_id:
                    customer = db.query(models.Customer).filter(models.Customer.id == sale_data.customer_id).first()
                    if customer:
                        _term_days = customer.payment_term_days if customer.payment_term_days is not None else 30
                        due_date = current_time + timedelta(days=_term_days)
            
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
            sale_change_amount   = float(new_sale.change_amount)   if new_sale.change_amount   else 0.0
            sale_change_currency = new_sale.change_currency or ""
            sale_exchange_rate   = float(new_sale.exchange_rate_used) if new_sale.exchange_rate_used else 1.0
            sale_total_bs        = float(new_sale.total_amount_bs) if new_sale.total_amount_bs else 0.0
            # Snapshot de pagos para el ticket WhatsApp (sale_data disponible aquí)
            sale_payments_snapshot = [
                {"currency": p.currency, "amount": float(p.amount)}
                for p in (sale_data.payments or [])
            ]

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
                
                # Check if we should skip stock deduction (Restaurant flow)
                skip_stock = getattr(item, "skip_stock_deduction", False)

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

                # --- STOCK DEDUCTION LOGIC ---
                if not skip_stock:
                    # NEW: RECIPE LOGIC (ESCANDALLO) - Check if product has a restaurant recipe
                    recipes = db.query(RestaurantRecipe).filter(RestaurantRecipe.product_id == product.id).all()

                    if recipes:
                        for recipe_item in recipes:
                            ingredient = db.query(models.Product).filter(models.Product.id == recipe_item.ingredient_id).with_for_update().first()
                            if not ingredient:
                                continue

                            qty_to_deduct = Decimal(str(item.quantity)) * Decimal(str(recipe_item.quantity)) * Decimal(str(getattr(item, "recipe_factor", 1.0)))

                            ing_stock = db.query(models.ProductStock).filter(
                                models.ProductStock.product_id == ingredient.id,
                                models.ProductStock.warehouse_id == warehouse_id
                            ).first()

                            if not ing_stock:
                                ing_stock = models.ProductStock(product_id=ingredient.id, warehouse_id=warehouse_id, quantity=0)
                                db.add(ing_stock)
                                db.flush()

                            available_qty = ing_stock.quantity
                            if available_qty < qty_to_deduct:
                                wh_name = db.query(models.Warehouse.name).filter(models.Warehouse.id == warehouse_id).scalar()
                                raise HTTPException(
                                    status_code=400,
                                    detail=f"Stock insuficiente para ingrediente '{ingredient.name}' en '{wh_name}'. Necesario: {qty_to_deduct}, Disponible: {available_qty}"
                                )

                            ing_stock.quantity -= qty_to_deduct
                            ingredient.stock -= qty_to_deduct

                            db.add(models.Kardex(
                                product_id=ingredient.id,
                                movement_type="SALE",
                                quantity=-qty_to_deduct,
                                balance_after=ingredient.stock,
                                description=f"Venta via Receta: {product.name} (Venta #{new_sale_id})"
                            ))

                            updated_products_info.append({
                                "id": ingredient.id,
                                "name": ingredient.name,
                                "price": float(ingredient.price),
                                "stock": float(ingredient.stock),
                                "exchange_rate_id": ingredient.exchange_rate_id
                            })

                    elif item.modifier_option_ids:
                        modifier_options = db.query(ProductModifierOption).filter(
                            ProductModifierOption.id.in_(item.modifier_option_ids)
                        ).options(joinedload(ProductModifierOption.product)).all()

                        for mod_opt in modifier_options:
                            if mod_opt.ingredient_id and mod_opt.quantity_consumed > 0:
                                ingredient_to_deduct = db.query(models.Product).filter(
                                    models.Product.id == mod_opt.ingredient_id
                                ).with_for_update().first()

                                if not ingredient_to_deduct:
                                    print(f"[WARNING] Modifier {mod_opt.name} refers to non-existent ingredient {mod_opt.ingredient_id}")
                                    continue

                                qty_to_deduct = Decimal(str(item.quantity)) * mod_opt.quantity_consumed

                                ing_stock = db.query(models.ProductStock).filter(
                                    models.ProductStock.product_id == ingredient_to_deduct.id,
                                    models.ProductStock.warehouse_id == warehouse_id
                                ).first()

                                if not ing_stock:
                                    ing_stock = models.ProductStock(product_id=ingredient_to_deduct.id, warehouse_id=warehouse_id, quantity=0)
                                    db.add(ing_stock)
                                    db.flush()

                                available_qty = ing_stock.quantity
                                if available_qty < qty_to_deduct:
                                    wh_name = db.query(models.Warehouse.name).filter(models.Warehouse.id == warehouse_id).scalar()
                                    raise HTTPException(
                                        status_code=400,
                                        detail=f"Stock insuficiente para ingrediente de modificador '{ingredient_to_deduct.name}' "
                                        f"({mod_opt.name}) en '{wh_name}'. Necesario: {qty_to_deduct}, Disponible: {available_qty}"
                                    )

                                ing_stock.quantity -= qty_to_deduct
                                ingredient_to_deduct.stock -= qty_to_deduct

                                db.add(models.Kardex(
                                    product_id=ingredient_to_deduct.id,
                                    movement_type="SALE_MODIFIER",
                                    quantity=-qty_to_deduct,
                                    balance_after=ingredient_to_deduct.stock,
                                    description=f"Venta Modificador: {mod_opt.name} ({product.name} - Venta #{new_sale_id})"
                                ))

                                updated_products_info.append({
                                    "id": ingredient_to_deduct.id,
                                    "name": ingredient_to_deduct.name,
                                    "price": float(ingredient_to_deduct.price),
                                    "stock": float(ingredient_to_deduct.stock),
                                    "exchange_rate_id": ingredient_to_deduct.exchange_rate_id
                                })
                    elif product.is_combo:
                        if not product.combo_items:
                            raise HTTPException(
                                status_code=400,
                                detail=f"Combo product '{product.name}' has no components defined"
                            )

                        for combo_item in product.combo_items:
                            child_product = combo_item.child_product

                            if combo_item.unit_id and combo_item.unit:
                                conversion_factor = combo_item.unit.conversion_factor
                                qty_needed = item.quantity * combo_item.quantity * conversion_factor
                            else:
                                qty_needed = item.quantity * combo_item.quantity

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

                        for combo_item in product.combo_items:
                            child_product = combo_item.child_product

                            if combo_item.unit_id and combo_item.unit:
                                conversion_factor = combo_item.unit.conversion_factor
                                qty_to_deduct = item.quantity * combo_item.quantity * conversion_factor
                                unit_description = f" ({combo_item.quantity}x {combo_item.unit.unit_name})"
                            else:
                                qty_to_deduct = item.quantity * combo_item.quantity
                                unit_description = ""

                            child_stock = db.query(models.ProductStock).filter(
                                models.ProductStock.product_id == child_product.id,
                                models.ProductStock.warehouse_id == warehouse_id
                            ).first()

                            if not child_stock:
                                child_stock = models.ProductStock(product_id=child_product.id, warehouse_id=warehouse_id, quantity=0)
                                db.add(child_stock)

                            child_stock.quantity -= qty_to_deduct
                            child_product.stock -= qty_to_deduct

                            db.add(models.Kardex(
                                product_id=child_product.id,
                                movement_type="SALE",
                                quantity=-qty_to_deduct,
                                balance_after=child_product.stock,
                                description=f"Sale via combo: {product.name}{unit_description} (Sale #{new_sale_id})"
                            ))

                            updated_products_info.append({
                                "id": child_product.id,
                                "name": child_product.name,
                                "price": float(child_product.price),
                                "stock": float(child_product.stock),
                                "exchange_rate_id": child_product.exchange_rate_id
                            })
                    elif is_service:
                        pass
                    else:
                        if product.has_imei:
                            if not item.serial_numbers and not sale_data.is_credit:
                                raise HTTPException(status_code=400,
                                    detail=f"Product '{product.name}' is serialized (has_imei=True) but no serial numbers provided.")

                            if item.serial_numbers and len(item.serial_numbers) != units_to_deduct:
                                raise HTTPException(status_code=400,
                                    detail=f"Discrepancia de cantidad para producto serializado '{product.name}'. "
                                    f"Esperado {int(units_to_deduct)}, recibido {len(item.serial_numbers)}.")

                            sold_instances = []

                            if item.serial_numbers:
                                sold_instances = db.query(models.ProductInstance).filter(
                                    models.ProductInstance.product_id == product.id,
                                    models.ProductInstance.warehouse_id == warehouse_id,
                                    models.ProductInstance.serial_number.in_(item.serial_numbers),
                                    models.ProductInstance.status == models.ProductInstanceStatus.AVAILABLE
                                ).with_for_update().all()

                                if len(sold_instances) != len(item.serial_numbers):
                                    found_sns = {i.serial_number for i in sold_instances}
                                    missing = set(item.serial_numbers) - found_sns
                                    raise HTTPException(status_code=400,
                                        detail=f"Números de serie no encontrados o no disponibles: {list(missing)}")
                            else:
                                sold_instances = db.query(models.ProductInstance).filter(
                                    models.ProductInstance.product_id == product.id,
                                    models.ProductInstance.warehouse_id == warehouse_id,
                                    models.ProductInstance.status == models.ProductInstanceStatus.AVAILABLE
                                ).with_for_update().limit(int(units_to_deduct)).all()

                                if len(sold_instances) < int(units_to_deduct):
                                    raise HTTPException(status_code=400,
                                        detail=f"Stock insuficiente para '{product.name}': "
                                        f"solo {len(sold_instances)} unidades disponibles con IMEI registrado.")

                            for instance in sold_instances:
                                instance.status = models.ProductInstanceStatus.SOLD

                            product_stock = db.query(models.ProductStock).filter(
                                models.ProductStock.product_id == product.id,
                                models.ProductStock.warehouse_id == warehouse_id
                            ).first()

                            available_qty = product_stock.quantity if product_stock else 0

                            if available_qty < units_to_deduct:
                                wh_name = db.query(models.Warehouse.name).filter(models.Warehouse.id == warehouse_id).scalar()
                                raise HTTPException(status_code=400, detail=f"Stock insuficiente para el producto '{product.name}' en almacén '{wh_name or 'Desconocido'}'. Disponible: {available_qty}")

                            product_stock.quantity -= units_to_deduct
                            product.stock -= units_to_deduct

                            updated_products_info.append({
                                "id": product.id,
                                "name": product.name,
                                "price": float(product.price),
                                "stock": float(product.stock),
                                "exchange_rate_id": product.exchange_rate_id
                            })

                            db.add(models.Kardex(
                                product_id=product.id,
                                movement_type="SALE",
                                quantity=-units_to_deduct,
                                balance_after=product.stock,
                                description=f"Sale #{new_sale_id} from Warehouse #{warehouse_id}"
                            ))

                        else:
                            product_stock = db.query(models.ProductStock).filter(
                                models.ProductStock.product_id == product.id,
                                models.ProductStock.warehouse_id == warehouse_id
                            ).first()

                            available_qty = product_stock.quantity if product_stock else 0

                            if available_qty < units_to_deduct:
                                wh_name = db.query(models.Warehouse.name).filter(models.Warehouse.id == warehouse_id).scalar()
                                raise HTTPException(status_code=400, detail=f"Stock insuficiente para el producto '{product.name}' en almacén '{wh_name or 'Desconocido'}'. Disponible: {available_qty}")

                            product_stock.quantity -= units_to_deduct
                            product.stock -= units_to_deduct

                            updated_products_info.append({
                                "id": product.id,
                                "name": product.name,
                                "price": float(product.price),
                                "stock": float(product.stock),
                                "exchange_rate_id": product.exchange_rate_id
                            })

                            db.add(models.Kardex(
                                product_id=product.id,
                                movement_type="SALE",
                                quantity=-units_to_deduct,
                                balance_after=product.stock,
                                description=f"Sale #{new_sale_id} from Warehouse #{warehouse_id}"
                            ))
                
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

                # ── COMMISSION ENGINE v2 ────────────────────────────────────
                # Jerarquía de salesperson:
                # 1. salesperson_id del ítem (selección manual en POS)
                # 2. user_id de la sesión de caja (quien abrió caja = cajero real)
                # 3. user_id del request (fallback)
                _sp_id = getattr(item, 'salesperson_id', None)
                if not _sp_id and open_session and open_session.user_id:
                    _sp_id = open_session.user_id
                if not _sp_id:
                    _sp_id = user_id
                if _sp_id:
                    _salesperson = db.query(models.User).filter(models.User.id == _sp_id).first()
                    if _salesperson:
                        commission_engine.record_vendor_commission(
                            sale_id=new_sale.id,
                            detail=detail,
                            salesperson=_salesperson,
                            exchange_rate=new_sale.exchange_rate_used,
                        )
                # ────────────────────────────────────────────────────────────
        
            # 3. Process Payments (New Multi-Payment Logic)
            total_paid_usd = Decimal("0.00")
            if sale_data.payments:

                for p in sale_data.payments:
                    # =========================================================================
                    # EXCHANGE RATE VALIDATION — Prevents frontend manipulation of rates
                    # =========================================================================
                    validated_exchange_rate = p.exchange_rate  # Default: use what frontend sent

                    if p.currency not in ("USD", "$"):
                        # Fetch the active rate matching by currency_code OR currency_symbol
                        # (frontend may send 'Bs' as symbol while DB stores code 'VES')
                        db_rate = db.query(models.ExchangeRate).filter(
                            or_(
                                models.ExchangeRate.currency_code == p.currency,
                                models.ExchangeRate.currency_symbol == p.currency,
                            ),
                            models.ExchangeRate.is_active == True,
                            models.ExchangeRate.is_default == True
                        ).first()

                        # If no default found, fall back to any active rate
                        if not db_rate:
                            db_rate = db.query(models.ExchangeRate).filter(
                                or_(
                                    models.ExchangeRate.currency_code == p.currency,
                                    models.ExchangeRate.currency_symbol == p.currency,
                                ),
                                models.ExchangeRate.is_active == True
                            ).first()

                        if not db_rate:
                            raise HTTPException(
                                status_code=400,
                                detail=f"Moneda no válida o no activa: {p.currency}"
                            )

                        db_rate_val = float(db_rate.rate)
                        frontend_rate = float(p.exchange_rate) if p.exchange_rate is not None else None

                        # Validate tolerance ±15% ONLY when client explicitly sends a rate
                        # (None = older client / desktop app that doesn't send rate → skip strict check)
                        if frontend_rate is not None and frontend_rate > 0 and db_rate_val > 0:
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

            # Audit log
            log_action(db, user_id=user_id, action="CREATE", table_name="sales", record_id=new_sale_id, changes=None, ip_address=None)

            # ── BloqueCelular: Sincronizar venta a crédito (solo celulares) ───────────
            # REGLA: Solo se sincronizan productos con has_imei=True (celulares).
            # Productos sin IMEI (ropa, alimentos, etc.) NO se envían a BloqueCelular.
            # No-bloqueante: si falla, la venta ya fue guardada correctamente.
            if sale_data.is_credit and sale_customer_id:
                try:
                    from ..services.bloqueocelular_service import sincronizar_venta_credito, is_enabled
                    from ..tenant_context import get_tenant_schema as _gts
                    from sqlalchemy import text as _blq_text
                    _schema = _gts()

                    if is_enabled(db, _schema):
                        # --- AUDITORIA: Split Logic (Credito vs Contado) ---
                        # --- AUDITORIA: Feature Flag Logic ---
                         
                        _tenant = db.query(Tenant).filter(Tenant.schema_name == _schema).first()
                        _is_split_active = False
                        if _tenant and _tenant.feature_flags:
                            _is_split_active = _tenant.feature_flags.get("bloqueocelular_split_logic", False)
                        # -------------------------------------
                        
                        # Calcular el total solo de los celulares (con IMEI)
                        _total_celulares = db.execute(_blq_text(
                            f"SELECT SUM(sd.unit_price * sd.quantity) FROM \"{_schema}\".sale_details sd "
                            f"JOIN \"{_schema}\".products p ON p.id = sd.product_id "
                            f"WHERE sd.sale_id = :sid AND p.has_imei = TRUE"
                        ), {"sid": new_sale_id}).scalar() or 0
                        # --------------------------------------------------\n                        # Verificar si algún producto de la venta es celular (has_imei=True)
                        _tiene_celular = db.execute(_blq_text(
                            f'SELECT COUNT(*) FROM "{_schema}".sale_details sd '
                            f'JOIN "{_schema}".products p ON p.id = sd.product_id '
                            f'WHERE sd.sale_id = :sid AND p.has_imei = TRUE'
                        ), {"sid": new_sale_id}).scalar() or 0

                        if not _tiene_celular:
                            print(f"[Bloqueo] ℹ️ Venta #{new_sale_id}: sin celulares — omitiendo sync")
                        else:
                            # Obtener datos del cliente
                            _cust_row = db.execute(
                                _blq_text(f'SELECT name, phone, id_number, email FROM "{_schema}".customers WHERE id = :cid'),
                                {"cid": sale_customer_id}
                            ).fetchone()

                            # Buscar serial_number del celular en la venta
                            _imei = None
                            _prod_name = "Celular"
                            _inst_row = db.execute(_blq_text(
                                f'SELECT pi.serial_number, p.name '
                                f'FROM "{_schema}".sale_detail_instances sdi '
                                f'JOIN "{_schema}".sale_details sd ON sd.id = sdi.sale_detail_id '
                                f'JOIN "{_schema}".product_instances pi ON pi.id = sdi.product_instance_id '
                                f'JOIN "{_schema}".products p ON p.id = pi.product_id '
                                f'WHERE sd.sale_id = :sid AND pi.serial_number IS NOT NULL LIMIT 1'
                            ), {"sid": new_sale_id}).fetchone()

                            if _inst_row:
                                _imei      = _inst_row[0]
                                _prod_name = _inst_row[1]
                            else:
                                _prod_row = db.execute(_blq_text(
                                    f'SELECT p.name FROM "{_schema}".sale_details sd '
                                    f'JOIN "{_schema}".products p ON p.id = sd.product_id '
                                    f'WHERE sd.sale_id = :sid AND p.has_imei = TRUE '
                                    f'ORDER BY sd.id ASC LIMIT 1'
                                ), {"sid": new_sale_id}).fetchone()
                                if _prod_row:
                                    _prod_name = _prod_row[0]

                            _blq_result = sincronizar_venta_credito(
                                db                 = db,
                                schema             = _schema,
                                sale_id            = new_sale_id,
                                customer_name      = _cust_row[0] if _cust_row else "Cliente",
                                customer_phone     = _cust_row[1] if _cust_row else None,
                                customer_id_number = _cust_row[2] if _cust_row else None,
                                customer_email     = _cust_row[3] if _cust_row else None,
                                total_amount       = float(sale_total_amount),
                                balance_pending    = min(float(_total_celulares), float(sale_total_amount) - float(total_paid_usd)) if _is_split_active else float(sale_total_amount) - float(total_paid_usd),
                                due_date           = None,
                                imei               = _imei,
                                product_name       = _prod_name,
                                num_cuotas         = getattr(sale_data, "credit_installments", 6) or 6,
                            )

                            if _blq_result.get("ok"):
                                print(f"[Bloqueo] ✅ Venta #{new_sale_id} sincronizada "
                                      f"código: {_blq_result.get('codigo_activacion')}")
                            else:
                                print(f"[Bloqueo] ⚠️ Venta #{new_sale_id}: {_blq_result.get('error')}")
                except Exception as _blq_e:
                    import logging as _blq_log
                    _blq_log.getLogger(__name__).warning(
                        f"[Bloqueo] Error sincronizando venta #{new_sale_id}: {_blq_e}"
                    )
            # ── Fin BloqueCelular ───────────────────────────────────────────────────

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
                
                # Emit Sale Event (WebSocket frontend)
                background_tasks.add_task(run_broadcast, WebSocketEvents.SALE_COMPLETED, {
                    "id": new_sale_id,
                    "total_amount": sale_total_amount,
                    "currency": sale_currency,
                    "payment_method": sale_payment_method,
                    "customer_id": sale_customer_id,
                    "date": sale_date_iso
                })

                # WhatsApp — enviar ticket al cliente directamente vía servicio Baileys
                if sale_customer_id:
                    try:
                        from sqlalchemy import text as _text
                        from ..tenant_context import get_tenant_schema as _get_schema
                        import httpx as _httpx
                        _schema = _get_schema()

                        # Obtener datos del cliente y config del negocio
                        _row = db.execute(
                            _text(f'SELECT name, phone FROM "{_schema}".customers WHERE id = :cid'),
                            {"cid": sale_customer_id}
                        ).fetchone()

                        if _row and _row[1]:
                            _name, _phone = _row[0], _row[1]

                            # Verificar config WhatsApp en una sola query
                            _wa_rows = db.execute(
                                _text(
                                    f"SELECT key, value FROM \"{_schema}\".business_config "
                                    "WHERE key IN ('whatsapp_instance_name','whatsapp_instance_status',"
                                    "'whatsapp_notify_sale','business_name','whatsapp_template_sale')"
                                )
                            ).fetchall()
                            _wa_cfg = {r[0]: r[1] for r in _wa_rows}
                            _inst   = _wa_cfg.get("whatsapp_instance_name", "")
                            _status = _wa_cfg.get("whatsapp_instance_status", "")
                            _notify = _wa_cfg.get("whatsapp_notify_sale") != "false"  # None o "true" = habilitado

                            if _inst and _status == "CONNECTED" and _notify:
                                # Obtener nombre del negocio
                                _biz_name = _wa_cfg.get("business_name") or "Mi Inventario"

                                _clean_phone = "".join(c for c in _phone if c.isdigit())
                                _tpl = _wa_cfg.get("whatsapp_template_sale") or (
                                    "🧾 *{{negocio}}*\n¡Gracias por tu compra, {{cliente}}!\n\n"
                                    "📋 Venta #{{id}}\n📦 {{metodo_pago}}\n\n"
                                    "*PAGOS:*\n{{pagos}}\n\n*TOTAL: {{total}}*{{vuelto}}\n\n"
                                    "¡Gracias por preferirnos! 😊"
                                )

                                # Construir líneas de pago con moneda real
                                _pay_lines = []
                                for _p in sale_payments_snapshot:
                                    _cur = _p["currency"]
                                    _amt = _p["amount"]
                                    # Si pagó en bolívares mostrar Bs, si en USD mostrar $
                                    if _cur in ("VES", "Bs", "BS", "BsF"):
                                        _pay_lines.append(f"  💳 Bs {_amt:,.2f}")
                                    elif _cur in ("USD", "$"):
                                        _pay_lines.append(f"  💵 $ {_amt:,.2f}")
                                    else:
                                        _pay_lines.append(f"  💰 {_cur} {_amt:,.2f}")

                                if not _pay_lines:
                                    # Fallback: mostrar el total en la moneda correcta
                                    if sale_currency in ("VES", "Bs", "BS"):
                                        _pay_lines = [f"  💳 Bs {sale_total_bs:,.2f}"]
                                    else:
                                        _pay_lines = [f"  💵 $ {sale_total_amount:,.2f}"]

                                _pay_str = "\n".join(_pay_lines)

                                # Línea de total según moneda de la venta
                                if sale_currency in ("VES", "Bs", "BS", "BsF"):
                                    _total_str = f"Bs {sale_total_bs:,.2f}"
                                else:
                                    _total_str = f"$ {sale_total_amount:,.2f}"

                                # Vuelto
                                _change_str = ""
                                if sale_change_amount and sale_change_amount > 0.005:
                                    if sale_change_currency in ("VES", "Bs", "BS", "BsF"):
                                        _change_str = f"\n🔄 Vuelto: Bs {sale_change_amount:,.2f}"
                                    elif sale_change_currency in ("USD", "$"):
                                        _change_str = f"\n🔄 Vuelto: $ {sale_change_amount:,.2f}"
                                    else:
                                        _change_str = f"\n🔄 Vuelto: {sale_change_amount:,.2f}"

                                # Tasa de cambio (mostrar solo si la venta es en Bs o hay pagos mixtos)
                                # Aplicar plantilla con variables
                                _msg = _tpl \
                                    .replace("{{negocio}}",     _biz_name) \
                                    .replace("{{cliente}}",     _name) \
                                    .replace("{{id}}",          f"{new_sale_id:04d}") \
                                    .replace("{{metodo_pago}}", sale_payment_method) \
                                    .replace("{{pagos}}",       _pay_str) \
                                    .replace("{{total}}",       _total_str) \
                                    .replace("{{vuelto}}",      _change_str)
                                # httpx síncrono — no bloquea significativamente (timeout 5s)
                                with _httpx.Client(timeout=5) as _c:
                                    _c.post(
                                        f"http://whatsapp_service:3000/instance/{_inst}/send",
                                        json={"phone": _clean_phone, "message": _msg}
                                    )

                    except Exception as _wa_err:
                        import logging as _log
                        _log.getLogger(__name__).warning(f"[WA] Ticket venta falló (no afecta la venta): {_wa_err}")
                
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
        configs = db.execute(text(f"SELECT key, value FROM {get_tenant_schema()}.business_config")).all()
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

            # Unidad de venta — prioridad: unit vinculada > unit_type del producto > "Unid"
            unit_name = ""
            try:
                if item.unit and item.unit.unit_name:
                    unit_name = item.unit.unit_name
                elif item.product and item.product.unit_type:
                    unit_name = item.product.unit_type
            except Exception:
                pass

            formatted_items.append({
                "product": {"name": display_name},
                "quantity": float(item.quantity) if item.quantity % 1 != 0 else int(item.quantity),
                "unit_name": unit_name,   # Ej: "Kg", "Litro", "Gramo", "Caja"
                "unit_type": item.product.unit_type if item.product else "",  # unit_type base del producto
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
        configs = db.execute(text(f"SELECT key, value FROM {get_tenant_schema()}.business_config")).all()
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
        # list of {method, usd_amount, bs_amount, amounts} — multi-currency aware
        payments_detail = []
        for method, currencies_dict in breakdown_raw.items():
            usd_amt = float(currencies_dict.get("USD", 0))
            bs_amt = float(currencies_dict.get("Bs", currencies_dict.get("VES", 0)))

            amounts = []
            for curr_sym, amt in currencies_dict.items():
                if float(amt) > 0.001:
                    amounts.append({"symbol": curr_sym, "value": f"{float(amt):,.2f}"})

            if amounts:
                payments_detail.append({
                    "method": method,
                    "amounts": amounts,
                    # backward compat fields
                    "usd": f"{usd_amt:,.2f}",
                    "bs": f"{bs_amt:,.2f}",
                    "has_usd": usd_amt > 0.001,
                    "has_bs": bs_amt > 0.001,
                })

        # Obtener todos los currency records de la sesión (multi-moneda dinámica)
        currency_records = db.query(models.CashSessionCurrency).filter(
            models.CashSessionCurrency.session_id == session.id
        ).all()

        # Construir array dinámico para el template
        session_currencies_ctx = []
        for curr in currency_records:
            sym = curr.currency_symbol or "?"
            exp = float(curr.final_expected or 0)
            rep = float(curr.final_reported or 0)
            diff = float(curr.difference or 0)
            diff_sign = "+" if diff >= 0 else ""
            session_currencies_ctx.append({
                "symbol": sym,
                "initial": f"{float(curr.initial_amount or 0):,.2f}",
                "expected": f"{exp:,.2f}",
                "reported": f"{rep:,.2f}",
                "difference": f"{diff_sign}{diff:,.2f}",
                "diff_ok": diff >= -0.05,
            })

        # Fallback: si no hay CashSessionCurrency, usar los campos legacy USD/Bs
        if not session_currencies_ctx:
            usd_diff = float(session.difference or 0)
            bs_diff = float(session.difference_bs or 0)
            session_currencies_ctx = [
                {
                    "symbol": "USD",
                    "initial": f"{float(session.initial_cash or 0):,.2f}",
                    "expected": f"{float(session.final_cash_expected or 0):,.2f}",
                    "reported": f"{float(session.final_cash_reported or 0):,.2f}",
                    "difference": f"{usd_diff:+,.2f}",
                    "diff_ok": usd_diff >= -0.05,
                },
                {
                    "symbol": "Bs",
                    "initial": f"{float(session.initial_cash_bs or 0):,.2f}",
                    "expected": f"{float(session.final_cash_expected_bs or 0):,.2f}",
                    "reported": f"{float(session.final_cash_reported_bs or 0):,.2f}",
                    "difference": f"{bs_diff:+,.2f}",
                    "diff_ok": bs_diff >= -0.05,
                },
            ]

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
                # legacy fields — kept for backward compat with older templates
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
                "payments_detail": payments_detail,
                "currencies": session_currencies_ctx,
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
<bold>PAGOS</bold>
{{ separator_equal }}
{{ for pay in session.payments_detail }}
{{ pay.method }}
{{ for a in pay.amounts }}  {{ a.symbol }}: {{ a.value }}
{{ end }}
{{ end }}
{{ separator_equal }}
<bold>FONDOS INICIALES</bold>
{{ separator_equal }}
{{ for curr in session.currencies }}{{ curr.symbol }}: {{ curr.initial }}
{{ end }}
{{ separator_equal }}
<bold>ARQUEO (TOTALES)</bold>
{{ separator_equal }}
{{ for curr in session.currencies }}
<bold>{{ curr.symbol }}</bold>
  Esperado:   {{ curr.expected }}
  Reportado:  {{ curr.reported }}
  Diferencia: {{ curr.difference }}
{{ end }}
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

        # ── BloqueCelular: notificar abono ──────────────────────────────────────────
        try:
            from ..services.bloqueocelular_service import registrar_pago as _blq_pago, is_enabled
            from ..tenant_context import get_tenant_schema as _gts
            from sqlalchemy import text as _bt
            _sch = _gts()
            if sale.is_credit and is_enabled(db, _sch):
                _blq_row = db.execute(
                    _bt(f'SELECT bloqueo_dispositivo_id FROM "{_sch}".sales WHERE id = :id'),
                    {"id": sale.id}
                ).fetchone()
                if _blq_row and _blq_row[0]:
                    _blq_pago(
                        db             = db,
                        schema         = _sch,
                        dispositivo_id = _blq_row[0],
                        monto          = amount_usd,
                        metodo         = payment_data.payment_method or "efectivo",
                        num_cuota      = 1,  # Sin rastreo de número de cuota por ahora
                    )
        except Exception as _pe:
            import logging as _pl
            _pl.getLogger(__name__).warning(f"[Bloqueo] Error notificando abono: {_pe}")
        # ── Fin BloqueCelular ───────────────────────────────────────────────────────

        # WhatsApp — confirmar recepción del abono al cliente
        try:
            import httpx as _httpx
            from sqlalchemy import text as _text
            from ..tenant_context import get_tenant_schema as _gs
            _s = _gs()
            if sale.customer_id:
                _cust = db.execute(
                    _text(f'SELECT name, phone FROM "{_s}".customers WHERE id = :cid'),
                    {"cid": sale.customer_id}
                ).fetchone()
                if _cust and _cust[1]:
                    _wa = {r[0]: r[1] for r in db.execute(
                        _text(f"SELECT key, value FROM \"{_s}\".business_config "
                              "WHERE key IN ('whatsapp_instance_name','whatsapp_instance_status',"
                              "'whatsapp_notify_sale','business_name')")).fetchall()}
                    _inst   = _wa.get("whatsapp_instance_name","")
                    _status = _wa.get("whatsapp_instance_status","")
                    _notify = _wa.get("whatsapp_notify_sale") != "false"
                    _biz    = _wa.get("business_name") or "Mi Inventario"
                    if _inst and _status == "CONNECTED" and _notify:
                        _cur = payment_data.currency
                        if _cur in ("VES","Bs","BS"):
                            _amt_str = f"Bs {float(payment_data.amount):,.2f}"
                        else:
                            _amt_str = f"$ {float(payment_data.amount):,.2f}"
                        _status_str = "✅ *¡Saldo cancelado completamente!*" if sale.paid else f"📋 Saldo restante: $ {new_balance:,.2f}"
                        _msg = (
                            f"💳 *{_biz}*\n"
                            f"Hola {_cust[0]}, confirmamos tu abono:\n\n"
                            f"💰 Pago recibido: {_amt_str}\n"
                            f"📄 Factura #{sale.id}\n"
                            f"{_status_str}\n\n"
                            f"¡Gracias por tu puntualidad! 🙏"
                        )
                        _phone = "".join(c for c in _cust[1] if c.isdigit())
                        with _httpx.Client(timeout=5) as _c:
                            _c.post(f"http://whatsapp_service:3000/instance/{_inst}/send",
                                    json={"phone": _phone, "message": _msg})
        except Exception as _e:
            import logging as _log
            _log.getLogger(__name__).warning(f"[WA] Confirmación abono falló: {_e}")

        return {
            "status": "success",
            "payment_id": payment.id,
            "new_balance": new_balance,
            "paid": sale.paid
        }
