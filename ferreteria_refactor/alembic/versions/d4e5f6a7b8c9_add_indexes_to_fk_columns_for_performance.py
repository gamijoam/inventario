"""add indexes to FK columns for performance

Revision ID: d4e5f6a7b8c9
Revises: c4e5f6a7b8c9
Create Date: 2026-03-09

"""
from alembic import op
from alembic import context
from typing import Union, Sequence

revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, Sequence[str], None] = 'c4e5f6a7b8c9'
branch_labels = None
depends_on = None

# These tables only exist in tenant schemas, not in public
TENANT_ONLY_TABLES = [
    'sale_payments', 'sale_details', 'cash_movements',
    'return_details',
]


def _is_public_schema() -> bool:
    """Return True when running against the public (shared) schema."""
    import os
    x_args = context.get_x_argument(as_dictionary=True)
    tenant_arg = x_args.get("tenant")
    if tenant_arg:
        return tenant_arg == "public"
    return os.getenv("ALEMBIC_SCHEMA", "public") == "public"


def upgrade():
    if _is_public_schema():
        # Tenant tables do not exist in public; nothing to do here.
        return

    # SalePayment.sale_id
    op.create_index('ix_sale_payments_sale_id', 'sale_payments', ['sale_id'], unique=False)
    # SaleDetail.sale_id
    op.create_index('ix_sale_details_sale_id', 'sale_details', ['sale_id'], unique=False)
    # SaleDetail.product_id
    op.create_index('ix_sale_details_product_id', 'sale_details', ['product_id'], unique=False)
    # CashMovement.session_id
    op.create_index('ix_cash_movements_session_id', 'cash_movements', ['session_id'], unique=False)
    # ReturnDetail.return_id
    op.create_index('ix_return_details_return_id', 'return_details', ['return_id'], unique=False)
    # ReturnDetail.product_id
    op.create_index('ix_return_details_product_id', 'return_details', ['product_id'], unique=False)


def downgrade():
    if _is_public_schema():
        return

    op.drop_index('ix_return_details_product_id', table_name='return_details')
    op.drop_index('ix_return_details_return_id', table_name='return_details')
    op.drop_index('ix_cash_movements_session_id', table_name='cash_movements')
    op.drop_index('ix_sale_details_product_id', table_name='sale_details')
    op.drop_index('ix_sale_details_sale_id', table_name='sale_details')
    op.drop_index('ix_sale_payments_sale_id', table_name='sale_payments')
