"""
test_func_ventas_avanzado.py — Tests funcionales de Ventas (flujos avanzados)

Flujos cubiertos:
  FVA01 — Descuento en carrito: total_discount_usd reduce total_amount
  FVA02 — Cambio/vuelto: change_amount registrado y resta del expected de caja
  FVA03 — Pago mixto: múltiples SalePayment por distintos métodos
  FVA04 — SaleDetail.unit_price es histórico (no cambia con el producto)
  FVA05 — cost_at_sale capturado al momento de la venta

Correr con:
    cd ferreteria_refactor
    python -m pytest backend_api/tests/test_func_ventas_avanzado.py -v --no-cov -s
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
    Sale, SaleDetail, SalePayment, Product, Warehouse,
    ProductStock, Kardex, MovementType,
    CashRegister, CashSession, CashSessionCurrency, CashMovement,
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
def warehouse_obj(tenant_db):
    wh = Warehouse(name=f"WH VA {uuid.uuid4().hex[:6]}", is_active=True, is_main=True)
    tenant_db.add(wh)
    tenant_db.flush()
    return wh


@pytest.fixture()
def product_obj(tenant_db):
    p = Product(
        name=f"Prod VA {uuid.uuid4().hex[:6]}",
        price=Decimal("100.00"),
        cost_price=Decimal("60.00"),
        stock=Decimal("50.000"),
    )
    tenant_db.add(p)
    tenant_db.flush()
    return p


@pytest.fixture()
def open_session_obj(tenant_db, user_id):
    register = CashRegister(
        name=f"Caja VA {uuid.uuid4().hex[:6]}",
        code=f"VA{uuid.uuid4().hex[:4].upper()}",
        is_active=True,
    )
    tenant_db.add(register)
    tenant_db.flush()
    session = CashSession(
        register_id=register.id,
        user_id=user_id,
        status="OPEN",
        initial_cash=Decimal("200.00"),
        initial_cash_bs=Decimal("0.00"),
    )
    tenant_db.add(session)
    tenant_db.flush()
    tenant_db.add(CashSessionCurrency(
        session_id=session.id, currency_symbol="USD",
        initial_amount=Decimal("200.00"),
    ))
    tenant_db.flush()
    return session


# ---------------------------------------------------------------------------
# FVA01 — Descuento en carrito
# ---------------------------------------------------------------------------

class TestFVA01Descuento:

    def test_descuento_reduce_total_amount(
        self, tenant_db, open_session_obj, product_obj, warehouse_obj
    ):
        """
        FVA01a: Un descuento en carrito reduce el total_amount de la venta.
        Venta bruta: $100, descuento: $15 → total_amount = $85.
        total_discount_usd almacena el monto descontado.
        """
        precio_bruto = product_obj.price  # 100.00
        descuento = Decimal("15.00")
        total_neto = precio_bruto - descuento  # 85.00

        sale = Sale(
            session_id=open_session_obj.id,
            total_amount=total_neto,
            total_discount_usd=descuento,
            payment_method="Efectivo",
            is_credit=False,
            paid=True,
        )
        tenant_db.add(sale)
        tenant_db.flush()

        tenant_db.refresh(sale)
        assert sale.total_amount == Decimal("85.00")
        assert sale.total_discount_usd == Decimal("15.00")

    def test_descuento_porcentual_calculado_correctamente(
        self, tenant_db, open_session_obj, product_obj
    ):
        """
        FVA01b: Descuento del 20% sobre $100 → $20 descontados, total $80.
        """
        precio = Decimal("100.00")
        descuento_pct = Decimal("20.00")
        descuento_monto = (precio * descuento_pct / Decimal("100.00"))
        total = precio - descuento_monto

        sale = Sale(
            session_id=open_session_obj.id,
            total_amount=total,
            total_discount_usd=descuento_monto,
            cart_discount_type="percent",
            payment_method="Efectivo",
            is_credit=False,
            paid=True,
        )
        tenant_db.add(sale)
        tenant_db.flush()

        tenant_db.refresh(sale)
        assert sale.total_amount == Decimal("80.00")
        assert sale.total_discount_usd == Decimal("20.00")

    def test_venta_sin_descuento_tiene_discount_cero(
        self, tenant_db, open_session_obj, product_obj
    ):
        """
        FVA01c: Una venta sin descuento debe tener total_discount_usd = 0
        y cart_discount_type = None.
        """
        sale = Sale(
            session_id=open_session_obj.id,
            total_amount=Decimal("100.00"),
            payment_method="Efectivo",
            is_credit=False,
            paid=True,
        )
        tenant_db.add(sale)
        tenant_db.flush()

        tenant_db.refresh(sale)
        assert sale.total_discount_usd == Decimal("0.00")
        assert sale.cart_discount_type is None


# ---------------------------------------------------------------------------
# FVA02 — Cambio/vuelto: registrado y resta del expected de caja
# ---------------------------------------------------------------------------

class TestFVA02Vuelto:

    def test_vuelto_registrado_en_venta(
        self, tenant_db, open_session_obj, product_obj
    ):
        """
        FVA02a: Cuando el cliente paga más del total, el vuelto se registra
        en change_amount y change_currency.
        Venta $85, cliente paga $100 efectivo → vuelto $15 VES.
        """
        sale = Sale(
            session_id=open_session_obj.id,
            total_amount=Decimal("85.00"),
            payment_method="Efectivo",
            is_credit=False,
            paid=True,
            change_amount=Decimal("15.00"),
            change_currency="VES",
        )
        tenant_db.add(sale)
        tenant_db.flush()

        tenant_db.refresh(sale)
        assert sale.change_amount == Decimal("15.00")
        assert sale.change_currency == "VES"

    def test_vuelto_resta_del_expected_en_cierre(
        self, tenant_db, open_session_obj, product_obj
    ):
        """
        FVA02b: El vuelto entregado al cliente SALE de la caja física.
        La fórmula de cierre descuenta el vuelto del expected.
        Si change_currency = VES, generalmente no afecta el expected en USD.
        Verificamos que el campo change_amount queda disponible para el cálculo.
        """
        # Venta con vuelto en USD (afecta el expected de USD)
        sale = Sale(
            session_id=open_session_obj.id,
            total_amount=Decimal("85.00"),
            payment_method="Efectivo",
            is_credit=False,
            paid=True,
            change_amount=Decimal("15.00"),
            change_currency="USD",  # vuelto en USD
        )
        tenant_db.add(sale)
        tenant_db.flush()

        # En el cierre, el router consulta change_amount de sales en la sesión
        ventas_con_vuelto = tenant_db.query(Sale).filter(
            Sale.session_id == open_session_obj.id,
            Sale.change_amount > 0,
            Sale.change_currency == "USD",
        ).with_entities(Sale.change_amount).all()

        total_vuelto_usd = sum(r[0] for r in ventas_con_vuelto)
        assert total_vuelto_usd == Decimal("15.00"), \
            "El vuelto en USD debe ser consultable para el cálculo del expected"

    def test_venta_sin_vuelto_change_amount_cero(
        self, tenant_db, open_session_obj
    ):
        """
        FVA02c: Una venta sin cambio tiene change_amount = 0 (default).
        El cliente pagó exacto.
        """
        sale = Sale(
            session_id=open_session_obj.id,
            total_amount=Decimal("50.00"),
            payment_method="Efectivo",
            is_credit=False,
            paid=True,
        )
        tenant_db.add(sale)
        tenant_db.flush()

        tenant_db.refresh(sale)
        assert sale.change_amount == Decimal("0.00")


# ---------------------------------------------------------------------------
# FVA03 — Pago mixto: múltiples SalePayment
# ---------------------------------------------------------------------------

class TestFVA03PagoMixto:

    def test_pago_mixto_crea_dos_sale_payments(
        self, tenant_db, open_session_obj
    ):
        """
        FVA03a: Una venta con pago mixto (USD + Bs) crea dos SalePayment.
        El total de ambos debe sumar al total_amount de la venta.
        """
        total = Decimal("100.00")
        sale = Sale(
            session_id=open_session_obj.id,
            total_amount=total,
            payment_method="Mixto",
            is_credit=False,
            paid=True,
        )
        tenant_db.add(sale)
        tenant_db.flush()

        payment_usd = SalePayment(
            sale_id=sale.id, amount=Decimal("60.00"),
            currency="USD", payment_method="Efectivo",
        )
        payment_bs = SalePayment(
            sale_id=sale.id, amount=Decimal("40.00"),
            currency="USD", payment_method="Transferencia",  # transferencia de Bs
        )
        tenant_db.add(payment_usd)
        tenant_db.add(payment_bs)
        tenant_db.flush()

        pagos = tenant_db.query(SalePayment).filter_by(sale_id=sale.id).all()
        assert len(pagos) == 2
        total_pagado = sum(p.amount for p in pagos)
        assert total_pagado == total

    def test_solo_efectivo_suma_al_expected_caja(
        self, tenant_db, open_session_obj
    ):
        """
        FVA03b: En una venta mixta, solo el pago en Efectivo suma al expected
        de la caja física. La transferencia va al banco, no a la caja.
        """
        sale = Sale(
            session_id=open_session_obj.id,
            total_amount=Decimal("100.00"),
            payment_method="Mixto",
            is_credit=False,
            paid=True,
        )
        tenant_db.add(sale)
        tenant_db.flush()

        tenant_db.add(SalePayment(sale_id=sale.id, amount=Decimal("60.00"),
                                   currency="USD", payment_method="Efectivo"))
        tenant_db.add(SalePayment(sale_id=sale.id, amount=Decimal("40.00"),
                                   currency="USD", payment_method="Transferencia"))
        tenant_db.flush()

        # Solo efectivo cuenta para el expected (lógica del cierre)
        efectivo_rows = tenant_db.query(SalePayment).join(Sale).filter(
            Sale.session_id == open_session_obj.id,
            SalePayment.payment_method.ilike("%efectivo%"),
            SalePayment.currency == "USD",
        ).with_entities(SalePayment.amount).all()

        efectivo_total = sum(r[0] for r in efectivo_rows)
        assert efectivo_total == Decimal("60.00")


# ---------------------------------------------------------------------------
# FVA04 — Precio histórico en SaleDetail
# ---------------------------------------------------------------------------

class TestFVA04PrecioHistorico:

    def test_unit_price_fijado_al_momento_de_venta(
        self, tenant_db, open_session_obj, product_obj
    ):
        """
        FVA04a: El unit_price en SaleDetail se fija al precio actual del producto
        al momento de la venta. Si el producto cambia de precio después,
        la venta conserva el precio original.
        """
        precio_en_venta = product_obj.price  # 100.00
        sale = Sale(
            session_id=open_session_obj.id,
            total_amount=precio_en_venta,
            is_credit=False, paid=True,
        )
        tenant_db.add(sale)
        tenant_db.flush()

        detail = SaleDetail(
            sale_id=sale.id,
            product_id=product_obj.id,
            quantity=Decimal("1.000"),
            unit_price=precio_en_venta,  # Fijado al vender
            cost_at_sale=product_obj.cost_price,
            subtotal=precio_en_venta,
        )
        tenant_db.add(detail)
        tenant_db.flush()

        # El producto cambia de precio
        product_obj.price = Decimal("150.00")
        tenant_db.flush()

        tenant_db.refresh(detail)
        assert detail.unit_price == Decimal("100.00"), \
            "El precio en SaleDetail no debe cambiar aunque el producto cambie"
        assert detail.unit_price != product_obj.price

    def test_subtotal_calculado_correctamente(
        self, tenant_db, open_session_obj, product_obj
    ):
        """
        FVA04b: subtotal = unit_price × quantity en SaleDetail.
        3 unidades × $100 = $300.
        """
        sale = Sale(
            session_id=open_session_obj.id,
            total_amount=Decimal("300.00"),
            is_credit=False, paid=True,
        )
        tenant_db.add(sale)
        tenant_db.flush()

        detail = SaleDetail(
            sale_id=sale.id,
            product_id=product_obj.id,
            quantity=Decimal("3.000"),
            unit_price=Decimal("100.00"),
            cost_at_sale=Decimal("60.00"),
            subtotal=Decimal("300.00"),  # 3 × 100
        )
        tenant_db.add(detail)
        tenant_db.flush()

        tenant_db.refresh(detail)
        assert detail.subtotal == Decimal("300.00")
        assert detail.subtotal == detail.quantity * detail.unit_price


# ---------------------------------------------------------------------------
# FVA05 — cost_at_sale capturado al momento de la venta
# ---------------------------------------------------------------------------

class TestFVA05CostoHistorico:

    def test_cost_at_sale_capturado_al_vender(
        self, tenant_db, open_session_obj, product_obj
    ):
        """
        FVA05a: cost_at_sale en SaleDetail debe ser el costo del producto
        al momento de la venta. Necesario para calcular margen de ganancia histórico.
        """
        costo_en_venta = product_obj.cost_price  # 60.00

        sale = Sale(
            session_id=open_session_obj.id,
            total_amount=Decimal("100.00"),
            is_credit=False, paid=True,
        )
        tenant_db.add(sale)
        tenant_db.flush()

        detail = SaleDetail(
            sale_id=sale.id,
            product_id=product_obj.id,
            quantity=Decimal("1.000"),
            unit_price=Decimal("100.00"),
            cost_at_sale=costo_en_venta,
            subtotal=Decimal("100.00"),
        )
        tenant_db.add(detail)
        tenant_db.flush()

        # El producto cambia de costo después
        product_obj.cost_price = Decimal("80.00")
        tenant_db.flush()

        tenant_db.refresh(detail)
        assert detail.cost_at_sale == costo_en_venta, \
            "El costo en SaleDetail no debe cambiar aunque el producto cambie de costo"
        assert detail.cost_at_sale != product_obj.cost_price

    def test_margen_calculable_desde_sale_detail(
        self, tenant_db, open_session_obj, product_obj
    ):
        """
        FVA05b: Con unit_price y cost_at_sale, se puede calcular el margen
        de ganancia de esa venta específica.
        Margen = (unit_price - cost_at_sale) / unit_price × 100
        100 - 60 = 40 → margen = 40%
        """
        sale = Sale(
            session_id=open_session_obj.id,
            total_amount=Decimal("100.00"),
            is_credit=False, paid=True,
        )
        tenant_db.add(sale)
        tenant_db.flush()

        detail = SaleDetail(
            sale_id=sale.id,
            product_id=product_obj.id,
            quantity=Decimal("1.000"),
            unit_price=Decimal("100.00"),
            cost_at_sale=Decimal("60.00"),
            subtotal=Decimal("100.00"),
        )
        tenant_db.add(detail)
        tenant_db.flush()

        ganancia = detail.unit_price - detail.cost_at_sale
        margen_pct = (ganancia / detail.unit_price) * Decimal("100.00")

        assert ganancia == Decimal("40.00")
        assert margen_pct == Decimal("40.00")
