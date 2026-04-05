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
