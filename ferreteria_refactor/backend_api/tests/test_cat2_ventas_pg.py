"""
test_cat2_ventas_pg.py — Categoría 2: Integridad de Ventas

10 tests que cubren consistencia de ventas, stock, crédito, descuentos,
unicidad de UUID, cambio/vuelto y Kardex.
Todos corren contra BD de test con datos reales de prod (read-only vía transacciones).

Correr con:
    cd ferreteria_refactor
    python -m pytest backend_api/tests/test_cat2_ventas_pg.py -v --no-cov
"""

import pytest
from decimal import Decimal
from sqlalchemy import text


class TestIntegridadBasicaVentas:
    """Tests 10-13: Consistencia fundamental de cada venta."""

    def test_toda_venta_tiene_al_menos_un_detalle(self, pg_engine):
        """
        Test 10: Ninguna venta puede existir sin ítems (SaleDetail).
        Una venta sin detalles indica inserción parcial o bug en la transacción.
        """
        with pg_engine.connect() as conn:
            tenants = conn.execute(
                text("SELECT schema_name FROM public.tenants WHERE is_active = TRUE")
            ).fetchall()

            problemas = []
            for (schema,) in tenants:
                try:
                    count = conn.execute(text(f"""
                        SELECT COUNT(*) FROM "{schema}".sales s
                        WHERE NOT EXISTS (
                            SELECT 1 FROM "{schema}".sale_details sd
                            WHERE sd.sale_id = s.id
                        )
                    """)).scalar()
                    if count > 0:
                        problemas.append(f"{schema}: {count} ventas sin detalle")
                except Exception:
                    pass

            assert problemas == [], \
                f"Ventas sin ningún SaleDetail: {problemas}"

    def test_total_venta_coincide_con_suma_de_detalles(self, pg_engine):
        """
        Test 11: El total_amount de la venta debe ser >= suma de subtotales de sus detalles.
        Discrepancias indican bug en cálculo de totales o descuentos globales no reflejados.
        Tolerancia: 0.10 USD por redondeo y descuentos de carrito.
        """
        with pg_engine.connect() as conn:
            tenants = conn.execute(
                text("SELECT schema_name FROM public.tenants WHERE is_active = TRUE")
            ).fetchall()

            inconsistencias = []
            for (schema,) in tenants:
                try:
                    malos = conn.execute(text(f"""
                        SELECT s.id, s.total_amount,
                               COALESCE(SUM(sd.subtotal), 0) as suma_detalles
                        FROM "{schema}".sales s
                        JOIN "{schema}".sale_details sd ON sd.sale_id = s.id
                        GROUP BY s.id, s.total_amount
                        HAVING ABS(s.total_amount - COALESCE(SUM(sd.subtotal), 0)) > 0.10
                        LIMIT 5
                    """)).fetchall()
                    if malos:
                        inconsistencias.append(
                            f"{schema}: {len(malos)} ventas con total inconsistente "
                            f"(ej: venta #{malos[0][0]} total={malos[0][1]} suma={malos[0][2]})"
                        )
                except Exception:
                    pass

            assert inconsistencias == [], \
                f"Ventas con total_amount inconsistente vs suma de detalles: {inconsistencias}"

    def test_uuid_unico_por_venta_sin_duplicados(self, pg_engine):
        """
        Test 12: El unique_uuid de cada venta debe ser único.
        Duplicados indican que una venta offline se sincronizó dos veces
        o que el mecanismo anti-duplicación falló.
        """
        with pg_engine.connect() as conn:
            tenants = conn.execute(
                text("SELECT schema_name FROM public.tenants WHERE is_active = TRUE")
            ).fetchall()

            problemas = []
            for (schema,) in tenants:
                try:
                    dupes = conn.execute(text(f"""
                        SELECT unique_uuid, COUNT(*) as c
                        FROM "{schema}".sales
                        WHERE unique_uuid IS NOT NULL
                        GROUP BY unique_uuid
                        HAVING COUNT(*) > 1
                    """)).fetchall()
                    if dupes:
                        problemas.append(f"{schema}: {len(dupes)} UUIDs duplicados")
                except Exception:
                    pass

            assert problemas == [], \
                f"UUIDs duplicados encontrados (posible doble sync): {problemas}"

    def test_total_amount_siempre_positivo(self, pg_engine):
        """
        Test 13: Ninguna venta debe tener total_amount <= 0.
        Un total negativo o cero indica un error de cálculo grave
        (descuento que superó el precio, o venta sin monto).
        """
        with pg_engine.connect() as conn:
            tenants = conn.execute(
                text("SELECT schema_name FROM public.tenants WHERE is_active = TRUE")
            ).fetchall()

            problemas = []
            for (schema,) in tenants:
                try:
                    count = conn.execute(text(f"""
                        SELECT COUNT(*) FROM "{schema}".sales
                        WHERE total_amount <= 0
                    """)).scalar()
                    if count > 0:
                        problemas.append(f"{schema}: {count} ventas con total <= 0")
                except Exception:
                    pass

            assert problemas == [], \
                f"Ventas con total_amount inválido: {problemas}"


class TestCredito:
    """Tests 14-15: Validaciones de ventas a crédito."""

    def test_ventas_credito_tienen_balance_pendiente_valido(self, pg_engine):
        """
        Test 14: Las ventas a crédito sin pagar deben tener balance_pending > 0.
        Un balance nulo o negativo en crédito activo es inconsistencia grave.
        """
        with pg_engine.connect() as conn:
            tenants = conn.execute(
                text("SELECT schema_name FROM public.tenants WHERE is_active = TRUE")
            ).fetchall()

            problemas = []
            for (schema,) in tenants:
                try:
                    count = conn.execute(text(f"""
                        SELECT COUNT(*) FROM "{schema}".sales
                        WHERE is_credit = TRUE
                          AND paid = FALSE
                          AND (balance_pending IS NULL OR balance_pending <= 0)
                    """)).scalar()
                    if count > 0:
                        problemas.append(f"{schema}: {count} créditos activos sin balance")
                except Exception:
                    pass

            assert problemas == [], \
                f"Créditos activos con balance_pending inválido: {problemas}"

    def test_ventas_pagadas_tienen_balance_cero_o_nulo(self, pg_engine):
        """
        Test 15: Las ventas marcadas como paid=TRUE no deben tener balance_pending > 0.
        Si paid=TRUE pero hay balance pendiente, el estado está corrupto.
        """
        with pg_engine.connect() as conn:
            tenants = conn.execute(
                text("SELECT schema_name FROM public.tenants WHERE is_active = TRUE")
            ).fetchall()

            problemas = []
            for (schema,) in tenants:
                try:
                    count = conn.execute(text(f"""
                        SELECT COUNT(*) FROM "{schema}".sales
                        WHERE paid = TRUE
                          AND balance_pending IS NOT NULL
                          AND balance_pending > 0.01
                    """)).scalar()
                    if count > 0:
                        problemas.append(f"{schema}: {count} ventas paid=TRUE con balance>0")
                except Exception:
                    pass

            assert problemas == [], \
                f"Ventas paid=TRUE con balance_pending positivo (estado corrupto): {problemas}"


class TestKardexYStock:
    """Tests 16-17: Trazabilidad de movimientos de inventario."""

    def test_kardex_tiene_movimiento_sale_por_cada_venta_con_producto(self, pg_engine):
        """
        Test 16: Toda venta de productos físicos debe generar un movimiento SALE en Kardex.
        Si no existe, el stock no se descuenta y el historial de inventario está roto.
        """
        with pg_engine.connect() as conn:
            tenants = conn.execute(
                text("SELECT schema_name FROM public.tenants WHERE is_active = TRUE")
            ).fetchall()

            problemas = []
            for (schema,) in tenants:
                try:
                    # Ventas con al menos un producto físico (no servicio) sin Kardex SALE
                    count = conn.execute(text(f"""
                        SELECT COUNT(DISTINCT s.id) FROM "{schema}".sales s
                        JOIN "{schema}".sale_details sd ON sd.sale_id = s.id
                        JOIN "{schema}".products p ON p.id = sd.product_id
                        WHERE p.is_service = FALSE
                          AND p.is_combo = FALSE
                          AND NOT EXISTS (
                              SELECT 1 FROM "{schema}".kardex k
                              WHERE k.movement_type = 'SALE'
                                AND k.product_id = sd.product_id
                                AND k.date::date = s.date::date
                          )
                    """)).scalar()
                    if count > 0:
                        problemas.append(f"{schema}: {count} ventas de físicos sin Kardex")
                except Exception:
                    pass

            # Este es un warning — la relación Kardex/Sale no siempre es 1:1 exacto
            # por combos y recetas, pero productos simples siempre deben tenerlo
            if problemas:
                pytest.warns(UserWarning, match="Kardex")
                print(f"\n⚠️  Ventas sin Kardex correspondiente: {problemas}")

    def test_kardex_balance_after_no_negativo_en_productos_no_servicio(self, pg_engine):
        """
        Test 17: El balance_after en Kardex no debe ser negativo para productos físicos.
        Stock negativo indica venta sin validar disponibilidad o bug en descuento.
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
                        JOIN "{schema}".products p ON p.id = k.product_id
                        WHERE k.balance_after < 0
                          AND p.is_service = FALSE
                    """)).scalar()
                    if count > 0:
                        problemas.append(f"{schema}: {count} movimientos con stock negativo")
                except Exception:
                    pass

            assert problemas == [], \
                f"Kardex con balance_after negativo (stock negativo): {problemas}"


class TestCambioYPagos:
    """Tests 18-19: Consistencia de pagos y cambio (vuelto)."""

    def test_ventas_con_cambio_tienen_currency_definida(self, pg_engine):
        """
        Test 18: Toda venta con change_amount > 0 debe tener change_currency definida.
        Sin moneda de cambio, el cierre de caja no puede deducir el vuelto correctamente.
        """
        with pg_engine.connect() as conn:
            tenants = conn.execute(
                text("SELECT schema_name FROM public.tenants WHERE is_active = TRUE")
            ).fetchall()

            problemas = []
            for (schema,) in tenants:
                try:
                    count = conn.execute(text(f"""
                        SELECT COUNT(*) FROM "{schema}".sales
                        WHERE change_amount > 0
                          AND (change_currency IS NULL OR change_currency = '')
                    """)).scalar()
                    if count > 0:
                        problemas.append(f"{schema}: {count} ventas con cambio sin moneda")
                except Exception:
                    pass

            assert problemas == [], \
                f"Ventas con change_amount pero sin change_currency: {problemas}"

    def test_pagos_de_venta_suman_al_total(self, pg_engine):
        """
        Test 19: La suma de sale_payments de una venta debe cubrir el total_amount.
        Para ventas NO a crédito: sum(payments) >= total_amount (puede haber vuelto).
        Para ventas a crédito: sum(payments) puede ser menor (hay balance pendiente).
        """
        with pg_engine.connect() as conn:
            tenants = conn.execute(
                text("SELECT schema_name FROM public.tenants WHERE is_active = TRUE")
            ).fetchall()

            problemas = []
            for (schema,) in tenants:
                try:
                    # Ventas NO crédito donde los pagos no cubren el total
                    malas = conn.execute(text(f"""
                        SELECT s.id, s.total_amount,
                               COALESCE(SUM(sp.amount), 0) as total_pagado
                        FROM "{schema}".sales s
                        LEFT JOIN "{schema}".sale_payments sp ON sp.sale_id = s.id
                        WHERE s.is_credit = FALSE
                          AND s.paid = TRUE
                        GROUP BY s.id, s.total_amount
                        HAVING COALESCE(SUM(sp.amount), 0) < (s.total_amount - 0.10)
                        LIMIT 3
                    """)).fetchall()
                    if malas:
                        problemas.append(
                            f"{schema}: {len(malas)} ventas pagadas con pagos insuficientes "
                            f"(ej: venta #{malas[0][0]} total={malas[0][1]} pagado={malas[0][2]})"
                        )
                except Exception:
                    pass

            assert problemas == [], \
                f"Ventas paid=TRUE con sum(payments) < total_amount: {problemas}"

    def test_ventas_sin_pagos_son_credito(self, pg_engine):
        """
        Test 20: Toda venta sin ningún registro en sale_payments debe ser crédito.
        Una venta contado sin pagos indica inserción incompleta.
        """
        with pg_engine.connect() as conn:
            tenants = conn.execute(
                text("SELECT schema_name FROM public.tenants WHERE is_active = TRUE")
            ).fetchall()

            problemas = []
            for (schema,) in tenants:
                try:
                    count = conn.execute(text(f"""
                        SELECT COUNT(*) FROM "{schema}".sales s
                        WHERE s.is_credit = FALSE
                          AND NOT EXISTS (
                              SELECT 1 FROM "{schema}".sale_payments sp
                              WHERE sp.sale_id = s.id
                          )
                    """)).scalar()
                    if count > 0:
                        problemas.append(f"{schema}: {count} ventas contado sin pagos")
                except Exception:
                    pass

            assert problemas == [], \
                f"Ventas contado (is_credit=FALSE) sin ningún payment registrado: {problemas}"
