"""
test_func_compras_pg.py — Tests funcionales de Compras (Purchase Orders)

Verifican que al registrar una compra:
- El stock en el warehouse específico aumenta correctamente
- El stock global (Product.stock) también aumenta
- Se crea un movimiento Kardex de tipo PURCHASE
- Otros warehouses no se afectan
- El costo de compra puede actualizarse en el producto

Flujos cubiertos:
  FP01 — Compra aumenta ProductStock en el warehouse destino
  FP02 — Compra no afecta otros warehouses
  FP03 — Compra crea Kardex tipo PURCHASE con balance_after correcto
  FP04 — Compra actualiza cost_price si update_cost=True
  FP05 — Compra CASH marca la orden como PAID inmediatamente

Correr con:
    cd ferreteria_refactor
    python -m pytest backend_api/tests/test_func_compras_pg.py -v --no-cov -s
"""

import pytest
import uuid
from decimal import Decimal
from datetime import datetime
from sqlalchemy import text

import sys, os
_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _root not in sys.path:
    sys.path.insert(0, _root)

from backend_api.models.models import (
    Product, ProductStock, Warehouse, Kardex, MovementType,
    Supplier, PurchaseOrder, PurchaseItem, PaymentStatus
)

TENANT = "lalicoreria"


# ---------------------------------------------------------------------------
# Fixtures locales
# ---------------------------------------------------------------------------

@pytest.fixture()
def tenant_db(pg_db_for_schema):
    return pg_db_for_schema(TENANT)


@pytest.fixture()
def warehouse_principal(tenant_db):
    wh = tenant_db.query(Warehouse).filter_by(is_active=True, is_main=True).first()
    if not wh:
        wh = tenant_db.query(Warehouse).filter_by(is_active=True).first()
    assert wh is not None
    return wh


@pytest.fixture()
def warehouse_secundario(tenant_db):
    wh = Warehouse(
        name=f"Bodega Compra Test {uuid.uuid4().hex[:6]}",
        is_active=True,
        is_main=False,
    )
    tenant_db.add(wh)
    tenant_db.flush()
    return wh


@pytest.fixture()
def proveedor(tenant_db):
    """Crea un proveedor de prueba."""
    sup = Supplier(
        name=f"Proveedor Test {uuid.uuid4().hex[:6]}",
        is_active=True,
        payment_terms=30,
        current_balance=Decimal("0.00"),
    )
    tenant_db.add(sup)
    tenant_db.flush()
    return sup


@pytest.fixture()
def producto_para_compra(tenant_db, warehouse_principal):
    """Producto con stock inicial de 10 en el warehouse principal."""
    product = Product(
        name=f"Producto Compra {uuid.uuid4().hex[:6]}",
        sku=f"CPR-{uuid.uuid4().hex[:8].upper()}",
        price=Decimal("15.00"),
        stock=Decimal("10.000"),
        cost_price=Decimal("8.00"),
        is_active=True,
        is_service=False,
        is_combo=False,
        has_imei=False,
    )
    tenant_db.add(product)
    tenant_db.flush()

    stock = ProductStock(
        product_id=product.id,
        warehouse_id=warehouse_principal.id,
        quantity=Decimal("10.000"),
    )
    tenant_db.add(stock)
    tenant_db.flush()

    return product, stock


# ---------------------------------------------------------------------------
# Helper — replica la lógica del router purchases.py:create_purchase_order()
# sin WebSocket ni db.commit() para que el test transaction funcione
# ---------------------------------------------------------------------------

def _execute_purchase(db, supplier, warehouse_id, items, payment_type="CREDIT"):
    """
    items = list of dicts: {product, quantity, unit_cost, update_cost, update_price}
    Retorna (purchase, lista de (product_stock, kardex) por ítem)
    """
    total = sum(Decimal(str(i["unit_cost"])) * Decimal(str(i["quantity"])) for i in items)

    purchase = PurchaseOrder(
        supplier_id=supplier.id,
        warehouse_id=warehouse_id,
        total_amount=total,
        paid_amount=Decimal("0.00"),
        payment_status=PaymentStatus.PENDING,
        purchase_date=datetime.now(),
    )
    db.add(purchase)
    db.flush()

    results = []
    for item in items:
        product = item["product"]
        qty = Decimal(str(item["quantity"]))
        unit_cost = Decimal(str(item["unit_cost"]))
        update_cost = item.get("update_cost", False)

        # Crear PurchaseItem
        pi = PurchaseItem(
            purchase_id=purchase.id,
            product_id=product.id,
            quantity=qty,
            unit_cost=unit_cost,
        )
        db.add(pi)

        # 1. Actualizar ProductStock en warehouse
        ps = db.query(ProductStock).filter_by(
            product_id=product.id,
            warehouse_id=warehouse_id
        ).first()
        if not ps:
            ps = ProductStock(
                product_id=product.id,
                warehouse_id=warehouse_id,
                quantity=Decimal("0.000"),
            )
            db.add(ps)
        ps.quantity += qty

        # 2. Actualizar stock global
        product.stock += qty

        # 3. Actualizar cost_price si se solicitó
        if update_cost and unit_cost > 0:
            product.cost_price = unit_cost

        # 4. Crear Kardex PURCHASE
        kardex = Kardex(
            product_id=product.id,
            warehouse_id=warehouse_id,
            movement_type=MovementType.PURCHASE,
            quantity=qty,
            balance_after=product.stock,
            description=f"Compra #{purchase.id} - {supplier.name}",
            date=datetime.now(),
        )
        db.add(kardex)
        results.append((ps, kardex))

    # Crédito/Contado
    if payment_type == "CREDIT":
        supplier.current_balance += total
    elif payment_type == "CASH":
        purchase.paid_amount = total
        purchase.payment_status = PaymentStatus.PAID

    db.flush()
    return purchase, results


# ---------------------------------------------------------------------------
# FP01 — Compra aumenta ProductStock en warehouse destino
# ---------------------------------------------------------------------------

class TestFP01StockWarehouse:

    def test_compra_aumenta_product_stock_en_warehouse(
        self, tenant_db, proveedor, producto_para_compra, warehouse_principal
    ):
        """
        FP01a: Una compra de 50 unidades debe aumentar ProductStock[warehouse] de 10 a 60.
        """
        product, stock_record = producto_para_compra
        stock_antes = stock_record.quantity  # 10.000

        _execute_purchase(tenant_db, proveedor, warehouse_principal.id, [
            {"product": product, "quantity": 50, "unit_cost": Decimal("8.00")}
        ])

        tenant_db.refresh(stock_record)
        assert stock_record.quantity == stock_antes + Decimal("50.000"), (
            f"ProductStock debería ser {stock_antes + 50}, es {stock_record.quantity}"
        )

    def test_compra_aumenta_stock_global(
        self, tenant_db, proveedor, producto_para_compra, warehouse_principal
    ):
        """
        FP01b: El campo Product.stock (caché global) también debe aumentar.
        """
        product, _ = producto_para_compra
        stock_antes = product.stock  # 10.000

        _execute_purchase(tenant_db, proveedor, warehouse_principal.id, [
            {"product": product, "quantity": 30, "unit_cost": Decimal("8.00")}
        ])

        tenant_db.refresh(product)
        assert product.stock == stock_antes + Decimal("30.000"), (
            f"Stock global debería ser {stock_antes + 30}, es {product.stock}"
        )

    def test_compra_crea_product_stock_si_no_existe(
        self, tenant_db, proveedor, warehouse_secundario
    ):
        """
        FP01c: Si el producto no tiene ProductStock en ese warehouse, debe crearse.
        Caso: producto que solo existía en bodega A y se compra para bodega B.
        """
        # Producto sin stock en warehouse_secundario
        product = Product(
            name=f"Prod Sin Stock {uuid.uuid4().hex[:6]}",
            sku=f"PSS-{uuid.uuid4().hex[:8].upper()}",
            price=Decimal("20.00"),
            stock=Decimal("0.000"),
            cost_price=Decimal("12.00"),
            is_active=True, is_service=False, is_combo=False, has_imei=False,
        )
        tenant_db.add(product)
        tenant_db.flush()

        # Verificar que no hay ProductStock para esta bodega
        ps_antes = tenant_db.query(ProductStock).filter_by(
            product_id=product.id,
            warehouse_id=warehouse_secundario.id
        ).first()
        assert ps_antes is None

        _execute_purchase(tenant_db, proveedor, warehouse_secundario.id, [
            {"product": product, "quantity": 25, "unit_cost": Decimal("12.00")}
        ])

        ps_despues = tenant_db.query(ProductStock).filter_by(
            product_id=product.id,
            warehouse_id=warehouse_secundario.id
        ).first()
        assert ps_despues is not None, "Se debió crear ProductStock para el warehouse"
        assert ps_despues.quantity == Decimal("25.000")


# ---------------------------------------------------------------------------
# FP02 — Compra no afecta otros warehouses
# ---------------------------------------------------------------------------

class TestFP02WarehouseEspecifico:

    def test_compra_en_secundario_no_afecta_principal(
        self, tenant_db, proveedor, producto_para_compra,
        warehouse_principal, warehouse_secundario
    ):
        """
        FP02: Al comprar stock en warehouse_secundario, el stock de warehouse_principal
        NO debe cambiar. La compra es warehouse-specific.
        """
        product, stock_principal = producto_para_compra
        qty_principal_antes = stock_principal.quantity  # 10.000

        _execute_purchase(tenant_db, proveedor, warehouse_secundario.id, [
            {"product": product, "quantity": 40, "unit_cost": Decimal("8.50")}
        ])

        tenant_db.refresh(stock_principal)
        assert stock_principal.quantity == qty_principal_antes, (
            f"warehouse_principal se modificó: "
            f"antes={qty_principal_antes}, después={stock_principal.quantity}"
        )

        # Verificar que sí aumentó en el secundario
        ps_sec = tenant_db.query(ProductStock).filter_by(
            product_id=product.id,
            warehouse_id=warehouse_secundario.id
        ).first()
        assert ps_sec is not None
        assert ps_sec.quantity == Decimal("40.000")


# ---------------------------------------------------------------------------
# FP03 — Compra crea Kardex PURCHASE con datos correctos
# ---------------------------------------------------------------------------

class TestFP03Kardex:

    def test_compra_crea_kardex_tipo_purchase(
        self, tenant_db, proveedor, producto_para_compra, warehouse_principal
    ):
        """
        FP03a: La compra debe crear una entrada Kardex de tipo PURCHASE.
        """
        product, _ = producto_para_compra
        kardex_antes = tenant_db.query(Kardex).filter_by(
            product_id=product.id,
            movement_type=MovementType.PURCHASE
        ).count()

        _execute_purchase(tenant_db, proveedor, warehouse_principal.id, [
            {"product": product, "quantity": 20, "unit_cost": Decimal("8.00")}
        ])

        kardex_despues = tenant_db.query(Kardex).filter_by(
            product_id=product.id,
            movement_type=MovementType.PURCHASE
        ).count()
        assert kardex_despues == kardex_antes + 1, \
            "La compra no generó movimiento Kardex de tipo PURCHASE"

    def test_kardex_balance_after_correcto(
        self, tenant_db, proveedor, producto_para_compra, warehouse_principal
    ):
        """
        FP03b: El balance_after del Kardex debe ser = stock previo + cantidad comprada.
        """
        product, _ = producto_para_compra
        stock_antes = product.stock  # 10.000
        qty_compra = Decimal("15.000")

        _, results = _execute_purchase(tenant_db, proveedor, warehouse_principal.id, [
            {"product": product, "quantity": qty_compra, "unit_cost": Decimal("8.00")}
        ])

        _, kardex = results[0]
        expected_balance = stock_antes + qty_compra  # 25.000

        assert kardex.balance_after == expected_balance, (
            f"balance_after={kardex.balance_after}, esperado={expected_balance}"
        )

    def test_kardex_referencia_warehouse_correcto(
        self, tenant_db, proveedor, producto_para_compra, warehouse_principal
    ):
        """
        FP03c: El Kardex debe referenciar el warehouse de destino de la compra.
        """
        product, _ = producto_para_compra

        _, results = _execute_purchase(tenant_db, proveedor, warehouse_principal.id, [
            {"product": product, "quantity": 10, "unit_cost": Decimal("8.00")}
        ])

        _, kardex = results[0]
        assert kardex.warehouse_id == warehouse_principal.id, (
            f"Kardex warehouse_id={kardex.warehouse_id}, "
            f"esperado={warehouse_principal.id}"
        )


# ---------------------------------------------------------------------------
# FP04 — Actualización de costo de compra
# ---------------------------------------------------------------------------

class TestFP04CostPrice:

    def test_compra_actualiza_cost_price_si_solicitado(
        self, tenant_db, proveedor, producto_para_compra, warehouse_principal
    ):
        """
        FP04a: Si update_cost=True, el costo del producto debe actualizarse
        al unit_cost de la compra.
        """
        product, _ = producto_para_compra
        nuevo_costo = Decimal("9.50")

        _execute_purchase(tenant_db, proveedor, warehouse_principal.id, [
            {"product": product, "quantity": 20,
             "unit_cost": nuevo_costo, "update_cost": True}
        ])

        tenant_db.refresh(product)
        assert product.cost_price == nuevo_costo, (
            f"cost_price debería ser {nuevo_costo}, es {product.cost_price}"
        )

    def test_compra_no_actualiza_cost_price_por_default(
        self, tenant_db, proveedor, producto_para_compra, warehouse_principal
    ):
        """
        FP04b: Sin update_cost=True, el costo del producto NO debe cambiar.
        """
        product, _ = producto_para_compra
        costo_original = product.cost_price  # 8.00

        _execute_purchase(tenant_db, proveedor, warehouse_principal.id, [
            {"product": product, "quantity": 20,
             "unit_cost": Decimal("11.00"), "update_cost": False}
        ])

        tenant_db.refresh(product)
        assert product.cost_price == costo_original, (
            f"El costo cambió sin update_cost=True: "
            f"original={costo_original}, ahora={product.cost_price}"
        )


# ---------------------------------------------------------------------------
# FP05 — Pago contado vs crédito
# ---------------------------------------------------------------------------

class TestFP05PagoTipo:

    def test_compra_cash_marca_como_pagada(
        self, tenant_db, proveedor, producto_para_compra, warehouse_principal
    ):
        """
        FP05a: Una compra CASH debe quedar con payment_status=PAID y
        paid_amount == total_amount.
        """
        product, _ = producto_para_compra

        purchase, _ = _execute_purchase(
            tenant_db, proveedor, warehouse_principal.id,
            [{"product": product, "quantity": 10, "unit_cost": Decimal("8.00")}],
            payment_type="CASH"
        )

        assert purchase.payment_status == PaymentStatus.PAID, \
            "Compra CASH debería quedar con status PAID"
        assert purchase.paid_amount == purchase.total_amount, \
            "Compra CASH: paid_amount debe ser igual a total_amount"

    def test_compra_credit_queda_pendiente(
        self, tenant_db, proveedor, producto_para_compra, warehouse_principal
    ):
        """
        FP05b: Una compra a CREDIT debe quedar con payment_status=PENDING.
        """
        product, _ = producto_para_compra

        purchase, _ = _execute_purchase(
            tenant_db, proveedor, warehouse_principal.id,
            [{"product": product, "quantity": 10, "unit_cost": Decimal("8.00")}],
            payment_type="CREDIT"
        )

        assert purchase.payment_status == PaymentStatus.PENDING, \
            "Compra CREDIT debería quedar con status PENDING"
        assert purchase.paid_amount == Decimal("0.00"), \
            "Compra CREDIT: paid_amount debe ser 0"

    def test_compra_credit_aumenta_deuda_proveedor(
        self, tenant_db, proveedor, producto_para_compra, warehouse_principal
    ):
        """
        FP05c: Una compra a crédito debe incrementar current_balance del proveedor.
        """
        product, _ = producto_para_compra
        deuda_antes = proveedor.current_balance  # 0.00
        total_compra = Decimal("10.000") * Decimal("8.00")  # 80.00

        _execute_purchase(
            tenant_db, proveedor, warehouse_principal.id,
            [{"product": product, "quantity": 10, "unit_cost": Decimal("8.00")}],
            payment_type="CREDIT"
        )

        tenant_db.refresh(proveedor)
        assert proveedor.current_balance == deuda_antes + total_compra, (
            f"Deuda del proveedor debería ser {deuda_antes + total_compra}, "
            f"es {proveedor.current_balance}"
        )
