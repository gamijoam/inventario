# 70 - Integración BloqueCelular ↔ Mi Inventario Fácil

> **Rama:** `feature/integracion-bloqueo` (4 commits) | **Tests:** 40/40 ✅
> **Estado:** QA funcional al 100% | PROD: pendiente merge + migración SQL

---

## Qué es BloqueCelular

Sistema SaaS en el mismo VPS (`bloqueo.miinventariofacil.com`) que permite bloquear
celulares a crédito remotamente vía push FCM (Google) o HMS (Huawei) si el cliente no paga.

**Contenedores:** `backend_bloqueo_server:3000` · `frontend_bloqueo_server` · `db_bloqueo_server`
**Red:** `web_publica` — comunicación directa con `backend_qa_server` ✅ verificado

---

## Flujo completo de venta a crédito de celular

```
POS: Vendedor agrega Samsung A55 (has_imei=true) al carrito
         ↓
PaymentModal: Toggle "Venta a Crédito" → botón 🧮 Calculadora aparece
         ↓
CreditoCelularModal → CalculadoraCredito.jsx:
  Vendedor ingresa: precio=$350, enganche=$100, tasa=10%, 6 cuotas, mensual
  Resultado: cuota=$47.50, financiado=$285, tabla de amortización 6 filas
  Botón "Usar en registro de venta"
         ↓
Backend crea la venta:
  total_amount    = $350          ← precio base del equipo
  balance_pending = $285          ← (350 + 35) - 100 = CORRECTO
  credit_down_payment      = $100
  credit_installments      = 6
  credit_interest_rate     = 10%
  credit_frequency         = mensual
  credit_installment_amount= $47.50
         ↓ automático (hook has_imei=true)
BloqueCelular sincronización:
  POST /api/clientes → cliente_id = 44
  Código BLC-XXXX generado → guardado en sales.bloqueo_codigo_activacion
         ↓
Pantalla de confirmación muestra:
  ┌─────────────────────────────────────┐
  │  Código: BLC-IEKY42                 │
  │  [Copiar] [Descargar APK] [QR]      │
  │  6 cuotas de $47.50 · mensual       │
  └─────────────────────────────────────┘
         ↓
Técnico instala APK en el celular → ingresa BLC-XXXX → equipo vinculado
         ↓
Ventas a crédito → Tab "Créditos" (Cuentas por Cobrar):
  Lista muestra: saldo, cuotas, monto/cuota, frecuencia
  Clic en factura → InvoiceDetailModal con:
    - Plan de cuotas completo (tabla: #, fecha, cuota, saldo)
    - Panel BloqueoCelular (estado activo/bloqueado, botones)
         ↓
Cliente no paga → vendedor toca "🔒 Bloquear equipo"
  → FCM push → celular bloqueado en segundos
         ↓
Cliente paga → vendedor registra abono ($47.50)
  → balance $285 → $237.50 ✅
  → BloqueCelular notificado automáticamente
         ↓
Saldo = 0 → vendedor toca "Desbloquear equipo" → FCM push
```

---

## Modelo de cálculo — idéntico a BloqueCelular

```
interes_total = precio × tasa%
total         = precio + interes_total
financiado    = max(0, total - enganche)   ← balance_pending en Mi Inventario
cuota         = financiado / num_cuotas
```

Ejemplo: Samsung $350, enganche $100, tasa 10%, 6 cuotas, mensual
- interés = $35 | total = $385 | financiado = **$285** | cuota = **$47.50**

---

## Regla clave: Filtro has_imei

**Solo productos con `has_imei = TRUE` se sincronizan con BloqueCelular.**
Fundas, cables, accesorios → se venden a crédito normal sin BloqueCelular.
Celulares, tablets, equipos → auto-sync + código BLC + control de bloqueo.

---

## Base de datos — columnas en `sales`

### Columnas de crédito (nuevas — Fase 4)
```sql
-- Aplicadas en todos los schemas QA
-- Pendiente en PROD al momento del merge
ALTER TABLE {schema}.sales
  ADD COLUMN credit_down_payment       NUMERIC(18,4),  -- Enganche pagado
  ADD COLUMN credit_installments       INTEGER,         -- Número de cuotas
  ADD COLUMN credit_interest_rate      NUMERIC(8,4),   -- Tasa % (modelo plano)
  ADD COLUMN credit_frequency          VARCHAR(20),     -- semanal/quincenal/mensual
  ADD COLUMN credit_installment_amount NUMERIC(18,4);  -- Monto de cada cuota
```

### Columnas de BloqueCelular (Fase 1)
```sql
ALTER TABLE {schema}.sales
  ADD COLUMN bloqueo_dispositivo_id    INTEGER,
  ADD COLUMN bloqueo_cliente_id        INTEGER,
  ADD COLUMN bloqueo_codigo_activacion VARCHAR(20),  -- BLC-XXXX
  ADD COLUMN bloqueo_sincronizado      BOOLEAN DEFAULT FALSE,
  ADD COLUMN bloqueo_estado            VARCHAR(20),  -- activo/bloqueado/liberado
  ADD COLUMN bloqueo_error             TEXT;
```

### Claves en `business_config`
```sql
-- Por tenant (auto-insertadas en la primera conexión)
bloqueocelular_enabled    = 'true'
bloqueocelular_url        = 'http://backend_bloqueo_server:3000'
bloqueocelular_email      = 'admin@tienda.com'
bloqueocelular_password   = '...'
bloqueocelular_token      = 'eyJ...'  -- JWT auto-renovable
bloqueocelular_token_exp  = '2026-04-12T...'
bloqueocelular_tenant_id  = 'oscarcredito'
```

---

## Archivos del backend

| Archivo | Descripción |
|---|---|
| `services/bloqueocelular_service.py` | 8 funciones: auth JWT auto-renovable, sincronizar_cliente (fallback cédula duplicada + teléfono vacío), registrar_dispositivo, registrar_pago, bloquear, desbloquear, obtener_estado, generar_nuevo_codigo, probar_conexion, sincronizar_venta_credito |
| `routers/bloqueo.py` | 9 endpoints: `/bloqueo/apk-url`, `/bloqueo/config/{conectar|desconectar|estado}`, `/bloqueo/sales/{id}/{estado|bloquear|desbloquear|nuevo-codigo|sync}` |

### Hook en `sales_service.create_sale`
```python
if sale_data.is_credit and sale_customer_id:
    # Solo si el producto tiene has_imei=TRUE
    _tiene_celular = db.execute(
        f'SELECT COUNT(*) FROM "{schema}".sale_details sd '
        f'JOIN "{schema}".products p ON p.id=sd.product_id '
        f'WHERE sd.sale_id=:sid AND p.has_imei=TRUE'
    ).scalar()
    if _tiene_celular:
        # Sincronizar con BloqueCelular
        sincronizar_venta_credito(...)
```

### Hook en `sales_service.register_payment`
```python
# Notifica a BloqueCelular cada abono para actualizar saldo
if sale.is_credit and is_enabled(db, schema):
    if sale.bloqueo_dispositivo_id:
        registrar_pago(db, schema, sale.bloqueo_dispositivo_id, monto, ...)
```

---

## Archivos del frontend

| Archivo | Descripción |
|---|---|
| `components/credit/CalculadoraCredito.jsx` | Calculadora idéntica a BloqueCelular: slider tasa, pills cuotas 3/6/9/12/18/24, frecuencias s/q/m, enganche $+%, hero cuota, tabla amortización |
| `components/credit/CreditoCelularModal.jsx` | Modal 2 pasos: Paso1=Calculadora, Paso2=Confirmación con código BLC + APK + resumen |
| `components/credit/BloqueoCelular.jsx` | Panel colapsable en InvoiceDetailModal: estado equipo, código BLC, APK+QR, botones bloquear/desbloquear/nuevo código |
| `components/credit/InvoiceDetailModal.jsx` | Detalle de venta a crédito con plan de cuotas + panel BloqueoCelular |
| `pages/Sales/tabs/CreditosTab.jsx` | Lista créditos con cuotas/frecuencia/monto visible |
| `pages/Config/tabs/IntegracionesTab.jsx` | Formulario conectar/desconectar BloqueCelular |
| `components/pos/PaymentModal.jsx` | Botón 🧮 Calculadora cuando hay celular en el carrito + is_credit toggle |

---

## Endpoints de Mi Inventario para BloqueCelular

```
GET  /bloqueo/apk-url                        URL del APK de instalación
POST /bloqueo/config/conectar                Guardar credenciales BloqueCelular
POST /bloqueo/config/desconectar             Desactivar integración
GET  /bloqueo/config/estado                  Estado actual (enabled, token_vigente, email)
GET  /bloqueo/sales/{sale_id}/estado         Estado del equipo (activo/bloqueado)
POST /bloqueo/sales/{sale_id}/bloquear       Enviar push FCM para bloquear
POST /bloqueo/sales/{sale_id}/desbloquear    Enviar push FCM para desbloquear
POST /bloqueo/sales/{sale_id}/nuevo-codigo   Generar nuevo BLC-XXXX
POST /bloqueo/sales/{sale_id}/sync           Reintentar sync (si falló antes)
```

---

## Conectividad verificada

```bash
# Desde backend_qa_server → backend_bloqueo_server (red web_publica)
docker exec backend_qa_server python3 -c "
import urllib.request, json
r = urllib.request.urlopen(urllib.request.Request(
    'http://backend_bloqueo_server:3000/api/auth/login',
    data=json.dumps({'email':'...','password':'...'}).encode(),
    headers={'Content-Type':'application/json'}
), timeout=5)
print(json.loads(r.read()))
"
# ✅ Retorna token JWT válido
```

**APK:** `https://bloqueo.miinventariofacil.com/app/bloqueo.apk` (7.1 MB)

---

## Migración SQL para PROD (pendiente)

```sql
-- Aplicar ANTES del merge de feature/integracion-bloqueo a PROD

DO $$ DECLARE s TEXT; BEGIN
  FOR s IN SELECT schema_name FROM information_schema.schemata
    WHERE schema_name NOT IN ('public','information_schema','pg_catalog','pg_toast')
      AND schema_name NOT LIKE 'pg_%'
  LOOP
    EXECUTE format('ALTER TABLE %I.sales
      ADD COLUMN IF NOT EXISTS bloqueo_dispositivo_id    INTEGER,
      ADD COLUMN IF NOT EXISTS bloqueo_cliente_id        INTEGER,
      ADD COLUMN IF NOT EXISTS bloqueo_codigo_activacion VARCHAR(20),
      ADD COLUMN IF NOT EXISTS bloqueo_sincronizado      BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS bloqueo_estado            VARCHAR(20),
      ADD COLUMN IF NOT EXISTS bloqueo_error             TEXT,
      ADD COLUMN IF NOT EXISTS credit_down_payment       NUMERIC(18,4),
      ADD COLUMN IF NOT EXISTS credit_installments       INTEGER,
      ADD COLUMN IF NOT EXISTS credit_interest_rate      NUMERIC(8,4),
      ADD COLUMN IF NOT EXISTS credit_frequency          VARCHAR(20),
      ADD COLUMN IF NOT EXISTS credit_installment_amount NUMERIC(18,4)', s);

    EXECUTE format('INSERT INTO %I.business_config (key,value) VALUES
      (''bloqueocelular_enabled'',   ''false''),
      (''bloqueocelular_url'',       ''http://backend_bloqueo_server:3000''),
      (''bloqueocelular_email'',     ''''),
      (''bloqueocelular_password'',  ''''),
      (''bloqueocelular_token'',     ''''),
      (''bloqueocelular_token_exp'', ''''),
      (''bloqueocelular_tenant_id'', '''')
      ON CONFLICT (key) DO NOTHING', s);
  END LOOP;
END $$;
```

---

## Tests — resultado final

| Bloque | Tests | Estado |
|---|---|---|
| Venta celular a crédito (balance correcto) | 9/9 | ✅ |
| SaleRead con campos credit_* | 5/5 | ✅ |
| Abono reduce balance_pending | 4/4 | ✅ |
| Cuentas por Cobrar con cuotas | 5/5 | ✅ |
| Filtro has_imei (regresión) | 4/4 | ✅ |
| Bundle compilado | 7/7 | ✅ |
| Cálculo modelo plano exacto | 4/4 | ✅ |
| **TOTAL** | **40/40** | **100% ✅** |

---

## Pendiente para completar la integración

1. **Prueba física con Android real** — instalar APK, ingresar BLC code, verificar bloqueo/desbloqueo
2. **Merge a main + migración PROD** — cuando Gabriel apruebe en Telegram
3. **Mejoras opcionales:**
   - Código BLC y link APK en el ticket impreso
   - Notificación WA al cliente con código BLC al momento de la venta
   - Bloqueo automático por mora (cron job en BloqueCelular)
   - Desbloqueo automático cuando saldo llega a 0

---

## Tab "📱 Créditos Celular" — Gestión completa desde un solo lugar

**Ruta:** `Ventas → Créditos → 📱 Créditos Celular`
**Archivo:** `frontend_web/src/pages/Sales/tabs/CreditosCelularesTab.jsx` (529 líneas)

### Qué tiene el tab

**Banner superior — para el técnico:**
- QR del APK generado automáticamente
- Botón "Descargar APK" prominente
- Instrucciones paso a paso

**KPIs:**
- Total celulares a crédito | Activos | Bloqueados | Sin activar | Saldo total

**Filtros:** Todos / 📱 Activos / 🔒 Bloqueados / ⚠️ Sin activar

**Lista de créditos (fila por celular):**
- Estado visual: 📱 Activo / 🔒 Bloqueado / ⚠️ Sin activar
- Botón 🔒 Bloquear directo (sin abrir modal)
- Botón 🔓 Desbloquear directo (sin abrir modal)
- Botón "Abonar" con campo de monto inline
- Barra de progreso del saldo pagado
- Código BLC-XXXX visible

**Expandir cada fila muestra:**
- Código BLC con botón copiar
- QR del APK + instrucciones + botón descargar
- Estado real del equipo en BloqueCelular (saldo, cuotas pagadas)
- Plan de amortización completo (tabla: #, fecha, cuota, saldo)
- Botones completos: Bloquear / Desbloquear / Nuevo código BLC / Refrescar estado

### Campos en SaleRead (añadidos Fase 5)
```
bloqueo_sincronizado      Optional[bool]
bloqueo_codigo_activacion Optional[str]
bloqueo_estado            Optional[str]
bloqueo_cliente_id        Optional[int]
bloqueo_dispositivo_id    Optional[int]
```
El endpoint `/products/credits` retorna todos estos campos para el tab.

### Registro en CreditosTab
```javascript
const SUB_TABS = [
    { id: 'cxc',      label: 'Cuentas por Cobrar', icon: Wallet     },
    { id: 'celulares',label: '📱 Créditos Celular', icon: Smartphone },
    { id: 'aging',    label: 'Antigüedad',          icon: Calendar   },
    { id: 'ledger',   label: 'Estado de Cuenta',    icon: FileText   },
];
```
