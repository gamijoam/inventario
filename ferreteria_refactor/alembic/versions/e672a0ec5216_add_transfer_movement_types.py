"""add transfer movement types

Revision ID: e672a0ec5216
Revises: a4041786c431
Create Date: 2026-01-04 09:48:47.816944

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e672a0ec5216'
down_revision: Union[str, Sequence[str], None] = 'a4041786c431'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Manual SQL for Postgres Enum update
    op.execute("ALTER TYPE movementtype ADD VALUE 'EXTERNAL_TRANSFER_IN'")
    op.execute("ALTER TYPE movementtype ADD VALUE 'EXTERNAL_TRANSFER_OUT'")


def downgrade() -> None:
    # Removing enum values is not directly supported in Postgres/Alembic without recreation
    pass
