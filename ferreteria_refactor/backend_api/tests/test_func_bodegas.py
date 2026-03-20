"""
test_func_bodegas.py — Tests funcionales de Bodegas/Almacenes

Flujos cubiertos:
  FBD01 — CRUD: crear, nombre único, defaults
  FBD02 — is_main exclusivo: solo una bodega principal a la vez
  FBD03 — Soft/hard delete: bloqueado si hay stock activo
  FBD04 — ProductStock: vínculo producto-bodega

Correr con:
    cd ferreteria_refactor
    python -m pytest backend_api/tests/test_func_bodegas.py -v --no-cov -s
"""

import pytest
import uuid
from decimal import Decimal

import sys, os
_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _root not in sys.path:
    sys.path.insert(0, _root)

from sqlalchemy.exc import IntegrityError
from backend_api.models.models import Product, ProductStock, Warehouse

TENANT = "lalicoreria"


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def tenant_db(pg_db_for_schema):
    return pg_db_for_schema(TENANT)


@pytest.fixture()
def warehouse_obj(tenant_db):
    wh = Warehouse(
        name=f"Bodega Test {uuid.uuid4().hex[:8]}",
        is_active=True,
        is_main=False,
    )
    tenant_db.add(wh)
    tenant_db.flush()
    return wh


@pytest.fixture()
def product_obj(tenant_db):
    p = Product(
        name=f"Prod Bodega {uuid.uuid4().hex[:6]}",
        price=Decimal("10.00"),
        cost_price=Decimal("6.00"),
        stock=Decimal("0.000"),
    )
    tenant_db.add(p)
    tenant_db.flush()
    return p


def _set_as_main(db, warehouse):
    """Replica la lógica del router: pone todos los demás is_main=False, luego este=True."""
    db.query(Warehouse).filter(Warehouse.id != warehouse.id).update({"is_main": False})
    warehouse.is_main = True
    db.flush()


# ---------------------------------------------------------------------------
# FBD01 — CRUD básico
# ---------------------------------------------------------------------------

class TestFBD01CRUD:

    def test_crear_bodega_campos_persisten(self, tenant_db):
        """FBD01a: Crear bodega con todos los campos — persiste correctamente."""
        wh = Warehouse(
            name=f"Bodega Full {uuid.uuid4().hex[:8]}",
            address="Calle 5, Local 3",
            is_active=True,
            is_main=False,
        )
        tenant_db.add(wh)
        tenant_db.flush()

        tenant_db.refresh(wh)
        assert wh.id is not None
        assert wh.address == "Calle 5, Local 3"
        assert wh.is_active is True
        assert wh.is_main is False

    def test_nombre_unico_integrity_error(self, tenant_db, warehouse_obj):
        """FBD01b: Dos bodegas con el mismo nombre → IntegrityError."""
        duplicate = Warehouse(name=warehouse_obj.name, is_active=True)
        tenant_db.add(duplicate)
        with pytest.raises(IntegrityError):
            tenant_db.flush()

    def test_is_active_default_true(self, tenant_db):
        """FBD01c: is_active tiene default True si no se especifica."""
        wh = Warehouse(name=f"Bodega Def {uuid.uuid4().hex[:8]}")
        tenant_db.add(wh)
        tenant_db.flush()
        tenant_db.refresh(wh)
        assert wh.is_active is True

    def test_is_main_default_false(self, tenant_db):
        """FBD01d: is_main tiene default False si no se especifica."""
        wh = Warehouse(name=f"Bodega NM {uuid.uuid4().hex[:8]}")
        tenant_db.add(wh)
        tenant_db.flush()
        tenant_db.refresh(wh)
        assert wh.is_main is False


# ---------------------------------------------------------------------------
# FBD02 — is_main exclusivo
# ---------------------------------------------------------------------------

class TestFBD02IsMainExclusivo:

    def test_solo_una_bodega_principal(self, tenant_db):
        """FBD02a: Al marcar una bodega como principal, las demás pierden is_main."""
        wh_a = Warehouse(name=f"WH-A {uuid.uuid4().hex[:6]}", is_main=False)
        wh_b = Warehouse(name=f"WH-B {uuid.uuid4().hex[:6]}", is_main=False)
        tenant_db.add_all([wh_a, wh_b])
        tenant_db.flush()

        # Marcar A como principal
        _set_as_main(tenant_db, wh_a)
        tenant_db.refresh(wh_a)
        tenant_db.refresh(wh_b)
        assert wh_a.is_main is True
        # wh_b puede o no tener is_main (depende de estado previo de la BD, usamos solo los nuevos)

        # Marcar B como principal → A pierde is_main
        _set_as_main(tenant_db, wh_b)
        tenant_db.refresh(wh_a)
        tenant_db.refresh(wh_b)
        assert wh_b.is_main is True
        assert wh_a.is_main is False, "Al cambiar la principal, la anterior pierde is_main"

    def test_nueva_bodega_no_es_main_por_defecto(self, tenant_db):
        """FBD02b: Una bodega nueva no es la principal a menos que se indique explícitamente."""
        wh = Warehouse(name=f"WH-New {uuid.uuid4().hex[:6]}")
        tenant_db.add(wh)
        tenant_db.flush()
        assert wh.is_main is False


# ---------------------------------------------------------------------------
# FBD03 — Delete con validación de stock
# ---------------------------------------------------------------------------

class TestFBD03DeleteConStock:

    def test_delete_bloqueado_con_stock_activo(self, tenant_db, warehouse_obj, product_obj):
        """
        FBD03a: No se puede eliminar una bodega que tiene stock activo (quantity > 0).
        El router verifica esto antes de hacer el delete — simulamos la validación.
        """
        ps = ProductStock(
            product_id=product_obj.id,
            warehouse_id=warehouse_obj.id,
            quantity=Decimal("10.000"),
        )
        tenant_db.add(ps)
        tenant_db.flush()

        # Simular la validación del router
        tiene_stock = tenant_db.query(ProductStock).filter(
            ProductStock.warehouse_id == warehouse_obj.id,
            ProductStock.quantity > 0,
        ).count() > 0

        assert tiene_stock is True, "La bodega tiene stock activo — el router debe rechazar el delete"

    def test_delete_permitido_sin_stock(self, tenant_db, warehouse_obj, product_obj):
        """
        FBD03b: Se puede eliminar una bodega cuyo stock es 0 o no tiene registros.
        """
        # ProductStock en cero
        ps = ProductStock(
            product_id=product_obj.id,
            warehouse_id=warehouse_obj.id,
            quantity=Decimal("0.000"),
        )
        tenant_db.add(ps)
        tenant_db.flush()

        tiene_stock = tenant_db.query(ProductStock).filter(
            ProductStock.warehouse_id == warehouse_obj.id,
            ProductStock.quantity > 0,
        ).count() > 0

        assert tiene_stock is False, "Sin stock activo, el delete debe ser permitido"

    def test_delete_permitido_sin_product_stock(self, tenant_db, warehouse_obj):
        """FBD03c: Bodega sin ningún ProductStock asociado puede eliminarse."""
        tiene_stock = tenant_db.query(ProductStock).filter(
            ProductStock.warehouse_id == warehouse_obj.id,
            ProductStock.quantity > 0,
        ).count() > 0
        assert tiene_stock is False


# ---------------------------------------------------------------------------
# FBD04 — ProductStock y relación producto-bodega
# ---------------------------------------------------------------------------

class TestFBD04ProductStock:

    def test_product_stock_vincula_correctamente(self, tenant_db, warehouse_obj, product_obj):
        """FBD04a: ProductStock vincula producto y bodega correctamente."""
        ps = ProductStock(
            product_id=product_obj.id,
            warehouse_id=warehouse_obj.id,
            quantity=Decimal("25.000"),
        )
        tenant_db.add(ps)
        tenant_db.flush()

        tenant_db.refresh(ps)
        assert ps.product_id == product_obj.id
        assert ps.warehouse_id == warehouse_obj.id
        assert ps.quantity == Decimal("25.000")

    def test_stock_independiente_por_bodega(self, tenant_db, product_obj):
        """FBD04b: El stock de un producto es independiente entre bodegas."""
        wh1 = Warehouse(name=f"WH1 {uuid.uuid4().hex[:6]}")
        wh2 = Warehouse(name=f"WH2 {uuid.uuid4().hex[:6]}")
        tenant_db.add_all([wh1, wh2])
        tenant_db.flush()

        ps1 = ProductStock(product_id=product_obj.id, warehouse_id=wh1.id, quantity=Decimal("10.000"))
        ps2 = ProductStock(product_id=product_obj.id, warehouse_id=wh2.id, quantity=Decimal("30.000"))
        tenant_db.add_all([ps1, ps2])
        tenant_db.flush()

        tenant_db.refresh(ps1)
        tenant_db.refresh(ps2)
        assert ps1.quantity == Decimal("10.000")
        assert ps2.quantity == Decimal("30.000")
        # Stock global = suma de todas las bodegas
        assert ps1.quantity + ps2.quantity == Decimal("40.000")
