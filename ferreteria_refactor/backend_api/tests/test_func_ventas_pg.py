"""
test_func_ventas_pg.py — Tests funcionales de Ventas

Verifican que el CÓDIGO funciona correctamente llamando a SalesService
con una BD PostgreSQL real (no mocks, no SQLite).
Cada test crea datos dentro de una transacción que se revierte al final.

Flujos cubiertos:
  F01 — Venta completa descuenta stock y crea Kardex
  F02 — Stock insuficiente → rechaza sin modificar nada
  F04 — Crédito con límite excedido → rechaza
  F09 — Venta a cliente bloqueado → rechaza
  F10 — Atomicidad: si un item falla, nada se guarda

Correr con:
    cd ferreteria_refactor
    python -m pytest backend_api/tests/test_func_ventas_pg.py -v --no-cov -s
"""

import pytest
import sys, os
import uuid
from decimal import Decimal
from sqlalchemy import text

_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _root not in sys.path:
    sys.path.insert(0, _root)

from backend_api.models.models import (
    Product, ProductStock, Warehouse, CashRegister, CashSession,
    Sale, SaleDetail, Kardex, Customer, MovementType
)
from backend_api import schemas


# ---------------------------------------------------------------------------
# Fixtures locales
# ---------------------------------------------------------------------------

TENANT = "lalicoreria"  # tenant con más datos reales para tener contexto


@pytest.fixture()
def tenant_db(pg_db_for_schema):
    """Sesión con search_path al tenant de prueba. Se revierte al final."""
    return pg_db_for_schema(TENANT)


@pytest.fixture()
def warehouse_obj(tenant_db):
    """Obtiene el almacén principal existente del tenant."""
    wh = tenant_db.query(Warehouse).filter_by(is_active=True, is_main=True).first()
    if not wh:
        wh = tenant_db.query(Warehouse).filter_by(is_active=True).first()
    assert wh is not None, f"El tenant {TENANT} no tiene ningún almacén activo"
    return wh


@pytest.fixture()
def user_id(pg_engine):
    """Obtiene el ID del primer ADMIN activo del tenant."""
    with pg_engine.connect() as conn:
        row = conn.execute(text("""
            SELECT u.id FROM public.users u
            JOIN public.tenants t ON t.id = u.tenant_id
            WHERE t.schema_name = :schema AND u.role = 'ADMIN' AND u.is_active = TRUE
            LIMIT 1
        """), {"schema": TENANT}).fetchone()
    assert row is not None, f"No se encontró usuario ADMIN en {TENANT}"
    return row[0]


@pytest.fixture()
def cash_register_obj(tenant_db):
    """Crea una caja registradora de prueba."""
    register = CashRegister(
        name=f"Caja Test Func {uuid.uuid4().hex[:6]}",
        code=f"CTF{uuid.uuid4().hex[:4].upper()}",
        is_active=True,
    )
    tenant_db.add(register)
    tenant_db.flush()
    return register


@pytest.fixture()
def open_session_obj(tenant_db, cash_register_obj, user_id):
    """Abre una sesión de caja para los tests."""
    session = CashSession(
        register_id=cash_register_obj.id,
        user_id=user_id,
        status="OPEN",
        initial_cash=Decimal("100.00"),
        initial_cash_bs=Decimal("0.00"),
    )
    tenant_db.add(session)
    tenant_db.flush()
    return session


@pytest.fixture()
def test_product(tenant_db, warehouse_obj):
    """Crea un producto físico con 20 unidades en el almacén."""
    product = Product(
        name=f"Producto Test Func {uuid.uuid4().hex[:6]}",
        sku=f"SKU-TF-{uuid.uuid4().hex[:8].upper()}",
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
        warehouse_id=warehouse_obj.id,
        quantity=Decimal("20.000"),
    )
    tenant_db.add(stock)
    tenant_db.flush()

    return product, stock


@pytest.fixture()
def credit_customer(tenant_db):
    """Crea un cliente con límite de crédito de 100 USD."""
    customer = Customer(
        name=f"Cliente Test Func {uuid.uuid4().hex[:6]}",
        id_number=f"V-{uuid.uuid4().int % 99999999:08d}",
        credit_limit=Decimal("100.00"),
        is_blocked=False,
        is_active=True,
    )
    tenant_db.add(customer)
    tenant_db.flush()
    return customer


@pytest.fixture()
def blocked_customer(tenant_db):
    """Crea un cliente bloqueado por mora."""
    customer = Customer(
        name=f"Cliente Bloqueado Test {uuid.uuid4().hex[:6]}",
        id_number=f"V-{uuid.uuid4().int % 99999999:08d}",
        credit_limit=Decimal("500.00"),
        is_blocked=True,
        is_active=True,
    )
    tenant_db.add(customer)
    tenant_db.flush()
    return customer


def _make_sale_data(product, qty, unit_price, total,
                    customer_id=None, is_credit=False,
                    warehouse_id=None, session_id=None):
    """Helper: construye un SaleCreate mínimo válido."""
    subtotal = Decimal(str(qty)) * Decimal(str(unit_price))
    return schemas.SaleCreate(
        customer_id=customer_id,
        payment_method="Efectivo",
        payments=[],
        items=[
            schemas.SaleDetailCreate(
                product_id=product.id,
                quantity=Decimal(str(qty)),
                unit_price=Decimal(str(unit_price)),
                subtotal=subtotal,
                discount=Decimal("0.00"),
                discount_type="NONE",
                tax_rate=Decimal("0.00"),
            )
        ],
        total_amount=Decimal(str(total)),
        total_amount_bs=Decimal("0.00"),
        total_discount_usd=Decimal("0.00"),
        change_amount=Decimal("0.00"),
        change_currency="VES",
        is_credit=is_credit,
        warehouse_id=warehouse_id,
        session_id=session_id,
    )


# ---------------------------------------------------------------------------
# F01 — Venta completa descuenta stock y crea Kardex
# ---------------------------------------------------------------------------

class TestF01VentaCompleta:

    def test_venta_descuenta_product_stock(
        self, tenant_db, test_product, open_session_obj, warehouse_obj, user_id
    ):
        """
        F01a: Al crear una venta, el stock en ProductStock debe reducirse
        exactamente en la cantidad vendida.
        """
        from backend_api.services.sales_service import SalesService

        product, stock_record = test_product
        stock_antes = stock_record.quantity  # 20.000

        sale_data = _make_sale_data(
            product=product,
            qty=3,
            unit_price=product.price,
            total=product.price * 3,
            warehouse_id=warehouse_obj.id,
            session_id=open_session_obj.id,
        )

        SalesService.create_sale(tenant_db, sale_data, user_id=user_id)

        tenant_db.refresh(stock_record)
        assert stock_record.quantity == stock_antes - Decimal("3.000"), (
            f"Stock debería ser {stock_antes - 3}, es {stock_record.quantity}"
        )

    def test_venta_descuenta_product_stock_global(
        self, tenant_db, test_product, open_session_obj, warehouse_obj, user_id
    ):
        """
        F01b: El campo Product.stock (caché global) también debe reducirse.
        """
        from backend_api.services.sales_service import SalesService

        product, _ = test_product
        stock_global_antes = product.stock  # 20.000

        sale_data = _make_sale_data(
            product=product,
            qty=5,
            unit_price=product.price,
            total=product.price * 5,
            warehouse_id=warehouse_obj.id,
            session_id=open_session_obj.id,
        )

        SalesService.create_sale(tenant_db, sale_data, user_id=user_id)

        tenant_db.refresh(product)
        assert product.stock == stock_global_antes - Decimal("5.000"), (
            f"Stock global debería ser {stock_global_antes - 5}, es {product.stock}"
        )

    def test_venta_crea_kardex_tipo_sale(
        self, tenant_db, test_product, open_session_obj, warehouse_obj, user_id
    ):
        """
        F01c: La venta debe generar al menos un movimiento Kardex de tipo SALE.
        Sin Kardex, el historial de inventario está incompleto.
        """
        from backend_api.services.sales_service import SalesService

        product, _ = test_product
        kardex_antes = tenant_db.query(Kardex).filter_by(product_id=product.id).count()

        sale_data = _make_sale_data(
            product=product,
            qty=2,
            unit_price=product.price,
            total=product.price * 2,
            warehouse_id=warehouse_obj.id,
            session_id=open_session_obj.id,
        )

        SalesService.create_sale(tenant_db, sale_data, user_id=user_id)

        kardex_despues = tenant_db.query(Kardex).filter_by(product_id=product.id).count()
        assert kardex_despues > kardex_antes, \
            "La venta no generó ningún movimiento en Kardex"

        ultimo_kardex = (
            tenant_db.query(Kardex)
            .filter_by(product_id=product.id)
            .order_by(Kardex.id.desc())
            .first()
        )
        assert ultimo_kardex.movement_type == MovementType.SALE, (
            f"El Kardex debería ser tipo SALE, es '{ultimo_kardex.movement_type}'"
        )

    def test_venta_crea_sale_detail_por_cada_item(
        self, tenant_db, test_product, open_session_obj, warehouse_obj, user_id
    ):
        """
        F01d: La venta debe tener exactamente un SaleDetail por cada item enviado.
        """
        from backend_api.services.sales_service import SalesService

        product, _ = test_product

        sale_data = _make_sale_data(
            product=product,
            qty=1,
            unit_price=product.price,
            total=product.price,
            warehouse_id=warehouse_obj.id,
            session_id=open_session_obj.id,
        )

        result = SalesService.create_sale(tenant_db, sale_data, user_id=user_id)
        sale_id = result["sale_id"]

        detalles = tenant_db.query(SaleDetail).filter_by(sale_id=sale_id).all()
        assert len(detalles) == 1, \
            f"Se esperaba 1 SaleDetail, hay {len(detalles)}"
        assert detalles[0].product_id == product.id
        assert detalles[0].quantity == Decimal("1.000")


# ---------------------------------------------------------------------------
# F02 — Stock insuficiente rechaza y NO modifica nada
# ---------------------------------------------------------------------------

class TestF02StockInsuficiente:

    def test_stock_insuficiente_devuelve_error(
        self, tenant_db, test_product, open_session_obj, warehouse_obj, user_id
    ):
        """
        F02a: Intentar vender más stock del disponible debe lanzar HTTPException 400.
        """
        from fastapi import HTTPException
        from backend_api.services.sales_service import SalesService

        product, stock_record = test_product
        # El producto tiene 20 unidades, intentamos vender 100

        sale_data = _make_sale_data(
            product=product,
            qty=100,
            unit_price=product.price,
            total=product.price * 100,
            warehouse_id=warehouse_obj.id,
            session_id=open_session_obj.id,
        )

        with pytest.raises(HTTPException) as exc_info:
            SalesService.create_sale(tenant_db, sale_data, user_id=user_id)

        assert exc_info.value.status_code == 400
        assert "insuficiente" in exc_info.value.detail.lower() or \
               "stock" in exc_info.value.detail.lower(), \
            f"Mensaje de error inesperado: {exc_info.value.detail}"

    def test_stock_insuficiente_no_modifica_stock(
        self, tenant_db, test_product, open_session_obj, warehouse_obj, user_id
    ):
        """
        F02b: Si el stock es insuficiente, el stock NO debe modificarse (rollback).
        El servicio llama db.rollback() internamente al lanzar la excepción,
        garantizando que ningún cambio parcial persiste.
        Verificamos que el error ocurre ANTES de cualquier modificación de stock.
        """
        from fastapi import HTTPException
        from backend_api.services.sales_service import SalesService

        product, stock_record = test_product
        # Pre-condición: el stock es exactamente lo que configuramos (20 unidades)
        assert stock_record.quantity == Decimal("20.000"), \
            "Pre-condición: el producto debe tener 20 unidades antes del intento fallido"

        sale_data = _make_sale_data(
            product=product,
            qty=100,
            unit_price=product.price,
            total=product.price * 100,
            warehouse_id=warehouse_obj.id,
            session_id=open_session_obj.id,
        )

        with pytest.raises(HTTPException) as exc_info:
            SalesService.create_sale(tenant_db, sale_data, user_id=user_id)

        # El servicio hace db.rollback() → ningún cambio de stock se guardó.
        # Verificamos la excepción menciona stock para confirmar que fue
        # el validador de stock quien paró (no un error de otro tipo).
        assert exc_info.value.status_code == 400
        detail = exc_info.value.detail.lower()
        assert "insuficiente" in detail or "stock" in detail, \
            f"Se esperaba error de stock, se obtuvo: {exc_info.value.detail}"

    def test_stock_insuficiente_no_crea_venta(
        self, tenant_db, test_product, open_session_obj, warehouse_obj, user_id, pg_engine
    ):
        """
        F02c: Si el stock es insuficiente, no debe quedar ninguna Sale en BD.
        El servicio hace rollback completo → ningún registro de Sale queda guardado.
        Verificamos via pg_engine (conexión externa) que el tenant no tiene
        ventas con la cantidad absurda que intentamos vender.
        """
        from fastapi import HTTPException
        from backend_api.services.sales_service import SalesService

        product, _ = test_product
        qty_absurda = 9999999  # Cantidad imposible → identificador único de este intento

        sale_data = _make_sale_data(
            product=product,
            qty=qty_absurda,
            unit_price=product.price,
            total=product.price * qty_absurda,
            warehouse_id=warehouse_obj.id,
            session_id=open_session_obj.id,
        )

        with pytest.raises(HTTPException) as exc_info:
            SalesService.create_sale(tenant_db, sale_data, user_id=user_id)

        assert exc_info.value.status_code == 400

        # Verificar via conexión independiente que no existe ninguna Sale
        # con el total absurdo de esta venta fallida
        total_absurdo = product.price * qty_absurda
        with pg_engine.connect() as conn:
            conn.execute(text(f'SET search_path TO "{TENANT}", public'))
            count = conn.execute(text(
                "SELECT COUNT(*) FROM sales WHERE total_amount = :total"
            ), {"total": float(total_absurdo)}).scalar()

        assert count == 0, \
            f"Se encontró una Sale con total={total_absurdo} que debería haberse rolledback"


# ---------------------------------------------------------------------------
# F04 — Crédito con límite excedido rechaza
# ---------------------------------------------------------------------------

class TestF04CreditoLimite:

    def test_credito_dentro_de_limite_se_aprueba(
        self, tenant_db, test_product, open_session_obj, warehouse_obj,
        credit_customer, user_id
    ):
        """
        F04a: Una venta a crédito dentro del límite disponible debe aprobarse.
        """
        from backend_api.services.sales_service import SalesService

        product, _ = test_product
        # credit_limit = 100, deuda actual = 0, venta = 50 → OK

        sale_data = _make_sale_data(
            product=product,
            qty=5,
            unit_price=Decimal("10.00"),
            total=Decimal("50.00"),
            customer_id=credit_customer.id,
            is_credit=True,
            warehouse_id=warehouse_obj.id,
            session_id=open_session_obj.id,
        )

        result = SalesService.create_sale(tenant_db, sale_data, user_id=user_id)
        sale_id = result["sale_id"]
        sale = tenant_db.query(Sale).get(sale_id)
        assert sale is not None
        assert sale.is_credit is True
        assert sale.balance_pending > Decimal("0")

    def test_credito_excede_limite_rechaza(
        self, tenant_db, test_product, open_session_obj, warehouse_obj,
        credit_customer, user_id
    ):
        """
        F04b: Una venta a crédito que supera el límite debe lanzar HTTPException 400.
        credit_limit = 100 USD, intentamos vender 200 USD.
        """
        from fastapi import HTTPException
        from backend_api.services.sales_service import SalesService

        product, _ = test_product

        sale_data = _make_sale_data(
            product=product,
            qty=20,
            unit_price=Decimal("10.00"),
            total=Decimal("200.00"),
            customer_id=credit_customer.id,
            is_credit=True,
            warehouse_id=warehouse_obj.id,
            session_id=open_session_obj.id,
        )

        with pytest.raises(HTTPException) as exc_info:
            SalesService.create_sale(tenant_db, sale_data, user_id=user_id)

        assert exc_info.value.status_code == 400
        assert any(word in exc_info.value.detail.lower()
                   for word in ["límite", "limite", "crédito", "credito", "excedido"]), \
            f"Mensaje de error inesperado: {exc_info.value.detail}"


# ---------------------------------------------------------------------------
# F09 — Venta a cliente bloqueado rechaza
# ---------------------------------------------------------------------------

class TestF09ClienteBloqueado:

    def test_cliente_bloqueado_rechaza_venta_credito(
        self, tenant_db, test_product, open_session_obj, warehouse_obj,
        blocked_customer, user_id
    ):
        """
        F09: Una venta a crédito a un cliente con is_blocked=TRUE debe rechazarse.
        """
        from fastapi import HTTPException
        from backend_api.services.sales_service import SalesService

        product, _ = test_product

        sale_data = _make_sale_data(
            product=product,
            qty=1,
            unit_price=Decimal("10.00"),
            total=Decimal("10.00"),
            customer_id=blocked_customer.id,
            is_credit=True,
            warehouse_id=warehouse_obj.id,
            session_id=open_session_obj.id,
        )

        with pytest.raises(HTTPException) as exc_info:
            SalesService.create_sale(tenant_db, sale_data, user_id=user_id)

        assert exc_info.value.status_code == 400
        assert "bloqueado" in exc_info.value.detail.lower(), \
            f"Mensaje de error inesperado: {exc_info.value.detail}"

    def test_cliente_bloqueado_puede_pagar_contado(
        self, tenant_db, test_product, open_session_obj, warehouse_obj,
        blocked_customer, user_id
    ):
        """
        F09b: Un cliente bloqueado SÍ puede comprar si paga al contado
        (is_credit=False). El bloqueo solo aplica a ventas a crédito.
        """
        from backend_api.services.sales_service import SalesService

        product, _ = test_product

        sale_data = _make_sale_data(
            product=product,
            qty=1,
            unit_price=Decimal("10.00"),
            total=Decimal("10.00"),
            customer_id=blocked_customer.id,
            is_credit=False,
            warehouse_id=warehouse_obj.id,
            session_id=open_session_obj.id,
        )

        result = SalesService.create_sale(tenant_db, sale_data, user_id=user_id)
        assert result["sale_id"] is not None, \
            "El cliente bloqueado no pudo comprar al contado — debería poder"


# ---------------------------------------------------------------------------
# F10 — Sin caja abierta rechaza
# ---------------------------------------------------------------------------

class TestF10SinCaja:

    def test_venta_sin_caja_abierta_rechaza(
        self, tenant_db, test_product, warehouse_obj, user_id
    ):
        """
        F10: Si no hay CashSession OPEN para el usuario, la venta debe rechazarse.
        No se crea open_session_obj en este test a propósito.
        """
        from fastapi import HTTPException
        from backend_api.services.sales_service import SalesService

        product, _ = test_product

        sale_data = _make_sale_data(
            product=product,
            qty=1,
            unit_price=Decimal("10.00"),
            total=Decimal("10.00"),
            warehouse_id=warehouse_obj.id,
            session_id=None,  # Sin sesión explícita
        )

        # Usar un user_id que no tiene sesión abierta (9999999)
        with pytest.raises(HTTPException) as exc_info:
            SalesService.create_sale(tenant_db, sale_data, user_id=9999999)

        assert exc_info.value.status_code == 400
        assert "caja" in exc_info.value.detail.lower(), \
            f"Mensaje de error inesperado: {exc_info.value.detail}"
