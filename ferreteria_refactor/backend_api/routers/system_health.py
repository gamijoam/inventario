from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Dict, Any, Optional
import json
import hashlib

from ..database.db import get_db, _validate_schema_name
from ..dependencies import get_current_superuser
from ..models.models import User
from ..models.tenant import Tenant
from ..utils.time_utils import get_venezuela_now
from datetime import timedelta

router = APIRouter(
    prefix="/admin/dashboard",
    tags=["system-health"],
    dependencies=[Depends(get_current_superuser)],
)

SYSTEM_HEALTH_ALLOWED_KINDS = {"CLIENT_ERROR", "API_ERROR", "NETWORK_ERROR"}


def _parse_system_event_changes(raw_changes: Optional[str]) -> Dict[str, Any]:
    if not raw_changes:
        return {}
    try:
        parsed = json.loads(raw_changes)
        return parsed if isinstance(parsed, dict) else {"message": str(parsed)}
    except Exception:
        return {"message": raw_changes[:1000]}


def _system_health_severity(kind: str, status_code: Optional[int]) -> str:
    normalized = (kind or "CLIENT_ERROR").upper()
    if status_code and status_code >= 500:
        return "critical"
    if normalized == "NETWORK_ERROR":
        return "warning"
    if normalized == "API_ERROR":
        return "warning" if status_code and status_code < 500 else "critical"
    return "error"


def _event_signature(source: str, message: str, route: str, url: str, status_code: Optional[int]) -> str:
    base = "|".join([
        source or "frontend",
        str(status_code or ""),
        (route or url or "sin-ruta")[:180],
        (message or "sin-mensaje")[:220],
    ])
    return hashlib.sha1(base.encode("utf-8", errors="ignore")).hexdigest()[:12]


def _health_check_item(
    check_id: str,
    title: str,
    status: str,
    severity: str,
    description: str,
    metric: Optional[int] = None,
    details: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    return {
        "id": check_id,
        "title": title,
        "status": status,
        "severity": severity,
        "description": description,
        "metric": metric,
        "details": details or [],
    }


def _tenant_has_table(db: Session, schema: str, table_name: str) -> bool:
    row = db.execute(
        text("""
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = :schema AND table_name = :table_name
            LIMIT 1
        """),
        {"schema": schema, "table_name": table_name},
    ).fetchone()
    return bool(row)


def _check_summary(checks: List[Dict[str, Any]]) -> Dict[str, int]:
    summary = {"critical": 0, "warning": 0, "ok": 0}
    for check in checks:
        if check.get("status") == "ok":
            summary["ok"] += 1
        elif check.get("severity") == "critical":
            summary["critical"] += 1
        else:
            summary["warning"] += 1
    return summary


def _run_tenant_health_checks(db: Session, schema: str) -> List[Dict[str, Any]]:
    checks: List[Dict[str, Any]] = []

    try:
        required_tables = {
            name: _tenant_has_table(db, schema, name)
            for name in [
                "audit_logs",
                "exchange_rates",
                "cash_registers",
                "products",
                "product_stocks",
                "product_instances",
            ]
        }
    except Exception as exc:
        db.rollback()
        return [_health_check_item(
            "schema_read",
            "Lectura del tenant",
            "fail",
            "critical",
            f"No se pudo inspeccionar el schema: {str(exc)[:180]}",
        )]

    missing_core = [name for name, exists in required_tables.items() if name in {"audit_logs", "products"} and not exists]
    checks.append(_health_check_item(
        "core_tables",
        "Tablas base",
        "fail" if missing_core else "ok",
        "critical" if missing_core else "info",
        "Faltan tablas base: " + ", ".join(missing_core) if missing_core else "Schema operativo con tablas base disponibles.",
        len(missing_core),
        [{"table": name} for name in missing_core],
    ))

    if required_tables.get("exchange_rates"):
        try:
            rate_row = db.execute(text(f'''
                SELECT
                    COUNT(*) FILTER (WHERE is_active IS TRUE AND is_default IS TRUE AND COALESCE(rate, 0) > 0) AS active_default,
                    COUNT(*) FILTER (WHERE is_active IS TRUE AND auto_update_enabled IS TRUE) AS auto_rates,
                    MAX(updated_at) FILTER (WHERE is_active IS TRUE AND is_default IS TRUE) AS last_default_update
                FROM "{schema}".exchange_rates
            ''')).mappings().first()
            active_default = int(rate_row.get("active_default") or 0)
            auto_rates = int(rate_row.get("auto_rates") or 0)
            checks.append(_health_check_item(
                "exchange_rate_default",
                "Tasa activa",
                "ok" if active_default > 0 else "fail",
                "info" if active_default > 0 else "critical",
                "Tiene tasa default activa para mostrar conversiones." if active_default > 0 else "No hay tasa default activa con valor mayor a cero.",
                active_default,
                [{"auto_update_enabled": auto_rates, "last_default_update": str(rate_row.get("last_default_update") or "")}],
            ))
        except Exception as exc:
            db.rollback()
            checks.append(_health_check_item("exchange_rate_default", "Tasa activa", "fail", "warning", f"No se pudo validar tasas: {str(exc)[:180]}"))
    else:
        checks.append(_health_check_item("exchange_rate_default", "Tasa activa", "fail", "critical", "El tenant no tiene tabla de tasas."))

    if required_tables.get("cash_registers"):
        try:
            cash_row = db.execute(text(f'''
                SELECT
                    COUNT(*) FILTER (WHERE is_active IS TRUE) AS active_registers,
                    COUNT(*) FILTER (
                        WHERE is_active IS TRUE
                          AND (hardware_client_id IS NULL OR btrim(hardware_client_id) = '')
                    ) AS missing_client_id
                FROM "{schema}".cash_registers
            ''')).mappings().first()
            active_registers = int(cash_row.get("active_registers") or 0)
            missing_client_id = int(cash_row.get("missing_client_id") or 0)
            checks.append(_health_check_item(
                "cash_register_bridge",
                "Cajas e impresion",
                "warn" if missing_client_id else "ok",
                "warning" if missing_client_id else "info",
                f"{missing_client_id} cajas activas sin ID de hardware." if missing_client_id else "Cajas activas con ID de hardware configurado.",
                missing_client_id,
                [{"active_registers": active_registers, "missing_client_id": missing_client_id}],
            ))
        except Exception as exc:
            db.rollback()
            checks.append(_health_check_item("cash_register_bridge", "Cajas e impresion", "fail", "warning", f"No se pudo validar cajas: {str(exc)[:180]}"))

    if required_tables.get("product_stocks"):
        try:
            negative_row = db.execute(text(f'''
                SELECT COUNT(*) AS negative_stocks
                FROM "{schema}".product_stocks
                WHERE COALESCE(quantity, 0) < 0
            ''')).mappings().first()
            negative_stocks = int(negative_row.get("negative_stocks") or 0)
            checks.append(_health_check_item(
                "negative_stock",
                "Stock negativo",
                "fail" if negative_stocks else "ok",
                "critical" if negative_stocks else "info",
                f"Hay {negative_stocks} registros de stock negativo." if negative_stocks else "Sin stock negativo en almacenes.",
                negative_stocks,
            ))
        except Exception as exc:
            db.rollback()
            checks.append(_health_check_item("negative_stock", "Stock negativo", "fail", "warning", f"No se pudo validar stock negativo: {str(exc)[:180]}"))

    if all(required_tables.get(name) for name in ["products", "product_stocks", "product_instances"]):
        try:
            mismatch_rows = db.execute(text(f'''
                WITH available_by_product AS (
                    SELECT product_id, COUNT(*)::numeric AS available_total
                    FROM "{schema}".product_instances
                    WHERE status = 'AVAILABLE'
                    GROUP BY product_id
                ), available_by_stock AS (
                    SELECT product_id, warehouse_id, COUNT(*)::numeric AS available_qty
                    FROM "{schema}".product_instances
                    WHERE status = 'AVAILABLE'
                    GROUP BY product_id, warehouse_id
                )
                SELECT p.id, p.name, p.stock, ps.warehouse_id, ps.quantity,
                       COALESCE(abs.available_qty, 0) AS available_warehouse,
                       COALESCE(abp.available_total, 0) AS available_total
                FROM "{schema}".products p
                LEFT JOIN "{schema}".product_stocks ps ON ps.product_id = p.id
                LEFT JOIN available_by_stock abs ON abs.product_id = p.id AND abs.warehouse_id = ps.warehouse_id
                LEFT JOIN available_by_product abp ON abp.product_id = p.id
                WHERE p.has_imei IS TRUE
                  AND p.is_active IS TRUE
                  AND (
                    COALESCE(p.stock, 0) <> COALESCE(abp.available_total, 0)
                    OR COALESCE(ps.quantity, 0) <> COALESCE(abs.available_qty, 0)
                  )
                ORDER BY ABS(COALESCE(p.stock, 0) - COALESCE(abp.available_total, 0)) DESC, p.name ASC
                LIMIT 10
            ''')).mappings().all()
            mismatch_count = len(mismatch_rows)
            checks.append(_health_check_item(
                "serialized_stock_sync",
                "Stock vs IMEI",
                "warn" if mismatch_count else "ok",
                "warning" if mismatch_count else "info",
                f"{mismatch_count} productos serializados tienen stock diferente a IMEIs disponibles." if mismatch_count else "Stock serializado cuadra con IMEIs disponibles.",
                mismatch_count,
                [dict(row) for row in mismatch_rows],
            ))
        except Exception as exc:
            db.rollback()
            checks.append(_health_check_item("serialized_stock_sync", "Stock vs IMEI", "fail", "warning", f"No se pudo validar stock serializado: {str(exc)[:180]}"))

        try:
            duplicate_rows = db.execute(text(f'''
                SELECT serial_number, COUNT(*) AS duplicates
                FROM "{schema}".product_instances
                WHERE status = 'AVAILABLE'
                  AND serial_number IS NOT NULL
                  AND btrim(serial_number) <> ''
                GROUP BY serial_number
                HAVING COUNT(*) > 1
                ORDER BY COUNT(*) DESC, serial_number ASC
                LIMIT 10
            ''')).mappings().all()
            duplicate_count = len(duplicate_rows)
            checks.append(_health_check_item(
                "available_imei_duplicates",
                "IMEIs duplicados",
                "fail" if duplicate_count else "ok",
                "critical" if duplicate_count else "info",
                f"Hay {duplicate_count} IMEIs duplicados en estado disponible." if duplicate_count else "Sin IMEIs disponibles duplicados.",
                duplicate_count,
                [dict(row) for row in duplicate_rows],
            ))
        except Exception as exc:
            db.rollback()
            checks.append(_health_check_item("available_imei_duplicates", "IMEIs duplicados", "fail", "warning", f"No se pudo validar duplicados: {str(exc)[:180]}"))

    return checks


@router.get("/system-health")
def get_system_health(
    hours: int = 24,
    tenant: Optional[str] = None,
    kind: Optional[str] = None,
    q: Optional[str] = None,
    limit: int = 200,
    alert_threshold: int = 3,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
):
    """Read frontend/API error reports and operational checks for the SaaS support panel."""
    hours = max(1, min(hours, 24 * 30))
    limit = max(20, min(limit, 500))
    alert_threshold = max(2, min(alert_threshold, 50))
    normalized_kind = kind.upper() if kind else None
    if normalized_kind and normalized_kind not in SYSTEM_HEALTH_ALLOWED_KINDS:
        raise HTTPException(400, "Tipo de evento invalido")

    since = get_venezuela_now() - timedelta(hours=hours)
    query_text = (q or "").strip().lower()
    tenant_filter = (tenant or "").strip().lower()

    tenants_query = db.query(Tenant).order_by(Tenant.name.asc())
    if tenant_filter:
        tenants_query = tenants_query.filter(Tenant.schema_name == tenant_filter)
    tenants = tenants_query.all()

    events: List[Dict[str, Any]] = []
    tenant_options: List[Dict[str, Any]] = []
    tenant_checks: List[Dict[str, Any]] = []
    check_totals = {"critical": 0, "warning": 0, "ok": 0}
    per_tenant_counts: Dict[str, int] = {}
    per_kind_counts: Dict[str, int] = {"CLIENT_ERROR": 0, "API_ERROR": 0, "NETWORK_ERROR": 0}
    per_severity_counts: Dict[str, int] = {"critical": 0, "error": 0, "warning": 0}
    groups: Dict[str, Dict[str, Any]] = {}

    for tenant_obj in tenants:
        schema = tenant_obj.schema_name
        try:
            _validate_schema_name(schema)
        except ValueError:
            continue

        tenant_options.append({
            "id": tenant_obj.id,
            "name": tenant_obj.name,
            "schema_name": schema,
            "is_active": tenant_obj.is_active,
        })

        try:
            schema_exists = db.execute(
                text("SELECT 1 FROM information_schema.schemata WHERE schema_name = :schema"),
                {"schema": schema},
            ).fetchone()
            if not schema_exists:
                missing_checks = [_health_check_item(
                    "schema_exists",
                    "Schema del tenant",
                    "fail",
                    "critical",
                    "El schema del tenant no existe en la base de datos.",
                )]
                summary = _check_summary(missing_checks)
                tenant_checks.append({
                    "tenant_id": tenant_obj.id,
                    "tenant_name": tenant_obj.name,
                    "tenant_schema": schema,
                    "checks": missing_checks,
                    "summary": summary,
                })
                check_totals["critical"] += summary["critical"]
                continue

            checks = _run_tenant_health_checks(db, schema)
            checks_summary = _check_summary(checks)
            tenant_checks.append({
                "tenant_id": tenant_obj.id,
                "tenant_name": tenant_obj.name,
                "tenant_schema": schema,
                "checks": checks,
                "summary": checks_summary,
            })
            for key in check_totals:
                check_totals[key] += checks_summary.get(key, 0)

            rows = db.execute(text(f'''
                SELECT id, user_id, action, changes, ip_address, timestamp
                FROM "{schema}".audit_logs
                WHERE table_name = 'system_events'
                  AND timestamp >= :since
                ORDER BY timestamp DESC
                LIMIT :tenant_limit
            '''), {"since": since, "tenant_limit": limit}).mappings().all()
        except Exception as exc:
            db.rollback()
            print(f"[SYSTEM_HEALTH] Error reading schema '{schema}': {exc}")
            continue

        for row in rows:
            payload = _parse_system_event_changes(row.get("changes"))
            event_kind = str(payload.get("kind") or row.get("action") or "CLIENT_ERROR").upper()[:40]
            if event_kind not in SYSTEM_HEALTH_ALLOWED_KINDS:
                continue
            if normalized_kind and event_kind != normalized_kind:
                continue

            message = str(payload.get("message") or "Error sin mensaje")
            route = str(payload.get("route") or "")
            source = str(payload.get("source") or "frontend")
            url = str(payload.get("url") or "")
            method = payload.get("method")
            status_code = payload.get("status")
            try:
                status_code = int(status_code) if status_code is not None else None
            except (TypeError, ValueError):
                status_code = None

            search_blob = " ".join([
                tenant_obj.name or "",
                schema,
                event_kind,
                message,
                route,
                source,
                url,
            ]).lower()
            if query_text and query_text not in search_blob:
                continue

            severity = _system_health_severity(event_kind, status_code)
            signature = _event_signature(source, message, route, url, status_code)
            timestamp = row.get("timestamp")
            event = {
                "id": f"{schema}:{row.get('id')}",
                "audit_id": row.get("id"),
                "tenant_id": tenant_obj.id,
                "tenant_name": tenant_obj.name,
                "tenant_schema": schema,
                "kind": event_kind,
                "severity": severity,
                "message": message[:1000],
                "source": source[:120],
                "route": route[:500],
                "url": url[:500],
                "method": method,
                "status": status_code,
                "ip_address": row.get("ip_address"),
                "user_id": row.get("user_id"),
                "user_agent": payload.get("user_agent"),
                "context": payload.get("context") if isinstance(payload.get("context"), dict) else {},
                "timestamp": timestamp.isoformat() if timestamp else None,
                "signature": signature,
            }
            events.append(event)

            per_tenant_counts[schema] = per_tenant_counts.get(schema, 0) + 1
            per_kind_counts[event_kind] = per_kind_counts.get(event_kind, 0) + 1
            per_severity_counts[severity] = per_severity_counts.get(severity, 0) + 1

            group = groups.setdefault(signature, {
                "signature": signature,
                "message": event["message"],
                "source": event["source"],
                "route": event["route"] or event["url"],
                "kind": event_kind,
                "severity": severity,
                "status": status_code,
                "count": 0,
                "tenants": {},
                "first_seen": event["timestamp"],
                "last_seen": event["timestamp"],
            })
            group["count"] += 1
            group["tenants"][schema] = tenant_obj.name
            if event["timestamp"]:
                if not group["first_seen"] or event["timestamp"] < group["first_seen"]:
                    group["first_seen"] = event["timestamp"]
                if not group["last_seen"] or event["timestamp"] > group["last_seen"]:
                    group["last_seen"] = event["timestamp"]

    events.sort(key=lambda item: item.get("timestamp") or "", reverse=True)
    events = events[:limit]

    grouped = []
    for group in groups.values():
        grouped.append({
            **group,
            "tenant_count": len(group["tenants"]),
            "tenants": [{"schema_name": schema, "name": name} for schema, name in group["tenants"].items()],
        })
    grouped.sort(key=lambda item: (item["count"], item.get("last_seen") or ""), reverse=True)
    alert_candidates = [
        {
            **group,
            "threshold": alert_threshold,
            "alert_level": "critical" if group.get("severity") == "critical" else "warning",
        }
        for group in grouped
        if group.get("count", 0) >= alert_threshold and group.get("severity") in {"critical", "error"}
    ][:20]

    top_tenants = sorted([
        {
            "schema_name": schema,
            "name": next((t.name for t in tenants if t.schema_name == schema), schema),
            "count": count,
        }
        for schema, count in per_tenant_counts.items()
    ], key=lambda item: item["count"], reverse=True)[:10]

    return {
        "summary": {
            "total_events": sum(per_kind_counts.values()),
            "critical": per_severity_counts.get("critical", 0),
            "error": per_severity_counts.get("error", 0),
            "warning": per_severity_counts.get("warning", 0),
            "unique_groups": len(grouped),
            "affected_tenants": len(per_tenant_counts),
            "check_critical": check_totals.get("critical", 0),
            "check_warning": check_totals.get("warning", 0),
            "check_ok": check_totals.get("ok", 0),
            "hours": hours,
            "since": since.isoformat(),
            "by_kind": per_kind_counts,
            "by_severity": per_severity_counts,
        },
        "events": events,
        "groups": grouped[:50],
        "alert_candidates": alert_candidates,
        "top_tenants": top_tenants,
        "tenant_options": tenant_options,
        "tenant_checks": tenant_checks,
    }
