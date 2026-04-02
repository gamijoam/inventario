"""
handlers/metrics.py
Comandos: /stats /ventas /nuevos /vencen /disco /ram
"""
import subprocess
from datetime import datetime

def _psql(sql, db="invensoft_prod"):
    r = subprocess.run(
        ["docker", "exec", "db_prod_server",
         "psql", "-U", "postgres", "-d", db, "-t", "-A", "-F", "|", "-c", sql],
        capture_output=True, text=True, timeout=15
    )
    return r.stdout.strip(), r.returncode


def _run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=10, shell=isinstance(cmd, str))
    return r.stdout.strip()


def handle_stats():
    # Tenants
    sql_tenants = """
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE is_active AND (trial_ends_at > NOW() OR license_type != 'trial')) AS activos,
      COUNT(*) FILTER (WHERE NOT is_active) AS bloqueados,
      COUNT(*) FILTER (WHERE is_active AND trial_ends_at BETWEEN NOW() AND NOW() + INTERVAL '7 days') AS por_vencer
    FROM public.tenants;
    """
    t_out, _ = _psql(sql_tenants)
    total, activos, bloqueados, por_vencer = (t_out.split("|") + ["0","0","0","0"])[:4]

    # Ventas de hoy (suma de todos los tenants es complejo, mostrar total de schemas)
    sql_ventas = """
    SELECT COUNT(*), COALESCE(SUM(total_amount),0) FROM (
        SELECT 'placeholder'::text, 0::numeric LIMIT 0
    ) q;
    """

    # Sistema
    disco  = _run("df -h / | awk 'NR==2{print $3\"/\"$2\" (\"$5\")\"}'")
    ram    = _run("free -h | awk 'NR==2{print $3\"/\"$2}'")
    cpu    = _run("top -bn1 | grep 'Cpu' | awk '{print $2}' | cut -d. -f1")

    # Estado contenedores
    svcs = ["backend_prod_server","frontend_prod_server","db_prod_server"]
    svc_status = []
    for s in svcs:
        r = _run(f"docker ps --filter name=^/{s}$ --filter status=running --format '{{{{.Names}}}}'")
        label = s.replace("_prod_server","").replace("_prod","")
        svc_status.append(f"{label}: {'🟢' if r else '🔴'}")

    return (
        f"📊 *Mi Inventario Fácil*\n"
        f"_{datetime.now().strftime('%d/%m/%Y %H:%M')}_\n\n"
        f"🏪 *Tenants:* {total.strip()} total\n"
        f"   ✅ Activos: {activos.strip()} | "
        f"🔴 Bloqueados: {bloqueados.strip()}\n"
        f"   ⚠️ Vencen en 7 días: {por_vencer.strip()}\n\n"
        f"🔧 *Sistema*\n"
        f"   💾 Disco: {disco}\n"
        f"   🧠 RAM: {ram}\n"
        f"   ⚡ CPU: {cpu}%\n"
        f"   {' | '.join(svc_status)}"
    )


def handle_ventas(parts):
    if len(parts) < 2:
        return "⌨️ Uso: `/ventas [schema]`\nEjemplo: `/ventas oscarcell`"
    schema = parts[1].strip().lower()

    sql = f"""
    SELECT
        COUNT(*) FILTER (WHERE date::date = CURRENT_DATE) AS hoy_n,
        COALESCE(SUM(total_amount) FILTER (WHERE date::date = CURRENT_DATE), 0) AS hoy_monto,
        COUNT(*) FILTER (WHERE date >= date_trunc('month', NOW())) AS mes_n,
        COALESCE(SUM(total_amount) FILTER (WHERE date >= date_trunc('month', NOW())), 0) AS mes_monto
    FROM "{schema}".sales WHERE status != 'VOIDED';
    """
    out, code = _psql(sql)
    if code != 0 or not out:
        return f"❌ Error obteniendo ventas de `{schema}`."

    parts_r = out.split("|")
    if len(parts_r) < 4:
        return f"❌ Sin datos para `{schema}`."

    hn, hm, mn, mm = [p.strip() for p in parts_r]
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
        parts_r = row.split("|")
        if len(parts_r) < 4: continue
        schema, name, fecha, plan = [p.strip() for p in parts_r]
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

    lines = ["⚠️ *Vencen en los próximos 7 días*\n"]
    for row in out.split("\n"):
        if not row.strip(): continue
        parts_r = row.split("|")
        if len(parts_r) < 4: continue
        schema, name, fecha, dias = [p.strip() for p in parts_r]
        urgencia = "🔴" if int(dias or 0) <= 2 else "🟡"
        lines.append(f"{urgencia} `{schema}` — {name} — vence en *{dias} días* ({fecha})")

    lines.append("\nUsa `/extender [schema] [dias]` para ampliar el período.")
    return "\n".join(lines)


def handle_disco():
    out = _run("df -h")
    lines = ["💾 *Uso del disco*\n```\n"]
    for line in out.split("\n"):
        if "/" in line and ("/" == line.split()[-1] or "docker" in line or "backup" in line.lower()):
            lines.append(line)
    lines.append("```")
    return "\n".join(lines)


def handle_ram():
    out = _run("free -h")
    return f"🧠 *Memoria RAM*\n\n```\n{out}\n```"
