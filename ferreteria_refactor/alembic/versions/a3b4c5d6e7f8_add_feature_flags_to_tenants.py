"""add feature_flags to tenants

Revision ID: a3b4c5d6e7f8
Revises: e2f1a9b2d3c4
Create Date: 2026-03-29 12:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision: str = 'a3b4c5d6e7f8'
down_revision: Union[str, Sequence[str], None] = 'e2f1a9b2d3c4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('tenants', schema='public')]

    if 'feature_flags' not in columns:
        print("🚀 Agregando columna feature_flags a public.tenants...")
        op.add_column(
            'tenants',
            sa.Column('feature_flags', JSONB, nullable=False, server_default='{}'),
            schema='public'
        )


def downgrade() -> None:
    op.drop_column('tenants', 'feature_flags', schema='public')
