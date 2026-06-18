"""APScheduler para tareas programadas del sistema."""
import logging
from datetime import datetime, timedelta
from .services import whatsapp_scheduler as _wa_sched

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import or_, and_
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)
scheduler = AsyncIOScheduler(timezone="UTC")


def _auto_expire_tenants(db_session_factory):
    """Desactiva tenants con suscripción vencida. Corre diariamente a las 00:05."""
    db: Session = db_session_factory()
    try:
        from .models.tenant import Tenant
        now = datetime.utcnow()
        grace_period = timedelta(days=5)

        expired = db.query(Tenant).filter(
            Tenant.is_active == True,
            or_(
                and_(
                    Tenant.license_type == "trial",
                    Tenant.trial_ends_at != None,
                    Tenant.trial_ends_at < (now - grace_period),
                ),
                and_(
                    Tenant.license_type != "trial",
                    Tenant.license_type != "lifetime",
                    Tenant.subscription_expires_at != None,
                    Tenant.subscription_expires_at < (now - grace_period),
                ),
            ),
        ).all()

        for tenant in expired:
            tenant.is_active = False
            tenant.license_blocked_reason = "expired"
            logger.info(f"[LICENSE] Auto-expired tenant: {tenant.schema_name}")

        db.commit()
        logger.info(f"[LICENSE] Expiry check done. Disabled {len(expired)} tenants.")
    except Exception as e:
        logger.exception(f"[LICENSE] Error in auto_expire_tenants: {e}")
        db.rollback()
    finally:
        db.close()


def _send_expiry_warnings(db_session_factory):
    """Envía emails de advertencia 7 días antes del vencimiento. Corre diariamente a las 09:00 UTC."""
    db: Session = db_session_factory()
    try:
        from .models.tenant import Tenant
        from .models.models import User, UserRole
        from .utils.email_utils import send_expiry_warning_email

        now = datetime.utcnow()
        warning_window_end = now + timedelta(days=7)

        expiring_soon = db.query(Tenant).filter(
            Tenant.is_active == True,
            Tenant.license_type != "lifetime",
            or_(
                and_(
                    Tenant.license_type == "trial",
                    Tenant.trial_ends_at != None,
                    Tenant.trial_ends_at >= now,
                    Tenant.trial_ends_at <= warning_window_end,
                ),
                and_(
                    Tenant.license_type.in_(["monthly", "annual"]),
                    Tenant.subscription_expires_at != None,
                    Tenant.subscription_expires_at >= now,
                    Tenant.subscription_expires_at <= warning_window_end,
                ),
            ),
        ).all()

        warned = 0
        for tenant in expiring_soon:
            # Determine the relevant expiry datetime
            if tenant.license_type == "trial":
                expiry_dt = tenant.trial_ends_at
            else:
                expiry_dt = tenant.subscription_expires_at

            days_remaining = max(0, (expiry_dt - now).days)
            expiry_date_str = expiry_dt.strftime("%d/%m/%Y")

            # Determine tenant URL from domain or schema_name
            domain = tenant.domain or f"{tenant.schema_name}.miinventariofacil.com"
            tenant_url = f"https://{domain}"

            # Fetch admin user email from public.users
            admin_user = (
                db.query(User)
                .filter(
                    User.tenant_id == tenant.id,
                    User.role == UserRole.ADMIN,
                    User.is_active == True,
                )
                .first()
            )

            if not admin_user or not admin_user.email:
                logger.warning(
                    f"[EXPIRY WARNING] No active admin email found for tenant: {tenant.schema_name} — skipping."
                )
                continue

            try:
                send_expiry_warning_email(
                    email_to=admin_user.email,
                    company_name=tenant.name,
                    days_remaining=days_remaining,
                    expiry_date=expiry_date_str,
                    tenant_url=tenant_url,
                )
                logger.info(
                    f"[EXPIRY WARNING] Sent warning to {admin_user.email} "
                    f"for tenant '{tenant.schema_name}' — {days_remaining} days left."
                )
                warned += 1
            except Exception as mail_err:
                logger.error(
                    f"[EXPIRY WARNING] Failed to send email for tenant '{tenant.schema_name}': {mail_err}"
                )

        logger.info(f"[EXPIRY WARNING] Check done. Warned {warned}/{len(expiring_soon)} tenants.")
    except Exception as e:
        logger.exception(f"[EXPIRY WARNING] Error in _send_expiry_warnings: {e}")
    finally:
        db.close()


def _auto_backup(keep_last: int = 7):
    """Genera respaldo automático diario y elimina los más antiguos. Corre a las 05:00 UTC (01:00 Venezuela)."""
    try:
        from .services import backup_service
        logger.info("[BACKUP] Starting automatic daily backup...")
        result = backup_service.create_backup()
        logger.info(f"[BACKUP] Created: {result['filename']} ({result['size']})")

        # Auto-cleanup: keep only the last `keep_last` backups
        all_backups = backup_service.list_backups()
        if len(all_backups) > keep_last:
            to_delete = all_backups[keep_last:]  # already sorted desc by date
            for b in to_delete:
                try:
                    backup_service.delete_backup(b["filename"])
                    logger.info(f"[BACKUP] Auto-deleted old backup: {b['filename']}")
                except Exception as del_err:
                    logger.warning(f"[BACKUP] Could not delete {b['filename']}: {del_err}")

        logger.info(f"[BACKUP] Done. Kept last {keep_last} backups.")
    except Exception as e:
        logger.exception(f"[BACKUP] Error in auto_backup: {e}")


def _sync_bloqueos_pendientes(db_session_factory):
    """Reintenta sincronizar ventas a crédito pendientes con BloqueCelular. Corre cada hora."""
    from .services import bloqueocelular_service as bcs
    from .models.models import Sale, Customer, ProductInstance, SaleDetailInstance
    
    db: Session = db_session_factory()
    try:
        # Check all schemas
        from sqlalchemy import text as _sched_text
        result = db.execute(_sched_text("SELECT schema_name FROM information_schema.schemata"))
        schemas = [row[0] for row in result.fetchall() if row[0] not in ('pg_catalog', 'information_schema', 'pg_toast') and not row[0].startswith('pg_')]
        
        for schema in schemas:
            try:
                # Find pending sales
                pending_sales = db.query(Sale).filter(
                    Sale.is_credit == True,
                    Sale.bloqueo_sincronizado == False,
                    Sale.bloqueo_dispositivo_id == None
                ).execution_options(schema_translate_map={None: schema}).all()
                
                if not pending_sales:
                    continue
                    
                if not bcs.is_enabled(db, schema):
                    continue
                    
                logger.info(f"[Bloqueo] {schema}: Encontradas {len(pending_sales)} ventas pendientes de sincronizar.")
                
                for sale in pending_sales:
                    # Get customer
                    customer = db.query(Customer).filter(Customer.id == sale.customer_id).execution_options(schema_translate_map={None: schema}).first()
                    if not customer:
                        continue
                        
                    # Find IMEI from details
                    imei = None
                    product_name = "Dispositivo"
                    instances = db.query(ProductInstance).join(SaleDetailInstance).filter(
                        SaleDetailInstance.sale_detail_id.in_([d.id for d in sale.details])
                    ).execution_options(schema_translate_map={None: schema}).all()
                    
                    if instances:
                        imei = instances[0].serial_number
                        product_name = instances[0].product.name
                        
                    res = bcs.sincronizar_venta_credito(
                        db=db,
                        schema=schema,
                        sale_id=sale.id,
                        customer_name=customer.name,
                        customer_phone=customer.phone,
                        customer_id_number=customer.id_number,
                        customer_email=customer.email,
                        total_amount=float(sale.total_amount),
                        balance_pending=float(sale.balance_pending),
                        due_date=sale.due_date,
                        imei=imei,
                        product_name=product_name,
                        num_cuotas=sale.credit_installments or 6
                    )
                    
                    if res.get("ok"):
                        logger.info(f"[Bloqueo] {schema}: Venta {sale.id} sincronizada correctamente en reintento.")
                    else:
                        logger.warning(f"[Bloqueo] {schema}: Reintento fallido para venta {sale.id} - {res.get('error')}")
            except Exception as e:
                logger.error(f"[Bloqueo] Error iterando esquema {schema}: {e}")
    except Exception as e:
        logger.exception(f"[Bloqueo] Error in _sync_bloqueos_pendientes: {e}")
    finally:
        db.close()

def _auto_update_bcv_rate(db_session_factory):
    """
    Consulta el BCV y actualiza solo las tasas marcadas como automaticas.
    Corre cada hora entre 06:00 y 22:00 (America/Caracas).
    """
    import re
    import urllib3
    import requests as _req
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

    logger.info("[BCV_AUTO] Iniciando consulta automatica de tasas BCV...")

    # 1. Scrape BCV (USD/VES y EUR/VES)
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0 Safari/537.36",
            "Accept-Language": "es-VE,es;q=0.9",
            "Cache-Control": "no-cache",
        }
        resp = _req.get("https://www.bcv.org.ve/", headers=headers, timeout=15, verify=False)
        resp.raise_for_status()
        html = resp.text
    except Exception as e:
        logger.error(f"[BCV_AUTO] No se pudo conectar al BCV: {e}")
        return

    def extract_rate(currency_id: str):
        pattern = (
            r'id=["\']' + re.escape(currency_id) + r'["\'][^>]*>'
            r'.*?<strong[^>]*>\s*([\d,\.]+)\s*</strong>'
        )
        m = re.search(pattern, html, re.DOTALL | re.IGNORECASE)
        if not m:
            return None
        try:
            return round(float(m.group(1).strip().replace(",", ".")), 8)
        except ValueError:
            return None

    bcv_rates = {
        "bcv_usd": extract_rate("dolar"),
        "bcv_eur": extract_rate("euro"),
    }

    if bcv_rates["bcv_usd"] is None and bcv_rates["bcv_eur"] is None:
        logger.error("[BCV_AUTO] No se pudieron extraer tasas del HTML del BCV.")
        return

    logger.info(
        "[BCV_AUTO] Tasas obtenidas: USD=%s VES, EUR=%s VES",
        bcv_rates["bcv_usd"],
        bcv_rates["bcv_eur"],
    )

    # 2. Actualizar solo tasas activas con auto_update_enabled=true
    db: Session = db_session_factory()
    try:
        from .models.tenant import Tenant
        from sqlalchemy import text as _t
        from datetime import datetime as _dt

        def quote_schema(schema_name: str) -> str:
            return '"' + schema_name.replace('"', '""') + '"'

        tenants = db.query(Tenant).filter(Tenant.is_active == True).all()
        updated_count = 0
        eligible_count = 0

        for tenant in tenants:
            try:
                schema = tenant.schema_name
                ready = db.execute(_t("""
                    SELECT COUNT(*)
                    FROM information_schema.columns
                    WHERE table_schema = :schema
                      AND table_name = 'exchange_rates'
                      AND column_name IN ('auto_update_enabled', 'auto_update_source')
                """), {"schema": schema}).scalar() or 0
                if ready < 2:
                    logger.warning("[BCV_AUTO] %s: columnas de auto-update no disponibles, omitido.", schema)
                    continue

                qschema = quote_schema(schema)
                rates = db.execute(_t(f"""
                    SELECT id, name, rate, currency_code, auto_update_source
                    FROM {qschema}.exchange_rates
                    WHERE is_active = true
                      AND auto_update_enabled = true
                      AND auto_update_source IN ('bcv_usd', 'bcv_eur')
                """)).all()

                eligible_count += len(rates)
                tenant_updates = 0

                for row in rates:
                    data = row._mapping
                    source = data["auto_update_source"] or "bcv_usd"
                    new_rate = bcv_rates.get(source)
                    if new_rate is None:
                        logger.warning("[BCV_AUTO] %s: fuente %s sin valor BCV disponible.", schema, source)
                        continue

                    old_rate = float(data["rate"])
                    if abs(old_rate - new_rate) < 0.0001:
                        continue

                    db.execute(_t(f"""
                        UPDATE {qschema}.exchange_rates
                        SET rate = :new_rate, updated_at = :now
                        WHERE id = :rate_id
                    """), {"new_rate": new_rate, "now": _dt.utcnow(), "rate_id": data["id"]})

                    tenant_updates += 1
                    updated_count += 1
                    logger.info(
                        "[BCV_AUTO] %s: %s %.8f -> %.8f (%s)",
                        schema, data["name"], old_rate, new_rate, source,
                    )

                if tenant_updates:
                    db.commit()
                    try:
                        from .cache import invalidate
                        invalidate(schema, "exchange_rates")
                        invalidate(schema, "pos_init")
                        invalidate(schema, "pos-init")
                    except Exception:
                        pass

            except Exception as e:
                db.rollback()
                logger.error(f"[BCV_AUTO] Error en tenant {tenant.schema_name}: {e}")
                continue

        logger.info(
            "[BCV_AUTO] Actualizacion completada. Elegibles=%s, actualizadas=%s.",
            eligible_count,
            updated_count,
        )

    except Exception as e:
        logger.exception(f"[BCV_AUTO] Error general: {e}")
        db.rollback()
    finally:
        db.close()


def start_scheduler(db_session_factory):
    """Registra los jobs y arranca el scheduler."""
    from .config import settings

    # En modo single-tenant/offline, no expiramos licencias ni enviamos emails
    if not settings.SINGLE_TENANT:
        scheduler.add_job(
            _auto_expire_tenants,
            trigger="cron",
            hour=0,
            minute=5,
            args=[db_session_factory],
            id="auto_expire_tenants",
            replace_existing=True,
        )
        scheduler.add_job(
            _send_expiry_warnings,
            trigger="cron",
            hour=9,
            minute=0,
            args=[db_session_factory],
            id="send_expiry_warnings",
            replace_existing=True,
        )

    scheduler.add_job(
        _auto_backup,
        trigger="cron",
        hour=5,
        minute=0,
        id="auto_backup",
        replace_existing=True,
    )

    scheduler.add_job(
        _sync_bloqueos_pendientes,
        trigger="interval",
        hours=1,
        args=[db_session_factory],
        id="sync_bloqueos_pendientes",
        replace_existing=True,
    )

    # Tasa BCV automatica: cada hora de 06:00 a 22:00 Venezuela
    scheduler.add_job(
        _auto_update_bcv_rate,
        trigger="cron",
        hour="6-22",
        minute=0,
        timezone="America/Caracas",
        args=[db_session_factory],
        id="auto_update_bcv_rate",
        replace_existing=True,
        misfire_grace_time=1800,
        coalesce=True,
        max_instances=1,
    )

    # WhatsApp — recordatorio de deuda diario a las 09:00 Venezuela
    scheduler.add_job(
        _wa_sched.job_credit_reminders,
        trigger="cron",
        hour=9,
        minute=0,
        timezone="America/Caracas",
        id="whatsapp_credit_reminders",
        replace_existing=True,
        misfire_grace_time=3600,
    )

    # WhatsApp — alertas de stock bajo a las 08:00 Venezuela (antes de abrir)
    scheduler.add_job(
        _wa_sched.job_stock_alerts,
        trigger="cron",
        hour=8, minute=0, timezone="America/Caracas",
        id="whatsapp_stock_alerts", replace_existing=True, misfire_grace_time=3600,
    )

    # WhatsApp — cotizaciones por vencer (2 días) a las 10:00 Venezuela
    scheduler.add_job(
        _wa_sched.job_quote_expiry_reminders,
        trigger="cron",
        hour=10, minute=0, timezone="America/Caracas",
        id="whatsapp_quote_expiry", replace_existing=True, misfire_grace_time=3600,
    )

    # WhatsApp — garantías por vencer (7 días) a las 10:30 Venezuela
    scheduler.add_job(
        _wa_sched.job_warranty_reminders,
        trigger="cron",
        hour=10, minute=30, timezone="America/Caracas",
        id="whatsapp_warranty_reminders", replace_existing=True, misfire_grace_time=3600,
    )

    scheduler.start()
    logger.info(
        "[SCHEDULER] Started. Jobs: auto_expire_tenants @ 00:05 UTC daily, "
        "send_expiry_warnings @ 09:00 UTC daily, "
        "auto_backup @ 05:00 UTC (01:00 Venezuela) daily (keeps last 7), "
        "auto_update_bcv_rate @ hourly 06:00-22:00 America/Caracas"
    )
    for job in scheduler.get_jobs():
        logger.info("[SCHEDULER] Job %s next run: %s", job.id, job.next_run_time)


def stop_scheduler():
    """Para el scheduler."""
    if scheduler.running:
        scheduler.shutdown()
        logger.info("[SCHEDULER] Stopped.")
