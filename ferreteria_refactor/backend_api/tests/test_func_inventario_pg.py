"""
test_func_inventario_pg.py — Tests funcionales de Inventario

Flujos cubiertos:
  F07 — Entrada de stock actualiza ProductStock, Product.stock y crea Kardex
  F14 — Entrada de stock va al warehouse específico y no afecta otros

Correr con:
    cd ferreteria_refactor
    python -m pytest backend_api/tests/test_func_inventario_pg.py -v --no-cov -s
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
    Product, ProductStock, Warehouse, Kardex, MovementType
)

TENANT = "lalicoreria"


# ---------------------------------------------------------------------------
# Fixtures locales
# ---------------------------------------------------------------------------

@pytest.fixture()
def tenant_db(pg_db_for_schema):
    return pg_db_for_schema(TENANT)


@pytest.fixture()
def warehouse_a(tenant_db):
    """Almacén principal A para tests."""
    wh = tenant_db.query(Warehouse).filter_by(is_active=True, is_main=True).first()
    if not wh:
        wh = tenant_db.query(Warehouse).filter_by(is_active=True).first()
    assert wh is not None, f"El tenant {TENANT} no tiene almacén activo"
    return wh


@pytest.fixture()
def warehouse_b(tenant_db):
    """Crea un segundo almacén para tests multi-warehouse."""
    wh = Warehouse(
        name=f"Bodega Test B {uuid.uuid4().hex[:6]}",
        is_active=True,
        is_main=False,
    )
    tenant_db.add(wh)
    tenant_db.flush()
    return wh


@pytest.fixture()
def test_product_with_stock(tenant_db, warehouse_a):
    """Producto físico con 20 unidades en warehouse_a."""
    product = Product(
        name=f"Producto Inv Test {uuid.uuid4().hex[:6]}",
        sku=f"INV-{uuid.uuid4().hex[:8].upper()}",
        price=Decimal("10.00"),
        stock=Decimal("20.000"),
        cost_price=Decimal("6.00"),
        is_active=True,
        is_service=False,
        is_combo=False,
        has_imei=False,
    )
    tenant_db.add(product)
    tenant_db.flush()

    stock = ProductStock(
        product_id=product.id,
        warehouse_id=warehouse_a.id,
        quantity=Decimal("20.000"),
    )
    tenant_db.add(stock)
    tenant_db.flush()

    return product, stock


# ---------------------------------------------------------------------------
# Helpers — replican la lógica del endpoint /inventory/add
# (sin WebSocket ni db.commit(), para funcionar en test-transaction)
# ---------------------------------------------------------------------------

def _add_stock(db, product, warehouse_id, quantity, movement_type=MovementType.ADJUSTMENT_IN, reason="Test entry"):
    """
    Replica la lógica de `add_stock` del router inventory.py.
    No llama db.commit() para que el rollback del test funcione.
    """
    # Actualizar ProductStock
    product_stock = db.query(ProductStock).filter_by(
        product_id=product.id,
        warehouse_id=warehouse_id,
    ).first()

    if not product_stock:
        product_stock = ProductStock(
            product_id=product.id,
            warehouse_id=warehouse_id,
            quantity=Decimal("0.000"),
        )
        db.add(product_stock)

    product_stock.quantity += Decimal(str(quantity))

    # Actualizar stock global (caché)
    product.stock += Decimal(str(quantity))

    # Crear entrada Kardex
    kardex = Kardex(
        product_id=product.id,
        warehouse_id=warehouse_id,
        movement_type=movement_type,
        quantity=Decimal(str(quantity)),
        balance_after=product.stock,
        description=reason,
        date=datetime.now(),
    )
    db.add(kardex)
    db.flush()

    return product_stock, kardex


# ---------------------------------------------------------------------------
# F07 — Entrada de stock actualiza Kardex
# ---------------------------------------------------------------------------

class TestF07EntradaStock:

    def test_add_stock_actualiza_product_stock(
        self, tenant_db, test_product_with_stock, warehouse_a
    ):
        """
        F07a: Al agregar 50 unidades, ProductStock[warehouse_a] debe pasar de 20 a 70.
        """
        product, stock_record = test_product_with_stock
        stock_antes = stock_record.quantity  # 20.000

        _add_stock(tenant_db, product, warehouse_a.id, 50)

        tenant_db.refresh(stock_record)
        assert stock_record.quantity == stock_antes + Decimal("50.000"), (
            f"Stock en bodega debería ser {stock_antes + 50}, es {stock_record.quantity}"
        )

    def test_add_stock_actualiza_stock_global(
        self, tenant_db, test_product_with_stock, warehouse_a
    ):
        """
        F07b: El campo Product.stock (caché global) también debe actualizarse.
        """
        product, _ = test_product_with_stock
        stock_global_antes = product.stock  # 20.000

        _add_stock(tenant_db, product, warehouse_a.id, 30)

        tenant_db.refresh(product)
        assert product.stock == stock_global_antes + Decimal("30.000"), (
            f"Stock global debería ser {stock_global_antes + 30}, es {product.stock}"
        )

    def test_add_stock_crea_entrada_kardex(
        self, tenant_db, test_product_with_stock, warehouse_a
    ):
        """
        F07c: La entrada de stock debe crear un movimiento Kardex con:
        - movement_type = ADJUSTMENT_IN (o PURCHASE)
        - quantity == cantidad agregada
        - balance_after == nuevo stock global
        """
        product, _ = test_product_with_stock
        kardex_antes = tenant_db.query(Kardex).filter_by(product_id=product.id).count()

        _, kardex = _add_stock(tenant_db, product, warehouse_a.id, 50, MovementType.ADJUSTMENT_IN)

        kardex_despues = tenant_db.query(Kardex).filter_by(product_id=product.id).count()
        assert kardex_despues == kardex_antes + 1, \
            "La entrada de stock no generó movimiento Kardex"

        assert kardex.movement_type == MovementType.ADJUSTMENT_IN
        assert kardex.quantity == Decimal("50.000")
        assert kardex.balance_after == Decimal("70.000")  # 20 + 50

    def test_add_stock_balance_after_correcto(
        self, tenant_db, test_product_with_stock, warehouse_a
    ):
        """
        F07d: El balance_after del Kardex debe ser exactamente el stock después de la entrada.
        """
        product, _ = test_product_with_stock
        stock_esperado = product.stock + Decimal("15.000")  # 20 + 15 = 35

        _, kardex = _add_stock(tenant_db, product, warehouse_a.id, 15)

        assert kardex.balance_after == stock_esperado, (
            f"balance_after={kardex.balance_after}, esperado={stock_esperado}"
        )


# ---------------------------------------------------------------------------
# F14 — Entrada en warehouse específico no afecta otros
# ---------------------------------------------------------------------------

class TestF14StockWarehouseEspecifico:

    def test_entrada_solo_afecta_warehouse_destino(
        self, tenant_db, test_product_with_stock, warehouse_a, warehouse_b
    ):
        """
        F14a: Al agregar stock en warehouse_b, el stock de warehouse_a no debe cambiar.
        """
        product, stock_a = test_product_with_stock
        stock_a_antes = stock_a.quantity  # 20.000

        # Agregar stock en warehouse_b (nuevo, sin stock previo)
        _add_stock(tenant_db, product, warehouse_b.id, 40)

        # warehouse_a debe quedar igual
        tenant_db.refresh(stock_a)
        assert stock_a.quantity == stock_a_antes, (
            f"warehouse_a se modificó cuando no debería: "
            f"antes={stock_a_antes}, después={stock_a.quantity}"
        )

        # warehouse_b debe tener 40
        stock_b = tenant_db.query(ProductStock).filter_by(
            product_id=product.id,
            warehouse_id=warehouse_b.id,
        ).first()
        assert stock_b is not None, "No se creó ProductStock para warehouse_b"
        assert stock_b.quantity == Decimal("40.000"), (
            f"warehouse_b debería tener 40, tiene {stock_b.quantity}"
        )

    def test_stock_global_acumula_todos_los_warehouses(
        self, tenant_db, test_product_with_stock, warehouse_a, warehouse_b
    ):
        """
        F14b: Product.stock debe reflejar la suma de TODOS los warehouses.
        Después de tener 20 en A y agregar 30 en B, el global debe ser 50.
        """
        product, _ = test_product_with_stock
        # product.stock starts at 20 (only warehouse_a)

        _add_stock(tenant_db, product, warehouse_b.id, 30)

        tenant_db.refresh(product)
        assert product.stock == Decimal("50.000"), (
            f"Stock global debería ser 50 (20+30), es {product.stock}"
        )
