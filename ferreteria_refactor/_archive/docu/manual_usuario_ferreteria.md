# Manual de Usuario - Ferretería Web 2.0

**Sistema de Punto de Venta e Inventario**  
*Versión 2.0 - Diciembre 2024*

---

## 📘 Introducción

¡Bienvenido al nuevo sistema **Ferretería Web 2.0**! 

Este es un sistema moderno y completo que te permitirá gestionar ventas, inventario y caja desde cualquier navegador web. Ya no necesitas instalar programas en cada computadora - solo abre tu navegador favorito (Chrome, Firefox, Edge) y comienza a trabajar.

### ¿Qué hace especial a este sistema?

✅ **Multimoneda Automática**: Los precios en Bolívares se actualizan solos según la tasa del día  
✅ **Acceso desde cualquier dispositivo**: Computadora, tablet o teléfono  
✅ **Interfaz moderna e intuitiva**: Diseñada para ser rápida y fácil de usar  
✅ **Control de caja completo**: Apertura, movimientos y cierre con cuadre automático  

---

## 🔐 Acceso y Seguridad

### Iniciar Sesión

1. Abre tu navegador web
2. Ingresa la dirección del sistema (pregunta a tu administrador)
3. Verás la pantalla de inicio de sesión:
   - **Usuario**: Tu nombre de usuario asignado
   - **Contraseña**: Tu contraseña personal

4. Presiona el botón **"Iniciar Sesión"** 🔑

> **💡 Tip Pro**: Guarda la dirección del sistema en tus favoritos para acceder más rápido.

### Recuperación de Contraseña

Si olvidaste tu contraseña:

1. Presiona el enlace **"¿Olvidaste tu contraseña?"** en la pantalla de inicio
2. Ingresa tu correo electrónico registrado
3. Recibirás un enlace para crear una nueva contraseña
4. Sigue las instrucciones del correo

> **⚠️ Importante**: Si no recibes el correo en 5 minutos, contacta a tu administrador.

### PIN de Seguridad

Algunas acciones sensibles (como eliminar ventas o hacer retiros de caja) requieren un PIN de seguridad adicional. Tu administrador te proporcionará este PIN cuando sea necesario.

---

## 🛒 Módulo de Ventas (POS) - El Corazón del Sistema

El Punto de Venta (POS) es donde realizarás todas las transacciones diarias. La interfaz está dividida en tres secciones principales:

```
┌─────────────────────────────────────────────────────────┐
│  [Búsqueda]  [Categorías]        │  CARRITO DE COMPRA   │
│                                   │                      │
│  [Productos Disponibles]          │  Total: $X.XX        │
│                                   │  Total: Bs X.XX      │
└─────────────────────────────────────────────────────────┘
```

### Buscar Productos

Tienes dos formas de buscar productos:

#### Opción 1: Escáner de Código de Barras (Recomendado)

1. Coloca el cursor en el campo de búsqueda 🔍
2. Escanea el código de barras del producto
3. El producto se agregará automáticamente al carrito

> **💡 Tip Pro**: Presiona **F3** en cualquier momento para ir directo al buscador.

#### Opción 2: Búsqueda Manual

1. Escribe el nombre o código del producto en el buscador
2. Verás una lista de resultados mientras escribes
3. Haz clic en el producto deseado

### Entendiendo la Interfaz Multimoneda

El sistema muestra **todos los precios en dos monedas simultáneamente**:

```
Producto: Tornillo 1/2"
Precio: $0.50 USD
Precio: Bs 22.50
```

**¿Cómo funciona?**

- Los productos se guardan con precio en **Dólares (USD)**
- El sistema convierte automáticamente a **Bolívares (Bs)** usando la tasa del día
- **No necesitas calcular nada** - el sistema lo hace por ti

> **⚠️ Nota Importante**: La tasa de cambio la configura el administrador cada día. Si ves precios incorrectos en Bolívares, avisa a tu supervisor.

### Agregar Productos con Diferentes Presentaciones

Muchos productos se venden de diferentes formas (por unidad, por caja, por kilo, etc.). El sistema maneja esto automáticamente:

#### Ejemplo: Tornillos

Cuando haces clic en "Tornillos 1/2", aparecerá un modal preguntando:

```
┌─────────────────────────────────────┐
│  ¿Cómo deseas vender este producto? │
│                                     │
│  📦 Caja (100 unidades)             │
│     $45.00 USD / Bs 2,025.00        │
│                                     │
│  📌 Unidad                          │
│     $0.50 USD / Bs 22.50            │
└─────────────────────────────────────┘
```

**Pasos:**

1. Selecciona la presentación deseada (Caja o Unidad)
2. El producto se agregará al carrito con el precio correcto
3. El inventario se descontará automáticamente

> **💡 Tip Pro**: Las presentaciones tienen sus propios códigos de barras. Escanea el código de la caja para agregar una caja completa directamente.

### Modificar Cantidades en el Carrito

Una vez que un producto está en el carrito:

- **Aumentar cantidad**: Presiona el botón **+** ➕
- **Disminuir cantidad**: Presiona el botón **-** ➖
- **Eliminar producto**: Presiona el botón de basura 🗑️

### Proceso de Cobro

Cuando el cliente esté listo para pagar:

1. Verifica el total en USD y Bs en la parte superior del carrito
2. Presiona el botón **"Cobrar"** 💳 (grande y verde)
3. Aparecerá el modal de pago con tres pestañas:

#### Pestaña 1: Efectivo 💵

```
┌─────────────────────────────────────┐
│  Total a Cobrar: $50.00             │
│                                     │
│  Monto Recibido USD: [____]         │
│  Monto Recibido Bs:  [____]         │
│                                     │
│  Cambio: $0.00                      │
└─────────────────────────────────────┘
```

**Pasos:**

1. Ingresa el monto que te dio el cliente en USD o Bs (o ambos)
2. El sistema calculará el cambio automáticamente
3. Presiona **"Completar Venta"**

> **💡 Tip Pro**: Puedes cobrar en ambas monedas al mismo tiempo. Ejemplo: $20 USD + Bs 1,350 para completar $50 USD.

#### Pestaña 2: Pago Móvil 📱

1. Ingresa el número de referencia del pago móvil
2. Ingresa el monto en Bolívares
3. Selecciona el banco (opcional)
4. Presiona **"Completar Venta"**

#### Pestaña 3: Zelle / Transferencia 🌐

1. Ingresa el número de confirmación
2. Ingresa el monto en USD
3. Presiona **"Completar Venta"**

### Pagos Mixtos (Combinados)

Puedes combinar diferentes métodos de pago:

**Ejemplo**: Total $100 USD

1. Pestaña Efectivo: Ingresa $50 USD
2. Cambia a pestaña Zelle: Ingresa $50 USD
3. El sistema validará que la suma sea correcta
4. Presiona **"Completar Venta"**

> **⚠️ Importante**: El total de todos los métodos debe ser igual o mayor al total de la venta.

### Ticket de Venta

Después de completar la venta:

1. Se mostrará un resumen de la transacción
2. Puedes **imprimir el ticket** 🖨️ presionando el botón correspondiente
3. O **enviar por correo** 📧 si el cliente lo solicita
4. Presiona **"Nueva Venta"** para continuar

---

## 💰 Gestión de Caja (Cash Management)

### Apertura de Turno

**Cada mañana** (o al inicio de tu turno), debes abrir la caja:

1. Al entrar al sistema, verás un modal de **"Apertura de Caja"**
2. Cuenta el dinero físico que hay en el cajón
3. Ingresa los montos por moneda:

```
┌─────────────────────────────────────┐
│  Apertura de Caja - Turno Mañana    │
│                                     │
│  💵 Dólares (USD):  [____]          │
│  💵 Bolívares (Bs): [____]          │
│  💶 Euros (EUR):    [____]          │
│                                     │
│  [Abrir Caja] 🔓                    │
└─────────────────────────────────────┘
```

4. Presiona **"Abrir Caja"** 🔓

> **💡 Tip Pro**: Cuenta dos veces para evitar errores. El sistema recordará este monto inicial para el cuadre final.

### Registro de Gastos y Retiros

Durante el día, puedes necesitar registrar gastos o hacer retiros:

#### Registrar un Gasto

1. Presiona el botón **"Movimientos"** en la barra superior
2. Selecciona **"Registrar Gasto"** 💸
3. Completa el formulario:
   - **Concepto**: Descripción del gasto (ej: "Compra de marcadores")
   - **Monto**: Cantidad en USD o Bs
   - **Categoría**: Selecciona del menú desplegable
4. Presiona **"Guardar"**

#### Hacer un Retiro

1. Presiona **"Movimientos"** → **"Retiro de Caja"** 🏦
2. Ingresa el monto a retirar
3. Ingresa tu **PIN de seguridad** 🔐
4. Anota el motivo del retiro
5. Presiona **"Confirmar Retiro"**

> **⚠️ Importante**: Todos los retiros quedan registrados con tu usuario y hora exacta.

### Cierre de Caja

Al final de tu turno:

1. Presiona el botón **"Cerrar Caja"** 🔒 en la barra superior
2. El sistema te mostrará un resumen:

```
┌─────────────────────────────────────────────┐
│  Resumen de Cierre - Turno Tarde            │
│                                             │
│  💵 Efectivo Inicial:    $100.00            │
│  💳 Ventas del Día:      $850.00            │
│  💸 Gastos Registrados:  -$25.00            │
│  🏦 Retiros:             -$200.00           │
│  ─────────────────────────────────          │
│  📊 Efectivo Esperado:   $725.00            │
│                                             │
│  Efectivo Real Contado:  [____]             │
│                                             │
│  Diferencia: $0.00 ✅                       │
└─────────────────────────────────────────────┘
```

3. Cuenta el dinero físico en el cajón
4. Ingresa el **"Efectivo Real Contado"**
5. El sistema calculará la diferencia:
   - **✅ $0.00**: Perfecto, todo cuadra
   - **⚠️ Diferencia positiva**: Hay más dinero del esperado (sobrante)
   - **❌ Diferencia negativa**: Falta dinero (faltante)

6. Presiona **"Cerrar Caja"** 🔒

> **💡 Tip Pro**: Si hay una diferencia, revisa las ventas del día antes de cerrar. Puedes cancelar el cierre y verificar.

### Cuadre de Divisas

El sistema maneja **cuadres separados por moneda**:

```
Dólares (USD):
  Inicial: $100.00
  Esperado: $725.00
  Real: $725.00 ✅

Bolívares (Bs):
  Inicial: Bs 4,500.00
  Esperado: Bs 38,250.00
  Real: Bs 38,250.00 ✅
```

Cada moneda debe cuadrar independientemente.

---

## 📦 Inventario (Básico)

### Crear un Producto Nuevo (Simple)

Para agregar un producto básico al inventario:

1. Ve al menú **"Productos"** 📦
2. Presiona el botón **"+ Nuevo Producto"** ➕
3. Completa el formulario:

#### Pestaña General

- **Nombre**: Nombre del producto (ej: "Tornillo Phillips 1/2")
- **SKU**: Código interno (opcional, se genera automático)
- **Categoría**: Selecciona del menú desplegable
- **Código de Barras**: Escanea o ingresa manualmente

#### Pestaña Precios & Stock

- **Precio de Costo**: Cuánto te costó (en USD)
- **Precio de Venta**: Cuánto lo vendes (en USD)
- **Stock Inicial**: Cantidad disponible
- **Stock Mínimo**: Alerta cuando llegue a este número
- **Ubicación**: Dónde está físicamente (ej: "Estante A3")

> **💡 Tip Pro**: El sistema calcula automáticamente el margen de ganancia cuando ingresas costo y precio de venta.

#### Pestaña Presentaciones (Opcional)

Si el producto se vende de diferentes formas:

1. Presiona **"+ Agregar EMPAQUE"** 📦 o **"+ Agregar FRACCIÓN"** ✂️
2. **Para Empaques** (ej: Cajas):
   - Nombre: "Caja"
   - ¿Cuántas unidades contiene?: 100
   - Código de barras de la caja (opcional)
   - Precio específico (opcional, se calcula automático)

3. **Para Fracciones** (ej: Gramos):
   - Nombre: "Gramo"
   - ¿Cuántos gramos hay en 1 Kilo?: 1000
   - Código de barras (opcional)

4. Presiona **"Agregar Presentación"**

> **💡 Tip Pro**: El sistema calcula automáticamente los precios de las presentaciones. Una caja de 100 unidades costará 100 veces el precio unitario.

5. Presiona **"Guardar Producto"** 💾

### Ajustar Stock Rápido

Para corregir el inventario de un producto:

1. Ve a **"Productos"** 📦
2. Busca el producto
3. Presiona el botón **"Ajustar Stock"** ⚙️
4. Ingresa el nuevo stock correcto
5. Anota el motivo (ej: "Conteo físico", "Producto dañado")
6. Presiona **"Guardar"**

> **⚠️ Importante**: Los ajustes de stock quedan registrados con tu usuario y fecha.

---

## 🎯 Tips Generales y Atajos de Teclado

### Atajos de Teclado

- **F3**: Ir al buscador de productos
- **F9**: Abrir modal de cobro
- **ESC**: Cerrar modal actual
- **Ctrl + N**: Nueva venta (después de completar una)

### Mejores Prácticas

✅ **Verifica siempre** el total antes de cobrar  
✅ **Cuenta el cambio** dos veces antes de entregarlo  
✅ **Escanea códigos** en lugar de buscar manualmente (más rápido)  
✅ **Cierra tu caja** al final del turno, no lo dejes para después  
✅ **Reporta diferencias** inmediatamente a tu supervisor  

### Preguntas Frecuentes

**P: ¿Qué hago si el sistema está lento?**  
R: Refresca la página (F5) o cierra y abre el navegador. Si persiste, contacta a soporte.

**P: ¿Puedo usar el sistema desde mi teléfono?**  
R: Sí, pero se recomienda usar una computadora o tablet para mejor experiencia.

**P: ¿Qué pasa si se va la luz durante una venta?**  
R: El sistema guarda automáticamente. Al volver la luz, la venta estará en el carrito.

**P: ¿Cómo cambio la tasa de cambio?**  
R: Solo los administradores pueden cambiar la tasa. Contacta a tu supervisor.

**P: ¿Puedo cancelar una venta ya completada?**  
R: Sí, pero necesitas permisos especiales. Contacta a tu supervisor.

---

## 📞 Soporte y Contacto

Si tienes problemas técnicos o dudas:

1. **Primer nivel**: Consulta este manual
2. **Segundo nivel**: Pregunta a tu supervisor de turno
3. **Soporte técnico**: [Contacto del administrador del sistema]

---

## 📝 Notas de Versión

**Versión 2.0 - Diciembre 2024**

Nuevas características:
- ✨ Sistema multimoneda con conversión automática
- ✨ Gestión de presentaciones de productos (cajas, fracciones)
- ✨ Cuadre de caja por moneda
- ✨ Interfaz moderna y responsive
- ✨ Búsqueda inteligente de productos

---

**¡Gracias por usar Ferretería Web 2.0!**

*Este manual se actualiza regularmente. Última actualización: Diciembre 2024*
