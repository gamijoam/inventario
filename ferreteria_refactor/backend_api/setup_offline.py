"""
Setup para modo offline / local.
Inicializa la BD, corre migraciones, y crea un tenant por defecto.

Uso (desde ferreteria_refactor/):
    python -m backend_api.setup_offline
"""
import sys
import os


def setup():
    # Los imports deben ser del paquete backend_api (relative imports)
    from backend_api.config import settings
    from backend_api.database.db import Base, engine, SessionLocal
    from sqlalchemy import inspect

    print("=" * 60)
    print("  Mi Inventario Fácil — Setup Offline")
    print("=" * 60)
    print(f"  BD: {settings.DATABASE_URL.split('@')[-1] if '@' in settings.DATABASE_URL else settings.DATABASE_URL}")
    print(f"  Schema tenant: {settings.SINGLE_TENANT_SCHEMA}")
    print()

    # 1. Crear tablas del schema public
    print("[1/4] Creando tablas del schema public...")
    try:
        from backend_api.models import models  # noqa — registra modelos en Base
        Base.metadata.create_all(bind=engine)
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        print(f"  ✅ {len(tables)} tablas en public")
    except Exception as e:
        print(f"  ❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

    # 2. Verificar si el tenant ya existe
    schema = settings.SINGLE_TENANT_SCHEMA
    print(f"[2/4] Verificando tenant '{schema}'...")
    db = SessionLocal()
    try:
        from backend_api.models.tenant import Tenant
        existing = db.query(Tenant).filter(Tenant.schema_name == schema).first()
        if existing:
            print(f"  ✅ Tenant '{schema}' ya existe (id={existing.id})")
            print("  ℹ️  Setup completado — no se crearon datos nuevos")
            return
    finally:
        db.close()

    # 3. Crear el tenant por defecto
    print(f"[3/4] Creando tenant '{schema}'...")
    try:
        from backend_api.services.tenant_service import TenantService

        TenantService.create_tenant(
            name="Mi Negocio",
            schema_name=schema,
            admin_email="admin@local.com",
            admin_password="admin123",
            plan_type="FERRETERIA",
        )
        print("  ✅ Tenant creado")
    except Exception as e:
        print(f"  ❌ Error creando tenant: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

    # 4. Marcar como lifetime (sin expiración)
    print("[4/4] Configurando licencia lifetime...")
    db = SessionLocal()
    try:
        from backend_api.models.tenant import Tenant
        tenant = db.query(Tenant).filter(Tenant.schema_name == schema).first()
        if tenant:
            tenant.license_type = "lifetime"
            tenant.is_active = True
            tenant.trial_ends_at = None
            db.commit()
            print("  ✅ Licencia lifetime asignada")
    finally:
        db.close()

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


if __name__ == "__main__":
    # Asegurar que ferreteria_refactor/ esté en el path
    parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if parent_dir not in sys.path:
        sys.path.insert(0, parent_dir)
    setup()
