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
    Consulta el BCV y actualiza automáticamente la tasa USD/VES
    en TODOS los tenants activos. Corre cada 2 horas.
    Solo actualiza tasas que tengan currency_code='VES' o 'Bs' y is_active=True.
    """
    import re, urllib3, requests as _req
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

    # 1. Scrape BCV
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

    # Extraer tasa USD/VES
    m = re.search(
        r'id=["\']dolar["\'][^>]*>.*?<strong[^>]*>\s*([\d,\.]+)\s*</strong>',
        html, re.DOTALL | re.IGNORECASE
    )
    if not m:
        logger.error("[BCV_AUTO] No se pudo extraer la tasa USD del HTML del BCV.")
        return

    try:
        usd_ves = round(float(m.group(1).strip().replace(",", ".")), 8)
    except ValueError as e:
        logger.error(f"[BCV_AUTO] Error convirtiendo tasa: {e}")
        return

    logger.info(f"[BCV_AUTO] Tasa BCV obtenida: 1 USD = {usd_ves} VES")

    # 2. Actualizar en todos los tenants activos
    db: Session = db_session_factory()
    try:
        from .models.tenant import Tenant
        from .models.models import ExchangeRate
        from sqlalchemy import text as _t
        from datetime import datetime as _dt

        tenants = db.query(Tenant).filter(Tenant.is_active == True).all()
        updated_count = 0

        for tenant in tenants:
            try:
                # Buscar tasas VES activas en este tenant
                rates = db.execute(_t(f"""
                    SELECT id, name, rate, currency_code, is_default
                    FROM {tenant.schema_name}.exchange_rates
                    WHERE is_active = true
                      AND (currency_code IN ('VES', 'Bs', 'BS', 'ves')
                           OR name ILIKE '%BCV%'
                           OR name ILIKE '%boliv%'
                           OR name ILIKE '%VES%')
                """)).all()

                if not rates:
                    continue

                for rate in rates:
                    old_rate = float(rate.rate)
                    if abs(old_rate - usd_ves) < 0.01:
                        continue  # Sin cambio significativo

                    db.execute(_t(f"""
                        UPDATE {tenant.schema_name}.exchange_rates
                        SET rate = :new_rate, updated_at = :now
                        WHERE id = :rate_id
                    """), {"new_rate": usd_ves, "now": _dt.utcnow(), "rate_id": rate.id})

                    updated_count += 1
                    logger.info(
                        f"[BCV_AUTO] {tenant.schema_name}: {rate.name} "
                        f"{old_rate} → {usd_ves} VES/USD"
                    )

                    # Invalidar caché Redis de exchange_rates para este tenant
                    try:
                        from .cache import invalidate
                        invalidate(tenant.schema_name, "exchange_rates")
                        invalidate(tenant.schema_name, "pos_init")
                    except Exception:
                        pass

            except Exception as e:
                logger.error(f"[BCV_AUTO] Error en tenant {tenant.schema_name}: {e}")
                continue

        db.commit()
        logger.info(f"[BCV_AUTO] ✅ Actualización completada. {updated_count} tasas actualizadas.")

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

    # Actualización automática de tasa BCV cada 2 horas
    scheduler.add_job(
        _auto_update_bcv_rate,
        trigger="interval",
        hours=2,
        args=[db_session_factory],
        id="auto_update_bcv_rate",
        replace_existing=True,
        misfire_grace_time=600,  # 10 min de gracia si el servidor estaba inactivo
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
        "auto_update_bcv_rate @ cada 2 horas"
    )


def stop_scheduler():
    """Para el scheduler."""
    if scheduler.running:
        scheduler.shutdown()
        logger.info("[SCHEDULER] Stopped.")
