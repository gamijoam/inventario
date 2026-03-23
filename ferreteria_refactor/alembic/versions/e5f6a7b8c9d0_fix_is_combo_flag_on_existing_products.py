"""fix is_combo flag on existing products with combo_items

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-03-23

Bug: ProductForm.jsx solo actualizaba combo_items en formData pero nunca
seteaba is_combo = True. Resultado: productos con combo_items guardados pero
is_combo = False en BD → al vender caían en el path de producto normal y
solo se descontaba el stock del combo, no de los componentes.

Fix frontend: onItemsChange ahora hace is_combo: i.length > 0
Esta migración repara productos ya existentes en BD.
"""
from alembic import op
from alembic import context
from typing import Union, Sequence

revision: str = 'e5f6a7b8c9d0'
down_revision: Union[str, Sequence[str], None] = 'f6a7b8c9d0e1'
branch_labels = None
depends_on = None


def _is_public_schema() -> bool:
    import os
    x_args = context.get_x_argument(as_dictionary=True)
    tenant_arg = x_args.get("tenant")
    if tenant_arg:
        return tenant_arg == "public"
    return os.getenv("ALEMBIC_SCHEMA", "public") == "public"


def upgrade():
    if _is_public_schema():
        return

    # Reparar productos que tienen combo_items pero is_combo = False
    op.execute("""
        UPDATE products
        SET is_combo = TRUE
        WHERE is_combo = FALSE
          AND id IN (SELECT DISTINCT parent_product_id FROM combo_items)
    """)


def downgrade():
    # No revertimos: no hay forma segura de saber cuáles is_combo=True
    # fueron puestos por esta migración vs por el usuario.
    pass
