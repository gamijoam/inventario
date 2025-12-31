"""fix missing columns

Revision ID: f152d00b510a
Revises: e1b4c19ddaac
Create Date: 2025-12-28 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import text

# revision identifiers, used by Alembic.
revision: str = 'f152d00b510a'
down_revision: Union[str, Sequence[str], None] = 'e1b4c19ddaac'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    conn = op.get_bind()
    # Suppliers
    op.add_column('suppliers', sa.Column('current_balance', sa.Numeric(12, 2), server_default='0.00', nullable=True))
    op.add_column('suppliers', sa.Column('credit_limit', sa.Numeric(12, 2), nullable=True))
    op.add_column('suppliers', sa.Column('payment_terms', sa.Integer(), server_default='30', nullable=True))
    
    # Returns
    op.add_column('return_details', sa.Column('unit_price', sa.Numeric(12, 2), server_default='0.00', nullable=True))
    
    # Sale Payments
    op.add_column('sale_payments', sa.Column('exchange_rate', sa.Numeric(14, 4), server_default='1.0000', nullable=True))

def downgrade() -> None:
    pass
