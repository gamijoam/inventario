"""add_contact_email_to_support_tickets

Revision ID: eeffd027992c
Revises: 9bf8906626b6
Create Date: 2026-02-11 15:38:40.759808

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'eeffd027992c'
down_revision: Union[str, Sequence[str], None] = '9bf8906626b6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('support_tickets', sa.Column('contact_email', sa.String(), nullable=True), schema='public')


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('support_tickets', 'contact_email', schema='public')
