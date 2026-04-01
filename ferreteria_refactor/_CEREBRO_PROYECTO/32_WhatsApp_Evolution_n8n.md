# 32 — WhatsApp Business: Evolution API + n8n

> **Creado:** 2026-04-01  
> **Estado:** Infraestructura instalada — pendiente implementación de webhooks y UI

---

## 1. Infraestructura instalada

### Servicios corriendo en producción

| Servicio | URL | Versión | Estado |
|---|---|---|---|
| Evolution API | https://evo.miinventariofacil.com | v2.2.3 | ✅ Up |
| n8n | https://n8n.miinventariofacil.com | latest | ✅ Up |

### Credenciales (guardar en lugar seguro)

```
Evolution API Key: 3dae0a60c42c32a42cecbc23e2620802a3797b97e6476aa5d5f1530881ef66af
Evolution DB:      postgresql://postgres:GaboMac12@db_prod_server:5432/evolution_db
n8n Encryption:    38c242e6663d43133d970ce72df2595f9560eb5f0e8700319884e446f690f87c
n8n DB:            postgresql://postgres:GaboMac12@db_prod_server:5432/n8n_db
```

### Redes Docker
Ambos contenedores están conectados a **dos redes**:
- `web_publica` — para que Traefik los enrute con SSL
- `prod_prod_internal` — para que puedan ver `db_prod_server`

### Archivos de configuración
```
/root/deploy/whatsapp/docker-compose.yml  ← definición de servicios
/root/deploy/whatsapp/.env                ← credenciales
```

---

## 2. Arquitectura del sistema

```
┌─────────────────────────────────────────────────────────┐
│                   MI INVENTARIO FÁCIL                   │
│                                                          │
│  POS / Taller / Créditos                                 │
│         │                                                │
│   Evento ocurre                                          │
│  (venta, taller listo, deuda vencida)                   │
│         │                                                │
│   Backend dispara webhook POST                           │
│   → POST https://n8n.miinventariofacil.com/webhook/xxx  │
└─────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────┐
│                        n8n                               │
│                                                          │
│  Recibe el evento                                        │
│  Identifica el tenant                                    │
│  Busca la instancia de WhatsApp del tenant               │
│  Formatea el mensaje según la plantilla                  │
│  Llama a Evolution API                                   │
└─────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────┐
│                   Evolution API                          │
│                                                          │
│  Instancia: ferreteria_abc (número +58 412 xxx xxxx)    │
│  Envía el mensaje al cliente final                       │
└─────────────────────────────────────────────────────────┘
              │
              ▼
        📱 WhatsApp del cliente
```

---

## 3. Modelo multi-tenant de instancias

Cada negocio (tenant) tiene su propia instancia en Evolution API.
El nombre de la instancia es igual al `tenant_id` del sistema.

```
Evolution API
├── instance: ferreteria_el_progreso  → +58 412 111 1111
├── instance: taller_tecnorep         → +58 414 222 2222
├── instance: bodega_la_familia       → +58 416 333 3333
└── instance: repuestos_pedro         → +58 424 444 4444
```

**Ciclo de vida de una instancia:**
1. Admin activa WhatsApp en Configuración → WhatsApp
2. Backend crea la instancia en Evolution API via API REST
3. Evolution API genera QR code
4. El dueño del negocio escanea el QR con su teléfono
5. La instancia queda conectada y puede enviar mensajes
6. El backend guarda `whatsapp_instance_name` y `whatsapp_status` en la BD

---

## 4. Eventos configurados (webhooks salientes)

### 4.1 Venta completada — `sale.completed`
**Trigger:** Al confirmar el cobro en el POS  
**Destinatario:** Teléfono del cliente (si tiene teléfono registrado)  
**Mensaje:**
```
🧾 *[Nombre del negocio]*
¡Gracias por tu compra, [nombre_cliente]!

Factura: VEN-00847
📅 [fecha] — [hora]

[lista de productos]

💵 Total: $[total]
✅ Pagado: [método]

¡Gracias por preferirnos!
```

### 4.2 Orden de taller lista — `order.ready`
**Trigger:** Al cambiar el estado de la orden a LISTO  
**Destinatario:** Teléfono del cliente de la orden  
**Mensaje:**
```
🔧 *[Nombre del negocio]*
¡Hola [nombre]! Tu equipo está listo 🎉

📱 [marca] [modelo]
🎫 Orden: [ticket_number]
💰 Total: $[monto]

Puedes pasar a buscarlo en nuestro horario habitual.
¡Te esperamos!
```

### 4.3 Recordatorio de deuda — `credit.reminder`
**Trigger:** Cron job diario — clientes con deuda vencida > 3 días  
**Destinatario:** Teléfono del cliente deudor  
**Mensaje:**
```
💳 *[Nombre del negocio]*
Hola [nombre], te recordamos que tienes
un saldo pendiente de *$[monto]*.

Fecha límite: [fecha]

Para consultas, escríbenos aquí mismo.
¡Gracias!
```

### 4.4 Cotización enviada — `quote.sent`
**Trigger:** Al crear/guardar una cotización con cliente asignado  
**Destinatario:** Teléfono del cliente  
**Mensaje:**
```
📄 *[Nombre del negocio]*
Hola [nombre], aquí está tu cotización:

Cotización #COT-[id]
📅 Válida hasta: [fecha_vencimiento]

[lista de productos]

💵 Total: $[total]

¿Aprobamos el pedido? Respóndenos aquí.
```

---

## 5. Cambios en base de datos (por tenant)

### Tabla `business_config` — nuevas claves

| Clave | Tipo | Descripción |
|---|---|---|
| `whatsapp_enabled` | boolean | Si el módulo WhatsApp está activo |
| `whatsapp_instance_name` | string | Nombre de la instancia en Evolution API |
| `whatsapp_instance_status` | string | CONNECTED / DISCONNECTED / PENDING_QR |
| `whatsapp_notify_sale` | boolean | Notificar en ventas del POS |
| `whatsapp_notify_order_ready` | boolean | Notificar cuando orden taller esté lista |
| `whatsapp_notify_credit_reminder` | boolean | Recordatorios de deuda |
| `whatsapp_notify_quote` | boolean | Enviar cotizaciones por WhatsApp |

---

## 6. Cambios en el backend (por implementar)

### 6.1 Nuevo router: `whatsapp.py`
```python
POST /whatsapp/instance/create      ← crear instancia para tenant
GET  /whatsapp/instance/qr          ← obtener QR para escanear
GET  /whatsapp/instance/status      ← estado de la conexión
DELETE /whatsapp/instance/disconnect ← desconectar número
POST /whatsapp/test                  ← enviar mensaje de prueba
```

### 6.2 Webhooks salientes — `webhook_service.py`
Servicio que hace POST a n8n cuando ocurren eventos:
```python
async def send_webhook(event: str, tenant_id: str, data: dict):
    n8n_url = "https://n8n.miinventariofacil.com/webhook/mi-inventario"
    payload = {
        "event": event,
        "tenant_id": tenant_id,
        "timestamp": datetime.now().isoformat(),
        "data": data
    }
    # HTTP POST async con httpx
```

### 6.3 Puntos de emisión de eventos
- `routers/sales.py` → al completar venta → `sale.completed`
- `routers/services.py` → al cambiar a READY → `order.ready`  
- `routers/credits.py` → cron diario → `credit.reminder`
- `routers/quotes.py` → al crear cotización → `quote.sent`

---

## 7. Nueva sección en ConfigCenter (por implementar)

**Ruta:** Configuración → WhatsApp

**Pantalla:**
```
┌─────────────────────────────────────────────────────┐
│ 📱 WhatsApp Business                                 │
│                                                      │
│ Estado: ● CONECTADO (o QR para escanear)            │
│ Número: +58 412 xxx xxxx                            │
│                                                      │
│ ┌─ Notificaciones ───────────────────────────────┐  │
│ │ [✓] Tickets de venta al cobrar                 │  │
│ │ [✓] Orden del taller lista para recoger        │  │
│ │ [✓] Recordatorio de deuda (vencidas > 3 días)  │  │
│ │ [ ] Envío de cotizaciones                      │  │
│ └────────────────────────────────────────────────┘  │
│                                                      │
│ [Desconectar número]  [Enviar mensaje de prueba]    │
└─────────────────────────────────────────────────────┘
```

---

## 8. Flujos en n8n (por crear)

### Flujo 1: Dispatcher principal
- Webhook receptor en `/webhook/mi-inventario`
- Switch por `event` type
- Ramifica a los flujos específicos

### Flujo 2: sale.completed
- Recibe datos de la venta
- Verifica que el cliente tenga teléfono
- Consulta Evolution API: ¿la instancia del tenant está conectada?
- Formatea el mensaje
- POST a Evolution API `/message/sendText/{instance_name}`

### Flujo 3: order.ready  
- Mismo patrón que sale.completed
- Mensaje diferente

### Flujo 4: credit.reminder (trigger por cron)
- Se activa automáticamente cada día a las 10am
- Llama al backend para obtener lista de deudores vencidos
- Itera y envía un mensaje por cliente

---

## 9. Plan de implementación

### Fase 1 — n8n (1 día)
- [ ] Crear cuenta admin en n8n
- [ ] Crear los 4 flujos base
- [ ] Probar webhook manualmente

### Fase 2 — Backend webhooks (2 días)
- [ ] Crear `webhook_service.py`
- [ ] Agregar emisión en `sales.py` (sale.completed)
- [ ] Agregar emisión en `services.py` (order.ready)
- [ ] Crear router `whatsapp.py` (gestión de instancias)
- [ ] Agregar claves a `business_config`

### Fase 3 — UI ConfigCenter (1 día)
- [ ] Tab WhatsApp en ConfigCenter
- [ ] QR code display + polling de estado
- [ ] Toggles de notificaciones

### Fase 4 — Primer tenant piloto (1 día)
- [ ] Conectar 1 negocio real
- [ ] Probar todos los flujos end-to-end
- [ ] Ajustar plantillas de mensajes

---

## 10. Consideraciones legales y técnicas

### Evolution API vs Meta Business API
- Evolution API usa el protocolo no oficial de WhatsApp Web
- Riesgo: el número puede ser baneado si envía spam masivo
- Para uso transaccional (tickets, confirmaciones) el riesgo es bajo
- Recomendación: máximo 200 mensajes/día por número
- Si un negocio quiere escalar, migrar a Meta Business API oficial

### Cuándo usar Meta Business API (oficial)
- Más de 500 mensajes/día por número
- Mensajes de marketing masivo
- Integración con catálogo de WhatsApp Business
- Empresas con requerimientos de cumplimiento legal

