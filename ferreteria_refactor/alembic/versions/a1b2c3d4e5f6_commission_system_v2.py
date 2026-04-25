"""commission_system_v2

Revision ID: a1b2c3d4e5f6
Revises: 0ea14a7dc3e9
Create Date: 2026-03-31 23:00:00.000000

Sistema de Comisiones Global v2:
- commission_vendor_pct + commission_technician_pct en users (public)
- commission_role + voided_at + sale_id en commission_logs (tenant)
- tabla commission_settings (tenant)
- tabla commission_rules (tenant)
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector

revision = 'a1b2c3d4e5f6'
down_revision = '0ea14a7dc3e9'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = Inspector.from_engine(bind)

    # ── 1. Columnas en public.users (aplica una sola vez) ──────────────
    existing_cols = [c['name'] for c in inspector.get_columns('users', schema='public')]

    if 'commission_vendor_pct' not in existing_cols:
        op.execute("ALTER TABLE public.users ADD COLUMN commission_vendor_pct NUMERIC(5,2) DEFAULT 0.00")

    if 'commission_technician_pct' not in existing_cols:
        op.execute("ALTER TABLE public.users ADD COLUMN commission_technician_pct NUMERIC(5,2) DEFAULT 0.00")

    # ── 2. Columnas + tablas en cada schema de tenant ──────────────────
    schemas_result = bind.execute(
        sa.text("SELECT schema_name FROM public.tenants WHERE is_active = TRUE AND schema_name IS NOT NULL")
    )
    schemas = [row[0] for row in schemas_result]

    for schema in schemas:
        # 2a. Columnas en commission_logs
        tables = inspector.get_table_names(schema=schema)

        if 'commission_logs' in tables:
            cols = [c['name'] for c in inspector.get_columns('commission_logs', schema=schema)]
            if 'commission_role' not in cols:
                op.execute(f"ALTER TABLE {schema}.commission_logs ADD COLUMN commission_role VARCHAR DEFAULT 'VENDOR'")
            if 'voided_at' not in cols:
                op.execute(f"ALTER TABLE {schema}.commission_logs ADD COLUMN voided_at TIMESTAMP NULL")
            if 'sale_id' not in cols:
                op.execute(f"ALTER TABLE {schema}.commission_logs ADD COLUMN sale_id INTEGER NULL")

        # 2b. Tabla commission_settings
        if 'commission_settings' not in tables:
            op.execute(f"""
                CREATE TABLE {schema}.commission_settings (
                    id SERIAL PRIMARY KEY,
                    global_enabled BOOLEAN DEFAULT FALSE,
                    pos_module_enabled BOOLEAN DEFAULT TRUE,
                    taller_module_enabled BOOLEAN DEFAULT TRUE,
                    strict_mode BOOLEAN DEFAULT TRUE,
                    updated_at TIMESTAMP DEFAULT NOW()
                )
            """)
            # Insertar fila por defecto
            op.execute(f"INSERT INTO {schema}.commission_settings (global_enabled) VALUES (FALSE)")

        # 2c. Tabla commission_rules
        if 'commission_rules' not in tables:
            op.execute(f"""
                CREATE TABLE {schema}.commission_rules (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR NOT NULL,
                    category_id INTEGER REFERENCES {schema}.categories(id) ON DELETE SET NULL,
                    module VARCHAR NULL,
                    percentage NUMERIC(5,2) NOT NULL,
                    is_active BOOLEAN DEFAULT TRUE,
                    priority INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT NOW()
                )
            """)


def downgrade():
    bind = op.get_bind()
    schemas_result = bind.execute(
        sa.text("SELECT schema_name FROM public.tenants WHERE is_active = TRUE AND schema_name IS NOT NULL")
    )
    schemas = [row[0] for row in schemas_result]

    for schema in schemas:
        op.execute(f"DROP TABLE IF EXISTS {schema}.commission_rules")
        op.execute(f"DROP TABLE IF EXISTS {schema}.commission_settings")
        op.execute(f"ALTER TABLE IF EXISTS {schema}.commission_logs DROP COLUMN IF EXISTS commission_role")
        op.execute(f"ALTER TABLE IF EXISTS {schema}.commission_logs DROP COLUMN IF EXISTS voided_at")
        op.execute(f"ALTER TABLE IF EXISTS {schema}.commission_logs DROP COLUMN IF EXISTS sale_id")

    op.execute("ALTER TABLE IF EXISTS public.users DROP COLUMN IF EXISTS commission_vendor_pct")
    op.execute("ALTER TABLE IF EXISTS public.users DROP COLUMN IF EXISTS commission_technician_pct")
