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
                     "WHERE key IN ('whatsapp_instance_name','whatsapp_instance_status',"
                     "'whatsapp_notify_credit_reminder','whatsapp_template_credit','business_name')")
            ).fetchall()}

            inst   = wa_cfg.get("whatsapp_instance_name", "")
            status = wa_cfg.get("whatsapp_instance_status", "")
            notify = wa_cfg.get("whatsapp_notify_credit_reminder") != "false"

            if not inst or status != "CONNECTED" or not notify:
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

            # Obtener clientes con saldo vencido > 0.01
            # Consideramos "vencido" si la venta de crédito tiene más de 1 día
            customers = db.execute(text(f"""
                SELECT c.id, c.name, c.phone,
                       SUM(s.balance_pending) as total_deuda
                FROM "{schema}".customers c
                JOIN "{schema}".sales s ON s.customer_id = c.id
                WHERE s.is_credit = true
                  AND s.paid = false
                  AND s.balance_pending > 0.01
                  AND c.phone IS NOT NULL
                  AND c.phone != ''
                  AND s.date < NOW() - INTERVAL '1 day'
                GROUP BY c.id, c.name, c.phone
                HAVING SUM(s.balance_pending) > 0.01
            """)).fetchall()

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


def stop_scheduler():
    """Detener el scheduler. Llamar desde main.py al shutdown."""
    if scheduler.running:
        scheduler.shutdown(wait=False)
