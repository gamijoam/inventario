"""
cash/sessions.py — Gestión de cajas físicas (registradoras) y apertura/cierre de sesiones.

Responsabilidades:
  - CRUD de cajas registradoras (CashRegister)
  - Apertura de sesión de caja (POST /sessions/open)
  - Consulta de sesión activa (GET /sessions/current)
  - Cierre de sesión de caja (POST /sessions/{id}/close)
  - Cierre forzado por admin (POST /registers/{id}/force-close-session)
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload, subqueryload
from sqlalchemy import text
from typing import List, Optional
from datetime import datetime
from decimal import Decimal
import logging

from ...database.db import get_db, _validate_schema_name
from ...dependencies import get_current_active_user
from ...models import models
from ...websocket.manager import manager
from ...tenant_context import get_tenant_schema
from ... import schemas

logger = logging.getLogger(__name__)

router = APIRouter()

# ============================================================
#  CASH REGISTERS (Cajas físicas / terminales)
# ============================================================

@router.get("/registers", response_model=List[schemas.CashRegisterRead])
def list_cash_registers(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """Lista todas las cajas registradoras activas del tenant."""
    return db.query(models.CashRegister).filter(
        models.CashRegister.is_active == True
    ).order_by(models.CashRegister.id).all()


@router.post("/registers", response_model=schemas.CashRegisterRead)
def create_cash_register(
    data: schemas.CashRegisterCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """Crea una nueva caja registradora."""
    existing = db.query(models.CashRegister).filter(
        models.CashRegister.code == data.code
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Ya existe una caja con el código '{data.code}'")

    register = models.CashRegister(
        name=data.name,
        code=data.code.upper(),
        description=data.description,
        is_active=True,
        hardware_client_id=data.hardware_client_id or None
    )
    db.add(register)
    db.commit()
    # expire_on_commit=False (see db.py) → register keeps all attributes after commit;
    # return it directly to avoid any search_path / re-query race in multi-tenant.
    return register


@router.put("/registers/{register_id}", response_model=schemas.CashRegisterRead)
def update_cash_register(
    register_id: int,
    data: schemas.CashRegisterUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """Actualiza nombre, descripción o estado activo de una caja."""
    register = db.query(models.CashRegister).filter(
        models.CashRegister.id == register_id
    ).first()
    if not register:
        raise HTTPException(status_code=404, detail="Caja no encontrada")

    if data.name is not None:
        register.name = data.name
    if data.description is not None:
        register.description = data.description
    if data.hardware_client_id is not None:
        register.hardware_client_id = data.hardware_client_id or None
    if data.is_active is not None:
        if data.is_active is False:
            open_session = db.query(models.CashSession).filter(
                models.CashSession.register_id == register_id,
                models.CashSession.status == "OPEN"
            ).first()
            if open_session:
                raise HTTPException(
                    status_code=400,
                    detail=f"No se puede desactivar '{register.name}': tiene una sesión abierta. Cierra la caja primero."
                )
        register.is_active = data.is_active

    db.commit()
    # expire_on_commit=False (see db.py) → register keeps all updated attributes after commit
    return register


@router.post("/registers/{register_id}/force-close-session")
def force_close_register_session(
    register_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """
    Admin: Force-close an orphaned OPEN session on a register.
    Use when a session is stuck (e.g. after a server restart or migration).
    """
    if current_user.role not in ["ADMIN"] and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Solo administradores pueden forzar el cierre de sesiones")

    register = db.query(models.CashRegister).filter(
        models.CashRegister.id == register_id
    ).first()
    if not register:
        raise HTTPException(status_code=404, detail="Caja no encontrada")

    open_session = db.query(models.CashSession).filter(
        models.CashSession.register_id == register_id,
        models.CashSession.status == "OPEN"
    ).first()

    if not open_session:
        raise HTTPException(status_code=404, detail="No hay sesión abierta en esta caja")

    open_session.status = "CLOSED"
    open_session.end_time = datetime.now()
    db.commit()

    return {"detail": f"Sesión #{open_session.id} de '{register.name}' cerrada forzosamente."}


@router.get("/registers/status", response_model=List[dict])
def get_registers_status(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """
    Devuelve el estado de todas las cajas activas: si están OPEN o CLOSED
    y quién las tiene abiertas. Útil para el selector de caja en apertura.
    """
    # Fix N+1: load all registers with their sessions and session users in 2 queries total
    registers = db.query(models.CashRegister).filter(
        models.CashRegister.is_active == True
    ).options(
        subqueryload(models.CashRegister.sessions)
        .joinedload(models.CashSession.user)
    ).order_by(models.CashRegister.id).all()

    result = []
    for reg in registers:
        # Filter in Python — sessions already loaded, no extra queries
        open_session = next((s for s in reg.sessions if s.status == "OPEN"), None)

        result.append({
            "id": reg.id,
            "name": reg.name,
            "code": reg.code,
            "description": reg.description,
            "is_active": reg.is_active,
            "session_status": "OPEN" if open_session else "CLOSED",
            "session_id": open_session.id if open_session else None,
            "opened_by": open_session.user.username if open_session and open_session.user else None,
            "opened_at": open_session.start_time.isoformat() if open_session else None,
        })
    return result


# ============================================================
#  CASH SESSIONS — Open / Current / Close
# ============================================================

@router.post("/sessions/open", response_model=schemas.CashSessionRead)
async def open_cash_session(
    initial_cash: schemas.CashSessionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    print(f"💰 [CASH] POST /sessions/open - User: {current_user.username} (id={current_user.id})")
    print(f"   - Payload: register_id={initial_cash.register_id}, initial_cash={initial_cash.initial_cash}, currencies={[c.currency_symbol for c in initial_cash.currencies]}")

    # Resolve which register to open
    if initial_cash.register_id:
        register = db.query(models.CashRegister).filter(
            models.CashRegister.id == initial_cash.register_id,
            models.CashRegister.is_active == True
        ).first()
        if not register:
            print(f"❌ [CASH] Register id={initial_cash.register_id} not found or inactive")
            raise HTTPException(status_code=404, detail="Caja registradora no encontrada o inactiva")
    else:
        # Default to first active register (backward compat)
        register = db.query(models.CashRegister).filter(
            models.CashRegister.is_active == True
        ).order_by(models.CashRegister.id).first()
        if not register:
            print(f"❌ [CASH] No active registers found in tenant")
            raise HTTPException(status_code=400, detail="No hay cajas configuradas. Crea una caja primero.")

    print(f"   - Register resolved: id={register.id}, name='{register.name}', hw_client='{register.hardware_client_id}'")

    # Check if this specific register already has an open session
    active_session = db.query(models.CashSession).filter(
        models.CashSession.register_id == register.id,
        models.CashSession.status == "OPEN"
    ).first()

    if active_session:
        print(f"⚠️ [CASH] Register '{register.name}' already has OPEN session #{active_session.id}")
        raise HTTPException(
            status_code=400,
            detail=f"'{register.name}' ya está abierta (sesión #{active_session.id})"
        )
    print(f"   - Register is FREE to open ✅")

    try:
        new_session = models.CashSession(
            user_id=current_user.id,
            register_id=register.id,
            start_time=datetime.now(),
            initial_cash=initial_cash.initial_cash,
            initial_cash_bs=initial_cash.initial_cash_bs,
            status="OPEN"
        )
        db.add(new_session)
        # FLUSH ONLY: This triggers ID generation but keeps the transaction OPEN
        # This keeps us within the same atomic block and search_path context.
        print(f"   - Flushing new session to DB...")
        db.flush()

        new_session_id = new_session.id
        print(f"💰 [CASH] Session flushed with ID: {new_session_id}")

        # Initialize currencies
        currencies_response = []
        for req_curr in initial_cash.currencies:
            if not req_curr.currency_symbol: continue

            db_curr = models.CashSessionCurrency(
                session_id=new_session_id,  # Use variable
                currency_symbol=req_curr.currency_symbol,
                initial_amount=req_curr.initial_amount
            )
            db.add(db_curr)
            db.flush()  # Flush to generate ID

            # Add to response list conforming to CashSessionCurrencyRead
            currencies_response.append({
                "id": db_curr.id,
                "currency_symbol": db_curr.currency_symbol,
                "initial_amount": db_curr.initial_amount,
                "final_reported": None,
                "final_expected": None,
                "difference": None
            })

        # PRE-COMMIT CAPTURE: Capture all values needed for response/broadcast
        captured_id = new_session.id
        captured_start_time = new_session.start_time
        captured_initial_cash = float(new_session.initial_cash or 0)
        captured_initial_cash_bs = float(new_session.initial_cash_bs or 0)

        # Final Commit
        print(f"   - Committing session #{new_session_id} with {len(currencies_response)} currencies...")
        db.commit()
        print(f"✅ [CASH] Commit OK for session #{new_session_id}")

        print(f"💰 [CASH] Commit OK. Rebuilding response for session #{captured_id}...")

        # Manually reconstruct the object for return using CAPTURED variables
        # Must match schemas.CashSessionRead STRICTLY
        response_model = {
             "id": captured_id,
             "user_id": current_user.id,
             "register_id": register.id,
             "register": {
                 "id": register.id,
                 "name": register.name,
                 "code": register.code,
                 "description": register.description,
                 "is_active": register.is_active,
                 "created_at": register.created_at,
                 "hardware_client_id": register.hardware_client_id  # Required by CashRegisterRead schema
             },
             "start_time": captured_start_time,
             "end_time": None,
             "status": "OPEN",
             "initial_cash": initial_cash.initial_cash,
             "initial_cash_bs": initial_cash.initial_cash_bs,
             "final_cash_reported": None,
             "final_cash_reported_bs": None,
             "final_cash_expected": None,
             "currencies": currencies_response
        }
        print(f"💰 [CASH] Response dict ready. register.hardware_client_id={register.hardware_client_id!r}")

        # Broadcast cash session opened event
        try:
            await manager.broadcast("cash_session:opened", {
                "session_id": captured_id,
                "register_id": register.id,
                "register_name": register.name,
                "initial_cash": captured_initial_cash,
                "initial_cash_bs": captured_initial_cash_bs,
                "start_time": captured_start_time.isoformat()
            })
        except Exception as e:
            logger.error(f"⚠️ Websocket broadcast failed: {e}")

        return response_model

    except Exception as e:
        import traceback
        print(f"🔥 [CASH] CRASH OPENING SESSION for user={current_user.username}: {type(e).__name__}: {e}")
        traceback.print_exc()
        db.rollback()
        print(f"   - DB rollback done after crash")
        # Clean up the session we just created to avoid zombie OPEN sessions
        try:
            if new_session and new_session.id:
                 # Check if session is still attached to session
                 # If rollback happened, new_session might be transient or detached.
                 # Re-query to be safe? Or just ignore if it fails.
                 pass
        except Exception:
             pass

        raise HTTPException(status_code=500, detail=f"Error interno abriendo caja: {str(e)}")

    # Broadcast (Safe Mode)
    try:
        if manager:
            await manager.broadcast("cash_session:opened", {
                "session_id": new_session.id,
                "initial_cash": float(new_session.initial_cash or 0),
                "initial_cash_bs": float(new_session.initial_cash_bs or 0),
                "start_time": new_session.start_time.isoformat()
            })
    except Exception as broadcast_err:
        print(f"⚠️ Warning: Failed to broadcast open event: {broadcast_err}")
        # Do not fail the request just because websocket failed

    return new_session


@router.get("/sessions/current", response_model=Optional[schemas.CashSessionRead])
def get_current_session(
    register_id: Optional[int] = Query(None, description="ID de la caja. Si se omite retorna la sesión del usuario actual."),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """
    Retorna la sesión abierta del usuario autenticado.
    Multi-caja: cada cajero solo ve SU propia sesión, no la de otros usuarios.
    """
    print(f"💰 [DEBUG] Checking for OPEN session. user={current_user.username}, register_id={register_id}")
    query = db.query(models.CashSession).filter(
        models.CashSession.status == "OPEN",
        models.CashSession.user_id == current_user.id  # Solo la sesión de ESTE usuario
    )

    if register_id is not None:
        query = query.filter(models.CashSession.register_id == register_id)

    session = query.options(
        joinedload(models.CashSession.register),
        joinedload(models.CashSession.currencies),
    ).first()
    print(f"💰 [DEBUG] Found session: {session.id if session else 'None'}")

    if not session:
        return None

    return session


@router.post("/sessions/{session_id}/close", response_model=schemas.CashSessionRead)
async def close_cash_session(
    session_id: int,
    close_data: schemas.CashSessionClose,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    session = db.query(models.CashSession).filter(models.CashSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")

    if session.status == "CLOSED":
        raise HTTPException(status_code=400, detail="La sesión ya está cerrada")

    # Re-calculate expected totals to save them (isolated by session_id for new sessions)
    sales_query = db.query(models.SalePayment).join(models.Sale).filter(
        models.Sale.session_id == session.id
        if session.id else
        models.Sale.date >= session.start_time
    )
    from sqlalchemy import or_, and_
    sales_query = db.query(models.SalePayment).join(models.Sale).filter(
        or_(
            models.Sale.session_id == session.id,
            and_(
                models.Sale.session_id.is_(None),
                models.Sale.date >= session.start_time,
            )
        )
    )
    payments = sales_query.all()
    movements = db.query(models.CashMovement).filter(models.CashMovement.session_id == session.id).all()

    # ============================================
    # CALCULATE EXPECTED BY CURRENCY
    # ============================================

    # Track sales and movements by currency
    cash_sales_by_currency = {}  # {currency_symbol: amount}
    movements_by_currency = {}   # {currency_symbol: {'deposits': X, 'expenses': Y}}

    # Process payments
    for p in payments:
        if "efectivo" in p.payment_method.lower() or "cash" in p.payment_method.lower() or "divisa" in p.payment_method.lower():
            curr = p.currency or "USD"
            # Normalize currency symbols
            if curr.upper() in ["BS", "VES", "VEF"]:
                curr = "Bs"

            if curr not in cash_sales_by_currency:
                cash_sales_by_currency[curr] = Decimal("0.00")
            cash_sales_by_currency[curr] += p.amount

    # 1.5 Process Debt Payments (Abonos)
    debt_payments = db.query(models.Payment).filter(models.Payment.session_id == session.id).all()
    for dp in debt_payments:
        if "efectivo" in dp.payment_method.lower() or "cash" in dp.payment_method.lower() or "divisa" in dp.payment_method.lower():
            curr = dp.currency or "USD"
            if curr.upper() in ["BS", "VES", "VEF"]:
                curr = "Bs"

            if curr not in cash_sales_by_currency:
                cash_sales_by_currency[curr] = Decimal("0.00")
            cash_sales_by_currency[curr] += dp.amount

    # Process Change (Vuelto)
    change_by_currency = {}
    sales_for_change = db.query(models.Sale.change_amount, models.Sale.change_currency).filter(
        or_(
            models.Sale.session_id == session.id,
            and_(models.Sale.session_id.is_(None), models.Sale.date >= session.start_time)
        ),
        models.Sale.change_amount > 0
    ).all()

    for s_change in sales_for_change:
        curr = s_change.change_currency or "USD"
        if curr.upper() in ["BS", "VES", "VEF"]:
            curr = "Bs"

        if curr not in change_by_currency:
            change_by_currency[curr] = Decimal("0.00")
        change_by_currency[curr] += s_change.change_amount

    # Process movements
    for m in movements:
        curr = m.currency or "USD"
        # Normalize currency symbols
        if curr.upper() in ["BS", "VES", "VEF"]:
            curr = "Bs"

        if curr not in movements_by_currency:
            movements_by_currency[curr] = {'deposits': Decimal("0.00"), 'expenses': Decimal("0.00")}

        if m.type in ["DEPOSIT", "IN"]:
            movements_by_currency[curr]['deposits'] += m.amount
        elif m.type in ["EXPENSE", "WITHDRAWAL", "OUT", "CASH_ADVANCE", "RETURN"]:
            movements_by_currency[curr]['expenses'] += m.amount

    # ============================================
    # UPDATE CURRENCY RECORDS
    # ============================================

    # Get all currency records for this session
    currency_records = db.query(models.CashSessionCurrency).filter(
        models.CashSessionCurrency.session_id == session.id
    ).all()

    # Build a lookup of existing currency records for this session
    currency_records_by_symbol = {r.currency_symbol: r for r in currency_records}

    # Collect ALL currencies that appear in sales, change, movements or existing records
    all_currencies = set(currency_records_by_symbol.keys())
    all_currencies.update(cash_sales_by_currency.keys())
    all_currencies.update(change_by_currency.keys())
    all_currencies.update(movements_by_currency.keys())

    for symbol in all_currencies:
        curr_record = currency_records_by_symbol.get(symbol)

        # If no record exists for this currency (e.g. COP appeared in sales but wasn't
        # registered at session open), create one dynamically
        if curr_record is None:
            curr_record = models.CashSessionCurrency(
                session_id=session.id,
                currency_symbol=symbol,
                initial_amount=Decimal("0.00")
            )
            db.add(curr_record)
            db.flush()
            currency_records_by_symbol[symbol] = curr_record
            currency_records.append(curr_record)

        # Calculate expected
        initial = curr_record.initial_amount or Decimal("0.00")
        sales = cash_sales_by_currency.get(symbol, Decimal("0.00"))
        deposits = movements_by_currency.get(symbol, {}).get('deposits', Decimal("0.00"))
        expenses = movements_by_currency.get(symbol, {}).get('expenses', Decimal("0.00"))
        change = change_by_currency.get(symbol, Decimal("0.00"))

        expected = initial + sales - change + deposits - expenses

        # Get reported from close_data
        # close_data should have currencies array with {currency_symbol, final_reported}
        reported = Decimal("0.00")
        if hasattr(close_data, 'currencies') and close_data.currencies:
            for curr_data in close_data.currencies:
                if curr_data.currency_symbol == symbol:
                    reported = Decimal(str(curr_data.final_reported))
                    break

        # Update currency record
        curr_record.final_expected = expected
        curr_record.final_reported = reported
        curr_record.difference = reported - expected

    # ============================================
    # UPDATE LEGACY FIELDS (for backward compatibility)
    # ============================================

    # Calculate legacy USD and BS totals
    cash_sales_usd = cash_sales_by_currency.get("USD", Decimal("0.00"))
    cash_sales_bs = cash_sales_by_currency.get("Bs", Decimal("0.00"))

    expenses_usd = movements_by_currency.get("USD", {}).get('expenses', Decimal("0.00"))
    expenses_bs = movements_by_currency.get("Bs", {}).get('expenses', Decimal("0.00"))

    deposits_usd = movements_by_currency.get("USD", {}).get('deposits', Decimal("0.00"))
    deposits_bs = movements_by_currency.get("Bs", {}).get('deposits', Decimal("0.00"))

    change_usd = change_by_currency.get("USD", Decimal("0.00"))
    change_bs = change_by_currency.get("Bs", Decimal("0.00"))

    expected_usd = session.initial_cash + cash_sales_usd - change_usd + deposits_usd - expenses_usd
    expected_bs = session.initial_cash_bs + cash_sales_bs - change_bs + deposits_bs - expenses_bs

    # Calculate unpaid credit sales for reporting
    credit_sales = db.query(models.Sale).filter(
        models.Sale.date >= session.start_time,
        models.Sale.date <= datetime.now(),
        models.Sale.is_credit == True,
        models.Sale.balance_pending > 0  # Only unpaid credits
    ).all()

    total_credit_pending = sum(float(sale.balance_pending or 0) for sale in credit_sales)

    # Update Session
    session.end_time = datetime.now()
    session.final_cash_reported = close_data.final_cash_reported
    session.final_cash_reported_bs = close_data.final_cash_reported_bs
    session.final_cash_expected = expected_usd
    session.final_cash_expected_bs = expected_bs
    session.difference = close_data.final_cash_reported - expected_usd
    session.difference_bs = close_data.final_cash_reported_bs - expected_bs
    session.status = "CLOSED"

    # Generate Payload BEFORE Commit to avoid lazy load issues later
    response_data = {
        "id": session.id,
        "user_id": session.user_id,
        "start_time": session.start_time,
        "end_time": session.end_time,
        "status": "CLOSED",
        "initial_cash": session.initial_cash,
        "initial_cash_bs": session.initial_cash_bs,
        "final_cash_reported": session.final_cash_reported,
        "final_cash_reported_bs": session.final_cash_reported_bs,
        "final_cash_expected": session.final_cash_expected,
        "final_cash_expected_bs": session.final_cash_expected_bs,
        "difference": session.difference,
        "difference_bs": session.difference_bs,
        "currencies": [
            {
                "id": c.id,
                "currency_symbol": c.currency_symbol,
                "initial_amount": c.initial_amount,
                "final_reported": c.final_reported,
                "final_expected": c.final_expected,
                "difference": c.difference
            } for c in currency_records
        ],
    }

    # CAPTURE VARS FOR BROADCAST
    broadcast_session_id = session.id
    broadcast_end_time = session.end_time.isoformat()
    broadcast_final_reported = float(session.final_cash_reported or 0)
    broadcast_final_reported_bs = float(session.final_cash_reported_bs or 0)
    broadcast_difference = float(session.difference or 0)
    broadcast_difference_bs = float(session.difference_bs or 0)

    db.commit()
    # NO db.refresh(session) calls!

    # Broadcast cash session closed event
    from ...services.sales_service import SalesService

    # SAFETY: Re-assert search path after commit just in case connection was reset
    try:
        current_schema = get_tenant_schema()
        if current_schema and current_schema != "public":
             _validate_schema_name(current_schema)
             db.execute(text(f'SET search_path TO "{current_schema}", public'))
    except Exception as e:
        logger.error(f"⚠️ Failed to re-assert search path: {e}")

    z_report_payload = SalesService.generate_z_report_payload(db, session_id)

    try:
        await manager.broadcast("cash_session:closed", {
            "session_id": broadcast_session_id,
            "end_time": broadcast_end_time,
            "final_cash_reported": broadcast_final_reported,
            "final_cash_reported_bs": broadcast_final_reported_bs,
            "difference": broadcast_difference,
            "difference_bs": broadcast_difference_bs,
            "credit_pending": total_credit_pending,
            "credit_count": len(credit_sales),
            "print_payload": z_report_payload
        })
    except Exception as e:
        logger.error(f"⚠️ Websocket broadcast failed: {e}")

    return response_data
