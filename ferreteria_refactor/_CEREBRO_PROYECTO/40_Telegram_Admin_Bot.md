# 40 - Bot de Telegram Admin (Panel SaaS completo)

Bot de Telegram que funciona como panel de administración completo del SaaS **Mi Inventario Fácil** directamente desde Telegram. Permite gestionar tenants, usuarios, backups, deploys, métricas y ahora también organizaciones multi-empresa.

---

## Arquitectura

```
Gabriel (Telegram) → Webhook HTTPS → deploy_bot_server → BD Prod / Docker / GitHub
```

**Contenedor:** `deploy_bot_server`
**Código:** `/root/deploy/telegram-bot/`
**Webhook URL:** configurado en variables de entorno `TELEGRAM_TOKEN` y `TELEGRAM_CHAT_ID`

---

## Comandos disponibles (~41 comandos)

### 🚀 Deploy & Sistema

| Comando | Descripción |
|---|---|
| `/status` | Estado de todos los contenedores Docker |
| `/version` | Versiones de imágenes desplegadas (QA y PROD) |
| `/rollback [entorno] [imagen]` | Hacer rollback a una imagen anterior |
| `/logs [contenedor]` | Ver últimas líneas de logs |
| `/restart [contenedor]` | Reiniciar un contenedor |

### 🏪 Tenants (Empresas)

| Comando | Descripción |
|---|---|
| `/tenants` | Lista todos los tenants con estado |
| `/tenant [schema]` | Detalle de un tenant específico |
| `/crear [schema] [email] [nombre]` | Crear nuevo tenant |
| `/bloquear [schema]` | Desactivar acceso de un tenant |
| `/activar [schema]` | Reactivar un tenant bloqueado |
| `/extender [schema] [días]` | Extender trial X días |
| `/plan [schema] [plan]` | Cambiar el plan de un tenant |
| `/eliminar [schema]` | Eliminar tenant (con confirmación) |

### 👥 Usuarios

| Comando | Descripción |
|---|---|
| `/usuarios [schema]` | Lista usuarios de un tenant |
| `/crear-usuario [schema] [email] [rol]` | Crear usuario en un tenant |
| `/reset-pass [schema] [email] [nueva]` | Resetear contraseña |
| `/bloquear-user [schema] [email]` | Bloquear usuario |
| `/activar-user [schema] [email]` | Activar usuario |

### 💾 Respaldos

| Comando | Descripción |
|---|---|
| `/backup` | Crear respaldo de BD prod y enviarlo al chat |
| `/backups` | Listar respaldos disponibles |
| `/descargar [archivo]` | Descargar un respaldo específico |
| `/del-backup [archivo]` | Eliminar respaldo |

### 📊 Métricas

| Comando | Descripción |
|---|---|
| `/stats` | Resumen global: tenants, ventas del día, estado del servidor |
| `/ventas [schema?]` | Ventas del día (toda la plataforma o un tenant) |
| `/nuevos` | Tenants nuevos en los últimos 30 días |
| `/vencen` | Tenants que vencen en los próximos 7 días |
| `/disco` | Uso de disco del VPS |
| `/ram` | Uso de RAM del VPS |

### 🏢 Multi-Empresa (NUEVO — Sprint 6)

| Comando | Descripción |
|---|---|
| `/org listar` | Ver todas las organizaciones con métricas (plan, empresas, miembros, precio, WA) |
| `/org detalle [id]` | Detalle completo: empresas del grupo, miembros, plan, WhatsApp |
| `/org crear [nombre] [email_dueño]` | Crear nueva organización (plan multi por defecto) |
| `/org plan [id] [duo\|multi\|enterprise]` | Cambiar plan de una organización |
| `/org precio [id] [monto]` | Fijar precio mensual en USD |
| `/org agregar [id] [schema]` | Agregar empresa al grupo (verifica límite del plan) |
| `/org quitar [id] [schema]` | Quitar empresa del grupo (el tenant sigue existiendo) |
| `/org wa [id] [on\|off] [instancia?]` | Configurar WhatsApp compartido (instancia Baileys) |
| `/org bloquear [id]` | Desactivar organización (bloquea el switch entre empresas) |
| `/org activar [id]` | Reactivar organización |

#### Planes disponibles para /org plan:
- `duo` — hasta 2 empresas
- `multi` — hasta 5 empresas
- `enterprise` — ilimitadas

#### Ejemplos de uso /org:
```
/org listar
/org crear Grupo Rodriguez admin@rodriguez.com
/org agregar 1 ferreteria-centro
/org agregar 1 ferreteria-norte
/org plan 1 enterprise
/org precio 1 49.99
/org wa 1 on grupo-rodriguez
/org detalle 1
/org bloquear 1
```

---

## Flujo de deploy con aprobación

1. GitHub Actions detecta push a `main`
2. Construye imagen Docker y notifica al bot
3. Bot envía mensaje con botones: **✅ Aprobar** / **❌ Rechazar**
4. Gabriel toca Aprobar → bot ejecuta el deploy en PROD
5. Bot notifica resultado con la nueva versión activa

---

## Estructura de archivos

```
/root/deploy/telegram-bot/
├── webhook.py           ← Flask app, router de todos los comandos
├── help.py              ← MENU_PRINCIPAL + COMMANDS + build_ayuda_*()
└── handlers/
    ├── __init__.py
    ├── deploy.py        ← /status /version /rollback /logs /restart
    ├── tenants.py       ← /tenants /tenant /crear /bloquear /activar /extender /plan /eliminar
    ├── usuarios.py      ← /usuarios /crear-usuario /reset-pass /bloquear-user /activar-user
    ├── backups.py       ← /backup /backups /descargar /del-backup
    ├── metrics.py       ← /stats /ventas /nuevos /vencen /disco /ram
    └── organizations.py ← /org [listar|detalle|crear|plan|precio|agregar|quitar|wa|bloquear|activar]
```

---

## Patrón de BD en los handlers

Los handlers usan `psql` via `docker exec` directamente — sin SQLAlchemy:

```python
def _psql(sql, db="invensoft_prod"):
    r = subprocess.run(
        ["docker","exec","db_prod_server",
         "psql","-U","postgres","-d",db,"-t","-A","-F","|","-c",sql],
        capture_output=True, text=True, timeout=15
    )
    return r.stdout.strip(), r.returncode
```

**Regla:** usar un solo flag `-c` por llamada. Múltiples `-c` o heredocs fallan silenciosamente.

---

## Variables de entorno requeridas

```env
TELEGRAM_TOKEN=...
TELEGRAM_CHAT_ID=...
WEBHOOK_SECRET=mi-inventario-deploy-2026
```

---

## Reiniciar el bot

```bash
docker restart deploy_bot_server
docker logs deploy_bot_server --tail 20
```
