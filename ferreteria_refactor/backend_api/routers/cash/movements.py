"""
cash/movements.py — Movimientos de caja e ingresos/egresos/adelantos.

Responsabilidades:
  - Registro de movimientos manuales (ingresos, egresos, adelantos) — POST /movements
  - Consulta de balance disponible en cajón — GET /balance
  - Función helper get_available_cash() (reutilizable por otros módulos)
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, and_, desc
from typing import Optional
from datetime import datetime
from decimal import Decimal
import logging

from ...database.db import get_db
from ...dependencies import get_current_active_user, require_permission
from ...models import models
from ... import schemas
from ...utils.time_utils import get_venezuela_now

logger = logging.getLogger(__name__)

router = APIRouter()

def _is_admin(user: models.User) -> bool:
    role_value = getattr(getattr(user, "role", None), "value", getattr(user, "role", None))
    role_text = str(role_value).upper()
    return bool(getattr(user, "is_superuser", False)) or role_text == "ADMIN" or str(getattr(user, "role", "")).upper() == "USERROLE.ADMIN"

def _resolve_target_session(
    db: Session,
    current_user: models.User,
    session_id: Optional[int] = None,
):
    query = db.query(models.CashSession).filter(models.CashSession.status == "OPEN")

    if session_id is not None:
        query = query.filter(models.CashSession.id == session_id)
        if not _is_admin(current_user):
            query = query.filter(models.CashSession.user_id == current_user.id)
        session = query.first()
        if not session:
            raise HTTPException(status_code=404, detail="La sesion de caja indicada no esta abierta o no pertenece al usuario actual")
        return session

    session = query.filter(models.CashSession.user_id == current_user.id).order_by(
        desc(models.CashSession.start_time),
        desc(models.CashSession.id),
    ).first()
    if session:
        return session

    if _is_admin(current_user):
        return query.order_by(desc(models.CashSession.start_time), desc(models.CashSession.id)).first()

    return None



# ============================================================
#  HELPER — disponibilidad de efectivo en cajón
# ============================================================

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
        models.CashMovement.type.in_(["DEPOSIT", "IN"]),  # Fixed: Allow 'IN' from frontend
        models.CashMovement.currency.in_(target_currencies)
    ).scalar() or Decimal("0.00")

    movements_out = db.query(func.sum(models.CashMovement.amount)).filter(
        models.CashMovement.session_id == session.id,
        models.CashMovement.type.in_(["EXPENSE", "WITHDRAWAL", "OUT", "CASH_ADVANCE", "RETURN"]),
        models.CashMovement.currency.in_(target_currencies)
    ).scalar() or Decimal("0.00")

    # 3.5 Customer debt payments (CxC) that were not mirrored as cash movements.
    # Some flows store a Payment row only, while newer/manual flows may also create
    # a matching DEPOSIT movement. Count Payment-only rows so advances/withdrawals
    # see the real drawer balance without duplicating CxC deposits.
    debt_payments = Decimal("0.00")
    possible_debt_payments = db.query(models.Payment).filter(
        models.Payment.session_id == session.id,
        models.Payment.currency.in_(target_currencies),
    ).all()
    for payment in possible_debt_payments:
        method = (payment.payment_method or "").lower()
        if "efectivo" not in method and "cash" not in method and "divisa" not in method:
            continue
        amount = Decimal(str(payment.amount or 0))
        matching_deposit = db.query(models.CashMovement.id).filter(
            models.CashMovement.session_id == session.id,
            models.CashMovement.type.in_(["DEPOSIT", "IN"]),
            models.CashMovement.currency.in_(target_currencies),
            models.CashMovement.amount == amount,
            or_(
                models.CashMovement.description.ilike("%abono%"),
                models.CashMovement.description.ilike("%cxc%"),
                models.CashMovement.description.ilike("%cuenta%"),
            )
        ).first()
        if not matching_deposit:
            debt_payments += amount

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

    return initial + cash_sales + debt_payments - cash_change + movements_in - movements_out


# ============================================================
#  ENDPOINTS
# ============================================================

@router.post("/movements", response_model=schemas.CashMovementRead, dependencies=[Depends(require_permission("cash.movements.create"))])
def register_movement(
    movement: schemas.CashMovementCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    session = _resolve_target_session(db, current_user, movement.session_id)

    if not session:
        raise HTTPException(status_code=400, detail="No hay sesion de caja abierta para este usuario o terminal")

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
        incoming_amount=movement.incoming_amount,
        incoming_currency=movement.incoming_currency,
        incoming_method=movement.incoming_method,
        incoming_reference=movement.incoming_reference,
        date=get_venezuela_now()
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
    return response_data


@router.get("/balance", dependencies=[Depends(require_permission("cash.view"))])
def get_current_balance(
    currency: str = "USD",
    session_id: Optional[int] = Query(None, description="ID de la sesion de caja actual"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """Get current available cash balance for a currency."""
    session = _resolve_target_session(db, current_user, session_id)

    if not session:
        return {"available": 0.0, "status": "CLOSED"}

    available = get_available_cash(db, session.id, currency)
    return {"available": float(available), "status": "OPEN", "session_id": session.id}
