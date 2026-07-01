from datetime import datetime
import json
import re
from typing import Optional
from urllib.parse import urlparse, urlunparse

import httpx
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..database.db import get_db
from ..models import models

router = APIRouter(prefix="/cloud", tags=["cloud"])

TENANT_RE = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$")
COMMON_PATHS = ("/login", "/api/v1", "/api", "/#", "/")


class ConnectionTestRequest(BaseModel):
    url: str = ""
    tenant_subdomain: Optional[str] = None


class CloudURLTestResponse(BaseModel):
    success: bool
    error: Optional[str] = None
    cleaned_url: Optional[str] = None
    api_url: Optional[str] = None
    tenant_subdomain: Optional[str] = None
    tenant_name: Optional[str] = None
    health_ok: bool = False
    tenant_ok: bool = False


class SetupCloudRequest(BaseModel):
    cloud_url: str
    tenant_subdomain: Optional[str] = None
    install_mode: str = Field("store_server", description="store_server | client_terminal | standalone")
    local_server_name: Optional[str] = None
    sync_enabled: bool = True
    sync_interval_minutes: int = 10
    safe_stock_mode: bool = True
    technician_notes: Optional[str] = None


class SetupCloudResponse(BaseModel):
    success: bool
    message: str
    cleaned_url: Optional[str] = None
    tenant_subdomain: Optional[str] = None
    saved: bool = False


def _clean_tenant(value: Optional[str]) -> Optional[str]:
    tenant = (value or "").strip().lower()
    if not tenant:
        return None
    tenant = tenant.replace("_", "-")
    if not TENANT_RE.match(tenant):
        raise ValueError("El subdominio solo puede usar letras, numeros y guiones.")
    return tenant


def _normalize_cloud_url(raw_url: str, tenant_subdomain: Optional[str] = None) -> str:
    raw = (raw_url or "").strip()
    tenant = _clean_tenant(tenant_subdomain)

    if not raw and tenant:
        raw = f"{tenant}.miinventariofacil.com"
    if not raw:
        raise ValueError("Indica la URL nube o el subdominio del tenant.")

    raw = raw.split("#", 1)[0].strip().rstrip("/")
    if not raw.startswith(("http://", "https://")):
        raw = "https://" + raw

    parsed = urlparse(raw)
    path = parsed.path or ""
    for suffix in COMMON_PATHS:
        if suffix != "/" and path.endswith(suffix):
            path = path[: -len(suffix)]
    if path == "/":
        path = ""

    host = parsed.netloc
    if tenant and host and "." in host and not host.startswith(f"{tenant}."):
        # Si el tecnico coloca qa.miinventariofacil.com + tenant, armamos el subdominio completo.
        known_roots = ("miinventariofacil.com", "qa.miinventariofacil.com")
        if any(host == root for root in known_roots):
            host = f"{tenant}.{host}"

    return urlunparse((parsed.scheme, host, path, "", "", "")).rstrip("/")


def _config_payload(configs: dict) -> dict:
    return {k: "" if v is None else ("true" if v is True else "false" if v is False else str(v)) for k, v in configs.items()}


def _save_business_configs(db: Session, configs: dict) -> bool:
    payload = _config_payload(configs)
    for key, value in payload.items():
        row = db.query(models.BusinessConfig).get(key)
        if not row:
            db.add(models.BusinessConfig(key=key, value=value))
        else:
            row.value = value
    db.commit()
    return True


@router.post("/test-connection", response_model=CloudURLTestResponse)
async def test_connection_proxy(request: ConnectionTestRequest):
    """
    Prueba la conexion con la nube desde el backend local.
    Valida salud del API y, si se envia subdominio, intenta leer la config publica del tenant.
    """
    try:
        tenant = _clean_tenant(request.tenant_subdomain)
        clean_url = _normalize_cloud_url(request.url, tenant)
    except ValueError as exc:
        return CloudURLTestResponse(success=False, error=str(exc))

    api_url = f"{clean_url}/api/v1"
    health_url = f"{api_url}/health"
    public_config_url = f"{api_url}/config/public"

    headers = {}
    if tenant:
        headers["X-Tenant-ID"] = tenant

    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            health_response = await client.get(health_url)
            health_ok = health_response.status_code == 200
            if not health_ok:
                return CloudURLTestResponse(
                    success=False,
                    error=f"El servidor respondio {health_response.status_code} en /health.",
                    cleaned_url=clean_url,
                    api_url=api_url,
                    tenant_subdomain=tenant,
                    health_ok=False,
                )

            tenant_name = None
            tenant_ok = False
            try:
                tenant_response = await client.get(public_config_url, headers=headers)
                tenant_ok = tenant_response.status_code == 200
                if tenant_ok:
                    tenant_name = (tenant_response.json() or {}).get("tenant_name")
            except Exception:
                tenant_ok = False

            if tenant and not tenant_ok:
                return CloudURLTestResponse(
                    success=False,
                    error="La nube responde, pero no pude validar ese tenant/subdominio.",
                    cleaned_url=clean_url,
                    api_url=api_url,
                    tenant_subdomain=tenant,
                    health_ok=True,
                    tenant_ok=False,
                )

            return CloudURLTestResponse(
                success=True,
                cleaned_url=clean_url,
                api_url=api_url,
                tenant_subdomain=tenant,
                tenant_name=tenant_name,
                health_ok=True,
                tenant_ok=tenant_ok,
            )
    except httpx.ConnectError:
        return CloudURLTestResponse(success=False, error="No se pudo conectar al servidor.", cleaned_url=clean_url, api_url=api_url, tenant_subdomain=tenant)
    except httpx.ConnectTimeout:
        return CloudURLTestResponse(success=False, error="Tiempo de espera agotado al probar la nube.", cleaned_url=clean_url, api_url=api_url, tenant_subdomain=tenant)
    except Exception as exc:
        return CloudURLTestResponse(success=False, error=f"Error al conectar: {exc}", cleaned_url=clean_url, api_url=api_url, tenant_subdomain=tenant)


@router.post("/setup", response_model=SetupCloudResponse)
def setup_cloud_connection(request: SetupCloudRequest, db: Session = Depends(get_db)):
    """
    Guarda la configuracion inicial del equipo offline/local.
    Es publico a proposito: se usa antes de que el tecnico tenga una sesion completa.
    """
    try:
        tenant = _clean_tenant(request.tenant_subdomain)
        clean_url = _normalize_cloud_url(request.cloud_url, tenant)
    except ValueError as exc:
        return SetupCloudResponse(success=False, message=str(exc), saved=False)

    install_mode = (request.install_mode or "store_server").strip().lower()
    if install_mode not in {"store_server", "client_terminal", "standalone"}:
        install_mode = "store_server"

    setup_snapshot = {
        "cloud_url": clean_url,
        "tenant_subdomain": tenant,
        "install_mode": install_mode,
        "local_server_name": request.local_server_name,
        "sync_enabled": request.sync_enabled,
        "sync_interval_minutes": request.sync_interval_minutes,
        "safe_stock_mode": request.safe_stock_mode,
        "technician_notes": request.technician_notes,
        "configured_at": datetime.utcnow().isoformat() + "Z",
    }

    try:
        _save_business_configs(db, {
            "cloud_url": clean_url,
            "cloud_tenant_subdomain": tenant or "",
            "offline_install_mode": install_mode,
            "offline_local_server_name": request.local_server_name or "Servidor local",
            "offline_sync_enabled": request.sync_enabled,
            "offline_sync_interval_minutes": max(1, int(request.sync_interval_minutes or 10)),
            "offline_safe_stock_mode": request.safe_stock_mode,
            "offline_setup_completed_at": setup_snapshot["configured_at"],
            "offline_setup_payload": json.dumps(setup_snapshot, ensure_ascii=True),
        })
        return SetupCloudResponse(
            success=True,
            message="Configuracion guardada correctamente.",
            cleaned_url=clean_url,
            tenant_subdomain=tenant,
            saved=True,
        )
    except Exception as exc:
        db.rollback()
        return SetupCloudResponse(
            success=False,
            message=f"No se pudo guardar en la base local: {exc}",
            cleaned_url=clean_url,
            tenant_subdomain=tenant,
            saved=False,
        )


@router.get("/setup-status")
def get_setup_status(db: Session = Depends(get_db)):
    keys = [
        "cloud_url",
        "cloud_tenant_subdomain",
        "offline_install_mode",
        "offline_sync_enabled",
        "offline_sync_interval_minutes",
        "offline_safe_stock_mode",
        "offline_setup_completed_at",
    ]
    try:
        rows = db.query(models.BusinessConfig).filter(models.BusinessConfig.key.in_(keys)).all()
        data = {row.key: row.value for row in rows}
        return {"configured": bool(data.get("cloud_url")), "data": data}
    except Exception as exc:
        return {"configured": False, "data": {}, "error": str(exc)}
