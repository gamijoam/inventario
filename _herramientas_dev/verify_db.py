from sqlalchemy import create_engine, inspect, text
import os
import sys

# Default to cloud.db if not specified
db_name = sys.argv[1] if len(sys.argv) > 1 else "cloud.db"
db_path = f"{db_name}"

if not os.path.exists(db_path):
    print(f"❌ Database file '{db_path}' not found in current directory.")
    print(f"Current Directory: {os.getcwd()}")
    exit(1)

print(f"📂 Inspecting: {db_path}")

engine = create_engine(f"sqlite:///{db_path}")

with engine.connect() as conn:
    # 1. Check Tables
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    if 'sales' not in tables:
        print("❌ Table 'sales' does not exist.")
        exit(1)
        
    # 2. Count Sales
    result = conn.execute(text("SELECT count(*) FROM sales"))
    count = result.scalar()
    print(f"📊 Total Sales in DB: {count}")
    
    # 3. List Sales with Sync Status
    if count > 0:
        print("\n--- Recent Sales ---")
        sales = conn.execute(text("SELECT id, total_amount, unique_uuid, sync_status, is_offline_sale FROM sales ORDER BY id DESC LIMIT 5"))
        for s in sales:
            print(f"ID: {s[0]} | Total: {s[1]} | UUID: {s[2]} | SyncStatus: {s[3]} | Offline: {s[4]}")
    else:
        print("⚠️ No sales found in this database.")
