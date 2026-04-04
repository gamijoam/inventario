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


def handle_crear_tenant(parts):
    """
    /crear [schema] "[nombre]" [email] [password]
    Ejemplo: /crear mitienda "Mi Tienda Lopez" admin@tienda.com Pass123
    """
    if len(parts) < 5:
        return (
            "⌨️ Uso:\n"
            "`/crear [schema] \"[nombre]\" [email] [password]`\n\n"
            "Ejemplo:\n"
            "`/crear mitienda \"Mi Tienda\" admin@tienda.com Pass123`\n\n"
            "⚠️ El schema debe ser único, en minúsculas y sin espacios."
        )

    schema = parts[1].strip().lower()
    raw    = " ".join(parts[2:])
    import re
    m      = re.search(r'\"([^\"]+)\"', raw)
    nombre = m.group(1) if m else parts[2].strip('\"')
    tail   = re.sub(r'\"[^\"]+\"', '', raw).split()
    if len(tail) < 2:
        return "❌ Faltan email o password."
    email, password = tail[-2].strip(), tail[-1].strip()

    # Verificar que no existe
    chk, _ = _psql(f"SELECT id FROM public.tenants WHERE schema_name='{schema}';")
    if chk:
        return f"❌ Ya existe un tenant con schema `{schema}`."

    # Delegar al endpoint del backend -- tiene toda la lógica correcta
    # (crea schema, tablas, usuario, seed completo)
    try:
        # Obtener token del superadmin
        import json as _json, urllib.request as _ur, urllib.parse as _up
        login_data = _up.urlencode({
            "username": "rodriguezisaac876@gmail.com",
            "password": "SuperAdmin2026",
            "grant_type": "password"
        }).encode()
        login_req = _ur.Request(
            "http://172.19.0.3:8000/api/v1/auth/token",
            data=login_data,
            headers={"Content-Type": "application/x-www-form-urlencoded",
                     "Origin": "https://admin.miinventariofacil.com"}
        )
        login_resp = _json.loads(_ur.urlopen(login_req, timeout=15).read())
        token = login_resp.get("access_token", "")
        if not token:
            return f"❌ Error obteniendo token de admin: {login_resp.get('detail', '')}"

        # Llamar al endpoint de creación de tenant
        payload = _json.dumps({
            "name": nombre,
            "schema_name": schema,
            "admin_email": email,
            "admin_password": password,
            "is_demo": False,
            "license_type": "trial",
            "trial_days": 15,
        }).encode()
        create_req = _ur.Request(
            "http://172.19.0.3:8000/api/v1/admin/tenants",
            data=payload,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {token}",
                "Origin": "https://admin.miinventariofacil.com"
            }
        )
        resp_data = _json.loads(_ur.urlopen(create_req, timeout=60).read())
        tenant_id = resp_data.get("id", "?")

        # Extender trial a 15 días directo en BD
        _psql(f"""UPDATE public.tenants
            SET trial_days=15,
                trial_ends_at=NOW() + INTERVAL '15 days'
            WHERE schema_name='{schema}';""")

        # Aplicar migraciones necesarias para los nuevos schemas
        _psql(f"""ALTER TABLE IF EXISTS "{schema}".purchase_orders
            ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(18,4) DEFAULT 0,
            ADD COLUMN IF NOT EXISTS discount_type   VARCHAR(20)   DEFAULT 'NONE',
            ADD COLUMN IF NOT EXISTS discount_notes  TEXT;""")
        _psql(f"""ALTER TABLE IF EXISTS "{schema}".purchase_items
            ADD COLUMN IF NOT EXISTS discount_pct    NUMERIC(10,4) DEFAULT 0,
            ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(18,4) DEFAULT 0,
            ADD COLUMN IF NOT EXISTS subtotal        NUMERIC(18,4);""")

        return (
            f"✅ *Negocio creado exitosamente*\n\n"
            f"🏪 {nombre}\n"
            f"🔑 Schema: `{schema}`\n"
            f"📅 Trial: 15 días\n"
            f"👤 Admin: `{email}`\n"
            f"🔒 Password: `{password}`\n\n"
            f"🌐 URL: `{schema}.miinventariofacil.com`"
        )

    except Exception as e:
        err = str(e)
        # Si es HTTP error, intentar leer el body
        if hasattr(e, 'read'):
            try:
                err = _json.loads(e.read().decode()).get('detail', err)
            except: pass
        return f"❌ Error creando tenant:\n`{err[:300]}`"


