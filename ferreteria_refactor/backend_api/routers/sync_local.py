from datetime import datetime
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database.db import get_db
from ..dependencies import get_current_active_user
from ..models import models
from ..services.sync_client import pull_catalog_from_cloud, push_sales_to_cloud

router = APIRouter(prefix="/sync-local", tags=["sync-local"])


def _get_config_map(db: Session) -> Dict[str, str]:
    keys = [
        "cloud_url",
        "cloud_tenant_subdomain",
        "offline_sync_enabled",
        "offline_sync_interval_minutes",
        "offline_safe_stock_mode",
        "offline_install_mode",
    ]
    rows = db.query(models.BusinessConfig).filter(models.BusinessConfig.key.in_(keys)).all()
    return {row.key: row.value for row in rows}


def _pending_sales_count(db: Session) -> int:
    return db.query(models.Sale).filter(
        models.Sale.sync_status == "PENDING",
        models.Sale.is_offline_sale == True,
    ).count()


@router.get("/status")
def sync_local_status(
    db: Session = Depends(get_db),
    user: Any = Depends(get_current_active_user),
):
    config = _get_config_map(db)
    return {
        "configured": bool(config.get("cloud_url")),
        "cloud_url": config.get("cloud_url"),
        "tenant_subdomain": config.get("cloud_tenant_subdomain"),
        "sync_enabled": (config.get("offline_sync_enabled", "true").lower() == "true"),
        "sync_interval_minutes": int(config.get("offline_sync_interval_minutes") or 10),
        "safe_stock_mode": (config.get("offline_safe_stock_mode", "true").lower() == "true"),
        "install_mode": config.get("offline_install_mode") or "store_server",
        "pending_sales": _pending_sales_count(db),
        "checked_at": datetime.utcnow().isoformat() + "Z",
    }


@router.post("/trigger")
async def trigger_local_sync(
    db: Session = Depends(get_db),
    user: Any = Depends(get_current_active_user),
):
    config = _get_config_map(db)
    cloud_url = (config.get("cloud_url") or "").strip()
    tenant_subdomain = (config.get("cloud_tenant_subdomain") or "").strip() or None
    sync_enabled = (config.get("offline_sync_enabled", "true").lower() == "true")

    if not cloud_url:
        raise HTTPException(status_code=400, detail="Configura la URL nube antes de sincronizar.")

    if not sync_enabled:
        return {
            "status": "disabled",
            "message": "La sincronizacion automatica esta desactivada en este equipo.",
            "details": {"products": 0, "customers": 0},
            "pending_sales": _pending_sales_count(db),
        }

    before_pending = _pending_sales_count(db)
    push_result = {"status": "skipped", "pushed": 0}
    pull_result = {"status": "skipped", "products": 0, "customers": 0}

    try:
        # Primero subimos movimientos locales para evitar que un pull pise stock local pendiente.
        push_result = await push_sales_to_cloud(db, cloud_url, tenant_subdomain=tenant_subdomain)
        pull_result = await pull_catalog_from_cloud(db, cloud_url, tenant_subdomain=tenant_subdomain)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"No se pudo sincronizar con la nube: {exc}") from exc

    after_pending = _pending_sales_count(db)
    return {
        "status": "success",
        "message": "Sincronizacion completada.",
        "tenant_subdomain": tenant_subdomain,
        "before_pending_sales": before_pending,
        "pending_sales": after_pending,
        "push": push_result,
        "pull": pull_result,
        "details": {
            "products": int(pull_result.get("products") or 0),
            "customers": int(pull_result.get("customers") or 0),
            "pushed_sales": int(push_result.get("pushed") or push_result.get("synced_count") or 0),
        },
        "synced_at": datetime.utcnow().isoformat() + "Z",
    }
