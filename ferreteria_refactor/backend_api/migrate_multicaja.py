"""
migrate_multicaja.py
--------------------
Migración para soporte de múltiples cajas (multi-cash-register).
Sigue el mismo patrón de migrate_barbershop.py / migrate_tenants.py.
Se ejecuta automáticamente en startup (main.py) y es IDEMPOTENTE.

Cambios que aplica en cada esquema de tenant (y public):
  1. CREATE TABLE cash_registers
  2. INSERT default "Caja Principal" si la tabla está vacía
  3. ALTER TABLE cash_sessions ADD COLUMN register_id (FK → cash_registers.id)
  4. ALTER TABLE sales ADD COLUMN session_id (FK → cash_sessions.id)
  5. CREATE UNIQUE INDEX (un solo OPEN por caja)
  6. Backfill: cash_sessions existentes → register_id = 1
"""
import os
import sys
from dotenv import load_dotenv
from sqlalchemy import create_engine, text, inspect

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
load_dotenv()


def migrate_multicaja(db_engine=None):
    if not db_engine:
        from .database.db import engine as default_engine
        db_engine = default_engine

    inspector = inspect(db_engine)
    all_schemas = inspector.get_schema_names()

    # All tenant schemas + public
    tenant_schemas = [s for s in all_schemas if s not in ['information_schema']]
    tenant_schemas = [s for s in tenant_schemas if not s.startswith('pg_')]

    print(f"\n🏧 Multicaja Migration — Schemas: {tenant_schemas}")

    for schema in tenant_schemas:
        safe_schema = schema.replace("-", "_")
        print(f"\n🚜 Schema: {schema}...")

        with db_engine.connect() as conn:

            # ----------------------------------------------------------------
            # 1. Create cash_registers table
            # ----------------------------------------------------------------
            try:
                tables = inspector.get_table_names(schema=schema)
                if 'cash_registers' not in tables:
                    print(f"   ➕ Creating {schema}.cash_registers")
                    conn.execute(text(f"""
                        CREATE TABLE "{schema}".cash_registers (
                            id        SERIAL PRIMARY KEY,
                            name      VARCHAR NOT NULL,
                            code      VARCHAR(20) NOT NULL,
                            description VARCHAR,
                            is_active BOOLEAN NOT NULL DEFAULT TRUE,
                            created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
                            CONSTRAINT "uq_{safe_schema}_cr_code" UNIQUE (code)
                        )
                    """))
                    conn.execute(text(
                        f'CREATE INDEX "ix_{safe_schema}_cr_id" ON "{schema}".cash_registers (id)'
                    ))
                    conn.commit()
                else:
                    print(f"   ✅ {schema}.cash_registers already exists")
            except Exception as e:
                conn.rollback()
                print(f"   ⚠️  Error creating cash_registers in {schema}: {e}")
                continue

            # ----------------------------------------------------------------
            # 2. Seed default register if empty
            # ----------------------------------------------------------------
            try:
                result = conn.execute(
                    text(f'SELECT COUNT(*) FROM "{schema}".cash_registers')
                )
                count = result.scalar()
                if count == 0:
                    print(f"   🌱 Seeding default 'Caja Principal' in {schema}")
                    conn.execute(text(f"""
                        INSERT INTO "{schema}".cash_registers (name, code, description, is_active)
                        VALUES ('Caja Principal', 'C01', 'Caja predeterminada del sistema', TRUE)
                    """))
                    conn.commit()
                else:
                    print(f"   ✅ {schema}.cash_registers already has data ({count} rows)")
            except Exception as e:
                conn.rollback()
                print(f"   ⚠️  Error seeding cash_registers in {schema}: {e}")

            # ----------------------------------------------------------------
            # 3. Add register_id to cash_sessions
            # ----------------------------------------------------------------
            try:
                # Re-inspect to get fresh column list after possible table creation
                cols = inspector.get_columns('cash_sessions', schema=schema)
                col_names = [c['name'] for c in cols]

                if 'register_id' not in col_names:
                    print(f"   ➕ Adding register_id to {schema}.cash_sessions")
                    conn.execute(text(f"""
                        ALTER TABLE "{schema}".cash_sessions
                        ADD COLUMN register_id INTEGER
                        REFERENCES "{schema}".cash_registers(id)
                    """))
                    conn.commit()
                else:
                    print(f"   ✅ register_id already in {schema}.cash_sessions")
            except Exception as e:
                conn.rollback()
                print(f"   ⚠️  Error adding register_id to cash_sessions in {schema}: {e}")

            # ----------------------------------------------------------------
            # 3.5. Close legacy OPEN sessions that have no register_id yet
            #      These were opened before multi-register support was added.
            #      If we backfill them to C01 while OPEN they block Caja 1.
            #      Idempotent: only affects sessions with register_id IS NULL.
            # ----------------------------------------------------------------
            try:
                result = conn.execute(text(f"""
                    UPDATE "{schema}".cash_sessions
                    SET status = 'CLOSED', end_time = NOW()
                    WHERE status = 'OPEN'
                    AND register_id IS NULL
                """))
                closed = result.rowcount
                if closed > 0:
                    print(f"   🔒 Closed {closed} legacy OPEN session(s) (no register_id) in {schema}")
                    print(f"      ℹ️  Cashiers must re-open their sessions after this upgrade.")
                conn.commit()
            except Exception as e:
                conn.rollback()
                print(f"   ⚠️  Error closing legacy sessions in {schema}: {e}")

            # ----------------------------------------------------------------
            # 4. Backfill: existing sessions → default register (id=1)
            # ----------------------------------------------------------------
            try:
                result = conn.execute(text(f"""
                    UPDATE "{schema}".cash_sessions
                    SET register_id = (
                        SELECT id FROM "{schema}".cash_registers
                        WHERE code = 'C01'
                        LIMIT 1
                    )
                    WHERE register_id IS NULL
                """))
                updated = result.rowcount
                if updated > 0:
                    print(f"   🔁 Backfilled {updated} session(s) → Caja Principal in {schema}")
                conn.commit()
            except Exception as e:
                conn.rollback()
                print(f"   ⚠️  Error backfilling sessions in {schema}: {e}")

            # ----------------------------------------------------------------
            # 5. Partial unique index: only one OPEN session per register
            # ----------------------------------------------------------------
            try:
                index_name = f"uq_{safe_schema}_one_open_per_register"
                # Check if index exists
                idx_result = conn.execute(text(f"""
                    SELECT 1 FROM pg_indexes
                    WHERE schemaname = '{schema}'
                    AND indexname = '{index_name}'
                """))
                if not idx_result.fetchone():
                    print(f"   ➕ Creating partial unique index {index_name}")
                    conn.execute(text(f"""
                        CREATE UNIQUE INDEX "{index_name}"
                        ON "{schema}".cash_sessions (register_id)
                        WHERE status = 'OPEN'
                    """))
                    conn.commit()
                else:
                    print(f"   ✅ Partial unique index already exists in {schema}")
            except Exception as e:
                conn.rollback()
                print(f"   ⚠️  Error creating unique index in {schema}: {e}")

            # ----------------------------------------------------------------
            # 6. Add session_id to sales
            # ----------------------------------------------------------------
            try:
                cols = inspector.get_columns('sales', schema=schema)
                col_names = [c['name'] for c in cols]

                if 'session_id' not in col_names:
                    print(f"   ➕ Adding session_id to {schema}.sales")
                    conn.execute(text(f"""
                        ALTER TABLE "{schema}".sales
                        ADD COLUMN session_id INTEGER
                        REFERENCES "{schema}".cash_sessions(id)
                    """))
                    conn.execute(text(
                        f'CREATE INDEX "ix_{safe_schema}_sale_session" '
                        f'ON "{schema}".sales (session_id)'
                    ))
                    conn.commit()
                else:
                    print(f"   ✅ session_id already in {schema}.sales")
            except Exception as e:
                conn.rollback()
                print(f"   ⚠️  Error adding session_id to sales in {schema}: {e}")

            # ----------------------------------------------------------------
            # 7. Add user_id to quotes (track who created each quote)
            # ----------------------------------------------------------------
            try:
                cols = inspector.get_columns('quotes', schema=schema)
                col_names = [c['name'] for c in cols]

                if 'user_id' not in col_names:
                    print(f"   ➕ Adding user_id to {schema}.quotes")
                    conn.execute(text(f"""
                        ALTER TABLE "{schema}".quotes
                        ADD COLUMN user_id INTEGER
                        REFERENCES public.users(id)
                    """))
                    conn.commit()
                else:
                    print(f"   ✅ user_id already in {schema}.quotes")
            except Exception as e:
                conn.rollback()
                print(f"   ⚠️  Error adding user_id to quotes in {schema}: {e}")

            # ----------------------------------------------------------------
            # 8. Add hardware_client_id to cash_registers
            # ----------------------------------------------------------------
            try:
                cols = inspector.get_columns('cash_registers', schema=schema)
                col_names = [c['name'] for c in cols]

                if 'hardware_client_id' not in col_names:
                    print(f"   ➕ Adding hardware_client_id to {schema}.cash_registers")
                    conn.execute(text(f"""
                        ALTER TABLE "{schema}".cash_registers
                        ADD COLUMN hardware_client_id VARCHAR
                    """))
                    conn.commit()
                else:
                    print(f"   ✅ hardware_client_id already in {schema}.cash_registers")
            except Exception as e:
                conn.rollback()
                print(f"   ⚠️  Error adding hardware_client_id to cash_registers in {schema}: {e}")

    print("\n🎉 Multicaja Migration Completed!")


if __name__ == "__main__":
    DATABASE_URL = os.getenv("DATABASE_URL")
    if not DATABASE_URL:
        print("❌ DATABASE_URL not found.")
    else:
        engine = create_engine(DATABASE_URL)
        migrate_multicaja(engine)
