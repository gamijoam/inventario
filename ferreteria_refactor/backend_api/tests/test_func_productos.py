"""
test_func_productos.py — Tests funcionales de Productos

Flujos cubiertos:
  FPR01 — CRUD: crear, SKU único, campos opcionales, categoría
  FPR02 — Stock global = suma de ProductStock de todos los warehouses
  FPR03 — Búsqueda multi-token: AND lógico en nombre/SKU
  FPR04 — Tipos especiales: is_box, soft-delete (is_active)

Correr con:
    cd ferreteria_refactor
    python -m pytest backend_api/tests/test_func_productos.py -v --no-cov -s
"""

import pytest
import uuid
from decimal import Decimal
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

import sys, os
_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _root not in sys.path:
    sys.path.insert(0, _root)

from backend_api.models.models import Product, ProductStock, Warehouse, Category

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
        name=f"Almacén Test {uuid.uuid4().hex[:6]}",
        is_active=True,
        is_main=False,
    )
    tenant_db.add(wh)
    tenant_db.flush()
    return wh


@pytest.fixture()
def warehouse_b(tenant_db):
    wh = Warehouse(
        name=f"Almacén B {uuid.uuid4().hex[:6]}",
        is_active=True,
        is_main=False,
    )
    tenant_db.add(wh)
    tenant_db.flush()
    return wh


@pytest.fixture()
def category_obj(tenant_db):
    cat = Category(name=f"Cat Test {uuid.uuid4().hex[:6]}")
    tenant_db.add(cat)
    tenant_db.flush()
    return cat


def _producto(db, *, sku=None, precio=Decimal("10.00"), costo=Decimal("6.00"),
               categoria_id=None, is_box=False, is_active=True):
    p = Product(
        name=f"Prod {uuid.uuid4().hex[:8]}",
        sku=sku or f"SKU-{uuid.uuid4().hex[:8].upper()}",
        price=precio,
        cost_price=costo,
        stock=Decimal("0.000"),
        category_id=categoria_id,
        is_box=is_box,
        is_active=is_active,
    )
    db.add(p)
    db.flush()
    return p


def _stock(db, product_id, warehouse_id, qty):
    ps = ProductStock(product_id=product_id, warehouse_id=warehouse_id, quantity=qty)
    db.add(ps)
    db.flush()
    return ps


# ---------------------------------------------------------------------------
# FPR01 — CRUD de productos
# ---------------------------------------------------------------------------

class TestFPR01CRUDProducto:

    def test_crear_producto_campos_persisten(self, tenant_db, category_obj):
        """
        FPR01a: Crear un producto con todos los campos y verificar persistencia.
        """
        sku = f"TEST-{uuid.uuid4().hex[:6].upper()}"
        p = Product(
            name="Cemento Blanco 42.5N",
            sku=sku,
            description="Saco de cemento 42.5N",
            price=Decimal("8.50"),
            cost_price=Decimal("5.00"),
            profit_margin=Decimal("70.00"),
            tax_rate=Decimal("16.00"),
            min_stock=Decimal("10.000"),
            category_id=category_obj.id,
        )
        tenant_db.add(p)
        tenant_db.flush()

        tenant_db.refresh(p)
        assert p.id is not None
        assert p.sku == sku
        assert p.price == Decimal("8.50")
        assert p.cost_price == Decimal("5.00")
        assert p.profit_margin == Decimal("70.00")
        assert p.category_id == category_obj.id
        assert p.is_active is True

    def test_sku_unico_rechaza_duplicado(self, tenant_db):
        """
        FPR01b: El SKU tiene unique=True. Dos productos con el mismo SKU
        deben generar IntegrityError. Previene confusión de referencias.
        """
        sku_fijo = f"DUP-{uuid.uuid4().hex[:6].upper()}"
        p1 = Product(name=f"P1 {uuid.uuid4().hex[:4]}", sku=sku_fijo, price=Decimal("5.00"))
        tenant_db.add(p1)
        tenant_db.flush()

        p2 = Product(name=f"P2 {uuid.uuid4().hex[:4]}", sku=sku_fijo, price=Decimal("7.00"))
        tenant_db.add(p2)
        with pytest.raises(IntegrityError):
            tenant_db.flush()

    def test_producto_sin_sku_permitido(self, tenant_db):
        """
        FPR01c: SKU es nullable — un producto sin código de barras es válido.
        Múltiples productos pueden tener SKU=None sin conflicto de unique.
        """
        p1 = Product(name=f"Sin SKU 1 {uuid.uuid4().hex[:4]}", sku=None, price=Decimal("5.00"))
        p2 = Product(name=f"Sin SKU 2 {uuid.uuid4().hex[:4]}", sku=None, price=Decimal("8.00"))
        tenant_db.add(p1)
        tenant_db.add(p2)
        tenant_db.flush()  # No debe lanzar excepción

        assert p1.sku is None
        assert p2.sku is None

    def test_producto_con_categoria(self, tenant_db, category_obj):
        """
        FPR01d: Asignar producto a una categoría. La relación FK persiste.
        """
        p = _producto(tenant_db, categoria_id=category_obj.id)
        tenant_db.refresh(p)
        assert p.category_id == category_obj.id

    def test_producto_sin_categoria_permitido(self, tenant_db):
        """
        FPR01e: category_id es nullable. Un producto sin categoría es válido.
        """
        p = _producto(tenant_db, categoria_id=None)
        assert p.category_id is None


# ---------------------------------------------------------------------------
# FPR02 — Stock global = suma de ProductStock de todos los warehouses
# ---------------------------------------------------------------------------

class TestFPR02StockGlobal:

    def test_stock_global_es_suma_de_warehouses(
        self, tenant_db, warehouse_obj, warehouse_b
    ):
        """
        FPR02a: Product.stock debe ser la suma de ProductStock.quantity
        de todos los almacenes. Simula el comportamiento del router de inventario.
        """
        p = _producto(tenant_db)

        _stock(tenant_db, p.id, warehouse_obj.id, Decimal("50.000"))
        _stock(tenant_db, p.id, warehouse_b.id, Decimal("30.000"))

        # Simular la lógica del router: actualizar stock global
        total = sum(
            r[0] for r in
            tenant_db.query(ProductStock).filter_by(product_id=p.id)
            .with_entities(ProductStock.quantity).all()
        )
        p.stock = total
        tenant_db.flush()

        tenant_db.refresh(p)
        assert p.stock == Decimal("80.000")

    def test_agregar_warehouse_nuevo_crea_product_stock(
        self, tenant_db, warehouse_obj, warehouse_b
    ):
        """
        FPR02b: Si un producto no tiene stock en un warehouse, al asignarle
        stock se crea el registro ProductStock automáticamente.
        """
        p = _producto(tenant_db)
        # No existe ProductStock para warehouse_b inicialmente
        ps_existente = tenant_db.query(ProductStock).filter_by(
            product_id=p.id, warehouse_id=warehouse_b.id
        ).first()
        assert ps_existente is None

        # Crear stock para ese warehouse (lo hace el router de inventario)
        nuevo_ps = _stock(tenant_db, p.id, warehouse_b.id, Decimal("25.000"))
        assert nuevo_ps.id is not None
        assert nuevo_ps.quantity == Decimal("25.000")

    def test_stock_de_warehouse_a_no_afecta_warehouse_b(
        self, tenant_db, warehouse_obj, warehouse_b
    ):
        """
        FPR02c: El stock de un warehouse es independiente del otro.
        Modificar warehouse A no debe cambiar warehouse B.
        """
        p = _producto(tenant_db)
        ps_a = _stock(tenant_db, p.id, warehouse_obj.id, Decimal("100.000"))
        ps_b = _stock(tenant_db, p.id, warehouse_b.id, Decimal("50.000"))

        # Reducir stock en A (por una venta)
        ps_a.quantity -= Decimal("20.000")
        tenant_db.flush()

        tenant_db.refresh(ps_b)
        assert ps_b.quantity == Decimal("50.000"), \
            "El stock de warehouse B no debe cambiar cuando cambia warehouse A"


# ---------------------------------------------------------------------------
# FPR03 — Búsqueda multi-token
# ---------------------------------------------------------------------------

class TestFPR03Busqueda:

    def test_busqueda_por_nombre_exacto(self, tenant_db):
        """
        FPR03a: Buscar un producto por nombre exacto → encontrado.
        """
        nombre_unico = f"Redmi Note {uuid.uuid4().hex[:4]}"
        p = Product(name=nombre_unico, price=Decimal("150.00"))
        tenant_db.add(p)
        tenant_db.flush()

        resultado = tenant_db.query(Product).filter(
            Product.name.ilike(f"%{nombre_unico}%")
        ).first()
        assert resultado is not None
        assert resultado.id == p.id

    def test_busqueda_multi_token_and_logico(self, tenant_db):
        """
        FPR03b: Búsqueda con múltiples tokens (ej: "Redmi 15C 256") debe
        retornar solo productos que contienen TODOS los tokens en el nombre.
        Un producto con solo algunos tokens no debe aparecer.
        """
        p_completo = Product(
            name="Xiaomi Redmi 15C 256GB Negro",
            price=Decimal("200.00"),
        )
        p_parcial = Product(
            name="Xiaomi Redmi Note 12",  # tiene Redmi pero no 15C ni 256
            price=Decimal("180.00"),
        )
        tenant_db.add(p_completo)
        tenant_db.add(p_parcial)
        tenant_db.flush()

        # Búsqueda multi-token: AND lógico
        tokens = ["Redmi", "15C", "256"]
        query = tenant_db.query(Product)
        for token in tokens:
            query = query.filter(Product.name.ilike(f"%{token}%"))

        resultados = query.filter(
            Product.id.in_([p_completo.id, p_parcial.id])
        ).all()

        assert len(resultados) == 1
        assert resultados[0].id == p_completo.id

    def test_busqueda_por_sku(self, tenant_db):
        """
        FPR03c: Búsqueda por SKU parcial (ilike). El SKU es el código de barras.
        """
        sku = f"BC-{uuid.uuid4().hex[:6].upper()}"
        p = Product(name=f"Prod Barcode {uuid.uuid4().hex[:4]}", sku=sku, price=Decimal("5.00"))
        tenant_db.add(p)
        tenant_db.flush()

        # Búsqueda por los primeros 3 caracteres del SKU
        resultado = tenant_db.query(Product).filter(
            Product.sku.ilike(f"%{sku[:5]}%")
        ).first()
        assert resultado is not None
        assert resultado.id == p.id


# ---------------------------------------------------------------------------
# FPR04 — Tipos especiales y soft-delete
# ---------------------------------------------------------------------------

class TestFPR04TiposEspeciales:

    def test_is_box_persiste(self, tenant_db):
        """
        FPR04a: Un producto de tipo "caja/bulto" (is_box=True) almacena ese
        flag correctamente. Afecta el cálculo de precio en ventas por caja.
        """
        p = _producto(tenant_db, is_box=True)
        tenant_db.refresh(p)
        assert p.is_box is True

    def test_soft_delete_is_active_false(self, tenant_db):
        """
        FPR04b: Marcar is_active=False desactiva el producto sin borrarlo.
        El historial de ventas con ese producto se preserva.
        """
        p = _producto(tenant_db)
        p_id = p.id

        p.is_active = False
        tenant_db.flush()

        recovered = tenant_db.query(Product).get(p_id)
        assert recovered is not None
        assert recovered.is_active is False

    def test_producto_activo_e_inactivo_en_misma_categoria(
        self, tenant_db, category_obj
    ):
        """
        FPR04c: Una categoría puede tener tanto productos activos como inactivos.
        Al filtrar activos, solo aparecen los activos.
        """
        p_activo = _producto(tenant_db, categoria_id=category_obj.id, is_active=True)
        p_inactivo = _producto(tenant_db, categoria_id=category_obj.id, is_active=False)

        activos = tenant_db.query(Product).filter(
            Product.category_id == category_obj.id,
            Product.id.in_([p_activo.id, p_inactivo.id]),
            Product.is_active == True,
        ).all()

        ids = [p.id for p in activos]
        assert p_activo.id in ids
        assert p_inactivo.id not in ids
