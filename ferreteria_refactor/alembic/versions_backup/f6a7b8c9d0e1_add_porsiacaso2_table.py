"""add porsiacaso2 table

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-01-03 12:10:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'f6a7b8c9d0e1'
down_revision = 'e5f6a7b8c9d0'
branch_labels = None
depends_on = None


def upgrade():
    # --- Check if table exists to be idempotent ---
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()
    
    if 'porsiacaso2' not in tables:
        op.create_table('porsiacaso2',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('description', sa.String(), nullable=True),
            sa.Column('priority', sa.Integer(), server_default='1', nullable=True),
            sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
            sa.PrimaryKeyConstraint('id')
        )


def downgrade():
    op.drop_table('porsiacaso2')
