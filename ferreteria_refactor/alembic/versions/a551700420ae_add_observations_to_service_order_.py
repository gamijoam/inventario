"""add_observations_to_service_order_details

Revision ID: a551700420ae
Revises: 50263d95b935
Create Date: 2026-01-30 18:28:19.916980

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a551700420ae'
down_revision: Union[str, Sequence[str], None] = '50263d95b935'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add observations column to service_order_details table
    op.add_column('service_order_details', sa.Column('observations', sa.String(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    # Remove observations column from service_order_details table
    op.drop_column('service_order_details', 'observations')
