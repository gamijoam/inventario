"""add_test_verification_table

Revision ID: d16e5fce48a9
Revises: 94f7283605db
Create Date: 2026-01-03 18:07:26.408349

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd16e5fce48a9'
down_revision: Union[str, Sequence[str], None] = '94f7283605db'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Crear tabla de prueba para verificar ejecución automática
    op.create_table(
        'test_auto_execution',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('message', sa.String(length=255), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Insertar un registro de prueba con timestamp
    op.execute(
        "INSERT INTO test_auto_execution (message) VALUES ('Migration executed automatically on server startup!')"
    )
    print("✅ [TEST] Tabla test_auto_execution creada exitosamente!")


def downgrade() -> None:
    """Downgrade schema."""
    # Eliminar tabla de prueba
    op.drop_table('test_auto_execution')
    print("🗑️  [TEST] Tabla test_auto_execution eliminada")
