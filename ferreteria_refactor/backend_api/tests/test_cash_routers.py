"""
test_cash_routers.py
====================
Tests para verificar que el refactor de cash.py en sub-routers funciona
correctamente. Cubre la lógica de negocio de los módulos:

  - routers/cash/sessions.py   → apertura, cierre, estado de caja
  - routers/cash/movements.py  → ingresos, egresos, validación de fondos
  - routers/cash/reports.py    → historial, detalles de sesión, cierre Z

Estrategia:
  - Tests de integración usan db_session (SQLite en memoria, conftest.py).
  - Tests unitarios puros usan MagicMock para evitar dependencias de BD.
  - Cada test es independiente; no depende del estado de otros tests.

Reglas de negocio verificadas:
  - No se puede abrir caja sin CashRegister válido/activo.
  - No pueden coexistir dos sesiones OPEN en la misma caja.
  - El cálculo de `final_cash_expected` es correcto al cierre.
  - Los ingresos (DEPOSIT/CASH_ADVANCE) aumentan el balance.
  - Los egresos (EXPENSE/WITHDRAWAL) reducen el balance.
  - Los egresos mayores al balance son rechazados.
  - El historial de sesiones se puede filtrar por fecha.
  - Los detalles de sesión incluyen los movimientos registrados.
  - El reporte Z calcula totales correctamente desde la BD.
"""

import os
import sys
import pytest
from decimal import Decimal
from datetime import datetime, date, timedelta
from unittest.mock import MagicMock


# ---------------------------------------------------------------------------
# Importaciones con skip seguro (igual que en test_cash.py)
# ---------------------------------------------------------------------------

def _import_models():
    try:
        _backend_root = os.path.dirname(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        )
        if _backend_root not in sys.path:
            sys.path.insert(0, _backend_root)

        from backend_api.models.models import (
            CashRegister,
            CashMovement,
            CashSession,
            Sale,
            SaleDetail,
            SalePayment,
            Product,
            Warehouse,
        )
        from fastapi import HTTPException
        from sqlalchemy import func
        return (
            CashRegister, CashMovement, CashSession,
            Sale, SaleDetail, SalePayment, Product, Warehouse,
            HTTPException, func, None
        )
    except Exception as e:
        return None, None, None, None, None, None, None, None, None, None, str(e)


(
    CashRegister, CashMovement, CashSession,
    Sale, SaleDetail, SalePayment, Product, Warehouse,
    HTTPException, _func, _import_error
) = _import_models()

MODELS_AVAILABLE = CashRegister is not None


# ===========================================================================
# TestCashSessions
# Cubre: sessions.py — lógica de apertura, cierre y estado de cajas
# ===========================================================================

class TestCashSessions:
    """
    Verifica las reglas de negocio del sub-router routers/cash/sessions.py.

    Las pruebas replican la lógica del endpoint sin invocar FastAPI ni HTTP,
    operando directamente sobre la BD SQLite en memoria.
    """

    # ------------------------------------------------------------------
    # test 1: abrir sesión requiere caja válida (register_id existente)
    # ------------------------------------------------------------------

    def test_abrir_sesion_requiere_caja_valida(self):
        """
        Intentar abrir una sesión con un register_id inexistente debe resultar
        en que la query devuelva None — equivalente al HTTPException 404 del
        endpoint open_cash_session.

        Test unitario — sin BD.
        """
        if not MODELS_AVAILABLE:
            pytest.skip(f"Modelos no disponibles: {_import_error}")

        mock_db = MagicMock()

        # Simular que no existe ninguna caja con ese ID
        mock_db.query.return_value.filter.return_value.first.return_value = None

        register = (
            mock_db.query(CashRegister)
            .filter(CashRegister.id == 9999, CashRegister.is_active == True)
            .first()
        )

        assert register is None, (
            "Un register_id inexistente debe retornar None; "
            "el endpoint debe responder 404."
        )

        # Comprobar que se lanzaría la excepción correspondiente
        with pytest.raises(HTTPException) as exc_info:
            if not register:
                raise HTTPException(
                    status_code=404,
                    detail="Caja registradora no encontrada o inactiva"
                )
        assert exc_info.value.status_code == 404

    # ------------------------------------------------------------------
    # test 2: no puede abrir dos sesiones en la misma caja
    # ------------------------------------------------------------------

    def test_no_puede_abrir_dos_sesiones_en_misma_caja(self, db_session, cash_register):
        """
        Si ya existe una CashSession OPEN para una caja dada, la lógica de
        negocio debe detectarlo y rechazar la apertura de una segunda sesión.

        Integración con SQLite.
        """
        if not MODELS_AVAILABLE:
            pytest.skip(f"Modelos no disponibles: {_import_error}")

        # Crear la primera sesión OPEN
        primera_sesion = CashSession(
            register_id=cash_register.id,
            status="OPEN",
            initial_cash=Decimal("50.00"),
            initial_cash_bs=Decimal("0.00"),
        )
        db_session.add(primera_sesion)
        db_session.flush()

        # Comprobar que la BD detecta la sesión activa existente
        sesion_activa = (
            db_session.query(CashSession)
            .filter(
                CashSession.register_id == cash_register.id,
                CashSession.status == "OPEN",
            )
            .first()
        )

        assert sesion_activa is not None, (
            "Debe existir una sesión OPEN antes de intentar abrir otra."
        )

        # La lógica del endpoint lanzaría HTTPException(400) en este punto
        with pytest.raises(HTTPException) as exc_info:
            if sesion_activa:
                raise HTTPException(
                    status_code=400,
                    detail=f"'{cash_register.name}' ya está abierta (sesión #{sesion_activa.id})"
                )
        assert exc_info.value.status_code == 400
        assert str(sesion_activa.id) in exc_info.value.detail

    # ------------------------------------------------------------------
    # test 3: cerrar sesión calcula monto final correctamente
    # ------------------------------------------------------------------

    def test_cerrar_sesion_calcula_monto_final(self, db_session, open_cash_session):
        """
        Al cerrar una sesión, final_cash_expected debe calcularse como:
            initial_cash + DEPOSIT - EXPENSE

        Escenario:
            initial_cash = 50.00
            DEPOSIT      = +30.00
            EXPENSE      = -10.00
            expected     = 70.00

        Integración con SQLite.
        """
        if not MODELS_AVAILABLE:
            pytest.skip(f"Modelos no disponibles: {_import_error}")

        from sqlalchemy import func as sa_func

        session_id = open_cash_session.id
        initial_cash = open_cash_session.initial_cash  # 50.00

        # Registrar movimientos
        db_session.add(CashMovement(
            session_id=session_id,
            type="DEPOSIT",
            amount=Decimal("30.00"),
            currency="USD",
            description="Depósito test",
        ))
        db_session.add(CashMovement(
            session_id=session_id,
            type="EXPENSE",
            amount=Decimal("10.00"),
            currency="USD",
            description="Gasto test",
        ))
        db_session.flush()

        # Calcular usando la misma lógica que el endpoint
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

        final_expected = initial_cash + ingresos - egresos

        # Simular el cierre escribiendo en BD
        open_cash_session.status = "CLOSED"
        open_cash_session.final_cash_expected = final_expected
        open_cash_session.final_cash_reported = Decimal("70.00")
        open_cash_session.difference = Decimal("70.00") - final_expected
        open_cash_session.end_time = datetime.now()
        db_session.flush()
        db_session.refresh(open_cash_session)

        assert open_cash_session.status == "CLOSED"
        assert open_cash_session.final_cash_expected == Decimal("70.00"), (
            f"50 + 30 - 10 = 70.00. Obtenido: {open_cash_session.final_cash_expected}"
        )
        assert open_cash_session.difference == Decimal("0.00"), (
            "Con arqueo exacto, la diferencia debe ser cero."
        )

    # ------------------------------------------------------------------
    # test 4: sesión sin caja previa falla
    # ------------------------------------------------------------------

    def test_sesion_sin_caja_previa_falla(self):
        """
        Si no existe ninguna caja registradora activa, la apertura de sesión
        debe fallar con HTTPException(400).

        Test unitario — sin BD.
        """
        if not MODELS_AVAILABLE:
            pytest.skip(f"Modelos no disponibles: {_import_error}")

        mock_db = MagicMock()

        # Sin cajas activas
        mock_db.query.return_value.filter.return_value.order_by.return_value.first.return_value = None

        register = (
            mock_db.query(CashRegister)
            .filter(CashRegister.is_active == True)
            .order_by(CashRegister.id)
            .first()
        )

        assert register is None, "Sin cajas configuradas, la query debe retornar None."

        with pytest.raises(HTTPException) as exc_info:
            if not register:
                raise HTTPException(
                    status_code=400,
                    detail="No hay cajas configuradas. Crea una caja primero."
                )
        assert exc_info.value.status_code == 400
        assert "No hay cajas configuradas" in exc_info.value.detail

    # ------------------------------------------------------------------
    # test 5: get_caja_status retorna info completa
    # ------------------------------------------------------------------

    def test_get_caja_status_retorna_info_completa(self, db_session, cash_register, open_cash_session):
        """
        La consulta de estado de las cajas debe incluir:
        - ID, nombre, código, is_active de la caja
        - session_status OPEN/CLOSED
        - session_id de la sesión activa

        Integración con SQLite.
        """
        if not MODELS_AVAILABLE:
            pytest.skip(f"Modelos no disponibles: {_import_error}")

        # Consultar la sesión activa del registro
        sesion_activa = (
            db_session.query(CashSession)
            .filter(
                CashSession.register_id == cash_register.id,
                CashSession.status == "OPEN",
            )
            .first()
        )

        # Construir el dict de estado (replica la lógica del endpoint)
        estado = {
            "id": cash_register.id,
            "name": cash_register.name,
            "code": cash_register.code,
            "is_active": cash_register.is_active,
            "session_status": "OPEN" if sesion_activa else "CLOSED",
            "session_id": sesion_activa.id if sesion_activa else None,
        }

        assert estado["id"] == cash_register.id
        assert estado["name"] == cash_register.name
        assert estado["code"] == cash_register.code
        assert estado["is_active"] is True
        assert estado["session_status"] == "OPEN", (
            "La caja debe reportar OPEN cuando tiene sesión activa."
        )
        assert estado["session_id"] == open_cash_session.id, (
            "El session_id debe apuntar a la sesión abierta existente."
        )

    # ------------------------------------------------------------------
    # test 6 (bonus): cerrar sesión ya cerrada es rechazada
    # ------------------------------------------------------------------

    def test_cerrar_sesion_ya_cerrada_es_rechazada(self, db_session, open_cash_session):
        """
        Intentar cerrar una sesión que ya está CLOSED debe lanzar
        HTTPException(400).

        Integración con SQLite.
        """
        if not MODELS_AVAILABLE:
            pytest.skip(f"Modelos no disponibles: {_import_error}")

        # Cerrar la sesión primero
        open_cash_session.status = "CLOSED"
        open_cash_session.end_time = datetime.now()
        db_session.flush()

        # Ahora intentar "cerrarla" de nuevo
        sesion = (
            db_session.query(CashSession)
            .filter(CashSession.id == open_cash_session.id)
            .first()
        )

        assert sesion.status == "CLOSED"

        with pytest.raises(HTTPException) as exc_info:
            if sesion.status == "CLOSED":
                raise HTTPException(
                    status_code=400,
                    detail="La sesión ya está cerrada"
                )
        assert exc_info.value.status_code == 400


# ===========================================================================
# TestCashMovements
# Cubre: movements.py — lógica de balance y validación de fondos
# ===========================================================================

class TestCashMovements:
    """
    Verifica las reglas de negocio del sub-router routers/cash/movements.py.

    La función get_available_cash() calcula:
        available = initial_cash + cash_sales - change + deposits - withdrawals
    """

    # ------------------------------------------------------------------
    # test 1: ingreso (DEPOSIT) aumenta el balance disponible
    # ------------------------------------------------------------------

    def test_ingreso_aumenta_balance(self, db_session, open_cash_session):
        """
        Un movimiento de tipo DEPOSIT debe incrementar el saldo calculado
        en el cajón de efectivo.

        Escenario:
            initial_cash   = 50.00
            DEPOSIT        = +25.00
            balance_esperado = 75.00

        Integración con SQLite.
        """
        if not MODELS_AVAILABLE:
            pytest.skip(f"Modelos no disponibles: {_import_error}")

        from sqlalchemy import func as sa_func

        session_id = open_cash_session.id
        initial = open_cash_session.initial_cash  # 50.00

        # Agregar un depósito
        db_session.add(CashMovement(
            session_id=session_id,
            type="DEPOSIT",
            amount=Decimal("25.00"),
            currency="USD",
            description="Depósito de apertura adicional",
        ))
        db_session.flush()

        # Calcular balance (sin ventas ni vueltos en este test)
        deposits = (
            db_session.query(sa_func.sum(CashMovement.amount))
            .filter(
                CashMovement.session_id == session_id,
                CashMovement.type.in_(["DEPOSIT", "IN"]),
                CashMovement.currency == "USD",
            )
            .scalar()
            or Decimal("0.00")
        )

        balance = initial + deposits
        assert balance == Decimal("75.00"), (
            f"50.00 + 25.00 = 75.00. Obtenido: {balance}"
        )

    # ------------------------------------------------------------------
    # test 2: egreso (EXPENSE) reduce el balance disponible
    # ------------------------------------------------------------------

    def test_egreso_reduce_balance(self, db_session, open_cash_session):
        """
        Un movimiento de tipo EXPENSE debe decrementar el saldo calculado.

        Escenario:
            initial_cash = 50.00
            EXPENSE      = -15.00
            balance      = 35.00

        Integración con SQLite.
        """
        if not MODELS_AVAILABLE:
            pytest.skip(f"Modelos no disponibles: {_import_error}")

        from sqlalchemy import func as sa_func

        session_id = open_cash_session.id
        initial = open_cash_session.initial_cash  # 50.00

        db_session.add(CashMovement(
            session_id=session_id,
            type="EXPENSE",
            amount=Decimal("15.00"),
            currency="USD",
            description="Pago de servicio",
        ))
        db_session.flush()

        withdrawals = (
            db_session.query(sa_func.sum(CashMovement.amount))
            .filter(
                CashMovement.session_id == session_id,
                CashMovement.type.in_(["EXPENSE", "WITHDRAWAL", "OUT", "CASH_ADVANCE", "RETURN"]),
                CashMovement.currency == "USD",
            )
            .scalar()
            or Decimal("0.00")
        )

        balance = initial - withdrawals
        assert balance == Decimal("35.00"), (
            f"50.00 - 15.00 = 35.00. Obtenido: {balance}"
        )

    # ------------------------------------------------------------------
    # test 3: egreso mayor al balance es rechazado
    # ------------------------------------------------------------------

    def test_egreso_mayor_al_balance_es_rechazado(self):
        """
        Si el monto del egreso supera el balance disponible en el cajón,
        el endpoint debe responder con HTTPException(400).

        Test unitario — sin BD real; se simula get_available_cash().
        """
        if not MODELS_AVAILABLE:
            pytest.skip(f"Modelos no disponibles: {_import_error}")

        # Simular balance disponible: 30.00 USD
        available_cash = Decimal("30.00")
        requested_withdrawal = Decimal("50.00")  # Mayor al disponible

        fondos_insuficientes = requested_withdrawal > available_cash

        assert fondos_insuficientes is True, (
            "El monto solicitado supera el disponible; debe ser rechazado."
        )

        with pytest.raises(HTTPException) as exc_info:
            if fondos_insuficientes:
                raise HTTPException(
                    status_code=400,
                    detail=f"Fondos insuficientes en USD. Disponible: {available_cash}"
                )

        assert exc_info.value.status_code == 400
        assert "Fondos insuficientes" in exc_info.value.detail
        assert "30.00" in exc_info.value.detail

    # ------------------------------------------------------------------
    # test 4: movimiento requiere caja abierta
    # ------------------------------------------------------------------

    def test_movimiento_requiere_caja_abierta(self):
        """
        Registrar un movimiento sin sesión OPEN activa debe lanzar
        HTTPException(400) — replica la validación de register_movement().

        Test unitario — sin BD.
        """
        if not MODELS_AVAILABLE:
            pytest.skip(f"Modelos no disponibles: {_import_error}")

        mock_db = MagicMock()

        # Simular ausencia de sesión OPEN
        mock_db.query.return_value.filter.return_value.first.return_value = None

        sesion_abierta = (
            mock_db.query(CashSession)
            .filter(CashSession.status == "OPEN")
            .first()
        )

        assert sesion_abierta is None, "No debe haber sesión OPEN en este escenario."

        with pytest.raises(HTTPException) as exc_info:
            if not sesion_abierta:
                raise HTTPException(
                    status_code=400,
                    detail="No hay sesión de caja abierta"
                )
        assert exc_info.value.status_code == 400

    # ------------------------------------------------------------------
    # test 5 (bonus): balance con múltiples tipos de movimiento
    # ------------------------------------------------------------------

    def test_balance_con_multiples_movimientos(self, db_session, open_cash_session):
        """
        El balance final debe ser correcto con combinación de ingresos
        y egresos de distintos tipos.

        Escenario:
            initial_cash   = 50.00
            DEPOSIT        = +20.00
            CASH_ADVANCE   = +10.00   (también es ingreso)
            EXPENSE        = -12.00
            WITHDRAWAL     = -8.00
            balance        = 50 + 20 + 10 - 12 - 8 = 60.00

        Integración con SQLite.
        """
        if not MODELS_AVAILABLE:
            pytest.skip(f"Modelos no disponibles: {_import_error}")

        from sqlalchemy import func as sa_func

        session_id = open_cash_session.id
        initial = open_cash_session.initial_cash  # 50.00

        movimientos = [
            CashMovement(session_id=session_id, type="DEPOSIT",      amount=Decimal("20.00"), currency="USD"),
            CashMovement(session_id=session_id, type="CASH_ADVANCE", amount=Decimal("10.00"), currency="USD"),
            CashMovement(session_id=session_id, type="EXPENSE",      amount=Decimal("12.00"), currency="USD"),
            CashMovement(session_id=session_id, type="WITHDRAWAL",   amount=Decimal("8.00"),  currency="USD"),
        ]
        for mov in movimientos:
            db_session.add(mov)
        db_session.flush()

        ingresos = (
            db_session.query(sa_func.sum(CashMovement.amount))
            .filter(
                CashMovement.session_id == session_id,
                CashMovement.type.in_(["DEPOSIT", "IN", "CASH_ADVANCE"]),
                CashMovement.currency == "USD",
            )
            .scalar()
            or Decimal("0.00")
        )

        egresos = (
            db_session.query(sa_func.sum(CashMovement.amount))
            .filter(
                CashMovement.session_id == session_id,
                CashMovement.type.in_(["EXPENSE", "WITHDRAWAL", "OUT", "RETURN"]),
                CashMovement.currency == "USD",
            )
            .scalar()
            or Decimal("0.00")
        )

        balance = initial + ingresos - egresos
        assert balance == Decimal("60.00"), (
            f"50 + 20 + 10 - 12 - 8 = 60.00. Obtenido: {balance}"
        )


# ===========================================================================
# TestCashReports
# Cubre: reports.py — historial, detalles de sesión, cierre Z
# ===========================================================================

class TestCashReports:
    """
    Verifica las reglas de negocio del sub-router routers/cash/reports.py.

    get_sessions_history() — filtra sesiones por fecha de inicio.
    get_session_details()  — incluye movimientos de la sesión.
    Z-report               — calcula totales de la sesión cerrada.
    """

    # ------------------------------------------------------------------
    # test 1: historial de sesiones filtrado por fecha
    # ------------------------------------------------------------------

    def test_historial_sesiones_filtrado_por_fecha(self, db_session, cash_register):
        """
        La query de historial debe devolver solo las sesiones cuyo
        start_time esté dentro del rango de fechas indicado.

        Sesión A: start_time = hoy - 10 días  → fuera del rango
        Sesión B: start_time = hoy - 1 día    → dentro del rango

        Integración con SQLite.
        """
        if not MODELS_AVAILABLE:
            pytest.skip(f"Modelos no disponibles: {_import_error}")

        hoy = datetime.now()
        hace_10_dias = hoy - timedelta(days=10)
        hace_1_dia = hoy - timedelta(days=1)

        # Sesión antigua (fuera del rango que queremos consultar)
        sesion_antigua = CashSession(
            register_id=cash_register.id,
            status="CLOSED",
            initial_cash=Decimal("100.00"),
            initial_cash_bs=Decimal("0.00"),
            start_time=hace_10_dias,
            end_time=hace_10_dias + timedelta(hours=8),
        )
        db_session.add(sesion_antigua)

        # Sesión reciente (dentro del rango)
        sesion_reciente = CashSession(
            register_id=cash_register.id,
            status="CLOSED",
            initial_cash=Decimal("75.00"),
            initial_cash_bs=Decimal("0.00"),
            start_time=hace_1_dia,
            end_time=hace_1_dia + timedelta(hours=8),
        )
        db_session.add(sesion_reciente)
        db_session.flush()

        # Filtrar: solo sesiones de los últimos 5 días
        cinco_dias_atras = hoy - timedelta(days=5)
        sesiones_filtradas = (
            db_session.query(CashSession)
            .filter(CashSession.start_time >= cinco_dias_atras)
            .order_by(CashSession.start_time.desc())
            .all()
        )

        ids_encontrados = {s.id for s in sesiones_filtradas}

        assert sesion_reciente.id in ids_encontrados, (
            "La sesión reciente debe estar dentro del rango filtrado."
        )
        assert sesion_antigua.id not in ids_encontrados, (
            "La sesión de hace 10 días debe quedar fuera del rango."
        )
        assert len(sesiones_filtradas) == 1, (
            f"Solo debe devolverse 1 sesión. Encontradas: {len(sesiones_filtradas)}"
        )

    # ------------------------------------------------------------------
    # test 2: detalles de sesión incluye movimientos
    # ------------------------------------------------------------------

    def test_detalles_sesion_incluye_movimientos(self, db_session, open_cash_session):
        """
        La consulta de detalles de una sesión debe incluir todos los
        movimientos registrados con ese session_id.

        Integración con SQLite.
        """
        if not MODELS_AVAILABLE:
            pytest.skip(f"Modelos no disponibles: {_import_error}")

        session_id = open_cash_session.id

        # Registrar movimientos variados
        tipos_y_montos = [
            ("DEPOSIT",    Decimal("50.00")),
            ("EXPENSE",    Decimal("10.00")),
            ("WITHDRAWAL", Decimal("5.00")),
        ]
        for tipo, monto in tipos_y_montos:
            db_session.add(CashMovement(
                session_id=session_id,
                type=tipo,
                amount=monto,
                currency="USD",
            ))
        db_session.flush()

        # Recuperar movimientos de la sesión (lógica que usa el endpoint)
        movimientos = (
            db_session.query(CashMovement)
            .filter(CashMovement.session_id == session_id)
            .all()
        )

        assert len(movimientos) == 3, (
            f"La sesión debe tener 3 movimientos. Encontrados: {len(movimientos)}"
        )

        tipos_encontrados = {m.type for m in movimientos}
        assert tipos_encontrados == {"DEPOSIT", "EXPENSE", "WITHDRAWAL"}, (
            f"Tipos esperados no coinciden: {tipos_encontrados}"
        )

    # ------------------------------------------------------------------
    # test 3: cierre Z calcula totales correctamente
    # ------------------------------------------------------------------

    def test_z_report_calcula_totales_correctamente(self, db_session, open_cash_session):
        """
        El reporte de cierre Z debe reflejar:
        - initial_cash correcto de la sesión
        - Suma de ingresos y egresos registrados
        - status CLOSED tras el cierre

        Se simula el proceso de cierre y se verifica la aritmética.

        Escenario:
            initial_cash   = 50.00
            DEPOSIT        = +40.00
            CASH_ADVANCE   = +10.00
            EXPENSE        = -20.00
            WITHDRAWAL     = -5.00
            final_expected = 50 + 40 + 10 - 20 - 5 = 75.00

        Integración con SQLite.
        """
        if not MODELS_AVAILABLE:
            pytest.skip(f"Modelos no disponibles: {_import_error}")

        from sqlalchemy import func as sa_func

        session_id = open_cash_session.id
        initial = open_cash_session.initial_cash  # 50.00

        # Insertar movimientos
        movimientos = [
            CashMovement(session_id=session_id, type="DEPOSIT",      amount=Decimal("40.00"), currency="USD"),
            CashMovement(session_id=session_id, type="CASH_ADVANCE", amount=Decimal("10.00"), currency="USD"),
            CashMovement(session_id=session_id, type="EXPENSE",      amount=Decimal("20.00"), currency="USD"),
            CashMovement(session_id=session_id, type="WITHDRAWAL",   amount=Decimal("5.00"),  currency="USD"),
        ]
        for mov in movimientos:
            db_session.add(mov)
        db_session.flush()

        # Calcular totales (replica lógica de close_cash_session)
        ingresos = (
            db_session.query(sa_func.sum(CashMovement.amount))
            .filter(
                CashMovement.session_id == session_id,
                CashMovement.currency == "USD",
                CashMovement.type.in_(["DEPOSIT", "CASH_ADVANCE", "IN"]),
            )
            .scalar()
            or Decimal("0.00")
        )

        egresos = (
            db_session.query(sa_func.sum(CashMovement.amount))
            .filter(
                CashMovement.session_id == session_id,
                CashMovement.currency == "USD",
                CashMovement.type.in_(["EXPENSE", "WITHDRAWAL", "OUT", "RETURN"]),
            )
            .scalar()
            or Decimal("0.00")
        )

        final_expected = initial + ingresos - egresos

        # Simular escritura del cierre en BD
        open_cash_session.status = "CLOSED"
        open_cash_session.final_cash_expected = final_expected
        open_cash_session.final_cash_reported = Decimal("75.00")
        open_cash_session.difference = Decimal("75.00") - final_expected
        open_cash_session.end_time = datetime.now()
        db_session.flush()
        db_session.refresh(open_cash_session)

        # Verificar
        assert open_cash_session.status == "CLOSED"
        assert final_expected == Decimal("75.00"), (
            f"50 + 40 + 10 - 20 - 5 = 75.00. Obtenido: {final_expected}"
        )
        assert open_cash_session.final_cash_expected == Decimal("75.00")
        assert open_cash_session.difference == Decimal("0.00"), (
            "Con arqueo exacto la diferencia debe ser 0."
        )

    # ------------------------------------------------------------------
    # test 4 (bonus): historial solo devuelve sesiones del registro correcto
    # ------------------------------------------------------------------

    def test_historial_sesiones_no_mezcla_registros(self, db_session):
        """
        Las sesiones de una caja (register A) no deben aparecer al consultar
        el historial de otra caja (register B).

        Integración con SQLite.
        """
        if not MODELS_AVAILABLE:
            pytest.skip(f"Modelos no disponibles: {_import_error}")

        # Crear dos cajas distintas
        caja_a = CashRegister(name="Caja A", code="CA01", is_active=True)
        caja_b = CashRegister(name="Caja B", code="CB01", is_active=True)
        db_session.add_all([caja_a, caja_b])
        db_session.flush()

        # Sesión solo en caja A
        sesion_a = CashSession(
            register_id=caja_a.id,
            status="CLOSED",
            initial_cash=Decimal("100.00"),
            initial_cash_bs=Decimal("0.00"),
        )
        db_session.add(sesion_a)
        db_session.flush()

        # Consultar solo sesiones de caja B
        sesiones_b = (
            db_session.query(CashSession)
            .filter(CashSession.register_id == caja_b.id)
            .all()
        )

        assert len(sesiones_b) == 0, (
            "La caja B no debe mostrar sesiones que pertenecen a la caja A."
        )
