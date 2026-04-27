"""
Fix: Añadir columnas ingredient_id y quantity_consumed a product_modifier_options
en todos los schemas de tenant en QA.
"""
import psycopg2
import os

DB_HOST = "db_qa"
DB_PORT = 5432
DB_NAME = "invensoft_qa"
DB_USER = "postgres"
DB_PASSWORD = os.environ.get("DB_PASSWORD", "postgres")

# Schemas a parchear (todos los tenants + public)
SCHEMAS = ["public", "restaurante", "restaurante2", "cosaloca", "colaloca2"]

conn = psycopg2.connect(
    host=DB_HOST, port=DB_PORT, dbname=DB_NAME,
    user=DB_USER, password=DB_PASSWORD
)
conn.autocommit = True
cur = conn.cursor()

for schema in SCHEMAS:
    print(f"\n🔧 Procesando schema: {schema}")

    # Verificar si la tabla existe
    cur.execute("""
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = %s AND table_name = 'product_modifier_options'
        )
    """, (schema,))
    exists = cur.fetchone()[0]

    if not exists:
        print(f"   ⏭️  Tabla no existe, saltando...")
        continue

    # Añadir ingredient_id si no existe
    cur.execute("""
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = %s AND table_name = 'product_modifier_options'
        AND column_name = 'ingredient_id'
    """, (schema,))
    if not cur.fetchone():
        cur.execute(f"""
            ALTER TABLE {schema}.product_modifier_options
            ADD COLUMN ingredient_id INTEGER NULL
        """)
        print(f"   ✅ Columna ingredient_id añadida")
    else:
        print(f"   ✅ ingredient_id ya existe")

    # Añadir quantity_consumed si no existe
    cur.execute("""
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = %s AND table_name = 'product_modifier_options'
        AND column_name = 'quantity_consumed'
    """, (schema,))
    if not cur.fetchone():
        cur.execute(f"""
            ALTER TABLE {schema}.product_modifier_options
            ADD COLUMN quantity_consumed NUMERIC(10,3) NULL DEFAULT 1.000
        """)
        print(f"   ✅ Columna quantity_consumed añadida")
    else:
        print(f"   ✅ quantity_consumed ya existe")

cur.close()
conn.close()
print("\n🎉 Fix completado!")
