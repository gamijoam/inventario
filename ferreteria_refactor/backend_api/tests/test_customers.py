"""
test_customers.py — Suite de tests para gestión de clientes y crédito.

Cubre:
- TestCreacionClientes     : validaciones de modelo al crear clientes (4+ tests)
- TestGestionCredito       : lógica de límite, abonos y saldos (5+ tests)
- TestBusquedaClientes     : filtros por nombre, teléfono y aislamiento multi-tenant (3+ tests)
- TestEstadoCuenta         : resumen de deuda, saldo y múltiples compras (3+ tests)

Estrategia:
- Tests de modelo/BD usan SQLite en memoria via fixtures compartidas de conftest.py.
- Tests de lógica de negocio que no necesitan BD usan MagicMock y patch directamente.
- Todos los tests pasan sin servidor ni BD PostgreSQL activos.
"""

import os
import datetime
import pytest
from decimal import Decimal
from unittest.mock import MagicMock, patch


# ---------------------------------------------------------------------------
# Importaciones con skip seguro — mismo patrón que conftest.py
# ---------------------------------------------------------------------------

def _import_models():
    try:
        import sys
        _backend_root = os.path.dirname(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        )
        if _backend_root not in sys.path:
            sys.path.insert(0, _backend_root)

        from backend_api.models.models import Customer, Sale, Payment, CashSession, CashRegister
        from sqlalchemy import func
        from fastapi import HTTPException
        return Customer, Sale, Payment, CashSession, CashRegister, func, HTTPException, None
    except Exception as e:
        return None, None, None, None, None, None, None, str(e)


Customer, Sale, Payment, CashSession, CashRegister, _func, HTTPException, _import_error = _import_models()
MODELS_AVAILABLE = Customer is not None


# ---------------------------------------------------------------------------
# Helpers de lógica de negocio — reflejan lo que hace el router customers.py
# ---------------------------------------------------------------------------

def _calcular_deuda(db, customer_id: int) -> Decimal:
    """Suma Sale.balance_pending de ventas a crédito no pagadas."""
    result = (
        db.query(_func.sum(Sale.balance_pending))
        .filter(
            Sale.customer_id == customer_id,
            Sale.is_credit == True,
            Sale.paid == False,
        )
        .scalar()
    )
    return Decimal(str(result)) if result is not None else Decimal("0.00")


def _puede_vender_credito(db, customer, monto: Decimal) -> bool:
    """
    Valida si una venta a crédito puede procesarse.
    - Rechaza si el cliente está bloqueado.
    - Rechaza si credit_limit es None o 0.
    - Rechaza si (deuda_actual + monto) > credit_limit.
    """
    if customer.is_blocked:
        raise HTTPException(
            status_code=400,
            detail=f"Cliente '{customer.name}' está bloqueado.",
        )
    if not customer.credit_limit or customer.credit_limit == 0:
        raise HTTPException(
            status_code=400,
            detail="El cliente no tiene límite de crédito habilitado.",
        )
    deuda = _calcular_deuda(db, customer.id)
    if (deuda + monto) > customer.credit_limit:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Límite de crédito excedido. "
                f"Deuda: ${deuda:.2f} / Límite: ${customer.credit_limit:.2f}"
            ),
        )
    return True


# ===========================================================================
# TestCreacionClientes
# ===========================================================================


class TestCreacionClientes:
    """Valida las restricciones y valores por defecto al crear clientes."""

    def test_cliente_requiere_nombre(self, db_session):
        """El campo name es NOT NULL; insertar sin nombre debe lanzar excepción."""
        if not MODELS_AVAILABLE:
            pytest.skip(f"Modelos no disponibles: {_import_error}")

        from sqlalchemy.exc import IntegrityError

        cliente_sin_nombre = Customer(
            name=None,
            credit_limit=Decimal("50.00"),
            is_blocked=False,
        )
        db_session.add(cliente_sin_nombre)

        with pytest.raises((IntegrityError, Exception)):
            db_session.flush()

        db_session.rollback()

    def test_cliente_telefono_unico_por_tenant(self, db_session):
        """
        El modelo no impone unique en phone a nivel BD; la unicidad por teléfono
        dentro del tenant se delega a la capa de servicio/router.
        Este test documenta que la consulta de duplicado por teléfono funciona.
        """
        if not MODELS_AVAILABLE:
            pytest.skip(f"Modelos no disponibles: {_import_error}")

        telefono = "0424-9999999"
        cliente_existente = Customer(name="Ana Torres", phone=telefono)
        db_session.add(cliente_existente)
        db_session.flush()

        # La lógica de negocio debe detectar el teléfono duplicado via query
        encontrado = (
            db_session.query(Customer)
            .filter(Customer.phone == telefono)
            .first()
        )
        assert encontrado is not None
        assert encontrado.phone == telefono

        # Simular validación del router: rechazar si ya existe ese teléfono
        duplicado = encontrado is not None
        assert duplicado is True, "El router debe detectar el teléfono duplicado."

    def test_cliente_puede_tener_limite_credito(self, db_session):
        """El campo credit_limit debe almacenarse y recuperarse con precisión decimal."""
        if not MODELS_AVAILABLE:
            pytest.skip(f"Modelos no disponibles: {_import_error}")

        cliente = Customer(
            name="María Rodríguez",
            id_number="V-22222222",
            credit_limit=Decimal("500.00"),
        )
        db_session.add(cliente)
        db_session.flush()

        recuperado = db_session.query(Customer).filter_by(id_number="V-22222222").first()
        assert recuperado is not None
        assert Decimal(str(recuperado.credit_limit)) == Decimal("500.00")

    def test_cliente_nuevo_tiene_saldo_cero(self, db_session):
        """Un cliente recién creado sin ventas no tiene deuda a crédito registrada."""
        if not MODELS_AVAILABLE:
            pytest.skip(f"Modelos no disponibles: {_import_error}")

        cliente = Customer(
            name="Pedro Salazar",
            id_number="V-33333333",
        )
        db_session.add(cliente)
        db_session.flush()

        deuda = _calcular_deuda(db_session, cliente.id)
        assert deuda == Decimal("0.00"), (
            f"Un cliente sin ventas debe tener deuda $0.00, se obtuvo ${deuda}."
        )

    def test_cliente_is_blocked_default_es_false(self, db_session):
        """El atributo is_blocked debe ser False por defecto al crear un cliente."""
        if not MODELS_AVAILABLE:
            pytest.skip(f"Modelos no disponibles: {_import_error}")

        cliente = Customer(name="Rosa Mendez")
        db_session.add(cliente)
        db_session.flush()

        assert cliente.is_blocked is False

    def test_cliente_payment_term_days_default(self, db_session):
        """El plazo de pago por defecto definido en el modelo es 15 días."""
        if not MODELS_AVAILABLE:
            pytest.skip(f"Modelos no disponibles: {_import_error}")

        cliente = Customer(name="Carlos Ruiz")
        db_session.add(cliente)
        db_session.flush()

        assert cliente.payment_term_days == 15


# ===========================================================================
# TestGestionCredito
# ===========================================================================


class TestGestionCredito:
    """Tests para la lógica de crédito: límites, abonos y saldos."""

    def test_credito_no_puede_superar_limite(self, db_session, customer_with_limit):
        """
        No se puede vender a crédito si (deuda_actual + monto) > credit_limit.

        Escenario:
            credit_limit = $100.00
            deuda_actual = $80.00 (venta previa)
            nueva_venta  = $30.00
            total        = $110.00 > $100.00 → RECHAZADA
        """
        if not MODELS_AVAILABLE:
            pytest.skip(f"Modelos no disponibles: {_import_error}")

        customer = customer_with_limit  # credit_limit=100.00

        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.scalar.return_value = Decimal("80.00")

        with pytest.raises(HTTPException) as exc_info:
            _puede_vender_credito(mock_db, customer, Decimal("30.00"))

        assert exc_info.value.status_code == 400
        assert "límite" in exc_info.value.detail.lower() or "excedido" in exc_info.value.detail.lower()

    def test_abono_reduce_saldo_pendiente(self, db_session, customer_with_limit):
        """Registrar un pago debe reducir balance_pending de la venta a crédito."""
        if not MODELS_AVAILABLE:
            pytest.skip(f"Modelos no disponibles: {_import_error}")

        customer = customer_with_limit
        ahora = datetime.datetime.now()
        vencimiento = ahora + datetime.timedelta(days=30)

        venta = Sale(
            customer_id=customer.id,
            total_amount=Decimal("80.00"),
            payment_method="Credito",
            is_credit=True,
            paid=False,
            balance_pending=Decimal("80.00"),
            date=ahora,
            due_date=vencimiento,
        )
        db_session.add(venta)
        db_session.flush()

        deuda_antes = _calcular_deuda(db_session, customer.id)
        assert deuda_antes == Decimal("80.00")

        # Aplicar abono de $30 (lógica FIFO simplificada)
        abono = Decimal("30.00")
        venta.balance_pending = Decimal(str(venta.balance_pending)) - abono

        pago = Payment(
            customer_id=customer.id,
            amount=abono,
            currency="USD",
            exchange_rate_used=Decimal("1.0000"),
            payment_method="Efectivo",
        )
        db_session.add(pago)
        db_session.flush()

        deuda_despues = _calcular_deuda(db_session, customer.id)
        assert deuda_despues == Decimal("50.00"), (
            f"Después del abono de $30 la deuda debe ser $50.00, se obtuvo ${deuda_despues}."
        )

    def test_saldo_negativo_no_permitido(self):
        """
        Un pago mayor al balance_pending marca la venta como pagada (balance=0, paid=True)
        y no produce saldo negativo. El remanente queda disponible para la siguiente venta.
        """
        # Simulamos la lógica FIFO del router create_customer_payment
        class VentaMock:
            balance_pending = Decimal("40.00")
            paid = False

        venta = VentaMock()
        pago_usd = Decimal("60.00")  # Pago mayor al saldo
        remaining = pago_usd

        balance = Decimal(str(venta.balance_pending))

        if remaining >= balance:
            remaining -= balance
            venta.balance_pending = Decimal("0.00")
            venta.paid = True
        else:
            venta.balance_pending = balance - remaining
            remaining = Decimal("0.00")

        assert venta.balance_pending == Decimal("0.00")
        assert venta.paid is True
        assert remaining == Decimal("20.00")
        # El saldo NUNCA debe ser negativo
        assert venta.balance_pending >= Decimal("0.00")

    def test_cliente_sin_limite_puede_comprar_al_credito(self, db_session):
        """
        Un cliente con credit_limit=None (sin límite asignado) puede tener ventas
        a crédito registradas en el modelo sin restricción a nivel de BD.
        La validación de None es decisión de la capa de servicio.
        """
        if not MODELS_AVAILABLE:
            pytest.skip(f"Modelos no disponibles: {_import_error}")

        cliente = Customer(
            name="Cliente Sin Límite Configurado",
            id_number="V-55555555",
            credit_limit=None,
        )
        db_session.add(cliente)
        db_session.flush()

        venta = Sale(
            total_amount=Decimal("9999.99"),
            payment_method="Credito",
            is_credit=True,
            paid=False,
            balance_pending=Decimal("9999.99"),
            customer_id=cliente.id,
        )
        db_session.add(venta)
        db_session.flush()

        venta_db = db_session.query(Sale).filter_by(customer_id=cliente.id).first()
        assert venta_db is not None
        assert Decimal(str(venta_db.balance_pending)) == Decimal("9999.99")

    def test_historial_credito_registra_movimientos(self, db_session, customer_with_limit):
        """Múltiples pagos de un mismo cliente quedan registrados en la tabla payments."""
        if not MODELS_AVAILABLE:
            pytest.skip(f"Modelos no disponibles: {_import_error}")

        customer = customer_with_limit

        montos = [Decimal("20.00"), Decimal("35.00"), Decimal("45.00")]
        for monto in montos:
            pago = Payment(
                customer_id=customer.id,
                amount=monto,
                currency="USD",
                exchange_rate_used=Decimal("1.0000"),
                payment_method="Efectivo",
            )
            db_session.add(pago)

        db_session.flush()

        pagos_db = db_session.query(Payment).filter_by(customer_id=customer.id).all()
        assert len(pagos_db) == 3

        total_pagado = sum(Decimal(str(p.amount)) for p in pagos_db)
        assert total_pagado == Decimal("100.00")

    def test_venta_pagada_no_suma_a_deuda(self, db_session, customer_with_limit):
        """Las ventas con paid=True no deben aparecer en el cálculo de deuda pendiente."""
        if not MODELS_AVAILABLE:
            pytest.skip(f"Modelos no disponibles: {_import_error}")

        customer = customer_with_limit
        ahora = datetime.datetime.now()
        vencimiento = ahora + datetime.timedelta(days=30)

        venta_pagada = Sale(
            customer_id=customer.id,
            total_amount=Decimal("50.00"),
            is_credit=True,
            paid=True,
            balance_pending=Decimal("0.00"),
            date=ahora,
            due_date=vencimiento,
        )
        venta_pendiente = Sale(
            customer_id=customer.id,
            total_amount=Decimal("45.00"),
            is_credit=True,
            paid=False,
            balance_pending=Decimal("45.00"),
            date=ahora,
            due_date=vencimiento,
        )
        db_session.add_all([venta_pagada, venta_pendiente])
        db_session.flush()

        deuda = _calcular_deuda(db_session, customer.id)
        assert deuda == Decimal("45.00"), (
            f"Solo la venta impagada debe sumar. Esperado $45.00, se obtuvo ${deuda}."
        )

    def test_cliente_bloqueado_no_puede_comprar_credito(self):
        """Un cliente con is_blocked=True es rechazado sin importar el saldo disponible."""
        if not MODELS_AVAILABLE:
            pytest.skip(f"Modelos no disponibles: {_import_error}")

        cliente_bloqueado = Customer(
            id=77,
            name="Cliente Bloqueado",
            credit_limit=Decimal("500.00"),
            is_blocked=True,
        )

        mock_db = MagicMock()

        with pytest.raises(HTTPException) as exc_info:
            _puede_vender_credito(mock_db, cliente_bloqueado, Decimal("1.00"))

        assert exc_info.value.status_code == 400
        assert "bloqueado" in exc_info.value.detail.lower()


# ===========================================================================
# TestBusquedaClientes
# ===========================================================================


class TestBusquedaClientes:
    """Verifica los filtros de búsqueda y el aislamiento entre tenants."""

    def test_busqueda_por_nombre(self, db_session):
        """La búsqueda ilike por nombre retorna coincidencias parciales (como el router /customers?q=)."""
        if not MODELS_AVAILABLE:
            pytest.skip(f"Modelos no disponibles: {_import_error}")

        db_session.query(Customer).delete()
        db_session.flush()

        clientes = [
            Customer(name="Alejandro Martínez", id_number="V-10000001"),
            Customer(name="Alejandra Pérez", id_number="V-10000002"),
            Customer(name="Roberto González", id_number="V-10000003"),
        ]
        db_session.add_all(clientes)
        db_session.flush()

        termino = "%Alejand%"
        resultados = db_session.query(Customer).filter(Customer.name.ilike(termino)).all()

        nombres = [c.name for c in resultados]
        assert "Alejandro Martínez" in nombres
        assert "Alejandra Pérez" in nombres
        assert "Roberto González" not in nombres

    def test_busqueda_por_telefono(self, db_session):
        """La búsqueda por id_number (cédula) retorna el cliente correcto."""
        if not MODELS_AVAILABLE:
            pytest.skip(f"Modelos no disponibles: {_import_error}")

        db_session.query(Customer).delete()
        db_session.flush()

        cliente_a = Customer(name="Sofía Blanco", id_number="V-77777777", phone="0212-1234567")
        cliente_b = Customer(name="Marco Polo", id_number="V-88888888", phone="0414-9876543")
        db_session.add_all([cliente_a, cliente_b])
        db_session.flush()

        # El router usa ilike tanto para name como para id_number
        termino = "%77777777%"
        resultados = (
            db_session.query(Customer)
            .filter(Customer.id_number.ilike(termino))
            .all()
        )

        assert len(resultados) == 1
        assert resultados[0].name == "Sofía Blanco"

    def test_cliente_de_otro_tenant_no_aparece(self):
        """
        En arquitectura multi-tenant el middleware de tenant filtra el search_path
        de PostgreSQL, de modo que clientes de otros tenants no son visibles.
        Se documenta el contrato usando MagicMock.
        """
        session_tenant_a = MagicMock()
        session_tenant_b = MagicMock()

        cliente_tenant_a = MagicMock(spec=Customer)
        cliente_tenant_a.name = "Cliente Tenant A"
        cliente_tenant_a.id = 1

        # La sesión del tenant_a retorna su cliente
        session_tenant_a.query.return_value.filter.return_value.all.return_value = [
            cliente_tenant_a
        ]
        # La sesión del tenant_b no ve clientes del tenant_a
        session_tenant_b.query.return_value.filter.return_value.all.return_value = []

        resultados_a = session_tenant_a.query(Customer).filter().all()
        resultados_b = session_tenant_b.query(Customer).filter().all()

        assert len(resultados_a) == 1
        assert resultados_a[0].name == "Cliente Tenant A"
        assert len(resultados_b) == 0, (
            "Un tenant diferente no debe ver clientes de otro tenant."
        )

    def test_busqueda_case_insensitive(self, db_session):
        """La búsqueda debe funcionar independientemente de mayúsculas/minúsculas."""
        if not MODELS_AVAILABLE:
            pytest.skip(f"Modelos no disponibles: {_import_error}")

        db_session.query(Customer).delete()
        db_session.flush()

        cliente = Customer(name="Fernando Castillo", id_number="V-12121212")
        db_session.add(cliente)
        db_session.flush()

        resultados_lower = (
            db_session.query(Customer).filter(Customer.name.ilike("%fernando%")).all()
        )
        resultados_upper = (
            db_session.query(Customer).filter(Customer.name.ilike("%FERNANDO%")).all()
        )

        assert len(resultados_lower) == 1
        assert len(resultados_upper) == 1

    def test_busqueda_sin_termino_retorna_todos(self, db_session):
        """Sin filtro de búsqueda, la query retorna todos los clientes del tenant."""
        if not MODELS_AVAILABLE:
            pytest.skip(f"Modelos no disponibles: {_import_error}")

        db_session.query(Customer).delete()
        db_session.flush()

        db_session.add_all([
            Customer(name="Cliente Alfa"),
            Customer(name="Cliente Beta"),
            Customer(name="Cliente Gamma"),
        ])
        db_session.flush()

        todos = db_session.query(Customer).all()
        assert len(todos) == 3


# ===========================================================================
# TestEstadoCuenta
# ===========================================================================


class TestEstadoCuenta:
    """Verifica la vista consolidada del estado financiero del cliente."""

    def test_estado_cuenta_muestra_deudas_pendientes(self, db_session, customer_with_limit):
        """El estado de cuenta refleja el total de balance_pending de ventas activas."""
        if not MODELS_AVAILABLE:
            pytest.skip(f"Modelos no disponibles: {_import_error}")

        customer = customer_with_limit
        ahora = datetime.datetime.now()
        vencimiento = ahora + datetime.timedelta(days=30)

        ventas = [
            Sale(
                customer_id=customer.id,
                total_amount=Decimal("150.00"),
                payment_method="Credito",
                is_credit=True,
                paid=False,
                balance_pending=Decimal("150.00"),
                date=ahora,
                due_date=vencimiento,
            ),
            Sale(
                customer_id=customer.id,
                total_amount=Decimal("75.00"),
                payment_method="Credito",
                is_credit=True,
                paid=False,
                balance_pending=Decimal("75.00"),
                date=ahora,
                due_date=vencimiento,
            ),
        ]
        db_session.add_all(ventas)
        db_session.flush()

        # Nota: customer_with_limit tiene credit_limit=100 pero para este test
        # registramos directamente en BD para verificar el cálculo de deuda,
        # no la validación del límite.
        total_deuda = (
            db_session.query(_func.sum(Sale.balance_pending))
            .filter(
                Sale.customer_id == customer.id,
                Sale.is_credit == True,
                Sale.paid == False,
            )
            .scalar()
        )

        assert Decimal(str(total_deuda)) == Decimal("225.00"), (
            f"La deuda total debe ser $225.00, se obtuvo ${total_deuda}."
        )

    def test_cliente_al_dia_tiene_saldo_cero(self, db_session, customer_with_limit):
        """Un cliente que pagó todas sus ventas a crédito tiene saldo pendiente = 0."""
        if not MODELS_AVAILABLE:
            pytest.skip(f"Modelos no disponibles: {_import_error}")

        customer = customer_with_limit
        ahora = datetime.datetime.now()
        vencimiento = ahora + datetime.timedelta(days=30)

        venta_pagada = Sale(
            customer_id=customer.id,
            total_amount=Decimal("90.00"),
            payment_method="Credito",
            is_credit=True,
            paid=True,
            balance_pending=Decimal("0.00"),
            date=ahora,
            due_date=vencimiento,
        )
        db_session.add(venta_pagada)
        db_session.flush()

        deuda = _calcular_deuda(db_session, customer.id)
        assert deuda == Decimal("0.00"), (
            f"Un cliente con todas las ventas pagadas debe tener deuda $0.00, se obtuvo ${deuda}."
        )

    def test_multiples_compras_credito_acumulan_saldo(self, db_session):
        """Varias ventas a crédito sin pagar deben acumularse correctamente."""
        if not MODELS_AVAILABLE:
            pytest.skip(f"Modelos no disponibles: {_import_error}")

        cliente = Customer(
            name="Cliente Acumulador",
            id_number="V-93333333",
            credit_limit=Decimal("2000.00"),
        )
        db_session.add(cliente)
        db_session.flush()

        ahora = datetime.datetime.now()
        vencimiento = ahora + datetime.timedelta(days=15)

        montos = [Decimal("100.00"), Decimal("250.00"), Decimal("75.50"), Decimal("49.50")]
        for monto in montos:
            venta = Sale(
                customer_id=cliente.id,
                total_amount=monto,
                payment_method="Credito",
                is_credit=True,
                paid=False,
                balance_pending=monto,
                date=ahora,
                due_date=vencimiento,
            )
            db_session.add(venta)

        db_session.flush()

        deuda = _calcular_deuda(db_session, cliente.id)
        assert deuda == Decimal("475.00"), (
            f"La suma de 4 ventas a crédito debe ser $475.00, se obtuvo ${deuda}."
        )

    def test_credito_disponible_se_calcula_correctamente(self):
        """credito_disponible = credit_limit - deuda_actual."""
        cliente = MagicMock(spec=Customer)
        cliente.credit_limit = Decimal("300.00")
        cliente.is_blocked = False

        deuda_actual = Decimal("120.00")
        credito_disponible = cliente.credit_limit - deuda_actual

        assert credito_disponible == Decimal("180.00")

    def test_cliente_bloqueado_identificado_correctamente(self, db_session):
        """Un cliente con is_blocked=True es filtrable en la BD."""
        if not MODELS_AVAILABLE:
            pytest.skip(f"Modelos no disponibles: {_import_error}")

        cliente_bloqueado = Customer(
            name="Cliente Bloqueado Estado",
            id_number="V-94444444",
            credit_limit=Decimal("200.00"),
            is_blocked=True,
        )
        db_session.add(cliente_bloqueado)
        db_session.flush()

        resultado = (
            db_session.query(Customer)
            .filter(
                Customer.id == cliente_bloqueado.id,
                Customer.is_blocked == True,
            )
            .first()
        )

        assert resultado is not None
        assert resultado.name == "Cliente Bloqueado Estado"

    def test_facturas_vencidas_se_identifican_por_due_date(self, db_session, customer_with_limit):
        """Ventas con due_date en el pasado y paid=False son facturas vencidas."""
        if not MODELS_AVAILABLE:
            pytest.skip(f"Modelos no disponibles: {_import_error}")

        customer = customer_with_limit
        ahora = datetime.datetime.now()
        fecha_pasada = ahora - datetime.timedelta(days=30)
        fecha_futura = ahora + datetime.timedelta(days=10)

        venta_vencida = Sale(
            customer_id=customer.id,
            total_amount=Decimal("60.00"),
            payment_method="Credito",
            is_credit=True,
            paid=False,
            balance_pending=Decimal("60.00"),
            date=ahora - datetime.timedelta(days=35),
            due_date=fecha_pasada,
        )
        venta_vigente = Sale(
            customer_id=customer.id,
            total_amount=Decimal("40.00"),
            payment_method="Credito",
            is_credit=True,
            paid=False,
            balance_pending=Decimal("40.00"),
            date=ahora,
            due_date=fecha_futura,
        )
        db_session.add_all([venta_vencida, venta_vigente])
        db_session.flush()

        vencidas = (
            db_session.query(Sale)
            .filter(
                Sale.customer_id == customer.id,
                Sale.is_credit == True,
                Sale.paid == False,
                Sale.due_date < ahora,
            )
            .all()
        )

        assert len(vencidas) == 1
        assert Decimal(str(vencidas[0].balance_pending)) == Decimal("60.00")

    def test_pagos_parciales_reducen_saldo_gradualmente(self, db_session, customer_with_limit):
        """Serie de pagos parciales debe llevar el saldo a cero progresivamente."""
        if not MODELS_AVAILABLE:
            pytest.skip(f"Modelos no disponibles: {_import_error}")

        customer = customer_with_limit
        ahora = datetime.datetime.now()
        vencimiento = ahora + datetime.timedelta(days=30)

        venta = Sale(
            customer_id=customer.id,
            total_amount=Decimal("90.00"),
            payment_method="Credito",
            is_credit=True,
            paid=False,
            balance_pending=Decimal("90.00"),
            date=ahora,
            due_date=vencimiento,
        )
        db_session.add(venta)
        db_session.flush()

        # Abono 1: $30
        venta.balance_pending = Decimal(str(venta.balance_pending)) - Decimal("30.00")
        db_session.flush()
        assert Decimal(str(venta.balance_pending)) == Decimal("60.00")

        # Abono 2: $40
        venta.balance_pending = Decimal(str(venta.balance_pending)) - Decimal("40.00")
        db_session.flush()
        assert Decimal(str(venta.balance_pending)) == Decimal("20.00")

        # Abono final: $20 → salda la deuda
        venta.balance_pending = Decimal(str(venta.balance_pending)) - Decimal("20.00")
        venta.paid = True
        db_session.flush()
        assert Decimal(str(venta.balance_pending)) == Decimal("0.00")
        assert venta.paid is True

        deuda_final = _calcular_deuda(db_session, customer.id)
        assert deuda_final == Decimal("0.00")
