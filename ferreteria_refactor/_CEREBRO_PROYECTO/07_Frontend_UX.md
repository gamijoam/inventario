# 07 - Frontend y UX (Mi Inventario Fácil)

Detalles de la arquitectura visual y experiencia de usuario de la plataforma.

## 1. Arquitectura de Estado
**Mi Inventario Fácil** utiliza una arquitectura de estado centralizada para garantizar la consistencia en el POS:
*   **AuthContext**: Persistencia de sesión y detección de subdominio.
*   **CashContext**: Control global del estado de la caja de la tienda.
*   **CartContext**: Lógica de carrito optimizada para lecturas rápidas de códigos de barras.

## 2. Adaptabilidad de Interfaz
*   **Ferretería / Repuestos**: Vistas de tablas densas con mucha información técnica.
*   **Servicio Técnico / Lavandería**: Formularios optimizados para captura rápida de datos de recepción.
*   **Mobile Ready**: Layouts responsivos que permiten a un vendedor consultar stock desde el pasillo usando su teléfono.

## 3. Patrones de UX
*   **Fast POS**: Minimiza la cantidad de clics para completar una venta.
*   **Real-time Notifications**: Alertas visuales vía WebSockets cuando llega un pago móvil o se desconecta una impresora.
*   **Offline Mode Indicator**: Notifica al usuario si su conexión es lenta o inexistente antes de intentar procesar una venta.

## 4. Tecnologías Core
*   **React + Vite**: Para una carga casi instantánea.
*   **Tailwind CSS**: Estilizado moderno y mantenible.
*   **React Context API**: Gestión de estados sin la complejidad de Redux.
