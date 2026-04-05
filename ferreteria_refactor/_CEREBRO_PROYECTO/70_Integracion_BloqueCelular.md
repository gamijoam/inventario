# 70 - Integración BloqueCelular ↔ Mi Inventario Fácil

> **Estado:** Diseño documentado — Implementación en rama `feature/integracion-bloqueo`
> **Fecha análisis:** 2026-04-05
> **Prioridad:** Alta — habilita venta de celulares a crédito con bloqueo remoto

---

## ¿Qué es BloqueCelular?

Sistema SaaS B2B que corre en el **mismo VPS** (212.28.176.157) bajo el dominio
`bloqueo.miinventariofacil.com`. Permite a tiendas vender celulares a crédito y
**bloquear el dispositivo remotamente** (vía push FCM/HMS) si el cliente no paga.

**Stack:** Node.js 22 + Express 5 / PostgreSQL 15 / Nginx / Docker  
**Contenedores:** `backend_bloqueo_server` (puerto 3000) · `frontend_bloqueo_server` · `db_bloqueo_server`  
**Conectividad:** ✅ `backend_prod_server` puede llamar directamente a `http://backend_bloqueo_server:3000` — misma red Docker `web_publica`

---

## Por qué integrar

Mi Inventario ya tiene:
- ✅ Ventas a crédito (`is_credit=True`)
- ✅ Abonos parciales y control de saldo pendiente
- ✅ Módulo de clientes con datos completos

Lo que le falta:
- ❌ Bloqueo físico del celular si el cliente no paga
- ❌ Código de activación para instalar el APK
- ❌ APK disponible para el técnico

BloqueCelular tiene exactamente lo que falta. La integración los conecta.

---

## Flujo completo de venta a crédito con bloqueo

```
┌─────────────────────────────────────────────────────────────────────┐
│ PASO 1 — VENTA EN MI INVENTARIO                                     │
│                                                                     │
│  Vendedor registra venta a crédito de un celular con IMEI           │
│  → is_credit: true                                                  │
│  → product_instance.serial_imei: "352000000000001"                  │
│  → total: $500, enganche: $100, saldo_pendiente: $400               │
└────────────────────────┬────────────────────────────────────────────┘
                         │ automático (invisible para el vendedor)
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│ PASO 2 — SINCRONIZACIÓN CON BLOQUEOCELULAR (backend a backend)      │
│                                                                     │
│  Mi Inventario → POST http://backend_bloqueo_server:3000/api/clientes│
│  → Crea o encuentra el cliente en BloqueCelular                     │
│  → BloqueCelular responde: { id: 15, codigo_activacion: "BLC-A3F9" }│
│                                                                     │
│  Mi Inventario → POST /api/dispositivos                              │
│  → Registra el dispositivo con IMEI y datos del crédito             │
│  → BloqueCelular responde: { id: 42, estado: "activo" }             │
│                                                                     │
│  Mi Inventario guarda en BD:                                        │
│  → sales.bloqueo_dispositivo_id = 42                                │
│  → sales.bloqueo_cliente_id = 15                                    │
│  → sales.bloqueo_codigo_activacion = "BLC-A3F9" ← CLAVE            │
│  → sales.bloqueo_sincronizado = true                                │
└────────────────────────┬────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│ PASO 3 — MI INVENTARIO MUESTRA EL CÓDIGO AL VENDEDOR                │
│                                                                     │
│  En la pantalla de confirmación de venta aparece:                   │
│  ┌─────────────────────────────────────────────────┐                │
│  │  🔒 Código de activación del bloqueo            │                │
│  │                                                 │                │
│  │         BLC-A3F9                                │                │
│  │                                                 │                │
│  │  1. Instala la app en el celular del cliente:   │                │
│  │     bloqueo.miinventariofacil.com/app/bloqueo.apk│               │
│  │     [Copiar enlace] [Ver QR]                    │                │
│  │                                                 │                │
│  │  2. Abre la app → ingresa este código           │                │
│  │  3. El celular quedará registrado               │                │
│  └─────────────────────────────────────────────────┘                │
└────────────────────────┬────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│ PASO 4 — TÉCNICO INSTALA LA APP EN EL CELULAR                       │
│                                                                     │
│  1. Descarga bloqueo.apk desde el enlace                            │
│  2. Instala en el Android del cliente                               │
│  3. La app pide el código → técnico ingresa "BLC-A3F9"              │
│  4. App reporta al backend de BloqueCelular:                        │
│     POST /api/dispositivos/activar                                  │
│     { imei: "352...", codigo: "BLC-A3F9", fcm_token: "...",         │
│       marca: "Samsung", modelo: "A55" }                             │
│  5. BloqueCelular valida el código, vincula el dispositivo          │
│  6. Equipo queda en estado: "activo"                                │
└────────────────────────┬────────────────────────────────────────────┘
                         │ días/semanas después...
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│ PASO 5A — CLIENTE PAGA (flujo normal)                               │
│                                                                     │
│  Vendedor registra abono en Mi Inventario                           │
│  → POST /api/bloqueo/sales/{id}/pago                                │
│  → Mi Inventario notifica a BloqueCelular                           │
│  → POST /api/pagos { dispositivo_id: 42, monto: 66.67 }             │
│  → Saldo baja en BloqueCelular                                      │
│  → Si saldo=0 → estado cambia a "liberado" automáticamente          │
└────────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────────┐
│ PASO 5B — CLIENTE NO PAGA (bloqueo)                                 │
│                                                                     │
│  Vendedor en Mi Inventario ve la venta en mora                      │
│  → Toca botón "Bloquear equipo"                                     │
│  → POST /api/bloqueo/sales/{id}/bloquear                            │
│  → Mi Inventario → BloqueCelular → FCM push al celular              │
│  → Celular se bloquea en segundos (pantalla de bloqueo con info     │
│    de la tienda: nombre, teléfono, instrucciones para pagar)        │
└────────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────────┐
│ PASO 5C — CLIENTE PAGA DESPUÉS DEL BLOQUEO (desbloqueo)             │
│                                                                     │
│  Vendedor registra el pago → toca "Desbloquear equipo"              │
│  → POST /api/bloqueo/sales/{id}/desbloquear                         │
│  → Mi Inventario → BloqueCelular → FCM push al celular              │
│  → Celular se desbloquea en segundos                                │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Datos clave del sistema BloqueCelular

### Código BLC-XXXX — el elemento más importante

Cuando se registra un cliente en BloqueCelular:
```json
POST /api/clientes → respuesta:
{
  "id": 15,
  "nombre": "Juan Pérez",
  "nivel": "bronce",
  "codigo_activacion": "BLC-A3F9",    ← Este código es el puente
  "codigos_pendientes": ["BLC-A3F9"]
}
```

El código:
- Es generado automáticamente (`BLC-` + 4 caracteres alfanuméricos)
- Tiene un tiempo de expiración
- Solo puede usarse UNA VEZ (luego queda marcado como `usado=true`)
- Si se necesita un segundo equipo: `POST /api/clientes/:id/nuevo-codigo`

**Mi Inventario DEBE mostrar este código claramente** en:
1. La pantalla de confirmación de la venta
2. El ticket/factura impresa
3. El mensaje de WhatsApp de confirmación de compra

### APK del sistema de bloqueo

- **URL pública:** `https://bloqueo.miinventariofacil.com/app/bloqueo.apk`
- **Ubicación en VPS:** `/root/deploy/bloqueo/public/app/bloqueo.apk`
- **Tamaño:** ~7.1 MB
- Es una app Android con permisos de **Device Owner** (control total del dispositivo)
- El técnico la instala en el celular del cliente

**Mi Inventario DEBE incluir:**
1. Link directo al APK en la vista de venta a crédito
2. QR code del enlace del APK (para que el técnico lo escanee con su propio celular)
3. Instrucciones del proceso en el ticket de venta

### Mecanismo de bloqueo

- **FCM (Google Firebase):** Para Android con Google Play Services (mayoría)
- **HMS (Huawei):** Para Huawei sin Google (P30, Mate series, etc.)
- El backend detecta automáticamente cuál usar según qué token tiene el dispositivo
- Si el celular no tiene internet al recibir el comando, Firebase lo retiene hasta 4 semanas
- La app es **Device Owner** → el usuario NO puede desinstalarla fácilmente

---

## Conectividad verificada ✅

```
backend_prod_server (red web_publica)
    ↓ HTTP directo
backend_bloqueo_server:3000 (red web_publica)

Prueba:
docker exec backend_prod_server python3 -c "
import urllib.request, json
url = 'http://backend_bloqueo_server:3000/api/auth/login'
data = json.dumps({'email':'admin@tienda.com','password':'pass'}).encode()
req = urllib.request.Request(url, data=data, headers={'Content-Type':'application/json'})
r = urllib.request.urlopen(req, timeout=5)
print(json.loads(r.read()))
"
```

---

## Cambios en la BD de Mi Inventario

### Nuevas columnas en el schema del tenant

```sql
-- En cada schema de tenant (no en public)

-- Tabla sales — datos de sincronización con BloqueCelular
ALTER TABLE sales
    ADD COLUMN bloqueo_dispositivo_id   INTEGER,
    ADD COLUMN bloqueo_cliente_id       INTEGER,
    ADD COLUMN bloqueo_codigo_activacion VARCHAR(20),  -- ej: "BLC-A3F9"
    ADD COLUMN bloqueo_sincronizado      BOOLEAN DEFAULT FALSE,
    ADD COLUMN bloqueo_estado            VARCHAR(20),  -- activo / bloqueado / liberado
    ADD COLUMN bloqueo_error             TEXT;

-- Tabla product_instances — estado del equipo
ALTER TABLE product_instances
    ADD COLUMN serial_imei               VARCHAR(20),  -- puede que ya exista
    ADD COLUMN bloqueo_dispositivo_id    INTEGER,
    ADD COLUMN bloqueo_estado            VARCHAR(20);  -- activo / bloqueado / liberado

-- Tabla business_config — configuración de la integración
INSERT INTO business_config (key, value) VALUES
    ('bloqueocelular_enabled',   'false'),
    ('bloqueocelular_url',       'http://backend_bloqueo_server:3000'),
    ('bloqueocelular_email',     ''),
    ('bloqueocelular_password',  ''),
    ('bloqueocelular_token',     ''),
    ('bloqueocelular_token_exp', ''),
    ('bloqueocelular_tenant_id', '');
```

---

## Archivos nuevos en Mi Inventario

### Backend (FastAPI Python)

```
backend_api/
├── services/
│   └── bloqueocelular_service.py   ← Servicio de integración
└── routers/
    └── bloqueo.py                  ← Endpoints bloquear/desbloquear/estado
```

### Frontend (React)

```
frontend_web/src/
├── components/
│   └── sales/
│       └── BloqueoCelular.jsx      ← Panel de control del bloqueo
├── pages/
│   └── Sales/
│       └── CreditSaleDetails.jsx   ← Vista de venta a crédito (incluye bloqueo)
└── pages/
    └── Config/
        └── tabs/
            └── IntegracionesTab.jsx ← Config de credenciales de BloqueCelular
```

---

## Endpoints nuevos en Mi Inventario

```
POST /bloqueo/sales/{sale_id}/bloquear         → Bloquea el equipo
POST /bloqueo/sales/{sale_id}/desbloquear      → Desbloquea el equipo
GET  /bloqueo/sales/{sale_id}/estado           → Estado actual del equipo
POST /bloqueo/sales/{sale_id}/sync             → Reintento de sincronización
GET  /bloqueo/apk-url                          → URL del APK para el frontend
POST /bloqueo/config/conectar                  → Guardar credenciales y probar conexión
```

---

## API de BloqueCelular — Referencia para la integración

**URL interna (desde Mi Inventario):** `http://backend_bloqueo_server:3000`

| Endpoint | Qué hace | Body |
|---|---|---|
| POST `/api/auth/login` | Obtener token JWT | `{email, password}` |
| POST `/api/clientes` | Crear cliente → retorna `codigo_activacion` | `{nombre, telefono, cedula, email}` |
| POST `/api/clientes/:id/nuevo-codigo` | Generar código para 2do equipo | — |
| POST `/api/dispositivos` | Registrar equipo con crédito | `{imei, nombre_equipo, cliente_id, precio_venta, enganche, monto_financiado, saldo_pendiente, num_cuotas, monto_cuota, fecha_limite_pago}` |
| GET `/api/dispositivos/:id` | Estado actual del equipo | — |
| POST `/api/dispositivos/:id/bloquear` | Bloquear via FCM | `{motivo}` |
| POST `/api/dispositivos/:id/desbloquear` | Desbloquear via FCM | `{nueva_fecha_limite}` |
| POST `/api/pagos` | Registrar pago de cuota | `{dispositivo_id, monto, metodo_pago, num_cuota}` |

**Autenticación:** `Authorization: Bearer <JWT_TOKEN>` en todos (excepto `/activar`)

---

## Qué debe mostrar Mi Inventario al vendedor

### En la vista de venta a crédito confirmada

```
┌──────────────────────────────────────────────────────┐
│  ✅ Venta registrada — Samsung Galaxy A55             │
│                                                      │
│  Cliente: Juan Pérez                                 │
│  Crédito: $400 en 6 cuotas de $66.67                 │
│  Próximo pago: 01/05/2026                            │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │  🔒 CÓDIGO DE ACTIVACIÓN DEL BLOQUEO           │  │
│  │                                                │  │
│  │           BLC-A3F9                             │  │
│  │                                                │  │
│  │  Pasos para activar:                           │  │
│  │  1. Instala la app en el celular del cliente   │  │
│  │     [📱 Descargar APK] [QR code]               │  │
│  │  2. Abre la app e ingresa el código            │  │
│  │  3. El equipo quedará protegido ✅              │  │
│  │                                                │  │
│  │  ⚠️ Este código expira en 48 horas              │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  [Imprimir ticket] [Enviar por WhatsApp] [Cerrar]    │
└──────────────────────────────────────────────────────┘
```

### En el listado de créditos activos

- Badge de estado: 📱 Activo / 🔒 Bloqueado / ✅ Pagado / ⚠️ Sin activar
- Columna "Equipo" mostrando el IMEI y el estado del bloqueo
- Botones de acción rápida: Bloquear / Desbloquear / Ver historial

### En el detalle de una venta a crédito

```
┌─────────────────────────────────────────────────────┐
│  🔒 Control de Bloqueo del Equipo                   │
│                                                     │
│  IMEI: 352000000000001                              │
│  Estado: ● Activo                                   │
│  Código usado: BLC-A3F9 (activado el 05/04/2026)    │
│  Último bloqueo: —                                  │
│                                                     │
│  [🔒 Bloquear equipo]  [📋 Ver historial]            │
│                                                     │
│  ⓘ El equipo tiene la app instalada y está          │
│    conectado a internet. El bloqueo tardará         │
│    segundos en aplicarse.                           │
└─────────────────────────────────────────────────────┘
```

---

## Plan de implementación

### Fase 1 — Backend (2 días)
- [ ] Crear `services/bloqueocelular_service.py` con funciones: `get_token`, `sync_cliente`, `registrar_dispositivo`, `registrar_pago`, `bloquear`, `desbloquear`, `estado`
- [ ] Crear `routers/bloqueo.py` con endpoints de control
- [ ] Modificar endpoint de venta a crédito: llamar al servicio al confirmar
- [ ] Modificar endpoint de abonos: notificar cada pago
- [ ] Agregar migraciones: columnas nuevas en `sales` y `product_instances`
- [ ] Endpoint `GET /bloqueo/apk-url` para que el frontend obtenga el link

### Fase 2 — Frontend (1 día)
- [ ] `BloqueoCelular.jsx`: panel de control con estado, botones bloquear/desbloquear, historial
- [ ] Mostrar código BLC en la confirmación de venta a crédito
- [ ] Agregar link + QR del APK en la vista de venta
- [ ] Incluir código BLC y link APK en el ticket impreso
- [ ] `IntegracionesTab.jsx`: sección para configurar credenciales de BloqueCelular
- [ ] Badge de estado en listado de créditos

### Fase 3 — Configuración y pruebas (1 día)
- [ ] Configurar credenciales de un tenant de prueba en BloqueCelular
- [ ] Hacer venta de prueba con IMEI real → verificar que aparece en BloqueCelular
- [ ] Instalar APK en celular de prueba → ingresar código BLC → verificar activación
- [ ] Probar bloqueo desde Mi Inventario → verificar en celular físico
- [ ] Probar desbloqueo → verificar en celular físico
- [ ] Probar flujo de error (BloqueCelular caído) → venta igual se guarda

---

## Reglas de negocio importantes

1. **La venta SIEMPRE se guarda aunque BloqueCelular falle** — el bloqueo es secundario
2. **El IMEI es obligatorio** para ventas de celulares a crédito con bloqueo
3. **El código BLC debe mostrarse UNA SOLA VEZ** — si se pierde, generar uno nuevo
4. **Token JWT expira en 7 días** — renovar automáticamente
5. **Solo celulares Android** — iOS no tiene soporte para este tipo de bloqueo
6. **El código BLC expira en 48 horas** — si no se usa, generar uno nuevo con `POST /api/clientes/:id/nuevo-codigo`

---

## Manejo de errores

| Error | Causa | Acción |
|---|---|---|
| `400 Código inválido` | Código expirado o ya usado | Generar nuevo código |
| `400 Dispositivo ya registrado` | IMEI duplicado en otro tenant | Verificar si el equipo ya tiene crédito activo |
| `400 Sin token FCM` | App no instalada o celular sin internet | Estado queda "pendiente" — se aplicará cuando el celular se conecte |
| `502 BloqueCelular caído` | Servicio no disponible | Guardar venta, marcar `bloqueo_sincronizado=false`, reintentar con job automático |

---

## Estado de la conectividad (verificado 2026-04-05)

- ✅ `backend_prod_server` → `backend_bloqueo_server:3000` — FUNCIONA (misma red `web_publica`)
- ✅ `backend_prod_server` → `frontend_bloqueo_server:80/app/bloqueo.apk` — FUNCIONA
- ✅ BloqueCelular responde con token JWT válido al autenticar
- ✅ APK disponible en: `https://bloqueo.miinventariofacil.com/app/bloqueo.apk`
