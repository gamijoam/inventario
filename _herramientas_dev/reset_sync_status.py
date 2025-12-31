from sqlalchemy import create_engine, text
import sys
import os

db_name = "ferreteria.db" # Local DB
if not os.path.exists(db_name):
    print(f"❌ '{db_name}' not found.")
    exit(1)

print(f"🔄 Resetting Sync Status in {db_name}...")

engine = create_engine(f"sqlite:///{db_name}")

with engine.connect() as conn:
    # Check count
    result = conn.execute(text("SELECT count(*) FROM sales WHERE sync_status = 'SYNCED'"))
    count = result.scalar()
    print(f"📊 Found {count} sales marked as SYNCED.")
    
    if count > 0:
        conn.execute(text("UPDATE sales SET sync_status = 'PENDING' WHERE sync_status = 'SYNCED'"))
        conn.commit()
        print(f"✅ Reset {count} sales to PENDING. Ready to retry Sync.")
    else:
        print("⚠️ No SYNCED sales found to reset.")
        
    # Verify
    result = conn.execute(text("SELECT count(*) FROM sales WHERE sync_status = 'PENDING'"))
    pending = result.scalar()
    print(f"📋 Total Pending Sales: {pending}")
