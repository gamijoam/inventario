"""
Script para habilitar el módulo de lavandería en la base de datos.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database.db import SessionLocal
from models.models import Tenant

def enable_laundry_module():
    db = SessionLocal()
    try:
        # Get the first tenant (or all tenants)
        tenant = db.query(Tenant).first()
        
        if not tenant:
            print("❌ No se encontró ningún tenant en la base de datos")
            return
        
        print(f"📋 Tenant encontrado: {tenant.name}")
        print(f"   Schema: {tenant.schema_name}")
        print(f"   Lavandería actual: {tenant.has_laundry_module}")
        
        # Enable laundry module
        tenant.has_laundry_module = True
        db.commit()
        
        print(f"✅ Módulo de lavandería HABILITADO para tenant '{tenant.name}'")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    enable_laundry_module()
