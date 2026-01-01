from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from typing import List
from datetime import datetime

from ....database.db import get_db
from ....dependencies import get_current_active_user, require_restaurant_module
from ....models.restaurant import RestaurantTable, RestaurantOrder, RestaurantOrderItem, RestaurantRecipe, TableStatusDB, OrderStatusDB, OrderItemStatusDB
from ....models.models import Product
from ....schemas.restaurant import OrderCreate, OrderRead, OrderItemCreate, TableRead
from ....schemas.restaurant_checkout import RestaurantCheckout
from ....services.sales_service import SalesService
from ....services.printer_service import PrinterService
from ....websocket.manager import manager
from ....websocket.events import WebSocketEvents
from .... import schemas
from fastapi import BackgroundTasks
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
        # Si ya está ocupada, retornar la orden actual activa (idempotencia o error, aquí error por claridad)
        # Opcional: Buscar orden activa y retornarla
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
    
    db.commit()
    db.refresh(new_order)
    return new_order

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

@router.post("/{order_id}/items", response_model=OrderRead)
def add_items_to_order(order_id: int, items: List[OrderItemCreate], background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
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
    for item_in in items:
        # Validar producto
        product = db.query(Product).filter(Product.id == item_in.product_id).first()
        if not product:
            continue # O lanzar error
            
        # Calcular subtotal
        price = product.price # Precio snapshot
        subtotal = price * item_in.quantity
        
        # Crear item
        new_item = RestaurantOrderItem(
            order_id=order.id,
            product_id=product.id,
            product=product, # Populate relationship for Pydantic response
            quantity=item_in.quantity,
            notes=item_in.notes,
            unit_price=price,
            subtotal=subtotal
        )
        db.add(new_item)
        db.flush() # Get ID and auto-populate defaults
        
        # Actualizar total de la orden (simple suma incremental o recalculo total)
        order.total_amount += subtotal
        
        # Collect for printing
        new_items_list.append(new_item)
        
    order.updated_at = datetime.now()
    db.commit()
    db.refresh(order)
    
    # TRIGGER KITCHEN PRINT
    try:
        if new_items_list:
            # Generate Payload
            print_payload = PrinterService.generate_kitchen_ticket(order, new_items_list)
            
            # Send to WebSocket (Target: Kitchen)
            background_tasks.add_task(
                run_broadcast, 
                "print_kitchen_ticket", 
                {
                    "type": "print",
                    "sale_id": order.id, # Using order ID as sale ID context
                    "payload": print_payload
                }
            )
    except Exception as e:
        print(f"Error queuing kitchen ticket: {e}")

    return order

# --- KITCHEN ENDPOINTS ---

@router.get("/kitchen/pending", response_model=List[OrderRead])
def get_pending_kitchen_orders(db: Session = Depends(get_db)):
    """
    Obtener todas las órdenes que tienen items PENDIENTES o EN PREPARACION.
    Ideal para el KDS (Kitchen Display System).
    """
    try:
        # Note: OrderItemStatusDB must have PREPARING.
        # Ensure we are comparing against OrderItemStatusDB members, not OrderStatusDB
        
        orders = db.query(RestaurantOrder).filter(
            RestaurantOrder.items.any(
                RestaurantOrderItem.status.in_([
                    OrderItemStatusDB.PENDING, 
                    OrderItemStatusDB.PREPARING
                ])
            ),
            RestaurantOrder.status.notin_([OrderStatusDB.PAID, OrderStatusDB.CANCELLED])
        ).options(
            joinedload(RestaurantOrder.items).joinedload(RestaurantOrderItem.product)
        ).order_by(RestaurantOrder.created_at.asc()).all()
        
        # print(f"DEBUG KITCHEN: Found {len(orders)} orders")
        # if orders:
        #    print(f"DEBUG KITCHEN: First order items: {orders[0].items}")
            
        return orders
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"ERROR KITCHEN: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/items/{item_id}/status")
def update_order_item_status(item_id: int, status: str, db: Session = Depends(get_db)):
    """
    Actualizar estado de un item (ej: PENDING -> READY)
    """
    try:
        # Validate Enum
        new_status = OrderItemStatusDB(status)
    except ValueError:
         raise HTTPException(status_code=400, detail=f"Invalid status. Allowed: {[e.value for e in OrderItemStatusDB]}")

    item = db.query(RestaurantOrderItem).filter(RestaurantOrderItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    item.status = new_status
    db.commit()
    
    return {"status": "success", "item_id": item_id, "new_status": new_status.value}

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
    ).options(joinedload(RestaurantOrderItem.product)).all()
    
    if not order_items:
         raise HTTPException(status_code=400, detail="Cannot checkout an empty order")

    for item in order_items:
        # Check if product is correctly loaded
        if not item.product:
             continue 
        
        # --- RECIPE INVENTORY LOGIC (ESCANDALLO) ---
        try:
            # 1. Check if this product is a Dish with a Recipe
            recipes = db.query(RestaurantRecipe).filter(RestaurantRecipe.product_id == item.product_id).all()
            
            if recipes:
                # It has a recipe! Deduct ingredients.
                for recipe_item in recipes:
                    # Assuming recipe_item.ingredient is loaded or we fetch it
                    # We need to fetch the ingredient product to update its stock
                    ingredient = db.query(Product).filter(Product.id == recipe_item.ingredient_id).first()
                    if ingredient:
                        try:
                            # Safely handle potential None/Decimal types
                            qty_needed = float(recipe_item.quantity or 0)
                            qty_sold = float(item.quantity or 0)
                            total_needed = qty_needed * qty_sold
                            
                            current_stock = float(ingredient.stock or 0)
                            ingredient.stock = current_stock - total_needed
                            db.add(ingredient)
                        except Exception as e:
                            print(f"[ERROR] Error calculating recipe deduction for {ingredient.name}: {e}")
                # NOTE: The Dish itself (item.product) will still be processed by SalesService.
        except Exception as e:
            print(f"[ERROR] Critical Recipe Logic Failed: {e}")
        
        sale_items.append(schemas.SaleDetailCreate(
            product_id=item.product_id,
            quantity=float(item.quantity),
            unit_price=float(item.unit_price), 
            subtotal=float(item.subtotal), 
            conversion_factor=1,
            discount=0,
            discount_type="NONE"
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
        customer_id=checkout_data.client_id, # Optional customer
        is_credit=False, # Restaurant usually immediate payment
        exchange_rate=1.0, # Placeholder, SalesService calculates/uses payment rates
        currency=checkout_data.currency,
        items=sale_items,
        payments=[
            schemas.SalePaymentCreate(
                amount=p.amount,
                currency=p.currency,
                payment_method=p.payment_method,
                exchange_rate=p.exchange_rate
            ) for p in checkout_data.payments
        ],
        total_amount=float(order.total_amount), # Expected total
        payment_method=checkout_data.payment_method, # Main method
        notes=f"Restaurant Order #{order.id} - Table {order.table_id}"
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
    
    # Liberar Mesa
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
