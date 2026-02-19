"""add service payments and tenant_id

Revision ID: 16a7f80b9c37
Revises: eeffd027992c
Create Date: 2026-02-18 07:44:17.123456

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy.engine.reflection import Inspector

# revision identifiers, used by Alembic.
revision = '16a7f80b9c37'
down_revision = '72cf5b064046'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Get current connection and inspector
    conn = op.get_bind()
    inspector = Inspector.from_engine(conn)
    tables = inspector.get_table_names()

    # 1. Add tenant_id to service_orders (Idempotent Check)
    if 'service_orders' in tables:
        columns = [c['name'] for c in inspector.get_columns('service_orders')]
        if 'tenant_id' not in columns:
            op.add_column('service_orders', sa.Column('tenant_id', sa.String(), nullable=True))
            op.create_index(op.f('ix_service_orders_tenant_id'), 'service_orders', ['tenant_id'], unique=False)

        # 2. Create service_payments table (Idempotent Check - Nested)
        if 'service_payments' not in tables:
            op.create_table('service_payments',
                sa.Column('id', sa.Integer(), nullable=False),
                sa.Column('tenant_id', sa.String(), nullable=True),
                sa.Column('service_order_id', sa.Integer(), nullable=False),
                sa.Column('amount', sa.Numeric(precision=18, scale=4), nullable=False),
                sa.Column('currency', sa.String(), nullable=True),
                sa.Column('payment_method', sa.String(), nullable=True),
                sa.Column('reference', sa.String(), nullable=True),
                sa.Column('created_at', sa.DateTime(), nullable=True),
                sa.ForeignKeyConstraint(['service_order_id'], ['service_orders.id'], ),
                sa.PrimaryKeyConstraint('id')
            )
            op.create_index(op.f('ix_service_payments_id'), 'service_payments', ['id'], unique=False)
            op.create_index(op.f('ix_service_payments_tenant_id'), 'service_payments', ['tenant_id'], unique=False)


def downgrade() -> None:
    # 1. Drop service_payments
    op.drop_index(op.f('ix_service_payments_tenant_id'), table_name='service_payments')
    op.drop_index(op.f('ix_service_payments_id'), table_name='service_payments')
    op.drop_table('service_payments')

    # 2. Drop tenant_id from service_orders
    op.drop_index(op.f('ix_service_orders_tenant_id'), table_name='service_orders')
    op.drop_column('service_orders', 'tenant_id')
