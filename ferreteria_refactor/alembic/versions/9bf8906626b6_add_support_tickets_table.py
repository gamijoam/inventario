"""add_support_tickets_table

Revision ID: 9bf8906626b6
Revises: 82548ed2c21a
Create Date: 2026-02-11 14:55:33.556681

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '9bf8906626b6'
down_revision: Union[str, Sequence[str], None] = '82548ed2c21a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('support_tickets',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('tenant_id', sa.Integer(), nullable=False),
    sa.Column('user_email', sa.String(), nullable=False),
    sa.Column('subject', sa.String(), nullable=False),
    sa.Column('message', sa.Text(), nullable=False),
    sa.Column('priority', sa.Enum('low', 'medium', 'high', 'critical', name='ticketpriority'), nullable=True),
    sa.Column('status', sa.Enum('open', 'in_progress', 'resolved', 'closed', name='ticketstatus'), nullable=True),
    sa.Column('admin_response', sa.Text(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.Column('updated_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['tenant_id'], ['public.tenants.id'], ),
    sa.PrimaryKeyConstraint('id'),
    schema='public'
    )
    with op.batch_alter_table('support_tickets', schema='public') as batch_op:
        batch_op.create_index(batch_op.f('ix_public_support_tickets_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_public_support_tickets_user_email'), ['user_email'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('support_tickets', schema='public') as batch_op:
        batch_op.drop_index(batch_op.f('ix_public_support_tickets_user_email'))
        batch_op.drop_index(batch_op.f('ix_public_support_tickets_id'))

    op.drop_table('support_tickets', schema='public')
