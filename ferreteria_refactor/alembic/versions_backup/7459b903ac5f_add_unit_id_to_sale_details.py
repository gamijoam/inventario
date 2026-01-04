"""add_unit_id_to_sale_details

Revision ID: 7459b903ac5f
Revises: b671e1f9c4a1
Create Date: 2026-01-03 07:50:55.106155

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision: str = '7459b903ac5f'
down_revision: Union[str, Sequence[str], None] = 'b671e1f9c4a1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add unit_id column to sale_details table to track which presentation was sold."""
    # Get connection and inspector
    conn = op.get_bind()
    inspector = inspect(conn)
    
    # Get existing columns for sale_details table
    sale_details_columns = [col['name'] for col in inspector.get_columns('sale_details')]
    
    # Add unit_id column only if it doesn't exist
    if 'unit_id' not in sale_details_columns:
        op.add_column('sale_details', 
            sa.Column('unit_id', sa.Integer(), nullable=True)
        )
        
        # Add foreign key constraint
        op.create_foreign_key(
            'fk_sale_details_unit_id',  # Constraint name
            'sale_details',              # Source table
            'product_units',             # Target table
            ['unit_id'],                 # Source column
            ['id']                       # Target column
        )
        
        # Create index for better query performance
        op.create_index(
            'idx_sale_details_unit_id',
            'sale_details',
            ['unit_id'],
            unique=False
        )


def downgrade() -> None:
    """Remove unit_id column from sale_details table."""
    # Remove index
    op.drop_index('idx_sale_details_unit_id', table_name='sale_details')
    
    # Remove foreign key constraint
    op.drop_constraint('fk_sale_details_unit_id', 'sale_details', type_='foreignkey')
    
    # Remove column
    op.drop_column('sale_details', 'unit_id')
