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


@router.get("/system-health")
def get_system_health(
    hours: int = 24,
    tenant: Optional[str] = None,
    kind: Optional[str] = None,
    q: Optional[str] = None,
    limit: int = 200,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
):
    """Read frontend/API error reports from tenant audit logs for the SaaS support panel."""
    hours = max(1, min(hours, 24 * 30))
    limit = max(20, min(limit, 500))
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
                continue

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
            "hours": hours,
            "since": since.isoformat(),
            "by_kind": per_kind_counts,
            "by_severity": per_severity_counts,
        },
        "events": events,
        "groups": grouped[:50],
        "top_tenants": top_tenants,
        "tenant_options": tenant_options,
    }
