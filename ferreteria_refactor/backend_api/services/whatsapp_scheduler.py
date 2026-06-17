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
    PDF de comisiones usando reportlab Table — layout automático sin solapamientos.
    Replica el frontend CommissionsTab con todos sus cálculos.
    """
    import io, base64
    from datetime import datetime as _dt
    from collections import defaultdict
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib.units import mm
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.enums import TA_RIGHT, TA_CENTER, TA_LEFT

    db = None
    try:
        set_tenant_schema(schema)
        db = SessionLocal()

        wa = {r[0]: r[1] for r in db.execute(text(
            f'SELECT key, value FROM "{schema}".business_config '
            "WHERE key IN ('whatsapp_instance_name','whatsapp_instance_status',"
            "'whatsapp_admin_phone','business_name','whatsapp_notify_commissions')"
        )).fetchall()}

        inst   = wa.get("whatsapp_instance_name", "")
        status = wa.get("whatsapp_instance_status", "")
        notify = wa.get("whatsapp_notify_commissions") != "false"
        biz    = wa.get("business_name") or "Mi Inventario"

        admin_phone_raw = wa.get("whatsapp_admin_phone", "") or ""
        admin_phone = "".join(c for c in admin_phone_raw if c.isdigit())
        if admin_phone and not admin_phone.startswith("58"):
            admin_phone = "58" + admin_phone

        if not inst or status != "CONNECTED" or not admin_phone or not notify:
            return

        rows = db.execute(text(
            f'SELECT u.username, cl.source_reference, cl.created_at, cl.amount,'
            f' cl.percentage_applied, cl.exchange_rate_snapshot, cl.paid_in_bs,'
            f' s.currency AS sale_currency, s.total_amount AS sale_total_usd,'
            f' s.total_amount_bs AS sale_total_bs, s.exchange_rate_used AS sale_exchange_rate,'
            f' (SELECT string_agg(sp2.payment_method, \', \')'
            f'  FROM "{schema}".sale_payments sp2 WHERE sp2.sale_id = s.id) AS payment_methods'
            f' FROM "{schema}".commission_logs cl'
            f' JOIN public.users u ON u.id = cl.user_id'
            f' LEFT JOIN "{schema}".sale_details sd ON sd.id = cl.source_id'
            f' LEFT JOIN "{schema}".sales s ON s.id = sd.sale_id'
            f' WHERE cl.status = \'PENDING\''
            f' ORDER BY u.username, cl.created_at DESC'
        )).fetchall()

        if not rows:
            return

        pay_totals = db.execute(text(
            f'SELECT sp.payment_method, sp.currency,'
            f' COALESCE(SUM(sp.amount),0)::float AS total'
            f' FROM "{schema}".commission_logs cl'
            f' JOIN "{schema}".sale_details sd ON sd.id = cl.source_id'
            f' JOIN "{schema}".sales s ON s.id = sd.sale_id'
            f' JOIN "{schema}".sale_payments sp ON sp.sale_id = s.id'
            f' WHERE cl.status = \'PENDING\''
            f' GROUP BY sp.payment_method, sp.currency ORDER BY total DESC'
        )).fetchall()

        by_user = defaultdict(list)
        for r in rows:
            by_user[r.username].append(r)

        # ── Calcular totales (igual al frontend) ───────────────────────────
        pct       = float(rows[0].percentage_applied or 0) if rows else 0
        pct_label = f"{pct:.1f}%" if pct else None
        last_rate = 489.55

        g_total_usd = 0.0
        g_total_bs  = 0.0
        for r in rows:
            rate = float(r.sale_exchange_rate or r.exchange_rate_snapshot or last_rate)
            if rate > 0: last_rate = rate
            en_bs = (str(r.sale_currency or "") == "Bs") or bool(r.paid_in_bs)
            g_total_usd += float(r.sale_total_usd or 0) if not en_bs else 0
            g_total_bs  += float(r.sale_total_bs  or 0) if en_bs     else 0

        total_eq     = g_total_bs / last_rate if last_rate else 0
        comision_usd = g_total_usd * (pct / 100)
        comision_eq  = total_eq    * (pct / 100)

        def fusd(v): return f"${v:,.2f}" if v else "—"
        def fbs(v):  return f"{v:,.2f}"  if v else "—"

        # ── Colores ────────────────────────────────────────────────────────
        C_HEADER  = colors.HexColor("#132e74")
        C_COL_HDR = colors.HexColor("#2d5fb5")
        C_VND_HDR = colors.HexColor("#dde8f5")
        C_ALT     = colors.HexColor("#f8f8fa")
        C_WHITE   = colors.white
        C_USD     = colors.HexColor("#0d3fa6")
        C_GRN     = colors.HexColor("#0d7040")
        C_IND     = colors.HexColor("#2e2e7a")
        C_ESM     = colors.HexColor("#065f46")
        C_MUTED   = colors.HexColor("#bbbbbb")
        C_PEND_BG = colors.HexColor("#fef3c7")
        C_PEND_FG = colors.HexColor("#b45309")
        C_FOOT1   = colors.HexColor("#dde8f5")
        C_FOOT2   = colors.HexColor("#f6f6fa")
        C_FOOT3   = colors.HexColor("#ecfdf5")
        C_AZUL_VND= colors.HexColor("#132e74")

        # ── Estilos de párrafo ─────────────────────────────────────────────
        FS = 7  # font size
        def ps(align=TA_LEFT, color=colors.black, bold=False, size=FS):
            return ParagraphStyle('x', fontSize=size,
                leading=size+2, alignment=align,
                textColor=color,
                fontName='Helvetica-Bold' if bold else 'Helvetica')

        # ── Definición de columnas ─────────────────────────────────────────
        # Landscape A4 = 277mm útil
        # FECHA | REFERENCIA | MÉT.PAGO | $ | Bs | E.Q$ | FINANCIAMIENTO | NIVEL | ESTADO
        # Landscape A4 útil=277mm — 8 columnas (sin NIVEL)
        # FECHA+REF+MET+$+Bs+EQ+FIN+ESTADO = 20+42+50+30+44+30+36+25 = 277mm
        COL_W = [20, 42, 50, 30, 44, 30, 36, 25]  # mm
        COL_W_PT = [w*mm for w in COL_W]

        def row_data(fecha, ref, met, usd_val, bs_val, eq_val, fin, nivel, estado,
                     usd_color=C_USD, bs_color=C_GRN, eq_color=C_IND):
            return [
                Paragraph(fecha, ps(TA_LEFT,  colors.HexColor("#666666"), size=FS)),
                Paragraph(ref,   ps(TA_LEFT,  colors.black, bold=True, size=FS)),
                Paragraph(met,   ps(TA_LEFT,  colors.HexColor("#444444"), size=FS)),
                Paragraph(usd_val, ps(TA_RIGHT, usd_color, bold=bool(usd_val!="—"), size=FS)),
                Paragraph(bs_val,  ps(TA_RIGHT, bs_color,  bold=bool(bs_val!="—"),  size=FS)),
                Paragraph(eq_val,  ps(TA_RIGHT, eq_color,  bold=bool(eq_val!="—"),  size=FS)),
                Paragraph(fin,   ps(TA_LEFT,  colors.HexColor("#666666"), size=FS)),
                Paragraph(estado, ps(TA_CENTER, C_PEND_FG, bold=True, size=6.5)),
            ]

        # ── Construir tabla ────────────────────────────────────────────────
        data = []
        style_cmds = []
        ROW = [0]  # contador de filas

        def add_style(cmd):
            style_cmds.append(cmd)

        # Header principal
        data.append([
            Paragraph(f"COMISIONES PENDIENTES — {biz.upper()}", ps(TA_LEFT, C_WHITE, bold=True, size=10)),
            '', '', '', '', '', '', '',
            Paragraph(f"Generado: {_dt.now().strftime('%d/%m/%Y %H:%M')}", ps(TA_RIGHT, colors.HexColor("#b0c4de"), size=6)),
        ])
        add_style(('BACKGROUND', (0,0), (-1,0), C_HEADER))
        add_style(('SPAN', (0,0), (6,0)))
        add_style(('ROWBACKGROUND', (0,0), (-1,0), C_HEADER))
        add_style(('TOPPADDING', (0,0), (-1,0), 5))
        add_style(('BOTTOMPADDING', (0,0), (-1,0), 5))
        ROW[0] += 1

        fecha_hoy = _dt.now().strftime("%d/%m/%Y %H:%M")

        for username, user_rows in by_user.items():
            # Cabecera vendedor
            r = ROW[0]
            data.append([Paragraph(f"▌ {username.upper()}", ps(TA_LEFT, C_AZUL_VND, bold=True, size=8)),
                          '','','','','','','',''])
            add_style(('BACKGROUND', (0,r), (-1,r), C_VND_HDR))
            add_style(('SPAN', (0,r), (-1,r)))
            add_style(('TOPPADDING', (0,r), (-1,r), 3))
            add_style(('BOTTOMPADDING', (0,r), (-1,r), 3))
            ROW[0] += 1

            # Cabecera columnas
            r = ROW[0]
            data.append([
                Paragraph('FECHA',          ps(TA_LEFT,   C_WHITE, bold=True, size=6.5)),
                Paragraph('REFERENCIA',     ps(TA_LEFT,   C_WHITE, bold=True, size=6.5)),
                Paragraph('MÉT. PAGO',      ps(TA_LEFT,   C_WHITE, bold=True, size=6.5)),
                Paragraph('$',              ps(TA_RIGHT,  C_WHITE, bold=True, size=6.5)),
                Paragraph('Bs',             ps(TA_RIGHT,  C_WHITE, bold=True, size=6.5)),
                Paragraph('E.Q $',          ps(TA_RIGHT,  C_WHITE, bold=True, size=6.5)),
                Paragraph('FINANCIAMIENTO', ps(TA_LEFT,   C_WHITE, bold=True, size=6.5)),
                Paragraph('ESTADO',         ps(TA_CENTER, C_WHITE, bold=True, size=6.5)),
            ])
            add_style(('BACKGROUND', (0,r), (-1,r), C_COL_HDR))
            add_style(('TOPPADDING', (0,r), (-1,r), 2))
            add_style(('BOTTOMPADDING', (0,r), (-1,r), 2))
            ROW[0] += 1

            for i, row in enumerate(user_rows):
                rate  = float(row.sale_exchange_rate or row.exchange_rate_snapshot or last_rate)
                if rate > 0: last_rate = rate
                en_bs = (str(row.sale_currency or "") == "Bs") or bool(row.paid_in_bs)
                sale_usd = float(row.sale_total_usd or 0)
                sale_bs  = float(row.sale_total_bs  or 0)

                usd_v = fusd(sale_usd) if not en_bs and sale_usd else "—"
                bs_v  = fbs(sale_bs)   if en_bs     and sale_bs  else "—"
                eq_v  = fusd(sale_bs/rate) if en_bs and sale_bs and rate else "—"

                usd_c = C_USD   if usd_v != "—" else C_MUTED
                bs_c  = C_GRN   if bs_v  != "—" else C_MUTED
                eq_c  = C_IND   if eq_v  != "—" else C_MUTED

                fecha_str = row.created_at.strftime("%d/%m/%y") if row.created_at else "—"
                metodo = str(row.payment_methods or "Sin datos")[:28]

                r_idx = ROW[0]
                data.append(row_data(
                    fecha_str, f"[V] {str(row.source_reference or '—')}", metodo,
                    usd_v, bs_v, eq_v, "Contado", "—", "PENDIENTE",
                    usd_color=usd_c, bs_color=bs_c, eq_color=eq_c
                ))
                if i % 2 == 0:
                    add_style(('BACKGROUND', (0,r_idx), (-1,r_idx), C_ALT))
                add_style(('TOPPADDING', (0,r_idx), (-1,r_idx), 2))
                add_style(('BOTTOMPADDING', (0,r_idx), (-1,r_idx), 2))
                add_style(('LINEBELOW', (0,r_idx), (-1,r_idx), 0.3, colors.HexColor("#eeeeee")))
                # PENDIENTE badge bg
                add_style(('BACKGROUND', (7,r_idx), (7,r_idx), C_PEND_BG))
                ROW[0] += 1

        # ── Fila TOTALES ───────────────────────────────────────────────────
        r = ROW[0]
        tot_usd = fusd(g_total_usd) if g_total_usd else "—"
        tot_bs  = fbs(g_total_bs)   if g_total_bs  else "—"
        tot_eq  = fusd(total_eq)    if total_eq    else "—"
        data.append([
            Paragraph('', ps()), Paragraph('', ps()), Paragraph('TOTALES', ps(TA_RIGHT, C_AZUL_VND, bold=True, size=7.5)),
            Paragraph(tot_usd, ps(TA_RIGHT, C_USD if g_total_usd else C_MUTED, bold=True, size=7.5)),
            Paragraph(tot_bs,  ps(TA_RIGHT, C_GRN if g_total_bs  else C_MUTED, bold=True, size=7.5)),
            Paragraph(tot_eq,  ps(TA_RIGHT, C_IND if total_eq    else C_MUTED, bold=True, size=7.5)),
            Paragraph('', ps()), Paragraph('', ps()),
        ])
        add_style(('BACKGROUND', (0,r), (-1,r), C_FOOT1))
        add_style(('LINEABOVE', (0,r), (-1,r), 1.5, C_COL_HDR))
        add_style(('TOPPADDING', (0,r), (-1,r), 3))
        add_style(('BOTTOMPADDING', (0,r), (-1,r), 3))
        ROW[0] += 1

        # ── Fila POR MÉTODO DE PAGO — SPAN completo de izq a der ──────────
        r = ROW[0]
        # Todos los metodos en una sola linea con separador
        all_mets_parts = []
        for pt in pay_totals:
            is_usd = str(pt.currency) == "USD"
            fmt = f"${float(pt.total):,.2f}" if is_usd else f"Bs {float(pt.total):,.2f}"
            color = "#0d3fa6" if is_usd else "#0d7040"
            all_mets_parts.append(f'<font color="{color}"><b>{pt.payment_method}:</b> {fmt}</font>')
        mets_inline = '     <font color="#aaaaaa">|</font>     '.join(all_mets_parts)

        data.append([
            Paragraph('POR MÉTODO DE PAGO', ps(TA_RIGHT, colors.HexColor("#35354a"), bold=True, size=7)),
            Paragraph(mets_inline, ps(TA_LEFT, colors.black, size=7.5)),
            '', '', '', '', '', '',
        ])
        # SPAN desde col 1 hasta el final — toda la anchura para los badges
        add_style(('SPAN', (1,r), (7,r)))
        add_style(('BACKGROUND', (0,r), (-1,r), C_FOOT2))
        add_style(('LINEABOVE', (0,r), (-1,r), 0.5, colors.HexColor("#dddddd")))
        add_style(('TOPPADDING', (0,r), (-1,r), 4))
        add_style(('BOTTOMPADDING', (0,r), (-1,r), 4))
        add_style(('LEFTPADDING', (1,r), (1,r), 8))
        ROW[0] += 1

        # ── Fila COMISIÓN X% ───────────────────────────────────────────────
        if pct_label:
            r = ROW[0]
            com_usd = fusd(comision_usd) if comision_usd else "—"
            com_eq  = fusd(comision_eq)  if comision_eq  else "—"
            data.append([
                Paragraph('', ps()), Paragraph('', ps()),
                Paragraph(f'COMISIÓN {pct_label}', ps(TA_RIGHT, C_ESM, bold=True, size=7.5)),
                Paragraph(com_usd, ps(TA_RIGHT, C_ESM if comision_usd else C_MUTED, bold=True, size=7.5)),
                Paragraph('—',     ps(TA_RIGHT, C_MUTED, size=7.5)),
                Paragraph(com_eq,  ps(TA_RIGHT, C_ESM if comision_eq  else C_MUTED, bold=True, size=7.5)),
                Paragraph('', ps()), Paragraph('', ps()),
            ])
            add_style(('BACKGROUND', (0,r), (-1,r), C_FOOT3))
            add_style(('LINEABOVE', (0,r), (-1,r), 0.5, colors.HexColor("#6ee7b7")))
            add_style(('TOPPADDING', (0,r), (-1,r), 3))
            add_style(('BOTTOMPADDING', (0,r), (-1,r), 3))
            ROW[0] += 1

        # ── Ensamblar PDF ──────────────────────────────────────────────────
        buf = io.BytesIO()
        doc = SimpleDocTemplate(buf, pagesize=landscape(A4),
            leftMargin=8*mm, rightMargin=8*mm,
            topMargin=8*mm, bottomMargin=8*mm)

        # Estilo global de la tabla
        base_style = TableStyle([
            ('FONT', (0,0), (-1,-1), 'Helvetica', FS),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('GRID', (0,1), (-1,-1), 0.2, colors.HexColor("#eeeeee")),
        ] + style_cmds)

        t = Table(data, colWidths=COL_W_PT, repeatRows=1)
        t.setStyle(base_style)

        doc.build([t])
        pdf_bytes = buf.getvalue()

        # ── Enviar por WhatsApp ────────────────────────────────────────────
        total_com = comision_usd + comision_eq
        msg = (
            f"💰 *Comisiones Pendientes — {biz}*\n"
            f"📅 {_dt.now().strftime('%d/%m/%Y %H:%M')}\n\n"
            f"👥 Vendedores: {len(by_user)}\n"
            f"📋 Registros: {len(rows)}\n"
            f"💵 Total comisiones: ${total_com:,.2f}\n\n"
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
        logger.info(f"[WA] PDF comisiones (Table) enviado: {schema}")

    except Exception as e:
        logger.error(f"[WA] Error PDF comisiones {schema}: {e}")
        import traceback; logger.error(traceback.format_exc())
    finally:
        if db: db.close()
