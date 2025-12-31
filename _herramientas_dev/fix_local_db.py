from sqlalchemy import create_engine, inspect
import os

# Inspect Local DB
db_path = "ferreteria.db"
if not os.path.exists(db_path):
    print(f"❌ {db_path} not found.")
    exit(1)

engine = create_engine(f"sqlite:///{db_path}")
inspector = inspect(engine)

columns = [c['name'] for c in inspector.get_columns('sales')]
print(f"Columns in 'sales': {columns}")

if 'unique_uuid' not in columns:
    print("❌ 'unique_uuid' is MISSING in sales table!")
    print("Attempting to add it...")
    with engine.connect() as conn:
        conn.execute("ALTER TABLE sales ADD COLUMN unique_uuid VARCHAR(36)")
        conn.execute("CREATE UNIQUE INDEX ix_sales_unique_uuid ON sales (unique_uuid)")
        # Also check other new columns
        if 'sync_status' not in columns:
            conn.execute("ALTER TABLE sales ADD COLUMN sync_status VARCHAR(20) DEFAULT 'PENDING'")
        if 'is_offline_sale' not in columns:
             conn.execute("ALTER TABLE sales ADD COLUMN is_offline_sale BOOLEAN DEFAULT 0")
             
    print("✅ Columns added manually.")
else:
    print("✅ 'unique_uuid' exists.")

if 'sync_status' not in columns:
     print("❌ 'sync_status' missing. Adding...")
     with engine.connect() as conn:
        conn.execute("ALTER TABLE sales ADD COLUMN sync_status VARCHAR(20) DEFAULT 'PENDING'")
else:
    print("✅ 'sync_status' exists.")
