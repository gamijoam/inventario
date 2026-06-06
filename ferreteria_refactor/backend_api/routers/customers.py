from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from ..database.db import get_db
from ..models import models
from .. import schemas
from ..websocket.manager import manager
from ..websocket.events import WebSocketEvents
from ..cache import get_cached, set_cached, invalidate_resource, TTL
from ..tenant_context import get_tenant_schema

router = APIRouter(
    prefix="/customers",
    tags=["customers"]
)


def _invalidate_customers_cache():
    try:
        invalidate_resource(get_tenant_schema(), "customers")
    except Exception:
        pass


@router.get("/")
@router.get("", include_in_schema=False)
def read_customers(
    skip: int = 0,
    limit: int = Query(default=500, le=5000),
    q: Optional[str] = None,
    include_inactive: bool = Query(default=False, description="Incluir clientes inactivos (soft-deleted)"),
    db: Session = Depends(get_db)
):
    schema = get_tenant_schema()
    cache_extra = f"skip={skip}:limit={limit}:q={q or ''}:inactive={include_inactive}"
    cached = get_cached(schema, "customers", cache_extra)
    if cached is not None:
        return cached

    query = db.query(models.Customer)
    if not include_inactive:
        query = query.filter(models.Customer.is_active == True)
    if q:
        search = f"%{q}%"
        query = query.filter(
            (models.Customer.name.ilike(search)) |
            (models.Customer.id_number.ilike(search))
        )
    total = query.count()
    items = query.offset(skip).limit(limit).all()
    result = {
        "items": [schemas.CustomerRead.model_validate(item).model_dump(mode="json") for item in items],
        "total": total,
        "has_more": (skip + limit) < total
    }
    set_cached(schema, "customers", result, cache_extra, ttl=TTL.get("customers", 120))
    return result

@router.post("/", response_model=schemas.CustomerRead)
@router.post("", response_model=schemas.CustomerRead, include_in_schema=False)
async def create_customer(customer: schemas.CustomerCreate, db: Session = Depends(get_db)):
    # Check duplicate ID
    if customer.id_number:
        exists = db.query(models.Customer).filter(models.Customer.id_number == customer.id_number).first()
        if exists:
            raise HTTPException(status_code=400, detail="Customer with this ID Number already exists")
            
    db_customer = models.Customer(**customer.model_dump())
    db.add(db_customer)
    db.flush() # ID generation
    
    # Capture data before commit
    response_data = {
        "id": db_customer.id,
        "name": db_customer.name,
        "id_number": db_customer.id_number,
        "phone": db_customer.phone,
        "email": db_customer.email,
        "address": db_customer.address,
        "credit_limit": db_customer.credit_limit,
        "payment_term_days": db_customer.payment_term_days,
        "is_blocked": db_customer.is_blocked,
        "is_active": db_customer.is_active
    }

    db.commit()
    _invalidate_customers_cache()
    # db.refresh(db_customer) # REMOVED

    # Broadcast customer created
    await manager.broadcast(WebSocketEvents.CUSTOMER_CREATED, {
        "id": response_data["id"],
        "name": response_data["name"],
        "id_number": response_data["id_number"],
        "credit_limit": float(response_data["credit_limit"]) if response_data["credit_limit"] else 0.0
    })
    
    # WhatsApp — mensaje de bienvenida al cliente nuevo
    if response_data.get("phone"):
        try:
            import httpx as _httpx
            from sqlalchemy import text as _text
            from ..tenant_context import get_tenant_schema as _gs
            _s = _gs()
            _wa = {r[0]: r[1] for r in db.execute(
                _text(f"SELECT key, value FROM \"{_s}\".business_config "
                      "WHERE key IN ('whatsapp_instance_name','whatsapp_instance_status',"
                      "'whatsapp_notify_welcome','business_name','whatsapp_template_welcome')")
            ).fetchall()}
            _inst   = _wa.get("whatsapp_instance_name", "")
            _status = _wa.get("whatsapp_instance_status", "")
            _notify = _wa.get("whatsapp_notify_welcome") != "false"
            _biz    = _wa.get("business_name") or "Mi Inventario"
            _tpl    = _wa.get("whatsapp_template_welcome") or (
                "👋 ¡Hola {{cliente}}! Bienvenido/a a *{{negocio}}*.\n\nYa tienes tu cuenta registrada. Estamos para servirte. 😊"
            )
            if _inst and _status == "CONNECTED" and _notify:
                _msg  = _tpl.replace("{{cliente}}", response_data["name"]).replace("{{negocio}}", _biz)
                _ph   = "".join(c for c in response_data["phone"] if c.isdigit())
                async with _httpx.AsyncClient(timeout=5) as _c:
                    await _c.post(f"http://whatsapp_service:3000/instance/{_inst}/send",
                                  json={"phone": _ph, "message": _msg})
        except Exception as _e:
            import logging as _l
            _l.getLogger(__name__).warning(f"[WA] Bienvenida falló: {_e}")

    return response_data

@router.put("/{customer_id}", response_model=schemas.CustomerRead)
async def update_customer(customer_id: int, customer_data: schemas.CustomerCreate, db: Session = Depends(get_db)):
    db_customer = db.query(models.Customer).filter(models.Customer.id == customer_id).first()
    if not db_customer:
        raise HTTPException(status_code=404, detail="Customer not found")
        
    for key, value in customer_data.model_dump(exclude_unset=True).items():
        setattr(db_customer, key, value)
        
    # Capture data before commit
    response_data = {
        "id": db_customer.id,
        "name": db_customer.name,
        "id_number": db_customer.id_number,
        "phone": db_customer.phone,
        "email": db_customer.email,
        "address": db_customer.address,
        "credit_limit": db_customer.credit_limit,
        "payment_term_days": db_customer.payment_term_days,
        "is_blocked": db_customer.is_blocked,
        "is_active": db_customer.is_active
    }

    db.commit()
    _invalidate_customers_cache()
    # db.refresh(db_customer) # REMOVED

    # Broadcast customer updated
    await manager.broadcast(WebSocketEvents.CUSTOMER_UPDATED, {
        "id": response_data["id"],
        "name": response_data["name"],
        "id_number": response_data["id_number"],
        "credit_limit": float(response_data["credit_limit"]) if response_data["credit_limit"] else 0.0
    })
    
    return response_data

@router.get("/{customer_id}/debt")
def get_customer_debt(customer_id: int, db: Session = Depends(get_db)):
    # Calculate Total Credit Sales
    # Note: Logic assumes 'is_credit=True' sales contribute to debt.
    # We might need to handle 'paid' status if we want to ignore fully paid ones,
    # but for a running balance, usually we sum ALL credit sales and subtract ALL payments.
    
    # 1. Sum of all Credit Sales for this customer
    # We must be careful not to double count if we have a different tracking system.
    # Assuming: total_amount_bs or total_amount depending on currency?
    # For now, let's standardise on USD (total_amount).
    
    from sqlalchemy import func
    
    total_credit_sales = db.query(func.sum(models.Sale.total_amount))\
        .filter(models.Sale.customer_id == customer_id)\
        .filter(models.Sale.is_credit == True)\
        .scalar() or 0.0
        
    # 2. Sum of all Payments
    # 2. Sum of all Payments (Converted to USD)
    # We must retrieve payments and sum them manually to handle conversion if DB is mixed currency
    payments = db.query(models.Payment).filter(models.Payment.customer_id == customer_id).all()
    total_payments_usd = 0.0
    
    for p in payments:
        if p.currency == "Bs" and p.exchange_rate_used > 0:
            total_payments_usd += (p.amount / p.exchange_rate_used)
        else:
            total_payments_usd += p.amount
            
    debt = total_credit_sales - total_payments_usd
    return {"debt": round(debt, 2)} # Round for clean display

@router.get("/{customer_id}/financial-status")
def get_customer_financial_status(customer_id: int, db: Session = Depends(get_db)):
    """
    Get comprehensive financial status for a customer including:
    - Total debt (balance_pending from unpaid credit sales)
    - Credit limit and available credit
    - Overdue invoices count and amount
    - Block status
    """
    try:
        from sqlalchemy import func
        from datetime import datetime
        
        customer = db.query(models.Customer).filter(models.Customer.id == customer_id).first()
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")
        
        # Calculate total debt from balance_pending of unpaid credit sales
        # Use coalesce to handle None
        total_debt = db.query(func.sum(models.Sale.balance_pending)).filter(
            models.Sale.customer_id == customer_id,
            models.Sale.is_credit == True,
            models.Sale.paid == False
        ).scalar() or 0.0
        
        # Ensure float for calculation
        total_debt = float(total_debt)
        credit_limit = float(customer.credit_limit or 0)

        # Count and sum overdue invoices
        now = datetime.now()
        overdue_invoices = db.query(models.Sale).filter(
            models.Sale.customer_id == customer_id,
            models.Sale.is_credit == True,
            models.Sale.paid == False,
            models.Sale.due_date < now
        ).all()
        
        overdue_count = len(overdue_invoices)
        overdue_amount = sum(float(sale.balance_pending or 0) for sale in overdue_invoices)
        
        # Calculate available credit
        available_credit = max(0.0, credit_limit - total_debt)
        
        return {
            "customer_id": customer.id,
            "customer_name": customer.name,
            "total_debt": round(total_debt, 2),
            "credit_limit": round(customer.credit_limit, 2),
            "available_credit": round(available_credit, 2),
            "overdue_invoices": overdue_count,
            "overdue_amount": round(overdue_amount, 2),
            "is_blocked": customer.is_blocked,
            "payment_term_days": customer.payment_term_days
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] Financial Status Failed: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{customer_id}")
def delete_customer(customer_id: int, db: Session = Depends(get_db)):
    """Soft-delete a customer (set is_active=False)"""
    customer = db.query(models.Customer).filter(models.Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    customer.is_active = False
    db.commit()
    _invalidate_customers_cache()
    return {"status": "success", "message": "Cliente desactivado"}


@router.put("/{customer_id}/deactivate")
def deactivate_customer(customer_id: int, db: Session = Depends(get_db)):
    """Deactivate (soft-delete) a customer"""
    customer = db.query(models.Customer).filter(models.Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    customer.is_active = False
    db.commit()
    _invalidate_customers_cache()
    return {"status": "success", "message": "Cliente desactivado"}


@router.put("/{customer_id}/activate")
def activate_customer(customer_id: int, db: Session = Depends(get_db)):
    """Reactivate a soft-deleted customer"""
    customer = db.query(models.Customer).filter(models.Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    customer.is_active = True
    db.commit()
    return {"status": "success", "message": "Cliente reactivado"}

from ..dependencies import cashier_or_admin

@router.post("/{customer_id}/payments", dependencies=[Depends(cashier_or_admin)])
def create_customer_payment(customer_id: int, payment: schemas.CustomerPaymentCreate, db: Session = Depends(get_db)):
    db_customer = db.query(models.Customer).filter(models.Customer.id == customer_id).first()
    if not db_customer:
        raise HTTPException(status_code=404, detail="Customer not found")
        
    new_payment = models.Payment(
        customer_id=customer_id,
        amount=payment.amount,
        description=payment.description,
        payment_method=payment.payment_method,
        currency=payment.currency,
        exchange_rate_used=payment.exchange_rate,
        # Calculate amount_bs if currency is Bs, or convert if needed.
        # For simple storage, we store what was paid.
        amount_bs = payment.amount if payment.currency in ["Bs", "VES"] else (payment.amount * payment.exchange_rate)
    )
    
    # 1.5 Link to Active Cash Session (Enforce Open Session)
    active_session = db.query(models.CashSession).filter(models.CashSession.status == "OPEN").first()
    if not active_session:
        raise HTTPException(status_code=400, detail="No hay una caja abierta. Debe abrir caja para recibir pagos.")
    
    new_payment.session_id = active_session.id
    print(f"[INFO] Pago de deuda vinculado a Sesión #{active_session.id}")

    db.add(new_payment)
    
    # 2. FIFO Debt Reduction Logic (CRITICAL FIX)
    # Convert payment to USD to apply against debt (which is tracked in USD)
    payment_value_usd = float(payment.amount)
    if payment.currency in ["Bs", "VES"] and payment.exchange_rate > 0:
        payment_value_usd = float(payment.amount) / float(payment.exchange_rate)
    
    remaining_payment = payment_value_usd
    
    # Get unpaid sales ordered by date (Oldest first)
    pending_sales = db.query(models.Sale).filter(
        models.Sale.customer_id == customer_id,
        models.Sale.is_credit == True,
        models.Sale.paid == False
    ).order_by(models.Sale.date.asc()).all()
    
    print(f"[CREDIT] Applying Payment ${payment_value_usd:.2f} to {len(pending_sales)} pending sales")
    
    for sale in pending_sales:
        if remaining_payment <= 0:
            break
            
        balance = float(sale.balance_pending or 0)
        
        if balance <= 0:
            sale.paid = True # Should already be paid, but safety check
            continue
            
        if remaining_payment >= balance:
            # Pay off this sale completely
            remaining_payment -= balance
            sale.balance_pending = 0
            sale.paid = True
            print(f"   -> Sale #{sale.id} PAID FULL. (Amt: ${balance})")
        else:
            # Partial payment
            sale.balance_pending = balance - remaining_payment
            remaining_payment = 0
            print(f"   -> Sale #{sale.id} Partial. Remaining Balance: ${sale.balance_pending}")
            
    db.commit()
    
    # Broadcast customer updated
    customer = db_customer
    total_debt = db.query(models.Sale.balance_pending).filter(
        models.Sale.customer_id == customer_id,
        models.Sale.is_credit == True,
        models.Sale.paid == False
    ).limit(100).all() # Just trigger update, frontend calls financial-status
    # Re-trigger broadcast
    
    return {"status": "success", "applied_usd": payment_value_usd}


# ══════════════════════════════════════════════════════════════
# HISTORIAL 360° DEL CLIENTE
# ══════════════════════════════════════════════════════════════

@router.get("/{customer_id}/360")
def get_customer_360(
    customer_id: int,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user = Depends(cashier_or_admin)
):
    """
    Vista 360° del cliente: resumen financiero, timeline unificado
    de actividad y productos más comprados.
    """
    from sqlalchemy import func, desc, case
    from decimal import Decimal

    tenant_id = str(current_user.tenant_id) if current_user.tenant_id else "public"

    # ── 1. Cliente base ────────────────────────────────────────
    customer = db.query(models.Customer).filter(
        models.Customer.id == customer_id
    ).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    # ── 2. Ventas del cliente ──────────────────────────────────
    sales = db.query(models.Sale).filter(
        models.Sale.customer_id == customer_id
    ).order_by(desc(models.Sale.date)).limit(limit).all()

    total_spent = db.query(func.sum(models.Sale.total_amount)).filter(
        models.Sale.customer_id == customer_id,
        models.Sale.paid == True
    ).scalar() or Decimal("0")

    total_sales_count = db.query(func.count(models.Sale.id)).filter(
        models.Sale.customer_id == customer_id
    ).scalar() or 0

    # ── 3. Órdenes de taller ──────────────────────────────────
    orders = db.query(models.ServiceOrder).filter(
        models.ServiceOrder.customer_id == customer_id,
        models.ServiceOrder.tenant_id == tenant_id
    ).order_by(desc(models.ServiceOrder.created_at)).limit(limit).all()

    total_orders = db.query(func.count(models.ServiceOrder.id)).filter(
        models.ServiceOrder.customer_id == customer_id,
        models.ServiceOrder.tenant_id == tenant_id
    ).scalar() or 0

    total_orders_amount = db.query(
        func.sum(models.ServicePayment.amount)
    ).join(
        models.ServiceOrder,
        models.ServicePayment.service_order_id == models.ServiceOrder.id
    ).filter(
        models.ServiceOrder.customer_id == customer_id,
        models.ServiceOrder.tenant_id == tenant_id
    ).scalar() or Decimal("0")

    # ── 4. Cotizaciones del cliente ───────────────────────────
    quotes = db.query(models.Quote).filter(
        models.Quote.customer_id == customer_id
    ).order_by(desc(models.Quote.date)).limit(limit).all()

    pending_quotes = db.query(func.count(models.Quote.id)).filter(
        models.Quote.customer_id == customer_id,
        models.Quote.status == "PENDING"
    ).scalar() or 0

    # ── 5. Pagos de crédito ───────────────────────────────────
    credit_payments = db.query(models.Payment).filter(
        models.Payment.customer_id == customer_id
    ).order_by(desc(models.Payment.date)).limit(limit).all()

    # ── 6. Top productos más comprados ────────────────────────
    top_products = db.query(
        models.Product.id,
        models.Product.name,
        func.sum(models.SaleDetail.quantity).label("total_qty"),
        func.sum(models.SaleDetail.subtotal).label("total_amount"),
        func.count(models.SaleDetail.sale_id).label("times_bought")
    ).join(
        models.SaleDetail, models.SaleDetail.product_id == models.Product.id
    ).join(
        models.Sale, models.Sale.id == models.SaleDetail.sale_id
    ).filter(
        models.Sale.customer_id == customer_id
    ).group_by(
        models.Product.id, models.Product.name
    ).order_by(
        desc(func.sum(models.SaleDetail.subtotal))
    ).limit(5).all()

    # ── 7. Timeline unificado (ventas + órdenes + cotizaciones + pagos) ──
    timeline = []

    for sale in sales:
        timeline.append({
            "type": "sale",
            "id": sale.id,
            "ref": f"VEN-{str(sale.id).zfill(5)}",
            "date": sale.date.isoformat() if sale.date else None,
            "amount": float(sale.total_amount),
            "method": sale.payment_method,
            "status": "CREDIT" if sale.is_credit and not sale.paid else "PAID",
            "meta": {
                "is_credit": sale.is_credit,
                "paid": sale.paid,
                "balance_pending": float(sale.balance_pending) if sale.balance_pending else 0,
            }
        })

    for order in orders:
        total_order_paid = sum(
            float(p.amount) for p in order.payments
        ) if order.payments else 0
        timeline.append({
            "type": "service_order",
            "id": order.id,
            "ref": order.ticket_number,
            "date": order.created_at.isoformat() if order.created_at else None,
            "amount": float(total_order_paid),
            "method": None,
            "status": order.status.value if hasattr(order.status, 'value') else str(order.status),
            "meta": {
                "device": f"{order.brand or ''} {order.model or ''}".strip() or order.device_type,
                "problem": order.problem_description,
            }
        })

    for quote in quotes:
        timeline.append({
            "type": "quote",
            "id": quote.id,
            "ref": f"COT-{str(quote.id).zfill(5)}",
            "date": quote.date.isoformat() if quote.date else None,
            "amount": float(quote.total_amount),
            "method": None,
            "status": quote.status,
            "meta": {
                "items_count": len(quote.details) if quote.details else 0,
            }
        })

    for payment in credit_payments:
        timeline.append({
            "type": "credit_payment",
            "id": payment.id,
            "ref": f"PAG-{str(payment.id).zfill(5)}",
            "date": payment.date.isoformat() if payment.date else None,
            "amount": float(payment.amount),
            "method": payment.payment_method,
            "status": "PAID",
            "meta": {}
        })

    # Ordenar timeline por fecha descendente
    timeline.sort(key=lambda x: x["date"] or "", reverse=True)
    timeline = timeline[:limit]

    # ── 8. Resumen financiero ─────────────────────────────────
    # Calcular saldo real desde ventas a crédito no pagadas
    credit_limit = float(customer.credit_limit) if customer.credit_limit else 0

    real_balance = db.query(func.sum(models.Sale.balance_pending)).filter(
        models.Sale.customer_id == customer_id,
        models.Sale.is_credit == True,
        models.Sale.paid == False,
        models.Sale.status != 'VOIDED'
    ).scalar()
    current_balance = float(real_balance) if real_balance else 0

    # Fallback: si el modelo tiene current_balance en BD, usar el mayor
    if hasattr(customer, 'current_balance') and customer.current_balance:
        current_balance = max(current_balance, float(customer.current_balance))

    return {
        "customer": {
            "id": customer.id,
            "name": customer.name,
            "id_number": customer.id_number,
            "phone": customer.phone,
            "email": customer.email,
            "address": customer.address,
            "is_active": customer.is_active,
            "is_blocked": customer.is_blocked,
            "credit_limit": credit_limit,
            "current_balance": current_balance,
            "payment_term_days": customer.payment_term_days,
        },
        "summary": {
            "total_spent": float(total_spent),
            "total_sales": total_sales_count,
            "total_orders": total_orders,
            "total_orders_amount": float(total_orders_amount),
            "pending_quotes": pending_quotes,
            "credit_available": max(0, credit_limit - current_balance),
            "lifetime_value": float(total_spent) + float(total_orders_amount),
        },
        "top_products": [
            {
                "id": p.id,
                "name": p.name,
                "total_qty": float(p.total_qty),
                "total_amount": float(p.total_amount),
                "times_bought": p.times_bought,
            }
            for p in top_products
        ],
        "timeline": timeline,
    }
