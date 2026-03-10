"""APScheduler para tareas programadas del sistema."""
import logging
from datetime import datetime

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

        expired = db.query(Tenant).filter(
            Tenant.is_active == True,
            or_(
                and_(
                    Tenant.license_type == "trial",
                    Tenant.trial_ends_at != None,
                    Tenant.trial_ends_at < now,
                ),
                and_(
                    Tenant.license_type != "trial",
                    Tenant.license_type != "lifetime",
                    Tenant.subscription_expires_at != None,
                    Tenant.subscription_expires_at < now,
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


def start_scheduler(db_session_factory):
    """Registra los jobs y arranca el scheduler."""
    scheduler.add_job(
        _auto_expire_tenants,
        trigger="cron",
        hour=0,
        minute=5,
        args=[db_session_factory],
        id="auto_expire_tenants",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("[SCHEDULER] Started. Jobs: auto_expire_tenants @ 00:05 UTC daily")


def stop_scheduler():
    """Para el scheduler."""
    if scheduler.running:
        scheduler.shutdown()
        logger.info("[SCHEDULER] Stopped.")
