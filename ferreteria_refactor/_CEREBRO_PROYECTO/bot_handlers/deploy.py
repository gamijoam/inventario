"""
handlers/deploy.py
Comandos: /status /version /rollback /logs /restart
"""
import subprocess, os

DEPLOY_DIR   = "/root/deploy"
HISTORY_FILE = f"{DEPLOY_DIR}/version_history.txt"
ENV_PROD     = f"{DEPLOY_DIR}/prod/.env"

CONTAINERS = {
    "backend":  "backend_prod_server",
    "frontend": "frontend_prod_server",
    "db":       "db_prod_server",
    "whatsapp": "whatsapp_service",
    "landing":  "landing_prod_server",
    "admin":    "admin_panel_prod_server",
}

def _run(cmd, timeout=30):
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    return r.stdout.strip(), r.returncode


def handle_status():
    lines = ["📊 *Estado de producción*\n"]
    for label, svc in CONTAINERS.items():
        out, _ = _run(["docker","ps","--filter",f"name=^/{svc}$",
                        "--filter","status=running","--format","{{.Names}} {{.Status}}"])
        icon = "✅" if out else "❌"
        status = out.split()[-1] if out else "Detenido"
        lines.append(f"{icon} `{label}` — {status}")
    tag, _ = _run(["grep","^TAG=", ENV_PROD])
    lines.append(f"\n🏷️ `{tag}`")
    return "\n".join(lines)


def handle_version():
    tag, _ = _run(["grep","^TAG=", ENV_PROD])
    return f"🏷️ *Versión en producción*\n\n`{tag.replace('TAG=','')}`"


def handle_rollback_list():
    try:
        with open(HISTORY_FILE) as f:
            lines = [l.strip() for l in f if l.strip()]
    except FileNotFoundError:
        return "❌ No hay historial todavía.", []

    current_tag, _ = _run(["grep","^TAG=", ENV_PROD])
    current_tag = current_tag.replace("TAG=","").strip()

    versions, seen = [], set()
    for line in reversed(lines):
        parts = line.split(" ", 2)
        ver   = parts[-1].strip()
        if ver and ver not in seen:
            seen.add(ver)
            versions.append((parts[0] if len(parts) > 1 else "", ver))

    emojis  = ["1️⃣","2️⃣","3️⃣","4️⃣","5️⃣"]
    t_lines = ["📋 *Historial de versiones*\n"]
    buttons = []
    for i, (date, ver) in enumerate(versions[:5]):
        marker = " ← *actual*" if ver == current_tag else ""
        t_lines.append(f"{emojis[i]} `{ver}`{marker}")
        if ver != current_tag:
            buttons.append([{"text": f"{emojis[i]} Rollback aquí",
                             "callback_data": f"rollback:{ver}"}])

    t_lines.append("\n¿A cuál versión quieres regresar?")
    return "\n".join(t_lines), buttons


def handle_rollback_exec(version):
    script = f"{DEPLOY_DIR}/deploy-containers.sh"
    out, code = _run(["bash", script, version], timeout=180)
    if code == 0:
        return f"✅ *Rollback exitoso*\n\n`{version}`"
    return f"❌ *Rollback falló*\n\n```\n{out[-500:]}\n```"


def handle_logs(parts):
    if len(parts) < 2:
        return "⌨️ Uso: `/logs [backend|frontend|db|whatsapp] [lineas]`"
    svc  = CONTAINERS.get(parts[1].lower())
    if not svc:
        return f"❌ Opciones: {', '.join(CONTAINERS.keys())}"
    n = parts[2] if len(parts) >= 3 and parts[2].isdigit() else "30"
    out, _ = _run(["docker","logs", svc,"--tail", n])
    text   = out[-3000:] if len(out) > 3000 else out
    return f"📋 *Logs `{parts[1]}` ({n} líneas)*\n\n```\n{text or 'Sin logs'}\n```"


def handle_restart(parts):
    if len(parts) < 2:
        return "⌨️ Uso: `/restart [backend|frontend|db|all]`"
    target = parts[1].lower()
    if target == "all":
        results = []
        for label, svc in CONTAINERS.items():
            _, code = _run(["docker","restart", svc])
            results.append(f"{'✅' if code==0 else '❌'} `{label}`")
        return "🔄 *Reinicio completo*\n\n" + "\n".join(results)
    svc = CONTAINERS.get(target)
    if not svc:
        return f"❌ `{target}` no encontrado."
    _, code = _run(["docker","restart", svc])
    return f"{'✅' if code==0 else '❌'} `{target}` {'reiniciado' if code==0 else 'falló'}."
