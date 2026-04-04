# 50 — Integración WhatsApp — Guía Completa para Reimplementar

> **Propósito:** Documento técnico completo para que cualquier desarrollador
> pueda entender cómo se implementó el sistema de envío de mensajes por
> WhatsApp en Mi Inventario Fácil y replicarlo en otro proyecto.
>
> **Fecha:** 2026-04-04
> **Estado:** ✅ En producción — funcionando

---

## 1. Contexto y decisiones de arquitectura

### ¿Por qué WhatsApp y no otro canal?

El cliente objetivo (pequeños negocios venezolanos) tiene WhatsApp como
canal principal de comunicación con sus clientes. Email tiene baja tasa
de apertura. SMS es caro. WhatsApp llega inmediatamente.

### Opciones evaluadas

| Opción | Pros | Contras | Decisión |
|---|---|---|---|
| **Meta Business API oficial** | Legal, escalable, sin riesgo de baneo | Requiere número dedicado, aprobación Meta, costo por mensaje | Descartada para MVP |
| **Evolution API v2 + n8n** | Popular, bien documentado, n8n como orquestador | QR no llegaba al frontend (webhook no entregaba base64), complejo | Descartada |
| **Evolution API v1** | Más simple | Versión vieja, sin mantenimiento activo | Descartada |
| **Baileys propio (elegida)** | Control total del QR, sin intermediarios, sin webhooks externos, sesiones persistentes | Uso no oficial de WA Web | ✅ Elegida |

### ¿Qué es Baileys?

Baileys (`@whiskeysockets/baileys`) es una librería Node.js de código abierto
que implementa el protocolo de WhatsApp Web mediante WebSocket.
Permite enviar y recibir mensajes sin usar la API oficial de Meta.

**Limitaciones importantes:**
- Usa el protocolo no oficial de WhatsApp Web
- Un número puede ser baneado si envía spam masivo
- Para uso transaccional (tickets, confirmaciones, recordatorios) el riesgo es bajo
- Recomendación: máximo 200 mensajes/día por número

---

## 2. Arquitectura final implementada

```
Usuario del negocio (browser)
    │
    │ polling cada 3s → GET /whatsapp/instance/qr
    ▼
Backend FastAPI (api.miinventariofacil.com)
    │
    │ HTTP interno Docker (red web_publica)
    │ http://whatsapp_service:3000
    ▼
Servicio Baileys (Node.js + Express)
    │
    │ WebSocket persistente
    ▼
WhatsApp Web (servidores Meta)
    │
    │ Mensaje de texto / PDF
    ▼
📱 Teléfono del cliente final
```

### Componentes del sistema

| Componente | Tecnología | Función |
|---|---|---|
| Backend API | FastAPI (Python) | Orquestar todo, guardar config en BD |
| Servicio Baileys | Node.js + Express | Manejar sesiones WA, enviar mensajes |
| Base de datos | PostgreSQL | Guardar configuración por tenant |
| Frontend | React | UI para conectar WA y configurar mensajes |
| Scheduler | APScheduler | Jobs automáticos (recordatorios, alertas) |

---

## 3. El servicio Baileys — Implementación detallada

### 3.1 Estructura de archivos

```
/root/deploy/whatsapp-service/
├── server.js          # Servicio Express + Baileys (~200 líneas)
├── package.json       # Dependencias
└── Dockerfile         # node:20-alpine
```

### 3.2 Dependencias (package.json)

```json
{
  "type": "module",
  "dependencies": {
    "@whiskeysockets/baileys": "^6.7.x",
    "express": "^4.x",
    "qrcode": "^1.5.x",
    "pino": "^8.x",
    "pino-pretty": "^10.x"
  }
}
```

### 3.3 Modelo multi-tenant en memoria

Cada tenant tiene su propia instancia de Baileys corriendo en el mismo proceso Node.js:

```javascript
// instances = { tenantId: { sock, status, qrBase64, retries } }
const instances = {};

// Estados posibles de cada instancia:
// 'connecting'   → iniciando la conexión
// 'pending_qr'   → QR generado, esperando escaneo
// 'open'         → conectado y listo para enviar
// 'disconnected' → sesión cerrada o expirada
```

### 3.4 Flujo de conexión de un nuevo número

```
1. Frontend hace POST /instance/{tenantId}/connect
2. Baileys crea la sesión (o la carga desde /data/sessions/{tenantId}/)
3. Si es primera vez → genera QR code como PNG base64
4. Frontend hace polling GET /instance/{tenantId}/qr cada 3s
5. Cuando hay QR → muestra la imagen en pantalla
6. Usuario escanea con su WhatsApp
7. Baileys recibe connection.update con state='open'
8. Frontend detecta status='CONNECTED' → muestra ✅
```

### 3.5 Persistencia de sesiones

Las sesiones se guardan en archivos en `/data/sessions/{tenantId}/`.
Al reiniciar el contenedor, Baileys restaura la sesión automáticamente
sin necesidad de escanear el QR de nuevo.

```bash
# Volumen Docker para persistencia
docker volume create whatsapp_sessions
docker run -v whatsapp_sessions:/data/sessions ...
```

### 3.6 Endpoints del servicio Baileys

| Método | Endpoint | Descripción |
|---|---|---|
| GET | `/health` | Estado del servicio y lista de instancias |
| POST | `/instance/:tenantId/connect` | Crear o reconectar instancia |
| GET | `/instance/:tenantId/qr` | Obtener QR como base64 PNG |
| GET | `/instance/:tenantId/status` | Estado: pending_qr / open / disconnected |
| DELETE | `/instance/:tenantId` | Desconectar y limpiar sesión |
| POST | `/instance/:tenantId/send` | Enviar mensaje de texto |
| POST | `/instance/:tenantId/send-document` | Enviar archivo PDF |

### 3.7 Formato del teléfono

```
Venezuela: 58 + operadora(3 dígitos) + número(7 dígitos)
Ejemplo:   584121234567

El sistema limpia el teléfono automáticamente:
phone_clean = "".join(c for c in phone if c.isdigit())
```

### 3.8 Dockerfile del servicio

```dockerfile
FROM node:20-alpine
RUN apk add --no-cache git python3 make g++
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```

### 3.9 Arrancar el contenedor

```bash
docker run -d \
  --name whatsapp_service \
  --restart always \
  --network web_publica \
  -v whatsapp_sessions:/data/sessions \
  -e PORT=3000 \
  mi-inventario-whatsapp:1.1
```

---

## 4. Backend FastAPI — Implementación

### 4.1 Router whatsapp.py

```
backend_api/routers/whatsapp.py
```

El router actúa como proxy entre el frontend y el servicio Baileys.
También guarda el estado de la conexión en la BD del tenant.

**Endpoints FastAPI:**

| Endpoint | Método | Descripción |
|---|---|---|
| `/whatsapp/config` | GET | Configuración + plantillas del tenant |
| `/whatsapp/config` | POST | Guardar toggles y plantillas |
| `/whatsapp/instance/create` | POST | Iniciar conexión (llama Baileys) |
| `/whatsapp/instance/qr` | GET | Polling del QR (llama Baileys) |
| `/whatsapp/instance/status` | GET | Estado actual |
| `/whatsapp/instance/disconnect` | POST | Desconectar |
| `/whatsapp/test` | POST | Enviar mensaje de prueba |
| `/whatsapp/send-message` | POST | Enviar mensaje manual (Customer360) |
| `/whatsapp/credit-reminders/send-now` | POST | Disparar recordatorios ahora |

### 4.2 Función compartida send_whatsapp_message

Esta función se exporta y se usa en todos los módulos que necesitan
enviar mensajes:

```python
async def send_whatsapp_message(db: Session, phone: str, message: str) -> bool:
    """
    Envía un mensaje por WhatsApp usando el servicio Baileys.
    Retorna True si se envió correctamente, False si no.
    """
    # 1. Verificar que WhatsApp está habilitado y conectado
    enabled = _get(db, KEY_ENABLED) == "true"
    status  = _get(db, KEY_STATUS)
    inst    = _get(db, KEY_INSTANCE)

    if not enabled or not inst or status != "CONNECTED":
        return False

    # 2. Limpiar el teléfono (solo dígitos)
    clean = "".join(c for c in phone if c.isdigit())
    if len(clean) < 7:
        return False

    # 3. Llamar al servicio Baileys
    await _wa("post", f"/instance/{inst}/send",
              json={"phone": clean, "message": message})
    return True
```

### 4.3 Configuración en business_config (por tenant)

Cada tenant tiene sus propias claves en la tabla `business_config`:

```sql
-- Conexión
'whatsapp_enabled'             → 'true'/'false'
'whatsapp_instance_name'       → schema del tenant (ej: 'oscarcell')
'whatsapp_instance_status'     → 'DISCONNECTED'/'PENDING_QR'/'CONNECTED'

-- Notificaciones a clientes
'whatsapp_notify_sale'         → 'true'/'false'  (ticket de venta)
'whatsapp_notify_order_ready'  → 'true'/'false'  (taller listo)
'whatsapp_notify_credit_reminder' → 'true'/'false' (recordatorio deuda)
'whatsapp_notify_quote'        → 'true'/'false'  (cotizaciones)
'whatsapp_notify_welcome'      → 'true'/'false'  (bienvenida cliente nuevo)
'whatsapp_notify_quote_expiry' → 'true'/'false'  (cotización por vencer)
'whatsapp_notify_warranty'     → 'true'/'false'  (garantía por vencer)

-- Notificaciones al admin
'whatsapp_admin_phone'         → '584121234567'  (teléfono del dueño)
'whatsapp_notify_stock'        → 'true'/'false'  (alerta stock bajo)
'whatsapp_notify_cash_summary' → 'true'/'false'  (resumen cierre caja)

-- Recordatorio de deuda (configurable)
'whatsapp_credit_reminder_auto' → 'true'/'false'
'whatsapp_credit_reminder_hour' → '9' (hora 0-23)
'whatsapp_credit_reminder_days' → '1' (días de gracia)

-- Plantillas de mensajes editables
'whatsapp_template_sale'       → texto con variables {{negocio}}, {{cliente}}...
'whatsapp_template_order'      → texto con variables {{cliente}}, {{equipo}}...
'whatsapp_template_credit'     → texto con variables {{cliente}}, {{monto}}...
'whatsapp_template_welcome'    → texto con variables {{cliente}}, {{negocio}}
```

### 4.4 Inicializar claves para tenant nuevo

```sql
INSERT INTO business_config (key, value) VALUES
  ('whatsapp_enabled',              'false'),
  ('whatsapp_instance_name',        ''),
  ('whatsapp_instance_status',      'DISCONNECTED'),
  ('whatsapp_notify_sale',          'true'),
  ('whatsapp_notify_order_ready',   'true'),
  ('whatsapp_notify_credit_reminder','true'),
  ('whatsapp_notify_quote',         'false'),
  ('whatsapp_notify_welcome',       'true'),
  ('whatsapp_notify_quote_expiry',  'true'),
  ('whatsapp_notify_warranty',      'true'),
  ('whatsapp_notify_stock',         'true'),
  ('whatsapp_notify_cash_summary',  'true'),
  ('whatsapp_admin_phone',          ''),
  ('whatsapp_credit_reminder_auto', 'true'),
  ('whatsapp_credit_reminder_hour', '9'),
  ('whatsapp_credit_reminder_days', '1')
ON CONFLICT (key) DO NOTHING;
```

---

## 5. Puntos de disparo de mensajes automáticos

### 5.1 Al completar una venta — sales_service.py

```python
# Al final de create_sale() después del db.commit()
if customer and customer.phone:
    template = _get_config(db, "whatsapp_template_sale") or TPL_SALE_DEFAULT
    message  = template.replace("{{negocio}}", business_name) \
                       .replace("{{cliente}}", customer.name) \
                       .replace("{{total}}", str(total))
    await send_whatsapp_message(db, customer.phone, message)
```

**Variables disponibles en la plantilla de venta:**
- `{{negocio}}` → nombre del negocio
- `{{cliente}}` → nombre del cliente
- `{{id}}` → número de factura (ej: VEN-0001)
- `{{metodo_pago}}` → método de pago
- `{{pagos}}` → detalle de pagos por moneda
- `{{total}}` → total de la venta
- `{{vuelto}}` → vuelto si aplica

### 5.2 Al cambiar orden a LISTO — routers/services.py

```python
# Cuando se actualiza el status de una orden a 'READY'
if new_status == 'READY' and order.customer.phone:
    message = template_order \
        .replace("{{cliente}}", order.customer.name) \
        .replace("{{equipo}}", f"{order.brand} {order.model}") \
        .replace("{{orden}}", order.ticket_number)
    await send_whatsapp_message(db, order.customer.phone, message)
```

### 5.3 Al crear un cliente nuevo — routers/customers.py

```python
# Después de db.commit() en create_customer()
if customer.phone and notify_welcome:
    message = template_welcome \
        .replace("{{cliente}}", customer.name) \
        .replace("{{negocio}}", business_name)
    await send_whatsapp_message(db, customer.phone, message)
```

### 5.4 Al registrar un abono de crédito — sales_service.py

```python
# Después de registrar el pago parcial
if customer.phone:
    mensaje = f"Hola {customer.name}! ✅ Recibimos tu abono de " \
              f"${payment_amount:.2f}.\n" \
              f"Saldo restante: ${remaining:.2f}"
    await send_whatsapp_message(db, customer.phone, mensaje)
```

---

## 6. Jobs automáticos (APScheduler)

### 6.1 Configuración del scheduler

```python
# En backend_api/services/whatsapp_scheduler.py
from apscheduler.schedulers.asyncio import AsyncIOScheduler

scheduler = AsyncIOScheduler(timezone="America/Caracas")

# Al iniciar la app (main.py lifespan)
scheduler.add_job(job_credit_reminders,   'cron', hour=9,    id='whatsapp_credit_reminders')
scheduler.add_job(job_stock_alerts,       'cron', hour=8,    id='whatsapp_stock_alerts')
scheduler.add_job(job_quote_expiry,       'cron', hour=10,   id='whatsapp_quote_expiry')
scheduler.add_job(job_warranty_reminders, 'cron', hour=10,   minute=30, id='whatsapp_warranty')
scheduler.start()
```

### 6.2 Recordatorio de deuda — job_credit_reminders()

```python
async def job_credit_reminders():
    """
    Corre a las 9am Venezuela (configurable por tenant).
    Envía recordatorio a clientes con deuda vencida.
    """
    # Para cada tenant activo con WhatsApp conectado:
    # 1. Leer config: auto=true, hour=9, days=1
    # 2. Si la hora configurada coincide con la hora actual → ejecutar
    # 3. Buscar clientes con balance_pending > 0 y deuda vencida > N días
    # 4. Enviar mensaje personalizado a cada uno
```

### 6.3 Alerta de stock bajo — job_stock_alerts()

```python
async def job_stock_alerts():
    """
    Corre a las 8am Venezuela.
    Envía alerta al admin con los productos bajo el mínimo.
    """
    # Para cada tenant con whatsapp_notify_stock='true':
    # 1. Buscar productos donde stock <= min_stock AND min_stock > 0
    # 2. Ordenar por criticidad (stock/min_stock ASC)
    # 3. Enviar lista de los top 20 al número del admin
```

### 6.4 Resumen de cierre de caja

```python
# Disparado en routers/cash/sessions.py al cerrar sesión
async def send_cash_session_summary(schema: str, session_id: int):
    """
    Envía al admin un resumen de la sesión de caja cerrada.
    """
    # Datos: hora apertura, hora cierre, total ventas,
    #        total en USD, total en Bs, número de transacciones
```

---

## 7. Frontend React — UI de configuración

### 7.1 Archivo principal

```
src/pages/Config/tabs/WhatsAppTab.jsx
```

### 7.2 Estados de la UI

**Estado 1 — Desconectado:**
- Botón "Conectar WhatsApp"
- Descripción de qué hace el módulo
- Al hacer clic → POST `/whatsapp/instance/create`

**Estado 2 — Mostrando QR (PENDING_QR):**
- Imagen del QR (base64 PNG) mostrada con `<img>`
- Barra de progreso (el QR expira en ~60 segundos)
- Polling cada 3 segundos a `GET /whatsapp/instance/qr`
- Al detectar status='CONNECTED' → pasar al estado 3

**Estado 3 — Conectado (CONNECTED):**
- Badge verde "✅ WhatsApp Conectado"
- Botón "Desconectar"
- Toggles de notificaciones (por tipo)
- Editores de plantillas de mensajes
- Variables disponibles como botones clicables
- Botón "Enviar mensaje de prueba"

### 7.3 Lógica de polling

```javascript
useEffect(() => {
  if (status !== 'PENDING_QR') return;

  const interval = setInterval(async () => {
    const res = await apiClient.get('/whatsapp/instance/qr');
    if (res.data.status === 'CONNECTED') {
      setStatus('CONNECTED');
      clearInterval(interval);
    } else if (res.data.qr) {
      setQrBase64(res.data.qr);
    }
  }, 3000);

  return () => clearInterval(interval);
}, [status]);
```

### 7.4 Editor de plantillas con variables

```jsx
// Variables disponibles como botones clicables
const VARIABLES_SALE = [
  { label: '{{negocio}}',     desc: 'Nombre del negocio' },
  { label: '{{cliente}}',     desc: 'Nombre del cliente' },
  { label: '{{id}}',          desc: 'Número de factura' },
  { label: '{{metodo_pago}}', desc: 'Forma de pago' },
  { label: '{{total}}',       desc: 'Total de la venta' },
  { label: '{{vuelto}}',      desc: 'Vuelto (si aplica)' },
];

// Al hacer clic en una variable → insertar al final del textarea
const insertVariable = (variable) => {
  setTemplate(prev => prev + variable);
};
```

---

## 8. Customer 360 — Botones de acción WhatsApp

### 8.1 Componente WaButton en Customer360.jsx

Los botones de WhatsApp en la vista Customer 360 envían mensajes
directamente por Baileys (no abriendo wa.me):

```jsx
const WaButton = ({ phone, label, icon: Icon, message, color }) => {
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    setSending(true);
    try {
      await apiClient.post('/whatsapp/send-message', { phone, message });
      toast.success('✅ Mensaje enviado por WhatsApp');
    } catch (e) {
      if (e?.response?.status === 503) {
        // WhatsApp no conectado → fallback a wa.me
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`);
      }
    } finally {
      setSending(false);
    }
  };
  // ...
};
```

### 8.2 Botones disponibles en Customer 360

| Botón | Visible cuando | Mensaje |
|---|---|---|
| 💛 Cobrar crédito $X | Cliente tiene saldo > 0 | Recordatorio de deuda con monto exacto |
| 💙 Enviar recordatorio | Cliente tiene teléfono | Mensaje de contacto general |
| 💚 Nuevos productos | Cliente tiene teléfono | Mensaje de reactivación |

### 8.3 El nombre del negocio en los mensajes

```jsx
// El Customer360 obtiene el nombre del negocio del ConfigContext
const { business } = useConfig();
const bizName = business?.name || 'Mi Inventario';

// Uso en los mensajes
message={`Hola ${c.name}! 👋\n\nTe recordamos desde *${bizName}* que tienes...`}
```

---

## 9. Historial de errores resueltos (importante para reimplementar)

### Error 1: QR no llegaba al frontend con Evolution API
**Síntoma:** El webhook `QRCODE_UPDATED` no incluía base64 del QR.
**Causa:** Evolution API v2 no permite forzar `webhookBase64=true` en runtime.
**Solución:** Migrar a Baileys propio que devuelve el QR directamente en la API.

### Error 2: search_path no persiste en SQLAlchemy multi-tenant
**Síntoma:** Consultas SQL fallan con "relation does not exist" después de commits.
**Causa:** `SET search_path` se resetea en cada transacción nueva.
**Solución:** Usar schema explícito en las queries: `SELECT FROM "schema".tabla`.

### Error 3: Dependencias de FastAPI — orden importa
**Síntoma:** get_tenant_schema() retorna None.
**Causa:** El middleware de tenant aún no corrió cuando get_db() se llama.
**Solución:** Poner `current_user: User = Depends(get_current_active_user)`
ANTES que `db: Session = Depends(get_db)` en cada función.

### Error 4: NameError en notificaciones
**Síntoma:** `NameError: name 'webhook_service' is not defined`
**Causa:** Variables de captura usadas antes de ser definidas.
**Solución:** Definir todas las variables de captura ANTES del bloque WhatsApp.

### Error 5: None vs "true"/"false" en toggles
**Síntoma:** Las notificaciones nunca se envían aunque estén activas.
**Causa:** Claves no inicializadas devuelven None. `None == "true"` es False.
**Solución:** Usar `!= "false"` para que None sea tratado como habilitado:
```python
# MAL
if _get(db, KEY_NOTIFY_SALE) == "true":
# BIEN
if _get(db, KEY_NOTIFY_SALE) != "false":
```

### Error 6: Toast del 403 visible para cajeros
**Síntoma:** Cajeros ven "No tienes permisos" al entrar al Dashboard.
**Causa:** AutoSyncContext llamaba PUT /config/cloud_url para todos los usuarios.
**Solución:** Verificar el rol antes de hacer la llamada:
```javascript
if (user?.role !== 'ADMIN') return;
```

### Error 7: WaButton abría wa.me en lugar de enviar directo
**Síntoma:** Al presionar el botón de WhatsApp se abría WhatsApp Web.
**Causa:** Los botones usaban links `wa.me` en lugar de llamar al backend.
**Solución:** Convertir los botones de `<a href>` a `<button onClick>`
que llaman a `POST /whatsapp/send-message`.

---

## 10. Resumen de automatizaciones implementadas

| # | Automatización | Trigger | Destinatario | Configurable |
|---|---|---|---|---|
| 1 | Ticket de venta | Al cobrar | Cliente | toggle |
| 2 | Cotización PDF | Botón manual | Cliente | toggle |
| 3 | Orden recibida taller | Al crear orden | Cliente | toggle |
| 4 | Equipo listo en taller | Estado → LISTO | Cliente | toggle |
| 5 | Confirmación de abono | Al registrar pago | Cliente | toggle |
| 6 | Recordatorio de deuda | Cron (configurable) | Cliente | hora + días |
| 7 | Bienvenida cliente nuevo | Al crear cliente | Cliente | toggle |
| 8 | Cotización por vencer | Cron 10:00am | Cliente | toggle |
| 9 | Garantía por vencer | Cron 10:30am | Cliente | toggle |
| 10 | Alerta stock bajo | Cron 8:00am | Admin | toggle |
| 11 | Resumen cierre de caja | Al cerrar sesión | Admin | toggle |

---

## 11. Cómo reimplementar en otro proyecto

### Paso 1 — Levantar el servicio Baileys

```bash
# Copiar /root/deploy/whatsapp-service/ al nuevo proyecto
cd nuevo-proyecto/whatsapp-service
docker build -t mi-app-whatsapp:1.0 .
docker run -d --name whatsapp_svc \
  --restart always \
  --network mi-red-interna \
  -v whatsapp_sessions:/data/sessions \
  mi-app-whatsapp:1.0
```

### Paso 2 — Crear el router en el backend

```python
# Copiar backend_api/routers/whatsapp.py
# Cambiar solo:
WA_URL = "http://whatsapp_svc:3000"  # nombre del contenedor

# La función send_whatsapp_message() es reutilizable tal cual
```

### Paso 3 — Crear la tabla de configuración

```sql
-- Si el proyecto no tiene business_config, crear una tabla equivalente:
CREATE TABLE app_config (
  id    SERIAL PRIMARY KEY,
  key   VARCHAR(100) UNIQUE NOT NULL,
  value TEXT
);

-- Insertar claves iniciales (ver sección 4.4 de este documento)
```

### Paso 4 — Inyectar envíos en los puntos de negocio

```python
# En cualquier función donde quieras enviar un mensaje:
from .whatsapp import send_whatsapp_message

async def completar_pedido(pedido, db):
    # ... lógica del negocio ...
    db.commit()

    # Enviar confirmación por WhatsApp
    if pedido.cliente.telefono:
        await send_whatsapp_message(
            db=db,
            phone=pedido.cliente.telefono,
            message=f"✅ Tu pedido #{pedido.id} está listo!"
        )
```

### Paso 5 — Crear la UI de configuración

Copiar `src/pages/Config/tabs/WhatsAppTab.jsx` y adaptar:
- Cambiar las URLs de los endpoints
- Ajustar las plantillas de mensajes al negocio
- Mantener la lógica de polling del QR

### Paso 6 — Configurar el scheduler (si se necesitan jobs automáticos)

```python
# Copiar backend_api/services/whatsapp_scheduler.py
# Ajustar las queries SQL al schema de tu BD
# Registrar los jobs en el lifespan de FastAPI
```

---

## 12. Infraestructura instalada y luego removida

Estos servicios fueron instalados durante la evaluación y luego eliminados.
Se mencionan para contexto histórico:

- **Evolution API** (`evolution_api` container) — removido, reemplazado por Baileys
- **n8n** (`n8n_server` container) — removido, ya no se necesita
- **evolution_db**, **n8n_db** en PostgreSQL — pueden quedar sin problema

---

## 13. Archivos clave del proyecto

```
backend_api/routers/whatsapp.py           ← Router + función send_whatsapp_message
backend_api/services/whatsapp_scheduler.py ← Jobs automáticos (cron)
backend_api/routers/sales_service.py      ← Trigger: venta completada
backend_api/routers/services.py           ← Trigger: taller listo
backend_api/routers/customers.py          ← Trigger: cliente nuevo + botones 360
backend_api/routers/cash/sessions.py      ← Trigger: cierre de caja

frontend/src/pages/Config/tabs/WhatsAppTab.jsx  ← UI config WhatsApp
frontend/src/components/customers/Customer360.jsx ← Botones WA en perfil cliente

/root/deploy/whatsapp-service/server.js   ← Servicio Baileys Node.js
/root/deploy/whatsapp-service/Dockerfile  ← Build del servicio
```
