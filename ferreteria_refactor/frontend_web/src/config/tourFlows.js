
export const TOUR_FLOWS = {
    // =============================================
    // TOUR 1: BIENVENIDA (Core - siempre visible)
    // =============================================
    WELCOME: {
        id: 'welcome',
        title: 'Bienvenida al Sistema',
        description: 'Conoce tu panel principal y la navegación general.',
        startUrl: '/',
        module: null,
        steps: [
            {
                element: '#tour-dashboard-container',
                popover: {
                    title: '¡Bienvenido a Mi Inventario Fácil!',
                    description: 'Este es tu Dashboard principal. Aquí verás un resumen en tiempo real de ventas, ganancias y alertas importantes de tu negocio.',
                    side: 'bottom', align: 'center'
                }
            },
            {
                element: '#sidebar-dashboard',
                popover: {
                    title: 'Menú de Navegación',
                    description: 'Desde el menú lateral puedes acceder a todos los módulos: Inventario, Ventas, Finanzas y Configuración. Haz clic en cualquier sección para expandirla.',
                    side: 'right', align: 'start'
                }
            },
            {
                element: '#sidebar-group-inventario',
                popover: {
                    title: 'Inventario',
                    description: 'Gestiona tus productos, categorías, almacenes y movimientos de stock. Todo lo relacionado con tu mercancía está aquí.',
                    side: 'right', align: 'start'
                }
            },
            {
                element: '#sidebar-group-ventas',
                popover: {
                    title: 'Ventas',
                    description: 'Accede al Punto de Venta (POS), historial de ventas, clientes y cotizaciones. Es el módulo que usarás a diario.',
                    side: 'right', align: 'start'
                }
            },
            {
                element: '#sidebar-group-finanzas',
                popover: {
                    title: 'Finanzas',
                    description: 'Controla la caja, compras a proveedores, cuentas por pagar y cobrar. Mantén tus finanzas organizadas.',
                    side: 'right', align: 'start'
                }
            },
            {
                element: '#sidebar-group-sistema',
                popover: {
                    title: 'Configuración',
                    description: 'Ajusta los datos de tu empresa, usuarios, roles, impuestos y preferencias de impresión.',
                    side: 'right', align: 'start'
                }
            }
        ]
    },

    // =============================================
    // TOUR 2: POS COMPLETO (Core)
    // =============================================
    POS_COMPLETE: {
        id: 'pos_complete',
        title: 'Punto de Venta (POS)',
        description: 'Aprende a facturar, buscar productos, pausar ventas y cobrar.',
        startUrl: '/pos',
        module: null,
        steps: [
            {
                element: '#tour-pos-container',
                popover: {
                    title: 'Tu Terminal de Ventas',
                    description: 'Este es el Punto de Venta. Está dividido en dos secciones: el catálogo de productos a la izquierda y el carrito de compras a la derecha.',
                    side: 'bottom', align: 'center'
                }
            },
            {
                element: '#tour-pos-search',
                popover: {
                    title: 'Buscar Productos (F3)',
                    description: 'Escribe el nombre o código del producto para buscarlo. También puedes escanear un código de barras con el ícono de la cámara. Presiona F3 para enfocar este campo rápidamente.',
                    side: 'bottom', align: 'start'
                }
            },
            {
                element: '#tour-pos-cart',
                popover: {
                    title: 'Carrito de Compras',
                    description: 'Los productos agregados aparecen aquí con su cantidad y precio. Puedes editar cantidades con +/-, hacer clic en un ítem para editar su precio, o eliminarlo con el ícono de basura.',
                    side: 'left', align: 'start'
                }
            },
            {
                element: '#tour-pos-hold-btn',
                popover: {
                    title: 'Pausar Venta (F6)',
                    description: '¿El cliente olvidó su billetera? Presiona "Pausar" para guardar la venta actual temporalmente. Puedes atender a otro cliente y luego retomar la venta pausada.',
                    side: 'bottom', align: 'center'
                }
            },
            {
                element: '#tour-pos-pay-btn',
                popover: {
                    title: 'Cobrar (F5)',
                    description: 'Cuando estés listo para cobrar, presiona este botón o F5. Se abrirá el modal de pago donde podrás seleccionar el método (efectivo, tarjeta, transferencia), calcular el vuelto y completar la venta.',
                    side: 'top', align: 'center'
                }
            },
            {
                element: '#tour-pos-settings',
                popover: {
                    title: 'Configuración de Estación',
                    description: 'Personaliza tu terminal: cambia el tema visual, el almacén desde el que vendes y otras preferencias de tu estación de trabajo.',
                    side: 'bottom', align: 'end'
                }
            },
            {
                popover: {
                    title: 'Atajos de Teclado',
                    description: 'Domina el POS con estos atajos:\n• F2 — Nueva venta (limpiar carrito)\n• F3 — Buscar producto\n• F4 — Editar último ítem\n• F5 — Cobrar\n• F6 — Pausar/Retomar venta\n• ↑↓ — Navegar productos\n• Enter — Agregar seleccionado',
                }
            }
        ]
    },

    // =============================================
    // TOUR 3: INVENTARIO COMPLETO (Core)
    // =============================================
    INVENTORY_COMPLETE: {
        id: 'inventory_complete',
        title: 'Gestión de Inventario',
        description: 'Productos, categorías, almacenes y movimientos de stock.',
        startUrl: '/inventory-center?tab=productos',
        module: null,
        steps: [
            {
                element: '#tour-products-add-btn',
                popover: {
                    title: 'Crear Producto',
                    description: 'Haz clic aquí para registrar un nuevo producto. Podrás definir nombre, precio, stock inicial, categoría, código de barras y hasta múltiples presentaciones (ej: unidad, caja, paquete).',
                    side: 'bottom', align: 'end'
                }
            },
            {
                popover: {
                    title: 'Tipos de Productos',
                    description: 'Puedes crear:\n• Productos con stock — Mercancía física que se descuenta al vender\n• Servicios — Sin control de stock (ej: reparación, corte)\n• Kits/Combos — Agrupan varios productos en un precio especial',
                }
            },
            {
                navigate: '/inventory-center?tab=categorias',
                element: '#tour-categories-add-btn',
                popover: {
                    title: 'Categorías',
                    description: 'Organiza tu inventario en categorías y subcategorías. Esto te ayudará a filtrar productos en el POS y generar reportes más detallados.',
                    side: 'bottom', align: 'end'
                }
            },
            {
                navigate: '/inventory-center?tab=almacenes',
                element: '#tour-warehouses-add-btn',
                popover: {
                    title: 'Almacenes',
                    description: 'Si tienes varias bodegas o sucursales, créalas aquí. Cada almacén maneja su propio stock de forma independiente.',
                    side: 'bottom', align: 'end'
                }
            },
            {
                navigate: '/inventory-center?tab=traslados',
                element: '#tour-transfers-add-btn',
                popover: {
                    title: 'Traslados',
                    description: 'Mueve mercancía entre almacenes de forma controlada. Selecciona origen, destino, productos y cantidades.',
                    side: 'bottom', align: 'end'
                }
            },
            {
                navigate: '/inventory-center?tab=kardex',
                element: '#tour-inventory-add-btn',
                popover: {
                    title: 'Ajustes de Inventario (Kardex)',
                    description: 'Aquí puedes ver el historial completo de entradas y salidas (Kardex). También puedes registrar ajustes manuales: entradas por conteo físico, salidas por daño, uso interno, etc.',
                    side: 'bottom', align: 'end'
                }
            },
            {
                popover: {
                    title: 'Alertas de Stock Bajo',
                    description: 'El sistema te alertará automáticamente en el Dashboard cuando un producto baje de su stock mínimo. Configura el stock mínimo al crear o editar cada producto.',
                }
            }
        ]
    },

    // =============================================
    // TOUR 4: VENTAS Y CLIENTES (Core)
    // =============================================
    SALES_CLIENTS: {
        id: 'sales_clients',
        title: 'Ventas y Clientes',
        description: 'Historial de ventas, cotizaciones y gestión de clientes.',
        startUrl: '/sales-history',
        module: null,
        steps: [
            {
                element: '#tour-sales-container',
                popover: {
                    title: 'Historial de Ventas',
                    description: 'Aquí puedes consultar todas las ventas realizadas. Filtra por fecha, método de pago o estado. Haz clic en una venta para ver su detalle completo.',
                    side: 'bottom', align: 'center'
                }
            },
            {
                popover: {
                    title: 'Acciones sobre Ventas',
                    description: 'Desde el detalle de una venta puedes:\n• Reimprimir el ticket o factura\n• Generar PDF de la factura\n• Anular la venta (requiere PIN de supervisor)',
                }
            },
            {
                navigate: '/customers',
                element: '#tour-customers-add-btn',
                popover: {
                    title: 'Gestión de Clientes',
                    description: 'Registra clientes con su nombre, teléfono, email y documento. Asigna límites de crédito y plazos de pago. Cada venta a crédito genera una cuenta por cobrar automática.',
                    side: 'bottom', align: 'end'
                }
            },
            {
                navigate: '/quotes',
                element: '#tour-quotes-add-btn',
                popover: {
                    title: 'Cotizaciones',
                    description: 'Crea presupuestos formales para tus clientes. Puedes enviarlos por PDF y luego convertirlos en una venta real con un clic desde el POS.',
                    side: 'bottom', align: 'end'
                }
            }
        ]
    },

    // =============================================
    // TOUR 5: FINANZAS (Core)
    // =============================================
    FINANCE: {
        id: 'finance',
        title: 'Finanzas y Caja',
        description: 'Caja, compras, proveedores y cuentas por pagar/cobrar.',
        startUrl: '/reports',
        module: null,
        steps: [
            {
                element: '#tour-cash-container',
                popover: {
                    title: 'Historial de Caja',
                    description: 'Cada cajero debe abrir y cerrar su caja diariamente. Aquí ves el historial de todos los cierres: ventas totales, efectivo esperado vs contado, y diferencias.',
                    side: 'bottom', align: 'center'
                }
            },
            {
                popover: {
                    title: 'Apertura y Cierre de Caja',
                    description: 'Al entrar al POS se te pedirá abrir caja con un monto inicial. Al cerrar, el sistema compara lo esperado con lo contado y genera un reporte Z automático.',
                }
            },
            {
                navigate: '/purchases',
                element: '#tour-purchases-add-btn',
                popover: {
                    title: 'Registrar Compras',
                    description: 'Cuando recibes mercancía de un proveedor, regístrala aquí. El stock se actualiza automáticamente y se genera la cuenta por pagar.',
                    side: 'bottom', align: 'end'
                }
            },
            {
                navigate: '/suppliers',
                element: '#tour-suppliers-add-btn',
                popover: {
                    title: 'Directorio de Proveedores',
                    description: 'Registra tus proveedores con nombre, teléfono, email y condiciones de crédito (días de plazo). Asocia cada compra a un proveedor para llevar el control.',
                    side: 'bottom', align: 'end'
                }
            },
            {
                navigate: '/accounts-payable',
                element: '#tour-payables-container',
                popover: {
                    title: 'Cuentas por Pagar',
                    description: 'Monitorea cuánto debes a cada proveedor. Ve las facturas pendientes, vencidas y registra pagos parciales o totales.',
                    side: 'bottom', align: 'center'
                }
            },
            {
                navigate: '/accounts-receivable',
                element: '#tour-receivables-container',
                popover: {
                    title: 'Cuentas por Cobrar',
                    description: 'Controla las ventas a crédito de tus clientes. Ve facturas pendientes, registra abonos y mantén el balance actualizado.',
                    side: 'bottom', align: 'center'
                }
            }
        ]
    },

    // =============================================
    // TOUR 6: SISTEMA Y SEGURIDAD (Core)
    // =============================================
    SYSTEM: {
        id: 'system',
        title: 'Sistema y Seguridad',
        description: 'Usuarios, roles, auditoría y configuración general.',
        startUrl: '/users',
        module: null,
        steps: [
            {
                element: '#tour-users-add-btn',
                popover: {
                    title: 'Crear Usuarios',
                    description: 'Crea cuentas para tu personal. Cada usuario tiene un rol que define qué puede hacer en el sistema.',
                    side: 'bottom', align: 'end'
                }
            },
            {
                popover: {
                    title: 'Roles Disponibles',
                    description: '• Admin — Control total del sistema\n• Cajero — Solo POS y caja\n• Almacén — Solo inventario y movimientos\n• Mesero — Solo toma de pedidos (restaurante)\n• Cocina — Solo pantalla de cocina (KDS)',
                }
            },
            {
                navigate: '/settings',
                element: '#tour-settings-container',
                popover: {
                    title: 'Configuración General',
                    description: 'Ajusta los datos de tu empresa (nombre, logo, dirección), configura impuestos, métodos de pago, monedas y tasas de cambio.',
                    side: 'bottom', align: 'center'
                }
            },
            {
                popover: {
                    title: 'Impresión y Hardware',
                    description: 'Conecta tu impresora térmica con la aplicación Invensoft Bridge para Windows. Soporta impresoras de 58mm y 80mm vía USB o red.',
                }
            }
        ]
    },

    // =============================================
    // TOUR 7: RESTAURANTE (Condicional)
    // =============================================
    RESTAURANT: {
        id: 'restaurant',
        title: 'Módulo de Restaurante',
        description: 'Mesas, cocina (KDS), pedidos y menú digital.',
        startUrl: '/restaurant/tables',
        module: 'restaurant',
        steps: [
            {
                element: '#tour-restaurant-tablemap',
                popover: {
                    title: 'Mapa de Mesas',
                    description: 'Visualiza todas tus mesas organizadas por zona. Los colores indican el estado: verde (libre), azul (ocupada), rojo (cuenta pedida). Haz clic en una mesa para tomar el pedido.',
                    side: 'bottom', align: 'center'
                }
            },
            {
                element: '#tour-restaurant-add-table',
                popover: {
                    title: 'Agregar Mesa',
                    description: 'Crea nuevas mesas asignándoles nombre, zona y capacidad. Puedes organizar por zonas como "Interior", "Terraza" o "Barra".',
                    side: 'bottom', align: 'end'
                }
            },
            {
                popover: {
                    title: 'Tomar un Pedido',
                    description: 'Haz clic en una mesa libre para abrirla. Se mostrará el menú donde puedes agregar platos, bebidas y notas especiales. El pedido se envía automáticamente a la cocina.',
                }
            },
            {
                navigate: '/restaurant/kitchen',
                element: '#tour-restaurant-kitchen',
                popover: {
                    title: 'Pantalla de Cocina (KDS)',
                    description: 'La cocina ve los pedidos en tiempo real con un temporizador. El personal marca cada plato como "Preparando" → "Listo". Las alertas sonoras avisan cuando llegan nuevos pedidos.',
                    side: 'bottom', align: 'center'
                }
            },
            {
                popover: {
                    title: 'Comandera Móvil',
                    description: 'Los meseros pueden tomar pedidos desde su celular. Ingresan con un PIN rápido, seleccionan la mesa y agregan los platos directamente desde el teléfono.',
                }
            },
            {
                popover: {
                    title: 'Cobrar una Mesa',
                    description: 'Cuando el cliente pide la cuenta, haz clic en la mesa y selecciona "Cobrar". Los productos del pedido se transfieren al POS para procesar el pago normalmente.',
                }
            }
        ]
    },

    // =============================================
    // TOUR 8: BARBERÍA (Condicional)
    // =============================================
    BARBERSHOP: {
        id: 'barbershop',
        title: 'Módulo de Barbería',
        description: 'Servicios, personal y comisiones.',
        startUrl: '/barbershop',
        module: 'barbershop',
        steps: [
            {
                element: '#tour-barbershop-container',
                popover: {
                    title: 'Panel de Barbería',
                    description: 'Desde aquí accedes a las tres áreas principales: Punto de Venta para cobrar servicios, gestión de personal y reportes de comisiones.',
                    side: 'bottom', align: 'center'
                }
            },
            {
                popover: {
                    title: 'Vender un Servicio',
                    description: 'En el POS, al seleccionar un servicio de barbería se te pedirá elegir el barbero/estilista que lo realizó. Esto permite calcular su comisión automáticamente.',
                }
            },
            {
                popover: {
                    title: 'Gestión de Personal',
                    description: 'Registra a tus barberos y estilistas con su porcentaje de comisión. Cada vez que realizan un servicio, el sistema calcula y acumula su comisión.',
                }
            },
            {
                popover: {
                    title: 'Reportes de Comisiones',
                    description: 'Consulta cuánto ha generado cada empleado en comisiones por periodo. Útil para liquidaciones semanales o quincenales.',
                }
            }
        ]
    },

    // =============================================
    // TOUR 9: LAVANDERÍA (Condicional)
    // =============================================
    LAUNDRY: {
        id: 'laundry',
        title: 'Módulo de Lavandería',
        description: 'Recepción de prendas, seguimiento y entrega.',
        startUrl: '/laundry',
        module: 'laundry',
        steps: [
            {
                element: '#tour-services-container',
                popover: {
                    title: 'Tablero de Lavandería',
                    description: 'Vista tipo Kanban con 4 columnas: Recibido → Procesando → Listo → Entregado. Arrastra las órdenes entre columnas o cambia su estado con un clic.',
                    side: 'bottom', align: 'center'
                }
            },
            {
                popover: {
                    title: 'Nueva Recepción',
                    description: 'Registra una nueva orden: selecciona el cliente, agrega las prendas con sus servicios (lavado, planchado, tintorería), define precios y fecha de entrega estimada.',
                }
            },
            {
                popover: {
                    title: 'Seguimiento de Estados',
                    description: '• Recibido — Las prendas llegaron al local\n• Procesando — Están siendo lavadas/tratadas\n• Listo — Terminadas, esperando al cliente\n• Entregado — Cliente recogió sus prendas',
                }
            },
            {
                popover: {
                    title: 'Cobro al Entregar',
                    description: 'Cuando el cliente viene a recoger, puedes enviar la orden directamente al POS para cobrar. También puedes registrar abonos parciales durante el proceso.',
                }
            }
        ]
    },

    // =============================================
    // TOUR 10: SERVICIOS TÉCNICOS (Condicional)
    // =============================================
    SERVICES: {
        id: 'services',
        title: 'Servicios Técnicos',
        description: 'Recepción de equipos, diagnóstico y reparación.',
        startUrl: '/laundry',
        module: 'services',
        steps: [
            {
                element: '#tour-services-container',
                popover: {
                    title: 'Tablero de Servicios',
                    description: 'Gestiona las órdenes de servicio técnico: recepción de equipos, diagnóstico, aprobación del presupuesto y entrega al cliente.',
                    side: 'bottom', align: 'center'
                }
            },
            {
                popover: {
                    title: 'Nueva Recepción',
                    description: 'Registra el equipo que trae el cliente: tipo, marca, modelo, problema reportado, accesorios que deja y una foto del estado inicial.',
                }
            },
            {
                popover: {
                    title: 'Diagnóstico y Presupuesto',
                    description: 'El técnico examina el equipo, registra el diagnóstico y crea un presupuesto con los repuestos y mano de obra necesarios. El cliente aprueba o rechaza.',
                }
            },
            {
                popover: {
                    title: 'Reparación y Entrega',
                    description: 'Una vez aprobado, el técnico trabaja en la reparación. Al terminar, la orden se marca como "Lista" y cuando el cliente recoge, se envía al POS para cobrar.',
                }
            }
        ]
    }
};
