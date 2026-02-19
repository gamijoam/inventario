from sqlalchemy import create_engine, text
import os
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL)

def check_schema_sql():
    with engine.connect() as conn:
        print("--- VERIFICACIÓN DE ESQUEMA (SQL) ---")
        
        # 1. Discover Schemas for ServiceOrders
        print("🔍 Buscando tabla 'service_orders' en todos los esquemas...")
        result = conn.execute(text("""
            SELECT table_schema 
            FROM information_schema.tables 
            WHERE table_name='service_orders'
        """))
        schemas = [row[0] for row in result.fetchall()]
        if schemas:
            print(f"✅ Tabla 'service_orders' encontrada en esquemas: {schemas}")
        else:
            print("❌ Tabla 'service_orders' NO ENCONTRADA en ningún esquema.")

        # 2. Check ServicePayments Table
        print("🔍 Buscando tabla 'service_payments' en todos los esquemas...")
        result = conn.execute(text("""
            SELECT table_schema 
            FROM information_schema.tables 
            WHERE table_name='service_payments'
        """))
        schemas_pay = [row[0] for row in result.fetchall()]
        if schemas_pay:
            print(f"✅ Tabla 'service_payments' encontrada en esquemas: {schemas_pay}")
        else:
            print("❌ Tabla 'service_payments' NO ENCONTRADA.")
            
        # 3. Check for Column tenant_id in discovered service_orders
        if schemas:
            for schema in schemas:
                res = conn.execute(text(f"""
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_name='service_orders' 
                    AND table_schema='{schema}' 
                    AND column_name='tenant_id'
                """))
                if res.fetchone():
                    print(f"  ✅ Esquema '{schema}': Columna 'tenant_id' EXISTE.")
                else:
                    print(f"  ❌ Esquema '{schema}': Columna 'tenant_id' NO EXISTE.")

if __name__ == "__main__":
    check_schema_sql()
