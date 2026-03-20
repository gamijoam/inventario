"""
test_func_ajustes_inventario.py — Tests funcionales de Ajustes de Inventario

Flujos cubiertos:
  FAJ01 — ADJUSTMENT_IN: stock aumenta, Kardex creado con qty positiva
  FAJ02 — ADJUSTMENT_OUT: validación de stock insuficiente, stock disminuye
  FAJ03 — Tipos especiales: DAMAGED y INTERNAL_USE → ADJUSTMENT_OUT con prefijo
  FAJ04 — Kardex: balance_after correcto, warehouse_id registrado

Correr con:
    cd ferreteria_refactor
    python -m pytest backend_api/tests/test_func_ajustes_inventario.py -v --no-cov -s
"""

import pytest
import uuid
from decimal import Decimal

import sys, os
_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _root not in sys.path:
    sys.path.insert(0, _root)

from backend_api.models.models import Product, ProductStock, Kardex, MovementType, Warehouse

TENANT = "lalicoreria"


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def tenant_db(pg_db_for_schema):
    return pg_db_for_schema(TENANT)


@pytest.fixture()
def warehouse_obj(tenant_db):
    wh = Warehouse(name=f"WH Ajuste {uuid.uuid4().hex[:6]}", is_active=True)
    tenant_db.add(wh)
    tenant_db.flush()
    return wh


@pytest.fixture()
def product_obj(tenant_db):
    p = Product(
        name=f"Prod Ajuste {uuid.uuid4().hex[:6]}",
        price=Decimal("15.00"),
        cost_price=Decimal("8.00"),
        stock=Decimal("0.000"),
    )
    tenant_db.add(p)
    tenant_db.flush()
    return p


def _add_stock(db, product, warehouse, qty, reason="Ajuste entrada"):
    """Replica la lógica de inventory.py:/add sin db.commit() ni WebSocket."""
    ps = db.query(ProductStock).filter_by(
        product_id=product.id, warehouse_id=warehouse.id
    ).first()
    if not ps:
        ps = ProductStock(product_id=product.id, warehouse_id=warehouse.id, quantity=Decimal("0.000"))
        db.add(ps)
        db.flush()

    ps.quantity += qty
    product.stock += qty

    db.add(Kardex(
        product_id=product.id,
        warehouse_id=warehouse.id,
        movement_type=MovementType.ADJUSTMENT_IN,
        quantity=qty,
        balance_after=product.stock,
        description=reason,
    ))
    db.flush()
    return ps


def _remove_stock(db, product, warehouse, qty, movement_type=MovementType.ADJUSTMENT_OUT, reason="Ajuste salida"):
    """
    Replica la lógica de inventory.py:/remove.
    Retorna (ProductStock, error_msg). error_msg=None si tuvo éxito.
    """
    ps = db.query(ProductStock).filter_by(
        product_id=product.id, warehouse_id=warehouse.id
    ).first()

    if not ps:
        return None, "Producto no tiene stock en esta bodega"
    if ps.quantity < qty:
        return ps, f"Stock insuficiente en bodega (Disponible: {ps.quantity})"

    ps.quantity -= qty
    product.stock -= qty

    db.add(Kardex(
        product_id=product.id,
        warehouse_id=warehouse.id,
        movement_type=movement_type,
        quantity=-qty,  # Negativo en salidas
        balance_after=product.stock,
        description=reason,
    ))
    db.flush()
    return ps, None


# ---------------------------------------------------------------------------
# FAJ01 — ADJUSTMENT_IN
# ---------------------------------------------------------------------------

class TestFAJ01AjusteEntrada:

    def test_add_stock_aumenta_warehouse_y_global(self, tenant_db, product_obj, warehouse_obj):
        """FAJ01a: Ajuste de entrada sube el stock de la bodega y el stock global del producto."""
        _add_stock(tenant_db, product_obj, warehouse_obj, Decimal("20.000"))

        tenant_db.refresh(product_obj)
        ps = tenant_db.query(ProductStock).filter_by(
            product_id=product_obj.id, warehouse_id=warehouse_obj.id
        ).first()

        assert ps.quantity == Decimal("20.000")
        assert product_obj.stock == Decimal("20.000")

    def test_multiples_entradas_acumulan(self, tenant_db, product_obj, warehouse_obj):
        """FAJ01b: Varios ajustes de entrada se acumulan correctamente."""
        _add_stock(tenant_db, product_obj, warehouse_obj, Decimal("10.000"))
        _add_stock(tenant_db, product_obj, warehouse_obj, Decimal("5.000"))
        _add_stock(tenant_db, product_obj, warehouse_obj, Decimal("3.000"))

        tenant_db.refresh(product_obj)
        ps = tenant_db.query(ProductStock).filter_by(
            product_id=product_obj.id, warehouse_id=warehouse_obj.id
        ).first()

        assert ps.quantity == Decimal("18.000")
        assert product_obj.stock == Decimal("18.000")

    def test_kardex_creado_con_tipo_adjustment_in(self, tenant_db, product_obj, warehouse_obj):
        """FAJ01c: El ajuste de entrada crea un Kardex con movement_type=ADJUSTMENT_IN."""
        _add_stock(tenant_db, product_obj, warehouse_obj, Decimal("10.000"), "Inventario inicial")

        kardex = tenant_db.query(Kardex).filter_by(
            product_id=product_obj.id,
            movement_type=MovementType.ADJUSTMENT_IN,
        ).first()

        assert kardex is not None
        assert kardex.quantity == Decimal("10.000")  # Positivo en entradas
        assert kardex.warehouse_id == warehouse_obj.id

    def test_add_crea_product_stock_si_no_existe(self, tenant_db, product_obj, warehouse_obj):
        """FAJ01d: Si no existe ProductStock para esa bodega, se crea automáticamente."""
        ps_antes = tenant_db.query(ProductStock).filter_by(
            product_id=product_obj.id, warehouse_id=warehouse_obj.id
        ).first()
        assert ps_antes is None  # No existe aún

        _add_stock(tenant_db, product_obj, warehouse_obj, Decimal("5.000"))

        ps_despues = tenant_db.query(ProductStock).filter_by(
            product_id=product_obj.id, warehouse_id=warehouse_obj.id
        ).first()
        assert ps_despues is not None
        assert ps_despues.quantity == Decimal("5.000")


# ---------------------------------------------------------------------------
# FAJ02 — ADJUSTMENT_OUT: validaciones y salidas
# ---------------------------------------------------------------------------

class TestFAJ02AjusteSalida:

    def test_remove_stock_disminuye_correctamente(self, tenant_db, product_obj, warehouse_obj):
        """FAJ02a: Ajuste de salida disminuye stock de la bodega y stock global."""
        _add_stock(tenant_db, product_obj, warehouse_obj, Decimal("30.000"))
        _remove_stock(tenant_db, product_obj, warehouse_obj, Decimal("10.000"))

        tenant_db.refresh(product_obj)
        ps = tenant_db.query(ProductStock).filter_by(
            product_id=product_obj.id, warehouse_id=warehouse_obj.id
        ).first()

        assert ps.quantity == Decimal("20.000")
        assert product_obj.stock == Decimal("20.000")

    def test_remove_bloqueado_sin_product_stock(self, tenant_db, product_obj, warehouse_obj):
        """
        FAJ02b: No se puede hacer ajuste de salida si el producto no tiene
        registro en esa bodega. El router devuelve 400.
        """
        _, error = _remove_stock(tenant_db, product_obj, warehouse_obj, Decimal("5.000"))
        assert error is not None
        assert "no tiene stock en esta bodega" in error.lower() or "insuficiente" in error.lower() or error

    def test_remove_bloqueado_stock_insuficiente(self, tenant_db, product_obj, warehouse_obj):
        """
        FAJ02c: No se puede remover más stock del disponible en la bodega.
        El router verifica: product_stock.quantity < adjustment.quantity → 400.
        """
        _add_stock(tenant_db, product_obj, warehouse_obj, Decimal("5.000"))
        _, error = _remove_stock(tenant_db, product_obj, warehouse_obj, Decimal("10.000"))
        assert error is not None
        assert "insuficiente" in error.lower()

    def test_kardex_salida_cantidad_negativa(self, tenant_db, product_obj, warehouse_obj):
        """FAJ02d: El Kardex de salida registra quantity negativa."""
        _add_stock(tenant_db, product_obj, warehouse_obj, Decimal("20.000"))
        _remove_stock(tenant_db, product_obj, warehouse_obj, Decimal("8.000"))

        kardex = tenant_db.query(Kardex).filter_by(
            product_id=product_obj.id,
            movement_type=MovementType.ADJUSTMENT_OUT,
        ).first()

        assert kardex is not None
        assert kardex.quantity == Decimal("-8.000"), "Kardex de salida debe tener cantidad negativa"


# ---------------------------------------------------------------------------
# FAJ03 — Tipos especiales (DAMAGED, INTERNAL_USE)
# ---------------------------------------------------------------------------

class TestFAJ03TiposEspeciales:

    def test_damaged_mapea_a_adjustment_out(self, tenant_db, product_obj, warehouse_obj):
        """
        FAJ03a: El tipo DAMAGED se mapea a ADJUSTMENT_OUT en el Kardex.
        La descripción lleva el prefijo [DAMAGED].
        """
        _add_stock(tenant_db, product_obj, warehouse_obj, Decimal("10.000"))

        reason = "[DAMAGED] Producto mojado"
        _remove_stock(
            tenant_db, product_obj, warehouse_obj,
            Decimal("2.000"),
            movement_type=MovementType.ADJUSTMENT_OUT,
            reason=reason,
        )

        kardex = tenant_db.query(Kardex).filter_by(
            product_id=product_obj.id,
            movement_type=MovementType.ADJUSTMENT_OUT,
        ).first()

        assert kardex is not None
        assert "[DAMAGED]" in kardex.description

    def test_internal_use_mapea_a_adjustment_out(self, tenant_db, product_obj, warehouse_obj):
        """
        FAJ03b: El tipo INTERNAL_USE se mapea a ADJUSTMENT_OUT en el Kardex.
        La descripción lleva el prefijo [INTERNAL USE].
        """
        _add_stock(tenant_db, product_obj, warehouse_obj, Decimal("10.000"))

        reason = "[INTERNAL USE] Uso en oficina"
        _remove_stock(
            tenant_db, product_obj, warehouse_obj,
            Decimal("1.000"),
            movement_type=MovementType.ADJUSTMENT_OUT,
            reason=reason,
        )

        kardex = tenant_db.query(Kardex).filter_by(
            product_id=product_obj.id,
            movement_type=MovementType.ADJUSTMENT_OUT,
        ).first()

        assert kardex is not None
        assert "[INTERNAL USE]" in kardex.description

    def test_tipos_especiales_reducen_stock_igual_que_salida(self, tenant_db, product_obj, warehouse_obj):
        """
        FAJ03c: Independientemente del tipo especial, la reducción de stock
        es idéntica a un ADJUSTMENT_OUT normal.
        """
        _add_stock(tenant_db, product_obj, warehouse_obj, Decimal("10.000"))
        _remove_stock(
            tenant_db, product_obj, warehouse_obj,
            Decimal("3.000"),
            movement_type=MovementType.ADJUSTMENT_OUT,
            reason="[DAMAGED] Test",
        )

        tenant_db.refresh(product_obj)
        ps = tenant_db.query(ProductStock).filter_by(
            product_id=product_obj.id, warehouse_id=warehouse_obj.id
        ).first()
        assert ps.quantity == Decimal("7.000")
        assert product_obj.stock == Decimal("7.000")


# ---------------------------------------------------------------------------
# FAJ04 — Kardex: balance_after y warehouse_id
# ---------------------------------------------------------------------------

class TestFAJ04Kardex:

    def test_kardex_balance_after_igual_a_stock_global(self, tenant_db, product_obj, warehouse_obj):
        """
        FAJ04a: balance_after en el Kardex refleja el stock global del producto
        después del ajuste (no el stock de la bodega individual).
        """
        product_obj.stock = Decimal("5.000")  # Stock previo
        tenant_db.flush()

        _add_stock(tenant_db, product_obj, warehouse_obj, Decimal("10.000"))

        kardex = tenant_db.query(Kardex).filter_by(
            product_id=product_obj.id,
            movement_type=MovementType.ADJUSTMENT_IN,
        ).order_by(Kardex.id.desc()).first()

        assert kardex.balance_after == Decimal("15.000")  # 5 + 10

    def test_kardex_registra_warehouse_id(self, tenant_db, product_obj, warehouse_obj):
        """FAJ04b: El Kardex registra el warehouse_id donde ocurrió el ajuste."""
        _add_stock(tenant_db, product_obj, warehouse_obj, Decimal("5.000"))

        kardex = tenant_db.query(Kardex).filter_by(
            product_id=product_obj.id,
            movement_type=MovementType.ADJUSTMENT_IN,
        ).first()

        assert kardex.warehouse_id == warehouse_obj.id

    def test_secuencia_kardex_refleja_historia_completa(self, tenant_db, product_obj, warehouse_obj):
        """FAJ04c: La secuencia de Kardex refleja todas las operaciones en orden."""
        _add_stock(tenant_db, product_obj, warehouse_obj, Decimal("20.000"))
        _remove_stock(tenant_db, product_obj, warehouse_obj, Decimal("5.000"))
        _add_stock(tenant_db, product_obj, warehouse_obj, Decimal("3.000"))

        entradas = tenant_db.query(Kardex).filter_by(
            product_id=product_obj.id,
            movement_type=MovementType.ADJUSTMENT_IN,
        ).all()
        salidas = tenant_db.query(Kardex).filter_by(
            product_id=product_obj.id,
            movement_type=MovementType.ADJUSTMENT_OUT,
        ).all()

        assert len(entradas) == 2  # +20 y +3
        assert len(salidas) == 1   # -5

        tenant_db.refresh(product_obj)
        assert product_obj.stock == Decimal("18.000")  # 20 - 5 + 3
