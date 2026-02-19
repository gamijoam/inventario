from sqlalchemy import create_engine, text, inspect
import os
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL)

def check_schema():
    inspector = inspect(engine)
    
    print("--- VERIFICACIÓN DE ESQUEMA ---")
    
    # 1. Check Service Orders
    columns = [c['name'] for c in inspector.get_columns('service_orders')]
    if 'tenant_id' in columns:
        print("✅ Columna 'tenant_id' ENCONTRADA en 'service_orders'")
    else:
        print("❌ Columna 'tenant_id' NO ENCONTRADA en 'service_orders'")

    # 2. Check Service Payments
    if inspector.has_table('service_payments'):
        print("✅ Tabla 'service_payments' ENCONTRADA")
        pay_cols = [c['name'] for c in inspector.get_columns('service_payments')]
        print(f"   Columnas: {pay_cols}")
    else:
        print("❌ Tabla 'service_payments' NO ENCONTRADA")

if __name__ == "__main__":
    check_schema()
