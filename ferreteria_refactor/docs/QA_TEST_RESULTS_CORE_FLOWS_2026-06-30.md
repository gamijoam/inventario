# Resultados de pruebas QA - flujos criticos

Fecha: 2026-06-30
Tenant: restaurante3
Ambiente: QA

## Resumen ejecutivo

Se ejecutaron pruebas reales por API contra el backend QA usando usuarios reales del tenant:

- Admin: restaurante3@gmail.com
- Cajero: restaurante3.2@gmail.com

Resultado total de corridas finales:

- Flujo POS / IMEI / permisos / caja: 19 aprobadas, 0 fallidas.
- Flujo dinero / devoluciones / credito / abonos: 11 aprobadas, 0 fallidas.
- Humo rendimiento reportes/productos/kardex: 6 aprobadas, 0 fallidas.

Total final: 36 aprobadas, 0 fallidas.

## Corrida POS / IMEI / permisos / caja

Run: 20260630160319
Caja temporal: register_id 37
Sesion: session_id 71
Productos temporales: 1127, 1128
Ventas: 516, 520
IMEI: 9926063016031901

Pruebas aprobadas:

- Login admin y cajero.
- Configuracion / probar impresion sin sesion bloquea con 401.
- Configuracion / probar impresion con cajero bloquea con 403.
- Creacion de caja temporal.
- Apertura de caja temporal por cajero.
- Creacion de producto normal y producto serializado.
- Recepcion de IMEI con color.
- Validacion de IMEI en almacen correcto.
- Validacion de IMEI en almacen incorrecto devuelve valid:false y mensaje claro.
- Venta normal descuenta stock: 5.000 a 3.000.
- Precio manipulado rechazado con 403.
- Metodo USD con moneda VES rechazado con 400.
- Lista PRECIO DETAL strict VES rechaza pago USD con 400.
- Venta sin stock rechazada con 400.
- Venta serial marca IMEI como SOLD.
- Reventa del mismo IMEI rechazada con 400.
- Cajero distinto no puede usar caja/sesion de otro usuario: 403.
- Cierre de caja cuadra: esperado 40.0000, declarado 40.0000, diferencia 0.0000.
- Kardex registra movimientos.

## Corrida dinero / devoluciones / credito / abonos

Run: 20260630161430
Caja temporal: register_id 38
Sesion: session_id 72
Productos temporales: 1129, 1130
Ventas: 522, 523
Devolucion: 10
Cliente temporal: 20
Pago credito: 552

Pruebas aprobadas:

- Apertura de caja temporal.
- Venta para devolucion descuenta stock: 2.000 a 1.000.
- Devolucion completa restaura stock: 1.000 a 2.000.
- Devolucion registra salida de caja RETURN por 15.0000.
- Venta a credito crea saldo pendiente de 30.0000.
- Abono con moneda/metodo incompatible rechazado: Efectivo USD no acepta VES.
- Abono correcto USD registra pago y deja saldo 25.0000.
- Actualizacion directa de venta bloqueada con 410.
- Cierre de caja cuadra tras venta, devolucion y abono: esperado 5.0000, declarado 5.0000, diferencia 0.0000.

## Humo de rendimiento

Mediciones contra endpoints reales en QA:

| Endpoint | Resultado | Tiempo |
| --- | ---: | ---: |
| Productos inventario 50 | 200 | 0.369s |
| Catalogo POS 80 | 200 | 0.108s |
| Ventas recientes 50 | 200 | 0.079s |
| Reporte ventas detallado mes | 200 | 0.160s |
| Kardex 100 | 200 | 0.427s |
| Kardex busqueda flexible | 200 | 0.191s |

## Observaciones

- El validador de IMEI para almacen incorrecto responde HTTP 200 con `valid:false`. Esto es correcto para UX porque permite mostrar mensaje sin tratarlo como error de servidor.
- Los productos, clientes y cajas temporales quedaron desactivados al final de las pruebas para no ensuciar la interfaz QA.
- Las ventas, pagos, devolucion y sesiones quedan como evidencia auditable.
- No se generaron migraciones nuevas durante esta fase.

## Estado

Modulo probado y apto para continuar con pruebas guiadas desde UI o push cuando se indique.
