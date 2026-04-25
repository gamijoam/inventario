# 10 - Registro de Actualizaciones (Changelog)

Bitácora oficial de cambios de **Mi Inventario Fácil**. Trazabilidad técnica de mejoras, correcciones y nuevas funcionalidades.

---

## [2026-04-05] — Integración BloqueCelular COMPLETA (`feature/integracion-bloqueo`)

### Fase 1 — Backend (42/42 ✅)
- `services/bloqueocelular_service.py`: auth JWT auto-renovable, sync cliente (fallback cédula duplicada + teléfono vacío), registrar dispositivo, bloquear/desbloquear via FCM, registrar pago, generar código BLC, probar conexión
- `routers/bloqueo.py`: 9 endpoints (APK URL, config, estado/bloquear/desbloquear/nuevo-codigo/sync por venta)
- Hook en `create_sale`: auto-sync con BloqueCelular al confirmar venta a crédito de celular
- Hook en `register_payment`: notifica cada abono a BloqueCelular
- Migración: 6 columnas `bloqueo_*` en `sales` + 7 claves `business_config`
- Fix: `payment_term_days=NULL` crasheaba `timedelta` → default 30 días
- Fix: `serial_imei` → `serial_number` (nombre real de la columna)

### Fase 2 — Frontend básico (21/21 ✅)
- `BloqueoCelular.jsx` (390 líneas): panel estado activo/bloqueado/sin activar, código BLC con copia, APK+QR, botones bloquear/desbloquear/nuevo código/sync
- `IntegracionesTab.jsx`: formulario conectar/desconectar, estado de la integración
- `InvoiceDetailModal`: integrado panel de bloqueo en detalle de ventas a crédito
- `ConfigCenter`: nuevo tab "Integraciones" con ícono candado

### Fase 3 — Filtro has_imei + Calculadora (47/48 ✅)
- Filtro en hook `create_sale`: solo productos con `has_imei=TRUE` van a BloqueCelular
- `CalculadoraCredito.jsx` (395 líneas): copia exacta de BloqueCelular (modelo plano, slider tasa, pills cuotas 3/6/9/12/18/24, frecuencias s/q/m, tabla amortización)
- `CreditoCelularModal.jsx`: flujo Paso1=Calculadora → Paso2=Confirmación con código BLC
- Botón 🧮 Calculadora en PaymentModal cuando hay celular en el carrito

### Fase 4 — Flujo crédito completo (40/40 ✅)
- Migración: 5 columnas `credit_*` en `sales` (down_payment, installments, interest_rate, frequency, installment_amount)
- `balance_pending` corregido: `(precio + interés) - enganche` (antes era precio completo)
- `SaleCreate` acepta datos del crédito; `SaleRead` los retorna
- `InvoiceDetailModal`: muestra plan de cuotas con tabla de amortización
- `CreditosTab`: muestra cuotas/frecuencia/monto por cuota en el listado
- Fix: `is_box`, `is_combo`, `is_discount_active`, `conversion_factor` → Optional en schemas

### Fase 5 — Tab Créditos Celular (35/36 ✅)
- `CreditosCelularesTab.jsx` (529 líneas): gestión completa desde un solo lugar
  - Banner APK prominente con QR para el técnico
  - KPIs: total, activos, bloqueados, sin activar, saldo total
  - Filtros por estado de bloqueo
  - Botones 🔒/🔓 DIRECTOS en la lista sin abrir modal
  - Abono rápido inline sin modal
  - Plan de cuotas expandible con tabla de amortización
  - Código BLC con copiar + instrucciones APK
- `SaleRead`: añadidos campos `bloqueo_sincronizado`, `bloqueo_codigo_activacion`, `bloqueo_estado`, etc.
- `CreditosTab`: sub-tab "📱 Créditos Celular" registrado en el menú

**Migración PROD pendiente:** ver `20_Migraciones_SQL_Pendientes.md`



---

## [2026-04-05] — Sistema Multi-Empresa COMPLETO (rama `feature/multi-empresa`)

### Sprint 0 — Base de datos y arquitectura
- 5 tablas nuevas en schema `public`: `organizations`, `organization_users`, `shared_products`, `inter_company_transfers`, `inter_company_transfer_items`
- Columna `organization_id` en `public.tenants` (FK hacia `organizations`)
- Migraciones aplicadas en QA ✅ | PROD ⏳ pendiente merge

### Sprint 1 — Backend completo (19 endpoints)
- `backend_api/models/organization.py` — 5 modelos SQLAlchemy
- `backend_api/schemas/organization.py` — 12 schemas Pydantic
- `backend_api/routers/organizations.py` — CRUD orgs, gestión tenants, miembros, catálogo compartido, dashboard consolidado
- `backend_api/routers/inter_transfers.py` — Transferencias de stock con Kardex automático en ambas empresas
- Fix: `AttributeError organization_id` en modelo `Tenant` — campo declarado en `models/tenant.py`
- Tests: 8/8 ✅

### Sprint 2 — Login unificado + Switch de empresa
- `POST /auth/token` enriquecido: retorna `has_multiple_companies`, `org_companies[]`, `switch_url` por empresa
- `POST /auth/switch-company?target_schema=X` — genera nuevo token para la empresa destino
- `OrgSelector.jsx` — pantalla de selección de empresa al iniciar sesión (aparece solo si hay 2+ empresas)
- `CompanySwitcher.jsx` — dropdown en sidebar para cambiar de empresa sin re-login
- `AuthContext.jsx` actualizado — guarda `org_companies` en localStorage
- `Login.jsx` — detecta `has_multiple_companies` y muestra `OrgSelector`
- `Sidebar.jsx` — integra `CompanySwitcher` en el bloque superior
- Fix: `NameError: get_current_active_user` en `auth.py` — import faltaba
- Tests: 5/5 ✅

### Sprint 3 — Dashboard consolidado del grupo
- `GET /organizations/consolidated-mine` — detecta automáticamente la org del usuario por su tenant
- Retorna: ventas totales del grupo hoy, mejor empresa, alertas stock por empresa, métricas por tenant
- `ConsolidatedDashboard.jsx` (445 líneas): 4 KPIs, gráfico barras SVG, alertas stock, tabla desempeño, auto-refresh cada 5 minutos
- Ruta `/org/dashboard` en `App.jsx`
- NavItem "Grupo Empresarial" en Sidebar (solo aparece si el usuario tiene 2+ empresas)
- Fix: conflicto de rutas — `/consolidated-mine` movido antes de `/{org_id}` en el router
- Tests: 4/4 ✅

### Sprint 4 — Catálogo compartido del grupo
- `SharedCatalog.jsx` (625 líneas): grid tarjetas, selección múltiple, importar individual/masivo, modal agregar con validación
- Deduplicación por SKU al importar: nunca crea el mismo producto dos veces
- NavItem "Catálogo Compartido" en Sidebar
- Ruta `/org/catalog`
- Tests: 6/6 ✅

### Sprint 5 — Transferencias de stock entre empresas
- `InterCompanyTransfers.jsx` (608 líneas): tabs Recibidas/Enviadas/Historial, TransferCard, NewTransferModal
- Al aceptar: descuenta stock en origen + suma en destino + inserta Kardex `EXTERNAL_TRANSFER_OUT/IN` en AMBAS BDs
- Si el producto no existe en la empresa destino, se crea automáticamente
- NavItem "Transferencias" en Sidebar | Ruta `/org/transfers`
- Fix: `MovementType: TRANSFER_OUT` inválido → corregido a `EXTERNAL_TRANSFER_OUT/IN`
- Fix: Kardex no se insertaba cuando el producto era nuevo en destino → agregado
- Tests: 5/5 ✅

### Sprint 6 — WhatsApp compartido, Plan y Configuración del grupo
- Columnas nuevas en `organizations`: `use_shared_whatsapp`, `whatsapp_instance`, `plan_expires_at`, `plan_price`, `plan_notes`
- Endpoints: `PATCH /organizations/{id}/plan`, `PATCH /organizations/{id}/whatsapp`, `GET /organizations/{id}/plan-info`
- `OrgConfig.jsx` (483 líneas): sección plan actual (barra uso, precio, vencimiento), WA compartido, empresas del grupo, miembros
- NavItem "Config. del Grupo" en Sidebar | Ruta `/org/config`
- Tests: 14/14 ✅

### Panel SaaS Admin — Módulo Organizaciones
- `saas_admin/src/api/organizations.ts` — 16 funciones API (CRUD orgs, tenants, miembros, plan, WA)
- `saas_admin/src/pages/Organizations.tsx` — lista grid con stats, filtros por plan/búsqueda, modal crear
- `saas_admin/src/pages/OrganizationDetails.tsx` — 4 tabs: Empresas, Miembros, Plan, WhatsApp
- NavItem "Organizaciones" agregado al `DashboardLayout.tsx`
- URL: `https://admin-qa.miinventariofacil.com/dashboard/organizations`
- Tests: 14/14 ✅ (incluyendo verificación en BD)

### Bot de Telegram — Comandos /org
- `telegram-bot/handlers/organizations.py` — 10 subcomandos completos con psql directo a BD prod
- `telegram-bot/webhook.py` — ruta `/org` integrada
- `telegram-bot/help.py` — `/org` en menú y COMMANDS
- Subcomandos: `listar`, `detalle`, `crear`, `plan`, `precio`, `agregar`, `quitar`, `wa`, `bloquear`, `activar`
- Tests sobre BD de PROD: 4/5 (T03 crear falla porque tablas aún no están en PROD — esperado)

### Fix crítico — Acceso cross-tenant via membresía de organización
- **Problema:** Al hacer switch de empresa, `get_current_user` bloqueaba porque el usuario no tenía `tenant_id` de la empresa destino
- **Fix en `dependencies.py`:** cuando `user.tenant_id != tenant.id`, verifica si el usuario es miembro de la organización que incluye ese tenant. Si sí, permite el acceso
- Este fix es el que habilita que el dueño del grupo opere en todas sus empresas sin necesitar cuenta local en cada una

### Confirmado: módulos y feature_flags son 100% independientes por empresa
- `organization_id` es solo un campo de agrupación — no altera módulos, feature_flags, ni ninguna lógica existente
- Tests: 14/14 ✅ — activar `has_pharmacy_module` en empresa A no afecta empresa B de la misma org

---

## [2026-04-05] — Fixes Módulo de Taller

### Archivar órdenes de servicio
- Columna `is_archived BOOLEAN DEFAULT false` en `service_orders` (aplicada en 53 tenants prod, 16 QA)
- Endpoint `PATCH /services/orders/{id}/archive` — solo ADMIN, solo si está en DELIVERED o CANCELLED
- Filtro `show_archived` en `GET /services/orders` — por defecto excluye archivadas
- Contador en dashboard de taller
- Vista de órdenes archivadas en `ServicesUnified.jsx`
- Fix: `position: relative` en contenedor del botón ⋮ para que el menú aparezca correctamente

### Fix comisión técnico con 0%
- `commission_technician_pct = 0` → no genera comisión (correcto)
- Solución para usuarios: configurar el % desde Configuración → Usuarios

---

## [2026-04-03] — Fixes Devoluciones y Anulaciones (5 bugs)

1. **Comisiones no se anulaban** al devolver → `void_sale_commissions()` llamado en `process_return()`
2. **Caja cerrada sin registro** → usa sesión original de la venta como fallback cuando no hay sesión activa
3. **Devolución parcial marcaba toda la factura como VOIDED** → propiedad `status` distingue `COMPLETED` / `PARTIAL_RETURN` / `VOIDED`
4. **Sin anulación rápida** → nuevo endpoint `POST /returns/void/{sale_id}` para anular sin devolución de mercancía
5. **Endpoints sin auth** → `get_current_active_user` agregado a todos los endpoints de returns

### Frontend (Returns)
- Badge naranja "Dev. Parcial" para `PARTIAL_RETURN`
- Badge rojo solo para `VOIDED` (no para parciales)
- Botón Anular bloqueado si ya hay devolución parcial
- Filtro "Dev. Parcial" en dropdown de estado
- `handleVoidConfirm` usa el endpoint correcto `/returns/void/{id}`

### Tests: 7/7 ✅

---

## [2026-03-31] — feat/services-redesign: Rediseño módulo servicios + fixes cotizaciones

### Servicios — Abonos parciales
- `POST /services/orders/{id}/payments` — endpoint para abonos anticipados
- Formulario de abono inline en `ServicesUnified.jsx`
- Auto-checkout al marcar `DELIVERED`: si abonos ≥ total → crea `Sale` automáticamente

### Servicios — Plantillas de servicio
- Tablas `service_templates` + `service_template_items` por schema de tenant
- Router `service_templates.py`: CRUD completo
- UI `ServiceTemplatesManager.jsx` + integración en `NewOrderModal.jsx`

### Feature Flags sistema
- Columna `tenants.feature_flags JSONB` en schema public
- `feature_flags_registry.py`: registro central de flags conocidos
- Hook `useFeatureFlag('flag_name')` en frontend
- Panel SaaS admin muestra/activa flags por tenant sin deploy

### Cotizaciones — Fixes UX
- Post-save panel: opciones Cargar en Caja / Imprimir / Volver
- HashRouter URL corregido a `'/#/pos?quote_id=...'`
- Botones no quedaban cortados por overflow-hidden

### Tests: 18/18 ✅

---

## [2026-03-23] — Fix: Display multi-moneda POS

- Badge de moneda secundaria resuelve `item.exchange_rate_id` → símbolo real (COP vs Bs)
- Footer carrito itera `totalsByCurrency` → muestra total en CADA moneda activa
- Fix vuelto en COP: `cambioEnMonedaSecundaria = totalBs / tasa_COP`

---

## [2026-03-15] — Módulo Customer 360 + WhatsApp Baileys

- Vista 360 del cliente: historial completo de ventas, créditos, servicios, compras
- Botones WhatsApp integrados con instancia Baileys del tenant
- Fallback a `wa.me` si WhatsApp está desconectado
- Endpoint `GET /customers/{id}/360` con datos consolidados

---

## [2026-03-10] — Bot de Telegram Admin (Panel SaaS completo)

- ~31 comandos: deploys, rollbacks, gestión tenants/usuarios, backups, métricas
- Aprobación de deploys por botones inline
- Ahora expandido con 10 comandos /org adicionales (multi-empresa)

---

## [2026-02-28] — Catálogo Público + QR

- Modal QR/link compartible por tenant
- Carrito WhatsApp: productos seleccionados → mensaje pre-armado
- Productos destacados con badge visual
- Horarios de negocio configurables
- Búsqueda dinámica con debounce 400ms
- Validación de stock en carrito

---

## [2026-04-06/07] — Fixes masivos de producción (sesión estabilización)

### Illegal constructor — íconos Lucide sin importar
**Causa raíz:** Íconos de `lucide-react` usados en JSX sin estar en el `import`. React los renderiza como `undefined` → `TypeError: Illegal constructor` en `renderWithHooks`.

| Archivo | Ícono faltante |
|---------|---------------|
| `Sidebar.jsx` | `BarChart3`, `ArrowLeftRight` |
| `ConfigCenter.jsx` | `Lock` |
| `POS.jsx` | `Settings as SettingsIcon` + `;;` doble |
| `GuiaComisiones.jsx` | `Pill` (era componente local, no ícono) |
| `ClientesTab.jsx` | imports duplicados consolidados |

**Diagnóstico:** El error solo aparecía en rutas específicas porque los íconos faltantes solo se renderizaban bajo condiciones específicas (org owner, tab activo, etc.). Las posiciones del stack trace (`Tm`, `Zm`, `Fp`) no corresponden al archivo fuente — hay que analizar el bundle minificado con `docker cp` + Python.

---

### CompanySwitcher — Fixes multi-empresa

**Bug 1 — Lista hacia arriba:**
- `bottom-full mb-2` → `top-full mt-1 z-[200]`

**Bug 2 — Switcher desaparecía al cambiar de empresa:**
- `localStorage` no se comparte entre subdominios
- Fix: `org_companies` se codifica en base64 (`?org_data=BASE64`) en la URL
- `App.jsx initApp()` lee `org_data` ANTES de cualquier provider y guarda en localStorage
- Esto permite switch encadenado A→B→C→A con el switcher siempre visible

**Bug 3 — ADMIN no veía sesión de caja abierta por otro usuario:**
- `GET /cash/sessions/current`: si el usuario es ADMIN → busca cualquier sesión OPEN del tenant
- Si es cajero normal → solo ve su propia sesión (multi-caja)

---

### Flujo de venta a crédito de celular — Fixes completos

**Problema:** "Usar en registro de venta" no hacía nada y volvía al POS.

**3 causas raíz:**
1. `session_id` no se pasaba al payload → backend decía "No hay caja abierta"
2. `onConfirmar` cerraba el `PaymentModal` antes de que el paso 2 (confirmación) se renderizara
3. `exchange_rate` fijo en `1.0` en lugar de la tasa real

**Fix:**
- `PaymentModal` pasa `session?.id` y `defaultBsRate` al `CreditoCelularModal`
- `onConfirmar` → renombrado a `onVentaExitosa` → solo se llama desde el botón "Listo" del paso 2
- `CreditoCelularModal` usa `portal` (document.body) para escapar el stacking context del PaymentModal

**Problema adicional — stock insuficiente con IMEIs:**
- Para ventas a crédito sin serial: backend hacía `pass` → no marcaba instancias como SOLD → stock se descontaba numéricamente pero `product_instances` quedaban AVAILABLE
- En la siguiente venta: stock=0 → error aunque hubiera IMEIs físicos
- Fix: auto-seleccionar primeras instancias AVAILABLE y marcarlas SOLD también en crédito

---

### Calculadora de crédito — Rediseño responsive
- Layout 2 columnas en PC (`lg:`), 1 columna compacta en tablet
- Tabla de pagos COLAPSABLE en tablet (siempre visible en PC)
- Botón "Usar en venta" siempre visible al fondo
- Modal: `h-[90vh]` mobile, `max-h-[88vh]` tablet/PC
- `createPortal` → modal aparece ENCIMA del PaymentModal (z-index correcto)

---

### Admin Panel SaaS

**VITE_API_URL faltaba en el build:**
- El bundle apuntaba a `http://localhost:8000/api/v1` → login no funcionaba en producción
- Fix: rebuild con `--build-arg VITE_API_URL=https://api.miinventariofacil.com/api/v1`

**Búsqueda por email de tenants:**
- `TenantOut` schema: nuevo campo `owner_email`
- `list_tenants`: query SQL `role::text IN ('ADMIN')` (cast necesario por enum PostgreSQL)
- Frontend: filtro de búsqueda incluye `owner_email`
- `TenantCard`: muestra email del admin debajo del dominio

---

### Schemas de BD incompletos en demo300/demo301
- Solo tenían 5/58 tablas — migración inicial no se completó
- Fix: `CREATE TABLE IF NOT EXISTS schema.tabla (LIKE oscardemo.tabla INCLUDING ALL)`
- Columnas faltantes en `purchase_items` en 4 tenants: `discount_pct`, `discount_amount`, `subtotal`
- Columna `products.featured` faltante en 6 tenants
- Script SQL para auditar y corregir todos los tenants: ver `20_Migraciones_SQL_Pendientes.md`

---

### ProductForm — Crear categoría inline
- Botón `+ Nueva` junto al label "Categoría"
- Input inline con `Enter` para guardar, `Escape` para cancelar
- Llama `POST /categories` y selecciona automáticamente la nueva
- `window.__refreshCategories` para actualizar la lista en el padre sin recargar

---

### Descarga del puente ConexionImpresora
- El archivo `.exe` nunca llegaba al nginx (SPA fallback devolvía `index.html`)
- Fix: empaquetado como `ConexionImpresora.zip` (72MB, self-contained .NET 8)
- `nginx.conf`: nueva `location /downloads/` con `try_files $uri =404` (sin SPA fallback)
- ZIP en `public/downloads/` → incluido en el build de Vite automáticamente
- Links en `POSSettingsModal`, `EstacionPOSTab` y `POSConfig`: `.exe` → `.zip`

---

### Plantillas de ticket ESC/POS — Fixes rosalicia
Ver documento completo: `70_Plantillas_Ticket_ESC_POS.md`

**Bug 1 — Cantidad `0` para productos vendidos por fracción:**
- `math.round 0` redondea `0.025` → `0`
- Fix: `math.format "0.###"` → muestra `0.025` / `0.1` / `1` según corresponda

**Bug 2 — `</right>` y `</center>` impresos literalmente:**
- El bridge procesa tags por línea — si están en líneas separadas del contenido, el de cierre queda huérfano
- Fix: tag + contenido + tag cierre en la misma línea: `<right>TOTAL: $10</right>`

**Aplicado en:** `rosalicia.business_config WHERE key='ticket_template'` (sin afectar otros clientes)

---

### Migraciones SQL aplicadas en PROD (2026-04-06/07)
```sql
-- purchase_items: discount_pct, discount_amount, subtotal
ALTER TABLE {schema}.purchase_items
  ADD COLUMN IF NOT EXISTS discount_pct    NUMERIC(10,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(18,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subtotal        NUMERIC(18,4);

-- products: featured
ALTER TABLE {schema}.products
  ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT false;

-- shared_products: is_active (public)
ALTER TABLE public.shared_products
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- inter_company_transfers: created_by (public)
ALTER TABLE public.inter_company_transfers
  ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL;
```
Aplicadas a todos los tenants activos con script DO $$ LOOP en psql.

