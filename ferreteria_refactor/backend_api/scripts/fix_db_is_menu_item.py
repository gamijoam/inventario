import psycopg2
import os

# Configuración de conexión QA
DB_HOST = "db_qa"
DB_PORT = 5432
DB_NAME = "invensoft_qa"
DB_USER = "postgres"
DB_PASSWORD = "postgres" # Usando 'postgres' como en tus otros scripts de test

try:
    conn = psycopg2.connect(
        host=DB_HOST, port=DB_PORT, dbname=DB_NAME,
        user=DB_USER, password=DB_PASSWORD
    )
    conn.autocommit = True
    cur = conn.cursor()

    # Obtener todos los esquemas
    cur.execute("SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast');")
    schemas = [row[0] for row in cur.fetchall()]

    for schema in schemas:
        # Verificar si existe la tabla products en este esquema
        cur.execute(f"SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = '{schema}' AND table_name = 'products');")
        if not cur.fetchone()[0]:
            continue

        print(f"🔧 Reparando esquema: {schema}")
        
        # Añadir is_menu_item si no existe
        cur.execute(f"""
            SELECT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_schema = '{schema}' AND table_name = 'products' AND column_name = 'is_menu_item'
            );
        """)
        if not cur.fetchone()[0]:
            cur.execute(f"ALTER TABLE {schema}.products ADD COLUMN is_menu_item BOOLEAN DEFAULT FALSE;")
            print(f"   ✅ Columna is_menu_item añadida.")
        else:
            print(f"   ℹ️ Columna is_menu_item ya existe.")

        # Añadir is_barbershop_service si no existe
        cur.execute(f"""
            SELECT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_schema = '{schema}' AND table_name = 'products' AND column_name = 'is_barbershop_service'
            );
        """)
        if not cur.fetchone()[0]:
            cur.execute(f"ALTER TABLE {schema}.products ADD COLUMN is_barbershop_service BOOLEAN DEFAULT FALSE;")
            print(f"   ✅ Columna is_barbershop_service añadida.")
        else:
            print(f"   ℹ️ Columna is_barbershop_service ya existe.")

    cur.close()
    conn.close()
    print("\n🎉 Base de datos reparada exitosamente!")

except Exception as e:
    print(f"\n❌ Error conectando o reparando la base de datos: {e}")
