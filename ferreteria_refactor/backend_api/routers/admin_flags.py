"""
Self-service feature flags endpoint.

Permite al ADMIN del tenant ver y actualizar sus propios feature flags
sin necesidad del panel SaaS. Útil en modo offline/desktop.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Dict
from ..database.db import get_db
from ..dependencies import admin_only
from ..models import models
from ..models.tenant import Tenant
from ..tenant_context import get_tenant_schema
from ..feature_flags_registry import REGISTRY, CATEGORIES

router = APIRouter(
    prefix="/admin/flags",
    tags=["Feature Flags"],
)


class FlagsUpdatePayload(BaseModel):
    flags: Dict[str, bool]


def _get_or_create_tenant(db: Session, schema: str) -> Tenant:
    """
    Busca el tenant por schema_name. Si no existe (ej. instalación offline donde
    setup_offline.py falló), crea una fila mínima para que los flags funcionen.
    """
    tenant = db.query(Tenant).filter(Tenant.schema_name == schema).first()
    if tenant:
        return tenant

    # En modo offline el tenant puede no existir si setup_offline.py falló.
    # Crear fila mínima para que el sistema sea funcional.
    from ..config import settings
    tenant = Tenant(
        name=getattr(settings, "SINGLE_TENANT_SCHEMA", schema),
        schema_name=schema,
        is_active=True,
        license_type="lifetime",
        feature_flags={},
    )
    db.add(tenant)
    db.commit()
    db.refresh(tenant)
    return tenant


@router.get("")
def get_my_feature_flags(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(admin_only),
):
    """
    Devuelve los feature flags activos del tenant actual + el registro completo.
    Usado por la UI de autogestión en modo offline/desktop.
    """
    schema = get_tenant_schema()
    if schema == "public":
        raise HTTPException(status_code=400, detail="Sin contexto de tenant")

    tenant = _get_or_create_tenant(db, schema)

    return {
        "flags": tenant.feature_flags or {},
        "registry": REGISTRY,
        "categories": CATEGORIES,
    }


@router.patch("")
def update_my_feature_flags(
    payload: FlagsUpdatePayload,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(admin_only),
):
    """
    Actualiza feature flags del tenant actual (merge, no reemplaza todo).
    Solo acepta flags que existen en el registro.
    """
    schema = get_tenant_schema()
    if schema == "public":
        raise HTTPException(status_code=400, detail="Sin contexto de tenant")

    unknown = [k for k in payload.flags if k not in REGISTRY]
    if unknown:
        raise HTTPException(status_code=400, detail=f"Feature flags desconocidas: {unknown}")

    tenant = _get_or_create_tenant(db, schema)

    current = dict(tenant.feature_flags or {})
    current.update(payload.flags)
    tenant.feature_flags = current
    db.commit()
    db.refresh(tenant)

    return {"feature_flags": tenant.feature_flags}
