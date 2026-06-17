-- ============================================================
-- Migración: Limpiar IMEIs en limbo (SOLD con devolución dañada)
-- ============================================================
-- Fecha: 2026-06-02
-- Contexto: Bug en routers/returns.py -> process_return. Antes del fix
--   (2026-06-02), cuando se devolvía un IMEI por condición DAMAGED
--   por el flujo normal de POS, el ProductInstance se quedaba en
--   status='SOLD' en vez de pasar a 'RMA' (cuarentena). Eso dejaba
--   el IMEI en "limbo": no aparecía como disponible, pero la venta
--   vieja seguía "reclamándolo", y la consulta de garantía
--   (/rma/check/{imei}) lo reportaba como garantía activa sobre
--   un equipo que físicamente estaba dañado en el depósito.
--
-- Propósito: Mover a 'RMA' los ProductInstance que quedaron en ese
-- limbo, para que el sistema refleje la cuarentena real.
--
-- Detección (por (product_id, sale_id)):
--   1. Existe al menos un Kardex con movement_type='RETURN' y
--      description conteniendo 'Dañado' y 'Venta #<sale_id>' para
--      ese product.
--   2. La suma de cantidades devueltas (kardex) es >= la cantidad
--      de instancias SOLD de ese product en esa venta.
--      Eso significa: TODAS las unidades vendidas de ese product en
--      esa venta fueron devueltas como dañadas -> todas son limbo
--      -> todas a RMA.
--
-- Limitación (parcial): Si la devolución dañada fue PARCIAL (no
-- cubre toda la venta del product), la migración NO toca esas
-- instancias, porque ReturnDetail no guarda product_instance_id
-- y no se puede saber cuáles específicas fueron. Esas se
-- resuelven con el Fix 4 (trackear seriales explícitos en el
-- return). Revisarlas manualmente si aplica.
--
-- Idempotente: solo actualiza instancias que siguen en 'SOLD'.
-- El fix de código (routers/returns.py) ya previene que se
-- generen nuevos limbos.
--
-- Cómo aplicar (por schema de tenant):
--   SET search_path TO <schema_tenant>, public;
--   \i 2026_06_02_clean_imei_limbo_sold_to_rma.sql
--
-- O con Python (psycopg2) si no hay psql:
--   conn.cursor().execute("SET search_path TO <schema>, public")
--   conn.cursor().execute(open('...sql').read())
-- ============================================================

DO $$
DECLARE
    r RECORD;
    v_kardex_qty NUMERIC;
    v_sold_count INTEGER;
    v_moved INTEGER;
    v_total_moved INTEGER := 0;
    v_total_partial_skipped INTEGER := 0;
BEGIN
    FOR r IN
        SELECT
            k.product_id,
            (regexp_match(k.description, 'Venta #(\d+)'))[1]::int AS sale_id,
            SUM(k.quantity) AS kardex_qty
        FROM kardex k
        WHERE k.movement_type = 'RETURN'
          AND k.description ILIKE '%Dañado%'
          AND k.description ~ 'Venta #\d+'
        GROUP BY k.product_id, (regexp_match(k.description, 'Venta #(\d+)'))[1]
    LOOP
        -- Contar instancias SOLD de este product en esta venta
        SELECT COUNT(*) INTO v_sold_count
        FROM product_instances pi
        JOIN sale_detail_instances sdi ON sdi.product_instance_id = pi.id
        JOIN sale_details sd ON sd.id = sdi.sale_detail_id
        WHERE sd.sale_id = r.sale_id
          AND sd.product_id = r.product_id
          AND pi.status = 'SOLD';

        v_kardex_qty := r.kardex_qty;

        IF v_sold_count > 0 AND v_kardex_qty >= v_sold_count THEN
            -- FULL damaged return de este product en esta venta:
            -- todas las SOLD instances son limbo -> RMA
            UPDATE product_instances pi
            SET status = 'RMA'
            FROM sale_detail_instances sdi
            JOIN sale_details sd ON sd.id = sdi.sale_detail_id
            WHERE sdi.product_instance_id = pi.id
              AND sd.sale_id = r.sale_id
              AND sd.product_id = r.product_id
              AND pi.status = 'SOLD';

            GET DIAGNOSTICS v_moved = ROW_COUNT;
            v_total_moved := v_total_moved + v_moved;
            RAISE NOTICE 'OK  product_id=% sale=%: % instancia(s) SOLD -> RMA (kardex=%, sold=%)',
                r.product_id, r.sale_id, v_moved, v_kardex_qty, v_sold_count;
        ELSE
            -- Devolución dañada PARCIAL: no se puede saber cuáles instancias
            -- específicas. Skip + log para revisión manual (o esperar Fix 4).
            v_total_partial_skipped := v_total_partial_skipped + 1;
            RAISE NOTICE 'SKIP product_id=% sale=%: parcial (kardex=%, sold=%) -> revisar manual',
                r.product_id, r.sale_id, v_kardex_qty, v_sold_count;
        END IF;
    END LOOP;

    RAISE NOTICE '=== Resumen: % instancia(s) movida(s) SOLD->RMA. % caso(s) parcial(es) omitido(s). ===',
        v_total_moved, v_total_partial_skipped;
END $$;
