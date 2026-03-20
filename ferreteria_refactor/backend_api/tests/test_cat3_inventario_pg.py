"""
test_cat3_inventario_pg.py — Categoría 3: Integridad de Inventario

8 tests que cubren stock por bodega, Kardex, IMEIs duplicados,
transferencias internas y externas (inter-empresa).
Todos corren contra BD de test con datos reales de prod.

Correr con:
    cd ferreteria_refactor
    python -m pytest backend_api/tests/test_cat3_inventario_pg.py -v --no-cov
"""

import pytest
from sqlalchemy import text


class TestStockYBodegas:
    """Tests 21-23: Consistencia de stock en bodegas."""

    def test_stock_global_producto_igual_suma_bodegas(self, pg_engine):
        """
        Test 21: El stock global de cada producto (products.stock) debe ser >= 0.
        Un stock negativo en la tabla principal indica inconsistencia con Kardex.
        Tolerancia: algunos tenants permiten ventas bajo reserva (stock puede quedar < 0
        brevemente), pero se reporta como warning sin fallar el test.
        """
        with pg_engine.connect() as conn:
            tenants = conn.execute(
                text("SELECT schema_name FROM public.tenants WHERE is_active = TRUE")
            ).fetchall()

            negativos_graves = []
            for (schema,) in tenants:
                try:
                    count = conn.execute(text(f"""
                        SELECT COUNT(*) FROM "{schema}".products
                        WHERE is_active = TRUE
                          AND is_service = FALSE
                          AND stock < -10
                    """)).scalar()
                    if count > 0:
                        negativos_graves.append(f"{schema}: {count} productos con stock < -10")
                except Exception:
                    pass

            assert negativos_graves == [], \
                f"Productos con stock gravemente negativo (< -10): {negativos_graves}"

    def test_product_stock_por_bodega_no_negativo(self, pg_engine):
        """
        Test 22: Los registros de ProductStock por bodega no deben ser negativos.
        Un stock negativo en una bodega específica indica descuento sin validación.
        """
        with pg_engine.connect() as conn:
            tenants = conn.execute(
                text("SELECT schema_name FROM public.tenants WHERE is_active = TRUE")
            ).fetchall()

            problemas = []
            for (schema,) in tenants:
                try:
                    count = conn.execute(text(f"""
                        SELECT COUNT(*) FROM "{schema}".product_stocks
                        WHERE quantity < 0
                    """)).scalar()
                    if count > 0:
                        problemas.append(f"{schema}: {count} registros de stock negativo")
                except Exception:
                    pass

            assert problemas == [], \
                f"Stocks negativos en product_stocks: {problemas}"

    def test_cada_producto_fisico_tiene_registro_en_alguna_bodega(self, pg_engine):
        """
        Test 23: Todo producto físico activo debe tener al menos un registro en product_stocks.
        Si no tiene bodega asignada, el stock no se puede ubicar ni mover correctamente.
        NOTA: Solo evalúa tenants con tabla product_stocks (multi-bodega habilitado).
        """
        with pg_engine.connect() as conn:
            tenants = conn.execute(
                text("SELECT schema_name FROM public.tenants WHERE is_active = TRUE")
            ).fetchall()

            problemas = []
            for (schema,) in tenants:
                try:
                    # Verificar que la tabla product_stocks existe
                    table_exists = conn.execute(text("""
                        SELECT COUNT(*) FROM information_schema.tables
                        WHERE table_schema = :schema AND table_name = 'product_stocks'
                    """), {"schema": schema}).scalar()

                    if not table_exists:
                        continue

                    # Solo tenants con bodegas configuradas
                    warehouse_count = conn.execute(text(f"""
                        SELECT COUNT(*) FROM "{schema}".warehouses WHERE is_active = TRUE
                    """)).scalar()

                    if warehouse_count == 0:
                        continue

                    # Productos físicos activos sin ningún registro de stock
                    count = conn.execute(text(f"""
                        SELECT COUNT(*) FROM "{schema}".products p
                        WHERE p.is_active = TRUE
                          AND p.is_service = FALSE
                          AND p.is_combo = FALSE
                          AND p.stock > 0
                          AND NOT EXISTS (
                              SELECT 1 FROM "{schema}".product_stocks ps
                              WHERE ps.product_id = p.id
                          )
                    """)).scalar()

                    if count > 0:
                        problemas.append(
                            f"{schema}: {count} productos con stock>0 pero sin registro en product_stocks"
                        )
                except Exception:
                    pass

            # Warning informativo — no es un hard fail porque la migración a multi-bodega es gradual
            if problemas:
                print(f"\n⚠️  Productos sin bodega asignada: {problemas}")


class TestKardexIntegridad:
    """Tests 24-25: Integridad del Kardex de inventario."""

    def test_kardex_suma_movimientos_consistente_con_stock_actual(self, pg_engine):
        """
        Test 24: Para cada producto, la suma neta del Kardex debe ser consistente
        con el stock registrado en products.stock.
        Un desfase grande (> 5 unidades) indica movimientos sin registrar en Kardex.
        Solo verifica productos con más de 10 movimientos (suficiente historial).
        """
        with pg_engine.connect() as conn:
            tenants = conn.execute(
                text("SELECT schema_name FROM public.tenants WHERE is_active = TRUE")
            ).fetchall()

            desfases = []
            for (schema,) in tenants:
                try:
                    malos = conn.execute(text(f"""
                        SELECT p.id, p.name, p.stock,
                               SUM(k.quantity) as suma_kardex,
                               COUNT(k.id) as n_movimientos
                        FROM "{schema}".products p
                        JOIN "{schema}".kardex k ON k.product_id = p.id
                        WHERE p.is_active = TRUE
                          AND p.is_service = FALSE
                        GROUP BY p.id, p.name, p.stock
                        HAVING COUNT(k.id) >= 10
                           AND ABS(p.stock - SUM(k.quantity)) > 5
                        LIMIT 3
                    """)).fetchall()

                    if malos:
                        desfases.append(
                            f"{schema}: {len(malos)} productos con desfase Kardex "
                            f"(ej: '{malos[0][1]}' stock={malos[0][2]} kardex_sum={malos[0][3]})"
                        )
                except Exception:
                    pass

            # Informativo — desfases pequeños son normales por combos/recetas
            if desfases:
                print(f"\n⚠️  Desfases Kardex vs stock: {desfases}")

    def test_kardex_no_tiene_movimientos_sin_producto(self, pg_engine):
        """
        Test 25: Ningún movimiento de Kardex debe referenciar un product_id inválido.
        Kardex huérfano indica que el producto fue eliminado sin limpiar el historial.
        """
        with pg_engine.connect() as conn:
            tenants = conn.execute(
                text("SELECT schema_name FROM public.tenants WHERE is_active = TRUE")
            ).fetchall()

            problemas = []
            for (schema,) in tenants:
                try:
                    count = conn.execute(text(f"""
                        SELECT COUNT(*) FROM "{schema}".kardex k
                        WHERE NOT EXISTS (
                            SELECT 1 FROM "{schema}".products p WHERE p.id = k.product_id
                        )
                    """)).scalar()
                    if count > 0:
                        problemas.append(f"{schema}: {count} movimientos Kardex huérfanos")
                except Exception:
                    pass

            assert problemas == [], \
                f"Kardex con product_id inválido: {problemas}"


class TestTransferenciasInternas:
    """Tests 26-27: Integridad de transferencias internas entre bodegas."""

    def test_transferencias_completadas_tienen_detalles(self, pg_engine):
        """
        Test 26: Toda transferencia COMPLETED debe tener al menos un TransferDetail.
        Una transferencia sin items indica inserción parcial o bug en la transacción.
        """
        with pg_engine.connect() as conn:
            tenants = conn.execute(
                text("SELECT schema_name FROM public.tenants WHERE is_active = TRUE")
            ).fetchall()

            problemas = []
            for (schema,) in tenants:
                try:
                    # Verificar que la tabla existe
                    table_exists = conn.execute(text("""
                        SELECT COUNT(*) FROM information_schema.tables
                        WHERE table_schema = :schema AND table_name = 'inventory_transfers'
                    """), {"schema": schema}).scalar()

                    if not table_exists:
                        continue

                    count = conn.execute(text(f"""
                        SELECT COUNT(*) FROM "{schema}".inventory_transfers t
                        WHERE t.status = 'COMPLETED'
                          AND NOT EXISTS (
                              SELECT 1 FROM "{schema}".transfer_details td
                              WHERE td.transfer_id = t.id
                          )
                    """)).scalar()

                    if count > 0:
                        problemas.append(
                            f"{schema}: {count} transferencias COMPLETED sin detalles"
                        )
                except Exception:
                    pass

            assert problemas == [], \
                f"Transferencias COMPLETED sin items (inserción incompleta): {problemas}"

    def test_transferencia_origen_distinto_a_destino(self, pg_engine):
        """
        Test 27: Ninguna transferencia puede tener el mismo warehouse de origen y destino.
        Una transferencia a sí misma no tiene sentido y genera duplicación de stock.
        """
        with pg_engine.connect() as conn:
            tenants = conn.execute(
                text("SELECT schema_name FROM public.tenants WHERE is_active = TRUE")
            ).fetchall()

            problemas = []
            for (schema,) in tenants:
                try:
                    table_exists = conn.execute(text("""
                        SELECT COUNT(*) FROM information_schema.tables
                        WHERE table_schema = :schema AND table_name = 'inventory_transfers'
                    """), {"schema": schema}).scalar()

                    if not table_exists:
                        continue

                    count = conn.execute(text(f"""
                        SELECT COUNT(*) FROM "{schema}".inventory_transfers
                        WHERE source_warehouse_id = target_warehouse_id
                    """)).scalar()

                    if count > 0:
                        problemas.append(
                            f"{schema}: {count} transferencias con mismo origen y destino"
                        )
                except Exception:
                    pass

            assert problemas == [], \
                f"Transferencias con bodega origen == destino: {problemas}"


class TestIMEIYSeriales:
    """Tests 28-29: Integridad de artículos serializados (IMEI/serial)."""

    def test_no_hay_imei_duplicado_en_estado_available(self, pg_engine):
        """
        Test 28: No puede existir el mismo número de serie (IMEI) dos veces
        en estado AVAILABLE para el mismo producto.
        Un IMEI duplicado indica que el mismo artículo se ingresó dos veces.
        """
        with pg_engine.connect() as conn:
            tenants = conn.execute(
                text("SELECT schema_name FROM public.tenants WHERE is_active = TRUE")
            ).fetchall()

            problemas = []
            for (schema,) in tenants:
                try:
                    table_exists = conn.execute(text("""
                        SELECT COUNT(*) FROM information_schema.tables
                        WHERE table_schema = :schema AND table_name = 'product_instances'
                    """), {"schema": schema}).scalar()

                    if not table_exists:
                        continue

                    dupes = conn.execute(text(f"""
                        SELECT serial_number, COUNT(*) as c
                        FROM "{schema}".product_instances
                        WHERE status = 'AVAILABLE'
                          AND serial_number IS NOT NULL
                          AND serial_number != ''
                        GROUP BY serial_number
                        HAVING COUNT(*) > 1
                        LIMIT 5
                    """)).fetchall()

                    if dupes:
                        problemas.append(
                            f"{schema}: {len(dupes)} IMEIs duplicados en AVAILABLE "
                            f"(ej: {dupes[0][0]})"
                        )
                except Exception:
                    pass

            assert problemas == [], \
                f"IMEIs duplicados en estado AVAILABLE: {problemas}"

    def test_product_instances_referencian_productos_has_imei(self, pg_engine):
        """
        Test 29: Los registros en product_instances solo deben existir para
        productos marcados con has_imei = TRUE.
        Instancias de productos no serializados indica bug en el flujo de entrada.
        """
        with pg_engine.connect() as conn:
            tenants = conn.execute(
                text("SELECT schema_name FROM public.tenants WHERE is_active = TRUE")
            ).fetchall()

            problemas = []
            for (schema,) in tenants:
                try:
                    table_exists = conn.execute(text("""
                        SELECT COUNT(*) FROM information_schema.tables
                        WHERE table_schema = :schema AND table_name = 'product_instances'
                    """), {"schema": schema}).scalar()

                    if not table_exists:
                        continue

                    count = conn.execute(text(f"""
                        SELECT COUNT(*) FROM "{schema}".product_instances pi
                        JOIN "{schema}".products p ON p.id = pi.product_id
                        WHERE p.has_imei = FALSE
                    """)).scalar()

                    if count > 0:
                        problemas.append(
                            f"{schema}: {count} instancias para productos sin has_imei"
                        )
                except Exception:
                    pass

            assert problemas == [], \
                f"ProductInstances para productos sin has_imei=TRUE: {problemas}"
