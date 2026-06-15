/**
 * Sistema de Ayuda Contextual — Mi Inventario Fácil
 * Guías completas para operación autónoma del sistema.
 */

export const HELP_CONTENT = {

  /* ══════════════════════════════════════════════════
     DASHBOARD
  ══════════════════════════════════════════════════ */
  dashboard: {
    title: 'Resumen del Negocio',
    icon: '📊',
    description: 'Tu pantalla de control. Muestra en tiempo real cómo está tu negocio: ingresos, ganancias, alertas activas y rendimiento del equipo para el período que elijas.',
    steps: [
      { title: 'Seleccionar el período', desc: 'Usa los botones Hoy / Ayer / Semana / Mes arriba a la derecha. El sistema recalcula todos los indicadores automáticamente.' },
      { title: 'Leer los 6 indicadores principales', desc: 'INGRESOS: total cobrado en el período. GANANCIA REAL: ingresos menos el costo de los productos vendidos — lo que realmente te quedó. TRANSACCIONES: número de ventas completadas. TICKET PROMEDIO: cuánto gasta en promedio cada cliente. CRÉDITOS PENDIENTES: dinero que te deben clientes. ÓRDENES TALLER: equipos activos en reparación.' },
      { title: 'Interpretar las flechas de tendencia', desc: 'La flecha verde con porcentaje indica que ese indicador subió vs el período anterior. La flecha roja indica que bajó. El porcentaje es la variación exacta.' },
      { title: 'Atender las alertas', desc: 'La sección naranja "Requieren Atención" aparece cuando hay problemas activos. Puede mostrar: productos agotados o bajo el mínimo de stock, órdenes del taller listas para cobrar, créditos de clientes vencidos. Haz clic en cualquier alerta para ir directo al módulo correspondiente.' },
      { title: 'Analizar ventas vs ganancia', desc: 'El gráfico de área muestra las ventas y la ganancia día por día. Si las barras de ventas son altas pero las de ganancia son bajas, estás vendiendo con poco margen — revisa tus costos de compra.' },
      { title: 'Revisar métodos de pago', desc: 'El gráfico circular muestra cómo pagaron tus clientes: efectivo, Zelle, transferencia, etc. Útil para saber cuánto efectivo real esperar al cerrar la caja.' },
      { title: 'Ver top productos', desc: '"Top Productos" muestra los artículos que más ingresos generaron. Si un producto no aparece, vendiste poco de él en ese período.' },
      { title: 'Revisar el equipo', desc: '"Rendimiento Equipo" muestra cuántas comisiones generó cada empleado y cuánto tiene pendiente de cobrar.' },
      { title: 'Actualizar los datos', desc: 'El botón ↺ en la esquina superior derecha recarga todos los datos sin tener que refrescar la página.' },
    ],
    tips: [
      'Si los ingresos de hoy muestran $0.00, verifica que hayas abierto el turno de caja antes de vender.',
      'La "Ganancia Real" es el indicador más honesto del negocio — un negocio con altas ventas pero baja ganancia puede estar en problemas.',
      'Un ticket promedio cayendo mes a mes indica que los clientes compran menos por visita. Considera estrategias de venta cruzada.',
      'Las alertas de stock bajo se configuran en cada producto (campo "Stock Mínimo"). Ajústalas según tu ritmo de ventas.',
    ],
    actions: ['Cambiar período', 'Actualizar datos (↺)', 'Ir al módulo desde alerta', 'Abrir POS'],
  },

  /* ══════════════════════════════════════════════════
     POS — GUÍA COMPLETA
  ══════════════════════════════════════════════════ */
  pos: {
    title: 'Punto de Venta — Guía Completa',
    icon: '🛒',
    description: 'El POS es donde realizas todas las ventas. Incluye búsqueda de productos, carrito, múltiples métodos de pago, descuentos, ventas a crédito, venta de órdenes del taller y atajos de teclado para cajeros rápidos.',
    steps: [
      {
        title: '1. Abrir el turno de caja (obligatorio)',
        desc: 'Antes de vender, debes tener un turno activo. Si ves el mensaje "Caja Cerrada" en la parte superior, ve a Apertura/Cierre de Caja, ingresa el monto del fondo inicial (el dinero con el que arrancas el día) y confirma. Sin este paso no puedes completar ventas.'
      },
      {
        title: '2. Buscar y agregar productos',
        desc: 'Escribe el nombre, código o SKU del producto en la barra de búsqueda. También puedes escanear el código de barras con un lector USB — el sistema lo detecta automáticamente. Haz clic en el producto o presiona Enter para agregarlo al carrito. Si el producto requiere serial/IMEI, el sistema te pedirá confirmarlo antes de agregar.'
      },
      {
        title: '3. Ajustar cantidades en el carrito',
        desc: 'Usa los botones + y − junto a cada ítem para cambiar la cantidad. También puedes hacer clic directo en el número de cantidad y escribir el valor exacto. Para eliminar un ítem, usa el ícono de papelera.'
      },
      {
        title: '4. Asignar un cliente (opcional pero recomendado)',
        desc: 'Haz clic en el ícono de persona (👤) en el carrito. Busca el cliente por nombre, cédula o teléfono. Al asignarlo: se aplican sus precios especiales si tiene lista de precios, puedes hacer ventas a crédito, y la venta queda en su historial. Si no lo encuentras, puedes crearlo desde el mismo buscador.'
      },
      {
        title: '5. Aplicar descuento en factura (requiere PIN de admin)',
        desc: 'Haz clic en el ícono de etiqueta (🏷️) en la sección del total del carrito. Tienes 5 tipos de descuento: PORCENTAJE (ej: 10% de descuento sobre el total), MONTO FIJO EN $ (ej: $5 de descuento), MONTO FIJO EN Bs (descuento en bolívares), PRECIO OBJETIVO en $ (estableces el total final que quieres cobrar en dólares) y PRECIO OBJETIVO en Bs (estableces el total final en bolívares). Ingresa el valor y confirma. El sistema pedirá el PIN del administrador para autorizar — el cajero no puede aplicar descuentos sin autorización.'
      },
      {
        title: '6. Descuentos automáticos por cantidad',
        desc: 'Si un producto tiene reglas de descuento por volumen configuradas (ej: "10% de descuento comprando 5 o más"), el descuento se aplica automáticamente al carrito cuando el cliente alcanza esa cantidad. No necesitas hacer nada extra.'
      },
      {
        title: '7. Pausar una venta y atender a otro cliente',
        desc: 'Si un cliente necesita tiempo para decidir y hay otro esperando, presiona el botón PAUSAR o usa la tecla F6. La venta actual queda guardada en memoria. Atiende al otro cliente normalmente. Para recuperar la venta pausada, presiona F6 de nuevo o haz clic en el banner amarillo que aparece en la parte inferior del carrito.'
      },
      {
        title: '8. Cobrar — métodos de pago',
        desc: 'Haz clic en "Cobrar" o presiona F5. Se abre el modal de pago con el total a cobrar. Selecciona el método de pago de la lista (los métodos activos se configuran en Configuración → Métodos de Pago). Ingresa el monto recibido. Para pagos en bolívares, el sistema convierte automáticamente usando la tasa del día.'
      },
      {
        title: '9. Pagos mixtos (cliente paga con dos métodos)',
        desc: 'En el modal de cobro, haz clic en "+ Agregar otro método de pago". Puedes dividir el total entre tantos métodos como necesites. Por ejemplo: el cliente paga $20 en efectivo y el resto por Zelle. El sistema calcula automáticamente cuánto falta con cada método que agregas.'
      },
      {
        title: '10. Venta a crédito',
        desc: 'El cliente debe estar asignado y tener crédito disponible. En el modal de cobro, activa el interruptor "Venta a Crédito". El sistema muestra el límite de crédito disponible del cliente. Si el total no supera el límite, confirma y la deuda queda registrada en Créditos (CxC). Cuando el cliente venga a pagar, ve a Centro de Ventas → Créditos.'
      },
      {
        title: '11. Cargar una orden del taller al POS',
        desc: 'Si un cliente viene a recoger y pagar su equipo del taller, puedes cobrarla directamente desde el POS. Haz clic en el botón de llave inglesa (🔧) en la barra superior. Busca la orden por nombre del cliente o número. Al cargarla, los ítems de servicio y repuestos aparecen en el carrito listos para cobrar.'
      },
      {
        title: '12. Cargar una cotización aprobada',
        desc: 'Si el cliente aprobó una cotización y viene a comprar, no tienes que agregar los productos uno a uno. Ve a Centro de Ventas → Cotizaciones, busca la cotización y haz clic en "Facturar". El sistema abre el POS con todos los productos ya en el carrito.'
      },
      {
        title: '13. Imprimir el ticket',
        desc: 'Después de confirmar el pago, el sistema imprime automáticamente si tienes una impresora térmica configurada. Si no imprimió, haz clic en el ícono de impresora en la confirmación de venta. También puedes imprimir en formato A4 si tienes esa función activa en Configuración → Estación POS.'
      },
      {
        title: '14. Nueva venta',
        desc: 'Después de cobrar, el carrito se limpia automáticamente. Para limpiar manualmente en cualquier momento usa la tecla F2 (pedirá confirmación si hay productos en el carrito).'
      },
    ],
    tips: [
      'ATAJOS DE TECLADO: F2 = Nueva venta | F3 = Enfocar búsqueda | F4 = Editar último ítem | F5 = Cobrar | F6 = Pausar/Retomar venta | ESC = Cerrar ventana activa.',
      'Los descuentos en factura requieren PIN de administrador. Si necesitas aplicar muchos descuentos, el administrador puede darte el PIN temporalmente.',
      'Para pagos en Zelle o transferencia, el sistema pedirá el número de referencia. Siempre pídele la confirmación al cliente antes de cerrar la venta.',
      'Si el cliente paga con un billete de más, ingresa el monto recibido exacto. El sistema calcula el vuelto automáticamente y lo muestra en pantalla.',
      'Puedes tener una sola venta pausada a la vez. Si pausas una segunda, te preguntará si quieres reemplazar la primera.',
      'Los productos agotados no aparecen en la búsqueda del POS. Si el cliente pide algo que no encuentras, puede estar sin stock.',
      'El botón de configuración (⚙️) en el POS te permite cambiar el almacén activo, el tema visual y otras opciones de esa estación específica.',
    ],
    actions: ['Buscar producto', 'Aplicar descuento (PIN requerido)', 'Pausar venta (F6)', 'Cobrar (F5)', 'Pago mixto', 'Venta a crédito', 'Cargar orden taller', 'Imprimir ticket', 'Nueva venta (F2)'],
  },

  /* ══════════════════════════════════════════════════
     CENTRO DE VENTAS
  ══════════════════════════════════════════════════ */
  'sales/cotizaciones': {
    title: 'Cotizaciones — Guía Completa',
    icon: '📄',
    description: 'Las cotizaciones son presupuestos formales que entregas al cliente antes de confirmar la venta. Cuando el cliente acepta, se convierten en venta real con un solo clic sin tener que reescribir nada.',
    steps: [
      { title: 'Entender el flujo completo', desc: 'El flujo típico es: 1) Cliente pregunta el precio → 2) Creas la cotización → 3) Se la imprimes o muestras → 4) El cliente decide → 5) Si acepta, presionas "Facturar" y el POS se carga automáticamente → 6) Cobras. Si no acepta, la cotización queda como Pendiente hasta que venza.' },
      { title: 'Crear una cotización', desc: 'Haz clic en "Nueva Cotización". Primero busca y selecciona el cliente (si no tiene cuenta, puedes usar "Cliente General"). Luego busca los productos, ajusta cantidades y precios si es necesario. El total se calcula automáticamente. Guarda cuando esté lista.' },
      { title: 'Leer el panel de estadísticas', desc: 'Los 4 cuadros superiores muestran: TOTAL (cuántas cotizaciones existen), PENDIENTES (aún sin respuesta del cliente con el monto total que representan), FACTURADAS (convertidas en ventas reales), y CONVERSIÓN (qué porcentaje de tus cotizaciones se convirtieron en ventas — un indicador de tu efectividad comercial).' },
      { title: 'Filtrar por estado', desc: 'Los botones Todas / Pendientes / Facturadas / Vencidas muestran solo las cotizaciones de ese estado. Úsalos para hacer seguimiento: ve a "Pendientes" para ver a qué clientes les falta responder.' },
      { title: 'Imprimir o mostrar al cliente', desc: 'Cada cotización tiene botones de acción en la parte inferior de la tarjeta. El ícono de impresora abre la versión para imprimir en hoja normal. El ícono de rayo (⚡) envía a la impresora térmica (58mm o 80mm según la que tengas). También puedes mostrar la pantalla directamente al cliente.' },
      { title: 'Convertir en venta (Facturar)', desc: 'Cuando el cliente confirma que quiere comprar, haz clic en "Facturar" en la tarjeta de la cotización. El sistema abre el POS con todos los productos y cantidades ya cargados. Solo debes asignar el cliente (si no estaba ya) y cobrar.' },
      { title: 'Duplicar para pedidos repetidos', desc: 'Si un cliente hace el mismo pedido seguido, haz clic en el ícono de copiar (📋) para crear una copia nueva de la cotización. Ahorra tiempo al no tener que escribir todo de nuevo. La copia queda en estado Pendiente.' },
      { title: 'Editar una cotización', desc: 'Si el cliente pide cambiar algo, haz clic en el ícono de lápiz (✏️). Puedes cambiar productos, cantidades y precios. Guarda los cambios e imprime la versión actualizada.' },
      { title: 'Eliminar', desc: 'El ícono de papelera elimina la cotización permanentemente. Solo los administradores pueden eliminar. Ten cuidado: las cotizaciones Facturadas no deben eliminarse ya que están ligadas a una venta real.' },
    ],
    tips: [
      'Una cotización en estado "Pendiente" significa que el cliente aún no ha confirmado ni pagado.',
      'Las cotizaciones no descuentan stock — solo cuando se facturan.',
      'Contacta a los clientes con cotizaciones pendientes de más de 3 días para hacer seguimiento.',
      'El % de conversión ideal varía por industria, pero si está por debajo del 40%, revisa tus precios o el proceso de seguimiento.',
      'Puedes establecer una fecha de vencimiento al crear la cotización. Pasada esa fecha, el estado cambia a "Vencida" automáticamente.',
    ],
    actions: ['Nueva Cotización', 'Filtrar por estado', 'Imprimir', 'Imprimir en térmica', 'Facturar (convertir)', 'Duplicar', 'Editar', 'Eliminar'],
  },

  'sales/clientes': {
    title: 'Gestión de Clientes — Guía Completa',
    icon: '👥',
    description: 'Directorio completo de clientes con historial de compras, control de crédito, precios especiales y seguimiento de garantías. Un cliente bien registrado facilita el trabajo en el POS y en el taller.',
    steps: [
      { title: 'Crear un cliente nuevo', desc: 'Haz clic en "Nuevo Cliente". Campos obligatorios: Nombre completo. Campos recomendados: Cédula/RIF (para facturas fiscales), Teléfono (para seguimiento y WhatsApp), Email. Opcionales: Dirección, Empresa. Guarda con el botón verde.' },
      { title: 'Buscar un cliente', desc: 'Escribe en la barra de búsqueda el nombre, cédula o número de teléfono. El sistema filtra en tiempo real. Si tienes muchos clientes, usa el filtro de estado (Activos / Inactivos / Con deuda).' },
      { title: 'Ver el historial completo', desc: 'Haz clic en un cliente de la lista. En el panel derecho verás: todas sus compras anteriores con fecha y monto, sus órdenes del taller, cotizaciones pendientes, y el saldo de crédito actual si tiene.' },
      { title: 'Asignar lista de precios especial', desc: 'En la ficha del cliente, busca el campo "Lista de Precios" y selecciona la que corresponde (ej: Mayorista, VIP, Precio Especial). Cuando ese cliente sea seleccionado en el POS, los precios especiales se aplican automáticamente sin que el cajero tenga que hacer nada.' },
      { title: 'Configurar crédito', desc: 'En la ficha del cliente, activa "Permite Crédito" y establece el límite máximo en dólares. Con esto habilitado, el cajero puede seleccionar "Venta a Crédito" en el POS sin pasar del límite configurado.' },
      { title: 'Editar información', desc: 'Haz clic en el ícono de lápiz junto al cliente. Actualiza los datos que necesites y guarda. Los cambios aplican inmediatamente en el POS y los reportes.' },
      { title: 'Desactivar un cliente', desc: 'Si un cliente dejó de comprar o tuvo problemas, puedes desactivarlo sin eliminarlo. Así conservas todo su historial pero no aparece en la búsqueda del POS. Para reactivarlo, basta con cambiar su estado en la ficha.' },
      { title: 'Registrar notas importantes', desc: 'El campo "Notas" guarda información que solo verá tu equipo: acuerdos especiales, comportamientos, preferencias, o cualquier contexto importante sobre ese cliente.' },
    ],
    tips: [
      'Un cliente con cédula registrada puede pedir facturas con sus datos fiscales — el sistema las genera automáticamente.',
      'Desactiva en vez de eliminar — así no pierdes el historial de ventas asociado.',
      'El campo de teléfono en formato internacional (+58 para Venezuela) facilita exportar para campañas de WhatsApp.',
      'Los clientes con deuda aparecen marcados en rojo en la lista — prioriza el contacto con ellos.',
    ],
    actions: ['Nuevo Cliente', 'Buscar por nombre/cédula/teléfono', 'Ver historial', 'Asignar lista de precios', 'Configurar crédito', 'Editar', 'Desactivar/Activar'],
  },

  'sales/devoluciones': {
    title: 'Devoluciones — Guía Completa',
    icon: '↩️',
    description: 'Procesa devoluciones de ventas completas o parciales. El stock se restaura automáticamente y el reembolso queda registrado en los reportes del día.',
    steps: [
      { title: 'Buscar la venta original', desc: 'Escribe el número de factura (ej: VEN-00123) o el nombre del cliente. El sistema muestra las ventas que coinciden. Selecciona la correcta verificando la fecha y el monto.' },
      { title: 'Seleccionar qué se devuelve', desc: 'La venta original muestra todos los productos comprados. Marca los ítems que el cliente está devolviendo y la cantidad de cada uno. Puedes hacer devoluciones parciales — no tienes que devolver todo.' },
      { title: 'Elegir el tipo de reembolso', desc: 'EFECTIVO: devuelves el dinero al cliente en la moneda en que pagó. CRÉDITO A FAVOR: el monto queda como saldo positivo en la cuenta del cliente para usarlo en su próxima compra. CAMBIO DE PRODUCTO: el cliente trae un producto y lo cambia por otro de igual o mayor valor.' },
      { title: 'Confirmar la devolución', desc: 'Revisa el resumen: qué se devuelve, en qué cantidad y el monto del reembolso. Confirma. El sistema descuenta el monto de las ventas del día, restaura el stock y si hay comisiones generadas de esa venta, las ajusta.' },
      { title: 'Registrar el motivo', desc: 'El campo "Motivo" es importante para los reportes. Opciones comunes: Producto defectuoso, Error en el pedido, Cliente cambió de opinión, Garantía. Esto te ayuda a identificar patrones de devolución.' },
    ],
    tips: [
      'Siempre busca la venta original — evita hacer ajustes manuales de stock que no quedan trazados.',
      'Las devoluciones afectan los reportes de ventas netas del día en que se registran, no del día original de la venta.',
      'Si el cliente no tiene factura, busca por fecha aproximada y nombre.',
      'El crédito a favor es útil cuando el cliente quiere volver a comprar — evitas manejar efectivo de vuelta.',
    ],
    actions: ['Buscar por # factura o cliente', 'Seleccionar ítems a devolver', 'Elegir tipo de reembolso', 'Confirmar devolución'],
  },

  'sales/garantias': {
    title: 'Garantías — Guía Completa',
    icon: '🛡️',
    description: 'Verifica rápidamente si un producto vendido tiene garantía vigente y gestiona las reclamaciones. Las garantías están vinculadas a cada venta automáticamente si el producto tiene una política configurada.',
    steps: [
      { title: 'Verificar una garantía', desc: 'Busca por nombre del cliente, número de factura o nombre del producto. El sistema muestra la tarjeta de garantía con: fecha de compra, política aplicada (ej: "90 días de garantía"), fecha de vencimiento y estado (VIGENTE en verde, VENCIDA en rojo).' },
      { title: 'Qué pasa si está vigente', desc: 'Si la garantía está activa, el cliente tiene derecho a reparación o reemplazo según la política. Puedes crear una orden de taller vinculada directamente desde aquí — el equipo queda ligado al cliente y la garantía original.' },
      { title: 'Crear orden de taller desde garantía', desc: 'Haz clic en "Crear Orden de Servicio" dentro de la tarjeta de garantía. El sistema pre-llena los datos del cliente y del producto. Agrega el diagnóstico inicial y confirma. La orden aparece en el Taller marcada como "Garantía".' },
      { title: 'Si está vencida', desc: 'Si la garantía venció, infórmale al cliente. Puedes igualmente crear una orden de servicio pagada normal desde el módulo de Taller.' },
      { title: 'Configurar políticas de garantía', desc: 'Las políticas (30, 60, 90 días, etc.) se definen en Configuración → Garantías. Cada producto puede tener asignada una política diferente.' },
    ],
    tips: [
      'Una orden de taller creada desde garantía tiene un campo especial de "Garantía" que queda en el historial — protege al negocio ante disputas.',
      'Configura diferentes políticas para distintos tipos de productos: 30 días para accesorios, 90 días para equipos reparados.',
      'Registra siempre el número de serial al vender para poder verificar garantías de forma precisa.',
    ],
    actions: ['Buscar garantía', 'Ver vigencia', 'Crear orden de taller', 'Ver historial del producto'],
  },

  'sales/creditos': {
    title: 'Créditos (Cuentas por Cobrar) — Guía Completa',
    icon: '💳',
    description: 'Control completo de lo que te deben tus clientes. Aquí registras pagos, ves el envejecimiento de cada deuda y haces seguimiento de la cartera.',
    steps: [
      { title: 'Leer el resumen de la cartera', desc: 'La pantalla principal muestra: el monto total que te deben todos los clientes, cuántos clientes tienen deuda activa, y cuánto de esa deuda está vencida (pasó la fecha acordada de pago).' },
      { title: 'Entender los estados de deuda', desc: 'AL DÍA: el cliente debe pero dentro del plazo acordado. PRÓXIMO A VENCER: vence en menos de 7 días — hay que contactar al cliente. VENCIDA: ya pasó la fecha de pago — prioridad de cobro. CRÍTICA: más de 30 días vencida.' },
      { title: 'Ver el detalle de un cliente', desc: 'Haz clic en un cliente de la lista. Verás cada factura pendiente por separado: número, fecha, monto original y saldo restante. Si el cliente ha hecho abonos parciales, aparece el historial de pagos.' },
      { title: 'Registrar un pago', desc: 'Dentro de la ficha del cliente, haz clic en "Registrar Pago". Ingresa el monto recibido y el método (efectivo, Zelle, transferencia). Si el pago no cubre todo el saldo, el sistema registra el abono parcial y actualiza el saldo pendiente. Si lo cubre todo, la deuda se marca como saldada.' },
      { title: 'Registrar un pago parcial (abono)', desc: 'El sistema acepta montos menores al total adeudado. Ingresa lo que el cliente pagó hoy. El saldo restante queda registrado como deuda activa. Puedes ver el historial de todos los abonos en la ficha del cliente.' },
      { title: 'Exportar para gestión de cobro', desc: 'El botón de exportar genera un Excel con todos los deudores, montos y antigüedad. Úsalo para hacer llamadas o mensajes de seguimiento de forma organizada.' },
    ],
    tips: [
      'Llama a los clientes con deuda a partir de los 15 días — cuanto más tiempo pasa, más difícil es cobrar.',
      'Ofrece descuento por pronto pago a clientes con deudas grandes: "si pagas esta semana te damos X% de descuento en la próxima compra".',
      'Un cliente con deuda vencida aparece marcado en rojo en el Dashboard principal.',
      'Puedes bloquear nuevas ventas a crédito a un cliente que supere su límite — el sistema lo hace automáticamente.',
      'Los pagos registrados aquí afectan directamente el reporte de Créditos del Centro de Reportes.',
    ],
    actions: ['Ver cartera completa', 'Filtrar por estado', 'Registrar pago', 'Registrar abono parcial', 'Ver historial por cliente', 'Exportar para cobranza'],
  },

  /* ══════════════════════════════════════════════════
     CENTRO DE INVENTARIO
  ══════════════════════════════════════════════════ */
  'inventory/productos': {
    title: 'Productos - Guia operativa',
    icon: '??',
    description: 'Catalogo central del negocio: precios, costos, stock, listas de precios, imagenes, SKU, productos fisicos, servicios, combos y seriales/IMEI.',
    steps: [
      { title: '1. Buscar antes de crear', desc: 'Antes de registrar un producto, busca por nombre, SKU o codigo de barras. Asi evitas duplicados y errores de stock repartido entre dos fichas.' },
      { title: '2. Crear o editar la ficha', desc: 'Usa Nuevo Producto o Editar. Completa nombre, SKU si existe, categoria, tipo de producto, costo, precio de venta y listas de precios si aplica.' },
      { title: '3. Revisar precios y margen', desc: 'El precio de venta es el valor principal del POS. El costo alimenta la ganancia real. Si el costo esta en cero, la venta puede verse bien pero la utilidad saldra incorrecta.' },
      { title: '4. Configurar inventario', desc: 'Define stock inicial, stock minimo y almacen. El stock minimo dispara alertas del dashboard y ayuda a reponer antes de quedarte sin mercancia.' },
      { title: '5. Activar IMEI solo cuando aplica', desc: 'Activa control serial/IMEI unicamente si cada unidad tiene un identificador unico. Al comprar, vender, trasladar o devolver, el sistema pedira la unidad exacta.' },
      { title: '6. Usar listas de precios', desc: 'Si vendes al detal y mayor, configura las listas desde la seccion de precios. Luego asigna esa lista al cliente para que el POS aplique el precio correcto.' },
      { title: '7. Corregir datos sin romper historial', desc: 'Si un producto ya tuvo ventas, edita su ficha en vez de crear otro. El historial, kardex, seriales y reportes quedan unidos a esa ficha.' },
    ],
    tips: [
      'SKU duplicado: cambia el codigo o edita el producto existente. No crees una copia para salir del paso.',
      'Precio en cero: revisa precio de venta y listas de precios antes de vender.',
      'No aparece en POS: confirma que este activo, tenga stock si no es servicio, y que el almacen del POS sea el correcto.',
      'Stock no cuadra: abre Kardex y luego Seriales si maneja IMEI. Evita ajustar manualmente sin diagnosticar.',
      'Producto con IMEI: la cantidad disponible debe cuadrar con seriales disponibles. Si no cuadra, revisa unidades en transito, vendidas o reservadas.',
    ],
    actions: ['Buscar producto', 'Nuevo Producto', 'Editar ficha', 'Revisar listas de precios', 'Activar IMEI', 'Recepcion IMEI', 'Ver Kardex', 'Filtrar por problemas'],
  },

  'inventory/categorias': {
    title: 'Categorias - Orden del catalogo',
    icon: '???',
    description: 'Organiza productos para busqueda, POS y reportes. Una buena categoria reduce errores del cajero y hace mas utiles los reportes de venta.',
    steps: [
      { title: '1. Crear categorias simples', desc: 'Usa nombres cortos y faciles de reconocer: Celulares, Accesorios, Repuestos, Servicios. Evita nombres largos o repetidos.' },
      { title: '2. Usar subcategorias solo si ayudan', desc: 'Si tienes mucho volumen, agrupa con subcategorias. Por ejemplo Celulares > iPhone, Samsung, Xiaomi.' },
      { title: '3. Asignar productos', desc: 'La categoria se asigna al editar el producto o desde importacion masiva. Si un producto queda sin categoria, seguira vendiendo, pero sera mas dificil filtrar y reportar.' },
      { title: '4. Limpiar duplicados', desc: 'Si hay categorias parecidas, deja una principal y reasigna productos antes de eliminar la duplicada.' },
    ],
    tips: [
      'Demasiadas categorias hacen lento el trabajo en POS.',
      'No elimines una categoria sin revisar productos asociados.',
      'Usa nombres pensados para el cajero, no solo para administracion.',
    ],
    actions: ['Nueva Categoria', 'Editar nombre', 'Reasignar productos', 'Filtrar productos por categoria'],
  },

  'inventory/kardex': {
    title: 'Kardex - Auditoria de inventario',
    icon: '??',
    description: 'Historial cronologico de entradas, salidas, ventas, compras, traslados, devoluciones y ajustes. Es la primera pantalla para investigar diferencias de stock.',
    steps: [
      { title: '1. Buscar el producto', desc: 'Filtra por producto, fecha, tipo de movimiento o usuario. Empieza por los ultimos movimientos antes de hacer un ajuste.' },
      { title: '2. Leer el saldo despues del movimiento', desc: 'Cada fila debe indicar cuanto entro o salio y cual fue el saldo resultante. Si el saldo cambia de forma inesperada, revisa el movimiento anterior.' },
      { title: '3. Traducir tipos de movimiento', desc: 'Venta baja stock, Compra sube stock, Traslado salida descuenta, Traslado entrada suma, Devolucion puede reintegrar, Ajuste corrige diferencias fisicas.' },
      { title: '4. Investigar antes de ajustar', desc: 'Si falta inventario, revisa ventas, traslados, anulaciones y devoluciones. El ajuste manual debe ser la ultima opcion y siempre con motivo claro.' },
      { title: '5. Documentar diferencias', desc: 'Cuando hagas un ajuste, escribe una razon entendible: conteo fisico, merma, robo, producto danado, error de carga o conciliacion.' },
    ],
    tips: [
      'Un ajuste sin motivo claro es dificil de auditar despues.',
      'Si el producto maneja IMEI, compara Kardex con la pesta?a Seriales.',
      'Para diferencias recurrentes, revisa el almacen activo del POS y traslados pendientes.',
    ],
    actions: ['Buscar movimiento', 'Filtrar por tipo', 'Filtrar por fecha', 'Nuevo ajuste manual', 'Ver responsable'],
  },

  'inventory/traslados': {
    title: 'Traslados - Movimiento entre almacenes o empresas',
    icon: '??',
    description: 'Mueve inventario de forma trazable. Puede ser interno entre almacenes del mismo tenant o externo exportando/importando un archivo.',
    steps: [
      { title: '1. Elegir el tipo correcto', desc: 'Interno mueve stock entre almacenes propios. Exportar descuenta del origen y genera archivo. Importar recibe el archivo en el destino.' },
      { title: '2. Revisar origen y destino', desc: 'Antes de confirmar, valida de donde sale y a donde entra. Un error aqui puede dejar stock en el almacen equivocado.' },
      { title: '3. Seleccionar cantidades reales', desc: 'La pantalla puede contar modelos y unidades. Si mandas 5 unidades del mismo modelo, revisa el total de unidades, no solo la cantidad de modelos.' },
      { title: '4. Manejar IMEI con cuidado', desc: 'Si el producto maneja IMEI, selecciona o escanea los seriales exactos. No basta con cantidad; cada unidad debe viajar identificada.' },
      { title: '5. Conservar el archivo externo', desc: 'En traslados entre empresas, guarda el archivo generado hasta confirmar que el destino lo importo correctamente.' },
      { title: '6. Revisar Kardex despues', desc: 'Tras confirmar, el Kardex debe mostrar salida en origen y entrada en destino cuando aplica. Para externos, el destino lo reflejara al importar.' },
    ],
    tips: [
      'Si exportaste a otro tenant pero no importaste, el origen queda descontado y el destino no sube. Eso es esperado hasta cargar el archivo.',
      'Si un IMEI no aparece para trasladar, puede estar vendido, en transito, no disponible o asociado a otro almacen.',
      'No uses ajustes manuales para simular traslados; pierdes trazabilidad.',
      'Verifica unidades totales antes de confirmar, sobre todo cuando hay varios seriales del mismo modelo.',
    ],
    actions: ['Traslado interno', 'Exportar archivo', 'Importar archivo', 'Ver resumen de unidades', 'Revisar Kardex', 'Auditar IMEI'],
  },

  'inventory/almacenes': {
    title: 'Almacenes - Ubicaciones de stock',
    icon: '??',
    description: 'Representan locales, bodegas, vitrinas o sucursales internas. El almacen activo del POS define de donde se descuenta la venta.',
    steps: [
      { title: '1. Crear solo los necesarios', desc: 'Si tienes un solo local, un almacen principal basta. Crea mas cuando realmente tengas bodega, vitrina o sucursal separada.' },
      { title: '2. Nombrar con claridad', desc: 'Usa nombres fisicos: Local Principal, Bodega, Vitrina, Sucursal Centro. Evita Almacen 1, Almacen 2 si el equipo no los reconoce.' },
      { title: '3. Definir almacen principal', desc: 'El principal sirve como referencia para operaciones por defecto. Confirma que exista y este activo.' },
      { title: '4. Configurar POS por estacion', desc: 'Cada caja debe vender desde el almacen correcto. Si una venta descuenta de otro sitio, revisa Configuracion > Estacion POS.' },
      { title: '5. Reabastecer con traslados', desc: 'Cuando un almacen se quede bajo, mueve stock desde otro con traslado interno para dejar historial.' },
    ],
    tips: [
      'Muchos almacenes innecesarios vuelven dificil cuadrar inventario.',
      'Si POS descuenta mal, casi siempre es estacion POS con almacen incorrecto.',
      'No elimines almacenes con historial; desactivalos si ya no se usan.',
    ],
    actions: ['Nuevo Almacen', 'Editar almacen', 'Marcar principal', 'Ver stock por almacen', 'Crear traslado'],
  },

  'inventory/seriales': {
    title: 'Seriales / IMEI - Trazabilidad por unidad',
    icon: '??',
    description: 'Controla cada unidad individual de productos serializados. Ideal para celulares, laptops, consolas, equipos y mercancia con garantia por serial.',
    steps: [
      { title: '1. Confirmar que el producto maneja serial', desc: 'El flag IMEI/Serial debe estar activo en la ficha del producto. Si no esta activo, el sistema lo tratara como stock normal.' },
      { title: '2. Registrar seriales al entrar', desc: 'En compras, recepcion IMEI o importaciones, cada unidad debe tener un serial unico. Cantidad y seriales deben coincidir.' },
      { title: '3. Leer estados', desc: 'Disponible se puede vender o trasladar. Vendido ya salio en una venta. En transito fue exportado o movido. Otros estados requieren revisar historial.' },
      { title: '4. Comparar stock vs seriales', desc: 'Si el producto dice 12 unidades pero hay 11 disponibles, revisa vendidos, en transito, anulados o seriales huerfanos.' },
      { title: '5. Hacer conteo fisico', desc: 'Pega o escanea los IMEIs fisicos para comparar contra el sistema. El resultado te dira faltantes, sobrantes y coincidencias.' },
      { title: '6. Usar para garantias y devoluciones', desc: 'Cuando el cliente devuelve o reclama garantia, valida que el serial coincida con el vendido originalmente.' },
    ],
    tips: [
      'Nunca inventes un IMEI para completar una compra; luego no podras vender ni auditar correctamente.',
      'Si un serial esta en transito, revisa traslados externos antes de corregir stock.',
      'Si hay descuadre, no ajustes el producto sin revisar la unidad exacta.',
      'El boton de IMEI.info ya no forma parte del flujo recomendado; el control debe ser interno y trazable.',
    ],
    actions: ['Buscar serial', 'Filtrar disponibles', 'Filtrar en transito', 'Conteo fisico', 'Recepcion IMEI', 'Auditar descuadre'],
  },

  /* ══════════════════════════════════════════════════
     REPORTES
  ══════════════════════════════════════════════════ */
  'reports/resumen': {
    title: 'Resumen de Reportes - Lectura ejecutiva',
    icon: '??',
    description: 'Vista para entender ventas, ganancia, pagos, clientes y productos del periodo seleccionado antes de entrar al detalle.',
    steps: [
      { title: '1. Define el periodo', desc: 'Usa los presets o fechas manuales. Todos los reportes dependen de ese rango, asi que valida fechas antes de comparar numeros.' },
      { title: '2. Lee ingresos vs ganancia', desc: 'Ingresos muestran lo vendido/cobrado segun el reporte. Ganancia depende de costos correctos en productos y compras.' },
      { title: '3. Compara tendencias', desc: 'Si ventas suben pero ganancia baja, revisa costos, descuentos, devoluciones o productos con margen bajo.' },
      { title: '4. Revisa metodos de pago', desc: 'Sirve para cuadrar caja y entender cuanto entro por efectivo, punto, transferencia u otros metodos.' },
      { title: '5. Exporta para auditoria', desc: 'Exporta cuando necesites enviar al contador, comparar con caja fisica o guardar cierre mensual.' },
    ],
    tips: [
      'Si ventas salen en cero, revisa fechas, caja abierta y ventas anuladas.',
      'Ganancia rara casi siempre apunta a costos en cero o compras cargadas con costo incorrecto.',
      'Para comparar meses, usa rangos completos y no mezcles dias parciales.',
    ],
    actions: ['Cambiar periodo', 'Actualizar', 'Exportar', 'Ir a ventas', 'Ir a caja'],
  },

  'reports/ventas': {
    title: 'Reporte de Ventas - Auditoria comercial',
    icon: '??',
    description: 'Detalle de ventas por fecha, cliente, vendedor, producto, metodo de pago, descuentos, anulaciones y devoluciones.',
    steps: [
      { title: '1. Filtra por fecha', desc: 'Selecciona el periodo exacto. Para cierre diario, inicio y fin deben ser el mismo dia.' },
      { title: '2. Busca ventas puntuales', desc: 'Usa factura, cliente, vendedor o producto para investigar una venta especifica.' },
      { title: '3. Revisa estados especiales', desc: 'Ventas anuladas, devoluciones, descuentos o creditos pueden explicar diferencias contra caja.' },
      { title: '4. Abre el detalle', desc: 'El detalle muestra productos, cantidades, precios, descuentos, pagos y usuario responsable.' },
      { title: '5. Cruza con caja', desc: 'Si ventas no cuadran con efectivo, compara metodos de pago y cierre de caja del mismo rango.' },
    ],
    tips: [
      'Ventas a credito pueden aparecer como venta aunque el dinero no entro a caja.',
      'Devoluciones afectan ventas netas y deben revisarse por fecha de devolucion.',
      'Si falta una venta, confirma tenant, usuario, caja y rango horario.',
    ],
    actions: ['Filtrar fecha', 'Buscar venta', 'Ver detalle', 'Exportar Excel', 'Comparar con caja'],
  },

  'reports/caja': {
    title: 'Reporte de Caja - Cuadre de dinero',
    icon: '??',
    description: 'Control de aperturas, cierres, ingresos, egresos, metodos de pago y diferencias entre sistema y dinero contado.',
    steps: [
      { title: '1. Elige el turno o periodo', desc: 'Filtra por fecha y cajero si aplica. Un cierre de caja debe analizarse por turno, no solo por dia.' },
      { title: '2. Compara esperado vs contado', desc: 'Diferencia positiva es sobrante; negativa es faltante. Revisa pagos, egresos y vuelto.' },
      { title: '3. Revisa egresos', desc: 'Todo egreso debe tener motivo claro. Egresos sin nota complican auditoria.' },
      { title: '4. Cruza metodos de pago', desc: 'Efectivo debe cuadrar fisicamente; transferencias y punto deben cruzar con referencias externas.' },
      { title: '5. Exporta o imprime cierre', desc: 'Usa el reporte para respaldar cierres diarios y entregar a administracion.' },
    ],
    tips: [
      'Si caja no cuadra, revisa pagos mixtos y referencias antes de culpar al cajero.',
      'Ventas a credito no siempre representan efectivo en caja.',
      'Un egreso sin descripcion debe corregirse con politica interna.',
    ],
    actions: ['Filtrar turno', 'Ver detalle', 'Revisar egresos', 'Imprimir cierre', 'Exportar'],
  },

  'reports/creditos': {
    title: 'Reporte de Creditos - Cuentas por cobrar',
    icon: '??',
    description: 'Seguimiento de clientes que deben dinero, antiguedad de deuda, abonos y saldos pendientes.',
    steps: [
      { title: '1. Lee deuda total', desc: 'Muestra cuanto falta por cobrar. Si sube mucho, revisa ventas a credito recientes.' },
      { title: '2. Prioriza vencidos', desc: 'Las deudas vencidas requieren gestion primero, sobre todo montos altos o muchos dias de atraso.' },
      { title: '3. Abre detalle por cliente', desc: 'Verifica facturas, abonos, saldo restante y fecha de vencimiento.' },
      { title: '4. Registra pagos en CxC', desc: 'Los abonos deben registrarse desde creditos para bajar saldo y dejar historial.' },
      { title: '5. Exporta cartera', desc: 'Exporta para llamadas, mensajes de cobro o revision administrativa.' },
    ],
    tips: [
      'Si una deuda no baja, revisa si el pago se registro en la factura correcta.',
      'Cliente duplicado puede dividir historial y saldos.',
      'Bloquea o reduce credito si el cliente supera limite o acumula mora.',
    ],
    actions: ['Ver vencidos', 'Ver cliente', 'Registrar abono', 'Exportar cartera', 'Revisar limite'],
  },

  'reports/proveedores': {
    title: 'Reporte de Proveedores - Cuentas por pagar',
    icon: '??',
    description: 'Controla compras a credito, pagos parciales, deuda actual y relacion con proveedores.',
    steps: [
      { title: '1. Revisa deuda por proveedor', desc: 'La deuda debe salir de compras a credito menos pagos registrados.' },
      { title: '2. Abre compras pendientes', desc: 'Identifica facturas vencidas, parciales o sin pago.' },
      { title: '3. Registra pagos', desc: 'Cada pago debe aplicarse a la compra/proveedor correcto para que el saldo baje.' },
      { title: '4. Cruza con compras', desc: 'Si la deuda no cuadra, revisa facturas duplicadas, compras marcadas como credito y pagos omitidos.' },
      { title: '5. Exporta saldos', desc: 'Usalo para planificar pagos y negociar con proveedores.' },
    ],
    tips: [
      'Proveedor duplicado divide deuda y confunde reportes.',
      'Factura de proveedor repetida puede inflar cuentas por pagar.',
      'Si pagaste contado pero aparece deuda, revisa condicion de pago de la compra.',
    ],
    actions: ['Ver pendientes', 'Registrar pago', 'Ver proveedor', 'Exportar saldos', 'Revisar compras'],
  },

  'reports/inventario': {
    title: 'Reporte de Inventario - Valoracion y riesgo',
    icon: '??',
    description: 'Valor actual del inventario por costo, precio de venta, margen, stock bajo y productos sin movimiento.',
    steps: [
      { title: '1. Lee costo total', desc: 'Representa dinero invertido en stock. Si se ve bajo, revisa productos con costo cero.' },
      { title: '2. Lee valor de venta', desc: 'Es lo que podrias facturar si vendes el stock al precio configurado.' },
      { title: '3. Detecta bajo stock', desc: 'Productos bajo minimo requieren reposicion o traslado desde otro almacen.' },
      { title: '4. Detecta capital dormido', desc: 'Productos sin movimiento inmovilizan dinero. Evalua promocion, liquidacion o no reponer.' },
      { title: '5. Cruza con Kardex', desc: 'Si una cantidad no cuadra, investiga movimientos antes de ajustar.' },
    ],
    tips: [
      'Costo cero distorsiona margen y ganancia real.',
      'Stock alto sin ventas es riesgo de capital parado.',
      'En productos con IMEI, compara valoracion con seriales disponibles.',
    ],
    actions: ['Ver valoracion', 'Filtrar bajo stock', 'Exportar inventario', 'Revisar Kardex', 'Auditar seriales'],
  },

  'reports/comisiones': {
    title: 'Comisiones - Liquidacion del equipo',
    icon: '??',
    description: 'Controla comisiones generadas, pendientes, pagadas y ajustes por devoluciones o anulaciones.',
    steps: [
      { title: '1. Filtra periodo', desc: 'Usa el rango correspondiente a la liquidacion semanal, quincenal o mensual.' },
      { title: '2. Revisa pendientes', desc: 'Las pendientes son comisiones generadas y aun no pagadas.' },
      { title: '3. Abre detalle por empleado', desc: 'Verifica venta, producto, porcentaje y monto antes de pagar.' },
      { title: '4. Paga con respaldo', desc: 'Registra el pago para dejar historial y evitar doble liquidacion.' },
      { title: '5. Revisa devoluciones', desc: 'Si una venta se devolvio o anulo, la comision puede ajustarse.' },
    ],
    tips: [
      'Comisiones dependen de reglas configuradas por usuario/categoria.',
      'No pagues solo con el total: revisa detalle si el monto parece raro.',
      'Devoluciones pueden reducir comisiones ya generadas.',
    ],
    actions: ['Filtrar periodo', 'Ver empleado', 'Pagar comision', 'Exportar', 'Revisar reglas'],
  },

  /* ══════════════════════════════════════════════════
     TALLER
  ══════════════════════════════════════════════════ */
  'services/dashboard': {
    title: 'Taller — Guía Completa',
    icon: '🔧',
    description: 'Gestión completa de órdenes de servicio. Desde recibir un equipo hasta cobrar la reparación, incluyendo diagnóstico, estado, repuestos, abonos y comisiones de técnicos.',
    steps: [
      { title: 'Crear una nueva orden de servicio', desc: 'Haz clic en "Nueva Orden". El asistente tiene 4 pasos: PASO 1 — Cliente: busca el cliente existente o crea uno nuevo. PASO 2 — Equipo: tipo (Celular, Laptop, Impresora, etc.), marca, modelo, descripción del problema reportado por el cliente, y el serial/IMEI si aplica. PASO 3 — Diagnóstico inicial: lo que ves al recibirlo (condición física, accesorios entregados, daños visibles). PASO 4 — Confirmación: revisa y confirma.' },
      { title: 'Entender los estados de la orden', desc: 'RECIBIDO: el equipo llegó al taller, pendiente de revisar. DIAGNÓSTICO: el técnico está evaluando qué tiene. APROBADO: el cliente autorizó el presupuesto de reparación. EN PROCESO: se está reparando activamente. LISTO: reparación terminada, esperando que el cliente recoja. ENTREGADO: el cliente recogió el equipo (ya sea que pagó o no).' },
      { title: 'Cambiar el estado de una orden', desc: 'Haz clic en la orden para abrirla. Usa el stepper de estados en la parte superior — avanza al siguiente estado cuando corresponda. Cada cambio queda registrado con fecha, hora y usuario.' },
      { title: 'Filtrar el tablero', desc: 'Usa los botones de estado en la parte superior del tablero para ver solo las órdenes en ese paso. Por ejemplo: selecciona "LISTO" para ver todos los equipos que están esperando que los clientes recojan y paguen.' },
      { title: 'Órdenes en amarillo', desc: 'Las órdenes resaltadas en amarillo llevan más de 3 días sin cambio de estado. Son señal de que algo está estancado — revísalas y actúa.' },
      { title: 'Cobrar una orden', desc: 'Con la orden en estado LISTO, aparece el botón verde "Cobrar". Haz clic, ingresa el método de pago y el monto. Si el cliente dejó abonos previos, se descuentan automáticamente. Al confirmar, se generan las comisiones del técnico y del cajero si corresponde.' },
      { title: 'Usar plantillas para servicios frecuentes', desc: 'Si hay servicios que haces seguido (ej: "Cambio de pantalla iPhone 13"), crea una plantilla con los ítems predefinidos. Al abrir una orden, carga la plantilla y los ítems aparecen automáticamente — ahorra tiempo y evita errores.' },
    ],
    tips: [
      'Registra siempre el estado físico del equipo al recibirlo (rayones, golpes, piezas faltantes). Si el cliente reclama después, tienes el registro.',
      'Mueve las órdenes de estado todos los días — un tablero actualizado permite al administrador tomar decisiones correctas.',
      'El botón "Cobrar" solo aparece en estado LISTO. Si cobras antes, el técnico puede no haber terminado.',
    ],
    actions: ['Nueva Orden', 'Cambiar estado', 'Filtrar por estado', 'Cobrar', 'Cargar plantilla', 'Ver órdenes en retraso'],
  },

  'services/order-detail': {
    title: 'Detalle de Orden — Guía Completa',
    icon: '📋',
    description: 'Gestión detallada de una orden específica: ítems de trabajo, cambios de estado, abonos, cobro final y comunicación con el cliente.',
    steps: [
      { title: 'Agregar repuestos del inventario', desc: 'Haz clic en "+ Agregar ítem" → "Repuesto del Inventario". Busca el producto en el buscador. El sistema toma el precio de venta del producto y descuenta el stock del almacén activo. Asigna el técnico responsable de ese ítem.' },
      { title: 'Agregar servicios de mano de obra', desc: 'Haz clic en "+ Agregar ítem" → "Servicio Manual". Escribe la descripción (ej: "Diagnóstico", "Mano de obra cambio de pantalla") y el precio acordado. No descuenta stock porque es mano de obra. Asigna el técnico.' },
      { title: 'Por qué asignar el técnico a cada ítem', desc: 'Las comisiones se calculan por ítem y por técnico. Si un equipo fue trabajado por 2 técnicos distintos, cada uno recibe su comisión solo por los ítems que le asignaste. Sin técnico asignado, no hay comisión.' },
      { title: 'Registrar un abono', desc: 'Si el cliente quiere dejar una señal o pago parcial: haz clic en "Registrar Abono". Ingresa el monto y el método de pago. El abono queda registrado en la sección de pagos de la orden. Al cobrar al final, el sistema descuenta automáticamente lo ya abonado.' },
      { title: 'Avanzar el estado paso a paso', desc: 'Usa el stepper de estados en la parte superior. La secuencia lógica es: Recibido → Diagnóstico (al revisar el equipo) → Aprobado (cuando el cliente autoriza el presupuesto) → En Proceso (al comenzar la reparación) → Listo (al terminar).' },
      { title: 'El estado Aprobado', desc: '"Aprobado" significa que el cliente ya vio el presupuesto y dijo que sí. Nunca pongas En Proceso sin Aprobado — significa que estás reparando sin autorización del cliente.' },
      { title: 'Cobrar la orden completa', desc: 'Con la orden en estado LISTO, el botón "Cobrar" se activa en verde. Haz clic. El sistema muestra el total de ítems menos los abonos. Selecciona el método de pago, confirma y el sistema: genera la venta en el historial del cliente, genera las comisiones, mueve la orden a estado ENTREGADO.' },
      { title: 'Imprimir la orden para el cliente', desc: 'El ícono de impresora genera el comprobante de recepción con los datos del equipo, el diagnóstico y el número de orden. Entrégalo al cliente cuando dejes el equipo.' },
      { title: 'Agregar fotos del equipo', desc: 'En la sección de adjuntos, puedes subir fotos del equipo antes y después. Protégete de reclamos — si el cliente dice que llegó con la pantalla rota y tú tienes la foto, tienes evidencia.' },
    ],
    tips: [
      'Nunca cobres sin mover la orden a estado LISTO primero — las comisiones dependen de ese flujo.',
      'Si el cliente no viene a recoger, no muevas a ENTREGADO — queda como LISTO hasta que aparezca.',
      'Los abonos parciales son muy útiles para equipos de reparación costosa — el cliente paga la mitad al dejar, la otra mitad al recoger.',
      'Si la reparación fracasa (no se pudo reparar), cambia el estado a ENTREGADO SIN COBRO y anota el motivo.',
    ],
    actions: ['Agregar repuesto (inventario)', 'Agregar servicio (mano de obra)', 'Asignar técnico', 'Registrar abono', 'Cambiar estado', 'Cobrar', 'Imprimir orden', 'Agregar fotos'],
  },

  /* ══════════════════════════════════════════════════
     COMPRAS Y PROVEEDORES
  ══════════════════════════════════════════════════ */
  purchases: {
    title: 'Compras - Recepcion y costos',
    icon: '???',
    description: 'Registra mercancia recibida, actualiza inventario, controla costos reales y crea cuentas por pagar cuando la compra queda a credito.',
    steps: [
      { title: '1. Elegir proveedor', desc: 'Toda compra debe tener proveedor. Si no existe, crea el proveedor antes o desde el flujo disponible. Esto permite ver deudas, historial y precios por proveedor.' },
      { title: '2. Agregar productos', desc: 'Busca por nombre, SKU o codigo. Si el producto no existe, usa producto nuevo al vuelo solo cuando sea realmente una ficha nueva y no un duplicado.' },
      { title: '3. Revisar cantidad y costo', desc: 'La cantidad suma stock. El costo alimenta costo promedio, ganancia real, Kardex y reportes. No dejes costo en cero salvo que sea una recepcion especial justificada.' },
      { title: '4. Manejar productos con IMEI', desc: 'Si el producto maneja serial, la cantidad debe coincidir con los IMEIs ingresados. Cada serial debe ser unico y pertenecer al modelo correcto.' },
      { title: '5. Definir contado o credito', desc: 'Contado significa que ya pagaste. Credito crea deuda con el proveedor. Si es credito, revisa fecha acordada, monto pendiente y referencia de factura.' },
      { title: '6. Registrar factura del proveedor', desc: 'Guarda numero de factura o documento. Ayuda a cruzar fisico vs sistema y evita registrar dos veces la misma compra.' },
      { title: '7. Confirmar y auditar', desc: 'Al confirmar sube stock, se crea movimiento de Kardex y, si aplica, cuenta por pagar. Revisa el detalle despues si el proveedor o el total no cuadran.' },
      { title: '8. Registrar pagos posteriores', desc: 'Si una compra quedo a credito, entra al detalle y registra pagos parciales o totales. El saldo del proveedor debe bajar con cada abono.' },
    ],
    tips: [
      'Proveedor faltante: no guardes la compra en un proveedor generico si luego necesitas reportes limpios.',
      'Costo cero: afecta directamente la ganancia real del dashboard y reportes.',
      'IMEI incompleto: cantidad 5 requiere 5 seriales validos; si faltan, no cierres la recepcion.',
      'Factura duplicada: revisa proveedor, numero de factura y fecha antes de confirmar.',
      'Producto nuevo al vuelo: coloca SKU si lo tienes para evitar duplicados futuros.',
      'Credito vs contado: si marcas contado por error, la deuda del proveedor no se reflejara.',
    ],
    actions: ['Nueva Compra', 'Seleccionar proveedor', 'Agregar producto', 'Producto nuevo al vuelo', 'Compra con IMEI', 'Marcar contado/credito', 'Registrar pago', 'Ver detalle'],
  },

  suppliers: {
    title: 'Proveedores - Contactos y saldos',
    icon: '??',
    description: 'Directorio de proveedores con datos de contacto, condiciones de credito, limite, deuda actual e historial para cuentas por pagar.',
    steps: [
      { title: '1. Crear proveedor', desc: 'Registra nombre comercial, contacto, telefono, correo y direccion. Mientras mas completa la ficha, mas facil sera comprar, reclamar o pagar.' },
      { title: '2. Definir terminos de pago', desc: 'Indica dias de credito y limite si aplica. Estos datos ayudan a saber cuando pagar y cuanto puedes deber sin salirte del acuerdo.' },
      { title: '3. Buscar y mantener limpio', desc: 'Busca por nombre o contacto antes de crear. Si ya existe, edita la ficha en vez de duplicarla.' },
      { title: '4. Leer deuda actual', desc: 'La deuda del proveedor viene de compras a credito menos pagos registrados. Si no cuadra, revisa compras pendientes y abonos.' },
      { title: '5. Registrar pagos desde la compra o reporte', desc: 'Cuando pagues, registra el abono en el detalle de compra o en reportes de proveedores. Evita cambiar saldos manualmente.' },
      { title: '6. Revisar historial', desc: 'Usa el historial para ver compras, precios, pagos y saldos. Es clave para negociar y detectar facturas duplicadas.' },
    ],
    tips: [
      'Proveedor duplicado divide la deuda y hace que reportes parezcan incorrectos.',
      'Si la deuda sale alta, revisa compras parciales, pendientes y pagos no registrados.',
      'No elimines proveedores con historial; edita datos o desactiva si existe esa opcion.',
      'Guarda telefono/WhatsApp del vendedor para reposiciones rapidas.',
      'Usa numero de factura del proveedor en cada compra para conciliacion.',
    ],
    actions: ['Nuevo Proveedor', 'Buscar proveedor', 'Editar datos', 'Revisar deuda', 'Ver historial', 'Registrar pago de compra'],
  },

  /* ══════════════════════════════════════════════════
     CONFIGURACIÓN
  ══════════════════════════════════════════════════ */
  'config/general': {
    title: 'Configuración General — Guía Completa',
    icon: '🏪',
    description: 'Datos fundamentales de tu negocio que aparecen en todos los documentos impresos: tickets, facturas, cotizaciones y reportes.',
    steps: [
      { title: 'Nombre comercial', desc: 'Es el nombre que aparece en los tickets y facturas. Usa el nombre con el que tus clientes te conocen.' },
      { title: 'RIF o identificación fiscal', desc: 'Necesario para emitir facturas con datos fiscales. Formato Venezuela: J-00000000-0 para empresas, V-00000000 para personas naturales.' },
      { title: 'Dirección y teléfono', desc: 'Aparecen en el pie de los documentos impresos. El teléfono de contacto que los clientes pueden usar.' },
      { title: 'Logo del negocio', desc: 'Sube una imagen cuadrada (mínimo 200x200 píxeles, máximo 2MB). El logo aparece en el encabezado de los tickets y en la pantalla de login. Formatos aceptados: PNG y JPG. Si no subes logo, el sistema usa las iniciales del nombre del negocio.' },
      { title: 'Zona horaria', desc: 'Venezuela usa UTC-4. Esta zona horaria afecta la hora que aparece en los tickets — si los tickets muestran hora incorrecta, verifica este campo.' },
    ],
    tips: [
      'Un logo profesional en los tickets transmite confianza a los clientes.',
      'El RIF correcto es importante si tienes clientes que piden facturas formales con retención de IVA.',
    ],
    actions: ['Editar datos', 'Subir logo', 'Guardar cambios'],
  },

  'config/usuarios': {
    title: 'Usuarios del Sistema — Guía Completa',
    icon: '👤',
    description: 'Crea y gestiona las cuentas de acceso para todo tu personal. Cada usuario tiene un rol que define exactamente qué puede y qué no puede hacer.',
    steps: [
      { title: 'Crear un usuario nuevo', desc: 'Haz clic en "Nuevo Usuario". Completa: Nombre completo, Nombre de usuario (con el que entrará al sistema, sin espacios), Contraseña inicial, y Rol.' },
      { title: 'Entender los roles en detalle', desc: 'ADMIN: acceso total al sistema incluyendo reportes, configuración, eliminación de registros, autorización de descuentos y gestión de comisiones. CAJERO/CASHIER: puede usar el POS para vender, crear y cobrar órdenes de taller, gestionar clientes y cotizaciones. No puede ver reportes financieros ni configuración.' },
      { title: 'Configurar el PIN del cajero', desc: 'Además de la contraseña, cada cajero puede tener un PIN de 4 dígitos para desbloquear el POS rápidamente sin tener que escribir la contraseña completa. Ve al detalle del usuario → "Configurar PIN".' },
      { title: 'Configurar porcentajes de comisión', desc: 'En la ficha de cada usuario, establece: "% Comisión Vendedor" (para ventas POS) y "% Comisión Técnico" (para órdenes del taller). Si el porcentaje es 0, ese usuario no recibe comisiones.' },
      { title: 'Cambiar contraseña', desc: 'Si un empleado olvida su contraseña, haz clic en su nombre → "Cambiar Contraseña". Ingresa la nueva dos veces y guarda. El empleado podrá ingresar con la nueva contraseña inmediatamente.' },
      { title: 'Desactivar un usuario', desc: 'Si un empleado sale del negocio, desactívalo con el interruptor en su ficha. No lo elimines — así conservas todas las ventas, órdenes y movimientos que realizó. Un usuario inactivo no puede entrar al sistema.' },
    ],
    tips: [
      'Nunca compartas la contraseña del admin con los cajeros — cada uno debe tener su propia cuenta.',
      'Si sospechas que una cuenta fue comprometida, cambia la contraseña inmediatamente.',
      'El historial de auditoría registra cada acción de cada usuario — si algo sale mal, puedes rastrear quién lo hizo y cuándo.',
    ],
    actions: ['Nuevo Usuario', 'Configurar PIN', 'Configurar % comisión', 'Cambiar contraseña', 'Activar / Desactivar'],
  },

  'config/monedas': {
    title: 'Monedas y Tasas de Cambio — Guía Completa',
    icon: '💱',
    description: 'Configura las monedas que aceptas y las tasas de cambio. El sistema convierte automáticamente en el POS cuando el cliente paga en bolívares u otra moneda.',
    steps: [
      { title: 'Cómo funciona el sistema de monedas', desc: 'El sistema usa el dólar (USD) como moneda base para guardar todos los precios y costos. Cuando agregas otras monedas (bolívares, pesos, euros), el sistema las convierte automáticamente usando la tasa configurada.' },
      { title: 'Actualizar la tasa del BCV', desc: 'La tasa del BCV cambia todos los días hábiles. Para actualizar: ve a Monedas → Bolívar Venezolano → "Actualizar Tasa". Ingresa la tasa oficial del día publicada en el BCV (bcv.org.ve). También puedes activar la actualización automática para que el sistema la obtenga solo.' },
      { title: 'Indicador de tasa actualizada', desc: 'En el header del sistema hay un indicador de la tasa. Verde = actualizada hoy. Amarillo = desactualizada (1-3 días). Rojo = muy desactualizada (más de 3 días). Una tasa roja puede hacer que estés cobrando de más o de menos.' },
      { title: 'Activar pesos colombianos u otras divisas', desc: 'Si tienes clientes que pagan en pesos colombianos, euros, u otra moneda: haz clic en "Nueva Moneda", selecciona la moneda, ingresa la tasa de cambio respecto al dólar y actívala. Aparecerá como opción de pago en el POS.' },
      { title: 'El IGTF (3%)', desc: 'El Impuesto a las Grandes Transacciones Financieras aplica sobre pagos en divisas. Si tienes el IGTF activo en Configuración → Impuestos, el sistema lo suma automáticamente a los pagos en Zelle, transferencia en dólares y otras divisas.' },
    ],
    tips: [
      'Una tasa desactualizada de más de 3 días puede generar pérdidas reales si el bolívar se devaluó en ese tiempo.',
      'Configura la actualización automática para no tener que acordarte de hacerlo manualmente cada día.',
      'Si un cliente paga en pesos colombianos, ingresa la tasa COP/USD vigente ese día — varía constantemente.',
    ],
    actions: ['Actualizar tasa BCV', 'Activar tasa automática', 'Agregar nueva moneda', 'Desactivar moneda'],
  },

  'config/comisiones': {
    title: 'Sistema de Comisiones — Guía Completa',
    icon: '💰',
    description: 'Configura cómo se calculan y distribuyen las comisiones de vendedores y técnicos. Incluye reglas por categoría, por usuario y control de qué módulos generan comisiones.',
    steps: [
      { title: 'Activar el sistema de comisiones', desc: 'El interruptor principal "Sistema de Comisiones Activo" debe estar encendido. Si está apagado, ninguna venta genera comisiones aunque los usuarios tengan porcentajes configurados.' },
      { title: 'Elegir qué módulos generan comisiones', desc: 'MÓDULO POS: activa comisiones para las ventas del punto de venta. MÓDULO TALLER: activa comisiones para el técnico que repara y para el cajero que gestiona la orden. Puedes activar ambos de forma independiente.' },
      { title: 'Configurar el porcentaje por usuario', desc: 'Ve a "Tasas por Usuario". Para cada empleado, establece: "% Comisión Vendedor" — porcentaje sobre el total de cada venta POS que realice. "% Comisión Técnico" — porcentaje sobre los ítems de taller que le asignen. Un empleado puede tener ambos.' },
      { title: 'Crear reglas por categoría (avanzado)', desc: 'En "Reglas por Categoría" puedes hacer que una categoría de producto pague un porcentaje diferente al del vendedor. Por ejemplo: Celulares → 5%, Accesorios → 10%. Esta regla tiene prioridad sobre el porcentaje del usuario para ese producto específico.' },
      { title: 'Jerarquía de comisiones', desc: 'El sistema aplica en este orden: 1) Si el producto tiene una regla de categoría → aplica ese %. 2) Si no tiene regla de categoría → aplica el % del usuario. 3) Si el usuario tiene % en 0 → no hay comisión.' },
      { title: 'Comisión del cajero en taller', desc: 'Puedes configurar que el cajero que recibe y gestiona una orden de taller también reciba una comisión (independiente de la del técnico). Activa "Comisión al cajero en taller" y establece el porcentaje.' },
    ],
    tips: [
      'Las comisiones se generan automáticamente al cerrar una venta o cobrar una orden — no hay nada que hacer manualmente.',
      'Revisa semanalmente el reporte de comisiones para que el equipo no acumule mucho pendiente por pagar.',
      'Si cambias los porcentajes, afectan solo las ventas futuras — no las que ya ocurrieron.',
    ],
    actions: ['Activar sistema', 'Configurar módulos', 'Tasas por usuario', 'Reglas por categoría', 'Comisión cajero taller'],
  },

  'config/pagos': {
    title: 'Métodos de Pago — Guía Completa',
    icon: '💳',
    description: 'Define qué formas de cobro están disponibles en el POS. Solo aparecen los métodos que actives aquí.',
    steps: [
      { title: 'Activar o desactivar métodos', desc: 'Cada método tiene un interruptor. Activa solo los que realmente usas. Los métodos inactivos no aparecen como opción al cobrar en el POS — simplifica el proceso para el cajero.' },
      { title: 'Métodos disponibles', desc: 'Efectivo USD, Efectivo Bs (bolívares), Zelle, Transferencia Bancaria, Pago Móvil, Tarjeta de Débito, Tarjeta de Crédito, y Crédito Interno (para ventas a crédito con el cliente en sistema).' },
      { title: 'Configurar datos bancarios para transferencias', desc: 'Para los métodos Transferencia Bancaria, Pago Móvil y Zelle, agrega los datos bancarios del negocio: banco, número de cuenta/teléfono, nombre del titular, RIF. Estos datos se muestran al cajero en el POS cuando el cliente elige ese método.' },
      { title: 'Referencia obligatoria', desc: 'Para transferencias y pagos digitales, puedes marcar "Referencia Obligatoria". Así el cajero no puede confirmar la venta sin ingresar el número de confirmación de la transacción — evita cobros sin verificar.' },
    ],
    tips: [
      'Activa solo los métodos que realmente aceptas — menos opciones en el POS = menos errores del cajero.',
      'El método "Crédito Interno" solo funciona si el cliente tiene crédito configurado en su ficha.',
      'Para locales con alto volumen de Zelle, considera tener la referencia como obligatoria — así siempre tienes el comprobante.',
    ],
    actions: ['Activar / desactivar método', 'Agregar datos bancarios', 'Activar referencia obligatoria', 'Guardar cambios'],
  },

  'config/impuestos': {
    title: 'Impuestos — Guía Completa',
    icon: '📑',
    description: 'Configura IVA, IGTF y tasas especiales que aplican a tus ventas según la normativa venezolana.',
    steps: [
      { title: 'Configurar el IVA', desc: 'Activa el IVA e ingresa el porcentaje (actualmente 16% en Venezuela para la mayoría de productos). Con IVA activo, el precio de venta ya lleva el IVA incluido por defecto, o puedes configurar que se sume al total al momento de facturar.' },
      { title: 'Configurar el IGTF', desc: 'El Impuesto a las Grandes Transacciones Financieras (3%) aplica sobre pagos en divisas (Zelle, transferencias en USD, etc.) según la Ley vigente. Al activarlo, el sistema suma el 3% automáticamente cuando el cliente paga en moneda extranjera.' },
      { title: 'Exenciones', desc: 'Si tienes productos exentos de IVA (como algunos alimentos), márcalos como "Exento" en la ficha del producto. Al venderse, el sistema no aplica IVA aunque esté activo globalmente.' },
    ],
    tips: [
      'Consulta con tu contador si eres o no contribuyente de IVA antes de activarlo — tiene implicaciones legales.',
      'El IGTF es obligatorio para negocios que reciben pagos en divisas según la normativa venezolana vigente desde 2022.',
    ],
    actions: ['Activar IVA', 'Configurar IGTF', 'Ver exenciones', 'Guardar'],
  },

  'config/impresoras': {
    title: 'Impresoras Térmicas — Guía Completa',
    icon: '🖨️',
    description: 'Conecta y configura impresoras térmicas ESC/POS para imprimir tickets automáticamente al cobrar. Requiere el Hardware Bridge instalado en la PC con la impresora.',
    steps: [
      { title: 'Instalar el Hardware Bridge', desc: 'El Bridge es un programa pequeño que actúa de puente entre el sistema web y la impresora física. Descárgalo desde el enlace en esta pantalla. Instálalo en la PC que tiene la impresora USB conectada. Debe estar abierto (puede minimizarse en la barra de tareas) para que funcione la impresión.' },
      { title: 'Conectar la impresora', desc: 'Con el Bridge activo, haz clic en "Detectar Impresoras". El sistema busca impresoras conectadas. Selecciona la tuya de la lista. Si no aparece, verifica que el cable USB esté conectado y que el sistema operativo la reconoce.' },
      { title: 'Configurar el ancho del papel', desc: 'Las impresoras térmicas más comunes usan papel de 80mm (más ancho) o 58mm (más angosto). Selecciona el que corresponde a tu impresora. Un ancho incorrecto hace que el texto se corte o quede muy pequeño.' },
      { title: 'Prueba de impresión', desc: 'Haz clic en "Imprimir Prueba". Debe salir un ticket de prueba con los datos del negocio. Si no sale nada, el Bridge no está activo o la impresora está offline.' },
      { title: 'Impresión automática', desc: 'Cuando el Bridge está activo y la impresora conectada, el ticket se imprime automáticamente al confirmar cada venta en el POS. Si no imprime, verifica que el Bridge esté abierto en la PC.' },
    ],
    tips: [
      'El Bridge debe estar abierto siempre que el negocio esté operando. Puedes configurarlo para que arranque automáticamente con Windows.',
      'Si imprime pero el texto está cortado, el ancho del papel está mal configurado.',
      'Para imprimir desde múltiples PCs, el Bridge debe estar instalado y activo en cada una.',
    ],
    actions: ['Descargar Bridge', 'Detectar impresoras', 'Configurar ancho de papel', 'Prueba de impresión'],
  },

  'config/garantias': {
    title: 'Políticas de Garantía — Guía Completa',
    icon: '🛡️',
    description: 'Define los diferentes períodos de garantía que ofreces. Cada política puede asignarse a productos individuales.',
    steps: [
      { title: 'Crear una política de garantía', desc: 'Haz clic en "Nueva Política". Escribe el nombre (ej: "30 días", "3 meses", "Sin garantía") y la duración en días (30, 90, 0). Una descripción opcional puede detallar las condiciones.' },
      { title: 'Marcar como predeterminada', desc: 'La política marcada como predeterminada se asigna automáticamente a todos los productos nuevos que no tengan una específica. Ahorra tiempo si la mayoría de tus productos tienen el mismo período.' },
      { title: 'Asignar a productos', desc: 'La política se asigna desde la ficha de cada producto. Ve a Inventario → Productos → edita el producto → campo "Política de Garantía".' },
      { title: 'Cómo funciona en la venta', desc: 'Cuando vendes un producto con garantía, el sistema registra la fecha de venta y calcula la fecha de vencimiento. En Ventas → Garantías puedes buscar cualquier venta y ver si la garantía está vigente.' },
    ],
    tips: [
      'Crea al menos 3 políticas: sin garantía (para accesorios básicos), 30 días (para accesorios de mayor valor), 90 días (para equipos y reparaciones).',
      'Las garantías de reparaciones son especialmente importantes — documentan el trabajo realizado.',
    ],
    actions: ['Nueva Política', 'Marcar como predeterminada', 'Asignar a producto'],
  },

  'config/pos': {
    title: 'Estación POS — Guía Completa',
    icon: '🖥️',
    description: 'Opciones avanzadas del punto de venta para esta estación específica. Los cambios aplican solo a la PC donde los configures.',
    steps: [
      { title: 'Seleccionar el almacén activo', desc: 'Cada estación de caja puede vender de un almacén diferente. Si tienes un local con bodega: la caja del local vende del almacén "Local", y el sistema descuenta stock de ese almacén. Cambiar el almacén aquí afecta solo esta computadora.' },
      { title: 'Configurar el tema visual del POS', desc: 'Puedes cambiar el esquema de colores del POS. Útil si tienes múltiples cajas y quieres diferenciarlas visualmente, o simplemente por preferencia del cajero.' },
      { title: 'Modo pantalla completa', desc: 'Activa el modo fullscreen para que el POS ocupe toda la pantalla sin barra del navegador. Ideal para tablets o pantallas dedicadas al POS.' },
      { title: 'Impresora predeterminada', desc: 'Si tienes múltiples impresoras, selecciona cuál es la predeterminada para esta estación. La impresión al cobrar irá a esa impresora automáticamente.' },
    ],
    tips: [
      'Los cambios en esta sección solo afectan la computadora desde donde los haces.',
      'Si tienes 2 cajas en el mismo local, asegúrate de que ambas tengan el mismo almacén activo a menos que intencialmente quieras que vendan de almacenes separados.',
    ],
    actions: ['Cambiar almacén activo', 'Cambiar tema visual', 'Seleccionar impresora', 'Guardar'],
  },

  'config/auditoria': {
    title: 'Auditoría del Sistema — Guía Completa',
    icon: '🔍',
    description: 'Registro completo e inmutable de cada acción realizada en el sistema. Quién hizo qué, cuándo y desde dónde.',
    steps: [
      { title: 'Qué registra la auditoría', desc: 'CREACIÓN de registros (nuevos productos, ventas, clientes). EDICIÓN de registros (cambio de precio, modificación de datos). ELIMINACIÓN de registros. LOGIN y LOGOUT de usuarios. DESCUENTOS aplicados (con el usuario que los autorizó).' },
      { title: 'Filtrar por usuario', desc: 'Selecciona un empleado para ver solo sus acciones. Útil para investigar si hay sospechas de irregularidades.' },
      { title: 'Filtrar por tipo de acción', desc: 'Filtra por: Creación, Edición, Eliminación, Login, Descuento. Puedes combinar filtros.' },
      { title: 'Filtrar por fecha', desc: 'Selecciona un rango de fechas para investigar qué pasó en un período específico.' },
      { title: 'Ver el detalle de una acción', desc: 'Haz clic en cualquier registro de auditoría para ver el antes y después del cambio. Por ejemplo, si alguien editó un precio, verás el precio anterior y el nuevo.' },
    ],
    tips: [
      'La auditoría no se puede editar ni eliminar — es un registro permanente para tu protección.',
      'Revisa la auditoría si encuentras diferencias de inventario inexplicables o cambios de precios no autorizados.',
      'Cada descuento aplicado en el POS aparece aquí con el usuario admin que lo autorizó.',
    ],
    actions: ['Filtrar por usuario', 'Filtrar por tipo de acción', 'Filtrar por fecha', 'Ver detalle del cambio'],
  },

  /* ══════════════════════════════════════════════════
     CAJA
  ══════════════════════════════════════════════════ */
  cash: {
    title: 'Apertura y Cierre de Caja — Guía Completa',
    icon: '🏧',
    description: 'Control de turnos de caja. La apertura activa el POS para vender; el cierre registra el cuadre del día con el efectivo físico contado.',
    steps: [
      { title: 'Abrir el turno al inicio del día', desc: 'Haz clic en "Abrir Turno". Cuenta el dinero físico que hay en la caja (billetes y monedas) e ingrésalo como "Fondo Inicial". Este es el dinero base del que dispones para dar vuelto. Confirma. A partir de este momento el POS puede procesar ventas.' },
      { title: 'Registrar egresos durante el día', desc: 'Si necesitas sacar dinero de la caja para gastos (compra de insumos, propina al mensajero, etc.), registra cada salida con el botón "Registrar Egreso". Ingresa el monto y el motivo. Sin este registro, el cierre mostrará una diferencia negativa inexplicable.' },
      { title: 'Registrar entradas de efectivo externas', desc: 'Si alguien pone dinero en caja sin hacer una venta (ej: reposición del fondo), regístralo como "Ingreso Extra" para que el cuadre sea correcto.' },
      { title: 'Ver el resumen del turno actual', desc: 'Durante el día puedes ver en tiempo real: cuánto entró por ventas en efectivo, cuánto salió en egresos, y el saldo estimado que debería haber en caja.' },
      { title: 'Cerrar el turno al final del día', desc: 'Haz clic en "Cerrar Turno". El sistema muestra el cierre calculado (lo que debería haber según el sistema). Cuenta el dinero físico en caja — billetes por denominación — e ingresa el total real. La diferencia entre calculado y real se muestra.' },
      { title: 'Interpretar la diferencia de cierre', desc: 'Diferencia = CERO: cuadre perfecto. Diferencia POSITIVA (sobrante): hay más efectivo del que debería — puede ser un error de cobro (se cobró de más) o un ingreso no registrado. Diferencia NEGATIVA (faltante): hay menos efectivo — puede ser un gasto no registrado, un error de vuelto, o un problema más serio.' },
      { title: 'Imprimir el Z-Report', desc: 'Al cerrar, imprime el Z-Report. Es el comprobante del turno con: ventas por método de pago, egresos del día, fondo inicial, efectivo esperado y diferencia. Guárdalo como registro diario.' },
    ],
    tips: [
      'Cierra la caja todos los días aunque no hayas vendido nada — así los reportes son precisos y cada turno queda bien delimitado.',
      'Un faltante pequeño y ocasional puede ser un error de vuelto. Un faltante recurrente es una señal de alerta.',
      'Registra SIEMPRE los egresos — es el error más común que hace que los cuadres salgan mal.',
      'El fondo inicial debe ser suficiente para dar vuelto durante el día. Si vendes mucho en efectivo, necesitas un fondo mayor.',
    ],
    actions: ['Abrir turno (ingresar fondo inicial)', 'Registrar egreso', 'Registrar ingreso extra', 'Ver resumen del turno', 'Cerrar turno', 'Contar efectivo físico', 'Imprimir Z-Report'],
  },
};
