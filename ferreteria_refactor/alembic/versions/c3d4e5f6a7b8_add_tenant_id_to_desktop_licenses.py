"""add tenant_id column to desktop_licenses table

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-03-10

"""
from alembic import op
import sqlalchemy as sa

revision = 'c3d4e5f6a7b8'
down_revision = 'b2c3d4e5f6a7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # desktop_licenses lives in the public schema
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names(schema='public')

    # Crear tabla si no existe (puede no estar en migraciones previas en fresh DB)
    if 'desktop_licenses' not in tables:
        op.create_table(
            'desktop_licenses',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('license_key', sa.String(length=64), nullable=False),
            sa.Column('hardware_id', sa.String(length=128), nullable=True),
            sa.Column('is_active', sa.Boolean(), nullable=True, server_default='true'),
            sa.Column('activated_at', sa.DateTime(), nullable=True),
            sa.Column('expires_at', sa.DateTime(), nullable=True),
            sa.Column('tenant_id', sa.Integer(), nullable=True),
            sa.ForeignKeyConstraint(['tenant_id'], ['public.tenants.id'], ondelete='CASCADE',
                                    name='fk_desktop_licenses_tenant_id'),
            sa.PrimaryKeyConstraint('id'),
            schema='public'
        )
        op.create_index('ix_desktop_licenses_tenant_id', 'desktop_licenses', ['tenant_id'], schema='public')
        return

    existing_cols = [c['name'] for c in inspector.get_columns('desktop_licenses', schema='public')]
    if 'tenant_id' not in existing_cols:
        op.add_column(
            'desktop_licenses',
            sa.Column('tenant_id', sa.Integer(), nullable=True),
            schema='public'
        )
        op.create_foreign_key(
            'fk_desktop_licenses_tenant_id',
            'desktop_licenses',
            'tenants',
            ['tenant_id'],
            ['id'],
            source_schema='public',
            referent_schema='public',
            ondelete='CASCADE'
        )
        op.create_index(
            'ix_desktop_licenses_tenant_id',
            'desktop_licenses',
            ['tenant_id'],
            schema='public'
        )


def downgrade() -> None:
    op.drop_index('ix_desktop_licenses_tenant_id', table_name='desktop_licenses', schema='public')
    op.drop_constraint('fk_desktop_licenses_tenant_id', 'desktop_licenses', schema='public', type_='foreignkey')
    op.drop_column('desktop_licenses', 'tenant_id', schema='public')
