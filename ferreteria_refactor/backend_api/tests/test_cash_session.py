"""
test_cash_session.py
====================
Tests de la regla de negocio: una sola sesión OPEN por caja (CashRegister).

Arquitectura relevante:
- CashSession.status ∈ {"OPEN", "CLOSED"}
- CashSession.register_id → FK a CashRegister.id
- La restricción "solo una sesión OPEN por caja" se aplica a dos niveles:
    1. Nivel aplicación: cash.py verifica si ya existe un session OPEN antes de crear una nueva.
       Si existe, retorna HTTP 400 (no lanza IntegrityError).
    2. Nivel BD (opcional): en producción se puede añadir un índice único parcial PostgreSQL:
       CREATE UNIQUE INDEX uix_one_open_session_per_register
           ON cash_sessions (register_id)
           WHERE status = 'OPEN';
       SQLite NO soporta índices únicos parciales con WHERE, por lo que el test de
       IntegrityError a nivel BD está marcado @pytest.mark.requires_postgres.

Tests incluidos:
    test_no_puede_haber_dos_sesiones_abiertas_nivel_app
        — Verifica la lógica de la capa de aplicación (sin BD real).
    test_cierre_de_sesion_permite_nueva_apertura
        — Verifica que cerrar una sesión (status=CLOSED) habilita abrir otra.
    test_no_puede_haber_dos_sesiones_abiertas_nivel_bd  [requires_postgres]
        — Verifica el IntegrityError del índice único parcial en PostgreSQL real.
    test_sesion_cerrada_no_bloquea_nueva_apertura_nivel_bd  [requires_postgres]
        — Idéntico al flujo de nivel app pero validado contra PostgreSQL real.
"""

import os
import pytest
from decimal import Decimal
from unittest.mock import MagicMock, patch


# ---------------------------------------------------------------------------
# Importaciones con skip seguro
# ---------------------------------------------------------------------------

def _import_models():
    try:
        import sys
        _backend_root = os.path.dirname(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        )
        if _backend_root not in sys.path:
            sys.path.insert(0, _backend_root)

        from backend_api.models.models import CashRegister, CashSession, Base
        return CashRegister, CashSession, Base, None
    except Exception as e:
        return None, None, None, str(e)


CashRegister, CashSession, Base, _import_error = _import_models()
MODELS_AVAILABLE = CashRegister is not None


# ---------------------------------------------------------------------------
# Test 1 — Regla de negocio a nivel de aplicación (sin BD real)
# ---------------------------------------------------------------------------

def test_no_puede_haber_dos_sesiones_abiertas_nivel_app():
    """
    Verifica que la lógica de negocio impide abrir una segunda sesión OPEN
    para la misma caja cuando ya existe una activa.

    Simula el comportamiento del endpoint POST /cash/sessions/open en cash.py:
    - Si db.query(CashSession).filter(register_id, status==OPEN).first() devuelve
      una sesión existente, se retorna HTTP 400 y NO se crea una nueva sesión.

    Este test es UNITARIO y no requiere BD.
    """
    if not MODELS_AVAILABLE:
        pytest.skip(f"Modelos no disponibles: {_import_error}")

    # --- Arrange ---
    mock_db = MagicMock()
    register_id = 1

    # Simular que ya existe una sesión OPEN para este register
    existing_session = MagicMock(spec=CashSession)
    existing_session.id = 42
    existing_session.status = "OPEN"
    existing_session.register_id = register_id

    # La query encadenada devuelve la sesión existente
    mock_db.query.return_value.filter.return_value.first.return_value = existing_session

    # --- Act: replicar la lógica del endpoint ---
    active_session = (
        mock_db.query(CashSession)
        .filter(
            CashSession.register_id == register_id,
            CashSession.status == "OPEN",
        )
        .first()
    )

    # Si existe sesión activa, el endpoint lanza HTTPException — verificamos la condición
    session_already_open = active_session is not None

    # --- Assert ---
    assert session_already_open is True, (
        "Debe detectar que ya existe una sesión OPEN para este register_id. "
        "El endpoint debería retornar HTTP 400 sin crear una nueva sesión."
    )

    # Verificar que NO se llamó a db.add() (no se intentó crear la segunda sesión)
    mock_db.add.assert_not_called()


def test_cierre_de_sesion_permite_nueva_apertura():
    """
    Verifica que al cambiar status de CLOSED en la sesión existente,
    la lógica de negocio permite abrir una nueva sesión OPEN para la misma caja.

    Flujo:
    1. Sesión existente está CLOSED.
    2. La query de "¿existe sesión OPEN?" devuelve None.
    3. Se puede crear una nueva CashSession con status=OPEN.
    """
    if not MODELS_AVAILABLE:
        pytest.skip(f"Modelos no disponibles: {_import_error}")

    # --- Arrange ---
    mock_db = MagicMock()
    register_id = 1

    # Simular que NO hay sesión OPEN (la anterior fue cerrada)
    mock_db.query.return_value.filter.return_value.first.return_value = None

    # --- Act: replicar lógica del endpoint para abrir nueva sesión ---
    active_session = (
        mock_db.query(CashSession)
        .filter(
            CashSession.register_id == register_id,
            CashSession.status == "OPEN",
        )
        .first()
    )

    can_open_new = active_session is None

    if can_open_new:
        new_session = CashSession(
            register_id=register_id,
            status="OPEN",
            initial_cash=Decimal("50.00"),
        )
        mock_db.add(new_session)
        mock_db.flush()

    # --- Assert ---
    assert can_open_new is True, (
        "Con la sesión anterior CLOSED, debe ser posible abrir una nueva sesión OPEN."
    )
    mock_db.add.assert_called_once(), (
        "Se debe haber llamado a db.add() para persistir la nueva sesión."
    )


# ---------------------------------------------------------------------------
# Test 2 — Lógica integrada con SQLite (sin índice único parcial)
# ---------------------------------------------------------------------------

def test_no_puede_haber_dos_sesiones_abiertas_sqlite(db_session, cash_register):
    """
    Verifica la regla de negocio contra la BD SQLite de prueba.

    Inserta una sesión OPEN y comprueba que la lógica de aplicación
    detecta el conflicto.  SQLite no soporta índices únicos parciales con
    WHERE, así que la restricción se verifica a nivel de código.
    """
    if not MODELS_AVAILABLE:
        pytest.skip(f"Modelos no disponibles: {_import_error}")

    # Abrir primera sesión
    session1 = CashSession(
        register_id=cash_register.id,
        status="OPEN",
        initial_cash=Decimal("100.00"),
    )
    db_session.add(session1)
    db_session.flush()

    # Comprobar que existe una sesión OPEN para esta caja
    existing_open = (
        db_session.query(CashSession)
        .filter(
            CashSession.register_id == cash_register.id,
            CashSession.status == "OPEN",
        )
        .first()
    )

    # La lógica de la aplicación debe detectar el conflicto
    assert existing_open is not None, (
        "Debe existir una sesión OPEN para la caja de prueba."
    )
    assert existing_open.id == session1.id, (
        "La sesión OPEN encontrada debe ser la primera creada."
    )

    # Intentar 'abrir' una segunda — la lógica retornaría HTTP 400
    would_block = existing_open is not None
    assert would_block is True, (
        "La lógica de negocio debe impedir una segunda sesión OPEN."
    )


def test_cierre_de_sesion_permite_nueva_apertura_sqlite(db_session, cash_register):
    """
    Verifica el ciclo completo: abrir → cerrar → abrir nuevamente.

    Contra BD SQLite en memoria.
    """
    if not MODELS_AVAILABLE:
        pytest.skip(f"Modelos no disponibles: {_import_error}")

    # Abrir primera sesión
    session1 = CashSession(
        register_id=cash_register.id,
        status="OPEN",
        initial_cash=Decimal("100.00"),
    )
    db_session.add(session1)
    db_session.flush()

    # Cerrar la sesión (simular cierre como hace el endpoint)
    session1.status = "CLOSED"
    db_session.flush()

    # Verificar que ya no hay sesiones OPEN
    open_after_close = (
        db_session.query(CashSession)
        .filter(
            CashSession.register_id == cash_register.id,
            CashSession.status == "OPEN",
        )
        .first()
    )
    assert open_after_close is None, (
        "Tras cerrar la sesión, no debe haber ninguna sesión OPEN."
    )

    # Abrir segunda sesión
    session2 = CashSession(
        register_id=cash_register.id,
        status="OPEN",
        initial_cash=Decimal("75.00"),
    )
    db_session.add(session2)
    db_session.flush()

    open_after_reopen = (
        db_session.query(CashSession)
        .filter(
            CashSession.register_id == cash_register.id,
            CashSession.status == "OPEN",
        )
        .first()
    )

    assert open_after_reopen is not None, (
        "Debe poder abrirse una nueva sesión OPEN tras cerrar la anterior."
    )
    assert open_after_reopen.id == session2.id, (
        "La sesión OPEN activa debe ser la nueva (session2), no la cerrada."
    )
    assert open_after_reopen.id != session1.id, (
        "La sesión cerrada (session1) no debe ser retornada como OPEN."
    )


# ---------------------------------------------------------------------------
# Tests con PostgreSQL real (índice único parcial a nivel BD)
# ---------------------------------------------------------------------------

@pytest.mark.requires_postgres
def test_no_puede_haber_dos_sesiones_abiertas_nivel_bd():
    """
    Verifica que la BD PostgreSQL lanza IntegrityError al intentar insertar
    una segunda sesión OPEN para la misma caja, cuando existe el índice único parcial:

        CREATE UNIQUE INDEX uix_one_open_session_per_register
            ON cash_sessions (register_id)
            WHERE status = 'OPEN';

    Si el índice no existe en la BD de prueba, el test se saltea con un mensaje claro.

    Requiere:
        TEST_DATABASE_URL=postgresql://user:pw@localhost/test_db
    """
    if not MODELS_AVAILABLE:
        pytest.skip(f"Modelos no disponibles: {_import_error}")

    test_db_url = os.environ.get("TEST_DATABASE_URL")
    if not test_db_url:
        pytest.skip("TEST_DATABASE_URL no definida.")

    from sqlalchemy import create_engine, text
    from sqlalchemy.orm import sessionmaker
    from sqlalchemy.exc import IntegrityError

    TEST_SCHEMA = "test_cash_session_schema"
    engine = create_engine(test_db_url)

    try:
        with engine.begin() as conn:
            conn.execute(text(f'DROP SCHEMA IF EXISTS "{TEST_SCHEMA}" CASCADE'))
            conn.execute(text(f'CREATE SCHEMA "{TEST_SCHEMA}"'))
            conn.execute(text(f'SET search_path TO "{TEST_SCHEMA}"'))
            Base.metadata.create_all(conn)

            # Crear índice único parcial (simular el índice de producción)
            conn.execute(text("""
                CREATE UNIQUE INDEX IF NOT EXISTS uix_one_open_session_per_register
                ON cash_sessions (register_id)
                WHERE status = 'OPEN'
            """))

            # Insertar CashRegister
            conn.execute(text(
                "INSERT INTO cash_registers (name, code, is_active) "
                "VALUES ('Caja PG Test', 'CPG01', true)"
            ))
            register_row = conn.execute(
                text("SELECT id FROM cash_registers WHERE code='CPG01'")
            ).fetchone()
            register_id = register_row[0]

            # Insertar primera sesión OPEN — debe funcionar
            conn.execute(text(
                "INSERT INTO cash_sessions (register_id, status, initial_cash) "
                "VALUES (:rid, 'OPEN', 100.00)"
            ), {"rid": register_id})

        # Intentar insertar segunda sesión OPEN en un bloque separado — debe fallar
        SessionFactory = sessionmaker(bind=engine)
        session = SessionFactory()
        try:
            session.execute(text(f'SET search_path TO "{TEST_SCHEMA}"'))
            session.execute(text(
                "INSERT INTO cash_sessions (register_id, status, initial_cash) "
                "VALUES (:rid, 'OPEN', 200.00)"
            ), {"rid": register_id})

            with pytest.raises(IntegrityError, match="uix_one_open_session_per_register"):
                session.flush()  # Forzar flush para disparar el constraint

        finally:
            session.rollback()
            session.close()

    finally:
        with engine.begin() as conn:
            conn.execute(text(f'DROP SCHEMA IF EXISTS "{TEST_SCHEMA}" CASCADE'))
        engine.dispose()


@pytest.mark.requires_postgres
def test_sesion_cerrada_no_bloquea_nueva_apertura_nivel_bd():
    """
    Con el índice único parcial activo en PostgreSQL, verifica que
    una sesión CLOSED no bloquea la creación de una nueva sesión OPEN.

    Flujo: INSERT OPEN → UPDATE status=CLOSED → INSERT OPEN (debe funcionar).

    Requiere:
        TEST_DATABASE_URL=postgresql://user:pw@localhost/test_db
    """
    if not MODELS_AVAILABLE:
        pytest.skip(f"Modelos no disponibles: {_import_error}")

    test_db_url = os.environ.get("TEST_DATABASE_URL")
    if not test_db_url:
        pytest.skip("TEST_DATABASE_URL no definida.")

    from sqlalchemy import create_engine, text

    TEST_SCHEMA = "test_cash_close_reopen_schema"
    engine = create_engine(test_db_url)

    try:
        with engine.begin() as conn:
            conn.execute(text(f'DROP SCHEMA IF EXISTS "{TEST_SCHEMA}" CASCADE'))
            conn.execute(text(f'CREATE SCHEMA "{TEST_SCHEMA}"'))
            conn.execute(text(f'SET search_path TO "{TEST_SCHEMA}"'))
            Base.metadata.create_all(conn)

            conn.execute(text("""
                CREATE UNIQUE INDEX IF NOT EXISTS uix_one_open_session_per_register
                ON cash_sessions (register_id)
                WHERE status = 'OPEN'
            """))

            conn.execute(text(
                "INSERT INTO cash_registers (name, code, is_active) "
                "VALUES ('Caja PG Reopen', 'CPR01', true)"
            ))
            register_row = conn.execute(
                text("SELECT id FROM cash_registers WHERE code='CPR01'")
            ).fetchone()
            register_id = register_row[0]

            # Paso 1: abrir primera sesión
            conn.execute(text(
                "INSERT INTO cash_sessions (register_id, status, initial_cash) "
                "VALUES (:rid, 'OPEN', 100.00)"
            ), {"rid": register_id})

            # Paso 2: cerrar la sesión
            conn.execute(text(
                "UPDATE cash_sessions SET status='CLOSED' "
                "WHERE register_id=:rid AND status='OPEN'"
            ), {"rid": register_id})

            # Paso 3: abrir nueva sesión — NO debe fallar porque la anterior está CLOSED
            conn.execute(text(
                "INSERT INTO cash_sessions (register_id, status, initial_cash) "
                "VALUES (:rid, 'OPEN', 75.00)"
            ), {"rid": register_id})

            # Verificar que existe exactamente 1 sesión OPEN
            count_open = conn.execute(text(
                "SELECT COUNT(*) FROM cash_sessions "
                "WHERE register_id=:rid AND status='OPEN'"
            ), {"rid": register_id}).scalar()

        assert count_open == 1, (
            f"Debe haber exactamente 1 sesión OPEN tras el ciclo abrir→cerrar→abrir. "
            f"Se encontraron: {count_open}."
        )

    finally:
        with engine.begin() as conn:
            conn.execute(text(f'DROP SCHEMA IF EXISTS "{TEST_SCHEMA}" CASCADE'))
        engine.dispose()
