from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from datetime import datetime
from decimal import Decimal
import json

from ....database.db import get_db
from .... import models
from .... import schemas
from ....schemas.print import PrintJobRequest, PrintType
from ....websocket.manager import manager
from ....websocket.events import WebSocketEvents
from ....models.restaurant import (
    RestaurantOrder,
    RestaurantOrderItem,
    RestaurantOrderItemModifier,
    ProductModifierOption,
    RestaurantTable,
    RestaurantMenuSection,
    RestaurantMenuItem
)
from ....models.models import Product  # Import global Product model
# from ....models.models import Warehouse, ProductStock, Kardex  # Import warehouse models if needed

router = APIRouter(
    prefix="/print",
    tags=["Restaurant - Print"]
)

@router.post("/", status_code=status.HTTP_202_ACCEPTED)
async def create_print_job(
    print_request: PrintJobRequest,
    db: Session = Depends(get_db)
):
    # 1. Load Order Details
    order = db.query(RestaurantOrder).filter(
        RestaurantOrder.id == print_request.order_id
    ).options(
        joinedload(RestaurantOrder.table),
        joinedload(RestaurantOrder.items)
            .joinedload(RestaurantOrderItem.product),
        joinedload(RestaurantOrder.items)
            .joinedload(RestaurantOrderItem.modifiers)
            .joinedload(RestaurantOrderItemModifier.option)
    ).first()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # 2. Build Print Template and Context based on PrintType
    template_name = ""
    context_data = {
        "order_id": order.id,
        "table_name": order.table.name if order.table else "Para Llevar",
        "customer_name": order.customer_name,
        "created_at": order.created_at.strftime("%Y-%m-%d %H:%M:%S"),
        "total_amount": float(order.total_amount),
        "items": []
    }

    # Helper to get product name for modifier (if the option has an ingredient, get its name)
    def get_modifier_ingredient_name(modifier_option: ProductModifierOption) -> str:
        if modifier_option.ingredient_id:
            ingredient_product = db.query(models.Product).filter(models.Product.id == modifier_option.ingredient_id).first()
            return f"({modifier_option.name} - desc. {ingredient_product.name})"
        return f"({modifier_option.name})"


    for item in order.items:
        item_data = {
            "product_name": item.product.name,
            "quantity": float(item.quantity),
            "unit_price": float(item.unit_price),
            "subtotal": float(item.subtotal),
            "notes": item.notes,
            "modifiers": []
        }
        for modifier_record in item.modifiers:
            if modifier_record.option:
                item_data["modifiers"].append({
                    "name": modifier_record.option.name,
                    "price_adjustment": float(modifier_record.option.price_adjustment),
                    "ingredient_info": get_modifier_ingredient_name(modifier_record.option) # Use helper
                })
        context_data["items"].append(item_data)

    if print_request.print_type == PrintType.KITCHEN_COMMAND:
        template_name = "kitchen_command_template"
        # Filter for PENDING/SENT items only for kitchen
        context_data["items"] = [
            item for item in context_data["items"] if item["status"] in ["PENDING", "SENT", "PREPARING"]
        ]
    elif print_request.print_type == PrintType.PRE_CHECK:
        template_name = "pre_check_template"
        # Add payment info, etc.
    elif print_request.print_type == PrintType.INVOICE:
        template_name = "invoice_template"
        # Add tax, payment details, client info
    else:
        template_name = "generic_receipt_template" # Default

    # 3. Send Print Job via WebSocket
    # Determine which Bridge client to send to (based on tenantId, and potentially printer_target)
    # The Bridge client_id is typically "BRIDGE_<something>" or just the tenant_id.
    # We will assume the Bridge connects with its _config.ClientId
    
    bridge_client_id = print_request.printer_target # The Bridge should be configured to map this to its internal ID
    if not bridge_client_id:
        # Fallback to a default config in DB using BusinessConfig
        config = db.query(models.BusinessConfig).filter(models.BusinessConfig.key == "BRIDGE_DEFAULT_PRINTER_CLIENT_ID").first()
        bridge_client_id = config.value if config else None
        
        if not bridge_client_id:
            raise HTTPException(status_code=500, detail="Default printer client ID not configured.")

    # Construct the WebSocket message payload
    ws_message_payload = {
        "type": "print",
        "payload": {
            "template": template_name,
            "context": context_data,
            "target": print_request.printer_target # Pass original target to Bridge for routing
        }
    }

    # Use manager.send_personal_message to send to a specific client_id (the Bridge)
    await manager.send_personal_message(
        json.dumps(ws_message_payload),
        client_id=bridge_client_id, # Target the Bridge instance
        tenant_id=db.info["tenant_id"] # Use the current tenant_id from the DB session
    )

    return {"message": "Print job sent successfully", "print_type": print_request.print_type, "printer_target": print_request.printer_target}
