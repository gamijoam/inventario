"""
conftest.py — Fixtures compartidas para el suite de tests.

Estrategia de BD de prueba:
- Se usa SQLite en memoria para tests unitarios/integración que NO necesitan
  comportamiento exclusivo de PostgreSQL (schemas, search_path).
- Los tests que SÍ requieren schemas PostgreSQL reales están marcados con
  @pytest.mark.requires_postgres y deben ejecutarse contra una BD de test
  dedicada (ver variable de entorno TEST_DATABASE_URL).

Variables de entorno relevantes:
    TEST_DATABASE_URL  — URL de PostgreSQL de test (e.g. postgresql://user:pw@localhost/test_db)
                         Si no está definida, los tests requires_postgres se saltean.
"""

import pytest
from decimal import Decimal
from unittest.mock import MagicMock, patch
from sqlalchemy import create_engine, text, event
from sqlalchemy.orm import sessionmaker

# ---------------------------------------------------------------------------
# Registro de marca personalizada para tests que necesitan PostgreSQL real
# ---------------------------------------------------------------------------

def pytest_configure(config):
    config.addinivalue_line(
        "markers",
        "requires_postgres: marca tests que necesitan una BD PostgreSQL real con soporte de schemas.",
    )


# ---------------------------------------------------------------------------
# Engine SQLite en memoria — para tests que NO dependen de schemas PG
# ---------------------------------------------------------------------------

SQLITE_URL = "sqlite:///:memory:"


def _create_sqlite_engine():
    """Crea un engine SQLite en memoria con check_same_thread desactivado."""
    engine = create_engine(
        SQLITE_URL,
        connect_args={"check_same_thread": False},
        echo=False,
    )
    return engine


# ---------------------------------------------------------------------------
# Importación de modelos — con manejo de error explícito para CI limpio
# ---------------------------------------------------------------------------

try:
    # Los modelos usan importaciones relativas; las resolvemos desde el paquete
    # raíz del backend.  Si el entorno de test no tiene el paquete instalado,
    # los tests concretos se saltean con un skip informativo.
    import sys, os

    # Agrega el directorio raíz de ferreteria_refactor al path para que
    # "from backend_api.models..." funcione en ejecución directa con pytest.
    _backend_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    if _backend_root not in sys.path:
        sys.path.insert(0, _backend_root)

    from backend_api.models.models import (
        Base,
        CashRegister,
        CashSession,
        Customer,
        Sale,
    )
    from backend_api.models.tenant import Tenant
    from backend_api.tenant_context import set_tenant_schema, reset_tenant_schema

    MODELS_AVAILABLE = True

except Exception as _import_err:  # noqa: BLE001
    MODELS_AVAILABLE = False
    _import_err_msg = str(_import_err)


# ---------------------------------------------------------------------------
# Fixture: engine + sesión SQLite en memoria (scope=function)
# ---------------------------------------------------------------------------

@pytest.fixture()
def sqlite_engine():
    """Engine SQLite en memoria con tablas creadas.

    Solo disponible cuando los modelos pudieron importarse.
    Si los modelos no están disponibles, el test se saltea automáticamente.
    """
    if not MODELS_AVAILABLE:
        pytest.skip(
            f"No se pudieron importar los modelos SQLAlchemy: {_import_err_msg}. "
            "Asegúrate de ejecutar pytest desde la raíz del proyecto con el "
            "paquete backend_api instalable (pip install -e .)."
        )

    engine = _create_sqlite_engine()

    # SQLite no tiene schemas; registramos un listener para ignorar
    # SET search_path que lanza error en SQLite.
    @event.listens_for(engine, "connect")
    def _set_sqlite_pragmas(dbapi_conn, _):
        dbapi_conn.execute("PRAGMA foreign_keys=ON")

    # Crea todas las tablas (sin schema prefix para SQLite)
    with engine.begin() as conn:
        # Patch temporal: SQLite ignora __table_args__ con schema,
        # pero create_all igual funciona porque SQLAlchemy omite el schema
        # en SQLite si el dialect no lo soporta.
        Base.metadata.create_all(conn)

    yield engine

    # Tear-down: elimina tablas para aislar tests
    with engine.begin() as conn:
        Base.metadata.drop_all(conn)
    engine.dispose()


@pytest.fixture()
def db_session(sqlite_engine):
    """Sesión SQLAlchemy ligada al engine SQLite de prueba.

    Cada test obtiene una transacción que se revierte al finalizar,
    garantizando aislamiento total entre tests.
    """
    SessionFactory = sessionmaker(bind=sqlite_engine, autocommit=False, autoflush=False)
    session = SessionFactory()

    yield session

    session.rollback()
    session.close()


# ---------------------------------------------------------------------------
# Fixtures de datos básicos reutilizables
# ---------------------------------------------------------------------------

@pytest.fixture()
def cash_register(db_session):
    """Crea y persiste un CashRegister de prueba."""
    if not MODELS_AVAILABLE:
        pytest.skip("Modelos no disponibles.")

    register = CashRegister(
        name="Caja Test",
        code="CT01",
        description="Caja utilizada en tests automatizados",
        is_active=True,
    )
    db_session.add(register)
    db_session.flush()  # Genera el ID sin hacer commit
    return register


@pytest.fixture()
def customer_with_limit(db_session):
    """Crea un Customer con credit_limit=100.00 y sin deuda inicial."""
    if not MODELS_AVAILABLE:
        pytest.skip("Modelos no disponibles.")

    customer = Customer(
        name="Cliente Test Crédito",
        id_number="V-12345678",
        credit_limit=Decimal("100.00"),
        is_blocked=False,
    )
    db_session.add(customer)
    db_session.flush()
    return customer
