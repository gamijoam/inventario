"""create_exchange_rates_table

Revision ID: f123456789ac
Revises: b76b112974a2
Create Date: 2026-02-19 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector


# revision identifiers, used by Alembic.
revision = 'f123456789ac'
down_revision = ('e0b95dd58b57', '5d4b7627a289') # Merging both heads
branch_labels = None
depends_on = None


def upgrade():
    # 1. Detect Schema
    # This migration runs for each tenant schema.
    # We need to filter out 'public' if we don't want it there, 
    # but based on the error, the code expects it everywhere or handles it.
    
    # Actually, the error `UndefinedTable: exchange_rates` happened in `public` context.
    # But `config.py` now handles `public` by RETURNING MOCK DATA.
    # So we ONLY need to create table in TENANT schemas.
    
    bind = op.get_bind()
    # Inspector approach is flaky in batch mode, use raw SQL for robustness
    
    # 2. Raw SQL Creation (Idempotent)
    # We use IF NOT EXISTS to be safe
    
    # Check if we are in a tenant schema (not public)
    # Actually, let's just create it. If it's public, it might be useful later.
    # But to be safe and avoid permissions issues, let's stick to standard.
    
    op.execute("""
    CREATE TABLE IF NOT EXISTS exchange_rates (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) NOT NULL,
        currency_code VARCHAR(3) NOT NULL,
        currency_symbol VARCHAR(5),
        rate NUMERIC(10, 2) NOT NULL,
        is_default BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
    );
    """)
    
    op.execute("""
    CREATE INDEX IF NOT EXISTS ix_exchange_rates_id ON exchange_rates (id);
    """)


def downgrade():
    op.execute("DROP TABLE IF EXISTS exchange_rates")
