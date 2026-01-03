import os
import sqlalchemy as sa
from sqlalchemy import inspect, text
from backend_api.database.db import engine

def fix_db():
    print("--- CHECKING DB SCHEMA ---")
    inspector = inspect(engine)
    columns = [c['name'] for c in inspector.get_columns('products')]
    
    print(f"Columns in products: {columns}")
    
    if 'is_combo' not in columns:
        print("❌ 'is_combo' MISSING! Attempting raw SQL fix...")
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE products ADD COLUMN is_combo BOOLEAN DEFAULT false"))
            conn.execute(text("UPDATE products SET is_combo = false WHERE is_combo IS NULL"))
            conn.execute(text("ALTER TABLE products ALTER COLUMN is_combo SET NOT NULL"))
            conn.commit()
        print("✅ Column added successfully via raw SQL.")
    else:
        print("✅ 'is_combo' matches expected schema.")

    if 'conversion_factor' not in columns:
        print("❌ 'conversion_factor' MISSING! Attempting raw SQL fix...")
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE products ADD COLUMN conversion_factor INTEGER DEFAULT 1"))
            conn.commit()
        print("✅ conversion_factor added.")
    else:
         print("✅ 'conversion_factor' matches expected schema.")

    if 'unit_type' not in columns:
        print("❌ 'unit_type' MISSING! Attempting raw SQL fix...")
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE products ADD COLUMN unit_type VARCHAR DEFAULT 'Unidad'"))
            conn.commit()
        print("✅ unit_type added.")
    else:
         print("✅ 'unit_type' matches expected schema.")

    # FIX SALES TABLE MISSING COLUMNS
    inspector = inspect(engine)
    sales_columns = [c['name'] for c in inspector.get_columns('sales')]
    
    if 'total_amount' not in sales_columns:
        print("❌ 'sales.total_amount' MISSING! Fixing...")
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE sales ADD COLUMN total_amount NUMERIC(12, 2) DEFAULT 0 NOT NULL"))
            conn.execute(text("ALTER TABLE sales ADD COLUMN currency VARCHAR DEFAULT 'USD'"))
            conn.execute(text("ALTER TABLE sales ADD COLUMN exchange_rate_used NUMERIC(14, 4)"))
            conn.execute(text("ALTER TABLE sales ADD COLUMN total_amount_bs NUMERIC(12, 2)"))
            conn.execute(text("ALTER TABLE sales ADD COLUMN is_credit BOOLEAN DEFAULT false"))
            conn.execute(text("ALTER TABLE sales ADD COLUMN paid BOOLEAN DEFAULT true"))
            conn.execute(text("ALTER TABLE sales ADD COLUMN due_date TIMESTAMP"))
            conn.execute(text("ALTER TABLE sales ADD COLUMN balance_pending NUMERIC(12, 2) DEFAULT 0"))
            conn.commit()
        print("✅ Added missing sales columns.")
    else:
        print("✅ 'sales.total_amount' exists.")

    # FIX MISSING TABLES
    tables = inspector.get_tables(schema='public') if hasattr(inspector, 'get_tables') else inspector.get_table_names()
    
    if 'sale_payments' not in tables:
        print("❌ 'sale_payments' TABLE MISSING! Creating...")
        with engine.connect() as conn:
            conn.execute(text("""
                CREATE TABLE sale_payments (
                    id SERIAL PRIMARY KEY,
                    sale_id INTEGER REFERENCES sales(id),
                    amount NUMERIC(12, 2) DEFAULT 0 NOT NULL,
                    currency VARCHAR DEFAULT 'USD',
                    payment_method VARCHAR,
                    exchange_rate NUMERIC(14, 4)
                )
            """))
            conn.commit()
        print("✅ Created sale_payments table.")
    else:
        print("✅ 'sale_payments' table exists.")

    if 'returns' not in tables:
        print("❌ 'returns' TABLE MISSING! Creating...")
        with engine.connect() as conn:
            conn.execute(text("""
                CREATE TABLE returns (
                    id SERIAL PRIMARY KEY,
                    sale_id INTEGER REFERENCES sales(id),
                    date TIMESTAMP DEFAULT now(),
                    total_refunded NUMERIC(12, 2) DEFAULT 0,
                    reason VARCHAR
                )
            """))
            conn.commit()
        print("✅ Created returns table.")
    else:
         print("✅ 'returns' table exists.")

    # FIX SALE_DETAILS TABLE MISSING COLUMNS
    inspector = inspect(engine)
    sd_columns = [c['name'] for c in inspector.get_columns('sale_details')]
    
    with engine.connect() as conn:
        if 'unit_price' not in sd_columns:
            print("❌ 'sale_details.unit_price' MISSING! Fixing...")
            conn.execute(text("ALTER TABLE sale_details ADD COLUMN unit_price NUMERIC(12, 2) DEFAULT 0"))
            conn.commit()
            print("✅ Added unit_price.")

        if 'subtotal' not in sd_columns:
            print("❌ 'sale_details.subtotal' MISSING! Fixing...")
            conn.execute(text("ALTER TABLE sale_details ADD COLUMN subtotal NUMERIC(12, 2) DEFAULT 0"))
            conn.commit()
            print("✅ Added subtotal.")

        if 'tax_rate' not in sd_columns:
            print("❌ 'sale_details.tax_rate' MISSING! Fixing...")
            conn.execute(text("ALTER TABLE sale_details ADD COLUMN tax_rate NUMERIC(5, 2) DEFAULT 0"))
            conn.commit()
            print("✅ Added tax_rate.")
            
        if 'discount' not in sd_columns:
            print("❌ 'sale_details.discount' MISSING! Fixing...")
            conn.execute(text("ALTER TABLE sale_details ADD COLUMN discount NUMERIC(12, 2) DEFAULT 0"))
            conn.commit()
            print("✅ Added discount.")
            
        if 'cost_at_sale' not in sd_columns:
            print("❌ 'sale_details.cost_at_sale' MISSING! Fixing...")
            conn.execute(text("ALTER TABLE sale_details ADD COLUMN cost_at_sale NUMERIC(12, 2) DEFAULT 0"))
            conn.commit()
            print("✅ Added cost_at_sale.")

        if 'discount_type' not in sd_columns:
            print("❌ 'sale_details.discount_type' MISSING! Fixing...")
            conn.execute(text("ALTER TABLE sale_details ADD COLUMN discount_type VARCHAR"))
            conn.commit()
            print("✅ Added discount_type.")

        if 'is_box_sale' not in sd_columns:
            print("❌ 'sale_details.is_box_sale' MISSING! Fixing...")
            conn.execute(text("ALTER TABLE sale_details ADD COLUMN is_box_sale BOOLEAN DEFAULT false"))
            conn.commit()
            print("✅ Added is_box_sale.")

        if 'unit_id' not in sd_columns:
            print("❌ 'sale_details.unit_id' MISSING! Fixing...")
            conn.execute(text("ALTER TABLE sale_details ADD COLUMN unit_id INTEGER"))
            conn.commit()
            print("✅ Added unit_id.")
            
    # FIX CUSTOMERS TABLE MISSING COLUMNS
    inspector = inspect(engine)
    cust_columns = [c['name'] for c in inspector.get_columns('customers')]
    
    with engine.connect() as conn:
        if 'is_blocked' not in cust_columns:
            print("❌ 'customers.is_blocked' MISSING! Fixing...")
            conn.execute(text("ALTER TABLE customers ADD COLUMN is_blocked BOOLEAN DEFAULT false"))
            conn.commit()
            print("✅ Added is_blocked.")

        if 'unique_uuid' not in cust_columns:
            print("❌ 'customers.unique_uuid' MISSING! Fixing...")
            conn.execute(text("ALTER TABLE customers ADD COLUMN unique_uuid VARCHAR(36)"))
            conn.commit()
            print("✅ Added unique_uuid.")
            
        if 'sync_status' not in cust_columns:
            print("❌ 'customers.sync_status' MISSING! Fixing...")
            conn.execute(text("ALTER TABLE customers ADD COLUMN sync_status VARCHAR(20) DEFAULT 'SYNCED'"))
            conn.commit()
            print("✅ Added sync_status.")
            
        if 'payment_term_days' not in cust_columns:
            print("❌ 'customers.payment_term_days' MISSING! Fixing...")
            conn.execute(text("ALTER TABLE customers ADD COLUMN payment_term_days INTEGER DEFAULT 15"))
            conn.commit()
            print("✅ Added payment_term_days.")
            
        if 'credit_limit' not in cust_columns:
            print("❌ 'customers.credit_limit' MISSING! Fixing...")
            conn.execute(text("ALTER TABLE customers ADD COLUMN credit_limit NUMERIC(12, 2) DEFAULT 0"))
            conn.commit()
            print("✅ Added credit_limit.")

    # FIX RETURNS TABLE MISSING COLUMNS
    inspector = inspect(engine)
    ret_columns = [c['name'] for c in inspector.get_columns('returns')]
    
    with engine.connect() as conn:
        if 'total_refunded' not in ret_columns:
            print("❌ 'returns.total_refunded' MISSING! Fixing...")
            conn.execute(text("ALTER TABLE returns ADD COLUMN total_refunded NUMERIC(12, 2) DEFAULT 0"))
            conn.commit()
            print("✅ Added total_refunded.")

        if 'reason' not in ret_columns:
            print("❌ 'returns.reason' MISSING! Fixing...")
            conn.execute(text("ALTER TABLE returns ADD COLUMN reason VARCHAR"))
            conn.commit()
            print("✅ Added reason.")
            
        if 'date' not in ret_columns:
            print("❌ 'returns.date' MISSING! Fixing...")
            conn.execute(text("ALTER TABLE returns ADD COLUMN date TIMESTAMP DEFAULT now()"))
            conn.commit()
            print("✅ Added date.")

    print("✅ customers schema verified.")
    print("✅ returns schema verified.")


if __name__ == "__main__":
    fix_db()
