"""add_pdf_template_path_to_warranty_policies

Revision ID: a1b2c3d4e5f7
Revises: 333333333333
Create Date: 2026-04-11 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f7'
down_revision = '333333333333'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    from sqlalchemy.engine.reflection import Inspector
    inspector = Inspector.from_engine(conn)
    tables = inspector.get_table_names()

    if 'warranty_policies' in tables:
        columns = [c['name'] for c in inspector.get_columns('warranty_policies')]
        if 'pdf_template_path' not in columns:
            with op.batch_alter_table('warranty_policies', schema=None) as batch_op:
                batch_op.add_column(sa.Column('pdf_template_path', sa.String(), nullable=True))


def downgrade():
    conn = op.get_bind()
    from sqlalchemy.engine.reflection import Inspector
    inspector = Inspector.from_engine(conn)
    tables = inspector.get_table_names()

    if 'warranty_policies' in tables:
        columns = [c['name'] for c in inspector.get_columns('warranty_policies')]
        if 'pdf_template_path' in columns:
            with op.batch_alter_table('warranty_policies', schema=None) as batch_op:
                batch_op.drop_column('pdf_template_path')
