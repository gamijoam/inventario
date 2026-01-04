"""fix_sales_date

Revision ID: c2d3e4f5a6b7
Revises: 9876543210ab
Create Date: 2026-01-03 12:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision: str = 'c2d3e4f5a6b7'
down_revision: Union[str, Sequence[str], None] = '9876543210ab'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('sales')]
    
    with op.batch_alter_table('sales', schema=None) as batch_op:
        if 'created_at' in columns and 'date' not in columns:
            batch_op.alter_column('created_at', new_column_name='date')
        elif 'date' not in columns:
            # Fallback if created_at is also missing (unlikely)
            batch_op.add_column(sa.Column('date', sa.DateTime(), nullable=True))


def downgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('sales')]
    
    with op.batch_alter_table('sales', schema=None) as batch_op:
        if 'date' in columns:
            batch_op.alter_column('date', new_column_name='created_at')
