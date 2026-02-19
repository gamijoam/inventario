"""create_warranty_tables

Revision ID: 333333333333
Revises: f123456789ac
Create Date: 2026-02-19 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '333333333333'
down_revision = 'f123456789ac'  # Points to the merge point
branch_labels = None
depends_on = None


def upgrade():
    # Get current connection and inspector
    conn = op.get_bind()
    from sqlalchemy.engine.reflection import Inspector
    inspector = Inspector.from_engine(conn)
    tables = inspector.get_table_names()

    # 1. Create warranty_policies table (Only if it doesn't exist, and ideally only in tenant schemas)
    if 'warranty_policies' not in tables:
        # We also check if we are meant to be here. 
        # If 'products' exists, it's likely a tenant schema.
        # If 'products' does NOT exist, it's likely public or empty.
        # Let's use 'products' existence as a proxy for "Is this a tenant schema?"
        if 'products' in tables:
            op.create_table(
                'warranty_policies',
                sa.Column('id', sa.Integer(), nullable=False),
                sa.Column('tenant_id', sa.Integer(), nullable=False),  # Tenant specific
                sa.Column('name', sa.String(length=100), nullable=False),
                sa.Column('type', sa.String(length=20), nullable=False), # 'DAYS', 'MONTHS', 'YEARS', 'LIFETIME'
                sa.Column('duration', sa.Integer(), nullable=True), # e.g. 30, 12, 1. Null for LIFETIME
                sa.Column('description', sa.Text(), nullable=True),
                sa.Column('is_default', sa.Boolean(), default=False),
                sa.Column('is_active', sa.Boolean(), default=True),
                sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
                sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
                sa.ForeignKeyConstraint(['tenant_id'], ['public.tenants.id'], ),
                sa.PrimaryKeyConstraint('id')
            )
            op.create_index(op.f('ix_warranty_policies_id'), 'warranty_policies', ['id'], unique=False)
            op.create_index(op.f('ix_warranty_policies_tenant_id'), 'warranty_policies', ['tenant_id'], unique=False)

    # 2. Add warranty_policy_id to products table
    if 'products' in tables:
        # Check if column already exists to be idempotent
        columns = [c['name'] for c in inspector.get_columns('products')]
        if 'warranty_policy_id' not in columns:
            with op.batch_alter_table('products', schema=None) as batch_op:
                batch_op.add_column(sa.Column('warranty_policy_id', sa.Integer(), nullable=True))
                batch_op.create_foreign_key(None, 'warranty_policies', ['warranty_policy_id'], ['id'])

    # 3. Create warranty_claims table
    if 'warranty_claims' not in tables and 'products' in tables:
        op.create_table(
            'warranty_claims',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('tenant_id', sa.Integer(), nullable=False),
            sa.Column('sale_item_id', sa.Integer(), nullable=False), # Link to specific item sold
            sa.Column('customer_id', sa.Integer(), nullable=False),
            sa.Column('policy_snapshot', sa.JSON(), nullable=True), # Store policy details at time of claim
            sa.Column('status', sa.String(length=20), server_default='PENDING', nullable=False), # PENDING, APPROVED, REJECTED, COMPLETED
            sa.Column('reason', sa.Text(), nullable=False), # Customer's reason
            sa.Column('diagnosis', sa.Text(), nullable=True), # Technician's diagnosis
            sa.Column('resolution_type', sa.String(length=20), nullable=True), # REFUND, REPLACE, REPAIR, CREDIT
            sa.Column('resolution_notes', sa.Text(), nullable=True),
            sa.Column('claimed_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
            sa.Column('resolved_at', sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(['tenant_id'], ['public.tenants.id'], ),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_warranty_claims_id'), 'warranty_claims', ['id'], unique=False)
        op.create_index(op.f('ix_warranty_claims_tenant_id'), 'warranty_claims', ['tenant_id'], unique=False)


def downgrade():
    # Only try to drop if they exist
    conn = op.get_bind()
    from sqlalchemy.engine.reflection import Inspector
    inspector = Inspector.from_engine(conn)
    tables = inspector.get_table_names()

    if 'warranty_claims' in tables:
        op.drop_table('warranty_claims')
    
    if 'products' in tables:
        columns = [c['name'] for c in inspector.get_columns('products')]
        if 'warranty_policy_id' in columns:
            with op.batch_alter_table('products', schema=None) as batch_op:
                batch_op.drop_constraint(None, type_='foreignkey')
                batch_op.drop_column('warranty_policy_id')
    
    if 'warranty_policies' in tables:
        op.drop_table('warranty_policies')
