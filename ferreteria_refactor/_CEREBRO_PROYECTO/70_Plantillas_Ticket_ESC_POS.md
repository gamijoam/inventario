# 70 — Plantillas de Ticket ESC/POS: Guía de Errores y Correcciones

## Cómo funciona el sistema de impresión

```
POS (frontend) → Backend (renderiza template Scriban) → Bridge .exe (procesa tags → ESC/POS bytes) → Impresora térmica
```

Cada empresa tiene su propia plantilla guardada en:
```
{schema}.business_config  WHERE key = 'ticket_template'
```

El Bridge (`PrinterService.cs`) procesa los tags **línea por línea**. Esto es crítico.

---

## BUG #1 — Tags `<center>`, `<right>` en líneas separadas del contenido

### Síntoma
El ticket imprime literalmente `</right>` o `</center>` como texto.

### Causa
El bridge procesa los tags dentro de una sola línea. Si el tag y el contenido están en líneas distintas, el bridge no los vincula:

```
❌ INCORRECTO — el bridge imprime "</right>" literal:
<right>
SUBTOTAL: $10.00
</right>

✅ CORRECTO — tag y contenido en la misma línea:
<right>SUBTOTAL: $10.00</right>
```

### Regla
**SIEMPRE** poner el tag de apertura Y cierre en la misma línea que el contenido:

```scriban
❌ <center>
❌ <bold>{{ business.name }}</bold>
❌ </center>

✅ <center><bold>{{ business.name }}</bold></center>
```

### Corrección aplicada en rosalicia (2026-04-07)
- Header: cada línea con su propio `<center>...</center>`
- Subtotal/Total: `<right>SUBTOTAL: ...</right>` (mismo línea)
- Vuelto: `<right>VUELTO: ...</right>` (mismo línea)
- Footer: `<center>Gracias por su compra</center>`

---

## BUG #2 — Cantidad `0` para productos vendidos por peso/fracción

### Síntoma
El ticket muestra `0` en la columna CANT para productos como 0.100 kg o 0.025 kg.

### Causa
El template usa `math.round 0` que redondea al entero más cercano:
- `0.100 | math.round 0` → **0** ❌
- `0.025 | math.round 0` → **0** ❌
- `1.000 | math.round 0` → **1** ✅

### Fix
Usar `math.format "0.###"` que muestra decimales solo cuando son necesarios:
- `0.100 | math.format "0.###"` → **"0.1"** ✅
- `0.025 | math.format "0.###"` → **"0.025"** ✅
- `1.000 | math.format "0.###"` → **"1"** ✅
- `6.000 | math.format "0.###"` → **"6"** ✅

```scriban
❌ {{ item.quantity | math.round 0 | string.pad_right 3 }}

✅ {{ item.quantity | math.format "0.###" | string.pad_right 6 }}
```

> Nota: aumentar el pad_right de 3 a 6 para dar espacio a los decimales.
> Reducir el nombre del producto de 16 a 14 chars para compensar el espacio.

### Corrección aplicada en rosalicia (2026-04-07)
```sql
-- Cambio en rosalicia.business_config WHERE key='ticket_template'
-- quantity | math.round 0 | string.pad_right 3
-- → quantity | math.format "0.###" | string.pad_right 6
-- + product.name | string.slice 0 14 (antes era 16)
```

---

## Cómo aplicar estas correcciones a otro cliente

### Verificar si tiene el problema de tags:
```sql
SELECT value FROM {schema}.business_config WHERE key='ticket_template';
```
Buscar si hay líneas que contengan **solo** `<right>`, `</right>`, `<center>` o `</center>`.

### Verificar si tiene el problema de cantidad:
```sql
-- Ver si vende productos fraccionados
SELECT DISTINCT quantity FROM {schema}.sale_details WHERE quantity < 1 LIMIT 5;
```
Si hay resultados + el template usa `math.round 0` → aplicar el fix.

### Script de corrección genérico:
```sql
-- Reemplazar math.round 0 por math.format "0.###"
UPDATE {schema}.business_config
SET value = REPLACE(value,
  'item.quantity | math.round 0 | string.pad_right 3',
  'item.quantity | math.format "0.###" | string.pad_right 6'
)
WHERE key = 'ticket_template'
AND value LIKE '%math.round 0%';

-- Corregir tags multilínea (más complejo — hacerlo manualmente o con el editor de plantillas en config-center)
```

---

## Tags disponibles en el Bridge (PrinterService.cs)

| Tag | Efecto ESC/POS | Notas |
|-----|---------------|-------|
| `<center>contenido</center>` | Alinea al centro | Deben estar en la misma línea |
| `<right>contenido</right>` | Alinea a la derecha | Deben estar en la misma línea |
| `<left>contenido</left>` | Alinea a la izquierda | Default, opcional |
| `<bold>contenido</bold>` | Texto en negrita | Pueden combinarse: `<right><bold>texto</bold></right>` |
| `<cut>` | Corte de papel | Al final del ticket |

---

## Formatos de número en Scriban (para templates)

| Formato | Ejemplo entrada | Ejemplo salida | Uso recomendado |
|---------|----------------|----------------|-----------------|
| `math.round 0` | 0.100 | 0 ❌ | NO usar para cantidades fraccionadas |
| `math.format "F2"` | 0.100 | "0.10" | Precios y totales (siempre 2 decimales) |
| `math.format "0.###"` | 0.025 / 1.000 | "0.025" / "1" | **Cantidades** (decimales solo si hacen falta) |
| `math.format "F0"` | 1.000 | "1" | Cantidades enteras fijas |

---

## Historial de cambios por cliente

| Cliente | Fecha | Problema | Fix aplicado |
|---------|-------|----------|-------------|
| rosalicia | 2026-04-07 | Tags `</right>` literales + cantidad `0` en fracciones | Tags inline + `math.format "0.###"` |
