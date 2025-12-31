"""Add profit margin and discount fields to products and units

Revision ID: 20c0ded2b729
Revises: 3bf88fad26c3
Create Date: 2025-12-22 10:04:18.320706

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20c0ded2b729'
down_revision: Union[str, Sequence[str], None] = '3bf88fad26c3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add profit margin and discount fields to products and product_units tables."""
    # Add columns to products table
    op.add_column('products', sa.Column('profit_margin', sa.Numeric(precision=5, scale=2), nullable=True))
    op.add_column('products', sa.Column('discount_percentage', sa.Numeric(precision=5, scale=2), server_default='0.00', nullable=False))
    op.add_column('products', sa.Column('is_discount_active', sa.Boolean(), server_default='false', nullable=False))
    
    # Add columns to product_units table
    op.add_column('product_units', sa.Column('profit_margin', sa.Numeric(precision=5, scale=2), nullable=True))
    op.add_column('product_units', sa.Column('discount_percentage', sa.Numeric(precision=5, scale=2), server_default='0.00', nullable=False))
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

