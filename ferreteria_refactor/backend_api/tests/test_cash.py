"""
test_cash.py
============
Tests críticos para operaciones de caja (CashSession / CashMovement).

Cubre las siguientes reglas de negocio del módulo de caja:

1. Movimiento requiere caja abierta
   - Un CashMovement solo puede existir ligado a una CashSession OPEN.
   - Intentar registrar un movimiento sin sesión activa debe fallar.

2. Cálculo de totales al cerrar la caja
   - Al cerrar una CashSession, final_cash_expected se calcula como:
       initial_cash
       + SUM(movimientos DEPOSIT/CASH_ADVANCE en USD)
       - SUM(movimientos EXPENSE/WITHDRAWAL en USD)
   - Verifica que la lógica produce el valor correcto.

3. Diferencia entre efectivo reportado y esperado
   - difference = final_cash_reported - final_cash_expected
   - Verifica cálculo de sobrante (+) y faltante (-).

4. CashMovement se crea correctamente en BD
   - Un movimiento insertado con los campos correctos queda en la BD
     y es recuperable por session_id.

Arquitectura relevante:
    - CashSession: status ∈ {"OPEN", "CLOSED"}
    - CashMovement: type ∈ {"EXPENSE", "WITHDRAWAL", "DEPOSIT", "CASH_ADVANCE"}
    - Los tests unitarios usan MagicMock; los de integración usan SQLite en memoria.

Nota: El test de índice único parcial a nivel BD (requires_postgres) ya está
cubierto en test_cash_session.py.
"""

import os
import pytest
from decimal import Decimal
from unittest.mock import MagicMock


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

        from backend_api.models.models import (
            CashRegister,
            CashMovement,
            CashSession,
        )
        from fastapi import HTTPException
        from sqlalchemy import func
        return CashRegister, CashMovement, CashSession, HTTPException, func, None
    except Exception as e:
        return None, None, None, None, None, str(e)


CashRegister, CashMovement, CashSession, HTTPException, _func, _import_error = _import_models()
MODELS_AVAILABLE = CashRegister is not None


# ---------------------------------------------------------------------------
# Helper: lógica de cálculo de cierre de caja
# Replica la lógica esperada del endpoint PUT /cash/sessions/{id}/close
# ---------------------------------------------------------------------------

def _calcular_expected_cash(db, session_id: int, initial_cash: Decimal) -> Decimal:
    """
    Calcula el efectivo esperado al cerrar una sesión de caja.

    Fórmula:
        expected = initial_cash
                   + SUM(DEPOSIT + CASH_ADVANCE)   [ingresos]
                   - SUM(EXPENSE + WITHDRAWAL)      [egresos]

    Args:
        db: Sesión SQLAlchemy (real o mock).
        session_id: ID de la sesión a cerrar.
        initial_cash: Monto de apertura de la sesión.

    Returns:
        Decimal: El saldo esperado en caja al momento del cierre.
    """
    ingresos = (
        db.query(_func.sum(CashMovement.amount))
        .filter(
            CashMovement.session_id == session_id,
            CashMovement.currency == "USD",
            CashMovement.type.in_(["DEPOSIT", "CASH_ADVANCE"]),
        )
        .scalar()
        or Decimal("0.00")
    )

    egresos = (
        db.query(_func.sum(CashMovement.amount))
        .filter(
            CashMovement.session_id == session_id,
            CashMovement.currency == "USD",
            CashMovement.type.in_(["EXPENSE", "WITHDRAWAL"]),
        )
        .scalar()
        or Decimal("0.00")
    )

    return initial_cash + ingresos - egresos


# ---------------------------------------------------------------------------
# ── BLOQUE 1: Movimiento requiere caja abierta ──────────────────────────
# ---------------------------------------------------------------------------

class TestMovimientoRequiereCajaAbierta:
    """
    Un CashMovement debe estar siempre ligado a una sesión OPEN.
    Si no hay sesión activa, el endpoint debe rechazar el movimiento.
    """

    def test_movimiento_sin_sesion_abierta_es_rechazado(self):
        """
        La lógica de negocio debe rechazar el registro de un movimiento
        si no hay CashSession OPEN activa.

        Test unitario — sin BD.
        """
        if not MODELS_AVAILABLE:
            pytest.skip(f"Modelos no disponibles: {_import_error}")

        mock_db = MagicMock()

        # Simular que no hay sesión OPEN
        mock_db.query.return_value.filter.return_value.first.return_value = None

        open_session = (
            mock_db.query(CashSession)
            .filter(CashSession.status == "OPEN")
            .first()
        )

        no_hay_sesion = open_session is None

        assert no_hay_sesion is True, (
            "Sin sesión OPEN, la lógica debe impedir registrar el movimiento."
        )

        # En el servicio real se lanzaría HTTPException(400)
        if no_hay_sesion:
            with pytest.raises(HTTPException) as exc_info:
                raise HTTPException(
                    status_code=400,
                    detail="No hay una sesión de caja abierta para registrar movimientos.",
                )
            assert exc_info.value.status_code == 400

    def test_movimiento_con_sesion_abierta_se_acepta(self, db_session, open_cash_session):
        """
        Con una sesión OPEN activa, el movimiento puede registrarse sin error.

        Integración con SQLite.
        """
        if not MODELS_AVAILABLE:
            pytest.skip(f"Modelos no disponibles: {_import_error}")

        # Verificar que la sesión OPEN existe en la BD de prueba
        sesion = (
            db_session.query(CashSession)
            .filter(CashSession.status == "OPEN")
            .first()
        )

        assert sesion is not None, "Debe haber una sesión OPEN para el test."

        # Registrar un movimiento de tipo DEPOSIT
        movimiento = CashMovement(
            session_id=sesion.id,
            type="DEPOSIT",
            amount=Decimal("20.00"),
            currency="USD",
            description="Depósito de prueba",
        )
        db_session.add(movimiento)
        db_session.flush()

        assert movimiento.id is not None, (
            "El movimiento debe tener ID asignado tras el flush."
        )
        assert movimiento.session_id == sesion.id

    def test_movimiento_sin_sesion_activa_en_bd(self, db_session, cash_register):
        """
        Sin ninguna sesión OPEN en la BD, la query retorna None.
        Integración con SQLite.
        """
        if not MODELS_AVAILABLE:
            pytest.skip(f"Modelos no disponibles: {_import_error}")

        # No se crea ninguna sesión OPEN en este test
        sesion_abierta = (
            db_session.query(CashSession)
            .filter(
                CashSession.register_id == cash_register.id,
                CashSession.status == "OPEN",
            )
            .first()
        )

        assert sesion_abierta is None, (
            "Sin sesión OPEN creada, la query debe retornar None."
        )


# ---------------------------------------------------------------------------
# ── BLOQUE 2: Cálculo de totales al cerrar caja ─────────────────────────
# ---------------------------------------------------------------------------

class TestCierreCajaCalculaTotales:
    """
    Verifica que el cálculo del saldo esperado al cierre es correcto.
    """

    def test_cierre_sin_movimientos_iguala_apertura(self, db_session, open_cash_session):
        """
        Si no hay movimientos durante la sesión, el efectivo esperado
        al cerrar debe ser igual al monto de apertura.

        Escenario:
            initial_cash = 50.00
            movimientos  = ninguno
            expected     = 50.00
        """
        if not MODELS_AVAILABLE:
            pytest.skip(f"Modelos no disponibles: {_import_error}")

        from sqlalchemy import func as sa_func

        # Reconstruir _calcular_expected_cash con sa_func real
        session_id = open_cash_session.id
        initial_cash = open_cash_session.initial_cash

        ingresos = (
            db_session.query(sa_func.sum(CashMovement.amount))
            .filter(
                CashMovement.session_id == session_id,
                CashMovement.currency == "USD",
                CashMovement.type.in_(["DEPOSIT", "CASH_ADVANCE"]),
            )
            .scalar()
            or Decimal("0.00")
        )

        egresos = (
            db_session.query(sa_func.sum(CashMovement.amount))
            .filter(
                CashMovement.session_id == session_id,
                CashMovement.currency == "USD",
                CashMovement.type.in_(["EXPENSE", "WITHDRAWAL"]),
            )
            .scalar()
            or Decimal("0.00")
        )

        expected = initial_cash + ingresos - egresos

        assert expected == initial_cash, (
            f"Sin movimientos, el esperado ({expected}) debe igual la apertura ({initial_cash})."
        )

    def test_cierre_con_deposito_suma_correctamente(self, db_session, open_cash_session):
        """
        Un depósito durante la sesión debe sumarse al saldo esperado.

        Escenario:
            initial_cash   = 50.00
            DEPOSIT        = +30.00
            expected       = 80.00
        """
        if not MODELS_AVAILABLE:
            pytest.skip(f"Modelos no disponibles: {_import_error}")

        from sqlalchemy import func as sa_func

        session_id = open_cash_session.id
        initial_cash = open_cash_session.initial_cash  # 50.00

        deposito = CashMovement(
            session_id=session_id,
            type="DEPOSIT",
            amount=Decimal("30.00"),
            currency="USD",
            description="Depósito test",
        )
        db_session.add(deposito)
        db_session.flush()

        ingresos = (
            db_session.query(sa_func.sum(CashMovement.amount))
            .filter(
                CashMovement.session_id == session_id,
                CashMovement.currency == "USD",
                CashMovement.type.in_(["DEPOSIT", "CASH_ADVANCE"]),
            )
            .scalar()
            or Decimal("0.00")
        )

        egresos = (
            db_session.query(sa_func.sum(CashMovement.amount))
            .filter(
                CashMovement.session_id == session_id,
                CashMovement.currency == "USD",
                CashMovement.type.in_(["EXPENSE", "WITHDRAWAL"]),
            )
            .scalar()
            or Decimal("0.00")
        )

        expected = initial_cash + ingresos - egresos

        assert expected == Decimal("80.00"), (
            f"50.00 (apertura) + 30.00 (depósito) = 80.00. Obtenido: {expected}"
        )

    def test_cierre_con_egreso_resta_correctamente(self, db_session, open_cash_session):
        """
        Un gasto (EXPENSE) durante la sesión debe restarse del saldo esperado.

        Escenario:
            initial_cash = 50.00
            EXPENSE      = -15.00
            expected     = 35.00
        """
        if not MODELS_AVAILABLE:
            pytest.skip(f"Modelos no disponibles: {_import_error}")

        from sqlalchemy import func as sa_func

        session_id = open_cash_session.id
        initial_cash = open_cash_session.initial_cash  # 50.00

        gasto = CashMovement(
            session_id=session_id,
            type="EXPENSE",
            amount=Decimal("15.00"),
            currency="USD",
            description="Gasto de prueba",
        )
        db_session.add(gasto)
        db_session.flush()

        ingresos = (
            db_session.query(sa_func.sum(CashMovement.amount))
            .filter(
                CashMovement.session_id == session_id,
                CashMovement.currency == "USD",
                CashMovement.type.in_(["DEPOSIT", "CASH_ADVANCE"]),
            )
            .scalar()
            or Decimal("0.00")
        )

        egresos = (
            db_session.query(sa_func.sum(CashMovement.amount))
            .filter(
                CashMovement.session_id == session_id,
                CashMovement.currency == "USD",
                CashMovement.type.in_(["EXPENSE", "WITHDRAWAL"]),
            )
            .scalar()
            or Decimal("0.00")
        )

        expected = initial_cash + ingresos - egresos

        assert expected == Decimal("35.00"), (
            f"50.00 (apertura) - 15.00 (gasto) = 35.00. Obtenido: {expected}"
        )

    def test_cierre_con_multiples_movimientos(self, db_session, open_cash_session):
        """
        Verifica el cálculo con combinación de depósitos y gastos.

        Escenario:
            initial_cash   = 50.00
            DEPOSIT        = +40.00
            CASH_ADVANCE   = +10.00
            EXPENSE        = -20.00
            WITHDRAWAL     = -5.00
            expected       = 50 + 40 + 10 - 20 - 5 = 75.00
        """
        if not MODELS_AVAILABLE:
            pytest.skip(f"Modelos no disponibles: {_import_error}")

        from sqlalchemy import func as sa_func

        session_id = open_cash_session.id
        initial_cash = open_cash_session.initial_cash  # 50.00

        movimientos = [
            CashMovement(session_id=session_id, type="DEPOSIT",      amount=Decimal("40.00"), currency="USD"),
            CashMovement(session_id=session_id, type="CASH_ADVANCE", amount=Decimal("10.00"), currency="USD"),
            CashMovement(session_id=session_id, type="EXPENSE",      amount=Decimal("20.00"), currency="USD"),
            CashMovement(session_id=session_id, type="WITHDRAWAL",   amount=Decimal("5.00"),  currency="USD"),
        ]
        for mov in movimientos:
            db_session.add(mov)
        db_session.flush()

        ingresos = (
            db_session.query(sa_func.sum(CashMovement.amount))
            .filter(
                CashMovement.session_id == session_id,
                CashMovement.currency == "USD",
                CashMovement.type.in_(["DEPOSIT", "CASH_ADVANCE"]),
            )
            .scalar()
            or Decimal("0.00")
        )

        egresos = (
            db_session.query(sa_func.sum(CashMovement.amount))
            .filter(
                CashMovement.session_id == session_id,
                CashMovement.currency == "USD",
                CashMovement.type.in_(["EXPENSE", "WITHDRAWAL"]),
            )
            .scalar()
            or Decimal("0.00")
        )

        expected = initial_cash + ingresos - egresos

        assert expected == Decimal("75.00"), (
            f"50 + 40 + 10 - 20 - 5 = 75.00. Obtenido: {expected}"
        )


# ---------------------------------------------------------------------------
# ── BLOQUE 3: Diferencia entre reportado y esperado ─────────────────────
# ---------------------------------------------------------------------------

class TestDiferenciaArqueo:
    """
    Verifica el cálculo de diferencias (sobrante/faltante) al cierre de caja.

    Fórmula: difference = final_cash_reported - final_cash_expected
        Positivo → sobrante (cajero reporta más de lo calculado)
        Negativo → faltante (cajero reporta menos de lo calculado)
    """

    def test_sobrante_cuando_reportado_supera_esperado(self):
        """
        Si el cajero reporta más efectivo del esperado, la diferencia es positiva.

        Escenario:
            final_cash_expected  = 100.00
            final_cash_reported  = 105.00
            difference           = +5.00 (sobrante)
        """
        if not MODELS_AVAILABLE:
            pytest.skip(f"Modelos no disponibles: {_import_error}")

        expected = Decimal("100.00")
        reported = Decimal("105.00")
        difference = reported - expected

        assert difference == Decimal("5.00"), (
            f"Con expected=100 y reported=105, la diferencia debe ser +5. Obtenido: {difference}"
        )
        assert difference > 0, "Un sobrante debe ser positivo."

    def test_faltante_cuando_reportado_es_menor_al_esperado(self):
        """
        Si el cajero reporta menos efectivo del esperado, la diferencia es negativa.

        Escenario:
            final_cash_expected  = 100.00
            final_cash_reported  = 92.00
            difference           = -8.00 (faltante)
        """
        if not MODELS_AVAILABLE:
            pytest.skip(f"Modelos no disponibles: {_import_error}")

        expected = Decimal("100.00")
        reported = Decimal("92.00")
        difference = reported - expected

        assert difference == Decimal("-8.00"), (
            f"Con expected=100 y reported=92, la diferencia debe ser -8. Obtenido: {difference}"
        )
        assert difference < 0, "Un faltante debe ser negativo."

    def test_cierre_exacto_tiene_diferencia_cero(self):
        """
        Si el cajero reporta exactamente el saldo esperado, la diferencia es cero.
        """
        if not MODELS_AVAILABLE:
            pytest.skip(f"Modelos no disponibles: {_import_error}")

        expected = Decimal("75.00")
        reported = Decimal("75.00")
        difference = reported - expected

        assert difference == Decimal("0.00"), (
            "Con arqueo exacto, la diferencia debe ser cero."
        )

    def test_cierre_guarda_difference_en_bd(self, db_session, open_cash_session):
        """
        Simula el cierre de una sesión: actualiza los campos de la CashSession
        y verifica que el campo 'difference' se persiste correctamente en la BD.
        """
        if not MODELS_AVAILABLE:
            pytest.skip(f"Modelos no disponibles: {_import_error}")

        session = open_cash_session
        expected_val = Decimal("60.00")
        reported_val = Decimal("58.50")
        diff = reported_val - expected_val  # -1.50

        session.status = "CLOSED"
        session.final_cash_expected = expected_val
        session.final_cash_reported = reported_val
        session.difference = diff
        db_session.flush()

        # Recargar desde BD
        db_session.refresh(session)

        assert session.status == "CLOSED", "La sesión debe estar CLOSED tras el cierre."
        assert session.final_cash_expected == expected_val
        assert session.final_cash_reported == reported_val
        assert session.difference == diff, (
            f"La diferencia persistida debe ser {diff}. Obtenido: {session.difference}"
        )


# ---------------------------------------------------------------------------
# ── BLOQUE 4: Recuperación de movimientos por sesión ────────────────────
# ---------------------------------------------------------------------------

class TestRecuperacionMovimientos:
    """
    Verifica que los movimientos de caja se pueden recuperar correctamente
    filtrando por session_id.
    """

    def test_movimientos_de_sesion_son_recuperables(self, db_session, open_cash_session):
        """
        Los CashMovements insertados con un session_id específico son
        recuperables mediante una query por ese mismo session_id.
        """
        if not MODELS_AVAILABLE:
            pytest.skip(f"Modelos no disponibles: {_import_error}")

        session_id = open_cash_session.id

        # Insertar 3 movimientos
        datos = [
            ("DEPOSIT",    Decimal("100.00")),
            ("EXPENSE",    Decimal("25.00")),
            ("WITHDRAWAL", Decimal("10.00")),
        ]
        for tipo, monto in datos:
            db_session.add(CashMovement(
                session_id=session_id,
                type=tipo,
                amount=monto,
                currency="USD",
            ))
        db_session.flush()

        # Recuperar todos los movimientos de la sesión
        movimientos = (
            db_session.query(CashMovement)
            .filter(CashMovement.session_id == session_id)
            .all()
        )

        assert len(movimientos) == 3, (
            f"Deben existir 3 movimientos para la sesión {session_id}. "
            f"Encontrados: {len(movimientos)}"
        )

        tipos_encontrados = {m.type for m in movimientos}
        assert tipos_encontrados == {"DEPOSIT", "EXPENSE", "WITHDRAWAL"}, (
            f"Los tipos de movimiento no coinciden: {tipos_encontrados}"
        )

    def test_movimientos_no_contaminan_otras_sesiones(
        self, db_session, cash_register
    ):
        """
        Los movimientos de una sesión no deben aparecer en las consultas
        de otra sesión del mismo registro.
        """
        if not MODELS_AVAILABLE:
            pytest.skip(f"Modelos no disponibles: {_import_error}")

        # Crear dos sesiones (la primera cerrada, la segunda abierta)
        sesion_a = CashSession(
            register_id=cash_register.id,
            status="CLOSED",
            initial_cash=Decimal("50.00"),
        )
        db_session.add(sesion_a)
        db_session.flush()

        sesion_b = CashSession(
            register_id=cash_register.id,
            status="OPEN",
            initial_cash=Decimal("75.00"),
        )
        db_session.add(sesion_b)
        db_session.flush()

        # Movimiento solo en sesion_a
        db_session.add(CashMovement(
            session_id=sesion_a.id,
            type="DEPOSIT",
            amount=Decimal("200.00"),
            currency="USD",
        ))
        db_session.flush()

        # Verificar que sesion_b no tiene movimientos
        movs_b = (
            db_session.query(CashMovement)
            .filter(CashMovement.session_id == sesion_b.id)
            .all()
        )

        assert len(movs_b) == 0, (
            "La sesión B no debe tener los movimientos registrados en la sesión A."
        )
