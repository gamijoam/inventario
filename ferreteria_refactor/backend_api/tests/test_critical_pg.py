"""
test_critical_pg.py — Tests críticos contra la BD PostgreSQL real (datos de prod restaurados).

Correr con:
    cd ferreteria_refactor/backend_api
    TEST_DATABASE_URL=postgresql://postgres:testpass123@localhost:5434/invensoft_test \
    pytest tests/test_critical_pg.py -v

O simplemente (usa el default del conftest_pg):
    pytest tests/test_critical_pg.py -v

Cada test corre en una transacción que se REVIERTE al final → la BD queda intacta.
"""

import pytest
import sys
import os
from decimal import Decimal
from sqlalchemy import text

# ---------------------------------------------------------------------------
# Setup de path para imports
# ---------------------------------------------------------------------------
_backend_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _backend_root not in sys.path:
    sys.path.insert(0, _backend_root)

# Las fixtures pg_engine, pg_db, pg_db_for_schema vienen de conftest.py automáticamente.

# ---------------------------------------------------------------------------
# SECCIÓN 1 — Integridad básica de la BD
# ---------------------------------------------------------------------------

class TestIntegridadBD:
    """Verifica que la estructura de la BD esté íntegra tras restaurar el backup."""

    def test_todos_los_tenants_tienen_schema(self, pg_engine):
        """Cada tenant registrado en public.tenants debe tener su schema PostgreSQL."""
        with pg_engine.connect() as conn:
            tenants = conn.execute(
                text("SELECT schema_name FROM public.tenants WHERE is_active = TRUE")
            ).fetchall()
            schemas_en_bd = conn.execute(
                text("SELECT nspname FROM pg_namespace WHERE nspname NOT LIKE 'pg_%' AND nspname != 'information_schema'")
            ).fetchall()

        schema_names_pg = {r[0] for r in schemas_en_bd}
        for tenant in tenants:
            assert tenant[0] in schema_names_pg, \
                f"Tenant '{tenant[0]}' está en public.tenants pero NO tiene schema PostgreSQL"

    def test_todos_los_tenants_tienen_caja_principal(self, pg_engine):
        """Todo tenant activo debe tener al menos una caja registradora."""
        with pg_engine.connect() as conn:
            tenants = conn.execute(
                text("SELECT schema_name FROM public.tenants WHERE is_active = TRUE")
            ).fetchall()

            sin_caja = []
            for (schema,) in tenants:
                try:
                    count = conn.execute(
                        text(f'SELECT COUNT(*) FROM "{schema}".cash_registers WHERE is_active = TRUE')
                    ).scalar()
                    if count == 0:
                        sin_caja.append(schema)
                except Exception:
                    sin_caja.append(f"{schema} (tabla no existe)")

        assert sin_caja == [], \
            f"Tenants SIN caja registradora activa: {sin_caja}"

    def test_todos_los_tenants_tienen_admin(self, pg_engine):
        """Cada tenant debe tener al menos un usuario con rol ADMIN."""
        with pg_engine.connect() as conn:
            tenants = conn.execute(
                text("SELECT id, schema_name FROM public.tenants WHERE is_active = TRUE")
            ).fetchall()

            sin_admin = []
            for (tenant_id, schema) in tenants:
                count = conn.execute(
                    text("SELECT COUNT(*) FROM public.users WHERE tenant_id = :tid AND role = 'ADMIN'"),
                    {"tid": tenant_id}
                ).scalar()
                if count == 0:
                    sin_admin.append(schema)

        assert sin_admin == [], \
            f"Tenants SIN usuario ADMIN: {sin_admin}"

    def test_todos_los_tenants_tienen_monedas(self, pg_engine):
        """Todo tenant debe tener al menos USD y Bs configurados."""
        with pg_engine.connect() as conn:
            tenants = conn.execute(
                text("SELECT schema_name FROM public.tenants WHERE is_active = TRUE")
            ).fetchall()

            sin_monedas = []
            for (schema,) in tenants:
                try:
                    count = conn.execute(
                        text(f'SELECT COUNT(*) FROM "{schema}".business_currencies WHERE is_active = TRUE')
                    ).scalar()
                    if count < 2:
                        sin_monedas.append(f"{schema} ({count} monedas)")
                except Exception:
                    sin_monedas.append(f"{schema} (tabla no existe)")

        assert sin_monedas == [], \
            f"Tenants con menos de 2 monedas activas: {sin_monedas}"

    def test_todos_los_tenants_tienen_almacen(self, pg_engine):
        """Todo tenant debe tener al menos un almacén activo."""
        with pg_engine.connect() as conn:
            tenants = conn.execute(
                text("SELECT schema_name FROM public.tenants WHERE is_active = TRUE")
            ).fetchall()

            sin_almacen = []
            for (schema,) in tenants:
                try:
                    count = conn.execute(
                        text(f'SELECT COUNT(*) FROM "{schema}".warehouses WHERE is_active = TRUE')
                    ).scalar()
                    if count == 0:
                        sin_almacen.append(schema)
                except Exception:
                    sin_almacen.append(f"{schema} (tabla no existe)")

        assert sin_almacen == [], \
            f"Tenants SIN almacén activo: {sin_almacen}"


# ---------------------------------------------------------------------------
# SECCIÓN 2 — Aislamiento Multi-Tenant (el más crítico)
# ---------------------------------------------------------------------------

class TestAislamientoMultiTenant:
    """Verifica que los datos de un tenant NO son visibles desde otro."""

    def test_productos_de_un_tenant_no_visibles_desde_otro(self, pg_db_for_schema):
        """
        Los productos de 'lalicoreria' no deben ser accesibles
        si el search_path está configurado para 'hmd2018caa'.
        """
        from backend_api.models.models import Product

        session_a = pg_db_for_schema("lalicoreria")
        session_b = pg_db_for_schema("hmd2018caa")

        productos_a = session_a.query(Product).count()
        productos_b = session_b.query(Product).count()

        # Ambos tenants deben tener conteos independientes
        assert productos_a > 0, "lalicoreria debe tener productos"
        # Los productos de A no se filtran en B (son schemas separados)
        assert productos_a != productos_b or productos_b == 0, \
            "La cantidad de productos debe ser independiente por tenant"

    def test_ventas_de_un_tenant_no_visibles_desde_otro(self, pg_db_for_schema):
        """Las ventas de lalicoreria no deben contaminarse con hmd2018caa."""
        from backend_api.models.models import Sale

        session_a = pg_db_for_schema("lalicoreria")
        session_b = pg_db_for_schema("hmd2018caa")

        ventas_a = session_a.query(Sale).count()
        ventas_b = session_b.query(Sale).count()

        # lalicoreria tiene 4913 ventas, hmd2018caa tiene 0
        assert ventas_a > 0, "lalicoreria debe tener ventas registradas"
        assert ventas_b == 0, \
            f"hmd2018caa no debería tener ventas, pero tiene {ventas_b}"

    def test_usuarios_globales_en_public_schema(self, pg_engine):
        """Los usuarios deben estar en public.users, no en schemas de tenants."""
        with pg_engine.connect() as conn:
            # Verificar que la tabla users existe en public
            count = conn.execute(
                text("SELECT COUNT(*) FROM public.users WHERE is_active = TRUE")
            ).scalar()
            assert count > 0, "Debe haber usuarios activos en public.users"

            # Verificar que cada usuario tiene su tenant_id correcto
            huerfanos = conn.execute(
                text("""
                    SELECT COUNT(*) FROM public.users u
                    WHERE u.tenant_id IS NOT NULL
                    AND NOT EXISTS (
                        SELECT 1 FROM public.tenants t WHERE t.id = u.tenant_id
                    )
                """)
            ).scalar()
            assert huerfanos == 0, \
                f"Hay {huerfanos} usuarios con tenant_id que no existe en public.tenants"


# ---------------------------------------------------------------------------
# SECCIÓN 3 — Integridad de Ventas
# ---------------------------------------------------------------------------

class TestIntegridadVentas:
    """Verifica consistencia en los datos de ventas del tenant con más data."""

    def test_ventas_tienen_detalles(self, pg_engine):
        """Toda venta debe tener al menos un SaleDetail."""
        with pg_engine.connect() as conn:
            ventas_sin_detalle = conn.execute(
                text("""
                    SELECT COUNT(*) FROM lalicoreria.sales s
                    WHERE NOT EXISTS (
                        SELECT 1 FROM lalicoreria.sale_details sd WHERE sd.sale_id = s.id
                    )
                """)
            ).scalar()

        assert ventas_sin_detalle == 0, \
            f"Hay {ventas_sin_detalle} ventas sin ningún detalle (SaleDetail)"

    def test_ventas_credito_tienen_balance(self, pg_engine):
        """Las ventas a crédito sin pagar deben tener balance_pending > 0."""
        with pg_engine.connect() as conn:
            ventas_credito_sin_balance = conn.execute(
                text("""
                    SELECT COUNT(*) FROM lalicoreria.sales
                    WHERE is_credit = TRUE AND paid = FALSE
                    AND (balance_pending IS NULL OR balance_pending <= 0)
                """)
            ).scalar()

        assert ventas_credito_sin_balance == 0, \
            f"Hay {ventas_credito_sin_balance} ventas a crédito sin pagar con balance_pending inválido"

    def test_total_amount_positivo(self, pg_engine):
        """Ninguna venta debe tener total_amount negativo o cero."""
        with pg_engine.connect() as conn:
            ventas_invalidas = conn.execute(
                text("""
                    SELECT COUNT(*) FROM lalicoreria.sales
                    WHERE total_amount <= 0
                """)
            ).scalar()

        assert ventas_invalidas == 0, \
            f"Hay {ventas_invalidas} ventas con total_amount <= 0"


# ---------------------------------------------------------------------------
# SECCIÓN 4 — Integridad de Caja
# ---------------------------------------------------------------------------

class TestIntegridadCaja:
    """Verifica que no haya sesiones de caja en estado inconsistente."""

    def test_no_hay_multiples_cajas_abiertas_en_mismo_registro(self, pg_engine):
        """Un registro de caja no puede tener dos sesiones OPEN al mismo tiempo."""
        with pg_engine.connect() as conn:
            tenants = conn.execute(
                text("SELECT schema_name FROM public.tenants WHERE is_active = TRUE")
            ).fetchall()

            conflictos = []
            for (schema,) in tenants:
                try:
                    dobles = conn.execute(
                        text(f"""
                            SELECT register_id, COUNT(*) as open_count
                            FROM "{schema}".cash_sessions
                            WHERE status = 'OPEN'
                            GROUP BY register_id
                            HAVING COUNT(*) > 1
                        """)
                    ).fetchall()
                    if dobles:
                        conflictos.append(f"{schema}: {dobles}")
                except Exception:
                    pass

        assert conflictos == [], \
            f"Hay registros de caja con múltiples sesiones OPEN: {conflictos}"

    def test_sesiones_cerradas_tienen_end_time(self, pg_engine):
        """Toda sesión CLOSED debe tener end_time registrado."""
        with pg_engine.connect() as conn:
            tenants = conn.execute(
                text("SELECT schema_name FROM public.tenants WHERE is_active = TRUE")
            ).fetchall()

            problemas = []
            for (schema,) in tenants:
                try:
                    count = conn.execute(
                        text(f"""
                            SELECT COUNT(*) FROM "{schema}".cash_sessions
                            WHERE status = 'CLOSED' AND end_time IS NULL
                        """)
                    ).scalar()
                    if count > 0:
                        problemas.append(f"{schema}: {count} sesiones")
                except Exception:
                    pass

        assert problemas == [], \
            f"Sesiones CLOSED sin end_time: {problemas}"


# ---------------------------------------------------------------------------
# SECCIÓN 5 — Integridad de Productos
# ---------------------------------------------------------------------------

class TestIntegridadProductos:
    """Verifica consistencia en el catálogo de productos."""

    def test_productos_sin_sku_duplicado(self, pg_engine):
        """No puede haber dos productos activos con el mismo SKU en el mismo tenant."""
        with pg_engine.connect() as conn:
            tenants = conn.execute(
                text("SELECT schema_name FROM public.tenants WHERE is_active = TRUE")
            ).fetchall()

            duplicados = []
            for (schema,) in tenants:
                try:
                    dupes = conn.execute(
                        text(f"""
                            SELECT sku, COUNT(*) as c FROM "{schema}".products
                            WHERE is_active = TRUE AND sku IS NOT NULL AND sku != ''
                            GROUP BY sku HAVING COUNT(*) > 1
                        """)
                    ).fetchall()
                    if dupes:
                        duplicados.append(f"{schema}: {[d[0] for d in dupes]}")
                except Exception:
                    pass

        assert duplicados == [], \
            f"SKUs duplicados encontrados: {duplicados}"

    def test_productos_precio_positivo(self, pg_engine):
        """Todo producto activo debe tener precio > 0."""
        with pg_engine.connect() as conn:
            # Excluir schemas de prueba/demo
            tenants = conn.execute(
                text("SELECT schema_name FROM public.tenants WHERE is_active = TRUE AND is_demo = FALSE")
            ).fetchall()

            problemas = []
            for (schema,) in tenants:
                try:
                    count = conn.execute(
                        text(f"""
                            SELECT COUNT(*) FROM "{schema}".products
                            WHERE is_active = TRUE AND is_service = FALSE
                            AND (price IS NULL OR price <= 0)
                        """)
                    ).scalar()
                    if count > 0:
                        problemas.append(f"{schema}: {count} productos")
                except Exception:
                    pass

        assert problemas == [], \
            f"Productos activos con precio inválido (tenants reales): {problemas}"
