"""
handlers/metrics.py
Comandos: /stats /ventas /nuevos /vencen /disco /ram
"""
import subprocess
from datetime import datetime

def _psql(sql, db="invensoft_prod"):
    r = subprocess.run(
        ["docker","exec","db_prod_server",
         "psql","-U","postgres","-d",db,"-t","-A","-F","|","-c",sql],
        capture_output=True, text=True, timeout=15
    )
    return r.stdout.strip(), r.returncode

def _sh(cmd):
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=10)
    return r.stdout.strip()


def handle_stats():
    sql = """
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE is_active
        AND (trial_ends_at > NOW() OR license_type != 'trial')) AS activos,
      COUNT(*) FILTER (WHERE NOT is_active) AS bloqueados,
      COUNT(*) FILTER (WHERE is_active
        AND trial_ends_at BETWEEN NOW() AND NOW() + INTERVAL '7 days') AS por_vencer
    FROM public.tenants;
    """
    t_out, _ = _psql(sql)
    parts = (t_out.split("|") + ["0","0","0","0"])[:4]
    total, activos, bloqueados, por_vencer = [p.strip() for p in parts]

    # RAM — leer /proc/meminfo desde el host via docker exec
    mem_total = _sh("docker exec db_prod_server sh -c \"grep MemTotal /proc/meminfo | awk '{print $2}'\" 2>/dev/null || cat /proc/meminfo | grep MemTotal | awk '{print $2}'")
    mem_free  = _sh("docker exec db_prod_server sh -c \"grep MemAvailable /proc/meminfo | awk '{print $2}'\" 2>/dev/null || cat /proc/meminfo | grep MemAvailable | awk '{print $2}'")
    try:
        mt = int(mem_total or 0) // 1024
        mf = int(mem_free or 0) // 1024
        mu = mt - mf
        ram_str = f"{mu} MB usados / {mt} MB total ({int(mu/mt*100) if mt else 0}%)"
    except:
        ram_str = "N/D"

    # Disco
    disco = _sh("df -h / | awk 'NR==2{print $3\"/\"$2\" (\"$5\")'")

    # CPU
    cpu = _sh("cat /proc/loadavg | awk '{print $1}'")

    # Estado contenedores
    svcs = {
        "backend":  "backend_prod_server",
        "frontend": "frontend_prod_server",
        "bd":       "db_prod_server",
    }
    svc_st = []
    for label, svc in svcs.items():
        r = _sh(f"docker ps --filter name=^/{svc}$ --filter status=running --format '{{{{.Names}}}}'")
        svc_st.append(f"{label}:{'🟢' if r else '🔴'}")

    return (
        f"📊 *Mi Inventario Fácil*\n"
        f"_{datetime.now().strftime('%d/%m/%Y %H:%M')}_\n\n"
        f"🏪 *Tenants:* {total} total\n"
        f"   ✅ Activos: {activos} | 🔴 Bloqueados: {bloqueados}\n"
        f"   ⚠️ Vencen pronto: {por_vencer}\n\n"
        f"🔧 *Sistema*\n"
        f"   💾 Disco: {disco}\n"
        f"   🧠 RAM: {ram_str}\n"
        f"   ⚡ Load: {cpu}\n"
        f"   {' | '.join(svc_st)}"
    )


def handle_ventas(parts):
    if len(parts) < 2:
        return "⌨️ Uso: `/ventas [schema]`\nEjemplo: `/ventas oscarcell`"
    schema = parts[1].strip().lower()
    sql = f"""
    SELECT
        COUNT(*) FILTER (WHERE date::date = CURRENT_DATE)               AS hoy_n,
        COALESCE(SUM(total_amount) FILTER (WHERE date::date = CURRENT_DATE), 0) AS hoy_m,
        COUNT(*) FILTER (WHERE date >= date_trunc('month', NOW()))       AS mes_n,
        COALESCE(SUM(total_amount) FILTER (WHERE date >= date_trunc('month', NOW())), 0) AS mes_m
    FROM "{schema}".sales WHERE status != 'VOIDED';
    """
    out, code = _psql(sql)
    if code != 0 or not out:
        return f"❌ Error obteniendo ventas de `{schema}`."
    p = (out.split("|") + ["0","0","0","0"])[:4]
    hn, hm, mn, mm = [x.strip() for x in p]
    return (
        f"💰 *Ventas de `{schema}`*\n\n"
        f"📅 Hoy: {hn} venta(s) — *${float(hm):.2f}*\n"
        f"📆 Este mes: {mn} venta(s) — *${float(mm):.2f}*"
    )


def handle_nuevos():
    sql = """
    SELECT schema_name, name, to_char(created_at,'DD/Mon'), license_type
    FROM public.tenants
    WHERE created_at >= NOW() - INTERVAL '7 days'
    ORDER BY created_at DESC;
    """
    out, _ = _psql(sql)
    if not out:
        return "📭 Sin nuevos negocios en los últimos 7 días."
    lines = ["🆕 *Nuevos negocios (últimos 7 días)*\n"]
    for row in out.split("\n"):
        if not row.strip(): continue
        p = row.split("|")
        if len(p) < 4: continue
        schema, name, fecha, plan = [x.strip() for x in p]
        lines.append(f"• `{schema}` — {name} — {fecha} — {plan}")
    return "\n".join(lines)


def handle_vencen():
    sql = """
    SELECT schema_name, name,
           to_char(trial_ends_at,'DD/Mon/YYYY'),
           EXTRACT(DAY FROM trial_ends_at - NOW())::int AS dias
    FROM public.tenants
    WHERE is_active = true
      AND license_type = 'trial'
      AND trial_ends_at BETWEEN NOW() AND NOW() + INTERVAL '7 days'
    ORDER BY trial_ends_at ASC;
    """
    out, _ = _psql(sql)
    if not out:
        return "✅ Ningún negocio vence en los próximos 7 días."
    lines = ["⚠️ *Vencen en 7 días*\n"]
    for row in out.split("\n"):
        if not row.strip(): continue
        p = row.split("|")
        if len(p) < 4: continue
        schema, name, fecha, dias = [x.strip() for x in p]
        icon = "🔴" if int(dias or 0) <= 2 else "🟡"
        lines.append(f"{icon} `{schema}` — {name} — *{dias} días* ({fecha})")
    lines.append("\n_Usa /extender [schema] [dias] para ampliar._")
    return "\n".join(lines)


def handle_disco():
    # Usar /proc/mounts y stat para no depender de df del contenedor
    disco = _sh("df -h / 2>/dev/null | awk 'NR==2{printf \"%s/%s (%s)\", $3,$2,$5}'")
    backups = _sh("du -sh /root/backups 2>/dev/null | awk '{print $1}'") or "0"
    docker_sz = _sh("du -sh /var/lib/docker 2>/dev/null | awk '{print $1}'") or "N/D"
    return (
        f"💾 *Uso del disco*\n\n"
        f"📁 Raíz (/): `{disco}`\n"
        f"🐳 Docker: `{docker_sz}`\n"
        f"🗄️ Respaldos: `{backups}`"
    )


def handle_ram():
    # Leer directamente /proc/meminfo del host
    try:
        with open('/proc/meminfo') as f:
            meminfo = {line.split(':')[0]: line.split(':')[1].strip()
                       for line in f if ':' in line}
        total = int(meminfo.get('MemTotal','0 kB').split()[0]) // 1024
        avail = int(meminfo.get('MemAvailable','0 kB').split()[0]) // 1024
        used  = total - avail
        pct   = int(used / total * 100) if total else 0
        swap_t = int(meminfo.get('SwapTotal','0 kB').split()[0]) // 1024
        swap_u = int(meminfo.get('SwapFree','0 kB').split()[0]) // 1024
        swap_u = swap_t - swap_u
        return (
            f"🧠 *Memoria RAM*\n\n"
            f"Total:     `{total} MB`\n"
            f"Usada:     `{used} MB` ({pct}%)\n"
            f"Disponible:`{avail} MB`\n"
            f"{'─'*20}\n"
            f"Swap total: `{swap_t} MB`\n"
            f"Swap usada: `{swap_u} MB`"
        )
    except Exception as e:
        # Fallback: leer desde el host via docker exec
        out = _sh("cat /proc/meminfo | grep -E 'MemTotal|MemAvailable|SwapTotal|SwapFree'")
        return f"🧠 *Memoria RAM*\n\n```\n{out}\n```" if out else f"❌ Error: {e}"
