# 10 - Registro de Actualizaciones (Changelog)

Este documento actúa como la bitácora oficial de cambios de **Mi Inventario Fácil**, permitiendo una trazabilidad técnica de las mejoras, correcciones y refactorizaciones realizadas en el ecosistema.

---

## [2026-03-31] — feat/services-redesign: Rediseño módulo servicios + fixes cotizaciones

### Servicios — Abonos parciales
- `POST /services/orders/{id}/payments` — endpoint para abonos anticipados (monto, método, referencia)
- Formulario de abono inline en `ServicesUnified.jsx`
- Los abonos NO marcan `payment_status=PAID` — solo el checkout lo hace
- Auto-checkout al marcar `DELIVERED`: si abonos ≥ total → crea `Sale` automáticamente → aparece en reportes

### Servicios — Plantillas de servicio (`service_templates`)
- Tablas `service_templates` + `service_template_items` por schema de tenant (migración `f0a1b2c3d4e5`)
- Router `service_templates.py`: CRUD completo, admin solo para crear/editar/borrar, cualquier auth para listar
- Modelo `ServiceTemplate` + `ServiceTemplateItem` en `models.py`
- Schemas en `schemas/__init__.py`: `ServiceTemplateCreate`, `ServiceTemplateUpdate`, `ServiceTemplateRead`
- UI `ServiceTemplatesManager.jsx`: gestión de plantillas desde el módulo de servicios
- `NewOrderModal.jsx`: integración para precargar ítems desde plantilla al crear orden

### Servicios — Fixes críticos search_path
- `.get()` legacy → `.filter().first()` en `add_item` / `create` (search_path compatible)
- `db.flush()` antes de eager loading en `update_status`
- Helper `_service_order_options()` con joinedload completo de todas las sub-relaciones — evita lazy loads post-commit

### Feature Flags sistema (migración `a3b4c5d6e7f8`)
- Columna `tenants.feature_flags JSONB` en schema public
- `feature_flags_registry.py`: registro central de flags conocidos (label, descripción, categoría)
- Hook `useFeatureFlag('flag_name')` en frontend
- Panel SaaS admin muestra/activa flags por tenant sin deploy

### Cotizaciones — Fixes UX y layout
- **Post-save panel**: `QuoteEditor.jsx` ya no hace `onBack()` inmediato al guardar. Muestra panel con opciones: "Cargar en Caja (POS)", "Imprimir", "Volver al listado"
- **HashRouter URL**: `window.location.href` corregido a `'/#/pos?quote_id=...'` en `QuoteList.jsx` y `CotizacionesTab.jsx`
- **Botones invisibles en tarjetas**: `h-[260px]` removido de ambas listas — el footer de acciones ya no queda cortado por `overflow-hidden`

### Tests
- 18 tests PostgreSQL para auto-checkout + regresiones (suite `test_services_pg_*.py`)
- Todos los tests pasando ✅

---

## [2026-03-23] — Fix: Display multi-moneda POS (carrito, tarjetas, cobro)

### Contexto
Tenant con COP y VES (Bs) activos simultáneamente. Los productos asignados a tasa COP
(exchange_rate_id = COP rate) almacenaban `subtotal_bs = price * COP_rate`. Sin embargo
el POS mostraba todo con símbolo "Bs" y calculaba el vuelto en Bs usando `totalBs/totalUSD`
que era en realidad la tasa COP, no VES.

### Fix: Etiqueta correcta en carrito (POSCart per-item)
**Causa:** El badge de moneda secundaria usaba `secondaryCurrency.symbol` + `subtotal_usd * secondaryCurrency.rate`, siempre "Bs 450" aunque el ítem fuera COP-priced.
**Fix:** Resuelve `item.exchange_rate_id` → `currency_symbol` real del ítem → muestra "COP 37,107.60" para ítems COP-priced, "Bs 450" para VES-priced.
**Archivo:** `POSCart.jsx`

### Fix: Footer carrito multi-moneda
**Causa:** Solo mostraba una moneda secundaria (`secondaryCurrency`) en el total.
**Fix:** Itera `totalsByCurrency` → muestra total en CADA moneda no-USD activa (Bs + COP si ambas activas).
**Archivo:** `POSCart.jsx`

### Fix: PaymentModal resumen "Total en Bolívares" → multi-moneda dinámico
**Causa:** Panel fijo "Total en Bolívares" siempre usaba `displayTotalBs` (que era COP cuando items eran COP-priced) con tasa VES (inconsistente).
**Fix:** Loop sobre `totalsByCurrency` → un panel por cada moneda activa con su nombre, tasa y símbolo correctos. Fallback si no hay monedas no-USD.
**Archivo:** `PaymentModal.jsx`

### Fix: Vuelto Bs usaba tasa COP (bug crítico)
**Causa:** `effectiveRate = totalBs/totalUSD` → con producto COP-priced daba tasa COP (3710.76) → vuelto en "Bs" era 7421 en lugar de 90.
**Fix:** `effectiveRate = (totalsByCurrency.VES/totalUSD) || defaultBsRate` → siempre usa tasa VES real.
**Archivo:** `PaymentModal.jsx`

### Fix: "Falta por pagar en Bolívares" → dinámico por moneda
**Causa:** Hardcodeado con fórmula `Bs X` usando `totalBs/totalUSD` (misma tasa errónea).
**Fix:** Loop sobre `totalsByCurrency` → muestra faltante en cada moneda activa con tasa correcta.
**Archivo:** `PaymentModal.jsx`

### Fix: Tarjetas de producto — secondaryCurrencies[] (todas las monedas)
**Causa:** `ProductCard` solo aceptaba una moneda secundaria → si VES era primaria, mostraba VES pero no COP.
**Fix:** Acepta `secondaryCurrencies[]` (array). Cuando toggle ON, muestra badge de precio para CADA moneda activa.
**Archivos:** `ProductCard.jsx`, `POSCatalog.jsx`, `POS.jsx`

### Fix: Toggle toolbar — etiqueta multi-moneda
**Causa:** Botón solo mostraba `secondaryCurrency.symbol` → "Bs OFF".
**Fix:** Muestra todos los símbolos activos → "Bs/COP OFF" / "Bs/COP ON".
**Archivo:** `POS.jsx`

### Tests añadidos (254 total — todos pasan ✅)
- `pos-multicurrency-cart-label.test.js` — etiqueta real del ítem, footer totalsByCurrency
- `pos-multicurrency-payment-modal.test.js` — paneles por moneda, vuelto Bs fix, falta por pagar
- `product-card-multicurrency.test.js` — secondaryCurrencies[], toggle label

---

## [2026-03-23] — Fix: Multimoneda COP + Landing + Trial 2 días

### Fix: Tasa COP 0.000269 redondeada incorrectamente a 0.0003
**Causa:** `exchange_rates.rate` era `Numeric(14,4)` en PostgreSQL — solo 4 decimales. COP inverso requiere 8.
**Fix:** Migración Alembic `d4e5f6a7b8c9` altera la columna a `Numeric(20,8)`. Config BCV scrap ahora guarda `round(float, 8)`. Frontend `step="0.00000001"` en MonedasTab.
**Archivos:** `alembic/versions/d4e5f6a7b8c9_*`, `models/models.py`, `routers/config.py`, `MonedasTab.jsx`

### Fix: Precio en COP no se mostraba en tarjetas del POS
**Causa:** ProductCard no recibía moneda secundaria. POS usaba `currencies.find()` que retornaba VES si ambas estaban activas.
**Fix:** `getPrimaryLocalCurrency()` respeta `is_default`. Toggle `showSecondaryPrice` (localStorage, default OFF) en toolbar del POS. ProductCard/POSCatalog pasan la moneda secundaria.
**Archivos:** `POS.jsx`, `POSCatalog.jsx`, `ProductCard.jsx`

### Fix: Modal de pago solo mostraba COP+USD, no mostraba Bs
**Causa:** PaymentModal usaba `find()` — retornaba solo la primera moneda no-USD.
**Fix:** Reemplazado por `map()` sobre el array completo de monedas deduplicadas.
**Archivo:** `PaymentModal.jsx`

### Fix: Vuelto, carrito y reportes no mostraban COP correctamente
**Causa:** Cálculos hardcodeados para Bs (`subtotal_bs`, `totalBs`). ZReportPDF agrupaba todo lo no-USD como "Bs".
**Fix:** Cart calcula on-the-fly con `subtotal_usd * secondaryCurrency.rate`. ZReportPDF agrupa por `currency_code` en objeto `localTotals`. CashClosingModal usa `data.symbol` dinámico.
**Archivos:** `POSCart.jsx`, `ZReportPDF.jsx`, `CashClosingModal.jsx`

### Fix: Formulario de contacto landing page — "no se pudo enviar mensaje"
**Causa:** `API_URL` ya incluía `/api/v1` (bakeado en build), la URL resultante era `.../api/v1/api/v1/support/tickets/public-contact` → 404.
**Fix:** Se agrega `normalizedApiUrl` igual que el formulario de registro.
**Archivo:** `landing_page/main.js`

### Cambio: Trial por defecto 15 → 2 días
**Motivo:** Reducir período de prueba para mayor control comercial.
**Fix:** Cambiado en `config.py` (`LICENSE_TRIAL_DAYS_DEFAULT=2`), `models/tenant.py`, `schemas/tenant.py`, `routers/admin.py`, `main.py`. Tests actualizados.

### Tests añadidos
- **Backend:** `test_exchange_rate_precision.py` (12 tests Numeric(20,8))
- **Frontend:** `exchange-rate-precision.test.js`, `payment-modal-currencies.test.js`, `product-card-secondary-price.test.js`, `pos-cart-secondary-price.test.js`, `zreport-multi-currency.test.js` (~138 tests nuevos)
- **CI:** Tests Jest integrados en `deploy_images.sh` y `Dockerfile.prod` (test-stage)

---

## [2026-03-19] — Fix: Cotizaciones + Config empresa + POS + Eliminación tenant

### Fix: Botón "Nueva Cotización" no hacía nada
**Causa:** La ruta `/quotes` tenía un `<Navigate>` que redirigía de vuelta a `SalesCenter`, formando un bucle. El botón navegaba pero el redirect lo regresaba al mismo lugar.
**Fix:** Se eliminó el redirect y se dejó la ruta `/quotes` apuntando directamente a `QuotesManager`. Se pasaron `onCreateNew` y `onEdit` como props a `CotizacionesTab` para navegar correctamente.
**Archivos:** `App.jsx`, `SalesCenter.jsx`, `CotizacionesTab.jsx`

---

### Fix: Configuración empresa no guardaba (business_config)
**Causa:** `update_business_info` llamaba `get_business_info` **después** de `db.commit()`, lo que reseteaba el `search_path` y lanzaba `relation "business_config" does not exist`.
**Fix:** Se movió la query antes del commit usando `db.flush()` (patrón estándar del proyecto).
**Archivo:** `ferreteria_refactor/backend_api/routers/config.py`

---

### Fix: Stock del POS no se actualizaba en tiempo real
**Causa:** Al cerrar el modal de éxito de venta, el carrito se limpiaba pero los productos en el catálogo no se refrescaban del servidor.
**Fix:** Al cerrar `handleSuccessClose`, se llama `refreshProduct(item.product_id)` por cada producto vendido antes de limpiar el carrito.
**Archivo:** `ferreteria_refactor/frontend_web/src/pages/POS.jsx`

---

### Feature: Filtros y ordenamiento en pestaña Productos del inventario
**Nuevos filtros client-side:**
- Por stock: `En stock` / `Stock bajo` / `Agotado`
- Ordenamiento: A→Z, Z→A, Precio ↑, Precio ↓
**Implementación:** `useMemo` en `ProductsTab.jsx` para no re-fetching innecesario.
**Archivo:** `ferreteria_refactor/frontend_web/src/pages/Inventory/tabs/ProductsTab.jsx`

---

### Fix: Eliminación de tenant falla con FK violation
**Causa:** El orden de eliminación era: (1) borrar usuarios → ERROR porque tablas del schema del tenant (ej. `cash_sessions`) tienen FK a `public.users`. (2) borrar tenant → ERROR porque `support_tickets` en public tiene FK a `public.tenants`.
**Fix:** Se invirtió el orden:
1. `DROP SCHEMA CASCADE` primero → elimina todas las tablas del tenant y sus FK
2. Borrar `support_tickets` de public para ese tenant
3. Borrar usuarios, pagos y finalmente el tenant
**Archivo:** `ferreteria_refactor/backend_api/routers/admin.py`

---

### Rediseño tarjetas POS
**Cambios:**
- Imagen con `object-contain` (foto completa, sin recorte)
- Imagen ocupa 60% de la tarjeta (`min-height: 110px`)
- Badges IMEI/SERIAL más pequeños, esquina superior izquierda
- Badge AGOTADO en rojo sólido, esquina superior derecha
- Info compacta: nombre (2 líneas), SKU + `X un.`, precios en una fila
- `ROW_HEIGHT` del grid virtual: 380 → 230px (caben más productos en pantalla)
**Archivo:** `ferreteria_refactor/frontend_web/src/components/pos/ProductCard.jsx`, `POSCatalog.jsx`

---

### UX: Buscador POS selecciona texto al hacer foco
**Comportamiento:** Al hacer clic en el buscador del POS, todo el texto se selecciona automáticamente. Presionar Backspace una vez borra todo.
**Implementación:** `onFocus={(e) => e.target.select()}` + `onMouseUp={(e) => e.preventDefault()}` (evita que mouseUp deshaga la selección).
**Archivo:** `ferreteria_refactor/frontend_web/src/components/common/SearchWithScanner.jsx`

---

### Fix + UX: Panel SaaS Admin fondo blanco
**Fix build:** Variable `activeSortLabel` declarada pero no usada en `ActivityDashboard.tsx` — removida.
**UX:** Fondo del contenido cambiado de `bg-slate-50` (gris) a `bg-white` en `DashboardLayout`, `ActivityDashboard` y `Tenants`.

---

## [2026-03-15] — Fix: Créditos con stock insuficiente + Sistema de Onboarding con Videos YouTube

### Fix: Venta a crédito se registraba aunque no hubiera stock
**Causa raíz:** `create_sale` en `sales_service.py` hacía `db.flush()` (crea el encabezado de venta) antes de validar el stock. Al fallar el stock lanzaba `HTTPException`, pero el `except HTTPException: raise` no hacía `db.rollback()`. El `finally` de `get_db()` llamaba `db.commit()` y committeba el encabezado de venta vacío.

**Fix:** Se agregó `db.rollback()` en el bloque `except HTTPException` de `create_sale`.

```python
except HTTPException:
    db.rollback()  # ← línea agregada
    raise
```

**Archivo:** `ferreteria_refactor/backend_api/services/sales_service.py` (línea ~633)

---

### Feature: Sistema de Onboarding con Videos YouTube

**Objetivo:** Mostrar un video tutorial corto la primera vez que un usuario entra a cada módulo/pestaña. Se puede re-ver con el botón "Ver tutorial".

**Arquitectura:**
- `src/config/onboardingVideos.js` — mapa `"modulo:pestana"` → `{ videoId, title }`
- `src/hooks/useOnboardingVideo.js` — hook con lógica localStorage (`onboarding_video:tenantId:userId:key`)
- `src/components/common/OnboardingVideoModal.jsx` — modal con iframe YouTube 16:9, autoplay

**Integración actual:** `InventoryCenter.jsx`
- Modal se muestra automáticamente al entrar a una pestaña con video configurado (delay 800ms)
- Banner de descripción muestra botón "▶ Ver tutorial" si la pestaña tiene video
- Estado "visto" aislado por tenant + usuario (no se mezclan entre cuentas)

**Videos disponibles:**
| Clave | Video | Descripción |
|---|---|---|
| `inventory:productos` | `btv6ZDuO4kA` | Cómo gestionar productos |

**Para agregar más videos:** editar `src/config/onboardingVideos.js` y descomentar/agregar entradas.

---

## [2026-03-14] — Fix Masivo: db.refresh() + Comisiones + Traslados con Fotos + Onboarding

### Fix Crítico: Patrón `db.refresh()` / post-commit queries
**Causa raíz de múltiples errores "relation does not exist"**: después de `db.commit()`, PostgreSQL resetea el `search_path` del tenant. Como `expire_on_commit=False` está configurado, `db.refresh()` es innecesario y rompe el tenant isolation.

**Regla:** Siempre usar `db.flush()` antes de `db.commit()` para obtener IDs. Nunca `db.refresh()` ni queries con `joinedload` post-commit.

**Archivos corregidos:**
- `routers/warranties.py` — 4 endpoints (create/update policy, create/update claim)
- `routers/employees.py` — create/update employee
- `routers/services.py` — create_service_order, add_item_to_order, delete_service_order_item (queries movidas antes del commit)
- `routers/products.py` — discount rules endpoints (líneas 1307, 1332)
- `routers/price_lists.py` — update y patch endpoints
- `routers/modules/restaurant/orders.py` — create order (dine-in + takeout) y add items
- `routers/support_client.py` y `support_admin.py`

### Fix: Sistema de Comisiones unificado a CommissionLog
**Problema:** Dos tablas de comisiones coexistían: `commissions` (barbería, legacy) y `commission_logs` (general/ventas). El frontend consultaba `commissions` pero las ventas generaban registros en `commission_logs`.

**Fix:**
- `routers/employees.py`: GET `/commissions` y POST `/commissions/{id}/pay` ahora usan `CommissionLog` + `CommissionStatus`
- `schemas/employees.py`: `CommissionResponse` reescrito con campos de CommissionLog (`user_name`, `source_type`, `amount`, etc.)
- `pages/Barbershop/CommissionsReport.jsx`: Reescrito completo para usar `CommissionLog`, columna "Tipo" (Venta/Servicio)

### Fix: Recepción de Servicios (Reception.jsx)
- Búsqueda de clientes: `?search=` → `?q=` (param correcto del backend)
- Respuesta paginada: `res.data` → `res.data.items || []`

### Fix: Tenant con guiones en nombre de esquema
- `database/db.py`: regex `^[a-zA-Z0-9_]+` → `^[a-zA-Z0-9_-]+`
- 7 tenants bloqueados (ej. `lavado-automoto-y-accesorios-el-progresito`) ahora pueden iniciar sesión

### Fix: Permisos de directorio de media en VPS
- **Problema runtime:** `/app/media/` era propiedad de `root`, pero el backend corre como `appuser`
- **Fix temporal aplicado:** `docker exec -u root backend_qa chown -R appuser:appgroup /app/media`
- **Pendiente:** Hacer permanente en Dockerfile

### Feature: ExternalTransferIn — Modal de búsqueda de productos
- Reemplazado `ProductSearchSelect` inline (se ocultaba detrás de la tabla) por `ProductSearchModal`
- Modal centrado con z-50, búsqueda con debounce 300ms, resultados scrollables
- Cada fila de la tabla tiene botón "Buscar producto" que abre el modal

### Feature: ExternalTransferOut — Evidencia fotográfica
- Sección de fotos antes del botón "Generar Paquete"
- Upload a `/api/v1/inventory/transfer/upload-photo` → `/app/media/transfers/`
- Almacenamiento permanente en VPS (UUIDs, no temporales)
- URLs incluidas en el JSON generado (`photo_urls: []`)
- Thumbnails 4 columnas con indicador de subida + botón eliminar

### Feature: ExternalTransferIn — Visualización de fotos del traslado
- Al importar un JSON, si tiene `photo_urls`, se muestran thumbnails clickables
- Lightbox modal para ver fotos en grande con navegación ← → entre fotos
- **Backend:** `preview_transfer_package` ahora retorna `photo_urls` del JSON
- **Schema:** `TransferPreviewResult` incluye `photo_urls: Optional[List[str]]`
- URLs resueltas con `API_ROOT_URL` (no relativas) — igual que imágenes de productos

---

## [2026-03-14] — Budget filtering en Bot + Fix Kardex en anulación de compras

### Bot Telegram — Presupuesto y System Prompt mejorado
- **System prompt completo:** sinónimos, normalización de modelos, detección de presupuesto, spanglish, typos
- **Budget filtering:** campos `budget_min`/`budget_max` en intent de Gemini → filtrado client-side en bot
- **Backend `min_price`/`max_price`:** nuevos query params en endpoint `/api/v1/products/catalog`
- **Intent `offtopic`:** nuevo tipo para mensajes no relacionados con productos

### Fix: Anulación de facturas de compra crasheaba
- `purchases.py:302` usaba `notes=` y `user_id=` al crear Kardex → modelo solo tiene `description` y no `user_id`
- Fix: `notes` → `description`, eliminado `user_id`

**Archivos:** `routers/purchases.py`, `telegram_bot/bot.py`, `telegram_bot/gemini_service.py`, `telegram_bot/inventory_api.py`, `routers/products.py`

---

## [2026-03-13] — Bot Telegram con IA + Módulo Proveedores + Centros Unificados

### Bot de Telegram (nueva rama: `feature/telegram-bot`)
Chatbot para clientes que permite buscar productos del inventario por lenguaje natural.
Ver documentación completa en `21_Bot_Telegram.md`.

**Stack:** Python + python-telegram-bot v20 + Google Gemini 2.5 Flash + httpx async

**Características implementadas:**
- Lenguaje natural: "tienen iphone y samsung?" → 2 búsquedas separadas en el catálogo
- Soporte multi-producto en un solo mensaje (`queries: []`)
- Envío de fotos de productos cuando tienen `image_url`
- Fallback inteligente cuando Gemini no está disponible (`_clean_query_fallback`)
- Rate limiting por usuario (2s entre consultas)
- `/buscar <término>` para búsqueda directa sin Gemini

**Identificación de tenant:** Header `X-Tenant-ID` en cada request al backend central (`api.miinventariofacil.com`)

**Bugs resueltos durante desarrollo:**
- `price` como string "90.0000" → función `_to_float()` antes de formatear
- Regex sin `\b` convertía "SAMSUNG" en "S A M S U N G" → reescrito con word boundaries
- `gemini-2.0-flash` da 404 con API keys nivel 1 → cambiado a `gemini-2.5-flash`
- Indentación rota por trabajo de agentes paralelos → archivo reescrito completo

**Archivos creados:**
- `telegram_bot/bot.py` — handler principal
- `telegram_bot/gemini_service.py` — wrapper Gemini con system prompt de tienda
- `telegram_bot/inventory_api.py` — cliente HTTP con header tenant
- `telegram_bot/config.py`, `Dockerfile`, `requirements.txt`, `.env.example`

**Rama:** `feature/telegram-bot` | **Commits:** `a42a1de`, `71bfa3d`, `162b35d`

---

### Módulo de Proveedores — 8 bugs corregidos
- `joinedload` en queries de compras para evitar lazy-load cross-schema
- `purchase_date` y `due_date` ahora se envían correctamente al crear factura
- Eliminación/anulación de órdenes con reversión de stock (Kardex `PURCHASE_VOID`)
- Anulación de facturas pagadas al contado (validación por `PurchasePayment` count, no `paid_amount`)
- `PurchaseProductBasic` schema mínimo para evitar lazy-load de `category`/`price_rules`
- `PaymentStatus(str, enum.Enum)` → serializa como `"PENDING"` no `"PaymentStatus.PENDING"`

**Archivos:** `routers/purchases.py`, `services/inventory_service.py`, `schemas/__init__.py`, `models/models.py`

---

### Centros Unificados (rama: `feature/reports-center`)

#### Centro de Inventario (`InventoryCenter.jsx`)
6 tabs: Productos, Categorías, Kardex, Traslados, Almacenes, Seriales
Reemplaza 8+ páginas dispersas. Cada tab tiene descripción contextual.

#### Centro de Ventas (`/sales-center` → `SalesCenter.jsx`)
5 tabs: Cotizaciones, Clientes, Devoluciones, Garantías, Créditos CxC
Sidebar: grupo "Ventas" reemplazado por un solo item. Rutas viejas redirigen a `/sales-center?tab=XXX`.

#### Centro de Configuración (`/config-center` → `ConfigCenter.jsx`, solo ADMIN)
9 tabs: General, Usuarios, Monedas, Impuestos, Métodos de Pago, Impresoras, Políticas de Garantía, Auditoría, Estación POS
Sidebar: grupo "Configuración" (8 items) reemplazado por un solo item. Rutas viejas redirigen.

#### Tab Descriptions Banner
Todos los centros (Inventario, Ventas, Configuración) muestran un banner informativo bajo los tabs con descripción + tip contextual.

#### Garantía en Órdenes de Servicio (Reception.jsx + ServiceManager.jsx)
- `Reception.jsx`: selector de política de garantía con pre-selección del default
- `ServiceManager.jsx`: badge con nombre y duración de la garantía asignada
- Backend ya tenía FK — solo faltaba exponer el selector en el frontend

#### Módulo Farmacia
- Activación automática por keyword ("FARMACIA", "DROGUERIA", "BOTICA") en `tenant_service.py`
- Fix en `config.py`: `pharmacy` y `barbershop` ahora aparecen en los 3 bloques del endpoint `/config/public`
- Pestaña "Farmacia" en sidebar solo visible cuando `has_pharmacy_module = true`

#### Sistema de Anuncios (AnnouncementModal)
- Modal de novedades con animación al entrar al sistema
- Parser de formato `emoji Título | descripción` para presentar features en tarjetas
- Dismiss persistente via `localStorage`

---

## [2026-03-13] — Centro de Inventario Unificado + Módulo Farmacia + Traslados Inter-Sucursales

### Centro de Inventario (`/inventory-center` → InventoryCenter.jsx)
Consolidación de 8+ páginas dispersas en un solo dashboard con 6 tabs. Reemplaza: Products, Categories, Inventory (Kardex), WarehouseManager, InventoryTransfers, ExternalTransferOut, ExternalTransferIn, SerializedReception.

- **Tab Productos**: Migrado completo de Products.jsx con CRUD, búsqueda, filtros, bulk actions, WebSocket, indicadores stock
- **Tab Categorías**: Migrado de Categories.jsx con tabla jerárquica, vista mobile, CRUD modal
- **Tab Kardex**: Migrado de Inventory.jsx (movimientos de inventario) con ajustes manuales, búsqueda, filtros fecha
- **Tab Traslados**: 3 sub-tabs con pill selector:
  - Internos (entre almacenes del mismo negocio)
  - Exportar (generar JSON para otra sucursal, descuenta stock)
  - Importar (recibir JSON con preview, fuzzy matching, mapeo manual, selector de almacén)
- **Tab Almacenes**: Migrado de WarehouseManager.jsx con grid, CRUD, inventario por almacén
- **Tab Seriales**: Migrado de SerializedReception.jsx para recepción de productos serializados (IMEI)

**Navegación**: Sidebar simplificado — un solo item "Centro de Inventario". Rutas antiguas (/products, /categories, /inventory, /warehouses, /transfers) redirigen con `<Navigate>`.

### Traslados Inter-Sucursales: Preview + Fuzzy Matching + Mapeo Manual
- **Backend**: `POST /transfer/preview` — recibe JSON de traslado, hace fuzzy matching por SKU/nombre con productos locales, retorna items clasificados (exact_match, fuzzy_match, no_match)
- **Backend**: `POST /transfer/import` v2 — acepta mappings manuales + `warehouse_id` por item
- **Frontend**: ExternalTransferIn.jsx reescrito con tabla preview a 3 colores (verde/amarillo/rojo), buscador de productos con z-50, selector de almacén global + por item
- **Schema**: `TransferImportV2Item.warehouse_id: Optional[int]` — almacén destino por producto

### Módulo Farmacia (Completo)
- **Backend**: Router `/pharmacy/` con endpoints: lots (CRUD), alerts (vencimientos), prescriptions, control-log
- **Backend**: Modelos: `ProductLot`, `Prescription` + columnas en `Product`: drug_classification, active_ingredient, storage_condition, requires_prescription
- **Frontend**: 4 páginas: PharmacyDashboard, PharmacyLots, PharmacyControlLog, PharmacyPrescriptions
- **Frontend**: Campos farmacéuticos en formulario de producto (sección azul), badges Rx/C/❄ en POS
- **Frontend**: Modal de receta obligatorio en POS al vender producto con requires_prescription
- **Frontend**: Tab Farmacia en ReportsCenter (vencimientos, ventas por clasificación, valoración)
- **Config**: `/config/public` ahora expone `pharmacy` y `barbershop` flags
- **SaaS Admin**: Toggle de módulo farmacia en panel de gestión de tenants
- **Landing**: Keyword detection para "FARMACIA"/"DROGUERIA"/"BOTICA" en tenant_service.py

### Migraciones SQL
- **M001**: `customers.is_active BOOLEAN DEFAULT TRUE` (eliminación lógica)
- **M002**: Índices en `sales` (is_credit, paid, due_date) para rendimiento CxC
- **M003**: `tenants.has_pharmacy_module`, columnas farmacia en `products`, tablas `product_lots` y `prescriptions`
- Aplicadas en QA (15 tenants) y PROD (19 tenants). Detalle en `20_Migraciones_SQL_Pendientes.md`.

---

## [2026-03-12] — Bug Fixes Ronda A + B: ReportsCenter, POS, Créditos, PDF, Comisiones

### POS: Cliente nuevo aparece sin refrescar
- `PaymentModal.jsx`: `handleQuickCustomerSuccess` agrega el nuevo cliente al array local inmediatamente, sin esperar evento WebSocket. Guard `alreadyExists` evita duplicados.

### Header: Botón "Reportes" al lado de "Vender"
- `Header.jsx`: Nuevo botón indigo con `BarChart2` → `Link to="/reports"` visible en navbar superior.

### Tab Ventas — Ventas del día no aparecían
- `SalesTab.jsx`: Cambiado `useState('COMPLETED')` a `useState('')` — sin filtro hardcodeado. Fix de desempaquetado de respuesta paginada `response.data.items` (antes leía `.data` como array). Límite subido a 200.

### Devoluciones — búsqueda por factura fallaba
- `ReturnsManager.jsx`: Eliminado `status=COMPLETED` hardcodeado. Fix desempaquetado `response.data.items`. Límite subido a 200.

### Avances POS — 3 monedas reducidas a 2
- `PaymentModal.jsx`: Selector de moneda ahora muestra exactamente USD + Bs (primera moneda no-USD), sin importar cuántas tasas (BCV, Paralelo) devuelva el backend.

### Créditos lentos — optimización
- `models.py`: Índices `index=True` en `Sale.is_credit`, `Sale.paid`, `Sale.due_date`.
- `products.py`: Límite default `/credits` 500→100. Eliminados JOINs pesados: `Sale.details→product` y `Sale.returns`.
- `CreditsTab.jsx`: Paginación acumulativa (`page`, `hasMore`, `total`). Botón "Cargar más (N restantes)". Reset al cambiar filtros.
- **SQL corrido en QA** (15 tenants): `idx_sales_is_credit`, `idx_sales_paid`, `idx_sales_due_date`.
- **SQL PENDIENTE en PROD**: Ver `.recordatorios/NOTAS.md` nota [009].

### PDF Cierre de Caja — nuevo formato
- `ZReportPDF.jsx`: Reescrito completo. Branding "Mi Inventario Fácil" (reemplaza "Invensoft"). Sin `toLocaleString` (incompatible con @react-pdf). Helpers manuales `fmtNum`, `fmtDate`, `fmtNow`. Secciones: Info sesión, Resumen ventas, Tabla por método de pago, Efectivo. Footer con URL `miinventariofacil.com`.

### Comisiones — ahora globales
- `ReportsCenter.jsx`: Eliminado `moduleRequired: 'barbershop'` del tab Comisiones. Ahora visible para **todos los tipos de negocio** (ferretería, lavandería, servicio técnico, etc.). Backend `/employees/commissions` ya era global (filtraba solo por `tenant_id`).

### SQL aplicado en QA (debe aplicarse en PROD)
```sql
ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
CREATE INDEX IF NOT EXISTS idx_sales_is_credit ON sales(is_credit) WHERE is_credit = true;
CREATE INDEX IF NOT EXISTS idx_sales_paid ON sales(paid);
CREATE INDEX IF NOT EXISTS idx_sales_due_date ON sales(due_date) WHERE due_date IS NOT NULL;
```

---

## [2026-03-11] — Centro de Reportes Unificado + Paginación POS + Tauri Removal + WS Fixes

### Centro de Reportes Profesional (`/reports` → ReportsCenter.jsx)
Consolidación de 16+ páginas dispersas en un solo dashboard con 7 tabs. Reemplaza: SalesHistory, CashHistory, AccountsReceivable, AgingReport, ClientLedger, AccountsPayable, SupplierLedger, CommissionsReport, UnifiedReports, DetailedReports.

- **Tab Resumen**: 6 KPIs con comparativa de períodos (% cambio), AreaChart ventas por día (Recharts), DonutChart métodos de pago, Top 10 productos/clientes, selector de fechas global con presets (Hoy/7D/Mes/30D/90D/Año), export Excel
- **Tab Ventas**: Sub-tabs Historial (migrado de SalesHistory — void con PIN, PDF, reprint, multi-moneda) + Análisis (por método de pago, por producto, por cliente top 50)
- **Tab Caja**: Sesiones expandibles con multi-moneda (Initial/Expected/Reported/Difference), reimprimir Z-Report via Hardware Bridge, descargar PDF, KPIs faltantes/sobrantes, export audit Excel
- **Tab Créditos**: Sub-tabs CxC (facturas con modal de pagos multi-moneda) + Antigüedad (aging buckets color-coded) + Estado de Cuenta (ledger inline con print)
- **Tab Proveedores**: Sub-tabs CxP (pagos a proveedores multi-moneda) + Estado de Cuenta proveedor (ledger + print)
- **Tab Inventario**: KPIs valuación (stock, inversión, valor venta, ganancia potencial, margen), tabla stock bajo con urgencia
- **Tab Comisiones**: Solo visible si módulo barbería activo. Tabla empleados con pago inline.

**Backend**: Nuevo endpoint `GET /reports/sales/period-comparison` para comparativa de períodos con métricas (revenue, transactions, items, avg_ticket, profit) + porcentaje de cambio.

**Navegación**: Sidebar simplificado — eliminados 8 items dispersos, agregado "Centro de Reportes" en Finanzas. Rutas antiguas redirigen a `/reports` via `<Navigate>`.

**Archivos creados**: `ReportsCenter.jsx`, `tabs/SalesTab.jsx`, `tabs/CashTab.jsx`, `tabs/CreditsTab.jsx`, `tabs/SuppliersTab.jsx`, `tabs/InventoryTab.jsx`, `tabs/CommissionsTab.jsx`
**Archivos modificados**: `Sidebar.jsx`, `App.jsx`, `unifiedReportService.js`, `sales_report.py`

---

## [2026-03-11] — Eliminación Tauri + Fixes WS + Notificaciones + Dashboard Actividad + Paginación POS

### POS: Paginación Server-Side con Infinite Scroll
- **Backend**: Endpoint `GET /products/catalog` ahora retorna `{items, total, has_more}` (antes retornaba lista plana)
  - COUNT query con mismos filtros antes del fetch principal
  - Soporte: `skip`, `limit`, `search`, `category_id`, `warehouse_id`
- **Backend**: Nuevo endpoint `GET /products/lookup` — búsqueda de producto único por SKU (case-insensitive) o product_id
  - Usado para barcode scanning cuando el producto no está en cache local
  - Joins livianos (sin combo_items, price_rules, discount_rules)
- **Frontend**: Nuevo hook `usePOSCatalog.js` — gestión completa de paginación
  - `products` (array acumulativo para infinite scroll) + `productCache` (Map por ID y SKU)
  - `fetchPage(reset)` con AbortController para cancelar peticiones obsoletas
  - `loadMore()` para cargar siguiente página (PAGE_SIZE = 40)
  - `lookupProduct(skuOrId)` — busca en cache primero, luego llama `/products/lookup`
  - `getFromCache(id)` — lookup sincrónico para cotizaciones/órdenes
  - `refreshProduct(id)` — actualiza un producto desde el servidor (WebSocket events)
  - Re-fetch automático al cambiar search/categoryId/warehouseId
- **Frontend**: `POSCatalog.jsx` actualizado con infinite scroll
  - Detección de scroll via `FixedSizeGrid.onScroll` (threshold 600px)
  - Spinner flotante "Cargando más productos..." durante carga
  - Contador "Mostrando X de Y productos" en barra de categorías
  - `forwardRef` + `useImperativeHandle` para resetear scroll desde el padre
  - Búsqueda con debounce 300ms delegada al servidor (ya no filtra client-side)
  - Backward compatible: sin props nuevos funciona como antes
- **Frontend**: `POS.jsx` reintegrado con el hook
  - Removido state `catalog` y `filteredCatalog` (useMemo client-side)
  - Barcode scanning ahora async con `await lookupProduct(code)`
  - Cotizaciones/órdenes usan `getFromCache()` con fallback a `lookupProduct()`
  - WebSocket: suscripción a `product:updated` y `product:deleted` para refresh en tiempo real
- **Schema**: Nuevo `PaginatedCatalog(BaseModel)` con `items: List[ProductRead]`, `total: int`, `has_more: bool`
- **Rendimiento**: Carga inicial de 40 productos vs 500 anteriores (~92% menos datos)
- **Archivos creados**: `hooks/usePOSCatalog.js`
- **Archivos modificados**: `products.py`, `schemas/__init__.py`, `POSCatalog.jsx`, `POS.jsx`

### Dashboard de Actividad de Tenants (Monitor de Rendimiento)
- **Backend**: Nuevo endpoint `GET /admin/dashboard/activity?date_from=&date_to=` — consulta cross-schema para métricas por tenant
  - Ventas (count + revenue), productos, clientes, usuarios, último login, última venta
  - Clasificación automática: Activo (venta <7d), Baja Actividad (7-30d), Inactivo (30d+), Sin Uso (nunca vendió)
  - Filtrado por rango de fechas con preset por defecto al mes actual
- **SaaS Admin**: Nueva página `/dashboard/activity` con tabla interactiva completa
  - Cards resumen clickeables para filtrar por estado (Activo/Baja/Inactivo/Sin Uso)
  - Búsqueda por nombre/schema, ordenamiento por cualquier columna (click en header)
  - Filtro de fechas con presets rápidos (7D, Mes, 30D, 90D, Año)
  - Exportar a CSV con BOM UTF-8 para Excel
  - Badges de licencia y demo por empresa
  - Formato "hace Xd/Xm" para fechas relativas
- **Archivos creados**: `activity.ts` (API), `ActivityDashboard.tsx` (página)
- **Archivos modificados**: `App.tsx` (ruta), `DashboardLayout.tsx` (nav link "Actividad")
- **Backend**: Endpoint en `admin.py` usa SQL raw cross-schema para máximo rendimiento

### Sistema de Notificaciones de Soporte (Badge en tiempo real)
- **Backend**: Nuevo endpoint `GET /support/tickets/unread-count?since=ISO` — cuenta tickets con respuesta admin desde última visita del cliente
- **Backend**: Nuevo endpoint `GET /admin/support/tickets/pending-count` — cuenta tickets abiertos/en progreso para badge admin
- **Frontend Cliente (Sidebar)**: Badge rojo animado en "Soporte" con conteo de respuestas no leídas, polling cada 60s
- **Frontend Cliente (SupportTickets)**: Auto-marca como leído al visitar la página (`localStorage` para tracking de última visita)
- **SaaS Admin (DashboardLayout)**: Badge rojo animado en "Mesa de Ayuda" con conteo de tickets pendientes, polling cada 60s
- **SaaS Admin (support.ts)**: Nueva función `getPendingCount()` para API de conteo
- Refactorizado `support_client.py` extrayendo `_resolve_tenant_id()` helper para evitar duplicación

### Eliminación completa de Tauri/Desktop
- Removido código Tauri de `constants.js`, `axios.js`, `Login.jsx`, `vite.config.js`, `package.json`
- Eliminados `@tauri-apps/api`, `@tauri-apps/cli`, 6 scripts npm `tauri:*`
- Eliminado `sync_local.py` (router de sincronización desktop)
- Eliminado `18_Plan_App_Escritorio_Tauri.md` (documentación completa)
- Limpiado código PyInstaller/frozen de `main.py`
- Removido `ENABLE_LOCAL_SYNC` feature flag de `config.py`
- Conservado: sistema de licencias desktop (funcionalidad admin SaaS)

### Fixes WebSocket y AutoSync
- **WebSocketContext.jsx**: Corregido retry infinito — ahora respeta `maxRetries=10` y para
- **AutoSyncContext.jsx**: Eliminado self-healing que enviaba `PUT /config/cloud_url` cada 30seg con token viejo del localStorage (causaba flood de 401 en logs)
- **websocket.py**: Rate-limit en logs de auth failure — max 1 log por IP cada 5 minutos (evita spam de cientos de líneas iguales)

### Infraestructura Prod
- **TZ=America/Caracas** agregado a `docker-compose.yml` de producción (backend + db)
- Migraciones de licencias verificadas en prod (todas aplicadas, Alembic en head `c3d4e5f6a7b8`)

---

## [2026-03-10] — Auditoría de Seguridad Completa (35+ fixes)
**Branch:** `fix/critical-security-multiagent` | **15 commits atómicos** | **4 agentes correctores + 4 verificadores**

### Resumen Ejecutivo
| Categoría | Fixes | Destacados |
|-----------|-------|------------|
| Seguridad | 8 | Cloudflare token externalizado, bare excepts eliminados, CORS dinámico, nginx headers, non-root Docker |
| Performance | 4 | 6 FK indexes, React.lazy 58 páginas, N+1 query corregido, paginación server-side |
| UX | 4 | alert() → toast (37 calls), console.log removidos (17 calls) |
| Docker/DevOps | 11 | Versiones pinneadas (30 Python + 8 images), healthchecks, resource limits, TZ=America/Caracas |
| Bugs producción | 4 | CORS multi-nivel, slowapi param naming, Alembic orphan recovery, UTC timezone |

### Bugs de Producción (descubiertos durante deploy QA)

| Commit | Fix | Causa Raíz |
|--------|-----|------------|
| `9c57e63` | TZ=America/Caracas en backend + DB | Contenedores en UTC, horas incorrectas |
| `7467bca` | Register: `request` → payload para slowapi | slowapi requiere param Request llamado exactamente `request` |
| `a519188` | CORS regex multi-nivel | Regex solo matcheaba 1 nivel de subdominio, QA usa 2 (`tenant.qa.domain`) |
| VPS fix | Alembic stamp `0fbdc2b894af` → `b2c3d4e5f6a7` | Revisión huérfana en BD, migraciones bloqueadas |

### Commits anteriores del branch: `ad8eb51`, `a0082cd`, `0aeb314`, `5cb5439`

### fix(security): Global exception handler — no expone internos del servidor

`backend_api/main.py` — el handler global de excepciones ya no retorna `str(exc)` ni `type(exc).__name__` en la respuesta al cliente. Retorna siempre `{"detail": "Internal server error"}` y registra el error completo internamente con `logger.exception()`.

### fix(security): Endpoint de debug protegido con autenticación de superusuario

`backend_api/main.py` — `GET /api/v1/debug/routes` ahora requiere `Depends(get_current_superuser)`. Antes era accesible sin autenticación, exponiendo el mapa de rutas completo de la API.

### fix(security): CORS estricto en producción

`backend_api/main.py` — en `ENVIRONMENT=production` el middleware CORS solo permite orígenes con `https://`. En desarrollo (`ENVIRONMENT=development`) permite también `http://localhost` para facilitar el trabajo local.

### fix(performance): Pool de conexiones PostgreSQL ampliado

`backend_api/database/db.py` — `pool_size` aumentado de 20 a 80, `max_overflow` de 10 a 50. Elimina cuellos de botella bajo carga concurrente alta.

### fix(reliability): Reset de `search_path` transaccional garantizado

`backend_api/database/db.py` — el bloque `finally` que resetea el `search_path` del tenant ahora es robusto: loguea errores, ejecuta `db.rollback()` si falla el reset, y `db.close()` en un `finally` anidado garantizado para evitar conexiones huérfanas.

### fix(security): Rate limiting en endpoint `/pin-login`

`backend_api/routers/users.py` — endpoint `POST /pin-login` protegido con `@limiter.limit("5/minute")`. Se requirió añadir `request: Request` como parámetro para que `slowapi` pueda identificar el cliente.

### fix(performance): Eliminación de N+1 en `get_registers_status`

`backend_api/routers/cash.py` — `get_registers_status()` ahora usa `subqueryload(CashRegister.sessions).joinedload(CashSession.user)`. Reducción de ~5500+ queries a 2 queries totales por llamada.

### fix(performance): `CartContext.jsx` — evitar re-renders innecesarios en POS

`frontend_web/src/context/CartContext.jsx` — el objeto `value` pasado al `Provider` ahora está envuelto en `useMemo` con todas sus dependencias declaradas. Previene re-renders en cascada de todos los consumidores del contexto en cada render del carrito.

### fix(build): Eliminar `console.log` y `debugger` en bundle de producción

`frontend_web/vite.config.js` — añadido `esbuild: { drop: ['console', 'debugger'] }`. Todos los `console.*` y sentencias `debugger` son eliminados automáticamente en `npm run build`, sin requerir cambios manuales en el código fuente.

### feat(db): Migración — 8 índices FK faltantes

`alembic/versions/a1b2c3d4e5f6_add_missing_fk_indexes.py` — nueva migración que agrega índices en columnas de clave foránea sin índice previo:

| Tabla | Columna |
|-------|---------|
| `sales` | `customer_id` |
| `sales` | `session_id` |
| `products` | `supplier_id` |
| `products` | `category_id` |
| `kardex` | `product_id` |
| `kardex` | `warehouse_id` |
| `product_stocks` | `product_id` |
| `product_stocks` | `warehouse_id` |

**Archivos afectados:**
- `backend_api/main.py`
- `backend_api/database/db.py`
- `backend_api/routers/users.py`
- `backend_api/routers/cash.py`
- `frontend_web/src/context/CartContext.jsx`
- `frontend_web/vite.config.js`
- `alembic/versions/a1b2c3d4e5f6_add_missing_fk_indexes.py` (nuevo)

### fix(security): Cloudflare token externalizado + .gitignore hardening
`deploy_images.sh` — token de Cloudflare DNS movido a variable de entorno `${CF_DNS_API_TOKEN}`. `.gitignore` actualizado para excluir `.venv/` y proteger `.env.example`.

### fix(security): nginx security headers + non-root Docker user
- nginx: `X-Frame-Options DENY`, `X-Content-Type-Options nosniff`, `X-XSS-Protection`, `Referrer-Policy strict-origin-when-cross-origin`
- Backend Dockerfile: usuario `appuser` (non-root)
- Healthchecks con `python urllib` a `/api/v1/health`
- Resource limits: backend 512m, frontend 128m, db 1g, traefik 256m

### fix(security): bare excepts + CORS dinámico + N+1 en reporte deudas
- 4 `except:` → excepciones específicas (services, config, admin, cash)
- CORS: variable `CORS_ORIGINS` env var + merge con defaults
- N+1 en reporte de deudas: de 2N queries a 3 queries (2 subqueries + 1 join)

### fix(ux): alert() → toast (37 calls) + console.log removidos (17 calls)
- `commit cad95f9`: 11 archivos migrados de `alert()` a `toast()` (25 calls)
- `commit 5cb5439`: Products (5) + SalesHistory (7) migrados (12 calls)
- console.log debug removidos en 11 archivos (17 total)

### feat(devops): Versiones pinneadas + paginación server-side + ErrorBoundary
- `commit 78dc26f`: 30 paquetes Python pinneados (`==`) + 8 base images Docker con versión+distro
- `commit 02c2287`: Paginación server-side en products + customers (skip/limit, max 500)
- `commit 02c2287`: `LazyErrorBoundary` — class component que atrapa errores de chunk load en lazy routes

### feat(deploy): pytest pre-flight gate
`deploy_images.sh` — `commit a8bc757`: gate opcional de pytest antes de build. Si los tests fallan, el deploy se detiene.

### fix(docker): npm ci + memoria limitada para Alpine
`commit 6e1a65d`: Frontend Dockerfile usa `npm ci` en vez de `npm install` + flag `--max-old-space-size` para evitar OOM en Alpine.

### fix(deps): regenerar package-lock.json para Node 22
`commit edd2f56`: package-lock.json de frontend y saas_admin regenerados para compatibilidad con Node 22.

### fix(registration): trial_ends_at en registro público + fix module mapping
`commit 601546e`: `trial_ends_at` se setea correctamente al registrar por `/public/register`. Corregido mapeo de módulos por rubro.

### fix(config): variables LICENSE_* en Settings + warnings Pydantic V2
`commit 96a4afb`: Variables `LICENSE_*` en `Settings` de config. Últimos warnings de Pydantic V2 corregidos.

### feat(semana-4): rate limiting + barbería fase 3 + panel dispositivos
`commit ab04ace`: Rate limiting completo, barbería fase 3, panel de dispositivos, warnings fix.

### Pasos Pendientes del Branch
1. **Rotar token Cloudflare** — el viejo estuvo en git history
2. **Rotar `private_key.pem`** — JWT signing key estuvo en repo
3. **Aplicar migraciones en Producción** — ver procedimiento en sección 7.B de `05_Guia_Despliegue.md`
4. **CI/CD pipeline** — no existe; deploys son manuales (pytest gate local como alternativa)

---

## [2026-03-06] — Modal de Novedades + Tasa BCV + Mejoras Servicios Técnicos
**Branch:** `feature/tauri-desktop` | **Commits:** `5e4447e`, `63e1fc2`, `07b2e7b`, `ba23c9a`, `993405d`, `09e0c92`, `5e0ab8f`, `14b62a5`, `d4c5b35`, `defa5f7`

### feat: Modal "¿Qué hay de nuevo?" — Sistema de Anuncios de Novedades

Nuevo tipo de mensaje del sistema para anunciar funcionalidades a los clientes. Se diferencia del `GlobalBanner` existente (esquina superior) en que aparece como **modal centrado con backdrop blur**, una sola vez por usuario por mensaje.

**Arquitectura:**
- `message_type: 'banner' | 'announcement'` y `version_tag` añadidos a `public.system_messages`
- Migración Alembic `c4e5f6a7b8c9` + `repair_public_schema()` en `main.py` como safety net
- `NotificationContext.jsx` separa banners de anuncios en dos arrays independientes
- `AnnouncementModal.jsx` (nuevo): modal con gradiente indigo/violeta, lista de features parseada desde el contenido y CTA "¡Entendido, a trabajar!"
- `DashboardLayout.jsx`: incluye `<AnnouncementModal />` junto al `<GlobalBanner />`
- SaaS Admin `SystemMessages.tsx`: selector visual de tipo (Banner vs Novedad), campo `version_tag`, hint de formato

**Formato de contenido para lista de features:**
```
🔧 Título de la función | Descripción breve de la mejora
📱 Otra función         | Su descripción aquí
```
Si el contenido no sigue este formato, se muestra como párrafo normal (retrocompatible).

**Comportamiento:**
- Aparece 600ms después de cargar el dashboard
- Marcado como visto en `localStorage: announced_<id>` — no vuelve a aparecer
- Clic fuera del modal o `[×]` también lo cierra
- Broadcast WebSocket en tiempo real al publicar (payload ahora incluye `message_type`)

**Bug fix:** El payload del WebSocket no incluía `message_type` → el frontend recibía `undefined` → fallback `?? 'banner'` → el anuncio aparecía en la esquina como banner. Corregido en `routers/admin.py`.

**Archivos afectados:**
- `alembic/versions/c4e5f6a7b8c9_add_message_type_to_system_messages.py` (nuevo)
- `backend_api/models/system_messages.py`
- `backend_api/schemas/system_messages.py`
- `backend_api/routers/admin.py`
- `backend_api/main.py` (`repair_public_schema`)
- `frontend_web/src/components/common/AnnouncementModal.jsx` (nuevo)
- `frontend_web/src/context/NotificationContext.jsx`
- `frontend_web/src/layouts/DashboardLayout.jsx`
- `saas_admin/src/api/systemMessages.ts`
- `saas_admin/src/pages/SystemMessages.tsx`

---

### feat: Tasa BCV Automática — Web Scraping del Banco Central de Venezuela

Nuevo endpoint que hace scraping de `bcv.org.ve` y devuelve las tasas oficiales USD/VES y EUR/VES con un solo clic desde la pantalla de configuración de monedas.

**Backend — `routers/config.py`:**
- `GET /api/v1/config/exchange-rates/bcv` — endpoint público (sin auth), scraping con `requests` + regex
- Extrae las tasas de los elementos `<strong>` dentro de `#dolar` y `#euro`
- `verify=False` + `urllib3.disable_warnings()` para VPS Docker sin bundle de CAs
- **Posición crítica**: debe estar definido ANTES de `GET /exchange-rates/{id}`, o FastAPI intenta castear `"bcv"` como `int` y devuelve un error Pydantic que React no puede renderizar

**Frontend — `CurrencyConfig.jsx`:**
- Panel lateral "Tasa Oficial BCV" con botón "Consultar BCV"
- Muestra USD y EUR con timestamp de consulta
- Botón "Aplicar" por moneda — aplica la tasa al tipo por defecto del tab activo

**Archivos afectados:**
- `backend_api/routers/config.py`
- `frontend_web/src/pages/Settings/CurrencyConfig.jsx`

---

### feat: Impresión de Órdenes de Servicio Técnico

El endpoint `GET /services/orders/{id}/print/thermal` ahora genera tickets propios para reparaciones (antes usaba el template de lavandería).

**Backend — `routers/services.py`:**
- Contexto enriquecido: `device_type`, `brand`, `model`, `serial_imei`, `physical_condition`, `problem_description`
- Consulta la `WarrantyPolicy` por defecto del tenant y la inyecta en `context["order"]["warranty"]`
- Selección automática de template: si `service_type == REPAIR` usa `get_service_repair_58/80_template()`, si no usa el de lavandería

**Backend — `template_presets.py`:**
- Nuevos `get_service_repair_58_template()` y `get_service_repair_80_template()`
- Sección dedicada `** GARANTIA DE SU EQUIPO **` al final del recibo (oculta si no hay garantía)

**Frontend — `Reception.jsx`:**
- Auto-impresión al crear orden: llama `GET /services/orders/{id}/print/thermal` y `printerService.printRaw()`
- Toast `🖨️ Sin impresora conectada` si falla (sin interrumpir el flujo)
- Botón "Reimprimir Ticket" en la sección de éxito
- `lastOrderId` state para rastrear la última orden creada

---

### feat: IMEI y Garantía en Recibos POS de Teléfonos Serializados

Al vender un producto con `has_imei=True`, el recibo ahora muestra el IMEI bajo el nombre del producto y una sección de garantía al final.

**Backend — `services/sales_service.py` (`get_sale_print_payload`):**
- Query enriquecida con `joinedload(SaleDetail.instances).joinedload(SaleDetailInstance.product_instance)` y `joinedload(SaleDetail.product).joinedload(Product.warranty_policy)`
- Campo `serial_numbers: list[str]` por ítem (IMEIs de las instancias vendidas)
- Campo `warranty: {name, duration_text, description}` por ítem (de `Product.warranty_policy`)

**Backend — `template_presets.py`:**
- Templates POS `get_services_sale_58/80_template()` actualizados
- `IMEI: ...` debajo del nombre del producto (si tiene seriales)
- Sección `** GARANTIA DE SU EQUIPO **` al final: agrupa todos los ítems con garantía

---

### fix: `warranty_policy_id` no se guardaba al editar un producto

`ProductUpdate` en `schemas/__init__.py` no tenía el campo `warranty_policy_id`, por lo que el backend lo ignoraba silenciosamente.

```python
# schemas/__init__.py → ProductUpdate
warranty_policy_id: Optional[int] = None  # campo añadido
```

---

### fix: `warranty_policies` tabla faltante en esquemas tenant

La migración de `migrate_tenants.py` intentaba añadir la FK `warranty_policy_id` en la sección 1 antes de que la tabla `warranty_policies` existiera (creada en sección 4). Corregido añadiendo el `CREATE TABLE IF NOT EXISTS warranty_policies` como paso 0.3 (antes de cualquier FK que la referencie).

---

### fix: Notificaciones apiladas en Recepción Serializada

Al escanear IMEIs rápidamente, los toasts se apilaban creando ruido visual. Corregido usando ID fijo `{ id: 'imei-scan', duration: 1500 }` — cada nuevo toast reemplaza al anterior.

---

### ux: Botón "Recepción" movido a `/products`

El acceso a Recepción Serializada se movió de `/#/inventory` a `/#/products` y ahora solo es visible cuando el módulo de servicios está activo (`modules?.services`).

---

### ux: Alerta de Stock Mínimo visible en productos IMEI

Al editar/crear un producto con `has_imei=True`, la sección de inventario se ocultaba (correcto, ya que el stock se gestiona por unidades individuales), pero también ocultaba `min_stock`. Ahora aparece una card "Alerta de Stock Mínimo" dedicada con `min_stock` + `location` solo para productos IMEI.

---

## [2026-03-05] — POS: Venta en pausa (Hold Sale)
**Branch:** `feature/tauri-desktop` | **Commits:** `6aa8a6e`, `965cfa1`

### feat(pos): Pausar y retomar ventas en el POS

Permite al cajero congelar el carrito actual, atender a otro cliente y retomar la venta cuando el cliente regrese.

**Decisión de diseño:** 100% frontend (estado React), sin backend ni migraciones. Solo 1 pausa simultánea. Se descarta si el cajero cierra sesión.

**`CartContext.jsx`:**
- `heldCart` state: `{ items, cartDiscount, pausedAt }` — guarda items Y el descuento aplicado
- `holdCart()` — guarda carrito actual en `heldCart`, limpia el POS
- `resumeHeldCart()` — restaura items y descuento exactamente como estaban
- `discardHeldCart()` — elimina la pausa sin restaurar

**`POS.jsx`:**
- Botón **⏸ Pausar** siempre visible en el header (entre "Órdenes" y "Cerrar Caja"), desactivado con carrito vacío
- Banner ámbar bajo el header cuando hay venta pausada: hora + cantidad ítems + [Retomar] + [Descartar]
- Hotkey **F6**: pausa si hay items; retoma si ya hay pausa activa
- Si al retomar el carrito actual tiene items, pide confirmación antes de reemplazar

**Flujo:**
```
[POS con items] → clic "Pausar" / F6
→ [POS limpio + banner ámbar "Venta pausada a las 14:32 · 3 ítems"]
→ cajero atiende siguiente cliente normalmente
→ clic "Retomar" / F6 → restaura carrito y descuento
```

---

## [2026-03-05] — Limpieza Tauri + Fix routing QA + SaaS Admin funcional
**Branch:** `feature/tauri-desktop` | **Commits:** `a1feb74`, `4fd78ce`, `17b9a17`, `affea8f`, `73a5b95`

### feat: Eliminación completa de la feature Tauri Desktop
Se tomó la decisión de abandonar la app de escritorio. Se removió todo el código específico de Tauri conservando todos los cambios valiosos (restaurante, barbería, móvil, etc.).

**Archivos eliminados:**
- `frontend_web/src-tauri/` (Tauri config, Rust sources, 75+ icons)
- `desktop_backend/` (FastAPI local, PyInstaller spec, middleware, startup)
- `frontend_web/src/pages/LicenseActivation|DesktopFirstRun|DesktopSetup.jsx`
- `backend_api/models/desktop_license.py` + `routers/desktop_licenses.py`
- `alembic/versions/0fbdc2b894af` (migración desktop_licenses — nunca ejecutada en prod)
- `saas_admin/pages/DesktopLicenses` + modales + `api/desktopLicenses.ts`
- `build_desktop_exe.bat`, `iniciar_backend.bat`

**Archivos limpiados:**
- `App.jsx` — sin `IS_TAURI`, sin `tauriPreLicense`, sin retry loop, startup normal
- `backend_api/main.py` — sin `desktop_licenses_router`
- `saas_admin/App.tsx` y `DashboardLayout.tsx` — sin rutas/nav de licencias desktop

### fix(qa): SaaS Admin panel accesible en admin-qa.miinventariofacil.com
- **Problema 1:** Imagen Docker incorrecta: `ferreteria-saas` → `ferreteria-admin-panel`
  (el script `deploy_images.bat` usa `ferreteria-admin-panel` como nombre)
- **Problema 2:** Dominio incorrecto: `admin.qa.*` → `admin-qa.miinventariofacil.com`
  (patrón correcto: `{servicio}-qa.miinventariofacil.com`, igual que `api-qa`)
- **Problema 3 (previo):** Priority Traefik para evitar que wildcard frontend capture requests
  de dominios específicos (priority=200 en backend y saas_admin)
- **Resultado:** `https://admin-qa.miinventariofacil.com/login` funciona correctamente

### chore(docker): docker-compose.qa.yml creado
- Stack QA completo: traefik + frontend + backend + saas_admin + db
- Dominios QA: `*.qa.miinventariofacil.com` (frontend), `api-qa.*`, `admin-qa.*`
- `.dockerignore.fast` y `.dockerignore.full` actualizados para excluir `src-tauri/target/`

---

## [2026-03-05] — App Desktop Tauri: Backend local funcional + Licencias + Build pipeline
**Branch:** `feature/tauri-desktop` | **Commits:** `fb60a79`, `47d1a80`, `4122f97`

### feat(tauri): Desktop backend funcional con DB local y seeding
- **`desktop_backend/startup.py`** — `_seed_default_data()` crea automáticamente en `desktop_local`:
  tasas de cambio (BCV/Paralelo), métodos de pago (5), monedas (USD/VES/COP),
  almacén "Almacen1", caja "Caja Principal/C01". Idempotente.
- **`desktop_backend/startup.py`** — `_ensure_desktop_tenant()` ahora activa todos los módulos
  (`has_restaurant_module`, `has_laundry_module`, etc.) al crear o actualizar el tenant desktop.
- **`frontend_web/src/App.jsx`** — Retry loop de 60 segundos en modo Tauri: la app espera
  confirmación de `GET /api/v1/desktop/info` antes de montar los React Providers.
  Elimina los toasts "error del servidor" al arranque. Muestra pantalla de error si el
  backend no responde en 60s con botón "Reintentar".
- **`iniciar_backend.bat`** — Script doble-click para arrancar el backend Python en desarrollo.
- **`frontend_web/src/pages/LicenseActivation.jsx`** — Botón "Saltar licencia" solo en
  `import.meta.env.DEV` que guarda `DEV-0000-0000-0000` con expiración de 5 años.

### feat(restaurant): Mejoras módulo restaurante y móvil
- `frontend_web/src/pages/Restaurant/` — mejoras en TableMap, KitchenDisplay, MenuManager, OrderModal
- `frontend_web/src/pages/Mobile/` — mejoras en MobileOrderTaker, MobileTableGrid, WaiterLogin
- `backend_api/routers/modules/restaurant/orders.py` — mejoras en lógica de órdenes
- Documentación: `16_Modulo_Restaurante.md` creado con arquitectura completa del módulo

### feat(desktop): Sistema de licencias + PyInstaller build pipeline
- **`backend_api/models/desktop_license.py`** — Modelo `DesktopLicense` en `public.desktop_licenses`
  Campos: `license_key` (XXXX-XXXX-XXXX-XXXX), `plan_name`, flags de módulos,
  `max_devices`, `activations_count`, `expires_at` (null = perpetua), `is_active`, info del cliente
- **`alembic/versions/0fbdc2b894af_add_desktop_licenses_table.py`** — Migración crea la tabla
- **`backend_api/routers/desktop_licenses.py`** — Router con:
  - `POST /api/v1/desktop/license/activate` — endpoint **público** (sin auth)
  - `GET/POST/PUT/DELETE /api/v1/desktop/licenses` — CRUD para superadmin
- **`backend_api/main.py`** — Registra `desktop_licenses_router`
- **`desktop_backend/entry.py`** — Entry point PyInstaller (sin `__name__` guard, maneja `sys._MEIPASS`)
- **`desktop_backend/invensoft_backend.spec`** — Spec PyInstaller con hiddenimports completos
- **`build_desktop_exe.bat`** — Pipeline completo: PyInstaller → copy .exe → inject externalBin →
  `npm run tauri:build` → restaurar `tauri.conf.json`. Genera instalador NSIS.

### Pendiente (próxima fase)
- UI en SaaS Admin para gestionar licencias desktop (crear, ver activaciones, desactivar)
- DesktopFirstRun: agregar campos empresa/RIF en primer arranque
- Test real de `build_desktop_exe.bat` (pendiente correr en máquina con Rust + MSVC)
- Sidebar desktop: ocultar opciones cloud-only en modo Tauri

---

## [2026-03-03] - Visibilidad Completa: Cajero/Caja en CxC y Cotizaciones

### Cotizaciones
- `quotes.py` → `GET /quotes` ahora hace joinedload del `user` (creador)
- `schemas/__init__.py` → nuevo schema `QuoteCreatorInfo` (id, username, full_name); `QuoteRead` incluye `user: Optional[QuoteCreatorInfo]`
- `QuoteList.jsx` → badge indigo con el nombre del creador en cada tarjeta de cotización

### Cuentas por Cobrar (CxC)
- `products.py` → `GET /products/credits` ahora hace joinedload de `cash_session → user` y `cash_session → register`
- La respuesta incluye `cashier_name`, `register_name`, `register_code` por factura de crédito
- `AccountsReceivable.jsx` → celda Detalles muestra cajero en indigo + badge azul de caja

### CxP (Cuentas por Pagar)
- No aplica filtro de caja: las órdenes de compra no pasan por caja registradora sino por el módulo de compras/almacén

## [2026-03-03] - Visibilidad de Cajas en Toda la Plataforma

### Fix: Bug `db.refresh()` en CashRegister endpoints (multi-tenant)
- `POST /cash/registers` y `PUT /cash/registers/{id}` fallaban con `InvalidRequestError` al hacer `db.refresh()` después del commit porque SQLAlchemy pierde el `search_path` del tenant. Corregido usando re-query por ID/code.

### Reporte Z (cierre de caja)
- `sales_service.generate_z_report_payload()` ahora carga el `register` con joinedload
- El contexto incluye `session.register_name` y `session.register_code`
- El template imprime: `Caja: C01 - Caja Principal` justo después de `Sesion:`

### Historial de Caja (`GET /cash/sessions/history`)
- Endpoint ahora hace `joinedload(CashSession.register)`
- Respuesta incluye campo `register: {id, name, code}` por sesión
- `CashHistory.jsx` muestra badge azul con código de caja y nombre de registro en cada sesión

### Historial de Ventas (`GET /returns/sales/search`)
- Endpoint hace joinedload de `Sale → cash_session → user` y `Sale → cash_session → register`
- Respuesta enriquecida con `cashier_name`, `register_name`, `register_code` por venta
- `SalesHistory.jsx` muestra columna **Cajero / Caja** con nombre del cajero y badge de caja

### Cotizaciones: rastrear usuario creador
- Modelo `Quote` recibe campo `user_id` (FK nullable a `public.users`)
- `migrate_multicaja.py` paso 7: `ALTER TABLE quotes ADD COLUMN user_id IF NOT EXISTS`
- `quotes.py` router ahora requiere autenticación y guarda `current_user.id` al crear
- `QuoteRead` schema incluye `user_id: Optional[int]`

## [2026-03-03] - Página de Gestión de Cajas + Fix Tenant Seed

### Nuevo: `CashRegistersPage.jsx`
- Página en `/cash-registers` (solo ADMIN) bajo Finanzas → Gestión de Cajas.
- Muestra todas las cajas activas en cards con estado en tiempo real (Abierta/Cerrada, quién la tiene, desde cuándo).
- Métricas resumen: Total activas, Abiertas ahora, Cerradas.
- Crear nueva caja (nombre, código, descripción).
- Editar nombre/descripción (solo si está cerrada).
- Activar/Desactivar caja (solo si está cerrada). La Caja Principal (C01) está protegida.
- Auto-refresh cada 30 segundos.

### Fix: `tenant_service.py` — Gap en creación de nuevos tenants
- Antes: nuevos tenants creados en runtime no recibían "Caja Principal" hasta el próximo restart del servidor.
- Ahora: `seed_cash_register(schema_name)` se llama en el seed chain de `create_tenant()`, igual que warehouse, currencies, etc.
- Idempotente: si ya existe una caja, se salta el seed.

## [2026-03-03] - Soporte de Múltiples Cajas (Multi-Cash-Register)

### 1. Sistema de Multicajas
**Descripción**: Arquitectura completa para múltiples cajas simultáneas. Terminales físicas (`CashRegister`), validación por caja, vinculación de ventas a sesión, migración automática idempotente.

- **Modelo**: `CashRegister` + FK `register_id` en `CashSession` + FK `session_id` en `Sale`.
- **Constraint DB**: partial unique index `WHERE status='OPEN'` — 1 sesión por caja garantizada a nivel BD.
- **Migración**: `migrate_multicaja.py` — auto-ejecuta en startup, seed "Caja Principal", backfill sesiones existentes.
- **Endpoints**: `GET/POST/PUT /cash/registers`, `GET /cash/registers/status`.
- **Frontend**: `CashOpeningModal` en 2 pasos (selector de caja → montos). `CashContext` expone registers.
- **Rama**: `feature/multi-cash-register`
- **Archivos**: `models.py`, `schemas/__init__.py`, `migrate_multicaja.py`, `main.py`, `cash.py`, `sales_service.py`, `CashContext.jsx`, `CashOpeningModal.jsx`.

## [2026-03-03] - Créditos en Dashboard y Correcciones de Integridad

### 1. Dashboard: Resumen Global de Créditos Pendientes
**Descripción**: Integración de cuentas por cobrar en el resumen general del dashboard con datos reales y actualizados.
- **Cambios Técnicos**:
  - **Nuevo Endpoint**: `GET /reports/credits/summary` — consulta global (sin filtro de fecha) de todas las ventas a crédito pendientes (`is_credit=True, paid=False, balance_pending > 0`). Retorna `total_pending_usd`, `total_pending_bs`, `pending_count` y `exchange_rate`.
  - **KPI Card**: Nuevo indicador "Créditos Pendientes" en la grilla de KPIs del dashboard (5 columnas) con soporte multimoneda.
  - **Widget Cuentas por Cobrar**: Actualizado para usar datos del endpoint real en vez de calcular desde las últimas 10 transacciones (que era impreciso). Ahora muestra monto en USD, equivalente en Bs y conteo exacto de facturas activas.
  - **Actualización en Tiempo Real**: Los créditos se actualizan automáticamente cuando se registra un pago o nueva venta vía WebSocket (`sale:created`).
- **Archivos Afectados**:
  - `backend_api/routers/reports.py`: Endpoint `/reports/credits/summary`.
  - `frontend_web/src/services/unifiedReportService.js`: Método `getCreditsSummary()`.
  - `frontend_web/src/pages/Dashboard.jsx`: KPI card + widget actualizado.

### 2. Fix: Dashboard Mostraba Ingresos Inflados por Créditos
**Descripción**: El KPI "Ingresos Hoy" sumaba ventas a crédito no cobradas, inflando los números reales.
- **Cambios Técnicos**:
  - **Separación de Ingresos**: `total_revenue` ahora solo incluye dinero efectivamente cobrado. Los créditos pendientes se reportan por separado en `pending_credit` y `pending_credit_bs`.
  - **Ganancia Real**: `realized_profit` ya excluía créditos, pero `total_revenue` no lo hacía — corregido.
- **Archivos Afectados**:
  - `backend_api/routers/reports.py`: Lógica de `get_sales_summary()`.

### 3. Fix: Servicios Aparecían en Alertas de Stock Bajo
**Descripción**: Productos marcados como servicio (`is_service=True`) con stock=0 generaban alertas de inventario falsos.
- **Cambios Técnicos**:
  - Filtros adicionales en `/reports/low-stock`: `is_service == False` y `is_active == True`.
- **Archivos Afectados**:
  - `backend_api/routers/reports.py`: Endpoint `get_low_stock_products()`.

## [2026-02-20] - Refactor de Seguridad y Módulo de Servicios

### 1. Hardware Bridge: Seguridad y Multi-tenancy
**Descripción**: Migración de la arquitectura de comunicación de hardware para soportar un entorno SaaS escalable y seguro.
- **Cambios Técnicos**:
  - Transición de una lógica de conexión monolítica a un esquema **Multi-Tenant** dinámico.
  - Implementación de autenticación robusta: el WebSocket ahora requiere `tenant_id` y un **Hardware Token** válido en la URL.
  - Creación de un flujo de **Emparejamiento (Pairing)** mediante códigos de 6 dígitos para autorizar nuevas estaciones de trabajo.
  - Reescritura completa del cliente local en **C# (.NET)**, permitiendo ejecución silenciosa en segundo plano y una integración directa con el **Spooler de Windows** para mayor estabilidad en la impresión.
- **Modelos de Datos Afectados (PostgreSQL)**:
  - `PairingCode` (NUEVO): Gestiona los códigos temporales de vinculación.
  - `HardwareToken` (NUEVO): Almacena los tokens de acceso persistentes vinculados a cada `client_id` y `tenant_id`.

### 2. Módulo de Servicios Técnicos: Finanzas e Integridad
**Descripción**: Refuerzo de la seguridad de datos y nueva lógica contable para abonos en órdenes de reparación.
- **Cambios Técnicos**:
  - **Identidad**: Inyección forzada del filtro `.filter(ServiceOrder.tenant_id == current_tenant)` en todas las consultas para eliminar brechas de visibilidad entre empresas.
  - **Lógica Contable**: Implementación de un sistema de **Abonos/Anticipos**. Ahora la lógica de Checkout (`service_checkout_service.py`) calcula el total de la orden, resta la suma de abonos previos y solo cobra el **Saldo Pendiente** en el POS.
  - **Móvil & UX**: 
    - Optimización del modal de importación (`ServiceImportModal`) para diseño responsivo.
    - Implementación visual de captura de **Patrón de Desbloqueo** para mejorar la recepción de dispositivos móviles.
- **Modelos de Datos Afectados (PostgreSQL)**:
  - `ServicePayment` (NUEVO): Modelo para el registro detallado de cada abono realizado a una orden.
  - `ServiceOrder` (MODIFICADO): Actualización de esquemas para relacionar pagos anticipados y estados financieros.

## [2026-02-21] - Soporte Multiformato de Impresión

### 1. Hardware Bridge: Configuración de Ancho de Papel
**Descripción**: Implementación de soporte para impresoras térmicas de 80mm (48 caracteres) manteniendo compatibilidad con 58mm (32 caracteres).
- **Cambios Técnicos**:
  - **Configuración Dinámica**: Se agregó la propiedad `PaperWidth` al modelo de configuración local.
  - **Interfaz de Usuario**: Inclusión de un selector de ancho de papel en el panel de `Configuración Manual` de la aplicación C#.
  - **Adaptación de Formato**: La lógica de renderizado en `PrinterService.cs` y las plantillas en el backend ahora ajustan dinámicamente el ancho de los separadores y el contenido según el papel (58mm vs 80mm).
  - **Distribución**: Generación de un nuevo binario `ConexionImpresora.exe` distribuido automáticamente a la carpeta de descargas del Frontend.
  - `bridge_config.json`: Nueva clave `"PaperWidth"` persistente.

### 2. Estabilización de Sesiones (Fix "Kick-out")
**Descripción**: Corrección del cierre de sesión inesperado mediante la extensión de vida de los tokens de acceso.
- **Cambios Técnicos**:
  - **Vida del Token**: Se aumentó `ACCESS_TOKEN_EXPIRE_MINUTES` de 30 a **1440 minutos** (24 horas).
  - **Sincronización de Cookies**: El campo `max_age` de las cookies HttpOnly ahora refleja la nueva duración de la sesión.
  - **UX**: Eliminación de redirecciones intrusivas al login durante transacciones largas.

### 3. POS: Optimización Visual y Legibilidad
**Descripción**: Rediseño de la interfaz de venta para mejorar la presentación de productos y evitar recortes de texto.
- **Cambios Técnicos**:
  - **Componente de Imagen**: Se flexibilizó `ProductImage.jsx` para permitir ajustes de aspecto dinámicos sin sobrescribir estilos de contenedor.
  - **Tarjeta de Producto**: 
    - Aumento de altura mínima de `220px` a **`360px`** en `ProductCard.jsx`.
    - Área de imagen expandida a `h-40` con escala interactiva en hover.
    - Soporte para nombres de artículos de hasta **3 líneas** (`line-clamp-3`).
    - Compactación de la sección de precios para maximizar el espacio de descripción.

## [2026-02-26] - Módulo Restaurante (Takeout) y Estabilidad SaaS

### 1. Restaurante: Soporte para Modo "Para Llevar" (Takeout)
**Descripción**: Implementación integral de órdenes sin mesa y optimización del flujo de cocina.
- **Cambios Técnicos**:
  - **Backend**: Creación del endpoint `/open_takeout` y adaptación de `/checkout` para manejar órdenes sin `table_id`.
  - **KDS**: Implementación de etiquetas visuales distintivas en la Pantalla de Cocina para identificar servicios de Takeout.
  - **Flujo POS**: Integración de captura opcional del nombre del cliente para órdenes externas.
- **Modelos de Datos Afectados (PostgreSQL)**:
  - `RestaurantOrder` (MODIFICADO): Columnas `is_takeout` (Boolean) y `customer_name` (String) añadidas; `table_id` ahora es **Nullable**.
  - Migración auditada de timestamps (`created_at`, `updated_at`).

### 2. Infraestructura: Propagación de Esquemas y HashRouter
**Descripción**: Automatización de la integridad de datos en el VPS y corrección de navegación.
- **Cambios Técnicos**:
  - **Migración Inteligente**: Actualización de `migrate_tenants.py` para propagar automáticamente cambios de esquema a todos los esquemas PostgreSQL de inquilinos durante el inicio (Startup Event).
  - **Navigation Fix**: Ajuste de rutas en correos de recuperación de contraseña y redirecciones de descubrimiento para compatibilidad con `HashRouter` (Inyección de `#` en URLs).
- **Archivos Afectados**:
  - `migrate_tenants.py`: Lógica de alteración de tablas distribuida.
  - `auth.py`, `email_utils.py`: Corrección de generadores de URL.

## [2026-02-24] - Módulo de Barbería / Salón de Belleza

### 1. Barbería: Infraestructura Multi-Tenant (Fases 1-2)
**Descripción**: Implementación completa del módulo de barbería con gestión de empleados, comisiones y dashboard.
- **Cambios Técnicos**:
  - **Modelos DB**: Tablas `employees` y `commissions` integradas en esquema multitenant.
  - **Endpoints API**: CRUD completo en `/api/v1/employees` y comisiones en `/api/v1/employees/commissions`.
  - **SaaS Panel**: Flag `has_barbershop_module` con toggle de activación por empresa (ícono de Tijeras).
  - **Frontend**: Dashboard unificado en `/barbershop`, selector de íconos Lucide-React, sidebar inteligente.
  - **Migración Automática**: Script `migrate_barbershop.py` para propagar columnas del módulo a todos los tenants.
- **Archivos Afectados**:
  - `backend_api/routers/employees.py`, `backend_api/models/models.py`, `backend_api/migrate_barbershop.py`.
  - `frontend_web/src/pages/Barbershop/`, `frontend_web/src/components/layout/Sidebar.jsx`.

## [2026-02-26] - Segmentación por Rubros y Estabilidad SaaS

### 1. Sistema de Segmentación Inteligente de Rubros
**Descripción**: Automatización de la configuración de módulos basada en el tipo de negocio seleccionado al registrarse.
- **Cambios Técnicos**:
  - **Detección por Palabras Clave**: `TenantService.create_tenant()` analiza el rubro seleccionado y activa automáticamente los módulos correspondientes.
  - **Modelo Tenant Expandido**: Nuevas columnas `business_type`, `has_restaurant_module`, `has_laundry_module`, `has_hardware_module`, `has_services_module`, `has_barbershop_module`.
  - **Panel SaaS**: Vista enriquecida con filtros por rubro y togglees de módulos por empresa.
- **Archivos Afectados**:
  - `backend_api/services/tenant_service.py`, `backend_api/models/tenant.py`.
  - `saas_admin/src/pages/TenantDetail.jsx`.

### 2. Correcciones de Estabilidad
- **Discovery Fix**: Corrección del endpoint `/auth/discovery` para manejar casos edge de usuarios sin tenant.
- **Session Fix**: Estabilización de cookies HttpOnly y tokens en entornos de producción con HTTPS.
- **DB Repair**: Función `repair_public_schema()` para recuperación automática de `alembic_version` y columnas faltantes.

## [2026-02-27] - Rediseño Completo del Módulo Restaurante (Fases 1-5)

### 1. Restaurante: Arquitectura Completa (5 Fases)
**Descripción**: Rediseño integral del módulo de restaurante, desde la base de datos hasta el frontend.
- **Fase 1: Modelos y Endpoints Base**
  - Modelos: `RestaurantTable`, `RestaurantOrder`, `RestaurantOrderItem`.
  - Endpoints CRUD para mesas y órdenes.
  - Frontend: Mapa interactivo de mesas con auto-refresh.

- **Fase 2: Takeout (Para Llevar)**
  - Columnas `is_takeout` y `customer_name` en `RestaurantOrder`.
  - Endpoint `/open_takeout` para órdenes sin mesa.
  - KDS con diferenciación visual de Takeout.

- **Fase 3: Menú Digital**
  - Modelos: `RestaurantMenuSection`, `RestaurantMenuItem`.
  - Endpoints CRUD para gestión de menú con secciones, alias y precios override.

- **Fase 4: Checkout y Vinculación con Ventas**
  - Integración de cierre de cuenta con `SalesService.create_sale()`.
  - Soporte multimoneda y métodos de pago mixtos.
  - Vinculación `sale_id` en `RestaurantOrder`.

- **Fase 5: Escandallo (Recetas) y Deducción de Inventario**
  - Modelo: `RestaurantRecipe` (plato → ingredientes con cantidades).
  - Lógica centralizada en `SalesService.create_sale()`: si existe receta, se deducen ingredientes; si no, se deduce el producto directamente.
  - Eliminación de lógica redundante de deducción en `orders.py`.

- **Archivos Afectados**:
  - `backend_api/models/restaurant.py`, `backend_api/schemas/restaurant.py`.
  - `backend_api/routers/modules/restaurant/tables.py`, `orders.py`, `menu.py`.
  - `backend_api/services/sales_service.py`.
  - `frontend_web/src/pages/Restaurant/TableMap.jsx`, `KitchenDisplay.jsx`.

### 2. Eliminación de SQLite y Estabilización PostgreSQL
**Descripción**: Limpieza total de código SQLite y simplificación del cambio de esquema.
- **Cambios Técnicos**:
  - **`db.py`**: Eliminadas todas las variables `IS_SQLITE`, `IS_POSTGRES`, event listener `on_connect` (ATTACH DATABASE), y checks condicionales de dialecto. El pool y `get_db()` son ahora 100% PostgreSQL.
  - **`tenant_service.py`**: Eliminados todos los `if "sqlite" not in ...` guards. `CREATE SCHEMA`, `SET search_path` y seeding ahora se ejecutan directamente sin verificación de dialecto.
  - **Diagnóstico Mejorado**: `RuntimeError` en `get_db()` ahora incluye el mensaje exacto de la excepción de PostgreSQL para facilitar debugging.
- **Archivos Afectados**:
  - `backend_api/database/db.py`, `backend_api/services/tenant_service.py`.


---

## [2026-03-31] Sistema de Comisiones Global v2

### Problema
El sistema anterior tenía comisiones básicas que solo usaban el `%` del usuario logueado sin considerar quién fue el vendedor real por ítem, no comisionaban ítems de plantilla en el taller, no había diferenciación entre rol Vendedor y Técnico, y no existía panel de configuración.

### Solución implementada

#### BD (migración `a1b2c3d4e5f6_commission_system_v2.py`)
- `public.users`: columnas `commission_vendor_pct` y `commission_technician_pct` (separadas por rol)
- `{schema}.commission_logs`: columnas `commission_role` (VENDOR|TECHNICIAN), `voided_at`, `sale_id`
- `{schema}.commission_settings`: tabla nueva — master ON/OFF + módulos + strict_mode
- `{schema}.commission_rules`: tabla nueva — reglas de % por categoría de producto

#### Backend
- `commission_engine.py`: motor centralizado con jerarquía (regla categoría > % usuario > sin comisión)
- `routers/commission_config.py`: CRUD de reglas, settings y tasas por usuario (8 endpoints)
- `feature_flags_registry.py`: flag `sistema_comisiones` en categoría `ventas`
- `services/sales_service.py`: usa `salesperson_id` del ítem (no usuario logueado)
- `services/service_checkout_service.py`: comisiona TODOS los ítems (no solo manuales) + comisión al vendedor de la orden

#### Frontend
- `ComisionesTab.jsx`: panel completo en Configuración con:
  - Toggle master ON/OFF con estado visual
  - Toggles por módulo (POS / Taller)
  - CRUD de reglas por categoría (modal, tabla)
  - Edición inline de tasas por usuario (vendor_pct + technician_pct)
- `ConfigCenter.jsx`: tab "Comisiones" agregado (protegido por feature flag)
- `CommissionsTab.jsx` (Reportes): columna "Rol" (🛒 Vendedor / 🔧 Técnico) + módulo (POS/Taller)

### Jerarquía de cálculo
```
1. feature_flag 'sistema_comisiones' activo?  → No = sin comisión
2. commission_settings.global_enabled?         → No = sin comisión
3. Módulo activo (pos_module_enabled/taller)?  → No = sin comisión
4. Regla por CATEGORÍA del producto?           → Sí = usa ese %
5. % del usuario (vendor_pct o tech_pct)?      → Sí = usa ese %
6. Nada aplica                                  → sin comisión
```

### Modo estricto (strict_mode=True por defecto)
Productos sin categoría → NO generan comisión. El admin debe asignar categoría + crear regla para que aplique.

### Activar desde SaaS Admin
Panel Admin → Tenant → Features Premium → "Sistema de Comisiones Global" → ON

### Tests
- 6/6 tests de importación y BD pasaron
- BD verificada: 16 schemas migrados, commission_settings con defaults correctos

### Commits
- `700a7a6` feat(comisiones): engine + migración + feature flag
- `30da646` feat(comisiones): implementación completa UI + fixes POS/taller

---

## [2026-03-31] Taller — Sesión de Fixes Post-Deploy (parte 2)

### Bugs corregidos

#### Fix: Botón "Cobrar" faltante en ServiceOrderDetail
- **Problema raíz:** Las comisiones solo se generan al hacer checkout (`POST /services/orders/{id}/checkout`). El nuevo dashboard no tenía botón de cobro — los usuarios cambiaban el estado a DELIVERED sin crear la venta. Auto-checkout solo aplica si abonos cubren el 100%.
- **Fix:** Botón verde "Cobrar" aparece cuando `status=READY`. Abre modal con total/pagado/pendiente, campo de monto y método de pago. Al confirmar → checkout → venta creada → comisiones generadas.
- **Flujo correcto:** Crear orden → ítems → READY → **[Cobrar]** → comisiones ✅

#### Fix: QuickItemForm — técnicos hardcodeados
- Nombres Juan García / Carlos López eliminados
- Ahora carga `GET /users/` con usuarios activos del tenant
- Técnico disponible en ambos tabs (inventario y manual)
- Búsqueda productos: `?q=` → `?search=` + límite 10 → 50

#### Fix: Wizard — sin selector de técnico
- Paso 3 ahora incluye dropdown "Técnico asignado" con usuarios reales
- Campo opcional — puede asignarse también por ítem al agregar
- Aparece en resumen del paso 4

#### Fix: Plantillas 403 para CASHIER
- Botón "Plantillas" ahora solo visible para ADMIN
- ServiceTemplatesManager usa fallback: `/all` (admin) o `/service-templates` (cashier)

#### Fix: Stepper de estados rediseñado
- **Problema técnico:** colores dinámicos `bg-${color}-600` no compilan en Tailwind JIT
- **Nuevo diseño:** pills compactas tipo badge con colores estáticos
  - Estado actual: pill sólida + ring luminoso + punto blanco
  - Estados completados: color suave
  - Estados futuros: gris discreto

#### Fix: Comisiones — taller_vendor_commission_enabled
- `GET /settings` devolvía ORM sin serializar correctamente el campo → `undefined` en frontend
- `PATCH /settings` no manejaba el campo → toggle no guardaba
- Fix: serialización explícita con `bool()` en GET y PATCH

#### Fix: Comisiones — user-rates filtraba todos los tenants
- Faltaba `models.User.tenant_id == current_user.tenant_id` en query

#### Fix: commission_config — patrón flush→query→commit
- Todos los endpoints reescritos con el patrón correcto del proyecto:
  `flush()` → queries → capturar datos → `commit()` al final
- Elimina `UndefinedTable` que ocurría al re-querying post-commit

### Usuarios de prueba creados en QA (solucionescodecraft)
| Usuario | Rol | % Vendedor | % Técnico | Contraseña |
|---|---|---|---|---|
| yamachu | CASHIER | 10% | 0% | (existente) |
| tecnico1 | CASHIER | 0% | 15% | tecnico123 |
| admin | ADMIN | 0% | 0% | (existente) |

---

## [2026-04-01] Deploy a Producción — prod-taller-comisiones-20260401

### Contenido del deploy
Todo el trabajo de la sesión del 31 de Marzo / 1 de Abril 2026:
- Módulo Taller rediseñado (FASES 1-3 + fixes post-deploy)
- Sistema de Comisiones Global v2
- ConfigCenter con sidebar lateral
- Campo "Aplica Comisión" oculto en ProductForm
- Guía interactiva de comisiones integrada en la app

### Proceso ejecutado
1. ✅ Docker login con Access Token desde MCP
2. ✅ Migración BD: 37 schemas en invensoft_prod
   - `public.users`: +commission_vendor_pct, +commission_technician_pct
   - Cada schema: +commission_settings (tabla), +commission_rules (tabla)
   - Cada schema commission_logs: +commission_role, +voided_at, +sale_id
3. ✅ Build de 4 imágenes Docker (backend, app, landing, admin-panel)
4. ✅ Push a DockerHub tag: `prod-taller-comisiones-20260401`
5. ✅ TAG actualizado en /root/deploy/prod/.env
6. ✅ Operador ejecutó `docker compose up -d --force-recreate` desde SSH
7. ✅ Smoke tests: 4 containers up, API health 200, imports OK
8. ✅ 23 commits pusheados a GitHub

### Aprendizaje crítico del deploy
- El MCP corre en contenedor propio — credenciales Docker del SSH del host NO son visibles
- La red interna de prod se llama `prod_prod_internal` (prefijo docker-compose)
- `docker compose` no está disponible como plugin en el VPS desde el MCP — el paso de restart lo ejecuta el operador desde SSH
- Ver documento `30_Proceso_Deploy_Produccion.md` para el procedimiento completo

### Tenants en prod al momento del deploy
37 tenants activos, incluyendo OscarCell (3 locales), La Lavandería, Moto Repuestos, etc.

---

## 2026-04-01 — Integración WhatsApp Business (Baileys Propio)

**Rama:** `feature/customer-360-whatsapp`  
**Estado:** ✅ Completo en QA — pendiente merge a prod

### Lo implementado

**Infraestructura:**
- Servicio WhatsApp propio con Baileys (`/root/deploy/whatsapp-service/`) — imagen `mi-inventario-whatsapp:1.1`
- Sin Evolution API, sin n8n — Baileys directo reduce latencia y elimina dependencias externas

**Backend:**
- `routers/whatsapp.py` — 7 endpoints (config, QR, status, connect, disconnect, test, plantillas)
- `routers/quotes.py` — endpoint `/quotes/{id}/send-whatsapp` genera PDF con ReportLab y lo envía
- `services/sales_service.py` — ticket de venta automático al cliente (Bs real, vuelto, plantilla)
- `routers/services.py` — notificación taller listo con plantilla configurable
- SQL con schema explícito en todas las queries de business_config (fix bug search_path SQLAlchemy)

**Frontend:**
- `Config/tabs/WhatsAppTab.jsx` — 3 estados (desconectado/QR/conectado), polling automático, barra progreso QR
- Editor de 3 plantillas con variables dinámicas, guardado automático
- `Quotes/QuoteList.jsx` — botón WhatsApp (PDF) en cada cotización, botón "Nueva" siempre visible

**Notificaciones automáticas:**
- Venta completada → ticket con moneda real (Bs/USD/mixto), vuelto, sin tasa de cambio
- Equipo listo en taller → mensaje con equipo, número de orden, total pendiente
- Cotización → PDF profesional (ReportLab) enviado como documento

**Fixes críticos en esta sesión:**
- Venta con cliente fallaba: query ORM sin search_path → SQL explícito + try/except aislado
- Botón "Nueva Cotización" solo aparecía sin cotizaciones → movido al header siempre visible
- `NameError webhook_service` en taller → eliminado, reemplazado con httpx directo
- `NameError sale_payments_snapshot` en ventas → variables definidas en scope correcto
- SQL `WHERE key=''nombre''` → comillas Python mal escapadas → corregido con `IN (...)`
- `None != "true"` para toggles → cambio a `!= "false"`

### Archivos nuevos
```
ferreteria_refactor/backend_api/routers/whatsapp.py
/root/deploy/whatsapp-service/server.js
/root/deploy/whatsapp-service/Dockerfile
/root/deploy/whatsapp-service/package.json
src/pages/Config/tabs/WhatsAppTab.jsx
_CEREBRO_PROYECTO/32_WhatsApp_Baileys.md
```
