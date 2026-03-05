"""repair tenant columns

Revision ID: e2f1a9b2d3c4
Revises: 79496be2603e
Create Date: 2026-02-26 19:40:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'e2f1a9b2d3c4'
down_revision: Union[str, Sequence[str], None] = '2abfc9e544a2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    """Upgrade schema - Repair missing columns in public.tenants."""
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('tenants', schema='public')]
    
    # 1. business_type (In case 79496be2603e didn't run properly on VPS)
    if 'business_type' not in columns:
        print("🚀 Repair: Adding business_type to public.tenants...")
        op.add_column('tenants', sa.Column('business_type', sa.String(), nullable=True), schema='public')
    
    # 2. has_barbershop_module (Missing from history)
    if 'has_barbershop_module' not in columns:
        print("🚀 Repair: Adding has_barbershop_module to public.tenants...")
        op.add_column('tenants', sa.Column('has_barbershop_module', sa.Boolean(), nullable=True), schema='public')
    
    # Ensure other module flags exist (Paranoia check)
    flags = [
        ('has_restaurant_module', sa.Boolean()),
        ('has_laundry_module', sa.Boolean()),
        ('has_hardware_module', sa.Boolean()),
        ('has_services_module', sa.Boolean())
    ]
    
    for flag_name, flag_type in flags:
        if flag_name not in columns:
            print(f"🚀 Repair: Adding {flag_name} to public.tenants...")
            op.add_column('tenants', sa.Column(flag_name, flag_type, nullable=True), schema='public')

def downgrade() -> None:
    """Downgrade schema."""
    # We don't usually downgrade repairs to avoid data loss, but for completeness:
    # op.drop_column('tenants', 'has_barbershop_module', schema='public')
    pass
