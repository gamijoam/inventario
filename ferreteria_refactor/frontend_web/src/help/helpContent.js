/**
 * Help Content Data Structure
 * Organized by module with step-by-step guides
 */

export const helpContent = [
    // ========================================
    // PUNTO DE VENTA (POS)
    // ========================================
    {
        id: 'pos',
        title: 'Punto de Venta (POS)',
        icon: '🛒',
        color: 'blue',
        sections: [
            {
                id: 'pos-search',
                title: 'Buscar Productos',
                steps: [
                    'Haga clic en la barra de búsqueda en la parte superior',
                    'Escriba el nombre o código del producto',
                    'Seleccione el producto de la lista de resultados',
                    'El producto se agregará automáticamente al carrito'
                ],
                tips: [
                    'Puede usar el lector de código de barras para búsqueda rápida',
                    'La búsqueda es en tiempo real, no necesita presionar Enter'
                ]
            },
            {
                id: 'pos-presentations',
                title: 'Usar Presentaciones (Unidades)',
                steps: [
                    'Cuando un producto tiene múltiples presentaciones, aparecerá un modal',
                    'Seleccione la presentación deseada (Ej: Unidad, Caja, Docena)',
                    'Verifique el precio de la presentación seleccionada',
                    'Haga clic en "Agregar al Carrito"'
                ],
                tips: [
                    'Cada presentación puede tener un precio diferente',
                    'Las presentaciones se configuran en la sección de Productos'
                ]
            },
            {
                id: 'pos-discounts',
                title: 'Aplicar Descuentos',
                steps: [
                    'Los descuentos se aplican automáticamente si están activos',
                    'Verá el precio original tachado y el precio con descuento',
                    'El porcentaje de descuento se muestra en el carrito',
                    'El descuento se refleja en el ticket impreso'
                ],
                tips: [
                    'Los descuentos se configuran por producto en la sección de Productos',
                    'Puede activar/desactivar descuentos sin eliminarlos'
                ]
            },
            {
                id: 'pos-payment',
                title: 'Procesar Pagos',
                steps: [
                    'Verifique el total en el carrito',
                    'Haga clic en "Procesar Venta"',
                    'Seleccione el método de pago (Efectivo, Tarjeta, Transferencia)',
                    'Ingrese el monto recibido',
                    'El sistema calculará el cambio automáticamente',
                    'Haga clic en "Confirmar Venta"'
                ],
                tips: [
                    'Puede usar múltiples métodos de pago en una sola venta',
                    'El sistema soporta pagos en USD y Bs simultáneamente',
                    'El cambio se calcula en la misma moneda del pago'
                ]
            },
            {
                id: 'pos-print',
                title: 'Imprimir Tickets',
                steps: [
                    'Después de procesar la venta, aparecerá el botón "Imprimir"',
                    'Haga clic en "Imprimir Ticket"',
                    'El ticket se enviará a la impresora configurada',
                    'Puede reimprimir desde el historial de ventas'
                ],
                tips: [
                    'Asegúrese de que BridgeInvensoft.exe esté ejecutándose',
                    'Configure el ID de la caja en la primera impresión',
                    'Si falla, verifique que el ID coincida con config.ini del Hardware Bridge'
                ]
            }
        ]
    },

    // ========================================
    // PRODUCTOS E INVENTARIO
    // ========================================
    {
        id: 'products',
        title: 'Productos e Inventario',
        icon: '📦',
        color: 'green',
        sections: [
            {
                id: 'products-create',
                title: 'Crear Nuevo Producto',
                steps: [
                    'Vaya a "Productos" en el menú',
                    'Haga clic en "Nuevo Producto"',
                    'Complete la información básica: Nombre, SKU, Precio',
                    'Opcional: Agregue descripción, categoría, proveedor',
                    'Configure el stock inicial',
                    'Haga clic en "Guardar"'
                ],
                tips: [
                    'El SKU es opcional pero recomendado para búsqueda rápida',
                    'El precio se ingresa en USD',
                    'El stock puede ser decimal (ej: 2.5 para productos fraccionables)'
                ]
            },
            {
                id: 'products-presentations',
                title: 'Configurar Presentaciones',
                steps: [
                    'Edite un producto existente',
                    'Vaya a la sección "Presentaciones"',
                    'Haga clic en "Agregar Presentación"',
                    'Ingrese: Nombre (ej: Caja), Factor de conversión (ej: 12)',
                    'Ingrese el precio de la presentación',
                    'Guarde los cambios'
                ],
                tips: [
                    'El factor indica cuántas unidades base contiene',
                    'Ejemplo: 1 Caja = 12 Unidades → Factor: 12',
                    'Cada presentación puede tener su propia tasa de cambio'
                ]
            },
            {
                id: 'products-exchange-rate',
                title: 'Asignar Tasas de Cambio Específicas',
                steps: [
                    'Edite un producto',
                    'En "Tasa de Cambio", seleccione una tasa específica',
                    'Ejemplo: Seleccione "Paralelo" en lugar de "BCV"',
                    'Guarde los cambios',
                    'El producto usará esa tasa en el POS'
                ],
                tips: [
                    'Si no selecciona una tasa, usará la tasa por defecto del sistema',
                    'Las presentaciones pueden tener tasas diferentes al producto base',
                    'Útil para productos importados o con precios especiales'
                ]
            },
            {
                id: 'products-combos',
                title: 'Crear y Gestionar Combos',
                steps: [
                    'Cree o edite un producto',
                    'Vaya a la pestaña "Combos" (o marque "Este producto es un Combo" en General)',
                    'Haga clic en "Convertir en Combo" si aún no lo es',
                    'Use el buscador para agregar productos componentes',
                    'Defina la cantidad de cada componente (ej: 2 Refrescos + 1 Snack)',
                    'El costo se calcula automáticamente, pero usted define el precio de venta'
                ],
                tips: [
                    'DIFERENCIA CLAVE: Use "Combos" para agrupar PRODUCTOS DIFERENTES. Use "Presentaciones" para el MISMO producto en diferentes cantidades (Cajas/Bultos).',
                    'El stock del combo es "Virtual": El sistema calcula cuántos puede armar basándose en el stock de los componentes.',
                    'Al vender un combo, se descuentan los componentes del inventario automáticamente.'
                ]
            },
            {
                id: 'products-discounts',
                title: 'Configurar Descuentos',
                steps: [
                    'Edite un producto',
                    'Active "Descuento Activo"',
                    'Ingrese el porcentaje de descuento (ej: 10 para 10%)',
                    'Guarde los cambios',
                    'El descuento se aplicará automáticamente en el POS'
                ],
                tips: [
                    'Puede desactivar el descuento sin eliminarlo',
                    'El descuento se muestra en el ticket',
                    'El precio con descuento se calcula automáticamente'
                ]
            }
        ]
    },

    // ========================================
    // CAJA REGISTRADORA
    // ========================================
    {
        id: 'cash',
        title: 'Caja Registradora',
        icon: '💰',
        color: 'yellow',
        sections: [
            {
                id: 'cash-open',
                title: 'Abrir Caja',
                steps: [
                    'Vaya a "Caja" en el menú',
                    'Haga clic en "Abrir Caja"',
                    'Ingrese el monto inicial en USD y/o Bs',
                    'Agregue un comentario opcional (ej: "Turno mañana")',
                    'Haga clic en "Abrir Caja"'
                ],
                tips: [
                    'Debe abrir caja antes de realizar ventas',
                    'Solo puede haber una caja abierta a la vez por usuario',
                    'El monto inicial debe coincidir con el efectivo físico'
                ]
            },
            {
                id: 'cash-movements',
                title: 'Registrar Movimientos',
                steps: [
                    'Con la caja abierta, haga clic en "Nuevo Movimiento"',
                    'Seleccione el tipo: Ingreso o Egreso',
                    'Ingrese el monto y la moneda',
                    'Agregue una descripción (ej: "Pago de servicios")',
                    'Haga clic en "Registrar"'
                ],
                tips: [
                    'Los ingresos suman al total de caja',
                    'Los egresos restan del total de caja',
                    'Las ventas se registran automáticamente, no las registre manualmente'
                ]
            },
            {
                id: 'cash-close',
                title: 'Cerrar Caja (Arqueo)',
                steps: [
                    'Haga clic en "Cerrar Caja"',
                    'Cuente el efectivo físico en la caja',
                    'Ingrese los montos reales en USD y Bs',
                    'El sistema mostrará la diferencia (faltante o sobrante)',
                    'Agregue un comentario si hay diferencia',
                    'Haga clic en "Cerrar Caja"'
                ],
                tips: [
                    'Verifique el reporte antes de cerrar',
                    'El sistema calcula automáticamente el total esperado',
                    'Puede imprimir el reporte de cierre'
                ]
            }
        ]
    },

    // ========================================
    // VENTAS Y REPORTES
    // ========================================
    {
        id: 'sales',
        title: 'Ventas y Reportes',
        icon: '📊',
        color: 'purple',
        sections: [
            {
                id: 'sales-history',
                title: 'Ver Historial de Ventas',
                steps: [
                    'Vaya a "Ventas" en el menú',
                    'Use los filtros para buscar: Fecha, Cliente, Usuario',
                    'Haga clic en una venta para ver detalles',
                    'Puede reimprimir el ticket desde aquí'
                ],
                tips: [
                    'El historial muestra todas las ventas del sistema',
                    'Puede filtrar por rango de fechas',
                    'Los totales se muestran en USD y Bs'
                ]
            },
            {
                id: 'sales-reports',
                title: 'Generar Reportes',
                steps: [
                    'Vaya a "Reportes" en el menú',
                    'Seleccione el tipo de reporte',
                    'Configure el rango de fechas',
                    'Haga clic en "Generar"',
                    'Puede exportar a Excel o PDF'
                ],
                tips: [
                    'Los reportes se generan en tiempo real',
                    'Puede ver ventas por producto, usuario, o período',
                    'Los gráficos son interactivos'
                ]
            }
        ]
    },

    // ========================================
    // CLIENTES
    // ========================================
    {
        id: 'customers',
        title: 'Clientes',
        icon: '👥',
        color: 'indigo',
        sections: [
            {
                id: 'customers-create',
                title: 'Registrar Nuevo Cliente',
                steps: [
                    'Vaya a "Clientes" en el menú',
                    'Haga clic en "Nuevo Cliente"',
                    'Complete: Nombre, Documento, Teléfono, Email',
                    'Agregue dirección si es necesario',
                    'Haga clic en "Guardar"'
                ],
                tips: [
                    'El documento puede ser RIF, CI, o Pasaporte',
                    'El email es opcional pero útil para enviar facturas',
                    'Puede editar la información después'
                ]
            },
            {
                id: 'customers-credit',
                title: 'Ventas a Crédito',
                steps: [
                    'En el POS, seleccione "Crédito" como método de pago',
                    'Seleccione el cliente',
                    'Ingrese el monto del abono inicial (opcional)',
                    'Complete la venta',
                    'El saldo pendiente se registra automáticamente'
                ],
                tips: [
                    'Puede ver el saldo pendiente en la ficha del cliente',
                    'Los abonos se registran en "Cuentas por Cobrar"',
                    'El sistema calcula intereses si está configurado'
                ]
            }
        ]
    },

    // ========================================
    // SERVICIOS TÉCNICOS
    // ========================================
    {
        id: 'services',
        title: 'Servicios Técnicos',
        icon: '🔧',
        color: 'purple',
        sections: [
            {
                id: 'new-order',
                title: 'Recepción de Equipos (Nueva Orden)',
                steps: [
                    'Vaya a "Servicios Técnicos" > "Nueva Orden" en el menú lateral.',
                    'Busque o seleccione el Cliente existente (o cree uno nuevo).',
                    'Seleccione el Técnico asignado (opcional en esta etapa).',
                    'Complete los datos del equipo: Tipo, Marca, Modelo, Serial/IMEI, Patrón/PIN.',
                    'Describa la falla reportada por el cliente y el estado físico del equipo (rayones, golpes).',
                    'Indique una fecha estimada de entrega.',
                    'Haga clic en "Crear Orden de Servicio". Se imprimirá un ticket de recepción.'
                ],
                tips: [
                    'Sea detallado en el estado físico para evitar reclamos futuros.',
                    'El ticket de recepción incluye un código QR y los términos del servicio.'
                ]
            },
            {
                id: 'service-management',
                title: 'Gestión y Diagnóstico (El Técnico)',
                steps: [
                    'Vaya a "Servicios Técnicos" > "Bandeja de Entrada".',
                    'Busque la orden por número de ticket, cliente o serial. Haga clic en "Gestionar".',
                    'En la pantalla de gestión, actualice el estado a "Diagnosticando" o "En Progreso".',
                    'En "Diagnóstico Técnico", escriba los hallazgos.',
                    'Para agregar repuestos o mano de obra, use el botón "+ Agregar".',
                    'Para REPUESTOS: Seleccione "Inventario", busque el producto. El precio se carga automáticamente.',
                    'Para MANO DE OBRA: Seleccione "Servicio Manual", escriba la descripción y asigne el TÉCNICO que ganará la comisión.',
                    'Haga clic en "Guardar Notas" o cambie el estado a "Listo" cuando termine.'
                ],
                tips: [
                    'Solo los "Servicios Manuales" permiten asignar un técnico para comisión.',
                    'Los repuestos descuentan stock del inventario automáticamente al facturar.'
                ]
            },
            {
                id: 'service-checkout',
                title: 'Facturación y Entrega (Caja)',
                steps: [
                    'Cuando el cliente venga a retirar, vaya a POS (Punto de Venta).',
                    'Haga clic en el botón "Cargar Servicio" (ícono de llave inglesa) en la parte superior.',
                    'Busque la orden lista o selecciónela de la lista "Listas para Entregar".',
                    'Los ítems de la orden se cargarán al carrito de compras automáticamente.',
                    'Si el cliente lleva otros productos, agréguelos normalmente al carrito.',
                    'Proceda al pago (Efectivo, Tarjeta, etc.) y finalice la venta.',
                    'La orden de servicio cambiará automáticamente a estado "Entregado".'
                ]
            }
        ]
    },

    // ========================================
    // COMISIONES Y PERSONAL
    // ========================================
    {
        id: 'commissions',
        title: 'Comisiones y Personal',
        icon: '👥',
        color: 'indigo',
        sections: [
            {
                id: 'users-setup',
                title: 'Creación de Usuarios (Técnicos y Vendedores)',
                steps: [
                    'Vaya a "Sistema" > "Usuarios".',
                    'Haga clic en "Nuevo Usuario".',
                    'Para VENDEDORES: Asigne un Rol de "Vendedor" o "Cajero". Estos aparecerán en el POS.',
                    'Para TÉCNICOS: Asigne un Rol de "Técnico" (o el que corresponda). Estos aparecerán para asignar en Servicios.',
                    'Asegúrese de que el usuario esté "Activo".'
                ],
                tips: [
                    'Cada empleado debe tener su propio usuario para rastrear sus comisiones correctamente.'
                ]
            },
            {
                id: 'pos-commission',
                title: 'Venta con Comisión (POS)',
                steps: [
                    'En la pantalla de POS, agregue productos al carrito.',
                    'En la lista de productos del carrito, verá un selector de "Vendedor".',
                    'Por defecto, se asigna al usuario que inició sesión.',
                    'Si la venta es de otro vendedor, cambie el nombre en el selector CADA ÍTEM o en el selector global si estuviera disponible.',
                    'Al finalizar la venta, el sistema registrará la comisión para ese vendedor.'
                ]
            },
            {
                id: 'service-commission',
                title: 'Comisión por Servicio Técnico',
                steps: [
                    'Las comisiones de servicio se asignan ITEM por ITEM.',
                    'Al agregar una "Mano de Obra" o "Servicio Manual" en la gestión de la orden, debe seleccionar el Técnico.',
                    'Los repuestos NO generan comisión para el técnico (generalmente).',
                    'Al facturar en caja, estas comisiones se registran a nombre del técnico seleccionado.'
                ]
            }
        ]
    },

    // ========================================
    // TRANSFERENCIAS INTER-SEDES
    // ========================================
    {
        id: 'transfers',
        title: 'Transferencias Inter-Sedes',
        icon: '🚚',
        color: 'indigo',
        sections: [
            {
                id: 'transfers-export',
                title: 'Exportar Inventario (Salida)',
                steps: [
                    'Vaya a "Inventario" → "Exportar (Salida)"',
                    'Seleccione el "Almacén de Origen" desde donde saldrá la mercancía',
                    'Busque los productos que desea transferir',
                    'Ajuste las cantidades a enviar',
                    'Haga clic en "Generar y Descargar Paquete"',
                    'Se descargará un archivo .JSON con los datos'
                ],
                tips: [
                    'El stock se descuenta automáticamente del almacén seleccionado',
                    'Envíe el archivo descargado por correo o WhatsApp a la otra sede',
                    'Solo puede transferir productos que tengan Código de Barras (SKU)'
                ]
            },
            {
                id: 'transfers-import',
                title: 'Importar Inventario (Entrada)',
                steps: [
                    'Vaya a "Inventario" → "Importar (Entrada)"',
                    'Haga clic en "Seleccionar Archivo JSON"',
                    'Busque y cargue el archivo que recibió de la otra sede',
                    'El sistema verificará los productos automáticamente',
                    'Si todo está correcto, haga clic en "Confirmar Importación"'
                ],
                tips: [
                    'El stock importado se suma al inventario global y se registra en el Kardex',
                    'Si un producto no existe por SKU, deberá crearlo manualmente primero',
                    'El proceso registra un movimiento "Entrada Externa"'
                ]
            }
        ]
    },

    // ========================================
    // CONFIGURACIÓN
    // ========================================
    {
        id: 'settings',
        title: 'Configuración',
        icon: '⚙️',
        color: 'gray',
        sections: [
            {
                id: 'settings-users',
                title: 'Gestionar Usuarios',
                steps: [
                    'Vaya a "Configuración" → "Usuarios"',
                    'Haga clic en "Nuevo Usuario"',
                    'Complete: Nombre, Usuario, Contraseña',
                    'Seleccione el rol: Admin, Vendedor, Almacén',
                    'Haga clic en "Crear"'
                ],
                tips: [
                    'Admin: Acceso total al sistema',
                    'Vendedor: Solo POS y ventas',
                    'Almacén: Gestión de inventario y compras'
                ]
            },
            {
                id: 'settings-exchange-rates',
                title: 'Configurar Tasas de Cambio',
                steps: [
                    'Vaya a "Configuración" → "Tasas de Cambio"',
                    'Haga clic en "Nueva Tasa"',
                    'Ingrese: Nombre (ej: BCV, Paralelo), Código (VES), Símbolo (Bs)',
                    'Ingrese la tasa (ej: 36.50)',
                    'Marque como "Por Defecto" si es la tasa principal',
                    'Haga clic en "Guardar"'
                ],
                tips: [
                    'Solo puede haber una tasa por defecto por moneda',
                    'Puede tener múltiples tasas activas (BCV, Paralelo, etc.)',
                    'Las tasas se actualizan manualmente'
                ]
            },
            {
                id: 'settings-company',
                title: 'Configurar Información de la Empresa',
                steps: [
                    'Vaya a "Configuración" → "Empresa"',
                    'Complete: Nombre, RIF, Dirección, Teléfono',
                    'Esta información aparecerá en los tickets',
                    'Haga clic en "Guardar"'
                ],
                tips: [
                    'La información se imprime en todos los tickets',
                    'Puede agregar un logo (próximamente)',
                    'Verifique que el RIF esté correcto'
                ]
            }
        ]
    }
];

export default helpContent;

/**
 * Índice por clave de contexto para el HelpDrawer
 * Convierte el array existente en objeto accesible por key
 */
export const HELP_CONTENT = {
  dashboard: {
    title: 'Resumen del Negocio', icon: '📊',
    description: 'Vista general de tu negocio: ingresos, ganancia, alertas y los indicadores más importantes del día o período seleccionado.',
    steps: [
      { title: 'Cambiar el período', desc: 'Usa los botones Hoy / Ayer / Semana / Mes en la parte superior para ver los datos del período que necesitas.' },
      { title: 'Leer los KPIs', desc: 'Los 6 cuadros muestran Ingresos, Ganancia, Transacciones, Ticket promedio, Créditos y Órdenes de taller. La flecha verde o roja indica si subió o bajó vs el período anterior.' },
      { title: 'Atender las alertas', desc: 'La sección "Requieren atención" en naranja/rojo señala problemas activos: stock bajo, órdenes sin cobrar, deudas vencidas. Haz clic en cualquier alerta para ir directo al módulo.' },
      { title: 'Ver los más vendidos', desc: 'En "Top Productos" ves qué productos generaron más ingresos. En "Rendimiento Equipo" ves las comisiones de cada empleado.' },
    ],
    tips: ['El gráfico de "Ventas vs Ganancia" ayuda a ver si estás vendiendo más pero ganando menos.', 'Si los ingresos muestran cero, verifica que la caja esté abierta.'],
    actions: ['Cambiar período', 'Actualizar datos', 'Abrir POS'],
  },
  pos: {
    title: 'Punto de Venta (POS)', icon: '🛒',
    description: 'Aquí realizas todas las ventas. Busca productos, agrégalos al carrito y cobra al cliente en efectivo, Zelle, transferencia u otro método configurado.',
    steps: [
      { title: 'Abrir la caja primero', desc: 'Antes de vender debes tener un turno de caja abierto. Si ves "Caja Cerrada" en el header, ve a Apertura/Cierre de Caja.' },
      { title: 'Buscar el producto', desc: 'Escribe el nombre o código en la barra de búsqueda. También puedes escanear el código de barras con un lector conectado.' },
      { title: 'Agregar y ajustar', desc: 'Haz clic en el producto para agregarlo. Modifica la cantidad con los botones + y − del carrito, o haz clic en el precio para aplicar un descuento manual.' },
      { title: 'Cobrar', desc: 'Haz clic en "Cobrar", selecciona el método de pago e ingresa el monto recibido. El sistema calcula el cambio automáticamente.' },
    ],
    tips: ['Usa Ctrl+K para buscar desde cualquier pantalla.', 'Para venta a crédito: selecciona el cliente primero y elige "Crédito" como método de pago.'],
    actions: ['Buscar producto', 'Aplicar descuento', 'Cobrar', 'Imprimir ticket'],
  },
  'sales/cotizaciones': {
    title: 'Cotizaciones', icon: '📄',
    description: 'Crea presupuestos para clientes antes de confirmar la venta. Si el cliente acepta, se convierte en venta con un solo clic.',
    steps: [
      { title: 'Crear cotización', desc: 'Haz clic en "Nueva Cotización". Selecciona el cliente, agrega los productos con sus cantidades y guarda.' },
      { title: 'Revisar estadísticas', desc: 'Los 4 cuadros superiores muestran: total, pendientes (con monto en espera), facturadas y la tasa de conversión (% que se convirtieron en ventas).' },
      { title: 'Filtrar por estado', desc: 'Usa los botones Todas / Pendientes / Facturadas / Vencidas para ver solo las que necesitas.' },
      { title: 'Convertir a venta', desc: 'Haz clic en "Facturar" en cualquier cotización. El sistema carga los productos al POS automáticamente.' },
      { title: 'Duplicar', desc: 'El botón 📋 crea una copia de la cotización para pedidos repetidos, sin tener que escribir todo de nuevo.' },
    ],
    tips: ['Una cotización Pendiente significa que el cliente aún no ha confirmado.', 'El % de conversión te dice qué tan efectivo eres cerrando presupuestos.'],
    actions: ['Nueva Cotización', 'Filtrar', 'Imprimir', 'Facturar', 'Duplicar'],
  },
  'sales/clientes': {
    title: 'Clientes', icon: '👥',
    description: 'Directorio completo de clientes con historial de compras, saldo de crédito y precios especiales.',
    steps: [
      { title: 'Agregar cliente', desc: 'Haz clic en "Nuevo Cliente". Completa nombre, cédula y teléfono como mínimo.' },
      { title: 'Buscar', desc: 'Escribe nombre, cédula o teléfono en la barra. Filtra en tiempo real.' },
      { title: 'Ver historial', desc: 'Haz clic en el cliente para ver todas sus compras y el saldo de crédito.' },
      { title: 'Asignar precio especial', desc: 'Asigna una lista de precios al cliente para que se aplique automáticamente en el POS.' },
    ],
    tips: ['El campo "Notas" es útil para guardar acuerdos o preferencias especiales.'],
    actions: ['Nuevo Cliente', 'Buscar', 'Ver historial', 'Asignar lista de precios'],
  },
  'sales/devoluciones': {
    title: 'Devoluciones', icon: '↩️',
    description: 'Registra cuando un cliente regresa un producto. El stock se restaura y el reembolso queda registrado.',
    steps: [
      { title: 'Buscar la venta', desc: 'Escribe el número de venta o el nombre del cliente para encontrar la venta original.' },
      { title: 'Seleccionar productos', desc: 'Marca qué productos devuelve y en qué cantidad. Puede ser parcial.' },
      { title: 'Elegir reembolso', desc: 'Devuelve en efectivo, como crédito al cliente o como cambio por otro producto.' },
    ],
    tips: ['Siempre busca la venta original para que el sistema ajuste correctamente los reportes y comisiones.'],
    actions: ['Buscar venta', 'Seleccionar productos', 'Confirmar devolución'],
  },
  'sales/garantias': {
    title: 'Garantías', icon: '🛡️',
    description: 'Verifica si un producto vendido tiene garantía activa y crea órdenes de servicio vinculadas.',
    steps: [
      { title: 'Buscar garantía', desc: 'Escribe el nombre del cliente o número de venta. El sistema muestra si está vigente y la fecha de vencimiento.' },
      { title: 'Crear orden de taller', desc: 'Si el equipo necesita reparación bajo garantía, crea una orden de taller directamente desde aquí.' },
    ],
    tips: ['Las políticas de garantía se configuran en Configuración → Garantías.'],
    actions: ['Buscar garantía', 'Crear orden de servicio'],
  },
  'sales/creditos': {
    title: 'Créditos (Cuentas por Cobrar)', icon: '💳',
    description: 'Control de deudas de clientes. Registra pagos y consulta el saldo de cada cliente.',
    steps: [
      { title: 'Ver deudas activas', desc: 'Lista de clientes con saldo pendiente, monto y antigüedad de la deuda.' },
      { title: 'Registrar pago', desc: 'Haz clic en el cliente → "Registrar Pago". Elige el monto y método. El saldo se actualiza al instante.' },
      { title: 'Ver historial', desc: 'Consulta cada factura pendiente con su fecha y monto.' },
    ],
    tips: ['Clientes con deuda mayor a 30 días aparecen marcados en rojo en el Dashboard.'],
    actions: ['Ver deudas', 'Registrar pago', 'Ver historial por cliente'],
  },
  'inventory/productos': {
    title: 'Productos', icon: '📦',
    description: 'Catálogo completo: crea productos, ajusta precios, controla stock y recibe mercancía.',
    steps: [
      { title: 'Nuevo producto', desc: 'Haz clic en "Nuevo Producto". Completa nombre, precio de costo y precio de venta. Asígnale una categoría.' },
      { title: 'Buscar y filtrar', desc: 'Usa la barra de búsqueda. Filtra por categoría, almacén o estado (En stock / Bajo stock / Agotado).' },
      { title: 'Recibir mercancía', desc: 'Haz clic en "Recepción", busca los productos recibidos y escribe las cantidades. El stock se suma automáticamente.' },
      { title: 'Importar masivo', desc: 'Usa "Importar" para cargar un Excel con muchos productos a la vez. Descarga la plantilla para ver el formato.' },
    ],
    tips: ['Rojo = stock cero. Amarillo = por debajo del mínimo configurado.', 'Agregar fotos ayuda al cajero a identificar productos rápido en el POS.'],
    actions: ['Nuevo Producto', 'Recepción', 'Importar Excel', 'Exportar'],
  },
  'inventory/categorias': {
    title: 'Categorías', icon: '🏷️',
    description: 'Organiza tus productos en grupos para filtrar en el POS y aplicar reglas de comisión.',
    steps: [
      { title: 'Nueva categoría', desc: 'Haz clic en "Nueva Categoría". Escribe el nombre (ej: Celulares, Accesorios, Repuestos).' },
      { title: 'Asignar a productos', desc: 'La categoría se asigna desde el formulario de cada producto.' },
    ],
    tips: ['Mantén pocas categorías bien definidas — facilita la búsqueda en el POS y los reportes.'],
    actions: ['Nueva Categoría', 'Editar', 'Eliminar'],
  },
  'inventory/kardex': {
    title: 'Kardex', icon: '📋',
    description: 'Registro completo de todos los movimientos de inventario: entradas, salidas, ajustes y traslados.',
    steps: [
      { title: 'Buscar producto', desc: 'Selecciona el producto. Verás todos sus movimientos en orden cronológico.' },
      { title: 'Filtrar por fecha', desc: 'Usa el selector de fechas para ver un período específico.' },
      { title: 'Tipos de movimiento', desc: 'ENTRADA: mercancía recibida. SALIDA: venta realizada. TRASLADO: movimiento entre almacenes.' },
    ],
    tips: ['Si el stock físico no coincide con el sistema, usa el Kardex para encontrar cuándo ocurrió la diferencia.'],
    actions: ['Buscar producto', 'Filtrar por fecha', 'Exportar Excel'],
  },
  'inventory/traslados': {
    title: 'Traslados', icon: '🔄',
    description: 'Mueve productos de un almacén a otro. Ideal para mover mercancía de bodega al local.',
    steps: [
      { title: 'Nuevo traslado', desc: 'Selecciona el almacén origen y destino. Agrega los productos y cantidades.' },
      { title: 'Confirmar', desc: 'Al confirmar, el stock se descuenta del origen y se suma al destino automáticamente.' },
    ],
    tips: ['Para sucursales en diferentes sistemas, usa "Traslado Externo".'],
    actions: ['Nuevo Traslado', 'Confirmar', 'Ver historial'],
  },
  'inventory/almacenes': {
    title: 'Almacenes', icon: '🏭',
    description: 'Espacios físicos donde guardas tu inventario: bodega, local, depósito, sucursales.',
    steps: [
      { title: 'Nuevo almacén', desc: 'Haz clic en "Nuevo Almacén". Escribe el nombre y dirección.' },
      { title: 'Almacén activo en POS', desc: 'En Configuración → Estación POS elige de qué almacén descuentan las ventas.' },
    ],
    tips: ['Si solo tienes un local, un almacén es suficiente.'],
    actions: ['Nuevo Almacén', 'Editar', 'Ver stock por almacén'],
  },
  'inventory/seriales': {
    title: 'Seriales / IMEI', icon: '🔢',
    description: 'Control individual de productos con número de serie único (celulares, equipos, etc.).',
    steps: [
      { title: 'Registrar seriales', desc: 'Al recibir mercancía serializada, ingresa o escanea el serial de cada unidad.' },
      { title: 'Buscar un serial', desc: 'Encuentra cualquier serial para ver cuándo fue vendido y a qué cliente.' },
    ],
    tips: ['Solo aplica a productos marcados con "Requiere Serial" al crearse.'],
    actions: ['Registrar seriales', 'Buscar serial', 'Ver vendidos'],
  },
  'reports/resumen': {
    title: 'Resumen de Reportes', icon: '📈',
    description: 'Indicadores consolidados del período: ingresos, ganancia, transacciones y métodos de pago.',
    steps: [
      { title: 'Seleccionar período', desc: 'Elige fechas de inicio y fin. Por defecto muestra el mes actual vs el anterior.' },
      { title: 'Leer los KPIs', desc: 'Cada cuadro muestra el valor actual y el % de variación vs el período anterior.' },
      { title: 'Analizar el gráfico', desc: 'El área de ventas por día muestra los picos de actividad del período.' },
      { title: 'Métodos de pago', desc: 'El donut muestra cómo pagan tus clientes: efectivo, Zelle, transferencia, etc.' },
    ],
    tips: ['Compara el mismo mes del año pasado para ver si el negocio está creciendo.'],
    actions: ['Seleccionar período', 'Exportar Excel', 'Imprimir'],
  },
  'reports/ventas': {
    title: 'Reporte de Ventas', icon: '🛒',
    description: 'Detalle de cada venta del período: productos, vendedor, método de pago y monto.',
    steps: [
      { title: 'Filtrar por fecha', desc: 'Selecciona el rango de fechas para ver las ventas de ese período.' },
      { title: 'Buscar una venta', desc: 'Escribe el nombre del cliente o número de venta.' },
      { title: 'Ver el detalle', desc: 'Haz clic en una venta para ver los productos, precios y descuentos aplicados.' },
    ],
    tips: ['Las ventas en rojo han sido anuladas o tienen devolución.', 'El total "Neto" descuenta las devoluciones.'],
    actions: ['Filtrar', 'Ver detalle', 'Exportar Excel'],
  },
  'reports/caja': {
    title: 'Reporte de Caja', icon: '🏦',
    description: 'Resumen de cada turno de caja: apertura, ventas, egresos y cierre.',
    steps: [
      { title: 'Seleccionar período', desc: 'Elige las fechas para ver los turnos de esos días.' },
      { title: 'Leer por turno', desc: 'Cada fila es un turno: apertura, ingresos, egresos, diferencia y cierre.' },
      { title: 'Imprimir Z-Report', desc: 'Haz clic en el ícono de impresora para el resumen de cierre de ese día.' },
    ],
    tips: ['Una diferencia de cierre distinta de cero indica descuadre — investiga con el Kardex.'],
    actions: ['Ver por período', 'Imprimir Z-Report', 'Exportar'],
  },
  'reports/creditos': {
    title: 'Reporte de Créditos', icon: '📑',
    description: 'Análisis de cuentas por cobrar: quién debe, cuánto y desde cuándo.',
    steps: [
      { title: 'Ver el resumen', desc: 'Cuadros con total adeudado, clientes con deuda y monto vencido.' },
      { title: 'Analizar aging', desc: 'Agrupa deudas por antigüedad: 0-30 días (normal), 31-60 (atención), +60 (urgente).' },
      { title: 'Exportar para cobro', desc: 'Exporta a Excel con la lista completa de deudores.' },
    ],
    tips: ['El aging es el reporte más importante para la salud financiera del negocio.'],
    actions: ['Ver aging', 'Detalle por cliente', 'Exportar'],
  },
  'reports/proveedores': {
    title: 'Reporte de Proveedores', icon: '🚚',
    description: 'Compras por proveedor, deudas pendientes e historial de pagos.',
    steps: [
      { title: 'Ver compras', desc: 'Monto total comprado a cada proveedor en el período.' },
      { title: 'Ver deudas', desc: 'Cuánto debes actualmente a cada proveedor.' },
    ],
    tips: ['Identifica tus proveedores principales para negociar mejores condiciones.'],
    actions: ['Filtrar', 'Ver por proveedor', 'Exportar'],
  },
  'reports/inventario': {
    title: 'Reporte de Inventario', icon: '📦',
    description: 'Valoración del inventario: cuánto tienes, cuánto vale al costo y al precio de venta.',
    steps: [
      { title: 'Ver valoración', desc: 'Valor al costo (lo invertido) y al precio de venta (lo que podrías recibir).' },
      { title: 'Sin movimiento', desc: 'Productos que no han vendido en el período — capital inmovilizado.' },
      { title: 'Exportar', desc: 'Excel con todos los productos, stock actual y valor total.' },
    ],
    tips: ['Productos sin vender más de 90 días son candidatos para promoción o liquidación.'],
    actions: ['Ver valoración', 'Exportar Excel', 'Filtrar por categoría'],
  },
  'reports/comisiones': {
    title: 'Comisiones', icon: '💰',
    description: 'Cuánto ha generado cada vendedor y técnico, qué está pendiente de pagar.',
    steps: [
      { title: 'Ver por empleado', desc: 'Cada tarjeta muestra total generado y pendiente de pago.' },
      { title: 'Pagar comisión', desc: 'Haz clic en "Pagar", elige el monto y método. Se registra el egreso en caja.' },
      { title: 'Ver el detalle', desc: 'Haz clic en el empleado para ver comisión por venta.' },
    ],
    tips: ['Las comisiones se generan automáticamente al vender o cobrar una orden del taller.'],
    actions: ['Ver por empleado', 'Pagar comisión', 'Ver detalle', 'Exportar'],
  },
  'services/dashboard': {
    title: 'Taller — Panel Principal', icon: '🔧',
    description: 'Vista general de todas las órdenes de servicio activas: qué está en reparación, qué está listo para cobrar.',
    steps: [
      { title: 'Nueva orden', desc: 'Haz clic en "Nueva Orden". El asistente te guía: cliente → equipo → diagnóstico → confirmación.' },
      { title: 'Filtrar por estado', desc: 'Usa los filtros de estado para ver solo las órdenes en ese paso.' },
      { title: 'Cambiar estado', desc: 'Haz clic en una orden y usa el stepper de estado para avanzar la reparación.' },
      { title: 'Cobrar', desc: 'Con la orden en LISTO, aparece el botón verde "Cobrar". Confirma el pago y se generan las comisiones.' },
    ],
    tips: ['Órdenes en amarillo llevan más de 3 días sin movimiento — revísalas.', 'Asigna siempre un técnico para que las comisiones se calculen correctamente.'],
    actions: ['Nueva Orden', 'Filtrar por estado', 'Cobrar', 'Ver plantillas'],
  },
  'services/order-detail': {
    title: 'Detalle de Orden', icon: '📋',
    description: 'Gestiona una orden específica: agrega trabajos, cambia el estado y cobra.',
    steps: [
      { title: 'Agregar ítems', desc: 'Haz clic en "+ Agregar". Elige "Repuesto del Inventario" (descuenta stock) o "Servicio Manual" (mano de obra). Asigna el técnico.' },
      { title: 'Cambiar estado', desc: 'Usa el stepper: Recibido → Diagnóstico → Aprobado → En Proceso → Listo.' },
      { title: 'Registrar abono', desc: 'Si el cliente paga parcialmente, usa "Registrar Abono". Puedes tomar varios abonos.' },
      { title: 'Cobrar', desc: 'Con la orden en LISTO, presiona "Cobrar". Esto crea la venta y genera las comisiones del técnico y cajero.' },
    ],
    tips: ['"Aprobado" significa que el cliente ya autorizó el presupuesto de reparación.'],
    actions: ['Agregar ítem', 'Cambiar estado', 'Registrar abono', 'Cobrar', 'Imprimir'],
  },
  'config/general': {
    title: 'Configuración General', icon: '🏪',
    description: 'Datos de tu negocio: nombre, logo, RIF y dirección. Aparecen en tickets y documentos.',
    steps: [
      { title: 'Datos del negocio', desc: 'Completa nombre, dirección, teléfono y RIF.' },
      { title: 'Subir logo', desc: 'Imagen cuadrada de al menos 200x200px. Aparece en tickets y login.' },
    ],
    tips: ['El RIF es importante si tus clientes piden facturas con datos fiscales.'],
    actions: ['Guardar cambios', 'Subir logo'],
  },
  'config/usuarios': {
    title: 'Usuarios del Sistema', icon: '👤',
    description: 'Crea y gestiona las cuentas de acceso del personal con sus roles y permisos.',
    steps: [
      { title: 'Crear usuario', desc: 'Haz clic en "Nuevo Usuario". Asigna nombre, usuario, contraseña y rol.' },
      { title: 'Roles disponibles', desc: 'ADMIN: acceso total. CAJERO: solo POS, ventas y taller.' },
      { title: 'Desactivar', desc: 'Si un empleado sale, desactívalo en lugar de eliminarlo. Así conservas su historial.' },
    ],
    tips: ['Nunca compartas la contraseña de admin con los cajeros.'],
    actions: ['Nuevo Usuario', 'Cambiar contraseña', 'Activar/Desactivar'],
  },
  'config/monedas': {
    title: 'Monedas y Tasas', icon: '💱',
    description: 'Configura las monedas aceptadas y las tasas de cambio. El sistema convierte automáticamente.',
    steps: [
      { title: 'Moneda base', desc: 'El dólar (USD) es la moneda base. Los precios se guardan en USD.' },
      { title: 'Activar bolívares', desc: 'Activa VES e ingresa la tasa del BCV. El POS convierte automáticamente.' },
      { title: 'Actualizar tasa', desc: 'Actualiza cada día hábil. Puedes activar la actualización automática desde el BCV.' },
    ],
    tips: ['La tasa desactualizada muestra un punto amarillo o rojo en el header.'],
    actions: ['Actualizar tasa BCV', 'Agregar moneda', 'Tasa automática'],
  },
  'config/comisiones': {
    title: 'Comisiones', icon: '💰',
    description: 'Configura el sistema de comisiones para vendedores y técnicos.',
    steps: [
      { title: 'Activar el sistema', desc: 'El interruptor principal activa las comisiones para todo el negocio.' },
      { title: 'Elegir módulos', desc: 'Activa para POS, Taller o ambos. También puedes dar comisión adicional a la cajera que gestiona órdenes.' },
      { title: 'Tasas por usuario', desc: 'Asigna el % a cada empleado: % Vendedor para ventas POS, % Técnico para taller.' },
      { title: 'Reglas por categoría', desc: 'Define que una categoría paga X% sin importar el vendedor. Tiene prioridad sobre el % del usuario.' },
    ],
    tips: ['Jerarquía: Regla de categoría > % del usuario > sin comisión.'],
    actions: ['Activar', 'Configurar módulos', 'Tasas por usuario', 'Reglas por categoría'],
  },
  'config/pagos': {
    title: 'Métodos de Pago', icon: '💳',
    description: 'Define qué formas de cobro están disponibles en el POS.',
    steps: [
      { title: 'Activar método', desc: 'Solo los métodos activos aparecen en el POS al cobrar.' },
      { title: 'Cuentas bancarias', desc: 'Para Transferencia y Pago Móvil, agrega los datos bancarios que verá el cliente.' },
    ],
    tips: ['Activa solo los métodos que realmente usas para simplificar el cobro.'],
    actions: ['Activar/desactivar', 'Agregar cuenta bancaria', 'Guardar'],
  },
  'config/impuestos': {
    title: 'Impuestos', icon: '📑',
    description: 'Configura IVA, IGTF y otros impuestos aplicables a tus ventas.',
    steps: [
      { title: 'Activar IVA', desc: 'Ingresa el porcentaje de IVA aplicable (generalmente 16% en Venezuela). Se suma automáticamente en los documentos fiscales.' },
      { title: 'IGTF', desc: 'El Impuesto a las Grandes Transacciones Financieras (3%) se aplica automáticamente a pagos en divisas según la normativa venezolana.' },
    ],
    tips: ['El IVA solo aplica si tu negocio es contribuyente formal. Consulta a tu contador.'],
    actions: ['Activar IVA', 'Configurar IGTF', 'Guardar'],
  },
  'config/impresoras': {
    title: 'Impresoras', icon: '🖨️',
    description: 'Conecta impresoras térmicas ESC/POS para imprimir tickets de venta y órdenes.',
    steps: [
      { title: 'Instalar el Bridge', desc: 'Descarga e instala el Hardware Bridge en la PC que tiene la impresora conectada.' },
      { title: 'Conectar impresora', desc: 'Con el Bridge activo, haz clic en "Detectar" y selecciona tu impresora de la lista.' },
      { title: 'Probar impresión', desc: 'Usa el botón "Prueba" para verificar que el ticket salga correctamente.' },
    ],
    tips: ['El Bridge debe estar abierto en la PC para que funcione la impresión desde el sistema.'],
    actions: ['Detectar impresora', 'Prueba de impresión', 'Configurar papel'],
  },
  'config/garantias': {
    title: 'Políticas de Garantía', icon: '🛡️',
    description: 'Define los períodos de garantía que puedes asignar a productos y órdenes de servicio.',
    steps: [
      { title: 'Nueva política', desc: 'Haz clic en "Nueva Política". Define el nombre (ej: "30 días") y la duración en días.' },
      { title: 'Política predeterminada', desc: 'Marca una como predeterminada para que se asigne automáticamente.' },
    ],
    tips: ['Puedes crear varias políticas: 30 días para accesorios, 90 días para equipos reparados.'],
    actions: ['Nueva política', 'Editar', 'Marcar como predeterminada'],
  },
  'config/pos': {
    title: 'Estación POS', icon: '🖥️',
    description: 'Opciones avanzadas del punto de venta: almacén activo, comportamiento y accesos directos.',
    steps: [
      { title: 'Almacén activo', desc: 'Selecciona de qué almacén descuenta las ventas esta estación. Cada PC puede tener un almacén diferente.' },
      { title: 'Tema visual', desc: 'Cambia el color del POS para diferenciar cajas o adaptarlo a la preferencia del cajero.' },
    ],
    tips: ['Los cambios aplican solo a la estación (PC) donde los configures.'],
    actions: ['Seleccionar almacén', 'Cambiar tema', 'Guardar'],
  },
  'config/auditoria': {
    title: 'Auditoría', icon: '🔍',
    description: 'Registro completo de todas las acciones realizadas en el sistema por todos los usuarios.',
    steps: [
      { title: 'Filtrar por usuario', desc: 'Selecciona un usuario específico para ver todas sus acciones.' },
      { title: 'Filtrar por tipo', desc: 'Filtra por tipo de acción: creación, edición, eliminación, login, etc.' },
      { title: 'Filtrar por fecha', desc: 'Consulta qué pasó en una fecha específica.' },
    ],
    tips: ['Cada acción registra: qué se hizo, quién lo hizo y a qué hora. Es tu herramienta de control.'],
    actions: ['Filtrar por usuario', 'Filtrar por tipo', 'Filtrar por fecha', 'Exportar'],
  },
  cash: {
    title: 'Apertura y Cierre de Caja', icon: '🏧',
    description: 'Controla los turnos de caja: abre con el dinero base y cierra contando el efectivo al final del día.',
    steps: [
      { title: 'Abrir el turno', desc: 'Al inicio del día haz clic en "Abrir Turno". Cuenta el dinero físico e ingrésalo como saldo inicial.' },
      { title: 'Registrar egresos', desc: 'Si usas efectivo de la caja para gastos, regístralos como "Egreso" para que el cuadre sea correcto.' },
      { title: 'Cerrar el turno', desc: 'Al final del día haz clic en "Cerrar Turno". Cuenta el efectivo físico e ingrésalo. El sistema muestra la diferencia.' },
      { title: 'Imprimir Z-Report', desc: 'Al cerrar, imprime el resumen del turno como comprobante del día.' },
    ],
    tips: ['Una diferencia positiva al cerrar (sobrante) puede indicar un error de cobro.', 'Cierra la caja todos los días aunque no hayas vendido nada.'],
    actions: ['Abrir turno', 'Registrar egreso', 'Cerrar turno', 'Imprimir Z-Report'],
  },
};
