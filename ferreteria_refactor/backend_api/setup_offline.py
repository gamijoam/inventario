"""
Setup para modo offline / local.
Inicializa la BD, corre migraciones, y crea un tenant por defecto.

Idempotente: se puede ejecutar múltiples veces sin duplicar datos.
Verifica si el schema y el seeding están completos, no solo si el
tenant row existe.

Uso (desde ferreteria_refactor/):
    python -m backend_api.setup_offline
"""
import sys
import os


def setup():
    # Los imports deben ser del paquete backend_api (relative imports)
    from backend_api.config import settings
    from backend_api.database.db import Base, engine, SessionLocal
    from sqlalchemy import inspect, text

    print("=" * 60)
    print("  Mi Inventario Fácil — Setup Offline")
    print("=" * 60)
    print(f"  BD: {settings.DATABASE_URL.split('@')[-1] if '@' in settings.DATABASE_URL else settings.DATABASE_URL}")
    print(f"  Schema tenant: {settings.SINGLE_TENANT_SCHEMA}")
    print()

    # 1. Crear tablas del schema public
    print("[1/6] Creando tablas del schema public...")
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

    # 1b. Migraciones seguras — agrega columnas nuevas sin borrar datos
    print("[1b/6] Aplicando migraciones de actualización...")
    try:
        with engine.connect() as conn:
            migrations = [
                # feature_flags: sistema de flags por tenant (v2.3+)
                "ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS feature_flags JSONB NOT NULL DEFAULT '{}'",
            ]
            applied = 0
            for sql in migrations:
                conn.execute(text(sql))
                applied += 1
            conn.commit()
        print(f"  ✅ {applied} migración(es) aplicada(s)")
    except Exception as e:
        print(f"  ⚠️  Migraciones: {e} (puede ser normal en primera instalación)")

    schema = settings.SINGLE_TENANT_SCHEMA

    # 2. Verificar/crear el tenant row
    print(f"[2/6] Verificando tenant '{schema}'...")
    db = SessionLocal()
    try:
        from backend_api.models.tenant import Tenant
        tenant = db.query(Tenant).filter(Tenant.schema_name == schema).first()
        if tenant:
            print(f"  ℹ️  Tenant row '{schema}' existe (id={tenant.id})")
        else:
            print(f"  Creando tenant '{schema}'...")
            from backend_api.services.tenant_service import TenantService
            TenantService.create_tenant(
                name="Mi Negocio",
                schema_name=schema,
                admin_email="admin@local.com",
                admin_password="admin123",
                plan_type="FERRETERIA",
            )
            print("  ✅ Tenant creado con todos los datos")
            # create_tenant hace todo (schema + tablas + seeding) → listo
            _finalize_license(schema)
            _print_summary()
            return
    except Exception as e:
        print(f"  ❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        db.close()

    # 3. Si el tenant row ya existía, verificar si el schema PostgreSQL existe
    print(f"[3/6] Verificando schema PostgreSQL '{schema}'...")
    schema_exists = False
    try:
        with engine.connect() as conn:
            result = conn.execute(
                text("SELECT schema_name FROM information_schema.schemata WHERE schema_name = :s"),
                {"s": schema}
            )
            schema_exists = result.fetchone() is not None
    except Exception as e:
        print(f"  ⚠️  Error verificando schema: {e}")

    if not schema_exists:
        print(f"  Schema '{schema}' no existe — creando y provisionando tablas...")
        try:
            from backend_api.database.db import _validate_schema_name
            with engine.connect() as conn:
                with conn.begin():
                    _validate_schema_name(schema)
                    conn.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{schema}"'))
                    conn.execute(text(f'SET search_path TO "{schema}"'))
                    Base.metadata.create_all(conn)
            print(f"  ✅ Schema '{schema}' creado y tablas provisionadas")
        except Exception as e:
            print(f"  ❌ Error creando schema: {e}")
            import traceback
            traceback.print_exc()
            sys.exit(1)
    else:
        print(f"  ✅ Schema '{schema}' existe")

    # 4. Verificar y sembrar datos base (idempotente — cada función verifica si ya existe)
    print(f"[4/6] Verificando datos base del tenant...")
    from backend_api.services.tenant_service import TenantService

    # Obtener tenant_id para el admin user
    db = SessionLocal()
    tenant_id = None
    try:
        from backend_api.models.tenant import Tenant
        t = db.query(Tenant).filter(Tenant.schema_name == schema).first()
        tenant_id = t.id if t else None
    finally:
        db.close()

    seeds_run = []

    try:
        # Admin user (solo si no existe)
        if tenant_id:
            db = SessionLocal()
            try:
                from backend_api.database.db import _validate_schema_name
                _validate_schema_name(schema)
                db.execute(text(f'SET search_path TO "{schema}", public'))
                from backend_api.models.models import User
                admin_exists = db.query(User).filter(
                    User.username == "admin",
                    User.tenant_id == tenant_id
                ).first()
                if not admin_exists:
                    TenantService.seed_tenant_admin(schema, "admin@local.com", "admin123", "Mi Negocio", tenant_id)
                    seeds_run.append("admin")
            finally:
                db.close()

        TenantService.seed_exchange_rates(schema)
        TenantService.seed_payment_methods(schema)
        TenantService.seed_currencies(schema)
        TenantService.seed_tenant_warehouse(schema)
        TenantService.seed_cash_register(schema)
        seeds_run.extend(["tasas", "métodos de pago", "monedas", "almacén", "caja"])
        print(f"  ✅ Datos base verificados/sembrados")
    except Exception as e:
        print(f"  ⚠️  Error en seeding: {e}")
        import traceback
        traceback.print_exc()

    # 5. Marcar como lifetime (sin expiración)
    _finalize_license(schema)

    _print_summary()


def _finalize_license(schema: str):
    print("[5/6] Configurando licencia lifetime...")
    from backend_api.database.db import SessionLocal
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


def _print_summary():
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
