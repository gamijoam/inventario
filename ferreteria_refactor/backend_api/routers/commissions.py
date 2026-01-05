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
    Get a summary of pending commissions grouped by user.
    """
    # Group by user_id and sum amount where status is PENDING
    results = db.query(
        models.CommissionLog.user_id,
        models.User.username.label("user_name"),
        func.sum(models.CommissionLog.amount).label("pending_amount"),
        func.count(models.CommissionLog.id).label("count")
    ).join(
        models.User, models.CommissionLog.user_id == models.User.id
    ).filter(
        models.CommissionLog.status == models.CommissionStatus.PENDING
    ).group_by(
        models.CommissionLog.user_id, models.User.username
    ).all()
    
    return [
        schemas.CommissionSummaryRead(
            user_id=r.user_id,
            user_name=r.user_name,
            pending_amount=r.pending_amount,
            count=r.count
        )
        for r in results
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
    # 1. Verify user exists
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
        raise HTTPException(status_code=400, detail="No valid pending commissions found for this selection")

    total_amount = sum(log.amount for log in logs)
    
    # 3. Update logs to PAID
    now = datetime.now()
    for log in logs:
        log.status = models.CommissionStatus.PAID
        log.paid_at = now
        log.notes = f"Paid via {payout_data.payment_method} by {current_user.username}"

    # 4. Create Expense (Cash Movement)
    # Check for active session
    session = db.query(models.CashSession).filter(
        models.CashSession.user_id == current_user.id,
        models.CashSession.status == "OPEN"
    ).first()

    if not session:
        # Try to find ANY open session if user is Admin, or raise error?
        # Better strictly require session.
        # Fallback: Check if there is a 'system' session or generic open session.
        session = db.query(models.CashSession).filter(models.CashSession.status == "OPEN").first()

    if not session:
        raise HTTPException(
            status_code=400, 
            detail="No active cash session found. Please open a cash register session first to record this payment."
        )
    
    expense = models.CashMovement(
        session_id=session.id,
        type="EXPENSE",
        amount=total_amount,
        currency="USD",
        exchange_rate=1.0, # Default to 1:1 for USD
        description=f"Pago de Comisiones a {user.username} ({len(logs)} ítems) - Processed by {current_user.username}",
        # category is NOT in the model, removed.
        # user_id is NOT in the model, removed.
    )
    db.add(expense)

    db.commit()

    return {
        "success": True, 
        "paid_count": len(logs), 
        "total_amount": total_amount,
        "message": f"Successfully paid ${total_amount} to {user.username}"
    }
