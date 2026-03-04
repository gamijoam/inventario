"""
desktop_backend/run.py

Punto de entrada para arrancar el backend de escritorio con uvicorn.
Este es el script que Tauri ejecuta como sidecar.

Uso:
    python -m desktop_backend.run            (desde ferreteria_refactor/)
    python run.py                            (desde desktop_backend/)

El compilado con PyInstaller usará este archivo como entry point.
"""
import sys
import os
from pathlib import Path

# Asegurar que ferreteria_refactor/ está en el path
_FERRETERIA_DIR = str(Path(__file__).parent.parent)
if _FERRETERIA_DIR not in sys.path:
    sys.path.insert(0, _FERRETERIA_DIR)

import uvicorn

if __name__ == "__main__":
    port = int(os.getenv("INVENSOFT_PORT", "8000"))
    print(f"[DESKTOP] Iniciando Invensoft Backend en puerto {port}...", flush=True)

    uvicorn.run(
        "desktop_backend.main:app",
        host="127.0.0.1",
        port=port,
        reload=False,
        log_level="warning",   # Solo errores en producción
        access_log=False,       # El LoggingMiddleware ya lo hace
    )
