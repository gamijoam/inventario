"""
handlers/usuarios.py
Comandos: /usuarios /crear-usuario /reset-pass /bloquear-user /activar-user
"""
import subprocess, secrets
from passlib.context import CryptContext

pwd_ctx = CryptContext(schemes=["bcrypt"])

def _psql(sql, db="invensoft_prod"):
    r = subprocess.run(
        ["docker", "exec", "db_prod_server",
         "psql", "-U", "postgres", "-d", db, "-t", "-A", "-F", "|", "-c", sql],
        capture_output=True, text=True, timeout=15
    )
    return r.stdout.strip(), r.returncode


ROLES = {"admin": "ADMIN", "cajero": "CASHIER", "almacen": "WAREHOUSE"}


def handle_usuarios(parts):
    if len(parts) < 2:
        return "⌨️ Uso: `/usuarios [schema]`\nEjemplo: `/usuarios oscarcell`"
    schema = parts[1].strip().lower()

    # Obtener tenant_id
    tid_sql = f"SELECT id, name FROM public.tenants WHERE schema_name='{schema}';"
    tid_out, _ = _psql(tid_sql)
    if not tid_out:
        return f"❌ Tenant `{schema}` no encontrado."
    tid, tname = tid_out.split("|")

    sql = f"""
    SELECT username, email, role,
           CASE WHEN is_active THEN 'activo' ELSE 'bloqueado' END
    FROM public.users
    WHERE tenant_id = {tid}
    ORDER BY role DESC;
    """
    out, _ = _psql(sql)
    if not out:
        return f"📭 No hay usuarios en `{schema}`."

    role_icons = {"ADMIN": "👑", "CASHIER": "🧑", "WAREHOUSE": "📦"}
    lines = [f"👥 *Usuarios de {tname}*\n"]
    for row in out.split("\n"):
        if not row.strip(): continue
        parts_r = row.split("|")
        if len(parts_r) < 4: continue
        user, email, role, estado = [p.strip() for p in parts_r]
        icon  = role_icons.get(role, "👤")
        block = "" if estado == "activo" else " 🔴"
        lines.append(f"{icon} `{user}` — {email} — {role}{block}")
    return "\n".join(lines)


def handle_crear_usuario(parts):
    """
    /crear-usuario [schema] [username] [email] [rol]
    """
    if len(parts) < 5:
        return (
            "⌨️ Uso: `/crear-usuario [schema] [username] [email] [rol]`\n\n"
            "Roles: `admin`, `cajero`, `almacen`\n"
            "Ejemplo: `/crear-usuario oscarcell carlos carlos@t.com cajero`"
        )
    schema, username, email, rol = parts[1], parts[2], parts[3], parts[4].lower()
    role = ROLES.get(rol)
    if not role:
        return f"❌ Rol inválido: `{rol}`\nOpciones: admin, cajero, almacen"

    # Obtener tenant_id
    tid_out, _ = _psql(f"SELECT id FROM public.tenants WHERE schema_name='{schema}';")
    if not tid_out:
        return f"❌ Tenant `{schema}` no encontrado."
    tid = tid_out.strip()

    # Contraseña temporal
    temp_pass = secrets.token_urlsafe(10)
    hashed    = pwd_ctx.hash(temp_pass)

    sql = f"""
    INSERT INTO public.users (username, email, hashed_password, role, is_active, tenant_id)
    VALUES ('{username}', '{email}', '{hashed}', '{role}', true, {tid})
    ON CONFLICT (email) DO NOTHING
    RETURNING id;
    """
    out, code = _psql(sql)
    if not out:
        return f"❌ Error creando usuario. ¿Ya existe el email `{email}`?"

    return (
        f"✅ *Usuario creado*\n\n"
        f"👤 `{username}` en `{schema}`\n"
        f"📧 {email}\n"
        f"🎭 Rol: {role}\n\n"
        f"🔑 Contraseña temporal: `{temp_pass}`\n"
        f"_(el usuario debe cambiarla al primer ingreso)_"
    )


def handle_reset_pass(parts):
    if len(parts) < 3:
        return "⌨️ Uso: `/reset-pass [schema] [username]`"
    schema, username = parts[1].strip().lower(), parts[2].strip().lower()

    tid_out, _ = _psql(f"SELECT id FROM public.tenants WHERE schema_name='{schema}';")
    if not tid_out:
        return f"❌ Tenant `{schema}` no encontrado."

    temp_pass = secrets.token_urlsafe(10)
    hashed    = pwd_ctx.hash(temp_pass)

    sql = f"""
    UPDATE public.users
    SET hashed_password = '{hashed}'
    WHERE LOWER(username) = '{username}' AND tenant_id = {tid_out.strip()}
    RETURNING username, email;
    """
    out, _ = _psql(sql)
    if not out:
        return f"❌ Usuario `{username}` no encontrado en `{schema}`."

    u_parts = out.split("|")
    return (
        f"🔑 *Contraseña restablecida*\n\n"
        f"👤 `{u_parts[0].strip()}` — {u_parts[1].strip() if len(u_parts)>1 else ''}\n\n"
        f"Nueva contraseña temporal:\n`{temp_pass}`"
    )


def handle_user_status(parts, accion):
    """bloquear-user / activar-user"""
    if len(parts) < 3:
        return f"⌨️ Uso: `/{accion} [schema] [username]`"
    schema, username = parts[1].strip().lower(), parts[2].strip().lower()

    tid_out, _ = _psql(f"SELECT id FROM public.tenants WHERE schema_name='{schema}';")
    if not tid_out:
        return f"❌ Tenant `{schema}` no encontrado."

    valor = "false" if accion == "bloquear-user" else "true"
    sql = f"""
    UPDATE public.users SET is_active={valor}
    WHERE LOWER(username)='{username}' AND tenant_id={tid_out.strip()}
    RETURNING username;
    """
    out, _ = _psql(sql)
    if not out:
        return f"❌ Usuario `{username}` no encontrado en `{schema}`."

    icon = "🔴" if accion == "bloquear-user" else "🟢"
    accion_txt = "bloqueado" if accion == "bloquear-user" else "activado"
    return f"{icon} Usuario `{out.strip()}` {accion_txt} en `{schema}`."
