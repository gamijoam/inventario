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

### Error 404 al abrir enlaces directos (HashRouter)
*   **Causa**: El frontend utiliza `HashRouter`, por lo que todas las rutas deben pasar por el punto de entrada principal seguido de `#`. Si un enlace (ej. recuperación de clave) no incluye el `#`, el servidor web intentará buscar un archivo físico y fallará.
*   **Solución**: Asegurarse de que las URLs sigan el formato `https://mi-dominio.com/#/ruta`. El backend ha sido actualizado para generar estos enlaces automáticamente.

## 5. Problemas del Módulo Restaurante

### "El stock no se deduce al cerrar una cuenta del restaurante"
*   **Escandallo (Receta)**: Verifica que el plato tenga una receta definida en `restaurant_recipes`. Si no hay receta, el sistema intentará deducir el producto directamente (que puede ser un "plato" no almacenable).
*   **Lógica Centralizada**: La deducción ocurre SOLO en `SalesService.create_sale()`, NO en `orders.py`. Si se modificó el router de órdenes, la deducción podría haberse roto.

### "Error: Could not switch to tenant schema"
*   **Causa**: PostgreSQL no puede ejecutar `SET search_path TO "nombre_esquema"`. Puede ser que el esquema no exista, la conexión esté corrupta, o haya un problema de permisos.
*   **Diagnóstico**: A partir de la última actualización, el mensaje de error incluye el detalle exacto de PostgreSQL (ej: `schema "xxx" does not exist` o `permission denied`).
*   **Solución**: Verificar que el esquema del tenant exista con: `SELECT schema_name FROM information_schema.schemata;`

### "La pantalla de cocina (KDS) no muestra nuevas órdenes"
*   **Auto-Refresh**: El KDS se actualiza automáticamente cada pocos segundos. Si no muestra datos, verificar conectividad de red.
*   **Status Filter**: El KDS solo muestra órdenes con ítems en estados activos (`PENDING`, `SENT`, `PREPARING`, `READY`). Si todos los ítems están en `SERVED` o `CANCELLED`, la orden no aparecerá.

## 6. Problemas de Base de Datos

### "Error: alembic_version table not found"
*   **Reparación Automática**: La función `repair_public_schema()` en `main.py` la recrea automáticamente durante el startup. Si persiste, verificar permisos del usuario de PostgreSQL.

### "Error: Column xxx does not exist in tenants"
*   **Reparación Automática**: `repair_public_schema()` agrega automáticamente columnas faltantes (`business_type`, `has_restaurant_module`, etc.) a `public.tenants` durante el startup.

### "FAILED: Can't locate revision identified by 'XXXXXXX'" (Alembic)
*   **Causa**: La tabla `alembic_version` referencia una revisión que fue eliminada del código fuente. Alembic no puede resolver la cadena de migraciones.
*   **Solución**: Forzar el stamp directamente en la BD — ver procedimiento completo en `05_Guia_Despliegue.md`, sección 7.B.
*   **Prevención**: NUNCA eliminar archivos de migración que ya hayan sido aplicados en algún entorno.

## 7. Problemas de Deploy y DevOps (Auditoría 2026-03-10)

### CORS falla con sub-subdominios (`tenant.qa.domain.com`)
*   **Causa**: La regex de CORS original solo matcheaba 1 nivel de subdominio. QA usa 2 niveles (`tenant.qa.miinventariofacil.com`).
*   **Solución**: Regex actualizada para soportar multi-nivel. Verificar con: `re.match(pattern, "tenant.qa.miinventariofacil.com")`.

### slowapi: "TypeError: missing argument 'request'"
*   **Causa**: `slowapi` requiere que el parametro de tipo `Request` se llame EXACTAMENTE `request`. Si se nombra `http_request` o cualquier otro nombre, el rate limiter no puede extraer la IP del cliente.
*   **Solución**: Renombrar el parametro a `request: Request` en la firma del endpoint.

### Contenedores muestran hora UTC en vez de hora local
*   **Causa**: Los contenedores Docker usan UTC por defecto.
*   **Solución**: Agregar `TZ=America/Caracas` como variable de entorno en backend y DB en docker-compose.

