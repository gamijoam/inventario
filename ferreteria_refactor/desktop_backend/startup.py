"""
desktop_backend/startup.py

Inicialización del backend de escritorio al primer arranque:
  1. Verificar que PostgreSQL local está accesible
  2. Crear la base de datos 'invensoft_desktop' si no existe
  3. Crear el schema 'desktop_local' si no existe
  4. Ejecutar migraciones Alembic (public + desktop_local)
  5. Crear el registro Tenant en public si no existe
  6. Detectar si es primera vez (no hay usuarios admin) → flag first_run

Esto corre UNA VEZ en el evento startup de FastAPI.
"""
import os
import sys
import subprocess
from pathlib import Path

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

from .config import (
    DESKTOP_SCHEMA,
    DESKTOP_DB_NAME,
    DESKTOP_DB_USER,
    DESKTOP_DB_PASSWORD,
    DESKTOP_DB_HOST,
    DESKTOP_DB_PORT,
    DESKTOP_DATABASE_URL,
)


# ─── Flag global de primer arranque ──────────────────────────────────────────
IS_FIRST_RUN: bool = False


def _ensure_database_exists():
    """
    Conecta a la DB 'postgres' (sistema) y crea 'invensoft_desktop' si no existe.
    """
    print("[DESKTOP] Verificando base de datos local...", flush=True)
    try:
        conn = psycopg2.connect(
            dbname="postgres",
            user=DESKTOP_DB_USER,
            password=DESKTOP_DB_PASSWORD,
            host=DESKTOP_DB_HOST,
            port=DESKTOP_DB_PORT,
        )
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cur = conn.cursor()

        cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (DESKTOP_DB_NAME,))
        exists = cur.fetchone()

        if not exists:
            print(f"[DESKTOP] Creando base de datos '{DESKTOP_DB_NAME}'...", flush=True)
            cur.execute(f'CREATE DATABASE "{DESKTOP_DB_NAME}" ENCODING = \'UTF8\'')
            print(f"[DESKTOP] ✅ Base de datos '{DESKTOP_DB_NAME}' creada.", flush=True)
        else:
            print(f"[DESKTOP] ✅ Base de datos '{DESKTOP_DB_NAME}' ya existe.", flush=True)

        cur.close()
        conn.close()
    except psycopg2.OperationalError as e:
        raise RuntimeError(
            f"[DESKTOP] ❌ No se pudo conectar a PostgreSQL local.\n"
            f"  Asegúrate de que PostgreSQL esté corriendo en {DESKTOP_DB_HOST}:{DESKTOP_DB_PORT}\n"
            f"  Usuario: {DESKTOP_DB_USER}  Error: {e}"
        )


def _ensure_schema_exists(engine):
    """Crea el schema 'desktop_local' si no existe."""
    with engine.connect() as conn:
        conn.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{DESKTOP_SCHEMA}"'))
        conn.commit()
    print(f"[DESKTOP] ✅ Schema '{DESKTOP_SCHEMA}' listo.", flush=True)


def _run_alembic_migrations():
    """
    Ejecuta las migraciones Alembic solo para el schema public.
    Para desktop_local usamos metadata.create_all() directamente
    para evitar conflictos con las tablas compartidas que ya existen en public.
    """
    alembic_dir = Path(__file__).parent.parent  # ferreteria_refactor/
    print("[DESKTOP] Ejecutando migraciones (public)...", flush=True)
    _run_alembic(alembic_dir, "public")


def _run_alembic(alembic_dir: Path, schema: str):
    """Lanza alembic upgrade head para el schema dado."""
    env = {
        **os.environ,
        "DATABASE_URL": DESKTOP_DATABASE_URL,
        "ALEMBIC_SCHEMA": schema,
    }
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=str(alembic_dir),
        env=env,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print(f"[DESKTOP] ⚠️  Alembic stderr: {result.stderr}", flush=True)
        # No lanzamos excepción — puede ser que ya esté en head
    else:
        print(f"[DESKTOP] ✅ Migraciones '{schema}' aplicadas.", flush=True)


def _create_desktop_local_tables(engine):
    """
    Crea las tablas de negocio en el schema desktop_local usando
    SQLAlchemy metadata.create_all() con checkfirst=True.

    No usamos Alembic aquí porque los migrations históricos intentan
    recrear tablas del schema public (tenants, users) que ya existen,
    causando DuplicateTable errors.
    """
    from backend_api.models.models import Base
    # Importar todos los modelos para registrarlos en metadata
    import backend_api.models.restaurant   # noqa
    import backend_api.models.tenant       # noqa (schema=public, se filtra)

    # Tablas que viven en public — NO recrear en desktop_local
    SHARED_TABLE_NAMES = {
        "users", "tenants", "tenant_payments", "system_messages",
        "support_tickets", "admin_tasks",
    }

    # Solo tablas sin schema explícito (las de negocio del tenant)
    tenant_tables = [
        t for t in Base.metadata.sorted_tables
        if t.schema is None and t.name not in SHARED_TABLE_NAMES
    ]

    # schema_translate_map redirige tablas sin schema → desktop_local
    desktop_engine = engine.execution_options(
        schema_translate_map={None: DESKTOP_SCHEMA}
    )
    Base.metadata.create_all(desktop_engine, tables=tenant_tables, checkfirst=True)
    print(f"[DESKTOP] ✅ Tablas en '{DESKTOP_SCHEMA}' listas ({len(tenant_tables)} tablas).", flush=True)


def _ensure_desktop_tenant(engine) -> int:
    """
    Crea el Tenant de escritorio en el schema public si no existe.
    Retorna el tenant_id.
    """
    from backend_api.models.tenant import Tenant

    Session = sessionmaker(bind=engine)
    db = Session()
    try:
        # Buscar en el schema public
        db.execute(text("SET search_path TO public"))
        tenant = db.query(Tenant).filter(Tenant.schema_name == DESKTOP_SCHEMA).first()

        # Flags comunes para el tenant desktop — todos los módulos habilitados
        _ALL_MODULES = dict(
            has_restaurant_module=True,
            has_laundry_module=True,
            has_hardware_module=True,
            has_services_module=True,
            has_barbershop_module=True,
        )

        if not tenant:
            print(f"[DESKTOP] Creando tenant '{DESKTOP_SCHEMA}'...", flush=True)
            tenant = Tenant(
                name="Invensoft Desktop",
                schema_name=DESKTOP_SCHEMA,
                is_active=True,
                business_type="desktop",
                is_demo=False,
                **_ALL_MODULES,
            )
            db.add(tenant)
            db.commit()
            db.refresh(tenant)
            print(f"[DESKTOP] ✅ Tenant creado con todos los módulos (id={tenant.id}).", flush=True)
        else:
            # Asegurarse de que todos los módulos estén habilitados (migración silenciosa)
            changed = False
            for flag, val in _ALL_MODULES.items():
                if getattr(tenant, flag, None) != val:
                    setattr(tenant, flag, val)
                    changed = True
            if changed:
                db.commit()
                print(f"[DESKTOP] ✅ Módulos habilitados en tenant existente.", flush=True)
            else:
                print(f"[DESKTOP] ✅ Tenant '{DESKTOP_SCHEMA}' ya existe (id={tenant.id}).", flush=True)

        return tenant.id
    finally:
        db.close()


def _seed_default_data(engine, schema: str):
    """
    Inserta datos predeterminados en el schema desktop_local si no existen:
    tasas de cambio, métodos de pago, monedas, almacén y caja principal.

    Equivale a lo que TenantService hace al crear un tenant nuevo en la web.
    Se ejecuta en cada arranque pero es idempotente (checkfirst).
    """
    from backend_api.models.models import (
        ExchangeRate, PaymentMethod, Currency, Warehouse, CashRegister,
    )

    Session = sessionmaker(bind=engine)
    db = Session()
    try:
        db.execute(text(f'SET search_path TO "{schema}", public'))

        # ── Tasas de cambio ──────────────────────────────────────────────────
        if db.query(ExchangeRate).count() == 0:
            db.add_all([
                ExchangeRate(name="BCV",      currency_code="VES", currency_symbol="Bs",
                             rate=45.00, is_default=True,  is_active=True),
                ExchangeRate(name="Paralelo", currency_code="VES", currency_symbol="Bs",
                             rate=52.00, is_default=False, is_active=True),
            ])
            db.commit()
            print(f"[DESKTOP] ✅ Tasas de cambio sembradas.", flush=True)

        # ── Métodos de pago ──────────────────────────────────────────────────
        if db.query(PaymentMethod).count() == 0:
            db.add_all([
                PaymentMethod(name="Efectivo",       is_active=True, is_system=True),
                PaymentMethod(name="Pago Móvil",     is_active=True, is_system=True),
                PaymentMethod(name="Zelle",           is_active=True, is_system=True),
                PaymentMethod(name="Punto de Venta", is_active=True, is_system=True),
                PaymentMethod(name="Transferencia",  is_active=True, is_system=True),
            ])
            db.commit()
            print(f"[DESKTOP] ✅ Métodos de pago sembrados.", flush=True)

        # ── Monedas ──────────────────────────────────────────────────────────
        if db.query(Currency).count() == 0:
            db.add_all([
                Currency(name="Dólar Americano",     symbol="USD", rate=1.00,    is_anchor=True,  is_active=True),
                Currency(name="Bolívar Venezolano",  symbol="VES", rate=60.00,   is_anchor=False, is_active=True),
                Currency(name="Peso Colombiano",     symbol="COP", rate=4200.00, is_anchor=False, is_active=True),
            ])
            db.commit()
            print(f"[DESKTOP] ✅ Monedas sembradas.", flush=True)

        # ── Almacén principal ─────────────────────────────────────────────────
        if db.query(Warehouse).count() == 0:
            db.add(Warehouse(
                name="Almacen1",
                address="Dirección Principal",
                is_active=True,
                is_main=True,
            ))
            db.commit()
            print(f"[DESKTOP] ✅ Almacén principal creado.", flush=True)

        # ── Caja principal ────────────────────────────────────────────────────
        if db.query(CashRegister).count() == 0:
            db.add(CashRegister(
                name="Caja Principal",
                code="C01",
                description="Caja predeterminada del sistema",
                is_active=True,
            ))
            db.commit()
            print(f"[DESKTOP] ✅ Caja principal creada.", flush=True)

    except Exception as e:
        db.rollback()
        print(f"[DESKTOP] ⚠️  Error sembrando datos predeterminados: {e}", flush=True)
        # No lanzar — la app puede correr sin estos datos aunque con errores en UI
    finally:
        db.close()


def _check_first_run(engine, tenant_id: int) -> bool:
    """
    Detecta si es el primer arranque verificando si existe algún admin
    en el schema desktop_local.
    Retorna True si no hay usuarios (primera vez).
    """
    from backend_api.models.models import User

    Session = sessionmaker(bind=engine)
    db = Session()
    try:
        db.execute(text(f'SET search_path TO "{DESKTOP_SCHEMA}", public'))
        count = db.query(User).filter(
            User.tenant_id == tenant_id
        ).count()
        return count == 0
    finally:
        db.close()


async def initialize_desktop():
    """
    Punto de entrada principal. Llamado desde el evento startup de FastAPI.
    """
    global IS_FIRST_RUN

    print("\n" + "=" * 60, flush=True)
    print("[DESKTOP] INICIALIZANDO INVENSOFT DESKTOP", flush=True)
    print("=" * 60, flush=True)

    # 1. Crear DB si no existe
    _ensure_database_exists()

    # 2. Motor principal (ya con la DB correcta)
    engine = create_engine(
        DESKTOP_DATABASE_URL,
        connect_args={"client_encoding": "utf8"},
        pool_pre_ping=True,
    )

    # 3. Crear schema desktop_local
    _ensure_schema_exists(engine)

    # 4. Migraciones Alembic (solo public)
    _run_alembic_migrations()

    # 4b. Crear tablas de negocio en desktop_local (sin Alembic)
    _create_desktop_local_tables(engine)

    # 5. Tenant record
    tenant_id = _ensure_desktop_tenant(engine)

    # 5b. Sembrar datos predeterminados (métodos de pago, monedas, caja, almacén…)
    _seed_default_data(engine, DESKTOP_SCHEMA)

    # 6. Detectar primer arranque
    IS_FIRST_RUN = _check_first_run(engine, tenant_id)
    if IS_FIRST_RUN:
        print("[DESKTOP] 🆕 PRIMER ARRANQUE detectado — no hay usuarios admin.", flush=True)

    engine.dispose()

    print("[DESKTOP] ✅ Inicialización completada.", flush=True)
    print("=" * 60 + "\n", flush=True)
