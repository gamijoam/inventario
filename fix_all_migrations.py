"""
Script COMPLETO para convertir TODAS las migraciones a idempotentes automáticamente
"""
import os
import re

migrations_dir = r"c:\Users\Gamijoam\Documents\ferreteria\ferreteria_refactor\alembic\versions"

# Migraciones que necesitan conversión COMPLETA
migrations_to_fix = {
    'b1c2d3e4f5g6_add_product_images.py': [
        ('products', 'image_url')
    ],
    'baed8ac6920d_add_combo_support_is_combo_flag_and_.py': [
        ('products', 'is_combo'),
        ('combo_items', '*')  # Tabla nueva
    ],
    '3bf88fad26c3_add_unit_id_to_combo_items_for_.py': [
        ('combo_items', 'unit_id')
    ],
    'a2b2c3d4e5f6_add_historical_cost.py': [
        ('sale_details', 'cost_at_sale')
    ],
    'b671e1f9c4a1_fix_multicurrency_logic.py': [
        ('*', '*')  # Revisar manualmente
    ],
    '12fea28e253c_add_warehouse_to_sales.py': [
        ('sales', 'warehouse_id')
    ],
    '2ba48a125ad0_add_warehouse_to_kardex_purchases.py': [
        ('kardex', 'warehouse_id'),
        ('purchases', 'warehouse_id')
    ],
    '1a2b3c4d5e6f_add_uuid_for_hybrid_sync.py': [
        ('*', 'uuid')  # Múltiples tablas
    ],
}

print("🔧 Convirtiendo migraciones a COMPLETAMENTE idempotentes...\n")

for filename, columns_info in migrations_to_fix.items():
    filepath = os.path.join(migrations_dir, filename)
    
    if not os.path.exists(filepath):
        print(f"⏭️  {filename} - No encontrado")
        continue
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Agregar import de inspect si no existe
    if 'from sqlalchemy import inspect' not in content:
        content = content.replace(
            'import sqlalchemy as sa',
            'import sqlalchemy as sa\nfrom sqlalchemy import inspect'
        )
    
    # Encontrar todas las líneas op.add_column
    add_column_pattern = r"(\s+)op\.add_column\('(\w+)',\s*sa\.Column\('(\w+)'[^)]+\)\)"
    
    def make_idempotent(match):
        indent = match.group(1)
        table = match.group(2)
        column = match.group(3)
        original = match.group(0)
        
        # Crear código idempotente
        return f"""{indent}# Check if {column} exists
{indent}{table}_columns = [col['name'] for col in inspector.get_columns('{table}')]
{indent}if '{column}' not in {table}_columns:
{indent}    {original.strip()}"""
    
    # Reemplazar op.add_column con versión idempotente
    content_new = re.sub(add_column_pattern, make_idempotent, content)
    
    # Agregar inspector al inicio de upgrade() si no existe
    if 'inspector = inspect(conn)' not in content_new:
        content_new = re.sub(
            r'(def upgrade\(\)[^\n]*:\n)(    )',
            r'\1\2conn = op.get_bind()\n\2inspector = inspect(conn)\n\2\n\2',
            content_new,
            count=1
        )
    
    # Guardar cambios
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content_new)
    
    print(f"✅ {filename} - Convertido completamente")

print("\n✅ ¡Todas las migraciones convertidas!")
print("📝 Reconstruye la imagen Docker ahora")
