import sys
import os
from datetime import date, datetime, timedelta
from decimal import Decimal
from sqlalchemy import create_engine, text, func
from sqlalchemy.orm import sessionmaker

# Ensure we are in the right directory or add it to path
current_dir = os.getcwd()
sys.path.append(current_dir)

print(f"Working Directory: {current_dir}")
print(f"Python Path: {sys.path}")

try:
    from backend_api.models import models
    from backend_api.routers.reports import get_sales_summary
    print("Imports successful!")
except ImportError as e:
    print(f"IMPORT ERROR: {e}")
    print("Ensure you are running this from 'ferreteria_refactor' directory")
    sys.exit(1)

# Database Setup
DATABASE_URL = "sqlite:///./sql_app.db"
# Verify DB file exists
if not os.path.exists("sql_app.db"):
    print("WARNING: sql_app.db not found in current directory!")
    # Try looking in parent or common locations
    if os.path.exists("../sql_app.db"):
         DATABASE_URL = "sqlite:///../sql_app.db"
         print("Found DB in parent directory")

print(f"Connecting to: {DATABASE_URL}")
try:
    engine = create_engine(DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    # Test connection
    db.execute(text("SELECT 1"))
    print("Database connection successful!")
except Exception as e:
    print(f"DB CONNECTION ERROR: {e}")
    sys.exit(1)

def audit_sales():
    today = date.today()
    print(f"\n--- AUDIT FOR {today} ---")
    
    start_dt = datetime.combine(today, datetime.min.time())
    end_dt = datetime.combine(today + timedelta(days=1), datetime.min.time())
    
    print(f"Time Range: {start_dt} to {end_dt}")

    # 1. Fetch Sales (Raw)
    try:
        print("Querying Sales...")
        sales = db.query(models.Sale).filter(
            models.Sale.date >= start_dt,
            models.Sale.date < end_dt
        ).all()
        print(f"Sales Found: {len(sales)}")
    except Exception as e:
        print(f"QUERY ERROR (Sales): {e}")
        return

    total_sales_db = Decimal(0)
    for s in sales:
        try:
            val = s.total_amount
            if val is None: val = Decimal(0)
            if not isinstance(val, Decimal): val = Decimal(str(val))
            total_sales_db += val
            print(f" - Sale #{s.id}: {val}")
        except Exception as conversion_error:
            print(f" - Sale #{s.id}: ERROR converting amount: {conversion_error}")

    # 2. Fetch Returns (Raw)
    try:
        print("Querying Returns...")
        returns = db.query(models.Return).filter(
            models.Return.date >= start_dt,
            models.Return.date < end_dt
        ).all()
        print(f"Returns Found: {len(returns)}")
    except Exception as e:
        print(f"QUERY ERROR (Returns): {e}")
        return

    total_returns_db = Decimal(0)
    for r in returns:
        val = r.total_refunded or Decimal(0)
        total_returns_db += Decimal(str(val))
        print(f" - Return #{r.id}: {val}")

    print(f"Total Sales (DB):   {total_sales_db}")
    print(f"Total Refunds (DB): {total_returns_db}")

    # Calculate Expected Items
    print("\n[CALCULATING ITEMS]")
    total_items_sold_db = db.query(func.sum(models.SaleDetail.quantity)).join(models.Sale).filter(
        models.Sale.date >= start_dt,
        models.Sale.date < end_dt
    ).scalar() or 0
    print(f"Total Items Sold (DB): {total_items_sold_db}")

    # Use ReturnDetail for items returned
    total_items_returned_db = db.query(func.sum(models.ReturnDetail.quantity)).join(models.Return).filter(
        models.Return.date >= start_dt,
        models.Return.date < end_dt
    ).scalar() or 0
    print(f"Total Items Returned (DB): {total_items_returned_db}")

    expected_net_items = total_items_sold_db - total_items_returned_db
    
    # 3. Run Validation
    print(f"\n[RUNNING REPORT FUNCTION]")
    try:
        report = get_sales_summary(today, today, db)
        print("REPORT RESULT:", report)
        
        gross = Decimal(str(report.get('gross_revenue', 0)))
        net = Decimal(str(report.get('total_revenue', 0)))
        
        net_items = Decimal(str(report.get('total_items_sold', 0)))
        
        print(f"\n*** VERDICT ***")
        if gross == total_sales_db:
            print("✅ GROSS REVENUE MATCHES DB (Logic is CORRECT)")
        else:
            print(f"❌ GROSS REVENUE MISMATCH: Report {gross} vs DB {total_sales_db}")
            
        if net == (total_sales_db - total_returns_db):
            print("✅ NET REVENUE MATCHES DB")
        else:
            print(f"❌ NET REVENUE MISMATCH: Report {net} vs DB {total_sales_db - total_returns_db}")

        if net_items == expected_net_items:
            print(f"✅ NET ITEMS MATCH DB ({net_items})")
        else:
            print(f"❌ NET ITEMS MISMATCH: Report {net_items} vs DB {expected_net_items}")

        # Transactions
        net_tx = report.get('net_transactions', 0)
        expected_tx = len(sales) - len(returns)
        
        if net_tx == expected_tx:
             print(f"✅ NET TRANSACTIONS MATCH DB ({net_tx})")
        else:
             print(f"❌ NET TRANSACTIONS MISMATCH: Report {net_tx} vs DB {expected_tx}")

    except Exception as e:
        print(f"REPORT FUNCTION CRASHED: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    audit_sales()
