"""add_is_commissionable_and_commission_percentage

Revision ID: 5d4b7627a289
Revises: e0b95dd58b57
Create Date: 2026-02-19 11:15:26.085379

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5d4b7627a289'
down_revision: Union[str, Sequence[str], None] = 'e0b95dd58b57'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    from sqlalchemy.engine.reflection import Inspector
    inspector = Inspector.from_engine(conn)
    tables = inspector.get_table_names()

    # Add is_commissionable to products (idempotent + guarded)
    if 'products' in tables:
        conn.execute(sa.text("""
            ALTER TABLE products
            ADD COLUMN IF NOT EXISTS is_commissionable BOOLEAN DEFAULT false
        """))
        
    # Add commission_percentage to users (idempotent) - Users is explicitly public.users often, 
    # but here we check if it's in tables or use explicit schema
    # Since Users is a SHARED_TABLE, it should exist in 'public' schema.
    if 'users' in tables or 'public.users' in tables:
        conn.execute(sa.text("""
            ALTER TABLE public.users
            ADD COLUMN IF NOT EXISTS commission_percentage NUMERIC(5,2) DEFAULT 0.00
        """))


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("ALTER TABLE products DROP COLUMN IF EXISTS is_commissionable"))
    conn.execute(sa.text("ALTER TABLE public.users DROP COLUMN IF EXISTS commission_percentage"))
