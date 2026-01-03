"""Add profit margin and discount fields to products and units

Revision ID: 20c0ded2b729
Revises: 3bf88fad26c3
Create Date: 2025-12-22 10:04:18.320706

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision: str = '20c0ded2b729'
down_revision: Union[str, Sequence[str], None] = '3bf88fad26c3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add profit margin and discount fields to products and product_units tables."""
    # Get connection and inspector
    conn = op.get_bind()
    inspector = inspect(conn)
    
    # Get existing columns for products table
    products_columns = [col['name'] for col in inspector.get_columns('products')]
    
    # Add columns to products table only if they don't exist
    if 'profit_margin' not in products_columns:
        op.add_column('products', sa.Column('profit_margin', sa.Numeric(precision=5, scale=2), nullable=True))
    if 'discount_percentage' not in products_columns:
        op.add_column('products', sa.Column('discount_percentage', sa.Numeric(precision=5, scale=2), server_default='0.00', nullable=False))
    if 'is_discount_active' not in products_columns:
        op.add_column('products', sa.Column('is_discount_active', sa.Boolean(), server_default='false', nullable=False))
    
    # Get existing columns for product_units table
    units_columns = [col['name'] for col in inspector.get_columns('product_units')]
    
    # Add columns to product_units table only if they don't exist
    if 'profit_margin' not in units_columns:
        op.add_column('product_units', sa.Column('profit_margin', sa.Numeric(precision=5, scale=2), nullable=True))
    if 'discount_percentage' not in units_columns:
        op.add_column('product_units', sa.Column('discount_percentage', sa.Numeric(precision=5, scale=2), server_default='0.00', nullable=False))
    if 'is_discount_active' not in units_columns:
        op.add_column('product_units', sa.Column('is_discount_active', sa.Boolean(), server_default='false', nullable=False))


def downgrade() -> None:
    """Remove profit margin and discount fields from products and product_units tables."""
    # Remove columns from product_units table
    op.drop_column('product_units', 'is_discount_active')
    op.drop_column('product_units', 'discount_percentage')
    op.drop_column('product_units', 'profit_margin')
    
    # Remove columns from products table
    op.drop_column('products', 'is_discount_active')
    op.drop_column('products', 'discount_percentage')
    op.drop_column('products', 'profit_margin')

