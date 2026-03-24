"""create_audit_logs_table

Revision ID: c7d8e9f0a1b2
Revises: eeffd027992c
Create Date: 2026-03-23 22:30:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector

revision = 'c7d8e9f0a1b2'
down_revision = 'eeffd027992c'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = Inspector.from_engine(bind)
    tables = inspector.get_table_names(schema='public')

    if 'audit_logs' not in tables:
        op.create_table(
            'audit_logs',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=True),
            sa.Column('action', sa.String(), nullable=False),
            sa.Column('table_name', sa.String(), nullable=False),
            sa.Column('record_id', sa.Integer(), nullable=True),
            sa.Column('changes', sa.Text(), nullable=True),
            sa.Column('ip_address', sa.String(), nullable=True),
            sa.Column('timestamp', sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint('id'),
            schema='public'
        )
        op.create_index('ix_audit_logs_id', 'audit_logs', ['id'], unique=False, schema='public')
        op.create_index('ix_audit_logs_timestamp', 'audit_logs', ['timestamp'], unique=False, schema='public')


def downgrade():
    op.drop_index('ix_audit_logs_timestamp', table_name='audit_logs', schema='public')
    op.drop_index('ix_audit_logs_id', table_name='audit_logs', schema='public')
    op.drop_table('audit_logs', schema='public')
