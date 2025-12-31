"""add product images support

Revision ID: b1c2d3e4f5g6
Revises: a1b2c3d4e5f6
Create Date: 2025-12-28 03:13:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'b1c2d3e4f5g6'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    """Add image_url and updated_at columns to products table."""
    # Add image_url column
    op.add_column('products', sa.Column('image_url', sa.String(255), nullable=True))
    
    # Add updated_at column with default value
    op.add_column('products', sa.Column('updated_at', sa.TIMESTAMP(), server_default=sa.func.now(), nullable=True))
    
    # Create trigger only for Postgres
    bind = op.get_bind()
    if bind.engine.name == 'postgresql':
        op.execute("""
            CREATE OR REPLACE FUNCTION update_updated_at_column()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = CURRENT_TIMESTAMP;
                RETURN NEW;
            END;
            $$ language 'plpgsql'
        """)
        
        op.execute("""
            DROP TRIGGER IF EXISTS update_products_updated_at ON products
        """)
        
        op.execute("""
            CREATE TRIGGER update_products_updated_at
            BEFORE UPDATE ON products
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column()
        """)

def downgrade() -> None:
    """Remove image support from products table."""
    op.execute("DROP TRIGGER IF EXISTS update_products_updated_at ON products")
    op.execute("DROP FUNCTION IF EXISTS update_updated_at_column()")
    op.execute("ALTER TABLE products DROP COLUMN IF EXISTS updated_at")
    op.execute("ALTER TABLE products DROP COLUMN IF EXISTS image_url")
