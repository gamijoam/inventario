"""add message_type and version_tag to system_messages

Revision ID: c4e5f6a7b8c9
Revises: e2f1a9b2d3c4
Create Date: 2026-03-06 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector


# revision identifiers, used by Alembic.
revision: str = 'c4e5f6a7b8c9'
down_revision: Union[str, Sequence[str], None] = 'e2f1a9b2d3c4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add message_type and version_tag to public.system_messages."""
    conn = op.get_bind()
    inspector = Inspector.from_engine(conn)

    existing_cols = [c['name'] for c in inspector.get_columns('system_messages', schema='public')]

    # message_type: 'banner' (default, current behavior) | 'announcement' (new modal)
    if 'message_type' not in existing_cols:
        op.add_column(
            'system_messages',
            sa.Column('message_type', sa.String(20), nullable=False, server_default='banner'),
            schema='public'
        )

    # version_tag: optional label shown in modal header, e.g. "v2.5"
    if 'version_tag' not in existing_cols:
        op.add_column(
            'system_messages',
            sa.Column('version_tag', sa.String(20), nullable=True),
            schema='public'
        )


def downgrade() -> None:
    """Remove message_type and version_tag from public.system_messages."""
    op.drop_column('system_messages', 'version_tag', schema='public')
    op.drop_column('system_messages', 'message_type', schema='public')
