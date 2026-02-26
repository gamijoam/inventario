"""add takeout support to restaurant orders

Revision ID: 2abfc9e544a2
Revises: 79496be2603e
Create Date: 2026-02-26 15:36:36.159664

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2abfc9e544a2'
down_revision: Union[str, Sequence[str], None] = '79496be2603e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Check if table exists in current context
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    # Get current search path or schema from context
    # In this project, env.py sets the search path.
    tables = inspector.get_table_names()
    
    if 'restaurant_orders' not in tables:
        print("ℹ️ Table 'restaurant_orders' not found in current schema, skipping migration.")
        return

    # Alter restaurant_orders table to support takeout
    # 1. Make table_id nullable
    op.alter_column('restaurant_orders', 'table_id',
               existing_type=sa.INTEGER(),
               nullable=True)
    
    # 2. Add is_takeout column
    cols = [c['name'] for c in inspector.get_columns('restaurant_orders')]
    if 'is_takeout' not in cols:
        op.add_column('restaurant_orders', sa.Column('is_takeout', sa.Boolean(), nullable=True, server_default=sa.text('false')))
        # Set default value for existing rows
        op.execute("UPDATE restaurant_orders SET is_takeout = false WHERE is_takeout IS NULL")
        # Make it non-nullable with default after update
        op.alter_column('restaurant_orders', 'is_takeout', nullable=False, server_default=sa.text('false'))

    # 3. Add customer_name column
    if 'customer_name' not in cols:
        op.add_column('restaurant_orders', sa.Column('customer_name', sa.String(), nullable=True))

    # 4. Add missing timestamps (created_at, updated_at) if they don't exist
    if 'created_at' not in [c['name'] for c in inspector.get_columns('restaurant_orders')]:
        op.add_column('restaurant_orders', sa.Column('created_at', sa.DateTime(), nullable=True, server_default=sa.text('now()')))
    
    if 'updated_at' not in [c['name'] for c in inspector.get_columns('restaurant_orders')]:
        op.add_column('restaurant_orders', sa.Column('updated_at', sa.DateTime(), nullable=True, server_default=sa.text('now()')))


def downgrade() -> None:
    """Downgrade schema."""
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()
    
    if 'restaurant_orders' not in tables:
        return

    cols = [c['name'] for c in inspector.get_columns('restaurant_orders')]
    if 'updated_at' in cols:
        op.drop_column('restaurant_orders', 'updated_at')
    if 'created_at' in cols:
        op.drop_column('restaurant_orders', 'created_at')
    op.drop_column('restaurant_orders', 'customer_name')
    op.drop_column('restaurant_orders', 'is_takeout')
    op.alter_column('restaurant_orders', 'table_id',
               existing_type=sa.INTEGER(),
               nullable=False)
