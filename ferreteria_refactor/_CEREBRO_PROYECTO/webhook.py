"""
webhook.py — Mi Inventario Deploy Bot
Recibe callbacks de botones inline de Telegram y ejecuta el deploy.
Corre como servicio en el VPS en el puerto 5050 (detrás de Traefik).
"""
import os, json, subprocess, threading, logging, sys
sys.path.insert(0, "/root/deploy/telegram-bot")
from flask import Flask, request, jsonify
import urllib.request
from help import build_ayuda_general, build_ayuda_comando, MENU_PRINCIPAL

logging.basicConfig(level=logging.INFO,
    format='[%(asctime)s] %(levelname)s %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S')
log = logging.getLogger(__name__)

app = Flask(__name__)

# ── Config ────────────────────────────────────────────────────
BOT_TOKEN   = os.environ.get("TELEGRAM_TOKEN", "")
CHAT_ID     = os.environ.get("TELEGRAM_CHAT_ID", "")
DEPLOY_DIR  = "/root/deploy"
WEBHOOK_SECRET = os.environ.get("WEBHOOK_SECRET", "mi-inventario-deploy-2026")

# Versiones pendientes de deploy {version: message_id}
pending = {}

# ── Telegram helpers ──────────────────────────────────────────
def tg(method, data):
    """Llamar a la API de Telegram."""
    try:
        body = json.dumps(data).encode()
        req  = urllib.request.Request(
            f"https://api.telegram.org/bot{BOT_TOKEN}/{method}",
            data=body, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=10) as r:
            return json.loads(r.read())
    except Exception as e:
        log.error(f"Telegram error: {e}")
        return {}

def send_msg(text, buttons=None):
    """Enviar mensaje con botones inline opcionales."""
    data = {"chat_id": CHAT_ID, "text": text, "parse_mode": "Markdown"}
    if buttons:
        data["reply_markup"] = {"inline_keyboard": buttons}
    return tg("sendMessage", data)

def edit_msg(msg_id, text):
    """Editar un mensaje existente (para actualizar el estado)."""
    tg("editMessageText", {
        "chat_id": CHAT_ID, "message_id": msg_id,
        "text": text, "parse_mode": "Markdown"
    })

def answer_callback(callback_id, text=""):
    """Responder al callback para quitar el spinner del botón."""
    tg("answerCallbackQuery", {"callback_query_id": callback_id, "text": text})

# ── Deploy en background ──────────────────────────────────────
def run_deploy(version, msg_id):
    """Ejecuta el deploy en un hilo separado para no bloquear el webhook."""
    log.info(f"Iniciando deploy: {version}")
    edit_msg(msg_id, f"⚙️ *Deployando...*\n\nVersión: `{version}`\n\nEsto tarda ~2 minutos...")

    try:
        # Actualizar el TAG en prod/.env
        subprocess.run(
            ["sed", "-i", f"s/^TAG=.*/TAG={version}/", "/root/deploy/prod/.env"],
            check=True
        )

        # Ejecutar el script de recrear contenedores
        result = subprocess.run(
            ["/bin/bash", "/root/deploy/deploy-containers.sh", version],
            capture_output=True, text=True, timeout=300
        )

        if result.returncode == 0:
            edit_msg(msg_id,
                f"✅ *Deploy exitoso*\n\n"
                f"Versión: `{version}`\n\n"
                f"Todos los servicios funcionando correctamente 🎉"
            )
            log.info(f"Deploy exitoso: {version}")
        else:
            edit_msg(msg_id,
                f"❌ *Deploy fallido*\n\n"
                f"Versión: `{version}`\n\n"
                f"Error:\n```{result.stderr[-300:]}```"
            )
            log.error(f"Deploy falló: {result.stderr}")

    except subprocess.TimeoutExpired:
        edit_msg(msg_id, f"⏱️ *Timeout*\n\nEl deploy de `{version}` tardó demasiado.\nRevisa el VPS manualmente.")
    except Exception as e:
        edit_msg(msg_id, f"❌ *Error inesperado*\n\n`{str(e)}`")
        log.exception(f"Error en deploy: {e}")

    pending.pop(version, None)

# ── Endpoints ─────────────────────────────────────────────────
@app.route("/health")
def health():
    return jsonify({"ok": True, "service": "deploy-bot"})

@app.route(f"/webhook/{WEBHOOK_SECRET}", methods=["POST"])
def webhook():
    """Recibe actualizaciones de Telegram."""
    try:
        update = request.get_json(force=True)
        log.info(f"Update recibido: {json.dumps(update)[:200]}")

        # Callback de botón inline
        if "callback_query" in update:
            cb      = update["callback_query"]
            cb_id   = cb["id"]
            data    = cb.get("data", "")
            msg_id  = cb["message"]["message_id"]
            user    = cb["from"].get("first_name", "alguien")

            # Solo procesar si viene del chat correcto
            if str(cb["message"]["chat"]["id"]) != str(CHAT_ID):
                answer_callback(cb_id, "⛔ No autorizado")
                return jsonify({"ok": True})

            if data.startswith("approve:"):
                version = data.replace("approve:", "")
                answer_callback(cb_id, "✅ Aprobado — iniciando deploy...")
                pending[version] = msg_id
                thread = threading.Thread(
                    target=run_deploy, args=(version, msg_id), daemon=True)
                thread.start()

            elif data.startswith("cancel:"):
                version = data.replace("cancel:", "")
                answer_callback(cb_id, "❌ Deploy cancelado")
                edit_msg(msg_id,
                    f"❌ *Deploy cancelado por {user}*\n\n"
                    f"Versión: `{version}`\n\n"
                    f"Puedes aprobarlo más tarde desde GitHub Actions."
                )

        # Mensaje de texto (comandos del bot)
        elif "message" in update:
            msg      = update["message"]
            text     = msg.get("text", "").strip()
            chat_id  = str(msg.get("chat", {}).get("id", ""))

            # ⛔ Solo el admin puede ejecutar comandos
            if chat_id != str(CHAT_ID):
                tg("sendMessage", {"chat_id": chat_id, "text": "⛔ No autorizado."})
                return jsonify({"ok": True})

            parts = text.split()
            cmd   = parts[0].lower() if parts else ""

            # /start o /ayuda general
            if cmd in ("/start", "/inicio"):
                send_msg(MENU_PRINCIPAL)

            elif cmd == "/ayuda":
                if len(parts) > 1:
                    send_msg(build_ayuda_comando(parts[1]))
                else:
                    send_msg(build_ayuda_general())

            elif cmd == "/status" or text == "/status":
                statuses = []
                for svc in ["backend_prod_server","frontend_prod_server",
                             "db_prod_server","whatsapp_service"]:
                    r = subprocess.run(
                        ["docker","ps","--filter",f"name=^/{svc}$",
                         "--filter","status=running","--format","{{.Names}}"],
                        capture_output=True, text=True)
                    icon = "✅" if svc in r.stdout else "❌"
                    statuses.append(f"{icon} {svc}")
                tag = subprocess.run(
                    ["grep","^TAG=","/root/deploy/prod/.env"],
                    capture_output=True, text=True).stdout.strip()
                send_msg(f"📊 *Estado de producción*\n\n" +
                         "\n".join(statuses) + f"\n\n🏷️ {tag}")

        return jsonify({"ok": True})

    except Exception as e:
        log.exception(f"Error en webhook: {e}")
        return jsonify({"ok": False, "error": str(e)}), 500

if __name__ == "__main__":
    log.info("🤖 Deploy bot iniciando en puerto 5050...")
    app.run(host="0.0.0.0", port=5050, debug=False)
