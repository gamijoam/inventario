"""
bg_remover.py
-------------
Servicio de eliminación de fondo de imágenes usando rembg (u2netp).

- El modelo se carga una sola vez (lazy) y se mantiene en memoria.
- u2netp pesa ~5MB y es razonablemente preciso para productos de retail.
- Falla con HTTPException si rembg no está disponible (entornos sin la dependencia).
"""
import io
import logging
import os
import threading
from pathlib import Path
from typing import Optional

from fastapi import HTTPException

logger = logging.getLogger(__name__)

# ── Singleton del modelo (thread-safe) ────────────────────────────────────────
_session = None
_session_lock = threading.Lock()
_session_load_failed = False
_DEFAULT_MODEL = "u2netp"


def _prepare_runtime_dirs():
    """Prepara caches escribibles para rembg/numba en contenedores sin HOME real."""
    base_dir = Path(os.environ.get("BG_REMOVER_RUNTIME_DIR", "/tmp/mi-inventario-bgremove"))
    home_dir = base_dir / "home"
    numba_cache_dir = base_dir / "numba-cache"
    xdg_cache_dir = base_dir / "xdg-cache"

    for directory in (home_dir, numba_cache_dir, xdg_cache_dir):
        directory.mkdir(parents=True, exist_ok=True)

    current_home = os.environ.get("HOME")
    if not current_home or not os.path.isdir(current_home) or not os.access(current_home, os.W_OK):
        os.environ["HOME"] = str(home_dir)

    os.environ.setdefault("NUMBA_CACHE_DIR", str(numba_cache_dir))
    os.environ.setdefault("XDG_CACHE_HOME", str(xdg_cache_dir))


def _get_session():
    """Carga (lazy) la sesión de rembg con el modelo configurado. Thread-safe."""
    global _session, _session_load_failed

    if _session is not None:
        return _session
    if _session_load_failed:
        return None

    with _session_lock:
        if _session is not None:
            return _session
        try:
            _prepare_runtime_dirs()
            from rembg import new_session  # type: ignore
            logger.info(f"[bg_remover] Cargando modelo {_DEFAULT_MODEL}…")
            _session = new_session(_DEFAULT_MODEL)
            logger.info("[bg_remover] Modelo cargado en memoria")
            return _session
        except Exception as e:
            _session_load_failed = True
            logger.error(f"[bg_remover] Falló la carga del modelo: {e}")
            return None


def remove_background(image_bytes: bytes) -> bytes:
    """
    Procesa una imagen y devuelve los bytes PNG con el fondo eliminado (alpha).

    Args:
        image_bytes: bytes crudos de la imagen original (JPEG/PNG/WEBP).

    Returns:
        bytes PNG con canal alpha (fondo transparente).

    Raises:
        HTTPException 503: si rembg no está disponible.
        HTTPException 500: si falla el procesamiento.
    """
    session = _get_session()
    if session is None:
        raise HTTPException(
            status_code=503,
            detail="El servicio de eliminación de fondo no está disponible en este entorno."
        )

    try:
        from rembg import remove  # type: ignore
        from PIL import Image
    except ImportError as e:
        raise HTTPException(status_code=503, detail=f"Dependencia faltante: {e}")

    try:
        # rembg.remove acepta bytes y devuelve bytes (PNG con alpha)
        out_bytes = remove(image_bytes, session=session)
        # Validar que se generó algo razonable
        if not out_bytes or len(out_bytes) < 100:
            raise HTTPException(status_code=500, detail="La imagen procesada salió vacía")

        # Verificar que es decodable como imagen
        try:
            Image.open(io.BytesIO(out_bytes)).verify()
        except Exception:
            raise HTTPException(status_code=500, detail="La imagen procesada no es válida")

        return out_bytes
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("[bg_remover] Error procesando imagen")
        raise HTTPException(status_code=500, detail=f"Error procesando imagen: {e}")


def is_available() -> bool:
    """Indica si el servicio de eliminación de fondo está cargable."""
    return _get_session() is not None
