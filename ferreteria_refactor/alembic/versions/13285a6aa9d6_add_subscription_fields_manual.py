"""add_subscription_fields_manual

Revision ID: 13285a6aa9d6
Revises: 08cbe082fd9d
Create Date: 2026-02-08 22:17:38.632407

"""
from typing import Sequence, Union

from alembic import op, context
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector


# revision identifiers, used by Alembic.
revision: str = '13285a6aa9d6'
down_revision: Union[str, Sequence[str], None] = '08cbe082fd9d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Check if we are running for a specific TENANT (from -x tenant=schema)
    x_args = context.get_x_argument(as_dictionary=True)
    if x_args.get("tenant"):
        # We are migrating a tenant schema, but 'tenants' table is Shared (Public).
        # We should NOT modify it here.
        # This allows the migration to be marked as "done" in the tenant's history without error.
        print("Skipping shared table migration for tenant schema.")
        return

    # 2. Idempotency check for PUBLIC execution (just in case)
    conn = op.get_bind()
    inspector = Inspector.from_engine(conn)
    # Check if table exists first (optional, safer)
    if 'tenants' in inspector.get_table_names():
        columns = [c['name'] for c in inspector.get_columns('tenants')]
        
        if 'is_demo' not in columns:
            op.add_column('tenants', sa.Column('is_demo', sa.Boolean(), server_default='true', nullable=False))
            print("Added is_demo column to tenants.")
            
        if 'subscription_expires_at' not in columns:
            op.add_column('tenants', sa.Column('subscription_expires_at', sa.DateTime(), nullable=True))
            print("Added subscription_expires_at column to tenants.")
    else:
        print("Warning: tenants table not found in public schema.")


def downgrade() -> None:
    # Also skip for tenants
    x_args = context.get_x_argument(as_dictionary=True)
    if x_args.get("tenant"):
        return

    # We assume public schema here
    conn = op.get_bind()
    inspector = Inspector.from_engine(conn)
    if 'tenants' in inspector.get_table_names():
        columns = [c['name'] for c in inspector.get_columns('tenants')]
        
        if 'is_demo' in columns:
            op.drop_column('tenants', 'is_demo')
        
        if 'subscription_expires_at' in columns:
            op.drop_column('tenants', 'subscription_expires_at')
