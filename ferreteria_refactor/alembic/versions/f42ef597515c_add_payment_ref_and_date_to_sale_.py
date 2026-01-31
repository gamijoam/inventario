"""add_payment_ref_and_date_to_sale_payments

Revision ID: f42ef597515c
Revises: 441afe556800
Create Date: 2026-01-28 18:07:55.220738

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f42ef597515c'
down_revision: Union[str, Sequence[str], None] = '441afe556800'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('sale_payments', sa.Column('reference', sa.String(), nullable=True))
    op.add_column('sale_payments', sa.Column('payment_date', sa.DateTime(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('sale_payments', 'payment_date')
    op.drop_column('sale_payments', 'reference')
