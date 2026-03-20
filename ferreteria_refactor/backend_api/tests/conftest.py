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

import os
import pytest
from decimal import Decimal
from unittest.mock import MagicMock, patch
from sqlalchemy import create_engine, text, event
from sqlalchemy.orm import sessionmaker

# ---------------------------------------------------------------------------
# Fixtures PostgreSQL real (BD de test restaurada desde backup de prod)
# ---------------------------------------------------------------------------

TEST_DB_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql://postgres:testpass123@localhost:5434/invensoft_test"
)

DEFAULT_TENANT = "farmaciasanjose"

TENANT_SCHEMAS = [
    "farmaciasanjose",
    "hmd2018caa",
    "inversionesjr",
    "lalicoreria",
    "yaracall",
]


@pytest.fixture(scope="session")
def pg_engine():
    """Engine PostgreSQL conectado a la BD de test. Una sola conexión por sesión."""
    engine = create_engine(TEST_DB_URL, echo=False)
    yield engine
    engine.dispose()


@pytest.fixture(scope="function")
def pg_db(pg_engine):
    """
    Sesión PostgreSQL con search_path al tenant por defecto.
    Corre en transacción que se revierte al final → BD queda intacta.
    """
    connection = pg_engine.connect()
    transaction = connection.begin()
    connection.execute(text(f'SET search_path TO "{DEFAULT_TENANT}", public'))
    Session = sessionmaker(bind=connection)
    session = Session()
    yield session
    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture(scope="function")
def pg_db_for_schema(pg_engine):
    """
    Factory fixture: devuelve una función que crea sesiones para cualquier schema.
    Útil para tests de aislamiento multi-tenant.
    """
    connections = []

    def _get_session(schema: str):
        conn = pg_engine.connect()
        txn = conn.begin()
        conn.execute(text(f'SET search_path TO "{schema}", public'))
        Session = sessionmaker(bind=conn)
        session = Session()
        connections.append((conn, txn, session))
        return session

    yield _get_session

    for conn, txn, session in connections:
        session.close()
        txn.rollback()
        conn.close()

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
        CashMovement,
        CashSession,
        Customer,
        Product,
        ProductStock,
        Sale,
        SaleDetail,
        Warehouse,
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

    # SQLite no tiene schemas; registramos un listener para activar FKs.
    @event.listens_for(engine, "connect")
    def _set_sqlite_pragmas(dbapi_conn, _):
        dbapi_conn.execute("PRAGMA foreign_keys=ON")

    # SQLite no soporta schemas ("unknown database public").  Se eliminan los
    # atributos schema de todos los Table ANTES de create_all y se mantienen
    # así durante todo el test para que los INSERTs/SELECTs tampoco los usen.
    # Se restauran en el tear-down para no afectar otros módulos ni el engine
    # de producción.
    schema_backups: dict = {}
    for table in Base.metadata.tables.values():
        if table.schema:
            schema_backups[table] = table.schema
            table.schema = None

    try:
        with engine.begin() as conn:
            Base.metadata.create_all(conn)

        # Los schemas permanecen a None durante el yield para que el DML
        # (INSERT/SELECT/UPDATE) tampoco incluya el prefijo "public.".
        yield engine

    finally:
        # Restaurar schemas originales antes del drop_all y al salir
        for table, original_schema in schema_backups.items():
            table.schema = original_schema

        # Tear-down: volver a quitar schemas para drop_all en SQLite
        schema_backups_drop: dict = {}
        for table in Base.metadata.tables.values():
            if table.schema:
                schema_backups_drop[table] = table.schema
                table.schema = None
        try:
            with engine.begin() as conn:
                Base.metadata.drop_all(conn)
        finally:
            for table, original_schema in schema_backups_drop.items():
                table.schema = original_schema
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


@pytest.fixture()
def warehouse(db_session):
    """Crea y persiste un Warehouse de prueba marcado como principal."""
    if not MODELS_AVAILABLE:
        pytest.skip("Modelos no disponibles.")

    wh = Warehouse(
        name="Almacén Principal Test",
        address="Calle Test 1",
        is_active=True,
        is_main=True,
    )
    db_session.add(wh)
    db_session.flush()
    return wh


@pytest.fixture()
def product_with_stock(db_session, warehouse):
    """Crea un Product físico con 10 unidades en el almacén de prueba.

    Retorna una tupla (product, product_stock) para facilitar las
    aserciones de cantidad antes y después de una venta.
    """
    if not MODELS_AVAILABLE:
        pytest.skip("Modelos no disponibles.")

    product = Product(
        name="Producto Test Stock",
        sku="SKU-TEST-001",
        price=Decimal("15.00"),
        stock=Decimal("10.000"),
        cost_price=Decimal("8.00"),
        is_active=True,
        is_service=False,
        is_combo=False,
        has_imei=False,
    )
    db_session.add(product)
    db_session.flush()

    stock_record = ProductStock(
        product_id=product.id,
        warehouse_id=warehouse.id,
        quantity=Decimal("10.000"),
    )
    db_session.add(stock_record)
    db_session.flush()

    return product, stock_record


@pytest.fixture()
def open_cash_session(db_session, cash_register):
    """Crea una CashSession OPEN ligada al cash_register de prueba."""
    if not MODELS_AVAILABLE:
        pytest.skip("Modelos no disponibles.")

    session = CashSession(
        register_id=cash_register.id,
        status="OPEN",
        initial_cash=Decimal("50.00"),
    )
    db_session.add(session)
    db_session.flush()
    return session
