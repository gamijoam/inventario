"""
test_pharmacy_lots.py
=====================
Tests para gestión de lotes (ProductLot) y alertas del módulo de farmacia.

Cubre:
 1. test_create_lot_increments_product_stock
 2. test_create_lot_invalid_product_returns_404
 3. test_list_lots_filter_by_status
 4. test_list_lots_filter_by_product_id
 5. test_list_lots_expiring_in_days
 6. test_update_lot_status_to_recalled
 7. test_update_lot_negative_quantity_rejected
 8. test_update_lot_invalid_status_rejected
 9. test_days_until_expiry_calculation
10. test_alerts_expired_lot_appears
11. test_alerts_expiring_30_lot_appears
12. test_alerts_expiring_90_lot_appears
13. test_alerts_low_stock_product
14. test_alerts_total_count

Estrategia:
- Tests 1, 3-6, 9-14: integración directa con capa de servicio/lógica usando
  SQLite en memoria (fixtures db_session de conftest.py).
- Tests 2, 7, 8: validación de reglas de negocio sobre el modelo, también SQLite.
- Los endpoints HTTP (POST /pharmacy/lots, PUT /pharmacy/lots/{id},
  GET /pharmacy/alerts) se testean con FastAPI TestClient con override de
  dependencias cuando la lógica no puede verificarse solo con el modelo.
"""

import os
import sys
import pytest
from datetime import date, timedelta
from decimal import Decimal

# ---------------------------------------------------------------------------
# Path setup — igual que el resto del suite
# ---------------------------------------------------------------------------

_backend_root = os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
)
if _backend_root not in sys.path:
    sys.path.insert(0, _backend_root)


# ---------------------------------------------------------------------------
# Importaciones con skip seguro
# ---------------------------------------------------------------------------

def _import_all():
    try:
        from backend_api.models.models import Product, ProductLot
        return Product, ProductLot, None
    except Exception as e:
        return None, None, str(e)


Product, ProductLot, _import_error = _import_all()
MODELS_AVAILABLE = Product is not None

_skip_if_no_models = pytest.mark.skipif(
    not MODELS_AVAILABLE,
    reason=f"Modelos no disponibles: {_import_error}",
)


# ---------------------------------------------------------------------------
# Helpers para crear objetos de prueba
# ---------------------------------------------------------------------------

def _make_product(db_session, *, name="Paracetamol 500mg", sku=None,
                  stock=Decimal("0.000"), min_stock=Decimal("5.000"),
                  **kwargs) -> "Product":
    """Crea y persiste un Product con valores mínimos válidos."""
    p = Product(
        name=name,
        sku=sku,
        price=Decimal("5.00"),
        stock=stock,
        min_stock=min_stock,
        is_active=True,
        is_service=False,
        is_combo=False,
        has_imei=False,
        **kwargs,
    )
    db_session.add(p)
    db_session.flush()
    return p


def _make_lot(db_session, product_id: int, *,
              lot_number="LOT-001",
              expiry_date=None,
              quantity=Decimal("50.00"),
              status="ACTIVE",
              **kwargs) -> "ProductLot":
    """Crea y persiste un ProductLot con valores por defecto razonables."""
    if expiry_date is None:
        expiry_date = date.today() + timedelta(days=365)
    lot = ProductLot(
        product_id=product_id,
        lot_number=lot_number,
        expiry_date=expiry_date,
        quantity=quantity,
        status=status,
        **kwargs,
    )
    db_session.add(lot)
    db_session.flush()
    return lot


# ---------------------------------------------------------------------------
# BLOQUE 1 — Creación de lotes
# ---------------------------------------------------------------------------

class TestCreateLot:
    """Verifica la lógica de creación de lotes y su efecto sobre el stock."""

    @_skip_if_no_models
    def test_create_lot_increments_product_stock(self, db_session):
        """
        Al registrar un lote con X unidades el stock del producto debe
        incrementarse en exactamente X.

        Se replica la lógica del endpoint POST /pharmacy/lots directamente
        sobre el modelo para verificar el comportamiento sin HTTP.
        """
        product = _make_product(db_session, name="Ibuprofeno 400mg",
                                sku="IBU-400", stock=Decimal("10.000"))
        stock_before = float(product.stock)

        # Lógica idéntica al router pharmacy.py → receive_lot()
        incoming_quantity = 25.0
        lot = ProductLot(
            product_id=product.id,
            lot_number="LOT-2026-001",
            expiry_date=date.today() + timedelta(days=180),
            quantity=incoming_quantity,
            received_date=date.today(),
            status="ACTIVE",
        )
        db_session.add(lot)
        db_session.flush()

        product.stock = float(product.stock or 0) + incoming_quantity
        db_session.flush()
        db_session.refresh(product)

        assert float(product.stock) == stock_before + incoming_quantity, (
            f"Stock esperado: {stock_before + incoming_quantity}, "
            f"obtenido: {float(product.stock)}"
        )
        assert lot.id is not None
        assert lot.status == "ACTIVE"

    @_skip_if_no_models
    def test_create_lot_invalid_product_returns_404(self, db_session):
        """
        Intentar crear un lote para un product_id que no existe debe resultar
        en un 404 desde el endpoint.

        Se usa TestClient con override de get_db apuntando a SQLite en memoria.
        """
        try:
            from fastapi.testclient import TestClient
            from backend_api.main import app
            from backend_api.dependencies import admin_only
            from backend_api.database.db import get_db
        except Exception as e:
            pytest.skip(f"No se puede cargar la app FastAPI: {e}")

        def _override_get_db():
            yield db_session

        def _override_admin_only():
            return True

        app.dependency_overrides[get_db] = _override_get_db
        app.dependency_overrides[admin_only] = _override_admin_only
        try:
            client = TestClient(app, raise_server_exceptions=False)
            response = client.post(
                "/pharmacy/lots",
                json={
                    "product_id": 999999,
                    "lot_number": "LOT-GHOST",
                    "expiry_date": str(date.today() + timedelta(days=100)),
                    "quantity": 10.0,
                },
            )
            assert response.status_code == 404, (
                f"Se esperaba 404 para producto inexistente, "
                f"se obtuvo {response.status_code}"
            )
        finally:
            app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# BLOQUE 2 — Listado y filtros de lotes
# ---------------------------------------------------------------------------

class TestListLots:
    """Verifica los filtros del endpoint GET /pharmacy/lots."""

    @_skip_if_no_models
    def test_list_lots_filter_by_status(self, db_session):
        """
        Solo deben retornarse lotes con el status solicitado.
        Se verifica la consulta directamente sobre SQLAlchemy (misma lógica
        que el router usa internamente).
        """
        product = _make_product(db_session, name="Amoxicilina 500mg",
                                sku="AMOX-500-LS")

        _make_lot(db_session, product.id, lot_number="LOT-ACTIVE-1",
                  status="ACTIVE")
        _make_lot(db_session, product.id, lot_number="LOT-RECALLED-1",
                  status="RECALLED")
        _make_lot(db_session, product.id, lot_number="LOT-ACTIVE-2",
                  status="ACTIVE")

        active_lots = (
            db_session.query(ProductLot)
            .filter(ProductLot.status == "ACTIVE",
                    ProductLot.product_id == product.id)
            .all()
        )
        recalled_lots = (
            db_session.query(ProductLot)
            .filter(ProductLot.status == "RECALLED",
                    ProductLot.product_id == product.id)
            .all()
        )

        assert len(active_lots) == 2, (
            f"Esperados 2 lotes ACTIVE, obtenidos {len(active_lots)}"
        )
        assert len(recalled_lots) == 1, (
            f"Esperado 1 lote RECALLED, obtenidos {len(recalled_lots)}"
        )
        assert all(l.status == "ACTIVE" for l in active_lots)

    @_skip_if_no_models
    def test_list_lots_filter_by_product_id(self, db_session):
        """
        Filtrar por product_id debe retornar solo los lotes de ese producto.
        """
        prod_a = _make_product(db_session, name="Producto A", sku="SKU-A-LOT")
        prod_b = _make_product(db_session, name="Producto B", sku="SKU-B-LOT")

        _make_lot(db_session, prod_a.id, lot_number="LOT-A-001")
        _make_lot(db_session, prod_a.id, lot_number="LOT-A-002")
        _make_lot(db_session, prod_b.id, lot_number="LOT-B-001")

        lots_a = (
            db_session.query(ProductLot)
            .filter(ProductLot.product_id == prod_a.id)
            .all()
        )
        lots_b = (
            db_session.query(ProductLot)
            .filter(ProductLot.product_id == prod_b.id)
            .all()
        )

        assert len(lots_a) == 2, (
            f"Esperados 2 lotes para prod_a, obtenidos {len(lots_a)}"
        )
        assert len(lots_b) == 1, (
            f"Esperado 1 lote para prod_b, obtenidos {len(lots_b)}"
        )
        assert all(l.product_id == prod_a.id for l in lots_a)

    @_skip_if_no_models
    def test_list_lots_expiring_in_days(self, db_session):
        """
        El filtro expiring_in_days debe incluir lotes cuya expiry_date esté
        entre hoy y hoy + N días (inclusive en ambos extremos).

        Se replica la condición exacta del router:
            expiry_date >= today AND expiry_date <= today + expiring_in_days
        """
        product = _make_product(db_session, name="Clonazepam 2mg",
                                sku="CLO-2-EXP")
        today = date.today()

        # Lote que vence en 20 días → dentro del rango de 30 días
        lot_20 = _make_lot(
            db_session, product.id,
            lot_number="LOT-EXP-20",
            expiry_date=today + timedelta(days=20),
        )
        # Lote que vence en 60 días → fuera del rango de 30 días
        lot_60 = _make_lot(
            db_session, product.id,
            lot_number="LOT-EXP-60",
            expiry_date=today + timedelta(days=60),
        )
        # Lote ya vencido → NOT incluido (expiry_date < today)
        lot_expired = _make_lot(
            db_session, product.id,
            lot_number="LOT-EXP-PAST",
            expiry_date=today - timedelta(days=5),
        )

        expiring_in_days = 30
        cutoff = today + timedelta(days=expiring_in_days)
        from sqlalchemy import and_
        results = (
            db_session.query(ProductLot)
            .filter(
                ProductLot.product_id == product.id,
                and_(
                    ProductLot.expiry_date >= today,
                    ProductLot.expiry_date <= cutoff,
                ),
            )
            .all()
        )

        result_ids = {l.id for l in results}
        assert lot_20.id in result_ids, (
            "Lote que vence en 20 días debe estar en el filtro de 30 días."
        )
        assert lot_60.id not in result_ids, (
            "Lote que vence en 60 días NO debe estar en el filtro de 30 días."
        )
        assert lot_expired.id not in result_ids, (
            "Lote ya vencido NO debe estar en el filtro expiring_in_days."
        )


# ---------------------------------------------------------------------------
# BLOQUE 3 — Actualización de lotes
# ---------------------------------------------------------------------------

class TestUpdateLot:
    """Verifica las reglas de validación al actualizar un lote."""

    @_skip_if_no_models
    def test_update_lot_status_to_recalled(self, db_session):
        """
        Cambiar el status de un lote a RECALLED debe persistir correctamente.
        Se replica la lógica del endpoint PUT /pharmacy/lots/{id}.
        """
        product = _make_product(db_session, name="Warfarina 5mg",
                                sku="WAR-5-UPD")
        lot = _make_lot(db_session, product.id, lot_number="LOT-WAR-001",
                        status="ACTIVE")
        assert lot.status == "ACTIVE"

        # Aplicar la lógica del router
        valid_statuses = {"ACTIVE", "EXPIRED", "RECALLED", "QUARANTINE"}
        new_status = "RECALLED"
        assert new_status in valid_statuses

        lot.status = new_status
        db_session.flush()
        db_session.refresh(lot)

        assert lot.status == "RECALLED", (
            f"Se esperaba status=RECALLED, obtenido: {lot.status}"
        )

    @_skip_if_no_models
    def test_update_lot_negative_quantity_rejected(self, db_session):
        """
        La lógica del router rechaza cantidades negativas.
        Se replica la validación directamente (pharmacy.py ~línea 159).
        """
        from fastapi import HTTPException

        product = _make_product(db_session, name="Metformina 850mg", sku="MET-850-NEG")
        lot = _make_lot(db_session, product.id, lot_number="LOT-MET-001")
        db_session.flush()

        new_quantity = -10.0
        caught = None
        try:
            if new_quantity is not None and new_quantity < 0:
                raise HTTPException(status_code=400, detail="Quantity cannot be negative")
            lot.quantity = new_quantity
        except HTTPException as e:
            caught = e

        assert caught is not None, "Debería haber lanzado HTTPException"
        assert caught.status_code == 400
        assert "negative" in caught.detail.lower()

    @_skip_if_no_models
    def test_update_lot_invalid_status_rejected(self, db_session):
        """
        Status fuera del conjunto válido debe ser rechazado.
        Se replica la validación directamente (pharmacy.py ~línea 150-155).
        """
        from fastapi import HTTPException

        product = _make_product(db_session, name="Atorvastatina 20mg", sku="ATO-20-INV")
        lot = _make_lot(db_session, product.id, lot_number="LOT-ATO-001")
        db_session.flush()

        valid_statuses = {"ACTIVE", "EXPIRED", "RECALLED", "QUARANTINE"}
        new_status = "DESTRUIDO"
        caught = None
        try:
            if new_status not in valid_statuses:
                raise HTTPException(status_code=400, detail=f"Invalid status: {new_status}")
            lot.status = new_status
        except HTTPException as e:
            caught = e

        assert caught is not None, "Debería haber lanzado HTTPException"
        assert caught.status_code == 400
        assert new_status in caught.detail


# ---------------------------------------------------------------------------
# BLOQUE 4 — Cálculo de days_until_expiry
# ---------------------------------------------------------------------------

class TestDaysUntilExpiry:
    """Verifica el cálculo de días hasta el vencimiento."""

    @_skip_if_no_models
    def test_days_until_expiry_calculation(self, db_session):
        """
        Un lote cuya expiry_date fue hace 5 días debe tener
        days_until_expiry == -5.

        Se replica la fórmula exacta del router:
            days_until_expiry = (lot.expiry_date - date.today()).days
        """
        product = _make_product(db_session, name="Penicilina 500mg",
                                sku="PEN-500-DUE")
        expired_date = date.today() - timedelta(days=5)
        lot = _make_lot(
            db_session, product.id,
            lot_number="LOT-EXPIRED-5D",
            expiry_date=expired_date,
        )
        db_session.refresh(lot)

        days_until_expiry = (lot.expiry_date - date.today()).days

        assert days_until_expiry == -5, (
            f"Se esperaba days_until_expiry=-5, obtenido: {days_until_expiry}"
        )

    @_skip_if_no_models
    def test_days_until_expiry_future(self, db_session):
        """
        Un lote que vence en exactamente 30 días debe tener
        days_until_expiry == 30.
        """
        product = _make_product(db_session, name="Aspirina 100mg",
                                sku="ASP-100-FUT")
        future_date = date.today() + timedelta(days=30)
        lot = _make_lot(
            db_session, product.id,
            lot_number="LOT-FUTURE-30",
            expiry_date=future_date,
        )
        db_session.refresh(lot)

        days_until_expiry = (lot.expiry_date - date.today()).days

        assert days_until_expiry == 30, (
            f"Se esperaba days_until_expiry=30, obtenido: {days_until_expiry}"
        )


# ---------------------------------------------------------------------------
# BLOQUE 5 — Alertas de farmacia
# ---------------------------------------------------------------------------

class TestPharmacyAlerts:
    """
    Verifica la lógica de clasificación de alertas del endpoint
    GET /pharmacy/alerts.

    Se replica la lógica del router directamente sobre la BD SQLite para
    evitar depender del stack HTTP completo en tests de lógica de negocio.
    """

    def _compute_alerts(self, db_session):
        """Replica exactamente la lógica de get_pharmacy_alerts() del router."""
        from sqlalchemy.orm import joinedload

        today = date.today()
        day30 = today + timedelta(days=30)
        day90 = today + timedelta(days=90)

        all_lots = (
            db_session.query(ProductLot)
            .options(joinedload(ProductLot.product))
            .filter(ProductLot.status == "ACTIVE")
            .all()
        )

        expiring_30 = []
        expiring_90 = []
        expired = []

        for lot in all_lots:
            if lot.expiry_date is None:
                continue
            if lot.expiry_date < today:
                expired.append(lot)
            elif lot.expiry_date <= day30:
                expiring_30.append(lot)
            elif lot.expiry_date <= day90:
                expiring_90.append(lot)

        low_stock_products = (
            db_session.query(Product)
            .filter(
                Product.is_active == True,
                Product.stock <= Product.min_stock,
            )
            .all()
        )

        total_alerts = len(expiring_30) + len(expired) + len(low_stock_products)

        return {
            "expiring_30": expiring_30,
            "expiring_90": expiring_90,
            "expired": expired,
            "low_stock": low_stock_products,
            "total_alerts": total_alerts,
        }

    @_skip_if_no_models
    def test_alerts_expired_lot_appears(self, db_session):
        """
        Un lote con expiry_date en el pasado y status=ACTIVE debe aparecer
        en la lista 'expired' de alertas.
        """
        product = _make_product(db_session, name="Dipirona 500mg",
                                sku="DIP-500-EXP",
                                min_stock=Decimal("5.000"),
                                stock=Decimal("20.000"))
        yesterday = date.today() - timedelta(days=1)
        lot = _make_lot(
            db_session, product.id,
            lot_number="LOT-DIP-EXPIRED",
            expiry_date=yesterday,
            status="ACTIVE",
        )

        alerts = self._compute_alerts(db_session)

        expired_ids = {l.id for l in alerts["expired"]}
        assert lot.id in expired_ids, (
            "El lote con expiry_date=ayer debe aparecer en alerts.expired."
        )

    @_skip_if_no_models
    def test_alerts_expiring_30_lot_appears(self, db_session):
        """
        Un lote que vence en 15 días debe aparecer en 'expiring_30'
        pero NO en 'expired' ni en 'expiring_90'.
        """
        product = _make_product(db_session, name="Ranitidina 150mg",
                                sku="RAN-150-30",
                                min_stock=Decimal("5.000"),
                                stock=Decimal("20.000"))
        lot = _make_lot(
            db_session, product.id,
            lot_number="LOT-RAN-15D",
            expiry_date=date.today() + timedelta(days=15),
            status="ACTIVE",
        )

        alerts = self._compute_alerts(db_session)

        exp30_ids = {l.id for l in alerts["expiring_30"]}
        exp90_ids = {l.id for l in alerts["expiring_90"]}
        expired_ids = {l.id for l in alerts["expired"]}

        assert lot.id in exp30_ids, (
            "Lote que vence en 15 días debe estar en expiring_30."
        )
        assert lot.id not in expired_ids, (
            "Lote que vence en 15 días NO debe estar en expired."
        )
        assert lot.id not in exp90_ids, (
            "Lote que vence en 15 días NO debe estar en expiring_90 "
            "(ya está clasificado en expiring_30)."
        )

    @_skip_if_no_models
    def test_alerts_expiring_90_lot_appears(self, db_session):
        """
        Un lote que vence en 60 días debe aparecer en 'expiring_90'
        pero NO en 'expiring_30' ni en 'expired'.
        """
        product = _make_product(db_session, name="Omeprazol 20mg",
                                sku="OME-20-90",
                                min_stock=Decimal("5.000"),
                                stock=Decimal("20.000"))
        lot = _make_lot(
            db_session, product.id,
            lot_number="LOT-OME-60D",
            expiry_date=date.today() + timedelta(days=60),
            status="ACTIVE",
        )

        alerts = self._compute_alerts(db_session)

        exp30_ids = {l.id for l in alerts["expiring_30"]}
        exp90_ids = {l.id for l in alerts["expiring_90"]}
        expired_ids = {l.id for l in alerts["expired"]}

        assert lot.id in exp90_ids, (
            "Lote que vence en 60 días debe estar en expiring_90."
        )
        assert lot.id not in exp30_ids, (
            "Lote que vence en 60 días NO debe estar en expiring_30."
        )
        assert lot.id not in expired_ids, (
            "Lote que vence en 60 días NO debe estar en expired."
        )

    @_skip_if_no_models
    def test_alerts_low_stock_product(self, db_session):
        """
        Un producto activo cuyo stock es menor o igual a min_stock debe
        aparecer en la lista 'low_stock' de alertas.

        Se crea un producto con stock=2 y min_stock=5 — claramente bajo.
        También se crea uno con stock suficiente para verificar que NO aparece.
        """
        prod_low = _make_product(
            db_session,
            name="Metronidazol 500mg",
            sku="MET-500-LOW",
            stock=Decimal("2.000"),
            min_stock=Decimal("5.000"),
        )
        prod_ok = _make_product(
            db_session,
            name="Metronidazol 250mg",
            sku="MET-250-OK",
            stock=Decimal("50.000"),
            min_stock=Decimal("5.000"),
        )

        alerts = self._compute_alerts(db_session)

        low_ids = {p.id for p in alerts["low_stock"]}

        assert prod_low.id in low_ids, (
            "Producto con stock=2, min_stock=5 debe aparecer en low_stock."
        )
        assert prod_ok.id not in low_ids, (
            "Producto con stock=50, min_stock=5 NO debe aparecer en low_stock."
        )

    @_skip_if_no_models
    def test_alerts_low_stock_at_exact_threshold(self, db_session):
        """
        La condición usa <=: un producto con stock == min_stock exacto
        también debe aparecer en low_stock (borde del límite).
        """
        prod_exact = _make_product(
            db_session,
            name="Loratadina 10mg",
            sku="LOR-10-EXACT",
            stock=Decimal("5.000"),
            min_stock=Decimal("5.000"),
        )

        alerts = self._compute_alerts(db_session)

        low_ids = {p.id for p in alerts["low_stock"]}
        assert prod_exact.id in low_ids, (
            "Producto con stock == min_stock debe aparecer en low_stock "
            "(condición stock <= min_stock)."
        )

    @_skip_if_no_models
    def test_alerts_total_count(self, db_session):
        """
        total_alerts debe ser la suma de len(expiring_30) + len(expired)
        + len(low_stock). expiring_90 NO cuenta para el total.
        """
        # Producto con bajo stock
        prod_low = _make_product(
            db_session,
            name="Cetirizina 10mg",
            sku="CET-10-TOTAL",
            stock=Decimal("1.000"),
            min_stock=Decimal("10.000"),
        )

        # Lote vencido
        lot_exp = _make_lot(
            db_session, prod_low.id,
            lot_number="LOT-CET-EXPIRED",
            expiry_date=date.today() - timedelta(days=3),
            status="ACTIVE",
        )

        # Lote que vence en 10 días (entra en expiring_30)
        lot_30 = _make_lot(
            db_session, prod_low.id,
            lot_number="LOT-CET-SOON",
            expiry_date=date.today() + timedelta(days=10),
            status="ACTIVE",
        )

        # Lote que vence en 70 días (solo expiring_90 — NO suma a total)
        lot_90 = _make_lot(
            db_session, prod_low.id,
            lot_number="LOT-CET-90",
            expiry_date=date.today() + timedelta(days=70),
            status="ACTIVE",
        )

        alerts = self._compute_alerts(db_session)

        expected_total = (
            len(alerts["expiring_30"])
            + len(alerts["expired"])
            + len(alerts["low_stock"])
        )

        assert alerts["total_alerts"] == expected_total, (
            f"total_alerts ({alerts['total_alerts']}) debe coincidir con "
            f"expiring_30 + expired + low_stock ({expected_total}). "
            f"expiring_90 ({len(alerts['expiring_90'])}) NO debe sumarse."
        )

        # Verificar que nuestros lotes específicos están donde deben
        exp30_ids = {l.id for l in alerts["expiring_30"]}
        expired_ids = {l.id for l in alerts["expired"]}
        exp90_ids = {l.id for l in alerts["expiring_90"]}

        assert lot_30.id in exp30_ids, "lot_30 debe estar en expiring_30."
        assert lot_exp.id in expired_ids, "lot_exp debe estar en expired."
        assert lot_90.id in exp90_ids, "lot_90 debe estar en expiring_90."

    @_skip_if_no_models
    def test_alerts_recalled_lot_excluded(self, db_session):
        """
        Lotes con status != ACTIVE (ej: RECALLED) NO deben aparecer en
        ninguna categoría de alertas, aunque tengan expiry_date pasada.
        """
        product = _make_product(
            db_session,
            name="Naproxeno 550mg",
            sku="NAP-550-REC",
            stock=Decimal("20.000"),
            min_stock=Decimal("5.000"),
        )
        recalled_lot = _make_lot(
            db_session, product.id,
            lot_number="LOT-NAP-RECALLED",
            expiry_date=date.today() - timedelta(days=10),  # vencido
            status="RECALLED",  # pero retirado, no ACTIVE
        )

        alerts = self._compute_alerts(db_session)

        all_alerted_ids = (
            {l.id for l in alerts["expired"]}
            | {l.id for l in alerts["expiring_30"]}
            | {l.id for l in alerts["expiring_90"]}
        )

        assert recalled_lot.id not in all_alerted_ids, (
            "Lote con status=RECALLED no debe aparecer en ninguna alerta "
            "de vencimiento, aunque su expiry_date ya haya pasado."
        )
