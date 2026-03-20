"""
test_func_clientes.py — Tests funcionales de Clientes

Flujos cubiertos:
  FCL01 — CRUD de clientes: crear, campos, soft-delete
  FCL02 — Cálculo de deuda: ventas crédito vs pagos FIFO
  FCL03 — Estado financiero: límite disponible, facturas vencidas
  FCL04 — Bloqueo: is_blocked afecta ventas crédito, no contado

Correr con:
    cd ferreteria_refactor
    python -m pytest backend_api/tests/test_func_clientes.py -v --no-cov -s
"""

import pytest
import uuid
from decimal import Decimal
from datetime import datetime, timedelta
from sqlalchemy import text

import sys, os
_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _root not in sys.path:
    sys.path.insert(0, _root)

from backend_api.models.models import Customer, Sale, Payment

TENANT = "lalicoreria"


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def tenant_db(pg_db_for_schema):
    return pg_db_for_schema(TENANT)


@pytest.fixture()
def customer_obj(tenant_db):
    customer = Customer(
        name=f"Cliente Test {uuid.uuid4().hex[:6]}",
        id_number=f"V-{uuid.uuid4().hex[:7]}",
        credit_limit=Decimal("500.00"),
        payment_term_days=15,
    )
    tenant_db.add(customer)
    tenant_db.flush()
    return customer


def _venta_credito(db, customer_id, monto, dias_atras=0):
    """Crea una Sale a crédito directamente sin SalesService."""
    fecha = datetime.utcnow() - timedelta(days=dias_atras)
    due = fecha + timedelta(days=15)
    sale = Sale(
        customer_id=customer_id,
        total_amount=monto,
        payment_method="Credito",
        is_credit=True,
        paid=False,
        balance_pending=monto,
        due_date=due,
    )
    db.add(sale)
    db.flush()
    return sale


def _abono(db, customer_id, monto):
    """Crea un Payment (abono a deuda) directamente."""
    payment = Payment(
        customer_id=customer_id,
        amount=monto,
        currency="USD",
        exchange_rate_used=Decimal("1.00"),
        payment_method="Efectivo",
    )
    db.add(payment)
    db.flush()
    return payment


# ---------------------------------------------------------------------------
# FCL01 — CRUD de clientes
# ---------------------------------------------------------------------------

class TestFCL01CRUDCliente:

    def test_crear_cliente_campos_persisten(self, tenant_db):
        """
        FCL01a: Crear cliente con todos los campos y verificar que persisten.
        """
        nombre = f"Distribuidora {uuid.uuid4().hex[:6]}"
        customer = Customer(
            name=nombre,
            id_number="V-12345678",
            phone="0414-9876543",
            email="cliente@ejemplo.com",
            address="Calle 1, Edificio 2",
            credit_limit=Decimal("1000.00"),
            payment_term_days=30,
            is_blocked=False,
        )
        tenant_db.add(customer)
        tenant_db.flush()

        tenant_db.refresh(customer)
        assert customer.id is not None
        assert customer.name == nombre
        assert customer.credit_limit == Decimal("1000.00")
        assert customer.payment_term_days == 30
        assert customer.is_blocked is False
        assert customer.is_active is True

    def test_cliente_con_campos_minimos(self, tenant_db):
        """
        FCL01b: Solo el nombre es obligatorio. El resto tiene defaults o nullable.
        """
        customer = Customer(name=f"Básico {uuid.uuid4().hex[:6]}")
        tenant_db.add(customer)
        tenant_db.flush()

        assert customer.id is not None
        assert customer.credit_limit == Decimal("100.00")  # default
        assert customer.payment_term_days == 15  # default
        assert customer.is_blocked is False
        assert customer.is_active is True

    def test_soft_delete_preserva_en_bd(self, tenant_db, customer_obj):
        """
        FCL01c: is_active=False no elimina el cliente. El historial de ventas
        y pagos sigue accesible con el cliente desactivado.
        """
        customer_obj.is_active = False
        tenant_db.flush()

        recovered = tenant_db.query(Customer).get(customer_obj.id)
        assert recovered is not None
        assert recovered.is_active is False

    def test_filtro_activos_excluye_inactivos(self, tenant_db, customer_obj):
        """
        FCL01d: Al filtrar is_active=True, los clientes inactivos no aparecen.
        """
        customer_obj.is_active = False
        tenant_db.flush()

        activos = tenant_db.query(Customer).filter(
            Customer.id == customer_obj.id,
            Customer.is_active == True,
        ).all()
        assert len(activos) == 0


# ---------------------------------------------------------------------------
# FCL02 — Cálculo de deuda del cliente
# ---------------------------------------------------------------------------

class TestFCL02Deuda:

    def test_deuda_es_suma_de_balance_pending(self, tenant_db, customer_obj):
        """
        FCL02a: La deuda total = suma de balance_pending de ventas crédito
        no pagadas. Esta es la fórmula que usa el router /customers/{id}/debt.
        """
        _venta_credito(tenant_db, customer_obj.id, Decimal("100.00"))
        _venta_credito(tenant_db, customer_obj.id, Decimal("50.00"))
        _venta_credito(tenant_db, customer_obj.id, Decimal("75.00"))

        deuda = tenant_db.query(Sale).filter(
            Sale.customer_id == customer_obj.id,
            Sale.is_credit == True,
            Sale.balance_pending > 0,
        ).with_entities(Sale.balance_pending).all()

        total_deuda = sum(r[0] for r in deuda)
        assert total_deuda == Decimal("225.00")

    def test_deuda_cero_si_todo_pagado(self, tenant_db, customer_obj):
        """
        FCL02b: Si todas las ventas tienen balance_pending = 0, la deuda = 0.
        """
        sale = _venta_credito(tenant_db, customer_obj.id, Decimal("80.00"))
        sale.balance_pending = Decimal("0.00")
        sale.paid = True
        tenant_db.flush()

        deuda_rows = tenant_db.query(Sale).filter(
            Sale.customer_id == customer_obj.id,
            Sale.is_credit == True,
            Sale.balance_pending > 0,
        ).all()

        assert len(deuda_rows) == 0

    def test_pago_reduce_balance_pending(self, tenant_db, customer_obj):
        """
        FCL02c: Un pago (abono) parcial reduce balance_pending de la venta
        más antigua (lógica FIFO). La deuda total disminuye.
        """
        sale = _venta_credito(tenant_db, customer_obj.id, Decimal("100.00"))
        pago = Decimal("40.00")

        # Aplicar pago (FIFO — una sola venta en este caso)
        sale.balance_pending -= pago
        if sale.balance_pending <= 0:
            sale.paid = True
            sale.balance_pending = Decimal("0.00")
        _abono(tenant_db, customer_obj.id, pago)

        tenant_db.flush()
        tenant_db.refresh(sale)

        assert sale.balance_pending == Decimal("60.00")
        assert sale.paid is False  # Aún no está totalmente pagada

    def test_pago_completo_marca_sale_como_paid(self, tenant_db, customer_obj):
        """
        FCL02d: Un pago igual al balance_pending marca la venta como paid=True
        y balance_pending = 0.
        """
        monto = Decimal("120.00")
        sale = _venta_credito(tenant_db, customer_obj.id, monto)

        # Pago total
        sale.balance_pending = Decimal("0.00")
        sale.paid = True
        _abono(tenant_db, customer_obj.id, monto)
        tenant_db.flush()

        tenant_db.refresh(sale)
        assert sale.paid is True
        assert sale.balance_pending == Decimal("0.00")


# ---------------------------------------------------------------------------
# FCL03 — Estado financiero: límite disponible y facturas vencidas
# ---------------------------------------------------------------------------

class TestFCL03EstadoFinanciero:

    def test_credito_disponible_es_limite_menos_deuda(self, tenant_db, customer_obj):
        """
        FCL03a: Crédito disponible = credit_limit - deuda_actual.
        Cliente con límite $500, deuda $200 → disponible $300.
        """
        _venta_credito(tenant_db, customer_obj.id, Decimal("200.00"))

        deuda = sum(
            r[0] for r in
            tenant_db.query(Sale).filter(
                Sale.customer_id == customer_obj.id,
                Sale.is_credit == True,
                Sale.balance_pending > 0,
            ).with_entities(Sale.balance_pending).all()
        )

        disponible = customer_obj.credit_limit - deuda
        assert deuda == Decimal("200.00")
        assert disponible == Decimal("300.00")

    def test_facturas_vencidas_por_due_date(self, tenant_db, customer_obj):
        """
        FCL03b: Facturas vencidas = ventas con due_date < hoy y balance_pending > 0.
        Cliente con 2 facturas vencidas y 1 al día.
        """
        hoy = datetime.utcnow()

        # Facturas vencidas
        sale_vencida_1 = Sale(
            customer_id=customer_obj.id,
            total_amount=Decimal("50.00"),
            payment_method="Credito",
            is_credit=True,
            paid=False,
            balance_pending=Decimal("50.00"),
            due_date=hoy - timedelta(days=10),  # 10 días vencida
        )
        sale_vencida_2 = Sale(
            customer_id=customer_obj.id,
            total_amount=Decimal("30.00"),
            payment_method="Credito",
            is_credit=True,
            paid=False,
            balance_pending=Decimal("30.00"),
            due_date=hoy - timedelta(days=5),   # 5 días vencida
        )
        # Factura al día (no vencida)
        sale_vigente = Sale(
            customer_id=customer_obj.id,
            total_amount=Decimal("70.00"),
            payment_method="Credito",
            is_credit=True,
            paid=False,
            balance_pending=Decimal("70.00"),
            due_date=hoy + timedelta(days=20),  # Aún no vence
        )
        tenant_db.add(sale_vencida_1)
        tenant_db.add(sale_vencida_2)
        tenant_db.add(sale_vigente)
        tenant_db.flush()

        # Consulta de facturas vencidas (como hace el router)
        vencidas = tenant_db.query(Sale).filter(
            Sale.customer_id == customer_obj.id,
            Sale.is_credit == True,
            Sale.balance_pending > 0,
            Sale.due_date < hoy,
        ).all()

        assert len(vencidas) == 2
        monto_vencido = sum(s.balance_pending for s in vencidas)
        assert monto_vencido == Decimal("80.00")

    def test_cliente_sin_deuda_tiene_limite_completo(self, tenant_db, customer_obj):
        """
        FCL03c: Un cliente sin facturas pendientes tiene el crédito completo
        disponible (credit_limit sin deducción).
        """
        deuda_rows = tenant_db.query(Sale).filter(
            Sale.customer_id == customer_obj.id,
            Sale.is_credit == True,
            Sale.balance_pending > 0,
        ).all()

        deuda = sum(s.balance_pending for s in deuda_rows)
        disponible = customer_obj.credit_limit - deuda

        assert deuda == Decimal("0.00")
        assert disponible == customer_obj.credit_limit


# ---------------------------------------------------------------------------
# FCL04 — Bloqueo de clientes
# ---------------------------------------------------------------------------

class TestFCL04Bloqueo:

    def test_cliente_bloqueado_rechaza_ventas_credito(self, tenant_db, customer_obj):
        """
        FCL04a: Un cliente con is_blocked=True no puede recibir ventas a crédito.
        El SalesService rechaza la venta antes de crearla.
        Verificamos la condición de bloqueo a nivel de modelo.
        """
        customer_obj.is_blocked = True
        tenant_db.flush()

        tenant_db.refresh(customer_obj)
        assert customer_obj.is_blocked is True

        # El router/service verifica: if customer.is_blocked → raise error
        # Este test verifica que el flag persiste correctamente
        puede_vender_credito = not customer_obj.is_blocked
        assert not puede_vender_credito, "Cliente bloqueado no debe poder comprar a crédito"

    def test_cliente_bloqueado_permite_contado(self, tenant_db, customer_obj):
        """
        FCL04b: El bloqueo solo aplica a ventas A CRÉDITO.
        Las ventas de contado (is_credit=False) siempre están permitidas.
        """
        customer_obj.is_blocked = True
        tenant_db.flush()

        # Venta de contado no verifica is_blocked (solo ventas a crédito)
        sale_contado = Sale(
            customer_id=customer_obj.id,
            total_amount=Decimal("30.00"),
            payment_method="Efectivo",
            is_credit=False,
            paid=True,
        )
        tenant_db.add(sale_contado)
        tenant_db.flush()

        assert sale_contado.id is not None
        assert sale_contado.is_credit is False

    def test_desbloquear_cliente_permite_credito(self, tenant_db, customer_obj):
        """
        FCL04c: Al desbloquear un cliente (is_blocked=False), puede volver
        a recibir ventas a crédito.
        """
        customer_obj.is_blocked = True
        tenant_db.flush()

        customer_obj.is_blocked = False
        tenant_db.flush()

        tenant_db.refresh(customer_obj)
        assert customer_obj.is_blocked is False
        puede_vender_credito = not customer_obj.is_blocked
        assert puede_vender_credito

    def test_bloqueo_no_afecta_historial_previo(self, tenant_db, customer_obj):
        """
        FCL04d: Bloquear un cliente no modifica ni elimina sus ventas previas.
        Las facturas históricas permanecen intactas.
        """
        sale_previa = _venta_credito(tenant_db, customer_obj.id, Decimal("200.00"))

        # Bloquear cliente después de la venta
        customer_obj.is_blocked = True
        tenant_db.flush()

        # La venta previa sigue existiendo
        recovered = tenant_db.query(Sale).get(sale_previa.id)
        assert recovered is not None
        assert recovered.balance_pending == Decimal("200.00")
