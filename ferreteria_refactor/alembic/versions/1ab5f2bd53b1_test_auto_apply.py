"""test_auto_apply

Revision ID: 1ab5f2bd53b1
Revises: 7459b903ac5f
Create Date: 2026-01-03 10:52:12.080653

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1ab5f2bd53b1'
down_revision: Union[str, Sequence[str], None] = '7459b903ac5f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - auto test table."""
    conn = op.get_bind()
    from sqlalchemy import inspect
    inspector = inspect(conn)
    
    if 'test_auto_table' not in inspector.get_table_names():
        op.create_table('test_auto_table',
            sa.Column('id', sa.Integer, primary_key=True),
            sa.Column('info', sa.String(50), server_default="auto_migrated"),
            sa.Column('created_at', sa.DateTime, server_default=sa.func.now())
        )


def downgrade() -> None:
    """Downgrade schema."""
    conn = op.get_bind()
    from sqlalchemy import inspect
    inspector = inspect(conn)
    if 'test_auto_table' in inspector.get_table_names():
        op.drop_table('test_auto_table')
