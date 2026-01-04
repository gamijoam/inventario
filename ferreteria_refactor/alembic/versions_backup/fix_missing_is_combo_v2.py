"""fix missing is_combo v2

Revision ID: fix_is_combo_v2
Revises: f6a7b8c9d0e1
Create Date: 2026-01-03 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision = 'fix_is_combo_v2'
down_revision = 'f6a7b8c9d0e1'
branch_labels = None
depends_on = None

def upgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [c['name'] for c in inspector.get_columns('products')]

    if 'is_combo' not in columns:
        print("[FIX] Adding missing 'is_combo' column to products table")
        op.add_column('products', sa.Column('is_combo', sa.Boolean(), server_default='false', nullable=False))
    else:
        print("[INFO] 'is_combo' column already exists in products table")

def downgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [c['name'] for c in inspector.get_columns('products')]
    
    if 'is_combo' in columns:
        op.drop_column('products', 'is_combo')
