"""
Script para inicializar la base de datos local de PostgreSQL.
Ejecutar con: python init_local_db.py
"""
import sys
import os

# Add parent directory to path to import from backend_api
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database.db import Base, engine, DATABASE_URL
from models import models  # Import all models to register them with Base

def init_database():
    """
    Crea todas las tablas en la base de datos.
    """
    print(f"🔧 Inicializando base de datos...")
    print(f"📍 DATABASE_URL: {DATABASE_URL}")
    
    try:
        # Create all tables
        print("📦 Creando tablas...")
        Base.metadata.create_all(bind=engine)
        print("✅ Tablas creadas exitosamente!")
        
        # List created tables
        from sqlalchemy import inspect
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        print(f"\n📋 Tablas creadas ({len(tables)}):")
        for table in sorted(tables):
            print(f"  - {table}")
            
    except Exception as e:
        print(f"❌ Error al crear tablas: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    init_database()
