"""
handlers/tenants.py
Comandos: /tenants /tenant /crear /bloquear /activar /extender /plan /eliminar
"""
import subprocess, os, secrets, hashlib
from datetime import datetime, timedelta

DB_URL = None  # Se inicializa en runtime desde .env

def _psql(sql, db="invensoft_prod"):
    """Ejecuta SQL en la BD de producción."""
    r = subprocess.run(
        ["docker", "exec", "db_prod_server",
         "psql", "-U", "postgres", "-d", db, "-t", "-A", "-F", "|", "-c", sql],
        capture_output=True, text=True, timeout=15
    )
    return r.stdout.strip(), r.returncode


def handle_tenants():
    """Lista todos los tenants con estado."""
    sql = """
    SELECT schema_name, name,
           license_type,
           CASE WHEN trial_ends_at IS NULL THEN 'sin fecha'
                ELSE to_char(trial_ends_at, 'DD/Mon') END AS vence,
           CASE WHEN NOT is_active THEN 'bloqueado'
                WHEN trial_ends_at < NOW() AND license_type='trial' THEN 'expirado'
                ELSE 'activo' END AS estado,
           (SELECT COUNT(*) FROM public.users u WHERE u.tenant_id = t.id) AS usuarios
    FROM public.tenants t
    ORDER BY is_active DESC, created_at DESC;
    """
    out, code = _psql(sql)
    if code != 0 or not out:
        return "❌ Error obteniendo tenants."

    lines = ["🏪 *Negocios registrados*\n"]
    total = activos = bloqueados = 0
    for row in out.split("\n"):
        if not row.strip(): continue
        parts = row.split("|")
        if len(parts) < 6: continue
        schema, name, plan, vence, estado, users = [p.strip() for p in parts]
        total += 1
        icon = "🟢" if estado == "activo" else "⏳" if estado == "expirado" else "🔴"
        if estado == "activo": activos += 1
        else: bloqueados += 1
        lines.append(f"{icon} `{schema}` — {name} | {plan} | vence {vence} | 👥{users}")

    lines.insert(1, f"Total: {total} | ✅ {activos} activos | 🔴 {bloqueados} inactivos\n")
    return "\n".join(lines)


def handle_tenant(parts):
    """Detalle de un tenant específico."""
    if len(parts) < 2:
        return "⌨️ Uso: `/tenant [schema]`\nEjemplo: `/tenant oscarcell`"

    schema = parts[1].strip().lower()
    sql = f"""
    SELECT t.name, t.schema_name, t.license_type,
           t.trial_ends_at, t.is_active, t.created_at,
           (SELECT COUNT(*) FROM public.users u WHERE u.tenant_id = t.id) AS usuarios,
           (SELECT COUNT(*) FROM public.users u WHERE u.tenant_id = t.id AND u.role='ADMIN') AS admins
    FROM public.tenants t WHERE t.schema_name = '{schema}';
    """
    out, code = _psql(sql)
    if not out:
        return f"❌ Tenant `{schema}` no encontrado."

    parts_row = out.split("|")
    if len(parts_row) < 8:
        return "❌ Error al obtener datos."

    name, sch, plan, vence, activo, creado, users, admins = [p.strip() for p in parts_row]
    estado = "🟢 Activo" if activo == "t" else "🔴 Bloqueado"

    # Ventas del mes (si hay datos)
    ventas_sql = f"""
    SELECT COUNT(*), COALESCE(SUM(total_amount),0)
    FROM "{schema}".sales
    WHERE date >= date_trunc('month', NOW()) AND status != 'VOIDED';
    """
    ventas_out, _ = _psql(ventas_sql)
    ventas_parts = ventas_out.split("|") if ventas_out else ["0","0"]
    num_ventas = ventas_parts[0].strip() if ventas_parts else "0"
    monto_ventas = ventas_parts[1].strip() if len(ventas_parts) > 1 else "0"

    # Productos
    prod_sql = f"SELECT COUNT(*) FROM \"{schema}\".products WHERE is_active=true;"
    prod_out, _ = _psql(prod_sql)

    dias_restantes = ""
    if vence and vence != "None":
        try:
            vence_dt = datetime.fromisoformat(vence.split(".")[0])
            diff = (vence_dt - datetime.now()).days
            dias_restantes = f" ({diff} días)" if diff >= 0 else f" (**EXPIRADO** hace {abs(diff)} días)"
        except: pass

    return (
        f"🏪 *{name}*\n"
        f"🔑 Schema: `{schema}`\n"
        f"📅 Plan: `{plan}` — vence {vence[:10] if vence else 'N/A'}{dias_restantes}\n"
        f"📊 Estado: {estado}\n"
        f"👥 Usuarios: {users} ({admins} admin)\n"
        f"💰 Ventas este mes: {num_ventas} ventas — ${float(monto_ventas or 0):.2f}\n"
        f"📦 Productos activos: {prod_out.strip()}\n"
        f"📆 Creado: {creado[:10] if creado else 'N/A'}"
    )


def handle_bloquear(parts, accion="bloquear"):
    if len(parts) < 2:
        return f"⌨️ Uso: `/{accion} [schema]`"
    schema = parts[1].strip().lower()
    valor  = "false" if accion == "bloquear" else "true"
    sql    = f"UPDATE public.tenants SET is_active={valor} WHERE schema_name='{schema}' RETURNING name;"
    out, code = _psql(sql)
    if not out:
        return f"❌ Tenant `{schema}` no encontrado."
    icon = "🔴" if accion == "bloquear" else "🟢"
    return f"{icon} *Tenant {'bloqueado' if accion == 'bloquear' else 'activado'}*\n\n`{schema}` — {out.strip()}"


def handle_extender(parts):
    if len(parts) < 3 or not parts[2].isdigit():
        return "⌨️ Uso: `/extender [schema] [dias]`\nEjemplo: `/extender oscarcell 15`"
    schema = parts[1].strip().lower()
    dias   = int(parts[2])
    sql = f"""
    UPDATE public.tenants
    SET trial_ends_at = GREATEST(COALESCE(trial_ends_at, NOW()), NOW()) + INTERVAL '{dias} days'
    WHERE schema_name = '{schema}'
    RETURNING name, to_char(trial_ends_at, 'DD/Mon/YYYY');
    """
    out, code = _psql(sql)
    if not out:
        return f"❌ Tenant `{schema}` no encontrado."
    parts_out = out.split("|")
    name  = parts_out[0].strip()
    nueva = parts_out[1].strip() if len(parts_out) > 1 else "N/A"
    return f"📅 *Trial extendido*\n\n`{schema}` — {name}\nNueva fecha: *{nueva}*"


def handle_plan(parts):
    if len(parts) < 3:
        return "⌨️ Uso: `/plan [schema] [trial|pro|enterprise]`"
    schema = parts[1].strip().lower()
    plan   = parts[2].strip().lower()
    if plan not in ("trial", "pro", "enterprise"):
        return "❌ Planes válidos: `trial`, `pro`, `enterprise`"
    sql = f"UPDATE public.tenants SET license_type='{plan}' WHERE schema_name='{schema}' RETURNING name;"
    out, code = _psql(sql)
    if not out:
        return f"❌ Tenant `{schema}` no encontrado."
    return f"💼 *Plan actualizado*\n\n`{schema}` — {out.strip()}\nNuevo plan: `{plan}`"


def handle_eliminar_confirmar(parts):
    """Primer paso: pide confirmación con botones."""
    if len(parts) < 2:
        return "⌨️ Uso: `/eliminar [schema]`", []
    schema = parts[1].strip().lower()

    # Verificar que existe
    sql = f"SELECT name FROM public.tenants WHERE schema_name='{schema}';"
    out, _ = _psql(sql)
    if not out:
        return f"❌ Tenant `{schema}` no encontrado.", []

    text = (
        f"⚠️ *¿Eliminar `{schema}`?*\n\n"
        f"Negocio: *{out.strip()}*\n\n"
        f"Esta acción eliminará TODOS sus datos permanentemente y no se puede deshacer.\n\n"
        f"¿Confirmas?"
    )
    buttons = [[
        {"text": f"🗑️ Sí, eliminar {schema}", "callback_data": f"eliminar_confirm:{schema}"},
        {"text": "❌ Cancelar",                "callback_data": f"eliminar_cancel:{schema}"},
    ]]
    return text, buttons


def handle_eliminar_exec(schema):
    """Ejecuta la eliminación definitiva."""
    # Eliminar schema del tenant
    sql_drop   = f"DROP SCHEMA IF EXISTS \"{schema}\" CASCADE;"
    sql_users  = f"DELETE FROM public.users WHERE tenant_id = (SELECT id FROM public.tenants WHERE schema_name='{schema}');"
    sql_tenant = f"DELETE FROM public.tenants WHERE schema_name='{schema}' RETURNING name;"

    _psql(sql_drop)
    _psql(sql_users)
    out, code = _psql(sql_tenant)

    if code == 0 and out:
        return f"🗑️ *Tenant eliminado*\n\n`{schema}` — {out.strip()}\n\nTodos sus datos han sido eliminados."
    return f"❌ Error eliminando `{schema}`."
