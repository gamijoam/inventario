"""
desktop_backend/config.py

Configuración exclusiva del backend de escritorio.
Las variables que comparte con backend_api se inyectan como env vars
en main.py ANTES de importar backend_api, para que pydantic_settings las lea.
"""
import os
from pathlib import Path

# ── Directorio de datos persistentes del desktop ─────────────────────────────
# Windows: C:\Users\<user>\AppData\Local\Invensoft\
DESKTOP_DATA_DIR = Path(
    os.getenv('INVENSOFT_DATA_DIR', str(Path.home() / 'AppData' / 'Local' / 'Invensoft'))
)
DESKTOP_DATA_DIR.mkdir(parents=True, exist_ok=True)

# ── Constantes del desktop ────────────────────────────────────────────────────
DESKTOP_SCHEMA      = "desktop_local"
DESKTOP_DB_NAME     = "invensoft_desktop"
DESKTOP_DB_USER     = "invensoft"
DESKTOP_DB_PASSWORD = "invensoft123"
DESKTOP_DB_HOST     = "localhost"
DESKTOP_DB_PORT     = 5432

DESKTOP_DATABASE_URL = (
    f"postgresql://{DESKTOP_DB_USER}:{DESKTOP_DB_PASSWORD}"
    f"@{DESKTOP_DB_HOST}:{DESKTOP_DB_PORT}/{DESKTOP_DB_NAME}"
)

# ── Licencia ──────────────────────────────────────────────────────────────────
# URL del servidor central para validar licencias (siempre VPS, nunca local)
LICENSE_SERVER_URL  = os.getenv('LICENSE_SERVER_URL', 'https://api.miinventariofacil.com')
LICENSE_FILE_PATH   = str(DESKTOP_DATA_DIR / 'license.lic')
SECRET_KEY_FILE     = DESKTOP_DATA_DIR / 'secret.key'

def get_or_create_secret_key() -> str:
    """Genera una SECRET_KEY persistente en el primer arranque."""
    if SECRET_KEY_FILE.exists():
        return SECRET_KEY_FILE.read_text().strip()
    import secrets
    key = secrets.token_hex(32)
    SECRET_KEY_FILE.write_text(key)
    return key
