"""
WhatsApp Router — Mi Inventario Fácil
Gestión de instancias Evolution API por tenant.
El QR llega vía webhook interno — el cliente solo ve la pantalla.
"""
import httpx
import logging
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from ..database.db import get_db
from ..models import models
from ..dependencies import get_current_active_user, has_role
from ..models.models import UserRole

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/whatsapp", tags=["whatsapp"])

admin_required = has_role([UserRole.ADMIN])

# ── Evolution API (red interna Docker) ────────────────────────
EVO_URL     = "http://evolution_api:8080"
EVO_KEY     = "3dae0a60c42c32a42cecbc23e2620802a3797b97e6476aa5d5f1530881ef66af"
EVO_HEADERS = {"apikey": EVO_KEY, "Content-Type": "application/json"}
EVO_TIMEOUT = 30

# URL pública del backend para que Evolution API envíe los webhooks
BACKEND_PUBLIC_URL = "https://api-qa.miinventariofacil.com"  # QA — cambiar a api.miinventariofacil.com en prod

# ── Claves en business_config ─────────────────────────────────
KEY_ENABLED       = "whatsapp_enabled"
KEY_INSTANCE      = "whatsapp_instance_name"
KEY_STATUS        = "whatsapp_instance_status"
KEY_QR_BASE64     = "whatsapp_qr_base64"
KEY_NOTIFY_SALE   = "whatsapp_notify_sale"
KEY_NOTIFY_ORDER  = "whatsapp_notify_order_ready"
KEY_NOTIFY_CREDIT = "whatsapp_notify_credit_reminder"
KEY_NOTIFY_QUOTE  = "whatsapp_notify_quote"

DEFAULTS = {
    KEY_ENABLED:       "false",
    KEY_INSTANCE:      "",
    KEY_STATUS:        "DISCONNECTED",
    KEY_QR_BASE64:     "",
    KEY_NOTIFY_SALE:   "true",
    KEY_NOTIFY_ORDER:  "true",
    KEY_NOTIFY_CREDIT: "true",
    KEY_NOTIFY_QUOTE:  "false",
}


# ── Helpers BD ────────────────────────────────────────────────
def _get_schema(db: Session) -> str:
    """Obtiene el schema activo de la conexión de BD."""
    from ..tenant_context import get_tenant_schema
    return get_tenant_schema()


def _get(db: Session, key: str) -> str:
    """Lee una clave de business_config usando SQL con schema explícito."""
    from sqlalchemy import text
    schema = _get_schema(db)
    try:
        result = db.execute(
            text(f'SELECT value FROM "{schema}".business_config WHERE key = :key'),
            {"key": key}
        ).fetchone()
        return result[0] if result else DEFAULTS.get(key, "")
    except Exception as e:
        logger.warning(f"[WA._get] key={key} schema={schema} error={e}")
        return DEFAULTS.get(key, "")


def _set(db: Session, key: str, value: str):
    """Escribe una clave en business_config usando SQL con schema explícito."""
    from sqlalchemy import text
    schema = _get_schema(db)
    try:
        # Intentar UPDATE primero
        result = db.execute(
            text(f'UPDATE "{schema}".business_config SET value = :value WHERE key = :key'),
            {"key": key, "value": value}
        )
        if result.rowcount == 0:
            # No existía — INSERT
            db.execute(
                text(f'INSERT INTO "{schema}".business_config (key, value) VALUES (:key, :value)'),
                {"key": key, "value": value}
            )
        db.commit()
        logger.debug(f"[WA._set] {schema}.business_config key={key} value={value[:20] if value else value}")
    except Exception as e:
        db.rollback()
        logger.error(f"[WA._set] FAILED key={key} schema={schema}: {e}")
        raise


# ── Helpers Evolution API ─────────────────────────────────────
async def _evo_post(path: str, body: dict = {}) -> dict:
    async with httpx.AsyncClient(timeout=EVO_TIMEOUT) as c:
        r = await c.post(f"{EVO_URL}{path}", json=body, headers=EVO_HEADERS)
        r.raise_for_status()
        return r.json()


async def _evo_get(path: str) -> dict:
    async with httpx.AsyncClient(timeout=EVO_TIMEOUT) as c:
        r = await c.get(f"{EVO_URL}{path}", headers=EVO_HEADERS)
        r.raise_for_status()
        return r.json()


async def _evo_delete(path: str) -> dict:
    async with httpx.AsyncClient(timeout=EVO_TIMEOUT) as c:
        r = await c.delete(f"{EVO_URL}{path}", headers=EVO_HEADERS)
        r.raise_for_status()
        return r.json()


def _configure_webhook(instance_name: str, tenant_id: str):
    """
    Configura el webhook de Evolution API apuntando al backend.
    Se llama de forma síncrona después de crear la instancia.
    """
    import httpx as _httpx
    webhook_url = f"{BACKEND_PUBLIC_URL}/api/v1/whatsapp/webhook/{tenant_id}"
    try:
        _httpx.post(
            f"{EVO_URL}/webhook/set/{instance_name}",
            headers=EVO_HEADERS,
            json={
                "webhook": {
                    "enabled":        True,
                    "url":            webhook_url,
                    "webhookByEvents": False,
                    "webhookBase64":  True,
                    "events": [
                        "QRCODE_UPDATED",
                        "CONNECTION_UPDATE",
                        "MESSAGES_UPSERT"
                    ]
                }
            },
            timeout=10
        )
        logger.info(f"[WA] Webhook configurado para {instance_name} → {webhook_url}")
    except Exception as e:
        logger.warning(f"[WA] Error configurando webhook: {e}")


# ══════════════════════════════════════════════════════════════
# WEBHOOK RECEPTOR — Evolution API envía eventos aquí
# ══════════════════════════════════════════════════════════════
@router.post("/webhook/{tenant_id}", include_in_schema=False)
async def receive_evo_webhook(tenant_id: str, request: Request):
    """
    Evolution API envía eventos a este endpoint.
    No requiere autenticación (llamada servidor→servidor).
    Procesa: QRCODE_UPDATED → guarda QR en BD
             CONNECTION_UPDATE open → marca CONNECTED
             CONNECTION_UPDATE close → marca DISCONNECTED
    """
    from ..tenant_context import set_tenant_schema

    try:
        payload = await request.json()
    except Exception:
        return {"ok": False}

    event    = payload.get("event", "")
    data     = payload.get("data", {})
    instance = payload.get("instance", "")

    logger.info(f"[WA-WEBHOOK] tenant={tenant_id} event={event} instance={instance}")

    try:
        # Obtener sesión de BD para el tenant
        set_tenant_schema(tenant_id)
        db = next(get_db())

    # Normalizar nombre del evento (Evolution v2 usa minúsculas con punto)
        event_norm = event.upper().replace(".", "_")
        logger.info(f"[WA-WEBHOOK] event_norm={event_norm} | data_keys={list(data.keys())}")

        if event_norm == "QRCODE_UPDATED":
            logger.info(f"[WA-WEBHOOK] QRCODE payload keys: {list(data.keys())}")
            logger.info(f"[WA-WEBHOOK] qrcode field: {str(data.get('qrcode','?'))[:100]}")

            # Extraer base64 — Evolution API v2 anida el QR en data.qrcode.base64
            qr_base64 = ""
            qr_obj = data.get("qrcode", {})
            if isinstance(qr_obj, dict):
                qr_base64 = qr_obj.get("base64", "")
            if not qr_base64:
                qr_base64 = data.get("base64", "")

            qr_code = ""
            if isinstance(qr_obj, dict):
                qr_code = qr_obj.get("code", "")
            if not qr_code:
                qr_code = data.get("code", "")

            logger.info(f"[WA-WEBHOOK] QR base64_len={len(qr_base64)} code_len={len(qr_code)}")

            if qr_base64:
                _set(db, KEY_QR_BASE64, qr_base64)
                _set(db, KEY_STATUS, "PENDING_QR")
                logger.info(f"[WA-WEBHOOK] ✅ QR base64 guardado tenant={tenant_id} len={len(qr_base64)}")
            elif qr_code:
                _set(db, KEY_QR_BASE64, f"CODE:{qr_code}")
                _set(db, KEY_STATUS, "PENDING_QR")
                logger.info(f"[WA-WEBHOOK] ✅ QR code guardado tenant={tenant_id}")
            else:
                logger.warning(f"[WA-WEBHOOK] ⚠️ QR vacío. data: {str(data)[:400]}")

        elif event_norm == "CONNECTION_UPDATE":
            state = data.get("state", "")
            logger.info(f"[WA-WEBHOOK] CONNECTION state={state}")
            if state == "open":
                _set(db, KEY_STATUS,    "CONNECTED")
                _set(db, KEY_QR_BASE64, "")
                _set(db, KEY_ENABLED,   "true")
                logger.info(f"[WA-WEBHOOK] ✅ CONECTADO: tenant {tenant_id}")
            elif state in ["close", "refused", "connecting"]:
                current = _get(db, KEY_STATUS)
                if current == "CONNECTED":
                    _set(db, KEY_STATUS, "DISCONNECTED")
                    logger.info(f"[WA-WEBHOOK] Desconectado: tenant {tenant_id}")

        db.close()
    except Exception as e:
        logger.error(f"[WA-WEBHOOK] Error procesando evento: {e}")

    return {"ok": True}


# ══════════════════════════════════════════════════════════════
# ENDPOINTS PARA EL FRONTEND
# ══════════════════════════════════════════════════════════════

@router.get("/config")
def get_config(
    current_user = Depends(get_current_active_user),
    db: Session   = Depends(get_db)
):
    return {
        "enabled":       _get(db, KEY_ENABLED) == "true",
        "instance_name": _get(db, KEY_INSTANCE),
        "status":        _get(db, KEY_STATUS),
        "notify_sale":   _get(db, KEY_NOTIFY_SALE)   == "true",
        "notify_order":  _get(db, KEY_NOTIFY_ORDER)  == "true",
        "notify_credit": _get(db, KEY_NOTIFY_CREDIT) == "true",
        "notify_quote":  _get(db, KEY_NOTIFY_QUOTE)  == "false",
    }


@router.post("/config")
def update_config(
    config: dict,
    current_user = Depends(admin_required),
    db: Session   = Depends(get_db)
):
    mapping = {
        "notify_sale":   KEY_NOTIFY_SALE,
        "notify_order":  KEY_NOTIFY_ORDER,
        "notify_credit": KEY_NOTIFY_CREDIT,
        "notify_quote":  KEY_NOTIFY_QUOTE,
    }
    for field, key in mapping.items():
        if field in config:
            _set(db, key, "true" if config[field] else "false")
    return {"ok": True}


@router.post("/instance/create")
async def create_instance(
    current_user = Depends(admin_required),
    db: Session   = Depends(get_db)
):
    """
    Crea la instancia en Evolution API y configura el webhook.
    El QR llegará automáticamente al endpoint /webhook/{tenant_id}.
    IMPORTANTE: Todo el trabajo de BD se hace ANTES del await largo.
    """
    from ..tenant_context import get_tenant_schema

    tenant_id     = str(current_user.tenant_id)
    schema_name   = get_tenant_schema()  # Guardar ANTES del await
    instance_name = schema_name.replace(".", "-").replace(" ", "-").lower()

    # ── 1. Operaciones de BD ANTES del await ──────────────────
    _set(db, KEY_INSTANCE,  instance_name)
    _set(db, KEY_STATUS,    "PENDING_QR")
    _set(db, KEY_ENABLED,   "true")
    _set(db, KEY_QR_BASE64, "")
    db.commit()
    db.close()  # Cerrar sesión antes del await — evita contaminación del pool

    # ── 2. Llamada a Evolution API (puede tardar ~20s) ─────────
    already_exists = False
    try:
        await _evo_post("/instance/create", {
            "instanceName": instance_name,
            "integration":  "WHATSAPP-BAILEYS",
            "qrcode":        True,
            "reject_call":   False,
            "groups_ignore": True,
            "always_online": False,
            "read_messages": False,
            "read_status":   False,
        })
    except httpx.HTTPStatusError as e:
        body = {}
        try:
            body = e.response.json()
        except Exception:
            pass
        msgs = body.get("response", {}).get("message", [])
        already_exists = any("already in use" in str(m) for m in msgs)
        if not already_exists:
            raise HTTPException(
                status_code=500,
                detail=f"Error en Evolution API: {e.response.status_code}"
            )

    # ── 3. Configurar webhook (síncrono, rápido) ───────────────
    _configure_webhook(instance_name, schema_name)

    return {
        "ok":            True,
        "instance_name": instance_name,
        "status":        "PENDING_QR",
        "message":       "Instancia configurada. El QR aparecerá en pantalla en segundos.",
        "already_existed": already_exists
    }


@router.get("/instance/qr")
def get_qr(
    current_user = Depends(get_current_active_user),
    db: Session   = Depends(get_db)
):
    """Devuelve el QR guardado por el webhook. El frontend hace polling aquí."""
    qr = _get(db, KEY_QR_BASE64)
    status = _get(db, KEY_STATUS)
    return {
        "status":    status,
        "qr_base64": qr,
        "has_qr":    bool(qr),
    }


@router.get("/instance/status")
async def get_status(
    current_user = Depends(get_current_active_user),
    db: Session   = Depends(get_db)
):
    """Estado actual de la conexión — consulta Evolution API en tiempo real."""
    instance_name = _get(db, KEY_INSTANCE)
    if not instance_name:
        return {"status": "NOT_CREATED", "connected": False}
    try:
        result    = await _evo_get(f"/instance/connectionState/{instance_name}")
        state     = result.get("instance", {}).get("state", "close")
        connected = state == "open"
        new_status = "CONNECTED" if connected else "DISCONNECTED"
        if _get(db, KEY_STATUS) != new_status and new_status != "DISCONNECTED":
            _set(db, KEY_STATUS, new_status)
        return {
            "status":        new_status,
            "connected":     connected,
            "instance_name": instance_name,
        }
    except Exception as e:
        return {"status": "ERROR", "connected": False}


@router.post("/instance/disconnect")
async def disconnect(
    current_user = Depends(admin_required),
    db: Session   = Depends(get_db)
):
    instance_name = _get(db, KEY_INSTANCE)
    if not instance_name:
        raise HTTPException(status_code=404, detail="No hay instancia configurada")
    try:
        await _evo_delete(f"/instance/delete/{instance_name}")
    except Exception:
        pass  # Aunque falle en Evo, limpiar la BD
    _set(db, KEY_STATUS,    "DISCONNECTED")
    _set(db, KEY_ENABLED,   "false")
    _set(db, KEY_INSTANCE,  "")
    _set(db, KEY_QR_BASE64, "")
    return {"ok": True}


@router.post("/test")
async def send_test(
    body: dict,
    current_user = Depends(admin_required),
    db: Session   = Depends(get_db)
):
    instance_name = _get(db, KEY_INSTANCE)
    if not instance_name:
        raise HTTPException(status_code=404, detail="No hay instancia configurada")
    phone = "".join(c for c in body.get("phone", "") if c.isdigit())
    if not phone:
        raise HTTPException(status_code=400, detail="Número de teléfono inválido")
    try:
        result = await _evo_post(f"/message/sendText/{instance_name}", {
            "number": phone,
            "text":   body.get("message", "✅ Prueba desde Mi Inventario Fácil"),
        })
        return {"ok": True, "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Función utilitaria para otros routers ────────────────────
async def send_whatsapp_message(db: Session, phone: str, message: str) -> bool:
    try:
        instance_name = _get(db, KEY_INSTANCE)
        enabled       = _get(db, KEY_ENABLED) == "true"
        status        = _get(db, KEY_STATUS)
        if not enabled or not instance_name or status != "CONNECTED":
            return False
        clean = "".join(c for c in phone if c.isdigit())
        if len(clean) < 7:
            return False
        await _evo_post(f"/message/sendText/{instance_name}", {
            "number": clean, "text": message
        })
        return True
    except Exception as e:
        logger.warning(f"[WA] Error enviando a {phone}: {e}")
        return False
