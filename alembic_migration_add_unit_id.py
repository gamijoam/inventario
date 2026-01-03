"""add_unit_id_to_sale_detail

Revision ID: add_unit_id_001
Revises: 
Create Date: 2026-01-03 07:35:00

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_unit_id_001'
down_revision = None  # Replace with your current head revision
branch_labels = None
depends_on = None


def upgrade():
    # Add unit_id column to sale_details table
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


def downgrade():
    # Remove index
    op.drop_index('idx_sale_details_unit_id', table_name='sale_details')
    
    # Remove foreign key constraint
    op.drop_constraint('fk_sale_details_unit_id', 'sale_details', type_='foreignkey')
    
    # Remove column
    op.drop_column('sale_details', 'unit_id')
