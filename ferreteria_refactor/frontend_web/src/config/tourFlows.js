
export const TOUR_FLOWS = {
    GLOBAL: {
        id: 'global',
        title: 'Tour Rápido',
        description: 'Resumen esencial del Dashboard y navegación.',
        startUrl: '/',
        steps: [
            {
                element: '#sidebar-dashboard',
                popover: {
                    title: '🚀 Dashboard Principal',
                    description: 'Tu centro de comando. Aquí verás métricas clave, alertas de stock y resumen de ventas en tiempo real.',
                    side: "right",
                    align: 'start'
                }
            },
            {
                element: '#sidebar-group-inventario',
                popover: {
                    title: '📦 Inventario',
                    description: 'Gestiona productos, almacenes y movimientos. Todo lo relacionado con tu stock está aquí.',
                    side: "right", align: 'start'
                }
            },
            {
                element: '#sidebar-group-ventas',
                popover: {
                    title: '💰 Ventas',
                    description: 'Punto de Venta (POS), clientes y facturación. La herramienta diaria para tus cajeros.',
                    side: "right", align: 'start'
                }
            },
            {
                element: '#sidebar-group-finanzas',
                popover: {
                    title: '💼 Finanzas',
                    description: 'Control de caja, compras a proveedores y cuentas por pagar/cobrar.',
                    side: "right", align: 'start'
                }
            },
            {
                element: '#sidebar-group-sistema',
                popover: {
                    title: '⚙️ Sistema',
                    description: 'Configuración global, usuarios y seguridad.',
                    side: "right", align: 'start'
                }
            }
        ]
    },
    FULL_SYSTEM: {
        id: 'full_system',
        title: 'Recorrido Maestro del Sistema',
        description: 'Paseo completo por todos los módulos principales del ERP.',
        startUrl: '/',
        steps: [
            // INTRO
            {
                element: '#sidebar-dashboard',
                popover: { title: 'Bienvenido', description: 'Comencemos un recorrido completo por tu nuevo sistema ERP.' }
            },

            // INVENTORY MODULE
            {
                navigate: '/products',
                element: '#btn-add-product',
                popover: { title: '1. Inventario: Productos', description: 'Aquí gestionas tu catálogo. Puedes crear productos, servicios o kits.' }
            },
            {
                navigate: '/categories',
                element: 'table', // Fallback if no ID
                popover: { title: '2. Categorías', description: 'Organiza tus productos en familias y subfamilias para facilitar la búsqueda y reportes.' }
            },
            {
                navigate: '/inventory',
                element: 'h1',
                popover: { title: '3. Movimientos', description: 'Registra entradas, salidas manuales y ajustes de inventario fuera de las ventas/compras.' }
            },

            // SALES MODULE
            {
                navigate: '/pos',
                element: '.pos-container', // Ensure this exists or use broad selector
                popover: { title: '4. Punto de Venta (POS)', description: 'La terminal de venta rápida. Optimizada para lectores de código de barras y uso ágil.' }
            },
            {
                navigate: '/sales-history',
                element: 'table',
                popover: { title: '5. Historial de Ventas', description: 'Consulta todas las transacciones pasadas, reimprime tickets o realiza devoluciones.' }
            },

            // FINANCE MODULE
            {
                navigate: '/purchases',
                element: '#btn-new-purchase',
                popover: { title: '6. Compras y Gastos', description: 'Registra facturas de proveedores para alimentar tu stock y controlar costos.' }
            },
            {
                navigate: '/cash-history',
                element: 'h1',
                popover: { title: '7. Cortes de Caja', description: 'Supervisa las aperturas y cierres de caja de tus empleados.' }
            },

            // SYSTEM
            {
                navigate: '/settings',
                element: 'h1',
                popover: { title: '8. Configuración', description: 'Ajusta impuestos, datos de la empresa e impresoras desde aquí.' }
            }
        ]
    },
    INVENTORY_FLOW: {
        id: 'inventory_flow',
        title: 'Módulo de Inventario',
        description: 'Guía detallada de gestión de stock.',
        startUrl: '/products',
        steps: [
            {
                element: '#btn-add-product',
                popover: { title: 'Crear Producto', description: 'Usa este botón para registrar un nuevo ítem en el sistema.' }
            },
            {
                navigate: '/warehouses',
                element: 'h1',
                popover: { title: 'Almacenes', description: 'Gestiona múltiples bodegas o sucursales si tu plan lo permite.' }
            },
            {
                navigate: '/transfers',
                element: '#btn-new-transfer',
                popover: { title: 'Traslados', description: 'Mueve mercancía entre tus diferentes almacenes de forma controlada.' }
            }
        ]
    },
    SALES_FLOW: {
        id: 'sales_flow',
        title: 'Ventas y POS',
        description: 'Todo lo necesario para facturar.',
        startUrl: '/pos',
        steps: [
            {
                element: '.pos-search-input', // Need to check this class
                popover: { title: 'Buscador Inteligente', description: 'Escribe nombre, código o escanea para agregar productos.' }
            },
            {
                element: '.pos-customer-select', // Need to check this class
                popover: { title: 'Asignar Cliente', description: 'Selecciona un cliente registrado o ventas al público en general.' }
            },
            {
                navigate: '/quotes',
                element: '#btn-new-quote',
                popover: { title: 'Cotizaciones', description: 'Crea presupuestos formales que luego puedes convertir en ventas.' }
            }
        ]
    },
    FINANCE_FLOW: {
        id: 'finance_flow',
        title: 'Finanzas y Compras',
        description: 'Gestión de dinero y proveedores.',
        startUrl: '/purchases',
        steps: [
            {
                element: '#btn-new-purchase',
                popover: { title: 'Registrar Compra', description: 'Ingresa la mercancía recibida y genera la cuenta por pagar.' }
            },
            {
                navigate: '/suppliers',
                element: '#btn-add-supplier',
                popover: { title: 'Proveedores', description: 'Administra tu directorio de proveedores y sus condiciones de crédito.' }
            },
            {
                navigate: '/accounts-payable',
                element: 'table',
                popover: { title: 'Cuentas por Pagar', description: 'Monitorea tus deudas y programa tus pagos para mantener sanas tus finanzas.' }
            }
        ]
    },
    SYSTEM_FLOW: {
        id: 'system_flow',
        title: 'Administración del Sistema',
        description: 'Seguridad y configuración.',
        startUrl: '/users',
        steps: [
            {
                element: '#btn-add-user',
                popover: { title: 'Usuarios', description: 'Crea cuentas para tu personal y asigna roles (Cajero, Gerente, Admin).' }
            },
            {
                navigate: '/audit-logs',
                element: 'table',
                popover: { title: 'Auditoría', description: 'Rastrea quién hizo qué y cuándo. Seguridad total sobre las acciones sensibles.' }
            },
            {
                navigate: '/settings',
                element: 'form',
                popover: { title: 'Ajustes Generales', description: 'Configura el logo, dirección, impuestos y preferencias de impresión.' }
            }
        ]
    }
};
