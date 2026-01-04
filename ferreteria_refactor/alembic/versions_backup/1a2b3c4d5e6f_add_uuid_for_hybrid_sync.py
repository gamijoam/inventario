"""add_uuid_for_hybrid_sync

Revision ID: 1a2b3c4d5e6f
Revises: f152d00b510a
Create Date: 2025-12-28 17:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect
from sqlalchemy.sql import text

# revision identifiers, used by Alembic.
revision: str = '1a2b3c4d5e6f'
down_revision: Union[str, Sequence[str], None] = ('f152d00b510a', 'b1c2d3e4f5g6')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)
    
    
    # 1. Add unique_uuid column to sales
    # Using String(36) for UUID storage to be database agnostic (SQLite/Postgres)
    sales_columns = [col['name'] for col in inspector.get_columns('sales')]
    
    if 'unique_uuid' not in sales_columns:
        op.add_column('sales', sa.Column('unique_uuid', sa.String(36), nullable=True))
    
    # Update existing rows to have a UUID (optional but good practice for unique constraints)
    # For now, we leave it nullable, but future offline sales MUST have it.
    
    # 2. Add sync status columns
    # Values: 'SYNCED' (created online), 'PENDING' (created offline, waiting to upload), 'CONFLICT'
    if 'sync_status' not in sales_columns:
        op.add_column('sales', sa.Column('sync_status', sa.String(20), server_default='SYNCED', nullable=True))
    
    if 'is_offline_sale' not in sales_columns:
        op.add_column('sales', sa.Column('is_offline_sale', sa.Boolean(), server_default='FALSE', nullable=True))
    
    # 3. Add same tracking for Customers (if created offline)
    customers_columns = [col['name'] for col in inspector.get_columns('customers')]
    
    if 'unique_uuid' not in customers_columns:
        op.add_column('customers', sa.Column('unique_uuid', sa.String(36), nullable=True))
        
    if 'sync_status' not in customers_columns:
        op.add_column('customers', sa.Column('sync_status', sa.String(20), server_default='SYNCED', nullable=True))

    # Create index for faster lookups during sync
    # conn.execute(text("CREATE INDEX IF NOT EXISTS idx_sales_uuid ON sales(unique_uuid)"))

def downgrade() -> None:
    # We typically don't remove columns in production to be safe, but here is the logic
    pass
