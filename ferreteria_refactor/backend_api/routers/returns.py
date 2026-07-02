from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, cast, String, func
from typing import List, Optional
from ..database.db import get_db
from ..models import models
from .. import schemas
from ..commission_engine import CommissionEngine
from ..dependencies import get_current_active_user, require_permission, require_any_permission
from ..utils.time_utils import get_venezuela_now
from ..services.serialized_stock_service import reconcile_serialized_product_stock
from ..services.offline_sync_outbox import enqueue_sync_event, cash_session_uuid
from datetime import datetime, date
from decimal import Decimal
import unicodedata

router = APIRouter(
    prefix="/returns",
    tags=["returns"]
)


def _estimate_return_total(return_data: schemas.ReturnCreate, db: Session) -> Decimal:
    """Calculate the USD value of the return before mutating stock/cash."""
    sale = db.query(models.Sale).options(
        joinedload(models.Sale.details)
    ).filter(models.Sale.id == return_data.sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")

    total = Decimal("0.00")
    for item in return_data.items:
        if item.quantity <= 0:
            continue
        detail = next((d for d in sale.details if d.product_id == item.product_id), None)
        if not detail:
            raise HTTPException(status_code=400, detail=f"Product {item.product_id} not found in this sale")
        serial_numbers = getattr(item, 'serial_numbers', None) or []
        actual_qty = Decimal(str(len(serial_numbers))) if serial_numbers else Decimal(str(item.quantity))
        total += Decimal(str(detail.unit_price)) * actual_qty
    return total


def _is_bs_currency(value) -> bool:
    return str(value or "").strip().upper() in {"BS", "VES", "VEF", "BSS"}


def _strip_accents(value: str) -> str:
    return ''.join(
        char for char in unicodedata.normalize('NFKD', value or '')
        if not unicodedata.combining(char)
    )


def _sales_search_terms(value: Optional[str]) -> List[str]:
    raw = str(value or '').strip()
    if not raw:
        return []
    terms = {raw, _strip_accents(raw)}
    compact = ''.join(raw.split())
    if compact and compact != raw:
        terms.add(compact)
        terms.add(_strip_accents(compact))
    lowered = _strip_accents(raw.lower())
    if len(lowered) > 3:
        for base in list(terms):
            base_lower = _strip_accents(base.lower())
            if base_lower.endswith('es'):
                terms.add(base[:-2])
            if base_lower.endswith('s'):
                terms.add(base[:-1])
    return [term for term in terms if term]


def _sale_summary_dict(sale: models.Sale) -> dict:
    customer = None
    if sale.customer:
        customer = {
            "id": sale.customer.id,
            "name": sale.customer.name,
            "phone": sale.customer.phone,
            "id_number": sale.customer.id_number,
        }

    payments = [
        {
            "id": payment.id,
            "amount": payment.amount,
            "currency": payment.currency,
            "payment_method": payment.payment_method,
            "exchange_rate": payment.exchange_rate,
            "reference": payment.reference,
            "payment_date": payment.payment_date,
        }
        for payment in (sale.payments or [])
    ]

    cashier_name = None
    register_name = None
    register_code = None
    if sale.cash_session:
        if sale.cash_session.user:
            cashier_name = sale.cash_session.user.full_name or sale.cash_session.user.username
        if sale.cash_session.register:
            register_name = sale.cash_session.register.name
            register_code = sale.cash_session.register.code

    return {
        "id": sale.id,
        "date": sale.date,
        "total_amount": sale.total_amount,
        "total_amount_bs": sale.total_amount_bs or Decimal("0.00"),
        "payment_method": sale.payment_method,
        "currency": sale.currency or "USD",
        "exchange_rate_used": sale.exchange_rate_used or Decimal("1.0"),
        "customer_id": sale.customer_id,
        "customer": customer,
        "payments": payments,
        "details": [],
        "is_credit": bool(sale.is_credit),
        "paid": bool(sale.paid),
        "status": sale.status,
        "cashier_name": cashier_name,
        "register_name": register_name,
        "register_code": register_code,
    }


def _payments_cover_difference(payments, difference_due: Decimal) -> bool:
    if difference_due <= Decimal("0.05"):
        return True
    total_usd = Decimal("0.00")
    for p in payments or []:
        if str(p.payment_method or '').lower() == 'canje':
            continue
        amount = Decimal(str(p.amount or 0))
        currency = str(p.currency or 'USD')
        if currency in ('USD', '$'):
            total_usd += amount
        else:
            rate = Decimal(str(p.exchange_rate or 0))
            if rate > 0:
                total_usd += amount / rate
    return total_usd + Decimal("0.05") >= difference_due


def _is_admin_like(current_user: Optional[models.User]) -> bool:
    if current_user is None:
        return False
    role = getattr(current_user, "role", None)
    role_value = getattr(role, "value", role)
    return bool(
        getattr(current_user, "is_superuser", False)
        or str(role_value or "").upper() == models.UserRole.ADMIN.value
    )


def _find_admin_fallback_cash_session(db: Session, current_user: Optional[models.User], sale: Optional[models.Sale] = None):
    # The endpoint permissions already decided whether the user can return/exchange.
    # If that authorized user has no personal cash session, use an open tenant session.
    base_query = db.query(models.CashSession).filter(models.CashSession.status == "OPEN")

    if sale and sale.session_id:
        original_session = db.query(models.CashSession).filter(models.CashSession.id == sale.session_id).first()
        original_register_id = getattr(original_session, "register_id", None)
        if original_register_id:
            same_register_session = base_query.filter(
                models.CashSession.register_id == original_register_id
            ).order_by(models.CashSession.start_time.desc(), models.CashSession.id.desc()).first()
            if same_register_session:
                return same_register_session

    return base_query.order_by(models.CashSession.start_time.desc(), models.CashSession.id.desc()).first()


def _resolve_cash_session_for_refund(db: Session, sale: models.Sale, current_user: Optional[models.User]):
    if sale.session_id:
        sale_session = db.query(models.CashSession).filter(
            models.CashSession.id == sale.session_id,
            models.CashSession.status == "OPEN"
        ).first()
        if sale_session:
            return sale_session

    if current_user is not None:
        user_session = db.query(models.CashSession).filter(
            models.CashSession.status == "OPEN",
            models.CashSession.user_id == current_user.id
        ).order_by(models.CashSession.start_time.desc(), models.CashSession.id.desc()).first()
        if user_session:
            return user_session

    return _find_admin_fallback_cash_session(db, current_user, sale)


def _resolve_cash_session_for_replacement_sale(
    db: Session,
    current_user: models.User,
    sale_data: schemas.SaleCreate,
    original_sale: Optional[models.Sale] = None,
):
    if getattr(sale_data, 'session_id', None):
        session = db.query(models.CashSession).filter(
            models.CashSession.id == sale_data.session_id,
            models.CashSession.status == "OPEN"
        ).first()
        if session:
            return session

    session = db.query(models.CashSession).filter(
        models.CashSession.status == "OPEN",
        models.CashSession.user_id == current_user.id
    ).order_by(models.CashSession.start_time.desc(), models.CashSession.id.desc()).first()
    if session:
        return session

    return _find_admin_fallback_cash_session(db, current_user, original_sale)


def _validate_replacement_sale_ready(
    sale_data: schemas.SaleCreate,
    db: Session,
    current_user: models.User,
    original_sale: Optional[models.Sale] = None,
):
    session = _resolve_cash_session_for_replacement_sale(db, current_user, sale_data, original_sale)
    if not session:
        raise HTTPException(
            status_code=400,
            detail="No hay caja abierta para registrar el canje. Abre una caja o selecciona una caja abierta."
        )

    warehouse_id = getattr(sale_data, 'warehouse_id', None)
    for item in sale_data.items:
        product = db.query(models.Product).filter(models.Product.id == item.product_id).first()
        if not product:
            raise HTTPException(status_code=404, detail=f"Producto de reemplazo {item.product_id} no encontrado")

        qty = Decimal(str(item.quantity or 0))
        serials = getattr(item, 'serial_numbers', None) or []
        if getattr(product, 'has_imei', False):
            if len(serials) != int(qty):
                raise HTTPException(status_code=400, detail=f"El producto '{product.name}' requiere {int(qty)} IMEI para el canje")
            for serial in serials:
                pi = db.query(models.ProductInstance).filter(
                    models.ProductInstance.product_id == product.id,
                    models.ProductInstance.serial_number == serial,
                    models.ProductInstance.status == models.ProductInstanceStatus.AVAILABLE,
                ).first()
                if not pi:
                    raise HTTPException(status_code=400, detail=f"IMEI '{serial}' no disponible para el producto de reemplazo '{product.name}'")
                if warehouse_id and pi.warehouse_id != warehouse_id:
                    raise HTTPException(status_code=400, detail=f"IMEI '{serial}' no pertenece al almacen seleccionado")
            continue

        if warehouse_id:
            ps = db.query(models.ProductStock).filter(
                models.ProductStock.product_id == product.id,
                models.ProductStock.warehouse_id == warehouse_id
            ).first()
            available = Decimal(str(ps.quantity if ps else 0))
        else:
            available = Decimal(str(product.stock or 0))
        if available < qty:
            raise HTTPException(status_code=400, detail=f"Stock insuficiente para '{product.name}'. Disponible: {available}, solicitado: {qty}")

    return session

@router.get("/sales/search", dependencies=[Depends(require_any_permission(["sales.returns.create", "sales.returns.exchange", "pos.void_sale"]))])
def search_sales(
    q: Optional[str] = None,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    payment_method: Optional[str] = None,
    status: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    include_details: bool = False,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    try:
        """Search sales with lightweight pagination for reports and returns."""
        query = db.query(models.Sale)

        if q:
            terms = _sales_search_terms(q)
            predicates = []
            for term in terms:
                like = f"%{term}%"
                normalized_like = f"%{_strip_accents(term)}%"
                predicates.extend([
                    cast(models.Sale.id, String).ilike(like),
                    func.unaccent(models.Customer.name).ilike(normalized_like),
                    models.Customer.phone.ilike(like),
                    models.Customer.id_number.ilike(like),
                    models.SalePayment.reference.ilike(like),
                    func.unaccent(models.SalePayment.payment_method).ilike(normalized_like),
                    func.unaccent(models.Product.name).ilike(normalized_like),
                    models.Product.sku.ilike(like),
                    models.ProductInstance.serial_number.ilike(like),
                ])

            query = (
                query
                .outerjoin(models.Customer, models.Sale.customer_id == models.Customer.id)
                .outerjoin(models.SalePayment, models.SalePayment.sale_id == models.Sale.id)
                .outerjoin(models.SaleDetail, models.SaleDetail.sale_id == models.Sale.id)
                .outerjoin(models.Product, models.Product.id == models.SaleDetail.product_id)
                .outerjoin(models.SaleDetailInstance, models.SaleDetailInstance.sale_detail_id == models.SaleDetail.id)
                .outerjoin(models.ProductInstance, models.ProductInstance.id == models.SaleDetailInstance.product_instance_id)
                .filter(or_(*predicates))
                .distinct()
            )

        if payment_method:
            query = query.filter(models.Sale.payment_method == payment_method)

        if status:
            if status == "VOIDED":
                query = query.join(models.Return)
            elif status == "COMPLETED":
                query = query.outerjoin(models.Return).filter(models.Return.id == None)

        if start_date:
            start_dt = datetime.combine(start_date, datetime.min.time())
            query = query.filter(models.Sale.date >= start_dt)

        if end_date:
            end_dt = datetime.combine(end_date, datetime.max.time())
            query = query.filter(models.Sale.date <= end_dt)

        total = query.count()

        options = [
            joinedload(models.Sale.customer),
            joinedload(models.Sale.payments),
            joinedload(models.Sale.returns),
            joinedload(models.Sale.cash_session).joinedload(models.CashSession.user),
            joinedload(models.Sale.cash_session).joinedload(models.CashSession.register),
        ]
        if include_details:
            options.append(joinedload(models.Sale.details).joinedload(models.SaleDetail.product))

        results = query.options(*options).order_by(models.Sale.date.desc()).offset(skip).limit(limit).all()

        output = [
            schemas.SaleRead.from_orm(sale).dict() if include_details else _sale_summary_dict(sale)
            for sale in results
        ]
        return {"items": output, "total": total, "has_more": skip + limit < total, "skip": skip, "limit": limit}
    except Exception as e:
        import traceback
        trace = traceback.format_exc()
        print(f"ERROR IN SEARCH_SALES: {str(e)}\n{trace}")
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)} | {trace}")

@router.get("/sales/{sale_id}", response_model=schemas.SaleRead, dependencies=[Depends(require_any_permission(["sales.returns.create", "sales.returns.exchange", "pos.void_sale"]))])
def get_sale_for_return(
    sale_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """Get sale details for processing return"""
    sale = db.query(models.Sale).options(
        joinedload(models.Sale.details).joinedload(models.SaleDetail.product),
        joinedload(models.Sale.details).joinedload(models.SaleDetail.instances).joinedload(models.SaleDetailInstance.product_instance),
        joinedload(models.Sale.customer),
        joinedload(models.Sale.payments)   # ← pagos mixtos
    ).filter(models.Sale.id == sale_id).first()
    
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    
    return sale

@router.post("", response_model=schemas.ReturnRead, dependencies=[Depends(require_permission("sales.returns.create"))])
def process_return(
    return_data: schemas.ReturnCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """Process a return: restore stock, create kardex entries, register cash movement"""
    
    # Find sale
    sale = db.query(models.Sale).filter(models.Sale.id == return_data.sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")

    # Validation: Check if sale is already fully returned
    if sale.status == "VOIDED":
        raise HTTPException(status_code=400, detail="Esta venta ya fue anulada completamente")

    # Validation: Check that there are still items to return
    all_fully_returned = True
    for detail in sale.details:
        if not detail.product_id or float(detail.quantity or 0) <= 0:
            continue
        already_ret = db.query(
            func.coalesce(func.sum(models.ReturnDetail.quantity), 0)
        ).join(
            models.Return, models.Return.id == models.ReturnDetail.return_id
        ).filter(
            models.Return.sale_id == sale.id,
            models.ReturnDetail.product_id == detail.product_id
        ).scalar() or 0
        if float(detail.quantity) - float(already_ret) > 0:
            all_fully_returned = False
            break

    if all_fully_returned and sale.details:
        raise HTTPException(
            status_code=400,
            detail="Esta venta ya fue devuelta en su totalidad. No se pueden registrar más devoluciones."
        )
    
    # Create Return Record
    new_return = models.Return(
        sale_id=sale.id,
        total_refunded=0,  # Will update later
        reason=return_data.reason
    )
    db.add(new_return)
    db.flush()  # Get ID
    
    total_refund = 0
    
    for item in return_data.items:
        if item.quantity <= 0:
            continue
        
        # Find original sale detail
        detail = db.query(models.SaleDetail).filter(
            models.SaleDetail.sale_id == sale.id,
            models.SaleDetail.product_id == item.product_id
        ).first()
        
        if not detail:
            raise HTTPException(
                status_code=400,
                detail=f"Product {item.product_id} not found in this sale"
            )
        
        # Validation: Cannot return more than sold
        if item.quantity > detail.quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot return more than purchased ({detail.quantity})"
            )

        # Validation: Cannot return more than what remains (considering previous returns)
        already_returned = db.query(
            func.coalesce(func.sum(models.ReturnDetail.quantity), 0)
        ).join(
            models.Return, models.Return.id == models.ReturnDetail.return_id
        ).filter(
            models.Return.sale_id == sale.id,
            models.ReturnDetail.product_id == item.product_id
        ).scalar() or 0

        remaining_qty = float(detail.quantity) - float(already_returned)
        if item.quantity > remaining_qty:
            raise HTTPException(
                status_code=400,
                detail=f"Solo quedan {remaining_qty} unidad(es) disponibles para devolver de este producto. Ya se devolvieron {already_returned}."
            )
        
        # Determine actual quantity: prefer explicit serial_numbers (Fix 4 IMEI tracking),
        # else fall back to item.quantity (non-IMEI / legacy). Esto permite que el
        # frontend envie seriales para IMEIs y el backend los trackee exacto.
        serial_numbers = getattr(item, 'serial_numbers', None) or []
        actual_qty = len(serial_numbers) if serial_numbers else int(item.quantity)

        # Calculate refund amount (using actual_qty)
        refund_amount = detail.unit_price * actual_qty
        total_refund += refund_amount
        
        # Determine Cost to Return (Try to use historical, fallback to current)
        cost_to_return = detail.cost_at_sale 
        
        # If historical cost was not recorded (legacy data), use current product cost
        if cost_to_return is None or cost_to_return == 0:
             current_product = db.query(models.Product).get(item.product_id)
             if current_product:
                 cost_to_return = current_product.cost_price
             else:
                 cost_to_return = 0.0000

        # Create Return Detail
        ret_detail = models.ReturnDetail(
            return_id=new_return.id,
            product_id=item.product_id,
            quantity=actual_qty,
            unit_price=detail.unit_price,
            unit_cost=cost_to_return
        )
        db.add(ret_detail)
        db.flush()  # Needed before linking returned IMEIs in return_detail_instances
        
        # Get product
        product = db.query(models.Product).get(item.product_id)

        # ── Restaurar ProductInstances (IMEI) + marcar SaleDetailInstance RETURNED ──
        # Fix 4: track explicito. Si vienen serial_numbers, esos especificos
        # (validados, con junction en return_detail_instances). Si no, fallback
        # determinista (Fix 2: .order_by + .limit). En ambos casos marcamos el/los
        # SaleDetailInstance como RETURNED para que NO quede como link activo en
        # queries de garantía (y desaparezca el "phantom" de la venta vieja).
        if serial_numbers:
            # Camino explicito: el cajero seleccionó QUÉ IMEIs devuelve
            for serial in serial_numbers:
                pi = db.query(models.ProductInstance).filter(
                    models.ProductInstance.serial_number == serial
                ).first()
                if not pi:
                    raise HTTPException(status_code=400, detail=f"IMEI/serial '{serial}' no encontrado")
                if pi.status != models.ProductInstanceStatus.SOLD:
                    raise HTTPException(status_code=400, detail=f"IMEI '{serial}' no está SOLD (actual: {pi.status.value})")
                sdi = db.query(models.SaleDetailInstance).join(
                    models.SaleDetail, models.SaleDetail.id == models.SaleDetailInstance.sale_detail_id
                ).filter(
                    models.SaleDetailInstance.product_instance_id == pi.id,
                    models.SaleDetail.sale_id == sale.id,
                    models.SaleDetailInstance.status == 'SOLD',
                ).first()
                if not sdi:
                    raise HTTPException(status_code=400, detail=f"IMEI '{serial}' no vendido en venta #{sale.id} o ya devuelto")
                # Marcar instancia
                if item.condition == "GOOD":
                    pi.status = models.ProductInstanceStatus.AVAILABLE
                else:
                    pi.status = models.ProductInstanceStatus.RMA
                # Marcar link como RETURNED
                sdi.status = 'RETURNED'
                sdi.returned_at = datetime.now()
                sdi.returned_in_return_id = new_return.id
                # Junction de auditoría
                db.add(models.ReturnDetailInstance(
                    return_detail_id=ret_detail.id,
                    product_instance_id=pi.id,
                ))
        else:
            # Camino legacy (no IMEI o sin seriales): .order_by + .limit determinista
            instances_to_restore = db.query(models.ProductInstance).join(
                models.SaleDetailInstance,
                models.SaleDetailInstance.product_instance_id == models.ProductInstance.id
            ).join(
                models.SaleDetail,
                models.SaleDetail.id == models.SaleDetailInstance.sale_detail_id
            ).filter(
                models.SaleDetail.sale_id == sale.id,
                models.SaleDetail.product_id == item.product_id,
                models.ProductInstance.status == models.ProductInstanceStatus.SOLD,
                models.SaleDetailInstance.status == 'SOLD',
            ).order_by(models.ProductInstance.id).limit(actual_qty).all()

            for pi in instances_to_restore:
                if item.condition == "GOOD":
                    pi.status = models.ProductInstanceStatus.AVAILABLE
                else:
                    pi.status = models.ProductInstanceStatus.RMA
                # Marcar SaleDetailInstances activos de este pi en esta venta
                for sdi in db.query(models.SaleDetailInstance).join(
                    models.SaleDetail, models.SaleDetail.id == models.SaleDetailInstance.sale_detail_id
                ).filter(
                    models.SaleDetailInstance.product_instance_id == pi.id,
                    models.SaleDetail.sale_id == sale.id,
                    models.SaleDetailInstance.status == 'SOLD',
                ).all():
                    sdi.status = 'RETURNED'
                    sdi.returned_at = datetime.now()
                    sdi.returned_in_return_id = new_return.id

                db.add(models.ReturnDetailInstance(
                    return_detail_id=ret_detail.id,
                    product_instance_id=pi.id,
                ))

        # Handle stock based on condition
        if item.condition == "GOOD":
            product.stock += actual_qty
            if sale.warehouse_id:
                ps = db.query(models.ProductStock).filter(
                    models.ProductStock.product_id == product.id,
                    models.ProductStock.warehouse_id == sale.warehouse_id
                ).first()
                if ps:
                    ps.quantity += actual_qty
                else:
                    db.add(models.ProductStock(
                        product_id=product.id,
                        warehouse_id=sale.warehouse_id,
                        quantity=actual_qty
                    ))
            kardex = models.Kardex(
                product_id=product.id,
                warehouse_id=sale.warehouse_id,
                movement_type="RETURN",
                quantity=actual_qty,
                balance_after=product.stock,
                description=f"Devolución Venta #{sale.id} - Buen Estado",
                date=datetime.now()
            )
            db.add(kardex)
        else:  # DAMAGED condition
            product.stock += actual_qty
            kardex_return = models.Kardex(
                product_id=product.id,
                warehouse_id=sale.warehouse_id,
                movement_type="RETURN",
                quantity=actual_qty,
                balance_after=product.stock,
                description=f"Devolución Venta #{sale.id} - Producto Dañado (Entrada)",
                date=datetime.now()
            )
            db.add(kardex_return)
            product.stock -= actual_qty
            kardex_adjustment = models.Kardex(
                product_id=product.id,
                warehouse_id=sale.warehouse_id,
                movement_type="ADJUSTMENT_OUT",
                quantity=actual_qty,
                balance_after=product.stock,
                description=f"Auto-merma por devolución dañada - Venta #{sale.id}",
                date=datetime.now()
            )
            db.add(kardex_adjustment)

        if product and getattr(product, "has_imei", False):
            reconcile_serialized_product_stock(db, product.id)
    
    new_return.total_refunded = total_refund
    
    # CRITICAL: Update balance_pending for credit sales
    actual_cash_refund = Decimal(str(total_refund))
    resolution_type = str(getattr(return_data, 'resolution_type', 'REFUND') or 'REFUND').upper()
    exchange_credit_requested = Decimal(str(getattr(return_data, 'exchange_credit_amount', Decimal('0.00')) or 0))
    exchange_credit_applied = Decimal('0.00')
    
    if sale.is_credit and sale.balance_pending is not None:
        # Reduce debt by refund amount
        old_balance = sale.balance_pending
        new_balance = sale.balance_pending - total_refund
        
        # Ensure balance doesn't go negative
        if new_balance < 0:
            new_balance = 0
            
        sale.balance_pending = new_balance
        debt_reduced = old_balance - new_balance
        actual_cash_refund = Decimal(str(total_refund)) - Decimal(str(debt_reduced))
        
        # Mark as paid if balance is zero or negative
        if new_balance <= 0.01:
            sale.paid = True
        
        print(f"💳 Credit sale return: Reduced balance from ${old_balance:.2f} to ${new_balance:.2f}, Paid: {sale.paid}")
        print(f"💵 Actual cash to refund (after debt offset): ${actual_cash_refund:.2f}")
    
    if resolution_type == 'EXCHANGE' and exchange_credit_requested > 0:
        exchange_credit_applied = min(exchange_credit_requested, actual_cash_refund)
        actual_cash_refund = max(Decimal('0.00'), actual_cash_refund - exchange_credit_applied)

    # ── FIX 1: Anular comisiones de la venta devuelta ───────────────────────────
    try:
        from ..models.tenant import Tenant as _TenantModel
        from sqlalchemy import text as _text_ret
        from ..tenant_context import get_tenant_schema as _gts_ret
        _s_ret = _gts_ret()
        # Leer feature_flags del tenant actual
        _ff_row = db.execute(
            _text_ret("SELECT feature_flags FROM public.tenants WHERE schema_name = :s"),
            {"s": _s_ret}
        ).fetchone()
        _flags = (_ff_row[0] or {}) if _ff_row and _ff_row[0] else {}
        _engine = CommissionEngine(db, _flags)
        _voided = _engine.void_sale_commissions(sale.id)
        if _voided:
            print(f"[RETURN] {_voided} comisiones anuladas para venta #{sale.id}")
    except Exception as _ce:
        print(f"[RETURN] Error anulando comisiones: {_ce}")

    # ── FIX 2: Registrar movimiento de caja ───────────────────────────────────
    # Buscar sesión abierta; si no hay, usar la sesión original de la venta
    refund_session = None
    cash_movement = None
    if actual_cash_refund > 0:
        amount_to_record = actual_cash_refund
        if _is_bs_currency(return_data.refund_currency):
            amount_to_record = actual_cash_refund * return_data.exchange_rate

        session = _resolve_cash_session_for_refund(db, sale, current_user)

        if session:
            refund_session = session
            cash_movement = models.CashMovement(
                session_id=session.id,
                type="RETURN",
                amount=amount_to_record,
                currency=return_data.refund_currency,
                exchange_rate=return_data.exchange_rate,
                description=f"Devolución Venta #{sale.id}: {return_data.reason}",
                date=get_venezuela_now()
            )
            db.add(cash_movement)
        else:
            raise HTTPException(
                status_code=400,
                detail="No hay caja abierta para registrar el reembolso. Abre una caja o selecciona una caja abierta."
            )

    # ── FIX 3: Marcar si la devolución cubre la venta completa ────────────────
    # Una venta solo es VOIDED si se devolvieron TODOS los ítems en su totalidad
    total_items_sold    = sum(float(d.quantity) for d in sale.details if d.product_id)
    total_items_returned = sum(float(i.quantity) for i in return_data.items if i.quantity > 0)
    is_full_return = total_items_returned >= total_items_sold

    # Guardar en metadata del return si es devolución completa o parcial
    resolution_label = "CANJE" if resolution_type == 'EXCHANGE' else "REEMBOLSO"
    exchange_label = f" | credito canje aplicado: ${exchange_credit_applied:.2f}" if exchange_credit_applied > 0 else ""
    cash_label = f" | efectivo a devolver: ${actual_cash_refund:.2f}" if resolution_type == 'EXCHANGE' else ""
    new_return.reason = (return_data.reason or "") + (
        " [ANULACIÓN TOTAL]" if is_full_return else " [DEVOLUCIÓN PARCIAL]"
    ) + f" [{resolution_label}]{exchange_label}{cash_label}"

    # 🔒 SECURITY: Final Eager Load BEFORE commit
    captured_id = new_return.id
    new_return = db.query(models.Return).options(
        joinedload(models.Return.details).joinedload(models.ReturnDetail.product)
    ).filter(models.Return.id == captured_id).first()

    db.flush()
    enqueue_sync_event(
        db,
        event_type="return.created",
        aggregate_type="return",
        aggregate_uuid=str(new_return.id),
        cash_session_uuid=cash_session_uuid(refund_session.id if refund_session else None),
        source_terminal_id=(refund_session.register.hardware_client_id if refund_session and refund_session.register else None),
        payload={
            "return_id": new_return.id,
            "sale_id": sale.id,
            "user_id": current_user.id,
            "session_id": refund_session.id if refund_session else None,
            "cash_movement_id": cash_movement.id if cash_movement else None,
            "resolution_type": resolution_type,
            "total_refunded": new_return.total_refunded,
            "refund_currency": getattr(return_data, "refund_currency", None),
            "exchange_rate": getattr(return_data, "exchange_rate", None),
            "actual_cash_refund": actual_cash_refund,
            "exchange_credit_applied": exchange_credit_applied,
            "is_full_return": is_full_return,
            "reason": new_return.reason,
            "items": [
                {
                    "product_id": item.product_id,
                    "quantity": item.quantity,
                    "serial_numbers": getattr(item, "serial_numbers", None) or [],
                }
                for item in (return_data.items or [])
            ],
        },
    )

    db.commit()

    return schemas.ReturnRead.model_validate(new_return)


@router.post("/exchange", response_model=schemas.ReturnExchangeRead, dependencies=[Depends(require_permission("sales.returns.exchange"))])
def process_exchange_return(
    payload: schemas.ReturnExchangeCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """Process a return and create a replacement sale paid with exchange credit."""
    original_sale = db.query(models.Sale).filter(models.Sale.id == payload.sale_id).first()
    if not original_sale:
        raise HTTPException(status_code=404, detail="Sale not found")

    estimated_refund = _estimate_return_total(payload, db)
    replacement_total = Decimal(str(payload.replacement_sale.total_amount))
    if replacement_total <= 0:
        raise HTTPException(status_code=400, detail="El canje debe tener al menos un producto de reemplazo")

    exchange_credit = min(estimated_refund, replacement_total)
    difference_due = max(Decimal("0.00"), replacement_total - exchange_credit)
    cash_refund_amount = max(Decimal("0.00"), estimated_refund - exchange_credit)

    submitted_payments = [p for p in (payload.replacement_sale.payments or []) if str(p.payment_method or '').lower() != 'canje']
    if not _payments_cover_difference(submitted_payments, difference_due):
        raise HTTPException(
            status_code=400,
            detail=f"El canje cubre ${exchange_credit:.2f}. Falta cobrar diferencia de ${difference_due:.2f}."
        )

    replacement_session = _validate_replacement_sale_ready(payload.replacement_sale, db, current_user, original_sale)

    return_payload = payload.model_copy(update={
        "resolution_type": "EXCHANGE",
        "exchange_credit_amount": exchange_credit,
        "reason": (payload.reason or "Canje de cliente"),
    })
    return_record = process_return(return_payload, db=db, current_user=current_user)

    canje_payment = schemas.SalePaymentCreate(
        amount=exchange_credit,
        currency="USD",
        payment_method="Canje",
        exchange_rate=Decimal("1.0"),
        reference=f"RETURN-{return_record.id}",
    )
    replacement_notes = (payload.replacement_sale.notes or "").strip()
    link_note = f"Canje por devolucion #{return_record.id} de venta original #{payload.sale_id}"
    replacement_sale = payload.replacement_sale.model_copy(update={
        "customer_id": payload.replacement_sale.customer_id or original_sale.customer_id,
        "payment_method": "Canje" if difference_due <= Decimal("0.05") else (payload.replacement_sale.payment_method or "Mixto"),
        "payments": [canje_payment] + submitted_payments,
        "notes": f"{replacement_notes} | {link_note}" if replacement_notes else link_note,
        "is_credit": False,
        "session_id": replacement_session.id,
    })

    from ..services.sales_service import SalesService
    sale_result = SalesService.create_sale(db, replacement_sale, user_id=current_user.id, background_tasks=background_tasks)
    replacement_sale_id = sale_result.get("sale_id")

    try:
        ret = db.query(models.Return).filter(models.Return.id == return_record.id).first()
        if ret:
            ret.reason = (ret.reason or "") + f" | venta reemplazo #{replacement_sale_id}"
            db.commit()
    except Exception as exc:
        print(f"[RETURN EXCHANGE] No se pudo anexar venta reemplazo al return: {exc}")

    return {
        "return_record": return_record,
        "replacement_sale_id": replacement_sale_id,
        "exchange_credit_amount": exchange_credit,
        "difference_due": difference_due,
        "cash_refund_amount": cash_refund_amount,
    }

@router.post("/void/{sale_id}", dependencies=[Depends(require_permission("pos.void_sale"))])
def void_sale(
    sale_id: int,
    reason: str = "ANULACIÓN DE VENTA - ERROR OPERATIVO",
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """
    Anulación directa de una venta completa.
    Devuelve todos los ítems, anula comisiones y registra en caja.
    Requiere PIN de admin desde el frontend antes de llamar este endpoint.
    """
    sale = db.query(models.Sale).options(
        joinedload(models.Sale.details).joinedload(models.SaleDetail.product),
        joinedload(models.Sale.returns)
    ).filter(models.Sale.id == sale_id).first()

    if not sale:
        raise HTTPException(status_code=404, detail="Venta no encontrada")

    if sale.status == "VOIDED":
        raise HTTPException(status_code=400, detail="Esta venta ya fue anulada")

    # Construir items de devolución con todos los productos
    from ..schemas import ReturnCreate, ReturnItemCreate
    items = []
    for detail in sale.details:
        if detail.product_id and float(detail.quantity or 0) > 0:
            # Calcular cantidad ya devuelta anteriormente
            already_returned = sum(
                float(rd.quantity or 0)
                for r in sale.returns
                for rd in r.details
                if rd.product_id == detail.product_id
            )
            remaining = float(detail.quantity) - already_returned
            if remaining > 0:
                items.append(ReturnItemCreate(
                    product_id=detail.product_id,
                    quantity=remaining,
                    condition="GOOD"
                ))

    if not items:
        raise HTTPException(status_code=400, detail="No hay ítems disponibles para anular")

    return_data = ReturnCreate(
        sale_id=sale_id,
        items=items,
        reason=reason,
        refund_currency="USD",
        exchange_rate=1.0
    )

    # Reusar la lógica del process_return internamente
    from fastapi import Request
    # Llamar directamente a la lógica (sin duplicar código)
    new_return = models.Return(
        sale_id=sale.id,
        total_refunded=0,
        reason=reason + " [ANULACIÓN TOTAL]"
    )
    db.add(new_return)
    db.flush()

    total_refund = 0
    for item in items:
        detail = next((d for d in sale.details if d.product_id == item.product_id), None)
        if not detail:
            continue
        refund_amount = detail.unit_price * item.quantity
        total_refund += refund_amount
        cost_to_return = detail.cost_at_sale or 0

        ret_detail = models.ReturnDetail(
            return_id=new_return.id,
            product_id=item.product_id,
            quantity=item.quantity,
            unit_price=detail.unit_price,
            unit_cost=cost_to_return
        )
        db.add(ret_detail)

        product = db.query(models.Product).get(item.product_id)
        if product:
            product.stock += item.quantity

            # Restaurar stock por almacén (product_stocks), espejo de la venta
            if sale.warehouse_id:
                ps = db.query(models.ProductStock).filter(
                    models.ProductStock.product_id == product.id,
                    models.ProductStock.warehouse_id == sale.warehouse_id
                ).first()
                if ps:
                    ps.quantity += item.quantity
                else:
                    db.add(models.ProductStock(
                        product_id=product.id,
                        warehouse_id=sale.warehouse_id,
                        quantity=item.quantity
                    ))

            db.add(models.Kardex(
                product_id=product.id,
                movement_type="RETURN",
                quantity=item.quantity,
                balance_after=product.stock,
                description=f"Anulación Venta #{sale.id}",
                date=datetime.now()
            ))

        # Restaurar ProductInstance (IMEI) en void_sale
        void_instances = db.query(models.ProductInstance).join(
            models.SaleDetailInstance,
            models.SaleDetailInstance.product_instance_id == models.ProductInstance.id
        ).join(
            models.SaleDetail,
            models.SaleDetail.id == models.SaleDetailInstance.sale_detail_id
        ).filter(
            models.SaleDetail.sale_id == sale.id,
            models.SaleDetail.product_id == item.product_id,
            models.ProductInstance.status == models.ProductInstanceStatus.SOLD
        ).all()
        for pi in void_instances:
            pi.status = models.ProductInstanceStatus.AVAILABLE

        if product and getattr(product, "has_imei", False):
            reconcile_serialized_product_stock(db, product.id)

    new_return.total_refunded = total_refund

    # Crédito: reducir balance_pending
    actual_cash_refund = float(total_refund)
    if sale.is_credit and sale.balance_pending is not None:
        old_bal   = float(sale.balance_pending)
        new_balance = max(0.0, old_bal - float(total_refund))
        debt_reduced = old_bal - new_balance
        sale.balance_pending = new_balance
        sale.paid = new_balance <= 0.01
        actual_cash_refund = float(total_refund) - debt_reduced

    # Anular comisiones
    try:
        from sqlalchemy import text as _txt
        from ..tenant_context import get_tenant_schema as _gts
        _s = _gts()
        _ff_row = db.execute(_txt("SELECT feature_flags FROM public.tenants WHERE schema_name=:s"), {"s": _s}).fetchone()
        _flags = (_ff_row[0] or {}) if _ff_row else {}
        _engine = CommissionEngine(db, _flags)
        _engine.void_sale_commissions(sale.id)
    except Exception as _ce:
        print(f"[VOID] Error comisiones: {_ce}")

    # Movimiento de caja
    if actual_cash_refund > 0:
        session = _resolve_cash_session_for_refund(db, sale, current_user)
        if session:
            db.add(models.CashMovement(
                session_id=session.id,
                type="RETURN",
                amount=actual_cash_refund,
                currency="USD",
                exchange_rate=1.0,
                description=f"Anulación Venta #{sale.id}: {reason}",
                date=get_venezuela_now()
            ))

    db.commit()
    return {"status": "voided", "sale_id": sale_id, "total_refunded": total_refund}


@router.get("", response_model=List[schemas.ReturnRead], dependencies=[Depends(require_any_permission(["sales.returns.create", "sales.returns.exchange", "reports.sales.view"]))])
def get_returns(
    skip: int = 0, limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """Get list of returns"""
    return db.query(models.Return).options(
        joinedload(models.Return.details).joinedload(models.ReturnDetail.product)
    ).order_by(models.Return.date.desc()).offset(skip).limit(limit).all()

@router.get("/{return_id}", response_model=schemas.ReturnRead, dependencies=[Depends(require_any_permission(["sales.returns.create", "sales.returns.exchange", "reports.sales.view"]))])
def get_return(
    return_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """Get specific return details"""
    ret = db.query(models.Return).options(
        joinedload(models.Return.details).joinedload(models.ReturnDetail.product)
    ).filter(models.Return.id == return_id).first()
    
    if not ret:
        raise HTTPException(status_code=404, detail="Return not found")
    
    return ret

@router.get("/sales/{sale_id}/print-payload", dependencies=[Depends(require_permission("pos.reprint.ticket"))])
def get_sale_print_payload(
    sale_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """Get print payload for reprinting a sale ticket"""
    from ..services.sales_service import SalesService
    
    try:
        payload = SalesService.get_sale_print_payload(db, sale_id)
        return payload
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating print payload: {str(e)}")
