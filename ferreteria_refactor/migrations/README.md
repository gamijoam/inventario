# Migrations — Aplicar a Producción

Carpeta con las migraciones de datos que se aplican **directamente a los schemas de tenants** (no usan alembic, que en este proyecto solo maneja `public`).

## Índice

| # | Archivo | Fecha | Propósito | Schema destino | ¿Aplica a prod? |
|---|---|---|---|---|---|
| 1 | `2026_06_02_add_default_price_list_margin.sql` | 2026-06-02 | Inserta el setting `default_price_list_margin=45` en `business_config` para que Configuración Masiva → "Margen a aplicar" arranque con un valor editable. Reemplaza el `useState(45)` hardcodeado en `ProductForm.jsx` y `PreciosMasivosTab.jsx`. | Cada tenant (ej. `restaurante3`, y en prod los tenants que apliquen) | Pendiente — creado y aplicado en QA, **falta aplicar a prod** |
| 2 | `2026_06_02_clean_imei_limbo_sold_to_rma.sql` | 2026-06-02 | Mueve a `RMA` (cuarentena) los `product_instances` que quedaron en `SOLD` por el bug de devoluciones DAMAGED en POS (no pasaban a RMA ni AVAILABLE). Idempotente. **Caveat:** solo limpia devoluciones dañadas que cubrían TODA la venta del product; las parciales se omiten (Fix 4 las resolverá). | Cada tenant (mismas consideraciones que #1) | Pendiente — creado y aplicado en QA, **falta aplicar a prod** |
| 3 | `2026_06_02_add_return_serial_tracking.sql` | 2026-06-02 | **Fix 4**: crea la tabla junction `return_detail_instances` (qué IMEIs específicos se devolvieron en cada línea) + agrega `status`/`returned_at`/`returned_in_return_id` a `sale_detail_instances` (link venta↔instancia ahora distingue activo vs devuelto, en vez de eliminarlo). Requiere cambios coordinados en backend (`ReturnItemCreate.serial_numbers`, `process_return`) y frontend (selector de IMEIs). **Sin esto, las devoluciones siguen sin tracking por serial.** | Cada tenant | Pendiente — creado y aplicado en QA, **falta aplicar a prod** |

## Cómo aplicar

Cada script es **idempotente** (usa `ON CONFLICT DO NOTHING` o checks). Se aplica por schema de tenant.

Desde el backend container (o con `psql` directo si está disponible):

```bash
# Ejemplo para un tenant en prod
docker exec -u root backend_prod_server sh -c "PGPASSWORD=\$DB_PASSWORD psql -h \$DB_HOST -U \$DB_USER -d \$DB_NAME -c \"SET search_path TO NOMBRE_TENANT, public\" -f /app/ferreteria_refactor/migrations/2026_06_02_add_default_price_list_margin.sql"
```

O, si psql no está disponible en el container (como en QA), usar el runner Python:
```bash
docker cp migrations/2026_06_02_add_default_price_list_margin.sql backend_prod_server:/tmp/
docker cp apply_migration.py backend_prod_server:/tmp/
docker exec backend_prod_server python3 /tmp/apply_migration.py
# (apply_migration.py debe apuntar al schema del tenant deseado)
```

## Pendientes (fixes de devoluciones)

Las migraciones de los fixes del sistema de devoluciones (IMEI en limbo → RMA, columna de seriales en `return_details`, etc.) se irán agregando aquí a medida que se apliquen, en formato `.sql` con nombre `YYYY_MM_DD_descripcion_corta.sql`.
