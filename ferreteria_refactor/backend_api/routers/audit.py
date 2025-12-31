from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List, Optional
from ..database.db import get_db
from ..models import models
from .. import schemas
import datetime

router = APIRouter(
    prefix="/audit",
    tags=["audit"]
)

@router.get("/logs", response_model=List[schemas.AuditLogRead])
def get_audit_logs(
    skip: int = 0,
    limit: int = 50,
    user_id: Optional[int] = None,
    table_name: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db)
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
