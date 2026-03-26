"""APScheduler para tareas programadas del sistema."""
import logging
from datetime import datetime, timedelta

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import or_, and_
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)
scheduler = AsyncIOScheduler()


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
    scheduler.start()
    logger.info(
        "[SCHEDULER] Started. Jobs: auto_expire_tenants @ 00:05 UTC daily, "
        "send_expiry_warnings @ 09:00 UTC daily, "
        "auto_backup @ 05:00 UTC (01:00 Venezuela) daily (keeps last 7)"
    )


def stop_scheduler():
    """Para el scheduler."""
    if scheduler.running:
        scheduler.shutdown()
        logger.info("[SCHEDULER] Stopped.")
