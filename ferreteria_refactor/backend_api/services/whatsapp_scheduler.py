"""
WhatsApp Scheduler — Mi Inventario Fácil
Tareas automáticas programadas que se ejecutan en background.

Tareas activas:
  - 09:00 VE → recordatorio de deuda a clientes con crédito vencido
"""
import logging
import httpx
from datetime import datetime, timezone, timedelta
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import text

from ..database.db import SessionLocal
from ..tenant_context import set_tenant_schema, reset_tenant_schema

logger = logging.getLogger(__name__)

# Zona horaria Venezuela (UTC-4)
VE_TZ = timezone(timedelta(hours=-4))
WA_URL = "http://whatsapp_service:3000"

scheduler = AsyncIOScheduler(timezone="America/Caracas")


async def _send_wa(instance: str, phone: str, message: str) -> bool:
    """Envía mensaje WhatsApp al servicio Baileys."""
    try:
        clean = "".join(c for c in phone if c.isdigit())
        if len(clean) < 7:
            return False
        async with httpx.AsyncClient(timeout=8) as c:
            r = await c.post(f"{WA_URL}/instance/{instance}/send",
                             json={"phone": clean, "message": message})
            return r.is_success
    except Exception as e:
        logger.warning(f"[CRON-WA] send error: {e}")
        return False


async def _get_tenant_schemas() -> list:
    """Lista todos los schemas de tenants activos."""
    db = SessionLocal()
    try:
        rows = db.execute(
            text("SELECT schema_name FROM public.tenants WHERE is_active = true")
        ).fetchall()
        return [r[0] for r in rows]
    except Exception as e:
        logger.error(f"[CRON] Error obteniendo tenants: {e}")
        return []
    finally:
        db.close()


async def job_credit_reminders():
    """
    Envía recordatorios de deuda a clientes con crédito vencido.
    Se ejecuta a las 09:00 hora Venezuela.
    Sólo procesa tenants con WhatsApp CONNECTED y whatsapp_notify_credit_reminder activo.
    """
    logger.info("[CRON] Iniciando recordatorios de deuda...")
    schemas = await _get_tenant_schemas()
    sent_total = 0

    for schema in schemas:
        db = None
        try:
            set_tenant_schema(schema)
            db = SessionLocal()

            # Verificar config WhatsApp del tenant
            wa_cfg = {r[0]: r[1] for r in db.execute(
                text(f"SELECT key, value FROM \"{schema}\".business_config "
                     "WHERE key IN ('whatsapp_instance_name','whatsapp_instance_status','whatsapp_credit_reminder_auto',"
                     "'whatsapp_notify_credit_reminder','whatsapp_template_credit','business_name','whatsapp_credit_reminder_days')")
            ).fetchall()}

            inst   = wa_cfg.get("whatsapp_instance_name", "")
            status = wa_cfg.get("whatsapp_instance_status", "")
            notify   = wa_cfg.get("whatsapp_notify_credit_reminder") != "false"
            auto_on  = wa_cfg.get("whatsapp_credit_reminder_auto") != "false"

            if not inst or status != "CONNECTED" or not notify or not auto_on:
                continue

            biz = wa_cfg.get("business_name") or "Mi Inventario"
            tpl = wa_cfg.get("whatsapp_template_credit") or (
                "💳 Hola {{cliente}}, te recordamos que tienes un saldo pendiente de *{{monto}}*.\n\n"
                "📅 Por favor regularizar a la brevedad.\n\n¡Gracias!"
            )

            # Verificar que el servicio Baileys responde para esta instancia
            try:
                async with httpx.AsyncClient(timeout=3) as c:
                    r = await c.get(f"{WA_URL}/instance/{inst}/status")
                    if not r.json().get("connected"):
                        continue
            except Exception:
                continue

            # Días de gracia configurados por el tenant
            days_overdue = int(_cfg.get("whatsapp_credit_reminder_days") or "1")

            # Obtener clientes con saldo vencido según días configurados
            customers = db.execute(text(
                f'''SELECT c.id, c.name, c.phone,
                       SUM(s.balance_pending) as total_deuda
                FROM "{schema}".customers c
                JOIN "{schema}".sales s ON s.customer_id = c.id
                WHERE s.is_credit = true
                  AND s.paid = false
                  AND s.balance_pending > 0.01
                  AND c.phone IS NOT NULL
                  AND c.phone != \'\'
                  AND s.date < NOW() - (:{days} * INTERVAL '1 day')
                GROUP BY c.id, c.name, c.phone
                HAVING SUM(s.balance_pending) > 0.01''',
                {"days": days_overdue}
            )).fetchall()

            for cust in customers:
                cust_id, name, phone, deuda = cust
                monto_str = f"$ {float(deuda):,.2f}"
                msg = (tpl
                       .replace("{{cliente}}", name)
                       .replace("{{monto}}", monto_str)
                       .replace("{{negocio}}", biz))

                ok = await _send_wa(inst, phone, msg)
                if ok:
                    sent_total += 1
                    logger.info(f"[CRON] Recordatorio enviado → {schema}/{name}")

        except Exception as e:
            logger.error(f"[CRON] Error en tenant {schema}: {e}")
        finally:
            if db:
                db.close()
            reset_tenant_schema()

    logger.info(f"[CRON] Recordatorios de deuda completados: {sent_total} enviados")


def start_scheduler():
    """Inicia el scheduler. Llamar desde main.py al startup."""
    if scheduler.running:
        return

    # Recordatorio de deuda — todos los días a las 09:00 hora Venezuela
    scheduler.add_job(
        job_credit_reminders,
        trigger=CronTrigger(hour=9, minute=0, timezone="America/Caracas"),
        id="credit_reminders",
        name="Recordatorio de deuda diario",
        replace_existing=True,
        misfire_grace_time=3600,  # Si el servidor estaba apagado, ejecutar si fue hace <1h
    )

    scheduler.start()
    logger.info("[CRON] Scheduler iniciado — recordatorio deuda: 09:00 VE diario")


async def job_stock_alerts():
    """
    Envía alertas de stock bajo al administrador del negocio.
    Se ejecuta diariamente a las 08:00 Venezuela (antes de abrir).
    """
    logger.info("[CRON] Verificando alertas de stock bajo...")
    schemas = await _get_tenant_schemas()
    sent = 0

    for schema in schemas:
        db = None
        try:
            set_tenant_schema(schema)
            db = SessionLocal()

            wa = {r[0]: r[1] for r in db.execute(text(
                f"SELECT key, value FROM \"{schema}\".business_config "
                "WHERE key IN ('whatsapp_instance_name','whatsapp_instance_status',"
                "'whatsapp_admin_phone','business_name','whatsapp_notify_stock')"
            )).fetchall()}

            inst        = wa.get("whatsapp_instance_name", "")
            status      = wa.get("whatsapp_instance_status", "")
            admin_phone_raw = wa.get("whatsapp_admin_phone", "") or ""
            admin_phone = "".join(c for c in admin_phone_raw if c.isdigit())
            if admin_phone and not admin_phone.startswith("58"):
                admin_phone = "58" + admin_phone
            notify      = wa.get("whatsapp_notify_stock") != "false"
            biz         = wa.get("business_name") or "Mi Inventario"

            if not inst or status != "CONNECTED" or not admin_phone or not notify:
                continue

            # Buscar productos bajo el stock mínimo
            low = db.execute(text(
                f'''SELECT name, stock, min_stock
                   FROM "{schema}".products
                   WHERE is_active = true
                     AND min_stock IS NOT NULL
                     AND min_stock > 0
                     AND stock <= min_stock
                   ORDER BY (stock::float / NULLIF(min_stock,0)) ASC
                   LIMIT 20'''
            )).fetchall()

            if not low:
                continue

            lines = "\n".join(f"  • {p[0]}: {p[1]} uds (mín: {p[2]})" for p in low)
            msg = (
                f"⚠️ *Alerta de Stock — {biz}*\n\n"
                f"Los siguientes productos están por agotarse:\n\n"
                f"{lines}\n\n"
                f"📅 {__import__('datetime').datetime.now().strftime('%d/%m/%Y %H:%M')}"
            )
            ok = await _send_wa(inst, admin_phone, msg)
            if ok:
                sent += 1

        except Exception as e:
            logger.error(f"[CRON] Stock alert error en {schema}: {e}")
        finally:
            if db: db.close()
            reset_tenant_schema()

    logger.info(f"[CRON] Alertas stock: {sent} negocios notificados")



async def send_cash_session_summary(schema: str, session_id: int):
    """
    Envía resumen del día al admin al cerrar la sesión de caja.
    Se llama desde el endpoint de cierre de caja.
    """
    db = None
    try:
        set_tenant_schema(schema)
        db = SessionLocal()

        wa = {r[0]: r[1] for r in db.execute(text(
            f"SELECT key, value FROM \"{schema}\".business_config "
            "WHERE key IN ('whatsapp_instance_name','whatsapp_instance_status',"
            "'whatsapp_admin_phone','business_name','whatsapp_notify_cash_summary')"
        )).fetchall()}

        inst        = wa.get("whatsapp_instance_name", "")
        status      = wa.get("whatsapp_instance_status", "")
        admin_phone_raw = wa.get("whatsapp_admin_phone", "") or ""
        notify      = wa.get("whatsapp_notify_cash_summary") != "false"
        biz         = wa.get("business_name") or "Mi Inventario"

        # Normalizar teléfono: quitar no-dígitos y agregar prefijo 58 si falta
        admin_phone = "".join(c for c in admin_phone_raw if c.isdigit())
        if admin_phone and not admin_phone.startswith("58"):
            admin_phone = "58" + admin_phone

        if not inst or status != "CONNECTED" or not admin_phone or not notify:
            return

        import datetime as _dt

        # Datos base de la sesión
        session_row = db.execute(text(
            f'''SELECT
                cs.start_time, cs.end_time,
                cs.initial_cash, cs.initial_cash_bs,
                cs.final_cash_reported, cs.final_cash_reported_bs,
                cs.final_cash_expected, cs.final_cash_expected_bs,
                cs.difference, cs.difference_bs,
                u.username as cajero
            FROM "{schema}".cash_sessions cs
            LEFT JOIN public.users u ON u.id = cs.user_id
            WHERE cs.id = :sid'''
        ), {"sid": session_id}).fetchone()

        if not session_row:
            return

        # Ventas de la sesión por moneda y método de pago
        sales_row = db.execute(text(
            f'''SELECT
                COUNT(DISTINCT s.id) AS total_ventas,
                COALESCE(SUM(CASE WHEN s.currency='USD' THEN s.total_amount ELSE 0 END),0) AS ventas_usd,
                COALESCE(SUM(CASE WHEN s.currency='Bs' THEN s.total_amount_bs ELSE 0 END),0) AS ventas_bs
            FROM "{schema}".cash_sessions cs
            LEFT JOIN "{schema}".sales s ON s.session_id = cs.id
            WHERE cs.id = :sid'''
        ), {"sid": session_id}).fetchone()

        # Pagos por método
        payments_rows = db.execute(text(
            f'''SELECT
                sp.payment_method,
                sp.currency,
                COALESCE(SUM(sp.amount),0) AS total
            FROM "{schema}".cash_sessions cs
            JOIN "{schema}".sales s ON s.session_id = cs.id
            JOIN "{schema}".sale_payments sp ON sp.sale_id = s.id
            WHERE cs.id = :sid
            GROUP BY sp.payment_method, sp.currency
            ORDER BY total DESC'''
        ), {"sid": session_id}).fetchall()

        now = _dt.datetime.now()
        start    = session_row.start_time
        end      = session_row.end_time or now
        cajero   = session_row.cajero or "—"
        fecha    = end.strftime('%d/%m/%Y')
        h_ini    = start.strftime('%H:%M') if start else "—"
        h_fin    = end.strftime('%H:%M')
        duracion = int((end - start).total_seconds() // 60) if start else 0

        n_ventas  = int(sales_row.total_ventas or 0)
        v_usd     = float(sales_row.ventas_usd or 0)
        v_bs      = float(sales_row.ventas_bs or 0)

        # Efectivo declarado vs esperado
        efectivo_dec_usd = float(session_row.final_cash_reported or 0)
        efectivo_dec_bs  = float(session_row.final_cash_reported_bs or 0)
        esperado_usd     = float(session_row.final_cash_expected or 0)
        esperado_bs      = float(session_row.final_cash_expected_bs or 0)
        dif_usd          = float(session_row.difference or 0)
        dif_bs           = float(session_row.difference_bs or 0)

        # Líneas de métodos de pago
        metodos_lines = ""
        for pm in payments_rows:
            sym = "$" if pm.currency == "USD" else "Bs"
            metodos_lines += f"   • {pm.payment_method}: {sym} {float(pm.total):,.2f}\n"
        if not metodos_lines:
            metodos_lines = "   Sin pagos registrados\n"

        # Estado del cuadre
        if abs(dif_usd) < 0.01 and abs(dif_bs) < 1:
            cuadre = "✅ Caja cuadrada perfectamente"
        elif dif_usd > 0 or dif_bs > 0:
            cuadre = f"⚠️ Sobrante: ${dif_usd:,.2f} | Bs {dif_bs:,.2f}"
        else:
            cuadre = f"🔴 Faltante: ${abs(dif_usd):,.2f} | Bs {abs(dif_bs):,.2f}"

        msg = (
            f"📊 *Resumen de Caja — {biz}*\n"
            f"📅 {fecha}  |  🕐 {h_ini} – {h_fin}  ({duracion} min)\n"
            f"👤 Cajero: {cajero}\n"
            f"{'─'*30}\n\n"
            f"🛒 *Ventas del turno: {n_ventas}*\n"
            f"   💵 En dólares: ${v_usd:,.2f}\n"
            f"   💳 En bolívares: Bs {v_bs:,.2f}\n\n"
            f"💰 *Pagos recibidos:*\n"
            f"{metodos_lines}\n"
            f"📦 *Cuadre de caja:*\n"
            f"   Efectivo declarado: ${efectivo_dec_usd:,.2f} | Bs {efectivo_dec_bs:,.2f}\n"
            f"   Efectivo esperado: ${esperado_usd:,.2f} | Bs {esperado_bs:,.2f}\n"
            f"   {cuadre}\n\n"
            f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        )

        await _send_wa(inst, admin_phone, msg)
        logger.info(f"[CRON] Resumen caja enviado → {schema}")

    except Exception as e:
        logger.warning(f"[CRON] Error resumen caja {schema}: {e}")
    finally:
        if db: db.close()
        reset_tenant_schema()



async def job_quote_expiry_reminders():
    """
    Recuerda a los clientes cuya cotización vence en 2 días.
    Se ejecuta diariamente a las 10:00 Venezuela.
    """
    logger.info("[CRON] Verificando cotizaciones por vencer...")
    schemas = await _get_tenant_schemas()
    sent = 0

    for schema in schemas:
        db = None
        try:
            set_tenant_schema(schema)
            db = SessionLocal()

            wa = {r[0]: r[1] for r in db.execute(text(
                f"SELECT key, value FROM \"{schema}\".business_config "
                "WHERE key IN ('whatsapp_instance_name','whatsapp_instance_status',"
                "'whatsapp_notify_quote_expiry','business_name')"
            )).fetchall()}

            inst   = wa.get("whatsapp_instance_name", "")
            status = wa.get("whatsapp_instance_status", "")
            notify = wa.get("whatsapp_notify_quote_expiry") != "false"
            biz    = wa.get("business_name") or "Mi Inventario"

            if not inst or status != "CONNECTED" or not notify:
                continue

            # Cotizaciones PENDING que vencen en exactamente 2 días
            from datetime import date, timedelta
            vence_en = date.today() + timedelta(days=2)

            rows = db.execute(text(
                f'''SELECT q.id, q.total_amount, q.valid_until,
                          c.name, c.phone
                   FROM "{schema}".quotes q
                   JOIN "{schema}".customers c ON c.id = q.customer_id
                   WHERE q.status = 'PENDING'
                     AND DATE(q.valid_until) = :vence
                     AND c.phone IS NOT NULL
                     AND c.phone != '''''
            ), {"vence": vence_en}).fetchall()

            for row in rows:
                q_id, total, valid_until, name, phone = row
                fecha_str = valid_until.strftime("%d/%m/%Y") if valid_until else "pronto"
                msg = (
                    f"📄 *{biz}*\n"
                    f"Hola {name}, tu cotización *#{q_id:04d}* vence el *{fecha_str}*.\n\n"
                    f"💰 Total: ${float(total):,.2f}\n\n"
                    f"¿Aprobamos el pedido? Respóndenos aquí 😊"
                )
                ok = await _send_wa(inst, phone, msg)
                if ok:
                    sent += 1

        except Exception as e:
            logger.error(f"[CRON] Quote expiry error en {schema}: {e}")
        finally:
            if db: db.close()
            reset_tenant_schema()

    logger.info(f"[CRON] Recordatorios cotización: {sent} enviados")


async def job_warranty_reminders():
    """
    Avisa a los clientes cuya garantía vence en 7 días.
    Se ejecuta diariamente a las 10:30 Venezuela.
    """
    logger.info("[CRON] Verificando garantías por vencer...")
    schemas = await _get_tenant_schemas()
    sent = 0

    for schema in schemas:
        db = None
        try:
            set_tenant_schema(schema)
            db = SessionLocal()

            wa = {r[0]: r[1] for r in db.execute(text(
                f"SELECT key, value FROM \"{schema}\".business_config "
                "WHERE key IN ('whatsapp_instance_name','whatsapp_instance_status',"
                "'whatsapp_notify_warranty','business_name')"
            )).fetchall()}

            inst   = wa.get("whatsapp_instance_name", "")
            status = wa.get("whatsapp_instance_status", "")
            notify = wa.get("whatsapp_notify_warranty") != "false"
            biz    = wa.get("business_name") or "Mi Inventario"

            if not inst or status != "CONNECTED" or not notify:
                continue

            from datetime import date, timedelta
            vence_en = date.today() + timedelta(days=7)

            # Órdenes de servicio cuya garantía vence en 7 días
            rows = db.execute(text(
                f'''SELECT so.id, so.ticket_number,
                          so.brand, so.model, so.device_type,
                          so.warranty_expires_at,
                          c.name, c.phone
                   FROM "{schema}".service_orders so
                   JOIN "{schema}".customers c ON c.id = so.customer_id
                   WHERE so.status = 'COMPLETED'
                     AND DATE(so.warranty_expires_at) = :vence
                     AND c.phone IS NOT NULL
                     AND c.phone != '''''
            ), {"vence": vence_en}).fetchall()

            for row in rows:
                order_id, ticket, brand, model_name, dtype, w_exp, name, phone = row
                device  = (f"{brand or ''} {model_name or ''}".strip() or dtype or "Tu equipo")
                fecha   = w_exp.strftime("%d/%m/%Y") if w_exp else "pronto"
                msg = (
                    f"🛡️ *{biz}*\n"
                    f"Hola {name}, la garantía de *{device}* "
                    f"(Orden {ticket}) vence el *{fecha}*.\n\n"
                    f"Si presentas algún problema, contáctanos antes de esa fecha. ¡Estamos para ayudarte! 😊"
                )
                ok = await _send_wa(inst, phone, msg)
                if ok:
                    sent += 1

        except Exception as e:
            logger.error(f"[CRON] Warranty reminder error en {schema}: {e}")
        finally:
            if db: db.close()
            reset_tenant_schema()

    logger.info(f"[CRON] Recordatorios garantía: {sent} enviados")


def stop_scheduler():
    """Detener el scheduler. Llamar desde main.py al shutdown."""
    if scheduler.running:
        scheduler.shutdown(wait=False)


async def send_commissions_summary(schema: str, session_id: int):
    """
    Envía resumen de comisiones de todos los vendedores al admin al cerrar caja.
    Solo se envía si whatsapp_notify_commissions = true.
    """
    db = None
    try:
        set_tenant_schema(schema)
        db = SessionLocal()

        wa = {r[0]: r[1] for r in db.execute(text(
            f"SELECT key, value FROM \"{schema}\".business_config "
            "WHERE key IN ('whatsapp_instance_name','whatsapp_instance_status',"
            "'whatsapp_admin_phone','business_name','whatsapp_notify_commissions')"
        )).fetchall()}

        inst        = wa.get("whatsapp_instance_name", "")
        status      = wa.get("whatsapp_instance_status", "")
        notify      = wa.get("whatsapp_notify_commissions") != "false"
        biz         = wa.get("business_name") or "Mi Inventario"

        admin_phone_raw = wa.get("whatsapp_admin_phone", "") or ""
        admin_phone = "".join(c for c in admin_phone_raw if c.isdigit())
        if admin_phone and not admin_phone.startswith("58"):
            admin_phone = "58" + admin_phone

        if not inst or status != "CONNECTED" or not admin_phone or not notify:
            return

        # Comisiones pendientes por vendedor
        rows = db.execute(text(
            f"""SELECT
                u.username,
                COUNT(cl.id) AS registros,
                COALESCE(SUM(cl.amount), 0)::float AS total_usd
            FROM "{schema}".commission_logs cl
            JOIN public.users u ON u.id = cl.user_id
            WHERE cl.status = 'PENDING'
            GROUP BY u.id, u.username
            ORDER BY total_usd DESC"""
        )).fetchall()

        if not rows:
            return  # Sin comisiones pendientes, no enviar

        import datetime as _dt
        fecha = _dt.datetime.now().strftime('%d/%m/%Y')
        total_global = sum(float(r.total_usd) for r in rows)

        lineas = ""
        for r in rows:
            lineas += f"   👤 {r.username}: ${float(r.total_usd):,.2f} ({int(r.registros)} ventas)\n"

        msg = (
            f"💰 *Comisiones Pendientes — {biz}*\n"
            f"📅 {fecha}\n"
            f"{'─'*30}\n\n"
            f"{lineas}\n"
            f"💵 *Total a pagar: ${total_global:,.2f}*\n\n"
            f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        )

        await _send_wa(inst, admin_phone, msg)
        logger.info(f"[WA] Comisiones enviadas → {schema}")

    except Exception as e:
        logger.error(f"[WA] Error comisiones {schema}: {e}")
    finally:
        if db:
            db.close()


async def send_commissions_pdf(schema: str, session_id: int):
    """
    Genera PDF de comisiones igual al frontend CommissionsTab y lo envía por WhatsApp.
    Columnas: FECHA | REFERENCIA | MÉTODO DE PAGO | $ | Bs | E.Q $ | FINANCIAMIENTO | NIVEL | M. FINANCIADO | ESTADO
    """
    import io, base64
    from datetime import datetime as _dt

    db = None
    try:
        set_tenant_schema(schema)
        db = SessionLocal()

        wa = {r[0]: r[1] for r in db.execute(text(
            f"SELECT key, value FROM \"{schema}\".business_config "
            "WHERE key IN ('whatsapp_instance_name','whatsapp_instance_status',"
            "'whatsapp_admin_phone','business_name','whatsapp_notify_commissions')"
        )).fetchall()}

        inst    = wa.get("whatsapp_instance_name", "")
        status  = wa.get("whatsapp_instance_status", "")
        notify  = wa.get("whatsapp_notify_commissions") != "false"
        biz     = wa.get("business_name") or "Mi Inventario"

        admin_phone_raw = wa.get("whatsapp_admin_phone", "") or ""
        admin_phone = "".join(c for c in admin_phone_raw if c.isdigit())
        if admin_phone and not admin_phone.startswith("58"):
            admin_phone = "58" + admin_phone

        if not inst or status != "CONNECTED" or not admin_phone or not notify:
            return

        # ── Datos comisiones con join correcto ──────────────────────────────
        rows = db.execute(text(f"""
            SELECT
                u.username,
                cl.source_reference,
                cl.created_at,
                cl.amount,
                cl.percentage_applied,
                cl.exchange_rate_snapshot,
                cl.paid_in_bs,
                cl.status,
                s.currency      AS sale_currency,
                s.total_amount  AS sale_total_usd,
                s.total_amount_bs AS sale_total_bs,
                s.exchange_rate_used AS sale_exchange_rate,
                (SELECT string_agg(sp2.payment_method, ', ')
                 FROM \"{schema}\".sale_payments sp2
                 WHERE sp2.sale_id = s.id) AS payment_methods
            FROM \"{schema}\".commission_logs cl
            JOIN public.users u ON u.id = cl.user_id
            LEFT JOIN \"{schema}\".sale_details sd ON sd.id = cl.source_id
            LEFT JOIN \"{schema}\".sales s ON s.id = sd.sale_id
            WHERE cl.status = 'PENDING'
            ORDER BY u.username, cl.created_at DESC
        """)).fetchall()

        if not rows:
            return

        # Totales por método de pago
        payment_totals = db.execute(text(f"""
            SELECT sp.payment_method, sp.currency,
                   COALESCE(SUM(sp.amount),0)::float AS total
            FROM \"{schema}\".commission_logs cl
            JOIN \"{schema}\".sale_details sd ON sd.id = cl.source_id
            JOIN \"{schema}\".sales s ON s.id = sd.sale_id
            JOIN \"{schema}\".sale_payments sp ON sp.sale_id = s.id
            WHERE cl.status = 'PENDING'
            GROUP BY sp.payment_method, sp.currency
            ORDER BY total DESC
        """)).fetchall()

        # Agrupar por vendedor
        from collections import defaultdict
        by_user = defaultdict(list)
        for r in rows:
            by_user[r.username].append(r)

        # ── PDF en landscape A4 ─────────────────────────────────────────────
        from reportlab.pdfgen import canvas
        from reportlab.lib.pagesizes import A4, landscape
        from reportlab.lib.units import mm

        pw, ph = landscape(A4)   # 297 x 210 mm
        buf = io.BytesIO()
        can = canvas.Canvas(buf, pagesize=landscape(A4))

        # Colores
        C_AZUL      = (0.08, 0.20, 0.45)
        C_AZUL_MED  = (0.18, 0.38, 0.70)
        C_AZUL_CL   = (0.88, 0.92, 0.97)
        C_VERDE     = (0.05, 0.45, 0.20)
        C_VERDE_CL  = (0.88, 0.97, 0.90)
        C_GRIS      = (0.25, 0.25, 0.25)
        C_GRIS_CL   = (0.95, 0.95, 0.95)
        C_BLANCO    = (1, 1, 1)
        C_AMBER     = (0.80, 0.50, 0.05)
        C_AMBER_CL  = (0.98, 0.93, 0.80)
        C_INDIGO    = (0.20, 0.20, 0.50)

        # ── Columnas exactas del frontend (en mm desde izq) ─────────────────
        # FECHA | REFERENCIA | MÉT.PAGO | $ | Bs | E.Q$ | FINANCIAMIENTO | NIVEL | M.FIN | ESTADO
        # Ancho total disponible: 10 a 287 mm = 277 mm
        # Landscape A4: ancho útil 10mm a 287mm = 277mm
        # FECHA | REFERENCIA | MÉT.PAGO | $ | Bs | E.Q $ | FINANCIAMIENTO | ESTADO
        # Columnas numéricas más anchas para evitar solapamiento
        COL = {
            "fecha":    (10,  22),   # inicio, ancho mm
            "ref":      (32,  40),
            "met":      (72,  42),
            "usd":      (114, 28),   # ancho 28 para "$2,503.20"
            "bs":       (142, 40),   # ancho 40 para "234,986.26"
            "eq":       (182, 28),   # ancho 28 para "$6,527.40"
            "fin":      (210, 40),
            "estado":   (250, 30),
        }

        fecha_hoy = _dt.now().strftime("%d/%m/%Y %H:%M")

        def rgb(c): can.setFillColorRGB(*c)
        def srgb(c): can.setStrokeColorRGB(*c)

        def page_header():
            rgb(C_AZUL); can.rect(0, ph-22*mm, pw, 22*mm, fill=1, stroke=0)
            rgb(C_BLANCO); can.setFont("Helvetica-Bold", 14)
            can.drawString(10*mm, ph-13*mm, f"COMISIONES PENDIENTES — {biz.upper()}")
            can.setFont("Helvetica", 8)
            rgb((0.75,0.85,0.95))
            can.drawRightString(pw-10*mm, ph-10*mm, f"Generado: {fecha_hoy}")
            can.drawRightString(pw-10*mm, ph-16*mm, "Solo registros con estado PENDIENTE")

        def table_header(y):
            rgb(C_AZUL_MED); can.rect(10*mm, y-7*mm, pw-20*mm, 7*mm, fill=1, stroke=0)
            rgb(C_BLANCO); can.setFont("Helvetica-Bold", 6.5)
            labels = [
                ("fecha","FECHA"),("ref","REFERENCIA"),("met","MÉT. PAGO"),
                ("usd","$"),("bs","Bs"),("eq","E.Q $"),
                ("fin","FINANCIAMIENTO"),("estado","ESTADO"),
            ]
            for key, label in labels:
                x, w = COL[key]
                # Numéricas alineadas a la derecha
                if key in ("usd","bs","eq","mfin"):
                    can.drawRightString((x+w)*mm, y-5*mm, label)
                else:
                    can.drawString(x*mm, y-5*mm, label)
            return y - 7*mm

        page_header()
        y = ph - 28*mm

        total_g_usd = 0.0
        total_g_bs  = 0.0
        total_g_com = 0.0
        last_rate   = 1.0

        for username, user_rows in by_user.items():
            # ─ Cabecera vendedor ─
            if y < 35*mm:
                can.showPage(); page_header(); y = ph - 28*mm

            rgb(C_AZUL_CL); can.rect(10*mm, y-6*mm, pw-20*mm, 6*mm, fill=1, stroke=0)
            rgb(C_AZUL); can.setFont("Helvetica-Bold", 8.5)
            can.drawString(12*mm, y-4.5*mm, f"▌ {username.upper()}")
            y -= 6*mm

            y = table_header(y)

            sub_usd = 0.0
            sub_bs  = 0.0
            sub_com = 0.0
            rate    = 1.0

            for i, r in enumerate(user_rows):
                if y < 22*mm:
                    can.showPage(); page_header(); y = ph - 28*mm
                    y = table_header(y)

                # Fondo alternado
                bg = C_GRIS_CL if i % 2 == 0 else C_BLANCO
                rgb(bg); can.rect(10*mm, y-5*mm, pw-20*mm, 5*mm, fill=1, stroke=0)

                sale_usd = float(r.sale_total_usd or 0)
                sale_bs  = float(r.sale_total_bs or 0)
                rate     = float(r.sale_exchange_rate or r.exchange_rate_snapshot or 1)
                if rate > 0: last_rate = rate
                en_bs    = (str(r.sale_currency or "") == "Bs") or bool(r.paid_in_bs)
                pct      = float(r.percentage_applied or 0)

                # Calcular comisión
                total_usd_venta = sale_usd if not en_bs else (sale_bs/rate if rate else 0)
                # cl.amount ya tiene la comisión calculada correctamente al momento de la venta
                comision = float(r.amount or 0)
                sub_usd += (sale_usd if not en_bs else 0)
                sub_bs  += (sale_bs  if en_bs     else 0)
                sub_com += comision

                yy = y - 3.5*mm
                can.setFont("Helvetica", 6.5)

                # FECHA
                fecha_str = r.created_at.strftime("%d/%m/%y") if r.created_at else "—"
                rgb(C_GRIS); can.drawString(COL["fecha"][0]*mm, yy, fecha_str)

                # REFERENCIA
                ref = str(r.source_reference or "—")
                rgb(C_GRIS); can.setFont("Helvetica-Bold", 6.5)
                can.drawString(COL["ref"][0]*mm, yy, f"[V] {ref}"[:20])

                # MÉTODO DE PAGO
                can.setFont("Helvetica", 6.5)
                rgb(C_GRIS)
                met = str(r.payment_methods or "Sin datos")[:22]
                can.drawString(COL["met"][0]*mm, yy, met)

                # $ — solo ventas en USD
                xr_usd = (COL["usd"][0] + COL["usd"][1]) * mm
                if not en_bs and sale_usd > 0:
                    rgb((0.05,0.25,0.65)); can.setFont("Helvetica-Bold", 6.5)
                    can.drawRightString(xr_usd, yy, f"${sale_usd:,.2f}")
                else:
                    rgb((0.75,0.75,0.75)); can.setFont("Helvetica", 6.5)
                    can.drawRightString(xr_usd, yy, "—")

                # Bs — solo ventas en Bs
                xr_bs = (COL["bs"][0] + COL["bs"][1]) * mm
                if en_bs and sale_bs > 0:
                    rgb(C_VERDE); can.setFont("Helvetica-Bold", 6.5)
                    can.drawRightString(xr_bs, yy, f"{sale_bs:,.2f}")
                else:
                    rgb((0.75,0.75,0.75)); can.setFont("Helvetica", 6.5)
                    can.drawRightString(xr_bs, yy, "—")

                # E.Q $ — Bs ÷ tasa (solo si venta en Bs)
                xr_eq = (COL["eq"][0] + COL["eq"][1]) * mm
                if en_bs and sale_bs > 0 and rate > 0:
                    eq = sale_bs / rate
                    rgb(C_INDIGO); can.setFont("Helvetica-Bold", 6.5)
                    can.drawRightString(xr_eq, yy, f"${eq:,.2f}")
                else:
                    rgb((0.75,0.75,0.75)); can.setFont("Helvetica", 6.5)
                    can.drawRightString(xr_eq, yy, "—")

                # FINANCIAMIENTO
                rgb(C_GRIS); can.setFont("Helvetica", 6.5)
                can.drawString(COL["fin"][0]*mm, yy, "Contado")

                # ESTADO badge
                bx = COL["estado"][0]*mm
                rgb(C_AMBER_CL); can.roundRect(bx, y-4.5*mm, 26*mm, 4.5*mm, 1, fill=1, stroke=0)
                rgb(C_AMBER); can.setFont("Helvetica-Bold", 6)
                can.drawCentredString(bx + 13*mm, y-2.5*mm, "PENDIENTE")

                y -= 5*mm

            # ─ Subtotal vendedor ─
            rgb(C_AZUL_CL); can.rect(10*mm, y-6*mm, pw-20*mm, 6*mm, fill=1, stroke=0)
            rgb(C_AZUL); can.setFont("Helvetica-Bold", 7.5)
            can.drawString(12*mm, y-4.5*mm, f"Subtotal {username}:")

            xr_usd = (COL["usd"][0]+COL["usd"][1])*mm
            xr_bs  = (COL["bs"][0]+COL["bs"][1])*mm
            xr_eq  = (COL["eq"][0]+COL["eq"][1])*mm

            if sub_usd > 0:
                rgb((0.05,0.25,0.65)); can.drawRightString(xr_usd, y-4.5*mm, f"${sub_usd:,.2f}")
            if sub_bs > 0:
                rgb(C_VERDE); can.drawRightString(xr_bs, y-4.5*mm, f"{sub_bs:,.2f}")
                eq_sub = sub_bs/last_rate if last_rate else 0
                rgb(C_INDIGO); can.drawRightString(xr_eq, y-4.5*mm, f"${eq_sub:,.2f}")

            rgb(C_VERDE); can.setFont("Helvetica-Bold", 7.5)
            can.drawString(COL["fin"][0]*mm, y-4.5*mm, f"Comisión: ${sub_com:,.2f}")

            total_g_usd += sub_usd
            total_g_bs  += sub_bs
            total_g_com += sub_com
            y -= 9*mm

        # ── TOTAL GENERAL ────────────────────────────────────────────────────
        if y < 20*mm:
            can.showPage(); page_header(); y = ph - 28*mm

        rgb(C_AZUL); can.rect(10*mm, y-10*mm, pw-20*mm, 10*mm, fill=1, stroke=0)
        rgb(C_BLANCO); can.setFont("Helvetica-Bold", 9)
        can.drawString(12*mm, y-7*mm, "TOTAL GENERAL")

        xr_usd = (COL["usd"][0]+COL["usd"][1])*mm
        xr_bs  = (COL["bs"][0]+COL["bs"][1])*mm
        xr_eq  = (COL["eq"][0]+COL["eq"][1])*mm

        if total_g_usd > 0:
            rgb(C_AZUL_CL); can.rect((COL["usd"][0]-1)*mm, y-9*mm, (COL["usd"][1]+1)*mm, 7*mm, fill=1, stroke=0)
            rgb((0.05,0.25,0.65)); can.setFont("Helvetica-Bold", 8)
            can.drawRightString(xr_usd, y-6.5*mm, f"${total_g_usd:,.2f}")
        if total_g_bs > 0:
            rgb(C_VERDE_CL); can.rect((COL["bs"][0]-1)*mm, y-9*mm, (COL["bs"][1]+1)*mm, 7*mm, fill=1, stroke=0)
            rgb(C_VERDE); can.setFont("Helvetica-Bold", 8)
            can.drawRightString(xr_bs, y-6.5*mm, f"{total_g_bs:,.2f}")
            eq_t = total_g_bs/last_rate if last_rate else 0
            rgb(C_AZUL_CL); can.rect((COL["eq"][0]-1)*mm, y-9*mm, (COL["eq"][1]+1)*mm, 7*mm, fill=1, stroke=0)
            rgb(C_INDIGO); can.drawRightString(xr_eq, y-6.5*mm, f"${eq_t:,.2f}")

        # Badge total comisiones
        bx = (COL["fin"][0])*mm
        bw = pw - bx - 12*mm
        can.setFillColorRGB(1, 0.85, 0.1)
        can.roundRect(bx, y-9*mm, bw, 7*mm, 2, fill=1, stroke=0)
        rgb((0.35,0.15,0)); can.setFont("Helvetica-Bold", 9)
        can.drawCentredString(bx + bw/2, y-6*mm, f"TOTAL COMISIONES:  ${total_g_com:,.2f}")
        y -= 14*mm

        # ── TOTALES POR MÉTODO DE PAGO ────────────────────────────────────────
        FOOTER_H = 12*mm
        if payment_totals:
            n = len(payment_totals)
            rows_needed = (n + 2) // 3
            block_h = 9*mm + rows_needed*11*mm + 4*mm
            if y - block_h < FOOTER_H + 2*mm:
                can.showPage(); page_header(); y = ph - 28*mm

            y -= 3*mm
            rgb(C_AZUL); can.rect(10*mm, y-7*mm, pw-20*mm, 7*mm, fill=1, stroke=0)
            rgb(C_BLANCO); can.setFont("Helvetica-Bold", 8.5)
            can.drawString(12*mm, y-5*mm, "TOTALES POR MÉTODO DE PAGO")
            y -= 10*mm

            col_w = (pw - 20*mm) / 3
            col_i = 0
            row_y = y

            for pt in payment_totals:
                is_usd = str(pt.currency) == "USD"
                total_fmt = f"${float(pt.total):,.2f}" if is_usd else f"Bs {float(pt.total):,.2f}"
                xp = 10*mm + (col_i % 3) * col_w
                if col_i > 0 and col_i % 3 == 0:
                    row_y -= 11*mm

                bg_b = C_AZUL_CL if is_usd else C_VERDE_CL
                rgb(bg_b); can.roundRect(xp, row_y-8*mm, col_w-3*mm, 8.5*mm, 2, fill=1, stroke=0)
                fg = (0.05,0.25,0.60) if is_usd else C_VERDE
                rgb(fg); can.setFont("Helvetica-Bold", 7.5)
                can.drawString(xp+2*mm, row_y-3.5*mm, str(pt.payment_method)[:24])
                can.setFont("Helvetica-Bold", 8.5)
                can.drawString(xp+2*mm, row_y-7*mm, total_fmt)
                col_i += 1

            y = row_y - 13*mm

        # ── FOOTER ────────────────────────────────────────────────────────────
        rgb(C_AZUL); can.rect(0, 0, pw, FOOTER_H, fill=1, stroke=0)
        rgb(C_BLANCO); can.setFont("Helvetica", 7.5)
        can.drawCentredString(pw/2, 4.5*mm, f"{biz}  •  Reporte de Comisiones Pendientes  •  {fecha_hoy}")

        can.save()
        buf.seek(0)
        pdf_bytes = buf.read()

        # ── Enviar mensaje + PDF ──────────────────────────────────────────────
        n_vendedores = len(by_user)
        n_registros  = len(rows)
        msg = (
            f"💰 *Comisiones Pendientes — {biz}*\n"
            f"📅 {_dt.now().strftime('%d/%m/%Y %H:%M')}\n\n"
            f"👥 Vendedores: {n_vendedores}\n"
            f"📋 Registros: {n_registros}\n"
            f"💵 Total comisiones: ${total_g_com:,.2f}\n\n"
            f"📎 Adjunto el cuadro completo en PDF."
        )
        await _send_wa(inst, admin_phone, msg)

        async with __import__("httpx").AsyncClient(timeout=30) as c:
            await c.post(f"{WA_URL}/instance/{inst}/send-document", json={
                "phone": admin_phone,
                "base64": base64.b64encode(pdf_bytes).decode(),
                "filename": f"comisiones_{_dt.now().strftime('%d%m%Y')}.pdf",
                "caption": f"Comisiones Pendientes — {biz}"
            })

        logger.info(f"[WA] PDF comisiones enviado → {schema}")

    except Exception as e:
        logger.error(f"[WA] Error PDF comisiones {schema}: {e}")
        import traceback; logger.error(traceback.format_exc())
    finally:
        if db:
            db.close()
