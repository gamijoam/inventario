"""
test_func_tasas_cambio.py — Tests funcionales de Tasas de Cambio

Flujos cubiertos:
  FTC01 — CRUD de tasas: crear, default único, activas/inactivas
  FTC02 — Productos con tasa específica vs tasa default
  FTC03 — Valuación de crédito en Bs usando tasas
  FTC04 — Coexistencia de múltiples tasas activas

Correr con:
    cd ferreteria_refactor
    python -m pytest backend_api/tests/test_func_tasas_cambio.py -v --no-cov -s
"""

import pytest
import uuid
from decimal import Decimal
from sqlalchemy import text

import sys, os
_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _root not in sys.path:
    sys.path.insert(0, _root)

from backend_api.models.models import ExchangeRate, Product, Sale, Customer

TENANT = "lalicoreria"


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def tenant_db(pg_db_for_schema):
    return pg_db_for_schema(TENANT)


def _nueva_tasa(db, *, name, rate, is_default=False, is_active=True):
    """Crea una ExchangeRate y hace flush. Retorna el objeto."""
    tasa = ExchangeRate(
        name=name,
        currency_code="VES",
        currency_symbol="Bs",
        rate=rate,
        is_default=is_default,
        is_active=is_active,
    )
    db.add(tasa)
    db.flush()
    return tasa


# ---------------------------------------------------------------------------
# FTC01 — CRUD de tasas de cambio
# ---------------------------------------------------------------------------

class TestFTC01CRUDTasas:

    def test_crear_tasa_campos_persisten(self, tenant_db):
        """
        FTC01a: Crear una tasa de cambio y verificar que todos los campos
        persisten correctamente en la BD.
        """
        tasa = _nueva_tasa(tenant_db, name=f"BCV {uuid.uuid4().hex[:4]}",
                            rate=Decimal("50.1234"))

        tenant_db.refresh(tasa)
        assert tasa.id is not None
        assert tasa.currency_code == "VES"
        assert tasa.currency_symbol == "Bs"
        assert tasa.rate == Decimal("50.1234")
        assert tasa.is_active is True

    def test_tasa_is_default_persiste(self, tenant_db):
        """
        FTC01b: Una tasa marcada como is_default=True persiste ese valor.
        La lógica de "solo una default a la vez" es responsabilidad del router,
        pero el modelo permite almacenarlo.
        """
        tasa = _nueva_tasa(tenant_db, name=f"Default {uuid.uuid4().hex[:4]}",
                            rate=Decimal("40.00"), is_default=True)

        tenant_db.refresh(tasa)
        assert tasa.is_default is True

    def test_cambiar_tasa_default(self, tenant_db):
        """
        FTC01c: El router desactiva la tasa default anterior al activar una nueva.
        Simulamos ese flujo: al crear una tasa nueva como default,
        la anterior debe quedar is_default=False.
        """
        tasa_vieja = _nueva_tasa(tenant_db, name=f"Vieja {uuid.uuid4().hex[:4]}",
                                  rate=Decimal("35.00"), is_default=True)

        # Simular lógica del router: desactivar la anterior, activar la nueva
        tasa_vieja.is_default = False
        tasa_nueva = _nueva_tasa(tenant_db, name=f"Nueva {uuid.uuid4().hex[:4]}",
                                  rate=Decimal("48.50"), is_default=True)

        tenant_db.refresh(tasa_vieja)
        tenant_db.refresh(tasa_nueva)
        assert tasa_vieja.is_default is False
        assert tasa_nueva.is_default is True

        # Solo una tasa es default de las dos
        defaults = tenant_db.query(ExchangeRate).filter(
            ExchangeRate.id.in_([tasa_vieja.id, tasa_nueva.id]),
            ExchangeRate.is_default == True,
        ).all()
        assert len(defaults) == 1
        assert defaults[0].id == tasa_nueva.id

    def test_tasa_inactiva_excluida_de_consulta(self, tenant_db):
        """
        FTC01d: Una tasa is_active=False no debe aparecer en las consultas
        de tasas activas. Permite archivar tasas sin borrarlas.
        """
        tasa_inactiva = _nueva_tasa(tenant_db, name=f"Inactiva {uuid.uuid4().hex[:4]}",
                                     rate=Decimal("10.00"), is_active=False)
        tasa_activa = _nueva_tasa(tenant_db, name=f"Activa {uuid.uuid4().hex[:4]}",
                                   rate=Decimal("50.00"), is_active=True)

        activas = tenant_db.query(ExchangeRate).filter(
            ExchangeRate.id.in_([tasa_inactiva.id, tasa_activa.id]),
            ExchangeRate.is_active == True,
        ).all()

        ids_activas = [t.id for t in activas]
        assert tasa_activa.id in ids_activas
        assert tasa_inactiva.id not in ids_activas


# ---------------------------------------------------------------------------
# FTC02 — Producto con tasa específica vs tasa default
# ---------------------------------------------------------------------------

class TestFTC02ProductoConTasa:

    def test_producto_con_exchange_rate_id_especifico(self, tenant_db):
        """
        FTC02a: Un producto puede tener exchange_rate_id apuntando a una tasa
        específica. Esa tasa se usa para valuación, no la default.
        """
        tasa_paralelo = _nueva_tasa(
            tenant_db,
            name=f"Paralelo {uuid.uuid4().hex[:4]}",
            rate=Decimal("65.00"),
            is_default=False,
        )

        producto = Product(
            name=f"Producto Paralelo {uuid.uuid4().hex[:6]}",
            price=Decimal("10.00"),
            exchange_rate_id=tasa_paralelo.id,
        )
        tenant_db.add(producto)
        tenant_db.flush()

        tenant_db.refresh(producto)
        assert producto.exchange_rate_id == tasa_paralelo.id

        # Valuación: precio × tasa paralelo
        precio_bs = producto.price * tasa_paralelo.rate
        assert precio_bs == Decimal("650.0000")

    def test_producto_sin_tasa_usa_default(self, tenant_db):
        """
        FTC02b: Un producto sin exchange_rate_id debe usar la tasa default
        para cualquier cálculo de valuación.
        """
        tasa_default = _nueva_tasa(
            tenant_db,
            name=f"BCV Default {uuid.uuid4().hex[:4]}",
            rate=Decimal("45.00"),
            is_default=True,
        )

        producto = Product(
            name=f"Producto Sin Tasa {uuid.uuid4().hex[:6]}",
            price=Decimal("20.00"),
            exchange_rate_id=None,  # Sin tasa específica
        )
        tenant_db.add(producto)
        tenant_db.flush()

        assert producto.exchange_rate_id is None

        # Obtener tasa default del sistema
        default = tenant_db.query(ExchangeRate).filter(
            ExchangeRate.id == tasa_default.id,
            ExchangeRate.is_default == True,
        ).first()
        assert default is not None

        precio_bs = producto.price * default.rate
        assert precio_bs == Decimal("900.0000")

    def test_dos_productos_con_tasas_distintas(self, tenant_db):
        """
        FTC02c: Dos productos pueden usar tasas diferentes simultáneamente.
        Permite mezclar BCV y paralelo en el mismo tenant.
        """
        tasa_bcv = _nueva_tasa(tenant_db, name=f"BCV {uuid.uuid4().hex[:4]}",
                                rate=Decimal("40.00"))
        tasa_par = _nueva_tasa(tenant_db, name=f"Par {uuid.uuid4().hex[:4]}",
                                rate=Decimal("60.00"))

        p1 = Product(name=f"P BCV {uuid.uuid4().hex[:6]}", price=Decimal("10.00"),
                      exchange_rate_id=tasa_bcv.id)
        p2 = Product(name=f"P Par {uuid.uuid4().hex[:6]}", price=Decimal("10.00"),
                      exchange_rate_id=tasa_par.id)
        tenant_db.add(p1)
        tenant_db.add(p2)
        tenant_db.flush()

        assert p1.exchange_rate_id != p2.exchange_rate_id
        assert p1.exchange_rate_id == tasa_bcv.id
        assert p2.exchange_rate_id == tasa_par.id


# ---------------------------------------------------------------------------
# FTC03 — Valuación de crédito pendiente en Bs
# ---------------------------------------------------------------------------

class TestFTC03ValuacionCredito:

    def test_valuacion_completa_credito(self, tenant_db):
        """
        FTC03a: Deuda total en Bs = balance_pending × rate.
        Un cliente debe $50 USD con tasa BCV = 40 → debe 2000 Bs.
        """
        tasa = _nueva_tasa(tenant_db, name=f"BCV Val {uuid.uuid4().hex[:4]}",
                            rate=Decimal("40.00"))

        balance_pending = Decimal("50.00")
        valuacion_bs = balance_pending * tasa.rate

        assert valuacion_bs == Decimal("2000.0000")

    def test_valuacion_proporcional_pago_parcial(self, tenant_db):
        """
        FTC03b: Si el cliente pagó parte de la deuda, la valuación en Bs
        debe ser proporcional al saldo pendiente.

        Venta total: $100, pagado: $60, pendiente: $40.
        Tasa: 45 Bs/USD → valuación = 40 × 45 = 1800 Bs.
        """
        tasa = _nueva_tasa(tenant_db, name=f"BCV Prop {uuid.uuid4().hex[:4]}",
                            rate=Decimal("45.00"))

        total_venta = Decimal("100.00")
        pagado = Decimal("60.00")
        pendiente = total_venta - pagado

        valuacion_bs = pendiente * tasa.rate

        assert pendiente == Decimal("40.00")
        assert valuacion_bs == Decimal("1800.0000")

    def test_valuacion_cero_si_deuda_pagada(self, tenant_db):
        """
        FTC03c: Si balance_pending = 0 (deuda saldada), valuación en Bs = 0.
        """
        tasa = _nueva_tasa(tenant_db, name=f"BCV Cero {uuid.uuid4().hex[:4]}",
                            rate=Decimal("50.00"))

        balance_pending = Decimal("0.00")
        valuacion_bs = balance_pending * tasa.rate

        assert valuacion_bs == Decimal("0.00")


# ---------------------------------------------------------------------------
# FTC04 — Coexistencia de múltiples tasas activas
# ---------------------------------------------------------------------------

class TestFTC04MultipleTasas:

    def test_bcv_y_paralelo_coexisten(self, tenant_db):
        """
        FTC04a: El sistema permite múltiples tasas activas simultáneamente
        (BCV, Paralelo, Preferencial). Cada producto elige la suya.
        """
        bcv = _nueva_tasa(tenant_db, name=f"BCV {uuid.uuid4().hex[:4]}",
                           rate=Decimal("40.00"), is_default=True)
        paralelo = _nueva_tasa(tenant_db, name=f"Paralelo {uuid.uuid4().hex[:4]}",
                                rate=Decimal("65.00"), is_default=False)
        preferencial = _nueva_tasa(tenant_db, name=f"Pref {uuid.uuid4().hex[:4]}",
                                    rate=Decimal("38.00"), is_default=False)

        # Las tres están activas
        ids = [bcv.id, paralelo.id, preferencial.id]
        activas = tenant_db.query(ExchangeRate).filter(
            ExchangeRate.id.in_(ids),
            ExchangeRate.is_active == True,
        ).all()
        assert len(activas) == 3

    def test_tasa_con_distintos_currency_code(self, tenant_db):
        """
        FTC04b: El sistema puede tener tasas para distintas monedas
        (VES y COP, por ejemplo). Cada currency_code es independiente.
        """
        tasa_ves = ExchangeRate(
            name=f"BCV VES {uuid.uuid4().hex[:4]}",
            currency_code="VES", currency_symbol="Bs",
            rate=Decimal("40.00"), is_default=True, is_active=True,
        )
        tasa_cop = ExchangeRate(
            name=f"COP Rate {uuid.uuid4().hex[:4]}",
            currency_code="COP", currency_symbol="$CO",
            rate=Decimal("4200.00"), is_default=True, is_active=True,
        )
        tenant_db.add(tasa_ves)
        tenant_db.add(tasa_cop)
        tenant_db.flush()

        assert tasa_ves.currency_code == "VES"
        assert tasa_cop.currency_code == "COP"

        # Cada currency puede tener su propio default sin conflicto de negocio
        tasas_default = tenant_db.query(ExchangeRate).filter(
            ExchangeRate.id.in_([tasa_ves.id, tasa_cop.id]),
            ExchangeRate.is_default == True,
        ).all()
        assert len(tasas_default) == 2  # Una por currency code
