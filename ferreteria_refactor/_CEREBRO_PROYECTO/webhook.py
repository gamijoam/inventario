"""
webhook.py — Mi Inventario Admin Bot
Panel SaaS completo desde Telegram.
"""
import os, json, subprocess, threading, logging, sys
sys.path.insert(0, "/root/deploy/telegram-bot")

from flask import Flask, request, jsonify
import urllib.request

from help import build_ayuda_general, build_ayuda_comando, MENU_PRINCIPAL
from handlers.deploy   import (handle_status, handle_version,
                                handle_rollback_list, handle_rollback_exec,
                                handle_logs, handle_restart)
from handlers.tenants  import (handle_tenants, handle_tenant,
                                handle_bloquear, handle_extender, handle_plan,
                                handle_eliminar_confirmar, handle_eliminar_exec,
                                handle_crear_tenant)
from handlers.usuarios import (handle_usuarios, handle_crear_usuario,
                                handle_reset_pass, handle_user_status)
from handlers.backups  import (handle_backup, handle_backups,
                                handle_descargar, handle_del_backup)
from handlers.organizations import handle_org
from handlers.metrics  import (handle_stats, handle_ventas,
                                handle_nuevos, handle_vencen,
                                handle_disco, handle_ram)

logging.basicConfig(level=logging.INFO,
    format='[%(asctime)s] %(levelname)s %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S')
log = logging.getLogger(__name__)

app = Flask(__name__)

BOT_TOKEN      = os.environ.get("TELEGRAM_TOKEN", "")
CHAT_ID        = os.environ.get("TELEGRAM_CHAT_ID", "")
WEBHOOK_SECRET = os.environ.get("WEBHOOK_SECRET", "mi-inventario-deploy-2026")
DEPLOY_DIR     = "/root/deploy"

pending = {}  # versiones pendientes de deploy

# ── Telegram helpers ──────────────────────────────────────────
def tg(method, data):
    try:
        body = json.dumps(data).encode()
        req  = urllib.request.Request(
            f"https://api.telegram.org/bot{BOT_TOKEN}/{method}",
            data=body, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.loads(r.read())
    except Exception as e:
        log.error(f"Telegram error {method}: {e}")
        return {}

def send_msg(text, buttons=None, chat=None):
    data = {"chat_id": chat or CHAT_ID,
            "text": text[:4096], "parse_mode": "Markdown"}
    if buttons:
        data["reply_markup"] = {"inline_keyboard": buttons}
    return tg("sendMessage", data)

def send_doc(fpath, caption="", chat=None):
    """Envía un archivo al chat."""
    import urllib.request
    chat_id = chat or CHAT_ID
    boundary = "----FormBoundary7MA4YWxkTrZu0gW"
    with open(fpath, "rb") as f:
        file_data = f.read()
    fname = os.path.basename(fpath)
    body  = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="chat_id"\r\n\r\n{chat_id}\r\n'
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="caption"\r\n\r\n{caption}\r\n'
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="document"; filename="{fname}"\r\n'
        f"Content-Type: application/octet-stream\r\n\r\n"
    ).encode() + file_data + f"\r\n--{boundary}--\r\n".encode()

    req = urllib.request.Request(
        f"https://api.telegram.org/bot{BOT_TOKEN}/sendDocument",
        data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read())
    except Exception as e:
        log.error(f"Error enviando documento: {e}")
        return {}

def edit_msg(msg_id, text):
    tg("editMessageText", {
        "chat_id": CHAT_ID, "message_id": msg_id,
        "text": text[:4096], "parse_mode": "Markdown"})

def answer_callback(cb_id, text=""):
    tg("answerCallbackQuery", {"callback_query_id": cb_id, "text": text})

# ── Deploy en background ──────────────────────────────────────
def run_deploy(version, msg_id):
    edit_msg(msg_id, f"⏳ *Desplegando*...\n\nVersión: `{version}`\nEsto tarda ~2 minutos.")
    try:
        r = subprocess.run(
            ["bash", f"{DEPLOY_DIR}/deploy-containers.sh", version],
            capture_output=True, text=True, timeout=180)
        if r.returncode == 0:
            edit_msg(msg_id,
                f"✅ *Deploy exitoso*\n\n"
                f"Versión: `{version}`\n"
                f"Todos los servicios responden correctamente.")
        else:
            edit_msg(msg_id,
                f"❌ *Deploy falló*\n\n`{version}`\n\n"
                f"```\n{r.stdout[-500:]}\n```")
    except subprocess.TimeoutExpired:
        edit_msg(msg_id, f"⏱️ *Timeout*\n\nEl deploy de `{version}` tardó demasiado.")
    except Exception as e:
        edit_msg(msg_id, f"❌ *Error inesperado*\n\n`{str(e)}`")
    pending.pop(version, None)

# ── Webhook principal ─────────────────────────────────────────
@app.route("/health")
def health():
    return jsonify({"ok": True, "service": "admin-bot"})

@app.route(f"/webhook/{WEBHOOK_SECRET}", methods=["POST"])
def webhook():
    try:
        update = request.get_json(force=True)
        log.info(f"Update: {json.dumps(update)[:300]}")

        # ── Callback de botones inline ────────────────────────
        if "callback_query" in update:
            cb     = update["callback_query"]
            cb_id  = cb["id"]
            data   = cb.get("data", "")
            msg_id = cb["message"]["message_id"]
            c_id   = str(cb["message"]["chat"]["id"])

            if c_id != str(CHAT_ID):
                answer_callback(cb_id, "⛔ No autorizado")
                return jsonify({"ok": True})

            # Deploy aprobado
            if data.startswith("approve:"):
                version = data.replace("approve:", "")
                answer_callback(cb_id, "✅ Aprobado — desplegando...")
                pending[version] = msg_id
                threading.Thread(target=run_deploy,
                    args=(version, msg_id), daemon=True).start()

            # Deploy cancelado
            elif data.startswith("cancel:"):
                version = data.replace("cancel:", "")
                answer_callback(cb_id, "❌ Cancelado")
                edit_msg(msg_id,
                    f"❌ *Deploy cancelado*\n\nVersión: `{version}`")

            # Rollback a versión específica
            elif data.startswith("rollback:"):
                version = data.replace("rollback:", "")
                answer_callback(cb_id, f"⏳ Haciendo rollback a {version}...")
                edit_msg(msg_id, f"⏳ *Rollback en progreso...*\n\n`{version}`")
                threading.Thread(target=lambda: edit_msg(
                    msg_id, handle_rollback_exec(version)), daemon=True).start()

            # Confirmar eliminación tenant
            elif data.startswith("eliminar_confirm:"):
                schema = data.replace("eliminar_confirm:", "")
                answer_callback(cb_id, "🗑️ Eliminando...")
                edit_msg(msg_id, handle_eliminar_exec(schema))

            elif data.startswith("eliminar_cancel:"):
                answer_callback(cb_id, "Cancelado")
                edit_msg(msg_id, "❌ Eliminación cancelada.")

            # Descargar backup
            elif data.startswith("descargar:"):
                fname = data.replace("descargar:", "")
                answer_callback(cb_id, "⬇️ Enviando archivo...")
                caption, fpath = handle_descargar(fname)
                if fpath:
                    threading.Thread(
                        target=send_doc, args=(fpath, caption), daemon=True).start()
                else:
                    send_msg(caption)

            # Eliminar backup
            elif data.startswith("del_backup:"):
                fname = data.replace("del_backup:", "")
                answer_callback(cb_id, "🗑️ Eliminado")
                edit_msg(msg_id, handle_del_backup(fname))

        # ── Comandos de texto ─────────────────────────────────
        elif "message" in update:
            msg     = update["message"]
            text    = msg.get("text", "").strip()
            chat_id = str(msg.get("chat", {}).get("id", ""))

            # Solo el admin autorizado
            if chat_id != str(CHAT_ID):
                tg("sendMessage", {"chat_id": chat_id,
                    "text": "⛔ No autorizado."})
                return jsonify({"ok": True})

            parts = text.split()
            cmd   = parts[0].lower() if parts else ""

            # ── Ayuda ────────────────────────
            if cmd in ("/start", "/inicio"):
                send_msg(MENU_PRINCIPAL)

            elif cmd == "/ayuda":
                if len(parts) > 1:
                    send_msg(build_ayuda_comando(parts[1]))
                else:
                    send_msg(build_ayuda_general())

            # ── Deploy & Sistema ─────────────
            elif cmd == "/status":
                send_msg(handle_status())

            elif cmd == "/version":
                send_msg(handle_version())

            elif cmd == "/rollback":
                text_r, buttons = handle_rollback_list()
                send_msg(text_r, buttons)

            elif cmd == "/logs":
                send_msg(handle_logs(parts))

            elif cmd == "/restart":
                send_msg(handle_restart(parts))

            # ── Tenants ──────────────────────
            elif cmd == "/tenants":
                send_msg(handle_tenants())

            elif cmd == "/tenant":
                send_msg(handle_tenant(parts))

            elif cmd == "/crear":
                send_msg(handle_crear_tenant(parts))

            elif cmd == "/bloquear":
                send_msg(handle_bloquear(parts, "bloquear"))

            elif cmd == "/activar":
                send_msg(handle_bloquear(parts, "activar"))

            elif cmd == "/extender":
                send_msg(handle_extender(parts))

            elif cmd == "/plan":
                send_msg(handle_plan(parts))

            elif cmd == "/eliminar":
                text_e, buttons = handle_eliminar_confirmar(parts)
                send_msg(text_e, buttons)

            # ── Usuarios ─────────────────────
            elif cmd == "/usuarios":
                send_msg(handle_usuarios(parts))

            elif cmd == "/crear-usuario":
                send_msg(handle_crear_usuario(parts))

            elif cmd == "/reset-pass":
                send_msg(handle_reset_pass(parts))

            elif cmd in ("/bloquear-user", "/activar-user"):
                send_msg(handle_user_status(parts, cmd.lstrip("/")))

            # ── Respaldos ────────────────────
            elif cmd == "/backup":
                send_msg("⏳ Generando respaldo, espera...")
                def do_backup():
                    caption, fpath = handle_backup(parts, None)
                    if fpath:
                        send_doc(fpath, caption)
                    else:
                        send_msg(caption)
                threading.Thread(target=do_backup, daemon=True).start()

            elif cmd == "/backups":
                text_b, buttons = handle_backups()
                send_msg(text_b, buttons)

            elif cmd == "/descargar":
                if len(parts) < 2:
                    send_msg("⌨️ Uso: `/descargar [nombre-archivo]`")
                else:
                    fname = parts[1]
                    caption, fpath = handle_descargar(fname)
                    if fpath:
                        send_msg("⏳ Enviando archivo...")
                        threading.Thread(
                            target=send_doc, args=(fpath, caption), daemon=True).start()
                    else:
                        send_msg(caption)

            # ── Métricas ─────────────────────
            elif cmd == "/stats":
                send_msg(handle_stats())

            elif cmd == "/ventas":
                send_msg(handle_ventas(parts))

            elif cmd == "/nuevos":
                send_msg(handle_nuevos())

            elif cmd == "/vencen":
                send_msg(handle_vencen())

            elif cmd == "/disco":
                send_msg(handle_disco())

            elif cmd == "/ram":
                send_msg(handle_ram())

            # ── Multi-Empresa ─────────────────
            elif cmd == "/org":
                send_msg(handle_org(parts))

            # ── Desconocido ───────────────────
            else:
                send_msg(
                    f"❓ Comando `{cmd}` no reconocido.\n\n"
                    "Escribe /ayuda para ver todos los comandos disponibles."
                )

        return jsonify({"ok": True})

    except Exception as e:
        log.exception(f"Error en webhook: {e}")
        return jsonify({"ok": False, "error": str(e)}), 500

if __name__ == "__main__":
    log.info("🤖 Admin Bot iniciando en puerto 5050...")
    app.run(host="0.0.0.0", port=5050, debug=False)
