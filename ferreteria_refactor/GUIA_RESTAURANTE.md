# Guía de Uso del Módulo de Restaurante
## Nuevas Funcionalidades: Menú Visual y Recetas

### 1. Configuración Inicial (Dueño/Admin)
Antes de vender, debemos configurar la Carta y las Recetas.

#### A. Crear el Menú (Carta)
1.  Ve al **Menú Lateral** -> **Restaurante** -> **Menú Digital**.
2.  En "Estructura del Menú" (Derecha), escribe un nombre de Sección (ej: `Hamburguesas`) y pulsa **"Crear"**.
3.  Desde el panel izquierdo "Inventario", **Arrastra** tus productos (ej: "Hamburguesa Doble") y **Suéltalos** dentro de la sección creada.
    *   *Nota: Si no arrastra, puedes usar un botón "+" si aparece en móvil, pero el arrastre es ideal.*
4.  Repite para todas las categorías (Bebidas, Postres).

#### B. Definir Recetas (Escandallos)
1.  Ve a **Menú Lateral** -> **Restaurante** -> **Recetas / Escandallos**.
2.  En la izquierda, busca y selecciona tu plato (ej: "Hamburguesa Doble").
3.  A la derecha verás "Gestionar Ingredientes".
4.  Busca el insumo (ej: "Carne Molida", "Pan de Hamburguesa").
5.  Ingresa la cantidad a descontar (ej: `0.2` para 200g, o `1` para 1 unidad).
6.  Pulsa **Agregar**.
    *   *Ahora, cada vez que vendas este plato, se descontarán estos ingredientes.*

---

### 2. Flujo Diario (Cajeros/Meseros)

#### A. Tomar Pedido (POS)
1.  Ve a **Restaurante** -> **Mapa de Mesas**.
2.  Haz clic en una mesa (ej: Mesa 1).
3.  Se abrirá la ventana de pedido con el nuevo **Menú Visual**.
4.  Verás pestañas arriba con tus secciones (`Hamburguesas`, `Bebidas`).
5.  Haz clic en la pestaña deseada y luego toca los productos (`Hamburguesa Doble`) para agregarlos.
    *   *También puedes usar el buscador clásico arriba si lo prefieres.*
6.  Pulsa "Agregar a la Orden".

#### B. Enviar a Cocina (Pre-Cuenta)
1.  Opcional: Pulsa el botón de impresora 🖨️ para sacar la Pre-cuenta.
2.  El pedido ya está guardado y visible en la pantalla de Cocina (KDS).

#### C. Cobrar (Checkout)
1.  Cuando el cliente pague, pulsa **"Cobrar / Cerrar Mesa"**.
2.  Selecciona el método de pago (Efectivo, Tarjeta).
3.  Pulsa **Confirmar Pago**.

---

### 3. ¿Qué pasa en el Inventario?
Al momento de Cobrar:
*   El sistema verifica si lo vendido tiene **Receta**.
*   **SI TIENE RECETA:** Se descuenta del stock de los **Ingredientes** (ej: -1 Pan, -0.2kg Carne).
*   **NO TIENE RECETA:** Se descuenta el producto mismo (ej: Coca-Cola).

> **Consejo:** Asegúrate de que tus Platos (ej: Hamburguesa) estén configurados como tipo "Servicio" en el inventario para evitar que su stock propio se vaya a negativo, ya que lo que importa es el stock de sus ingredientes.
