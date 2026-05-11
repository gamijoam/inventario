"""
cache.py — Módulo de caché Redis para Mi Inventario Fácil
Cachea datos frecuentes por tenant para reducir queries a PostgreSQL.
"""
import json
import logging
from functools import wraps
from typing import Any, Optional
try:
    import redis
    REDIS_AVAILABLE = True
except ImportError:
    redis = None
    REDIS_AVAILABLE = False

logger = logging.getLogger(__name__)

# ── Configuración ──────────────────────────────────────────────────────────────
import os
REDIS_HOST = os.environ.get("REDIS_HOST", "172.20.0.3")
REDIS_PORT = int(os.environ.get("REDIS_PORT", "6379"))
REDIS_DB   = int(os.environ.get("REDIS_DB", "0"))

# TTLs en segundos
TTL = {
    "business_config":   300,   # 5 min — config del negocio
    "exchange_rates":    900,   # 15 min — tasas de cambio
    "payment_methods":   600,   # 10 min — métodos de pago
    "price_lists":       600,   # 10 min — listas de precios
    "feature_flags":     300,   # 5 min — flags de módulos
    "categories":        600,   # 10 min — categorías
    "warehouses":        600,   # 10 min — almacenes
    "currencies":        900,   # 15 min — monedas
    "unread_count":       60,   # 1 min — tickets sin leer
}

# ── Cliente Redis singleton ────────────────────────────────────────────────────
_redis_client = None  # Optional Redis client

def get_redis():
    global _redis_client
    if not REDIS_AVAILABLE or redis is None:
        return None
    if _redis_client is None:
        try:
            _redis_client = redis.Redis(
                host=REDIS_HOST,
                port=REDIS_PORT,
                db=REDIS_DB,
                decode_responses=True,
                socket_connect_timeout=2,
                socket_timeout=2,
            )
            _redis_client.ping()
            logger.info("✅ Redis conectado en %s:%s", REDIS_HOST, REDIS_PORT)
        except Exception as e:
            logger.warning("⚠️ Redis no disponible: %s — usando sin caché", e)
            _redis_client = None
    return _redis_client


# ── Funciones de caché por tenant ──────────────────────────────────────────────
def cache_key(tenant: str, resource: str, extra: str = "") -> str:
    """Genera una clave única por tenant y recurso."""
    key = f"mif:{tenant}:{resource}"
    if extra:
        key += f":{extra}"
    return key


def get_cached(tenant: str, resource: str, extra: str = "") -> Optional[Any]:
    """Obtiene un valor de caché. Retorna None si no existe o Redis no disponible."""
    r = get_redis()
    if not r:
        return None
    try:
        key = cache_key(tenant, resource, extra)
        data = r.get(key)
        if data:
            return json.loads(data)
        return None
    except Exception as e:
        logger.debug("Cache get error: %s", e)
        return None


def set_cached(tenant: str, resource: str, data: Any, extra: str = "", ttl: int = 300) -> bool:
    """Guarda un valor en caché. Retorna True si se guardó."""
    r = get_redis()
    if not r:
        return False
    try:
        key = cache_key(tenant, resource, extra)
        r.setex(key, ttl, json.dumps(data, default=str))
        return True
    except Exception as e:
        logger.debug("Cache set error: %s", e)
        return False


def invalidate(tenant: str, resource: str, extra: str = "") -> bool:
    """Invalida una clave de caché específica."""
    r = get_redis()
    if not r:
        return False
    try:
        key = cache_key(tenant, resource, extra)
        r.delete(key)
        return True
    except Exception:
        return False


def invalidate_tenant(tenant: str) -> int:
    """Invalida TODA la caché de un tenant (al hacer logout, cambios masivos, etc.)."""
    r = get_redis()
    if not r:
        return 0
    try:
        pattern = f"mif:{tenant}:*"
        keys = r.keys(pattern)
        if keys:
            r.delete(*keys)
        return len(keys)
    except Exception:
        return 0


def invalidate_all() -> int:
    """Invalida toda la caché (emergencias). Usar con cuidado."""
    r = get_redis()
    if not r:
        return 0
    try:
        keys = r.keys("mif:*")
        if keys:
            r.delete(*keys)
        return len(keys)
    except Exception:
        return 0


def cache_stats() -> dict:
    """Estadísticas del caché para monitoreo."""
    r = get_redis()
    if not r:
        return {"status": "disconnected"}
    try:
        info = r.info("memory")
        keys = r.dbsize()
        return {
            "status":       "connected",
            "keys":         keys,
            "used_memory":  info.get("used_memory_human", "?"),
            "max_memory":   info.get("maxmemory_human", "128M"),
            "hit_rate":     None,  # requiere pg_stat_statements
        }
    except Exception as e:
        return {"status": "error", "error": str(e)}
