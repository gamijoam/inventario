from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from datetime import datetime
from decimal import Decimal

from ....database.db import get_db
from ....dependencies import get_current_active_user, require_restaurant_module
from ....models.restaurant import RestaurantTable, RestaurantOrder, RestaurantOrderItem, RestaurantRecipe, TableStatusDB, OrderStatusDB, OrderItemStatusDB, RestaurantOrderItemModifier, ProductModifierOption
from ....models import models
from ....models.models import Product
from ....schemas.restaurant import OrderCreate, OrderRead, OrderItemCreate, OrderItemCreateWithModifiers, TableRead, OrderMove, OrderSplit
from ....schemas.restaurant_checkout import RestaurantCheckout
from ....services.inventory_service import InventoryService
from ....services.sales_service import SalesService
from ....services.printer_service import PrinterService
from ....websocket.manager import manager
from ....websocket.events import WebSocketEvents
from .... import schemas
from fastapi import BackgroundTasks
from sqlalchemy import text
from ....database.db import get_tenant_schema
from ....template_presets import get_restaurant_precheck_58_template, get_restaurant_precheck_80_template
from pydantic import BaseModel
import asyncio

# Helper for WebSocket broadcast
def run_broadcast(event: str, data: dict):
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(manager.broadcast(event, data))
    finally:
        loop.close()

router = APIRouter(
    prefix="/orders",
    tags=["Restaurante - Órdenes"],
    dependencies=[Depends(get_current_active_user), Depends(require_restaurant_module)]
)

@router.post("/open/{table_id}", response_model=OrderRead)
def open_table(table_id: int, db: Session = Depends(get_db), current_user = Depends(get_current_active_user)):
    """
    Abrir una mesa: Cambia estado a OCCUPIED y crea una Orden PENDING.
    """
    # 1. Verificar mesa
    table = db.query(RestaurantTable).filter(RestaurantTable.id == table_id).first()
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")

    if table.status == TableStatusDB.OCCUPIED:
        raise HTTPException(status_code=400, detail="Table is already occupied")

    # 2. Crear Orden
    new_order = RestaurantOrder(
        table_id=table.id,
        waiter_id=current_user.id,
        status=OrderStatusDB.PENDING,
        total_amount=0
    )
    db.add(new_order)

    # 3. Actualizar Mesa
    table.status = TableStatusDB.OCCUPIED

    db.flush()
    db.commit()

    # Return plain dict to avoid ORM lazy-load issues
    return {
        "id": new_order.id,
        "table_id": new_order.table_id,
        "waiter_id": new_order.waiter_id,
        "status": new_order.status.value if hasattr(new_order.status, 'value') else new_order.status,
        "is_takeout": new_order.is_takeout or False,
        "customer_name": new_order.customer_name,
        "total_amount": float(new_order.total_amount),
        "created_at": new_order.created_at.isoformat() if new_order.created_at else None,
        "items": []
    }

@router.post("/open-takeout", response_model=OrderRead)
def open_takeout(customer_name: Optional[str] = None, db: Session = Depends(get_db), current_user = Depends(get_current_active_user)):
    """
    Abrir un pedido PARA LLEVAR (sin mesa).
    """
    new_order = RestaurantOrder(
        table_id=None,
        waiter_id=current_user.id,
        is_takeout=True,
        customer_name=customer_name,
        status=OrderStatusDB.PENDING,
        total_amount=0
    )
    db.add(new_order)
    db.flush()
    db.commit()

    # Return plain dict to avoid ORM lazy-load issues
    return {
        "id": new_order.id,
        "table_id": new_order.table_id,
        "waiter_id": new_order.waiter_id,
        "status": new_order.status.value if hasattr(new_order.status, 'value') else new_order.status,
        "is_takeout": new_order.is_takeout or True,
        "customer_name": new_order.customer_name,
        "total_amount": float(new_order.total_amount),
        "created_at": new_order.created_at.isoformat() if new_order.created_at else None,
        "items": []
    }

@router.get("/{table_id}/current", response_model=OrderRead)
def get_current_order(table_id: int, db: Session = Depends(get_db)):
    """
    Obtener la orden activa de una mesa ocupada.
    """
    # Buscar una orden para esta mesa que NO esté pagada ni cancelada
    active_order = db.query(RestaurantOrder).filter(
        RestaurantOrder.table_id == table_id,
        RestaurantOrder.status.in_([OrderStatusDB.PENDING, OrderStatusDB.PREPARING, OrderStatusDB.READY, OrderStatusDB.DELIVERED])
    ).first()
    
    if not active_order:
         raise HTTPException(status_code=404, detail="No active order found for this table")
    
    # Eager loading items handled by schema from_attributes automatically if relationship works, 
    # but efficient query might need .options(joinedload(RestaurantOrder.items))
    return active_order

@router.get("/{order_id}", response_model=OrderRead)
def get_order_by_id(order_id: int, db: Session = Depends(get_db)):
    """
    Obtener una orden específica por ID, incluyendo modificadores de cada item.
    """
    order = db.query(RestaurantOrder).filter(RestaurantOrder.id == order_id).options(
        joinedload(RestaurantOrder.items).joinedload(RestaurantOrderItem.product)
    ).first()
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Build response with modifiers
    items_data = []
    for item in order.items:
        item_mods = db.query(RestaurantOrderItemModifier).filter(
            RestaurantOrderItemModifier.order_item_id == item.id
        ).all()
        mods_data = []
        for m in item_mods:
            opt = db.query(ProductModifierOption).filter(ProductModifierOption.id == m.option_id).first()
            if opt:
                mods_data.append({"id": opt.id, "name": opt.name, "price_applied": float(m.price_applied or 0)})
        items_data.append({
            "id": item.id,
            "product_id": item.product_id,
            "quantity": float(item.quantity),
            "notes": item.notes,
            "status": item.status.value if hasattr(item.status, "value") else item.status,
            "unit_price": float(item.unit_price),
            "subtotal": float(item.subtotal),
            "product_name": item.product.name if item.product else "Unknown",
            "modifiers": mods_data
        })
    
    return {
        "id": order.id,
        "table_id": order.table_id,
        "waiter_id": order.waiter_id,
        "status": order.status.value if hasattr(order.status, "value") else order.status,
        "is_takeout": order.is_takeout or False,
        "customer_name": order.customer_name,
        "total_amount": float(order.total_amount),
        "created_at": order.created_at.isoformat() if order.created_at else None,
        "items": items_data
    }

@router.post("/{order_id}/items", response_model=OrderRead)
def add_items_to_order(order_id: int, items: List[OrderItemCreateWithModifiers], background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """
    Agregar productos a una orden existente. recalcula el total.
    """
    order = db.query(RestaurantOrder).filter(RestaurantOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
        
    if order.status in [OrderStatusDB.PAID, OrderStatusDB.CANCELLED]:
        raise HTTPException(status_code=400, detail="Cannot add items to a closed order")

    # Procesar items
    new_items_list = []
    removed_ingredients_map = {}  # {item_id: [ingredient_id, ...]}

    for item_in in items:
        # Validar producto
        product = db.query(Product).filter(Product.id == item_in.product_id).first()
        if not product:
            continue # O lanzar error

        # Calcular precio base + ajuste de modificadores
        price = product.price  # Precio snapshot base
        modifier_adjustment = Decimal("0.00")
        modifier_ids = item_in.modifier_option_ids or []
        removed_ingredient_ids = item_in.removed_ingredient_ids or []

        selected_options = []
        if modifier_ids:
            selected_options = db.query(ProductModifierOption).filter(
                ProductModifierOption.id.in_(modifier_ids)
            ).all()
            for opt in selected_options:
                modifier_adjustment += opt.price_adjustment or Decimal("0.00")

        effective_price = price + modifier_adjustment
        subtotal = effective_price * item_in.quantity

        # Construir nota de ingredientes removidos para cocina
        removed_notes = ""
        if removed_ingredient_ids:
            removed_ingredients = db.query(Product).filter(Product.id.in_(removed_ingredient_ids)).all()
            removed_names = [f"SIN {ing.name.upper()}" for ing in removed_ingredients]
            removed_notes = " | ".join(removed_names)
            removed_ingredients_map[item_in.product_id] = removed_ingredient_ids

        # Combinar notas del mesero con las de ingredientes removidos
        final_notes = item_in.notes or ""
        if removed_notes:
            final_notes = f"{final_notes} [{removed_notes}]" if final_notes else removed_notes
        
        # Crear item
        new_item = RestaurantOrderItem(
            order_id=order.id,
            product_id=product.id,
            product=product,  # Populate relationship for Pydantic response
            quantity=item_in.quantity,
            notes=final_notes,
            unit_price=effective_price,
            subtotal=subtotal,
            status=OrderItemStatusDB.SERVED if not product.needs_kitchen else OrderItemStatusDB.PENDING
        )
        db.add(new_item)
        db.flush()  # Get ID and auto-populate defaults

        # Guardar modificadores seleccionados
        for opt in selected_options:
            mod_record = RestaurantOrderItemModifier(
                order_item_id=new_item.id,
                option_id=opt.id,
                price_applied=opt.price_adjustment or Decimal("0.00")
            )
            db.add(mod_record)
        
        # Actualizar total de la orden
        order.total_amount += subtotal
        
        # Collect for printing
        new_items_list.append(new_item)
        
    order.updated_at = datetime.now()
    
    # --- IMMEDIATE STOCK DEDUCTION ---
    from ....services.inventory_service import InventoryService
    from ....models import models as core_models
    
    # Find Restaurant Warehouse (Main or First active)
    warehouse = db.query(core_models.Warehouse).filter(core_models.Warehouse.is_main == True).first()
    if not warehouse:
        warehouse = db.query(core_models.Warehouse).filter(core_models.Warehouse.is_active == True).first()

    if not warehouse:
        raise HTTPException(status_code=400, detail="No hay ningún almacén configurado para deductar stock")

    if new_items_list:
        InventoryService.deduct_order_items_stock(db, new_items_list, warehouse.id, removed_ingredients_map=removed_ingredients_map)
        db.flush()
    # ---------------------------------

    db.commit()

    # TRIGGER KITCHEN PRINT - but don't fail the response if this errors
    try:
        if new_items_list:
            print_payload = PrinterService.generate_kitchen_ticket(order, new_items_list)
            background_tasks.add_task(
                run_broadcast,
                "print_kitchen_ticket",
                {
                    "type": "print",
                    "sale_id": order.id,
                    "payload": print_payload
                }
            )
    except Exception as e:
        print(f"Error queuing kitchen ticket: {e}")

    # Return plain dict using new_items_list data
    items_data = []
    for item in new_items_list:
        product_name = None
        if item.product:
            product_name = item.product.name
        items_data.append({
            "id": item.id,
            "product_id": item.product_id,
            "quantity": float(item.quantity),
            "notes": item.notes,
            "status": item.status.value if hasattr(item.status, 'value') else item.status,
            "unit_price": float(item.unit_price),
            "subtotal": float(item.subtotal),
            "product_name": product_name or "Unknown"
        })

    return {
        "id": order.id,
        "table_id": order.table_id,
        "waiter_id": order.waiter_id,
        "status": order.status.value if hasattr(order.status, 'value') else order.status,
        "is_takeout": order.is_takeout or False,
        "customer_name": order.customer_name,
        "total_amount": float(order.total_amount),
        "created_at": order.created_at.isoformat() if order.created_at else None,
        "items": items_data
    }

# --- KITCHEN ENDPOINTS ---

@router.get("/kitchen/pending", response_model=List[OrderRead])
def get_pending_kitchen_orders(db: Session = Depends(get_db)):
    """
    Obtener todas las órdenes que tienen items PENDIENTES, ENVIADOS o EN PREPARACION.
    """
    try:
        # Define target statuses as strings to avoid Enum comparison issues in some environments
        target_item_statuses = ['PENDING', 'SENT', 'PREPARING', 'READY']
        closed_order_statuses = ['PAID', 'CANCELLED']

        orders = db.query(RestaurantOrder).filter(
            RestaurantOrder.items.any(RestaurantOrderItem.status.in_(target_item_statuses)),
            RestaurantOrder.status.notin_(closed_order_statuses)
        ).options(
            joinedload(RestaurantOrder.items).joinedload(RestaurantOrderItem.product),
            joinedload(RestaurantOrder.table)
        ).order_by(RestaurantOrder.created_at.asc()).all()
        
        return orders
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/items/{item_id}/status")
def update_order_item_status(
    item_id: int, 
    status: str, 
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """
    Actualizar estado de un item (ej: PENDING -> READY, READY -> SERVED).
    
    Validaciones:
    - Solo ADMIN o el mesero ASIGNADO a la orden puede modificar
    - SERVED solo puede ser marcado por el mesero asignado (no por cocina)
    """
    try:
        new_status = OrderItemStatusDB(status)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid status. Allowed: {[e.value for e in OrderItemStatusDB]}")

    item = db.query(RestaurantOrderItem).filter(RestaurantOrderItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    order = item.order
    
    is_admin = getattr(current_user, 'role', None) == models.UserRole.ADMIN
    is_assigned_waiter = order.waiter_id == current_user.id
    
    if not (is_admin or is_assigned_waiter):
        raise HTTPException(
            status_code=403, 
            detail="No tienes permiso para modificar esta orden. Solo el mesero asignado o un administrador puede hacerlo."
        )

    old_status = item.status
    item.status = new_status
    db.commit()

    if new_status == OrderItemStatusDB.READY and old_status != OrderItemStatusDB.READY:
        manager.broadcast(WebSocketEvents.SYSTEM_NOTIFICATION, {
            "type": "order:item_ready",
            "order_id": order.id,
            "table_id": order.table_id,
            "item_id": item_id,
            "product_name": item.product.name if item.product else "Unknown",
            "waiter_id": order.waiter_id
        })

    if new_status == OrderItemStatusDB.SERVED:
        all_served = all(
            i.status == OrderItemStatusDB.SERVED or i.status == OrderItemStatusDB.CANCELLED
            for i in order.items
        )
        if all_served and order.table_id:
            table = db.query(RestaurantTable).filter(RestaurantTable.id == order.table_id).first()
            if table:
                table.status = TableStatusDB.WAITING_BILL
                db.commit()
                manager.broadcast(WebSocketEvents.SYSTEM_NOTIFICATION, {
                    "type": "order:ready_to_bill",
                    "order_id": order.id,
                    "table_id": order.table_id,
                    "table_name": table.name,
                    "waiter_id": order.waiter_id
                })
    
    return {"status": "success", "item_id": item_id, "new_status": new_status.value}

@router.delete("/items/{item_id}")
def cancel_order_item(
    item_id: int, 
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """
    Cancela un item de orden y revierte el stock reservado.
    Solo funciona para items que aún no han sido servidos.
    """
    item = db.query(RestaurantOrderItem).filter(RestaurantOrderItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    order = item.order

    is_admin = getattr(current_user, 'role', None) == models.UserRole.ADMIN
    is_assigned_waiter = order.waiter_id == current_user.id

    if not (is_admin or is_assigned_waiter):
        raise HTTPException(
            status_code=403,
            detail="No tienes permiso para cancelar este item."
        )
    
    if item.status == OrderItemStatusDB.SERVED:
        raise HTTPException(status_code=400, detail="No se puede cancelar un item ya servido")
    
    if order.status == OrderStatusDB.PAID:
        raise HTTPException(status_code=400, detail="No se puede modificar una orden pagada")
    
    item_price = float(item.subtotal)
    item_quantity = float(item.quantity)
    
    InventoryService.reverse_stock_for_item(db, item)
    
    db.delete(item)
    
    order.total_amount = max(0, float(order.total_amount) - item_price)
    order.updated_at = datetime.now()
    
    db.commit()
    
    return {"status": "success", "message": "Item cancelado y stock revertido"}

@router.get("/stock/{product_id}")
def get_product_stock(product_id: int, db: Session = Depends(get_db)):
    """
    Retorna la disponibilidad real de un producto considerando stock físico
    y reservas en órdenes activas de restaurante.
    """
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    main_warehouse = db.query(models.Warehouse).filter(models.Warehouse.is_main == True).first()
    if not main_warehouse:
        main_warehouse = db.query(models.Warehouse).filter(models.Warehouse.is_active == True).first()
    
    if not main_warehouse:
        return {
            "product_id": product_id,
            "product_name": product.name,
            "stock_total": 0,
            "stock_reserved": 0,
            "stock_available": 0,
            "warehouse_id": None,
            "has_recipe": False,
            "recipe_ingredients": []
        }
    
    availability = InventoryService.get_product_availability(db, product_id, main_warehouse.id)
    
    recipes = db.query(RestaurantRecipe).filter(RestaurantRecipe.product_id == product_id).all()
    
    return {
        "product_id": product_id,
        "product_name": product.name,
        "stock_total": availability["stock_total"],
        "stock_reserved": availability["stock_reserved"],
        "stock_available": availability["stock_available"],
        "warehouse_id": availability["warehouse_id"],
        "has_recipe": len(recipes) > 0,
        "recipe_ingredients": [
            {
                "ingredient_id": r.ingredient_id,
                "ingredient_name": r.ingredient.name if r.ingredient else "Unknown",
                "quantity_per_dish": float(r.quantity)
            }
            for r in recipes
        ]
    }

@router.post("/{order_id}/checkout")
def checkout_order(
    order_id: int, 
    checkout_data: RestaurantCheckout,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """
    Cerrar mesa y procesar pago (Checkout).
    Convierte la RestaurantOrder en una Sale del sistema.
    """
    # 1. Obtener Orden
    order = db.query(RestaurantOrder).filter(RestaurantOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
        
    if order.status == OrderStatusDB.PAID:
        raise HTTPException(status_code=400, detail="Order is already paid")

    # 2. Preparar datos para SalesService.create_sale
    # Convertir RestaurantOrderItems a SaleItemCreate
    sale_items = []
    
    # Reload items to be sure
    order_items = db.query(RestaurantOrderItem).filter(
        RestaurantOrderItem.order_id == order.id,
        RestaurantOrderItem.status != OrderItemStatusDB.CANCELLED
    ).options(
        joinedload(RestaurantOrderItem.product),
        joinedload(RestaurantOrderItem.modifiers).joinedload(RestaurantOrderItemModifier.option)
    ).all()
    
    if not order_items:
         raise HTTPException(status_code=400, detail="Cannot checkout an empty order")

    for item in order_items:
        # Check if product is correctly loaded
        if not item.product:
             continue 
        
        # Load associated modifiers for the OrderItem
        item_modifier_records = db.query(RestaurantOrderItemModifier).filter(
            RestaurantOrderItemModifier.order_item_id == item.id
        ).all()
        
        # Extract the option_ids from these modifier records
        modifier_option_ids = [mod.option_id for mod in item_modifier_records]

        # Calculate aggregate recipe factor from modifiers
        aggregate_factor = Decimal("1.0")
        for mod in item.modifiers: # Item.modifiers already loaded if OrderItem was queried with joinedload(RestaurantOrderItem.modifiers)
            if mod.option and mod.option.recipe_factor:
                aggregate_factor *= Decimal(str(mod.option.recipe_factor))
        
        # SalesService now handles Recipe/Escandallo inventory deduction automatically
        
        sale_items.append(schemas.SaleDetailCreate(
            product_id=item.product_id,
            quantity=float(item.quantity),
            unit_price=float(item.unit_price), 
            subtotal=float(item.subtotal), 
            conversion_factor=1,
            discount=0,
            discount_type="NONE",
            recipe_factor=aggregate_factor,
            modifier_option_ids=modifier_option_ids, # Pass modifier IDs to SalesService
            skip_stock_deduction=item.stock_deducted or False
        ))
    
    # Construir SaleCreate
    # Usamos checkout_data para el método de pago, pero el total viene de la orden (seguridad)
    # VERIFICACION: El frontend envía pagos que deben sumar el total.
    # SalesService recalcula totalse en base a items, pero acepta pagos personalizados.
    
    # Validar total
    total_payments = sum(p.amount / (p.exchange_rate or 1) for p in checkout_data.payments) if checkout_data.payments else 0
    
    # Si no hay pagos detallados (legacy flow), usar el total de la orden
    if not checkout_data.payments:
        # Single payment shim
        pass 
    
    sale_create = schemas.SaleCreate(
        customer_id=checkout_data.client_id, 
        is_credit=False, 
        exchange_rate=Decimal(str(checkout_data.exchange_rate or 1.0)),
        currency=checkout_data.currency,
        items=sale_items,
        payments=[
            schemas.SalePaymentCreate(
                amount=Decimal(str(p.amount)),
                currency=p.currency,
                payment_method=p.payment_method,
                exchange_rate=Decimal(str(p.exchange_rate or 1.0))
            ) for p in checkout_data.payments
        ],
        total_amount=Decimal(str(order.total_amount)), 
        total_amount_bs=Decimal(str(checkout_data.total_amount_bs or 0.0)),
        change_amount=Decimal(str(checkout_data.change_amount or 0.0)),
        change_currency=checkout_data.change_currency or "VES",
        payment_method=checkout_data.payment_method, 
        notes=f"Restaurant Order #{order.id} - {'Table ' + str(order.table_id) if order.table_id else 'PARA LLEVAR'}"
    )

    # 3. Llamar al Servicio de Ventas (Reutilización de Lógica)
    # Esto maneja descuento de inventario, kardex, caja, etc.
    try:
        # SalesService.create_sale returns {"status": "success", "sale_id": new_sale.id}
        result = SalesService.create_sale(
            db=db, 
            sale_data=sale_create, 
            user_id=current_user.id
        )
        new_sale_id = result["sale_id"]
        
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing sale: {str(e)}")

    # 4. Actualizar Estado de la Orden y Mesa
    order.status = OrderStatusDB.PAID
    order.sale_id = new_sale_id
    order.updated_at = datetime.now()
    
    # Liberar Mesa (si aplica)
    if order.table_id:
        table = db.query(RestaurantTable).filter(RestaurantTable.id == order.table_id).first()
        if table:
            table.status = TableStatusDB.AVAILABLE
        
    db.commit()
    
    return {"status": "success", "sale_id": new_sale_id, "message": "Order closed and table freed"}

@router.post("/{order_id}/precheck")
def print_precheck(
    order_id: int, 
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """
    Imprimir Pre-Cuenta (Pro-Forma).
    No altera el estado de la orden.
    """
    order = db.query(RestaurantOrder).filter(RestaurantOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    try:
        # Generate Payload
        print_payload = PrinterService.generate_pre_check_ticket(order)
        
        # Send to WebSocket (Target: Cashier/Default)
        background_tasks.add_task(
            run_broadcast, 
            "print_precheck", 
            {
                "type": "print",
                "sale_id": order.id,
                "payload": print_payload
            }
        )
        return {"status": "success", "message": "Pre-check print queued"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error printing pre-check: {e}")

@router.get("/{order_id}/print/thermal")
def get_restaurant_precheck_thermal(
    order_id: int,
    width: str = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """
    Genera un payload de impresion termica para la pre-cuenta de restaurante.
    El frontend lo envia al Bridge via printerService.printRaw().
    """
    order = db.query(RestaurantOrder).options(
        joinedload(RestaurantOrder.table),
        joinedload(RestaurantOrder.items)
            .joinedload(RestaurantOrderItem.product),
        joinedload(RestaurantOrder.items)
            .joinedload(RestaurantOrderItem.modifiers)
            .joinedload(RestaurantOrderItemModifier.option)
    ).filter(RestaurantOrder.id == order_id).first()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    business_config = {}
    configs = db.execute(text(f"SELECT key, value FROM {get_tenant_schema()}.business_config")).all()
    for config in configs:
        business_config[config.key] = config.value

    total = sum(float(item.subtotal) for item in order.items if item.status != 'CANCELLED')

    context = {
        "business": {
            "name": business_config.get("business_name", "MI NEGOCIO"),
            "document_id": business_config.get("business_doc", ""),
            "address": business_config.get("business_address", ""),
            "phone": business_config.get("business_phone", ""),
        },
        "order": {
            "table_name": order.table.name if order.table else ("LLEVAR (" + order.customer_name + ")" if order.customer_name else "PARA LLEVAR"),
            "date": order.created_at.strftime("%d/%m/%Y") if order.created_at else "",
            "time": order.created_at.strftime("%I:%M %p") if order.created_at else "",
            "items": [
                {
                    "product_name": item.product.name,
                    "quantity": int(float(item.quantity)) if float(item.quantity) % 1 == 0 else float(item.quantity),
                    "subtotal": f"{float(item.subtotal):.2f}",
                }
                for item in order.items if item.status != 'CANCELLED'
            ],
            "total": f"{total:.2f}",
        }
    }

    effective_width = width if width in ("58", "80") else business_config.get("paper_width", "58")
    template = get_restaurant_precheck_80_template() if effective_width == "80" else get_restaurant_precheck_58_template()

    return {
        "status": "ready",
        "template": template,
        "context": context
    }

@router.post("/{order_id}/move")
def move_order(order_id: int, move_data: OrderMove, db: Session = Depends(get_db)):
    """
    Mover una orden a otra mesa (Cambio de Mesa).
    La mesa destino debe estar disponible.
    """
    # 1. Validar Orden
    order = db.query(RestaurantOrder).filter(RestaurantOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order.is_takeout:
        raise HTTPException(status_code=400, detail="Cannot move a takeout order to a table (use a table-based order instead)")
    
    # 2. Validar Mesa Destino
    target_table = db.query(RestaurantTable).filter(RestaurantTable.id == move_data.target_table_id).first()
    if not target_table:
        raise HTTPException(status_code=404, detail="Target table not found")
    
    if target_table.status != TableStatusDB.AVAILABLE:
        raise HTTPException(status_code=400, detail="Target table is not available")

    # 3. Mover
    old_table = order.table
    
    # Actualizar puntero de mesa en orden
    order.table_id = target_table.id
    
    # Actualizar estados de mesa
    target_table.status = TableStatusDB.OCCUPIED
    
    # Liberar mesa anterior (si no tiene otras órdenes activas)
    # Verificamos si hay otras ordenes activas en la mesa vieja
    other_orders = db.query(RestaurantOrder).filter(
        RestaurantOrder.table_id == old_table.id,
        RestaurantOrder.id != order.id,
        RestaurantOrder.status.in_([OrderStatusDB.PENDING, OrderStatusDB.PREPARING, OrderStatusDB.READY, OrderStatusDB.DELIVERED])
    ).count()
    
    if other_orders == 0:
        old_table.status = TableStatusDB.AVAILABLE

    db.commit()
    return {"status": "success", "message": f"Moved order to table {target_table.name}"}


@router.post("/{order_id}/split")
def split_order(order_id: int, split_data: OrderSplit, db: Session = Depends(get_db), current_user = Depends(get_current_active_user)):
    """
    Dividir una cuenta.
    Crea una NUEVA orden en la MISMA mesa con los items seleccionados.
    Retorna el ID de la nueva orden para cobrarla.
    """
    # 1. Validar Orden Origen
    original_order = db.query(RestaurantOrder).filter(RestaurantOrder.id == order_id).first()
    if not original_order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if not split_data.items_to_split:
         raise HTTPException(status_code=400, detail="No items selected to split")

    # 2. Crear Nueva Orden (Sub-cuenta)
    # Misma mesa, mismo mesero
    new_order = RestaurantOrder(
        table_id=original_order.table_id,
        waiter_id=current_user.id,
        status=OrderStatusDB.PENDING,
        total_amount=0
    )
    db.add(new_order)
    db.flush() # Get new ID

    total_moved = 0
    total_removed_from_original = 0

    # 3. Procesar Items
    for split_item in split_data.items_to_split:
        # Buscar item original
        original_item = db.query(RestaurantOrderItem).filter(
            RestaurantOrderItem.id == split_item.item_id, 
            RestaurantOrderItem.order_id == original_order.id
        ).first()
        
        if not original_item:
            continue # O error
            
        qty_to_move = float(split_item.quantity)
        qty_original = float(original_item.quantity)
        
        if qty_to_move > qty_original:
            raise HTTPException(status_code=400, detail=f"Cannot split more than available for item {original_item.id}")
        
        # Calculate Logic
        price = float(original_item.unit_price)
        subtotal_moved = price * qty_to_move
        
        # A. Crear Item en Nueva Orden
        new_item = RestaurantOrderItem(
            order_id=new_order.id,
            product_id=original_item.product_id,
            quantity=qty_to_move,
            unit_price=original_item.unit_price,
            subtotal=subtotal_moved, # Calc subtotal
            notes=original_item.notes,
            status=original_item.status # Preserve status (e.g. if already cooked)
        )
        db.add(new_item)
        total_moved += subtotal_moved
        
        # B. Reducir/Eliminar de Original
        if qty_to_move == qty_original:
            # Mover todo -> Eliminar de original (o marcar status, pero mejor eliminar para 'split')
            # Ojo: delete() en ORM a veces es tricky con listas, mejor db.delete
            db.delete(original_item)
            total_removed_from_original += float(original_item.subtotal)
        else:
            # Reducir parcial
            original_item.quantity = qty_original - qty_to_move
            original_item.subtotal = float(original_item.subtotal) - subtotal_moved
            total_removed_from_original += subtotal_moved
    
    # 4. Actualizar Totales
    new_order.total_amount = total_moved
    original_order.total_amount = float(original_order.total_amount) - total_removed_from_original
    
    # Validaciones de integridad
    if original_order.total_amount < 0:
         original_order.total_amount = 0 # Should not happen with validation above
         
    db.commit()
    
    return {
        "status": "success", 
        "new_order_id": new_order.id, 
        "original_order_id": original_order.id,
        "message": "Order split successfully"
    }
