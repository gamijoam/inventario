"""Add unit_id to combo_items for presentation support

Revision ID: 3bf88fad26c3
Revises: baed8ac6920d
Create Date: 2025-12-19 18:33:XX.XXXXXX

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3bf88fad26c3'
down_revision: Union[str, Sequence[str], None] = 'baed8ac6920d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add unit_id column to combo_items table"""
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [c['name'] for c in inspector.get_columns('combo_items')]
    
    if 'unit_id' not in columns:
        op.add_column('combo_items', sa.Column('unit_id', sa.Integer(), nullable=True))
        op.create_foreign_key(
            'fk_combo_items_unit_id',
            'combo_items', 'product_units',
            ['unit_id'], ['id'],
            ondelete='SET NULL'
        )


def downgrade() -> None:
    """Remove unit_id column from combo_items table"""
    op.drop_constraint('fk_combo_items_unit_id', 'combo_items', type_='foreignkey')
    op.drop_column('combo_items', 'unit_id')
