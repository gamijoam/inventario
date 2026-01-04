"""test_verify_workflow

Revision ID: f03dffc96ece
Revises: 1ab5f2bd53b1
Create Date: 2026-01-03 10:59:56.904744

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f03dffc96ece'
down_revision: Union[str, Sequence[str], None] = '1ab5f2bd53b1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - test verification."""
    conn = op.get_bind()
    from sqlalchemy import inspect
    inspector = inspect(conn)
    
    if 'test_restart_verify' not in inspector.get_table_names():
        op.create_table('test_restart_verify',
            sa.Column('id', sa.Integer, primary_key=True),
            sa.Column('status', sa.String(50), server_default="ok")
        )


def downgrade() -> None:
    """Downgrade schema."""
    conn = op.get_bind()
    from sqlalchemy import inspect
    inspector = inspect(conn)
    
    if 'test_restart_verify' in inspector.get_table_names():
        op.drop_table('test_restart_verify')
