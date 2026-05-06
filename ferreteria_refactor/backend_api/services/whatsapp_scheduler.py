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
    Genera un PDF con el cuadro de comisiones de todos los vendedores
    y lo envía al admin por WhatsApp al cerrar la caja.
    """
    import io
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

        # ── Datos de comisiones por vendedor ─────────────────────────────────
        rows = db.execute(text(f"""
            SELECT
                u.username,
                cl.source_reference,
                cl.created_at,
                cl.amount,
                cl.percentage_applied,
                cl.exchange_rate_snapshot,
                cl.amount_bs,
                cl.paid_in_bs,
                cl.status,
                s.currency      AS sale_currency,
                s.total_amount  AS sale_total_usd,
                s.total_amount_bs AS sale_total_bs,
                s.exchange_rate_used AS sale_exchange_rate,
                sp.payment_methods
            FROM "{schema}".commission_logs cl
            JOIN public.users u ON u.id = cl.user_id
            LEFT JOIN "{schema}".sale_details sd ON sd.id = cl.source_id
            LEFT JOIN "{schema}".sales s ON s.id = sd.sale_id
            LEFT JOIN (
                SELECT sale_id, string_agg(payment_method, ', ') AS payment_methods
                FROM "{schema}".sale_payments
                GROUP BY sale_id
            ) sp ON sp.sale_id = s.id
            WHERE cl.status = 'PENDING'
            ORDER BY u.username, cl.created_at DESC
        """)).fetchall()

        if not rows:
            return  # Sin comisiones pendientes

        # Agrupar por vendedor
        from collections import defaultdict
        by_user = defaultdict(list)
        for r in rows:
            by_user[r.username].append(r)

        # ── Generar PDF ───────────────────────────────────────────────────────
        from reportlab.pdfgen import canvas
        from reportlab.lib.pagesizes import A4, landscape
        from reportlab.lib.units import mm

        buffer = io.BytesIO()
        pw, ph = landscape(A4)
        can = canvas.Canvas(buffer, pagesize=landscape(A4))

        AZUL     = (0.08, 0.20, 0.45)
        AZUL_MED = (0.18, 0.38, 0.70)
        AZUL_CL  = (0.88, 0.92, 0.97)
        VERDE    = (0.08, 0.50, 0.25)
        ROJO     = (0.70, 0.10, 0.10)
        GRIS_OSC = (0.25, 0.25, 0.25)
        GRIS_CL  = (0.95, 0.95, 0.95)
        BLANCO   = (1, 1, 1)
        NEGRO    = (0, 0, 0)
        AMBER    = (0.80, 0.50, 0.05)

        fecha_hoy = _dt.now().strftime('%d/%m/%Y %H:%M')

        def draw_page_header():
            # Header azul
            can.setFillColorRGB(*AZUL)
            can.rect(0, ph - 22*mm, pw, 22*mm, fill=1, stroke=0)
            can.setFillColorRGB(*BLANCO)
            can.setFont("Helvetica-Bold", 16)
            can.drawString(12*mm, ph - 13*mm, f"💰  REPORTE DE COMISIONES PENDIENTES — {biz.upper()}")
            can.setFont("Helvetica", 9)
            can.setFillColorRGB(0.75, 0.85, 0.95)
            can.drawRightString(pw - 12*mm, ph - 10*mm, f"Generado: {fecha_hoy}")
            can.drawRightString(pw - 12*mm, ph - 16*mm, "Solo comisiones PENDIENTES de pago")

        # Columnas exactas igual al frontend CommissionsTab
        # REFERENCIA | MÉT. PAGO | $ | Bs | E.Q $ | FINANCIAMIENTO | NIVEL | M. FINANCIADO | ESTADO
        COLS = [
            (12*mm,   45*mm,  "REFERENCIA"),
            (57*mm,   38*mm,  "MÉT. PAGO"),
            (95*mm,   22*mm,  "$"),
            (117*mm,  28*mm,  "Bs"),
            (145*mm,  22*mm,  "E.Q $"),
            (167*mm,  38*mm,  "FINANCIAMIENTO"),
            (205*mm,  22*mm,  "NIVEL"),
            (227*mm,  28*mm,  "M. FINANCIADO"),
            (255*mm,  35*mm,  "ESTADO"),
        ]

        def draw_table_header(y):
            can.setFillColorRGB(*AZUL_MED)
            can.rect(10*mm, y - 7*mm, pw - 20*mm, 7*mm, fill=1, stroke=0)
            can.setFillColorRGB(*BLANCO)
            can.setFont("Helvetica-Bold", 7.5)
            for x, _, label in COLS:
                can.drawString(x, y - 5.5*mm, label)
            return y - 7*mm

        draw_page_header()
        y = ph - 28*mm

        total_global_usd = 0.0
        total_global_bs  = 0.0
        total_comision   = 0.0

        for username, user_rows in by_user.items():
            # ── Cabecera del vendedor ─────────────────────────────────────
            if y < 35*mm:
                can.showPage()
                draw_page_header()
                y = ph - 28*mm

            can.setFillColorRGB(*AZUL_CL)
            can.rect(10*mm, y - 6*mm, pw - 20*mm, 6*mm, fill=1, stroke=0)
            can.setFillColorRGB(*AZUL)
            can.setFont("Helvetica-Bold", 9)
            can.drawString(12*mm, y - 4.5*mm, f"👤  {username.upper()}")
            y -= 6*mm

            # Encabezado de columnas
            y = draw_table_header(y)

            subtotal_usd = 0.0
            subtotal_bs  = 0.0
            sub_comision = 0.0

            for i, r in enumerate(user_rows):
                if y < 25*mm:
                    can.showPage()
                    draw_page_header()
                    y = ph - 28*mm
                    y = draw_table_header(y)

                bg = GRIS_CL if i % 2 == 0 else BLANCO
                can.setFillColorRGB(*bg)
                can.rect(10*mm, y - 5.5*mm, pw - 20*mm, 5.5*mm, fill=1, stroke=0)

                vendido_en_bs = (r.sale_currency == 'Bs') if r.sale_currency else (r.paid_in_bs or False)
                sale_usd = float(r.sale_total_usd or 0)
                sale_bs  = float(r.sale_total_bs or 0)
                rate     = float(r.sale_exchange_rate or r.exchange_rate_snapshot or 1)
                pct      = float(r.percentage_applied or 0)

                # Total en $ para comisión
                if vendido_en_bs:
                    total_venta_usd = sale_bs / rate if rate else 0
                else:
                    total_venta_usd = sale_usd

                comision = total_venta_usd * (pct / 100) if pct else float(r.amount or 0)
                subtotal_usd += (0 if vendido_en_bs else sale_usd)
                subtotal_bs  += (sale_bs if vendido_en_bs else 0)
                sub_comision += comision

                fecha_str = r.created_at.strftime('%d/%m/%y') if r.created_at else '—'

                yy = y - 4*mm
                can.setFont("Helvetica", 7.5)

                # REFERENCIA
                can.setFillColorRGB(*GRIS_OSC)
                ref = str(r.source_reference or '—')
                source_type = getattr(r, 'source_type', 'SALE')
                icon = '🔧' if source_type == 'SERVICE' else '🛒'
                can.drawString(12*mm, yy, f"{icon} {ref}"[:22])

                # MÉTODO DE PAGO
                can.setFillColorRGB(*GRIS_OSC)
                can.drawString(57*mm, yy, str(r.payment_methods or '—')[:20])

                # $ — solo si venta en dólares
                if not vendido_en_bs and sale_usd:
                    can.setFillColorRGB(0.05, 0.30, 0.65)
                    can.setFont("Helvetica-Bold", 7.5)
                    can.drawString(95*mm, yy, f"${sale_usd:,.2f}")
                else:
                    can.setFillColorRGB(*GRIS_OSC)
                    can.setFont("Helvetica", 7.5)
                    can.drawString(95*mm, yy, "—")

                # Bs — solo si venta en bolívares
                if vendido_en_bs and sale_bs:
                    can.setFillColorRGB(*VERDE)
                    can.setFont("Helvetica-Bold", 7.5)
                    can.drawString(117*mm, yy, f"{sale_bs:,.2f}")
                else:
                    can.setFillColorRGB(*GRIS_OSC)
                    can.setFont("Helvetica", 7.5)
                    can.drawString(117*mm, yy, "—")

                # E.Q $ — Bs ÷ tasa del día
                if vendido_en_bs and sale_bs and rate:
                    eq = sale_bs / rate
                    can.setFillColorRGB(GRIS_OSC[0], GRIS_OSC[1], GRIS_OSC[2])
                    can.setFont("Helvetica-Bold", 7.5)
                    can.drawString(145*mm, yy, f"${eq:,.2f}")
                else:
                    can.setFillColorRGB(*GRIS_OSC)
                    can.setFont("Helvetica", 7.5)
                    can.drawString(145*mm, yy, "—")

                # FINANCIAMIENTO
                financing = getattr(r, 'financing_method', None)
                can.setFillColorRGB(*GRIS_OSC)
                can.setFont("Helvetica", 7.5)
                can.drawString(167*mm, yy, str(financing or 'Contado')[:16])

                # NIVEL
                nivel = getattr(r, 'financing_level', None)
                can.drawString(205*mm, yy, str(nivel or '—')[:10])

                # M. FINANCIADO
                fin_amount = getattr(r, 'financed_amount', None)
                if fin_amount:
                    can.drawString(227*mm, yy, f"${float(fin_amount):,.2f}")
                else:
                    can.drawString(227*mm, yy, "—")

                # ESTADO
                can.setFillColorRGB(*AMBER)
                can.setFont("Helvetica-Bold", 7)
                can.drawString(255*mm, yy, "PENDIENTE")

                y -= 5.5*mm

            # ── Subtotal vendedor ─────────────────────────────────────────
            can.setFillColorRGB(*AZUL_CL)
            can.rect(10*mm, y - 6*mm, pw - 20*mm, 6*mm, fill=1, stroke=0)
            can.setFillColorRGB(*AZUL)
            can.setFont("Helvetica-Bold", 8)
            can.drawString(12*mm, y - 4.5*mm, f"Subtotal {username}:")
            if subtotal_usd:
                can.drawString(95*mm, y - 4.5*mm, f"${subtotal_usd:,.2f}")
            if subtotal_bs:
                eq_sub = subtotal_bs / rate if rate else 0
                can.drawString(117*mm, y - 4.5*mm, f"Bs {subtotal_bs:,.2f}")
                can.drawString(145*mm, y - 4.5*mm, f"${eq_sub:,.2f}")
            can.setFillColorRGB(*VERDE)
            can.drawString(220*mm, y - 4.5*mm, f"Total comisión: ${sub_comision:,.2f}")

            total_global_usd += subtotal_usd
            total_global_bs  += subtotal_bs
            total_comision   += sub_comision
            y -= 9*mm

        # ── TOTAL GLOBAL ──────────────────────────────────────────────────────
        if y < 20*mm:
            can.showPage()
            draw_page_header()
            y = ph - 28*mm

        can.setFillColorRGB(*AZUL)
        can.rect(10*mm, y - 10*mm, pw - 20*mm, 10*mm, fill=1, stroke=0)
        can.setFillColorRGB(*BLANCO)
        can.setFont("Helvetica-Bold", 10)
        can.drawString(12*mm, y - 7*mm, "TOTAL GENERAL")
        if total_global_usd:
            can.drawString(95*mm, y - 7*mm, f"${total_global_usd:,.2f}")
        if total_global_bs:
            eq_total = total_global_bs / rate if rate else 0
            can.drawString(117*mm, y - 7*mm, f"Bs {total_global_bs:,.2f}")
            can.drawString(145*mm, y - 7*mm, f"${eq_total:,.2f}")
        can.setFillColorRGB(1, 0.9, 0.3)
        can.drawString(210*mm, y - 7*mm, f"TOTAL COMISIONES: ${total_comision:,.2f}")

        # Footer
        can.setFillColorRGB(*AZUL)
        can.rect(0, 0, pw, 8*mm, fill=1, stroke=0)
        can.setFillColorRGB(*BLANCO)
        can.setFont("Helvetica", 7)
        can.drawCentredString(pw / 2, 3*mm,
            f"{biz}  •  Reporte de Comisiones Pendientes  •  {fecha_hoy}")

        can.save()
        buffer.seek(0)
        pdf_bytes = buffer.read()

        # ── Enviar mensaje previo + PDF ───────────────────────────────────────
        n_vendedores = len(by_user)
        n_registros  = len(rows)
        msg = (
            f"💰 *Comisiones Pendientes — {biz}*\n"
            f"📅 {_dt.now().strftime('%d/%m/%Y %H:%M')}\n\n"
            f"👥 Vendedores: {n_vendedores}\n"
            f"📋 Registros: {n_registros}\n"
            f"💵 Total comisiones: ${total_comision:,.2f}\n\n"
            f"📎 Adjunto el cuadro completo de comisiones."
        )

        import base64
        await _send_wa(inst, admin_phone, msg)

        # Enviar PDF
        async with __import__('httpx').AsyncClient(timeout=30) as c:
            r = await c.post(
                f"{WA_URL}/instance/{inst}/send-document",
                json={
                    "phone": admin_phone,
                    "base64": base64.b64encode(pdf_bytes).decode(),
                    "filename": f"comisiones_{_dt.now().strftime('%d%m%Y')}.pdf",
                    "caption": f"Comisiones Pendientes — {biz}"
                }
            )

        logger.info(f"[WA] PDF comisiones enviado → {schema}")

    except Exception as e:
        logger.error(f"[WA] Error PDF comisiones {schema}: {e}")
        import traceback; logger.error(traceback.format_exc())
    finally:
        if db:
            db.close()
