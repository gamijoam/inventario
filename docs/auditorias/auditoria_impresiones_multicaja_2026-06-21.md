# Auditoria de impresiones multicaja - 2026-06-21

## Contexto

Tenant observado en produccion: `oscarcelltucacas`.

Sintoma reportado: con dos cajas abiertas (`caja-1` y `caja-2`), a veces una caja imprime y la otra no; al cambiar de usuario cajero/admin en la misma PC puede quedar una ruta vieja. El usuario ve errores tipo conexion/internet aunque el sistema web cargue normalmente y el bridge exista.

## Evidencia en produccion (solo lectura)

- `oscarcelltucacas.cash_registers` tiene dos cajas activas:
  - `C01 / Caja Principal` -> `hardware_client_id = caja-1`
  - `CAJA2 / caja2` -> `hardware_client_id = caja-2`
- Hay dos sesiones abiertas:
  - sesion `17`, caja `C01`, usuario `caja1tucacas@gmail.com`
  - sesion `19`, caja `CAJA2`, usuario `caja2tucacas@gmail.com`
- Las ventas recientes si estan quedando enlazadas a su sesion/caja correcta.
- Logs prod muestran conexiones y desconexiones frecuentes de bridges `caja-1` y `caja-2`.
- Logs prod tambien muestran casos donde el navegador manda `client_id = caja-1` aunque el tenant tiene otro bridge conectado. Eso explica errores intermitentes y mensajes confusos.

## Hallazgos tecnicos

1. El ticket termico dependia principalmente de `localStorage.hardware_client_id` en el navegador.
2. En una sola caja esto funciona, pero en multicaja es fragil: si una PC queda con `caja-1` guardada y luego entra otro usuario o admin, puede intentar imprimir por la caja equivocada.
3. El backend ya tenia datos suficientes para resolver mejor la ruta: venta -> sesion de caja -> caja -> `hardware_client_id`.
4. `sessions/current` para cajeros no recuperaba automaticamente la caja real del usuario cuando el navegador enviaba un `register_id` viejo.
5. Los mensajes de error decian indirectamente conexion/internet, pero el problema real podia ser bridge desconectado, ID equivocado o ruta vieja en el navegador.

## Correccion aplicada en QA

- `POST /products/print/remote` ahora soporta rutas explicitas:
  - `prefer_sale_register=true`: imprime por la caja que creo la venta.
  - `register_id`: imprime por la caja seleccionada en esta estacion.
  - `client_id`: compatibilidad con flujo anterior.
- El backend resuelve y valida el bridge real conectado por tenant antes de imprimir.
- El error ahora indica el bridge esperado y los bridges conectados.
- La venta recien completada imprime usando la caja de la venta, no una ruta vieja del navegador.
- La reimpresion desde la pantalla de tickets conserva el flujo de estacion actual.
- El reporte Z puede enviarse con `register_id` de la caja cerrada.
- `sessions/current` ahora recupera la sesion abierta real del cajero si el navegador traia un `register_id` viejo.
- `CashContext` evita reutilizar una caja abierta por otro usuario cuando no es admin.

## Pruebas QA

- Backend: `python3 -m py_compile` sobre rutas modificadas: OK.
- Frontend: `npm run build` dentro de `frontend_qa_server`: OK.
- Login API en `restaurante3`: OK.
- Diagnostico `/cash/registers/print-status`: OK.
- Prueba controlada de `/products/print/remote` sin bridge conectado: responde `503` con mensaje claro: impresora esperada y bridges conectados.

## Recomendacion de infraestructura

La estructura correcta para multicaja debe ser:

1. Cada caja fisica tiene `hardware_client_id` unico.
2. Cada sesion de caja queda ligada a una caja fisica.
3. Cada venta queda ligada a la sesion.
4. La impresion automatica postventa usa la caja de la venta.
5. La reimpresion puede usar la estacion actual, pero validada por `register_id`.
6. El frontend nunca debe ser la unica fuente de verdad para elegir impresora.
7. El bridge puede mantenerse como esta por ahora; si se actualiza el `.exe`, la mejora ideal seria que devuelva ACK de impresion real, version, impresora Windows seleccionada y ultimo error.

## Pendiente recomendado

- Agregar una pantalla de salud de impresoras por caja con: conectado, ultimo ping, ultimo ticket, ultimo error.
- Agregar historial `print_jobs` persistente para auditar cada intento de impresion.
- Mejorar el bridge para ACK real de trabajo impreso, no solo mensaje WebSocket recibido.


## Fase 2 aplicada en QA: print_jobs

Archivo SQL guardado para prod:

- `ferreteria_refactor/migrations/2026_06_21_add_print_jobs.sql`

Se agrego una tabla tenant-scope `print_jobs` para auditar intentos de impresion termica y payloads crudos:

- `job_type`: `ticket` o `raw_payload`.
- `status`: `PENDING`, `SENT`, `FAILED`.
- `sale_id`, `register_id`, `user_id`.
- `requested_client_id`, `resolved_client_id`, `route`.
- `request_payload`, `response_payload`, `error_message`.
- timestamps de creacion, envio y fallo.

Tambien se agrego el endpoint de soporte:

- `GET /api/v1/products/print/jobs`

Pruebas QA:

- Migracion aplicada en QA: OK.
- `POST /products/print/remote` sin bridge conectado registra `FAILED` con `sale_id`, `register_id`, caja y `resolved_client_id`.
- `POST /products/print/remote/payload` sin bridge conectado registra `FAILED` con caja y bridge esperado.
- Backend compile: OK.
