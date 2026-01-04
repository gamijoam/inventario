"""add description to sale details

Revision ID: ed766efe1bea
Revises: b32a26360397
Create Date: 2026-01-04 18:30:36.538811

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ed766efe1bea'
down_revision: Union[str, Sequence[str], None] = 'b32a26360397'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('sale_details', sa.Column('description', sa.String(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('sale_details', 'description')
