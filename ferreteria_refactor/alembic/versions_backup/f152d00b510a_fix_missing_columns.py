"""fix missing columns

Revision ID: f152d00b510a
Revises: e1b4c19ddaac
Create Date: 2025-12-28 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision: str = 'f152d00b510a'
down_revision: Union[str, Sequence[str], None] = 'e1b4c19ddaac'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    """Add missing columns (idempotent)."""
    conn = op.get_bind()
    inspector = inspect(conn)
    
    # Check suppliers table
    suppliers_columns = [col['name'] for col in inspector.get_columns('suppliers')]
    if 'current_balance' not in suppliers_columns:
        op.add_column('suppliers', sa.Column('current_balance', sa.Numeric(12, 2), server_default='0.00', nullable=True))
    if 'credit_limit' not in suppliers_columns:
        op.add_column('suppliers', sa.Column('credit_limit', sa.Numeric(12, 2), nullable=True))
    if 'payment_terms' not in suppliers_columns:
        op.add_column('suppliers', sa.Column('payment_terms', sa.Integer(), server_default='30', nullable=True))
    
    # Check return_details table
    if 'return_details' in inspector.get_table_names():
        return_details_columns = [col['name'] for col in inspector.get_columns('return_details')]
        if 'unit_price' not in return_details_columns:
            op.add_column('return_details', sa.Column('unit_price', sa.Numeric(12, 2), server_default='0.00', nullable=True))
    
    # Check sale_payments table (it might be named 'payments' in recent models but migration referred to sale_payments)
    # We check for both or skip if neither exists
    target_payment_table = None
    if 'sale_payments' in inspector.get_table_names():
        target_payment_table = 'sale_payments'
    elif 'payments' in inspector.get_table_names():
        target_payment_table = 'payments'
        
    if target_payment_table:
        cols = [col['name'] for col in inspector.get_columns(target_payment_table)]
        if 'exchange_rate' not in cols:
            op.add_column(target_payment_table, sa.Column('exchange_rate', sa.Numeric(14, 4), server_default='1.0000', nullable=True))


def downgrade() -> None:
    pass
