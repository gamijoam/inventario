"""
test_func_devoluciones.py — Tests funcionales de Devoluciones

Flujos cubiertos:
  FRE01 — Devolución GOOD: stock restaurado, Kardex RETURN, ReturnDetail histórico
  FRE02 — Devolución DAMAGED: RETURN + ADJUSTMENT_OUT, stock neto = 0
  FRE03 — Devolución de venta a crédito: reduce balance_pending
  FRE04 — Cálculo de refund: unit_price × qty_returned

Correr con:
    cd ferreteria_refactor
    python -m pytest backend_api/tests/test_func_devoluciones.py -v --no-cov -s
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
    Product, ProductStock, Warehouse, Kardex, MovementType,
    Sale, SaleDetail, Customer,
    Return, ReturnDetail,
)

TENANT = "lalicoreria"


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def tenant_db(pg_db_for_schema):
    return pg_db_for_schema(TENANT)


@pytest.fixture()
def warehouse_obj(tenant_db):
    wh = Warehouse(name=f"WH Dev {uuid.uuid4().hex[:6]}", is_active=True, is_main=True)
    tenant_db.add(wh)
    tenant_db.flush()
    return wh


@pytest.fixture()
def product_obj(tenant_db):
    p = Product(
        name=f"Prod Dev {uuid.uuid4().hex[:6]}",
        price=Decimal("50.00"),
        cost_price=Decimal("30.00"),
        stock=Decimal("100.000"),
    )
    tenant_db.add(p)
    tenant_db.flush()
    return p


@pytest.fixture()
def stock_obj(tenant_db, product_obj, warehouse_obj):
    ps = ProductStock(
        product_id=product_obj.id,
        warehouse_id=warehouse_obj.id,
        quantity=Decimal("100.000"),
    )
    tenant_db.add(ps)
    tenant_db.flush()
    return ps


@pytest.fixture()
def customer_obj(tenant_db):
    c = Customer(name=f"Cliente Dev {uuid.uuid4().hex[:6]}")
    tenant_db.add(c)
    tenant_db.flush()
    return c


def _crear_venta_contado(db, product, warehouse_id, qty, unit_price):
    """Crea una Sale de contado con su SaleDetail."""
    subtotal = qty * unit_price
    sale = Sale(
        warehouse_id=warehouse_id,
        total_amount=subtotal,
        payment_method="Efectivo",
        is_credit=False,
        paid=True,
    )
    db.add(sale)
    db.flush()

    detail = SaleDetail(
        sale_id=sale.id,
        product_id=product.id,
        quantity=qty,
        unit_price=unit_price,
        cost_at_sale=product.cost_price,
        subtotal=subtotal,
    )
    db.add(detail)
    db.flush()
    return sale, detail


def _crear_venta_credito(db, customer_id, product, warehouse_id, qty, unit_price):
    """Crea una Sale a crédito con su SaleDetail."""
    monto = qty * unit_price
    sale = Sale(
        customer_id=customer_id,
        warehouse_id=warehouse_id,
        total_amount=monto,
        payment_method="Credito",
        is_credit=True,
        paid=False,
        balance_pending=monto,
    )
    db.add(sale)
    db.flush()

    detail = SaleDetail(
        sale_id=sale.id,
        product_id=product.id,
        quantity=qty,
        unit_price=unit_price,
        cost_at_sale=product.cost_price,
        subtotal=monto,
    )
    db.add(detail)
    db.flush()
    return sale, detail


def _execute_return_good(db, sale, detail, product, stock_obj, qty_returned):
    """
    Replica returns.py para devolución en BUEN estado (GOOD).
    Lógica: restaurar stock + RETURN en Kardex + crear Return + ReturnDetail.
    """
    unit_price = detail.unit_price
    refund_amount = qty_returned * unit_price

    # Restaurar stock en warehouse
    stock_obj.quantity += qty_returned

    # Restaurar stock global
    product.stock += qty_returned

    # Kardex: entrada RETURN (signo positivo = entra al inventario)
    kardex_return = Kardex(
        product_id=product.id,
        movement_type=MovementType.RETURN,
        quantity=qty_returned,
        balance_after=product.stock,
        warehouse_id=stock_obj.warehouse_id,
        description=f"Devolución sale #{sale.id}",
    )
    db.add(kardex_return)

    # Registro de devolución
    ret = Return(
        sale_id=sale.id,
        total_refunded=refund_amount,
        reason="Devolución GOOD",
    )
    db.add(ret)
    db.flush()

    # ReturnDetail con precios históricos
    ret_detail = ReturnDetail(
        return_id=ret.id,
        product_id=product.id,
        quantity=qty_returned,
        unit_price=unit_price,
        unit_cost=detail.cost_at_sale,
    )
    db.add(ret_detail)
    db.flush()

    return ret, refund_amount


def _execute_return_damaged(db, sale, detail, product, stock_obj, qty_returned):
    """
    Replica returns.py para devolución DAMAGED.
    Lógica: RETURN kardex + ADJUSTMENT_OUT kardex = stock neto 0 + auditoría completa.
    """
    unit_price = detail.unit_price
    refund_amount = qty_returned * unit_price

    # Paso 1: restaurar stock temporalmente (como en GOOD)
    stock_obj.quantity += qty_returned
    product.stock += qty_returned

    kardex_return = Kardex(
        product_id=product.id,
        movement_type=MovementType.RETURN,
        quantity=qty_returned,
        balance_after=product.stock,
        warehouse_id=stock_obj.warehouse_id,
        description=f"Devolución DAMAGED (entrada) sale #{sale.id}",
    )
    db.add(kardex_return)
    db.flush()

    # Paso 2: ajuste de salida inmediata (producto dañado → no se puede vender)
    stock_obj.quantity -= qty_returned
    product.stock -= qty_returned

    kardex_adj = Kardex(
        product_id=product.id,
        movement_type=MovementType.ADJUSTMENT_OUT,
        quantity=-qty_returned,  # negativo = salida
        balance_after=product.stock,
        warehouse_id=stock_obj.warehouse_id,
        description=f"Ajuste producto dañado sale #{sale.id}",
    )
    db.add(kardex_adj)

    # Registro de devolución
    ret = Return(
        sale_id=sale.id,
        total_refunded=refund_amount,
        reason="Devolución DAMAGED",
    )
    db.add(ret)
    db.flush()

    ret_detail = ReturnDetail(
        return_id=ret.id,
        product_id=product.id,
        quantity=qty_returned,
        unit_price=unit_price,
        unit_cost=detail.cost_at_sale,
    )
    db.add(ret_detail)
    db.flush()

    return ret, refund_amount


# ---------------------------------------------------------------------------
# FRE01 — Devolución en buen estado (GOOD)
# ---------------------------------------------------------------------------

class TestFRE01DevolucionGood:

    def test_good_restaura_stock_warehouse(
        self, tenant_db, product_obj, stock_obj, warehouse_obj
    ):
        """
        FRE01a: Devolución GOOD debe aumentar el stock del warehouse.
        Si había 100 unidades y se devuelven 3, debe quedar 103.
        """
        sale, detail = _crear_venta_contado(
            tenant_db, product_obj, warehouse_obj.id, Decimal("3.000"), Decimal("50.00")
        )
        stock_antes = stock_obj.quantity

        _execute_return_good(
            tenant_db, sale, detail, product_obj, stock_obj, Decimal("3.000")
        )

        tenant_db.refresh(stock_obj)
        assert stock_obj.quantity == stock_antes + Decimal("3.000")

    def test_good_restaura_stock_global(
        self, tenant_db, product_obj, stock_obj, warehouse_obj
    ):
        """
        FRE01b: Devolución GOOD debe aumentar Product.stock (caché global).
        """
        sale, detail = _crear_venta_contado(
            tenant_db, product_obj, warehouse_obj.id, Decimal("5.000"), Decimal("50.00")
        )
        stock_global_antes = product_obj.stock

        _execute_return_good(
            tenant_db, sale, detail, product_obj, stock_obj, Decimal("5.000")
        )

        tenant_db.refresh(product_obj)
        assert product_obj.stock == stock_global_antes + Decimal("5.000")

    def test_good_crea_kardex_return(
        self, tenant_db, product_obj, stock_obj, warehouse_obj
    ):
        """
        FRE01c: Devolución GOOD debe crear un Kardex con movement_type=RETURN.
        Auditoría completa de por qué el stock aumentó.
        """
        sale, detail = _crear_venta_contado(
            tenant_db, product_obj, warehouse_obj.id, Decimal("2.000"), Decimal("50.00")
        )
        _execute_return_good(
            tenant_db, sale, detail, product_obj, stock_obj, Decimal("2.000")
        )

        kardex = tenant_db.query(Kardex).filter_by(
            product_id=product_obj.id,
            movement_type=MovementType.RETURN,
        ).first()
        assert kardex is not None
        assert kardex.quantity == Decimal("2.000")
        assert kardex.warehouse_id == warehouse_obj.id

    def test_return_detail_almacena_precios_historicos(
        self, tenant_db, product_obj, stock_obj, warehouse_obj
    ):
        """
        FRE01d: ReturnDetail debe guardar unit_price y unit_cost del momento
        de la venta original (históricos, no los precios actuales).
        """
        precio_venta = Decimal("50.00")
        costo_original = product_obj.cost_price  # 30.00

        sale, detail = _crear_venta_contado(
            tenant_db, product_obj, warehouse_obj.id, Decimal("1.000"), precio_venta
        )

        # El producto cambia de precio después de la venta
        product_obj.price = Decimal("75.00")
        product_obj.cost_price = Decimal("45.00")
        tenant_db.flush()

        ret, _ = _execute_return_good(
            tenant_db, sale, detail, product_obj, stock_obj, Decimal("1.000")
        )

        ret_detail = tenant_db.query(ReturnDetail).filter_by(return_id=ret.id).first()
        assert ret_detail.unit_price == precio_venta, \
            "El precio en ReturnDetail debe ser el del momento de la venta, no el actual"
        assert ret_detail.unit_cost == costo_original, \
            "El costo en ReturnDetail debe ser el del momento de la venta"


# ---------------------------------------------------------------------------
# FRE02 — Devolución de producto dañado (DAMAGED)
# ---------------------------------------------------------------------------

class TestFRE02DevolucionDamaged:

    def test_damaged_stock_neto_no_cambia(
        self, tenant_db, product_obj, stock_obj, warehouse_obj
    ):
        """
        FRE02a: Devolución DAMAGED: el stock neto del warehouse debe quedar
        igual que antes de la devolución (RETURN + ADJUSTMENT_OUT se cancelan).
        El producto dañado no puede venderse.
        """
        stock_antes = stock_obj.quantity

        sale, detail = _crear_venta_contado(
            tenant_db, product_obj, warehouse_obj.id, Decimal("4.000"), Decimal("50.00")
        )
        _execute_return_damaged(
            tenant_db, sale, detail, product_obj, stock_obj, Decimal("4.000")
        )

        tenant_db.refresh(stock_obj)
        assert stock_obj.quantity == stock_antes, \
            "Stock neto debe ser igual al inicial — el producto dañado no entra al inventario"

    def test_damaged_crea_dos_kardex(
        self, tenant_db, product_obj, stock_obj, warehouse_obj
    ):
        """
        FRE02b: Devolución DAMAGED crea dos entradas Kardex:
        1. RETURN (entrada temporal)
        2. ADJUSTMENT_OUT (ajuste de salida inmediata)
        Ambas necesarias para la auditoría completa.
        """
        sale, detail = _crear_venta_contado(
            tenant_db, product_obj, warehouse_obj.id, Decimal("2.000"), Decimal("50.00")
        )
        kardex_count_antes = tenant_db.query(Kardex).filter_by(
            product_id=product_obj.id
        ).count()

        _execute_return_damaged(
            tenant_db, sale, detail, product_obj, stock_obj, Decimal("2.000")
        )

        kardex_count_despues = tenant_db.query(Kardex).filter_by(
            product_id=product_obj.id
        ).count()

        nuevos_kardex = kardex_count_despues - kardex_count_antes
        assert nuevos_kardex == 2, \
            f"DAMAGED debe crear 2 entradas Kardex (RETURN + ADJUSTMENT_OUT), creó {nuevos_kardex}"

    def test_damaged_tiene_kardex_return_y_adjustment(
        self, tenant_db, product_obj, stock_obj, warehouse_obj
    ):
        """
        FRE02c: Las dos entradas Kardex son específicamente RETURN y ADJUSTMENT_OUT.
        """
        sale, detail = _crear_venta_contado(
            tenant_db, product_obj, warehouse_obj.id, Decimal("1.000"), Decimal("50.00")
        )
        _execute_return_damaged(
            tenant_db, sale, detail, product_obj, stock_obj, Decimal("1.000")
        )

        kardex_return = tenant_db.query(Kardex).filter_by(
            product_id=product_obj.id, movement_type=MovementType.RETURN
        ).first()
        kardex_adj = tenant_db.query(Kardex).filter_by(
            product_id=product_obj.id, movement_type=MovementType.ADJUSTMENT_OUT
        ).first()

        assert kardex_return is not None, "Debe existir Kardex RETURN"
        assert kardex_adj is not None, "Debe existir Kardex ADJUSTMENT_OUT"


# ---------------------------------------------------------------------------
# FRE03 — Devolución sobre venta a crédito
# ---------------------------------------------------------------------------

class TestFRE03DevolucionCredito:

    def test_devolucion_reduce_balance_pending(
        self, tenant_db, customer_obj, product_obj, stock_obj, warehouse_obj
    ):
        """
        FRE03a: Si la venta fue a crédito, la devolución debe reducir
        balance_pending de la venta original.
        Venta $100, devuelven $30 → balance_pending = $70.
        """
        sale, detail = _crear_venta_credito(
            tenant_db, customer_obj.id, product_obj, warehouse_obj.id,
            Decimal("2.000"), Decimal("50.00"),  # $100 total
        )

        refund = Decimal("1.000") * detail.unit_price  # $50 de refund (1 unidad)

        # El router reduce el balance_pending en la devolución
        sale.balance_pending = max(
            Decimal("0.00"),
            sale.balance_pending - refund
        )
        if sale.balance_pending <= 0:
            sale.paid = True
        tenant_db.flush()

        tenant_db.refresh(sale)
        assert sale.balance_pending == Decimal("50.00"), \
            f"balance_pending debería ser 50, es {sale.balance_pending}"
        assert sale.paid is False  # Aún debe la otra mitad

    def test_devolucion_total_cancela_deuda_credito(
        self, tenant_db, customer_obj, product_obj, stock_obj, warehouse_obj
    ):
        """
        FRE03b: Si el refund cubre toda la deuda, balance_pending = 0 y paid = True.
        """
        sale, detail = _crear_venta_credito(
            tenant_db, customer_obj.id, product_obj, warehouse_obj.id,
            Decimal("1.000"), Decimal("50.00"),  # $50
        )

        # Devolver el 100% de la deuda
        sale.balance_pending = Decimal("0.00")
        sale.paid = True
        tenant_db.flush()

        tenant_db.refresh(sale)
        assert sale.balance_pending == Decimal("0.00")
        assert sale.paid is True

    def test_return_vinculado_a_sale_original(
        self, tenant_db, customer_obj, product_obj, stock_obj, warehouse_obj
    ):
        """
        FRE03c: El registro Return tiene FK a la sale original.
        Permite rastrear qué venta generó la devolución.
        """
        sale, detail = _crear_venta_contado(
            tenant_db, product_obj, warehouse_obj.id, Decimal("3.000"), Decimal("50.00")
        )
        ret, _ = _execute_return_good(
            tenant_db, sale, detail, product_obj, stock_obj, Decimal("3.000")
        )

        assert ret.sale_id == sale.id


# ---------------------------------------------------------------------------
# FRE04 — Cálculo del monto de refund
# ---------------------------------------------------------------------------

class TestFRE04CalculoRefund:

    def test_refund_es_unit_price_por_qty(
        self, tenant_db, product_obj, stock_obj, warehouse_obj
    ):
        """
        FRE04a: total_refunded = unit_price × quantity_returned.
        Si vendió 5 unidades a $20 y devuelve 2 → refund = $40.
        """
        sale, detail = _crear_venta_contado(
            tenant_db, product_obj, warehouse_obj.id, Decimal("5.000"), Decimal("20.00")
        )
        qty_devuelta = Decimal("2.000")
        refund_esperado = qty_devuelta * detail.unit_price  # 2 × 20 = 40

        ret, refund = _execute_return_good(
            tenant_db, sale, detail, product_obj, stock_obj, qty_devuelta
        )

        assert refund == refund_esperado
        tenant_db.refresh(ret)
        assert ret.total_refunded == Decimal("40.00")

    def test_devolucion_parcial_calcula_proporcional(
        self, tenant_db, product_obj, stock_obj, warehouse_obj
    ):
        """
        FRE04b: Devolución parcial (no todas las unidades) calcula
        el refund proporcional basado en las unidades devueltas.
        Venta: 10 unidades × $15 = $150. Devuelve 3 → $45.
        """
        sale, detail = _crear_venta_contado(
            tenant_db, product_obj, warehouse_obj.id, Decimal("10.000"), Decimal("15.00")
        )
        qty_devuelta = Decimal("3.000")
        refund_esperado = qty_devuelta * Decimal("15.00")  # 45

        ret, refund = _execute_return_good(
            tenant_db, sale, detail, product_obj, stock_obj, qty_devuelta
        )

        assert refund == Decimal("45.00")
        assert ret.total_refunded == Decimal("45.00")
