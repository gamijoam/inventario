from fastapi import APIRouter, Depends, HTTPException, Body, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, or_, and_, text
from typing import List, Dict, Optional
from datetime import datetime, date
from decimal import Decimal
import logging
from ..database.db import get_db, _validate_schema_name
from ..dependencies import get_current_active_user
from ..models import models
from ..websocket.manager import manager
from ..tenant_context import get_tenant_schema
from .. import schemas

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/cash",
    tags=["Caja"]
)

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
    registers = db.query(models.CashRegister).filter(
        models.CashRegister.is_active == True
    ).order_by(models.CashRegister.id).all()

    result = []
    for reg in registers:
        open_session = db.query(models.CashSession).filter(
            models.CashSession.register_id == reg.id,
            models.CashSession.status == "OPEN"
        ).options(joinedload(models.CashSession.user)).first()

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
                session_id=new_session_id, # Use variable
                currency_symbol=req_curr.currency_symbol,
                initial_amount=req_curr.initial_amount
            )
            db.add(db_curr)
            db.flush() # Flush to generate ID
            
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
        except:
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

# ... (Previous code remains, skipping to close_cash_session)



@router.post("/movements", response_model=schemas.CashMovementRead)
def register_movement(
    movement: schemas.CashMovementCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    # Get global open session
    session = db.query(models.CashSession).filter(
        models.CashSession.status == "OPEN"
    ).first()

    if not session:
        raise HTTPException(status_code=400, detail="No hay sesión de caja abierta")

    # VALIDATE FUNDS FOR OUTBOUND MOVEMENTS
    if movement.type in ["WITHDRAWAL", "EXPENSE", "OUT", "CASH_ADVANCE"]:
        available = get_available_cash(db, session.id, movement.currency)
        if movement.amount > available:
            raise HTTPException(
                status_code=400, 
                detail=f"Fondos insuficientes en {movement.currency}. Disponible: {available}"
            )

    new_movement = models.CashMovement(
        session_id=session.id,
        type=movement.type,
        amount=movement.amount,
        currency=movement.currency,
        description=movement.description,
        # Dual Transaction Fields
        incoming_amount=movement.incoming_amount,
        incoming_currency=movement.incoming_currency,
        incoming_method=movement.incoming_method,
        incoming_reference=movement.incoming_reference,
        date=datetime.now()
    )
    db.add(new_movement)
    db.flush()
    
    response_data = {
        "id": new_movement.id,
        "session_id": new_movement.session_id,
        "type": new_movement.type,
        "amount": new_movement.amount,
        "currency": new_movement.currency,
        "description": new_movement.description,
        "incoming_amount": new_movement.incoming_amount,
        "incoming_currency": new_movement.incoming_currency,
        "incoming_method": new_movement.incoming_method,
        "incoming_reference": new_movement.incoming_reference,
        "date": new_movement.date
    }
    
    db.commit()
    # db.refresh(new_movement)
    return response_data

@router.get("/balance")
def get_current_balance(
    currency: str = "USD",
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """Get current available cash balance for a currency"""
    session = db.query(models.CashSession).filter(
        models.CashSession.status == "OPEN"
    ).first()
    
    if not session:
        return {"available": 0.0, "status": "CLOSED"}
        
    available = get_available_cash(db, session.id, currency)
    return {"available": float(available), "status": "OPEN"}

def get_available_cash(db: Session, session_id: int, currency: str) -> Decimal:
    """Calculate available physical cash in the drawer for a specific currency"""
    session = db.query(models.CashSession).filter(models.CashSession.id == session_id).first()
    if not session:
        return Decimal("0.00")

    # 1. Initial Cash
    initial = Decimal("0.00")
    if currency == "USD":
        initial = session.initial_cash
    elif currency in ["Bs", "VES", "VEF"]:
        initial = session.initial_cash_bs
    
    # 2. Cash Sales (Only "Efectivo")
    # Query optimization: Calculate sum directly in DB would be faster, but staying consistent with existing logic
    # We filter specifically for CASH payments in the requested currency
    
    # Normalize currency for query
    target_currencies = [currency]
    if currency in ["Bs", "VES", "VEF"]:
        target_currencies = ["Bs", "VES", "VEF"]
    
    cash_sales = db.query(func.sum(models.SalePayment.amount)).\
        join(models.Sale).\
        filter(
            # New: isolate by session_id; fallback to date range for old sales without session_id
            or_(
                models.Sale.session_id == session.id,
                and_(
                    models.Sale.session_id.is_(None),
                    models.Sale.date >= session.start_time,
                    models.Sale.date <= (session.end_time or datetime.now()),
                )
            ),
            or_(
                models.SalePayment.payment_method.ilike("%efectivo%"),
                models.SalePayment.payment_method.ilike("%cash%")
            ),
            models.SalePayment.currency.in_(target_currencies)
        ).scalar() or Decimal("0.00")

    # 3. Movements (Deposits - Withdrawals/Expenses)
    movements_in = db.query(func.sum(models.CashMovement.amount)).filter(
        models.CashMovement.session_id == session.id,
        models.CashMovement.type.in_(["DEPOSIT", "IN"]), # Fixed: Allow 'IN' from frontend
        models.CashMovement.currency.in_(target_currencies)
    ).scalar() or Decimal("0.00")
    
    movements_out = db.query(func.sum(models.CashMovement.amount)).filter(
        models.CashMovement.session_id == session.id,
        models.CashMovement.type.in_(["EXPENSE", "WITHDRAWAL", "OUT", "CASH_ADVANCE", "RETURN"]),
        models.CashMovement.currency.in_(target_currencies)
    ).scalar() or Decimal("0.00")
    
    # 4. Change Given (Vuelto) - DEDUCT FROM DRAWER
    # We must check if the change was given in this currency
    # Note: We assume change is always given in CASH
    target_change_currencies = target_currencies
    
    cash_change = db.query(func.sum(models.Sale.change_amount)).filter(
        or_(
            models.Sale.session_id == session.id,
            and_(
                models.Sale.session_id.is_(None),
                models.Sale.date >= session.start_time,
                models.Sale.date <= (session.end_time or datetime.now()),
            )
        ),
        models.Sale.change_currency.in_(target_change_currencies),
        models.Sale.change_amount > 0
    ).scalar() or Decimal("0.00")

    return initial + cash_sales - cash_change + movements_in - movements_out

@router.get("/sessions/history")
def get_sessions_history(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """
    Get cash session history with optional date filtering
    Returns all sessions (OPEN and CLOSED) with their closure details and multi-currency info
    """
    from sqlalchemy.orm import joinedload
    
    query = db.query(models.CashSession).options(
        joinedload(models.CashSession.currencies),
        joinedload(models.CashSession.user),
        joinedload(models.CashSession.register)
    )
    
    # Apply date filters if provided
    if start_date:
        start_dt = datetime.combine(start_date, datetime.min.time())
        query = query.filter(models.CashSession.start_time >= start_dt)
    
    if end_date:
        end_dt = datetime.combine(end_date, datetime.max.time())
        query = query.filter(models.CashSession.start_time <= end_dt)
    
    # Order by most recent first
    sessions = query.order_by(models.CashSession.start_time.desc()).all()
    
    # Format response with calculated fields
    result = []
    
    # Pre-fetch for performance? 
    # For now, we do it in loop (30 queries max usually). Optimize later if needed.
    from ..utils.financials import get_session_payment_breakdown
    
    for session in sessions:
        # Calculate Breakdown
        breakdown_raw = get_session_payment_breakdown(db, session)
        
        # Format breakdown for JSON (Decimal -> float)
        breakdown_formatted = []
        for method, currencies in breakdown_raw.items():
            for curr, amt in currencies.items():
                if amt > 0:
                    breakdown_formatted.append({
                        "method": method,
                        "currency": curr,
                        "amount": float(amt)
                    })

        session_dict = {
            "id": session.id,
            "user_id": session.user_id,
            "start_time": session.start_time.isoformat() if session.start_time else None,
            "end_time": session.end_time.isoformat() if session.end_time else None,
            "opened_at": session.start_time.isoformat() if session.start_time else None,  # Alias
            "closed_at": session.end_time.isoformat() if session.end_time else None,  # Alias
            "status": session.status,
            "initial_cash": float(session.initial_cash) if session.initial_cash else 0.0,
            "initial_cash_bs": float(session.initial_cash_bs) if session.initial_cash_bs else 0.0,
            "final_cash_reported": float(session.final_cash_reported) if session.final_cash_reported else 0.0,
            "final_cash_reported_bs": float(session.final_cash_reported_bs) if session.final_cash_reported_bs else 0.0,
            "final_cash_expected": float(session.final_cash_expected) if session.final_cash_expected else 0.0,
            "final_cash_expected_bs": float(session.final_cash_expected_bs) if session.final_cash_expected_bs else 0.0,
            "difference": float(session.difference) if session.difference else 0.0,
            "difference_bs": float(session.difference_bs) if session.difference_bs else 0.0,
            "user": {
                "id": session.user.id,
                "username": session.user.username,
                "full_name": session.user.full_name
            } if session.user else None,
            "register": {
                "id": session.register.id,
                "name": session.register.name,
                "code": session.register.code
            } if session.register else None,
            "currencies": [
                {
                    "id": curr.id,
                    "currency_symbol": curr.currency_symbol,
                    "initial_amount": float(curr.initial_amount) if curr.initial_amount else 0.0,
                    "final_reported": float(curr.final_reported) if curr.final_reported else 0.0,
                    "final_expected": float(curr.final_expected) if curr.final_expected else 0.0,
                    "difference": float(curr.difference) if curr.difference else 0.0
                }
                for curr in session.currencies
            ] if session.currencies else [],
            
            # THE NEW FIELD
            "payment_breakdown": breakdown_formatted
        }
        result.append(session_dict)
    
    return result

@router.get("/sessions/{session_id}/details", response_model=schemas.CashSessionCloseResponse)
def get_session_details(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    session = db.query(models.CashSession).filter(models.CashSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")

    # 1. Calculate Sales Totals
    sales_query = db.query(models.SalePayment).join(models.Sale).filter(
        or_(
            models.Sale.session_id == session.id,
            and_(
                models.Sale.session_id.is_(None),
                models.Sale.date >= session.start_time,
                models.Sale.date <= (session.end_time or datetime.now()),
            )
        )
    )
    
    # 2. Get Movements
    movements = db.query(models.CashMovement).filter(models.CashMovement.session_id == session.id).all()
    
    # Initialize totals
    sales_total_usd = Decimal("0.00")
    sales_total_bs = Decimal("0.00")
    
    sales_by_method = {} # e.g. {"CASH": {"USD": 10, "BS": 500}, "CARD": ...}
    
    payments = sales_query.all()
    
    for p in payments:
        curr = p.currency 
        method = p.payment_method
        amt = p.amount # Already Decimal from DB
        
        if method not in sales_by_method:
            sales_by_method[method] = {}
        
        # Initialize currency in method if not exists
        if curr not in sales_by_method[method]:
            sales_by_method[method][curr] = Decimal("0.00")
        
        # Accumulate by actual currency
        sales_by_method[method][curr] += amt
        
        # Also track total by currency (for backward compatibility)
        if curr and curr.upper() in ["BS", "VES", "VEF"]:
            sales_total_bs += amt
        else:
            sales_total_usd += amt

    # 1.5 Get Debt Payments (Abonos) linked to this session
    debt_payments = db.query(models.Payment).filter(models.Payment.session_id == session.id).all()
    debt_payments_total_usd = Decimal("0.00")
    debt_payments_total_bs = Decimal("0.00")
    
    # Add Debt Payments to Sales By Method (or separate bucket?)
    # For Cash Consistency, we must add them to the relevant "Method" bucket so they count towards expected.
    for dp in debt_payments:
        curr = dp.currency
        method = dp.payment_method # "Efectivo", "Zelle", etc.
        amt = dp.amount
        
        # Normalize method name for consistency
        method_key = f"{method} (Abono)"
        
        if method_key not in sales_by_method:
            sales_by_method[method_key] = {}
            
        if curr not in sales_by_method[method_key]:
            sales_by_method[method_key][curr] = Decimal("0.00")
            
        sales_by_method[method_key][curr] += amt
        
        # For legacy totals, we might want to separate or merge?
        # Merging ensures "Total IN" is correct.
        if curr and curr.upper() in ["BS", "VES", "VEF"]:
            debt_payments_total_bs += amt
            sales_total_bs += amt # Add to global total for simplicity
        else:
            debt_payments_total_usd += amt
            sales_total_usd += amt


    # Calculate Movements
    # Separate Expenses from Cash Advances and Returns
    expenses_usd = sum((m.amount for m in movements if m.type in ["EXPENSE", "WITHDRAWAL", "OUT"] and m.currency == "USD"), Decimal("0.00"))
    expenses_bs = sum((m.amount for m in movements if m.type in ["EXPENSE", "WITHDRAWAL", "OUT"] and (m.currency and m.currency.upper() in ["BS", "VES", "VEF"])), Decimal("0.00"))
    
    returns_usd = sum((m.amount for m in movements if m.type == "RETURN" and m.currency == "USD"), Decimal("0.00"))
    returns_bs = sum((m.amount for m in movements if m.type == "RETURN" and (m.currency and m.currency.upper() in ["BS", "VES", "VEF"])), Decimal("0.00"))
    
    cash_advances_usd = sum((m.amount for m in movements if m.type == "CASH_ADVANCE" and m.currency == "USD"), Decimal("0.00"))
    cash_advances_bs = sum((m.amount for m in movements if m.type == "CASH_ADVANCE" and (m.currency and m.currency.upper() in ["BS", "VES", "VEF"])), Decimal("0.00"))
    
    deposits_usd = sum((m.amount for m in movements if m.type in ["DEPOSIT", "IN"] and m.currency == "USD"), Decimal("0.00"))
    deposits_bs = sum((m.amount for m in movements if m.type in ["DEPOSIT", "IN"] and (m.currency and m.currency.upper() in ["BS", "VES", "VEF"])), Decimal("0.00"))

    # Calculate Expected Cash (Only Cash payments affect the drawer)
    # Check for multiple possible cash payment method names using substring
    cash_by_currency = {}  # Track cash sales by currency
    
    for method_name in sales_by_method:
        # Flexible check: if "efectivo", "cash" or "divisa" is in the name (case-insensitive)
        if "efectivo" in method_name.lower() or "cash" in method_name.lower() or "divisa" in method_name.lower():
            for curr, amt in sales_by_method[method_name].items():
                if curr not in cash_by_currency:
                    cash_by_currency[curr] = Decimal("0.00")
                cash_by_currency[curr] += amt
    
    # Legacy USD/Bs for backward compatibility
    cash_sales_usd = cash_by_currency.get("USD", Decimal("0.00"))
    cash_sales_bs = Decimal("0.00")
    for curr in ["Bs", "VES", "VEF"]:
        cash_sales_bs += cash_by_currency.get(curr, Decimal("0.00"))

    # Calculate Change (Vuelto) totals
    
    total_change_usd = db.query(func.sum(models.Sale.change_amount)).filter(
        or_(
            models.Sale.session_id == session.id,
            and_(models.Sale.session_id.is_(None), models.Sale.date >= session.start_time, models.Sale.date <= (session.end_time or datetime.now()))
        ),
        models.Sale.change_currency == "USD"
    ).scalar() or Decimal("0.00")

    total_change_bs = db.query(func.sum(models.Sale.change_amount)).filter(
        or_(
            models.Sale.session_id == session.id,
            and_(models.Sale.session_id.is_(None), models.Sale.date >= session.start_time, models.Sale.date <= (session.end_time or datetime.now()))
        ),
        models.Sale.change_currency.in_(["Bs", "VES", "VEF"])
    ).scalar() or Decimal("0.00")

    # Expenses, Returns AND Cash Advances reduce expected cash
    expected_usd = session.initial_cash + cash_sales_usd + deposits_usd - expenses_usd - returns_usd - cash_advances_usd - total_change_usd
    expected_bs = session.initial_cash_bs + cash_sales_bs + deposits_bs - expenses_bs - returns_bs - cash_advances_bs - total_change_bs
    
    final_reported_usd = session.final_cash_reported or Decimal("0.00")
    final_reported_bs = session.final_cash_reported_bs or Decimal("0.00")

    # Build expected_by_currency dict for frontend
    expected_by_currency = {
        "USD": float(expected_usd),
        "Bs": float(expected_bs)
    }
    
    # Build cash_by_currency (only cash payments) - convert to float for JSON
    cash_by_currency_response = {curr: float(amt) for curr, amt in cash_by_currency.items()}
    
    # Build transfers_by_currency (non-cash payments) and CONSOLIDATE with Cash Advance Incomings
    transfers_by_currency = {}
    
    # 1. Sales Transfers
    for method, currencies in sales_by_method.items():
        is_cash = "efectivo" in method.lower() or "cash" in method.lower() or "divisa" in method.lower()
        if not is_cash:  # Exclude cash
            for curr, amt in currencies.items():
                if amt > 0:
                    if curr not in transfers_by_currency:
                        transfers_by_currency[curr] = {}
                    transfers_by_currency[curr][method] = float(amt)
                    
    # 2. Cash Advance Incomings (Dual Transaction Consolidation)
    advance_movements = [m for m in movements if m.type == "CASH_ADVANCE" and m.incoming_amount and m.incoming_amount > 0]
    
    for adv in advance_movements:
        if not adv.incoming_method: continue
        
        inc_curr = adv.incoming_currency or "USD"
        inc_amt = float(adv.incoming_amount)
        inc_method = adv.incoming_method
        
        if inc_curr not in transfers_by_currency:
            transfers_by_currency[inc_curr] = {}
            
        # Consolidate: Add to existing sales total or create new entry
        current_val = transfers_by_currency[inc_curr].get(inc_method, 0.0)
        transfers_by_currency[inc_curr][inc_method] = current_val + inc_amt
    
    # Calculate credit sales (only unpaid ones)
    credit_sales = db.query(models.Sale).filter(
        or_(
            models.Sale.session_id == session.id,
            and_(models.Sale.session_id.is_(None), models.Sale.date >= session.start_time, models.Sale.date <= (session.end_time or datetime.now()))
        ),
        models.Sale.is_credit == True,
        models.Sale.balance_pending > 0  # Only unpaid credits
    ).all()
    
    total_credit_pending = sum(float(sale.balance_pending or 0) for sale in credit_sales)
    credit_count = len(credit_sales)

    return {
        "session": session,
        "details": {
            "initial_usd": session.initial_cash,
            "initial_bs": session.initial_cash_bs,
            "sales_total": sales_total_usd,
            "sales_by_method": {k: {curr: float(amt) for curr, amt in v.items()} for k, v in sales_by_method.items()},
            "transfers_by_currency": transfers_by_currency, # NEW: Consolidated transfers (Sales + Cash Advances)
            "expenses_usd": expenses_usd,
            "expenses_bs": expenses_bs,
            "returns_usd": returns_usd,       # NEW: Separated Refunds
            "returns_bs": returns_bs,         # NEW: Separated Refunds
            "cash_advances_usd": cash_advances_usd,
            "cash_advances_bs": cash_advances_bs,
            "deposits_usd": deposits_usd,
            "deposits_bs": deposits_bs,
            "cash_by_currency": cash_by_currency_response,
            "transfers_by_currency": transfers_by_currency,
            "credit_pending": total_credit_pending,  # NEW: Total unpaid credits
            "credit_count": credit_count  # NEW: Number of unpaid credit sales
        },
        "expected_usd": expected_usd,
        "expected_bs": expected_bs,
        "expected_by_currency": expected_by_currency,
        "diff_usd": final_reported_usd - expected_usd,
        "diff_bs": final_reported_bs - expected_bs
    }

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
    
    for curr_record in currency_records:
        symbol = curr_record.currency_symbol
        
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
        "user_id": session.user_id 
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
    from ..services.sales_service import SalesService
    
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


@router.get("/sessions/{session_id}/z-report-payload")
def get_z_report_payload(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """Get Z-Report print payload for reprinting"""
    from ..services.sales_service import SalesService
    
    payload = SalesService.generate_z_report_payload(db, session_id)
    if not payload:
        raise HTTPException(status_code=404, detail="Session not found")
    return payload

