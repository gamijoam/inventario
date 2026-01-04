"""auto_sync_missing_columns_safe

Revision ID: e24d25b92815
Revises: fix_is_combo_v2
Create Date: 2026-01-03 16:43:06.059492

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision: str = 'e24d25b92815'
down_revision: Union[str, Sequence[str], None] = 'fix_is_combo_v2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [c['name'] for c in inspector.get_columns('products')]
    
    # Add conversion_factor if missing
    if 'conversion_factor' not in columns:
        print("[FIX] Adding missing 'conversion_factor' column to products table")
        op.add_column('products', sa.Column('conversion_factor', sa.Integer(), server_default='1', nullable=True))
    
    # Add unit_type if missing
    if 'unit_type' not in columns:
        print("[FIX] Adding missing 'unit_type' column to products table")
        op.add_column('products', sa.Column('unit_type', sa.String(), server_default='Unidad', nullable=True))

def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [c['name'] for c in inspector.get_columns('products')]
    
    if 'conversion_factor' in columns:
        op.drop_column('products', 'conversion_factor')
    
    if 'unit_type' in columns:
        op.drop_column('products', 'unit_type')
