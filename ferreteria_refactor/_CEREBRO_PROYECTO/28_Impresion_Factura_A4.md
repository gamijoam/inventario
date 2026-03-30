# 28 — Impresión Factura A4 (Impresora Normal)

## Contexto

Un cliente con instalación **desktop (.exe / modo offline)** necesita imprimir facturas
en impresora normal (A4/Carta) en lugar de — o además de — el ticket térmico 58mm/80mm.

El formato es una factura estilo "hoja completa" como se usa en negocios venezolanos:
cabecera de empresa, datos del cliente, tabla de ítems con código/descripción/qty/precio/total,
y resumen de totales al pie.

---

## Decisión: Feature Flag

**Flag:** `impresion_factura_a4`
**Por qué flag:** Es para un cliente específico, no para todos los tenants.
**Categoría:** `pos`

Cuando activo, aparece un botón **"Imprimir Factura"** en el POS al completar una venta
(junto al botón de ticket térmico existente). Al presionarlo abre el diálogo de impresión
del navegador/Electron con el layout A4.

---

## Estructura del Layout A4

```
┌─────────────────────────────────────────────────────┐
│  [Logo]   NOMBRE DE LA EMPRESA          Factura N°  │
│           RIF / Dirección / Teléfonos   000001       │
│           Página 1                                   │
├──────────────────────────┬──────────────────────────┤
│ Factura a nombre de:     │ Emisión: DD/MM/AAAA       │
│ Cliente: NOMBRE          │ Vencimiento: DD/MM/AAAA   │
│ R.I.F: V-XXXXXXXX-X     │ Orden Compra:             │
│ Teléfonos: XXXX          │ Vendedor: CÓDIGO          │
│ Dirección: ...           │                           │
├──────┬────────────────────────────┬──────┬───────┬───┤
│ Cód  │ Descripción                │ Cant │ Precio│Tot│
├──────┴────────────────────────────┴──────┴───────┴───┤
│ (filas de ítems)                                     │
├──────────────────────────────────────────────────────┤
│ Notas: _______________    Total Ítems:  XXX.XX       │
│                           Descuento:     0.00        │
│                           Fletes:        0.00        │
│                           Impuestos:     0.00        │
│                           Total Factura: XXX.XX      │
└──────────────────────────────────────────────────────┘
```

---

## Implementación

### 1. Flag en registry

```python
"impresion_factura_a4": {
    "label": "Impresión factura A4 (impresora normal)",
    "description": "Habilita botón 'Imprimir Factura' en A4/Carta al finalizar venta. Para clientes con impresora de hoja.",
    "category": "pos",
}
```

### 2. Componente React

`frontend_web/src/components/pos/FacturaA4.jsx`
- Recibe los datos de la venta completada (sale object + business config + tenant)
- Renderiza el HTML del layout A4
- Se imprime con `window.print()` — CSS `@media print` oculta todo el POS y muestra solo la factura

### 3. CSS de impresión

`@page { size: A4; margin: 15mm; }`
Clase `.factura-a4-print` visible solo en `@media print` — el resto del POS oculto.

### 4. Trigger

En el modal de venta completada (PaymentSuccessModal o similar), si el flag está activo:
- Botón **"🖨️ Imprimir Factura A4"** aparece junto al botón de ticket térmico
- Al presionar llama a `window.print()` con el componente montado en DOM oculto

---

## Datos que necesita la factura

Del objeto `sale` devuelto por el backend al completar venta:
- `sale.id` → número de factura (formateado como 000001)
- `sale.created_at` → fecha emisión
- `sale.customer` → nombre, rif, teléfono, dirección
- `sale.items[]` → código, nombre, qty, unit_price_usd, subtotal_usd
- `sale.total_usd` → total
- `sale.discount_usd` → descuento
- `sale.notes` → notas

Del `ConfigContext` / `business`:
- Nombre empresa, RIF, dirección, teléfono, logo_url

---

## Notas Técnicas

- En modo offline (Electron/NWJS futuro o simplemente navegador web), `window.print()` abre
  el diálogo nativo del SO → funciona igual en desktop y SaaS.
- El número de factura se formatea con `String(id).padStart(6, '0')`.
- Si no hay cliente asignado, la sección "Factura a nombre de" queda en blanco o dice "Consumidor Final".
- El campo "Vendedor" puede ser el nombre del usuario actual (`useAuth().user.username`).
- Fletes e impuestos se muestran en 0.00 si no aplica (preparado para futuro).
