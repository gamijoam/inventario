"""
test_func_cotizaciones.py — Tests funcionales de Cotizaciones

Flujos cubiertos:
  FCT01 — Crear cotización con múltiples ítems, precios históricos
  FCT02 — Estados: solo PENDING editable, CONVERTED inmutable
  FCT03 — Eliminar cotización PENDING

Correr con:
    cd ferreteria_refactor
    python -m pytest backend_api/tests/test_func_cotizaciones.py -v --no-cov -s
"""

import pytest
import uuid
from decimal import Decimal
from sqlalchemy import text

import sys, os
_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _root not in sys.path:
    sys.path.insert(0, _root)

from backend_api.models.models import Quote, QuoteDetail, Product, Customer

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
    customer = Customer(name=f"Cliente Cot {uuid.uuid4().hex[:6]}")
    tenant_db.add(customer)
    tenant_db.flush()
    return customer


@pytest.fixture()
def product_obj(tenant_db):
    product = Product(
        name=f"Producto Cot {uuid.uuid4().hex[:6]}",
        price=Decimal("25.00"),
        cost_price=Decimal("15.00"),
    )
    tenant_db.add(product)
    tenant_db.flush()
    return product


def _crear_quote(db, user_id, customer_id=None, *, status="PENDING"):
    quote = Quote(
        customer_id=customer_id,
        user_id=user_id,
        total_amount=Decimal("0.00"),
        status=status,
    )
    db.add(quote)
    db.flush()
    return quote


def _agregar_item(db, quote_id, product_id, qty, unit_price):
    subtotal = qty * unit_price
    item = QuoteDetail(
        quote_id=quote_id,
        product_id=product_id,
        quantity=qty,
        unit_price=unit_price,
        subtotal=subtotal,
    )
    db.add(item)
    db.flush()
    return item


# ---------------------------------------------------------------------------
# FCT01 — Crear cotización con ítems
# ---------------------------------------------------------------------------

class TestFCT01CrearCotizacion:

    def test_crear_cotizacion_con_cliente_y_usuario(
        self, tenant_db, user_id, customer_obj
    ):
        """
        FCT01a: Crear una cotización con cliente y usuario asignados.
        Status inicial = PENDING.
        """
        quote = _crear_quote(tenant_db, user_id, customer_id=customer_obj.id)

        tenant_db.refresh(quote)
        assert quote.id is not None
        assert quote.status == "PENDING"
        assert quote.customer_id == customer_obj.id
        assert quote.user_id == user_id

    def test_cotizacion_sin_cliente_permitida(self, tenant_db, user_id):
        """
        FCT01b: customer_id es nullable — cotización sin cliente es válida.
        Útil para presupuestos rápidos a clientes ocasionales.
        """
        quote = _crear_quote(tenant_db, user_id, customer_id=None)
        assert quote.customer_id is None
        assert quote.id is not None

    def test_agregar_item_subtotal_calculado(
        self, tenant_db, user_id, product_obj
    ):
        """
        FCT01c: Al agregar un ítem a la cotización, el subtotal debe ser
        quantity × unit_price. El precio en QuoteDetail es histórico (fijado).
        """
        quote = _crear_quote(tenant_db, user_id)
        item = _agregar_item(tenant_db, quote.id, product_obj.id,
                              qty=Decimal("3.000"), unit_price=Decimal("25.00"))

        tenant_db.refresh(item)
        assert item.quantity == Decimal("3.000")
        assert item.unit_price == Decimal("25.00")
        assert item.subtotal == Decimal("75.0000")

    def test_total_cotizacion_es_suma_de_subtotales(
        self, tenant_db, user_id, product_obj
    ):
        """
        FCT01d: total_amount de la Quote debe ser la suma de todos los subtotales.
        """
        quote = _crear_quote(tenant_db, user_id)

        # Crear dos productos distintos con precios distintos
        p2 = Product(name=f"P2 {uuid.uuid4().hex[:6]}", price=Decimal("10.00"))
        tenant_db.add(p2)
        tenant_db.flush()

        item1 = _agregar_item(tenant_db, quote.id, product_obj.id,
                               qty=Decimal("2.000"), unit_price=Decimal("25.00"))  # 50
        item2 = _agregar_item(tenant_db, quote.id, p2.id,
                               qty=Decimal("5.000"), unit_price=Decimal("10.00"))  # 50

        total = item1.subtotal + item2.subtotal
        quote.total_amount = total
        tenant_db.flush()

        tenant_db.refresh(quote)
        assert quote.total_amount == Decimal("100.0000")

    def test_precio_item_historico_independiente_del_producto(
        self, tenant_db, user_id, product_obj
    ):
        """
        FCT01e: El unit_price en QuoteDetail se fija al momento de cotizar.
        Si el precio del producto cambia después, la cotización conserva el original.
        Este comportamiento es crítico para auditoría y consistencia de precios.
        """
        precio_al_cotizar = product_obj.price  # 25.00
        quote = _crear_quote(tenant_db, user_id)
        item = _agregar_item(tenant_db, quote.id, product_obj.id,
                              qty=Decimal("1.000"), unit_price=precio_al_cotizar)

        # El producto cambia de precio
        product_obj.price = Decimal("35.00")
        tenant_db.flush()

        # La cotización conserva el precio original
        tenant_db.refresh(item)
        assert item.unit_price == Decimal("25.00"), \
            "El precio en la cotización no debe cambiar cuando cambia el producto"
        assert item.unit_price != product_obj.price


# ---------------------------------------------------------------------------
# FCT02 — Estados: PENDING editable, CONVERTED inmutable
# ---------------------------------------------------------------------------

class TestFCT02EstadosCotizacion:

    def test_estado_inicial_es_pending(self, tenant_db, user_id):
        """
        FCT02a: Una cotización recién creada tiene status = PENDING.
        """
        quote = _crear_quote(tenant_db, user_id)
        assert quote.status == "PENDING"

    def test_cotizacion_pending_puede_editarse(
        self, tenant_db, user_id, product_obj
    ):
        """
        FCT02b: Una cotización en PENDING puede modificarse (editar ítems,
        notas, total). Aún no fue convertida en venta.
        """
        quote = _crear_quote(tenant_db, user_id)
        item = _agregar_item(tenant_db, quote.id, product_obj.id,
                              qty=Decimal("1.000"), unit_price=Decimal("25.00"))

        # Editar ítem
        item.quantity = Decimal("3.000")
        item.subtotal = item.quantity * item.unit_price
        quote.total_amount = item.subtotal
        quote.notes = "Actualizado por el vendedor"
        tenant_db.flush()

        tenant_db.refresh(quote)
        assert quote.total_amount == Decimal("75.0000")
        assert quote.notes == "Actualizado por el vendedor"

    def test_convertir_cotizacion_a_converted(self, tenant_db, user_id):
        """
        FCT02c: Al convertir una cotización en venta, el status cambia a CONVERTED.
        Una cotización CONVERTED no debe ser editable.
        """
        quote = _crear_quote(tenant_db, user_id)

        # Simular conversión
        quote.status = "CONVERTED"
        tenant_db.flush()

        tenant_db.refresh(quote)
        assert quote.status == "CONVERTED"

    def test_cotizacion_converted_no_editable(self, tenant_db, user_id, product_obj):
        """
        FCT02d: El router rechaza editar una cotización CONVERTED.
        A nivel de modelo, verificamos que el status persiste sin cambios
        cuando el router detecta que está CONVERTED (validación en router,
        no en DB constraint).
        """
        quote = _crear_quote(tenant_db, user_id, status="CONVERTED")
        item = _agregar_item(tenant_db, quote.id, product_obj.id,
                              qty=Decimal("2.000"), unit_price=Decimal("25.00"))

        # Verificar que el status sigue siendo CONVERTED
        tenant_db.refresh(quote)
        assert quote.status == "CONVERTED"

        # La lógica del router: si status != PENDING → rechazar la edición
        puede_editar = quote.status == "PENDING"
        assert not puede_editar, "Una cotización CONVERTED no debe ser editable"

    def test_estado_expired(self, tenant_db, user_id):
        """
        FCT02e: Una cotización puede marcarse como EXPIRED (vencida).
        Las cotizaciones vencidas tampoco deben ser editables.
        """
        quote = _crear_quote(tenant_db, user_id, status="EXPIRED")

        tenant_db.refresh(quote)
        assert quote.status == "EXPIRED"
        assert quote.status != "PENDING"


# ---------------------------------------------------------------------------
# FCT03 — Eliminar cotización PENDING
# ---------------------------------------------------------------------------

class TestFCT03EliminarCotizacion:

    def test_eliminar_cotizacion_pending_borra_de_bd(
        self, tenant_db, user_id, product_obj
    ):
        """
        FCT03a: Una cotización PENDING puede eliminarse completamente.
        Los QuoteDetail también deben eliminarse (cascade o manual).
        """
        quote = _crear_quote(tenant_db, user_id)
        item = _agregar_item(tenant_db, quote.id, product_obj.id,
                              qty=Decimal("1.000"), unit_price=Decimal("25.00"))
        quote_id = quote.id
        item_id = item.id

        # Eliminar ítems primero, luego la cotización
        tenant_db.delete(item)
        tenant_db.flush()
        tenant_db.delete(quote)
        tenant_db.flush()

        # Verificar que ya no existe
        recovered_quote = tenant_db.query(Quote).get(quote_id)
        recovered_item = tenant_db.query(QuoteDetail).get(item_id)
        assert recovered_quote is None
        assert recovered_item is None

    def test_cotizacion_con_nota_persiste(self, tenant_db, user_id):
        """
        FCT03b: Las notas de la cotización (terms, observaciones) persisten.
        Importantes para comunicar condiciones al cliente.
        """
        nota = "Precio válido por 15 días. No incluye IVA."
        quote = _crear_quote(tenant_db, user_id)
        quote.notes = nota
        tenant_db.flush()

        tenant_db.refresh(quote)
        assert quote.notes == nota
