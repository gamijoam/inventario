from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import text
from .. import schemas
from ..models import models
from ..database.db import get_db
from ..tenant_context import get_tenant_schema
from ..dependencies import get_current_active_user
from ..security import pwd_context
from ..utils.time_utils import get_venezuela_now
from ..template_presets import (
    get_laundry_58_template, get_laundry_80_template,
    get_service_repair_58_template, get_service_repair_80_template,
)
from typing import List, Optional, Dict, Any
from sqlalchemy import desc
from enum import Enum
import traceback
import unicodedata
from decimal import Decimal
from ..services.service_checkout_service import ServiceCheckoutService


def _service_order_options():
    """Eager loading completo para ServiceOrder — carga TODAS las sub-relaciones
    que ProductRead necesita para evitar lazy loads post-commit (search_path lost)."""
    return [
        joinedload(models.ServiceOrder.customer),
        joinedload(models.ServiceOrder.technician),
        joinedload(models.ServiceOrder.payments),
        joinedload(models.ServiceOrder.details).joinedload(models.ServiceOrderDetail.technician),
        joinedload(models.ServiceOrder.details).joinedload(models.ServiceOrderDetail.product).selectinload(models.Product.category),
        joinedload(models.ServiceOrder.details).joinedload(models.ServiceOrderDetail.product).selectinload(models.Product.stocks),
        joinedload(models.ServiceOrder.details).joinedload(models.ServiceOrderDetail.product).selectinload(models.Product.units),
        joinedload(models.ServiceOrder.details).joinedload(models.ServiceOrderDetail.product).selectinload(models.Product.prices),
        joinedload(models.ServiceOrder.details).joinedload(models.ServiceOrderDetail.product).selectinload(models.Product.combo_items),
        joinedload(models.ServiceOrder.details).joinedload(models.ServiceOrderDetail.product).selectinload(models.Product.discount_rules),
        joinedload(models.ServiceOrder.details).joinedload(models.ServiceOrderDetail.product).selectinload(models.Product.price_rules),
    ]


def _ascii_safe(text: str) -> str:
    """Normaliza caracteres acentuados a ASCII para compatibilidad con impresoras ESC/POS."""
    if not text:
        return text
    return unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode('ascii')

router = APIRouter(
    prefix="/services",
    tags=["services"]
)

# 🔒 SECURITY DEPENDENCY: Ensure user has tenant context
# NOTE: We use current_user.tenant_id (from schema name or string ID)

@router.post("/orders", response_model=schemas.ServiceOrderRead)
def create_service_order(
    order_data: schemas.ServiceOrderCreate, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """Create a new service order with auto-generated Ticket Number"""
    try:
        # 1. Determine Tenant Context
        # Uses the schema_name string stored in user.tenant_id (or tenant.schema_name)
        # We'll rely on the user.tenant_id attribute we fixed earlier.
        tenant_id = str(current_user.tenant_id) if current_user.tenant_id else "public"
        
        # 2. Determine Prefix based on Service Type
        prefix = "SRV"
        if order_data.service_type == models.ServiceType.LAUNDRY:
            prefix = "LAV"

        # 3. Generate Ticket Number (Scoped by Tenant!)
        # Filter by tenant_id to allow same ticket numbers in different tenants
        last_order = db.query(models.ServiceOrder)\
            .filter(models.ServiceOrder.tenant_id == tenant_id)\
            .filter(models.ServiceOrder.ticket_number.like(f"{prefix}-%"))\
            .order_by(desc(models.ServiceOrder.id)).first()
        
        if last_order and last_order.ticket_number:
            try:
                last_num = int(last_order.ticket_number.split("-")[1])
                new_num = last_num + 1
            except (ValueError, IndexError, AttributeError):
                new_num = 1
        else:
            new_num = 1
            
        ticket_number = f"{prefix}-{new_num:05d}"
        
        # 4. Create Order
        new_order = models.ServiceOrder(
            ticket_number=ticket_number,
            tenant_id=tenant_id, # 🔒 Tenant Isolation
            customer_id=order_data.customer_id,
            technician_id=order_data.technician_id,
            status=models.ServiceOrderStatus.RECEIVED,
            service_type=order_data.service_type,
            
            device_type=order_data.device_type,
            brand=order_data.brand,
            model=order_data.model,
            serial_imei=order_data.serial_imei,
            passcode_pattern=order_data.passcode_pattern,
            
            problem_description=order_data.problem_description,
            physical_condition=order_data.physical_condition,
            diagnosis_notes=order_data.diagnosis_notes,
            estimated_delivery=order_data.estimated_delivery,
            order_metadata=order_data.order_metadata,
            priority=order_data.priority,
            warranty_policy_id=order_data.warranty_policy_id,
        )
        
        db.add(new_order)
        db.flush() # Get ID for details and payments

        # 5. Process Items (Cart)
        if order_data.items:
            for item in order_data.items:
                if item.product_id:
                    # PRODUCT ITEM
                    product = db.query(models.Product).filter(models.Product.id == item.product_id).first()
                    if not product:
                        continue
                    description = product.name
                    cost = product.cost_price
                    is_manual = False
                else:
                    # MANUAL ITEM
                    description = item.description or "Servicio Manual"
                    cost = 0 
                    is_manual = True
                    
                new_detail = models.ServiceOrderDetail(
                    service_order_id=new_order.id,
                    product_id=item.product_id,
                    description=description,
                    is_manual=is_manual,
                    observations=item.observations,
                    quantity=item.quantity,
                    unit_price=item.unit_price,
                    cost=cost, 
                    technician_id=item.technician_id or new_order.technician_id 
                )
                db.add(new_detail)
        
        # 6. Process Initial Payments (Abonos) - NEW!
        if order_data.payments:
            for p in order_data.payments:
                new_payment = models.ServicePayment(
                    tenant_id=tenant_id,
                    service_order_id=new_order.id,
                    amount=p.amount,
                    currency=p.currency,
                    payment_method=p.payment_method,
                    reference=p.reference
                )
                db.add(new_payment)

        # Eager load BEFORE commit (while search_path is still set)
        db.flush()

        final_order = db.query(models.ServiceOrder).options(
            *_service_order_options()
        ).filter(models.ServiceOrder.id == new_order.id).first()

        db.commit()

        return schemas.ServiceOrderRead.model_validate(final_order)
        
    except Exception as e:
        print(f"❌ [CRITICAL ERROR] Create Service Order Failed!")
        print(traceback.format_exc())
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error en servidor al crear orden: {str(e)}")

@router.delete("/orders/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_service_order(
    order_id: int, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """Delete a service order if it's not processed/paid"""
    # 🔒 Multi-Tenant Filter
    tenant_id = str(current_user.tenant_id) if current_user.tenant_id else "public"
    
    order = db.query(models.ServiceOrder).filter(
        models.ServiceOrder.id == order_id,
        models.ServiceOrder.tenant_id == tenant_id
    ).first()
    
    if not order:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    
    db.delete(order)
    db.commit()
    return None

@router.get("/orders", response_model=List[schemas.ServiceOrderRead])
def get_service_orders(
    skip: int = 0, 
    limit: int = 100, 
    status: Optional[str] = None,
    customer_id: Optional[int] = None,
    service_type: Optional[str] = None,
    search: Optional[str] = None, # NEW: Search term
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """List service orders with filters"""
    # 🔒 Multi-Tenant Filter
    tenant_id = str(current_user.tenant_id) if current_user.tenant_id else "public"
    
    query = db.query(models.ServiceOrder).filter(models.ServiceOrder.tenant_id == tenant_id)
    
    if status:
        query = query.filter(models.ServiceOrder.status == status)
    
    if service_type:
        query = query.filter(models.ServiceOrder.service_type == service_type)
    
    if customer_id:
        query = query.filter(models.ServiceOrder.customer_id == customer_id)
       
    if search:
        search_term = f"%{search}%"
        query = query.join(models.Customer).filter(
            (models.ServiceOrder.ticket_number.ilike(search_term)) |
            (models.Customer.name.ilike(search_term)) |
            (models.ServiceOrder.serial_imei.ilike(search_term))
        )

    # Order by newest first
    query = query.order_by(desc(models.ServiceOrder.created_at))
    
    return query.offset(skip).limit(limit).all()

@router.get("/orders/{order_id}", response_model=schemas.ServiceOrderRead)
def get_service_order(
    order_id: int, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """Get service order details"""
    # 🔒 Multi-Tenant Filter
    tenant_id = str(current_user.tenant_id) if current_user.tenant_id else "public"
    
    order = db.query(models.ServiceOrder).options(
        joinedload(models.ServiceOrder.payments)
    ).filter(
        models.ServiceOrder.id == order_id, 
        models.ServiceOrder.tenant_id == tenant_id
    ).first()
    
    if not order:
        raise HTTPException(status_code=404, detail="Service Order not found")
    return order

@router.post("/orders/{order_id}/items", response_model=schemas.ServiceOrderRead)
def add_service_order_item(
    order_id: int, 
    item_data: schemas.ServiceOrderDetailCreate, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """Add a product/service/spare part to the service order"""
    # 🔒 Multi-Tenant Check
    tenant_id = str(current_user.tenant_id) if current_user.tenant_id else "public"
    
    order = db.query(models.ServiceOrder).filter(
        models.ServiceOrder.id == order_id, 
        models.ServiceOrder.tenant_id == tenant_id
    ).first()
    
    if not order:
        raise HTTPException(status_code=404, detail="Service Order not found")
        
    if item_data.product_id:
        product = db.query(models.Product).filter(models.Product.id == item_data.product_id).first()
        if not product:
            raise HTTPException(status_code=400, detail="Product not found")

        description = product.name
        cost = product.cost_price
        is_manual = False
    else:
        if not item_data.description:
             raise HTTPException(status_code=400, detail="Description is required for manual items")
             
        description = item_data.description
        cost = 0 
        is_manual = True
        
    new_detail = models.ServiceOrderDetail(
        service_order_id=order_id,
        product_id=item_data.product_id,
        description=description,
        is_manual=is_manual,
        observations=item_data.observations,
        quantity=item_data.quantity,
        unit_price=item_data.unit_price,
        cost=cost, 
        technician_id=item_data.technician_id
    )
    
    db.add(new_detail)
    db.flush()

    # Reload BEFORE commit (while search_path is still set)
    result = db.query(models.ServiceOrder).options(
        *_service_order_options()
    ).filter(models.ServiceOrder.id == order_id).first()

    db.commit()
    return result

@router.delete("/orders/{order_id}/items/{item_id}", response_model=schemas.ServiceOrderRead)
def delete_service_order_item(
    order_id: int,
    item_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """Remove an item from the service order"""
    tenant_id = str(current_user.tenant_id) if current_user.tenant_id else "public"
    
    order = db.query(models.ServiceOrder).filter(
        models.ServiceOrder.id == order_id, 
        models.ServiceOrder.tenant_id == tenant_id
    ).first()
    
    if not order:
        raise HTTPException(status_code=404, detail="Service Order not found")
        
    item = db.query(models.ServiceOrderDetail).filter(
        models.ServiceOrderDetail.id == item_id,
        models.ServiceOrderDetail.service_order_id == order_id
    ).first()
    
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
        
    db.delete(item)
    db.flush()

    result = db.query(models.ServiceOrder).options(
        *_service_order_options()
    ).filter(models.ServiceOrder.id == order_id).first()

    db.commit()
    return result

@router.patch("/orders/{order_id}/status", response_model=schemas.ServiceOrderRead)
def update_service_order_status(
    order_id: int, 
    update_data: schemas.ServiceOrderUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """Update order status, diagnosis notes, and metadata"""
    tenant_id = str(current_user.tenant_id) if current_user.tenant_id else "public"
    
    order = db.query(models.ServiceOrder).filter(
        models.ServiceOrder.id == order_id, 
        models.ServiceOrder.tenant_id == tenant_id
    ).first()
    
    if not order:
        raise HTTPException(status_code=404, detail="Service Order not found")
        
    if update_data.status:
        # 🔒 AUTHORIZATION: Reverting DELIVERED orders requires Admin privileges or PIN
        if order.status == models.ServiceOrderStatus.DELIVERED and update_data.status != "DELIVERED":
            is_authorized = current_user.role == models.UserRole.ADMIN
            
            if not is_authorized and update_data.admin_pin:
                # Check if PIN belongs to ANY active admin (verify against bcrypt hash)
                admin_candidates = db.query(models.User).filter(
                    models.User.role == models.UserRole.ADMIN,
                    models.User.is_active == True,
                    models.User.pin.isnot(None)
                ).all()
                for candidate in admin_candidates:
                    if candidate.pin and pwd_context.verify(update_data.admin_pin, candidate.pin):
                        is_authorized = True
                        break
            
            if not is_authorized:
                raise HTTPException(
                    status_code=403, 
                    detail="Se requiere PIN de Administrador para revertir una orden entregada"
                )
        
        if update_data.status not in models.ServiceOrderStatus.__members__:
             raise HTTPException(status_code=400, detail=f"Invalid status")
        order.status = models.ServiceOrderStatus[update_data.status]

        # WhatsApp — notificar al cliente cuando su equipo está listo
        if update_data.status == "READY" and order.customer:
            try:
                import httpx as _httpx
                from sqlalchemy import text as _text
                from ..tenant_context import get_tenant_schema as _schema

                customer = order.customer
                if customer and customer.phone:
                    _s = _schema()
                    _wa_rows = db.execute(
                        _text(f"SELECT key, value FROM \"{_s}\".business_config "
                              "WHERE key IN ('whatsapp_instance_name','whatsapp_instance_status',"
                              "'whatsapp_notify_order_ready','whatsapp_template_order','business_name')")
                    ).fetchall()
                    _cfg      = {r[0]: r[1] for r in _wa_rows}
                    _inst     = _cfg.get("whatsapp_instance_name", "")
                    _status   = _cfg.get("whatsapp_instance_status", "")
                    _notify   = _cfg.get("whatsapp_notify_order_ready") != "false"
                    _biz      = _cfg.get("business_name") or "Mi Inventario"
                    _tpl      = _cfg.get("whatsapp_template_order") or (
                        "🔧 ¡Hola {{cliente}}! Tu equipo está listo 🎉\n\n"
                        "📱 {{equipo}}\n🎫 Orden: {{orden}}\n💰 Total: {{total}}\n\n"
                        "¡Puedes pasar a buscarlo en nuestro horario habitual!"
                    )

                    if _inst and _status == "CONNECTED" and _notify:
                        _total   = sum(float(d.quantity * d.unit_price) for d in order.details)
                        _paid    = sum(float(p.amount) for p in order.payments)
                        _pending = max(0, _total - _paid)
                        _device  = (f"{order.brand or ''} {order.model or ''}".strip()
                                   or order.device_type or "Equipo")
                        _ticket  = order.ticket_number or f"#{order.id}"

                        _total_str   = f"${_total:,.2f}" if _total > 0 else "—"
                        _pending_str = f" (pendiente: ${_pending:,.2f})" if _pending > 0.01 else ""

                        _msg = (_tpl
                            .replace("{{cliente}}", customer.name)
                            .replace("{{equipo}}",  _device)
                            .replace("{{orden}}",   _ticket)
                            .replace("{{total}}",   _total_str + _pending_str)
                            .replace("{{negocio}}", _biz)
                        )
                        _phone = "".join(c for c in customer.phone if c.isdigit())
                        with _httpx.Client(timeout=5) as _c:
                            _c.post(f"http://whatsapp_service:3000/instance/{_inst}/send",
                                    json={"phone": _phone, "message": _msg})
            except Exception as _wa_err:
                import logging as _log
                _log.getLogger(__name__).warning(f"[WA] Notif taller falló: {_wa_err}")

    if update_data.diagnosis_notes:
        order.diagnosis_notes = update_data.diagnosis_notes
        
    if update_data.order_metadata:
        if order.order_metadata:
             order.order_metadata = {**order.order_metadata, **update_data.order_metadata}
        else:
             order.order_metadata = update_data.order_metadata
             
    if update_data.technician_id:
        order.technician_id = update_data.technician_id

    if update_data.priority:
        order.priority = update_data.priority

    # Auto-checkout: si se marca como DELIVERED y ya tiene abonos que cubren el total,
    # crear la Sale automáticamente (sin requerir checkout manual).
    # IMPORTANTE: convert_order_to_sale requiere status=READY, así que revertimos
    # temporalmente, hacemos checkout, y luego volvemos a DELIVERED.
    if (update_data.status == "DELIVERED"
            and (order.order_metadata or {}).get("payment_status") != "PAID"):
        order_total = sum(float(d.quantity * d.unit_price) for d in order.details)
        total_paid = sum(float(p.amount) for p in order.payments)
        if total_paid >= order_total and order_total > 0:
            # Restaurar a READY para que checkout funcione, luego vuelve a DELIVERED
            order.status = models.ServiceOrderStatus.READY
            db.flush()
            try:
                checkout_data = schemas.ServiceCheckoutPayment(
                    total_amount=Decimal(str(order_total)),
                    total_amount_bs=Decimal("0.00"),
                    payment_method="Efectivo",
                    payments=[],
                )
                ServiceCheckoutService.convert_order_to_sale(
                    db, order.id, checkout_data, current_user.id
                )
                # convert_order_to_sale hace db.commit() internamente → search_path se pierde
                # Re-setear search_path antes de cualquier query post-checkout
                _schema = get_tenant_schema()
                if _schema and _schema != "public":
                    db.execute(text(f'SET search_path TO "{_schema}", public'))
                return schemas.ServiceOrderRead.model_validate(
                    db.query(models.ServiceOrder).options(
                        *_service_order_options()
                    ).filter(models.ServiceOrder.id == order_id).first()
                )
            except Exception as _e:
                # Checkout falló — rollback y continuar con flujo normal (status DELIVERED sin Sale)
                db.rollback()
                order.status = models.ServiceOrderStatus.DELIVERED

    db.flush()
    # Eager Load for status update response BEFORE commit
    final_order = db.query(models.ServiceOrder).options(
        *_service_order_options()
    ).filter(models.ServiceOrder.id == order_id).first()

    db.commit()

    return schemas.ServiceOrderRead.model_validate(final_order)


@router.get("/orders/status/ready", response_model=List[schemas.ServiceOrderRead])
def get_ready_service_orders(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """Get all service orders ready for checkout/delivery"""
    tenant_id = str(current_user.tenant_id) if current_user.tenant_id else "public"
    
    # We filter in Python to handle JSON metadata checking easily or use cast/JSON logic in SQL
    # But since it's a small list, Python filter is safer across DB types
    orders = db.query(models.ServiceOrder)\
        .options(joinedload(models.ServiceOrder.payments))\
        .filter(
            models.ServiceOrder.status == models.ServiceOrderStatus.READY,
            models.ServiceOrder.tenant_id == tenant_id
        ).all()
    
    return [o for o in orders if (o.order_metadata or {}).get("payment_status") != "PAID"]


@router.post("/orders/{order_id}/payments")
def add_service_payment(
    order_id: int,
    payment: schemas.ServicePaymentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """Registrar un abono/pago parcial a una orden de servicio."""
    tenant_id = str(current_user.tenant_id) if current_user.tenant_id else "public"
    order = db.query(models.ServiceOrder).options(
        *_service_order_options()
    ).filter(
        models.ServiceOrder.id == order_id,
        models.ServiceOrder.tenant_id == tenant_id
    ).first()
    if not order:
        raise HTTPException(status_code=404, detail="Orden no encontrada")

    if (order.order_metadata or {}).get("payment_status") == "PAID":
        raise HTTPException(status_code=400, detail="Esta orden ya está completamente pagada")

    new_payment = models.ServicePayment(
        tenant_id=tenant_id,
        service_order_id=order.id,
        amount=payment.amount,
        currency=payment.currency,
        payment_method=payment.payment_method,
        reference=payment.reference,
    )
    db.add(new_payment)
    db.flush()

    # Nota: payment_status=PAID solo se marca en el checkout (cuando se crea la Sale).
    # Los abonos se acumulan como ServicePayment y se migran al checkout.

    db.flush()
    # Re-query con eager loading ANTES del commit (search_path se pierde después)
    result = db.query(models.ServiceOrder).options(
        *_service_order_options(),
    ).filter(models.ServiceOrder.id == order.id).first()
    db.commit()
    return result


@router.post("/orders/{order_id}/checkout")
def checkout_service_order(
    order_id: int, 
    payment_data: schemas.ServiceCheckoutPayment,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """
    Convert a Service Order into a Sale (Process Payment).
    """
    # Verify Tenant ownership implicitly in convert_order_to_sale or here
    # Better here to fail fast
    tenant_id = str(current_user.tenant_id) if current_user.tenant_id else "public"
    order = db.query(models.ServiceOrder).filter(models.ServiceOrder.id == order_id, models.ServiceOrder.tenant_id == tenant_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    
    # 🔒 Double Billing Prevention
    if (order.order_metadata or {}).get("payment_status") == "PAID":
        raise HTTPException(status_code=400, detail="Esta orden ya ha sido pagada y facturada anteriormente.")
        
    sale = ServiceCheckoutService.convert_order_to_sale(db, order_id, payment_data, current_user.id)
    return {"status": "success", "sale_id": sale.id, "ticket_number": sale.id}


@router.get("/orders/{order_id}/print/thermal")
def get_laundry_thermal_payload(
    order_id: int,
    width: str = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """
    Generate a thermal print payload (template + context) for a laundry/service order.
    The frontend sends this payload to the Hardware Bridge via printerService.printRaw().
    Optional ?width=58 or ?width=80 — falls back to business config paper_width.
    """
    tenant_id = str(current_user.tenant_id) if current_user.tenant_id else "public"

    order = db.query(models.ServiceOrder).options(
        joinedload(models.ServiceOrder.customer),
        joinedload(models.ServiceOrder.details),
        joinedload(models.ServiceOrder.warranty_policy),
    ).filter(
        models.ServiceOrder.id == order_id,
        models.ServiceOrder.tenant_id == tenant_id
    ).first()

    if not order:
        raise HTTPException(status_code=404, detail="Orden no encontrada")

    # Business config (same pattern as sales_service)
    business_config = {}
    configs = db.query(models.BusinessConfig).all()
    for config in configs:
        business_config[config.key] = config.value

    # Calculate total from details
    total = sum(
        float(item.quantity) * float(item.unit_price)
        for item in (order.details or [])
    )

    metadata = order.order_metadata or {}

    # Warranty policy for repair receipts:
    # Priority 1 → policy assigned to this specific order (warranty_policy_id)
    # Priority 2 → tenant's default policy (is_default=True, is_active=True)
    warranty_context = None
    unit_map = {"DAYS": "días", "MONTHS": "meses", "YEARS": "años", "LIFETIME": "De por vida"}

    def _build_warranty_context(wp):
        dur_text = (
            f"{wp.duration} {unit_map.get(str(wp.type).split('.')[-1], str(wp.type))}"
            if wp.duration else unit_map.get(str(wp.type).split('.')[-1], str(wp.type))
        )
        return {
            "name": _ascii_safe(wp.name or ""),
            "duration_text": _ascii_safe(dur_text),
            "description": _ascii_safe(wp.description or ""),
        }

    try:
        # 1) Use order-specific policy if set
        if order.warranty_policy:
            warranty_context = _build_warranty_context(order.warranty_policy)
        else:
            # 2) Fall back to tenant default
            wp_query = db.query(models.WarrantyPolicy).filter(
                models.WarrantyPolicy.is_default == True,
                models.WarrantyPolicy.is_active == True,
            )
            wp = wp_query.first()
            if wp:
                warranty_context = _build_warranty_context(wp)
    except Exception:
        pass

    context = {
        "business": {
            "name": business_config.get("business_name", "MI NEGOCIO"),
            "document_id": business_config.get("business_doc", ""),
            "address": business_config.get("business_address", ""),
            "phone": business_config.get("business_phone", ""),
        },
        "order": {
            "ticket_number": order.ticket_number or str(order.id),
            "date": order.created_at.strftime("%d/%m/%Y %I:%M %p") if order.created_at else "",
            "customer": {
                "name": _ascii_safe(order.customer.name) if order.customer else "Sin cliente",
                "phone": order.customer.phone if order.customer else "",
                "id_number": order.customer.id_number if order.customer else "",
            },
            # Device info (repair orders)
            "device_type": _ascii_safe(order.device_type or ""),
            "brand": _ascii_safe(order.brand or ""),
            "model": _ascii_safe(order.model or ""),
            "serial_imei": order.serial_imei or "",
            "physical_condition": _ascii_safe(order.physical_condition or ""),
            "problem_description": _ascii_safe(order.problem_description or ""),
            # Items
            "items": [
                {
                    "description": detail.description or "",
                    "quantity": float(detail.quantity),
                    "unit_price": float(detail.unit_price),
                    "subtotal": float(detail.quantity) * float(detail.unit_price),
                    "observations": detail.observations or "",
                    "is_manual": bool(detail.is_manual) if hasattr(detail, "is_manual") else False,
                }
                for detail in (order.details or [])
            ],
            "total": total,
            "pieces": metadata.get("pieces", 0),
            "bag_color": metadata.get("bag_color", "---"),
            "priority": order.priority or "NORMAL",
            "diagnosis_notes": order.diagnosis_notes or "",
            # Warranty policy (default for this tenant)
            "warranty": warranty_context,
        },
    }

    # Template selection: repair vs laundry, then 58mm vs 80mm
    effective_width = width if width in ("58", "80") else business_config.get("paper_width", "58")
    # Use .value to safely get the string regardless of Python version behavior with str enums
    _stype = order.service_type
    service_type_str = (_stype.value if hasattr(_stype, "value") else str(_stype)).upper()
    is_repair = service_type_str != "LAUNDRY"
    if is_repair:
        template = get_service_repair_80_template() if effective_width == "80" else get_service_repair_58_template()
    else:
        template = get_laundry_80_template() if effective_width == "80" else get_laundry_58_template()

    return {
        "status": "ready",
        "template": template,
        "context": context,
    }

