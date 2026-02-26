from sqlalchemy import create_engine, text
import os
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL)

def check_barbershop_tables():
    with engine.connect() as conn:
        print("--- VERIFICACIÓN DE TABLAS BARBERÍA (SQL) ---")
        
        # 1. Check Employees Table
        print("🔍 Buscando tabla 'employees' en todos los esquemas...")
        result = conn.execute(text("""
            SELECT table_schema 
            FROM information_schema.tables 
            WHERE table_name='employees'
        """))
        schemas_emp = [row[0] for row in result.fetchall()]
        if schemas_emp:
            print(f"✅ Tabla 'employees' encontrada en esquemas: {schemas_emp}")
        else:
            print("❌ Tabla 'employees' NO ENCONTRADA.")

        # 2. Check Commissions Table
        print("🔍 Buscando tabla 'commissions' en todos los esquemas...")
        result = conn.execute(text("""
            SELECT table_schema 
            FROM information_schema.tables 
            WHERE table_name='commissions'
        """))
        schemas_comm = [row[0] for row in result.fetchall()]
        if schemas_comm:
            print(f"✅ Tabla 'commissions' encontrada en esquemas: {schemas_comm}")
        else:
            print("❌ Tabla 'commissions' NO ENCONTRADA.")
            
        # 3. Check for specific columns in prueba3
        target_schema = 'prueba3'
        for table in ['employees', 'commissions']:
            print(f"\n🔍 Revisando columnas de '{table}' en '{target_schema}':")
            res = conn.execute(text(f"""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='{table}' 
                AND table_schema='{target_schema}'
            """))
            cols = [row[0] for row in res.fetchall()]
            if cols:
                print(f"  ✅ Columnas: {cols}")
            else:
                print(f"  ❌ No se encontraron columnas (¿existe la tabla en este esquema?)")

if __name__ == "__main__":
    check_barbershop_tables()
