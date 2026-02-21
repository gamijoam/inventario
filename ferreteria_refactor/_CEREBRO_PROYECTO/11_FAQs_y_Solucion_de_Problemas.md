# 10 - FAQs y Solución de Problemas (Troubleshooting)

Guía de resolución de conflictos comunes en el uso y administración de **Mi Inventario Fácil**.

## 1. Problemas de Hardware y Bridge

### "La impresora no imprime nada"
1.  **Verificar WebSocket**: Abre la consola del navegador (F12) y busca errores de conexión `wss://`. Si la impresora tiene el icono en rojo, el Bridge no está conectado.
2.  **Cable/Puerto**: Asegúrate de que el Bridge esté configurado en el puerto COM correcto (ej. COM3).
3.  **Papel/Ready**: El Bridge no enviará trabajos si detecta que la impresora no está en estado `READY`.

### "El cajón de dinero no abre"
*   **Comando de Pulso**: Verifica que el comando `'2,100,200'` (estándar Epson) sea el configurado.
*   **Conector RJ11**: Asegúrate de que el cable del cajón esté firmemente conectado a la impresora de tickets, no a la PC directamente.

## 2. Errores de Autenticación y Acceso

### "Mi correo no se encuentra en el Discovery"
*   El usuario debe estar registrado previamente en la tabla `public.users`. Si fue borrado o no tiene un `tenant_id` asignado, el Discovery fallará por seguridad.

### "Sesión cerrada repentinamente"
*   **Expiración de JWT**: Por seguridad, el token dura 24 horas.
*   **Conflicto de Subdominio**: Si intentas entrar a `tiendaA.miinventariofacil.com` con una sesión activa de `tiendaB`, el middleware te expulsará de vuelta al login.

## 3. Inventario y Sincronización

### "El stock no disminuyó al vender"
*   **Servicios Intangibles**: Verifica si el producto tiene el flag `is_service=True`. Estos productos no afectan stock.
*   **Diferencia de Almacén**: Confirma que estás consultando el stock del mismo `warehouse_id` donde se realizó la venta.

### "Venta duplicada en el historial"
*   Esto ocurre si una petición falló por red lenta y el navegador reintentó. El sistema usa `unique_uuid` para mitigar esto, pero si el frontend falló al generar el UUID, podrían existir colisiones.

## 4. Problemas de Red y SaaS

### Error 504 Gateway Timeout (Traefik)
*   **Causa**: El proceso de migración de esquemas (`migrate_tenants.py`) tardó demasiado al arrancar el contenedor.
*   **Solución**: Reiniciar el contenedor de API y verificar la carga del servidor Postgres.

### Error 403 Forbidden
*   Tu `UserRole` no tiene permisos para esa acción. Por ejemplo, un `WAITER` intentando cerrar la caja o un `KITCHEN` intentando editar precios de productos.
