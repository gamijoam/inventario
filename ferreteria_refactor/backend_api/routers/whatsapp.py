"""
WhatsApp Router — Mi Inventario Fácil
Usa el servicio Baileys propio (mi-inventario-whatsapp) en la red Docker.
Sin Evolution API — control total del QR y la sesión.
"""
import httpx
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text

from ..database.db import get_db
from ..models import models
from ..dependencies import get_current_active_user, has_role
from ..models.models import UserRole
from ..tenant_context import get_tenant_schema

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/whatsapp", tags=["whatsapp"])
admin_required = has_role([UserRole.ADMIN])

# ── Servicio Baileys interno ──────────────────────────────────
WA_URL     = "http://whatsapp_service:3000"
WA_TIMEOUT = 30

# ── Claves en business_config ─────────────────────────────────
KEY_ENABLED       = "whatsapp_enabled"
KEY_INSTANCE      = "whatsapp_instance_name"
KEY_STATUS        = "whatsapp_instance_status"
KEY_NOTIFY_SALE   = "whatsapp_notify_sale"
KEY_NOTIFY_ORDER  = "whatsapp_notify_order_ready"
KEY_NOTIFY_CREDIT = "whatsapp_notify_credit_reminder"
KEY_NOTIFY_QUOTE  = "whatsapp_notify_quote"
KEY_ADMIN_PHONE   = "whatsapp_admin_phone"   # Número del dueño para alertas internas
KEY_NOTIFY_TRANSFER = "whatsapp_notify_transfer"   # Feature flag para notificar transfers
KEY_CREDIT_AUTO   = "whatsapp_credit_reminder_auto"
KEY_CREDIT_HOUR   = "whatsapp_credit_reminder_hour"
KEY_CREDIT_DAYS   = "whatsapp_credit_reminder_days"
KEY_NOTIFY_WELCOME  = "whatsapp_notify_welcome"
KEY_NOTIFY_QUOTE_EXP = "whatsapp_notify_quote_expiry"
KEY_NOTIFY_WARRANTY  = "whatsapp_notify_warranty"
KEY_NOTIFY_STOCK     = "whatsapp_notify_stock"
KEY_NOTIFY_CASH_SUM  = "whatsapp_notify_cash_summary"
KEY_NOTIFY_COMMISSIONS = "whatsapp_notify_commissions"
KEY_CHATBOT_ENABLED    = "whatsapp_chatbot_enabled"
KEY_TPL_WELCOME     = "whatsapp_template_welcome"
KEY_TPL_SALE        = "whatsapp_template_sale"
KEY_TPL_ORDER     = "whatsapp_template_order"
KEY_TPL_CREDIT    = "whatsapp_template_credit"

TPL_SALE_DEFAULT = (
    "🧾 *{{negocio}}*\n"
    "¡Gracias por tu compra, {{cliente}}!\n\n"
    "📋 Venta #{{id}}\n"
    "📦 {{metodo_pago}}\n\n"
    "*PAGOS:*\n{{pagos}}\n\n"
    "*TOTAL: {{total}}*{{vuelto}}\n\n"
    "¡Gracias por preferirnos! 😊"
)
TPL_ORDER_DEFAULT = (
    "🔧 ¡Hola {{cliente}}! Tu equipo está listo 🎉\n\n"
    "📱 {{equipo}}\n"
    "🎫 Orden: {{orden}}\n"
    "💰 Total: {{total}}\n\n"
    "¡Puedes pasar a buscarlo en nuestro horario habitual!"
)
TPL_CREDIT_DEFAULT = (
    "💳 Hola {{cliente}}, te recordamos que tienes un saldo pendiente de *{{monto}}*.\n\n"
    "📅 Por favor regularizar a la brevedad.\n\n"
    "¡Gracias!"
)

DEFAULTS = {
    KEY_ENABLED:       "false",
    KEY_INSTANCE:      "",
    KEY_STATUS:        "DISCONNECTED",
    KEY_NOTIFY_SALE:   "true",
    KEY_NOTIFY_ORDER:  "true",
    KEY_NOTIFY_CREDIT: "true",
    KEY_NOTIFY_QUOTE:  "false",
    KEY_ADMIN_PHONE:   "",
    KEY_CREDIT_AUTO:   "true",
    KEY_CREDIT_HOUR:   "9",
    KEY_CREDIT_DAYS:     "1",
    KEY_NOTIFY_WELCOME:  "true",
    KEY_NOTIFY_QUOTE_EXP:"true",
    KEY_NOTIFY_WARRANTY: "true",
    KEY_NOTIFY_STOCK:    "true",
    KEY_NOTIFY_CASH_SUM: "true",
    KEY_TPL_WELCOME: (
        "👋 ¡Hola {{cliente}}! Bienvenido/a a *{{negocio}}*.\n\n"
        "Ya tienes tu cuenta registrada. Estamos para servirte. 😊"
    ),
    KEY_TPL_SALE:      TPL_SALE_DEFAULT,
    KEY_TPL_ORDER:     TPL_ORDER_DEFAULT,
    KEY_TPL_CREDIT:    TPL_CREDIT_DEFAULT,
}

# ── BD: SQL con schema explícito (no depende de search_path) ──
def _schema(db: Session) -> str:
    return get_tenant_schema()

def _get(db: Session, key: str) -> str:
    s = _schema(db)
    try:
        row = db.execute(
            text(f'SELECT value FROM "{s}".business_config WHERE key = :k'),
            {"k": key}
        ).fetchone()
        return row[0] if row else DEFAULTS.get(key, "")
    except Exception as e:
        logger.warning(f"[WA._get] key={key} schema={s}: {e}")
        return DEFAULTS.get(key, "")

def _set(db: Session, key: str, value: str):
    s = _schema(db)
    try:
        r = db.execute(
            text(f'UPDATE "{s}".business_config SET value=:v WHERE key=:k'),
            {"k": key, "v": value}
        )
        if r.rowcount == 0:
            db.execute(
                text(f'INSERT INTO "{s}".business_config(key,value) VALUES(:k,:v)'),
                {"k": key, "v": value}
            )
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"[WA._set] FAILED key={key} schema={s}: {e}")
        raise

# ── HTTP al servicio Baileys ──────────────────────────────────
async def _wa(method: str, path: str, **kwargs) -> dict:
    async with httpx.AsyncClient(timeout=WA_TIMEOUT) as c:
        r = await getattr(c, method)(f"{WA_URL}{path}", **kwargs)
        r.raise_for_status()
        return r.json()

# ══════════════════════════════════════════════════════════════
# ENDPOINTS
# ══════════════════════════════════════════════════════════════

def _check_whatsapp_flag(db: Session):
    """Lanza 403 si el tenant no tiene activado el flag whatsapp_business."""
    from sqlalchemy import text
    schema = get_tenant_schema()
    # Leer feature_flags del tenant desde la tabla pública de tenants
    try:
        row = db.execute(
            text("SELECT feature_flags FROM public.tenants WHERE schema_name = :s"),
            {"s": schema}
        ).fetchone()
        flags = row[0] if row else {}
        if not (flags or {}).get("whatsapp_business", False):
            from fastapi import HTTPException
            raise HTTPException(
                status_code=403,
                detail="El módulo WhatsApp Business no está activado en tu plan. Contacta a soporte para habilitarlo."
            )
    except HTTPException:
        raise
    except Exception:
        pass  # Si falla la verificación, permitir (evitar bloqueo por error técnico)


@router.get("/config")
def get_config(
    current_user=Depends(get_current_active_user),
    db: Session=Depends(get_db)
):
    _check_whatsapp_flag(db)
    return {
        "enabled":        _get(db, KEY_ENABLED) == "true",
        "instance_name":  _get(db, KEY_INSTANCE),
        "status":         _get(db, KEY_STATUS),
        "notify_sale":    _get(db, KEY_NOTIFY_SALE)   == "true",
        "notify_order":   _get(db, KEY_NOTIFY_ORDER)  == "true",
        "notify_credit":  _get(db, KEY_NOTIFY_CREDIT) == "true",
        "notify_quote":   _get(db, KEY_NOTIFY_QUOTE)  == "true",
        "template_sale":  _get(db, KEY_TPL_SALE),
        "template_order": _get(db, KEY_TPL_ORDER),
        "template_credit":_get(db, KEY_TPL_CREDIT),
        "admin_phone":          _get(db, KEY_ADMIN_PHONE),
        "credit_reminder_auto": _get(db, KEY_CREDIT_AUTO) == "true",
        "credit_reminder_hour": int(_get(db, KEY_CREDIT_HOUR) or "9"),
        "credit_reminder_days":  int(_get(db, KEY_CREDIT_DAYS) or "1"),
        "notify_welcome":        _get(db, KEY_NOTIFY_WELCOME)  != "false",
        "chatbot_enabled":       _get(db, KEY_CHATBOT_ENABLED) == "true",
        "notify_quote_expiry":   _get(db, KEY_NOTIFY_QUOTE_EXP) != "false",
        "notify_warranty":       _get(db, KEY_NOTIFY_WARRANTY) != "false",
        "notify_stock":          _get(db, KEY_NOTIFY_STOCK)    != "false",
        "notify_cash_summary":   _get(db, KEY_NOTIFY_CASH_SUM) != "false",
        "notify_commissions":    _get(db, KEY_NOTIFY_COMMISSIONS) != "false",
        "template_welcome":      _get(db, KEY_TPL_WELCOME),
    }


@router.post("/config")
def update_config(
    config: dict,
    current_user=Depends(admin_required),
    db: Session=Depends(get_db)
):
    # Toggles booleanos
    for field, key in [
        ("notify_welcome",      KEY_NOTIFY_WELCOME),
        ("notify_quote_expiry", KEY_NOTIFY_QUOTE_EXP),
        ("notify_warranty",     KEY_NOTIFY_WARRANTY),
        ("notify_stock",        KEY_NOTIFY_STOCK),
        ("notify_cash_summary", KEY_NOTIFY_CASH_SUM),
        ("notify_commissions",  KEY_NOTIFY_COMMISSIONS),
        ("chatbot_enabled",     KEY_CHATBOT_ENABLED),
        ("notify_sale",   KEY_NOTIFY_SALE),
        ("notify_order",  KEY_NOTIFY_ORDER),
        ("notify_credit", KEY_NOTIFY_CREDIT),
        ("notify_quote",  KEY_NOTIFY_QUOTE),
    ]:
        if field in config:
            _set(db, key, "true" if config[field] else "false")

    # Número del admin
    if "admin_phone" in config and isinstance(config["admin_phone"], str):
        _set(db, KEY_ADMIN_PHONE, config["admin_phone"].strip())

    # Config recordatorio crédito
    if "credit_reminder_auto" in config:
        _set(db, KEY_CREDIT_AUTO, "true" if config["credit_reminder_auto"] else "false")
        # Actualizar el scheduler dinámicamente
        from ..scheduler import scheduler as _sched
        from ..services.whatsapp_scheduler import job_credit_reminders
        from apscheduler.triggers.cron import CronTrigger
        try:
            if config["credit_reminder_auto"]:
                hour = int(config.get("credit_reminder_hour", _get(db, KEY_CREDIT_HOUR) or 9))
                _sched.reschedule_job("whatsapp_credit_reminders",
                    trigger=CronTrigger(hour=hour, minute=0, timezone="America/Caracas"))
            else:
                _sched.pause_job("whatsapp_credit_reminders")
        except Exception:
            pass
    if "credit_reminder_hour" in config:
        hour = int(config.get("credit_reminder_hour", 9))
        _set(db, KEY_CREDIT_HOUR, str(hour))
        from ..scheduler import scheduler as _sched
        from apscheduler.triggers.cron import CronTrigger
        try:
            _sched.reschedule_job("whatsapp_credit_reminders",
                trigger=CronTrigger(hour=hour, minute=0, timezone="America/Caracas"))
        except Exception:
            pass
    if "credit_reminder_days" in config:
        _set(db, KEY_CREDIT_DAYS, str(int(config.get("credit_reminder_days", 1))))

    # Plantillas de texto
    for field, key in [
        ("template_welcome", KEY_TPL_WELCOME),
        ("template_sale",   KEY_TPL_SALE),
        ("template_order",  KEY_TPL_ORDER),
        ("template_credit", KEY_TPL_CREDIT),
    ]:
        if field in config and isinstance(config[field], str) and config[field].strip():
            _set(db, key, config[field].strip())

    return {"ok": True}


@router.post("/instance/create")
async def create_instance(
    current_user=Depends(admin_required),
    db: Session=Depends(get_db)
):
    """Inicia la conexión WhatsApp. El QR estará disponible en /instance/qr."""
    _check_whatsapp_flag(db)
    schema_name   = get_tenant_schema()
    instance_name = schema_name.replace(".", "-").lower()

    # Guardar en BD antes del await
    _set(db, KEY_INSTANCE, instance_name)
    _set(db, KEY_STATUS,   "PENDING_QR")
    _set(db, KEY_ENABLED,  "true")
    db.close()

    # Iniciar instancia en el servicio Baileys
    try:
        result = await _wa("post", f"/instance/{instance_name}/connect")
        logger.info(f"[WA] Instancia {instance_name} iniciada: {result}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error iniciando WhatsApp: {str(e)}")

    return {"ok": True, "status": "PENDING_QR", "instance_name": instance_name}


@router.get("/instance/qr")
async def get_qr(
    current_user=Depends(get_current_active_user),
    db: Session=Depends(get_db)
):
    """Polling del QR — consulta el servicio Baileys directamente."""
    instance_name = _get(db, KEY_INSTANCE)
    if not instance_name:
        return {"status": "NOT_CREATED", "has_qr": False, "qr_base64": ""}

    try:
        data = await _wa("get", f"/instance/{instance_name}/qr")
        status   = data.get("status", "CONNECTING").upper()
        qr_b64   = data.get("qr_base64", "")
        has_qr   = data.get("has_qr", False)

        # Sincronizar estado en BD
        if status == "CONNECTED":
            _set(db, KEY_STATUS,  "CONNECTED")
            _set(db, KEY_ENABLED, "true")
        elif status in ("PENDING_QR", "CONNECTING"):
            _set(db, KEY_STATUS, "PENDING_QR")

        return {"status": status, "has_qr": has_qr, "qr_base64": qr_b64}

    except Exception as e:
        logger.error(f"[WA] Error obteniendo QR: {e}")
        return {"status": "ERROR", "has_qr": False, "qr_base64": ""}


@router.get("/instance/status")
async def get_status(
    current_user=Depends(get_current_active_user),
    db: Session=Depends(get_db)
):
    instance_name = _get(db, KEY_INSTANCE)
    if not instance_name:
        return {"status": "NOT_CREATED", "connected": False}
    try:
        data = await _wa("get", f"/instance/{instance_name}/status")
        return {"status": data.get("status","?"), "connected": data.get("connected", False)}
    except Exception:
        return {"status": "ERROR", "connected": False}


@router.post("/instance/disconnect")
async def disconnect(
    current_user=Depends(admin_required),
    db: Session=Depends(get_db)
):
    instance_name = _get(db, KEY_INSTANCE)
    if not instance_name:
        raise HTTPException(status_code=404, detail="No hay instancia configurada")
    try:
        await _wa("delete", f"/instance/{instance_name}")
    except Exception:
        pass
    _set(db, KEY_STATUS,   "DISCONNECTED")
    _set(db, KEY_ENABLED,  "false")
    _set(db, KEY_INSTANCE, "")
    return {"ok": True}


@router.post("/credit-reminders/send-now")
async def send_credit_reminders_now(
    current_user=Depends(admin_required),
    db: Session=Depends(get_db)
):
    """Dispara los recordatorios de deuda manualmente ahora mismo."""
    from ..services.whatsapp_scheduler import job_credit_reminders
    import asyncio
    asyncio.create_task(job_credit_reminders())
    return {"ok": True, "message": "Recordatorios enviándose en segundo plano..."}


@router.post("/test")
async def send_test(
    body: dict,
    current_user=Depends(admin_required),
    db: Session=Depends(get_db)
):
    instance_name = _get(db, KEY_INSTANCE)
    if not instance_name:
        raise HTTPException(status_code=404, detail="No hay instancia configurada")
    phone = "".join(c for c in body.get("phone", "") if c.isdigit())
    if not phone:
        raise HTTPException(status_code=400, detail="Número inválido")
    try:
        result = await _wa("post", f"/instance/{instance_name}/send",
                           json={"phone": phone, "message": body.get("message", "Prueba desde Mi Inventario ✅")})
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Función para otros routers (ventas, taller, etc.) ─────────
async def send_whatsapp_message(db: Session, phone: str, message: str) -> bool:
    try:
        inst    = _get(db, KEY_INSTANCE)
        enabled = _get(db, KEY_ENABLED) == "true"
        status  = _get(db, KEY_STATUS)
        if not enabled or not inst or status != "CONNECTED":
            return False
        clean = "".join(c for c in phone if c.isdigit())
        if len(clean) < 7:
            return False
        await _wa("post", f"/instance/{inst}/send",
                  json={"phone": clean, "message": message})
        return True
    except Exception as e:
        logger.warning(f"[WA] Error enviando a {phone}: {e}")
        return False


# ── Envío manual desde Customer360 ───────────────────────────────────────────
@router.post("/send-message")
async def send_manual_message(
    body: dict,
    current_user=Depends(admin_required),
    db: Session=Depends(get_db)
):
    """Envía un mensaje WhatsApp desde el Customer360 (crédito, recordatorio, etc.)"""
    phone   = body.get("phone", "")
    message = body.get("message", "")

    if not phone or not message:
        raise HTTPException(status_code=400, detail="Número y mensaje requeridos")

    ok = await send_whatsapp_message(db, phone, message)
    if not ok:
        raise HTTPException(
            status_code=503,
            detail="WhatsApp no está conectado. Verifica la sesión en Configuración → WhatsApp."
        )
    return {"ok": True, "message": "Mensaje enviado correctamente"}
