"""fix_service_orders

Revision ID: 16a7f80b9c38
Revises: 16a7f80b9c37
Create Date: 2024-02-18 20:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector


# revision identifiers, used by Alembic.
revision = '16a7f80b9c38'
down_revision = '16a7f80b9c37'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = Inspector.from_engine(conn)
    tables = inspector.get_table_names()

    # This migration only affects tenant schemas (where service_orders exists)
    if 'service_orders' in tables:
        columns = [c['name'] for c in inspector.get_columns('service_orders')]
        
        # 1. Add tenant_id if missing
        if 'tenant_id' not in columns:
            op.add_column('service_orders', sa.Column('tenant_id', sa.String(), nullable=True))
            op.create_index(op.f('ix_service_orders_tenant_id_v2'), 'service_orders', ['tenant_id'], unique=False)
            
            # Backfill tenant_id with current schema name if possible, or just leave null for now
            # In multi-tenant context, we might not know the exact schema name easily here without raw SQL
            # But the app logic handles missing tenant_id gracefully or we can update later
            
        # 2. Make serial_imei nullable
        # We use alter_column to drop NOT NULL constraint
        op.alter_column('service_orders', 'serial_imei',
               existing_type=sa.VARCHAR(),
               nullable=True)


def downgrade() -> None:
    conn = op.get_bind()
    inspector = Inspector.from_engine(conn)
    tables = inspector.get_table_names()

    if 'service_orders' in tables:
         # Revert: Make serial_imei NOT NULL again (Warning: Check for nulls first!)
         # op.alter_column('service_orders', 'serial_imei', nullable=False) # Risky without cleanup
         
         # Revert: Drop tenant_id
         columns = [c['name'] for c in inspector.get_columns('service_orders')]
         if 'tenant_id' in columns:
             op.drop_index(op.f('ix_service_orders_tenant_id_v2'), table_name='service_orders')
             op.drop_column('service_orders', 'tenant_id')
