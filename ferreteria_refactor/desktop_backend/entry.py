"""
desktop_backend/entry.py

Entry point para PyInstaller.
NO tiene el guard __name__ == '__main__' de run.py.

PyInstaller llama a este archivo directamente como el ejecutable.
"""
import sys
import os
from pathlib import Path

# UTF-8 en Windows
os.environ.setdefault("PYTHONUTF8", "1")
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

# Cuando PyInstaller empaqueta, los archivos quedan en sys._MEIPASS
# Necesitamos que Python pueda importar backend_api y desktop_backend
if getattr(sys, 'frozen', False):
    # Modo compilado: los módulos están en el bundle dir
    _bundle_dir = Path(sys._MEIPASS)
    if str(_bundle_dir) not in sys.path:
        sys.path.insert(0, str(_bundle_dir))
else:
    # Modo desarrollo: subir un nivel desde desktop_backend/
    _root = Path(__file__).parent.parent
    if str(_root) not in sys.path:
        sys.path.insert(0, str(_root))

import uvicorn

port = int(os.getenv("INVENSOFT_PORT", "8000"))
print(f"[DESKTOP] Iniciando Invensoft Backend en puerto {port}...", flush=True)

uvicorn.run(
    "desktop_backend.main:app",
    host="127.0.0.1",
    port=port,
    reload=False,
    log_level="warning",
    access_log=False,
)
