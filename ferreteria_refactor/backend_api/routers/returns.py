from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, cast, String, func
from typing import List, Optional
from ..database.db import get_db
from ..models import models
from .. import schemas
from ..commission_engine import CommissionEngine
from ..dependencies import get_current_active_user
from datetime import datetime, date

router = APIRouter(
    prefix="/returns",
    tags=["returns"]
)

@router.get("/sales/search")
def search_sales(
    q: Optional[str] = None,
    skip: int = 0,
    limit: int = Query(default=500, le=5000),
    payment_method: Optional[str] = None,
    status: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    try:
        """Search sales with filters"""
        query = db.query(models.Sale)

        # Text Search — por ID, cliente o IMEI
        if q:
            query = query.join(models.Customer, isouter=True).outerjoin(
                models.SaleDetail, models.SaleDetail.sale_id == models.Sale.id
            ).outerjoin(
                models.SaleDetailInstance, models.SaleDetailInstance.sale_detail_id == models.SaleDetail.id
            ).outerjoin(
                models.ProductInstance, models.ProductInstance.id == models.SaleDetailInstance.product_instance_id
            ).filter(
                or_(
                    cast(models.Sale.id, String).ilike(f"%{q}%"),
                    models.Customer.name.ilike(f"%{q}%"),
                    models.Customer.phone.ilike(f"%{q}%"),
                    models.ProductInstance.serial_number.ilike(f"%{q}%"),
                )
            ).distinct()

        # Filter by Payment Method
        if payment_method:
            query = query.filter(models.Sale.payment_method == payment_method)

        # Filter by Status (Derived from existence of Return)
        if status:
            if status == "VOIDED":
                # Show only sales with returns
                query = query.join(models.Return)
            elif status == "COMPLETED":
                # Show only sales WITHOUT returns
                query = query.outerjoin(models.Return).filter(models.Return.id == None)

        # Filter by Date Range
        if start_date:
            start_dt = datetime.combine(start_date, datetime.min.time())
            query = query.filter(models.Sale.date >= start_dt)

        if end_date:
            end_dt = datetime.combine(end_date, datetime.max.time())
            query = query.filter(models.Sale.date <= end_dt)

        total = query.count()

        results = query.options(
            joinedload(models.Sale.customer),
            joinedload(models.Sale.payments),
            joinedload(models.Sale.returns),
            joinedload(models.Sale.details).joinedload(models.SaleDetail.product),
            joinedload(models.Sale.cash_session).joinedload(models.CashSession.user),
            joinedload(models.Sale.cash_session).joinedload(models.CashSession.register),
        ).order_by(models.Sale.date.desc()).offset(skip).limit(limit).all()

        # Build enriched response with cashier + register info
        output = []
        for sale in results:
            sale_dict = schemas.SaleRead.from_orm(sale).dict()
            sale_dict["cashier_name"] = None
            sale_dict["register_name"] = None
            sale_dict["register_code"] = None
            if sale.cash_session:
                sale_dict["cashier_name"] = (
                    sale.cash_session.user.full_name or sale.cash_session.user.username
                ) if sale.cash_session.user else None
                if sale.cash_session.register:
                    sale_dict["register_name"] = sale.cash_session.register.name
                    sale_dict["register_code"] = sale.cash_session.register.code
            output.append(sale_dict)
        return {"items": output, "total": total, "has_more": skip + limit < total}
    except Exception as e:
        import traceback
        trace = traceback.format_exc()
        print(f"ERROR IN SEARCH_SALES: {str(e)}\n{trace}")
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)} | {trace}")

@router.get("/sales/{sale_id}", response_model=schemas.SaleRead)
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

@router.post("", response_model=schemas.ReturnRead)
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
        
        # Calculate refund amount
        refund_amount = detail.unit_price * item.quantity
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
            quantity=item.quantity,
            unit_price=detail.unit_price,  # Add unit price from original sale
            unit_cost=cost_to_return # CRITICAL: Record cost of returned item
        )
        db.add(ret_detail)
        
        # Get product
        product = db.query(models.Product).get(item.product_id)

        # ── Restaurar ProductInstance (IMEI/Serial) si aplica ───────────────
        # Buscar los instances vendidos de este producto en esta venta
        instances_to_restore = db.query(models.ProductInstance).join(
            models.SaleDetailInstance,
            models.SaleDetailInstance.product_instance_id == models.ProductInstance.id
        ).join(
            models.SaleDetail,
            models.SaleDetail.id == models.SaleDetailInstance.sale_detail_id
        ).filter(
            models.SaleDetail.sale_id == sale.id,
            models.SaleDetail.product_id == item.product_id,
            models.ProductInstance.status == models.ProductInstanceStatus.SOLD
        ).limit(int(item.quantity)).all()

        for pi in instances_to_restore:
            if item.condition == "GOOD":
                pi.status = models.ProductInstanceStatus.AVAILABLE
            # Si DAMAGED: el IMEI queda en SOLD (ya no está disponible para venta)
            # El stock físico igual se mueve para el kardex pero el IMEI queda dañado

        # Handle stock based on condition
        if item.condition == "GOOD":
            # GOOD condition: Simply restore to stock
            product.stock += item.quantity

            # Restaurar también el stock por almacén (product_stocks), espejo de la venta.
            # El inventario y el POS muestran la suma de product_stocks, no products.stock.
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

            # Kardex Entry: RETURN (Entrada)
            kardex = models.Kardex(
                product_id=product.id,
                movement_type="RETURN",
                quantity=item.quantity,
                balance_after=product.stock,
                description=f"Devolución Venta #{sale.id} - Buen Estado",
                date=datetime.now()
            )
            db.add(kardex)
            
        else:  # DAMAGED condition
            # Step 1: Register the return (for audit trail)
            old_stock = product.stock
            product.stock += item.quantity
            
            kardex_return = models.Kardex(
                product_id=product.id,
                movement_type="RETURN",
                quantity=item.quantity,
                balance_after=product.stock,
                description=f"Devolución Venta #{sale.id} - Producto Dañado (Entrada)",
                date=datetime.now()
            )
            db.add(kardex_return)
            
            # Step 2: Immediately adjust out (automatic shrinkage)
            product.stock -= item.quantity
            
            kardex_adjustment = models.Kardex(
                product_id=product.id,
                movement_type="ADJUSTMENT_OUT",
                quantity=item.quantity,
                balance_after=product.stock,
                description=f"Auto-merma por devolución dañada - Venta #{sale.id}",
                date=datetime.now()
            )
            db.add(kardex_adjustment)
            
            # Net effect: stock unchanged, but audit trail complete
    
    new_return.total_refunded = total_refund
    
    # CRITICAL: Update balance_pending for credit sales
    actual_cash_refund = total_refund
    
    if sale.is_credit and sale.balance_pending is not None:
        # Reduce debt by refund amount
        old_balance = sale.balance_pending
        new_balance = sale.balance_pending - total_refund
        
        # Ensure balance doesn't go negative
        if new_balance < 0:
            new_balance = 0
            
        sale.balance_pending = new_balance
        debt_reduced = old_balance - new_balance
        actual_cash_refund = total_refund - debt_reduced
        
        # Mark as paid if balance is zero or negative
        if new_balance <= 0.01:
            sale.paid = True
        
        print(f"💳 Credit sale return: Reduced balance from ${old_balance:.2f} to ${new_balance:.2f}, Paid: {sale.paid}")
        print(f"💵 Actual cash to refund (after debt offset): ${actual_cash_refund:.2f}")
    
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
    if actual_cash_refund > 0:
        amount_to_record = actual_cash_refund
        if return_data.refund_currency == "Bs":
            amount_to_record = actual_cash_refund * return_data.exchange_rate

        session = db.query(models.CashSession).filter(
            models.CashSession.status == "OPEN"
        ).first()

        # Si no hay caja abierta → usar la sesión original de la venta
        if not session and sale.session_id:
            session = db.query(models.CashSession).filter(
                models.CashSession.id == sale.session_id
            ).first()

        if session:
            cash_movement = models.CashMovement(
                session_id=session.id,
                type="RETURN",
                amount=amount_to_record,
                currency=return_data.refund_currency,
                exchange_rate=return_data.exchange_rate,
                description=f"Devolución Venta #{sale.id}: {return_data.reason}"
            )
            db.add(cash_movement)
        else:
            # Sin sesión disponible: registrar como movimiento sin sesión
            print(f"[RETURN] Sin sesión de caja disponible para venta #{sale.id} — movimiento no registrado en caja")

    # ── FIX 3: Marcar si la devolución cubre la venta completa ────────────────
    # Una venta solo es VOIDED si se devolvieron TODOS los ítems en su totalidad
    total_items_sold    = sum(float(d.quantity) for d in sale.details if d.product_id)
    total_items_returned = sum(float(i.quantity) for i in return_data.items if i.quantity > 0)
    is_full_return = total_items_returned >= total_items_sold

    # Guardar en metadata del return si es devolución completa o parcial
    new_return.reason = (return_data.reason or "") + (
        " [ANULACIÓN TOTAL]" if is_full_return else " [DEVOLUCIÓN PARCIAL]"
    )

    # 🔒 SECURITY: Final Eager Load BEFORE commit
    captured_id = new_return.id
    new_return = db.query(models.Return).options(
        joinedload(models.Return.details).joinedload(models.ReturnDetail.product)
    ).filter(models.Return.id == captured_id).first()

    db.commit()

    return schemas.ReturnRead.model_validate(new_return)

@router.post("/void/{sale_id}")
def void_sale(
    sale_id: int,
    reason: str = "ANULACIÓN DE VENTA - ERROR OPERATIVO",
    db: Session = Depends(get_db)
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
        session = db.query(models.CashSession).filter(models.CashSession.status == "OPEN").first()
        if not session and sale.session_id:
            session = db.query(models.CashSession).filter(models.CashSession.id == sale.session_id).first()
        if session:
            db.add(models.CashMovement(
                session_id=session.id,
                type="RETURN",
                amount=actual_cash_refund,
                currency="USD",
                exchange_rate=1.0,
                description=f"Anulación Venta #{sale.id}: {reason}"
            ))

    db.commit()
    return {"status": "voided", "sale_id": sale_id, "total_refunded": total_refund}


@router.get("", response_model=List[schemas.ReturnRead])
def get_returns(
    skip: int = 0, limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """Get list of returns"""
    return db.query(models.Return).options(
        joinedload(models.Return.details).joinedload(models.ReturnDetail.product)
    ).order_by(models.Return.date.desc()).offset(skip).limit(limit).all()

@router.get("/{return_id}", response_model=schemas.ReturnRead)
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

@router.get("/sales/{sale_id}/print-payload")
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
