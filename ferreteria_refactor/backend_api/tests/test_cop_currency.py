"""
test_cop_currency.py — Tests funcionales de Moneda COP (Peso Colombiano)

Flujos cubiertos:
  FCC01 — Crear tasa COP y verificar que persiste correctamente
  FCC02 — Crear tasa COP via ORM y leerla de vuelta (simula POST al modelo)
  FCC03 — Conversión matemática COP ↔ USD (test puro, sin BD)
  FCC04 — Filtro por currency_code devuelve solo COP (no VES ni otras)
  FCC05 — Activar / desactivar tasa COP: is_active se filtra correctamente
  FCC06 — Placeholder: integración con ventas (documentado, no ejecutado)

Estos tests usan dos estrategias:
  • PostgreSQL real (pg_db_for_schema): FCC01, FCC02, FCC04, FCC05
    Requieren TEST_DATABASE_URL o el servidor PostgreSQL de test en localhost:5434.
  • SQLite en memoria (db_session): FCC03 (matemática pura, sin BD)
    Disponible sin servidor PostgreSQL.

Correr con:
    cd ferreteria_refactor
    python -m pytest backend_api/tests/test_cop_currency.py -v --no-cov -s

Solo tests SQLite (sin Postgres):
    python -m pytest backend_api/tests/test_cop_currency.py::TestFCC03Conversion -v --no-cov -s
"""

import pytest
import uuid
from decimal import Decimal, ROUND_HALF_UP

import sys
import os

_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _root not in sys.path:
    sys.path.insert(0, _root)

# ---------------------------------------------------------------------------
# Importaciones condicionales — el suite no revienta si los modelos no cargan
# ---------------------------------------------------------------------------

try:
    from backend_api.models.models import ExchangeRate

    MODELS_AVAILABLE = True
except Exception as _import_err:
    MODELS_AVAILABLE = False
    _import_err_msg = str(_import_err)

# ---------------------------------------------------------------------------
# Constantes de prueba
# ---------------------------------------------------------------------------

TENANT = "lalicoreria"

COP_CODE = "COP"
COP_SYMBOL = "$CO"
COP_RATE_STD = Decimal("4200.00")   # Tasa estándar de prueba (COP por 1 USD)
COP_RATE_ALT = Decimal("4350.00")   # Tasa alternativa para escenarios de cambio


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _nueva_tasa_cop(db, *, rate=None, name=None, is_default=True, is_active=True):
    """Crea una ExchangeRate COP y hace flush. Retorna el objeto."""
    tasa = ExchangeRate(
        name=name or f"COP Rate {uuid.uuid4().hex[:6]}",
        currency_code=COP_CODE,
        currency_symbol=COP_SYMBOL,
        rate=rate if rate is not None else COP_RATE_STD,
        is_default=is_default,
        is_active=is_active,
    )
    db.add(tasa)
    db.flush()
    return tasa


def _nueva_tasa_ves(db, *, rate=Decimal("40.00"), name=None, is_default=False, is_active=True):
    """Crea una ExchangeRate VES y hace flush. Retorna el objeto."""
    tasa = ExchangeRate(
        name=name or f"BCV VES {uuid.uuid4().hex[:6]}",
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
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def tenant_db(pg_db_for_schema):
    """Sesión PostgreSQL en el schema del tenant de prueba."""
    return pg_db_for_schema(TENANT)


# ===========================================================================
# FCC01 — Crear tasa COP y verificar persistencia de campos
# ===========================================================================

class TestFCC01CrearTasaCOP:
    """
    Verifica que todos los campos de una tasa COP persisten correctamente
    en la BD. Equivale a lo que haría POST /api/v1/config/exchange-rates
    con currency_code='COP'.
    """

    def test_cop_campos_basicos_persisten(self, tenant_db):
        """
        FCC01a: Crear una tasa COP y verificar que currency_code, symbol,
        rate, is_active e id se almacenan sin alteraciones.
        """
        if not MODELS_AVAILABLE:
            pytest.skip(f"Modelos no disponibles: {_import_err_msg}")

        tasa = _nueva_tasa_cop(tenant_db, rate=COP_RATE_STD)

        tenant_db.refresh(tasa)
        assert tasa.id is not None, "La tasa COP debe tener un ID asignado tras flush"
        assert tasa.currency_code == COP_CODE
        assert tasa.currency_symbol == COP_SYMBOL
        assert tasa.rate == COP_RATE_STD
        assert tasa.is_active is True

    def test_cop_is_default_persiste(self, tenant_db):
        """
        FCC01b: Una tasa COP marcada como is_default=True almacena ese valor
        en la BD. La lógica de unicidad por currency_code es del router.
        """
        if not MODELS_AVAILABLE:
            pytest.skip(f"Modelos no disponibles: {_import_err_msg}")

        tasa = _nueva_tasa_cop(tenant_db, is_default=True)

        tenant_db.refresh(tasa)
        assert tasa.is_default is True

    def test_cop_created_at_se_asigna_automaticamente(self, tenant_db):
        """
        FCC01c: El campo created_at debe asignarse automáticamente al crear
        la tasa (no puede ser None tras flush).
        """
        if not MODELS_AVAILABLE:
            pytest.skip(f"Modelos no disponibles: {_import_err_msg}")

        tasa = _nueva_tasa_cop(tenant_db)

        tenant_db.refresh(tasa)
        assert tasa.created_at is not None, "created_at debe asignarse automáticamente"

    def test_cop_incluida_en_consulta_de_tasas_activas(self, tenant_db):
        """
        FCC01d: La tasa COP recién creada debe aparecer en la consulta de tasas
        activas filtrada por currency_code='COP'. Simula lo que devuelve
        GET /api/v1/config/exchange-rates.
        """
        if not MODELS_AVAILABLE:
            pytest.skip(f"Modelos no disponibles: {_import_err_msg}")

        tasa = _nueva_tasa_cop(tenant_db, rate=COP_RATE_STD, is_active=True)

        resultado = (
            tenant_db.query(ExchangeRate)
            .filter(
                ExchangeRate.id == tasa.id,
                ExchangeRate.currency_code == COP_CODE,
                ExchangeRate.is_active == True,
            )
            .first()
        )

        assert resultado is not None, "La tasa COP activa debe aparecer en la consulta"
        assert resultado.currency_code == COP_CODE
        assert resultado.is_active is True


# ===========================================================================
# FCC02 — Crear tasa COP con rate=4200.00 (simula POST payload completo)
# ===========================================================================

class TestFCC02CrearTasaCOPPayload:
    """
    Simula el payload que enviaría un cliente en POST /api/v1/config/exchange-rates
    con los datos de COP. Verifica que el objeto persistido refleja exactamente
    los valores enviados — currency_code='COP', rate=4200.00.
    """

    def test_crear_cop_rate_4200(self, tenant_db):
        """
        FCC02a: Crear tasa COP con rate=4200.00 y verificar que se almacena
        con el valor exacto (sin redondeos ni truncados inesperados).
        """
        if not MODELS_AVAILABLE:
            pytest.skip(f"Modelos no disponibles: {_import_err_msg}")

        tasa = _nueva_tasa_cop(tenant_db, rate=Decimal("4200.00"), name="COP Oficial")

        tenant_db.refresh(tasa)
        assert tasa.currency_code == COP_CODE, (
            f"currency_code esperado 'COP', obtenido '{tasa.currency_code}'"
        )
        assert tasa.rate == Decimal("4200.00"), (
            f"rate esperado 4200.00, obtenido {tasa.rate}"
        )

    def test_crear_cop_rate_con_decimales(self, tenant_db):
        """
        FCC02b: El campo rate soporta 4 decimales (Numeric 14,4). Una tasa
        como 4199.5000 debe almacenarse sin pérdida de precisión.
        """
        if not MODELS_AVAILABLE:
            pytest.skip(f"Modelos no disponibles: {_import_err_msg}")

        tasa = _nueva_tasa_cop(
            tenant_db,
            rate=Decimal("4199.5000"),
            name=f"COP Decimal {uuid.uuid4().hex[:4]}",
        )

        tenant_db.refresh(tasa)
        assert tasa.rate == Decimal("4199.5000"), (
            f"Precisión de decimales perdida: esperado 4199.5000, obtenido {tasa.rate}"
        )

    def test_multiples_tasas_cop_distintos_nombres(self, tenant_db):
        """
        FCC02c: Es posible crear múltiples tasas COP (e.g., 'COP Oficial' y
        'COP Paralelo') con rates distintos. El modelo no impone unicidad de rate.
        """
        if not MODELS_AVAILABLE:
            pytest.skip(f"Modelos no disponibles: {_import_err_msg}")

        tasa_oficial = _nueva_tasa_cop(
            tenant_db,
            rate=Decimal("4200.00"),
            name=f"COP Oficial {uuid.uuid4().hex[:4]}",
            is_default=True,
        )
        tasa_paralelo = _nueva_tasa_cop(
            tenant_db,
            rate=Decimal("4350.00"),
            name=f"COP Paralelo {uuid.uuid4().hex[:4]}",
            is_default=False,
        )

        assert tasa_oficial.id != tasa_paralelo.id
        assert tasa_oficial.rate == Decimal("4200.00")
        assert tasa_paralelo.rate == Decimal("4350.00")
        assert tasa_oficial.currency_code == tasa_paralelo.currency_code == COP_CODE


# ===========================================================================
# FCC03 — Conversión matemática COP ↔ USD (tests puros, sin BD)
# ===========================================================================

class TestFCC03Conversion:
    """
    Verifica la aritmética de conversión entre COP y USD.
    No requiere base de datos — son tests puramente matemáticos.

    El modelo almacena `rate` como la cantidad de COP por 1 USD.
    Fórmula:  USD = COP_amount / rate
              COP = USD_amount × rate
    """

    def test_200000_cop_a_usd_con_tasa_4200(self):
        """
        FCC03a: 200 000 COP / 4200 COP/USD = 47.619047... ≈ 47.62 USD
        Verifica el redondeo a 2 decimales con ROUND_HALF_UP.
        """
        cop_amount = Decimal("200000")
        rate = Decimal("4200.00")
        usd = (cop_amount / rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        assert usd == Decimal("47.62"), (
            f"Conversión incorrecta: 200000 COP / 4200 = {usd} (esperado 47.62)"
        )

    def test_100_usd_a_cop_con_tasa_4200(self):
        """
        FCC03b: 100 USD × 4200 COP/USD = 420 000 COP (exacto, sin redondeo).
        """
        usd_amount = Decimal("100.00")
        rate = Decimal("4200.00")
        cop = usd_amount * rate
        assert cop == Decimal("420000.0000"), (
            f"Conversión incorrecta: 100 USD × 4200 = {cop} (esperado 420000.0000)"
        )

    def test_1_usd_a_cop_con_tasa_4350(self):
        """
        FCC03c: 1 USD × 4350 = 4350 COP. Tasa alternativa, resultado exacto.
        """
        usd_amount = Decimal("1.00")
        rate = Decimal("4350.00")
        cop = usd_amount * rate
        assert cop == Decimal("4350.0000")

    def test_cop_a_usd_redondeo_correcto(self):
        """
        FCC03d: Casos límite de redondeo — el resultado se redondea
        correctamente a 2 decimales con ROUND_HALF_UP.

        50000 COP / 4200 = 11.904761... → 11.90 (no 11.91)
        """
        cop_amount = Decimal("50000")
        rate = Decimal("4200.00")
        usd = (cop_amount / rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        assert usd == Decimal("11.90"), (
            f"Redondeo incorrecto: 50000 / 4200 = {usd} (esperado 11.90)"
        )

    def test_tasa_cero_levanta_exception(self):
        """
        FCC03e: Dividir entre tasa cero debe levantar ZeroDivisionError.
        El código de producción debe validar rate > 0 antes de dividir.
        """
        cop_amount = Decimal("100000")
        rate = Decimal("0")
        with pytest.raises((ZeroDivisionError, Exception)):
            _ = cop_amount / rate

    def test_conversion_ida_y_vuelta(self):
        """
        FCC03f: Convertir USD→COP→USD debe recuperar el valor original
        dentro de un margen de 0.01 USD (pérdida de precisión esperada
        por redondeo a 2 decimales en el paso intermedio).
        """
        usd_original = Decimal("150.00")
        rate = Decimal("4200.00")

        cop = usd_original * rate                                         # → 630000.0000
        usd_recuperado = (cop / rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

        diferencia = abs(usd_original - usd_recuperado)
        assert diferencia <= Decimal("0.01"), (
            f"Conversión ida-vuelta con error {diferencia} > 0.01: "
            f"{usd_original} USD → {cop} COP → {usd_recuperado} USD"
        )


# ===========================================================================
# FCC04 — Filtro por currency_code devuelve solo COP
# ===========================================================================

class TestFCC04FiltrarPorCurrencyCode:
    """
    Verifica que filtrar por currency_code='COP' excluye tasas de otras monedas
    (VES, USD, etc.). Simula la query interna de
    GET /api/v1/config/exchange-rates?currency_code=COP.
    """

    def test_filtro_cop_excluye_ves(self, tenant_db):
        """
        FCC04a: Crear tasa COP y tasa VES. Filtrar por COP devuelve solo
        la tasa COP; la VES no aparece.
        """
        if not MODELS_AVAILABLE:
            pytest.skip(f"Modelos no disponibles: {_import_err_msg}")

        tasa_cop = _nueva_tasa_cop(tenant_db)
        tasa_ves = _nueva_tasa_ves(tenant_db)

        resultado = (
            tenant_db.query(ExchangeRate)
            .filter(
                ExchangeRate.id.in_([tasa_cop.id, tasa_ves.id]),
                ExchangeRate.currency_code == COP_CODE,
            )
            .all()
        )

        ids_resultado = [t.id for t in resultado]
        assert tasa_cop.id in ids_resultado, "La tasa COP debe aparecer en el filtro"
        assert tasa_ves.id not in ids_resultado, "La tasa VES NO debe aparecer al filtrar por COP"

    def test_filtro_cop_devuelve_todas_las_tasas_cop(self, tenant_db):
        """
        FCC04b: Si existen dos tasas COP (oficial y paralelo), el filtro
        por currency_code='COP' devuelve ambas.
        """
        if not MODELS_AVAILABLE:
            pytest.skip(f"Modelos no disponibles: {_import_err_msg}")

        tasa_cop_1 = _nueva_tasa_cop(
            tenant_db,
            rate=Decimal("4200.00"),
            name=f"COP A {uuid.uuid4().hex[:4]}",
            is_default=True,
        )
        tasa_cop_2 = _nueva_tasa_cop(
            tenant_db,
            rate=Decimal("4350.00"),
            name=f"COP B {uuid.uuid4().hex[:4]}",
            is_default=False,
        )
        tasa_ves = _nueva_tasa_ves(tenant_db)

        resultado = (
            tenant_db.query(ExchangeRate)
            .filter(
                ExchangeRate.id.in_([tasa_cop_1.id, tasa_cop_2.id, tasa_ves.id]),
                ExchangeRate.currency_code == COP_CODE,
            )
            .all()
        )

        ids_resultado = [t.id for t in resultado]
        assert tasa_cop_1.id in ids_resultado
        assert tasa_cop_2.id in ids_resultado
        assert tasa_ves.id not in ids_resultado
        assert len(ids_resultado) == 2

    def test_filtro_ves_no_incluye_cop(self, tenant_db):
        """
        FCC04c: El filtro inverso — filtrar por VES no debe incluir COP.
        Garantiza que currency_code actúa como discriminador estricto.
        """
        if not MODELS_AVAILABLE:
            pytest.skip(f"Modelos no disponibles: {_import_err_msg}")

        tasa_cop = _nueva_tasa_cop(tenant_db)
        tasa_ves = _nueva_tasa_ves(tenant_db)

        resultado = (
            tenant_db.query(ExchangeRate)
            .filter(
                ExchangeRate.id.in_([tasa_cop.id, tasa_ves.id]),
                ExchangeRate.currency_code == "VES",
            )
            .all()
        )

        ids_resultado = [t.id for t in resultado]
        assert tasa_ves.id in ids_resultado
        assert tasa_cop.id not in ids_resultado


# ===========================================================================
# FCC05 — Activar / desactivar tasa COP
# ===========================================================================

class TestFCC05ActivarDesactivar:
    """
    Verifica el ciclo de vida is_active de una tasa COP.
    Simula el flujo completo de:
      1. Crear tasa activa → aparece en consulta is_active=True
      2. Desactivarla (PUT /api/v1/config/exchange-rates/{id} con is_active=False)
      3. Ya no aparece en consulta is_active=True
      4. Sigue apareciendo en consulta sin filtro is_active
    """

    def test_tasa_cop_activa_aparece_en_filtro_activas(self, tenant_db):
        """
        FCC05a: Una tasa COP con is_active=True debe aparecer al filtrar
        por is_active=True. Simula GET ...?is_active=true.
        """
        if not MODELS_AVAILABLE:
            pytest.skip(f"Modelos no disponibles: {_import_err_msg}")

        tasa = _nueva_tasa_cop(tenant_db, is_active=True)

        activas = (
            tenant_db.query(ExchangeRate)
            .filter(
                ExchangeRate.id == tasa.id,
                ExchangeRate.is_active == True,
            )
            .all()
        )

        assert len(activas) == 1
        assert activas[0].id == tasa.id

    def test_tasa_cop_inactiva_no_aparece_en_filtro_activas(self, tenant_db):
        """
        FCC05b: Una tasa COP con is_active=False NO debe aparecer al filtrar
        por is_active=True.
        """
        if not MODELS_AVAILABLE:
            pytest.skip(f"Modelos no disponibles: {_import_err_msg}")

        tasa = _nueva_tasa_cop(tenant_db, is_active=False)

        activas = (
            tenant_db.query(ExchangeRate)
            .filter(
                ExchangeRate.id == tasa.id,
                ExchangeRate.is_active == True,
            )
            .all()
        )

        assert len(activas) == 0, (
            "Una tasa COP inactiva no debe aparecer en el filtro is_active=True"
        )

    def test_desactivar_tasa_cop_activa(self, tenant_db):
        """
        FCC05c: Flujo completo — crear tasa activa, desactivarla via ORM
        (equivalente al PUT del router), verificar que ya no aparece en activas.
        """
        if not MODELS_AVAILABLE:
            pytest.skip(f"Modelos no disponibles: {_import_err_msg}")

        # Paso 1: crear tasa activa
        tasa = _nueva_tasa_cop(tenant_db, is_active=True)
        assert tasa.is_active is True

        # Paso 2: desactivar (simula lógica del router PUT)
        tasa.is_active = False
        tenant_db.flush()

        # Paso 3: verificar que no aparece en activas
        activas = (
            tenant_db.query(ExchangeRate)
            .filter(
                ExchangeRate.id == tasa.id,
                ExchangeRate.is_active == True,
            )
            .all()
        )
        assert len(activas) == 0, "La tasa desactivada no debe aparecer en activas"

        # Paso 4: verificar que sigue existiendo (sin filtro is_active)
        todas = (
            tenant_db.query(ExchangeRate)
            .filter(ExchangeRate.id == tasa.id)
            .all()
        )
        assert len(todas) == 1, "La tasa desactivada debe seguir existiendo en la BD"
        assert todas[0].is_active is False

    def test_reactivar_tasa_cop_inactiva(self, tenant_db):
        """
        FCC05d: Una tasa COP previamente desactivada puede reactivarse.
        Verifica que is_active es mutable en ambas direcciones.
        """
        if not MODELS_AVAILABLE:
            pytest.skip(f"Modelos no disponibles: {_import_err_msg}")

        tasa = _nueva_tasa_cop(tenant_db, is_active=False)
        assert tasa.is_active is False

        # Reactivar
        tasa.is_active = True
        tenant_db.flush()

        tenant_db.refresh(tasa)
        assert tasa.is_active is True

    def test_cop_activa_y_ves_inactiva_filtro_independiente(self, tenant_db):
        """
        FCC05e: COP activa + VES inactiva.
        Filtrar is_active=True y currency_code=COP devuelve solo COP.
        Filtrar is_active=True y currency_code=VES no devuelve nada.
        """
        if not MODELS_AVAILABLE:
            pytest.skip(f"Modelos no disponibles: {_import_err_msg}")

        tasa_cop = _nueva_tasa_cop(tenant_db, is_active=True)
        tasa_ves = _nueva_tasa_ves(tenant_db, is_active=False)

        # COP activa → aparece
        cop_activas = (
            tenant_db.query(ExchangeRate)
            .filter(
                ExchangeRate.id.in_([tasa_cop.id, tasa_ves.id]),
                ExchangeRate.currency_code == COP_CODE,
                ExchangeRate.is_active == True,
            )
            .all()
        )
        assert len(cop_activas) == 1
        assert cop_activas[0].id == tasa_cop.id

        # VES inactiva → no aparece
        ves_activas = (
            tenant_db.query(ExchangeRate)
            .filter(
                ExchangeRate.id.in_([tasa_cop.id, tasa_ves.id]),
                ExchangeRate.currency_code == "VES",
                ExchangeRate.is_active == True,
            )
            .all()
        )
        assert len(ves_activas) == 0


# ===========================================================================
# FCC06 — Placeholder: integración con ventas (COP en SaleDetail)
# ===========================================================================

class TestFCC06IntegracionVentas:
    """
    Placeholder para tests de integración de pagos en COP dentro de ventas.

    Estos tests requieren:
    - Un endpoint de venta que acepte payment_currency='COP'
    - Lógica de conversión COP→USD en el procesamiento de la venta
    - Verificación de que el total_amount en la Sale refleja el monto en USD

    ESTADO: Pendiente de implementación cuando el endpoint de ventas
    soporte explícitamente pagos en COP (currency_code en PaymentMethod).

    Para ejecutar este placeholder (siempre skip):
        python -m pytest backend_api/tests/test_cop_currency.py::TestFCC06IntegracionVentas -v
    """

    def test_placeholder_venta_con_pago_cop(self, tenant_db):
        """
        FCC06a (PLACEHOLDER): Verificar que una venta con pago en COP
        convierte correctamente el monto al equivalente en USD usando
        la tasa COP activa del sistema.

        Ejemplo esperado:
          - Monto pagado: 840 000 COP
          - Tasa: 4200 COP/USD
          - Total venta: 840000 / 4200 = 200.00 USD

        Este test se marca skip hasta que el endpoint de ventas implemente
        soporte explícito para pagos en COP.
        """
        pytest.skip(
            "FCC06a pendiente: el endpoint de ventas aún no soporta "
            "payment_currency='COP' de forma explícita. "
            "Implementar cuando se agregue ese flujo al router de ventas."
        )

    def test_placeholder_igtf_no_aplica_a_cop(self, tenant_db):
        """
        FCC06b (PLACEHOLDER): El IGTF 3% (impuesto a transacciones en divisas)
        aplica en Venezuela solo a pagos en USD/EUR, NO a COP.
        Verificar que las ventas pagadas en COP no generan recargo IGTF.

        Nota: el IGTF actualmente se calcula en el frontend; este test
        deberá ser de integración completa cuando se mueva al backend.
        """
        pytest.skip(
            "FCC06b pendiente: lógica IGTF en backend no implementada aún. "
            "Verificar que COP queda excluido de la lista de monedas con IGTF "
            "cuando se centralice el cálculo."
        )
