"""Add cost_price to product_units

Revision ID: e4c79bc471b0
Revises: 20c0ded2b729
Create Date: 2025-12-22 10:51:51.989493

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e4c79bc471b0'
down_revision: Union[str, Sequence[str], None] = '20c0ded2b729'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add cost_price column to product_units table."""
    # Safe add column
    # Not using IF NOT EXISTS because SQLite doesn't support it in ALTER TABLE
    # If the column exists, this will fail, which is fine (we'll manually stamp or it's a real issue)
    op.add_column('product_units', sa.Column('cost_price', sa.Numeric(14, 4), nullable=True))


def downgrade() -> None:
    """Remove cost_price column from product_units table."""
    op.drop_column('product_units', 'cost_price')
