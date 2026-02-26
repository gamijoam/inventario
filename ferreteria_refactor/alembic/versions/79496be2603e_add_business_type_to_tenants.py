"""add business_type to tenants

Revision ID: 79496be2603e
Revises: a1d22bd99b9c
Create Date: 2026-02-26 10:16:56.496023

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '79496be2603e'
down_revision: Union[str, Sequence[str], None] = 'a1d22bd99b9c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Check if column exists (since some environments might have it manually)
    conn = op.get_bind()
    columns = [col['name'] for col in sa.inspect(conn).get_columns('tenants', schema='public')]
    
    if 'business_type' not in columns:
        print("🚀 Adding business_type column to public.tenants...")
        op.add_column('tenants', sa.Column('business_type', sa.String(), nullable=True), schema='public')
    else:
        print("ℹ️ Column business_type already exists in public.tenants, skipping.")


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('tenants', 'business_type', schema='public')
