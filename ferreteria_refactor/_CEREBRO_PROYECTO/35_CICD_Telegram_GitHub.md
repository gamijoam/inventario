# 35 — CI/CD con GitHub Actions + Bot de Telegram

> Sistema de deploy automático con aprobación manual vía Telegram.
> **Fecha de implementación:** 2026-04-01

---

## Resumen del flujo completo

```
Desarrollador hace merge → main
        │
        ▼
GitHub Actions detecta el push
        │
        ▼ (SSH al VPS — no buildea en GitHub)
VPS ejecuta:
  1. git pull origin main
  2. docker build × 4 imágenes
  3. docker push → DockerHub
  4. notify_build_ready.py
        │
        ▼
Telegram Bot @miinventario_monitor_bot
┌─────────────────────────────────────┐
│ 🔨 Build listo para deploy          │
│                                     │
│ Versión: prod-feature-x-2026...     │
│                                     │
│ ¿Desplegar a producción?            │
│ [✅ Aprobar deploy] [❌ Cancelar]   │
└─────────────────────────────────────┘
        │
        ▼ (usuario presiona ✅)
Telegram → webhook → deploy_bot_server
        │
        ▼
deploy-containers.sh (recrea 4 contenedores)
        │
        ▼
Smoke tests (curl a los 3 endpoints)
        │
        ▼
Telegram: "✅ Deploy exitoso"
```

---

## Arquitectura de componentes

### 1. GitHub Actions — `.github/workflows/deploy.yml`
**Ubicación:** `/root/deploy/qa/code/.github/workflows/deploy.yml`
**Qué hace:** Solo conecta al VPS por SSH y ejecuta el build ahí.

**Por qué en el VPS y no en GitHub Actions:**
- Vite (el bundler del frontend) fallaba consistentemente en GitHub Actions
- El VPS ya tiene Docker configurado, credenciales de DockerHub, y el build funciona
- Es más rápido porque no hay que configurar el entorno

**Secrets requeridos en GitHub (Settings → Secrets → Actions):**

| Secret | Valor |
|---|---|
| `VPS_HOST` | `212.28.176.157` |
| `VPS_SSH_PASSWORD` | Contraseña root del VPS |
| `DOCKERHUB_TOKEN` | Token de DockerHub de gamijoam |
| `TELEGRAM_TOKEN` | Token del bot (en monitor.conf) |
| `TELEGRAM_CHAT_ID` | Chat ID del admin (en monitor.conf) |

---

### 2. Script de notificación — `notify_build_ready.py`
**Ubicación:** `/root/deploy/notify_build_ready.py`
**Invocado por:** El workflow de GitHub Actions tras el build exitoso

**Cómo funciona:**
- Lee `TELEGRAM_TOKEN` y `TELEGRAM_CHAT_ID` de `/root/deploy/monitor.conf`
- Recibe la versión como argumento: `python3 notify_build_ready.py "prod-feature-x-20260401"`
- Envía mensaje con botones inline al chat del admin

**Para probarlo manualmente:**
```bash
python3 /root/deploy/notify_build_ready.py "prod-test-manual-20260401"
```

---

### 3. Deploy Bot — `deploy_bot_server`
**Contenedor Docker:** `deploy_bot_server` (imagen `mi-inventario-deploy-bot`)
**Código fuente:** `/root/deploy/telegram-bot/webhook.py`
**URL del webhook:** `https://api.miinventariofacil.com/bot/webhook/mi-inventario-deploy-2026`

**Cómo funciona:**
- Telegram registra el webhook: cuando el usuario presiona un botón, Telegram llama a esta URL
- El bot recibe el `callback_query` con `callback_data = "approve:VERSION"` o `"cancel:VERSION"`
- Si es `approve:` → ejecuta `deploy-containers.sh VERSION` en un hilo separado
- Si es `cancel:` → edita el mensaje en Telegram mostrando "Deploy cancelado"
- El contenedor tiene acceso al Docker socket del host: `-v /var/run/docker.sock:/var/run/docker.sock`
- Y tiene acceso al directorio de deploy: `-v /root/deploy:/root/deploy`

**Rutas del bot:**
- `GET /health` → health check
- `POST /webhook/mi-inventario-deploy-2026` → recibe updates de Telegram
- Comando `/status` → muestra estado de contenedores prod en Telegram

---

### 4. Script de recreación de contenedores — `deploy-containers.sh`
**Ubicación:** `/root/deploy/deploy-containers.sh`
**Invocado por:** El bot de Telegram cuando el usuario aprueba el deploy

**Qué hace:**
1. Actualiza TAG en `/root/deploy/prod/.env`
2. Recrea los 4 contenedores prod (siempre `--network web_publica` primero)
3. Conecta `prod_prod_internal` al backend como segunda red
4. Espera 30 segundos
5. Smoke tests a los 3 endpoints
6. Retorna exit code 0 (éxito) o 1 (fallo)

---

### 5. Bot de Telegram — `@miinventario_monitor_bot`
**Token:** En `/root/deploy/monitor.conf` como `TELEGRAM_TOKEN`
**Chat ID del admin:** En `/root/deploy/monitor.conf` como `TELEGRAM_CHAT_ID`
**Webhook registrado en:** `https://api.miinventariofacil.com/bot/webhook/mi-inventario-deploy-2026`

**El bot tiene DOS funciones:**
1. **Deploy notifications** — recibe aprobaciones/cancelaciones del deploy
2. **Monitor alerts** — recibe alertas del `monitor.sh` cuando algún servicio cae

---

## Cómo hacer cambios

### Cambiar el número de Telegram que recibe las notificaciones
```bash
nano /root/deploy/monitor.conf
# Cambiar TELEGRAM_CHAT_ID="nuevo_chat_id"
```
Para obtener el chat ID de alguien nuevo:
1. Esa persona busca `@miinventario_monitor_bot` y escribe `/start`
2. Ejecutar: `curl "https://api.telegram.org/botTOKEN/getUpdates"` y ver el `chat.id`

---

### Cambiar el secreto del webhook (WEBHOOK_SECRET)
El secreto `mi-inventario-deploy-2026` protege el endpoint del bot.
Para cambiarlo:
```bash
# 1. Parar el bot
docker stop deploy_bot_server && docker rm deploy_bot_server

# 2. Relanzar con nuevo secreto
docker run -d --name deploy_bot_server \
  --network web_publica \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v /root/deploy:/root/deploy \
  -e TELEGRAM_TOKEN="TOKEN" \
  -e TELEGRAM_CHAT_ID="CHAT_ID" \
  -e WEBHOOK_SECRET="nuevo-secreto-aqui" \
  --label "traefik.enable=true" \
  --label "traefik.http.routers.deploy-bot.rule=Host(\`api.miinventariofacil.com\`) && PathPrefix(\`/bot/\`)" \
  --label "traefik.http.routers.deploy-bot.entrypoints=websecure" \
  --label "traefik.http.routers.deploy-bot.tls.certresolver=myresolver" \
  --label "traefik.http.routers.deploy-bot.priority=300" \
  --label "traefik.http.middlewares.strip-bot-prefix.stripprefix.prefixes=/bot" \
  --label "traefik.http.routers.deploy-bot.middlewares=strip-bot-prefix" \
  --label "traefik.http.services.deploy-bot.loadbalancer.server.port=5050" \
  --label "traefik.docker.network=web_publica" \
  mi-inventario-deploy-bot

# 3. Registrar nuevo webhook en Telegram
curl -X POST "https://api.telegram.org/botTOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://api.miinventariofacil.com/bot/webhook/nuevo-secreto-aqui"}'
```

---

### Modificar la lógica del bot (webhook.py)
```bash
# 1. Editar el código
nano /root/deploy/telegram-bot/webhook.py

# 2. Reconstruir la imagen
docker build -t mi-inventario-deploy-bot /root/deploy/telegram-bot/

# 3. Relanzar (ver comando de arriba)
docker stop deploy_bot_server && docker rm deploy_bot_server
# ... docker run con los labels ...
```

---

### Modificar el workflow de GitHub Actions
**Archivo:** `/root/deploy/qa/code/.github/workflows/deploy.yml`

El workflow tiene UN solo job que:
1. SSH al VPS
2. `cd /root/deploy/qa/code && git pull origin main`
3. Build de 4 imágenes con `docker build`
4. Push a DockerHub con `docker push`
5. Llama a `python3 /root/deploy/notify_build_ready.py "$VERSION"`

Para agregar un nuevo contenedor al build, copiar el bloque de `docker build` y `docker push`.

---

### Cambiar el token del bot de Telegram
Si el bot es comprometido o se necesita recrear:
```bash
# 1. Crear nuevo bot con @BotFather en Telegram
# 2. Actualizar monitor.conf
nano /root/deploy/monitor.conf
# TELEGRAM_TOKEN="nuevo_token"

# 3. Re-registrar el webhook
curl -X POST "https://api.telegram.org/botNUEVO_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://api.miinventariofacil.com/bot/webhook/mi-inventario-deploy-2026"}'

# 4. Reconstruir y relanzar el bot con la nueva variable
```

---

## Troubleshooting

### El build falla en GitHub Actions
1. Ir a `github.com/gamijoam/inventario/actions`
2. Ver el job fallido → step "Conectar al VPS y ejecutar build"
3. El error estará en el output del SSH

Causas comunes:
- `git pull` falla → conflicto en el repositorio QA
- `docker build` falla → error de compilación (ver en el log)
- `docker push` falla → credenciales de DockerHub expiradas

Para regenerar el token de DockerHub:
```bash
echo "NUEVO_TOKEN" | docker login -u gamijoam --password-stdin
```

---

### No llega la notificación de Telegram
```bash
# Probar manualmente
python3 /root/deploy/notify_build_ready.py "test-$(date +%s)"

# Verificar webhook registrado
BOT_TOKEN=$(grep TELEGRAM_TOKEN /root/deploy/monitor.conf | cut -d'"' -f2)
curl "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo"
```

Si el webhook no está registrado:
```bash
SECRET="mi-inventario-deploy-2026"
curl -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{\"url\":\"https://api.miinventariofacil.com/bot/webhook/${SECRET}\"}"
```

---

### El bot no responde a los botones
```bash
# Ver logs del bot
docker logs deploy_bot_server --tail 30

# Verificar que el bot está corriendo
docker ps --filter "name=deploy_bot_server"

# Verificar que responde
curl https://api.miinventariofacil.com/bot/health
```

Si no responde → revisar que Traefik tiene los labels correctos:
```bash
docker inspect deploy_bot_server --format \
  '{{range $k,$v := .Config.Labels}}{{$k}}={{$v}}{{"\n"}}{{end}}' | grep traefik
```

---

### Deploy aprobado pero no se desplegó
```bash
# Ver logs del bot (buscar el deploy)
docker logs deploy_bot_server --tail 50 | grep -E "deploy|VERSION|FAILED"

# Ver si deploy-containers.sh tiene errores
bash /root/deploy/deploy-containers.sh "prod-version-aqui"
```

---

## Archivos del sistema

```
/root/deploy/
├── monitor.conf              ← Configuración: TOKEN + CHAT_ID de Telegram
├── monitor.sh                ← Monitor de servicios (cron cada minuto)
├── notify_build_ready.py     ← Envía botones de aprobación a Telegram
├── deploy-containers.sh      ← Recrea los 4 contenedores prod
├── deploy.sh                 ← Script de deploy manual (fallback)
└── telegram-bot/
    ├── webhook.py            ← Código del bot Flask
    └── Dockerfile            ← Para construir la imagen del bot

/root/deploy/qa/code/
└── .github/
    └── workflows/
        └── deploy.yml        ← Workflow de GitHub Actions
```

---

## Secretos en GitHub (Settings → Secrets → Actions)

| Nombre | Descripción |
|---|---|
| `VPS_HOST` | IP del servidor: `212.28.176.157` |
| `VPS_SSH_PASSWORD` | Contraseña root del VPS |
| `DOCKERHUB_TOKEN` | Token de DockerHub (`gamijoam`) |
| `TELEGRAM_TOKEN` | Token del bot (mismo que monitor.conf) |
| `TELEGRAM_CHAT_ID` | Chat ID del admin (mismo que monitor.conf) |

---

## Verificación rápida del sistema

```bash
# 1. Bot corriendo
docker ps --filter "name=deploy_bot_server" --format "{{.Status}}"

# 2. Webhook registrado en Telegram
BOT_TOKEN=$(grep TELEGRAM_TOKEN /root/deploy/monitor.conf | cut -d'"' -f2)
curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo" | python3 -c \
  "import sys,json;d=json.load(sys.stdin)['result'];print('URL:',d.get('url','VACIO'))"

# 3. Bot responde
curl -s https://api.miinventariofacil.com/bot/health

# 4. Enviar test de notificación
python3 /root/deploy/notify_build_ready.py "test-verificacion"
```

---

## Historial de decisiones

| Decisión | Razón |
|---|---|
| Build en el VPS, no en GitHub Actions | Vite fallaba consistentemente en runners de GitHub (problema de entorno) |
| Bot Flask en lugar de n8n | n8n requería credenciales extra; Flask es más simple y transparente |
| Webhook en `api.miinventariofacil.com/bot/` | El subdominio `deploy-bot.miinventariofacil.com` no resolvía para Telegram (DNS) |
| PathPrefix `/bot/` con priority 300 | El frontend wildcard `*.miinventariofacil.com` capturaba todos los subdominios; se necesita mayor prioridad |
| SSH con password en lugar de llave | La llave SSH no persistía entre el contenedor MCP y el host del VPS |
