"""
test_func_caja_pg.py — Tests funcionales de Caja

Flujos cubiertos:
  F03    — Fórmula de cierre: expected = initial + depósitos - gastos
  F05    — Constraint único: no dos sesiones OPEN en la misma caja
  FCJ02  — Cierre con ventas: efectivo suma al expected, tarjeta NO
  FCJ03  — Diferencia (sobrante/faltante/exacto) se calcula y persiste
  FCJ04  — Estado y timestamps al cerrar la sesión
  FCJ05  — CashSessionCurrency se actualiza correctamente al cerrar
  FCJ06  — Historial: sesiones consultables, vinculadas a register y usuario
  FCJ07  — Integración créditos: ventas a crédito y abonos vinculados a sesión

Correr con:
    cd ferreteria_refactor
    python -m pytest backend_api/tests/test_func_caja_pg.py -v --no-cov -s
"""

import pytest
import uuid
from decimal import Decimal
from datetime import datetime
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

import sys, os
_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _root not in sys.path:
    sys.path.insert(0, _root)

from backend_api.models.models import (
    CashRegister, CashSession, CashMovement, CashSessionCurrency,
    Sale, SalePayment, Customer, Payment,
)

TENANT = "lalicoreria"


# ---------------------------------------------------------------------------
# Fixtures locales
# ---------------------------------------------------------------------------

@pytest.fixture()
def tenant_db(pg_db_for_schema):
    return pg_db_for_schema(TENANT)


@pytest.fixture()
def user_id(pg_engine):
    with pg_engine.connect() as conn:
        row = conn.execute(text("""
            SELECT u.id FROM public.users u
            JOIN public.tenants t ON t.id = u.tenant_id
            WHERE t.schema_name = :schema AND u.role = 'ADMIN' AND u.is_active = TRUE
            LIMIT 1
        """), {"schema": TENANT}).fetchone()
    assert row is not None, f"No hay usuario ADMIN activo en el tenant '{TENANT}'"
    return row[0]


@pytest.fixture()
def cash_register_obj(tenant_db):
    register = CashRegister(
        name=f"Caja Test {uuid.uuid4().hex[:6]}",
        code=f"CTC{uuid.uuid4().hex[:4].upper()}",
        is_active=True,
    )
    tenant_db.add(register)
    tenant_db.flush()
    return register


@pytest.fixture()
def open_session_obj(tenant_db, cash_register_obj, user_id):
    """Sesión OPEN con 100 USD de apertura, lista para operar."""
    session = CashSession(
        register_id=cash_register_obj.id,
        user_id=user_id,
        status="OPEN",
        initial_cash=Decimal("100.00"),
        initial_cash_bs=Decimal("0.00"),
    )
    tenant_db.add(session)
    tenant_db.flush()
    tenant_db.add(CashSessionCurrency(
        session_id=session.id,
        currency_symbol="USD",
        initial_amount=Decimal("100.00"),
    ))
    tenant_db.flush()
    return session


@pytest.fixture()
def customer_obj(tenant_db):
    customer = Customer(name=f"Cliente Test {uuid.uuid4().hex[:6]}")
    tenant_db.add(customer)
    tenant_db.flush()
    return customer


# ---------------------------------------------------------------------------
# Helper: replica la fórmula de cierre del router (sin WebSocket ni db.commit)
# ---------------------------------------------------------------------------

def _close_session(
    db,
    session,
    reported_usd,
    *,
    deposits=Decimal("0"),
    expenses=Decimal("0"),
    cash_sales=Decimal("0"),
    debt_payments=Decimal("0"),
    change=Decimal("0"),
):
    """
    Replica la lógica central de sessions.py:close_session() a nivel ORM.

    Fórmula del router:
        expected = initial + cash_sales + debt_payments - change + deposits - expenses

    Actualiza: session.status, session.end_time, session.final_cash_*,
    session.difference y CashSessionCurrency USD.
    """
    expected = (
        session.initial_cash
        + cash_sales
        + debt_payments
        - change
        + deposits
        - expenses
    )

    session.status = "CLOSED"
    session.end_time = datetime.utcnow()
    session.final_cash_expected = expected
    session.final_cash_reported = reported_usd
    session.difference = reported_usd - expected

    # Actualizar el registro de CashSessionCurrency para USD
    currency = db.query(CashSessionCurrency).filter_by(
        session_id=session.id, currency_symbol="USD"
    ).first()
    if currency:
        currency.final_expected = expected
        currency.final_reported = reported_usd
        currency.difference = reported_usd - expected

    db.flush()
    return expected


# ---------------------------------------------------------------------------
# F03 — Fórmula de cierre calcula expected correcto
# ---------------------------------------------------------------------------

class TestF03CierreCaja:

    def test_cierre_sin_movimientos_expected_igual_a_initial(
        self, tenant_db, open_session_obj
    ):
        """
        F03a: Sin ventas ni movimientos, expected == initial_cash (100 USD).
        """
        session = open_session_obj
        expected = _close_session(tenant_db, session, reported_usd=Decimal("100.00"))

        assert expected == Decimal("100.00")
        tenant_db.refresh(session)
        assert session.status == "CLOSED"
        assert session.final_cash_expected == Decimal("100.00")
        assert session.difference == Decimal("0.00")

    def test_cierre_con_deposito_suma_al_expected(
        self, tenant_db, open_session_obj
    ):
        """
        F03b: DEPOSIT de 50 USD → expected = 100 + 50 = 150.
        """
        session = open_session_obj
        tenant_db.add(CashMovement(
            session_id=session.id, type="DEPOSIT",
            amount=Decimal("50.00"), currency="USD", description="Depósito prueba",
        ))
        tenant_db.flush()

        expected = _close_session(tenant_db, session,
                                   reported_usd=Decimal("150.00"),
                                   deposits=Decimal("50.00"))
        assert expected == Decimal("150.00")

    def test_cierre_con_gasto_resta_del_expected(
        self, tenant_db, open_session_obj
    ):
        """
        F03c: EXPENSE de 20 USD → expected = 100 - 20 = 80.
        """
        session = open_session_obj
        tenant_db.add(CashMovement(
            session_id=session.id, type="EXPENSE",
            amount=Decimal("20.00"), currency="USD", description="Gasto prueba",
        ))
        tenant_db.flush()

        expected = _close_session(tenant_db, session,
                                   reported_usd=Decimal("80.00"),
                                   expenses=Decimal("20.00"))
        assert expected == Decimal("80.00")

    def test_cierre_formula_completa(self, tenant_db, open_session_obj):
        """
        F03d: initial=100, depósito=50, gasto=20 → expected=130, difference=0.
        """
        session = open_session_obj
        tenant_db.add(CashMovement(session_id=session.id, type="DEPOSIT",
                                    amount=Decimal("50.00"), currency="USD", description="D"))
        tenant_db.add(CashMovement(session_id=session.id, type="EXPENSE",
                                    amount=Decimal("20.00"), currency="USD", description="G"))
        tenant_db.flush()

        expected = _close_session(tenant_db, session,
                                   reported_usd=Decimal("130.00"),
                                   deposits=Decimal("50.00"),
                                   expenses=Decimal("20.00"))

        assert expected == Decimal("130.00")
        tenant_db.refresh(session)
        assert session.difference == Decimal("0.00")


# ---------------------------------------------------------------------------
# F05 — No se pueden abrir dos sesiones OPEN en el mismo registro
# ---------------------------------------------------------------------------

class TestF05DobleCaja:

    def test_una_sola_sesion_open_por_registro(
        self, tenant_db, cash_register_obj, user_id
    ):
        """
        F05: El índice único parcial (WHERE status='OPEN') impide dos sesiones
        OPEN simultáneas para el mismo register_id → IntegrityError.
        """
        tenant_db.add(CashSession(
            register_id=cash_register_obj.id, user_id=user_id, status="OPEN",
            initial_cash=Decimal("100.00"), initial_cash_bs=Decimal("0.00"),
        ))
        tenant_db.flush()

        tenant_db.add(CashSession(
            register_id=cash_register_obj.id, user_id=user_id, status="OPEN",
            initial_cash=Decimal("50.00"), initial_cash_bs=Decimal("0.00"),
        ))
        with pytest.raises(IntegrityError, match="uq_.*one_open_per_register|unique"):
            tenant_db.flush()

    def test_dos_cajas_distintas_pueden_abrirse_juntas(self, tenant_db, user_id):
        """
        F05b: Dos registros distintos SÍ pueden tener sesiones OPEN simultáneas.
        El constraint es por register_id, no global.
        """
        reg_a = CashRegister(name=f"Caja A {uuid.uuid4().hex[:6]}",
                              code=f"CA{uuid.uuid4().hex[:4].upper()}", is_active=True)
        reg_b = CashRegister(name=f"Caja B {uuid.uuid4().hex[:6]}",
                              code=f"CB{uuid.uuid4().hex[:4].upper()}", is_active=True)
        tenant_db.add(reg_a)
        tenant_db.add(reg_b)
        tenant_db.flush()

        tenant_db.add(CashSession(register_id=reg_a.id, user_id=user_id, status="OPEN",
                                   initial_cash=Decimal("100.00"), initial_cash_bs=Decimal("0.00")))
        tenant_db.add(CashSession(register_id=reg_b.id, user_id=user_id, status="OPEN",
                                   initial_cash=Decimal("50.00"), initial_cash_bs=Decimal("0.00")))
        tenant_db.flush()  # No debe lanzar excepción — son registros distintos


# ---------------------------------------------------------------------------
# FCJ02 — Cierre con ventas: efectivo suma, no-efectivo NO suma
# ---------------------------------------------------------------------------

class TestFCJ02CierreConVentas:

    def test_venta_efectivo_suma_al_expected(self, tenant_db, open_session_obj):
        """
        FCJ02a: Venta de 50 USD en Efectivo → expected = 100 + 50 = 150.
        El dinero entró físicamente a la caja.
        """
        session = open_session_obj
        sale = Sale(session_id=session.id, total_amount=Decimal("50.00"),
                    payment_method="Efectivo", is_credit=False, paid=True)
        tenant_db.add(sale)
        tenant_db.flush()
        tenant_db.add(SalePayment(sale_id=sale.id, amount=Decimal("50.00"),
                                   currency="USD", payment_method="Efectivo"))
        tenant_db.flush()

        # Replicar consulta del router: sólo métodos de pago en efectivo
        cash_rows = (
            tenant_db.query(SalePayment).join(Sale)
            .filter(
                Sale.session_id == session.id,
                SalePayment.payment_method.ilike("%efectivo%"),
                SalePayment.currency == "USD",
            )
            .with_entities(SalePayment.amount)
            .all()
        )
        cash_sales = sum(r[0] for r in cash_rows)

        assert cash_sales == Decimal("50.00")
        expected = _close_session(tenant_db, session,
                                   reported_usd=Decimal("150.00"),
                                   cash_sales=cash_sales)
        assert expected == Decimal("150.00")

    def test_venta_tarjeta_no_suma_al_expected_efectivo(self, tenant_db, open_session_obj):
        """
        FCJ02b: Venta de 80 USD con Tarjeta NO modifica el expected de efectivo.
        El dinero va al banco, no a la caja física.
        expected = 100 (initial sin cambios)
        """
        session = open_session_obj
        sale = Sale(session_id=session.id, total_amount=Decimal("80.00"),
                    payment_method="Tarjeta", is_credit=False, paid=True)
        tenant_db.add(sale)
        tenant_db.flush()
        tenant_db.add(SalePayment(sale_id=sale.id, amount=Decimal("80.00"),
                                   currency="USD", payment_method="Tarjeta"))
        tenant_db.flush()

        cash_rows = (
            tenant_db.query(SalePayment).join(Sale)
            .filter(
                Sale.session_id == session.id,
                SalePayment.payment_method.ilike("%efectivo%"),
                SalePayment.currency == "USD",
            )
            .with_entities(SalePayment.amount)
            .all()
        )
        cash_sales = sum(r[0] for r in cash_rows)

        assert cash_sales == Decimal("0.00"), \
            "Tarjeta no debe contribuir al expected de efectivo"
        expected = _close_session(tenant_db, session,
                                   reported_usd=Decimal("100.00"),
                                   cash_sales=cash_sales)
        assert expected == Decimal("100.00")

    def test_multiples_ventas_efectivo_suman(self, tenant_db, open_session_obj):
        """
        FCJ02c: Tres ventas en efectivo ($30 + $20 + $10 = $60)
        → expected = 100 + 60 = 160.
        """
        session = open_session_obj
        for amount in [Decimal("30.00"), Decimal("20.00"), Decimal("10.00")]:
            sale = Sale(session_id=session.id, total_amount=amount,
                        payment_method="Efectivo", is_credit=False, paid=True)
            tenant_db.add(sale)
            tenant_db.flush()
            tenant_db.add(SalePayment(sale_id=sale.id, amount=amount,
                                       currency="USD", payment_method="Efectivo"))
        tenant_db.flush()

        cash_rows = (
            tenant_db.query(SalePayment).join(Sale)
            .filter(
                Sale.session_id == session.id,
                SalePayment.payment_method.ilike("%efectivo%"),
                SalePayment.currency == "USD",
            )
            .with_entities(SalePayment.amount)
            .all()
        )
        cash_sales = sum(r[0] for r in cash_rows)

        assert cash_sales == Decimal("60.00")
        expected = _close_session(tenant_db, session,
                                   reported_usd=Decimal("160.00"),
                                   cash_sales=cash_sales)
        assert expected == Decimal("160.00")

    def test_venta_mixta_efectivo_y_tarjeta(self, tenant_db, open_session_obj):
        """
        FCJ02d: Venta con pago mixto: 40 USD Efectivo + 30 USD Tarjeta = 70 total.
        Solo los 40 de efectivo entran a la caja → expected = 100 + 40 = 140.
        """
        session = open_session_obj
        sale = Sale(session_id=session.id, total_amount=Decimal("70.00"),
                    payment_method="Mixto", is_credit=False, paid=True)
        tenant_db.add(sale)
        tenant_db.flush()

        # Dos SalePayments para la misma venta
        tenant_db.add(SalePayment(sale_id=sale.id, amount=Decimal("40.00"),
                                   currency="USD", payment_method="Efectivo"))
        tenant_db.add(SalePayment(sale_id=sale.id, amount=Decimal("30.00"),
                                   currency="USD", payment_method="Tarjeta"))
        tenant_db.flush()

        cash_rows = (
            tenant_db.query(SalePayment).join(Sale)
            .filter(
                Sale.session_id == session.id,
                SalePayment.payment_method.ilike("%efectivo%"),
                SalePayment.currency == "USD",
            )
            .with_entities(SalePayment.amount)
            .all()
        )
        cash_sales = sum(r[0] for r in cash_rows)

        assert cash_sales == Decimal("40.00"), \
            "Sólo la parte en efectivo del pago mixto debe sumarse"
        expected = _close_session(tenant_db, session,
                                   reported_usd=Decimal("140.00"),
                                   cash_sales=cash_sales)
        assert expected == Decimal("140.00")


# ---------------------------------------------------------------------------
# FCJ03 — Diferencia (sobrante / faltante / exacto)
# ---------------------------------------------------------------------------

class TestFCJ03Diferencia:

    def test_diferencia_cero_cuando_reportado_igual_esperado(
        self, tenant_db, open_session_obj
    ):
        """
        FCJ03a: Reportado == Esperado → difference = 0.00 (arqueo perfecto).
        """
        session = open_session_obj
        _close_session(tenant_db, session, reported_usd=Decimal("100.00"))

        tenant_db.refresh(session)
        assert session.difference == Decimal("0.00")

    def test_sobrante_positivo_cuando_reportado_mayor(
        self, tenant_db, open_session_obj
    ):
        """
        FCJ03b: Reportado (120) > Esperado (100) → difference = +20 (sobrante).
        Puede indicar un error de conteo o propinas recibidas.
        """
        session = open_session_obj
        _close_session(tenant_db, session, reported_usd=Decimal("120.00"))

        tenant_db.refresh(session)
        assert session.difference == Decimal("20.00")
        assert session.difference > 0

    def test_faltante_negativo_cuando_reportado_menor(
        self, tenant_db, open_session_obj
    ):
        """
        FCJ03c: Reportado (85) < Esperado (100) → difference = -15 (faltante).
        El cajero declaró menos efectivo del que debería haber en caja.
        """
        session = open_session_obj
        _close_session(tenant_db, session, reported_usd=Decimal("85.00"))

        tenant_db.refresh(session)
        assert session.difference == Decimal("-15.00")
        assert session.difference < 0

    def test_diferencia_persiste_en_bd_recuperable_por_id(
        self, tenant_db, open_session_obj
    ):
        """
        FCJ03d: Los tres campos (reported, expected, difference) persisten
        correctamente y son recuperables por ID — necesario para el historial.
        """
        session = open_session_obj
        session_id = session.id
        _close_session(tenant_db, session, reported_usd=Decimal("95.00"))

        recovered = tenant_db.query(CashSession).get(session_id)
        assert recovered.final_cash_reported == Decimal("95.00")
        assert recovered.final_cash_expected == Decimal("100.00")
        assert recovered.difference == Decimal("-5.00")


# ---------------------------------------------------------------------------
# FCJ04 — Estado y timestamps al cerrar la sesión
# ---------------------------------------------------------------------------

class TestFCJ04EstadoCierre:

    def test_status_cambia_de_open_a_closed(self, tenant_db, open_session_obj):
        """
        FCJ04a: Al cerrar, status debe cambiar de OPEN a CLOSED.
        Una sesión cerrada ya no acepta operaciones.
        """
        session = open_session_obj
        assert session.status == "OPEN"

        _close_session(tenant_db, session, reported_usd=Decimal("100.00"))

        tenant_db.refresh(session)
        assert session.status == "CLOSED"

    def test_end_time_se_establece_al_cerrar(self, tenant_db, open_session_obj):
        """
        FCJ04b: end_time es None al abrir y debe quedar registrado al cerrar.
        Permite calcular duración del turno y auditar en el historial.
        """
        session = open_session_obj
        assert session.end_time is None

        _close_session(tenant_db, session, reported_usd=Decimal("100.00"))

        tenant_db.refresh(session)
        assert session.end_time is not None

    def test_nueva_sesion_puede_abrirse_despues_del_cierre(
        self, tenant_db, open_session_obj, user_id
    ):
        """
        FCJ04c: Después de cerrar una sesión, la misma caja puede abrir
        una nueva (constraint sólo prohíbe dos OPEN simultáneas, no CLOSED+OPEN).
        Simula el inicio del turno del día siguiente.
        """
        session = open_session_obj
        register_id = session.register_id
        _close_session(tenant_db, session, reported_usd=Decimal("100.00"))
        tenant_db.flush()

        nueva = CashSession(
            register_id=register_id,
            user_id=user_id,
            status="OPEN",
            initial_cash=Decimal("50.00"),
            initial_cash_bs=Decimal("0.00"),
        )
        tenant_db.add(nueva)
        tenant_db.flush()  # No debe lanzar IntegrityError

        assert nueva.id is not None
        assert nueva.status == "OPEN"

    def test_sesion_cerrada_mantiene_initial_cash(self, tenant_db, open_session_obj):
        """
        FCJ04d: El cierre no modifica initial_cash — es histórico de lo que
        había al abrir y nunca debe cambiar.
        """
        session = open_session_obj
        initial_original = session.initial_cash

        _close_session(tenant_db, session, reported_usd=Decimal("90.00"))
        tenant_db.refresh(session)

        assert session.initial_cash == initial_original


# ---------------------------------------------------------------------------
# FCJ05 — CashSessionCurrency se actualiza al cerrar
# ---------------------------------------------------------------------------

class TestFCJ05CurrencyAlCerrar:

    def test_currency_usd_final_expected_y_reported_se_guardan(
        self, tenant_db, open_session_obj
    ):
        """
        FCJ05a: Al cerrar, CashSessionCurrency USD debe tener
        final_expected, final_reported y difference correctos.
        """
        session = open_session_obj
        tenant_db.add(CashMovement(session_id=session.id, type="DEPOSIT",
                                    amount=Decimal("30.00"), currency="USD",
                                    description="Depósito"))
        tenant_db.flush()

        _close_session(tenant_db, session,
                        reported_usd=Decimal("135.00"),
                        deposits=Decimal("30.00"))  # expected = 130

        currency = tenant_db.query(CashSessionCurrency).filter_by(
            session_id=session.id, currency_symbol="USD"
        ).first()

        assert currency is not None
        assert currency.final_expected == Decimal("130.00"), \
            f"final_expected debería ser 130, es {currency.final_expected}"
        assert currency.final_reported == Decimal("135.00"), \
            f"final_reported debería ser 135, es {currency.final_reported}"
        assert currency.difference == Decimal("5.00"), \
            f"difference (sobrante) debería ser 5, es {currency.difference}"

    def test_currency_diferencia_negativa_persiste(self, tenant_db, open_session_obj):
        """
        FCJ05b: Si hay faltante, CashSessionCurrency.difference debe ser negativo.
        """
        session = open_session_obj
        _close_session(tenant_db, session, reported_usd=Decimal("90.00"))  # 10 menos

        currency = tenant_db.query(CashSessionCurrency).filter_by(
            session_id=session.id, currency_symbol="USD"
        ).first()

        assert currency.difference == Decimal("-10.00")

    def test_currency_diferencia_cero_arqueo_exacto(self, tenant_db, open_session_obj):
        """
        FCJ05c: Arqueo exacto → CashSessionCurrency.difference = 0.
        """
        session = open_session_obj
        _close_session(tenant_db, session, reported_usd=Decimal("100.00"))

        currency = tenant_db.query(CashSessionCurrency).filter_by(
            session_id=session.id, currency_symbol="USD"
        ).first()
        assert currency.difference == Decimal("0.00")


# ---------------------------------------------------------------------------
# FCJ06 — Historial: sesiones consultables con datos de register y usuario
# ---------------------------------------------------------------------------

class TestFCJ06Historial:

    def test_sesion_cerrada_es_consultable_por_id(
        self, tenant_db, open_session_obj
    ):
        """
        FCJ06a: Una sesión cerrada debe ser recuperable por ID con todos sus datos.
        Simula lo que hace GET /sessions/history.
        """
        session = open_session_obj
        session_id = session.id
        _close_session(tenant_db, session, reported_usd=Decimal("100.00"))

        recovered = tenant_db.query(CashSession).filter_by(id=session_id).first()
        assert recovered is not None
        assert recovered.status == "CLOSED"
        assert recovered.final_cash_expected == Decimal("100.00")

    def test_sesion_tiene_link_correcto_al_register(
        self, tenant_db, open_session_obj, cash_register_obj
    ):
        """
        FCJ06b: La sesión referencia correctamente el nombre y código de la caja.
        Necesario para el historial que muestra qué caja hizo el turno.
        """
        session = open_session_obj
        assert session.register_id == cash_register_obj.id

        register = tenant_db.query(CashRegister).get(session.register_id)
        assert register is not None
        assert register.name == cash_register_obj.name
        assert register.code == cash_register_obj.code

    def test_multiples_sesiones_mismo_registro_en_historial(
        self, tenant_db, cash_register_obj, user_id
    ):
        """
        FCJ06c: Un registro puede tener múltiples sesiones CLOSED (un turno por día).
        Todas deben ser consultables en el historial.
        """
        montos = [Decimal("100.00"), Decimal("150.00"), Decimal("200.00")]
        for monto in montos:
            s = CashSession(
                register_id=cash_register_obj.id, user_id=user_id,
                status="OPEN", initial_cash=monto, initial_cash_bs=Decimal("0.00"),
            )
            tenant_db.add(s)
            tenant_db.flush()
            tenant_db.add(CashSessionCurrency(
                session_id=s.id, currency_symbol="USD", initial_amount=monto,
            ))
            tenant_db.flush()
            _close_session(tenant_db, s, reported_usd=monto)
            tenant_db.flush()

        sesiones_cerradas = tenant_db.query(CashSession).filter(
            CashSession.register_id == cash_register_obj.id,
            CashSession.status == "CLOSED",
        ).all()

        assert len(sesiones_cerradas) == 3
        montos_guardados = sorted(s.initial_cash for s in sesiones_cerradas)
        assert montos_guardados == [Decimal("100.00"), Decimal("150.00"), Decimal("200.00")]

    def test_sesion_abierta_tambien_es_consultable(
        self, tenant_db, open_session_obj
    ):
        """
        FCJ06d: La sesión del turno actual (OPEN) también debe ser consultable.
        El historial incluye todas las sesiones, no sólo las cerradas.
        """
        session = open_session_obj
        result = tenant_db.query(CashSession).filter_by(id=session.id).first()

        assert result is not None
        assert result.status == "OPEN"
        assert result.end_time is None

    def test_historial_filtrable_por_register(
        self, tenant_db, cash_register_obj, user_id
    ):
        """
        FCJ06e: El historial debe poder filtrarse por register_id para mostrar
        sólo los turnos de una caja específica (multi-caja).
        """
        # Caja extra (no debe aparecer en el filtro)
        otra_caja = CashRegister(
            name=f"Otra Caja {uuid.uuid4().hex[:6]}",
            code=f"OC{uuid.uuid4().hex[:4].upper()}", is_active=True,
        )
        tenant_db.add(otra_caja)
        tenant_db.flush()

        # Sesión en la caja de control
        s_principal = CashSession(
            register_id=cash_register_obj.id, user_id=user_id, status="OPEN",
            initial_cash=Decimal("100.00"), initial_cash_bs=Decimal("0.00"),
        )
        tenant_db.add(s_principal)

        # Sesión en la caja extra
        s_otra = CashSession(
            register_id=otra_caja.id, user_id=user_id, status="OPEN",
            initial_cash=Decimal("200.00"), initial_cash_bs=Decimal("0.00"),
        )
        tenant_db.add(s_otra)
        tenant_db.flush()

        # Filtrar sólo sesiones de la caja principal
        sesiones = tenant_db.query(CashSession).filter(
            CashSession.register_id == cash_register_obj.id
        ).all()

        assert all(s.register_id == cash_register_obj.id for s in sesiones)
        ids = [s.id for s in sesiones]
        assert s_principal.id in ids
        assert s_otra.id not in ids


# ---------------------------------------------------------------------------
# FCJ07 — Integración créditos con sesión de caja
# ---------------------------------------------------------------------------

class TestFCJ07CreditosEnCaja:

    def test_venta_credito_vinculada_a_sesion(
        self, tenant_db, open_session_obj, customer_obj
    ):
        """
        FCJ07a: Una venta a crédito debe poder vincularse a la sesión activa.
        is_credit=True, paid=False, balance_pending = total_amount.
        """
        session = open_session_obj
        monto = Decimal("75.00")

        sale = Sale(
            session_id=session.id,
            customer_id=customer_obj.id,
            total_amount=monto,
            payment_method="Credito",
            is_credit=True,
            paid=False,
            balance_pending=monto,
        )
        tenant_db.add(sale)
        tenant_db.flush()

        assert sale.session_id == session.id
        assert sale.is_credit is True
        assert sale.paid is False
        assert sale.balance_pending == monto

    def test_cierre_cuenta_ventas_credito_pendientes(
        self, tenant_db, open_session_obj, customer_obj
    ):
        """
        FCJ07b: Al cerrar se puede contar créditos pendientes del turno.
        El router devuelve credit_count y credit_pending para informar al cajero.
        Turno: 2 créditos ($50 + $30) + 1 venta pagada ($20) → credit_pending = $80.
        """
        session = open_session_obj

        for monto in [Decimal("50.00"), Decimal("30.00")]:
            tenant_db.add(Sale(
                session_id=session.id, customer_id=customer_obj.id,
                total_amount=monto, payment_method="Credito",
                is_credit=True, paid=False, balance_pending=monto,
            ))
        # Venta pagada → no debe contar como crédito pendiente
        tenant_db.add(Sale(
            session_id=session.id, total_amount=Decimal("20.00"),
            payment_method="Efectivo", is_credit=False, paid=True,
        ))
        tenant_db.flush()

        # Replicar lógica del router
        pending = tenant_db.query(Sale).filter(
            Sale.session_id == session.id,
            Sale.is_credit == True,
            Sale.balance_pending > 0,
        ).all()

        assert len(pending) == 2
        assert sum(s.balance_pending for s in pending) == Decimal("80.00")

    def test_abono_efectivo_vinculado_a_sesion(
        self, tenant_db, open_session_obj, customer_obj
    ):
        """
        FCJ07c: Un abono (Payment) en efectivo puede vincularse a la sesión.
        Permite que el cajero sepa cuánto entró por cobros de deuda en su turno.
        """
        session = open_session_obj
        payment = Payment(
            customer_id=customer_obj.id,
            amount=Decimal("40.00"),
            currency="USD",
            exchange_rate_used=Decimal("1.00"),
            payment_method="Efectivo",
            session_id=session.id,
            description="Abono deuda cliente",
        )
        tenant_db.add(payment)
        tenant_db.flush()

        assert payment.session_id == session.id

        abonos = tenant_db.query(Payment).filter_by(session_id=session.id).all()
        assert len(abonos) == 1
        assert abonos[0].amount == Decimal("40.00")

    def test_abono_efectivo_suma_al_expected_de_cierre(
        self, tenant_db, open_session_obj, customer_obj
    ):
        """
        FCJ07d: El abono en efectivo vinculado a la sesión DEBE sumarse al
        expected de cierre. El dinero físicamente entró a la caja.
        expected = 100 (initial) + 40 (abono efectivo) = 140 USD.
        """
        session = open_session_obj
        tenant_db.add(Payment(
            customer_id=customer_obj.id, amount=Decimal("40.00"), currency="USD",
            exchange_rate_used=Decimal("1.00"), payment_method="Efectivo",
            session_id=session.id,
        ))
        tenant_db.flush()

        debt_rows = tenant_db.query(Payment).filter(
            Payment.session_id == session.id,
            Payment.payment_method.ilike("%efectivo%"),
            Payment.currency == "USD",
        ).with_entities(Payment.amount).all()
        debt_payments = sum(r[0] for r in debt_rows)

        assert debt_payments == Decimal("40.00")
        expected = _close_session(tenant_db, session,
                                   reported_usd=Decimal("140.00"),
                                   debt_payments=debt_payments)
        assert expected == Decimal("140.00")

    def test_abono_tarjeta_no_suma_al_expected_efectivo(
        self, tenant_db, open_session_obj, customer_obj
    ):
        """
        FCJ07e: Un abono pagado con Tarjeta/Transferencia NO entra a la caja física.
        expected sigue siendo 100 (initial).
        """
        session = open_session_obj
        tenant_db.add(Payment(
            customer_id=customer_obj.id, amount=Decimal("60.00"), currency="USD",
            exchange_rate_used=Decimal("1.00"), payment_method="Transferencia",
            session_id=session.id,
        ))
        tenant_db.flush()

        debt_rows = tenant_db.query(Payment).filter(
            Payment.session_id == session.id,
            Payment.payment_method.ilike("%efectivo%"),
            Payment.currency == "USD",
        ).with_entities(Payment.amount).all()
        debt_payments = sum(r[0] for r in debt_rows)

        assert debt_payments == Decimal("0.00"), \
            "Abono por transferencia no debe sumarse al expected de efectivo"

    def test_cierre_mixto_completo(
        self, tenant_db, open_session_obj, customer_obj
    ):
        """
        FCJ07f: Escenario completo de turno con todos los movimientos:
          - initial:          100 USD
          - Venta efectivo:   +50 USD  → entra a caja
          - Venta crédito:    +30 USD  → NO entra (es crédito pendiente)
          - Abono efectivo:   +20 USD  → entra a caja
          - Gasto de caja:    -10 USD  → sale de caja
          ─────────────────────────────
          expected = 100 + 50 + 20 - 10 = 160 USD
          credit_pending = 30 USD
        """
        session = open_session_obj

        # Venta en efectivo
        sale_ef = Sale(session_id=session.id, total_amount=Decimal("50.00"),
                       payment_method="Efectivo", is_credit=False, paid=True)
        tenant_db.add(sale_ef)
        tenant_db.flush()
        tenant_db.add(SalePayment(sale_id=sale_ef.id, amount=Decimal("50.00"),
                                   currency="USD", payment_method="Efectivo"))

        # Venta a crédito
        tenant_db.add(Sale(
            session_id=session.id, customer_id=customer_obj.id,
            total_amount=Decimal("30.00"), payment_method="Credito",
            is_credit=True, paid=False, balance_pending=Decimal("30.00"),
        ))

        # Abono en efectivo
        tenant_db.add(Payment(
            customer_id=customer_obj.id, amount=Decimal("20.00"), currency="USD",
            exchange_rate_used=Decimal("1.00"), payment_method="Efectivo",
            session_id=session.id,
        ))

        # Gasto de caja
        tenant_db.add(CashMovement(
            session_id=session.id, type="EXPENSE",
            amount=Decimal("10.00"), currency="USD", description="Gasto limpieza",
        ))
        tenant_db.flush()

        # --- Calcular igual que el router ---
        cash_sales = sum(
            r[0] for r in
            tenant_db.query(SalePayment).join(Sale)
            .filter(Sale.session_id == session.id,
                    SalePayment.payment_method.ilike("%efectivo%"),
                    SalePayment.currency == "USD")
            .with_entities(SalePayment.amount).all()
        )
        debt_payments = sum(
            r[0] for r in
            tenant_db.query(Payment)
            .filter(Payment.session_id == session.id,
                    Payment.payment_method.ilike("%efectivo%"),
                    Payment.currency == "USD")
            .with_entities(Payment.amount).all()
        )
        expenses = sum(
            r[0] for r in
            tenant_db.query(CashMovement)
            .filter(CashMovement.session_id == session.id,
                    CashMovement.type.in_(["EXPENSE", "WITHDRAWAL", "OUT"]),
                    CashMovement.currency == "USD")
            .with_entities(CashMovement.amount).all()
        )

        expected = _close_session(tenant_db, session,
                                   reported_usd=Decimal("160.00"),
                                   cash_sales=cash_sales,
                                   debt_payments=debt_payments,
                                   expenses=expenses)

        assert cash_sales == Decimal("50.00")
        assert debt_payments == Decimal("20.00")
        assert expenses == Decimal("10.00")
        assert expected == Decimal("160.00")
        tenant_db.refresh(session)
        assert session.difference == Decimal("0.00")

        # Créditos pendientes del turno
        credit_pending = sum(
            s.balance_pending for s in
            tenant_db.query(Sale).filter(
                Sale.session_id == session.id,
                Sale.is_credit == True,
                Sale.balance_pending > 0,
            ).all()
        )
        assert credit_pending == Decimal("30.00")
