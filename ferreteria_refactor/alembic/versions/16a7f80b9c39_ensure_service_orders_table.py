"""ensure_service_orders_table_exists

Revision ID: 16a7f80b9c39
Revises: 16a7f80b9c38
Create Date: 2026-02-18 09:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy.engine.reflection import Inspector

# revision identifiers, used by Alembic.
revision = '16a7f80b9c39'
down_revision = '16a7f80b9c38'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Get current connection and inspector
    conn = op.get_bind()
    inspector = Inspector.from_engine(conn)
    tables = inspector.get_table_names()

    # Create service_orders if missing AND customers exists (to avoid running in 'public' schema)
    if 'service_orders' not in tables and 'customers' in tables:
        op.create_table('service_orders',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('ticket_number', sa.String(), nullable=False),
            sa.Column('tenant_id', sa.String(), nullable=True),
            sa.Column('customer_id', sa.Integer(), nullable=False),
            sa.Column('technician_id', sa.Integer(), nullable=True),
            sa.Column('status', sa.Enum('RECEIVED', 'DIAGNOSIS', 'WAITING_APPROVAL', 'APPROVED', 'IN_PROGRESS', 'WAITING_PARTS', 'COMPLETED', 'DELIVERED', 'CANCELLED', name='serviceorderstatus'), nullable=True),
            sa.Column('service_type', sa.Enum('REPAIR', 'MAINTENANCE', 'INSTALLATION', 'WARRANTY', 'OTHER', name='servicetype'), nullable=True),
            sa.Column('priority', sa.Enum('LOW', 'NORMAL', 'HIGH', 'URGENT', name='servicepriority'), nullable=True),
            sa.Column('device_type', sa.String(), nullable=True),
            sa.Column('brand', sa.String(), nullable=True),
            sa.Column('model', sa.String(), nullable=True),
            sa.Column('serial_imei', sa.String(), nullable=True),
            sa.Column('passcode_pattern', sa.Text(), nullable=True),
            sa.Column('problem_description', sa.Text(), nullable=True),
            sa.Column('physical_condition', sa.Text(), nullable=True),
            sa.Column('diagnosis_notes', sa.Text(), nullable=True),
            sa.Column('order_metadata', sa.JSON(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
            sa.Column('estimated_delivery', sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(['customer_id'], ['customers.id'], ),
            sa.ForeignKeyConstraint(['technician_id'], ['public.users.id'], ),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_service_orders_id'), 'service_orders', ['id'], unique=False)
        op.create_index(op.f('ix_service_orders_serial_imei'), 'service_orders', ['serial_imei'], unique=False)
        op.create_index(op.f('ix_service_orders_tenant_id'), 'service_orders', ['tenant_id'], unique=False)
        op.create_index(op.f('ix_service_orders_ticket_number'), 'service_orders', ['ticket_number'], unique=True)

    # Create service_order_details if missing AND customers exists (meaning not public)
    if 'service_order_details' not in tables and 'customers' in tables:
        op.create_table('service_order_details',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('service_order_id', sa.Integer(), nullable=False),
            sa.Column('product_id', sa.Integer(), nullable=True),
            sa.Column('description', sa.String(), nullable=True),
            sa.Column('is_manual', sa.Boolean(), nullable=True),
            sa.Column('observations', sa.String(), nullable=True),
            sa.Column('quantity', sa.Numeric(precision=12, scale=3), nullable=True),
            sa.Column('unit_price', sa.Numeric(precision=12, scale=2), nullable=False),
            sa.Column('cost', sa.Numeric(precision=14, scale=4), nullable=True),
            sa.Column('technician_id', sa.Integer(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(['product_id'], ['products.id'], ),
            sa.ForeignKeyConstraint(['service_order_id'], ['service_orders.id'], ),
            sa.ForeignKeyConstraint(['technician_id'], ['public.users.id'], ),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_service_order_details_id'), 'service_order_details', ['id'], unique=False)

def downgrade() -> None:
    # We generally don't drop tables in downgrade for safety, or we could if consistent.
    # For now, let's allow it to drop if we added it.
    conn = op.get_bind()
    inspector = Inspector.from_engine(conn)
    tables = inspector.get_table_names()
    
    if 'service_order_details' in tables:
        op.drop_index(op.f('ix_service_order_details_id'), table_name='service_order_details')
        op.drop_table('service_order_details')
        
    if 'service_orders' in tables:
        op.drop_index(op.f('ix_service_orders_ticket_number'), table_name='service_orders')
        op.drop_index(op.f('ix_service_orders_tenant_id'), table_name='service_orders')
        op.drop_index(op.f('ix_service_orders_serial_imei'), table_name='service_orders')
        op.drop_index(op.f('ix_service_orders_id'), table_name='service_orders')
        op.drop_table('service_orders')
