"""add_onboarding_completed_to_user

Revision ID: 9f369c723d70
Revises: eeffd027992c
Create Date: 2026-02-11 20:14:19.818158

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9f369c723d70'
down_revision: Union[str, Sequence[str], None] = 'eeffd027992c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add is_onboarding_completed column to users table in public schema
    op.add_column('users', sa.Column('is_onboarding_completed', sa.Boolean(), nullable=True, server_default=sa.text('false')), schema='public')


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('users', 'is_onboarding_completed', schema='public')
