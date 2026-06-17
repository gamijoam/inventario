"""
migrate_price_change_log.py
---------------------------
Migración idempotente que crea las tablas para auditar cambios masivos
de precios (feature "Margen Global de Precios").

Tablas por schema de tenant:
  - price_change_log         (header — un registro por cambio masivo)
  - price_change_log_items   (detalle — un registro por producto afectado)

Se ejecuta automáticamente en startup (main.py) y es IDEMPOTENTE.
"""
from sqlalchemy import text, inspect


def migrate_price_change_log(db_engine=None):
    if not db_engine:
        from .database.db import engine as default_engine
        db_engine = default_engine

    inspector = inspect(db_engine)
    all_schemas = inspector.get_schema_names()
    tenant_schemas = [s for s in all_schemas if s not in ['information_schema']]
    tenant_schemas = [s for s in tenant_schemas if not s.startswith('pg_')]

    print(f"\n💰 PriceChangeLog Migration — Schemas: {tenant_schemas}")

    with db_engine.begin() as conn:
        for schema in tenant_schemas:
            try:
                has_products = conn.execute(text(
                    "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
                    "WHERE table_schema = :s AND table_name = 'products')"
                ), {"s": schema}).scalar()
                if not has_products:
                    continue

                # Header
                conn.execute(text(f'''
                    CREATE TABLE IF NOT EXISTS "{schema}".price_change_log (
                        id                 SERIAL PRIMARY KEY,
                        applied_at         TIMESTAMP NOT NULL DEFAULT NOW(),
                        user_email         VARCHAR(255),
                        margin_percent     NUMERIC(10,2) NOT NULL,
                        target             VARCHAR(50) NOT NULL,   -- 'price_list' | 'product_price' | 'both'
                        price_list_id      INTEGER,
                        rounding           VARCHAR(20) NOT NULL,    -- 'none' | 'integer' | 'multiple_5'
                        total_products     INTEGER NOT NULL DEFAULT 0,
                        total_value_before NUMERIC(18,2) NOT NULL DEFAULT 0,
                        total_value_after  NUMERIC(18,2) NOT NULL DEFAULT 0,
                        notes              TEXT,
                        reverted_at        TIMESTAMP,
                        reverted_by        VARCHAR(255)
                    )
                '''))
                conn.execute(text(f'CREATE INDEX IF NOT EXISTS ix_price_change_log_applied_at ON "{schema}".price_change_log (applied_at DESC)'))

                # Detalle
                conn.execute(text(f'''
                    CREATE TABLE IF NOT EXISTS "{schema}".price_change_log_items (
                        id            SERIAL PRIMARY KEY,
                        log_id        INTEGER NOT NULL REFERENCES "{schema}".price_change_log(id) ON DELETE CASCADE,
                        product_id    INTEGER NOT NULL,
                        product_name  VARCHAR(300),
                        cost_price    NUMERIC(18,4) NOT NULL DEFAULT 0,
                        price_before  NUMERIC(18,4) NOT NULL DEFAULT 0,
                        price_after   NUMERIC(18,4) NOT NULL DEFAULT 0
                    )
                '''))
                conn.execute(text(f'CREATE INDEX IF NOT EXISTS ix_price_change_log_items_log_id ON "{schema}".price_change_log_items (log_id)'))

                print(f"   ✅ {schema}: price_change_log + items OK")
            except Exception as e:
                print(f"   ⚠️  {schema}: {e}")

    print("🎉 PriceChangeLog Migration Completed!")
