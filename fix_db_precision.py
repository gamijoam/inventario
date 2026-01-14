import sys
import os
from sqlalchemy import text

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__))))

try:
    from ferreteria_refactor.backend_api.database.db import engine
    
    print("Connecting to DB...")
    with engine.connect() as conn:
        print("Executing ALTER TABLE statements to upgrade precision...")
        
        # Sales
        conn.execute(text("ALTER TABLE sales ALTER COLUMN total_amount TYPE NUMERIC(18, 4)"))
        conn.execute(text("ALTER TABLE sales ALTER COLUMN total_amount_bs TYPE NUMERIC(18, 4)"))
        conn.execute(text("ALTER TABLE sales ALTER COLUMN change_amount TYPE NUMERIC(18, 4)"))
        conn.execute(text("ALTER TABLE sales ALTER COLUMN balance_pending TYPE NUMERIC(18, 4)"))
        print("Sales updated.")
        
        # Sale Payments
        conn.execute(text("ALTER TABLE sale_payments ALTER COLUMN amount TYPE NUMERIC(18, 4)"))
        print("Sale Payments updated.")
        
        # Cash Movements
        conn.execute(text("ALTER TABLE cash_movements ALTER COLUMN amount TYPE NUMERIC(18, 4)"))
        conn.execute(text("ALTER TABLE cash_movements ALTER COLUMN incoming_amount TYPE NUMERIC(18, 4)"))
        print("Cash Movements updated.")
        
        # Cash Sessions
        conn.execute(text("ALTER TABLE cash_sessions ALTER COLUMN initial_cash TYPE NUMERIC(18, 4)"))
        conn.execute(text("ALTER TABLE cash_sessions ALTER COLUMN initial_cash_bs TYPE NUMERIC(18, 4)"))
        conn.execute(text("ALTER TABLE cash_sessions ALTER COLUMN final_cash_reported TYPE NUMERIC(18, 4)"))
        conn.execute(text("ALTER TABLE cash_sessions ALTER COLUMN final_cash_reported_bs TYPE NUMERIC(18, 4)"))
        conn.execute(text("ALTER TABLE cash_sessions ALTER COLUMN final_cash_expected TYPE NUMERIC(18, 4)"))
        conn.execute(text("ALTER TABLE cash_sessions ALTER COLUMN final_cash_expected_bs TYPE NUMERIC(18, 4)"))
        conn.execute(text("ALTER TABLE cash_sessions ALTER COLUMN difference TYPE NUMERIC(18, 4)"))
        conn.execute(text("ALTER TABLE cash_sessions ALTER COLUMN difference_bs TYPE NUMERIC(18, 4)"))
        print("Cash Sessions updated.")
        
        conn.commit()
        print("SUCCESS! Database precision upgraded.")
        
except Exception as e:
    print(f"Error: {e}")
