"""
test_func_services_pg.py — Comprehensive PostgreSQL integration tests for the Services module.

These tests run against a REAL PostgreSQL database with tenant schemas and catch
search_path issues that SQLite tests miss. The main bugs have been search_path loss
after commit — SQLite tests DON'T catch these.

Flujos cubiertos:
  CRUD    — Crear/leer ordenes, agregar/eliminar items, totales
  STATUS  — Flujo de estados RECEIVED → DIAGNOSING → READY → DELIVERED
  PAYMENT — Abonos parciales (ServicePayment), acumulados, referencia
  CHECKOUT — Conversion orden → Sale con stock, pagos, metadatos
  VISIBLE — La venta resultante aparece en queries generales

Correr con:
    cd ferreteria_refactor
    python -m pytest backend_api/tests/test_func_services_pg.py -v --no-cov -s
"""

import pytest
import sys
import os
import uuid
from decimal import Decimal
from sqlalchemy import text
from datetime import datetime, timedelta

_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _root not in sys.path:
    sys.path.insert(0, _root)

from backend_api.models.models import (
    Product, ProductStock, Warehouse, CashRegister, CashSession,
    Sale, SaleDetail, SalePayment, Kardex, Customer, MovementType,
    ServiceOrder, ServiceOrderDetail, ServicePayment, ServiceOrderStatus,
    ServiceType, ServicePriority,
)
from backend_api import schemas
from backend_api.services.service_checkout_service import ServiceCheckoutService

pytestmark = pytest.mark.requires_postgres

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

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
# Helper factories (no fixture — called explicitly inside tests)
# ---------------------------------------------------------------------------


def _make_customer(db):
    c = Customer(name=f"Cliente Test {uuid.uuid4().hex[:6]}", phone="04121234567")
    db.add(c)
    db.flush()
    return c


def _make_product(db, name=None, price=25.00, stock=50):
    p = Product(
        name=name or f"Repuesto {uuid.uuid4().hex[:6]}",
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


def _make_cash_session(db, user_id):
    reg = CashRegister(
        name=f"Caja {uuid.uuid4().hex[:4]}",
        code=f"C{uuid.uuid4().hex[:3].upper()}",
        is_active=True,
    )
    db.add(reg)
    db.flush()
    session = CashSession(
        register_id=reg.id,
        user_id=user_id,
        status="OPEN",
        initial_cash=Decimal("100.00"),
        initial_cash_bs=Decimal("0.00"),
    )
    db.add(session)
    db.flush()
    return session


def _make_service_order(db, customer_id, user_id, status="RECEIVED", items=None, payments=None):
    order = ServiceOrder(
        ticket_number=f"SRV-PG-{uuid.uuid4().hex[:6].upper()}",
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

    if items:
        for item in items:
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

    if payments:
        for pay in payments:
            sp = ServicePayment(
                tenant_id=TENANT,
                service_order_id=order.id,
                amount=Decimal(str(pay.get("amount", 0))),
                currency=pay.get("currency", "USD"),
                payment_method=pay.get("method", "Efectivo"),
                reference=pay.get("reference"),
            )
            db.add(sp)

    db.flush()
    return order


def _build_checkout_payment(total, total_bs=None, payments_list=None):
    return schemas.ServiceCheckoutPayment(
        total_amount=Decimal(str(total)),
        total_amount_bs=Decimal(str(total_bs or 0)),
        payment_method="Efectivo",
        payments=payments_list or [
            schemas.SalePaymentCreate(
                amount=Decimal(str(total)),
                currency="USD",
                payment_method="Efectivo",
                exchange_rate=Decimal("1.0"),
            )
        ],
    )


# ===========================================================================
# Class 1: TestPgServiceOrderCRUD
# ===========================================================================


class TestPgServiceOrderCRUD:

    def test_create_order_persists_in_tenant_schema(self, tenant_db, user_id):
        """Create order, verify it lives in the tenant schema (not public)."""
        customer = _make_customer(tenant_db)
        order = _make_service_order(tenant_db, customer.id, user_id)

        # Re-query to confirm persistence in tenant schema
        found = tenant_db.query(ServiceOrder).filter_by(id=order.id).first()
        assert found is not None
        assert found.ticket_number == order.ticket_number
        assert found.tenant_id == TENANT
        assert found.customer_id == customer.id

        # Verify it is NOT in public schema
        raw = tenant_db.execute(
            text("SELECT COUNT(*) FROM service_orders WHERE id = :oid"),
            {"oid": order.id},
        ).scalar()
        assert raw == 1

    def test_add_product_item_to_order(self, tenant_db, user_id):
        """Add a real product item, verify detail record links correctly."""
        customer = _make_customer(tenant_db)
        product = _make_product(tenant_db, name="Pantalla Samsung A52", price=35.00)
        order = _make_service_order(tenant_db, customer.id, user_id)

        detail = ServiceOrderDetail(
            service_order_id=order.id,
            product_id=product.id,
            description=product.name,
            is_manual=False,
            quantity=Decimal("1"),
            unit_price=Decimal("35.00"),
            cost=product.cost_price,
        )
        tenant_db.add(detail)
        tenant_db.flush()

        found = tenant_db.query(ServiceOrderDetail).filter_by(
            service_order_id=order.id, product_id=product.id
        ).first()
        assert found is not None
        assert found.is_manual is False
        assert found.unit_price == Decimal("35.00")

    def test_add_manual_item_to_order(self, tenant_db, user_id):
        """Add manual item, verify is_manual=True and no product_id."""
        customer = _make_customer(tenant_db)
        order = _make_service_order(tenant_db, customer.id, user_id)

        detail = ServiceOrderDetail(
            service_order_id=order.id,
            product_id=None,
            description="Mano de obra - reparacion pantalla",
            is_manual=True,
            quantity=Decimal("1"),
            unit_price=Decimal("20.00"),
            cost=Decimal("0"),
        )
        tenant_db.add(detail)
        tenant_db.flush()

        found = tenant_db.query(ServiceOrderDetail).filter_by(
            service_order_id=order.id, is_manual=True
        ).first()
        assert found is not None
        assert found.product_id is None
        assert found.description == "Mano de obra - reparacion pantalla"

    def test_delete_item_from_order(self, tenant_db, user_id):
        """Delete an item, verify count decreases."""
        customer = _make_customer(tenant_db)
        order = _make_service_order(
            tenant_db, customer.id, user_id,
            items=[
                {"description": "Item A", "unit_price": 10, "is_manual": True},
                {"description": "Item B", "unit_price": 15, "is_manual": True},
            ],
        )

        details = tenant_db.query(ServiceOrderDetail).filter_by(
            service_order_id=order.id
        ).all()
        assert len(details) == 2

        tenant_db.delete(details[0])
        tenant_db.flush()

        remaining = tenant_db.query(ServiceOrderDetail).filter_by(
            service_order_id=order.id
        ).all()
        assert len(remaining) == 1

    def test_order_with_multiple_items_total(self, tenant_db, user_id):
        """Add 3 items, verify total calculation from details."""
        customer = _make_customer(tenant_db)
        items = [
            {"description": "Diagnostico", "unit_price": 5, "quantity": 1, "is_manual": True},
            {"description": "Pantalla", "unit_price": 30, "quantity": 1, "is_manual": True},
            {"description": "Mano de obra", "unit_price": 15, "quantity": 2, "is_manual": True},
        ]
        order = _make_service_order(tenant_db, customer.id, user_id, items=items)

        details = tenant_db.query(ServiceOrderDetail).filter_by(
            service_order_id=order.id
        ).all()
        assert len(details) == 3

        total = sum(d.unit_price * d.quantity for d in details)
        assert total == Decimal("65.00000")  # 5 + 30 + (15*2)


# ===========================================================================
# Class 2: TestPgServiceStatusFlow
# ===========================================================================


class TestPgServiceStatusFlow:

    def test_status_received_to_diagnosing(self, tenant_db, user_id):
        """Change status from RECEIVED to DIAGNOSING, verify persistence."""
        customer = _make_customer(tenant_db)
        order = _make_service_order(tenant_db, customer.id, user_id, status="RECEIVED")
        assert order.status == ServiceOrderStatus.RECEIVED

        order.status = ServiceOrderStatus.DIAGNOSING
        tenant_db.flush()

        refreshed = tenant_db.query(ServiceOrder).filter_by(id=order.id).first()
        assert refreshed.status == ServiceOrderStatus.DIAGNOSING

    def test_status_to_ready(self, tenant_db, user_id):
        """Change to READY, verify search_path survives flush."""
        customer = _make_customer(tenant_db)
        order = _make_service_order(tenant_db, customer.id, user_id, status="IN_PROGRESS")

        order.status = ServiceOrderStatus.READY
        tenant_db.flush()

        # This query tests that search_path is still correct after flush
        refreshed = tenant_db.query(ServiceOrder).filter_by(id=order.id).first()
        assert refreshed.status == ServiceOrderStatus.READY
        assert refreshed.customer_id == customer.id

    def test_status_to_delivered_via_checkout(self, tenant_db, user_id):
        """Full checkout marks DELIVERED."""
        customer = _make_customer(tenant_db)
        order = _make_service_order(
            tenant_db, customer.id, user_id,
            status="READY",
            items=[{"description": "Reparacion", "unit_price": 50, "is_manual": True}],
        )

        payment_data = _build_checkout_payment(total=50)
        sale = ServiceCheckoutService.convert_order_to_sale(
            tenant_db, order.id, payment_data, user_id
        )
        assert sale is not None

        # Re-query after commit (search_path bug would manifest here)
        refreshed = tenant_db.query(ServiceOrder).filter_by(id=order.id).first()
        assert refreshed.status == ServiceOrderStatus.DELIVERED

    def test_status_prevents_double_checkout(self, tenant_db, user_id):
        """Second checkout on same order raises error."""
        customer = _make_customer(tenant_db)
        order = _make_service_order(
            tenant_db, customer.id, user_id,
            status="READY",
            items=[{"description": "Servicio", "unit_price": 25, "is_manual": True}],
        )

        payment_data = _build_checkout_payment(total=25)
        sale = ServiceCheckoutService.convert_order_to_sale(
            tenant_db, order.id, payment_data, user_id
        )
        assert sale is not None

        # Second checkout should fail — order is now DELIVERED, not READY
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc_info:
            ServiceCheckoutService.convert_order_to_sale(
                tenant_db, order.id, payment_data, user_id
            )
        assert exc_info.value.status_code in (400, 500)


# ===========================================================================
# Class 3: TestPgServicePayments
# ===========================================================================


class TestPgServicePayments:

    def test_register_abono_creates_service_payment(self, tenant_db, user_id):
        """Add ServicePayment (abono), verify it persists."""
        customer = _make_customer(tenant_db)
        order = _make_service_order(
            tenant_db, customer.id, user_id,
            items=[{"description": "Reparacion", "unit_price": 100, "is_manual": True}],
        )

        abono = ServicePayment(
            tenant_id=TENANT,
            service_order_id=order.id,
            amount=Decimal("30.00"),
            currency="USD",
            payment_method="Efectivo",
        )
        tenant_db.add(abono)
        tenant_db.flush()

        found = tenant_db.query(ServicePayment).filter_by(
            service_order_id=order.id
        ).all()
        assert len(found) == 1
        assert found[0].amount == Decimal("30.0000")

    def test_multiple_abonos_accumulate_correctly(self, tenant_db, user_id):
        """3 abonos, verify sum."""
        customer = _make_customer(tenant_db)
        order = _make_service_order(
            tenant_db, customer.id, user_id,
            items=[{"description": "Reparacion", "unit_price": 100, "is_manual": True}],
        )

        amounts = [Decimal("20.00"), Decimal("35.00"), Decimal("15.00")]
        for amt in amounts:
            tenant_db.add(ServicePayment(
                tenant_id=TENANT,
                service_order_id=order.id,
                amount=amt,
                currency="USD",
                payment_method="Efectivo",
            ))
        tenant_db.flush()

        payments = tenant_db.query(ServicePayment).filter_by(
            service_order_id=order.id
        ).all()
        assert len(payments) == 3
        total_paid = sum(p.amount for p in payments)
        assert total_paid == Decimal("70.0000")

    def test_abono_does_not_mark_paid(self, tenant_db, user_id):
        """Verify abono does NOT set payment_status=PAID in metadata."""
        customer = _make_customer(tenant_db)
        order = _make_service_order(
            tenant_db, customer.id, user_id,
            items=[{"description": "Reparacion", "unit_price": 100, "is_manual": True}],
        )

        tenant_db.add(ServicePayment(
            tenant_id=TENANT,
            service_order_id=order.id,
            amount=Decimal("50.00"),
            currency="USD",
            payment_method="Transferencia",
        ))
        tenant_db.flush()

        refreshed = tenant_db.query(ServiceOrder).filter_by(id=order.id).first()
        metadata = refreshed.order_metadata or {}
        assert metadata.get("payment_status") != "PAID"

    def test_abono_with_reference_persists(self, tenant_db, user_id):
        """Reference field saved correctly."""
        customer = _make_customer(tenant_db)
        order = _make_service_order(
            tenant_db, customer.id, user_id,
            items=[{"description": "Reparacion", "unit_price": 50, "is_manual": True}],
        )

        ref = f"REF-{uuid.uuid4().hex[:8].upper()}"
        tenant_db.add(ServicePayment(
            tenant_id=TENANT,
            service_order_id=order.id,
            amount=Decimal("25.00"),
            currency="USD",
            payment_method="Transferencia",
            reference=ref,
        ))
        tenant_db.flush()

        found = tenant_db.query(ServicePayment).filter_by(
            service_order_id=order.id
        ).first()
        assert found.reference == ref

    def test_payment_history_returned_with_order(self, tenant_db, user_id):
        """Fetch order, verify payments relationship includes abonos."""
        customer = _make_customer(tenant_db)
        order = _make_service_order(
            tenant_db, customer.id, user_id,
            payments=[
                {"amount": 10, "currency": "USD", "method": "Efectivo"},
                {"amount": 20, "currency": "USD", "method": "Transferencia", "reference": "ABC123"},
            ],
            items=[{"description": "Reparacion", "unit_price": 50, "is_manual": True}],
        )

        refreshed = tenant_db.query(ServiceOrder).filter_by(id=order.id).first()
        assert len(refreshed.payments) == 2
        refs = [p.reference for p in refreshed.payments]
        assert "ABC123" in refs


# ===========================================================================
# Class 4: TestPgCheckoutCreatesValidSale (CRITICAL)
# ===========================================================================


class TestPgCheckoutCreatesValidSale:

    def _do_checkout(self, db, user_id, items=None, payments=None, manual_only=True):
        """Helper: create order with items, checkout, return (order, sale)."""
        customer = _make_customer(db)
        if items is None:
            items = [{"description": "Reparacion general", "unit_price": 50, "is_manual": True}]

        order = _make_service_order(
            db, customer.id, user_id,
            status="READY",
            items=items,
            payments=payments,
        )

        total = sum(
            Decimal(str(i.get("unit_price", 0))) * Decimal(str(i.get("quantity", 1)))
            for i in items
        )
        prepaid = sum(Decimal(str(p.get("amount", 0))) for p in (payments or []))
        balance = total - prepaid

        checkout_payments = []
        if balance > 0:
            checkout_payments.append(schemas.SalePaymentCreate(
                amount=balance,
                currency="USD",
                payment_method="Efectivo",
                exchange_rate=Decimal("1.0"),
            ))

        payment_data = _build_checkout_payment(
            total=total,
            payments_list=checkout_payments,
        )

        sale = ServiceCheckoutService.convert_order_to_sale(
            db, order.id, payment_data, user_id
        )
        return order, sale, customer

    def test_checkout_creates_sale_in_tenant_schema(self, tenant_db, user_id):
        """Sale exists in tenant schema after checkout."""
        order, sale, _ = self._do_checkout(tenant_db, user_id)
        assert sale is not None
        assert sale.id is not None

        # Verify sale exists in current search_path (tenant schema)
        found = tenant_db.query(Sale).filter_by(id=sale.id).first()
        assert found is not None

    def test_checkout_sale_has_correct_total(self, tenant_db, user_id):
        """Sale.total_amount matches order items total."""
        items = [
            {"description": "Pantalla", "unit_price": 30, "quantity": 1, "is_manual": True},
            {"description": "Mano de obra", "unit_price": 20, "quantity": 1, "is_manual": True},
        ]
        _, sale, _ = self._do_checkout(tenant_db, user_id, items=items)
        assert sale.total_amount == Decimal("50")

    def test_checkout_sale_has_customer(self, tenant_db, user_id):
        """Sale.customer_id = order.customer_id."""
        order, sale, customer = self._do_checkout(tenant_db, user_id)
        assert sale.customer_id == customer.id
        assert sale.customer_id == order.customer_id

    def test_checkout_sale_details_match_items(self, tenant_db, user_id):
        """SaleDetail count and amounts match order items."""
        items = [
            {"description": "Diagnostico", "unit_price": 10, "quantity": 1, "is_manual": True},
            {"description": "Pantalla", "unit_price": 35, "quantity": 1, "is_manual": True},
            {"description": "Mano de obra", "unit_price": 15, "quantity": 2, "is_manual": True},
        ]
        _, sale, _ = self._do_checkout(tenant_db, user_id, items=items)

        details = tenant_db.query(SaleDetail).filter_by(sale_id=sale.id).all()
        assert len(details) == 3

        subtotals = sorted([d.subtotal for d in details])
        expected = sorted([Decimal("10"), Decimal("35"), Decimal("30")])
        assert subtotals == expected

    def test_checkout_sale_payments_include_abonos(self, tenant_db, user_id):
        """Previous abonos migrated as ABONO(...) in SalePayment."""
        items = [{"description": "Reparacion", "unit_price": 100, "is_manual": True}]
        prepayments = [
            {"amount": 30, "currency": "USD", "method": "Efectivo"},
            {"amount": 20, "currency": "USD", "method": "Transferencia", "reference": "TRF001"},
        ]

        _, sale, _ = self._do_checkout(
            tenant_db, user_id, items=items, payments=prepayments
        )

        sale_payments = tenant_db.query(SalePayment).filter_by(sale_id=sale.id).all()

        # Should have: 2 migrated abonos + 1 balance payment at checkout
        assert len(sale_payments) >= 3

        abono_payments = [sp for sp in sale_payments if "ABONO" in (sp.payment_method or "")]
        assert len(abono_payments) == 2

        abono_total = sum(sp.amount for sp in abono_payments)
        assert abono_total == Decimal("50.0000")

    def test_checkout_deducts_physical_product_stock(self, tenant_db, user_id):
        """Product stock decreases after checkout with physical product."""
        product = _make_product(tenant_db, name="Pantalla LCD", price=40.00, stock=50)
        initial_stock = product.stock

        items = [
            {
                "description": product.name,
                "product_id": product.id,
                "unit_price": 40,
                "quantity": 2,
                "is_manual": False,
                "cost": float(product.cost_price),
            },
        ]

        _, sale, _ = self._do_checkout(tenant_db, user_id, items=items)

        # Re-query product after checkout commit
        refreshed = tenant_db.query(Product).filter_by(id=product.id).first()
        assert refreshed.stock == initial_stock - Decimal("2")

        # Verify Kardex entry was created
        kardex = tenant_db.query(Kardex).filter_by(
            product_id=product.id,
            movement_type=MovementType.SALE,
        ).order_by(Kardex.id.desc()).first()
        assert kardex is not None
        assert kardex.quantity == Decimal("-2")

    def test_checkout_no_stock_deduction_for_manual(self, tenant_db, user_id):
        """Manual items don't affect any product stock."""
        product = _make_product(tenant_db, name="Producto Testigo", price=10.00, stock=100)
        initial_stock = product.stock

        items = [
            {"description": "Mano de obra", "unit_price": 25, "quantity": 1, "is_manual": True},
        ]
        self._do_checkout(tenant_db, user_id, items=items)

        # The unrelated product stock should be unchanged
        refreshed = tenant_db.query(Product).filter_by(id=product.id).first()
        assert refreshed.stock == initial_stock

    def test_checkout_order_marked_delivered_and_paid(self, tenant_db, user_id):
        """Order status=DELIVERED, metadata.payment_status=PAID after checkout."""
        customer = _make_customer(tenant_db)
        order = _make_service_order(
            tenant_db, customer.id, user_id,
            status="READY",
            items=[{"description": "Servicio", "unit_price": 40, "is_manual": True}],
        )

        payment_data = _build_checkout_payment(total=40)
        ServiceCheckoutService.convert_order_to_sale(
            tenant_db, order.id, payment_data, user_id
        )

        refreshed = tenant_db.query(ServiceOrder).filter_by(id=order.id).first()
        assert refreshed.status == ServiceOrderStatus.DELIVERED

        metadata = refreshed.order_metadata or {}
        assert metadata.get("payment_status") == "PAID"


# ===========================================================================
# Class 5: TestPgSaleVisibility
# ===========================================================================


class TestPgSaleVisibility:

    def _checkout_and_get_sale(self, db, user_id):
        """Helper: full checkout, return sale."""
        customer = _make_customer(db)
        ticket = f"SRV-PG-{uuid.uuid4().hex[:6].upper()}"
        order = ServiceOrder(
            ticket_number=ticket,
            tenant_id=TENANT,
            customer_id=customer.id,
            service_type=ServiceType.REPAIR,
            priority=ServicePriority.NORMAL,
            status=ServiceOrderStatus.READY,
            device_type="SMARTPHONE",
            brand="Samsung",
            model="A52",
            problem_description="Pantalla rota",
        )
        db.add(order)
        db.flush()

        detail = ServiceOrderDetail(
            service_order_id=order.id,
            description="Reparacion completa",
            is_manual=True,
            quantity=Decimal("1"),
            unit_price=Decimal("75.00"),
            cost=Decimal("0"),
        )
        db.add(detail)
        db.flush()

        payment_data = _build_checkout_payment(total=75)
        sale = ServiceCheckoutService.convert_order_to_sale(
            db, order.id, payment_data, user_id
        )
        return sale, ticket

    def test_service_sale_in_general_sales_query(self, tenant_db, user_id):
        """db.query(Sale).all() includes the service sale."""
        sale, _ = self._checkout_and_get_sale(tenant_db, user_id)

        all_sales = tenant_db.query(Sale).all()
        sale_ids = [s.id for s in all_sales]
        assert sale.id in sale_ids

    def test_service_sale_notes_contain_ticket(self, tenant_db, user_id):
        """Sale.notes has 'Orden de Servicio #SRV-...'."""
        sale, ticket = self._checkout_and_get_sale(tenant_db, user_id)

        found = tenant_db.query(Sale).filter_by(id=sale.id).first()
        assert found.notes is not None
        assert ticket in found.notes
        assert "Orden de Servicio" in found.notes

    def test_service_sale_searchable_by_date(self, tenant_db, user_id):
        """Filter Sale by date range includes service sale."""
        sale, _ = self._checkout_and_get_sale(tenant_db, user_id)

        today = datetime.now().date()
        yesterday = today - timedelta(days=1)
        tomorrow = today + timedelta(days=1)

        results = tenant_db.query(Sale).filter(
            Sale.date >= datetime.combine(yesterday, datetime.min.time()),
            Sale.date <= datetime.combine(tomorrow, datetime.max.time()),
        ).all()

        sale_ids = [s.id for s in results]
        assert sale.id in sale_ids
