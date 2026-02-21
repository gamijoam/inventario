"""Merge multiple heads

Revision ID: a1d22bd99b9c
Revises: bf1dde485556
Create Date: 2026-02-20 08:17:35.864127

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1d22bd99b9c'
down_revision: Union[str, Sequence[str], None] = 'bf1dde485556'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
