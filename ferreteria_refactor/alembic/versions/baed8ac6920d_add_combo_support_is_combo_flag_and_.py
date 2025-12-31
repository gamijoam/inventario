"""Add combo support - is_combo flag and combo_items table

Revision ID: baed8ac6920d
Revises: 6bff1d3c8718
Create Date: 2025-12-19 18:08:14.729784

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'baed8ac6920d'
down_revision: Union[str, Sequence[str], None] = '6bff1d3c8718'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [c['name'] for c in inspector.get_columns('products')]
    
    # Add is_combo column to products table if not exists
    if 'is_combo' not in columns:
        op.add_column('products', sa.Column('is_combo', sa.Boolean(), nullable=True))
        
        # Set default value for existing products
        op.execute("UPDATE products SET is_combo = false WHERE is_combo IS NULL")
        
        # Make column non-nullable
        op.alter_column('products', 'is_combo', nullable=False, server_default='false')
    
    # Check if combo_items table exists
    tables = inspector.get_table_names()
    if 'combo_items' not in tables:
        # Create combo_items table
        op.create_table(
            'combo_items',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('parent_product_id', sa.Integer(), nullable=False),
            sa.Column('child_product_id', sa.Integer(), nullable=False),
            sa.Column('quantity', sa.Numeric(precision=12, scale=3), nullable=False, server_default='1.000'),
            sa.ForeignKeyConstraint(['parent_product_id'], ['products.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['child_product_id'], ['products.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )
        
        # Create indexes for better query performance
        op.create_index('ix_combo_items_parent', 'combo_items', ['parent_product_id'])
        op.create_index('ix_combo_items_child', 'combo_items', ['child_product_id'])


def downgrade() -> None:
    """Downgrade schema."""
    # Drop indexes
    op.drop_index('ix_combo_items_child', 'combo_items')
    op.drop_index('ix_combo_items_parent', 'combo_items')
    
    # Drop combo_items table
    op.drop_table('combo_items')
    
    # Drop is_combo column from products
    op.drop_column('products', 'is_combo')
