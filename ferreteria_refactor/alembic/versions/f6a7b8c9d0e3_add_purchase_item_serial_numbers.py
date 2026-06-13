"""add purchase item serial numbers

Revision ID: f6a7b8c9d0e3
Revises: f6a7b8c9d0e2
Create Date: 2026-06-13 10:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = "f6a7b8c9d0e3"
down_revision = "f6a7b8c9d0e2"
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    schemas = [row[0] for row in conn.execute(sa.text("""
        SELECT schema_name
        FROM information_schema.schemata
        WHERE schema_name NOT IN ('information_schema','pg_catalog','pg_toast')
    """))]
    for schema in schemas:
        exists = conn.execute(sa.text("""
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = :schema AND table_name = 'purchase_items'
            )
        """), {"schema": schema}).scalar()
        if not exists:
            continue
        has_col = conn.execute(sa.text("""
            SELECT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = :schema AND table_name = 'purchase_items' AND column_name = 'serial_numbers'
            )
        """), {"schema": schema}).scalar()
        if not has_col:
            op.add_column('purchase_items', sa.Column('serial_numbers', sa.Text(), nullable=True), schema=schema)


def downgrade():
    conn = op.get_bind()
    schemas = [row[0] for row in conn.execute(sa.text("""
        SELECT schema_name
        FROM information_schema.schemata
        WHERE schema_name NOT IN ('information_schema','pg_catalog','pg_toast')
    """))]
    for schema in schemas:
        has_col = conn.execute(sa.text("""
            SELECT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = :schema AND table_name = 'purchase_items' AND column_name = 'serial_numbers'
            )
        """), {"schema": schema}).scalar()
        if has_col:
            op.drop_column('purchase_items', 'serial_numbers', schema=schema)
