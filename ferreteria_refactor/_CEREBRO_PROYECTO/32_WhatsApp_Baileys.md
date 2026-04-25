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

---

## 13. Sprint 1 y Sprint 2 — Automatizaciones completadas

> **Fecha:** 2026-04-01

### Sprint 1 ✅

#### Recordatorio de deuda (cron diario configurable)
- **Job:** `job_credit_reminders()` en `services/whatsapp_scheduler.py`
- **Registrado en:** `scheduler.py` → APScheduler
- **Config por tenant en business_config:**
  - `whatsapp_credit_reminder_auto` — true/false (activar envío automático)
  - `whatsapp_credit_reminder_hour` — hora del envío (0–23, default 9)
  - `whatsapp_credit_reminder_days` — días de gracia antes de enviar (1–30, default 1)
- **Endpoint manual:** `POST /whatsapp/credit-reminders/send-now` — envío inmediato
- **UI:** Sección expandible en WhatsApp tab con toggle auto/manual, selector de hora y slider de días

#### Orden recibida en taller
- **Inyectado en:** `routers/services.py` → `create_service_order()` tras `db.commit()`
- **Mensaje incluye:** nombre del equipo, número de ticket, descripción del problema, fecha estimada
- **Condición:** cliente con teléfono + WhatsApp CONNECTED + `whatsapp_notify_order_ready != "false"`

#### Confirmación de abono de crédito
- **Inyectado en:** `services/sales_service.py` → `register_payment()` tras `db.commit()`
- **Mensaje incluye:** monto pagado (con moneda), número de factura, saldo restante
- **Si saldo = 0:** *"¡Saldo cancelado completamente!"*
- **Condición:** cliente con teléfono + WhatsApp CONNECTED + `whatsapp_notify_sale != "false"`

---

### Sprint 2 ✅

#### Alerta de stock bajo (cron diario)
- **Job:** `job_stock_alerts()` en `services/whatsapp_scheduler.py`
- **Horario:** 8:00am Venezuela (antes de abrir) — `id="whatsapp_stock_alerts"`
- **Destinatario:** número del admin (`whatsapp_admin_phone` en business_config)
- **Lógica:** Productos donde `stock <= min_stock AND min_stock > 0 AND is_active`
- **Config:** `whatsapp_notify_stock` — true por defecto, false para desactivar
- **Muestra:** top 20 productos más críticos (ordenados por stock/min_stock ASC)

#### Resumen de cierre de caja
- **Función:** `send_cash_session_summary(schema, session_id)` en `whatsapp_scheduler.py`
- **Disparador:** `routers/cash/sessions.py` → al final del endpoint de cierre de sesión
- **Destinatario:** número del admin (`whatsapp_admin_phone`)
- **Incluye:** fecha, hora inicio-fin, total ventas, total USD y Bs
- **Config:** `whatsapp_notify_cash_summary` — true por defecto

---

## 14. Claves nuevas en business_config (Sprint 1+2)

```sql
INSERT INTO business_config (key, value) VALUES
  ('whatsapp_credit_reminder_auto',    'true'),
  ('whatsapp_credit_reminder_hour',    '9'),
  ('whatsapp_credit_reminder_days',    '1'),
  ('whatsapp_notify_stock',            'true'),
  ('whatsapp_notify_cash_summary',     'true')
ON CONFLICT (key) DO NOTHING;
```

---

## 15. Roadmap de automatizaciones — estado actualizado

| Sprint | Feature | Estado |
|---|---|---|
| 1 | Recordatorio de deuda (configurable) | ✅ Completado |
| 1 | Orden recibida en taller | ✅ Completado |
| 1 | Confirmación de abono | ✅ Completado |
| 2 | Alerta de stock bajo (admin) | ✅ Completado |
| 2 | Resumen de cierre de caja (admin) | ✅ Completado |
| 3 | Bienvenida cliente nuevo | ⏳ Pendiente |
| 3 | Cotización por vencer | ⏳ Pendiente |
| 3 | Garantía próxima a vencer | ⏳ Pendiente |

---

## 16. Configuración de recordatorio de deuda — UI

La pantalla de WhatsApp Business muestra una sección expandible de configuración:

- **Toggle Automático/Manual:** si está en Manual, el admin decide cuándo enviar pulsando "Enviar ahora"
- **Hora del envío:** dropdown 00:00 → 23:00 (solo si automático está activo)
- **Días de gracia:** slider 1–30 días — "enviar recordatorio a partir de X días vencido"
- **Botón "Enviar ahora":** dispara `POST /whatsapp/credit-reminders/send-now` — envío inmediato para todos los clientes con saldo vencido

El scheduler respeta la configuración de CADA tenant individualmente. Tenants con `credit_reminder_auto=false` no reciben el cron aunque el scheduler esté corriendo.

---

## 17. Sprint 3 — Automatizaciones completadas

> **Fecha:** 2026-04-01

### Bienvenida cliente nuevo ✅
- **Inyectado en:** `routers/customers.py` → `create_customer()` tras `db.commit()`
- **Condición:** cliente con teléfono + `whatsapp_notify_welcome != "false"`
- **Plantilla editable:** `whatsapp_template_welcome` — variables: `{{cliente}}`, `{{negocio}}`

### Cotización por vencer ✅
- **Job:** `job_quote_expiry_reminders()` — cron 10:00am Venezuela
- **Lógica:** cotizaciones con `status=PENDING` y `valid_until = hoy + 2 días`
- **Config:** `whatsapp_notify_quote_expiry`

### Garantía próxima a vencer ✅
- **Job:** `job_warranty_reminders()` — cron 10:30am Venezuela
- **Lógica:** órdenes `COMPLETED` con `warranty_expires_at = hoy + 7 días`
- **Config:** `whatsapp_notify_warranty`

---

## 18. Estado final de automatizaciones (completo)

| # | Automatización | Cron/Trigger | Dest | Config key |
|---|---|---|---|---|
| 1 | Ticket de venta | Al cobrar | Cliente | `whatsapp_notify_sale` |
| 2 | Cotización PDF | Manual (botón) | Cliente | `whatsapp_notify_quote` |
| 3 | Orden recibida taller | Al crear orden | Cliente | `whatsapp_notify_order_ready` |
| 4 | Equipo listo taller | Estado → LISTO | Cliente | `whatsapp_notify_order_ready` |
| 5 | Confirmación abono | Al registrar pago | Cliente | `whatsapp_notify_sale` |
| 6 | Recordatorio deuda | Configurable (9am default) | Cliente | `whatsapp_notify_credit_reminder` |
| 7 | Bienvenida cliente nuevo | Al crear cliente | Cliente | `whatsapp_notify_welcome` |
| 8 | Cotización por vencer | 10:00am — 2d antes | Cliente | `whatsapp_notify_quote_expiry` |
| 9 | Garantía por vencer | 10:30am — 7d antes | Cliente | `whatsapp_notify_warranty` |
| 10 | Alerta stock bajo | 8:00am diario | Admin | `whatsapp_notify_stock` |
| 11 | Resumen cierre caja | Al cerrar sesión | Admin | `whatsapp_notify_cash_summary` |

### Jobs en APScheduler
| ID | Función | Horario |
|---|---|---|
| `whatsapp_credit_reminders` | `job_credit_reminders` | 9:00am VE (configurable) |
| `whatsapp_stock_alerts` | `job_stock_alerts` | 8:00am VE |
| `whatsapp_quote_expiry` | `job_quote_expiry_reminders` | 10:00am VE |
| `whatsapp_warranty_reminders` | `job_warranty_reminders` | 10:30am VE |

### Inicializar BD en nuevos tenants
```sql
INSERT INTO business_config (key, value) VALUES
  ('whatsapp_enabled',             'false'),
  ('whatsapp_instance_name',       ''),
  ('whatsapp_instance_status',     'DISCONNECTED'),
  ('whatsapp_notify_sale',         'true'),
  ('whatsapp_notify_order_ready',  'true'),
  ('whatsapp_notify_credit_reminder','true'),
  ('whatsapp_notify_quote',        'false'),
  ('whatsapp_notify_welcome',      'true'),
  ('whatsapp_notify_quote_expiry', 'true'),
  ('whatsapp_notify_warranty',     'true'),
  ('whatsapp_notify_stock',        'true'),
  ('whatsapp_notify_cash_summary', 'true'),
  ('whatsapp_admin_phone',         ''),
  ('whatsapp_credit_reminder_auto','true'),
  ('whatsapp_credit_reminder_hour','9'),
  ('whatsapp_credit_reminder_days','1')
ON CONFLICT (key) DO NOTHING;
```
