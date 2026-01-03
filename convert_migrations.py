"""
Script automatizado para convertir TODAS las migraciones restantes a idempotentes
"""
import os
import re

migrations_dir = r"c:\Users\Gamijoam\Documents\ferreteria\ferreteria_refactor\alembic\versions"

# Lista de migraciones que necesitan conversión (del scan anterior)
migrations_to_convert = [
    '12fea28e253c_add_warehouse_to_sales.py',
    '1a2b3c4d5e6f_add_uuid_for_hybrid_sync.py',
    '2ba48a125ad0_add_warehouse_to_kardex_purchases.py',
    '3bf88fad26c3_add_unit_id_to_combo_items_for_.py',
    'a2b2c3d4e5f6_add_historical_cost.py',
    'b1c2d3e4f5g6_add_product_images.py',
    'b671e1f9c4a1_fix_multicurrency_logic.py',
    'baed8ac6920d_add_combo_support_is_combo_flag_and_.py',
]

print("🔧 Convirtiendo migraciones a idempotentes...\n")

for filename in migrations_to_convert:
    filepath = os.path.join(migrations_dir, filename)
    
    if not os.path.exists(filepath):
        print(f"⏭️  {filename} - No encontrado")
        continue
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Ya tiene inspector?
    if 'from sqlalchemy import inspect' in content:
        print(f"✅ {filename} - Ya tiene inspect")
        continue
    
    # Agregar import de inspect
    if 'from alembic import op' in content and 'from sqlalchemy import inspect' not in content:
        content = content.replace(
            'from alembic import op\nimport sqlalchemy as sa',
            'from alembic import op\nimport sqlalchemy as sa\nfrom sqlalchemy import inspect'
        )
    
    # Agregar inspector al inicio de upgrade()
    if 'def upgrade()' in content and 'inspector = inspect(conn)' not in content:
        # Buscar el patrón de upgrade function
        upgrade_pattern = r'(def upgrade\(\)[^\n]*:\n)(    .*?\n)'
        
        def add_inspector(match):
            func_def = match.group(1)
            first_line = match.group(2)
            
            # Si ya tiene conn = op.get_bind(), solo agregar inspector
            if 'conn = op.get_bind()' in first_line:
                return func_def + first_line + '    inspector = inspect(conn)\n    \n'
            else:
                return func_def + '    conn = op.get_bind()\n    inspector = inspect(conn)\n    \n' + first_line
        
        content = re.sub(upgrade_pattern, add_inspector, content, count=1)
    
    # Guardar cambios
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"✅ {filename} - Convertido (inspector agregado)")

print("\n📝 NOTA: Las migraciones ahora tienen inspector, pero DEBES revisar manualmente")
print("         cada op.add_column() y agregar verificación if 'column' not in columns")
print("\n💡 Patrón a seguir:")
print("   columns = [col['name'] for col in inspector.get_columns('table_name')]")
print("   if 'column_name' not in columns:")
print("       op.add_column(...)")
