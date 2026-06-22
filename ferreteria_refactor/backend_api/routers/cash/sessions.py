"""
cash/sessions.py — Gestión de cajas físicas (registradoras) y apertura/cierre de sesiones.

Responsabilidades:
  - CRUD de cajas registradoras (CashRegister)
  - Apertura de sesión de caja (POST /sessions/open)
  - Consulta de sesión activa (GET /sessions/current)
  - Cierre de sesión de caja (POST /sessions/{id}/close)
  - Cierre forzado por admin (POST /registers/{id}/force-close-session)
"""
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload, subqueryload
from sqlalchemy import text
from typing import List, Optional
from datetime import datetime
from ...utils.time_utils import get_venezuela_now
from decimal import Decimal
import logging

from ...database.db import get_db, _validate_schema_name
from ...dependencies import get_current_active_user, require_permission
from ...models import models
from ...websocket.manager import manager
from ...tenant_context import get_tenant_schema
from ... import schemas
from ...audit_utils import log_action
from ...services.cash_reconciliation_service import CashReconciliationService
from ...services.accounting_ledger_service import AccountingLedgerService

logger = logging.getLogger(__name__)

router = APIRouter()

# ============================================================
#  CASH REGISTERS (Cajas físicas / terminales)
# ============================================================

def _normalize_register_code(value: str) -> str:
    return (value or "").strip().upper()


def _normalize_hardware_client_id(value: Optional[str]) -> Optional[str]:
    normalized = (value or "").strip().lower()
    return normalized or None


def _connected_bridge_ids(tenant_schema: str) -> List[str]:
    tenant_key = (tenant_schema or "").strip().lower()
    tenant_connections = manager.active_connections.get(tenant_key, {})
    return sorted(
        client_id for client_id in tenant_connections.keys()
        if client_id and not client_id.lower().startswith("web_")
    )


def _assert_hardware_client_id_available(
    db: Session,
    hardware_client_id: Optional[str],
    exclude_register_id: Optional[int] = None,
):
    if not hardware_client_id:
        return

    query = db.query(models.CashRegister).filter(
        models.CashRegister.is_active == True,
        text("lower(trim(coalesce(hardware_client_id, ''))) = :hardware_client_id")
    ).params(hardware_client_id=hardware_client_id)

    if exclude_register_id:
        query = query.filter(models.CashRegister.id != exclude_register_id)

    duplicate = query.first()
    if duplicate:
        raise HTTPException(
            status_code=400,
            detail=(
                f"El ID de impresora '{hardware_client_id}' ya está usado por "
                f"'{duplicate.code} / {duplicate.name}'. Cada caja activa debe tener un ID único."
            )
        )

@router.get("/registers", response_model=List[schemas.CashRegisterRead], dependencies=[Depends(require_permission("cash.view"))])
def list_cash_registers(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """Lista todas las cajas registradoras activas del tenant."""
    return db.query(models.CashRegister).filter(
        models.CashRegister.is_active == True
    ).order_by(models.CashRegister.id).all()


@router.post("/registers", response_model=schemas.CashRegisterRead, dependencies=[Depends(require_permission("config.printing.manage"))])
def create_cash_register(
    data: schemas.CashRegisterCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """Crea una nueva caja registradora."""
    code = _normalize_register_code(data.code)
    hardware_client_id = _normalize_hardware_client_id(data.hardware_client_id)

    existing = db.query(models.CashRegister).filter(
        models.CashRegister.code == code
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Ya existe una caja con el código '{code}'")

    _assert_hardware_client_id_available(db, hardware_client_id)

    register = models.CashRegister(
        name=data.name.strip(),
        code=code,
        description=(data.description or "").strip() or None,
        is_active=True,
        hardware_client_id=hardware_client_id
    )
    db.add(register)
    db.commit()
    # expire_on_commit=False (see db.py) → register keeps all attributes after commit;
    # return it directly to avoid any search_path / re-query race in multi-tenant.
    return register


@router.put("/registers/{register_id}", response_model=schemas.CashRegisterRead, dependencies=[Depends(require_permission("config.printing.manage"))])
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
        register.name = data.name.strip()
    if data.description is not None:
        register.description = data.description.strip() or None
    if data.hardware_client_id is not None:
        hardware_client_id = _normalize_hardware_client_id(data.hardware_client_id)
        _assert_hardware_client_id_available(db, hardware_client_id, exclude_register_id=register_id)
        register.hardware_client_id = hardware_client_id
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


@router.post("/registers/{register_id}/force-close-session", dependencies=[Depends(require_permission("cash.force_close"))])
def force_close_register_session(
    register_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """
    Admin: Force-close an orphaned OPEN session on a register.
    Use when a session is stuck (e.g. after a server restart or migration).
    """
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

    from .movements import get_available_cash

    expected_usd = get_available_cash(db, open_session.id, "USD")
    expected_bs = get_available_cash(db, open_session.id, "Bs")
    open_session.final_cash_expected = expected_usd
    open_session.final_cash_expected_bs = expected_bs
    open_session.final_cash_reported = open_session.final_cash_reported if open_session.final_cash_reported is not None else expected_usd
    open_session.final_cash_reported_bs = open_session.final_cash_reported_bs if open_session.final_cash_reported_bs is not None else expected_bs
    open_session.difference = open_session.final_cash_reported - expected_usd
    open_session.difference_bs = open_session.final_cash_reported_bs - expected_bs
    open_session.status = "CLOSED"
    open_session.end_time = get_venezuela_now()

    currency_records = db.query(models.CashSessionCurrency).filter(
        models.CashSessionCurrency.session_id == open_session.id
    ).all()
    currency_records_by_symbol = {
        (record.currency_symbol or "USD").strip().upper(): record
        for record in currency_records
    }
    for symbol, expected in (("USD", expected_usd), ("BS", expected_bs)):
        curr_record = currency_records_by_symbol.get(symbol)
        if curr_record is None:
            curr_record = models.CashSessionCurrency(
                session_id=open_session.id,
                currency_symbol="Bs" if symbol == "BS" else "USD",
                initial_amount=Decimal("0.00"),
            )
            db.add(curr_record)
            currency_records_by_symbol[symbol] = curr_record
        curr_record.final_expected = expected
        curr_record.final_reported = expected
        curr_record.difference = Decimal("0.00")

    # Materialize the accounting ledger inside the same close transaction.
    # This keeps forced closes aligned with the cash audit/report engine.
    db.flush()
    AccountingLedgerService.rebuild_cash_session(db, open_session.id, commit=False)
    db.commit()

    return {
        "detail": f"Sesión #{open_session.id} de '{register.name}' cerrada forzosamente.",
        "final_cash_expected": float(expected_usd),
        "final_cash_expected_bs": float(expected_bs),
    }


@router.get("/registers/status", response_model=List[dict], dependencies=[Depends(require_permission("cash.view"))])
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

    tenant_schema = get_tenant_schema()
    connected_bridges = _connected_bridge_ids(tenant_schema)
    connected_lookup = {client_id.strip().lower() for client_id in connected_bridges}

    result = []
    for reg in registers:
        # Filter in Python — sessions already loaded, no extra queries
        open_session = next((s for s in reg.sessions if s.status == "OPEN"), None)
        print_connected = bool(
            reg.hardware_client_id
            and reg.hardware_client_id.strip().lower() in connected_lookup
        )

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
            "hardware_client_id": reg.hardware_client_id,
            "print_connected": print_connected,
            "connected_bridges": connected_bridges,
        })
    return result


@router.get("/registers/print-status", response_model=dict, dependencies=[Depends(require_permission("config.printing.manage"))])
def get_registers_print_status(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """Diagnóstico de impresoras por caja sin tocar el bridge de Windows."""
    tenant_schema = get_tenant_schema()
    connected_bridges = _connected_bridge_ids(tenant_schema)
    connected_lookup = {client_id.strip().lower() for client_id in connected_bridges}
    registers = db.query(models.CashRegister).filter(
        models.CashRegister.is_active == True
    ).order_by(models.CashRegister.id).all()

    return {
        "tenant": tenant_schema,
        "connected_bridges": connected_bridges,
        "registers": [
            {
                "id": reg.id,
                "code": reg.code,
                "name": reg.name,
                "hardware_client_id": reg.hardware_client_id,
                "print_connected": bool(
                    reg.hardware_client_id
                    and reg.hardware_client_id.strip().lower() in connected_lookup
                ),
                "status": (
                    "sin_impresora"
                    if not reg.hardware_client_id
                    else "conectada"
                    if reg.hardware_client_id.strip().lower() in connected_lookup
                    else "desconectada"
                ),
            }
            for reg in registers
        ],
    }


# ============================================================
#  CASH SESSIONS — Open / Current / Close
# ============================================================

@router.post("/sessions/open", response_model=schemas.CashSessionRead, dependencies=[Depends(require_permission("cash.open"))])
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
            start_time=get_venezuela_now(),
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
        log_action(db, user_id=current_user.id, action="CREATE", table_name="cash_sessions", record_id=new_session_id)

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


@router.api_route("/sessions/current", methods=["GET","HEAD"], response_model=Optional[schemas.CashSessionRead], dependencies=[Depends(require_permission("cash.view"))])
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
    # ADMIN ve cualquier sesión abierta (no solo la suya)
    # Cajero normal solo ve su propia sesión para multi-caja
    role_value = getattr(getattr(current_user, 'role', None), 'value', getattr(current_user, 'role', None))
    is_admin = (str(role_value).upper() == "ADMIN"
                or str(getattr(current_user, 'role', '')).upper() == "USERROLE.ADMIN"
                or getattr(current_user, 'is_superuser', False))
    if is_admin:
        query = db.query(models.CashSession).filter(
            models.CashSession.status == "OPEN"
        )
    else:
        query = db.query(models.CashSession).filter(
            models.CashSession.status == "OPEN",
            models.CashSession.user_id == current_user.id
        )

    if register_id is not None:
        query = query.filter(models.CashSession.register_id == register_id)

    session = query.options(
        joinedload(models.CashSession.register),
        joinedload(models.CashSession.currencies),
    ).first()
    print(f"💰 [DEBUG] Found session: {session.id if session else 'None'}")

    # Si el navegador conservaba una caja vieja, recuperar la sesion real del cajero.
    # Esto evita que una PC usada por caja-1 deje a caja-2 sin ruta de impresion al cambiar usuario.
    if not session and register_id is not None and not is_admin:
        session = db.query(models.CashSession).filter(
            models.CashSession.status == "OPEN",
            models.CashSession.user_id == current_user.id
        ).options(
            joinedload(models.CashSession.register),
            joinedload(models.CashSession.currencies),
        ).first()
        if session:
            print(f"[DEBUG] Recovered cashier session ignoring stale register_id={register_id}: {session.id}")

    # Si no hay sesion propia y es ADMIN, devolver cualquier sesion abierta del tenant.
    # Importante: si register_id fue enviado, nunca reemplazar la sesion encontrada por otra caja.
    if not session and register_id is None and is_admin:
        session = db.query(models.CashSession).filter(
            models.CashSession.status == "OPEN"
        ).options(
            joinedload(models.CashSession.register),
            joinedload(models.CashSession.currencies),
        ).first()
        if session:
            print(f"[DEBUG] Admin fallback session: {session.id}")

    if not session:
        return None

    return session


@router.post("/sessions/{session_id}/close", response_model=schemas.CashSessionRead, dependencies=[Depends(require_permission("cash.close.blind"))])
async def close_cash_session(
    session_id: int,
    close_data: schemas.CashSessionClose,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    session = db.query(models.CashSession).filter(models.CashSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")

    if session.status == "CLOSED":
        raise HTTPException(status_code=400, detail="La sesión ya está cerrada")

    close_time = get_venezuela_now()
    session.end_time = close_time

    def _currency_key(value):
        curr = (value or "USD").strip()
        if curr.upper() in ["BS", "VES", "VEF"]:
            return "Bs"
        if curr in ("$", ""):
            return "USD"
        return curr

    def _to_decimal(value):
        if value is None:
            return Decimal("0.00")
        return Decimal(str(value))

    reported_by_currency = {
        "USD": _to_decimal(close_data.final_cash_reported),
        "Bs": _to_decimal(close_data.final_cash_reported_bs),
    }
    if getattr(close_data, 'currencies', None):
        for curr_data in close_data.currencies:
            reported_by_currency[_currency_key(curr_data.currency_symbol)] = _to_decimal(curr_data.final_reported)

    # Canonical expected totals come from the read-only audit engine. This keeps
    # close, history, audit modal and PDF aligned to one calculation path.
    audit_report = CashReconciliationService.build_session_audit(db, session.id)
    if not audit_report:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")

    cash_rows = audit_report.get("cash_by_currency", [])
    cash_rows_by_currency = {row["currency"]: row for row in cash_rows}

    # Include every opened/reported/audited currency, even when it has zero movement.
    all_currencies = set(reported_by_currency.keys())
    all_currencies.update(cash_rows_by_currency.keys())
    all_currencies.update(
        _currency_key(record.currency_symbol)
        for record in db.query(models.CashSessionCurrency).filter(
            models.CashSessionCurrency.session_id == session.id
        ).all()
    )

    currency_records = db.query(models.CashSessionCurrency).filter(
        models.CashSessionCurrency.session_id == session.id
    ).all()
    currency_records_by_symbol = {_currency_key(r.currency_symbol): r for r in currency_records}

    for symbol in sorted(all_currencies):
        curr_record = currency_records_by_symbol.get(symbol)
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

        audit_row = cash_rows_by_currency.get(symbol, {})
        expected = _to_decimal(audit_row.get("expected"))
        reported = reported_by_currency.get(symbol, Decimal("0.00"))

        curr_record.final_expected = expected
        curr_record.final_reported = reported
        curr_record.difference = reported - expected

    expected_usd = _to_decimal(cash_rows_by_currency.get("USD", {}).get("expected"))
    expected_bs = _to_decimal(cash_rows_by_currency.get("Bs", {}).get("expected"))
    reported_usd = reported_by_currency.get("USD", Decimal("0.00"))
    reported_bs = reported_by_currency.get("Bs", Decimal("0.00"))

    credit_summary = audit_report.get("credits") or {}
    total_credit_pending = float(credit_summary.get("pending_amount") or 0)
    credit_count = int(credit_summary.get("pending_count") or 0)

    # Update Session
    session.final_cash_reported = reported_usd
    session.final_cash_reported_bs = reported_bs
    session.final_cash_expected = expected_usd
    session.final_cash_expected_bs = expected_bs
    session.difference = reported_usd - expected_usd
    session.difference_bs = reported_bs - expected_bs
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

    # Materialize the accounting ledger before the close commit so the
    # session, currency counts and ledger remain atomic and idempotent.
    db.flush()
    AccountingLedgerService.rebuild_cash_session(db, session.id, commit=False)

    db.commit()
    # NO db.refresh(session) calls!
    log_action(
        db,
        user_id=current_user.id,
        action="UPDATE",
        table_name="cash_sessions",
        record_id=broadcast_session_id,
        changes=f'{{"status": "CLOSED", "final_cash_reported": {broadcast_final_reported}, "final_cash_reported_bs": {broadcast_final_reported_bs}, "difference": {broadcast_difference}, "difference_bs": {broadcast_difference_bs}}}'
    )

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
            "register_id": session.register_id,
            "register_code": session.register.code if session.register else None,
            "end_time": broadcast_end_time,
            "final_cash_reported": broadcast_final_reported,
            "final_cash_reported_bs": broadcast_final_reported_bs,
            "difference": broadcast_difference,
            "difference_bs": broadcast_difference_bs,
            "credit_pending": total_credit_pending,
            "credit_count": credit_count,
            "print_payload": z_report_payload
        })
    except Exception as e:
        logger.error(f"⚠️ Websocket broadcast failed: {e}")

    # WhatsApp — resumen de cierre al admin (async directo, sin thread)
    try:
        from ...services import whatsapp_scheduler as _wa_sched
        from ...tenant_context import get_tenant_schema as _gs
        import asyncio as _asyncio

        _schema_now = _gs()
        _sid_now    = broadcast_session_id

        async def _run_wa_tasks():
            try:
                await _wa_sched.send_cash_session_summary(_schema_now, _sid_now)
                logger.info(f"[WA] Resumen caja enviado — schema={_schema_now}")
                await _wa_sched.send_commissions_pdf(_schema_now, _sid_now)
                logger.info(f"[WA] PDF comisiones enviado — schema={_schema_now}")
            except Exception as _ex:
                import traceback
                logger.error(f"[WA] Error WA cierre caja: {_ex}\n{traceback.format_exc()}")

        _asyncio.ensure_future(_run_wa_tasks())
    except Exception as _e:
        logger.warning(f"[WA] Setup WA falló: {_e}")

    return response_data
