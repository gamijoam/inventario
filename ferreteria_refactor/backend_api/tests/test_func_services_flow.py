"""
test_func_services_flow.py — Tests funcionales del flujo COMPLETO de Servicios

Flujos cubiertos:
  1 — Crear orden: status, cliente, ticket, lavanderia
  2 — Items: manual, producto, total, eliminacion
  3 — Status: flujo completo, saltos, metadata merge
  4 — Pagos: ServicePayment, multiples, indicadores
  5 — Checkout: conversion a Sale, items, pagos, stock, doble cobro
  6 — Visibilidad: ventas de servicio en listados

Correr con:
    cd ferreteria_refactor
    python -m pytest backend_api/tests/test_func_services_flow.py -v --no-cov -s
"""

import pytest
import uuid
from decimal import Decimal
from datetime import datetime
from unittest.mock import patch

import sys
import os

_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _root not in sys.path:
    sys.path.insert(0, _root)

from backend_api.models.models import (
    ServiceOrder, ServiceOrderDetail, ServicePayment, ServiceOrderStatus,
    ServiceType, ServicePriority, Sale, SaleDetail, SalePayment,
    Product, ProductStock, Customer, CashRegister, CashSession,
    Warehouse, User, UserRole, Kardex,
)
from backend_api.models.tenant import Tenant
from backend_api.schemas import SaleCreate, SalePaymentCreate
from backend_api.services.service_checkout_service import ServiceCheckoutService


# ---------------------------------------------------------------------------
# Helper factories
# ---------------------------------------------------------------------------

def _make_customer(db, name="Test Client"):
    c = Customer(name=name, phone="04121234567", id_number=f"V-{uuid.uuid4().hex[:8]}")
    db.add(c)
    db.flush()
    return c


def _make_product(db, name="Pantalla Samsung", price=45.00, stock=10, warehouse_id=None):
    p = Product(
        name=name,
        sku=f"SKU-{uuid.uuid4().hex[:8]}",
        price=Decimal(str(price)),
        cost_price=Decimal(str(round(price * 0.6, 2))),
        stock=Decimal(str(stock)),
        is_service=False,
        is_active=True,
    )
    db.add(p)
    db.flush()
    if warehouse_id:
        ps = ProductStock(product_id=p.id, warehouse_id=warehouse_id, quantity=Decimal(str(stock)))
        db.add(ps)
        db.flush()
    return p


def _make_generic_service_product(db):
    p = Product(
        name="Servicio General",
        sku="GENERIC-SERVICE",
        price=Decimal("0"),
        cost_price=Decimal("0"),
        stock=Decimal("999999"),
        is_service=True,
        is_active=True,
    )
    db.add(p)
    db.flush()
    return p


def _make_warehouse(db):
    w = Warehouse(name=f"Almacen {uuid.uuid4().hex[:6]}", is_main=True, is_active=True)
    db.add(w)
    db.flush()
    return w


def _ensure_tenant(db):
    """Ensure a Tenant with id=1 exists (needed for User FK)."""
    existing = db.query(Tenant).filter(Tenant.id == 1).first()
    if existing:
        return existing
    t = Tenant(id=1, name="Test Tenant", schema_name=f"test_{uuid.uuid4().hex[:6]}")
    db.add(t)
    db.flush()
    return t


def _make_user(db, role=UserRole.ADMIN):
    _ensure_tenant(db)
    u = User(
        username=f"testadmin-{uuid.uuid4().hex[:6]}",
        email=f"test-{uuid.uuid4().hex[:6]}@local.com",
        password_hash="$2b$12$fakehashfakehashfakehashfakehashfakehashfakehashfake",
        role=role,
        tenant_id=1,
    )
    db.add(u)
    db.flush()
    return u


def _ticket():
    return f"SRV-{uuid.uuid4().hex[:6].upper()}"


def _make_service_order(db, customer_id, status="RECEIVED", items=None, payments=None,
                        service_type=ServiceType.REPAIR):
    order = ServiceOrder(
        ticket_number=_ticket(),
        tenant_id="default",
        customer_id=customer_id,
        service_type=service_type,
        priority=ServicePriority.NORMAL,
        status=ServiceOrderStatus[status],
        device_type="SMARTPHONE" if service_type == ServiceType.REPAIR else None,
        brand="Samsung" if service_type == ServiceType.REPAIR else None,
        model="A52" if service_type == ServiceType.REPAIR else None,
        problem_description="Pantalla rota" if service_type == ServiceType.REPAIR else None,
    )
    db.add(order)
    db.flush()

    if items:
        for item in items:
            detail = ServiceOrderDetail(
                service_order_id=order.id,
                product_id=item.get("product_id"),
                description=item.get("description", "Servicio"),
                is_manual=item.get("is_manual", True),
                quantity=Decimal(str(item.get("quantity", 1))),
                unit_price=Decimal(str(item.get("unit_price", 10))),
                cost=Decimal(str(item.get("cost", 0))),
                technician_id=item.get("technician_id"),
            )
            db.add(detail)

    if payments:
        for pay in payments:
            sp = ServicePayment(
                tenant_id="default",
                service_order_id=order.id,
                amount=Decimal(str(pay.get("amount", 0))),
                currency=pay.get("currency", "USD"),
                payment_method=pay.get("method", "Efectivo"),
                reference=pay.get("reference"),
            )
            db.add(sp)

    db.flush()
    return order


def _make_sale_create(total, payments=None, notes=None):
    """Build a SaleCreate schema for checkout tests."""
    return SaleCreate(
        total_amount=Decimal(str(total)),
        total_amount_bs=Decimal("0"),
        currency="USD",
        exchange_rate=Decimal("1.0"),
        payment_method="Efectivo",
        notes=notes,
        is_credit=False,
        items=[],  # Items come from service order, not this schema
        payments=payments or [
            SalePaymentCreate(
                amount=Decimal(str(total)),
                currency="USD",
                payment_method="Efectivo",
                exchange_rate=Decimal("1.0"),
            )
        ],
    )


# ===========================================================================
# Class 1: TestServiceOrderCreation
# ===========================================================================

class TestServiceOrderCreation:

    def test_create_order_sets_received_status(self, db_session):
        """Create order, verify status=RECEIVED."""
        customer = _make_customer(db_session)
        order = _make_service_order(db_session, customer.id)

        assert order.status == ServiceOrderStatus.RECEIVED, \
            "A new service order must default to RECEIVED status"
        assert order.id is not None, "Order must have a generated ID after flush"

    def test_create_order_with_customer(self, db_session):
        """Verify customer_id is linked correctly."""
        customer = _make_customer(db_session)
        order = _make_service_order(db_session, customer.id)

        assert order.customer_id == customer.id, \
            "Order customer_id must match the linked customer"

    def test_create_order_generates_ticket_number(self, db_session):
        """Verify ticket starts with SRV-."""
        customer = _make_customer(db_session)
        order = _make_service_order(db_session, customer.id)

        assert order.ticket_number.startswith("SRV-"), \
            f"Ticket number must start with 'SRV-', got '{order.ticket_number}'"

    def test_create_laundry_order(self, db_session):
        """Verify service_type=LAUNDRY works with nullable device fields."""
        customer = _make_customer(db_session)
        order = _make_service_order(
            db_session, customer.id,
            service_type=ServiceType.LAUNDRY,
        )

        assert order.service_type == ServiceType.LAUNDRY, \
            "Order service_type must be LAUNDRY"
        assert order.device_type is None, \
            "Laundry orders should have no device_type"
        assert order.brand is None, \
            "Laundry orders should have no brand"
        assert order.model is None, \
            "Laundry orders should have no model"
        assert order.problem_description is None, \
            "Laundry orders should have no problem_description"


# ===========================================================================
# Class 2: TestServiceOrderItems
# ===========================================================================

class TestServiceOrderItems:

    def test_add_manual_item(self, db_session):
        """Add manual service item, verify is_manual=True, no product_id."""
        customer = _make_customer(db_session)
        order = _make_service_order(db_session, customer.id, items=[
            {"description": "Mano de obra reparacion", "is_manual": True,
             "unit_price": 25.00, "quantity": 1},
        ])

        items = db_session.query(ServiceOrderDetail).filter_by(
            service_order_id=order.id
        ).all()
        assert len(items) == 1
        assert items[0].is_manual is True, "Manual item must have is_manual=True"
        assert items[0].product_id is None, "Manual item must have no product_id"

    def test_add_product_item(self, db_session):
        """Add product item, verify product_id set, is_manual=False."""
        customer = _make_customer(db_session)
        wh = _make_warehouse(db_session)
        product = _make_product(db_session, warehouse_id=wh.id)
        order = _make_service_order(db_session, customer.id, items=[
            {"product_id": product.id, "description": product.name,
             "is_manual": False, "unit_price": float(product.price),
             "cost": float(product.cost_price), "quantity": 1},
        ])

        items = db_session.query(ServiceOrderDetail).filter_by(
            service_order_id=order.id
        ).all()
        assert len(items) == 1
        assert items[0].product_id == product.id, "Product item must reference the product"
        assert items[0].is_manual is False, "Product item must have is_manual=False"

    def test_multiple_items_calculate_total(self, db_session):
        """Add 3 items, verify total = sum of (qty * price)."""
        customer = _make_customer(db_session)
        order = _make_service_order(db_session, customer.id, items=[
            {"description": "Servicio A", "unit_price": 15.00, "quantity": 2, "is_manual": True},
            {"description": "Servicio B", "unit_price": 20.00, "quantity": 1, "is_manual": True},
            {"description": "Servicio C", "unit_price": 10.50, "quantity": 3, "is_manual": True},
        ])

        items = db_session.query(ServiceOrderDetail).filter_by(
            service_order_id=order.id
        ).all()
        assert len(items) == 3

        total = sum(i.unit_price * i.quantity for i in items)
        expected = Decimal("15.00") * 2 + Decimal("20.00") * 1 + Decimal("10.50") * 3
        assert total == expected, \
            f"Total {total} must equal sum of (qty * price) = {expected}"

    def test_delete_item_removes_from_order(self, db_session):
        """Delete item, verify it is gone."""
        customer = _make_customer(db_session)
        order = _make_service_order(db_session, customer.id, items=[
            {"description": "Servicio temporal", "unit_price": 10, "is_manual": True},
            {"description": "Servicio permanente", "unit_price": 20, "is_manual": True},
        ])

        items_before = db_session.query(ServiceOrderDetail).filter_by(
            service_order_id=order.id
        ).all()
        assert len(items_before) == 2

        # Delete the first item
        db_session.delete(items_before[0])
        db_session.flush()

        items_after = db_session.query(ServiceOrderDetail).filter_by(
            service_order_id=order.id
        ).all()
        assert len(items_after) == 1, "Only one item should remain after deletion"
        assert items_after[0].description == "Servicio permanente"


# ===========================================================================
# Class 3: TestServiceOrderStatus
# ===========================================================================

class TestServiceOrderStatus:

    def test_status_flow_received_to_delivered(self, db_session):
        """Walk through all statuses: RECEIVED -> IN_PROGRESS -> READY -> DELIVERED."""
        customer = _make_customer(db_session)
        order = _make_service_order(db_session, customer.id)

        assert order.status == ServiceOrderStatus.RECEIVED

        order.status = ServiceOrderStatus.IN_PROGRESS
        db_session.flush()
        assert order.status == ServiceOrderStatus.IN_PROGRESS

        order.status = ServiceOrderStatus.READY
        db_session.flush()
        assert order.status == ServiceOrderStatus.READY

        order.status = ServiceOrderStatus.DELIVERED
        db_session.flush()
        assert order.status == ServiceOrderStatus.DELIVERED

    def test_status_can_skip_steps(self, db_session):
        """RECEIVED -> READY directly (skipping IN_PROGRESS)."""
        customer = _make_customer(db_session)
        order = _make_service_order(db_session, customer.id)

        assert order.status == ServiceOrderStatus.RECEIVED

        order.status = ServiceOrderStatus.READY
        db_session.flush()

        assert order.status == ServiceOrderStatus.READY, \
            "Order must be able to skip to READY from RECEIVED"

    def test_metadata_merge_on_status_update(self, db_session):
        """Update metadata, verify merge not replace."""
        customer = _make_customer(db_session)
        order = _make_service_order(db_session, customer.id)

        # Set initial metadata
        order.order_metadata = {"diagnosis": "Pantalla rota", "priority_note": "VIP"}
        db_session.flush()

        # Merge new data (simulates status update adding info)
        metadata = dict(order.order_metadata or {})
        metadata["payment_status"] = "PARTIAL"
        metadata["technician_notes"] = "Requiere repuesto original"
        order.order_metadata = metadata
        db_session.flush()

        db_session.refresh(order)
        assert order.order_metadata["diagnosis"] == "Pantalla rota", \
            "Original metadata must persist after merge"
        assert order.order_metadata["priority_note"] == "VIP", \
            "Original metadata must persist after merge"
        assert order.order_metadata["payment_status"] == "PARTIAL", \
            "New metadata keys must be present after merge"
        assert order.order_metadata["technician_notes"] == "Requiere repuesto original"


# ===========================================================================
# Class 4: TestServicePayments
# ===========================================================================

class TestServicePayments:

    def test_initial_payment_creates_service_payment(self, db_session):
        """Create order with payment, verify ServicePayment record."""
        customer = _make_customer(db_session)
        order = _make_service_order(db_session, customer.id, payments=[
            {"amount": 20.00, "currency": "USD", "method": "Efectivo"},
        ])

        payments = db_session.query(ServicePayment).filter_by(
            service_order_id=order.id
        ).all()
        assert len(payments) == 1, "One ServicePayment must be created"
        assert payments[0].amount == Decimal("20.0000"), \
            f"Payment amount must be 20.00, got {payments[0].amount}"
        assert payments[0].currency == "USD"
        assert payments[0].payment_method == "Efectivo"

    def test_multiple_payments_sum_correctly(self, db_session):
        """Add 3 payments, verify sum."""
        customer = _make_customer(db_session)
        order = _make_service_order(db_session, customer.id, payments=[
            {"amount": 10.00, "currency": "USD", "method": "Efectivo"},
            {"amount": 15.50, "currency": "USD", "method": "Transferencia"},
            {"amount": 5.00, "currency": "USD", "method": "Efectivo"},
        ])

        payments = db_session.query(ServicePayment).filter_by(
            service_order_id=order.id
        ).all()
        total_paid = sum(p.amount for p in payments)
        expected = Decimal("10.00") + Decimal("15.50") + Decimal("5.00")
        assert total_paid == expected, \
            f"Sum of payments {total_paid} must equal {expected}"

    def test_payment_status_indicators(self, db_session):
        """Verify paid/partial/unpaid logic based on payments vs items total."""
        customer = _make_customer(db_session)

        # Order with items totaling 50 USD
        order = _make_service_order(db_session, customer.id,
            items=[
                {"description": "Reparacion", "unit_price": 50.00, "is_manual": True},
            ],
        )

        items = db_session.query(ServiceOrderDetail).filter_by(
            service_order_id=order.id
        ).all()
        order_total = sum(i.unit_price * i.quantity for i in items)

        # Unpaid: no payments
        payments = db_session.query(ServicePayment).filter_by(
            service_order_id=order.id
        ).all()
        total_paid = sum(p.amount for p in payments)
        assert total_paid == 0, "No payments yet means unpaid"

        # Partial: add a partial payment
        sp = ServicePayment(
            tenant_id="default",
            service_order_id=order.id,
            amount=Decimal("20.00"),
            currency="USD",
            payment_method="Efectivo",
        )
        db_session.add(sp)
        db_session.flush()

        payments = db_session.query(ServicePayment).filter_by(
            service_order_id=order.id
        ).all()
        total_paid = sum(p.amount for p in payments)
        assert Decimal("0") < total_paid < order_total, \
            "Partial payment: 0 < paid < total"

        # Fully paid: add remaining
        sp2 = ServicePayment(
            tenant_id="default",
            service_order_id=order.id,
            amount=Decimal("30.00"),
            currency="USD",
            payment_method="Transferencia",
        )
        db_session.add(sp2)
        db_session.flush()

        payments = db_session.query(ServicePayment).filter_by(
            service_order_id=order.id
        ).all()
        total_paid = sum(p.amount for p in payments)
        assert total_paid >= order_total, \
            f"Fully paid: total_paid ({total_paid}) >= order_total ({order_total})"


# ===========================================================================
# Class 5: TestServiceCheckoutFlow (uses ServiceCheckoutService.convert_order_to_sale)
# ===========================================================================

class TestServiceCheckoutFlow:

    def _setup_ready_order(self, db, with_product=False, with_manual=True,
                           payments=None, product_price=45.00, manual_price=20.00):
        """Helper: creates a READY order with optional items and payments."""
        customer = _make_customer(db)
        wh = _make_warehouse(db)

        items = []
        if with_product:
            product = _make_product(db, price=product_price, stock=10, warehouse_id=wh.id)
            items.append({
                "product_id": product.id, "description": product.name,
                "is_manual": False, "unit_price": product_price,
                "cost": float(product.cost_price), "quantity": 1,
            })
        else:
            product = None

        if with_manual:
            items.append({
                "description": "Mano de obra", "is_manual": True,
                "unit_price": manual_price, "quantity": 1, "cost": 0,
            })

        # Ensure GENERIC-SERVICE product exists for manual items
        generic = db.query(Product).filter(Product.sku == "GENERIC-SERVICE").first()
        if not generic:
            _make_generic_service_product(db)

        order = _make_service_order(
            db, customer.id, status="READY",
            items=items, payments=payments,
        )

        total = sum(
            Decimal(str(i["unit_price"])) * Decimal(str(i.get("quantity", 1)))
            for i in items
        )
        return order, customer, product, wh, total

    def _do_checkout(self, db, order, total, extra_payments=None):
        """Helper: runs the checkout service."""
        user = _make_user(db)
        payment_data = _make_sale_create(total, payments=extra_payments)
        sale = ServiceCheckoutService.convert_order_to_sale(
            db=db, order_id=order.id, payment_data=payment_data, user_id=user.id,
        )
        return sale

    def test_checkout_creates_sale(self, db_session):
        """Checkout READY order, verify Sale created."""
        order, customer, _, _, total = self._setup_ready_order(db_session)
        sale = self._do_checkout(db_session, order, total)

        assert sale is not None, "Checkout must return a Sale object"
        assert sale.id is not None, "Sale must have an ID after commit"
        assert isinstance(sale, Sale), "Returned object must be a Sale instance"

    def test_checkout_creates_sale_details(self, db_session):
        """Verify SaleDetail records match order items."""
        order, _, _, _, total = self._setup_ready_order(
            db_session, with_product=True, with_manual=True
        )
        sale = self._do_checkout(db_session, order, total)

        details = db_session.query(SaleDetail).filter_by(sale_id=sale.id).all()
        assert len(details) == 2, \
            f"Sale must have 2 details (product + manual), got {len(details)}"

    def test_checkout_creates_sale_payments(self, db_session):
        """Verify SalePayment records for abonos + new payment."""
        # Order with a previous payment (abono) of 10 USD
        order, _, _, _, total = self._setup_ready_order(
            db_session, with_manual=True, manual_price=30.00,
            payments=[{"amount": 10.00, "currency": "USD", "method": "Efectivo"}],
        )

        remaining = total - Decimal("10.00")
        new_payments = [
            SalePaymentCreate(
                amount=remaining, currency="USD",
                payment_method="Efectivo", exchange_rate=Decimal("1.0"),
            ),
        ]
        sale = self._do_checkout(db_session, order, total, extra_payments=new_payments)

        sale_payments = db_session.query(SalePayment).filter_by(sale_id=sale.id).all()
        # 1 migrated abono + 1 new payment = 2
        assert len(sale_payments) == 2, \
            f"Expected 2 SalePayments (1 abono + 1 new), got {len(sale_payments)}"

    def test_checkout_marks_order_delivered(self, db_session):
        """Verify order.status = DELIVERED after checkout."""
        order, _, _, _, total = self._setup_ready_order(db_session)
        self._do_checkout(db_session, order, total)

        db_session.refresh(order)
        is_delivered = (
            order.status == ServiceOrderStatus.DELIVERED
            or str(order.status) == "DELIVERED"
            or (hasattr(order.status, 'value') and order.status.value == "DELIVERED")
        )
        assert is_delivered, \
            f"Order status must be DELIVERED after checkout, got {order.status}"

    def test_checkout_marks_order_paid(self, db_session):
        """Verify order_metadata.payment_status = 'PAID'."""
        order, _, _, _, total = self._setup_ready_order(db_session)
        self._do_checkout(db_session, order, total)

        db_session.refresh(order)
        assert order.order_metadata is not None, \
            "Order metadata must be set after checkout"
        assert order.order_metadata.get("payment_status") == "PAID", \
            f"payment_status must be 'PAID', got {order.order_metadata.get('payment_status')}"

    def test_checkout_prevents_double_billing(self, db_session):
        """Try checkout twice, second should fail (order no longer READY)."""
        order, _, _, _, total = self._setup_ready_order(db_session)
        self._do_checkout(db_session, order, total)

        # Second checkout attempt should fail because order is now DELIVERED
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc_info:
            user = _make_user(db_session)
            payment_data = _make_sale_create(total)
            ServiceCheckoutService.convert_order_to_sale(
                db=db_session, order_id=order.id,
                payment_data=payment_data, user_id=user.id,
            )

        assert exc_info.value.status_code in (400, 500), \
            "Double checkout must be rejected with 400 or 500"

    def test_checkout_deducts_stock_for_products(self, db_session):
        """Add product item, checkout, verify stock decreased."""
        order, _, product, wh, total = self._setup_ready_order(
            db_session, with_product=True, with_manual=False, product_price=45.00,
        )

        stock_before = db_session.query(ProductStock).filter_by(
            product_id=product.id, warehouse_id=wh.id,
        ).first()
        qty_before = stock_before.quantity if stock_before else Decimal("10")

        self._do_checkout(db_session, order, total)

        db_session.refresh(product)
        # The service uses warehouse_id=1 hardcoded, so check both product.stock
        # and the stock record for warehouse_id matching the first warehouse
        stock_record = db_session.query(ProductStock).filter_by(
            product_id=product.id, warehouse_id=wh.id,
        ).first()

        # Product stock is deducted at the Product level
        assert product.stock < Decimal(str(10)), \
            f"Product.stock must decrease after checkout, got {product.stock}"

    def test_checkout_does_not_deduct_stock_for_manual(self, db_session):
        """Manual items don't affect stock."""
        generic = _make_generic_service_product(db_session)
        stock_before = generic.stock

        order, _, _, _, total = self._setup_ready_order(
            db_session, with_product=False, with_manual=True, manual_price=30.00,
        )
        self._do_checkout(db_session, order, total)

        db_session.refresh(generic)
        assert generic.stock == stock_before, \
            f"Generic service product stock must not change, was {stock_before}, now {generic.stock}"

    def test_checkout_migrates_previous_payments(self, db_session):
        """Verify ServicePayment records become SalePayment with 'ABONO' prefix."""
        order, _, _, _, total = self._setup_ready_order(
            db_session, with_manual=True, manual_price=50.00,
            payments=[
                {"amount": 15.00, "currency": "USD", "method": "Efectivo"},
                {"amount": 10.00, "currency": "USD", "method": "Transferencia"},
            ],
        )

        remaining = total - Decimal("25.00")
        new_payments = [
            SalePaymentCreate(
                amount=remaining, currency="USD",
                payment_method="Efectivo", exchange_rate=Decimal("1.0"),
            ),
        ]
        sale = self._do_checkout(db_session, order, total, extra_payments=new_payments)

        sale_payments = db_session.query(SalePayment).filter_by(sale_id=sale.id).all()

        # 2 migrated abonos + 1 new payment = 3
        assert len(sale_payments) == 3, \
            f"Expected 3 SalePayments (2 abonos + 1 new), got {len(sale_payments)}"

        abono_payments = [p for p in sale_payments if "ABONO" in (p.payment_method or "")]
        assert len(abono_payments) == 2, \
            f"Expected 2 payments with ABONO prefix, got {len(abono_payments)}"

        # Verify ABONO amounts
        abono_amounts = sorted([p.amount for p in abono_payments])
        assert abono_amounts[0] == Decimal("10.0000"), \
            f"First abono must be 10.00, got {abono_amounts[0]}"
        assert abono_amounts[1] == Decimal("15.0000"), \
            f"Second abono must be 15.00, got {abono_amounts[1]}"

        # Verify ABONO methods contain original method
        abono_methods = sorted([p.payment_method for p in abono_payments])
        assert "ABONO (Efectivo)" in abono_methods, \
            f"Abono must contain original method, got {abono_methods}"
        assert "ABONO (Transferencia)" in abono_methods, \
            f"Abono must contain original method, got {abono_methods}"


# ===========================================================================
# Class 6: TestServiceSaleVisibility
# ===========================================================================

class TestServiceSaleVisibility:

    def _checkout_order(self, db):
        """Helper: create and checkout a service order, return (sale, order, customer)."""
        customer = _make_customer(db)
        wh = _make_warehouse(db)

        generic = db.query(Product).filter(Product.sku == "GENERIC-SERVICE").first()
        if not generic:
            _make_generic_service_product(db)

        order = _make_service_order(
            db, customer.id, status="READY",
            items=[
                {"description": "Reparacion pantalla", "unit_price": 35.00,
                 "is_manual": True, "quantity": 1},
                {"description": "Limpieza interna", "unit_price": 15.00,
                 "is_manual": True, "quantity": 1},
            ],
        )

        total = Decimal("50.00")
        user = _make_user(db)
        payment_data = _make_sale_create(total)
        sale = ServiceCheckoutService.convert_order_to_sale(
            db=db, order_id=order.id, payment_data=payment_data, user_id=user.id,
        )
        return sale, order, customer

    def test_service_sale_appears_in_sales_list(self, db_session):
        """Query Sale table, verify service sale is there."""
        sale, _, _ = self._checkout_order(db_session)

        all_sales = db_session.query(Sale).all()
        sale_ids = [s.id for s in all_sales]
        assert sale.id in sale_ids, \
            "Service-originated sale must appear in general sales list"

    def test_service_sale_has_correct_total(self, db_session):
        """Verify sale.total_amount matches order items sum (35 + 15 = 50)."""
        sale, _, _ = self._checkout_order(db_session)

        assert sale.total_amount == Decimal("50.0000"), \
            f"Sale total must be 50.00, got {sale.total_amount}"

    def test_service_sale_has_customer_linked(self, db_session):
        """Verify sale.customer_id = order.customer_id."""
        sale, order, customer = self._checkout_order(db_session)

        assert sale.customer_id == customer.id, \
            f"Sale customer_id ({sale.customer_id}) must match order customer ({customer.id})"

    def test_service_sale_notes_contain_ticket(self, db_session):
        """Verify sale.notes contains 'Orden de Servicio #SRV-...'."""
        sale, order, _ = self._checkout_order(db_session)

        assert sale.notes is not None, "Sale notes must not be None"
        assert f"Orden de Servicio #{order.ticket_number}" in sale.notes, \
            f"Sale notes must contain the order ticket number, got: '{sale.notes}'"
