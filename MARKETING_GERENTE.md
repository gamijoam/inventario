# Mi Inventario Fácil — Documento de Producto para Marketing
> **Para:** Gerente de Marketing
> **Preparado por:** Equipo de Desarrollo
> **Fecha:** Marzo 2026
> **Confidencialidad:** Uso interno / Publicable en su totalidad salvo secciones marcadas

---

## 1. ¿Qué es Mi Inventario Fácil?

**Mi Inventario Fácil** (también conocido como **Invensoft**) es un sistema de gestión empresarial en la nube (*SaaS*) diseñado específicamente para el comerciante venezolano. Permite a cualquier negocio controlar su inventario, registrar ventas, gestionar clientes, emitir reportes y cobrar a crédito — todo desde el navegador, sin instalar nada.

### Propuesta de valor en una línea
> *"El sistema que le da a la bodega de la esquina el mismo control que tiene una cadena de supermercados, al precio de una suscripción mensual."*

---

## 2. ¿A quién va dirigido?

El sistema se adapta automáticamente al tipo de negocio del cliente. Los rubros actualmente soportados son:

| Tipo de Negocio | ¿Qué activa automáticamente? |
|---|---|
| **Ferretería / Retail / Repuestos** | POS completo, inventario multi-almacén, créditos, listas de precio |
| **Servicio Técnico** | Órdenes de reparación, diagnóstico de equipos, garantías, abonos |
| **Lavandería / Tintorería** | Órdenes de servicio, estados de entrega, prendas por cliente |
| **Restaurante / Café / Panadería** | Mapa de mesas, comandas de cocina, menú digital, recetas |
| **Barbería / Salón / Spa** | Control de empleados, comisiones automáticas por servicio |

Un negocio que se registra como "Taller Electrónica Don Pedro" recibe automáticamente las herramientas de servicio técnico activadas — sin configuración manual.

---

## 3. Características del Producto

### 3.1 Punto de Venta (POS)
- Venta rápida con búsqueda de productos por nombre o código SKU
- Soporte de **múltiples métodos de pago** en una sola transacción (efectivo + transferencia + débito)
- **Pago en Bolívares y Dólares** con conversión automática usando la tasa BCV del día
- **IGTF 3%** calculado automáticamente en pagos en divisas (cumplimiento fiscal Venezuela)
- Descuentos por ítem o por total de venta
- Cálculo de vuelto automático
- Impresión de recibo en impresoras térmicas (58mm / 80mm)
- Modalidad **ventas a crédito** con deuda registrada por cliente

### 3.2 Control de Inventario
- Stock en tiempo real, actualizado con cada venta y cada compra
- Soporte de **múltiples almacenes** (Mostrador, Depósito, Sucursal) con stock independiente por bodega
- **Traslados entre bodegas** con registro de origen y destino
- **Kardex completo**: historial de cada movimiento de inventario (entradas, salidas, devoluciones, traslados)
- Ajustes de inventario: entradas manuales, mermas, productos dañados, uso interno
- Categorías jerárquicas de productos (padre → hijo)
- **Código SKU** opcional por producto
- Productos por caja/unidad (conversión automática)
- **Listas de precio múltiples**: Detal, Mayor, Especial, etc. — con control de acceso por PIN
- **Cotizaciones**: genera presupuestos que el cliente puede aprobar o rechazar; al aprobar se convierte en venta automáticamente

### 3.3 Gestión de Clientes y Crédito
- Registro completo de clientes con cédula, teléfono, dirección y límite de crédito
- Control de **deuda en tiempo real**: cuánto debe cada cliente y cuándo vence
- Alertas automáticas de clientes con facturas vencidas
- **Bloqueo de crédito**: el sistema impide nuevas ventas a crédito si el cliente excedió su límite o tiene facturas vencidas
- Abonos parciales con historial completo de pagos
- **Devoluciones**: gestión de productos devueltos, con reintegro de stock y ajuste de deuda

### 3.4 Gestión de Compras y Proveedores
- Registro de órdenes de compra con seguimiento de pago (pendiente / parcial / pagado)
- Control de **deuda con proveedores** (cuentas por pagar)
- Actualización automática de costo del producto al recibir mercancía
- Cálculo de margen de ganancia protegido

### 3.5 Caja y Finanzas
- Sistema **multicaja**: cada terminal tiene su propia caja registradora
- Apertura y cierre de turno con cuadre automático
- Historial de cada sesión con: ventas en efectivo, tarjeta, créditos cobrados, egresos
- Movimientos de caja: ingresos y egresos manuales con descripción
- **Reporte Z**: resumen de cierre de caja imprimible
- Múltiples tasas de cambio configurables (BCV, paralelo, dólar oficial)

### 3.6 Módulo Restaurante
- **Mapa de mesas interactivo**: visual en tiempo real con auto-actualización cada 10 segundos
- **Modo Para Llevar** (*Takeout*): órdenes sin mesa con nombre del cliente
- **Pantalla de Cocina (KDS)**: los meseros mandan pedidos, la cocina los ve y marca estado por ítem
- **Menú digital**: secciones organizadas, descripciones, precios por lista
- **Recetas (escandallo)**: define los ingredientes de cada plato; al vender, el sistema descuenta los ingredientes del almacén automáticamente

### 3.7 Módulo Servicio Técnico
- Recepción de equipos con ficha técnica: marca, modelo, IMEI/serial, estado visual, problema reportado, código de acceso
- **Ticket de recepción impreso** automáticamente al crear la orden
- Ciclo completo de estados: Recibido → Diagnóstico → Aprobado → En reparación → Listo → Entregado
- Abonos anticipados del cliente, descontados al momento de cobrar
- Garantías configurables por producto (días, meses, años, de por vida)
- El recibo de venta incluye el IMEI y la vigencia de garantía del equipo

### 3.8 Módulo Barbería / Salón
- Registro de empleados (barberos, estilistas) con porcentaje de comisión base
- Cálculo automático de comisión por cada servicio vendido
- Panel unificado: POS + gestión de personal en una sola pantalla
- Liquidación de comisiones con egreso automático de caja

### 3.9 Bot de Telegram con Inteligencia Artificial ✨
- Los clientes de la tienda pueden **buscar productos por Telegram**, escribiendo en lenguaje natural
- El bot entiende español venezolano coloquial ("tienen iPhone chino?", "¿cuánto está la tuerca 3/8?")
- Responde con foto del producto, precio y disponibilidad en stock
- Búsquedas múltiples en paralelo: "tienen martillo y taladro?" → busca ambos al mismo tiempo
- Motor de IA: **Google Gemini 2.5 Flash**
- Cada tienda tiene su propio bot conectado a su catálogo

### 3.10 Usuarios y Seguridad
- **3 roles de acceso**: Administrador, Cajero, Almacenista
- El Cajero solo ve lo que necesita para vender; el Almacenista solo gestiona inventario; el Admin tiene acceso total
- Autenticación con PIN numérico + contraseña
- Sesiones con tiempo de expiración automático
- Historial de auditoría de cambios (quién hizo qué y cuándo)

---

## 4. ¿Cómo funciona? (Flujo simple para el cliente)

```
1. El negocio se registra en miinventariofacil.com
2. Recibe su empresa en su propio subdominio: minegocio.miinventariofacil.com
3. Carga su catálogo de productos (o lo importa)
4. Sus cajeros abren caja y empiezan a vender desde el mismo día
5. El dueño ve reportes en tiempo real desde cualquier celular o PC
```

No requiere instalación. Funciona desde cualquier navegador moderno.

---

## 5. El Ecosistema Completo

```
┌─────────────────────────────────────────────────────────────┐
│                  MI INVENTARIO FÁCIL                        │
├──────────────────────┬──────────────────────────────────────┤
│  📱 App Web (POS)    │  Panel de administración en la nube  │
│  Funciona en PC,     │  Reportes, configuración, usuarios   │
│  tablet y celular    │                                      │
├──────────────────────┼──────────────────────────────────────┤
│  🤖 Bot Telegram     │  🖨️ Bridge de Hardware (Windows)     │
│  Catálogo vía IA     │  Conecta impresoras térmicas y       │
│  para clientes       │  cajones de efectivo físicos         │
├──────────────────────┼──────────────────────────────────────┤
│  🔧 Panel Admin SaaS │  📊 Reportes financieros             │
│  Gestión de todas    │  Dashboard, flujo de caja,           │
│  las empresas        │  ventas por periodo, utilidades      │
└──────────────────────┴──────────────────────────────────────┘
```

---

## 6. Modelo de Suscripción

| Plan | Descripción |
|---|---|
| **Trial** | Días gratuitos configurables (por defecto 15 días) para probar el sistema completo |
| **Mensual** | Pago mensual recurrente, acceso completo |
| **Anual** | Pago anual con descuento |
| **Lifetime** | Pago único, acceso de por vida |

> La empresa es bloqueada automáticamente si la suscripción vence o no se renueva. El dueño recibe el mensaje: *"Esta empresa está suspendida. Contacta a soporte para renovar tu suscripción."*

---

## 7. Diferenciadores Clave vs. la Competencia

| Característica | Mi Inventario Fácil | Competencia típica |
|---|---|---|
| Adaptación automática por rubro | ✅ El sistema detecta el tipo de negocio | ❌ Un solo módulo genérico |
| Multi-moneda con tasa BCV | ✅ USD, Bs, tasa del día automática | ❌ Solo Bolívares o solo USD |
| IGTF Venezuela integrado | ✅ Automático en cobros en divisas | ❌ Manual o no lo tiene |
| Bot de Telegram con IA | ✅ Catálogo conversacional para clientes | ❌ No existe |
| Módulo restaurante + KDS | ✅ Pantalla de cocina en tiempo real | ❌ Separado o no existe |
| Impresión térmica integrada | ✅ Bridge nativo para impresoras ESC/POS | ⚠️ Requiere software aparte |
| Multi-almacén con Kardex | ✅ Trazabilidad completa por bodega | ⚠️ Básico o de pago extra |
| Sin instalación | ✅ 100% web, cualquier navegador | ⚠️ Muchos requieren instalar |
| Precio accesible para PyME | ✅ SaaS mensual desde Venezuela | ❌ Sistemas costosos o en USD alto |

---

## 8. Estado Actual del Producto

| Módulo | Estado |
|---|---|
| POS y ventas | ✅ Operativo y en producción |
| Inventario multi-almacén | ✅ Operativo |
| Créditos y cuentas por cobrar | ✅ Operativo |
| Compras y proveedores | ✅ Operativo |
| Caja multicaja y cierres | ✅ Operativo |
| Módulo Restaurante | ✅ Operativo |
| Módulo Servicio Técnico | ✅ Operativo |
| Módulo Lavandería | ✅ Operativo |
| Módulo Barbería / Salón | ✅ Operativo |
| Bot de Telegram con IA | ✅ Operativo |
| Garantías y devoluciones | ✅ Operativo |
| Cotizaciones | ✅ Operativo |
| Listas de precio múltiples | ✅ Operativo |
| Suite de tests automatizados (~305 tests) | ✅ Implementado — garantiza estabilidad |
| App móvil nativa | 🔜 Roadmap 2026 |
| Predicción de stock con IA | 🔜 Roadmap 2026 |

---

## 9. Mensajes Clave para Comunicaciones

### Para redes sociales / posts cortos
- *"¿Sigues usando un cuaderno para controlar tu inventario? Ya existe algo mejor."*
- *"Vende en bolívares y dólares al mismo tiempo. El sistema calcula la tasa BCV por ti."*
- *"Tu cliente te escribe por Telegram preguntando por un producto — y el bot le responde con foto, precio y stock. Sin que tú hagas nada."*
- *"De la ferretería al restaurante, del taller técnico al salón de belleza. Un solo sistema para todos."*
- *"Empieza gratis. Sin instalar nada. Desde el navegador de tu celular."*

### Para el sitio web / landing page
- **Hero:** *"Controla tu negocio desde cualquier lugar. Vende, cobra, gestiona — todo en un solo lugar."*
- **Subtítulo:** *"Sistema SaaS para ferreterías, talleres, restaurantes, barberías y más. Multi-moneda, multi-almacén, con bot de Telegram incluido."*
- **CTA principal:** *"Empieza tu prueba gratis"*

### Para publicidad pagada (Google Ads / Meta Ads)
- Audiencia: Dueños de negocios PyME Venezuela, 28-55 años
- Pain point: *"¿Tu vendedor no sabe si hay stock sin ir al depósito?"*
- Solución: *"Ve el stock en tiempo real desde tu celular. Invensoft."*

---

## 10. Lo que NO se debe publicar (Confidencial)

> Las siguientes secciones son para uso interno exclusivamente y **no deben aparecer en materiales de marketing públicos**:

- Credenciales de acceso al servidor VPS o panel de administración
- Detalles técnicos del stack (FastAPI, PostgreSQL, Docker)
- Datos de clientes actuales (tenants en producción)
- Precios exactos de suscripción (hasta que se definan oficialmente)
- Información sobre deuda técnica o bugs conocidos

---

## 11. Contacto del Equipo Técnico

Para preguntas sobre capacidades específicas del sistema, integraciones posibles o demos técnicas, coordinar con el equipo de desarrollo antes de hacer compromisos públicos sobre features en roadmap.

---

*Documento generado en Marzo 2026 — Versión 1.0*
*Actualizar cada vez que se lancen módulos nuevos o cambie el modelo de precios.*
