"""add_is_superuser_to_users

Revision ID: 2987ca1163f6
Revises: 5dd93f3e147f
Create Date: 2026-02-07 17:55:06.536481

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2987ca1163f6'
down_revision: Union[str, Sequence[str], None] = '5dd93f3e147f'
branch_labels: Union[str, Sequence[str], None] = None
from sqlalchemy.engine.reflection import Inspector

def upgrade() -> None:
    """Upgrade schema."""
    # check if column exists first to avoid DuplicateColumn error
    conn = op.get_bind()
    inspector = Inspector.from_engine(conn)
    columns = [c['name'] for c in inspector.get_columns('users')]
    
    if 'is_superuser' not in columns:
        # Add is_superuser column to users table
        op.add_column('users', sa.Column('is_superuser', sa.Boolean(), nullable=False, server_default='false'))


def downgrade() -> None:
    """Downgrade schema."""
    # check if column exists before dropping
    conn = op.get_bind()
    inspector = Inspector.from_engine(conn)
    columns = [c['name'] for c in inspector.get_columns('users')]
    
    if 'is_superuser' in columns:
        # Remove is_superuser column from users table
        op.drop_column('users', 'is_superuser')
