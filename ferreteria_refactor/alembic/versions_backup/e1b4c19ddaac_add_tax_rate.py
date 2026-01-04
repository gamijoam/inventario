"""add tax_rate

Revision ID: e1b4c19ddaac
Revises: e4c79bc471b0
Create Date: 2025-12-26 19:24:39.862333

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision: str = 'e1b4c19ddaac'
down_revision: Union[str, Sequence[str], None] = 'e4c79bc471b0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add tax_rate column (idempotent)."""
    conn = op.get_bind()
    inspector = inspect(conn)
    
    # Check products table
    products_columns = [col['name'] for col in inspector.get_columns('products')]
    if 'tax_rate' not in products_columns:
        op.add_column('products', sa.Column('tax_rate', sa.Numeric(5, 2), nullable=True))
    
    # Check sale_details table
    sale_details_columns = [col['name'] for col in inspector.get_columns('sale_details')]
    if 'tax_rate' not in sale_details_columns:
        op.add_column('sale_details', sa.Column('tax_rate', sa.Numeric(5, 2), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('sale_details', 'tax_rate')
    op.drop_column('products', 'tax_rate')
