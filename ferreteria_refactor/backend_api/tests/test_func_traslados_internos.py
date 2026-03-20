"""
test_func_traslados_internos.py — Tests funcionales de Traslados entre Bodegas (mismo tenant)

Flujos cubiertos:
  FTI01 — Movimiento de stock: origen baja, destino sube
  FTI02 — Stock global invariante: Product.stock no cambia en traslados internos
  FTI03 — Validaciones: mismo warehouse bloqueado, stock insuficiente bloqueado
  FTI04 — InventoryTransfer y TransferDetail: registros creados correctamente
  FTI05 — Destino sin stock previo: ProductStock se crea en destino si no existe

Nota técnica: Los traslados internos NO generan Kardex (es intencional).
El stock global (Product.stock) no cambia — solo se redistribuye entre bodegas.

Correr con:
    cd ferreteria_refactor
    python -m pytest backend_api/tests/test_func_traslados_internos.py -v --no-cov -s
"""

import pytest
import uuid
from decimal import Decimal
from datetime import datetime

import sys, os
_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _root not in sys.path:
    sys.path.insert(0, _root)

from backend_api.models.models import Product, ProductStock, InventoryTransfer, TransferDetail, Warehouse

TENANT = "lalicoreria"


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def tenant_db(pg_db_for_schema):
    return pg_db_for_schema(TENANT)


@pytest.fixture()
def wh_origen(tenant_db):
    wh = Warehouse(name=f"Origen {uuid.uuid4().hex[:6]}", is_active=True)
    tenant_db.add(wh)
    tenant_db.flush()
    return wh


@pytest.fixture()
def wh_destino(tenant_db):
    wh = Warehouse(name=f"Destino {uuid.uuid4().hex[:6]}", is_active=True)
    tenant_db.add(wh)
    tenant_db.flush()
    return wh


@pytest.fixture()
def product_obj(tenant_db):
    p = Product(
        name=f"Prod Traslado {uuid.uuid4().hex[:6]}",
        price=Decimal("10.00"),
        cost_price=Decimal("6.00"),
        stock=Decimal("0.000"),
    )
    tenant_db.add(p)
    tenant_db.flush()
    return p


def _setup_source_stock(db, product, warehouse, qty):
    """Crea ProductStock en el origen con la cantidad dada."""
    ps = ProductStock(product_id=product.id, warehouse_id=warehouse.id, quantity=qty)
    db.add(ps)
    product.stock += qty
    db.flush()
    return ps


def _execute_transfer(db, source_wh, target_wh, items):
    """
    Replica la lógica de transfers.py:create_transfer() sin db.commit().
    items: [(product, qty), ...]
    Retorna (InventoryTransfer, error_msg). error_msg=None si tuvo éxito.
    """
    # Validación: mismo warehouse
    if source_wh.id == target_wh.id:
        return None, "Cannot transfer to the same warehouse"

    # Validación: stock disponible en origen
    for product, qty in items:
        source_stock = db.query(ProductStock).filter_by(
            warehouse_id=source_wh.id, product_id=product.id
        ).first()
        current_qty = source_stock.quantity if source_stock else Decimal("0")
        if current_qty < qty:
            return None, f"Stock insuficiente para '{product.name}'. Disponible: {current_qty}"

    # Crear el registro de traslado
    transfer = InventoryTransfer(
        source_warehouse_id=source_wh.id,
        target_warehouse_id=target_wh.id,
        status="COMPLETED",
        date=datetime.now(),
    )
    db.add(transfer)
    db.flush()

    # Mover stock
    for product, qty in items:
        db.add(TransferDetail(transfer_id=transfer.id, product_id=product.id, quantity=qty))

        # Decrementar origen
        source_stock = db.query(ProductStock).filter_by(
            warehouse_id=source_wh.id, product_id=product.id
        ).first()
        source_stock.quantity -= qty

        # Incrementar destino
        target_stock = db.query(ProductStock).filter_by(
            warehouse_id=target_wh.id, product_id=product.id
        ).first()
        if not target_stock:
            target_stock = ProductStock(
                warehouse_id=target_wh.id, product_id=product.id, quantity=Decimal("0")
            )
            db.add(target_stock)
            db.flush()
        target_stock.quantity += qty

        # Product.stock NO cambia (solo redistribución)

    db.flush()
    return transfer, None


# ---------------------------------------------------------------------------
# FTI01 — Movimiento de stock entre bodegas
# ---------------------------------------------------------------------------

class TestFTI01MovimientoStock:

    def test_origen_disminuye_al_trasladar(self, tenant_db, wh_origen, wh_destino, product_obj):
        """FTI01a: El stock en la bodega origen disminuye en la cantidad trasladada."""
        _setup_source_stock(tenant_db, product_obj, wh_origen, Decimal("50.000"))

        _execute_transfer(tenant_db, wh_origen, wh_destino, [(product_obj, Decimal("20.000"))])

        ps_origen = tenant_db.query(ProductStock).filter_by(
            product_id=product_obj.id, warehouse_id=wh_origen.id
        ).first()
        assert ps_origen.quantity == Decimal("30.000")

    def test_destino_aumenta_al_trasladar(self, tenant_db, wh_origen, wh_destino, product_obj):
        """FTI01b: El stock en la bodega destino aumenta en la cantidad trasladada."""
        _setup_source_stock(tenant_db, product_obj, wh_origen, Decimal("50.000"))
        # Destino tiene stock previo
        ps_dest = ProductStock(product_id=product_obj.id, warehouse_id=wh_destino.id, quantity=Decimal("10.000"))
        tenant_db.add(ps_dest)
        tenant_db.flush()

        _execute_transfer(tenant_db, wh_origen, wh_destino, [(product_obj, Decimal("15.000"))])

        tenant_db.refresh(ps_dest)
        assert ps_dest.quantity == Decimal("25.000")  # 10 + 15


# ---------------------------------------------------------------------------
# FTI02 — Stock global invariante
# ---------------------------------------------------------------------------

class TestFTI02StockGlobalInvariante:

    def test_stock_global_no_cambia(self, tenant_db, wh_origen, wh_destino, product_obj):
        """
        FTI02a: Product.stock (stock global) no cambia en traslados internos.
        Un traslado solo redistribuye el stock entre bodegas, no lo crea ni destruye.
        """
        _setup_source_stock(tenant_db, product_obj, wh_origen, Decimal("40.000"))
        stock_global_antes = product_obj.stock

        _execute_transfer(tenant_db, wh_origen, wh_destino, [(product_obj, Decimal("15.000"))])

        tenant_db.refresh(product_obj)
        assert product_obj.stock == stock_global_antes, \
            "El stock global NO debe cambiar en un traslado interno"

    def test_suma_bodegas_igual_a_stock_global(self, tenant_db, wh_origen, wh_destino, product_obj):
        """
        FTI02b: La suma del stock en todas las bodegas siempre iguala al stock global.
        Invariante del sistema multi-bodega.
        """
        _setup_source_stock(tenant_db, product_obj, wh_origen, Decimal("30.000"))

        _execute_transfer(tenant_db, wh_origen, wh_destino, [(product_obj, Decimal("12.000"))])

        ps_origen = tenant_db.query(ProductStock).filter_by(
            product_id=product_obj.id, warehouse_id=wh_origen.id
        ).first()
        ps_destino = tenant_db.query(ProductStock).filter_by(
            product_id=product_obj.id, warehouse_id=wh_destino.id
        ).first()

        tenant_db.refresh(product_obj)
        suma_bodegas = ps_origen.quantity + ps_destino.quantity
        assert suma_bodegas == product_obj.stock, \
            "Suma de stocks en bodegas debe igualar al stock global"


# ---------------------------------------------------------------------------
# FTI03 — Validaciones
# ---------------------------------------------------------------------------

class TestFTI03Validaciones:

    def test_traslado_misma_bodega_bloqueado(self, tenant_db, wh_origen, product_obj):
        """FTI03a: No se puede trasladar de una bodega a sí misma."""
        _setup_source_stock(tenant_db, product_obj, wh_origen, Decimal("20.000"))

        _, error = _execute_transfer(tenant_db, wh_origen, wh_origen, [(product_obj, Decimal("5.000"))])
        assert error is not None
        assert "same warehouse" in error.lower()

    def test_stock_insuficiente_en_origen_bloqueado(self, tenant_db, wh_origen, wh_destino, product_obj):
        """
        FTI03b: No se puede trasladar más stock del disponible en el origen.
        El router verifica current_qty < item.quantity → 400.
        """
        _setup_source_stock(tenant_db, product_obj, wh_origen, Decimal("5.000"))

        _, error = _execute_transfer(
            tenant_db, wh_origen, wh_destino, [(product_obj, Decimal("10.000"))]
        )
        assert error is not None
        assert "insuficiente" in error.lower()

    def test_traslado_sin_stock_en_origen_bloqueado(self, tenant_db, wh_origen, wh_destino, product_obj):
        """FTI03c: No hay ProductStock en origen → traslado bloqueado."""
        # No se crea stock en origen
        _, error = _execute_transfer(
            tenant_db, wh_origen, wh_destino, [(product_obj, Decimal("5.000"))]
        )
        assert error is not None


# ---------------------------------------------------------------------------
# FTI04 — Registros de InventoryTransfer y TransferDetail
# ---------------------------------------------------------------------------

class TestFTI04Registros:

    def test_inventory_transfer_creado(self, tenant_db, wh_origen, wh_destino, product_obj):
        """FTI04a: El traslado crea un registro InventoryTransfer con status=COMPLETED."""
        _setup_source_stock(tenant_db, product_obj, wh_origen, Decimal("20.000"))

        transfer, _ = _execute_transfer(
            tenant_db, wh_origen, wh_destino, [(product_obj, Decimal("5.000"))]
        )

        assert transfer is not None
        assert transfer.id is not None
        assert transfer.status == "COMPLETED"
        assert transfer.source_warehouse_id == wh_origen.id
        assert transfer.target_warehouse_id == wh_destino.id

    def test_transfer_detail_creado_por_item(self, tenant_db, wh_origen, wh_destino, product_obj):
        """FTI04b: Se crea un TransferDetail por cada ítem del traslado."""
        _setup_source_stock(tenant_db, product_obj, wh_origen, Decimal("30.000"))

        p2 = Product(name=f"P2 Traslado {uuid.uuid4().hex[:6]}", price=Decimal("5.00"), stock=Decimal("0.000"))
        tenant_db.add(p2)
        tenant_db.flush()
        ps2 = ProductStock(product_id=p2.id, warehouse_id=wh_origen.id, quantity=Decimal("20.000"))
        tenant_db.add(ps2)
        p2.stock = Decimal("20.000")
        tenant_db.flush()

        transfer, _ = _execute_transfer(
            tenant_db, wh_origen, wh_destino,
            [(product_obj, Decimal("5.000")), (p2, Decimal("8.000"))]
        )

        details = tenant_db.query(TransferDetail).filter_by(transfer_id=transfer.id).all()
        assert len(details) == 2

        product_ids = {d.product_id for d in details}
        assert product_obj.id in product_ids
        assert p2.id in product_ids


# ---------------------------------------------------------------------------
# FTI05 — ProductStock creado en destino si no existe
# ---------------------------------------------------------------------------

class TestFTI05DestinoSinStock:

    def test_product_stock_creado_en_destino(self, tenant_db, wh_origen, wh_destino, product_obj):
        """
        FTI05a: Si el destino no tiene ProductStock para el producto,
        el traslado crea uno con qty=0 y luego suma la cantidad trasladada.
        """
        _setup_source_stock(tenant_db, product_obj, wh_origen, Decimal("20.000"))

        # Verificar que no existe en destino
        ps_dest_antes = tenant_db.query(ProductStock).filter_by(
            product_id=product_obj.id, warehouse_id=wh_destino.id
        ).first()
        assert ps_dest_antes is None

        _execute_transfer(tenant_db, wh_origen, wh_destino, [(product_obj, Decimal("8.000"))])

        ps_dest_despues = tenant_db.query(ProductStock).filter_by(
            product_id=product_obj.id, warehouse_id=wh_destino.id
        ).first()
        assert ps_dest_despues is not None
        assert ps_dest_despues.quantity == Decimal("8.000")

    def test_traslado_parcial_deja_resto_en_origen(self, tenant_db, wh_origen, wh_destino, product_obj):
        """FTI05b: Un traslado parcial deja el restante en el origen."""
        _setup_source_stock(tenant_db, product_obj, wh_origen, Decimal("50.000"))

        _execute_transfer(tenant_db, wh_origen, wh_destino, [(product_obj, Decimal("30.000"))])

        ps_origen = tenant_db.query(ProductStock).filter_by(
            product_id=product_obj.id, warehouse_id=wh_origen.id
        ).first()
        ps_destino = tenant_db.query(ProductStock).filter_by(
            product_id=product_obj.id, warehouse_id=wh_destino.id
        ).first()

        assert ps_origen.quantity == Decimal("20.000")
        assert ps_destino.quantity == Decimal("30.000")
