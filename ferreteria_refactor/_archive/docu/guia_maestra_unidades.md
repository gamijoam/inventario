# Guía Maestra de Unidades y Presentaciones
**Sistema de Gestión de Inventario - Motor de Conversión**

---

## 📚 Introducción

Esta guía está diseñada para que entiendas **cómo funciona el cerebro del inventario** en Ferretería Web 2.0. El sistema te permite vender productos de formas complejas (a granel, por cajas, por peso) sin romper el control de stock.

### El Concepto Fundamental: Unidad Base

Imagina que el inventario es como un banco:
- **Unidad Base** = La moneda más pequeña (el centavo)
- **Presentaciones** = Billetes de diferentes denominaciones ($1, $5, $20)

Puedes dar cambio de muchas formas, pero al final todo se cuenta en centavos.

```
┌─────────────────────────────────────────┐
│         JERARQUÍA DEL SISTEMA           │
│                                         │
│  Producto: Cemento Portland            │
│  └─ Unidad Base: KILOGRAMO (KG)        │
│     ├─ Presentación: Saco (42.5 KG)    │
│     ├─ Presentación: Media Saco (21 KG)│
│     └─ Presentación: Gramo (0.001 KG)  │
└─────────────────────────────────────────┘
```

**Regla de Oro**: El stock SIEMPRE se mide en la Unidad Base. Las presentaciones son solo "formas de vender" esa base.

---

## 🏗️ CASO 1: La Ferretería Pesada (Cemento)

### El Problema Real

Compras cemento en **sacos de 42.5 kg**, pero tus clientes piden:
- Constructoras: Sacos completos
- Maestros de obra: Medios sacos
- Particulares: Kilos sueltos o incluso gramos

Si configuras mal, terminarás con:
- ❌ Stock negativo fantasma
- ❌ Ventas que no descuentan inventario
- ❌ Cuadres imposibles al final del mes

### Configuración Correcta

#### Paso 1: Define la Unidad Base

**Pregunta clave**: ¿Cuál es la unidad más pequeña que puedes vender?

**Respuesta**: KILOGRAMO (KG)

```
Producto: Cemento Portland Gris
├─ Unidad Base: KILOGRAMO (KG)
├─ Stock Actual: 850 KG
└─ Precio Base: $0.50 USD/KG
```

> **💡 Por qué KG y no Saco**: Porque puedes vender fracciones de saco, pero no fracciones de kilo (bueno, técnicamente sí, pero para efectos prácticos el kilo es tu átomo).

#### Paso 2: Crea la Presentación "Saco"

En el sistema:

1. Ve a la pestaña **"Presentaciones"**
2. Presiona **"+ Agregar EMPAQUE"** 📦
3. Completa:

| Campo | Valor | Explicación |
|-------|-------|-------------|
| Nombre | Saco de Cemento | Nombre comercial |
| Tipo | EMPAQUE | Porque contiene múltiples unidades base |
| Pregunta del Wizard | ¿Cuántos KG contiene un Saco? | |
| Respuesta | 42.5 | Un saco = 42.5 kilos |
| Factor (automático) | 42.5 | El sistema lo calcula |
| Precio Específico | (vacío) | Se calcula: $0.50 × 42.5 = $21.25 |
| Código de Barras | 7501234567890 | Código del saco |

**Resultado**: Cuando vendas 1 Saco, el sistema descontará **42.5 KG** del inventario.

#### Paso 3: Crea la Presentación "Gramo" (Fracción)

1. Presiona **"+ Agregar FRACCIÓN"** ✂️
2. Completa:

| Campo | Valor | Explicación |
|-------|-------|-------------|
| Nombre | Gramo | Unidad de venta al menudeo |
| Tipo | FRACCIÓN | Porque es parte de la unidad base |
| Pregunta del Wizard | ¿Cuántos Gramos hay en 1 KG? | |
| Respuesta | 1000 | 1 kilo = 1000 gramos |
| Factor (automático) | 0.001 | El sistema calcula 1/1000 |
| Precio Específico | (vacío) | Se calcula: $0.50 ÷ 1000 = $0.0005 |

**Resultado**: Cuando vendas 500 Gramos, el sistema descontará **0.5 KG** del inventario.

### Tabla de Conversión Automática

| Venta | Descuento en Inventario (KG) | Precio USD |
|-------|------------------------------|------------|
| 1 Saco | -42.5 KG | $21.25 |
| 1 Medio Saco | -21.25 KG | $10.63 |
| 1 Kilo | -1 KG | $0.50 |
| 500 Gramos | -0.5 KG | $0.25 |

### Diagrama de Flujo de Venta

```
Cliente compra: 2 Sacos + 3 Kilos + 500 Gramos
                    ↓
Sistema calcula:
  2 × 42.5 KG = 85 KG
  3 × 1 KG    = 3 KG
  500 × 0.001 = 0.5 KG
                    ↓
Total descuento: 88.5 KG
                    ↓
Stock anterior: 850 KG
Stock nuevo:    761.5 KG ✅
```

---

## ☕ CASO 1.5: La Cafetería (Café por Gramos)

### El Problema Real

Compras café en **sacos de 1 kilo**, pero tus clientes piden:
- Cafeterías: Kilos completos
- Particulares: 250g, 500g, 750g
- Tiendas pequeñas: Gramos sueltos

**Pregunta clave**: ¿Configuro el sistema en GRAMOS o en KILOS?

### ✅ Opción Recomendada: Base en KILOS

**Por qué**: Es más fácil de leer y los proveedores venden por kilos.

#### Paso 1: Define la Unidad Base

```
Producto: Café Arábica Premium
├─ Unidad Base: KILOGRAMO
├─ Stock Actual: 850 kilos
└─ Precio Base: $15.00 USD/kilo
```

#### Paso 2: Crea la Presentación "Gramo" (FRACCIÓN)

En el sistema:

1. Ve a la pestaña **"Presentaciones"**
2. Presiona **"+ Agregar Unidad"** → Selecciona **"Fracción ✂️"**
3. Completa:

| Campo | Valor | Explicación |
|-------|-------|-------------|
| Nombre | Gramo | Unidad de venta al menudeo |
| Pregunta | ¿Cuántos Gramos hay en 1 KILOGRAMO? | Nueva interfaz clara |
| Respuesta | 1000 | 1 kilo = 1000 gramos |
| **Preview Automático** | **💰 $0.015** | El sistema lo muestra en grande |
| Cálculo mostrado | $15.00 ÷ 1000 = $0.015 | Transparente |

**Resultado**: Cuando vendas 250 Gramos, el sistema descontará **0.25 KG** del inventario.

#### Paso 3: Ejemplo de Venta

**Cliente pide: 250 gramos de café**

```
En el POS:
1. Busca "Café Arábica"
2. Aparecen 2 opciones:
   - Café Arábica - KILOGRAMO ($15.00)
   - Café Arábica - Gramo ($0.015)
3. Selecciona "Gramo"
4. Cambia cantidad a 250
5. Total: $3.75
6. Stock descuenta: 0.25 kilos
```

### Tabla de Conversión Automática

| Venta | Descuento en Inventario (KG) | Precio USD |
|-------|------------------------------|------------|
| 1 Kilo | -1 KG | $15.00 |
| 500 Gramos | -0.5 KG | $7.50 |
| 250 Gramos | -0.25 KG | $3.75 |
| 100 Gramos | -0.1 KG | $1.50 |

### 🔄 Opción Alternativa: Base en GRAMOS

**Solo si vendes PRINCIPALMENTE por gramos y rara vez por kilos.**

#### Configuración:

```
Producto: Café Arábica Premium
├─ Unidad Base: GRAMO
├─ Stock Actual: 850,000 gramos
└─ Precio Base: $0.015 USD/gramo
```

#### Presentación "Kilo" (EMPAQUE):

| Campo | Valor |
|-------|-------|
| Nombre | Kilo de Café |
| Tipo | EMPAQUE 📦 |
| ¿Cuántos GRAMOS contiene? | 1000 |
| Preview Automático | 💰 $15.00 |

**Ventaja**: Números más precisos para ventas pequeñas.
**Desventaja**: Stock se muestra como 850,000 (menos legible).

### 🎯 Comparación: ¿Cuál Elegir?

| Criterio | Base: KILO ✅ | Base: GRAMO |
|----------|--------------|-------------|
| **Legibilidad** | Stock: 850 | Stock: 850,000 |
| **Proveedores** | Venden por kilos | Venden por kilos |
| **Ventas comunes** | 250g, 500g, 1kg | 250g, 500g, 1kg |
| **Recomendado para** | Mayoría de casos | Venta ultra-precisa |

> **💡 Recomendación**: Usa **KILO como base** a menos que vendas exclusivamente gramos sueltos (ej: tienda de especias a granel).

---

## 🥚 CASO 2: El Bodegón (Los Huevos)

### El Problema Real

Vendes huevos de tres formas:
- **Sueltos**: Para el cliente que solo quiere 5 huevos
- **Cartones**: La presentación estándar (30 huevos)
- **Cajas Master**: Para restaurantes (12 cartones = 360 huevos)

### Configuración Correcta

#### Paso 1: Unidad Base = UNIDAD (Huevo Individual)

```
Producto: Huevos Blancos AA
├─ Unidad Base: UNIDAD (Huevo)
├─ Stock Actual: 2,160 Huevos
└─ Precio Base: $0.25 USD/Huevo
```

#### Paso 2: Presentación "Cartón"

| Campo | Valor |
|-------|-------|
| Nombre | Cartón de 30 |
| Tipo | EMPAQUE |
| ¿Cuántos Huevos contiene? | 30 |
| Factor | 30 |
| Precio | $7.50 (auto: $0.25 × 30) |

#### Paso 3: Presentación "Caja Master"

| Campo | Valor |
|-------|-------|
| Nombre | Caja Master |
| Tipo | EMPAQUE |
| ¿Cuántos Huevos contiene? | 360 |
| Factor | 360 |
| Precio | $90.00 (auto: $0.25 × 360) |

> **⚠️ Nota Crítica**: NO crees una presentación "Caja de 12 Cartones". Crea "Caja de 360 Huevos". El sistema no maneja jerarquías anidadas (Caja → Cartón → Huevo), solo (Presentación → Unidad Base).

### Jerarquía Visual

```
                    PRODUCTO: Huevos
                           │
                    Unidad Base: HUEVO
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
   Presentación 1    Presentación 2    Presentación 3
   Huevo Suelto      Cartón (×30)      Caja (×360)
   Factor: 1         Factor: 30        Factor: 360
   $0.25             $7.50             $90.00
```

### Ejemplo de Venta Compleja

**Pedido de un restaurante**:
- 2 Cajas Master
- 3 Cartones sueltos
- 15 Huevos sueltos

**Cálculo del sistema**:
```
2 Cajas   × 360 = 720 Huevos
3 Cartones × 30 = 90 Huevos
15 Huevos  × 1  = 15 Huevos
                  ─────────
Total descuento:  825 Huevos

Stock anterior: 2,160 Huevos
Stock nuevo:    1,335 Huevos ✅
```

---

## 💱 CASO 3: Compras con Tasa Diferenciada

### El Problema Real

Importas cajas de tornillos de China. Tu proveedor te cobra en USD con **Tasa Paralelo** (más alta), pero vendes tornillos sueltos a tus clientes con **Tasa BCV** (oficial).

**Escenario**:
- Compras: 1 Caja = $100 USD (Tasa Paralelo: 50 Bs/$)
- Vendes: 1 Tornillo = $0.10 USD (Tasa BCV: 45 Bs/$)

### Configuración Correcta

#### Paso 1: Producto Base con Tasa BCV

```
Producto: Tornillo Phillips 1/2"
├─ Unidad Base: UNIDAD
├─ Precio Base: $0.10 USD
└─ Tasa de Cambio: BCV (45 Bs/$)
```

Resultado: 1 Tornillo = $0.10 = **Bs 4.50**

#### Paso 2: Presentación "Caja" con Tasa Paralelo

En la pestaña de Presentaciones:

| Campo | Valor |
|-------|-------|
| Nombre | Caja de 1000 |
| Tipo | EMPAQUE |
| ¿Cuántos Tornillos contiene? | 1000 |
| Factor | 1000 |
| Precio Específico USD | $100.00 (precio real de compra) |
| **Tasa de Cambio** | **Paralelo (50 Bs/$)** ⭐ |

Resultado: 1 Caja = $100 = **Bs 5,000**

### Tabla Comparativa

| Presentación | Precio USD | Tasa | Precio Bs | Descuento Inventario |
|--------------|------------|------|-----------|----------------------|
| 1 Tornillo | $0.10 | BCV (45) | Bs 4.50 | -1 Tornillo |
| 1 Caja | $100.00 | Paralelo (50) | Bs 5,000 | -1000 Tornillos |

### ¿Por Qué Esto es Importante?

Sin esta funcionalidad:
- ❌ Venderías la caja a Bs 4,500 (45 × $100) → **Pérdida de Bs 500**
- ❌ O venderías tornillos sueltos a Bs 5.00 → **Clientes molestos**

Con tasas diferenciadas:
- ✅ La caja se vende al precio correcto (Bs 5,000)
- ✅ Los tornillos sueltos se venden competitivos (Bs 4.50)
- ✅ Tu margen está protegido

### Cómo Configurarlo en el Sistema

1. En la ficha de la Presentación "Caja"
2. Busca el selector **"💱 Tasa de Cambio Específica"**
3. Cambia de "🔗 Heredar del Producto" a **"Paralelo"**
4. Guarda

> **💡 Tip Pro**: Usa un indicador visual en el POS. El sistema muestra un badge morado 🟣 cuando un ítem usa una tasa especial.

---

## 📊 Tabla Comparativa: Tipos de Presentaciones

| Característica | EMPAQUE 📦 | FRACCIÓN ✂️ |
|----------------|-----------|-------------|
| **Definición** | Contiene múltiples unidades base | Es parte de la unidad base |
| **Factor** | > 1 (Multiplicador) | < 1 (Divisor) |
| **Ejemplos** | Caja, Saco, Pallet, Six-pack | Gramo, Metro, Litro, Onza |
| **Pregunta Wizard** | "¿Cuántas [Base] contiene?" | "¿Cuántos [Fracción] hay en 1 [Base]?" |
| **Cálculo Precio** | Precio Base × Factor | Precio Base ÷ Factor |
| **Uso Común** | Ventas mayoristas | Ventas al menudeo |

---

## ❓ Preguntas Frecuentes (FAQ)

### 1. ¿Qué pasa si elimino una presentación que tiene stock?

**R**: No pasa nada con el stock. El stock está en la **Unidad Base**, no en las presentaciones. Las presentaciones son solo "formas de vender".

**Ejemplo**:
- Stock: 1000 Tornillos
- Eliminas la presentación "Caja de 100"
- Stock sigue siendo: 1000 Tornillos ✅

Solo pierdes la opción de vender por caja, pero el inventario está intacto.

### 2. ¿Puedo tener múltiples presentaciones del mismo tipo?

**R**: ¡Sí! Puedes tener:
- Caja de 100
- Caja de 500
- Caja de 1000

Todas son EMPAQUES con diferentes factores.

### 3. ¿Qué pasa si vendo más de lo que tengo en stock?

**R**: El sistema te alertará:
```
⚠️ Stock insuficiente
Intentas vender: 5 Cajas (500 Tornillos)
Stock disponible: 350 Tornillos
```

No te dejará completar la venta.

### 4. ¿Puedo cambiar el factor de conversión después de crear ventas?

**R**: **Sí, pero con cuidado**. Cambiar el factor no afecta ventas pasadas, solo futuras. 

**Recomendación**: Si cambias el factor significativamente, crea una nueva presentación en lugar de modificar la existente.

### 5. ¿Cómo sé cuál es mi Unidad Base correcta?

**Pregúntate**:
- ¿Cuál es la unidad más pequeña que vendo?
- ¿Cuál es la unidad en la que cuento mi stock físicamente?
- ¿Qué unidad usa mi proveedor?

**Ejemplos**:
- Tornillos → UNIDAD (cuentas tornillos)
- Cemento → KILOGRAMO (pesas kilos)
- Cable → METRO (mides metros)
- Pintura → LITRO (mides litros)
- **Café → KILOGRAMO** (aunque vendas por gramos, el stock se cuenta en kilos)

**Regla de Oro**: Usa la unidad que hace los números más legibles. Stock de 850 es mejor que 850,000.

### 6. ¿El sistema me muestra el precio calculado antes de guardar?

**¡Sí!** Con las nuevas mejoras de UX (Diciembre 2024):

Cuando creas una presentación, verás un **cuadro azul grande** que muestra:

```
💰 Precio Calculado Automáticamente: $0.015
Cálculo: $15.00 ÷ 1000 = $0.015
```

Esto te permite verificar que el precio es correcto ANTES de guardar.

### 7. ¿Qué significa "¿Cuántos Gramos hay en 1 KILOGRAMO?"?

Esta es la **nueva pregunta clara** del sistema (antes decía "Divisor").

**Cómo responder**:
- Si 1 kilo = 1000 gramos → Escribe **1000**
- Si 1 metro = 100 centímetros → Escribe **100**
- Si 1 litro = 1000 mililitros → Escribe **1000**

El sistema automáticamente calculará el factor de conversión (0.001, 0.01, etc.).

### 8. ¿Puedo vender en negativo (bajo pedido)?

**R**: Depende de la configuración del sistema. Por defecto, no. Pero el administrador puede habilitar "Ventas en Negativo" para productos bajo pedido.

### 7. ¿Qué pasa si escaneo el código de barras de una presentación?

**R**: El sistema:
1. Identifica la presentación
2. Agrega al carrito con el precio correcto
3. Descuenta el inventario según el factor

**Ejemplo**: Escaneas código de "Caja de 100" → Se agrega 1 Caja ($X) → Se descuentan 100 unidades del stock.

---

## 🎯 Mejores Prácticas

### ✅ DO (Haz esto)

1. **Define la Unidad Base pensando en legibilidad**
   - Si cuentas kilos, usa KG (no gramos)
   - Si cuentas unidades, usa UNIDAD
   - Evita números gigantes (850 es mejor que 850,000)

2. **Usa nombres descriptivos para presentaciones**
   - ✅ "Caja Master 360 Huevos"
   - ✅ "Gramo (para café)"
   - ❌ "Caja Grande"
   - ❌ "Unidad 2"

3. **Verifica el preview de precio antes de guardar**
   - El sistema muestra 💰 Precio Calculado Automáticamente
   - Si el precio no tiene sentido, revisa el factor

4. **Asigna códigos de barras a cada presentación**
   - Acelera el proceso de venta
   - Reduce errores humanos

5. **Lee el mensaje de feedback**
   - El sistema te muestra un ejemplo de cómo se descontará el stock
   - Ejemplo: "Al vender 250 gramos, se descontarán 0.250 KILOGRAMO"

6. **Usa tasas diferenciadas solo cuando sea necesario**
   - Para importaciones con costos en tasa paralela
   - Para productos con márgenes especiales

### ❌ DON'T (Evita esto)

1. **No cambies la Unidad Base después de tener movimientos**
   - Romperás el historial de stock

2. **No crees jerarquías anidadas**
   - ❌ Caja → Cartón → Huevo
   - ✅ Caja (360 Huevos) y Cartón (30 Huevos)

3. **No uses factores de conversión "creativos"**
   - Si 1 Caja = 100 Tornillos, el factor es 100, no 99.5

4. **No elimines presentaciones con ventas activas**
   - Espera a que se completen las transacciones

---

## 🔧 Troubleshooting

### Problema: "El stock no cuadra después de vender cajas"

**Diagnóstico**:
```
Vendí: 5 Cajas de 100
Stock esperado: -500 unidades
Stock real: -50 unidades ❌
```

**Causa probable**: El factor está mal configurado (10 en lugar de 100).

**Solución**:
1. Ve a la presentación "Caja"
2. Verifica el campo "¿Cuántas unidades contiene?"
3. Debe ser 100, no 10
4. Corrige y guarda
5. Las futuras ventas usarán el factor correcto

### Problema: "Los precios en Bs están incorrectos"

**Diagnóstico**:
```
Precio USD: $10.00
Tasa BCV: 45 Bs/$
Precio mostrado: Bs 500 ❌ (debería ser Bs 450)
```

**Causa probable**: La presentación tiene una tasa específica asignada.

**Solución**:
1. Ve a la presentación
2. Busca "💱 Tasa de Cambio Específica"
3. Si dice algo distinto a "Heredar", cámbialo
4. Guarda

---

## 📈 Caso de Éxito Real

**Ferretería "El Tornillo Feliz"** implementó este sistema:

**Antes**:
- ❌ 15% de diferencias de inventario mensual
- ❌ 2 horas diarias cuadrando stock manualmente
- ❌ Pérdidas por ventas mal calculadas

**Después (3 meses)**:
- ✅ 0.5% de diferencias (solo por merma natural)
- ✅ 15 minutos de cuadre automático
- ✅ Aumento de 8% en margen por precios correctos

**Clave del éxito**: Configuraron correctamente las 3 presentaciones principales (Unidad, Caja, Pallet) y capacitaron al equipo.

---

## 📚 Recursos Adicionales

- **Video Tutorial**: [Próximamente]
- **Plantilla de Configuración**: [Descargar Excel]
- **Soporte Técnico**: admin@ferreteria.com

---

**Última actualización**: Diciembre 2024 (v1.1 - Mejoras de UX)  
**Versión del documento**: 1.1  
**Cambios en v1.1**: Agregado caso de café, nuevas preguntas del FAQ, documentación de mejoras de interfaz
