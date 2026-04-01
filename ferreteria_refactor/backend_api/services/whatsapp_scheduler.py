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
            admin_phone = wa.get("whatsapp_admin_phone", "")
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
        admin_phone = wa.get("whatsapp_admin_phone", "")
        notify      = wa.get("whatsapp_notify_cash_summary") != "false"
        biz         = wa.get("business_name") or "Mi Inventario"

        if not inst or status != "CONNECTED" or not admin_phone or not notify:
            return

        # Obtener resumen de la sesión
        row = db.execute(text(
            f'''SELECT
                cs.start_time, cs.end_time,
                COUNT(DISTINCT s.id)        AS total_ventas,
                COALESCE(SUM(s.total_amount),0) AS total_usd,
                COALESCE(SUM(s.total_amount_bs),0) AS total_bs
            FROM "{schema}".cash_sessions cs
            LEFT JOIN "{schema}".sales s
                ON s.date BETWEEN cs.start_time AND COALESCE(cs.end_time, NOW())
            WHERE cs.id = :sid
            GROUP BY cs.id'''
        ), {"sid": session_id}).fetchone()

        if not row:
            return

        start, end, n_ventas, total_usd, total_bs = row
        fecha = (end or __import__('datetime').datetime.now()).strftime('%d/%m/%Y')
        hora_inicio = start.strftime('%H:%M') if start else '-'
        hora_fin    = (end or __import__('datetime').datetime.now()).strftime('%H:%M')

        msg = (
            f"📊 *Resumen de Caja — {biz}*\n"
            f"📅 {fecha} | {hora_inicio}–{hora_fin}\n\n"
            f"🛒 Ventas realizadas: {n_ventas}\n"
            f"💵 Total USD: ${float(total_usd):,.2f}\n"
            f"💳 Total Bs: Bs {float(total_bs):,.2f}\n\n"
            f"✅ Caja cerrada correctamente."
        )

        await _send_wa(inst, admin_phone, msg)
        logger.info(f"[CRON] Resumen caja enviado → {schema}")

    except Exception as e:
        logger.warning(f"[CRON] Error resumen caja {schema}: {e}")
    finally:
        if db: db.close()
        reset_tenant_schema()


def stop_scheduler():
    """Detener el scheduler. Llamar desde main.py al shutdown."""
    if scheduler.running:
        scheduler.shutdown(wait=False)
