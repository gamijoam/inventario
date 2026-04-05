"""
bot_handlers/organizations.py
Sprint 6 — Multi-Empresa

Comandos del bot de Telegram para gestión de organizaciones (grupos empresariales).

Comandos disponibles:
    /org listar            — Ver todas las organizaciones activas
    /org detalle [id]      — Ver detalle de una organización
    /org crear [nombre] [email] — Crear nueva organización
    /org plan [id] [plan]  — Cambiar el plan de una organización
    /org agregar [id] [schema] — Agregar empresa a una organización
    /org quitar [id] [schema]  — Quitar empresa de una organización
    /org wa [id] [on/off] [instancia] — Configurar WhatsApp compartido
    /org bloquear [id]     — Desactivar una organización
    /org activar [id]      — Activar una organización

Planes disponibles: duo (2 empresas), multi (5), enterprise (ilimitadas)
"""

from sqlalchemy.orm import Session
from sqlalchemy import text
from ..database.db import engine_map  # Motor de BD del sistema


# ── Planes disponibles ────────────────────────────────────────────────────────

PLANES = {
    "duo"       : {"max_tenants": 2,   "label": "Dúo (2 empresas)"},
    "multi"     : {"max_tenants": 5,   "label": "Multi (5 empresas)"},
    "enterprise": {"max_tenants": 999, "label": "Enterprise (ilimitadas)"},
}


def handle_org_command(args: list, db_url: str) -> str:
    """
    Punto de entrada para los comandos /org del bot de Telegram.

    Args:
        args: Lista de argumentos del comando. args[0] es el subcomando.
        db_url: URL de conexión a la BD del sistema.

    Returns:
        Texto de respuesta para el bot.
    """
    if not args:
        return _help_text()

    subcommand = args[0].lower()

    # Router de subcomandos
    handlers = {
        "listar"  : _cmd_listar,
        "detalle" : _cmd_detalle,
        "crear"   : _cmd_crear,
        "plan"    : _cmd_plan,
        "agregar" : _cmd_agregar,
        "quitar"  : _cmd_quitar,
        "wa"      : _cmd_whatsapp,
        "bloquear": _cmd_bloquear,
        "activar" : _cmd_activar,
    }

    handler = handlers.get(subcommand)
    if not handler:
        return f"❌ Subcomando desconocido: *{subcommand}*\n\n{_help_text()}"

    try:
        from sqlalchemy import create_engine
        from sqlalchemy.orm import sessionmaker
        _engine = create_engine(db_url)
        Session_  = sessionmaker(bind=_engine)
        with Session_() as session:
            return handler(args[1:], session)
    except Exception as e:
        return f"❌ Error al ejecutar /org {subcommand}:\n`{str(e)[:200]}`"


def _help_text() -> str:
    """Texto de ayuda con todos los comandos /org disponibles."""
    return (
        "🏢 *Comandos de organizaciones multi-empresa:*\n\n"
        "`/org listar` — Ver todas las orgs\n"
        "`/org detalle [id]` — Detalle de una org\n"
        "`/org crear [nombre] [email]` — Crear org\n"
        "`/org plan [id] [duo|multi|enterprise]` — Cambiar plan\n"
        "`/org agregar [id] [schema]` — Agregar empresa\n"
        "`/org quitar [id] [schema]` — Quitar empresa\n"
        "`/org wa [id] [on|off] [instancia?]` — WhatsApp compartido\n"
        "`/org bloquear [id]` — Desactivar org\n"
        "`/org activar [id]` — Activar org\n"
    )


def _cmd_listar(args: list, db: Session) -> str:
    """Listar todas las organizaciones con sus métricas principales."""
    rows = db.execute(text("""
        SELECT
            o.id, o.name, o.plan, o.is_active, o.owner_email,
            o.use_shared_whatsapp, o.plan_expires_at,
            COUNT(t.id) AS tenant_count,
            COUNT(m.id) AS member_count
        FROM public.organizations o
        LEFT JOIN public.tenants t ON t.organization_id = o.id
        LEFT JOIN public.organization_users m ON m.organization_id = o.id
        GROUP BY o.id
        ORDER BY o.created_at DESC
    """)).fetchall()

    if not rows:
        return "📭 No hay organizaciones registradas aún."

    lines = ["🏢 *Organizaciones registradas:*\n"]
    for r in rows:
        status  = "✅" if r.is_active else "🔴"
        wa_icon = "📱" if r.use_shared_whatsapp else ""
        expired = ""
        if r.plan_expires_at:
            from datetime import datetime
            if r.plan_expires_at < datetime.now():
                expired = " ⚠️ VENCIDA"

        lines.append(
            f"{status} *#{r.id} {r.name}*{wa_icon}{expired}\n"
            f"   Plan: `{r.plan}` | 🏪 {r.tenant_count} empresa(s) | 👥 {r.member_count} miembro(s)\n"
            f"   Owner: `{r.owner_email}`"
        )

    return "\n".join(lines)


def _cmd_detalle(args: list, db: Session) -> str:
    """Ver detalle completo de una organización por su ID."""
    if not args:
        return "❌ Uso: `/org detalle [id]`"

    try:
        org_id = int(args[0])
    except ValueError:
        return "❌ El ID debe ser un número entero"

    org = db.execute(text(
        "SELECT * FROM public.organizations WHERE id = :id"
    ), {"id": org_id}).fetchone()

    if not org:
        return f"❌ No existe organización con ID {org_id}"

    tenants = db.execute(text(
        "SELECT schema_name, name, is_active FROM public.tenants WHERE organization_id = :id"
    ), {"id": org_id}).fetchall()

    members = db.execute(text(
        "SELECT user_email, role, can_switch FROM public.organization_users WHERE organization_id = :id"
    ), {"id": org_id}).fetchall()

    lines = [
        f"🏢 *Organización #{org.id}: {org.name}*\n",
        f"📋 Slug: `{org.slug}`",
        f"👤 Owner: `{org.owner_email}`",
        f"📦 Plan: `{org.plan}` (máx. {org.max_tenants} empresas)",
        f"💰 Precio: `${float(org.plan_price or 0):.2f}/mes`",
        f"📱 WA compartido: {'✅ Sí' if org.use_shared_whatsapp else '❌ No'}",
        f"🔐 Estado: {'✅ Activa' if org.is_active else '🔴 Inactiva'}",
    ]

    if org.plan_expires_at:
        lines.append(f"📅 Vence: `{org.plan_expires_at}`")
    if org.plan_notes:
        lines.append(f"📝 Notas: _{org.plan_notes}_")

    # Empresas del grupo
    if tenants:
        lines.append(f"\n🏪 *Empresas ({len(tenants)}):*")
        for t in tenants:
            icon = "✅" if t.is_active else "🔴"
            lines.append(f"  {icon} `{t.schema_name}` — {t.name}")
    else:
        lines.append("\n🏪 Sin empresas asignadas")

    # Miembros
    if members:
        lines.append(f"\n👥 *Miembros ({len(members)}):*")
        for m in members:
            switch = "🔄" if m.can_switch else ""
            lines.append(f"  • `{m.user_email}` [{m.role}] {switch}")

    return "\n".join(lines)


def _cmd_crear(args: list, db: Session) -> str:
    """Crear una nueva organización."""
    if len(args) < 2:
        return "❌ Uso: `/org crear [nombre] [email_dueño]`\nEj: `/org crear 'Grupo Rodriguez' admin@empresa.com`"

    # El nombre puede tener espacios — todo menos el último arg es el nombre
    owner_email = args[-1]
    name        = " ".join(args[:-1]).strip("'\"")

    if "@" not in owner_email:
        return "❌ El último argumento debe ser un email válido"

    # Generar slug
    import re
    slug = re.sub(r'[^a-z0-9]+', '-', name.lower().strip()).strip('-')[:80]

    # Verificar si ya existe
    exists = db.execute(text(
        "SELECT id FROM public.organizations WHERE slug = :slug OR owner_email = :email"
    ), {"slug": slug, "email": owner_email.lower()}).fetchone()

    if exists:
        return f"⚠️ Ya existe una organización con ese slug o email (ID: {exists.id})"

    # Crear
    result = db.execute(text("""
        INSERT INTO public.organizations (name, slug, owner_email, plan, max_tenants, is_active)
        VALUES (:name, :slug, :email, 'multi', 5, true)
        RETURNING id, name, slug
    """), {"name": name, "slug": slug, "email": owner_email.lower()})
    db.commit()
    row = result.fetchone()

    # Agregar como miembro owner
    db.execute(text("""
        INSERT INTO public.organization_users (organization_id, user_email, role, can_switch)
        VALUES (:org_id, :email, 'owner', true)
    """), {"org_id": row.id, "email": owner_email.lower()})
    db.commit()

    return (
        f"✅ *Organización creada exitosamente*\n\n"
        f"🆔 ID: `{row.id}`\n"
        f"🏢 Nombre: `{row.name}`\n"
        f"🔗 Slug: `{row.slug}`\n"
        f"📦 Plan: `multi` (5 empresas)\n"
        f"👤 Owner: `{owner_email}`\n\n"
        f"Usa `/org agregar {row.id} [schema]` para agregar empresas."
    )


def _cmd_plan(args: list, db: Session) -> str:
    """Cambiar el plan de una organización."""
    if len(args) < 2:
        return "❌ Uso: `/org plan [id] [duo|multi|enterprise]`"

    try:
        org_id = int(args[0])
    except ValueError:
        return "❌ El ID debe ser un número"

    plan = args[1].lower()
    if plan not in PLANES:
        return f"❌ Plan inválido. Opciones: {', '.join(PLANES.keys())}"

    org = db.execute(text(
        "SELECT id, name FROM public.organizations WHERE id = :id"
    ), {"id": org_id}).fetchone()
    if not org:
        return f"❌ Organización #{org_id} no encontrada"

    plan_data = PLANES[plan]
    db.execute(text("""
        UPDATE public.organizations
        SET plan = :plan, max_tenants = :max
        WHERE id = :id
    """), {"plan": plan, "max": plan_data["max_tenants"], "id": org_id})
    db.commit()

    return (
        f"✅ Plan actualizado para *{org.name}*\n\n"
        f"📦 Plan nuevo: `{plan_data['label']}`\n"
        f"🏪 Máx. empresas: `{plan_data['max_tenants']}`"
    )


def _cmd_agregar(args: list, db: Session) -> str:
    """Agregar una empresa (tenant) a una organización."""
    if len(args) < 2:
        return "❌ Uso: `/org agregar [org_id] [schema_name]`"
    try:
        org_id = int(args[0])
    except ValueError:
        return "❌ El ID de la organización debe ser un número"

    schema = args[1].lower().strip()

    # Verificar organización
    org = db.execute(text(
        "SELECT id, name, max_tenants FROM public.organizations WHERE id = :id"
    ), {"id": org_id}).fetchone()
    if not org:
        return f"❌ Organización #{org_id} no encontrada"

    # Verificar tenant
    tenant = db.execute(text(
        "SELECT id, name, organization_id FROM public.tenants WHERE schema_name = :schema"
    ), {"schema": schema}).fetchone()
    if not tenant:
        return f"❌ Empresa con schema `{schema}` no encontrada"

    if tenant.organization_id and tenant.organization_id != org_id:
        return f"❌ La empresa `{schema}` ya pertenece a otra organización (ID: {tenant.organization_id})"

    # Verificar límite del plan
    current = db.execute(text(
        "SELECT COUNT(*) FROM public.tenants WHERE organization_id = :id"
    ), {"id": org_id}).scalar() or 0

    if current >= org.max_tenants:
        return f"⚠️ La organización ya tiene {current}/{org.max_tenants} empresas. Actualiza el plan con `/org plan {org_id} [plan]`"

    db.execute(text(
        "UPDATE public.tenants SET organization_id = :org_id WHERE id = :tid"
    ), {"org_id": org_id, "tid": tenant.id})
    db.commit()

    return f"✅ Empresa `{schema}` ({tenant.name}) agregada a *{org.name}*"


def _cmd_quitar(args: list, db: Session) -> str:
    """Quitar una empresa de una organización."""
    if len(args) < 2:
        return "❌ Uso: `/org quitar [org_id] [schema_name]`"
    try:
        org_id = int(args[0])
    except ValueError:
        return "❌ El ID debe ser un número"

    schema = args[1].lower().strip()
    tenant = db.execute(text(
        "SELECT id, name FROM public.tenants WHERE schema_name = :s AND organization_id = :o"
    ), {"s": schema, "o": org_id}).fetchone()

    if not tenant:
        return f"❌ La empresa `{schema}` no está en la organización #{org_id}"

    db.execute(text(
        "UPDATE public.tenants SET organization_id = NULL WHERE id = :id"
    ), {"id": tenant.id})
    db.commit()
    return f"✅ Empresa `{schema}` ({tenant.name}) removida de la organización #{org_id}"


def _cmd_whatsapp(args: list, db: Session) -> str:
    """Activar o desactivar WhatsApp compartido para una organización."""
    if len(args) < 2:
        return "❌ Uso: `/org wa [id] [on|off] [instancia]`\nEj: `/org wa 1 on grupo-rodriguez`"
    try:
        org_id = int(args[0])
    except ValueError:
        return "❌ El ID debe ser un número"

    enabled  = args[1].lower() in ("on", "true", "1", "activar", "si")
    instance = args[2] if len(args) > 2 and enabled else None

    org = db.execute(text(
        "SELECT id, name FROM public.organizations WHERE id = :id"
    ), {"id": org_id}).fetchone()
    if not org:
        return f"❌ Organización #{org_id} no encontrada"

    db.execute(text("""
        UPDATE public.organizations
        SET use_shared_whatsapp = :enabled, whatsapp_instance = :instance
        WHERE id = :id
    """), {"enabled": enabled, "instance": instance, "id": org_id})
    db.commit()

    if enabled:
        return (
            f"📱 *WhatsApp compartido ACTIVADO* para *{org.name}*\n"
            f"Instancia: `{instance or 'sin nombre'}` \n"
            f"Todas las empresas del grupo usarán esta instancia de Baileys."
        )
    else:
        return f"📵 *WhatsApp compartido DESACTIVADO* para *{org.name}*"


def _cmd_bloquear(args: list, db: Session) -> str:
    """Desactivar una organización (bloquea el switch entre empresas)."""
    if not args:
        return "❌ Uso: `/org bloquear [id]`"
    try:
        org_id = int(args[0])
    except ValueError:
        return "❌ El ID debe ser un número"

    org = db.execute(text(
        "SELECT id, name FROM public.organizations WHERE id = :id"
    ), {"id": org_id}).fetchone()
    if not org:
        return f"❌ Organización #{org_id} no encontrada"

    db.execute(text(
        "UPDATE public.organizations SET is_active = false WHERE id = :id"
    ), {"id": org_id})
    db.commit()
    return f"🔴 Organización *{org.name}* (#{org_id}) desactivada."


def _cmd_activar(args: list, db: Session) -> str:
    """Reactivar una organización."""
    if not args:
        return "❌ Uso: `/org activar [id]`"
    try:
        org_id = int(args[0])
    except ValueError:
        return "❌ El ID debe ser un número"

    org = db.execute(text(
        "SELECT id, name FROM public.organizations WHERE id = :id"
    ), {"id": org_id}).fetchone()
    if not org:
        return f"❌ Organización #{org_id} no encontrada"

    db.execute(text(
        "UPDATE public.organizations SET is_active = true WHERE id = :id"
    ), {"id": org_id})
    db.commit()
    return f"✅ Organización *{org.name}* (#{org_id}) reactivada."
