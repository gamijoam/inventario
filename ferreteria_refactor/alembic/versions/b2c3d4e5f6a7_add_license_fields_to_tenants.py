"""add license fields to tenants table

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-03-10 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = 'b2c3d4e5f6a7'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Solo aplica al schema public (tabla tenants es global)
    # Idempotente: verifica existencia antes de agregar (compatible con fresh DB y VPS)
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing = [c['name'] for c in inspector.get_columns('tenants', schema='public')]

    if 'license_type' not in existing:
        op.add_column('tenants',
            sa.Column('license_type', sa.String(20), nullable=False, server_default='lifetime'),
            schema='public')
    if 'trial_days' not in existing:
        op.add_column('tenants',
            sa.Column('trial_days', sa.Integer(), nullable=False, server_default='15'),
            schema='public')
    if 'trial_ends_at' not in existing:
        op.add_column('tenants',
            sa.Column('trial_ends_at', sa.DateTime(), nullable=True),
            schema='public')
    if 'license_blocked_reason' not in existing:
        op.add_column('tenants',
            sa.Column('license_blocked_reason', sa.String(50), nullable=True),
            schema='public')

    # Marcar tenants existentes como lifetime (ya son clientes activos)
    op.execute("""
        UPDATE public.tenants
        SET license_type = 'lifetime'
        WHERE is_active = true
    """)


def downgrade() -> None:
    op.drop_column('tenants', 'license_blocked_reason', schema='public')
    op.drop_column('tenants', 'trial_ends_at', schema='public')
    op.drop_column('tenants', 'trial_days', schema='public')
    op.drop_column('tenants', 'license_type', schema='public')
