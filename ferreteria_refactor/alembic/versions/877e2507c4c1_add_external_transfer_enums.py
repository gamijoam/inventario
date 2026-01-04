"""add_external_transfer_enums

Revision ID: 877e2507c4c1
Revises: e672a0ec5216
Create Date: 2026-01-04 10:07:07.156658

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '877e2507c4c1'
down_revision: Union[str, Sequence[str], None] = 'e672a0ec5216'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # We commit the transaction first because ALTER TYPE ... ADD VALUE cannot run inside a transaction block
    op.execute("COMMIT")
    op.execute("ALTER TYPE movementtype ADD VALUE IF NOT EXISTS 'EXTERNAL_TRANSFER_OUT'")
    op.execute("ALTER TYPE movementtype ADD VALUE IF NOT EXISTS 'EXTERNAL_TRANSFER_IN'")


def downgrade() -> None:
    # Downgrading enums in Postgres is hard (requires creating new type, swapping, dropping old).
    # For now, we leave them or warn.
    pass
