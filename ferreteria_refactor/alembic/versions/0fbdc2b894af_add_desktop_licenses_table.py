"""add desktop_licenses table

Revision ID: 0fbdc2b894af
Revises: e2f1a9b2d3c4
Create Date: 2026-03-05

Tabla public.desktop_licenses para gestionar licencias del producto Invensoft Desktop.
"""
from alembic import op
import sqlalchemy as sa

revision = '0fbdc2b894af'
down_revision = 'e2f1a9b2d3c4'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'desktop_licenses',
        sa.Column('id',          sa.Integer(),     primary_key=True),
        sa.Column('license_key', sa.String(20),    nullable=False, unique=True),
        sa.Column('plan_name',   sa.String(50),    nullable=False, server_default='basic'),

        # Módulos
        sa.Column('has_restaurant_module', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('has_laundry_module',    sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('has_hardware_module',   sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('has_services_module',   sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('has_barbershop_module', sa.Boolean(), nullable=False, server_default='false'),

        # Control
        sa.Column('max_devices',       sa.Integer(), nullable=False, server_default='1'),
        sa.Column('activations_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('expires_at',        sa.DateTime(), nullable=True),
        sa.Column('is_active',         sa.Boolean(), nullable=False, server_default='true'),

        # Datos cliente
        sa.Column('customer_name',  sa.String(200), nullable=True),
        sa.Column('customer_email', sa.String(200), nullable=True),
        sa.Column('notes',          sa.Text(),      nullable=True),

        # Auditoría
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(),
                  onupdate=sa.func.now()),

        schema='public',
    )
    op.create_index('ix_desktop_licenses_license_key', 'desktop_licenses',
                    ['license_key'], schema='public')


def downgrade() -> None:
    op.drop_index('ix_desktop_licenses_license_key', table_name='desktop_licenses',
                  schema='public')
    op.drop_table('desktop_licenses', schema='public')
