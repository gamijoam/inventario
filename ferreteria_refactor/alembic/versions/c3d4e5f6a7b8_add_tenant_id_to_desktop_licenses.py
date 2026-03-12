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
