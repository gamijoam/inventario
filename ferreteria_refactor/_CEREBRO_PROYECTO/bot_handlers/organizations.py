"""
bot_handlers/organizations.py
Sistema Multi-Empresa — Comandos del bot de Telegram

Comandos disponibles (todos con /org [subcomando]):
    /org listar                        — Ver todas las organizaciones
    /org detalle [id]                  — Detalle completo de una org
    /org crear [nombre] [email_dueño]  — Crear nueva organización
    /org plan [id] [duo|multi|ent]     — Cambiar plan de una org
    /org precio [id] [monto]           — Fijar precio mensual
    /org agregar [id] [schema]         — Agregar empresa al grupo
    /org quitar [id] [schema]          — Quitar empresa del grupo
    /org wa [id] [on|off] [instancia?] — Configurar WhatsApp compartido
    /org bloquear [id]                 — Desactivar organización
    /org activar [id]                  — Activar organización

Planes: duo (2 empresas) | multi (5) | enterprise (ilimitadas)
"""

import subprocess
from datetime import datetime


# ─── Helper SQL ───────────────────────────────────────────────────────────────

def _psql(sql, db="invensoft_prod"):
    """Ejecuta SQL en la BD de producción via docker exec."""
    r = subprocess.run(
        ["docker","exec","db_prod_server",
         "psql","-U","postgres","-d",db,"-t","-A","-F","|","-c",sql],
        capture_output=True, text=True, timeout=15
    )
    return r.stdout.strip(), r.returncode


# ── Planes disponibles ─────────────────────────────────────────────────────────
PLANES = {
    "duo"       : {"max_tenants": 2,   "label": "🤝 Dúo (2 empresas)"},
    "multi"     : {"max_tenants": 5,   "label": "🏢 Multi (5 empresas)"},
    "enterprise": {"max_tenants": 999, "label": "👑 Enterprise (ilimitadas)"},
    "ent"       : {"max_tenants": 999, "label": "👑 Enterprise (ilimitadas)"},
}


# ─── Router principal ─────────────────────────────────────────────────────────

def handle_org(parts: list) -> str:
    """
    Punto de entrada para /org.
    parts[0] = '/org', parts[1] = subcomando, parts[2:] = argumentos
    """
    if len(parts) < 2:
        return _ayuda()

    sub  = parts[1].lower()
    args = parts[2:]

    routes = {
        "listar"  : _listar,
        "detalle" : _detalle,
        "crear"   : _crear,
        "plan"    : _plan,
        "precio"  : _precio,
        "agregar" : _agregar,
        "quitar"  : _quitar,
        "wa"      : _whatsapp,
        "bloquear": _bloquear,
        "activar" : _activar,
    }

    fn = routes.get(sub)
    if not fn:
        return f"❓ Subcomando desconocido: *{sub}*\n\n{_ayuda()}"

    try:
        return fn(args)
    except Exception as e:
        return f"❌ Error en /org {sub}: `{str(e)[:200]}`"


# ─── Ayuda ────────────────────────────────────────────────────────────────────

def _ayuda() -> str:
    return (
        "🏢 *Comandos Multi-Empresa:*\n\n"
        "`/org listar` — Ver todas las orgs\n"
        "`/org detalle [id]` — Detalle de una org\n"
        "`/org crear [nombre] [email]` — Crear org\n"
        "`/org plan [id] [duo|multi|enterprise]` — Cambiar plan\n"
        "`/org precio [id] [monto]` — Fijar precio mensual\n"
        "`/org agregar [id] [schema]` — Agregar empresa\n"
        "`/org quitar [id] [schema]` — Quitar empresa\n"
        "`/org wa [id] [on|off] [instancia?]` — WhatsApp compartido\n"
        "`/org bloquear [id]` — Desactivar org\n"
        "`/org activar [id]` — Activar org\n\n"
        "_Planes: duo · multi · enterprise_"
    )


# ─── Subcomandos ──────────────────────────────────────────────────────────────

def _listar(args: list) -> str:
    """Lista todas las organizaciones con sus métricas."""
    sql = """
    SELECT
        o.id, o.name, o.plan, o.is_active,
        o.owner_email, o.plan_price,
        o.use_shared_whatsapp,
        COUNT(DISTINCT t.id)   AS tenants,
        COUNT(DISTINCT m.id)   AS members
    FROM public.organizations o
    LEFT JOIN public.tenants t ON t.organization_id = o.id
    LEFT JOIN public.organization_users m ON m.organization_id = o.id
    GROUP BY o.id
    ORDER BY o.created_at DESC
    """
    out, rc = _psql(sql)
    if rc != 0 or not out.strip():
        return "📭 No hay organizaciones registradas."

    lines = ["🏢 *Organizaciones Multi-Empresa:*\n"]
    for row in out.split('\n'):
        if not row.strip() or '|' not in row:
            continue
        p = row.split('|')
        if len(p) < 9:
            continue
        oid, name, plan, active, email, price, wa, tenants, members = p[:9]
        status  = "✅" if active == "t" else "🔴"
        wa_icon = " 📱" if wa == "t" else ""
        precio  = f" · ${float(price):.0f}/mes" if price and float(price) > 0 else ""
        lines.append(
            f"{status} *#{oid} {name}*{wa_icon}\n"
            f"   Plan: `{plan}`{precio} · 🏪 {tenants} empresa(s) · 👥 {members} miembro(s)\n"
            f"   `{email}`"
        )
    return "\n".join(lines) if len(lines) > 1 else "📭 Sin organizaciones."


def _detalle(args: list) -> str:
    """Muestra detalle completo de una organización."""
    if not args:
        return "❌ Uso: `/org detalle [id]`"
    try:
        oid = int(args[0])
    except ValueError:
        return "❌ El ID debe ser un número."

    # Info de la org
    out, rc = _psql(
        f"SELECT id,name,slug,owner_email,owner_name,plan,max_tenants,"
        f"is_active,plan_price,use_shared_whatsapp,whatsapp_instance,plan_expires_at "
        f"FROM public.organizations WHERE id={oid}"
    )
    if rc != 0 or not out.strip() or '|' not in out:
        return f"❌ No existe la organización #{oid}."

    p = out.split('|')
    name     = p[1]; slug    = p[2]; email   = p[3]
    owner    = p[4]; plan    = p[5]; max_t   = p[6]
    active   = p[7]; price   = p[8]; wa      = p[9]
    wa_inst  = p[10]; expires = p[11]

    # Empresas del grupo
    t_out, _ = _psql(
        f"SELECT schema_name, name, is_active FROM public.tenants "
        f"WHERE organization_id={oid} ORDER BY name"
    )
    tenants_lines = []
    for row in (t_out or "").split('\n'):
        if '|' in row:
            tp = row.split('|')
            ico = "✅" if len(tp) > 2 and tp[2] == "t" else "🔴"
            tenants_lines.append(f"  {ico} `{tp[0]}` — {tp[1]}")

    # Miembros
    m_out, _ = _psql(
        f"SELECT user_email, role, can_switch FROM public.organization_users "
        f"WHERE organization_id={oid} ORDER BY role"
    )
    member_lines = []
    for row in (m_out or "").split('\n'):
        if '|' in row:
            mp = row.split('|')
            sw = "🔄" if len(mp) > 2 and mp[2] == "t" else ""
            member_lines.append(f"  • `{mp[0]}` [{mp[1]}] {sw}")

    lines = [
        f"🏢 *Organización #{oid}: {name}*\n",
        f"🔗 Slug: `{slug}`",
        f"👤 Owner: `{email}`" + (f" ({owner})" if owner else ""),
        f"📦 Plan: `{plan}` (máx. {max_t} empresas)",
        f"💰 Precio: `${float(price or 0):.2f}/mes`",
        f"📱 WA compartido: {'✅ ' + (wa_inst or 'sin instancia') if wa == 't' else '❌ No'}",
        f"🔐 Estado: {'✅ Activa' if active == 't' else '🔴 Inactiva'}",
    ]
    if expires and expires != "":
        lines.append(f"📅 Vence: `{expires[:10]}`")

    if tenants_lines:
        lines.append(f"\n🏪 *Empresas ({len(tenants_lines)}):*")
        lines += tenants_lines
    else:
        lines.append("\n🏪 Sin empresas asignadas")

    if member_lines:
        lines.append(f"\n👥 *Miembros ({len(member_lines)}):*")
        lines += member_lines

    return "\n".join(lines)


def _crear(args: list) -> str:
    """Crea una nueva organización."""
    if len(args) < 2:
        return (
            "❌ Uso: `/org crear [nombre] [email_dueño]`\n"
            "Ejemplo: `/org crear Grupo Rodriguez admin@empresa.com`\n\n"
            "_Si el nombre tiene espacios, el email siempre va al final._"
        )

    owner_email = args[-1].strip()
    name        = " ".join(args[:-1]).strip().strip("'\"")

    if "@" not in owner_email or "." not in owner_email:
        return "❌ El último argumento debe ser un email válido."

    # Generar slug
    import re
    slug = re.sub(r'[^a-z0-9]+', '-', name.lower().strip()).strip('-')[:80]

    # Verificar duplicado
    exists, _ = _psql(
        f"SELECT id FROM public.organizations "
        f"WHERE slug='{slug}' OR owner_email='{owner_email.lower()}'"
    )
    if exists.strip():
        return f"⚠️ Ya existe una organización con ese nombre o email (ID: {exists.strip()})."

    # Insertar organización
    out, rc = _psql(
        f"INSERT INTO public.organizations (name,slug,owner_email,plan,max_tenants,is_active) "
        f"VALUES ('{name}','{slug}','{owner_email.lower()}','multi',5,true) RETURNING id"
    )
    if rc != 0 or not out.strip():
        return "❌ Error al crear la organización. Revisa los logs."

    new_id = out.strip()

    # Agregar owner como miembro
    _psql(
        f"INSERT INTO public.organization_users "
        f"(organization_id,user_email,role,can_switch,accepted_at) "
        f"VALUES ({new_id},'{owner_email.lower()}','owner',true,NOW())"
    )

    return (
        f"✅ *Organización creada exitosamente*\n\n"
        f"🆔 ID: `{new_id}`\n"
        f"🏢 Nombre: `{name}`\n"
        f"🔗 Slug: `{slug}`\n"
        f"📦 Plan: `multi` (5 empresas)\n"
        f"👤 Owner: `{owner_email}`\n\n"
        f"▶️ Próximo paso:\n"
        f"`/org agregar {new_id} [schema_empresa]`"
    )


def _plan(args: list) -> str:
    """Cambia el plan de una organización."""
    if len(args) < 2:
        return "❌ Uso: `/org plan [id] [duo|multi|enterprise]`"
    try:
        oid = int(args[0])
    except ValueError:
        return "❌ El ID debe ser un número."

    plan_key = args[1].lower()
    if plan_key not in PLANES:
        return f"❌ Plan inválido. Opciones: `duo`, `multi`, `enterprise`"

    plan_data = PLANES[plan_key]
    plan_name = "enterprise" if plan_key == "ent" else plan_key
    max_t     = plan_data["max_tenants"]

    # Verificar que la org existe
    org_out, _ = _psql(f"SELECT name FROM public.organizations WHERE id={oid}")
    if not org_out.strip():
        return f"❌ Organización #{oid} no encontrada."
    org_name = org_out.strip()

    _, rc = _psql(
        f"UPDATE public.organizations "
        f"SET plan='{plan_name}', max_tenants={max_t} "
        f"WHERE id={oid}"
    )
    if rc != 0:
        return "❌ Error al actualizar el plan."

    return (
        f"✅ *Plan actualizado*\n\n"
        f"🏢 Org: *{org_name}*\n"
        f"📦 Nuevo plan: {plan_data['label']}\n"
        f"🏪 Máx. empresas: `{max_t}`"
    )


def _precio(args: list) -> str:
    """Fija el precio mensual de una organización."""
    if len(args) < 2:
        return "❌ Uso: `/org precio [id] [monto_usd]`\nEjemplo: `/org precio 1 29.99`"
    try:
        oid   = int(args[0])
        price = float(args[1])
    except ValueError:
        return "❌ ID y monto deben ser números."

    org_out, _ = _psql(f"SELECT name FROM public.organizations WHERE id={oid}")
    if not org_out.strip():
        return f"❌ Organización #{oid} no encontrada."

    _, rc = _psql(f"UPDATE public.organizations SET plan_price={price} WHERE id={oid}")
    if rc != 0:
        return "❌ Error al actualizar el precio."

    return f"✅ Precio actualizado para *{org_out.strip()}*: `${price:.2f}/mes`"


def _agregar(args: list) -> str:
    """Agrega una empresa (tenant) a una organización."""
    if len(args) < 2:
        return "❌ Uso: `/org agregar [id] [schema]`"
    try:
        oid = int(args[0])
    except ValueError:
        return "❌ El ID debe ser un número."

    schema = args[1].lower().strip()

    # Verificar org y límite
    org_out, _ = _psql(
        f"SELECT name, max_tenants, "
        f"(SELECT COUNT(*) FROM public.tenants WHERE organization_id={oid}) "
        f"FROM public.organizations WHERE id={oid}"
    )
    if not org_out.strip() or '|' not in org_out:
        return f"❌ Organización #{oid} no encontrada."

    parts  = org_out.split('|')
    org_name = parts[0]; max_t = int(parts[1]); current = int(parts[2])
    if current >= max_t:
        return (
            f"⚠️ Límite del plan alcanzado ({current}/{max_t}).\n"
            f"Actualiza el plan con `/org plan {oid} enterprise`"
        )

    # Verificar tenant
    t_out, _ = _psql(
        f"SELECT id, name, organization_id FROM public.tenants WHERE schema_name='{schema}'"
    )
    if not t_out.strip() or '|' not in t_out:
        return f"❌ No existe empresa con schema `{schema}`."

    tp = t_out.split('|')
    if tp[2] and tp[2] != str(oid):
        return f"⚠️ La empresa `{schema}` ya pertenece a la org #{tp[2]}."

    _, rc = _psql(f"UPDATE public.tenants SET organization_id={oid} WHERE schema_name='{schema}'")
    if rc != 0:
        return "❌ Error al agregar la empresa."

    return f"✅ Empresa `{schema}` (*{tp[1]}*) agregada a *{org_name}*"


def _quitar(args: list) -> str:
    """Quita una empresa de su organización."""
    if len(args) < 2:
        return "❌ Uso: `/org quitar [id] [schema]`"
    try:
        oid = int(args[0])
    except ValueError:
        return "❌ El ID debe ser un número."

    schema = args[1].lower().strip()
    t_out, _ = _psql(
        f"SELECT id, name FROM public.tenants "
        f"WHERE schema_name='{schema}' AND organization_id={oid}"
    )
    if not t_out.strip():
        return f"❌ La empresa `{schema}` no está en la org #{oid}."

    tp = t_out.split('|')
    _, rc = _psql(f"UPDATE public.tenants SET organization_id=NULL WHERE schema_name='{schema}'")
    if rc != 0:
        return "❌ Error al quitar la empresa."

    return f"✅ Empresa `{schema}` (*{tp[1]}*) removida de la org #{oid}"


def _whatsapp(args: list) -> str:
    """Activa o desactiva WhatsApp compartido."""
    if len(args) < 2:
        return (
            "❌ Uso: `/org wa [id] [on|off] [instancia]`\n"
            "Ejemplo activar: `/org wa 1 on grupo-rodriguez`\n"
            "Ejemplo desactivar: `/org wa 1 off`"
        )
    try:
        oid = int(args[0])
    except ValueError:
        return "❌ El ID debe ser un número."

    enabled  = args[1].lower() in ("on","true","si","activar","1")
    instance = args[2].strip() if len(args) > 2 and enabled else ""

    org_out, _ = _psql(f"SELECT name FROM public.organizations WHERE id={oid}")
    if not org_out.strip():
        return f"❌ Organización #{oid} no encontrada."

    wa_val   = "true" if enabled else "false"
    inst_val = f"'{instance}'" if instance else "NULL"
    _, rc = _psql(
        f"UPDATE public.organizations "
        f"SET use_shared_whatsapp={wa_val}, whatsapp_instance={inst_val} "
        f"WHERE id={oid}"
    )
    if rc != 0:
        return "❌ Error al actualizar WhatsApp."

    org_name = org_out.strip()
    if enabled:
        return (
            f"📱 *WhatsApp compartido ACTIVADO*\n\n"
            f"🏢 Org: *{org_name}*\n"
            f"🔌 Instancia: `{instance or 'sin nombre'}`\n\n"
            f"_Todas las empresas del grupo usarán esta instancia de Baileys._"
        )
    return f"📵 *WhatsApp compartido DESACTIVADO* para *{org_name}*"


def _bloquear(args: list) -> str:
    """Desactiva una organización."""
    if not args:
        return "❌ Uso: `/org bloquear [id]`"
    try:
        oid = int(args[0])
    except ValueError:
        return "❌ El ID debe ser un número."

    org_out, _ = _psql(f"SELECT name FROM public.organizations WHERE id={oid}")
    if not org_out.strip():
        return f"❌ Organización #{oid} no encontrada."

    _, rc = _psql(f"UPDATE public.organizations SET is_active=false WHERE id={oid}")
    if rc != 0:
        return "❌ Error al desactivar."

    return f"🔴 Organización *{org_out.strip()}* (#{oid}) desactivada."


def _activar(args: list) -> str:
    """Activa una organización."""
    if not args:
        return "❌ Uso: `/org activar [id]`"
    try:
        oid = int(args[0])
    except ValueError:
        return "❌ El ID debe ser un número."

    org_out, _ = _psql(f"SELECT name FROM public.organizations WHERE id={oid}")
    if not org_out.strip():
        return f"❌ Organización #{oid} no encontrada."

    _, rc = _psql(f"UPDATE public.organizations SET is_active=true WHERE id={oid}")
    if rc != 0:
        return "❌ Error al activar."

    return f"✅ Organización *{org_out.strip()}* (#{oid}) activada."
