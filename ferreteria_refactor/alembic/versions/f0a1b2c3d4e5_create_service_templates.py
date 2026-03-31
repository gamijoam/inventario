"""create_service_templates

Revision ID: f0a1b2c3d4e5
Revises: a3b4c5d6e7f8, e5f6a7b8c9d0, c7d8e9f0a1b2
Create Date: 2026-03-30 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'f0a1b2c3d4e5'
down_revision = ('a3b4c5d6e7f8', 'e5f6a7b8c9d0', 'c7d8e9f0a1b2')
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'service_templates',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('category', sa.String(), nullable=True),
        sa.Column('estimated_days', sa.Integer(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), nullable=True),
    )

    op.create_table(
        'service_template_items',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('template_id', sa.Integer(), sa.ForeignKey('service_templates.id'), nullable=False),
        sa.Column('description', sa.String(), nullable=False),
        sa.Column('unit_price', sa.Numeric(12, 2), nullable=False),
        sa.Column('quantity', sa.Numeric(12, 3), nullable=False, server_default='1.000'),
    )


def downgrade():
    op.drop_table('service_template_items')
    op.drop_table('service_templates')
