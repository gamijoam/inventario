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
    Ejecuta las migraciones Alembic para:
      - Schema public (tablas compartidas: users, tenants, etc.)
      - Schema desktop_local (tablas de negocio: products, sales, etc.)
    """
    # El alembic.ini está en ferreteria_refactor/
    alembic_dir = Path(__file__).parent.parent  # ferreteria_refactor/

    print("[DESKTOP] Ejecutando migraciones (public)...", flush=True)
    _run_alembic(alembic_dir, "public")

    print(f"[DESKTOP] Ejecutando migraciones ({DESKTOP_SCHEMA})...", flush=True)
    _run_alembic(alembic_dir, DESKTOP_SCHEMA)


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

        if not tenant:
            print(f"[DESKTOP] Creando tenant '{DESKTOP_SCHEMA}'...", flush=True)
            tenant = Tenant(
                name="Invensoft Desktop",
                schema_name=DESKTOP_SCHEMA,
                is_active=True,
                # Licencia desktop — se valida por separado
                license_type="desktop",
            )
            db.add(tenant)
            db.commit()
            db.refresh(tenant)
            print(f"[DESKTOP] ✅ Tenant creado (id={tenant.id}).", flush=True)
        else:
            print(f"[DESKTOP] ✅ Tenant '{DESKTOP_SCHEMA}' ya existe (id={tenant.id}).", flush=True)

        return tenant.id
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

    # 4. Migraciones Alembic
    _run_alembic_migrations()

    # 5. Tenant record
    tenant_id = _ensure_desktop_tenant(engine)

    # 6. Detectar primer arranque
    IS_FIRST_RUN = _check_first_run(engine, tenant_id)
    if IS_FIRST_RUN:
        print("[DESKTOP] 🆕 PRIMER ARRANQUE detectado — no hay usuarios admin.", flush=True)

    engine.dispose()

    print("[DESKTOP] ✅ Inicialización completada.", flush=True)
    print("=" * 60 + "\n", flush=True)
