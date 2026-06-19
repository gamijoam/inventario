from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from ..database.db import get_db
from ..models import models
from .. import schemas
from ..dependencies import admin_only, get_current_active_user
import datetime
import json
from pydantic import BaseModel, Field
from ..audit_utils import log_action

router = APIRouter(
    prefix="/audit",
    tags=["audit"]
)


class ClientErrorReport(BaseModel):
    kind: str = Field(default="CLIENT_ERROR", max_length=40)
    message: str = Field(default="", max_length=1000)
    stack: Optional[str] = Field(default=None, max_length=6000)
    component_stack: Optional[str] = Field(default=None, max_length=6000)
    route: Optional[str] = Field(default=None, max_length=500)
    source: Optional[str] = Field(default=None, max_length=120)
    status: Optional[int] = None
    method: Optional[str] = Field(default=None, max_length=20)
    url: Optional[str] = Field(default=None, max_length=500)
    context: Optional[Dict[str, Any]] = None


def _client_ip(request: Request) -> Optional[str]:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None

@router.get("/logs", response_model=List[schemas.AuditLogRead])
def get_audit_logs(
    skip: int = 0,
    limit: int = 50,
    user_id: Optional[int] = None,
    table_name: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(admin_only)
):
    from sqlalchemy.orm import joinedload
    query = db.query(models.AuditLog).options(joinedload(models.AuditLog.user))

    if user_id:
        query = query.filter(models.AuditLog.user_id == user_id)
    
    if table_name:
        query = query.filter(models.AuditLog.table_name == table_name)
        
    if start_date:
        try:
            start_dt = datetime.datetime.strptime(start_date, "%Y-%m-%d")
            query = query.filter(models.AuditLog.timestamp >= start_dt)
        except ValueError:
            pass
            
    if end_date:
        try:
            end_dt = datetime.datetime.strptime(end_date, "%Y-%m-%d")
            end_dt = end_dt.replace(hour=23, minute=59, second=59)
            query = query.filter(models.AuditLog.timestamp <= end_dt)
        except ValueError:
            pass

    # Newest first
    logs = query.order_by(models.AuditLog.timestamp.desc()).offset(skip).limit(limit).all()
    return logs

@router.post("/client-errors")
def report_client_error(
    payload: ClientErrorReport,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    """Store frontend/API failures as audit events for later diagnostics."""
    safe_context = payload.context or {}
    if isinstance(safe_context, dict):
        sensitive_keys = {"password", "token", "access_token", "authorization"}
        safe_context = {
            str(key)[:80]: value
            for key, value in safe_context.items()
            if str(key).lower() not in sensitive_keys
        }

    changes = json.dumps({
        "kind": payload.kind,
        "message": payload.message,
        "stack": payload.stack,
        "component_stack": payload.component_stack,
        "route": payload.route,
        "source": payload.source,
        "status": payload.status,
        "method": payload.method,
        "url": payload.url,
        "context": safe_context,
        "user_agent": request.headers.get("user-agent"),
    }, default=str, ensure_ascii=False)

    log_action(
        db=db,
        user_id=current_user.id,
        action=(payload.kind or "CLIENT_ERROR").upper()[:40],
        table_name="system_events",
        record_id=None,
        changes=changes,
        ip_address=_client_ip(request),
    )
    db.commit()
    return {"ok": True}
