"""add missing fk indexes for performance

Revision ID: a1b2c3d4e5f6
Revises: d4e5f6a7b8c9
Create Date: 2026-03-10 00:00:00.000000

"""
from alembic import op
from alembic import context
import sqlalchemy as sa
import os

revision = 'a1b2c3d4e5f6'
down_revision = 'd4e5f6a7b8c9'
branch_labels = None
depends_on = None


def _is_public_schema() -> bool:
    """Return True when running against the public (shared) schema."""
    x_args = context.get_x_argument(as_dictionary=True)
    tenant_arg = x_args.get("tenant")
    if tenant_arg:
        return tenant_arg == "public"
    return os.getenv("ALEMBIC_SCHEMA", "public") == "public"


def upgrade() -> None:
    # Estos índices se crean en cada schema de tenant.
    # En el schema public no existen estas tablas, se omite.
    if _is_public_schema():
        return

    # sales table
    op.create_index('ix_sales_customer_id', 'sales', ['customer_id'], unique=False)
    op.create_index('ix_sales_session_id', 'sales', ['session_id'], unique=False)

    # products table
    op.create_index('ix_products_supplier_id', 'products', ['supplier_id'], unique=False)
    op.create_index('ix_products_category_id', 'products', ['category_id'], unique=False)

    # kardex table
    op.create_index('ix_kardex_product_id', 'kardex', ['product_id'], unique=False)
    op.create_index('ix_kardex_warehouse_id', 'kardex', ['warehouse_id'], unique=False)

    # product_stocks table (nombre real de la tabla: product_stocks)
    op.create_index('ix_product_stocks_product_id', 'product_stocks', ['product_id'], unique=False)
    op.create_index('ix_product_stocks_warehouse_id', 'product_stocks', ['warehouse_id'], unique=False)


def downgrade() -> None:
    if _is_public_schema():
        return

    op.drop_index('ix_product_stocks_warehouse_id', table_name='product_stocks')
    op.drop_index('ix_product_stocks_product_id', table_name='product_stocks')
    op.drop_index('ix_kardex_warehouse_id', table_name='kardex')
    op.drop_index('ix_kardex_product_id', table_name='kardex')
    op.drop_index('ix_products_category_id', table_name='products')
    op.drop_index('ix_products_supplier_id', table_name='products')
    op.drop_index('ix_sales_session_id', table_name='sales')
    op.drop_index('ix_sales_customer_id', table_name='sales')
