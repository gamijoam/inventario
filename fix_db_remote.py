import os
import psycopg2

db_url = os.environ.get("DATABASE_URL")
if db_url.startswith("postgresql+psycopg2://"):
    db_url = db_url.replace("postgresql+psycopg2://", "postgresql://")

conn = psycopg2.connect(db_url)
conn.autocommit = True
cur = conn.cursor()

# Get all schemas
cur.execute("SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast');")
schemas = [row[0] for row in cur.fetchall()]

columns_to_add = [
    ("credit_down_payment", "NUMERIC(18,4)"),
    ("credit_installments", "INTEGER"),
    ("credit_interest_rate", "NUMERIC(8,4)"),
    ("credit_frequency", "VARCHAR(20)"),
    ("credit_installment_amount", "NUMERIC(18,4)"),
    ("bloqueo_cliente_id", "INTEGER"),
    ("bloqueo_dispositivo_id", "INTEGER"),
    ("bloqueo_codigo_activacion", "VARCHAR(20)"),
    ("bloqueo_sincronizado", "BOOLEAN DEFAULT FALSE"),
    ("bloqueo_estado", "VARCHAR(20)"),
    ("bloqueo_error", "TEXT"),
]

for schema in schemas:
    cur.execute(f"SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = '{schema}' AND table_name = 'sales');")
    if not cur.fetchone()[0]:
        continue

    for col_name, col_type in columns_to_add:
        try:
            cur.execute(f"ALTER TABLE {schema}.sales ADD COLUMN {col_name} {col_type};")
            print(f"Added {col_name} to {schema}.sales")
        except psycopg2.errors.DuplicateColumn:
            pass
        except psycopg2.Error as e:
            pass

print("Done fixing database.")
