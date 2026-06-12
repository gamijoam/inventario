"""add tenant scope to system messages

Revision ID: f6a7b8c9d0e1
Revises: c4e5f6a7b8c9
Create Date: 2026-06-12 12:35:00
"""
from alembic import op
import sqlalchemy as sa

revision = 'f6a7b8c9d0e1'
down_revision = 'c4e5f6a7b8c9'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_cols = [c['name'] for c in inspector.get_columns('system_messages', schema='public')]

    if 'target_tenant_schema' not in existing_cols:
        op.add_column('system_messages', sa.Column('target_tenant_schema', sa.String(length=120), nullable=True), schema='public')
    if 'created_by_user_id' not in existing_cols:
        op.add_column('system_messages', sa.Column('created_by_user_id', sa.Integer(), nullable=True), schema='public')

    indexes = [idx['name'] for idx in inspector.get_indexes('system_messages', schema='public')]
    if 'ix_public_system_messages_target_tenant_schema' not in indexes:
        op.create_index('ix_public_system_messages_target_tenant_schema', 'system_messages', ['target_tenant_schema'], schema='public')


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    indexes = [idx['name'] for idx in inspector.get_indexes('system_messages', schema='public')]
    existing_cols = [c['name'] for c in inspector.get_columns('system_messages', schema='public')]

    if 'ix_public_system_messages_target_tenant_schema' in indexes:
        op.drop_index('ix_public_system_messages_target_tenant_schema', table_name='system_messages', schema='public')
    if 'created_by_user_id' in existing_cols:
        op.drop_column('system_messages', 'created_by_user_id', schema='public')
    if 'target_tenant_schema' in existing_cols:
        op.drop_column('system_messages', 'target_tenant_schema', schema='public')
