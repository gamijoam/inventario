"""
help.py — Sistema de ayuda del bot admin de Mi Inventario Fácil
Contiene la definición de todos los comandos con descripción y ejemplos.
"""

COMMANDS = {
    # ── Deploy & Sistema ──────────────────────────────────────
    "status": {
        "grupo": "🚀 Deploy & Sistema",
        "desc": "Muestra el estado actual de los 4 contenedores de producción.",
        "uso": "/status",
        "ejemplo": (
            "/status\n\n"
            "Respuesta:\n"
            "📊 Estado de producción\n"
            "✅ backend_prod_server\n"
            "✅ frontend_prod_server\n"
            "✅ db_prod_server\n"
            "✅ whatsapp_service\n"
            "🏷️ TAG=prod-catalogo-20260401"
        ),
    },
    "version": {
        "grupo": "🚀 Deploy & Sistema",
        "desc": "Muestra la versión actualmente desplegada en producción.",
        "uso": "/version",
        "ejemplo": (
            "/version\n\n"
            "Respuesta:\n"
            "🏷️ Versión en prod: prod-catalogo-20260401"
        ),
    },
    "rollback": {
        "grupo": "🚀 Deploy & Sistema",
        "desc": "Lista las últimas 5 versiones con botones para hacer rollback.",
        "uso": "/rollback",
        "ejemplo": (
            "/rollback\n\n"
            "Respuesta:\n"
            "📋 Historial de versiones\n"
            "1️⃣ prod-catalogo-20260401 ← actual\n"
            "2️⃣ prod-onboarding-20260330\n"
            "3️⃣ prod-wizard-20260328\n\n"
            "Presiona el número para hacer rollback."
        ),
    },
    "logs": {
        "grupo": "🚀 Deploy & Sistema",
        "desc": "Muestra las últimas líneas de logs de un contenedor.",
        "uso": "/logs [contenedor] [lineas]",
        "ejemplo": (
            "/logs backend\n"
            "/logs frontend 50\n"
            "/logs backend 100\n\n"
            "Contenedores disponibles: backend, frontend, db, whatsapp"
        ),
    },
    "restart": {
        "grupo": "🚀 Deploy & Sistema",
        "desc": "Reinicia un contenedor de producción.",
        "uso": "/restart [contenedor]",
        "ejemplo": (
            "/restart backend\n"
            "/restart frontend\n"
            "/restart all  ← reinicia los 4 en orden"
        ),
    },
    # ── Tenants ───────────────────────────────────────────────
    "tenants": {
        "grupo": "🏪 Tenants",
        "desc": "Lista todos los negocios registrados con su estado y plan.",
        "uso": "/tenants",
        "ejemplo": (
            "/tenants\n\n"
            "Respuesta:\n"
            "🏪 Negocios registrados (49)\n\n"
            "🟢 oscarcell — Trial (8 días)\n"
            "🟢 laGuapa — Trial (3 días)\n"
            "🔴 demo123 — Bloqueado\n"
            "..."
        ),
    },
    "tenant": {
        "grupo": "🏪 Tenants",
        "desc": "Muestra el detalle completo de un negocio.",
        "uso": "/tenant [schema]",
        "ejemplo": (
            "/tenant oscarcell\n\n"
            "Respuesta:\n"
            "🏪 OscarCell\n"
            "📧 oscar@gmail.com\n"
            "📅 Trial — vence en 8 días\n"
            "👥 Usuarios: 3\n"
            "💰 Ventas este mes: $1.240\n"
            "📦 Productos: 48\n"
            "🟢 Estado: Activo"
        ),
    },
    "crear": {
        "grupo": "🏪 Tenants",
        "desc": "Crea un nuevo negocio completo con su schema, admin y configuración inicial.",
        "uso": '/crear [schema] "[nombre]" [email] [password]',
        "ejemplo": (
            '/crear mitienda "Mi Tienda López" admin@tienda.com Pass123\n\n'
            "El schema debe ser único, sin espacios ni caracteres especiales.\n"
            "El email será el usuario admin del negocio."
        ),
    },
    "bloquear": {
        "grupo": "🏪 Tenants",
        "desc": "Bloquea el acceso de un negocio. Sus datos se conservan.",
        "uso": "/bloquear [schema]",
        "ejemplo": "/bloquear oscarcell",
    },
    "activar": {
        "grupo": "🏪 Tenants",
        "desc": "Reactiva un negocio bloqueado o expirado.",
        "uso": "/activar [schema]",
        "ejemplo": "/activar oscarcell",
    },
    "extender": {
        "grupo": "🏪 Tenants",
        "desc": "Extiende el período de trial de un negocio.",
        "uso": "/extender [schema] [dias]",
        "ejemplo": (
            "/extender oscarcell 15\n"
            "/extender mitienda 7"
        ),
    },
    "plan": {
        "grupo": "🏪 Tenants",
        "desc": "Cambia el plan de un negocio.",
        "uso": "/plan [schema] [plan]",
        "ejemplo": (
            "/plan oscarcell pro\n"
            "/plan mitienda trial\n\n"
            "Planes disponibles: trial, pro, enterprise"
        ),
    },
    "eliminar": {
        "grupo": "🏪 Tenants",
        "desc": "Elimina permanentemente un negocio. Pide confirmación antes de ejecutar.",
        "uso": "/eliminar [schema]",
        "ejemplo": (
            "/eliminar demo123\n\n"
            "⚠️ ESTA ACCIÓN NO SE PUEDE DESHACER.\n"
            "Se eliminarán todos los datos del negocio."
        ),
    },
    # ── Usuarios ──────────────────────────────────────────────
    "usuarios": {
        "grupo": "👥 Usuarios",
        "desc": "Lista los usuarios de un negocio con sus roles.",
        "uso": "/usuarios [schema]",
        "ejemplo": (
            "/usuarios oscarcell\n\n"
            "Respuesta:\n"
            "👥 Usuarios de OscarCell\n"
            "👑 admin — oscar@gmail.com — Activo\n"
            "🧑 carlos — carlos@gmail.com — Cajero — Activo\n"
            "🧑 maria — maria@gmail.com — Almacén — Activo"
        ),
    },
    "crear-usuario": {
        "grupo": "👥 Usuarios",
        "desc": "Crea un nuevo usuario en un negocio.",
        "uso": "/crear-usuario [schema] [username] [email] [rol]",
        "ejemplo": (
            "/crear-usuario oscarcell carlos carlos@tienda.com cajero\n\n"
            "Roles: admin, cajero, almacen"
        ),
    },
    "reset-pass": {
        "grupo": "👥 Usuarios",
        "desc": "Genera una contraseña temporal y la envía aquí.",
        "uso": "/reset-pass [schema] [username]",
        "ejemplo": (
            "/reset-pass oscarcell carlos\n\n"
            "Respuesta:\n"
            "🔑 Contraseña temporal generada\n"
            "Usuario: carlos\n"
            "Contraseña: xK9#mP2qRt\n"
            "El usuario deberá cambiarla al ingresar."
        ),
    },
    "bloquear-user": {
        "grupo": "👥 Usuarios",
        "desc": "Desactiva un usuario específico de un negocio.",
        "uso": "/bloquear-user [schema] [username]",
        "ejemplo": "/bloquear-user oscarcell carlos",
    },
    "activar-user": {
        "grupo": "👥 Usuarios",
        "desc": "Reactiva un usuario desactivado.",
        "uso": "/activar-user [schema] [username]",
        "ejemplo": "/activar-user oscarcell carlos",
    },
    # ── Respaldos ─────────────────────────────────────────────
    "backup": {
        "grupo": "💾 Respaldos",
        "desc": "Genera un respaldo de la base de datos y lo envía aquí como archivo.",
        "uso": "/backup [schema opcional]",
        "ejemplo": (
            "/backup            ← respaldo completo\n"
            "/backup oscarcell  ← solo ese negocio\n\n"
            "El archivo .sql.gz llega directo a este chat."
        ),
    },
    "backups": {
        "grupo": "💾 Respaldos",
        "desc": "Lista los últimos 10 respaldos con fecha, tamaño y botones de acción.",
        "uso": "/backups",
        "ejemplo": (
            "/backups\n\n"
            "Respuesta:\n"
            "💾 Últimos respaldos\n\n"
            "1. backup_2026-04-01_22h30.sql.gz — 48 MB\n"
            "   [⬇️ Descargar] [🗑️ Eliminar]\n"
            "2. backup_2026-03-31_08h00.sql.gz — 46 MB\n"
            "   [⬇️ Descargar] [🗑️ Eliminar]"
        ),
    },
    "descargar": {
        "grupo": "💾 Respaldos",
        "desc": "Envía un respaldo específico como archivo a este chat.",
        "uso": "/descargar [nombre-archivo]",
        "ejemplo": "/descargar backup_2026-04-01_22h30.sql.gz",
    },
    # ── Métricas ──────────────────────────────────────────────
    "stats": {
        "grupo": "📊 Métricas",
        "desc": "Resumen global del sistema: tenants, ventas del día y estado del servidor.",
        "uso": "/stats",
        "ejemplo": (
            "/stats\n\n"
            "Respuesta:\n"
            "📊 Mi Inventario Fácil\n"
            "🏪 Tenants: 49 total\n"
            "   ✅ Activos: 40 | ⏳ Trial: 8 | 🔴 Bloqueados: 1\n"
            "   ⚠️ Vencen pronto: 3\n\n"
            "🔧 Sistema\n"
            "   💾 Disco: 45% | 🧠 RAM: 67% | ⚡ CPU: 34%\n"
            "   Backend: 🟢 | Frontend: 🟢 | BD: 🟢\n\n"
            "📅 Hoy: 12 ventas — $842.00"
        ),
    },
    "ventas": {
        "grupo": "📊 Métricas",
        "desc": "Ventas de un negocio hoy y este mes.",
        "uso": "/ventas [schema]",
        "ejemplo": (
            "/ventas oscarcell\n\n"
            "Respuesta:\n"
            "💰 Ventas de OscarCell\n"
            "📅 Hoy: 5 ventas — $320.00\n"
            "📆 Este mes: 38 ventas — $2.840.00"
        ),
    },
    "nuevos": {
        "grupo": "📊 Métricas",
        "desc": "Negocios registrados en los últimos 7 días.",
        "uso": "/nuevos",
        "ejemplo": (
            "/nuevos\n\n"
            "Respuesta:\n"
            "🆕 Nuevos negocios (últimos 7 días)\n\n"
            "• mitienda — 01/Apr — Trial 15d\n"
            "• farmacia01 — 29/Mar — Trial 15d"
        ),
    },
    "vencen": {
        "grupo": "📊 Métricas",
        "desc": "Negocios cuyo trial vence en los próximos 7 días.",
        "uso": "/vencen",
        "ejemplo": (
            "/vencen\n\n"
            "Respuesta:\n"
            "⚠️ Vencen en 7 días\n\n"
            "• oscarcell — vence en 2 días\n"
            "• laGuapa — vence en 5 días\n\n"
            "Usa /extender [schema] [dias] para ampliar."
        ),
    },
    "disco": {
        "grupo": "📊 Métricas",
        "desc": "Uso actual del disco del VPS.",
        "uso": "/disco",
        "ejemplo": (
            "/disco\n\n"
            "Respuesta:\n"
            "💾 Uso del disco\n"
            "Total: 100 GB | Usado: 45 GB (45%)\n"
            "Libre: 55 GB\n\n"
            "📁 Mayores:\n"
            "  /var/lib/docker — 28 GB\n"
            "  /root/backups  — 12 GB\n"
            "  /root/deploy   — 3 GB"
        ),
    },
    "ram": {
        "grupo": "📊 Métricas",
        "desc": "Uso actual de memoria RAM del VPS.",
        "uso": "/ram",
        "ejemplo": (
            "/ram\n\n"
            "Respuesta:\n"
            "🧠 Memoria RAM\n"
            "Total: 4 GB | Usada: 2.7 GB (67%)\n"
            "Libre: 1.3 GB"
        ),
    },
    "org": {
        "grupo": "🏢 Multi-Empresa",
        "desc": "Gestiona organizaciones multi-empresa. Subcomandos: listar, detalle, crear, plan, precio, agregar, quitar, wa, bloquear, activar.",
        "uso": "/org [subcomando] [args]",
        "ejemplos": [
            "/org listar",
            "/org crear \"Grupo Rodriguez\" admin@empresa.com",
            "/org agregar 1 ferreteria",
            "/org plan 1 enterprise",
            "/org wa 1 on instancia-baileys",
        ]
    },
}

# ── Textos del bot ────────────────────────────────────────────

MENU_PRINCIPAL = """🤖 *Bot Admin — Mi Inventario Fácil*

Soy tu panel de administración desde Telegram.
Puedo gestionar negocios, usuarios, respaldos y deploys.

*Módulos disponibles:*

🚀 Deploy & Sistema
🏪 Tenants (negocios)
👥 Usuarios
💾 Respaldos
📊 Métricas
🏢 Multi-Empresa (/org)

Escribe /ayuda para ver todos los comandos.
Escribe /ayuda [comando] para ver el detalle de uno específico.

*Ejemplo:* /ayuda tenant"""

def build_ayuda_general():
    """Construye el mensaje de ayuda con todos los grupos."""
    grupos = {}
    for cmd, info in COMMANDS.items():
        g = info["grupo"]
        if g not in grupos:
            grupos[g] = []
        grupos[g].append(f"  /{cmd} — {info['desc'].split('.')[0]}")

    lines = ["📋 *Comandos disponibles*\n"]
    for grupo, cmds in grupos.items():
        lines.append(f"\n*{grupo}*")
        lines.extend(cmds)

    lines.append("\n\nEscribe /ayuda [comando] para ver el detalle y ejemplos.")
    lines.append("Ejemplo: /ayuda tenant")
    return "\n".join(lines)


def build_ayuda_comando(cmd):
    """Construye el mensaje de ayuda detallado para un comando específico."""
    cmd = cmd.lstrip("/").lower()
    if cmd not in COMMANDS:
        return f"❌ Comando `/{cmd}` no encontrado.\n\nEscribe /ayuda para ver la lista completa."

    info = COMMANDS[cmd]
    return (
        f"{info['grupo']} — `/{cmd}`\n\n"
        f"📝 *Descripción:*\n{info['desc']}\n\n"
        f"⌨️ *Uso:*\n`{info['uso']}`\n\n"
        f"💡 *Ejemplo:*\n```\n{info['ejemplo']}\n```"
    )
