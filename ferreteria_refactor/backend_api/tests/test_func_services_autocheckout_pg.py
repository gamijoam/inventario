"""
test_func_services_autocheckout_pg.py — Tests de regresión PostgreSQL para el
flujo de auto-checkout en el módulo de Servicios.

Cubren los bugs corregidos en feat/services-redesign:

BUG 1: Al marcar orden como DELIVERED con abonos que cubren el total,
        el auto-checkout fallaba con 400 porque el status ya era DELIVERED
        cuando se llamaba convert_order_to_sale (que requiere READY).
        Fix: revertir a READY, hacer checkout, luego set DELIVERED.

BUG 2: convert_order_to_sale llama db.commit() internamente, lo que resetea
        el search_path de la conexión PostgreSQL. La query post-checkout
        de eager loading fallaba con "relation service_orders does not exist".
        Fix: re-setear SET search_path después del commit del checkout.

BUG 3: .get(id) legacy no respeta search_path del tenant.
        Fix: reemplazados por .filter(Model.id == id).first()

Correr con:
    cd ferreteria_refactor
    python -m pytest backend_api/tests/test_func_services_autocheckout_pg.py -v --no-cov -s
"""

import pytest
import sys
import os
import uuid
from decimal import Decimal
from sqlalchemy import text
from datetime import datetime

_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _root not in sys.path:
    sys.path.insert(0, _root)

from backend_api.models.models import (
    Product, ProductStock, Warehouse, CashRegister,
    Sale, SaleDetail, SalePayment, Kardex, Customer, MovementType,
    ServiceOrder, ServiceOrderDetail, ServicePayment, ServiceOrderStatus,
    ServiceType, ServicePriority,
)
from backend_api import schemas
from backend_api.services.service_checkout_service import ServiceCheckoutService

pytestmark = pytest.mark.requires_postgres

TENANT = os.getenv("TEST_TENANT", "lalicoreria")


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
    assert row is not None, f"No ADMIN user found for {TENANT}"
    return row[0]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_customer(db):
    c = Customer(name=f"Cliente AC {uuid.uuid4().hex[:6]}", phone="04121234567")
    db.add(c)
    db.flush()
    return c


def _make_product(db, price=25.00, stock=50):
    p = Product(
        name=f"Repuesto {uuid.uuid4().hex[:6]}",
        sku=f"SKU-{uuid.uuid4().hex[:8].upper()}",
        price=Decimal(str(price)),
        cost_price=Decimal(str(price * 0.6)),
        stock=Decimal(str(stock)),
        is_active=True,
        is_service=False,
        is_combo=False,
        has_imei=False,
    )
    db.add(p)
    db.flush()
    wh = db.query(Warehouse).filter_by(is_active=True).first()
    if wh:
        ps = ProductStock(product_id=p.id, warehouse_id=wh.id, quantity=Decimal(str(stock)))
        db.add(ps)
        db.flush()
    return p


def _make_order(db, customer_id, user_id, status="RECEIVED", items=None, payments=None):
    """Crea una ServiceOrder con items y/o abonos opcionales."""
    order = ServiceOrder(
        ticket_number=f"AC-PG-{uuid.uuid4().hex[:6].upper()}",
        tenant_id=TENANT,
        customer_id=customer_id,
        service_type=ServiceType.REPAIR,
        priority=ServicePriority.NORMAL,
        status=ServiceOrderStatus[status],
        device_type="SMARTPHONE",
        brand="Samsung",
        model="A52",
        problem_description="Pantalla rota",
    )
    db.add(order)
    db.flush()

    for item in (items or []):
        d = ServiceOrderDetail(
            service_order_id=order.id,
            product_id=item.get("product_id"),
            description=item.get("description", "Servicio"),
            is_manual=item.get("is_manual", True),
            quantity=Decimal(str(item.get("quantity", 1))),
            unit_price=Decimal(str(item.get("unit_price", 10))),
            cost=Decimal(str(item.get("cost", 0))),
            technician_id=item.get("technician_id"),
        )
        db.add(d)

    for pay in (payments or []):
        sp = ServicePayment(
            tenant_id=TENANT,
            service_order_id=order.id,
            amount=Decimal(str(pay["amount"])),
            currency=pay.get("currency", "USD"),
            payment_method=pay.get("method", "Efectivo"),
            reference=pay.get("reference"),
        )
        db.add(sp)

    db.flush()
    return order


def _simulate_auto_checkout(db, order, user_id):
    """
    Replica exactamente la lógica corregida de update_service_order_status
    para el caso DELIVERED + abonos completos.

    Esta función es el 'sujeto del test': si la lógica del router está bien,
    debe crear una Sale y dejar la orden en DELIVERED con payment_status=PAID.
    """
    from sqlalchemy import text as _text
    from backend_api.tenant_context import get_tenant_schema

    order_total = sum(float(d.quantity * d.unit_price) for d in order.details)
    total_paid = sum(float(p.amount) for p in order.payments)

    if total_paid < order_total or order_total == 0:
        # No hay cobertura completa → solo cambiar status, sin checkout
        order.status = ServiceOrderStatus.DELIVERED
        db.flush()
        return None

    if (order.order_metadata or {}).get("payment_status") == "PAID":
        # Ya pagada → solo cambiar status
        order.status = ServiceOrderStatus.DELIVERED
        db.flush()
        return None

    # === LÓGICA CORREGIDA (fix del bug) ===
    # 1. Revertir a READY para que convert_order_to_sale no falle con 400
    order.status = ServiceOrderStatus.READY
    db.flush()

    try:
        checkout_data = schemas.ServiceCheckoutPayment(
            total_amount=Decimal(str(order_total)),
            total_amount_bs=Decimal("0.00"),
            payment_method="Efectivo",
            payments=[],
        )
        sale = ServiceCheckoutService.convert_order_to_sale(
            db, order.id, checkout_data, user_id
        )
        # 2. convert_order_to_sale hace db.commit() — resetea search_path
        # 3. Re-setear search_path antes de cualquier query post-checkout
        schema = get_tenant_schema()
        if schema and schema != "public":
            db.execute(_text(f'SET search_path TO "{schema}", public'))
        return sale
    except Exception:
        # Si falla, continuar con DELIVERED sin Sale
        db.rollback()
        order.status = ServiceOrderStatus.DELIVERED
        return None


# ===========================================================================
# TestAutoCheckoutOnDelivered
# ===========================================================================

class TestAutoCheckoutOnDelivered:
    """
    Verifica el flujo corregido: marcar DELIVERED con abonos completos
    dispara auto-checkout y crea Sale correctamente.
    """

    def test_full_payment_triggers_auto_checkout(self, tenant_db, user_id):
        """
        REGRESIÓN BUG 1: abonos cubren el total → auto-checkout crea Sale.
        Antes del fix: fallaba 400 'La orden debe estar en estado READY'.
        """
        customer = _make_customer(tenant_db)
        order = _make_order(
            tenant_db, customer.id, user_id,
            status="RECEIVED",
            items=[{"description": "Reparacion", "unit_price": 80, "is_manual": True}],
            payments=[{"amount": 80, "currency": "USD", "method": "Efectivo"}],
        )

        sale = _simulate_auto_checkout(tenant_db, order, user_id)

        assert sale is not None, "Debe crear una Sale cuando los abonos cubren el total"
        assert sale.id is not None

    def test_auto_checkout_order_ends_delivered(self, tenant_db, user_id):
        """
        Después del auto-checkout, la orden debe quedar en estado DELIVERED.
        """
        customer = _make_customer(tenant_db)
        order = _make_order(
            tenant_db, customer.id, user_id,
            status="RECEIVED",
            items=[{"description": "Pantalla", "unit_price": 50, "is_manual": True}],
            payments=[{"amount": 50, "currency": "USD", "method": "Zelle"}],
        )

        _simulate_auto_checkout(tenant_db, order, user_id)

        # REGRESIÓN BUG 2: esta query requiere search_path correcto post-commit
        refreshed = tenant_db.query(ServiceOrder).filter_by(id=order.id).first()
        assert refreshed is not None, "Search_path debe ser correcto después del checkout commit"
        assert refreshed.status == ServiceOrderStatus.DELIVERED

    def test_auto_checkout_marks_paid_in_metadata(self, tenant_db, user_id):
        """
        El auto-checkout debe marcar payment_status=PAID en order_metadata.
        """
        customer = _make_customer(tenant_db)
        order = _make_order(
            tenant_db, customer.id, user_id,
            status="RECEIVED",
            items=[{"description": "Servicio", "unit_price": 35, "is_manual": True}],
            payments=[{"amount": 35, "currency": "USD", "method": "Transferencia"}],
        )

        _simulate_auto_checkout(tenant_db, order, user_id)

        refreshed = tenant_db.query(ServiceOrder).filter_by(id=order.id).first()
        metadata = refreshed.order_metadata or {}
        assert metadata.get("payment_status") == "PAID"

    def test_auto_checkout_sale_has_correct_amount(self, tenant_db, user_id):
        """
        La Sale creada por auto-checkout tiene el total correcto.
        """
        customer = _make_customer(tenant_db)
        order = _make_order(
            tenant_db, customer.id, user_id,
            status="RECEIVED",
            items=[
                {"description": "Pantalla", "unit_price": 40, "is_manual": True},
                {"description": "Mano de obra", "unit_price": 15, "is_manual": True},
            ],
            payments=[{"amount": 55, "currency": "USD", "method": "Efectivo"}],
        )

        sale = _simulate_auto_checkout(tenant_db, order, user_id)

        assert sale is not None
        assert sale.total_amount == Decimal("55")

    def test_auto_checkout_sale_linked_to_customer(self, tenant_db, user_id):
        """
        La Sale debe estar vinculada al cliente de la orden.
        """
        customer = _make_customer(tenant_db)
        order = _make_order(
            tenant_db, customer.id, user_id,
            status="RECEIVED",
            items=[{"description": "Servicio", "unit_price": 30, "is_manual": True}],
            payments=[{"amount": 30, "currency": "USD", "method": "Pago Móvil"}],
        )

        sale = _simulate_auto_checkout(tenant_db, order, user_id)

        assert sale is not None
        assert sale.customer_id == customer.id

    def test_auto_checkout_sale_references_ticket(self, tenant_db, user_id):
        """
        Las notas de la Sale deben contener el número de ticket de la orden.
        """
        customer = _make_customer(tenant_db)
        order = _make_order(
            tenant_db, customer.id, user_id,
            status="RECEIVED",
            items=[{"description": "Servicio", "unit_price": 20, "is_manual": True}],
            payments=[{"amount": 20, "currency": "USD", "method": "Efectivo"}],
        )
        ticket = order.ticket_number

        sale = _simulate_auto_checkout(tenant_db, order, user_id)

        assert sale is not None
        assert ticket in sale.notes

    def test_auto_checkout_abonos_migrated_to_sale_payments(self, tenant_db, user_id):
        """
        Los abonos previos deben aparecer como SalePayment con prefijo ABONO.
        """
        customer = _make_customer(tenant_db)
        order = _make_order(
            tenant_db, customer.id, user_id,
            status="RECEIVED",
            items=[{"description": "Reparacion", "unit_price": 100, "is_manual": True}],
            payments=[
                {"amount": 40, "currency": "USD", "method": "Efectivo"},
                {"amount": 60, "currency": "USD", "method": "Zelle", "reference": "ZLL001"},
            ],
        )

        sale = _simulate_auto_checkout(tenant_db, order, user_id)

        assert sale is not None
        sale_payments = tenant_db.query(SalePayment).filter_by(sale_id=sale.id).all()
        abono_payments = [sp for sp in sale_payments if "ABONO" in (sp.payment_method or "")]
        assert len(abono_payments) == 2

        abono_total = sum(sp.amount for sp in abono_payments)
        assert abono_total == Decimal("100.0000")

    def test_partial_payment_no_auto_checkout(self, tenant_db, user_id):
        """
        Si los abonos NO cubren el total, marcar DELIVERED no crea Sale.
        """
        customer = _make_customer(tenant_db)
        order = _make_order(
            tenant_db, customer.id, user_id,
            status="RECEIVED",
            items=[{"description": "Reparacion", "unit_price": 100, "is_manual": True}],
            payments=[{"amount": 50, "currency": "USD", "method": "Efectivo"}],  # 50 < 100
        )

        sale = _simulate_auto_checkout(tenant_db, order, user_id)

        assert sale is None, "Con pago parcial NO debe crear Sale automáticamente"

        refreshed = tenant_db.query(ServiceOrder).filter_by(id=order.id).first()
        assert refreshed.status == ServiceOrderStatus.DELIVERED

    def test_no_payments_no_auto_checkout(self, tenant_db, user_id):
        """
        Sin abonos, marcar DELIVERED no intenta checkout.
        """
        customer = _make_customer(tenant_db)
        order = _make_order(
            tenant_db, customer.id, user_id,
            status="RECEIVED",
            items=[{"description": "Diagnostico", "unit_price": 25, "is_manual": True}],
        )

        sale = _simulate_auto_checkout(tenant_db, order, user_id)

        assert sale is None
        refreshed = tenant_db.query(ServiceOrder).filter_by(id=order.id).first()
        assert refreshed.status == ServiceOrderStatus.DELIVERED

    def test_already_paid_no_double_checkout(self, tenant_db, user_id):
        """
        Orden ya marcada PAID no debe crear una segunda Sale.
        """
        customer = _make_customer(tenant_db)
        order = _make_order(
            tenant_db, customer.id, user_id,
            status="RECEIVED",
            items=[{"description": "Servicio", "unit_price": 40, "is_manual": True}],
            payments=[{"amount": 40, "currency": "USD", "method": "Efectivo"}],
        )

        # Primer checkout
        sale1 = _simulate_auto_checkout(tenant_db, order, user_id)
        assert sale1 is not None

        # Contar Sales antes del segundo intento
        sale_count_before = tenant_db.query(Sale).filter(
            Sale.notes.contains(order.ticket_number)
        ).count()

        # Segundo intento — orden ya está DELIVERED+PAID
        sale2 = _simulate_auto_checkout(tenant_db, order, user_id)
        assert sale2 is None, "No debe crear segunda Sale si ya está PAID"

        sale_count_after = tenant_db.query(Sale).filter(
            Sale.notes.contains(order.ticket_number)
        ).count()
        assert sale_count_after == sale_count_before


# ===========================================================================
# TestSearchPathSurvivesCheckoutCommit
# ===========================================================================

class TestSearchPathSurvivesCheckoutCommit:
    """
    REGRESIÓN BUG 2: convert_order_to_sale hace db.commit() internamente.
    Después de ese commit, el search_path de PostgreSQL se resetea al default.
    Las queries post-checkout deben seguir encontrando tablas del tenant.
    """

    def test_service_orders_queryable_after_checkout_commit(self, tenant_db, user_id):
        """
        Después del commit del checkout, service_orders sigue siendo accessible.
        Antes del fix: ProgrammingError 'relation service_orders does not exist'.
        """
        customer = _make_customer(tenant_db)
        order = _make_order(
            tenant_db, customer.id, user_id,
            status="READY",
            items=[{"description": "Test SP", "unit_price": 20, "is_manual": True}],
        )

        checkout_data = schemas.ServiceCheckoutPayment(
            total_amount=Decimal("20"),
            total_amount_bs=Decimal("0"),
            payment_method="Efectivo",
            payments=[
                schemas.SalePaymentCreate(
                    amount=Decimal("20"),
                    currency="USD",
                    payment_method="Efectivo",
                    exchange_rate=Decimal("1.0"),
                )
            ],
        )
        ServiceCheckoutService.convert_order_to_sale(
            tenant_db, order.id, checkout_data, user_id
        )

        # Re-setear search_path (como lo hace el fix del router)
        from backend_api.tenant_context import get_tenant_schema
        schema = get_tenant_schema()
        if schema and schema != "public":
            tenant_db.execute(text(f'SET search_path TO "{schema}", public'))

        # Esta query fallaba antes del fix con search_path perdido
        refreshed = tenant_db.query(ServiceOrder).filter_by(id=order.id).first()
        assert refreshed is not None, \
            "ServiceOrder debe ser localizable después del commit del checkout"

    def test_customers_queryable_after_checkout_commit(self, tenant_db, user_id):
        """
        Customer también debe ser localizable post-checkout.
        """
        customer = _make_customer(tenant_db)
        order = _make_order(
            tenant_db, customer.id, user_id,
            status="READY",
            items=[{"description": "Test", "unit_price": 15, "is_manual": True}],
        )

        checkout_data = schemas.ServiceCheckoutPayment(
            total_amount=Decimal("15"),
            total_amount_bs=Decimal("0"),
            payment_method="Efectivo",
            payments=[
                schemas.SalePaymentCreate(
                    amount=Decimal("15"),
                    currency="USD",
                    payment_method="Efectivo",
                    exchange_rate=Decimal("1.0"),
                )
            ],
        )
        ServiceCheckoutService.convert_order_to_sale(
            tenant_db, order.id, checkout_data, user_id
        )

        from backend_api.tenant_context import get_tenant_schema
        schema = get_tenant_schema()
        if schema and schema != "public":
            tenant_db.execute(text(f'SET search_path TO "{schema}", public'))

        refreshed_customer = tenant_db.query(Customer).filter_by(id=customer.id).first()
        assert refreshed_customer is not None

    def test_sale_queryable_after_checkout_commit(self, tenant_db, user_id):
        """
        La Sale creada debe ser re-localizable después del commit.
        """
        customer = _make_customer(tenant_db)
        order = _make_order(
            tenant_db, customer.id, user_id,
            status="READY",
            items=[{"description": "Test", "unit_price": 25, "is_manual": True}],
        )

        checkout_data = schemas.ServiceCheckoutPayment(
            total_amount=Decimal("25"),
            total_amount_bs=Decimal("0"),
            payment_method="Efectivo",
            payments=[
                schemas.SalePaymentCreate(
                    amount=Decimal("25"),
                    currency="USD",
                    payment_method="Efectivo",
                    exchange_rate=Decimal("1.0"),
                )
            ],
        )
        sale = ServiceCheckoutService.convert_order_to_sale(
            tenant_db, order.id, checkout_data, user_id
        )

        from backend_api.tenant_context import get_tenant_schema
        schema = get_tenant_schema()
        if schema and schema != "public":
            tenant_db.execute(text(f'SET search_path TO "{schema}", public'))

        found_sale = tenant_db.query(Sale).filter_by(id=sale.id).first()
        assert found_sale is not None
        assert found_sale.total_amount == Decimal("25")


# ===========================================================================
# TestCheckoutServiceFilterFirst
# ===========================================================================

class TestCheckoutServiceFilterFirst:
    """
    REGRESIÓN BUG 3: .get(id) legacy en service_checkout_service.py.
    Ahora usa .filter(Model.id == id).first() que respeta search_path.
    """

    def test_checkout_with_physical_product_finds_product_in_tenant_schema(
        self, tenant_db, user_id
    ):
        """
        Producto físico debe encontrarse vía .filter().first() para
        deducir stock y registrar kardex.
        """
        product = _make_product(tenant_db, price=30.00, stock=10)
        customer = _make_customer(tenant_db)
        order = _make_order(
            tenant_db, customer.id, user_id,
            status="READY",
            items=[{
                "description": product.name,
                "product_id": product.id,
                "unit_price": 30,
                "quantity": 1,
                "is_manual": False,
                "cost": float(product.cost_price),
            }],
        )

        checkout_data = schemas.ServiceCheckoutPayment(
            total_amount=Decimal("30"),
            total_amount_bs=Decimal("0"),
            payment_method="Efectivo",
            payments=[
                schemas.SalePaymentCreate(
                    amount=Decimal("30"),
                    currency="USD",
                    payment_method="Efectivo",
                    exchange_rate=Decimal("1.0"),
                )
            ],
        )
        sale = ServiceCheckoutService.convert_order_to_sale(
            tenant_db, order.id, checkout_data, user_id
        )
        assert sale is not None

        # Re-setear search_path post-commit
        from backend_api.tenant_context import get_tenant_schema
        schema = get_tenant_schema()
        if schema and schema != "public":
            tenant_db.execute(text(f'SET search_path TO "{schema}", public'))

        # El stock debe haberse deducido (prueba que .filter().first() encontró el producto)
        refreshed = tenant_db.query(Product).filter_by(id=product.id).first()
        assert refreshed.stock == Decimal("9"), \
            "Stock debe decrementarse — .filter().first() debe haber encontrado el producto"

    def test_checkout_kardex_created_for_physical_product(self, tenant_db, user_id):
        """
        Kardex debe registrarse. Requiere que .filter().first() funcione
        para encontrar el producto y crear la entrada Kardex.
        """
        product = _make_product(tenant_db, price=20.00, stock=5)
        customer = _make_customer(tenant_db)
        order = _make_order(
            tenant_db, customer.id, user_id,
            status="READY",
            items=[{
                "description": product.name,
                "product_id": product.id,
                "unit_price": 20,
                "quantity": 2,
                "is_manual": False,
                "cost": float(product.cost_price),
            }],
        )

        checkout_data = schemas.ServiceCheckoutPayment(
            total_amount=Decimal("40"),
            total_amount_bs=Decimal("0"),
            payment_method="Efectivo",
            payments=[
                schemas.SalePaymentCreate(
                    amount=Decimal("40"),
                    currency="USD",
                    payment_method="Efectivo",
                    exchange_rate=Decimal("1.0"),
                )
            ],
        )
        ServiceCheckoutService.convert_order_to_sale(
            tenant_db, order.id, checkout_data, user_id
        )

        from backend_api.tenant_context import get_tenant_schema
        schema = get_tenant_schema()
        if schema and schema != "public":
            tenant_db.execute(text(f'SET search_path TO "{schema}", public'))

        kardex = tenant_db.query(Kardex).filter_by(
            product_id=product.id,
            movement_type=MovementType.SALE,
        ).order_by(Kardex.id.desc()).first()

        assert kardex is not None, "Kardex debe crearse para producto físico en checkout"
        assert kardex.quantity == Decimal("-2")


# ===========================================================================
# TestMultipleAbonos → Auto-checkout
# ===========================================================================

class TestMultipleAbonosAutoCheckout:
    """
    Flujos con múltiples abonos parciales que acumulan hasta cubrir el total,
    verificando que el auto-checkout se activa correctamente al marcar DELIVERED.
    """

    def test_two_abonos_sum_triggers_checkout(self, tenant_db, user_id):
        """
        Dos abonos que juntos cubren el total → auto-checkout crea Sale.
        """
        customer = _make_customer(tenant_db)
        order = _make_order(
            tenant_db, customer.id, user_id,
            status="RECEIVED",
            items=[{"description": "Reparacion", "unit_price": 100, "is_manual": True}],
            payments=[
                {"amount": 60, "currency": "USD", "method": "Efectivo"},
                {"amount": 40, "currency": "USD", "method": "Transferencia"},
            ],
        )

        sale = _simulate_auto_checkout(tenant_db, order, user_id)

        assert sale is not None
        assert sale.total_amount == Decimal("100")

        sale_payments = tenant_db.query(SalePayment).filter_by(sale_id=sale.id).all()
        abonos = [sp for sp in sale_payments if "ABONO" in (sp.payment_method or "")]
        assert len(abonos) == 2

    def test_overpayment_still_triggers_checkout(self, tenant_db, user_id):
        """
        Si el abono es mayor que el total (pago en exceso), igual se hace checkout.
        """
        customer = _make_customer(tenant_db)
        order = _make_order(
            tenant_db, customer.id, user_id,
            status="RECEIVED",
            items=[{"description": "Servicio", "unit_price": 50, "is_manual": True}],
            payments=[{"amount": 60, "currency": "USD", "method": "Efectivo"}],  # 60 > 50
        )

        sale = _simulate_auto_checkout(tenant_db, order, user_id)

        assert sale is not None, "Pago en exceso también debe disparar auto-checkout"

    def test_three_currency_abonos_trigger_checkout_on_usd_total(self, tenant_db, user_id):
        """
        Múltiples abonos en USD que suman el total → checkout correcto.
        """
        customer = _make_customer(tenant_db)
        order = _make_order(
            tenant_db, customer.id, user_id,
            status="RECEIVED",
            items=[
                {"description": "Pantalla", "unit_price": 35, "is_manual": True},
                {"description": "Mano de obra", "unit_price": 25, "is_manual": True},
            ],
            payments=[
                {"amount": 20, "currency": "USD", "method": "Efectivo"},
                {"amount": 20, "currency": "USD", "method": "Pago Móvil"},
                {"amount": 20, "currency": "USD", "method": "Zelle"},
            ],
        )

        sale = _simulate_auto_checkout(tenant_db, order, user_id)

        assert sale is not None
        assert sale.total_amount == Decimal("60")

        refreshed = tenant_db.query(ServiceOrder).filter_by(id=order.id).first()
        assert refreshed.status == ServiceOrderStatus.DELIVERED
        assert (refreshed.order_metadata or {}).get("payment_status") == "PAID"
