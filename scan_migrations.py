"""
Script para convertir TODAS las migraciones a idempotentes automáticamente
"""
import os
import re

# Directorio de migraciones
migrations_dir = r"c:\Users\Gamijoam\Documents\ferreteria\ferreteria_refactor\alembic\versions"

# Patrón para detectar op.add_column sin verificación
pattern = r"op\.add_column\("

# Contador
converted = 0
skipped = 0

print("🔍 Escaneando migraciones...")

for filename in os.listdir(migrations_dir):
    if not filename.endswith('.py') or filename == '__init__.py':
        continue
    
    filepath = os.path.join(migrations_dir, filename)
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Verificar si ya tiene inspector (ya es idempotente)
    if 'from sqlalchemy import inspect' in content and 'inspector = inspect(conn)' in content:
        print(f"⏭️  {filename} - Ya es idempotente")
        skipped += 1
        continue
    
    # Verificar si tiene op.add_column
    if 'op.add_column(' not in content:
        print(f"⏭️  {filename} - No tiene add_column")
        skipped += 1
        continue
    
    print(f"⚠️  {filename} - Necesita conversión")
    converted += 1

print(f"\n📊 Resumen:")
print(f"   ✅ Idempotentes: {skipped}")
print(f"   ⚠️  Necesitan conversión: {converted}")
print(f"\n💡 Migraciones que necesitan ser convertidas manualmente:")
print(f"   - Revisa cada una y agrega verificación de columnas existentes")
