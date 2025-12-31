"""add test migration table

Revision ID: a1b2c3d4e5f6
Revises: f152d00b510a
Create Date: 2025-12-28 02:22:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = 'f152d00b510a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    """Create test migration table with various column types."""
    # Using raw SQL with IF NOT EXISTS for safety
    op.execute("""
        CREATE TABLE IF NOT EXISTS test_migration_validation (
            id SERIAL PRIMARY KEY,
            test_string VARCHAR(100) NOT NULL,
            test_integer INTEGER DEFAULT 0,
            test_decimal NUMERIC(12, 2) DEFAULT 0.00,
            test_boolean BOOLEAN DEFAULT FALSE,
            test_datetime TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            test_text TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Insert a test record
    op.execute("""
        INSERT INTO test_migration_validation 
        (test_string, test_integer, test_decimal, test_boolean, test_text)
        VALUES 
        ('Migration Test Successful', 42, 99.99, TRUE, 'This record proves the migration system works correctly')
        ON CONFLICT DO NOTHING
    """)

def downgrade() -> None:
    """Remove test migration table."""
    op.execute("DROP TABLE IF EXISTS test_migration_validation")
