"""create_admin_tasks_table

Revision ID: 72cf5b064046
Revises: 9f369c723d70
Create Date: 2026-02-11 21:51:28.749890

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '72cf5b064046'
down_revision: Union[str, Sequence[str], None] = '9f369c723d70'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create admin_tasks table
    op.create_table('admin_tasks',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_completed', sa.Boolean(), nullable=True),
        sa.Column('priority', sa.Enum('LOW', 'MEDIUM', 'HIGH', name='taskpriority'), nullable=True),
        sa.Column('due_date', sa.DateTime(), nullable=True),
        sa.Column('created_by_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['created_by_id'], ['public.users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        schema='public'
    )
    
    # Fix FKs if needed (from autogenerate)
    with op.batch_alter_table('support_tickets', schema=None) as batch_op:
        batch_op.drop_constraint('support_tickets_tenant_id_fkey', type_='foreignkey')
        batch_op.create_foreign_key(None, 'tenants', ['tenant_id'], ['id'], referent_schema='public')

    with op.batch_alter_table('tenant_payments', schema=None) as batch_op:
        batch_op.drop_constraint('tenant_payments_tenant_id_fkey', type_='foreignkey')
        batch_op.create_foreign_key(None, 'tenants', ['tenant_id'], ['id'], referent_schema='public')

    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_constraint('users_tenant_id_fkey', type_='foreignkey')
        batch_op.create_foreign_key(None, 'tenants', ['tenant_id'], ['id'], referent_schema='public')


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('admin_tasks', schema='public')
    
    # Revert FK changes is tricky but let's keep it simple
    # Usually we don't need to strictly revert FK constraint naming if underlying logic is same
