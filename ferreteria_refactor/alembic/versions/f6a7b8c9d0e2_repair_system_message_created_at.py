"""repair system message created_at defaults

Revision ID: f6a7b8c9d0e2
Revises: f6a7b8c9d0e1
Create Date: 2026-06-12 12:50:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = "f6a7b8c9d0e2"
down_revision = "f6a7b8c9d0e1"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("UPDATE public.system_messages SET created_at = COALESCE(starts_at, NOW()) WHERE created_at IS NULL")
    op.alter_column(
        "system_messages",
        "created_at",
        schema="public",
        existing_type=sa.DateTime(),
        server_default=sa.text("now()"),
        existing_nullable=True,
    )


def downgrade():
    op.alter_column(
        "system_messages",
        "created_at",
        schema="public",
        existing_type=sa.DateTime(),
        server_default=None,
        existing_nullable=True,
    )
