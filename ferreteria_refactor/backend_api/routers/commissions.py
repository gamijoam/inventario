from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime
from ..database.db import get_db
from ..models import models
from .. import schemas
from ..dependencies import get_current_active_user, has_role
from ..models import models
from ..models.models import UserRole

router = APIRouter(
    prefix="/commissions",
    tags=["commissions"],
    responses={404: {"description": "Not found"}},
)

@router.get("/summary", response_model=List[schemas.CommissionSummaryRead])
def get_commissions_summary(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(has_role([UserRole.ADMIN]))
):
    """
    Resumen de comisiones por usuario — incluye total ganado, pendiente y rol.
    Usado por el Dashboard Ejecutivo y el panel de Reportes > Comisiones.
    """
    # Total ganado (todos los estados) por usuario + rol
    all_results = db.query(
        models.CommissionLog.user_id,
        models.CommissionLog.commission_role,
        models.User.username.label("user_name"),
        models.User.full_name.label("full_name"),
        func.sum(models.CommissionLog.amount).label("total_earned"),
        func.sum(
            func.case((models.CommissionLog.status == models.CommissionStatus.PENDING,
                       models.CommissionLog.amount), else_=0)
        ).label("total_pending"),
        func.count(models.CommissionLog.id).label("count")
    ).join(
        models.User, models.CommissionLog.user_id == models.User.id
    ).group_by(
        models.CommissionLog.user_id,
        models.CommissionLog.commission_role,
        models.User.username,
        models.User.full_name,
    ).order_by(func.sum(models.CommissionLog.amount).desc()).all()

    return [
        schemas.CommissionSummaryRead(
            user_id=r.user_id,
            user_name=r.user_name,
            full_name=r.full_name or r.user_name,
            commission_role=r.commission_role or "VENDOR",
            total_earned=r.total_earned or 0,
            pending_amount=r.total_pending or 0,
            count=r.count
        )
        for r in all_results
    ]

@router.get("/details/{user_id}", response_model=List[schemas.CommissionLogRead])
def get_user_commissions(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(has_role([UserRole.ADMIN]))
):
    """
    Get detailed pending commissions for a specific user.
    """
    commissions = db.query(models.CommissionLog).filter(
        models.CommissionLog.user_id == user_id,
        models.CommissionLog.status == models.CommissionStatus.PENDING
    ).order_by(models.CommissionLog.created_at.desc()).all()
    
    return commissions

@router.post("/payout")
def payout_commissions(
    payout_data: schemas.CommissionPayoutRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(has_role([UserRole.ADMIN]))
):
    """
    Pay selected commissions and record an expense in the cash register.
    """
    # 1. Verify user
    user = db.query(models.User).get(payout_data.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # 2. Get selected logs
    logs = db.query(models.CommissionLog).filter(
        models.CommissionLog.id.in_(payout_data.log_ids),
        models.CommissionLog.user_id == payout_data.user_id,
        models.CommissionLog.status == models.CommissionStatus.PENDING
    ).all()

    if not logs:
        raise HTTPException(status_code=400, detail="No valid pending commissions found (or already paid)")

    # Validate Total Amount Security Check
    db_total = sum(log.amount for log in logs)
    if abs(db_total - payout_data.amount_usd_total) > 0.05: # 5 cents tolerance
        raise HTTPException(status_code=400, detail="Amount mismatch. Please refresh.")

    # 3. Determine Final Amount & Currency
    final_amount = payout_data.amount_usd_total
    currency = "USD"
    
    if "VES" in payout_data.payment_method or "PAGO_MOVIL" in payout_data.payment_method:
        final_amount = payout_data.amount_usd_total * payout_data.exchange_rate
        currency = "VES"
    
    # 4. Handle Source Logic
    print(f"DEBUG PAYOUT: Source='{payout_data.payment_source}' Method='{payout_data.payment_method}' Amount={final_amount}")
    
    session = None
    if payout_data.payment_source == "DRAWER":
        # Get active session
        session = db.query(models.CashSession).filter(
            models.CashSession.user_id == current_user.id, # Must be current user's drawer
            models.CashSession.status == "OPEN"
        ).first()

        if not session:
            # Fallback for admins paying from a general session
            if "ADMIN" in current_user.role:
                 session = db.query(models.CashSession).filter(
                    models.CashSession.status == "OPEN"
                ).first()
        
        if not session:
            raise HTTPException(status_code=400, detail="No active cash session found. Open your drawer first.")
        
        # VALIDATE FUNDS (Strict Check)
        # Import here to avoid circular dependencies at module level if any
        from .cash import get_available_cash
        
        # Normalize currency for check
        check_currency = "Bs" if currency == "VES" else "USD"
        available = get_available_cash(db, session.id, check_currency)
        
        if final_amount > available:
            raise HTTPException(
                status_code=400, 
                detail=f"Fondos insuficientes en CAJA ({check_currency}). Disponible: {available:,.2f}, Requerido: {final_amount:,.2f}"
            )
        
        # Creating Expense
        expense = models.CashMovement(
            session_id=session.id,
            type="EXPENSE", 
            amount=final_amount,
            currency=currency,
            exchange_rate=payout_data.exchange_rate if currency == "VES" else 1.0,
            description=f"Pago Comisiones: {user.username} ({len(logs)} ítems) via {payout_data.payment_method}",
        )
        db.add(expense)
    
    # 5. Update Logs
    now = datetime.now()
    payment_note = f"Paid via {payout_data.payment_source} - {payout_data.payment_method}. Ref: {payout_data.reference or 'N/A'}"
    
    for log in logs:
        log.status = models.CommissionStatus.PAID
        log.paid_at = now
        log.notes = payment_note

    db.commit()

    return {
        "success": True, 
        "paid_count": len(logs), 
        "total_amount": float(final_amount),
        "currency": currency,
        "source": payout_data.payment_source,
        "message": f"Paid {len(logs)} commissions. Total: {final_amount:,.2f} {currency}"
    }
