"""Initial_migration

Revision ID: 3a1b7ff040a1
Revises: 
Create Date: 2025-12-19 10:49:25.731105

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision: str = '3a1b7ff040a1'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema. Create all base tables safely."""
    conn = op.get_bind()
    inspector = inspect(conn)
    tables = inspector.get_table_names()

    # --- 1. USERS ---
    if 'users' not in tables:
        op.create_table('users',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('username', sa.String(length=50), nullable=False),
            sa.Column('password_hash', sa.String(length=200), nullable=False),
            sa.Column('pin', sa.String(length=10), nullable=True),
            sa.Column('role', sa.Enum('ADMIN', 'CASHIER', 'WAREHOUSE', 'WAITER', 'KITCHEN', name='userrole'), nullable=False),
            sa.Column('full_name', sa.String(length=100), nullable=True),
            sa.Column('is_active', sa.Boolean(), server_default='true', nullable=True),
            sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('username')
        )

    # --- 2. CATEGORIES ---
    if 'categories' not in tables:
        op.create_table('categories',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('name', sa.String(), nullable=False),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('parent_id', sa.Integer(), nullable=True),
            sa.ForeignKeyConstraint(['parent_id'], ['categories.id'], ),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_categories_name'), 'categories', ['name'], unique=True)

    # --- 3. SUPPLIERS ---
    if 'suppliers' not in tables:
        op.create_table('suppliers',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('name', sa.String(), nullable=False),
            sa.Column('contact_person', sa.String(), nullable=True),
            sa.Column('phone', sa.String(), nullable=True),
            sa.Column('email', sa.String(), nullable=True),
            sa.Column('address', sa.Text(), nullable=True),
            sa.Column('notes', sa.Text(), nullable=True),
            sa.Column('is_active', sa.Boolean(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('current_balance', sa.Numeric(precision=12, scale=2), nullable=True),
            sa.Column('credit_limit', sa.Numeric(precision=12, scale=2), nullable=True),
            sa.Column('payment_terms', sa.Integer(), nullable=True),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_suppliers_name'), 'suppliers', ['name'], unique=True)

    # --- 4. EXCHANGE RATES ---
    if 'exchange_rates' not in tables:
        op.create_table('exchange_rates',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('name', sa.String(), nullable=False),
            sa.Column('currency_code', sa.String(), nullable=False),
            sa.Column('currency_symbol', sa.String(), nullable=False),
            sa.Column('rate', sa.Numeric(precision=14, scale=4), nullable=False),
            sa.Column('is_default', sa.Boolean(), nullable=True),
            sa.Column('is_active', sa.Boolean(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_exchange_rates_id'), 'exchange_rates', ['id'], unique=False)

    # --- 5. PRODUCTS ---
    if 'products' not in tables:
        op.create_table('products',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('name', sa.String(), nullable=False),
            sa.Column('sku', sa.String(), nullable=True),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('price', sa.Numeric(precision=12, scale=2), nullable=False),
            sa.Column('price_mayor_1', sa.Numeric(precision=12, scale=2), nullable=True),
            sa.Column('price_mayor_2', sa.Numeric(precision=12, scale=2), nullable=True),
            sa.Column('cost_price', sa.Numeric(precision=14, scale=4), nullable=True),
            sa.Column('profit_margin', sa.Numeric(precision=5, scale=2), nullable=True),
            sa.Column('discount_percentage', sa.Numeric(precision=5, scale=2), nullable=True),
            sa.Column('is_discount_active', sa.Boolean(), nullable=True),
            sa.Column('tax_rate', sa.Numeric(precision=5, scale=2), nullable=True),
            sa.Column('stock', sa.Numeric(precision=12, scale=3), nullable=True),
            sa.Column('min_stock', sa.Numeric(precision=12, scale=3), nullable=True),
            sa.Column('is_active', sa.Boolean(), nullable=True),
            sa.Column('is_combo', sa.Boolean(), server_default='false', nullable=False),
            sa.Column('category_id', sa.Integer(), nullable=True),
            sa.Column('supplier_id', sa.Integer(), nullable=True),
            sa.Column('exchange_rate_id', sa.Integer(), nullable=True),
            sa.Column('image_url', sa.String(length=255), nullable=True),
            sa.Column('updated_at', sa.TIMESTAMP(), server_default=sa.func.now(), nullable=True),
            sa.ForeignKeyConstraint(['category_id'], ['categories.id'], ),
            sa.ForeignKeyConstraint(['exchange_rate_id'], ['exchange_rates.id'], ),
            sa.ForeignKeyConstraint(['supplier_id'], ['suppliers.id'], ),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_products_name'), 'products', ['name'], unique=False)
        op.create_index(op.f('ix_products_sku'), 'products', ['sku'], unique=True)

    # --- 6. CUSTOMERS ---
    if 'customers' not in tables:
        op.create_table('customers',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('name', sa.String(), nullable=False),
            sa.Column('id_number', sa.String(), nullable=False),
            sa.Column('email', sa.String(), nullable=True),
            sa.Column('phone', sa.String(), nullable=True),
            sa.Column('address', sa.Text(), nullable=True),
            sa.Column('credit_limit', sa.Numeric(precision=12, scale=2), nullable=True),
            sa.Column('current_debt', sa.Numeric(precision=12, scale=2), nullable=True),
            sa.Column('payment_term_days', sa.Integer(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_customers_id_number'), 'customers', ['id_number'], unique=True)

    # --- 7. SALES & DETAILS ---
    if 'sales' not in tables:
        op.create_table('sales',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('customer_id', sa.Integer(), nullable=True),
            sa.Column('user_id', sa.Integer(), nullable=True),
            sa.Column('total_amount_usd', sa.Numeric(precision=12, scale=2), nullable=False),
            sa.Column('total_amount_ves', sa.Numeric(precision=12, scale=2), nullable=False),
            sa.Column('exchange_rate', sa.Numeric(precision=14, scale=4), nullable=False),
            sa.Column('payment_method', sa.String(), nullable=True),
            sa.Column('status', sa.Enum('PENDING', 'PAID', 'CANCELLED', 'REFUNDED', name='salestatus'), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('notes', sa.Text(), nullable=True),
            sa.ForeignKeyConstraint(['customer_id'], ['customers.id'], ),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
            sa.PrimaryKeyConstraint('id')
        )

    if 'sale_details' not in tables:
        op.create_table('sale_details',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('sale_id', sa.Integer(), nullable=False),
            sa.Column('product_id', sa.Integer(), nullable=False),
            sa.Column('quantity', sa.Numeric(precision=12, scale=3), nullable=False),
            sa.Column('unit_price_usd', sa.Numeric(precision=12, scale=2), nullable=False),
            sa.Column('subtotal_usd', sa.Numeric(precision=12, scale=2), nullable=False),
            sa.Column('product_name', sa.String(), nullable=True),
            sa.Column('tax_rate', sa.Numeric(precision=5, scale=2), nullable=True),
            sa.ForeignKeyConstraint(['product_id'], ['products.id'], ),
            sa.ForeignKeyConstraint(['sale_id'], ['sales.id'], ),
            sa.PrimaryKeyConstraint('id')
        )

    # --- 8. PRODUCT UNITS ---
    if 'product_units' not in tables:
        op.create_table('product_units',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('product_id', sa.Integer(), nullable=False),
            sa.Column('unit_name', sa.String(), nullable=False),
            sa.Column('conversion_factor', sa.Numeric(precision=12, scale=3), nullable=False),
            sa.Column('barcode', sa.String(), nullable=True),
            sa.Column('price_usd', sa.Numeric(precision=12, scale=2), nullable=True),
            sa.Column('cost_price', sa.Numeric(precision=14, scale=4), nullable=True),
            sa.Column('profit_margin', sa.Numeric(precision=5, scale=2), nullable=True),
            sa.Column('is_default', sa.Boolean(), nullable=True),
            sa.Column('is_active', sa.Boolean(), nullable=True),
            sa.Column('exchange_rate_id', sa.Integer(), nullable=True),
            sa.ForeignKeyConstraint(['exchange_rate_id'], ['exchange_rates.id'], ),
            sa.ForeignKeyConstraint(['product_id'], ['products.id'], ),
            sa.PrimaryKeyConstraint('id')
        )

    # --- 9. RETURNS ---
    if 'returns' not in tables:
        op.create_table('returns',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('sale_id', sa.Integer(), nullable=False),
            sa.Column('date', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
            sa.Column('reason', sa.Text(), nullable=True),
            sa.ForeignKeyConstraint(['sale_id'], ['sales.id'], ),
            sa.PrimaryKeyConstraint('id')
        )

    if 'return_details' not in tables:
        op.create_table('return_details',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('return_id', sa.Integer(), nullable=False),
            sa.Column('product_id', sa.Integer(), nullable=False),
            sa.Column('quantity', sa.Numeric(precision=12, scale=3), nullable=False),
            sa.Column('unit_price', sa.Numeric(precision=12, scale=2), server_default='0.00', nullable=True),
            sa.Column('unit_cost', sa.Numeric(precision=14, scale=4), server_default='0.0000', nullable=True),
            sa.ForeignKeyConstraint(['product_id'], ['products.id'], ),
            sa.ForeignKeyConstraint(['return_id'], ['returns.id'], ),
            sa.PrimaryKeyConstraint('id')
        )

    # --- 10. PAYMENTS & METHODS ---
    if 'payment_methods' not in tables:
        op.create_table('payment_methods',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('name', sa.String(), nullable=False),
            sa.Column('is_active', sa.Boolean(), nullable=True),
            sa.Column('is_system', sa.Boolean(), nullable=True),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('name')
        )

    if 'payments' not in tables:
        op.create_table('payments',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('customer_id', sa.Integer(), nullable=False),
            sa.Column('amount', sa.Numeric(precision=12, scale=2), nullable=False),
            sa.Column('date', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('currency', sa.String(), server_default='USD', nullable=True),
            sa.Column('exchange_rate_used', sa.Numeric(precision=14, scale=4), server_default='1.0000', nullable=True),
            sa.Column('amount_bs', sa.Numeric(precision=12, scale=2), nullable=True),
            sa.Column('payment_method', sa.String(), server_default='Efectivo', nullable=True),
            sa.ForeignKeyConstraint(['customer_id'], ['customers.id'], ),
            sa.PrimaryKeyConstraint('id')
        )

    # --- 11. WAREHOUSES & STOCKS ---
    if 'warehouses' not in tables:
        op.create_table('warehouses',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('name', sa.String(), nullable=False),
            sa.Column('address', sa.String(), nullable=True),
            sa.Column('is_active', sa.Boolean(), nullable=True),
            sa.Column('is_main', sa.Boolean(), nullable=True),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_warehouses_name'), 'warehouses', ['name'], unique=True)

    if 'product_stocks' not in tables:
        op.create_table('product_stocks',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('product_id', sa.Integer(), nullable=False),
            sa.Column('warehouse_id', sa.Integer(), nullable=False),
            sa.Column('quantity', sa.Numeric(precision=12, scale=3), server_default='0.000', nullable=True),
            sa.Column('location', sa.String(), nullable=True),
            sa.ForeignKeyConstraint(['product_id'], ['products.id'], ),
            sa.ForeignKeyConstraint(['warehouse_id'], ['warehouses.id'], ),
            sa.PrimaryKeyConstraint('id')
        )

    # --- 12. KARDEX ---
    if 'kardex' not in tables:
        op.create_table('kardex',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('product_id', sa.Integer(), nullable=False),
            sa.Column('date', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
            sa.Column('movement_type', sa.Enum('PURCHASE', 'SALE', 'ADJUSTMENT', 'RETURN', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', name='movementtype'), nullable=False),
            sa.Column('quantity', sa.Numeric(precision=12, scale=3), nullable=False),
            sa.Column('balance_after', sa.Numeric(precision=12, scale=3), nullable=False),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('warehouse_id', sa.Integer(), nullable=True),
            sa.ForeignKeyConstraint(['product_id'], ['products.id'], ),
            sa.ForeignKeyConstraint(['warehouse_id'], ['warehouses.id'], ),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_kardex_id'), 'kardex', ['id'], unique=False)

    # --- 13. CONFIG ---
    if 'business_config' not in tables:
        op.create_table('business_config',
            sa.Column('key', sa.String(), nullable=False),
            sa.Column('value', sa.Text(), nullable=True),
            sa.PrimaryKeyConstraint('key')
        )
        op.create_index(op.f('ix_business_config_key'), 'business_config', ['key'], unique=False)



def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('product_units')
    op.drop_table('sale_details')
    op.drop_table('sales')
    op.drop_table('customers')
    op.drop_table('products')
    op.drop_index(op.f('ix_exchange_rates_id'), table_name='exchange_rates')
    op.drop_table('exchange_rates')
    op.drop_index(op.f('ix_suppliers_name'), table_name='suppliers')
    op.drop_table('suppliers')
    op.drop_index(op.f('ix_categories_name'), table_name='categories')
    op.drop_table('categories')
    op.drop_table('users')
