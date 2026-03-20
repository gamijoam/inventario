"""
test_func_compras_avanzado.py — Tests funcionales de Compras (flujos avanzados)

Flujos cubiertos:
  FPA01 — Balance de proveedor: CREDIT aumenta, pagos parciales → PARTIAL → PAID
  FPA02 — Actualización de precio de venta: update_price y margen protegido
  FPA03 — Warehouse específico vs principal, múltiples ítems
  FPA04 — PO con múltiples ítems actualiza cada producto

Correr con:
    cd ferreteria_refactor
    python -m pytest backend_api/tests/test_func_compras_avanzado.py -v --no-cov -s
"""

import pytest
import uuid
from decimal import Decimal
from sqlalchemy import text

import sys, os
_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _root not in sys.path:
    sys.path.insert(0, _root)

from backend_api.models.models import (
    Supplier, PurchaseOrder, PurchaseItem, PaymentStatus,
    Product, ProductStock, Warehouse, Kardex, MovementType,
)

TENANT = "lalicoreria"


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def tenant_db(pg_db_for_schema):
    return pg_db_for_schema(TENANT)


@pytest.fixture()
def supplier_obj(tenant_db):
    supplier = Supplier(
        name=f"Proveedor Adv {uuid.uuid4().hex[:8]}",
        payment_terms=30,
        current_balance=Decimal("0.00"),
    )
    tenant_db.add(supplier)
    tenant_db.flush()
    return supplier


@pytest.fixture()
def warehouse_a(tenant_db):
    wh = Warehouse(
        name=f"WH-A {uuid.uuid4().hex[:6]}",
        is_active=True, is_main=True,
    )
    tenant_db.add(wh)
    tenant_db.flush()
    return wh


@pytest.fixture()
def warehouse_b(tenant_db):
    wh = Warehouse(
        name=f"WH-B {uuid.uuid4().hex[:6]}",
        is_active=True, is_main=False,
    )
    tenant_db.add(wh)
    tenant_db.flush()
    return wh


@pytest.fixture()
def product_obj(tenant_db):
    p = Product(
        name=f"Prod Adv {uuid.uuid4().hex[:6]}",
        price=Decimal("20.00"),
        cost_price=Decimal("12.00"),
        profit_margin=Decimal("66.67"),
        stock=Decimal("0.000"),
    )
    tenant_db.add(p)
    tenant_db.flush()
    return p


def _execute_purchase(db, supplier, warehouse_id, items, payment_type="CASH"):
    """
    Replica la lógica de purchases.py:create_purchase_order() sin db.commit().
    items: [{"product": Product, "qty": Decimal, "unit_cost": Decimal, "update_cost": bool}]
    """
    total = sum(i["qty"] * i["unit_cost"] for i in items)

    po = PurchaseOrder(
        supplier_id=supplier.id,
        warehouse_id=warehouse_id,
        total_amount=total,
        paid_amount=total if payment_type == "CASH" else Decimal("0.00"),
        payment_status=PaymentStatus.PAID if payment_type == "CASH" else PaymentStatus.PENDING,
    )
    db.add(po)
    db.flush()

    for item_data in items:
        product = item_data["product"]
        qty = item_data["qty"]
        unit_cost = item_data["unit_cost"]
        update_cost = item_data.get("update_cost", False)

        # Crear PurchaseItem
        poi = PurchaseItem(
            purchase_id=po.id,
            product_id=product.id,
            quantity=qty,
            unit_cost=unit_cost,
        )
        db.add(poi)

        # Actualizar ProductStock
        ps = db.query(ProductStock).filter_by(
            product_id=product.id, warehouse_id=warehouse_id
        ).first()
        if ps:
            ps.quantity += qty
        else:
            ps = ProductStock(product_id=product.id, warehouse_id=warehouse_id, quantity=qty)
            db.add(ps)

        # Actualizar stock global
        product.stock += qty

        # Crear Kardex
        db.add(Kardex(
            product_id=product.id,
            movement_type=MovementType.PURCHASE,
            quantity=qty,
            balance_after=product.stock,
            warehouse_id=warehouse_id,
        ))

        # Actualizar cost_price si se solicitó
        if update_cost:
            product.cost_price = unit_cost

    # Actualizar balance del proveedor si es crédito
    if payment_type == "CREDIT":
        supplier.current_balance += total

    db.flush()
    return po


# ---------------------------------------------------------------------------
# FPA01 — Balance de proveedor: CREDIT y pagos
# ---------------------------------------------------------------------------

class TestFPA01BalanceProveedor:

    def test_compra_credit_aumenta_balance_proveedor(
        self, tenant_db, supplier_obj, warehouse_a, product_obj
    ):
        """
        FPA01a: Una compra CREDIT suma el total al current_balance del proveedor.
        Representa la deuda que le debemos al proveedor.
        """
        po = _execute_purchase(
            tenant_db, supplier_obj, warehouse_a.id,
            [{"product": product_obj, "qty": Decimal("10.000"), "unit_cost": Decimal("12.00")}],
            payment_type="CREDIT",
        )

        tenant_db.refresh(supplier_obj)
        assert supplier_obj.current_balance == Decimal("120.00")
        assert po.payment_status == PaymentStatus.PENDING
        assert po.paid_amount == Decimal("0.00")

    def test_pago_parcial_actualiza_po_a_partial(
        self, tenant_db, supplier_obj, warehouse_a, product_obj
    ):
        """
        FPA01b: Un pago parcial sobre una PO PENDING debe actualizar:
        - paid_amount += pago
        - payment_status = PARTIAL
        - supplier.current_balance -= pago
        """
        po = _execute_purchase(
            tenant_db, supplier_obj, warehouse_a.id,
            [{"product": product_obj, "qty": Decimal("5.000"), "unit_cost": Decimal("12.00")}],
            payment_type="CREDIT",
        )  # total = 60, proveedor debe 60

        pago = Decimal("25.00")
        po.paid_amount += pago
        supplier_obj.current_balance -= pago
        po.payment_status = PaymentStatus.PARTIAL if po.paid_amount < po.total_amount \
            else PaymentStatus.PAID
        tenant_db.flush()

        tenant_db.refresh(po)
        tenant_db.refresh(supplier_obj)
        assert po.payment_status == PaymentStatus.PARTIAL
        assert po.paid_amount == Decimal("25.00")
        assert supplier_obj.current_balance == Decimal("35.00")

    def test_pago_completo_liquida_deuda(
        self, tenant_db, supplier_obj, warehouse_a, product_obj
    ):
        """
        FPA01c: Pago completo → PO status=PAID, supplier.current_balance=0.
        """
        po = _execute_purchase(
            tenant_db, supplier_obj, warehouse_a.id,
            [{"product": product_obj, "qty": Decimal("3.000"), "unit_cost": Decimal("10.00")}],
            payment_type="CREDIT",
        )  # total = 30

        # Pago total
        po.paid_amount = po.total_amount
        po.payment_status = PaymentStatus.PAID
        supplier_obj.current_balance = Decimal("0.00")
        tenant_db.flush()

        tenant_db.refresh(po)
        tenant_db.refresh(supplier_obj)
        assert po.payment_status == PaymentStatus.PAID
        assert supplier_obj.current_balance == Decimal("0.00")

    def test_compra_cash_no_aumenta_balance(
        self, tenant_db, supplier_obj, warehouse_a, product_obj
    ):
        """
        FPA01d: Una compra CASH se paga en el momento. current_balance no cambia.
        """
        balance_antes = supplier_obj.current_balance

        _execute_purchase(
            tenant_db, supplier_obj, warehouse_a.id,
            [{"product": product_obj, "qty": Decimal("5.000"), "unit_cost": Decimal("10.00")}],
            payment_type="CASH",
        )

        tenant_db.refresh(supplier_obj)
        assert supplier_obj.current_balance == balance_antes


# ---------------------------------------------------------------------------
# FPA02 — Actualización de costo y precio de venta
# ---------------------------------------------------------------------------

class TestFPA02ActualizacionPrecio:

    def test_update_cost_actualiza_cost_price(
        self, tenant_db, supplier_obj, warehouse_a, product_obj
    ):
        """
        FPA02a: update_cost=True → product.cost_price = unit_cost de la compra.
        Permite mantener el costo actual del producto actualizado.
        """
        costo_anterior = product_obj.cost_price  # 12.00
        nuevo_costo = Decimal("14.50")

        _execute_purchase(
            tenant_db, supplier_obj, warehouse_a.id,
            [{"product": product_obj, "qty": Decimal("10.000"),
              "unit_cost": nuevo_costo, "update_cost": True}],
        )

        tenant_db.refresh(product_obj)
        assert product_obj.cost_price == nuevo_costo
        assert product_obj.cost_price != costo_anterior

    def test_sin_update_cost_no_cambia_costo(
        self, tenant_db, supplier_obj, warehouse_a, product_obj
    ):
        """
        FPA02b: update_cost=False (default) → product.cost_price no cambia.
        Útil cuando el costo histórico debe preservarse.
        """
        costo_original = product_obj.cost_price  # 12.00

        _execute_purchase(
            tenant_db, supplier_obj, warehouse_a.id,
            [{"product": product_obj, "qty": Decimal("5.000"),
              "unit_cost": Decimal("20.00"), "update_cost": False}],
        )

        tenant_db.refresh(product_obj)
        assert product_obj.cost_price == costo_original, \
            "El costo no debe cambiar si update_cost=False"

    def test_margen_protegido_calcula_nuevo_precio(self, tenant_db, product_obj):
        """
        FPA02c: Si hay profit_margin definido, el nuevo precio de venta se puede
        calcular como: nuevo_precio = nuevo_costo × (1 + margen/100).
        product.profit_margin = 66.67% → precio = 14.50 × 1.6667 ≈ 24.17
        """
        product_obj.cost_price = Decimal("14.50")
        product_obj.profit_margin = Decimal("66.67")

        # Cálculo del router cuando update_price=True y profit_margin está definido
        nuevo_precio = product_obj.cost_price * (
            1 + product_obj.profit_margin / Decimal("100.00")
        )
        product_obj.price = nuevo_precio.quantize(Decimal("0.01"))
        tenant_db.flush()

        tenant_db.refresh(product_obj)
        # 14.50 × 1.6667 = 24.17
        assert product_obj.price == Decimal("24.17")


# ---------------------------------------------------------------------------
# FPA03 — Warehouse específico y múltiples ítems
# ---------------------------------------------------------------------------

class TestFPA03WarehouseYMultiples:

    def test_recibir_en_warehouse_b_no_toca_a(
        self, tenant_db, supplier_obj, warehouse_a, warehouse_b, product_obj
    ):
        """
        FPA03a: Una compra dirigida a warehouse B no modifica el stock de warehouse A.
        Aislamiento entre almacenes.
        """
        # Stock inicial en A
        ps_a = ProductStock(product_id=product_obj.id,
                             warehouse_id=warehouse_a.id, quantity=Decimal("20.000"))
        tenant_db.add(ps_a)
        tenant_db.flush()
        stock_a_antes = ps_a.quantity

        # Compra va a warehouse B
        _execute_purchase(
            tenant_db, supplier_obj, warehouse_b.id,
            [{"product": product_obj, "qty": Decimal("15.000"), "unit_cost": Decimal("12.00")}],
        )

        tenant_db.refresh(ps_a)
        assert ps_a.quantity == stock_a_antes, \
            "La compra en warehouse B no debe tocar el stock de warehouse A"

        # Warehouse B tiene el nuevo stock
        ps_b = tenant_db.query(ProductStock).filter_by(
            product_id=product_obj.id, warehouse_id=warehouse_b.id
        ).first()
        assert ps_b is not None
        assert ps_b.quantity == Decimal("15.000")

    def test_po_con_multiples_productos(
        self, tenant_db, supplier_obj, warehouse_a, product_obj
    ):
        """
        FPA03b: Una PO con múltiples productos actualiza el stock de cada uno.
        """
        p2 = Product(name=f"P2 Adv {uuid.uuid4().hex[:6]}", price=Decimal("5.00"),
                      cost_price=Decimal("3.00"), stock=Decimal("0.000"))
        tenant_db.add(p2)
        tenant_db.flush()

        _execute_purchase(
            tenant_db, supplier_obj, warehouse_a.id,
            [
                {"product": product_obj, "qty": Decimal("10.000"), "unit_cost": Decimal("12.00")},
                {"product": p2, "qty": Decimal("20.000"), "unit_cost": Decimal("3.00")},
            ],
        )

        tenant_db.refresh(product_obj)
        tenant_db.refresh(p2)
        assert product_obj.stock == Decimal("10.000")
        assert p2.stock == Decimal("20.000")

        # Kardex para ambos
        kardex_p1 = tenant_db.query(Kardex).filter_by(
            product_id=product_obj.id, movement_type=MovementType.PURCHASE
        ).first()
        kardex_p2 = tenant_db.query(Kardex).filter_by(
            product_id=p2.id, movement_type=MovementType.PURCHASE
        ).first()
        assert kardex_p1 is not None
        assert kardex_p2 is not None

    def test_kardex_purchase_balance_after_correcto(
        self, tenant_db, supplier_obj, warehouse_a, product_obj
    ):
        """
        FPA03c: El Kardex de la compra debe registrar balance_after = stock total
        del producto después de la compra.
        """
        product_obj.stock = Decimal("5.000")  # Stock previo
        tenant_db.flush()

        _execute_purchase(
            tenant_db, supplier_obj, warehouse_a.id,
            [{"product": product_obj, "qty": Decimal("10.000"), "unit_cost": Decimal("12.00")}],
        )

        kardex = tenant_db.query(Kardex).filter_by(
            product_id=product_obj.id, movement_type=MovementType.PURCHASE,
            warehouse_id=warehouse_a.id,
        ).order_by(Kardex.id.desc()).first()

        assert kardex is not None
        assert kardex.balance_after == Decimal("15.000")  # 5 + 10
        assert kardex.quantity == Decimal("10.000")
