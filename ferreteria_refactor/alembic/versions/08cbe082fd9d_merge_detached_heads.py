"""merge_detached_heads

Revision ID: 08cbe082fd9d
Revises: 2987ca1163f6
Create Date: 2026-02-08 22:16:00.434979

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '08cbe082fd9d'
down_revision: Union[str, Sequence[str], None] = '2987ca1163f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
