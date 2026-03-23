"""
test_exchange_rate_precision.py — Tests de precisión decimal en ExchangeRate

Flujos cubiertos:
  ERP01 — Precisión de 8 decimales en BD (PostgreSQL real)
           Verifica que tasas micro-moneda (e.g., COP/USD ~ 0.000269)
           se almacenan y recuperan con exactitud completa usando Numeric(20,8).
  ERP02 — Matemática pura con 8 decimales (sin BD, siempre corren)
           Demuestra el bug antiguo (round a 4 decimales trunca micro-tasas)
           y el fix correcto (round a 8 decimales preserva el valor).
  ERP03 — Validación de inputs multi-moneda (sin BD)
           Verifica que varias micro-monedas con tasas similares no colisionan
           al almacenarse/recuperarse con 8 decimales.

Contexto del bug:
  Antes de la migración a Numeric(20,8), el campo rate era Numeric(14,4).
  Una tasa COP/USD de 0.000269 con 4 decimales se truncaba a 0.0003,
  causando conversiones incorrectas. Con 8 decimales el valor es exacto.

Estos tests usan dos estrategias:
  • PostgreSQL real (pg_db_for_schema): ERP01
    Requieren TEST_DATABASE_URL o el servidor PostgreSQL de test en localhost:5434.
  • Tests puros sin BD: ERP02, ERP03
    Disponibles siempre, sin servidor PostgreSQL.

Correr todos:
    cd ferreteria_refactor
    python -m pytest backend_api/tests/test_exchange_rate_precision.py -v --no-cov -s

Solo tests sin Postgres:
    python -m pytest backend_api/tests/test_exchange_rate_precision.py::TestERP02MatematicaPura -v --no-cov -s
    python -m pytest backend_api/tests/test_exchange_rate_precision.py::TestERP03ValidacionInputs -v --no-cov -s
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

# Tasas micro-moneda (COP/USD y similares) — el valor "real" es < 0.001
TASA_COP_EXACTA   = Decimal("0.00026900")   # ~1/3717 — tasa de prueba ERP01a
TASA_1_4200       = Decimal("0.00023810")   # 1/4200 truncado a 8 decimales
TASA_GRANDE       = Decimal("4200.00000000")  # tasas grandes (COP por USD, no inverso)

# Tres tasas micro distintas para ERP01d
MICRO_TASAS = [
    Decimal("0.00023400"),
    Decimal("0.00045600"),
    Decimal("0.00078900"),
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _nueva_tasa(db, *, rate, currency_code="COP", currency_symbol="$CO",
                name=None, is_default=False, is_active=True):
    """Crea una ExchangeRate con los parámetros dados y hace flush. Retorna el objeto."""
    tasa = ExchangeRate(
        name=name or f"Test Rate {uuid.uuid4().hex[:6]}",
        currency_code=currency_code,
        currency_symbol=currency_symbol,
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
# ERP01 — Precisión de 8 decimales en BD (PostgreSQL real)
# ===========================================================================

class TestERP01PrecisionBD:
    """
    Verifica que el campo rate (Numeric(20,8)) almacena y devuelve
    micro-tasas con exactitud completa. Antes de la migración a 8 decimales,
    0.000269 se truncaba a 0.0003 (Numeric(14,4)), produciendo errores
    de conversión de hasta ~10% en monedas como COP.

    Requiere PostgreSQL real — se salta automáticamente si no hay servidor.
    """

    def test_tasa_0_000269_se_almacena_exacta(self, tenant_db):
        """
        ERP01a: Crear ExchangeRate con rate=0.00026900 y verificar que se lee
        de vuelta con el mismo valor exacto, no 0.0003 (que sería el resultado
        incorrecto con Numeric(14,4) — solo 4 decimales).
        """
        if not MODELS_AVAILABLE:
            pytest.skip(f"Modelos no disponibles: {_import_err_msg}")

        tasa = _nueva_tasa(tenant_db, rate=TASA_COP_EXACTA, name=f"ERP01a {uuid.uuid4().hex[:4]}")

        tenant_db.refresh(tasa)
        assert tasa.rate == TASA_COP_EXACTA, (
            f"ERP01a: rate almacenado {tasa.rate} != esperado {TASA_COP_EXACTA}. "
            f"¿Está el campo como Numeric(20,8)? Con Numeric(14,4) el resultado sería 0.0003."
        )
        # Guardia explícita contra el bug antiguo
        assert tasa.rate != Decimal("0.0003"), (
            "ERP01a: La tasa colapsó a 0.0003 — el campo solo tiene 4 decimales (bug antiguo)."
        )

    def test_tasa_8_decimales_sin_perdida(self, tenant_db):
        """
        ERP01b: rate=0.00023810 (aproximación de 1/4200 a 8 decimales).
        Verifica que todos los 8 decimales se preservan sin pérdida.
        Antes del fix: 1/4200 ≈ 0.0002 con 4 decimales, error de ~19%.
        """
        if not MODELS_AVAILABLE:
            pytest.skip(f"Modelos no disponibles: {_import_err_msg}")

        tasa = _nueva_tasa(tenant_db, rate=TASA_1_4200, name=f"ERP01b {uuid.uuid4().hex[:4]}")

        tenant_db.refresh(tasa)
        assert tasa.rate == TASA_1_4200, (
            f"ERP01b: rate almacenado {tasa.rate} != esperado {TASA_1_4200}. "
            f"Pérdida de precisión detectada."
        )

    def test_tasa_grande_mantiene_precision(self, tenant_db):
        """
        ERP01c: rate=4200.00000000 — las tasas grandes (e.g., cuántos COP vale 1 USD)
        también deben almacenarse con exactitud. Verifica que Numeric(20,8) maneja
        correctamente la parte entera grande junto a los 8 decimales.
        """
        if not MODELS_AVAILABLE:
            pytest.skip(f"Modelos no disponibles: {_import_err_msg}")

        tasa = _nueva_tasa(tenant_db, rate=TASA_GRANDE, name=f"ERP01c {uuid.uuid4().hex[:4]}")

        tenant_db.refresh(tasa)
        assert tasa.rate == TASA_GRANDE, (
            f"ERP01c: rate almacenado {tasa.rate} != esperado {TASA_GRANDE}."
        )

    def test_varias_tasas_micro_distintas(self, tenant_db):
        """
        ERP01d: Crear 3 tasas con rates micro distintos (0.000234, 0.000456, 0.000789)
        y verificar que cada una se almacena con su valor único — no se colapsan
        a un mismo valor redondeado como ocurriría con 4 decimales, donde
        0.000234 y 0.000456 ambas se convertirían en 0.0002/0.0005 incorrectamente.
        """
        if not MODELS_AVAILABLE:
            pytest.skip(f"Modelos no disponibles: {_import_err_msg}")

        tasas_creadas = []
        for i, rate in enumerate(MICRO_TASAS):
            t = _nueva_tasa(
                tenant_db,
                rate=rate,
                name=f"ERP01d-{i} {uuid.uuid4().hex[:4]}",
            )
            tasas_creadas.append(t)

        # Refrescar todas y verificar que cada una tiene su rate exacto
        for tasa, rate_esperado in zip(tasas_creadas, MICRO_TASAS):
            tenant_db.refresh(tasa)
            assert tasa.rate == rate_esperado, (
                f"ERP01d: Tasa {tasa.name}: almacenado {tasa.rate} != esperado {rate_esperado}. "
                f"Las micro-tasas se están colapsando."
            )

        # Verificar que los rates leídos son todos distintos entre sí
        rates_leidos = [t.rate for t in tasas_creadas]
        assert len(set(rates_leidos)) == len(MICRO_TASAS), (
            f"ERP01d: Dos o más tasas colapsaron al mismo valor: {rates_leidos}. "
            f"Esto indica precisión insuficiente en la BD."
        )


# ===========================================================================
# ERP02 — Matemática pura con 8 decimales (sin BD, siempre corren)
# ===========================================================================

class TestERP02MatematicaPura:
    """
    Tests puramente aritméticos que demuestran el bug de precisión (4 decimales)
    y el fix correcto (8 decimales). No requieren base de datos.

    Contexto: el sistema usa Decimal de Python para conversiones de moneda.
    Una micro-tasa como 0.000269 (COP/USD) necesita al menos 6 decimales
    significativos para ser útil; con 4 decimales se convierte en 0.0003
    (+11.5% de error), que causa pérdidas en transacciones grandes.
    """

    def test_round4_trunca_000269(self):
        """
        ERP02a: Demostrar que round(0.000269, 4) = 0.0003 — el bug antiguo.
        Con solo 4 decimales, la micro-tasa 0.000269 se redondea a 0.0003,
        un error de +11.5%. En una venta de 1,000,000 COP esto implica
        cobrar $300 USD en vez de $269 USD.
        """
        valor = 0.000269
        redondeado_4 = round(valor, 4)
        assert redondeado_4 == 0.0003, (
            f"ERP02a: Se esperaba demostrar round(0.000269, 4) == 0.0003, "
            f"pero el resultado fue {redondeado_4}."
        )

    def test_round8_preserva_000269(self):
        """
        ERP02b: round(0.000269, 8) = 0.000269 — la corrección.
        Con 8 decimales la micro-tasa se preserva sin alteración.
        """
        valor = 0.000269
        redondeado_8 = round(valor, 8)
        assert redondeado_8 == 0.000269, (
            f"ERP02b: round(0.000269, 8) debería ser 0.000269, "
            f"pero fue {redondeado_8}."
        )

    def test_inversion_cop_usd(self):
        """
        ERP02c: 1 / Decimal("4200") con cuantización a 8 decimales = 0.00023810.
        Verifica que la inversión de la tasa COP→USD produce el valor correcto
        con 8 decimales de precisión.
        """
        tasa_cop_por_usd = Decimal("4200")
        tasa_usd_por_cop = (Decimal("1") / tasa_cop_por_usd).quantize(
            Decimal("0.00000001"), rounding=ROUND_HALF_UP
        )
        assert tasa_usd_por_cop == Decimal("0.00023810"), (
            f"ERP02c: 1/4200 a 8 decimales = {tasa_usd_por_cop}, esperado 0.00023810."
        )

    def test_conversion_micro_rate(self):
        """
        ERP02d: Decimal("100") * Decimal("0.00026900") = Decimal("0.026900").
        Verifica la multiplicación directa con una micro-tasa — 100 COP
        a tasa 0.000269 USD/COP equivalen a $0.0269 USD.
        """
        cantidad_cop = Decimal("100")
        tasa_usd_por_cop = Decimal("0.00026900")
        resultado_usd = cantidad_cop * tasa_usd_por_cop
        assert resultado_usd == Decimal("0.026900"), (
            f"ERP02d: 100 * 0.00026900 = {resultado_usd}, esperado 0.026900."
        )

    def test_round_trip_micro(self):
        """
        ERP02e: Conversión ida y vuelta USD → micro-moneda → USD debe
        recuperar el valor original dentro de ±0.01 USD.
        Ejemplo: 50 USD a tasa COP 4200 → 210,000 COP → 50 USD (exacto).
        """
        usd_original = Decimal("50.00")
        tasa_cop_por_usd = Decimal("4200.00000000")

        # USD → COP
        cop = usd_original * tasa_cop_por_usd          # 210000.0000000000

        # COP → USD (usando tasa invertida con 8 decimales)
        tasa_usd_por_cop = (Decimal("1") / tasa_cop_por_usd).quantize(
            Decimal("0.00000001"), rounding=ROUND_HALF_UP
        )
        usd_recuperado = (cop * tasa_usd_por_cop).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )

        diferencia = abs(usd_original - usd_recuperado)
        assert diferencia <= Decimal("0.01"), (
            f"ERP02e: Round-trip USD→COP→USD con error {diferencia} > 0.01. "
            f"Original: {usd_original} USD, recuperado: {usd_recuperado} USD."
        )

    def test_diferencia_round4_vs_round8(self):
        """
        ERP02f: Para rate 0.000269, round(x, 4) != round(x, 8).
        Demuestra concretamente que el impacto del bug es real y medible —
        las dos versiones de redondeo producen valores distintos.
        """
        valor = 0.000269
        r4 = round(valor, 4)
        r8 = round(valor, 8)
        assert r4 != r8, (
            f"ERP02f: Se esperaba que round({valor}, 4) != round({valor}, 8), "
            f"pero ambos dieron {r4}. El test de impacto del bug no es válido."
        )
        # Documentar la magnitud del error
        error_relativo = abs(r4 - r8) / r8
        assert error_relativo > 0.10, (
            f"ERP02f: El error relativo entre 4 y 8 decimales es {error_relativo:.2%}, "
            f"se esperaba > 10% para demostrar impacto significativo."
        )


# ===========================================================================
# ERP03 — Validación de inputs multi-moneda (sin BD)
# ===========================================================================

class TestERP03ValidacionInputs:
    """
    Verifica que múltiples monedas con micro-tasas similares no colisionan
    al ser almacenadas y recuperadas con precisión de 8 decimales.
    Tests puramente aritméticos — no requieren base de datos.
    """

    def test_rates_distintos_micro_monedas(self):
        """
        ERP03a: Dict de 5 monedas con tasas micro-pequeñas distintas.
        Almacenar con 8 decimales y verificar que ninguna colisiona al recuperar.
        Simula el escenario donde el sistema maneja COP, PEN, BOB, PYG, UYU
        todas con tasas < 0.01 USD por unidad.
        """
        monedas = {
            "COP": Decimal("0.00026900"),   # Peso colombiano ~3717/USD
            "PEN": Decimal("0.00027200"),   # Sol peruano (ficticio para test)
            "BOB": Decimal("0.00014500"),   # Boliviano (ficticio para test)
            "PYG": Decimal("0.00013800"),   # Guaraní paraguayo (ficticio)
            "UYU": Decimal("0.00025600"),   # Peso uruguayo (ficticio para test)
        }

        # Simular almacenamiento y recuperación con 8 decimales
        almacenados = {}
        for codigo, rate in monedas.items():
            # Quantize a 8 decimales (como lo haría Numeric(20,8) en PostgreSQL)
            almacenados[codigo] = rate.quantize(Decimal("0.00000001"))

        # Verificar que ningún rate colisionó con otro
        valores = list(almacenados.values())
        assert len(set(valores)) == len(monedas), (
            f"ERP03a: Colisión detectada entre micro-tasas al almacenar con 8 decimales. "
            f"Valores: {almacenados}. "
            f"Con 4 decimales muchas de estas tasas colapsarían al mismo valor."
        )

        # Verificar que cada moneda mantiene su rate exacto
        for codigo, rate_original in monedas.items():
            rate_recuperado = almacenados[codigo]
            assert rate_recuperado == rate_original, (
                f"ERP03a: Moneda {codigo}: rate recuperado {rate_recuperado} "
                f"!= original {rate_original}."
            )

    def test_bcv_scraping_round8(self):
        """
        ERP03b: Simular que el scraping BCV devuelve "0,000269" (formato venezolano
        con coma decimal), parsear a float, luego round(float, 8) → 0.000269.
        Verifica que el pipeline de scraping → almacenamiento preserva la precisión
        cuando se usa round a 8 decimales en lugar de 4.
        """
        # Simular el string que devuelve el scraper BCV (formato venezolano)
        valor_scraping = "0,000269"

        # Pipeline de parseo: reemplazar coma por punto y convertir a float
        valor_float = float(valor_scraping.replace(",", "."))

        # Almacenar con 8 decimales (el fix correcto)
        valor_round8 = round(valor_float, 8)

        assert valor_round8 == 0.000269, (
            f"ERP03b: El pipeline scraping→round8 produjo {valor_round8}, "
            f"esperado 0.000269. El parseo del formato BCV venezolano falla."
        )

        # Guardia: demostrar que round4 habría dado el resultado incorrecto
        valor_round4 = round(valor_float, 4)
        assert valor_round4 != 0.000269, (
            f"ERP03b: round4 inesperadamente preservó 0.000269 — "
            f"el test de regresión no es válido."
        )
        assert valor_round4 == 0.0003, (
            f"ERP03b: Con round4, el scraping debería haber producido 0.0003 (bug), "
            f"pero produjo {valor_round4}."
        )
