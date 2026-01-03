"""fix_missing_is_box

Revision ID: 9876543210ab
Revises: f03dffc96ece
Create Date: 2026-01-03 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision: str = '9876543210ab'
down_revision: Union[str, Sequence[str], None] = 'f03dffc96ece'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('products')]
    
    with op.batch_alter_table('products', schema=None) as batch_op:
        if 'is_box' not in columns:
            batch_op.add_column(sa.Column('is_box', sa.Boolean(), server_default='false', nullable=False))


def downgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('products')]
    
    with op.batch_alter_table('products', schema=None) as batch_op:
        if 'is_box' in columns:
            batch_op.drop_column('is_box')
