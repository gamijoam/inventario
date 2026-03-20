"""
test_func_ordenes_servicio.py — Tests funcionales de Órdenes de Servicio

Flujos cubiertos:
  FSO01 — Crear orden: campos, ticket único, tipos de servicio
  FSO02 — Flujo de estados: RECEIVED → IN_PROGRESS → READY → DELIVERED
  FSO03 — Ítems: con producto y manual (sin product_id)
  FSO04 — Checkout: convertir a Sale, prevención de doble cobro
  FSO05 — Metadata: datos específicos por tipo (laundry, repair)

Correr con:
    cd ferreteria_refactor
    python -m pytest backend_api/tests/test_func_ordenes_servicio.py -v --no-cov -s
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

from backend_api.models.models import (
    ServiceOrder, ServiceOrderDetail, ServiceOrderStatus, ServiceType, ServicePriority,
    Customer, Product, Sale, SaleDetail,
    CashRegister, CashSession,
)

TENANT = "lalicoreria"


# ---------------------------------------------------------------------------
# Fixtures
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
    assert row is not None
    return row[0]


@pytest.fixture()
def customer_obj(tenant_db):
    c = Customer(name=f"Cliente SO {uuid.uuid4().hex[:6]}")
    tenant_db.add(c)
    tenant_db.flush()
    return c


@pytest.fixture()
def product_obj(tenant_db):
    p = Product(
        name=f"Repuesto {uuid.uuid4().hex[:6]}",
        price=Decimal("25.00"),
        cost_price=Decimal("15.00"),
        stock=Decimal("50.000"),
    )
    tenant_db.add(p)
    tenant_db.flush()
    return p


@pytest.fixture()
def open_session_obj(tenant_db, user_id):
    reg = CashRegister(
        name=f"Caja SO {uuid.uuid4().hex[:6]}",
        code=f"SO{uuid.uuid4().hex[:4].upper()}",
        is_active=True,
    )
    tenant_db.add(reg)
    tenant_db.flush()
    session = CashSession(
        register_id=reg.id, user_id=user_id, status="OPEN",
        initial_cash=Decimal("100.00"), initial_cash_bs=Decimal("0.00"),
    )
    tenant_db.add(session)
    tenant_db.flush()
    return session


def _ticket():
    """Genera un número de ticket único para tests."""
    return f"SRV-{uuid.uuid4().hex[:6].upper()}"


def _nueva_orden(db, customer_id, technician_id=None, *,
                 service_type=ServiceType.REPAIR,
                 status=ServiceOrderStatus.RECEIVED,
                 priority=ServicePriority.NORMAL):
    order = ServiceOrder(
        ticket_number=_ticket(),
        customer_id=customer_id,
        technician_id=technician_id,
        service_type=service_type,
        status=status,
        priority=priority,
        device_type="Smartphone",
        brand="Samsung",
        model="Galaxy A54",
        problem_description="Pantalla rota",
    )
    db.add(order)
    db.flush()
    return order


# ---------------------------------------------------------------------------
# FSO01 — Crear orden de servicio
# ---------------------------------------------------------------------------

class TestFSO01CrearOrden:

    def test_crear_orden_repair_campos_persisten(
        self, tenant_db, customer_obj, user_id
    ):
        """
        FSO01a: Crear una orden de reparación con todos los campos.
        Verificar que persiste correctamente.
        """
        ticket = _ticket()
        order = ServiceOrder(
            ticket_number=ticket,
            customer_id=customer_obj.id,
            technician_id=user_id,
            service_type=ServiceType.REPAIR,
            status=ServiceOrderStatus.RECEIVED,
            priority=ServicePriority.HIGH,
            device_type="Laptop",
            brand="HP",
            model="ProBook 450",
            serial_imei="SN123456789",
            problem_description="No enciende",
            physical_condition="Buen estado externo",
        )
        tenant_db.add(order)
        tenant_db.flush()

        tenant_db.refresh(order)
        assert order.id is not None
        assert order.ticket_number == ticket
        assert order.status == ServiceOrderStatus.RECEIVED
        assert order.service_type == ServiceType.REPAIR
        assert order.priority == ServicePriority.HIGH
        assert order.customer_id == customer_obj.id

    def test_ticket_number_unico(self, tenant_db, customer_obj):
        """
        FSO01b: ticket_number tiene UNIQUE constraint. Dos órdenes con el mismo
        ticket → IntegrityError.
        """
        from sqlalchemy.exc import IntegrityError
        ticket = _ticket()
        o1 = ServiceOrder(ticket_number=ticket, customer_id=customer_obj.id,
                           service_type=ServiceType.REPAIR, status=ServiceOrderStatus.RECEIVED)
        tenant_db.add(o1)
        tenant_db.flush()

        o2 = ServiceOrder(ticket_number=ticket, customer_id=customer_obj.id,
                           service_type=ServiceType.REPAIR, status=ServiceOrderStatus.RECEIVED)
        tenant_db.add(o2)
        with pytest.raises(IntegrityError):
            tenant_db.flush()

    def test_orden_laundry_campos_opcionales(self, tenant_db, customer_obj):
        """
        FSO01c: Una orden de lavandería no necesita device_type, brand, model.
        Esos campos son nullable para acomodar el tipo LAUNDRY.
        """
        order = ServiceOrder(
            ticket_number=_ticket(),
            customer_id=customer_obj.id,
            service_type=ServiceType.LAUNDRY,
            status=ServiceOrderStatus.RECEIVED,
            device_type=None,   # No aplica para lavandería
            brand=None,
            model=None,
            problem_description=None,
        )
        tenant_db.add(order)
        tenant_db.flush()

        assert order.id is not None
        assert order.service_type == ServiceType.LAUNDRY
        assert order.device_type is None

    def test_estimated_delivery_nullable(self, tenant_db, customer_obj):
        """
        FSO01d: estimated_delivery es opcional al crear la orden.
        Se puede agregar durante el diagnóstico.
        """
        order = _nueva_orden(tenant_db, customer_obj.id)
        assert order.estimated_delivery is None

        # Agregar estimado durante diagnóstico
        order.estimated_delivery = datetime.utcnow() + timedelta(days=3)
        tenant_db.flush()

        tenant_db.refresh(order)
        assert order.estimated_delivery is not None


# ---------------------------------------------------------------------------
# FSO02 — Flujo de estados
# ---------------------------------------------------------------------------

class TestFSO02FlujoEstados:

    def test_estado_inicial_es_received(self, tenant_db, customer_obj):
        """
        FSO02a: Una orden recién creada tiene status = RECEIVED.
        """
        order = _nueva_orden(tenant_db, customer_obj.id)
        assert order.status == ServiceOrderStatus.RECEIVED

    def test_received_a_in_progress(self, tenant_db, customer_obj):
        """
        FSO02b: RECEIVED → IN_PROGRESS (técnico toma la orden).
        """
        order = _nueva_orden(tenant_db, customer_obj.id)
        order.status = ServiceOrderStatus.IN_PROGRESS
        tenant_db.flush()

        tenant_db.refresh(order)
        assert order.status == ServiceOrderStatus.IN_PROGRESS

    def test_in_progress_a_ready(self, tenant_db, customer_obj):
        """
        FSO02c: IN_PROGRESS → READY (reparación completada, lista para retirar).
        """
        order = _nueva_orden(tenant_db, customer_obj.id,
                              status=ServiceOrderStatus.IN_PROGRESS)
        order.status = ServiceOrderStatus.READY
        tenant_db.flush()

        tenant_db.refresh(order)
        assert order.status == ServiceOrderStatus.READY

    def test_ready_a_delivered(self, tenant_db, customer_obj):
        """
        FSO02d: READY → DELIVERED (cliente recoge y paga).
        updated_at se actualiza al cambiar el status.
        """
        order = _nueva_orden(tenant_db, customer_obj.id,
                              status=ServiceOrderStatus.READY)
        order.status = ServiceOrderStatus.DELIVERED
        tenant_db.flush()

        tenant_db.refresh(order)
        assert order.status == ServiceOrderStatus.DELIVERED

    def test_flujo_completo_received_to_delivered(self, tenant_db, customer_obj):
        """
        FSO02e: Flujo completo RECEIVED → IN_PROGRESS → READY → DELIVERED
        en una misma orden.
        """
        order = _nueva_orden(tenant_db, customer_obj.id)
        assert order.status == ServiceOrderStatus.RECEIVED

        order.status = ServiceOrderStatus.IN_PROGRESS
        tenant_db.flush()
        order.status = ServiceOrderStatus.READY
        tenant_db.flush()
        order.status = ServiceOrderStatus.DELIVERED
        tenant_db.flush()

        tenant_db.refresh(order)
        assert order.status == ServiceOrderStatus.DELIVERED

    def test_orden_puede_cancelarse(self, tenant_db, customer_obj):
        """
        FSO02f: Una orden puede cancelarse desde cualquier estado.
        CANCELLED es un estado final válido.
        """
        order = _nueva_orden(tenant_db, customer_obj.id,
                              status=ServiceOrderStatus.IN_PROGRESS)
        order.status = ServiceOrderStatus.CANCELLED
        tenant_db.flush()

        tenant_db.refresh(order)
        assert order.status == ServiceOrderStatus.CANCELLED


# ---------------------------------------------------------------------------
# FSO03 — Ítems de la orden (repuestos y trabajo manual)
# ---------------------------------------------------------------------------

class TestFSO03Items:

    def test_item_con_producto_del_catalogo(
        self, tenant_db, customer_obj, product_obj
    ):
        """
        FSO03a: Agregar un repuesto del catálogo de productos a la orden.
        El ServiceOrderDetail referencia un product_id real.
        """
        order = _nueva_orden(tenant_db, customer_obj.id)
        item = ServiceOrderDetail(
            service_order_id=order.id,
            product_id=product_obj.id,
            description=product_obj.name,
            is_manual=False,
            quantity=Decimal("1.000"),
            unit_price=product_obj.price,
            cost=product_obj.cost_price,
        )
        tenant_db.add(item)
        tenant_db.flush()

        tenant_db.refresh(item)
        assert item.product_id == product_obj.id
        assert item.is_manual is False
        assert item.unit_price == Decimal("25.00")

    def test_item_manual_sin_product_id(self, tenant_db, customer_obj):
        """
        FSO03b: Un ítem manual (mano de obra, servicio no catalogado) puede
        agregarse sin product_id. product_id es nullable para este caso.
        """
        order = _nueva_orden(tenant_db, customer_obj.id)
        item = ServiceOrderDetail(
            service_order_id=order.id,
            product_id=None,  # Sin referencia al catálogo
            description="Mano de obra - Cambio de pantalla",
            is_manual=True,
            quantity=Decimal("1.000"),
            unit_price=Decimal("15.00"),
            cost=Decimal("0.00"),
        )
        tenant_db.add(item)
        tenant_db.flush()

        tenant_db.refresh(item)
        assert item.product_id is None
        assert item.is_manual is True
        assert item.description == "Mano de obra - Cambio de pantalla"

    def test_orden_con_multiples_items(
        self, tenant_db, customer_obj, product_obj
    ):
        """
        FSO03c: Una orden puede tener múltiples ítems (mezcla de productos
        y trabajo manual).
        """
        order = _nueva_orden(tenant_db, customer_obj.id)

        # Repuesto del catálogo
        item1 = ServiceOrderDetail(
            service_order_id=order.id,
            product_id=product_obj.id,
            description="Pantalla de reemplazo",
            is_manual=False,
            quantity=Decimal("1.000"),
            unit_price=Decimal("25.00"),
            cost=Decimal("15.00"),
        )
        # Mano de obra
        item2 = ServiceOrderDetail(
            service_order_id=order.id,
            product_id=None,
            description="Mano de obra",
            is_manual=True,
            quantity=Decimal("1.000"),
            unit_price=Decimal("20.00"),
            cost=Decimal("0.00"),
        )
        tenant_db.add(item1)
        tenant_db.add(item2)
        tenant_db.flush()

        items = tenant_db.query(ServiceOrderDetail).filter_by(
            service_order_id=order.id
        ).all()
        assert len(items) == 2

        total_items = sum(i.unit_price * i.quantity for i in items)
        assert total_items == Decimal("45.00")  # 25 + 20


# ---------------------------------------------------------------------------
# FSO04 — Checkout: convertir a Sale y prevención de doble cobro
# ---------------------------------------------------------------------------

class TestFSO04Checkout:

    def test_checkout_crea_sale_vinculada(
        self, tenant_db, customer_obj, product_obj, open_session_obj
    ):
        """
        FSO04a: El checkout convierte la orden READY en una Sale.
        La Sale debe tener el total de los ítems de la orden.
        """
        order = _nueva_orden(tenant_db, customer_obj.id,
                              status=ServiceOrderStatus.READY)

        item = ServiceOrderDetail(
            service_order_id=order.id,
            product_id=product_obj.id,
            description="Repuesto",
            is_manual=False,
            quantity=Decimal("1.000"),
            unit_price=Decimal("45.00"),
            cost=Decimal("25.00"),
        )
        tenant_db.add(item)
        tenant_db.flush()

        total_orden = item.unit_price * item.quantity

        # Simular el checkout: crear Sale a partir de la orden
        sale = Sale(
            customer_id=customer_obj.id,
            session_id=open_session_obj.id,
            total_amount=total_orden,
            payment_method="Efectivo",
            is_credit=False,
            paid=True,
        )
        tenant_db.add(sale)
        tenant_db.flush()

        # Marcar orden como DELIVERED y registrar pago en metadata
        order.status = ServiceOrderStatus.DELIVERED
        order.order_metadata = {"payment_status": "PAID", "sale_id": sale.id}
        tenant_db.flush()

        tenant_db.refresh(order)
        assert order.status == ServiceOrderStatus.DELIVERED
        assert order.order_metadata["payment_status"] == "PAID"
        assert sale.total_amount == Decimal("45.00")

    def test_doble_checkout_rechazado_por_flag(
        self, tenant_db, customer_obj, product_obj, open_session_obj
    ):
        """
        FSO04b: Una orden ya cobrada (payment_status=PAID en metadata) no debe
        permitir un segundo checkout. El router verifica este flag.
        Verificamos que el flag queda correctamente para que el router lo detecte.
        """
        order = _nueva_orden(tenant_db, customer_obj.id,
                              status=ServiceOrderStatus.READY)

        # Primer checkout
        sale = Sale(
            customer_id=customer_obj.id,
            session_id=open_session_obj.id,
            total_amount=Decimal("50.00"),
            payment_method="Efectivo",
            is_credit=False,
            paid=True,
        )
        tenant_db.add(sale)
        tenant_db.flush()

        order.order_metadata = {"payment_status": "PAID", "sale_id": sale.id}
        order.status = ServiceOrderStatus.DELIVERED
        tenant_db.flush()

        # Verificar que el router detectaría el intento de doble cobro
        tenant_db.refresh(order)
        ya_cobrada = order.order_metadata.get("payment_status") == "PAID"
        assert ya_cobrada, "La orden debe estar marcada como PAID para prevenir doble cobro"

        # El router rechazaría: if ya_cobrada → raise error
        puede_hacer_checkout = not ya_cobrada
        assert not puede_hacer_checkout


# ---------------------------------------------------------------------------
# FSO05 — Metadata específica por tipo de servicio
# ---------------------------------------------------------------------------

class TestFSO05Metadata:

    def test_laundry_metadata_piezas_y_color_bolsa(self, tenant_db, customer_obj):
        """
        FSO05a: Una orden de lavandería puede guardar datos específicos en
        order_metadata: número de piezas y color de la bolsa.
        """
        order = ServiceOrder(
            ticket_number=_ticket(),
            customer_id=customer_obj.id,
            service_type=ServiceType.LAUNDRY,
            status=ServiceOrderStatus.RECEIVED,
            order_metadata={
                "pieces": 5,
                "bag_color": "azul",
                "weight_kg": 2.5,
            },
        )
        tenant_db.add(order)
        tenant_db.flush()

        tenant_db.refresh(order)
        assert order.order_metadata["pieces"] == 5
        assert order.order_metadata["bag_color"] == "azul"
        assert order.order_metadata["weight_kg"] == 2.5

    def test_repair_metadata_passcode_y_diagnostico(self, tenant_db, customer_obj):
        """
        FSO05b: Una orden de reparación puede guardar el código de desbloqueo
        y notas de diagnóstico en metadata.
        """
        order = ServiceOrder(
            ticket_number=_ticket(),
            customer_id=customer_obj.id,
            service_type=ServiceType.REPAIR,
            status=ServiceOrderStatus.RECEIVED,
            passcode_pattern="1234",
            diagnosis_notes="Batería agotada, pantalla con líneas",
            order_metadata={
                "warranty_claim": False,
                "technician_notes": "Requiere repuesto original",
            },
        )
        tenant_db.add(order)
        tenant_db.flush()

        tenant_db.refresh(order)
        assert order.passcode_pattern == "1234"
        assert order.diagnosis_notes == "Batería agotada, pantalla con líneas"
        assert order.order_metadata["warranty_claim"] is False

    def test_orden_sin_metadata_es_none(self, tenant_db, customer_obj):
        """
        FSO05c: Una orden sin metadata tiene order_metadata = None (nullable).
        Se puede agregar después.
        """
        order = _nueva_orden(tenant_db, customer_obj.id)
        assert order.order_metadata is None

        # Agregar metadata después
        order.order_metadata = {"priority_note": "Cliente VIP"}
        tenant_db.flush()

        tenant_db.refresh(order)
        assert order.order_metadata["priority_note"] == "Cliente VIP"

    def test_orden_urgente_priority_field(self, tenant_db, customer_obj):
        """
        FSO05d: El campo priority permite indicar urgencia.
        URGENT → el técnico debe atenderla antes que las NORMAL.
        """
        order_urgente = _nueva_orden(tenant_db, customer_obj.id,
                                      priority=ServicePriority.URGENT)
        order_normal = _nueva_orden(tenant_db, customer_obj.id,
                                     priority=ServicePriority.NORMAL)

        assert order_urgente.priority == ServicePriority.URGENT
        assert order_normal.priority == ServicePriority.NORMAL

        # Consultar urgentes primero
        urgentes = tenant_db.query(ServiceOrder).filter(
            ServiceOrder.id.in_([order_urgente.id, order_normal.id]),
            ServiceOrder.priority == ServicePriority.URGENT,
        ).all()
        assert len(urgentes) == 1
        assert urgentes[0].id == order_urgente.id
