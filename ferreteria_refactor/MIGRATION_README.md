# Migración de Base de Datos Legacy "lico"

## Pasos para Ejecutar la Migración

### 1. Preparación

**Instalar dependencias:**
```bash
pip install psycopg2-binary
```

**Verificar que ambas bases de datos estén corriendo:**
- BD Antigua: `lico` (PostgreSQL local)
- BD Nueva: `pruebita2_db` (PostgreSQL local)

### 2. Configurar Credenciales

Edita el archivo `migrate_from_lico.py` y ajusta:

```python
# Base de datos ORIGEN (lico - antigua)
SOURCE_DB = {
    'host': 'localhost',
    'port': 5432,
    'database': 'lico',
    'user': 'postgres',
    'password': 'TU_PASSWORD_AQUI'  # ⚠️ CAMBIAR
}

# Base de datos DESTINO (nueva)
TARGET_DB = {
    'host': 'localhost',
    'port': 5432,
    'database': 'pruebita2_db',
    'user': 'postgres',
    'password': 'TU_PASSWORD_AQUI'  # ⚠️ CAMBIAR
}
```

### 3. Ajustar Query de Productos (IMPORTANTE)

**Revisa la estructura de tu tabla `products` en la BD antigua** y ajusta la query en la función `get_products_from_lico()`:

```python
query = """
    SELECT 
        id,
        name,
        description,
        barcode,
        sku,
        price,
        cost,
        stock,        -- ⚠️ Verifica que esta columna exista
        category_id,
        is_active,
        created_at
    FROM products
    WHERE is_active = true
    ORDER BY id
"""
```

**Si tu BD antigua tiene nombres de columnas diferentes**, ajusta la query. Por ejemplo:
- Si la columna de stock se llama `quantity` en lugar de `stock`, cámbiala
- Si no tienes `barcode`, usa `NULL as barcode`

### 4. Ejecutar Migración

```bash
python migrate_from_lico.py
```

**El script te pedirá confirmación:**
```
⚠️  ADVERTENCIA: Este script modificará la base de datos destino.
   Origen: lico
   Destino: pruebita2_db

¿Deseas continuar? (escribe 'SI' para confirmar):
```

Escribe `SI` y presiona Enter.

### 5. Verificar Resultados

El script mostrará:
```
📊 RESUMEN DE MIGRACIÓN
============================================================
✅ Productos migrados exitosamente: 150
❌ Errores: 0
📦 Total procesado: 150
```

## Qué Hace el Script

1. **Conecta a ambas bases de datos** (origen y destino)
2. **Verifica que existe el warehouse ID=1** en la BD nueva
3. **Lee todos los productos** de la BD antigua `lico`
4. **Para cada producto:**
   - Lo inserta en la tabla `products` de la BD nueva
   - Crea un registro en `product_stocks` con:
     - `warehouse_id = 1`
     - `quantity = stock` (del producto antiguo)
5. **Maneja conflictos:** Si un producto ya existe (por `barcode`), lo actualiza

## Estructura de Datos

### BD Antigua (lico)
```
products
├── id
├── name
├── description
├── barcode
├── sku
├── price
├── cost
├── stock          ← Stock global (sin warehouse)
├── category_id
└── is_active
```

### BD Nueva (pruebita2_db)
```
products                    product_stocks
├── id                      ├── id
├── name                    ├── product_id  → products.id
├── description             ├── warehouse_id → warehouses.id
├── barcode                 ├── quantity    ← Stock por warehouse
├── sku                     └── location
├── price
├── cost
├── category_id
└── is_active
```

## Solución de Problemas

### Error: "No existe warehouse con ID=1"

**Solución:** Crea el warehouse primero en la BD nueva:
```sql
INSERT INTO warehouses (id, name, is_active, is_main)
VALUES (1, 'Almacen Principal', true, true);
```

### Error: "column 'stock' does not exist"

**Solución:** Ajusta la query en `get_products_from_lico()` para usar el nombre correcto de la columna en tu BD antigua.

### Error: "duplicate key value violates unique constraint"

**Solución:** El script usa `ON CONFLICT` para manejar duplicados automáticamente. Si sigue fallando, revisa que la columna `barcode` sea única.

## Notas Importantes

- ✅ El script es **idempotente**: puedes ejecutarlo múltiples veces sin duplicar datos
- ✅ Usa **transacciones**: si un producto falla, no afecta a los demás
- ⚠️ **Backup recomendado**: Haz un backup de la BD destino antes de migrar
- 📝 **Logs detallados**: El script muestra cada producto que migra

## Personalización

Si necesitas migrar otras tablas (categorías, clientes, etc.), puedes extender el script agregando funciones similares a `migrate_product()`.
