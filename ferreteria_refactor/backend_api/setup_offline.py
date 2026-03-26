"""
Setup para modo offline / local.
Inicializa la BD, corre migraciones, y crea un tenant por defecto.

Uso:
    python -m backend_api.setup_offline

    O desde la carpeta backend_api/:
    python setup_offline.py
"""
import sys
import os

# Asegurar que el path del proyecto esté disponible
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def setup():
    from config import settings
    from database.db import Base, engine, SessionLocal
    from sqlalchemy import inspect, text

    print("=" * 60)
    print("  Mi Inventario Fácil — Setup Offline")
    print("=" * 60)
    print(f"  BD: {settings.DATABASE_URL.split('@')[-1] if '@' in settings.DATABASE_URL else settings.DATABASE_URL}")
    print(f"  Schema tenant: {settings.SINGLE_TENANT_SCHEMA}")
    print()

    # 1. Crear tablas del schema public
    print("[1/4] Creando tablas del schema public...")
    try:
        Base.metadata.create_all(bind=engine)
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        print(f"  ✅ {len(tables)} tablas en public")
    except Exception as e:
        print(f"  ❌ Error: {e}")
        sys.exit(1)

    # 2. Correr migraciones Alembic (si están disponibles)
    print("[2/4] Corriendo migraciones Alembic...")
    try:
        from main import run_migrations
        run_migrations()
        print("  ✅ Migraciones aplicadas")
    except Exception as e:
        print(f"  ⚠️  Migraciones saltadas: {e}")

    # 3. Verificar si el tenant ya existe
    schema = settings.SINGLE_TENANT_SCHEMA
    print(f"[3/4] Verificando tenant '{schema}'...")
    db = SessionLocal()
    try:
        from models.models import Tenant
        existing = db.query(Tenant).filter(Tenant.schema_name == schema).first()
        if existing:
            print(f"  ✅ Tenant '{schema}' ya existe (id={existing.id})")
            print("  ℹ️  Setup completado — no se crearon datos nuevos")
            return
    finally:
        db.close()

    # 4. Crear el tenant por defecto
    print(f"[4/4] Creando tenant '{schema}'...")
    try:
        from services.tenant_service import TenantService

        result = TenantService.create_tenant(
            name="Mi Negocio",
            schema_name=schema,
            admin_email="admin@local.com",
            admin_password="admin123",
            plan_type="FERRETERIA",
        )

        # Marcar como lifetime (sin expiración)
        db = SessionLocal()
        try:
            tenant = db.query(Tenant).filter(Tenant.schema_name == schema).first()
            if tenant:
                tenant.license_type = "lifetime"
                tenant.is_active = True
                tenant.trial_ends_at = None
                db.commit()
        finally:
            db.close()

        print(f"  ✅ Tenant creado exitosamente")
        print()
        print("=" * 60)
        print("  ¡Setup completado!")
        print()
        print("  Credenciales de acceso:")
        print("    Usuario: admin")
        print("    Email:   admin@local.com")
        print("    Clave:   admin123")
        print()
        print("  Inicia el servidor con:")
        print("    uvicorn backend_api.main:app --host 0.0.0.0 --port 8000")
        print()
        print("  Luego abre: http://localhost:8000")
        print("=" * 60)

    except Exception as e:
        print(f"  ❌ Error creando tenant: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    setup()
