# Plan estricto de pruebas QA - flujos criticos

Fecha: 2026-06-30
Ambiente: QA
Objetivo: validar que las reglas criticas vivan en backend y que POS, caja, seriales, financiamiento, devoluciones, compras, traslados y reportes no dependan de confianza del frontend.

## Criterio general

- Cada prueba debe ejecutarse con un usuario admin y al menos un usuario cajero sin permisos especiales.
- Toda operacion de dinero debe quedar asociada a una caja/sesion valida.
- Todo cambio de inventario debe reflejarse en stock, IMEI/serial si aplica, kardex y reporte.
- Toda accion rechazada debe dejar el stock y el dinero sin cambios.
- Las pruebas destructivas se hacen solo en tenants QA.

## 1. POS - productos normales

1. Abrir caja QA con saldo inicial 0 USD y 0 Bs.
2. Vender un producto normal con stock suficiente.
3. Confirmar que descuenta exactamente la cantidad vendida.
4. Confirmar kardex con movimiento en espanol y saldo sin decimales innecesarios.
5. Confirmar reporte de ventas y caja.
6. Intentar agregar el mismo producto sin stock.

Resultado esperado: el producto agotado no entra al carrito y el backend rechaza cualquier intento manipulado.

## 2. POS - seriales / IMEI

1. Registrar IMEI en almacen A.
2. Vender escaneando el IMEI desde una caja abierta del mismo almacen.
3. Confirmar que el color/variante aparece si el serial lo tiene.
4. Intentar vender el mismo IMEI nuevamente.
5. Intentar vender un IMEI que pertenece a otro almacen.

Resultado esperado: solo se vende una vez, el serial queda SOLD/UNAVAILABLE, y el almacen incorrecto se rechaza con mensaje claro.

## 3. POS - listas de precio y monedas

1. Crear lista flexible y lista estricta USD.
2. Crear lista estricta Bs.
3. Agregar productos al carrito y cambiar una linea a lista estricta Bs.
4. Confirmar que todo el carrito migra a esa lista/regla si corresponde.
5. Confirmar que solo aparecen metodos de pago compatibles con la moneda.
6. Intentar pagar una venta Bs con metodo USD manipulando el payload.

Resultado esperado: backend rechaza moneda/metodo incompatible.

## 4. POS - permisos de precio y descuento

1. Con cajero sin permiso, manipular precio base desde payload.
2. Con cajero sin permiso, aplicar descuento manual.
3. Con usuario autorizado, repetir con permiso valido.

Resultado esperado: cajero sin permiso recibe 403 y no se registra la venta; usuario autorizado puede operar segun regla.

## 5. Caja y sesiones

1. Crear tres cajas QA: C01, C02, C03.
2. Abrir tres sesiones con tres usuarios distintos.
3. Hacer ventas simultaneas por cada caja.
4. Intentar que un cajero facture usando la session_id de otro cajero.
5. Cerrar caja con cierre ciego.
6. Descargar auditoria PDF.

Resultado esperado: cada caja respeta su sesion; el reporte visual y el PDF muestran la misma diferencia por moneda.

## 6. Caja maestra / dinero compartido

1. Configurar una caja maestra receptora.
2. Hacer ventas en dos terminales que depositan en la caja maestra.
3. Cerrar terminales y luego caja maestra.
4. Verificar origen por terminal en reporte.

Resultado esperado: el dinero puede centralizarse sin perder trazabilidad por caja origen.

## 7. Financiamiento externo

1. Vender equipo financiado con inicial 0.
2. Vender equipo financiado con inicial USD.
3. Vender equipo financiado con inicial Bs.
4. Confirmar que lo financiado no entra como efectivo esperado en caja.
5. Confirmar que solo entra a caja lo realmente cobrado.
6. Confirmar reporte de financiadoras.

Resultado esperado: arqueo no infla ventas financiadas; caja refleja solo dinero recibido.

## 8. Creditos / CxC

1. Crear venta a credito.
2. Registrar abono con metodo compatible.
3. Intentar abono Bs con metodo USD y viceversa.
4. Intentar registrar abono con cajero sin caja abierta.

Resultado esperado: solo abonos validos impactan caja, credito y contabilidad.

## 9. Devoluciones y canjes

1. Devolver producto normal desde admin con caja abierta propia o permiso fuerte.
2. Intentar devolver desde admin sin caja propia pero con cajas de otros usuarios.
3. Hacer canje por producto de igual valor.
4. Hacer canje por producto mayor valor y cobrar diferencia.
5. Hacer canje por menor valor y reembolsar diferencia.
6. Repetir con producto serializado.

Resultado esperado: stock, caja, credito aplicado y ledger contable cuadran. Si no hay caja valida, el mensaje debe indicar que caja usar.

## 10. Compras y recepcion

1. Crear compra con producto normal.
2. Crear compra con producto serializado usando modal de IMEI.
3. Registrar color/capacidad por lote de IMEI.
4. Intentar duplicar IMEI en la misma compra.
5. Intentar duplicar IMEI existente en otro producto.
6. Confirmar kardex y stock.

Resultado esperado: no hay doble suma de stock serializado; los IMEI quedan vinculados al producto y almacen correcto.

## 11. Traslados

1. Traslado interno de producto normal entre almacenes.
2. Traslado interno de IMEI especifico.
3. Exportacion externa con varios modelos y varias unidades.
4. Importacion externa del archivo en otro tenant QA.
5. Descargar guia de despacho.
6. Ver historial de salida externa y entrada externa.

Resultado esperado: conteos por unidad y por modelo son claros; la guia y el historial coinciden con stock/kardex.

## 12. Configuracion y permisos

1. Con cajero, intentar probar impresion desde configuracion.
2. Con admin, probar impresion.
3. Con cajero, intentar cambiar tasa, listas de precio y metodos de pago.
4. Con admin autorizado, hacer cambios.

Resultado esperado: cajero recibe 403; admin autorizado conserva flujo normal.

## 13. Reportes y contabilidad

1. Hacer una venta normal, una financiada, una devolucion, un abono CxC, una entrada manual y una salida manual.
2. Verificar resumen, ventas, caja, contabilidad y auditoria PDF.
3. Confirmar que el libro contable tiene entradas por cada evento monetario.

Resultado esperado: reportes se alimentan de movimientos reales, no de totales visuales del frontend.

## 14. Aislamiento de tenants

1. Crear producto unico en tenant A.
2. Buscar el producto en tenant B y C.
3. Crear venta en tenant A y revisar reportes de B y C.
4. Intentar usar token de tenant A contra tenant B.

Resultado esperado: no hay mezcla de productos, ventas, caja ni seriales entre tenants.

## 15. Rendimiento minimo aceptable

1. POS carga inicial con 900+ productos: menor a 3 segundos en red normal.
2. Busqueda POS: menor a 500 ms despues del debounce.
3. Reporte ventas mensual: menor a 5 segundos.
4. Kardex filtrado por producto: menor a 3 segundos.
5. Productos inventario: menor a 3 segundos.

Resultado esperado: si supera el limite, se revisa indice SQL/cache/API antes de tocar solo la vista.

## Evidencia requerida

- Captura o log de cada rechazo esperado.
- ID de ventas de prueba.
- ID de sesiones de caja.
- Comparacion stock antes/despues.
- Comparacion reporte visual vs PDF.
- Commit aplicado en QA.
