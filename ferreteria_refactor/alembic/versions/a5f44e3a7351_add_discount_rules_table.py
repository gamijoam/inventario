"""add_discount_rules_table

Revision ID: a5f44e3a7351
Revises: 333333333333
Create Date: 2026-02-19 18:02:22.003790

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision: str = 'a5f44e3a7351'
down_revision: Union[str, Sequence[str], None] = '333333333333'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Only create discount_rules if `products` table exists in this schema.
    # In the public schema, products does NOT exist (tenant-only), so we skip.
    bind = op.get_bind()
    inspector = inspect(bind)
    existing_tables = inspector.get_table_names()

    if 'products' not in existing_tables:
        return  # Skip in public schema – no products table here

    if 'discount_rules' in existing_tables:
        return  # Already exists, skip

    op.create_table(
        'discount_rules',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('product_id', sa.Integer(), nullable=False),
        sa.Column('min_quantity', sa.Numeric(12, 3), nullable=False),
        sa.Column('discount_percentage', sa.Numeric(5, 2), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_discount_rules_id'), 'discount_rules', ['id'], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    existing_tables = inspector.get_table_names()

    if 'discount_rules' not in existing_tables:
        return

    op.drop_index(op.f('ix_discount_rules_id'), table_name='discount_rules')
    op.drop_table('discount_rules')
