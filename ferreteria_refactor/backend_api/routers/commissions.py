from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from typing import List, Optional
from datetime import datetime
from ..database.db import get_db
from ..models import models
from .. import schemas
from ..dependencies import get_current_active_user, require_permission, require_all_permissions
from ..models import models

router = APIRouter(
    prefix="/commissions",
    tags=["commissions"],
    responses={404: {"description": "Not found"}},
)

@router.get("/summary", response_model=List[schemas.CommissionSummaryRead])
def get_commissions_summary(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_permission("reports.commissions.view"))
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
            case(
                (models.CommissionLog.status == models.CommissionStatus.PENDING,
                 models.CommissionLog.amount),
                else_=0
            )
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

@router.get("/details/{user_id}")
def get_user_commissions(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_permission("reports.commissions.view"))
):
    """
    Get detailed pending commissions for a specific user, incluyendo método de pago de la venta.
    """
    from sqlalchemy.orm import joinedload
    commissions = db.query(models.CommissionLog).filter(
        models.CommissionLog.user_id == user_id,
        models.CommissionLog.status == models.CommissionStatus.PENDING
    ).order_by(models.CommissionLog.created_at.desc()).all()

    result = []
    for c in commissions:
        payment_methods = []
        sale_currency = None
        sale_total_usd = None
        sale_total_bs = None
        sale_exchange_rate = None
        is_credit = False
        financing_method = None
        financing_level = None
        financed_amount = None

        if c.source_id:
            # source_id es el ID del SaleDetail — buscar la venta a través de él
            sale = None
            if c.source_type == 'SALE' or c.source_type is None:
                detail = db.query(models.SaleDetail).filter(
                    models.SaleDetail.id == c.source_id
                ).first()
                if detail:
                    sale = db.query(models.Sale).filter(models.Sale.id == detail.sale_id).first()
                # Fallback: si no hay sale_detail, intentar directo
                if not sale:
                    sale = db.query(models.Sale).filter(models.Sale.id == c.source_id).first()

            if sale:
                # Pagos de la venta
                payments = db.query(models.SalePayment).filter(
                    models.SalePayment.sale_id == sale.id
                ).all()
                payment_methods = [p.payment_method for p in payments if p.payment_method]

                sale_currency = sale.currency
                sale_total_usd = float(sale.total_amount or 0)
                sale_total_bs = float(sale.total_amount_bs or 0)
                sale_exchange_rate = float(sale.exchange_rate_used or 1)
                is_credit = bool(sale.is_credit)

                # Financiamiento externo
                if hasattr(sale, 'financer_name') and sale.financer_name:
                    financing_method = sale.financer_name
                    financing_level = getattr(sale, 'financer_payment_status', None)
                    financed_amount = float(getattr(sale, 'financed_amount', 0) or 0)
                elif is_credit:
                    financing_method = "Crédito interno"
                    financing_level = f"{sale.credit_installments or 0} cuotas" if sale.credit_installments else None
                    financed_amount = float(sale.credit_installment_amount or 0) * int(sale.credit_installments or 0)

        item = {
            "id": c.id,
            "user_id": c.user_id,
            "amount": float(c.amount),
            "currency": c.currency,
            "source_type": c.source_type,
            "source_id": c.source_id,
            "source_reference": c.source_reference,
            "status": c.status.value if hasattr(c.status, "value") else str(c.status),
            "created_at": c.created_at.isoformat() if c.created_at else None,
            "paid_at": c.paid_at.isoformat() if c.paid_at else None,
            "exchange_rate_snapshot": float(c.exchange_rate_snapshot) if c.exchange_rate_snapshot else None,
            "amount_bs": float(c.amount_bs) if c.amount_bs else None,
            "paid_in_bs": c.paid_in_bs or False,
            "percentage_applied": float(c.percentage_applied) if c.percentage_applied else None,
            "commission_role": c.commission_role,
            # Datos de la venta
            "payment_methods": payment_methods,
            "sale_currency": sale_currency,
            "sale_total_usd": sale_total_usd,
            "sale_total_bs": sale_total_bs,
            "sale_exchange_rate": sale_exchange_rate,
            # Financiamiento
            "is_credit": is_credit,
            "financing_method": financing_method,
            "financing_level": financing_level,
            "financed_amount": financed_amount,
        }
        result.append(item)
    return result

@router.post("/payout")
def payout_commissions(
    payout_data: schemas.CommissionPayoutRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_all_permissions(["reports.commissions.view", "cash.movements.create"]))
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
