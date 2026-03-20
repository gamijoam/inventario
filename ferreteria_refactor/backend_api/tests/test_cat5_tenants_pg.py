"""
test_cat5_tenants_pg.py — Categoría 5: Integridad de Tenants

8 tests que verifican que cada tenant fue correctamente creado y sembrado:
schema PostgreSQL, admin, caja, almacén, monedas, métodos de pago y módulos.
Todos corren contra la BD de test con datos reales de prod.

Correr con:
    cd ferreteria_refactor
    python -m pytest backend_api/tests/test_cat5_tenants_pg.py -v --no-cov
"""

import pytest
from sqlalchemy import text


class TestSeedingBasico:
    """Tests 38-42: Verificar que el seeding inicial se ejecutó correctamente en cada tenant."""

    def test_todo_tenant_tiene_schema_postgresql(self, pg_engine):
        """
        Test 38: Cada tenant en public.tenants debe tener su schema PostgreSQL.
        Si el schema no existe, el tenant es inoperable: cualquier query falla.
        """
        with pg_engine.connect() as conn:
            tenants = conn.execute(
                text("SELECT schema_name FROM public.tenants WHERE is_active = TRUE")
            ).fetchall()
            schemas_pg = {r[0] for r in conn.execute(text("""
                SELECT nspname FROM pg_namespace
                WHERE nspname NOT LIKE 'pg_%' AND nspname != 'information_schema'
            """)).fetchall()}

        faltantes = [t[0] for t in tenants if t[0] not in schemas_pg]
        assert faltantes == [], \
            f"Tenants sin schema PostgreSQL: {faltantes}"

    def test_todo_tenant_tiene_admin_activo(self, pg_engine):
        """
        Test 39: Todo tenant activo debe tener al menos un usuario ADMIN activo.
        Sin admin, el tenant no puede ser gestionado ni configurado.
        """
        with pg_engine.connect() as conn:
            tenants = conn.execute(
                text("SELECT id, schema_name FROM public.tenants WHERE is_active = TRUE")
            ).fetchall()

            sin_admin = []
            for (tid, schema) in tenants:
                count = conn.execute(text("""
                    SELECT COUNT(*) FROM public.users
                    WHERE tenant_id = :tid AND role = 'ADMIN' AND is_active = TRUE
                """), {"tid": tid}).scalar()
                if count == 0:
                    sin_admin.append(schema)

        assert sin_admin == [], \
            f"Tenants sin ADMIN activo (seeding incompleto): {sin_admin}"

    def test_todo_tenant_tiene_almacen_activo(self, pg_engine):
        """
        Test 40: Todo tenant activo debe tener al menos un almacén activo.
        Sin almacén, no se puede registrar stock ni procesar ventas.
        NOTA: is_main puede ser FALSE en tenants históricos — se verifica solo is_active=TRUE.
        """
        with pg_engine.connect() as conn:
            tenants = conn.execute(
                text("SELECT schema_name FROM public.tenants WHERE is_active = TRUE")
            ).fetchall()

            sin_almacen = []
            for (schema,) in tenants:
                try:
                    count = conn.execute(text(f"""
                        SELECT COUNT(*) FROM "{schema}".warehouses
                        WHERE is_active = TRUE
                    """)).scalar()
                    if count == 0:
                        sin_almacen.append(schema)
                except Exception:
                    sin_almacen.append(f"{schema} (error al consultar)")

        assert sin_almacen == [], \
            f"Tenants sin ningún almacén activo: {sin_almacen}"

    def test_todo_tenant_tiene_caja_registradora(self, pg_engine):
        """
        Test 41: Todo tenant activo debe tener al menos una caja registradora activa.
        Sin caja, no se puede abrir una sesión de caja ni vender.
        """
        with pg_engine.connect() as conn:
            tenants = conn.execute(
                text("SELECT schema_name FROM public.tenants WHERE is_active = TRUE")
            ).fetchall()

            sin_caja = []
            for (schema,) in tenants:
                try:
                    count = conn.execute(text(f"""
                        SELECT COUNT(*) FROM "{schema}".cash_registers
                        WHERE is_active = TRUE
                    """)).scalar()
                    if count == 0:
                        sin_caja.append(schema)
                except Exception:
                    sin_caja.append(f"{schema} (error al consultar)")

        assert sin_caja == [], \
            f"Tenants sin caja registradora activa: {sin_caja}"

    def test_todo_tenant_tiene_metodos_de_pago(self, pg_engine):
        """
        Test 42: Todo tenant activo debe tener al menos métodos de pago sembrados.
        Sin métodos de pago, las ventas no pueden procesarse.
        Mínimo esperado: 3 métodos (Efectivo, Pago Móvil, Transferencia).
        """
        with pg_engine.connect() as conn:
            tenants = conn.execute(
                text("SELECT schema_name FROM public.tenants WHERE is_active = TRUE")
            ).fetchall()

            sin_pagos = []
            for (schema,) in tenants:
                try:
                    count = conn.execute(text(f"""
                        SELECT COUNT(*) FROM "{schema}".payment_methods
                        WHERE is_active = TRUE
                    """)).scalar()
                    if count < 3:
                        sin_pagos.append(f"{schema} ({count} métodos)")
                except Exception:
                    sin_pagos.append(f"{schema} (tabla no existe)")

        assert sin_pagos == [], \
            f"Tenants con menos de 3 métodos de pago: {sin_pagos}"


class TestConfiguracionTenant:
    """Tests 43-45: Configuración y estado de los tenants."""

    def test_schema_name_es_valido_y_no_reservado(self, pg_engine):
        """
        Test 43: Los schema_name de los tenants no deben ser nombres reservados de PostgreSQL
        (public, pg_catalog, information_schema, etc.) ni contener caracteres especiales.
        Un schema_name inválido puede ejecutar SQL injection o corromper queries con f-strings.
        """
        NOMBRES_RESERVADOS = {
            "public", "pg_catalog", "information_schema", "pg_toast",
            "pg_temp", "pg_toast_temp", "admin", "postgres"
        }

        with pg_engine.connect() as conn:
            tenants = conn.execute(
                text("SELECT schema_name FROM public.tenants")
            ).fetchall()

        problemas = []
        for (schema,) in tenants:
            if schema in NOMBRES_RESERVADOS:
                problemas.append(f"'{schema}' es un nombre reservado")
            elif not all(c.isalnum() or c in ("_", "-") for c in schema):
                problemas.append(f"'{schema}' contiene caracteres especiales")

        assert problemas == [], \
            f"Tenants con schema_name inválido o reservado: {problemas}"

    def test_tenants_activos_tienen_monedas_configuradas(self, pg_engine):
        """
        Test 44: Todo tenant activo (no demo) debe tener al menos 2 monedas activas.
        Sin monedas, el sistema multi-moneda no puede calcular equivalencias.
        Se excluyen tenants demo que pueden estar incompletos.
        """
        with pg_engine.connect() as conn:
            tenants = conn.execute(
                text("""
                    SELECT schema_name FROM public.tenants
                    WHERE is_active = TRUE AND is_demo = FALSE
                """)
            ).fetchall()

            sin_monedas = []
            for (schema,) in tenants:
                try:
                    count = conn.execute(text(f"""
                        SELECT COUNT(*) FROM "{schema}".business_currencies
                        WHERE is_active = TRUE
                    """)).scalar()
                    if count < 2:
                        sin_monedas.append(f"{schema} ({count} monedas)")
                except Exception:
                    try:
                        # Fallback: tabla currencies (nombre alternativo)
                        count = conn.execute(text(f"""
                            SELECT COUNT(*) FROM "{schema}".currencies
                            WHERE is_active = TRUE
                        """)).scalar()
                        if count < 2:
                            sin_monedas.append(f"{schema} ({count} monedas)")
                    except Exception:
                        sin_monedas.append(f"{schema} (tabla no existe)")

        assert sin_monedas == [], \
            f"Tenants reales con menos de 2 monedas activas: {sin_monedas}"

    def test_no_hay_dos_tenants_con_mismo_schema(self, pg_engine):
        """
        Test 45: No puede haber dos tenants con el mismo schema_name.
        Si existiera, sus datos se mezclarían completamente (mismo schema PostgreSQL).
        El campo tiene UNIQUE constraint pero lo verificamos explícitamente.
        """
        with pg_engine.connect() as conn:
            dupes = conn.execute(text("""
                SELECT schema_name, COUNT(*) as c
                FROM public.tenants
                GROUP BY schema_name
                HAVING COUNT(*) > 1
            """)).fetchall()

        assert dupes == [], \
            f"schema_name duplicados en public.tenants: {[(d[0], d[1]) for d in dupes]}"
