"""
WhatsApp Router — Mi Inventario Fácil
Gestiona instancias de Evolution API por tenant.
Cada tenant conecta su propio número de WhatsApp.
"""
import httpx
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional

from ..database.db import get_db
from ..models import models
from ..dependencies import get_current_active_user, cashier_or_admin, has_role
from ..models.models import UserRole

admin_required = has_role([UserRole.ADMIN])

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/whatsapp", tags=["whatsapp"])

# ── Configuración de Evolution API ────────────────────────────
EVO_URL = "https://evo.miinventariofacil.com"
EVO_KEY = "3dae0a60c42c32a42cecbc23e2620802a3797b97e6476aa5d5f1530881ef66af"
EVO_HEADERS = {"apikey": EVO_KEY, "Content-Type": "application/json"}
EVO_TIMEOUT = 10

# ── Claves de business_config ──────────────────────────────────
KEY_ENABLED          = "whatsapp_enabled"
KEY_INSTANCE         = "whatsapp_instance_name"
KEY_STATUS           = "whatsapp_instance_status"
KEY_NOTIFY_SALE      = "whatsapp_notify_sale"
KEY_NOTIFY_ORDER     = "whatsapp_notify_order_ready"
KEY_NOTIFY_CREDIT    = "whatsapp_notify_credit_reminder"
KEY_NOTIFY_QUOTE     = "whatsapp_notify_quote"

DEFAULT_KEYS = {
    KEY_ENABLED:       "false",
    KEY_INSTANCE:      "",
    KEY_STATUS:        "DISCONNECTED",
    KEY_NOTIFY_SALE:   "true",
    KEY_NOTIFY_ORDER:  "true",
    KEY_NOTIFY_CREDIT: "true",
    KEY_NOTIFY_QUOTE:  "false",
}


# ── Helpers ───────────────────────────────────────────────────
def _get_cfg(db: Session, key: str) -> Optional[str]:
    row = db.query(models.BusinessConfig).filter(
        models.BusinessConfig.key == key
    ).first()
    return row.value if row else DEFAULT_KEYS.get(key)


def _set_cfg(db: Session, key: str, value: str) -> None:
    row = db.query(models.BusinessConfig).filter(
        models.BusinessConfig.key == key
    ).first()
    if row:
        row.value = value
    else:
        db.add(models.BusinessConfig(key=key, value=value))
    db.commit()


async def _evo_get(path: str) -> dict:
    async with httpx.AsyncClient(timeout=EVO_TIMEOUT) as c:
        r = await c.get(f"{EVO_URL}{path}", headers=EVO_HEADERS)
        r.raise_for_status()
        return r.json()


async def _evo_post(path: str, body: dict = {}) -> dict:
    async with httpx.AsyncClient(timeout=EVO_TIMEOUT) as c:
        r = await c.post(f"{EVO_URL}{path}", json=body, headers=EVO_HEADERS)
        r.raise_for_status()
        return r.json()


async def _evo_delete(path: str) -> dict:
    async with httpx.AsyncClient(timeout=EVO_TIMEOUT) as c:
        r = await c.delete(f"{EVO_URL}{path}", headers=EVO_HEADERS)
        r.raise_for_status()
        return r.json()


# ── Endpoints ─────────────────────────────────────────────────

@router.get("/config")
def get_whatsapp_config(
    current_user = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Devuelve la configuración de WhatsApp del tenant actual."""
    return {
        "enabled":          _get_cfg(db, KEY_ENABLED) == "true",
        "instance_name":    _get_cfg(db, KEY_INSTANCE),
        "status":           _get_cfg(db, KEY_STATUS),
        "notify_sale":      _get_cfg(db, KEY_NOTIFY_SALE) == "true",
        "notify_order":     _get_cfg(db, KEY_NOTIFY_ORDER) == "true",
        "notify_credit":    _get_cfg(db, KEY_NOTIFY_CREDIT) == "true",
        "notify_quote":     _get_cfg(db, KEY_NOTIFY_QUOTE) == "true",
    }


@router.post("/config")
def update_whatsapp_config(
    config: dict,
    current_user = Depends(admin_required),
    db: Session = Depends(get_db)
):
    """Actualiza los toggles de notificación del tenant."""
    mapping = {
        "notify_sale":   KEY_NOTIFY_SALE,
        "notify_order":  KEY_NOTIFY_ORDER,
        "notify_credit": KEY_NOTIFY_CREDIT,
        "notify_quote":  KEY_NOTIFY_QUOTE,
    }
    for field, key in mapping.items():
        if field in config:
            _set_cfg(db, key, "true" if config[field] else "false")
    return {"ok": True}


@router.post("/instance/create")
async def create_instance(
    current_user = Depends(admin_required),
    db: Session = Depends(get_db)
):
    """
    Crea la instancia de Evolution API para este tenant.
    El nombre de la instancia es el tenant_id.
    """
    tenant_id = str(current_user.tenant_id)
    instance_name = tenant_id.replace(".", "-").replace(" ", "-").lower()

    try:
        body = {
            "instanceName": instance_name,
            "integration":  "WHATSAPP-BAILEYS",
            "qrcode":        True,
            "reject_call":   False,
            "msg_call":      "",
            "groups_ignore": True,
            "always_online": False,
            "read_messages": False,
            "read_status":   False,
        }
        result = await _evo_post("/instance/create", body)

        _set_cfg(db, KEY_INSTANCE, instance_name)
        _set_cfg(db, KEY_STATUS, "PENDING_QR")
        _set_cfg(db, KEY_ENABLED, "true")

        qr = result.get("qrcode", {})
        return {
            "instance_name": instance_name,
            "status":        "PENDING_QR",
            "qr_base64":     qr.get("base64", ""),
            "qr_code":       qr.get("code", ""),
        }
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 409:
            # La instancia ya existe — devolver el QR actual
            return await get_qr(db=db, current_user=current_user)
        raise HTTPException(status_code=500, detail=f"Error creando instancia: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/instance/qr")
async def get_qr(
    current_user = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Obtiene el QR actual de la instancia para escanear."""
    instance_name = _get_cfg(db, KEY_INSTANCE)
    if not instance_name:
        raise HTTPException(status_code=404, detail="Instancia no creada aún")
    try:
        result = await _evo_get(f"/instance/connect/{instance_name}")
        return {
            "status":    "PENDING_QR",
            "qr_base64": result.get("base64", ""),
            "qr_code":   result.get("code", ""),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/instance/status")
async def get_instance_status(
    current_user = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Consulta el estado de la conexión de WhatsApp."""
    instance_name = _get_cfg(db, KEY_INSTANCE)
    if not instance_name:
        return {"status": "NOT_CREATED", "connected": False}
    try:
        result = await _evo_get(f"/instance/connectionState/{instance_name}")
        state = result.get("instance", {}).get("state", "close")
        connected = state == "open"
        new_status = "CONNECTED" if connected else "DISCONNECTED"

        # Actualizar en BD si cambió
        if _get_cfg(db, KEY_STATUS) != new_status:
            _set_cfg(db, KEY_STATUS, new_status)

        return {
            "status":        new_status,
            "connected":     connected,
            "instance_name": instance_name,
            "raw_state":     state,
        }
    except Exception as e:
        return {"status": "ERROR", "connected": False, "detail": str(e)}


@router.post("/instance/disconnect")
async def disconnect_instance(
    current_user = Depends(admin_required),
    db: Session = Depends(get_db)
):
    """Desconecta y elimina la instancia de Evolution API."""
    instance_name = _get_cfg(db, KEY_INSTANCE)
    if not instance_name:
        raise HTTPException(status_code=404, detail="No hay instancia configurada")
    try:
        await _evo_delete(f"/instance/delete/{instance_name}")
        _set_cfg(db, KEY_STATUS,   "DISCONNECTED")
        _set_cfg(db, KEY_ENABLED,  "false")
        _set_cfg(db, KEY_INSTANCE, "")
        return {"ok": True, "message": "Instancia desconectada"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/test")
async def send_test_message(
    body: dict,
    current_user = Depends(admin_required),
    db: Session = Depends(get_db)
):
    """Envía un mensaje de prueba al número indicado."""
    instance_name = _get_cfg(db, KEY_INSTANCE)
    if not instance_name:
        raise HTTPException(status_code=404, detail="No hay instancia configurada")

    phone = body.get("phone", "").replace("+", "").replace(" ", "").replace("-", "")
    if not phone:
        raise HTTPException(status_code=400, detail="Número de teléfono requerido")

    try:
        result = await _evo_post(f"/message/sendText/{instance_name}", {
            "number": phone,
            "text":   body.get("message", "✅ Mensaje de prueba desde Mi Inventario Fácil"),
        })
        return {"ok": True, "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Función utilitaria para enviar mensajes desde otros routers ──
async def send_whatsapp_message(
    db: Session,
    tenant_id: str,
    phone: str,
    message: str
) -> bool:
    """
    Envía un mensaje de WhatsApp si el tenant tiene la instancia conectada.
    Retorna True si se envió, False si no.
    Usar desde sales.py, services.py, etc.
    """
    try:
        instance_name = _get_cfg(db, KEY_INSTANCE)
        enabled       = _get_cfg(db, KEY_ENABLED) == "true"
        status        = _get_cfg(db, KEY_STATUS)

        if not enabled or not instance_name or status != "CONNECTED":
            return False

        clean_phone = phone.replace("+", "").replace(" ", "").replace("-", "")
        if not clean_phone or len(clean_phone) < 7:
            return False

        await _evo_post(f"/message/sendText/{instance_name}", {
            "number": clean_phone,
            "text":   message,
        })
        return True
    except Exception as e:
        logger.warning(f"[WA] Error enviando mensaje a {phone}: {e}")
        return False
