from sqlalchemy import func
from ferreteria_refactor.backend_api.database.db import SessionLocal
from ferreteria_refactor.backend_api.models import models
from ferreteria_refactor.backend_api.routers.cash import get_available_cash

db = SessionLocal()

print("--- Last 5 Cash Movements ---")
movements = db.query(models.CashMovement).order_by(models.CashMovement.id.desc()).limit(5).all()

for m in movements:
    print(f"ID: {m.id} | Session: {m.session_id} | Type: '{m.type}' | Amount: {m.amount} | Currency: {m.currency} | Desc: {m.description}")

print("\n--- Balance Check for Latest Session ---")
if movements:
    session_id = movements[0].session_id
    session = db.query(models.CashSession).get(session_id)
    print(f"Session ID: {session.id} | Status: {session.status} | Init USD: {session.initial_cash} | Init Bs: {session.initial_cash_bs}")
    
    avail_usd = get_available_cash(db, session.id, "USD")
    avail_bs = get_available_cash(db, session.id, "Bs")
    
    print(f"Calculated Available USD: {avail_usd}")
    print(f"Calculated Available Bs: {avail_bs}")
    
    # Manual Breakdown
    # Expenses (VES)
    expenses_ves = db.query(func.sum(models.CashMovement.amount)).filter(
        models.CashMovement.session_id == session.id,
        models.CashMovement.type.in_(["EXPENSE", "WITHDRAWAL", "OUT"]),
        models.CashMovement.currency.in_(["Bs", "VES", "VEF"])
    ).scalar() or 0
    print(f"Total Expenses (VES): {expenses_ves}")

    # Deposits (VES)
    deposits_ves = db.query(func.sum(models.CashMovement.amount)).filter(
        models.CashMovement.session_id == session.id,
        models.CashMovement.type == "DEPOSIT",
        models.CashMovement.currency.in_(["Bs", "VES", "VEF"])
    ).scalar() or 0
    print(f"Total Deposits (VES): {deposits_ves}")
    
    # Check if logic holds:
    # Approx Balance = Init + Deposits - Expenses
    # (Ignoring Sales for a moment, assuming they are large or 0)
    print(f"Init ({session.initial_cash_bs}) + Dep ({deposits_ves}) - Exp ({expenses_ves}) = {float(session.initial_cash_bs or 0) + float(deposits_ves) - float(expenses_ves)}")

