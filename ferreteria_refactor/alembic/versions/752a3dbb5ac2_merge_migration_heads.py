"""merge_migration_heads

Revision ID: 752a3dbb5ac2
Revises: 447215c5dc51, a551700420ae
Create Date: 2026-01-31 09:39:14.641779

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '752a3dbb5ac2'
down_revision: Union[str, Sequence[str], None] = ('447215c5dc51', 'a551700420ae')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
