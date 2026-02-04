"""
Script para crear usuario admin manualmente en el schema 'public'

Este script crea un usuario administrador con credenciales predeterminadas
para poder acceder a Swagger y al sistema.

Uso: python create_admin.py
"""

import sys
import os

# Agregar el directorio actual al path para importar módulos del backend
sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy import text
from backend_api.database.db import SessionLocal
from backend_api.models.models import User, UserRole
from backend_api.security import get_password_hash

def create_super_admin():
    """
    Crea un usuario administrador en el schema 'public'
    
    Credenciales:
    - Username: admin
    - Password: admin123
    - Role: ADMIN
    """
    db = SessionLocal()
    try:
        print("🔌 Conectando a la Base de Datos...")
        
        # 1. Asegurar que estamos en el schema public
        db.execute(text("SET search_path TO public"))
        db.commit()
        print("✅ Schema configurado: public")
        
        username = "admin"
        password_raw = "admin123"
        
        # 2. Buscar si ya existe el usuario
        existing_user = db.query(User).filter(User.username == username).first()
        
        if existing_user:
            print(f"⚠️  El usuario '{username}' YA EXISTE en schema 'public'.")
            print(f"   ID: {existing_user.id}")
            print(f"   Role: {existing_user.role}")
            print(f"   Active: {existing_user.is_active}")
            
            # Actualizar contraseña y asegurar que esté activo
            existing_user.password_hash = get_password_hash(password_raw)
            existing_user.is_active = True
            existing_user.role = UserRole.ADMIN
            existing_user.pin = "0000"  # PIN por defecto
            
            db.commit()
            print(f"✅ Contraseña actualizada a '{password_raw}'")
            print(f"✅ PIN configurado: 0000")
            print(f"✅ Usuario activado y configurado como ADMIN")
        else:
            print(f"✨ Creando nuevo usuario '{username}'...")
            
            # Crear nuevo usuario admin
            new_user = User(
                username=username,
                password_hash=get_password_hash(password_raw),
                full_name="Administrador del Sistema",
                role=UserRole.ADMIN,
                is_active=True,
                pin="0000",  # PIN por defecto para autorizaciones
                commission_percentage=0.00
            )
            
            db.add(new_user)
            db.commit()
            db.refresh(new_user)
            
            print(f"✅ Usuario '{username}' CREADO exitosamente!")
            print(f"   ID: {new_user.id}")
            print(f"   Username: {new_user.username}")
            print(f"   Password: {password_raw}")
            print(f"   PIN: 0000")
            print(f"   Role: {new_user.role}")
            
        print("\n" + "="*60)
        print("🎉 PROCESO COMPLETADO")
        print("="*60)
        print(f"\n📝 Credenciales de acceso:")
        print(f"   Username: {username}")
        print(f"   Password: {password_raw}")
        print(f"   PIN: 0000")
        print(f"\n🔗 Puedes acceder a:")
        print(f"   - Swagger UI: http://localhost:8000/docs")
        print(f"   - Frontend: http://localhost:5173")
        print()
            
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        print(f"   Tipo: {type(e).__name__}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()
        print("🔌 Conexión cerrada")

if __name__ == "__main__":
    print("\n" + "🔐"*30)
    print("CREACIÓN DE USUARIO ADMINISTRADOR")
    print("🔐"*30 + "\n")
    create_super_admin()