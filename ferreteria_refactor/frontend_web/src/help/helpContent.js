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
    title: 'Cotizaciones - Seguimiento comercial',
    icon: 'CT',
    description: 'Propuestas formales para clientes. No descuentan stock hasta convertirse en venta desde POS.',
    steps: [
      { title: '1. Crear propuesta', desc: 'Usa Nueva Cotizacion cuando el cliente quiere precio formal pero aun no va a pagar. Selecciona cliente, productos, cantidades, precios y vigencia.' },
      { title: '2. Revisar pendientes', desc: 'Las pendientes necesitan seguimiento. Filtra por pendientes para llamar o escribir al cliente antes de que se enfrie la venta.' },
      { title: '3. Compartir o imprimir', desc: 'Entrega la cotizacion por PDF, impresion o WhatsApp si aplica. Revisa que los precios y vigencia sean claros.' },
      { title: '4. Facturar cuando aprueben', desc: 'Facturar envia la cotizacion al POS. Alli se confirma stock, seriales si aplica y metodo de pago.' },
      { title: '5. No duplicar sin revisar', desc: 'Si el cliente vuelve, busca la cotizacion existente antes de crear otra. Duplicados confunden seguimiento y conversion.' },
    ],
    tips: [
      'Cotizacion pendiente no descuenta inventario.',
      'Si hay muchas pendientes, el problema puede ser seguimiento o precios.',
      'Al facturar, revisa stock actual: pudo cambiar desde que se creo la propuesta.',
      'Una cotizacion vencida debe actualizarse antes de vender si cambiaron precios o tasa.',
    ],
    actions: ['Nueva cotizacion', 'Filtrar pendientes', 'Buscar cliente', 'Imprimir/enviar', 'Facturar', 'Duplicar'],
  },

  'sales/clientes': {
    title: 'Clientes - Datos, credito e historial',
    icon: 'CL',
    description: 'Directorio de clientes para ventas, cotizaciones, creditos, garantias, devoluciones y precios especiales.',
    steps: [
      { title: '1. Buscar antes de crear', desc: 'Busca por nombre, documento o telefono. Evita duplicados porque dividen historial, creditos y garantias.' },
      { title: '2. Crear datos limpios', desc: 'Registra nombre, documento, telefono y direccion si el negocio lo exige. Mientras mas claro, menos errores en POS y CxC.' },
      { title: '3. Configurar credito', desc: 'Activa credito solo si el cliente tiene autorizacion. Define limite y condiciones para que POS pueda validar.' },
      { title: '4. Asignar lista de precios', desc: 'Si tiene precio especial, asigna la lista correcta. El POS aplicara esa lista cuando se seleccione el cliente.' },
      { title: '5. Revisar historial', desc: 'Usa historial para ventas, garantias, cotizaciones y deudas antes de aprobar descuentos o credito adicional.' },
    ],
    tips: [
      'Cliente duplicado puede hacer que una deuda parezca desaparecida.',
      'No compartas credito entre clientes parecidos sin confirmar documento.',
      'Desactiva en vez de eliminar si quieres conservar historial.',
      'Telefono correcto ayuda a seguimiento, garantias y cobranza.',
    ],
    actions: ['Buscar cliente', 'Nuevo cliente', 'Editar datos', 'Configurar credito', 'Asignar lista', 'Ver historial'],
  },

  'sales/devoluciones': {
    title: 'Devoluciones - Reembolso o canje',
    icon: 'DV',
    description: 'Procesa devoluciones desde una venta original, restaurando stock y dejando trazabilidad de caja, inventario y comisiones.',
    steps: [
      { title: '1. Buscar venta original', desc: 'Usa factura, cliente o documento. No hagas devoluciones manuales si existe una venta que puede trazarse.' },
      { title: '2. Seleccionar items', desc: 'Marca cantidades a devolver. Si el producto maneja IMEI, selecciona el serial exacto vendido.' },
      { title: '3. Elegir resolucion', desc: 'Reembolso devuelve dinero; canje usa el valor devuelto para entregar otro producto. Revisa diferencia final.' },
      { title: '4. Validar caja y moneda', desc: 'Si devuelves efectivo, confirma moneda y saldo de caja. Pagos digitales requieren respaldo/referencia.' },
      { title: '5. Registrar motivo', desc: 'El motivo ayuda a detectar patrones: defecto, error de venta, cambio del cliente o garantia.' },
      { title: '6. Confirmar con resumen', desc: 'Antes de confirmar revisa cantidades, seriales, monto, moneda, motivo y resolucion.' },
    ],
    tips: [
      'La devolucion afecta reportes en la fecha en que se registra.',
      'En canje, si el reemplazo cuesta mas se cobra diferencia; si cuesta menos puede quedar dinero a devolver.',
      'No devuelvas un IMEI diferente al vendido originalmente.',
      'Si caja no tiene saldo para reembolso, resuelve antes de confirmar.',
    ],
    actions: ['Buscar venta', 'Seleccionar items', 'Seleccionar IMEI', 'Elegir reembolso/canje', 'Registrar motivo', 'Confirmar'],
  },

  'sales/garantias': {
    title: 'Garantias - Validacion por venta y serial',
    icon: 'GT',
    description: 'Verifica si una unidad vendida tiene cobertura vigente y registra la resolucion con respaldo.',
    steps: [
      { title: '1. Buscar unidad o venta', desc: 'Para productos serializados, busca por IMEI/serial. Para productos normales, usa factura o cliente si aplica.' },
      { title: '2. Validar cobertura', desc: 'Confirma producto, cliente, fecha de venta, politica aplicada y vencimiento antes de aceptar.' },
      { title: '3. Documentar diagnostico', desc: 'Escribe motivo y condicion. Un diagnostico claro protege al negocio si el cliente reclama despues.' },
      { title: '4. Elegir accion', desc: 'Segun politica: reparar, reemplazar, reembolsar, rechazar o enviar a revision.' },
      { title: '5. Confirmar impacto', desc: 'La resolucion puede afectar inventario, caja, comisiones o taller. Revisa el resumen antes de guardar.' },
    ],
    tips: [
      'No proceses garantia por un equipo que no coincide con el serial vendido.',
      'Garantia vencida puede pasar a orden de servicio pagada si el negocio lo permite.',
      'Fotos/notas del diagnostico ayudan a evitar disputas.',
      'Reemplazos deben tener stock disponible y serial correcto si aplica.',
    ],
    actions: ['Buscar serial', 'Validar cobertura', 'Registrar diagnostico', 'Elegir accion', 'Confirmar garantia'],
  },

  'sales/creditos': {
    title: 'Creditos - Cuentas por cobrar',
    icon: 'CX',
    description: 'Control de facturas pendientes, vencimientos, abonos, saldo por cliente y riesgo de mora.',
    steps: [
      { title: '1. Leer resumen', desc: 'Revisa saldo pendiente, vencido y cobrado. Prioriza vencidos y montos altos.' },
      { title: '2. Filtrar cartera', desc: 'Filtra por pendiente, vencido o pagado. Busca cliente/factura antes de registrar abonos.' },
      { title: '3. Ver detalle', desc: 'Abre la factura o cliente para revisar fecha, monto original, abonos y saldo restante.' },
      { title: '4. Registrar abono', desc: 'Ingresa monto, moneda, metodo, tasa y referencia si aplica. El pago debe aplicarse al cliente/factura correcta.' },
      { title: '5. Usar pago masivo con cuidado', desc: 'Para varias facturas del mismo cliente, revisa total seleccionado antes de confirmar.' },
      { title: '6. Revisar reporte', desc: 'Despues de abonar, Reportes > Creditos debe reflejar el saldo actualizado.' },
    ],
    tips: [
      'Saldo no baja: el abono puede haberse aplicado al cliente/factura incorrecta.',
      'Cliente duplicado divide la deuda y complica cobranza.',
      'No permitas nuevas ventas a credito si supera limite o tiene mora critica.',
      'Guarda referencia en pagos digitales para poder auditar.',
    ],
    actions: ['Filtrar vencidos', 'Buscar cliente', 'Ver detalle', 'Registrar abono', 'Pago masivo', 'Exportar cartera'],
  },

  /* ══════════════════════════════════════════════════
     CENTRO DE INVENTARIO
  ══════════════════════════════════════════════════ */
  'inventory/productos': {
    title: 'Productos - Guia operativa',
    icon: 'PR',
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
    icon: 'CT',
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
    icon: 'KD',
    description: 'Historial cronologico de entradas, salidas, ventas, compras, traslados, devoluciones y ajustes. Es la primera pantalla para investigar diferencias de stock.',
    steps: [
      { title: '1. Ubicar producto y fecha', desc: 'Busca por producto, SKU, IMEI o descripcion. Usa un rango cercano al evento: venta, compra, traslado, devolucion o conteo fisico.' },
      { title: '2. Leer tipo y direccion', desc: 'Entrada suma, salida descuenta. Ventas, compras, traslados, devoluciones y ajustes deben verse con nombres entendibles para el cliente.' },
      { title: '3. Revisar saldo posterior', desc: 'Cada movimiento debe dejar un saldo resultante. Si el saldo salta de forma rara, compara contra el movimiento anterior.' },
      { title: '4. Identificar responsable', desc: 'Revisa usuario, fecha y descripcion. Un ajuste sin responsable o motivo claro no sirve para auditoria.' },
      { title: '5. Cruzar con Seriales si aplica', desc: 'En productos con IMEI, Kardex explica cantidad y Seriales explica unidad exacta. Ambos deben cuadrar antes de corregir.' },
      { title: '6. Ajustar solo al final', desc: 'El ajuste manual es para conteo fisico, merma, dano, robo, error de carga o conciliacion. Documenta el motivo en lenguaje claro.' },
    ],
    tips: [
      'No ajustes para tapar un traslado o compra mal cargada; corrige la causa si existe flujo para hacerlo.',
      'Si el producto maneja IMEI, compara disponibles, vendidos y en transito antes de tocar stock.',
      'Para auditorias por caja, usa el mismo rango horario del cierre.',
      'Si ves movimientos en ingles o codigos tecnicos, hay que traducirlos antes de mostrarlos al cliente.',
    ],
    actions: ['Buscar producto/IMEI', 'Filtrar tipo', 'Filtrar fecha', 'Revisar saldo', 'Nuevo ajuste manual', 'Cruzar con Seriales'],
  },

  'inventory/traslados': {
    title: 'Traslados - Movimiento entre almacenes o empresas',
    icon: 'TR',
    description: 'Mueve inventario de forma trazable. Puede ser interno entre almacenes o externo exportando/importando un archivo entre empresas.',
    steps: [
      { title: '1. Elegir flujo correcto', desc: 'Interno mueve dentro del mismo tenant. Exportar descuenta del origen y genera archivo. Importar recibe el archivo y suma en destino.' },
      { title: '2. Validar origen y destino', desc: 'Confirma de donde sale y a donde entra. Un origen equivocado descuenta el almacen incorrecto.' },
      { title: '3. Revisar unidades totales', desc: 'El resumen debe distinguir modelos de unidades. Si mandas 5 del mismo modelo, son 5 unidades aunque sea 1 modelo.' },
      { title: '4. Seleccionar IMEIs exactos', desc: 'Para productos serializados no basta cantidad. Escanea o selecciona cada IMEI que viaja.' },
      { title: '5. Guardar archivo externo', desc: 'En exportaciones, conserva el archivo hasta confirmar que el destino lo importo. Sin importacion, el origen queda descontado y el destino no suma.' },
      { title: '6. Auditar despues', desc: 'Revisa Kardex para salida/entrada y Seriales para unidades en transito o disponibles.' },
    ],
    tips: [
      'Exportar sin importar no es error: es stock descontado en origen y pendiente de recibir en destino.',
      'Si un IMEI no aparece, puede estar vendido, en transito, no disponible o en otro almacen.',
      'No uses ajuste manual para simular un traslado; pierdes trazabilidad.',
      'Antes de confirmar, valida unidades totales, no solo modelos distintos.',
    ],
    actions: ['Traslado interno', 'Exportar archivo', 'Importar archivo', 'Ver unidades totales', 'Auditar IMEI', 'Revisar Kardex'],
  },

  'inventory/almacenes': {
    title: 'Almacenes - Ubicaciones de stock',
    icon: 'AL',
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
    icon: 'IM',
    description: 'Controla cada unidad individual de productos serializados: disponible, vendida, devuelta, reservada o en transito.',
    steps: [
      { title: '1. Confirmar flag serial', desc: 'El producto debe tener activo IMEI/Serial en su ficha. Si no, el sistema lo tratara como stock normal.' },
      { title: '2. Registrar al recibir', desc: 'Compra, recepcion IMEI o importacion deben crear las unidades exactas. Cantidad y seriales deben coincidir.' },
      { title: '3. Leer estados', desc: 'Disponible se vende o traslada. Vendido ya salio. En transito fue exportado o movido. Otros estados requieren revisar historial.' },
      { title: '4. Comparar stock vs unidades', desc: 'Si el producto dice 12 pero cuentas 11, revisa disponibles, vendidos, devueltos y en transito antes de ajustar.' },
      { title: '5. Hacer conteo fisico', desc: 'Escanea o pega los IMEIs fisicos para detectar faltantes, sobrantes y coincidencias.' },
      { title: '6. Usar en garantias/devoluciones', desc: 'El serial vendido confirma que el equipo que vuelve es el mismo que salio, evitando reclamos cruzados.' },
    ],
    tips: [
      'No inventes IMEIs para completar una compra; destruye la trazabilidad.',
      'Un IMEI en transito suele venir de una exportacion aun no importada por destino.',
      'No corrijas con ajuste general si el problema es una unidad especifica.',
      'El flujo recomendado ya no depende de IMEI.info; el control debe estar dentro del sistema.',
    ],
    actions: ['Buscar serial', 'Ver disponibles', 'Ver en transito', 'Conteo fisico', 'Recepcion IMEI', 'Cruzar con Kardex'],
  },

  /* ══════════════════════════════════════════════════
     REPORTES
  ══════════════════════════════════════════════════ */
  'reports/resumen': {
    title: 'Resumen de Reportes - Lectura ejecutiva',
    icon: 'RP',
    description: 'Vista para entender ventas, ganancia, pagos, clientes y productos del periodo antes de entrar al detalle operativo.',
    steps: [
      { title: '1. Define el periodo', desc: 'Usa presets para lectura rapida o fechas manuales para auditoria. Todos los indicadores dependen de ese rango.' },
      { title: '2. Lee ingresos vs ganancia', desc: 'Ingresos muestran venta/cobro segun el reporte. Ganancia depende de costos correctos en productos y compras.' },
      { title: '3. Revisa tendencias', desc: 'Si ventas suben pero ganancia baja, revisa costos, descuentos, devoluciones o productos con margen bajo.' },
      { title: '4. Cruza metodos de pago', desc: 'Sirve para entender cuanto fue efectivo, punto, transferencia, credito o pago mixto antes de comparar con caja.' },
      { title: '5. Baja al detalle', desc: 'Cuando un numero se vea raro, abre Ventas, Caja, Inventario, Creditos o Proveedores. El resumen indica donde investigar, no reemplaza la auditoria.' },
      { title: '6. Exporta respaldo', desc: 'Exporta si necesitas enviar al contador, guardar cierre mensual o comparar con administracion.' },
    ],
    tips: [
      'Ventas en cero: revisa rango, caja abierta y ventas anuladas.',
      'Ganancia rara: casi siempre apunta a costos cero o compras con costo incorrecto.',
      'Compara periodos completos; no compares un mes completo contra uno parcial.',
      'Si caja no cuadra, abre Reporte de Caja y luego Ventas con el mismo rango.',
    ],
    actions: ['Cambiar periodo', 'Actualizar', 'Exportar', 'Ir a ventas', 'Ir a caja', 'Ir a inventario'],
  },

  'reports/ventas': {
    title: 'Reporte de Ventas - Auditoria comercial',
    icon: 'VT',
    description: 'Detalle de ventas por fecha, cliente, vendedor, producto, metodo de pago, descuentos, anulaciones y devoluciones.',
    steps: [
      { title: '1. Filtra por fecha exacta', desc: 'Para cierre diario usa el mismo dia o turno. Para investigar una venta, usa el rango donde ocurrio.' },
      { title: '2. Busca la venta puntual', desc: 'Usa factura, cliente, vendedor, producto o metodo de pago para ubicar la operacion.' },
      { title: '3. Revisa estados especiales', desc: 'Anulaciones, devoluciones, descuentos, pagos mixtos y ventas a credito explican diferencias contra caja.' },
      { title: '4. Abre el detalle', desc: 'El detalle debe mostrar productos, cantidades, precios, descuentos, pagos, seriales si aplica y usuario responsable.' },
      { title: '5. Cruza con caja', desc: 'Si no cuadra con efectivo, compara metodos de pago y cierre de caja del mismo rango y usuario/caja.' },
      { title: '6. Cruza con Kardex', desc: 'Si el problema es stock, revisa Kardex y Seriales para confirmar descuento de unidades.' },
    ],
    tips: [
      'Venta a credito puede aparecer como venta aunque el dinero no haya entrado a caja.',
      'Devoluciones afectan ventas netas por fecha de devolucion, no necesariamente por fecha original.',
      'Si falta una venta, confirma tenant, usuario, caja, estado y rango horario.',
    ],
    actions: ['Filtrar fecha', 'Buscar factura', 'Ver detalle', 'Comparar caja', 'Revisar Kardex', 'Exportar Excel'],
  },

  'reports/caja': {
    title: 'Reporte de Caja - Cuadre de dinero',
    icon: 'CJ',
    description: 'Control de aperturas, cierres, ingresos, egresos, avances, metodos de pago y diferencias entre sistema y dinero contado.',
    steps: [
      { title: '1. Elige turno correcto', desc: 'Analiza por caja, cajero y rango horario. No mezcles turnos si hubo mas de una caja abierta.' },
      { title: '2. Compara esperado vs contado', desc: 'Diferencia positiva es sobrante; negativa es faltante. Revisa efectivo separado de pagos digitales.' },
      { title: '3. Revisa egresos y avances', desc: 'Todo egreso debe tener motivo. Avances deben tener referencia porque combinan salida de efectivo y entrada bancaria.' },
      { title: '4. Cruza metodos de pago', desc: 'Efectivo se cuenta fisicamente; punto, transferencia, pago movil y Zelle se validan con referencias externas.' },
      { title: '5. Cruza con ventas', desc: 'Usa el mismo rango en Reporte de Ventas para detectar anulaciones, devoluciones, pagos mixtos y creditos.' },
      { title: '6. Exporta cierre', desc: 'Guarda respaldo de cierres diarios para administracion o auditoria.' },
    ],
    tips: [
      'Faltante: revisa egresos no registrados, vuelto y ventas cobradas en metodo incorrecto.',
      'Sobrante: revisa ingresos no registrados o cobros recibidos por encima del total.',
      'Ventas a credito no son efectivo en caja.',
      'Si imprime o vende desde caja equivocada, revisa estacion POS y gestion de cajas.',
    ],
    actions: ['Filtrar turno', 'Ver cierre', 'Revisar egresos', 'Comparar ventas', 'Exportar', 'Abrir gestion de cajas'],
  },

  'reports/creditos': {
    title: 'Reporte de Creditos - Cuentas por cobrar',
    icon: 'CX',
    description: 'Seguimiento de clientes que deben dinero, antiguedad de deuda, abonos, vencimientos y saldos pendientes.',
    steps: [
      { title: '1. Lee saldo total', desc: 'Muestra cuanto falta por cobrar. Si sube rapido, revisa ventas a credito recientes y limites de clientes.' },
      { title: '2. Prioriza vencidos', desc: 'Gestiona primero montos altos, facturas vencidas y clientes con muchos dias de atraso.' },
      { title: '3. Abre detalle por cliente', desc: 'Verifica facturas, abonos, saldo restante, fecha de vencimiento y responsable de la venta.' },
      { title: '4. Registra abonos correctamente', desc: 'Los pagos deben aplicarse al cliente/factura correcta para bajar saldo y dejar historial.' },
      { title: '5. Exporta cartera', desc: 'Exporta para llamadas, WhatsApp de cobranza o revision administrativa.' },
    ],
    tips: [
      'Saldo no baja: revisa si el pago se aplico al cliente o factura correcta.',
      'Cliente duplicado divide historial y deuda.',
      'Bloquea o reduce credito si el cliente supera limite o acumula mora.',
    ],
    actions: ['Ver vencidos', 'Ver cliente', 'Registrar abono', 'Revisar limite', 'Exportar cartera'],
  },

  'reports/proveedores': {
    title: 'Reporte de Proveedores - Cuentas por pagar',
    icon: 'PV',
    description: 'Controla compras a credito, pagos parciales, facturas pendientes, vencimientos y deuda actual por proveedor.',
    steps: [
      { title: '1. Revisa deuda por proveedor', desc: 'La deuda debe salir de compras a credito menos pagos registrados. Si se ve alta, abre el detalle.' },
      { title: '2. Abre compras pendientes', desc: 'Identifica facturas vencidas, parciales, sin pago o duplicadas.' },
      { title: '3. Registra pagos', desc: 'Cada pago debe aplicarse a la compra/proveedor correcto. Evita cambiar saldos sin historial.' },
      { title: '4. Cruza con compras', desc: 'Si no cuadra, revisa facturas duplicadas, compras marcadas como credito y pagos omitidos.' },
      { title: '5. Exporta saldos', desc: 'Usalo para planificar pagos, negociar con proveedores o entregar a administracion.' },
    ],
    tips: [
      'Proveedor duplicado divide deuda y confunde reportes.',
      'Factura repetida infla cuentas por pagar.',
      'Si pagaste contado pero aparece deuda, revisa condicion de pago de la compra.',
    ],
    actions: ['Ver pendientes', 'Registrar pago', 'Ver proveedor', 'Revisar compras', 'Exportar saldos'],
  },

  'reports/inventario': {
    title: 'Reporte de Inventario - Valoracion y riesgo',
    icon: 'IN',
    description: 'Valor actual del inventario por costo, precio de venta, margen, stock bajo, productos sin movimiento y riesgo de capital detenido.',
    steps: [
      { title: '1. Lee costo total', desc: 'Representa dinero invertido en stock. Si se ve bajo o raro, revisa productos con costo cero.' },
      { title: '2. Lee valor de venta', desc: 'Es el potencial de facturacion si vendes el stock al precio configurado. Depende de precios correctos.' },
      { title: '3. Detecta bajo stock', desc: 'Productos bajo minimo requieren compra o traslado desde otro almacen.' },
      { title: '4. Detecta capital detenido', desc: 'Productos sin movimiento inmovilizan dinero. Evalua promocion, liquidacion o no reponer.' },
      { title: '5. Cruza con Kardex', desc: 'Si una cantidad no cuadra, investiga movimientos antes de ajustar.' },
      { title: '6. Cruza IMEI si aplica', desc: 'En productos serializados, compara stock numerico contra seriales disponibles, vendidos y en transito.' },
    ],
    tips: [
      'Costo cero distorsiona margen, ganancia real y valoracion.',
      'Stock alto sin ventas es riesgo de capital parado.',
      'En productos con IMEI, no ajustes sin revisar la unidad exacta.',
    ],
    actions: ['Ver valoracion', 'Filtrar bajo stock', 'Revisar Kardex', 'Auditar seriales', 'Exportar inventario'],
  },

  'reports/comisiones': {
    title: 'Comisiones - Liquidacion del equipo',
    icon: 'CM',
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
    title: 'Servicios / Taller - Tablero operativo',
    icon: 'SV',
    description: 'Controla las ordenes de servicio desde la recepcion hasta la entrega: cliente, equipo, estado, diagnostico, repuestos, abonos y cobro final.',
    steps: [
      { title: '1. Crear una orden', desc: 'Usa Nueva. Primero identifica al cliente, luego registra equipo, marca, modelo, falla reportada, serial/IMEI si aplica y accesorios recibidos. Esa informacion protege al negocio si luego hay reclamos.' },
      { title: '2. Filtrar por estado', desc: 'Los filtros ayudan a trabajar por cola: Recibido para equipos nuevos, Diagnostico para revisar, Reparando para trabajos activos, Listo para equipos por entregar y Entregado para historial reciente.' },
      { title: '3. Abrir el detalle correcto', desc: 'Selecciona una orden de la lista. En el panel derecho veras cliente, equipo, falla, estado, repuestos/mano de obra, pagos y diagnostico.' },
      { title: '4. Avanzar estados con disciplina', desc: 'Recibido significa que el equipo entro. Diagnostico significa que se esta evaluando. Reparando significa trabajo activo. Listo significa que puede cobrarse o entregarse. Entregado cierra el ciclo.' },
      { title: '5. Registrar repuestos y mano de obra', desc: 'Dentro del detalle agrega repuestos desde inventario o servicios manuales. Los repuestos deben tener cantidad y precio; la mano de obra debe tener descripcion, precio y tecnico si corresponde.' },
      { title: '6. Registrar abonos', desc: 'Si el cliente deja una senal, registrala en Pagos. El sistema muestra total, abonado y pendiente para evitar cobrar dos veces o entregar con saldo abierto.' },
      { title: '7. Cobrar y entregar', desc: 'Cuando la orden este lista, cobra el pendiente. Si se cobra desde el flujo de entrega, queda vinculado a la orden y el historial del cliente.' },
      { title: '8. Usar plantillas', desc: 'Plantillas sirve para servicios repetidos: cambio de pantalla, mantenimiento, diagnostico, desbloqueo. Evita escribir los mismos items cada vez.' },
    ],
    tips: [
      'No entregues una orden con pendiente si el negocio no permite credito para ese cliente.',
      'Si un repuesto sale del inventario, cargalo como repuesto, no como servicio manual.',
      'Si una orden se queda muchos dias en el mismo estado, actualiza diagnostico o contacta al cliente.',
      'Imprime o comparte el comprobante de recepcion cuando el cliente deja el equipo.',
    ],
    actions: ['Nueva orden', 'Filtrar estado', 'Abrir detalle', 'Agregar item', 'Registrar abono', 'Cobrar/entregar', 'Plantillas'],
  },

  'services/order-detail': {
    title: 'Detalle de orden de servicio',
    icon: 'OD',
    description: 'Ficha completa de una orden: estado, diagnostico, repuestos, mano de obra, pagos, saldo pendiente, impresion y entrega.',
    steps: [
      { title: '1. Revisar cabecera', desc: 'Confirma numero de orden, cliente, telefono, equipo, serial/IMEI y falla reportada antes de modificar o cobrar.' },
      { title: '2. Cambiar estado', desc: 'Usa la barra de estados para reflejar el avance real. Evita saltar a Listo si aun no se termino el trabajo o falta autorizacion del cliente.' },
      { title: '3. Agregar repuestos', desc: 'En Repuestos y Mano de Obra usa Agregar, busca el producto de inventario y confirma cantidad. Asi el stock queda trazado contra la orden.' },
      { title: '4. Agregar mano de obra', desc: 'Si no es un producto fisico, usa Servicio Manual. Escribe una descripcion clara, precio y tecnico responsable para que el cobro y comisiones sean entendibles.' },
      { title: '5. Revisar total', desc: 'Cada item suma al total de la orden. Antes de cobrar, confirma que no falten repuestos, servicios o descuentos acordados.' },
      { title: '6. Registrar pagos parciales', desc: 'En Pagos registra abonos con monto, metodo y referencia. El pendiente se recalcula automaticamente.' },
      { title: '7. Guardar diagnostico', desc: 'Usa Diagnostico y Notas para documentar hallazgos, autorizaciones y observaciones. Guarda despues de editar.' },
      { title: '8. Imprimir comprobante', desc: 'El boton de impresora genera el ticket de orden. Sirve como respaldo al recibir o entregar el equipo.' },
      { title: '9. Cobrar cierre', desc: 'Al cerrar, cobra solo el pendiente. Si el cliente ya abono, verifica el historial de pagos antes de confirmar.' },
    ],
    tips: [
      'Repuesto con stock: cargalo desde inventario para que el Kardex quede correcto.',
      'Mano de obra: cargala como servicio manual para no afectar inventario.',
      'Saldo pendiente: no cierres como entregado si falta cobrar, salvo que el negocio lo autorice.',
      'Diagnostico claro reduce reclamos y ayuda a otro tecnico a continuar el trabajo.',
    ],
    actions: ['Cambiar estado', 'Agregar repuesto', 'Agregar servicio', 'Registrar abono', 'Guardar diagnostico', 'Imprimir', 'Cobrar cierre'],
  },

  purchases: {
    title: 'Compras - Recepcion y costos',
    icon: 'CP',
    description: 'Registra mercancia recibida, actualiza inventario, controla costos reales, captura IMEIs en la misma recepcion y crea cuentas por pagar cuando corresponde.',
    steps: [
      { title: '1. Elegir proveedor', desc: 'Toda compra debe tener proveedor real. Esto permite ver deuda, historial, pagos y reclamos sin mezclar facturas.' },
      { title: '2. Agregar productos', desc: 'Busca por nombre, SKU o codigo. Si no existe, crea el producto al vuelo solo despues de confirmar que no es un duplicado.' },
      { title: '3. Revisar cantidad y costo', desc: 'La cantidad suma stock. El costo alimenta ganancia real, Kardex y reportes. Costo en cero debe ser una excepcion documentada.' },
      { title: '4. Capturar IMEIs si aplica', desc: 'Para telefonos o equipos serializados, captura los IMEIs dentro de la compra. No los ingreses despues desde otra pantalla para evitar doble stock.' },
      { title: '5. Validar seriales', desc: 'La cantidad de la linea debe coincidir con los IMEIs validos. El sistema debe bloquear duplicados, vacios o seriales ya existentes.' },
      { title: '6. Definir contado o credito', desc: 'Contado no deja deuda. Credito crea cuenta por pagar al proveedor. Revisa vencimiento, referencia y monto pendiente.' },
      { title: '7. Confirmar y revisar detalle', desc: 'Al procesar sube stock una sola vez, registra Kardex y guarda seriales si aplica. Abre el detalle si el total, proveedor o costo no cuadran.' },
      { title: '8. Registrar pagos posteriores', desc: 'Si quedo a credito, registra abonos desde el detalle o reportes. El saldo del proveedor debe bajar con cada pago.' },
    ],
    tips: [
      'Proveedor generico ensucia reportes de deuda y pagos.',
      'Costo cero afecta directamente la ganancia real del dashboard.',
      'Compra con IMEI: cantidad 5 requiere 5 IMEIs validos antes de procesar.',
      'No cargues los mismos IMEIs luego desde Seriales; la compra ya los registra.',
      'Factura duplicada: revisa proveedor, numero y fecha antes de confirmar.',
      'Si marcas contado por error, la deuda del proveedor no aparecera.',
    ],
    actions: ['Nueva Compra', 'Seleccionar proveedor', 'Agregar producto', 'Crear producto', 'Capturar IMEI', 'Marcar contado/credito', 'Registrar pago', 'Ver detalle'],
  },

  suppliers: {
    title: 'Proveedores - Contactos y saldos',
    icon: 'PV',
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
    title: 'General - Identidad del negocio',
    icon: 'GN',
    description: 'Datos visibles en tickets, cotizaciones, reportes, login y documentos comerciales. Es la identidad que ve el cliente.',
    steps: [
      { title: '1. Datos principales', desc: 'Actualiza nombre comercial, RIF, direccion, telefono y eslogan. Estos datos salen en documentos y pantallas del negocio.' },
      { title: '2. Logo', desc: 'Carga un logo limpio y cuadrado. Despues de cambiarlo, revisa login y ticket para confirmar que no se vea cortado.' },
      { title: '3. Horario y zona', desc: 'La zona horaria afecta cierres, tickets, auditoria y reportes. Si las horas salen raras, empieza por aqui.' },
      { title: '4. Guardar y validar', desc: 'Guarda y haz una prueba visual: abre POS, imprime un ticket o una cotizacion y confirma datos reales.' },
    ],
    tips: [
      'No cambies nombre/RIF sin validar facturacion y documentos fiscales.',
      'Logo pesado o con fondo raro puede verse mal en tickets.',
      'Si el login muestra otra marca, revisa esta pantalla y refresca.',
    ],
    actions: ['Editar datos', 'Subir logo', 'Guardar', 'Probar ticket'],
  },

  'config/usuarios': {
    title: 'Usuarios - Acceso y permisos',
    icon: 'US',
    description: 'Crea cuentas individuales para saber quien vende, cobra, edita, autoriza y cambia informacion sensible.',
    steps: [
      { title: '1. Crear cuenta propia', desc: 'Cada empleado debe entrar con su usuario. Evita compartir admin porque despues no se puede auditar bien.' },
      { title: '2. Elegir rol', desc: 'El rol define que puede ver y hacer. Cajeros no deberian administrar configuracion ni reportes sensibles.' },
      { title: '3. PIN y contrasena', desc: 'Configura PIN para uso rapido en POS y cambia contrasena si el empleado olvida acceso o sale del negocio.' },
      { title: '4. Comisiones', desc: 'Si el usuario vende o repara, revisa porcentajes. Si esta en cero no generara comision.' },
      { title: '5. Desactivar, no borrar', desc: 'Al retirar personal, desactiva la cuenta para conservar ventas, caja, auditoria y comisiones historicas.' },
    ],
    tips: [
      'Un usuario por persona mejora auditoria y control de caja.',
      'Si un cajero ve demasiado, revisa rol/permisos antes de seguir operando.',
      'Despues de crear usuarios, prueba login con una cuenta no admin.',
    ],
    actions: ['Nuevo usuario', 'Configurar PIN', 'Cambiar rol', 'Revisar comisiones', 'Desactivar'],
  },

  'config/monedas': {
    title: 'Monedas - Tasa y conversion',
    icon: 'BS',
    description: 'Controla la tasa que usa el POS para mostrar precios en Bs, cobrar en distintas monedas y calcular reportes.',
    steps: [
      { title: '1. Revisar moneda base', desc: 'Los precios principales se guardan en USD. Las demas monedas se calculan desde su tasa activa.' },
      { title: '2. Actualizar tasa', desc: 'Carga la tasa del dia o valida la automatica. Si la tasa esta vieja, POS y reportes en Bs se veran incorrectos.' },
      { title: '3. Activar monedas usadas', desc: 'Manten activas solo las monedas que aceptas realmente. Menos opciones reducen errores del cajero.' },
      { title: '4. Probar en POS', desc: 'Despues de actualizar, abre POS y confirma que las tarjetas, carrito y modal de pago muestren Bs correctamente.' },
    ],
    tips: [
      'Si los precios en Bs no aparecen, revisa moneda activa y tasa.',
      'Una tasa vieja puede hacer que cobres de mas o de menos.',
      'Actualiza antes de abrir caja si vendes mucho en Bs.',
    ],
    actions: ['Actualizar tasa', 'Activar moneda', 'Revisar POS en Bs', 'Guardar'],
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
    title: 'Metodos de pago - Cobro en POS',
    icon: 'PG',
    description: 'Define que formas de cobro ve el cajero y que datos debe capturar antes de cerrar una venta.',
    steps: [
      { title: '1. Activar solo lo usado', desc: 'Los metodos activos aparecen en POS. Desactiva los que no aceptas para que el cobro sea rapido y limpio.' },
      { title: '2. Referencia obligatoria', desc: 'Para pago movil, transferencia, Zelle o punto, exige referencia si necesitas cuadrar comprobantes.' },
      { title: '3. Datos bancarios', desc: 'Guarda datos claros para que el cajero pueda copiarlos o mostrarlos al cliente sin improvisar.' },
      { title: '4. Probar cobro', desc: 'Haz una venta pequena o de prueba y confirma que el metodo aparece, pide referencia y cae en reporte/caja correcto.' },
    ],
    tips: [
      'Metodo mal nombrado confunde caja y reportes.',
      'Credito interno requiere cliente con credito activo.',
      'Si un metodo no aparece en POS, casi siempre esta inactivo.',
    ],
    actions: ['Activar metodo', 'Exigir referencia', 'Editar datos', 'Probar en POS'],
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
    title: 'Impresoras - Tickets y bridge',
    icon: 'IP',
    description: 'Configura impresoras termicas y pruebas de ticket. La impresion depende del bridge local de cada computadora.',
    steps: [
      { title: '1. Bridge activo', desc: 'El bridge debe estar abierto en la PC que tiene la impresora. Sin bridge, el navegador no puede imprimir directo.' },
      { title: '2. Detectar impresora', desc: 'Detecta y selecciona la impresora correcta. Si no aparece, revisa cable, Windows y bridge.' },
      { title: '3. Ancho de papel', desc: 'Configura 58mm u 80mm segun el rollo. Si esta mal, el ticket sale cortado o con texto raro.' },
      { title: '4. Prueba real', desc: 'Imprime prueba y luego una venta controlada. Confirma que sale por la caja correcta.' },
    ],
    tips: [
      'Cada PC/caja puede necesitar su propia impresora predeterminada.',
      'Si imprime en otra caja, revisa Estacion POS e impresora local.',
      'Despues de cambiar logo/datos, imprime una prueba.',
    ],
    actions: ['Descargar bridge', 'Detectar impresora', 'Configurar ancho', 'Imprimir prueba'],
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
    title: 'Estacion POS - Caja local',
    icon: 'EP',
    description: 'Ajustes de esta computadora: almacen, caja, impresora y comportamiento del punto de venta.',
    steps: [
      { title: '1. Almacen activo', desc: 'Define de donde descuenta esta caja. Si vende desde otro almacen, todo el inventario se descuadra.' },
      { title: '2. Impresora local', desc: 'Selecciona la impresora de esta estacion. Evita que una caja imprima tickets por otra computadora.' },
      { title: '3. Caja y experiencia', desc: 'Revisa modo pantalla, tema y ajustes locales para que el cajero trabaje rapido.' },
      { title: '4. Validar con venta', desc: 'Haz una venta de prueba: debe descontar del almacen correcto, cobrar en la caja correcta e imprimir donde corresponde.' },
    ],
    tips: [
      'Estos ajustes pueden depender de la computadora/navegador.',
      'Si cambias de usuario en la misma PC, valida la estacion antes de vender.',
      'Para dos cajas fisicas, prueba impresion y almacen por separado.',
    ],
    actions: ['Cambiar almacen', 'Seleccionar impresora', 'Probar venta', 'Guardar'],
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

  'config/precios': {
    title: 'Precios masivos - Ajustes controlados',
    icon: 'PM',
    description: 'Actualiza costos, margenes o precios de muchos productos con cuidado. Es una herramienta potente para corregir catalogo sin editar ficha por ficha.',
    steps: [
      { title: '1. Filtrar antes de aplicar', desc: 'Selecciona categoria, marca o grupo de productos. Evita cambios globales si solo necesitas ajustar una linea.' },
      { title: '2. Revisar margen', desc: 'Antes de guardar, valida que el margen resultante sea rentable. Un costo mal cargado puede arrastrar precios incorrectos.' },
      { title: '3. Medir impacto', desc: 'Piensa en POS, listas de precios y clientes con precios especiales. El cambio puede afectar ventas inmediatas.' },
      { title: '4. Guardar y verificar', desc: 'Despues de aplicar, abre uno o dos productos de muestra y confirma precio base, lista de precios y precio en Bs.' },
    ],
    tips: ['Usa esta pantalla fuera de horas pico.', 'Exporta o revisa una muestra antes de cambios grandes.', 'Si algo se ve raro, no sigas aplicando lotes; revisa primero costos.'],
    actions: ['Filtrar productos', 'Aplicar margen', 'Revisar muestra', 'Guardar cambios'],
  },

  'config/financiadoras': {
    title: 'Financiadoras - Credito externo',
    icon: 'FN',
    description: 'Configura empresas externas de financiamiento para vender con planes como Cashea, Krece u otros aliados.',
    steps: [
      { title: '1. Crear financiadora', desc: 'Registra nombre, estado activo y condiciones basicas. Usa nombres claros para que el cajero la identifique rapido.' },
      { title: '2. Definir reglas', desc: 'Configura porcentajes, comisiones o datos requeridos segun la financiadora. Esto evita ventas con informacion incompleta.' },
      { title: '3. Validar en POS', desc: 'Haz una prueba controlada para confirmar que aparece como metodo o flujo esperado y que el reporte queda entendible.' },
    ],
    tips: ['No mezcles pagos normales con financiamiento externo.', 'Conserva referencia o aprobacion del aliado.', 'Revisa reportes para cuadrar lo cobrado por la financiadora.'],
    actions: ['Crear financiadora', 'Activar/desactivar', 'Revisar reglas', 'Probar POS'],
  },

  'config/catalogo': {
    title: 'Catalogo publico - Venta compartida',
    icon: 'CP',
    description: 'Controla el catalogo visible para clientes: enlace publico, QR, productos publicados y opciones de carrito.',
    steps: [
      { title: '1. Revisar estado', desc: 'Confirma si el catalogo esta activo. Si esta inactivo, los clientes no deberian poder comprar desde el enlace.' },
      { title: '2. Validar productos visibles', desc: 'Los productos deben tener precio, stock e imagen si quieres una experiencia clara para el cliente.' },
      { title: '3. Compartir enlace o QR', desc: 'Usa el link publico o QR solo despues de revisar precios y disponibilidad.' },
      { title: '4. Revisar pedidos', desc: 'Si el catalogo permite carrito, define quien revisa pedidos y como se confirman pagos.' },
    ],
    tips: ['No publiques productos sin precio o sin stock.', 'Revisa el catalogo desde una ventana externa.', 'Usa imagenes limpias para productos principales.'],
    actions: ['Activar catalogo', 'Copiar enlace', 'Ver QR', 'Revisar productos'],
  },

  'config/whatsapp': {
    title: 'WhatsApp - Mensajes y avisos',
    icon: 'WA',
    description: 'Configura comunicacion por WhatsApp para avisos, soporte, pedidos o notificaciones del negocio.',
    steps: [
      { title: '1. Revisar conexion', desc: 'Confirma que la integracion este activa y autorizada antes de depender de mensajes automaticos.' },
      { title: '2. Preparar plantillas', desc: 'Usa mensajes claros para pagos, ordenes listas, garantias o seguimiento. Evita textos largos.' },
      { title: '3. Probar con un numero propio', desc: 'Antes de usarlo con clientes, envia una prueba y verifica formato, acentos y enlaces.' },
    ],
    tips: ['No prometas automatizacion si la conexion no esta verificada.', 'Manten mensajes cortos y con accion clara.', 'Prueba despues de cambiar plantillas.'],
    actions: ['Ver conexion', 'Editar plantilla', 'Enviar prueba'],
  },

  'config/integraciones': {
    title: 'Integraciones - Sistemas externos',
    icon: 'IN',
    description: 'Conecta servicios externos como BloqueCelular u otros aliados. Cambios aqui pueden afectar validaciones fuera del sistema.',
    steps: [
      { title: '1. Revisar credenciales', desc: 'Confirma que token, usuario o endpoint correspondan al ambiente correcto.' },
      { title: '2. Activar solo lo necesario', desc: 'Manten apagadas integraciones que no uses para evitar errores o demoras innecesarias.' },
      { title: '3. Probar operacion real', desc: 'Despues de guardar, realiza una prueba pequena y revisa respuesta del proveedor externo.' },
    ],
    tips: ['No mezcles credenciales de QA y produccion.', 'Documenta quien tiene acceso a cada token.', 'Si falla, revisa primero conexion y credenciales.'],
    actions: ['Actualizar credenciales', 'Activar/desactivar', 'Probar conexion'],
  },

  cash: {
    title: 'Caja - Turno, movimientos y cuadre',
    icon: 'CJ',
    description: 'Control operativo del dinero. Cada turno debe quedar asociado a caja, usuario, estacion, almacen e impresora correctos.',
    steps: [
      { title: '1. Abrir turno', desc: 'Selecciona una caja libre y registra fondo inicial real por moneda. No uses una caja abierta por otro cajero.' },
      { title: '2. Validar estacion', desc: 'Antes de vender confirma almacen, caja e impresora. Si una venta imprime o descuenta mal, revisa Configuracion > Estacion POS.' },
      { title: '3. Cobrar por metodo', desc: 'Efectivo se cuenta fisicamente; pagos digitales se verifican por referencia; credito no es dinero disponible en caja.' },
      { title: '4. Registrar movimientos', desc: 'Entradas y salidas no relacionadas con ventas deben registrarse al momento con motivo claro.' },
      { title: '5. Registrar avances', desc: 'Un avance mueve efectivo hacia banco/punto con comision. Debe tener referencia y monto exacto.' },
      { title: '6. Cerrar con arqueo', desc: 'Cuenta cada moneda, compara esperado contra contado y deja observacion si hay diferencia.' },
      { title: '7. Investigar diferencias', desc: 'Cruza Reportes > Caja y Reportes > Ventas con el mismo rango, caja y usuario. Revisa devoluciones, anulaciones y pagos mixtos.' },
    ],
    tips: [
      'No cierres caja sin contar efectivo fisico.',
      'Un retiro sin movimiento registrado se convierte en faltante.',
      'Un pago digital sin referencia complica el cuadre.',
      'Si un admin vende desde la PC de otra caja, valida la estacion antes de cobrar.',
      'Cierra cada turno para delimitar responsabilidad aunque haya pocas ventas.',
    ],
    actions: ['Abrir turno', 'Registrar movimiento', 'Registrar avance', 'Cerrar caja', 'Comparar reportes', 'Revisar estacion POS'],
  },

  'cash/registers': {
    title: 'Gestion de cajas - Sesiones y estaciones',
    icon: 'GC',
    description: 'Administra las cajas fisicas del negocio, sesiones abiertas, bloqueo, cierre forzado e impresora/estacion asociada.',
    steps: [
      { title: '1. Revisar estado', desc: 'El resumen muestra abiertas, cerradas y bloqueadas. Una caja abierta ya tiene usuario responsable.' },
      { title: '2. Crear cajas claras', desc: 'Usa codigos cortos como C01, C02 o Taller. Crea una caja por punto fisico que maneje dinero.' },
      { title: '3. Asociar estacion', desc: 'Si usas impresoras por caja, el identificador debe coincidir con el bridge/estacion configurado en esa computadora.' },
      { title: '4. Editar solo cerradas', desc: 'No cambies caja con sesion activa. Primero cierra turno para proteger historial y cuadre.' },
      { title: '5. Forzar cierre con criterio', desc: 'Forzar cierre libera sesiones trabadas. Usalo solo si el cajero no puede cerrar y deja motivo para auditoria.' },
      { title: '6. Validar con prueba', desc: 'Despues de crear o cambiar caja, haz una venta controlada para confirmar caja, impresora y reporte.' },
    ],
    tips: [
      'Manten una nomenclatura simple y visible para los cajeros.',
      'Si imprime por otra caja, revisa Estacion POS antes de cambiar datos de la caja.',
      'Si una caja se bloquea seguido, revisa si el cajero cierra turno correctamente.',
      'No desactives cajas con historial si solo quieres ocultarlas temporalmente.',
    ],
    actions: ['Nueva caja', 'Ver sesiones', 'Editar caja cerrada', 'Forzar cierre', 'Revisar estacion', 'Probar impresion'],
  },

};
