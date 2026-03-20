"""
conftest_pg.py — Fixtures para tests contra PostgreSQL real (BD de test con datos de prod).

Uso:
    pytest tests/test_critical_pg.py -v

La BD de test se levanta con:
    docker compose -f docker-compose.test.yml up -d
    (Puerto 5434, invensoft_test, restaurado del backup de prod)
"""

import os
import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# URL de la BD de test (PostgreSQL real con datos de prod restaurados)
TEST_DB_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql://postgres:testpass123@localhost:5434/invensoft_test"
)

# Schemas de tenants reales disponibles en la BD de test
TENANT_SCHEMAS = [
    "farmaciasanjose",
    "hmd2018caa",
    "inversionesjr",
    "lalicoreria",
    "yaracall",
]

# Un tenant de referencia para tests que necesitan uno concreto
DEFAULT_TENANT = "farmaciasanjose"


@pytest.fixture(scope="session")
def pg_engine():
    """Engine PostgreSQL conectado a la BD de test. Scope session = una sola conexión."""
    engine = create_engine(TEST_DB_URL, echo=False)
    yield engine
    engine.dispose()


@pytest.fixture(scope="function")
def pg_db(pg_engine):
    """
    Sesión PostgreSQL con search_path al tenant por defecto.
    Cada test corre en una transacción que se revierte al final → BD queda intacta.
    """
    connection = pg_engine.connect()
    transaction = connection.begin()

    # Establecer search_path al tenant de prueba
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
    Factory fixture: devuelve una función que retorna una sesión para cualquier schema.
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

    # Cleanup: revertir todas las transacciones
    for conn, txn, session in connections:
        session.close()
        txn.rollback()
        conn.close()
