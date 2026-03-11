# 07 - Frontend y UX (Mi Inventario Fácil)

Detalles de la arquitectura visual y experiencia de usuario de la plataforma.

## 1. Arquitectura de Estado
**Mi Inventario Fácil** utiliza una arquitectura de estado centralizada para garantizar la consistencia en el POS:
*   **AuthContext**: Persistencia de sesión y detección de subdominio.
*   **CashContext**: Control global del estado de la caja de la tienda.
*   **CartContext**: Lógica de carrito optimizada para lecturas rápidas de códigos de barras. Incluye `holdCart()` / `resumeHeldCart()` para ventas pausadas (F6).
*   **NotificationContext**: Gestiona dos arrays separados:
    - `notifications` → banners de alerta (esquina superior derecha, `GlobalBanner`)
    - `announcements` → modales de novedad centrados (`AnnouncementModal`, se muestran una sola vez por usuario)
    - Sincronizado con WebSocket en tiempo real. Separa los mensajes entrantes según `message_type`.
*   **WebSocketContext**: Suscripción a eventos del servidor. Clave: el payload del evento `system:notification` DEBE incluir `message_type` o el frontend lo trata como banner.

## 2. Adaptabilidad de Interfaz
*   **Ferretería / Repuestos**: Vistas de tablas densas con mucha información técnica.
*   **Servicio Técnico / Lavandería**: Formularios optimizados para captura rápida de datos de recepción.
*   **Mobile Ready**: Layouts responsivos que permiten a un vendedor consultar stock desde el pasillo usando su teléfono.

## 3. Patrones de UX

*   **Fast POS**: Minimiza la cantidad de clics para completar una venta.
*   **Real-time Notifications**: Alertas visuales vía WebSockets cuando llega un pago móvil o se desconecta una impresora.
*   **Offline Mode Indicator**: Notifica al usuario si su conexión es lenta o inexistente antes de intentar procesar una venta.
*   **Hold Sale (Venta Pausada)**: Hotkey F6 para congelar el carrito y atender otro cliente. Un banner ámbar recuerda la venta pausada.
*   **Toast Deduplication**: Notificaciones con ID fijo (`{ id: 'imei-scan' }`) para evitar apilamiento durante escaneo rápido de IMEIs.

## 4. Sistema de Comunicaciones al Usuario

### GlobalBanner (`components/common/GlobalBanner.jsx`)
- Mensajes tipo `banner` recibidos del SaaS Admin
- Aparece en esquina superior derecha, con prioridad: LIVE > CRITICAL
- Se descarta por usuario con `localStorage: dismissed_popup_<id>`
- Niveles: INFO (azul), WARNING (ámbar), CRITICAL (rojo)

### AnnouncementModal (`components/common/AnnouncementModal.jsx`)
- Mensajes tipo `announcement` recibidos del SaaS Admin
- Modal centrado con gradiente indigo/violeta y backdrop blur
- Aparece 600ms después de cargar el dashboard
- Se muestra **una sola vez** por usuario → `localStorage: announced_<id>`
- Parsea el contenido en lista de features si sigue el formato:
  ```
  emoji Título | descripción breve
  ```
  Si no sigue el formato, muestra el texto como párrafo normal.
- Header: ícono ✨ + título + badge de versión (`version_tag`)
- CTA: "¡Entendido, a trabajar!" — cierra y marca como visto

### Cómo crear un anuncio (desde SaaS Admin → Mensajes del Sistema)
1. Clic "Nuevo Mensaje" → seleccionar **"Modal de Novedad"** (panel violeta)
2. Escribir título y contenido con formato `emoji Título | descripción` (una función por línea)
3. Opcionalmente añadir etiqueta de versión (ej. `v2.5`)
4. Publicar → se envía en tiempo real a todos los usuarios conectados

## 5. Diseño de Catálogo (UI/UX)
Para maximizar la conversión en el POS, se han implementado patrones visuales avanzados:
*   **Full-Frame Imagery**: El uso de `object-cover` en contenedores de `360px` asegura que el producto sea el protagonista visual.
*   **Legibilidad Adaptativa**: El sistema de `line-clamp-3` permite hasta 3 líneas de descripción, asegurando que nombres técnicos complejos nunca queden truncados.
*   **Feedback Táctil**: Las tarjetas responden visualmente al hover y al tacto, mejorando la experiencia en tablets y móviles.

## 6. Formulario de Productos (ProductForm)

*   **Productos con IMEI** (`has_imei=True`): La sección de inventario estándar (cantidad, mínimo de stock) se oculta porque el stock se gestiona por unidades individuales serializadas. En su lugar aparece la card **"Alerta de Stock Mínimo"** con campos `min_stock` y `location`.
*   **Configuración de Monedas**: Panel lateral con tasas actuales + botón "Consultar BCV" que obtiene las tasas oficiales del Banco Central de Venezuela en tiempo real.
*   **Botón Recepción**: En la página `/products`, visible solo si `modules?.services` está activo. Lleva a `/inventory/serialized-reception`.

## 7. Lazy Loading y ErrorBoundary (Auditoría 2026-03-10)

*   **React.lazy()**: 58 páginas cargadas con `React.lazy()`. Solo `Login` y `Dashboard` se cargan de forma eager (bundle inicial ~60% menor).
*   **LazyErrorBoundary**: Class component que atrapa errores de chunk load en rutas lazy. Si un chunk falla al cargar (ej. deploy nuevo mientras el usuario tiene la app abierta), muestra un mensaje amigable con opción de recargar.
*   **Notificaciones migradas**: 37 llamadas `alert()` reemplazadas por `toast()` de `react-hot-toast` en 16 archivos.
*   **console.log eliminados**: 17 llamadas de debug removidas. Además, `vite.config.js` tiene `esbuild: { drop: ['console', 'debugger'] }` para eliminar automáticamente en build de producción.
*   **CartContext optimizado**: El objeto `value` del Provider está envuelto en `useMemo` para evitar re-renders innecesarios en cascada.
*   **Paginación server-side**: Products y Customers usan `skip/limit` (max 500) en vez de cargar todos los registros.

## 8. Tecnologías Core
*   **React + Vite**: Para una carga casi instantánea.
*   **Tailwind CSS**: Estilizado moderno y mantenible.
*   **React Context API**: Gestión de estados sin la complejidad de Redux.
*   **react-hot-toast**: Sistema de notificaciones con soporte de ID fijo para deduplicación.
*   **Lucide React**: Librería de íconos consistente en todo el sistema.
