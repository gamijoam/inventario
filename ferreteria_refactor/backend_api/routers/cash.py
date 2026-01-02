from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Dict, Optional
from datetime import datetime, date
from decimal import Decimal
from ..database.db import get_db
from ..dependencies import get_current_active_user
from ..models import models
from ..websocket.manager import manager
from .. import schemas

router = APIRouter(
    prefix="/cash",
    tags=["Caja"]
)

@router.post("/sessions/open", response_model=schemas.CashSessionRead)
async def open_cash_session(
    initial_cash: schemas.CashSessionCreate, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    # Check if there's ANY open session (global, not per-user)
    active_session = db.query(models.CashSession).filter(
        models.CashSession.status == "OPEN"
    ).first()

    if active_session:
        raise HTTPException(status_code=400, detail="Ya hay una caja abierta en el sistema")

    new_session = models.CashSession(
        user_id=current_user.id,
        start_time=datetime.now(),
        initial_cash=initial_cash.initial_cash,
        initial_cash_bs=initial_cash.initial_cash_bs,
        status="OPEN"
    )
    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    
    # Initialize currencies
    for req_curr in initial_cash.currencies:
        db_curr = models.CashSessionCurrency(
            session_id=new_session.id,
            currency_symbol=req_curr.currency_symbol,
            initial_amount=req_curr.initial_amount
        )
        db.add(db_curr)
    
    db.commit()
    db.refresh(new_session)
    
    # Broadcast cash session opened event to all connected clients
    await manager.broadcast("cash_session:opened", {
        "session_id": new_session.id,
        "initial_cash": float(new_session.initial_cash),
        "initial_cash_bs": float(new_session.initial_cash_bs),
        "start_time": new_session.start_time.isoformat()
    })
    
    return new_session

@router.get("/sessions/current", response_model=schemas.CashSessionRead)
def get_current_session(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    # Get ANY open session (global, not per-user)
    session = db.query(models.CashSession).filter(
        models.CashSession.status == "OPEN"
    ).first()

    if not session:
        raise HTTPException(status_code=404, detail="No hay sesión de caja activa")
    
    return session

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
    if movement.type in ["WITHDRAWAL", "EXPENSE", "OUT"]:
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
        date=datetime.now()
    )
    db.add(new_movement)
    db.commit()
    db.refresh(new_movement)
    return new_movement

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
            models.Sale.date >= session.start_time,
            models.Sale.date <= (session.end_time or datetime.now()),
            models.SalePayment.payment_method.in_(["Efectivo", "CASH", "Cash", "efectivo"]),
            models.SalePayment.currency.in_(target_currencies)
        ).scalar() or Decimal("0.00")

    # 3. Movements (Deposits - Withdrawals/Expenses)
    movements_in = db.query(func.sum(models.CashMovement.amount)).filter(
        models.CashMovement.session_id == session.id,
        models.CashMovement.type == "DEPOSIT",
        models.CashMovement.currency.in_(target_currencies)
    ).scalar() or Decimal("0.00")
    
    movements_out = db.query(func.sum(models.CashMovement.amount)).filter(
        models.CashMovement.session_id == session.id,
        models.CashMovement.type.in_(["EXPENSE", "WITHDRAWAL", "OUT"]),
        models.CashMovement.currency.in_(target_currencies)
    ).scalar() or Decimal("0.00")
    
    return initial + cash_sales + movements_in - movements_out

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
        joinedload(models.CashSession.user)
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
    for session in sessions:
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
            ] if session.currencies else []
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
        models.Sale.date >= session.start_time,
        models.Sale.date <= (session.end_time or datetime.now()),
        # Filter by user if we tracked user per sale
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

    # Calculate Movements
    # Calculate Movements
    expenses_usd = sum((m.amount for m in movements if m.type in ["EXPENSE", "WITHDRAWAL", "OUT"] and m.currency == "USD"), Decimal("0.00"))
    expenses_bs = sum((m.amount for m in movements if m.type in ["EXPENSE", "WITHDRAWAL", "OUT"] and (m.currency and m.currency.upper() in ["BS", "VES", "VEF"])), Decimal("0.00"))
    
    deposits_usd = sum((m.amount for m in movements if m.type == "DEPOSIT" and m.currency == "USD"), Decimal("0.00"))
    deposits_bs = sum((m.amount for m in movements if m.type == "DEPOSIT" and (m.currency and m.currency.upper() in ["BS", "VES", "VEF"])), Decimal("0.00"))

    # Calculate Expected Cash (Only Cash payments affect the drawer)
    # Check for multiple possible cash payment method names
    cash_methods = ["Efectivo", "CASH", "Cash", "efectivo"]
    cash_by_currency = {}  # Track cash sales by currency
    
    for method_name in cash_methods:
        if method_name in sales_by_method:
            for curr, amt in sales_by_method[method_name].items():
                if curr not in cash_by_currency:
                    cash_by_currency[curr] = Decimal("0.00")
                cash_by_currency[curr] += amt
    
    # Legacy USD/Bs for backward compatibility
    cash_sales_usd = cash_by_currency.get("USD", Decimal("0.00"))
    cash_sales_bs = Decimal("0.00")
    for curr in ["Bs", "VES", "VEF"]:
        cash_sales_bs += cash_by_currency.get(curr, Decimal("0.00"))

    expected_usd = session.initial_cash + cash_sales_usd + deposits_usd - expenses_usd
    expected_bs = session.initial_cash_bs + cash_sales_bs + deposits_bs - expenses_bs
    
    final_reported_usd = session.final_cash_reported or Decimal("0.00")
    final_reported_bs = session.final_cash_reported_bs or Decimal("0.00")

    # Build expected_by_currency dict for frontend
    expected_by_currency = {
        "USD": float(expected_usd),
        "Bs": float(expected_bs)
    }
    
    # Build cash_by_currency (only cash payments) - convert to float for JSON
    cash_by_currency_response = {curr: float(amt) for curr, amt in cash_by_currency.items()}
    
    # Build transfers_by_currency (non-cash payments)
    transfers_by_currency = {}
    for method, currencies in sales_by_method.items():
        if method not in cash_methods:  # Exclude cash
            for curr, amt in currencies.items():
                if amt > 0:
                    if curr not in transfers_by_currency:
                        transfers_by_currency[curr] = {}
                    transfers_by_currency[curr][method] = float(amt)
    
    # Calculate credit sales (only unpaid ones)
    credit_sales = db.query(models.Sale).filter(
        models.Sale.date >= session.start_time,
        models.Sale.date <= (session.end_time or datetime.now()),
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
            "expenses_usd": expenses_usd,
            "expenses_bs": expenses_bs,
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

    # Re-calculate expected totals to save them
    sales_query = db.query(models.SalePayment).join(models.Sale).filter(
        models.Sale.date >= session.start_time,
        # models.Sale.date <= datetime.now() 
    )
    payments = sales_query.all()
    movements = db.query(models.CashMovement).filter(models.CashMovement.session_id == session.id).all()
    
    # ============================================
    # CALCULATE EXPECTED BY CURRENCY
    # ============================================
    
    cash_methods = ["Efectivo", "CASH", "Cash", "efectivo"]
    
    # Track sales and movements by currency
    cash_sales_by_currency = {}  # {currency_symbol: amount}
    movements_by_currency = {}   # {currency_symbol: {'deposits': X, 'expenses': Y}}
    
    # Process payments
    for p in payments:
        if p.payment_method in cash_methods:
            curr = p.currency or "USD"
            # Normalize currency symbols
            if curr.upper() in ["BS", "VES", "VEF"]:
                curr = "Bs"
            
            if curr not in cash_sales_by_currency:
                cash_sales_by_currency[curr] = Decimal("0.00")
            cash_sales_by_currency[curr] += p.amount
    
    # Process movements
    for m in movements:
        curr = m.currency or "USD"
        # Normalize currency symbols
        if curr.upper() in ["BS", "VES", "VEF"]:
            curr = "Bs"
        
        if curr not in movements_by_currency:
            movements_by_currency[curr] = {'deposits': Decimal("0.00"), 'expenses': Decimal("0.00")}
        
        if m.type == "DEPOSIT":
            movements_by_currency[curr]['deposits'] += m.amount
        elif m.type in ["EXPENSE", "WITHDRAWAL", "OUT"]:
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
        
        expected = initial + sales + deposits - expenses
        
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
    
    expected_usd = session.initial_cash + cash_sales_usd + deposits_usd - expenses_usd
    expected_bs = session.initial_cash_bs + cash_sales_bs + deposits_bs - expenses_bs
    
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
    
    db.commit()
    db.refresh(session)
    
    # Broadcast cash session closed event to all connected clients
    # Generate Z Report Payload for automatic printing
    from ..services.sales_service import SalesService
    z_report_payload = SalesService.generate_z_report_payload(db, session.id)

    await manager.broadcast("cash_session:closed", {
        "session_id": session.id,
        "end_time": session.end_time.isoformat(),
        "final_cash_reported": float(session.final_cash_reported),
        "final_cash_reported_bs": float(session.final_cash_reported_bs),
        "difference": float(session.difference),
        "difference_bs": float(session.difference_bs),
        "credit_pending": total_credit_pending,
        "credit_count": len(credit_sales),
        "print_payload": z_report_payload # Payload for frontend to print
    })
    
    return session

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

