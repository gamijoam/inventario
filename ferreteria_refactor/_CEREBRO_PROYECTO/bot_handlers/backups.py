"""
handlers/backups.py
Comandos: /backup /backups /descargar
"""
import subprocess, os
from datetime import datetime

BACKUP_DIR = "/root/backups"
DB_NAME    = "invensoft_prod"

def _ensure_dir():
    os.makedirs(BACKUP_DIR, exist_ok=True)


def handle_backup(parts, send_document_fn):
    """Genera respaldo y lo envía al chat."""
    _ensure_dir()
    schema = parts[1].strip().lower() if len(parts) > 1 else None
    ts     = datetime.now().strftime("%Y%m%d_%Hh%M")
    fname  = f"backup_{schema+'_' if schema else ''}{ts}.sql"
    fpath  = f"{BACKUP_DIR}/{fname}"
    fgz    = f"{fpath}.gz"

    if schema:
        sql_cmd = f"pg_dump -U postgres -d {DB_NAME} -n {schema}"
    else:
        sql_cmd = f"pg_dump -U postgres -d {DB_NAME}"

    t0  = datetime.now()
    cmd = f"docker exec db_prod_server {sql_cmd} | gzip > {fgz}"
    ret = subprocess.run(cmd, shell=True, capture_output=True, timeout=120)
    secs = (datetime.now() - t0).seconds

    if ret.returncode != 0:
        return f"❌ Error generando respaldo:\n```\n{ret.stderr.decode()[:300]}\n```", None

    size = os.path.getsize(fgz) / (1024*1024)
    caption = (
        f"✅ *Respaldo completado*\n"
        f"📁 `{fname}.gz`\n"
        f"📦 {size:.1f} MB\n"
        f"⏱️ {secs}s\n"
        f"{'🔍 Schema: ' + schema if schema else '🗄️ BD completa'}"
    )
    return caption, fgz


def handle_backups():
    """Lista los últimos 10 respaldos."""
    _ensure_dir()
    files = sorted(
        [f for f in os.listdir(BACKUP_DIR) if f.endswith(".gz")],
        reverse=True
    )[:10]

    if not files:
        return "📭 No hay respaldos disponibles.\n\nUsa /backup para generar uno.", []

    lines   = ["💾 *Últimos respaldos*\n"]
    buttons = []
    for i, f in enumerate(files, 1):
        size = os.path.getsize(f"{BACKUP_DIR}/{f}") / (1024*1024)
        # Extraer fecha del nombre
        lines.append(f"{i}. `{f}` — {size:.1f} MB")
        buttons.append([
            {"text": f"⬇️ {i}. Descargar", "callback_data": f"descargar:{f}"},
            {"text": f"🗑️ Eliminar",       "callback_data": f"del_backup:{f}"},
        ])
    return "\n".join(lines), buttons


def handle_descargar(filename):
    """Retorna la ruta del archivo para enviarlo por Telegram."""
    fpath = f"{BACKUP_DIR}/{filename}"
    if not os.path.exists(fpath):
        return f"❌ Archivo `{filename}` no encontrado.", None
    size = os.path.getsize(fpath) / (1024*1024)
    caption = f"📁 `{filename}`\n📦 {size:.1f} MB"
    return caption, fpath


def handle_del_backup(filename):
    """Elimina un respaldo."""
    fpath = f"{BACKUP_DIR}/{filename}"
    if not os.path.exists(fpath):
        return f"❌ `{filename}` no encontrado."
    os.remove(fpath)
    return f"🗑️ Respaldo `{filename}` eliminado."
