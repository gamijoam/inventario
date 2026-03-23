"""increase exchange_rate.rate precision to Numeric(20,8)

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-03-23

Motivo: La columna `rate` en `exchange_rates` era Numeric(14,4), lo cual
truncaba tasas con más de 4 decimales (ej. COP inverso: 0.000269 → 0.0003).
Se amplía a Numeric(20,8) para soportar micro-monedas y tasas muy pequeñas.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import NUMERIC


# revision identifiers, used by Alembic.
revision = 'd4e5f6a7b8c9'
down_revision = 'c3d4e5f6a7b8'
branch_labels = None
depends_on = None


def upgrade():
    # Ampliar precisión en todos los schemas (cada tenant tiene su propio schema)
    # La migración se corre por tenant en el contexto de cada schema.
    op.alter_column(
        'exchange_rates',
        'rate',
        existing_type=sa.Numeric(14, 4),
        type_=sa.Numeric(20, 8),
        existing_nullable=False,
    )


def downgrade():
    op.alter_column(
        'exchange_rates',
        'rate',
        existing_type=sa.Numeric(20, 8),
        type_=sa.Numeric(14, 4),
        existing_nullable=False,
    )
