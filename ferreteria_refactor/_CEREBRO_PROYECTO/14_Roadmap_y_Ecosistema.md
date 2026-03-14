# 14 - Roadmap y Ecosistema Mi Inventario Fácil

Este documento ofrece una visión panorámica de la plataforma **Mi Inventario Fácil**, detallando los componentes actuales, los que están en desarrollo y la visión de crecimiento del ecosistema.

## 1. El Ecosistema de Mi Inventario Fácil

La plataforma no es solo un POS, sino un conjunto de herramientas interconectadas que facilitan la vida del comerciante:

1.  **Dashboard Web (Actual)**: El centro de comando donde se gestionan productos, ventas, reportes y configuraciones de seguridad.
2.  **Hardware Bridge (Actual)**: El "músculo" local que conecta la nube con la realidad física (impresión, básculas, cajones).
3.  **App Móvil (PWA/Capacitor)**: Permite a los dueños consultar sus ventas en tiempo real desde cualquier lugar o a los vendedores verificar stock en el pasillo.
4.  **Landing Page (Marketing)**: La vitrina de ventas del SaaS para captar nuevos clientes.
5.  **Panel Admin SaaS (Management)**: Herramienta interna para gestionar facturación de los tenants, suspender cuentas y monitorear la salud del servidor.

## 2. Módulos Operativos (✅ Completados)

### Módulo Ferretería / Retail
✅ **Completado** - Core del sistema. POS, inventario, créditos, multi-almacén, Kardex, listas de precios.

### Módulo Servicio Técnico
✅ **Completado** - Recepción de dispositivos, abonos, checkout con saldo pendiente, garantías RMA.

### Módulo Lavandería
✅ **Completado** - Órdenes de servicio, estados de entrega, metadata flexible.

### Módulo Restaurante
✅ **Completado (5 Fases)** - Mapa de mesas, takeout, KDS, menú digital, escandallo/recetas, deducción automática de inventario. Documentación detallada en `16_Modulo_Restaurante.md`.

### Módulo Barbería / Salón de Belleza
✅ **Completado (Fases 1-2)** - Gestión de empleados, comisiones, dashboard unificado. Documentación en `15_Modulo_Barberia.md`.

### Sistema de Segmentación por Rubros
✅ **Completado** - Detección automática de módulos según tipo de negocio al registrarse.

## 3. Roadmap: Módulos en Desarrollo (Beta/Pending)

### ✅ Sistema Multicaja — COMPLETADO (2026-03-03)
*   Múltiples cajas físicas (`CashRegister`) configurables por tenant.
*   Apertura de turno con selector de caja libre; restricción DB con índice único parcial.
*   Trazabilidad cajero/caja en: Historial de Caja, Historial de Ventas, CxC, Cotizaciones, Reporte Z.
*   Página de administración en `/cash-registers` (solo ADMIN).
*   Seed automático de "Caja Principal (C01)" al crear nuevo tenant.
*   Migración automática al startup vía `migrate_multicaja.py`.

### Barbería: Fase 3 (Operación Financiera)
*   **Integración POS**: Modal de selección de barbero al vender un servicio de barbería.
*   **Proceso de Liquidación**: Botón "Pagar" que cambie estado de comisión a `PAID` y genere egreso en caja.
*   **Configuración por Producto**: Flag de comisión específico por servicio (override del base del empleado).

### Módulo de RRHH y Comisiones (Avanzado)
*   **Pago a Vendedores**: Cálculo automático de comisiones basadas en margen o precio de venta.
*   **Asistencia**: Registro de entrada y salida de empleados por PIN.

### IA de Business Intelligence (Próximamente)
*   **Predicción de Stock**: El sistema alertará no solo cuando haya poco stock, sino cuándo es el momento óptimo de comprar basado en la velocidad de venta histórica.

## 4. Nuevos Componentes del Ecosistema (2026-03)

### ✅ Bot de Telegram con IA — COMPLETADO (2026-03-13)
Chatbot para clientes finales que permite buscar el catálogo de la tienda por lenguaje natural vía Telegram.
- Integra Google Gemini 2.5 Flash para comprensión de español venezolano
- Búsqueda multi-producto: "tienen iPhone y Samsung?" → 2 búsquedas paralelas
- Envío de fotos + precio + stock por producto
- Identificación de tenant por `X-Tenant-ID` (mismo backend central `api.miinventariofacil.com`)
- Rama: `feature/telegram-bot` | Documentación completa: `21_Bot_Telegram.md`

**Roadmap Bot — Fases Propuestas:**

| Fase | Feature | Estado |
|---|---|---|
| 1 | Búsqueda de catálogo con Gemini | ✅ Completado |
| 2 | Carrito + Apartado de productos | 🔜 Propuesto |
| 3 | Pedidos completos + notificación al vendedor | 🔜 Propuesto |
| 4 | Integración de pagos | 💡 Idea futura |

### ✅ Centros Unificados — COMPLETADO (2026-03-13)
- **InventoryCenter** (6 tabs) — reemplaza 8+ páginas de inventario
- **SalesCenter** (5 tabs) — ventas, clientes, créditos, garantías
- **ConfigCenter** (9 tabs) — configuración completa del sistema (solo ADMIN)

## 5. Integraciones Futuras

*   **E-commerce (Shopify/WooCommerce)**: Sincronización automática de inventario entre la tienda física y la tienda online.
*   **Bancos Locales**: Integración directa para verificar Pagos Móviles de forma automatizada mediante API bancaria.
*   **n8n como orquestador**: Complementa el bot Python para notificaciones, alertas de stock y flujos con pasarelas de pago. No reemplaza la lógica conversacional.

## 6. Filosofía del Proyecto

**Mi Inventario Fácil** nace con la misión de democratizar la gestión empresarial. Buscamos que un pequeño taller de teléfonos o una lavandería de barrio tenga las mismas herramientas de control que una gran cadena de ferreterías, con una interfaz que cualquiera pueda aprender a usar en menos de 10 minutos.
