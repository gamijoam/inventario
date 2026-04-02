# 40 — Bot Admin de Telegram — Panel SaaS completo

> Bot de Telegram para administrar Mi Inventario Fácil desde el móvil.
> Solo el chat ID del admin puede ejecutar estos comandos.

---

## Arquitectura

```
Admin escribe comando → Telegram → webhook.py (deploy_bot_server)
                                          ↓
                                   Ejecuta en VPS/BD
                                          ↓
                                   Responde al chat
```

El bot vive en el mismo contenedor `deploy_bot_server` que ya maneja
los deploys. Solo se amplía el `webhook.py`.

---

## Lista completa de comandos

### 🚀 Deploy & Sistema

| Comando | Descripción |
|---|---|
| `/status` | Estado de los 4 contenedores prod (🟢/🔴) |
| `/version` | Versión actual desplegada en prod |
| `/deploy` | Igual que el botón ✅ del CI/CD — aprueba el build pendiente |
| `/rollback` | Lista las últimas 5 versiones con botones para elegir |
| `/rollback [version]` | Hace rollback a una versión específica |
| `/logs backend [n]` | Últimas N líneas del backend (default 30) |
| `/logs frontend [n]` | Últimas N líneas del frontend |
| `/restart backend` | Reinicia el contenedor backend_prod_server |
| `/restart frontend` | Reinicia el contenedor frontend_prod_server |
| `/restart all` | Reinicia los 4 contenedores prod en orden |

---

### 🏪 Gestión de Tenants

| Comando | Descripción |
|---|---|
| `/tenants` | Lista todos los tenants (nombre, plan, estado, vencimiento) |
| `/tenant [schema]` | Detalle completo de un negocio |
| `/crear [schema] "[nombre]" [email] [password]` | Crea un tenant nuevo completo |
| `/bloquear [schema]` | Bloquea el acceso del tenant |
| `/activar [schema]` | Desbloquea el tenant |
| `/extender [schema] [dias]` | Extiende el trial X días |
| `/plan [schema] [trial/pro/enterprise]` | Cambia el plan del tenant |
| `/eliminar [schema]` | Elimina el tenant (pide confirmación) |

**Ejemplo de respuesta `/tenant oscarcell`:**
```
🏪 OscarCell
📧 oscar@gmail.com
📅 Plan: Trial — vence en 8 días
👥 Usuarios: 3 (1 admin, 2 cajeros)
💰 Ventas este mes: $1.240
📦 Productos: 48
🟢 Estado: Activo

[🔴 Bloquear] [📅 Extender 7d] [💼 Ir a Pro]
```

---

### 👥 Gestión de Usuarios

| Comando | Descripción |
|---|---|
| `/usuarios [schema]` | Lista usuarios del tenant |
| `/crear-usuario [schema] [username] [email] [rol]` | Crea usuario (roles: admin/cashier/warehouse) |
| `/reset-pass [schema] [username]` | Genera contraseña temporal y la envía por aquí |
| `/bloquear-user [schema] [username]` | Desactiva el usuario |
| `/activar-user [schema] [username]` | Reactiva el usuario |

---

### 💾 Respaldos

| Comando | Descripción |
|---|---|
| `/backup` | Genera respaldo completo de la BD ahora mismo |
| `/backup [schema]` | Respaldo solo del tenant indicado |
| `/backups` | Lista los últimos 10 respaldos con tamaño y fecha |
| `/descargar [nombre]` | Envía el archivo .sql.gz directo al chat de Telegram |
| `/eliminar-backup [nombre]` | Elimina un respaldo (pide confirmación) |

**Ejemplo de respuesta `/backup`:**
```
⏳ Generando respaldo...

✅ Respaldo completado
📁 backup_2026-04-01_22h30.sql.gz
📦 Tamaño: 48 MB
⏱️ Duración: 12 segundos

[⬇️ Descargar] [🗑️ Eliminar]
```

---

### 📊 Métricas del SaaS

| Comando | Descripción |
|---|---|
| `/stats` | Métricas globales: tenants, ventas hoy, estado del sistema |
| `/ventas [schema]` | Ventas del tenant hoy / este mes |
| `/nuevos` | Tenants registrados en los últimos 7 días |
| `/vencen` | Tenants cuyo trial vence en los próximos 7 días |
| `/disco` | Uso del disco del VPS |
| `/ram` | Uso de memoria RAM |

**Ejemplo de respuesta `/stats`:**
```
📊 Mi Inventario Fácil

🏪 Tenants: 49 total
   ✅ Activos: 40 | ⏳ Trial: 8 | 🔴 Bloqueados: 1
   ⚠️  Vencen pronto: 3

🔧 Sistema
   💾 Disco: 45% | 🧠 RAM: 67% | ⚡ CPU: 34%
   Backend: 🟢 | Frontend: 🟢 | BD: 🟢

📅 Hoy: 12 ventas — $842.00
```

---

### ❓ Ayuda

| Comando | Descripción |
|---|---|
| `/ayuda` | Lista todos los comandos disponibles |
| `/ayuda [comando]` | Detalle de un comando específico |
| `/start` | Mensaje de bienvenida con menú principal |

---

## Seguridad

- Solo el `ADMIN_CHAT_ID` configurado en `monitor.conf` puede ejecutar comandos
- Cualquier otro chat recibe: "⛔ No autorizado"
- Los comandos destructivos (`/eliminar`, `/eliminar-backup`) piden confirmación con botones
- Los resets de contraseña se envían solo al chat del admin, nunca por otro canal

---

## Archivos del sistema

```
/root/deploy/telegram-bot/
├── webhook.py          ← Código principal del bot (ampliar aquí)
├── handlers/
│   ├── deploy.py       ← /status /rollback /logs /restart
│   ├── tenants.py      ← /tenants /tenant /crear /bloquear etc
│   ├── usuarios.py     ← /usuarios /crear-usuario /reset-pass etc
│   ├── backups.py      ← /backup /backups /descargar
│   ├── metrics.py      ← /stats /ventas /disco /ram
│   └── help.py         ← /ayuda /start
├── utils/
│   ├── db.py           ← Conexión a la BD de prod
│   ├── docker.py       ← Helpers para docker commands
│   └── auth.py         ← Verificación del chat ID admin
└── Dockerfile
```

---

## Notas de implementación

1. **BD:** El bot se conecta directamente a la BD de producción para leer/escribir tenants y usuarios.
2. **Docker:** Usa el socket `/var/run/docker.sock` que ya está montado en el contenedor.
3. **Backups:** Los archivos se guardan en `/root/backups/` y se envían via Telegram `sendDocument`.
4. **Rollback:** Lee el historial de tags de DockerHub + el archivo `/root/deploy/prod/.env` para saber la versión actual y las anteriores.
5. **Contraseñas temporales:** Se generan con `secrets.token_urlsafe(12)` y se hashean con bcrypt antes de guardarlas.

