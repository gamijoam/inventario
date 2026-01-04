"""Add cost_price to product_units

Revision ID: e4c79bc471b0
Revises: 20c0ded2b729
Create Date: 2025-12-22 10:04:18.320706

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision: str = 'e4c79bc471b0'
down_revision: Union[str, None] = '20c0ded2b729'  # FIXED: Correct parent
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None



def upgrade() -> None:
    """Add cost_price column to product_units table (idempotent)."""
    # Get connection and inspector
    conn = op.get_bind()
    inspector = inspect(conn)
    
    # Get existing columns
    columns = [col['name'] for col in inspector.get_columns('product_units')]
    
    # Add column only if it doesn't exist
    if 'cost_price' not in columns:
        op.add_column('product_units', sa.Column('cost_price', sa.Numeric(14, 4), nullable=True))


def downgrade() -> None:
    """Remove cost_price column from product_units table."""
    op.drop_column('product_units', 'cost_price')
