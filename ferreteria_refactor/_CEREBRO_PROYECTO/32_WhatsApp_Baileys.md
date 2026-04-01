# 32 — WhatsApp Business: Servicio Baileys Propio

> **Creado:** 2026-04-01  
> **Actualizado:** 2026-04-01  
> **Estado:** ✅ PRODUCCIÓN — Funcionando completamente  
> **Rama:** `feature/customer-360-whatsapp`

---

## 1. Decisión de arquitectura

Se evaluaron 3 opciones:
- **Evolution API v2.2.3** — Descartada: `QRCODE_UPDATED` webhook no entregaba base64, webhookBase64 no se podía forzar a true, QR no llegaba al frontend
- **Evolution API v1.x** — Descartada: versión vieja, posibles problemas futuros
- **Baileys directo (elegida)** — Control total del QR, sin webhooks externos, sin pasar por Cloudflare

---

## 2. Arquitectura implementada

```
Cliente (browser)
    │
    │ polling cada 3s → GET /whatsapp/instance/qr
    ▼
Backend FastAPI (api-qa / api.miinventariofacil.com)
    │
    │ HTTP interno Docker
    ▼
Servicio Baileys (Node.js Express)
whatsapp_service:3000 — red web_publica
    │
    │ WebSocket
    ▼
WhatsApp Web (servidores Meta)
```

### Flujo de conexión QR
1. Tenant hace clic "Conectar WhatsApp" en Configuración → WhatsApp
2. Backend llama `POST /instance/{tenant}/connect` al servicio Baileys
3. Baileys genera QR como PNG base64 en ~8 segundos
4. Frontend hace polling a `GET /whatsapp/instance/qr` cada 3 segundos
5. Cuando hay QR → se muestra en pantalla
6. Tenant escanea con su WhatsApp
7. Baileys detecta `connection.update` state=open → status=CONNECTED
8. Frontend detecta CONNECTED → muestra ✅

---

## 3. Servicio Baileys

### Ubicación en servidor
```
/root/deploy/whatsapp-service/
├── server.js          # Servicio Express + Baileys (192 líneas)
├── package.json       # @whiskeysockets/baileys, express, qrcode, pino
└── Dockerfile         # node:20-alpine + git + python3
```

### Imagen Docker
```
mi-inventario-whatsapp:1.1
```

### Arrancar el contenedor
```bash
docker run -d \
  --name whatsapp_service \
  --restart always \
  --network web_publica \
  -v whatsapp_sessions:/data/sessions \
  -e PORT=3000 \
  mi-inventario-whatsapp:1.1
```

### Sesiones persistentes
Las sesiones se guardan en volumen Docker `whatsapp_sessions` → `/data/sessions/{tenantId}/`  
Al reiniciar el contenedor, las sesiones se restauran automáticamente sin necesidad de escanear de nuevo.

### Endpoints del servicio Baileys

| Método | Endpoint | Descripción |
|---|---|---|
| GET | `/health` | Estado del servicio |
| POST | `/instance/:tenantId/connect` | Crear/iniciar instancia |
| GET | `/instance/:tenantId/qr` | Obtener QR como base64 PNG |
| GET | `/instance/:tenantId/status` | Estado de conexión |
| DELETE | `/instance/:tenantId` | Desconectar y limpiar sesión |
| POST | `/instance/:tenantId/send` | Enviar mensaje de texto |
| POST | `/instance/:tenantId/send-document` | Enviar archivo PDF |

---

## 4. Backend FastAPI

### Router: `backend_api/routers/whatsapp.py`

**Endpoints públicos (requieren auth):**

| Endpoint | Método | Descripción |
|---|---|---|
| `/whatsapp/config` | GET | Configuración + plantillas del tenant |
| `/whatsapp/config` | POST | Guardar toggles y plantillas |
| `/whatsapp/instance/create` | POST | Iniciar conexión WhatsApp |
| `/whatsapp/instance/qr` | GET | Polling del QR |
| `/whatsapp/instance/status` | GET | Estado actual |
| `/whatsapp/instance/disconnect` | POST | Desconectar |
| `/whatsapp/test` | POST | Enviar mensaje de prueba |

### Claves en `business_config` por tenant

| Clave | Tipo | Descripción |
|---|---|---|
| `whatsapp_enabled` | bool | WhatsApp activo |
| `whatsapp_instance_name` | string | Nombre instancia Baileys (= schema_name) |
| `whatsapp_instance_status` | string | DISCONNECTED / PENDING_QR / CONNECTED |
| `whatsapp_notify_sale` | bool | Notificar ventas |
| `whatsapp_notify_order_ready` | bool | Notificar taller listo |
| `whatsapp_notify_credit_reminder` | bool | Notificar deuda |
| `whatsapp_notify_quote` | bool | Notificar cotizaciones |
| `whatsapp_template_sale` | text | Plantilla ticket de venta |
| `whatsapp_template_order` | text | Plantilla taller listo |
| `whatsapp_template_credit` | text | Plantilla recordatorio deuda |

### Función compartida `send_whatsapp_message(db, phone, message)`
Exportada desde `whatsapp.py` para uso en otros módulos. Verifica status CONNECTED antes de enviar.

---

## 5. Notificaciones automáticas

### Venta completada — `sales_service.py` línea ~707
```python
# Al crear una venta con cliente que tiene teléfono registrado
# Usa plantilla whatsapp_template_sale con variables:
# {{negocio}}, {{cliente}}, {{id}}, {{metodo_pago}}, {{pagos}}, {{total}}, {{vuelto}}
```
**Variables del mensaje:**
- `{{negocio}}` → nombre del negocio (business_config)
- `{{cliente}}` → nombre del cliente
- `{{id}}` → número de venta con padding 0001
- `{{metodo_pago}}` → Efectivo, Transferencia, etc.
- `{{pagos}}` → líneas con moneda real (💳 Bs / 💵 $)
- `{{total}}` → total en moneda de la venta
- `{{vuelto}}` → vuelto si aplica, vacío si no

**NOTA:** La tasa de cambio NO se muestra al cliente intencionalmente.

### Equipo listo en taller — `routers/services.py` línea ~400
```python
# Cuando order.status cambia a "READY"
# Usa plantilla whatsapp_template_order con variables:
# {{cliente}}, {{equipo}}, {{orden}}, {{total}}, {{negocio}}
```

### Cotización enviada — `routers/quotes.py`
```python
# Endpoint POST /quotes/{id}/send-whatsapp
# Genera PDF con ReportLab y lo envía como documento
# Requiere cliente con teléfono registrado
```

---

## 6. PDF de Cotizaciones

### Generación con ReportLab
- Librería: `reportlab` (ya instalada en el backend)
- Diseño: encabezado con nombre negocio, tabla de productos, total destacado, notas
- Colores: indigo (#4F46E5) como color primario
- Enviado como: archivo `Cotizacion_{id}_{negocio}.pdf` via WhatsApp documento

### Botón en QuoteList
Ícono verde `MessageCircle` en cada cotización → llama `POST /quotes/{id}/send-whatsapp`

---

## 7. Frontend — Tab WhatsApp

### Archivo: `src/pages/Config/tabs/WhatsAppTab.jsx`

**3 estados de la UI:**
1. **Desconectado** → botón "Conectar WhatsApp" + descripción
2. **Pending QR** → imagen QR animada + barra de progreso (expira en 60s) + info
3. **Conectado** → badge verde + botón desconectar + toggles + plantillas + prueba

**Polling:** cada 3 segundos a `/whatsapp/instance/qr`

**Editor de plantillas** (solo visible cuando conectado):
- 3 editores: Ticket venta, Equipo listo, Recordatorio deuda
- Variables como botones clicables para insertar al final
- Guardado automático al perder el foco (onBlur)

---

## 8. Formato del número de teléfono

| Formato | Ejemplo | Resultado |
|---|---|---|
| ✅ Recomendado | `584121234567` | funciona |
| ✅ Acepta | `+58 412 123 4567` | limpiado a `584121234567` |
| ⚠️ Riesgoso | `04121234567` | sin código de país |
| ❌ Evitar | `0412-123-4567` | sin código de país |

El sistema hace `"".join(c for c in phone if c.isdigit())` automáticamente.  
**Venezuela:** código de país `58` + operador (412, 414, 416, 424, 426) + 7 dígitos

---

## 9. Bug history (para no repetir errores)

### Bug 1: search_path no persiste en SQLAlchemy
`SET search_path` en `get_db()` no persiste después de commits o awaits largos.  
**Solución:** Usar SQL con schema explícito: `SELECT FROM "schema".tabla WHERE...`

### Bug 2: Dependencias FastAPI — orden importa
`get_db()` usa `get_tenant_schema()` que depende de que `get_current_active_user` ya haya corrido.  
**Solución:** Poner `current_user` ANTES que `db` en la firma de cada función.

### Bug 3: Evolution API v2 no entrega QR por webhook
`QRCODE_UPDATED` se configuraba pero `webhookBase64` no se podía forzar a `true`.  
**Solución:** Migrar a servicio Baileys propio que devuelve QR en la API directamente.

### Bug 4: NameError en notificaciones de ventas/taller
`webhook_service` y `sale_payments_snapshot` se usaban sin estar definidos en el scope.  
**Solución:** Definir todas las variables de captura ANTES del bloque WhatsApp.

### Bug 5: Comillas Python en SQL dinámico
`WHERE key=''whatsapp_instance_name''` → Python interpreta `''` como string vacío concatenado.  
**Solución:** Usar f-string con `IN (...)` y comillas simples correctamente escapadas.

### Bug 6: `None != "true"` para toggles
Claves no inicializadas devuelven `None` → `None == "true"` es `False` → notificación desactivada.  
**Solución:** Usar `!= "false"` para que `None` sea tratado como habilitado.

---

## 10. Infraestructura removida

Estos servicios fueron instalados y luego eliminados:
- **Evolution API** (`evolution_api` container) — removido, reemplazado por Baileys propio
- **n8n** (`n8n_server` container) — removido, ya no se necesita como dispatcher
- Base de datos `n8n_db` y `evolution_db` — pueden quedar en PostgreSQL sin problema

---

## 11. Cómo reconectar WhatsApp si se pierde la sesión

```bash
# 1. Ver estado del servicio
docker ps --filter "name=whatsapp_service"

# 2. Ver instancias cargadas
curl http://localhost:3000/health  # desde dentro del servidor

# 3. Si la sesión expiró, el frontend mostrará "Desconectado"
# El tenant solo tiene que ir a Configuración → WhatsApp y hacer clic en "Conectar"

# 4. Si el contenedor cayó, se reinicia automáticamente (restart: always)
# Las sesiones persisten en el volumen whatsapp_sessions
```

---

## 12. Deploy a producción

Cuando se haga merge de `feature/customer-360-whatsapp` a `main`:

1. **Reconstruir imagen Baileys:**
```bash
cd /root/deploy/whatsapp-service
docker build -t mi-inventario-whatsapp:1.1 .
```

2. **Actualizar contenedor (prod usa la misma imagen):**
```bash
docker stop whatsapp_service_prod && docker rm whatsapp_service_prod
docker run -d --name whatsapp_service_prod --restart always \
  --network prod_prod_internal \
  -v whatsapp_sessions_prod:/data/sessions \
  mi-inventario-whatsapp:1.1
```

3. **BACKEND_PUBLIC_URL en whatsapp.py** — cambiar de `api-qa` a `api` para producción  
   (aunque ya no se usa webhook, está en el código como referencia)

4. **Inicializar claves en BD de cada tenant:**
```sql
INSERT INTO business_config (key, value) VALUES
  ('whatsapp_notify_sale', 'true'),
  ('whatsapp_template_sale', '...plantilla default...')
ON CONFLICT (key) DO NOTHING;
```
