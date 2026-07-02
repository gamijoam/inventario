import re
from datetime import datetime
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..database.db import get_db
from ..dependencies import get_current_active_user
from ..models import models
from ..services.sync_client import pull_catalog_from_cloud, push_sales_to_cloud
from ..tenant_context import get_tenant_schema

router = APIRouter(prefix="/sync-local", tags=["sync-local"])

SYNC_MONITORED_TABLES = [
    ("sync_outbox", "Eventos offline"),
    ("sync_conflicts", "Conflictos de sincronizacion"),
    ("sales", "Ventas"),
    ("sale_details", "Detalle de ventas"),
    ("sale_detail_instances", "Seriales vendidos"),
    ("sale_payments", "Pagos de ventas"),
    ("cash_sessions", "Sesiones de caja"),
    ("cash_session_currencies", "Arqueo por moneda"),
    ("cash_movements", "Movimientos de caja"),
    ("returns", "Devoluciones"),
    ("return_details", "Detalle de devoluciones"),
    ("return_detail_instances", "Seriales devueltos"),
    ("payments", "Abonos CxC"),
    ("layaways", "Apartados"),
    ("layaway_items", "Items de apartados"),
    ("layaway_payments", "Pagos de apartados"),
    ("layaway_events", "Eventos de apartados"),
    ("accounting_ledger_entries", "Libro contable"),
]
_IDENTIFIER_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


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


def _is_safe_identifier(value: str) -> bool:
    return bool(_IDENTIFIER_RE.fullmatch(value or ""))


def _table_has_columns(db: Session, schema: str, table_name: str, columns: List[str]) -> bool:
    if not _is_safe_identifier(schema) or not _is_safe_identifier(table_name):
        return False

    result = db.execute(
        text(
            """
            SELECT COUNT(*)
            FROM information_schema.columns
            WHERE table_schema = :schema
              AND table_name = :table_name
              AND column_name = ANY(:columns)
            """
        ),
        {"schema": schema, "table_name": table_name, "columns": columns},
    ).scalar()
    return int(result or 0) == len(columns)


def _pending_count_for_table(db: Session, schema: str, table_name: str) -> int:
    if table_name == "sync_outbox":
        if not _table_has_columns(db, schema, table_name, ["status"]):
            return 0
        sql = text(
            f'''
            SELECT COUNT(*)
            FROM "{schema}"."{table_name}"
            WHERE COALESCE(status, 'PENDING') IN ('PENDING', 'ERROR')
            '''
        )
        return int(db.execute(sql).scalar() or 0)

    if table_name == "sync_conflicts":
        if not _table_has_columns(db, schema, table_name, ["status"]):
            return 0
        sql = text(
            f'''
            SELECT COUNT(*)
            FROM "{schema}"."{table_name}"
            WHERE COALESCE(status, 'OPEN') = 'OPEN'
            '''
        )
        return int(db.execute(sql).scalar() or 0)

    if table_name == "sales":
        return db.query(models.Sale).filter(
            models.Sale.sync_status == "PENDING",
            models.Sale.is_offline_sale == True,
        ).count()

    if not _table_has_columns(db, schema, table_name, ["sync_status", "is_offline_origin"]):
        return 0

    sql = text(
        f'''
        SELECT COUNT(*)
        FROM "{schema}"."{table_name}"
        WHERE COALESCE(sync_status, 'SYNCED') IN ('PENDING', 'ERROR')
          AND COALESCE(is_offline_origin, FALSE) = TRUE
        '''
    )
    return int(db.execute(sql).scalar() or 0)


def _sync_pending_summary(db: Session) -> Dict[str, Any]:
    schema = get_tenant_schema() or "public"
    modules = []
    total = 0
    metadata_ready = True

    for table_name, label in SYNC_MONITORED_TABLES:
        if table_name in {"sync_outbox", "sync_conflicts"}:
            has_metadata = _table_has_columns(db, schema, table_name, ["status"])
        else:
            has_metadata = table_name == "sales" or _table_has_columns(
                db,
                schema,
                table_name,
                ["sync_uuid", "sync_status", "is_offline_origin", "synced_at", "sync_error"],
            )
        count = _pending_count_for_table(db, schema, table_name) if has_metadata else 0
        total += count
        metadata_ready = metadata_ready and has_metadata
        modules.append({
            "table": table_name,
            "label": label,
            "pending": count,
            "metadata_ready": has_metadata,
        })

    return {
        "schema": schema,
        "metadata_ready": metadata_ready,
        "total_pending": total,
        "modules": modules,
    }


def _pending_sales_count(db: Session) -> int:
    return _pending_count_for_table(db, get_tenant_schema() or "public", "sales")


@router.get("/status")
def sync_local_status(
    db: Session = Depends(get_db),
    user: Any = Depends(get_current_active_user),
):
    config = _get_config_map(db)
    pending_summary = _sync_pending_summary(db)
    return {
        "configured": bool(config.get("cloud_url")),
        "cloud_url": config.get("cloud_url"),
        "tenant_subdomain": config.get("cloud_tenant_subdomain"),
        "sync_enabled": (config.get("offline_sync_enabled", "true").lower() == "true"),
        "sync_interval_minutes": int(config.get("offline_sync_interval_minutes") or 10),
        "safe_stock_mode": (config.get("offline_safe_stock_mode", "true").lower() == "true"),
        "install_mode": config.get("offline_install_mode") or "store_server",
        "pending_sales": _pending_sales_count(db),
        "pending_summary": pending_summary,
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
            "pending_summary": _sync_pending_summary(db),
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
        "pending_summary": _sync_pending_summary(db),
        "push": push_result,
        "pull": pull_result,
        "details": {
            "products": int(pull_result.get("products") or 0),
            "customers": int(pull_result.get("customers") or 0),
            "pushed_sales": int(push_result.get("pushed") or push_result.get("synced_count") or 0),
        },
        "synced_at": datetime.utcnow().isoformat() + "Z",
    }
