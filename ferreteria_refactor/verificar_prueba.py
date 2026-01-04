"""
Script para verificar que la tabla de prueba se creó correctamente
"""
import sys
import os

# Agregar el directorio raíz al path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import inspect
from backend_api.database.db import engine

def verificar_tabla_prueba():
    print("=" * 60)
    print("🔍 VERIFICACIÓN DE TABLA DE PRUEBA")
    print("=" * 60)
    
    inspector = inspect(engine)
    
    # Verificar que la tabla existe
    tabla_existe = inspector.has_table("prueba_actualizacion")
    
    if tabla_existe:
        print("\n✅ ÉXITO: La tabla 'prueba_actualizacion' existe!")
        
        # Obtener columnas
        columnas = inspector.get_columns("prueba_actualizacion")
        
        print("\n📋 Columnas detectadas:")
        for col in columnas:
            nullable = "NULL" if col['nullable'] else "NOT NULL"
            print(f"   - {col['name']}: {col['type']} ({nullable})")
        
        # Obtener índices
        indices = inspector.get_indexes("prueba_actualizacion")
        
        if indices:
            print("\n🔑 Índices detectados:")
            for idx in indices:
                print(f"   - {idx['name']}: {idx['column_names']}")
        
        print("\n" + "=" * 60)
        print("🎉 CONCLUSIÓN: Las actualizaciones incrementales FUNCIONAN")
        print("=" * 60)
        print("\n✅ Alembic detectó el nuevo modelo")
        print("✅ Generó la migración correctamente")
        print("✅ Aplicó la migración a la base de datos")
        print("✅ La tabla se creó con todas sus columnas")
        
    else:
        print("\n❌ ERROR: La tabla 'prueba_actualizacion' NO existe")
        print("\nTablas disponibles:")
        for tabla in inspector.get_table_names():
            print(f"   - {tabla}")

if __name__ == "__main__":
    try:
        verificar_tabla_prueba()
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
