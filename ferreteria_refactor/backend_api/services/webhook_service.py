"""
Webhook Service — Mi Inventario Fácil
Envía eventos a n8n cuando ocurren acciones en el sistema.
n8n los enruta a Evolution API → WhatsApp del cliente.
"""
import httpx
import asyncio
import logging
from datetime import datetime
from typing import Optional

logger = logging.getLogger(__name__)

N8N_WEBHOOK_URL = "https://n8n.miinventariofacil.com/webhook/mi-inventario"
WEBHOOK_TIMEOUT  = 5  # segundos — no bloqueamos la respuesta al cajero


async def _post(payload: dict) -> None:
    """Dispara el webhook sin bloquear. Los errores se loguean silenciosamente."""
    try:
        async with httpx.AsyncClient(timeout=WEBHOOK_TIMEOUT) as client:
            r = await client.post(N8N_WEBHOOK_URL, json=payload)
            logger.info(f"[WEBHOOK] {payload['event']} → {r.status_code}")
    except Exception as e:
        logger.warning(f"[WEBHOOK] Error enviando {payload.get('event')}: {e}")


def fire(event: str, tenant_id: str, data: dict) -> None:
    """
    Dispara un webhook de forma no bloqueante.
    Llamar con: webhook_service.fire("sale.completed", tenant_id, {...})
    """
    payload = {
        "event":     event,
        "tenant_id": str(tenant_id),
        "timestamp": datetime.utcnow().isoformat(),
        "data":      data,
    }
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            loop.create_task(_post(payload))
        else:
            loop.run_until_complete(_post(payload))
    except RuntimeError:
        asyncio.run(_post(payload))
