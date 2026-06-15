
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


    POS_CHECKOUT: {
        id: 'pos_checkout',
        title: 'Cobrar en POS',
        description: 'Guia corta para pasar del carrito al cobro.',
        startUrl: '/pos',
        module: null,
        steps: [
            {
                element: '#tour-pos-cart',
                popover: {
                    title: 'Revisa el carrito',
                    description: 'Confirma productos, cantidades, seriales si aplica y total antes de cobrar. Si falta algo, vuelve al catalogo y agregalo.',
                    side: 'left', align: 'start'
                }
            },
            {
                element: '#tour-pos-pay-btn',
                popover: {
                    title: 'Abrir cobro',
                    description: 'Presiona Cobrar o F5. Se abrira el modal de pago con cliente, metodos, pagos mixtos, credito y confirmacion.',
                    side: 'top', align: 'center'
                }
            },
            {
                popover: {
                    title: 'Dentro del modal',
                    description: 'Selecciona metodo de pago, escribe el monto recibido y confirma solo cuando el sistema marque el pago como completo.'
                }
            }
        ]
    },

    POS_MIXED_PAYMENT: {
        id: 'pos_mixed_payment',
        title: 'Pago mixto',
        description: 'Cobrar una venta con dos o mas metodos de pago.',
        startUrl: '/pos',
        module: null,
        steps: [
            {
                element: '#tour-pos-pay-btn',
                popover: {
                    title: 'Primero abre Cobrar',
                    description: 'El pago mixto vive dentro del modal de cobro. Abre Cobrar cuando el carrito este listo.',
                    side: 'top', align: 'center'
                }
            },
            {
                element: '#tour-payment-add-row',
                popover: {
                    title: 'Agregar otro metodo',
                    description: 'Usa + Agregar para dividir el pago entre efectivo, punto, transferencia, Zelle u otros metodos activos.',
                    side: 'bottom', align: 'end'
                }
            },
            {
                element: '#tour-payment-methods',
                popover: {
                    title: 'Completa cada linea',
                    description: 'En cada linea elige metodo, moneda, monto y referencia si el metodo la exige. El sistema calcula cuanto falta.',
                    side: 'left', align: 'start'
                }
            },
            {
                element: '#tour-payment-confirm',
                popover: {
                    title: 'Confirmar solo cuando cuadre',
                    description: 'Cuando el pago este completo, confirma. Si falta monto o referencia, el boton queda bloqueado para evitar errores.',
                    side: 'top', align: 'center'
                }
            }
        ]
    },

    POS_CREDIT_SALE: {
        id: 'pos_credit_sale',
        title: 'Venta a credito',
        description: 'Registrar una venta que queda como cuenta por cobrar.',
        startUrl: '/pos',
        module: null,
        steps: [
            {
                element: '#tour-pos-pay-btn',
                popover: {
                    title: 'Abre el cobro',
                    description: 'La venta a credito se activa desde el modal de cobro. Primero agrega productos y abre Cobrar.',
                    side: 'top', align: 'center'
                }
            },
            {
                element: '#tour-payment-customer',
                popover: {
                    title: 'Cliente obligatorio',
                    description: 'Busca o registra el cliente. El credito siempre debe quedar asociado a una persona o empresa.',
                    side: 'left', align: 'start'
                }
            },
            {
                element: '#tour-payment-credit-toggle',
                popover: {
                    title: 'Activa Venta a Credito',
                    description: 'Al activar credito, el sistema consulta limite, deuda y bloqueos antes de permitir registrar la venta.',
                    side: 'left', align: 'center'
                }
            },
            {
                element: '#tour-payment-confirm',
                popover: {
                    title: 'Registrar credito',
                    description: 'Confirma solo si el cliente tiene credito disponible y no esta bloqueado. La deuda aparece en Creditos CxC.',
                    side: 'top', align: 'center'
                }
            }
        ]
    },

    POS_SERIAL_SALE: {
        id: 'pos_serial_sale',
        title: 'Venta con IMEI o serial',
        description: 'Seleccionar la unidad exacta al vender productos serializados.',
        startUrl: '/pos',
        module: null,
        steps: [
            {
                element: '#tour-pos-search',
                popover: {
                    title: 'Busca el producto serializado',
                    description: 'Agrega el producto desde el catalogo. Si maneja IMEI o serial, el sistema abrira el selector antes de enviarlo al carrito.',
                    side: 'bottom', align: 'start'
                }
            },
            {
                element: '#tour-serial-input',
                popover: {
                    title: 'Escanea o escribe el serial',
                    description: 'Usa el lector o escribe el IMEI. Presiona Enter para validar y agregar cada unidad.',
                    side: 'bottom', align: 'center'
                }
            },
            {
                element: '#tour-serial-confirm',
                popover: {
                    title: 'Completa la cantidad',
                    description: 'El boton se activa cuando escaneaste todos los seriales requeridos. Asi se descuenta la unidad exacta.',
                    side: 'top', align: 'center'
                }
            }
        ]
    },

    PURCHASES_LIST: {
        id: 'purchases_list',
        title: 'Compras',
        description: 'Historial y control de facturas de proveedor.',
        startUrl: '/purchases',
        module: null,
        steps: [
            {
                element: '#tour-purchases-container',
                popover: {
                    title: 'Centro de compras',
                    description: 'Aqui ves compras, estados de pago, totales y acceso rapido a nuevas recepciones.',
                    side: 'bottom', align: 'center'
                }
            },
            {
                element: '#tour-purchases-summary',
                popover: {
                    title: 'Resumen de deuda y compras',
                    description: 'Estos indicadores ayudan a ver cuanto se compro, cuanto se pago y que queda pendiente.',
                    side: 'bottom', align: 'center'
                }
            },
            {
                element: '#tour-purchases-list',
                popover: {
                    title: 'Historial de facturas',
                    description: 'Revisa cada compra, abre el detalle, registra pagos o anula si necesitas revertir una recepcion.',
                    side: 'top', align: 'center'
                }
            },
            {
                element: '#tour-purchases-add-btn',
                popover: {
                    title: 'Nueva compra',
                    description: 'Abre la recepcion de inventario para cargar proveedor, productos, costos, IMEIs y condicion de pago.',
                    side: 'bottom', align: 'end'
                }
            }
        ]
    },

    PURCHASES_CREATE: {
        id: 'purchases_create',
        title: 'Nueva compra',
        description: 'Registrar proveedor, productos, costos y condiciones.',
        startUrl: '/purchases/new',
        module: null,
        steps: [
            {
                element: '#tour-purchase-supplier',
                popover: {
                    title: 'Selecciona proveedor',
                    description: 'Toda compra debe quedar vinculada al proveedor correcto para controlar cuentas por pagar e historial de costos.',
                    side: 'bottom', align: 'start'
                }
            },
            {
                element: '#tour-purchase-product-search',
                popover: {
                    title: 'Agrega productos',
                    description: 'Busca por nombre o codigo. Tambien puedes crear un producto al vuelo si aun no existe en inventario.',
                    side: 'bottom', align: 'start'
                }
            },
            {
                element: '#tour-purchase-items',
                popover: {
                    title: 'Cantidades y costos',
                    description: 'Cada linea debe tener cantidad y costo correctos. El costo alimenta ganancia real, kardex y precio sugerido.',
                    side: 'top', align: 'center'
                }
            },
            {
                element: '#tour-purchase-conditions',
                popover: {
                    title: 'Condicion de pago',
                    description: 'Marca contado si ya pagaste, o credito si queda deuda con proveedor. Las notas ayudan a auditar despues.',
                    side: 'left', align: 'start'
                }
            },
            {
                element: '#tour-purchase-submit',
                popover: {
                    title: 'Procesar compra',
                    description: 'Al procesar, el stock sube, el kardex registra entrada y la deuda se crea si la compra fue a credito.',
                    side: 'top', align: 'center'
                }
            }
        ]
    },

    PURCHASES_IMEI: {
        id: 'purchases_imei',
        title: 'Compra con IMEI',
        description: 'Registrar seriales al recibir productos serializados.',
        startUrl: '/purchases/new',
        module: null,
        steps: [
            {
                element: '#tour-purchase-product-search',
                popover: {
                    title: 'Agrega el producto con IMEI',
                    description: 'El producto debe tener activo el control serial. Al agregarlo, la linea mostrara el campo de IMEIs o seriales.',
                    side: 'bottom', align: 'start'
                }
            },
            {
                element: '#tour-purchase-items',
                popover: {
                    title: 'Cantidad igual a seriales',
                    description: 'Si recibes 5 unidades, debes pegar o escanear 5 IMEIs unicos. Si no coincide, la compra no debe procesarse.',
                    side: 'top', align: 'center'
                }
            },
            {
                element: '#tour-purchase-submit',
                popover: {
                    title: 'Validacion final',
                    description: 'Antes de procesar, revisa que no haya duplicados y que cada IMEI pertenezca al producto correcto.',
                    side: 'top', align: 'center'
                }
            }
        ]
    },

    SERIALIZED_RECEPTION: {
        id: 'serialized_reception',
        title: 'Recepcion serializada',
        description: 'Ingreso rapido de IMEIs con asignacion de producto.',
        startUrl: '/inventory/serialized-reception',
        module: null,
        steps: [
            {
                element: '#tour-serialized-warehouse',
                popover: {
                    title: 'Almacen destino',
                    description: 'Elige donde entraran fisicamente las unidades antes de empezar a escanear.',
                    side: 'bottom', align: 'end'
                }
            },
            {
                element: '#tour-serialized-scanner',
                popover: {
                    title: 'Scanner de IMEI',
                    description: 'Escanea o escribe el IMEI y presiona Enter. Cada codigo se agrupa para luego guardar la entrada.',
                    side: 'bottom', align: 'center'
                }
            },
            {
                element: '#tour-serialized-groups',
                popover: {
                    title: 'Grupos y asignacion',
                    description: 'Si alguna unidad queda sin producto asignado, toca la tarjeta y vincula el modelo correcto antes de guardar.',
                    side: 'top', align: 'center'
                }
            },
            {
                popover: {
                    title: 'Guardar entrada',
                    description: 'Cuando todos los IMEIs esten asignados, Guardar todo crea las entradas, suma stock y deja trazabilidad por serial.'
                }
            }
        ]
    },

    // =============================================
    // TOUR 3: INVENTARIO COMPLETO (Core)
    // =============================================
    INVENTORY_COMPLETE: {
        id: 'inventory_complete',
        title: 'Gesti?n de Inventario',
        description: 'Vista general de productos, categor?as, kardex, traslados y almacenes.',
        startUrl: '/inventory-center?tab=productos',
        module: null,
        steps: [
            {
                element: '#tour-inventory-tabs',
                popover: {
                    title: 'Centro de Inventario',
                    description: 'Estas pesta?as separan el trabajo diario: cat?logo, categor?as, kardex, traslados, almacenes y seriales cuando el negocio los usa.',
                    side: 'bottom', align: 'center'
                }
            },
            {
                element: '#tour-products-search',
                popover: {
                    title: 'Buscar productos',
                    description: 'Busca por nombre, SKU o serial. Es la forma m?s r?pida de ubicar productos antes de editar, revisar stock o diagnosticar precios.',
                    side: 'bottom', align: 'start'
                }
            },
            {
                element: '#tour-products-add-btn',
                popover: {
                    title: 'Crear producto',
                    description: 'Aqu? registras productos nuevos con precio, costo, categor?a, stock, IMEI/serial, servicios o combos seg?n corresponda.',
                    side: 'bottom', align: 'end'
                }
            },
            {
                navigate: '/inventory-center?tab=categorias',
                element: '#tour-categories-add-btn',
                popover: {
                    title: 'Categor?as',
                    description: 'Organiza el cat?logo para filtrar mejor en inventario y POS. Crea categor?as simples o subcategor?as si necesitas m?s orden.',
                    side: 'bottom', align: 'end'
                }
            },
            {
                navigate: '/inventory-center?tab=kardex',
                element: '#tour-kardex-adjust-btn',
                popover: {
                    title: 'Kardex y ajustes',
                    description: 'El Kardex muestra entradas, salidas, ventas, compras, traslados y ajustes. Usa Nuevo ajuste manual solo para correcciones controladas.',
                    side: 'bottom', align: 'end'
                }
            },
            {
                navigate: '/inventory-center?tab=traslados',
                element: '#tour-transfers-modes',
                popover: {
                    title: 'Traslados',
                    description: 'Elige entre traslados internos, exportar inventario a otra empresa o importar un paquete recibido. Cada modo tiene su flujo propio.',
                    side: 'bottom', align: 'center'
                }
            },
            {
                navigate: '/inventory-center?tab=almacenes',
                element: '#tour-warehouses-add-btn',
                popover: {
                    title: 'Almacenes',
                    description: 'Administra ubicaciones de stock. Define almac?n principal, revisa inventario por ubicaci?n y crea almacenes cuando el negocio crezca.',
                    side: 'bottom', align: 'end'
                }
            },
            {
                popover: {
                    title: 'Listo para operar',
                    description: 'Usa la ayuda contextual de cada pesta?a cuando necesites pasos espec?ficos. Si algo no cuadra, abre soporte desde la ayuda y se enviar? con contexto.',
                }
            }
        ]
    },

    INVENTORY_PRODUCTS: {
        id: 'inventory_products',
        title: 'Productos de Inventario',
        description: 'Busqueda, filtros, diagnostico y creacion de productos.',
        startUrl: '/inventory-center?tab=productos',
        module: null,
        steps: [
            {
                element: '#tour-products-search',
                popover: {
                    title: 'B?squeda r?pida',
                    description: 'Busca por nombre, SKU o serial. La lista se actualiza para encontrar r?pido lo que quieres editar o revisar.',
                    side: 'bottom', align: 'start'
                }
            },
            {
                element: '#tour-products-filters-btn',
                popover: {
                    title: 'Filtros y diagn?stico',
                    description: 'Filtra por categor?a, almac?n, tipo de producto o problemas como precio cero, SKU faltante o listas pendientes.',
                    side: 'bottom', align: 'center'
                }
            },
            {
                element: '#tour-products-panel',
                popover: {
                    title: 'Cat?logo operativo',
                    description: 'El panel resume productos, categor?a, precios, stock y estado. Desde aqu? puedes editar y corregir datos sin entrar al POS.',
                    side: 'top', align: 'center'
                }
            },
            {
                element: '#tour-products-add-btn',
                popover: {
                    title: 'Nuevo producto',
                    description: 'Abre el formulario compacto para crear o editar la ficha completa: datos principales, precio, inventario, imagen y opciones avanzadas.',
                    side: 'bottom', align: 'end'
                }
            }
        ]
    },

    INVENTORY_CATEGORIES: {
        id: 'inventory_categories',
        title: 'Categor?as de Inventario',
        description: 'Organizaci?n del cat?logo para b?squeda y POS.',
        startUrl: '/inventory-center?tab=categorias',
        module: null,
        steps: [
            {
                element: '#tour-categories-add-btn',
                popover: {
                    title: 'Nueva categor?a',
                    description: 'Crea categor?as para ordenar productos y facilitar filtros en inventario y punto de venta.',
                    side: 'bottom', align: 'end'
                }
            },
            {
                popover: {
                    title: 'Buenas practicas',
                    description: 'Usa nombres cortos y claros. Evita duplicar categor?as parecidas porque eso hace m?s dif?cil buscar productos en el POS.'
                }
            }
        ]
    },

    INVENTORY_KARDEX: {
        id: 'inventory_kardex',
        title: 'Kardex de Inventario',
        description: 'Auditor?a de entradas, salidas y ajustes.',
        startUrl: '/inventory-center?tab=kardex',
        module: null,
        steps: [
            {
                element: '#tour-kardex-panel',
                popover: {
                    title: 'Historial de movimientos',
                    description: 'Aqu? se audita todo lo que entra y sale: ventas, compras, traslados, devoluciones y ajustes manuales.',
                    side: 'bottom', align: 'center'
                }
            },
            {
                element: '#tour-kardex-adjust-btn',
                popover: {
                    title: 'Ajuste manual',
                    description: '?salo para conteos f?sicos, correcciones autorizadas o salidas por merma. Siempre deja una descripci?n clara.',
                    side: 'bottom', align: 'end'
                }
            }
        ]
    },

    INVENTORY_TRANSFERS: {
        id: 'inventory_transfers',
        title: 'Traslados de Inventario',
        description: 'Movimientos internos y entre empresas.',
        startUrl: '/inventory-center?tab=traslados',
        module: null,
        steps: [
            {
                element: '#tour-transfers-modes',
                popover: {
                    title: 'Modos de traslado',
                    description: 'Internos mueve entre almacenes del mismo negocio. Exportar descuenta y genera archivo. Importar recibe el archivo en la empresa destino.',
                    side: 'bottom', align: 'center'
                }
            },
            {
                element: '#tour-transfers-mode-internal',
                popover: {
                    title: 'Traslado interno',
                    description: 'Usalo cuando el inventario sigue dentro del mismo tenant, por ejemplo de deposito a tienda.',
                    side: 'bottom', align: 'start'
                }
            },
            {
                element: '#tour-transfers-mode-export',
                popover: {
                    title: 'Exportar a otra empresa',
                    description: 'Genera un paquete para otra empresa y descuenta las cantidades. Si hay IMEI, selecciona los seriales exactos.',
                    side: 'bottom', align: 'center'
                }
            },
            {
                element: '#tour-transfers-mode-import',
                popover: {
                    title: 'Importar paquete',
                    description: 'Carga el archivo recibido para sumar productos al destino. Revisa el resumen antes de aceptar.',
                    side: 'bottom', align: 'end'
                }
            }
        ]
    },

    INVENTORY_WAREHOUSES: {
        id: 'inventory_warehouses',
        title: 'Almacenes',
        description: 'Ubicaciones y control por almacen.',
        startUrl: '/inventory-center?tab=almacenes',
        module: null,
        steps: [
            {
                element: '#tour-warehouses-add-btn',
                popover: {
                    title: 'Nuevo almacen',
                    description: 'Crea ubicaciones de stock cuando tienes tienda, deposito, vitrina o sucursales internas.',
                    side: 'bottom', align: 'end'
                }
            },
            {
                popover: {
                    title: 'Almacen principal',
                    description: 'Mantener un almacen principal claro ayuda al POS y a los reportes. Evita tener stock disperso sin necesidad.'
                }
            }
        ]
    },

    INVENTORY_SERIALS: {
        id: 'inventory_serials',
        title: 'Seriales e IMEI',
        description: 'Control individual de unidades serializadas.',
        startUrl: '/inventory-center?tab=seriales',
        module: null,
        steps: [
            {
                element: '#tour-serials-panel',
                popover: {
                    title: 'Equipos serializados',
                    description: 'Esta vista compara productos que manejan IMEI con las unidades disponibles, vendidas o en transito.',
                    side: 'bottom', align: 'center'
                }
            },
            {
                element: '#tour-serials-modes',
                popover: {
                    title: 'Cat?logo y tr?nsitos',
                    description: 'Cat?logo muestra modelos y unidades. En tr?nsito ayuda a auditar IMEIs movidos entre empresas.',
                    side: 'bottom', align: 'end'
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


    SALES_QUOTES: {
        id: 'sales_quotes',
        title: 'Cotizaciones',
        description: 'Crear, filtrar y convertir cotizaciones en ventas.',
        startUrl: '/sales-center?tab=cotizaciones',
        module: null,
        steps: [
            { element: '#tour-sales-tabs', popover: { title: 'Centro de Ventas', description: 'Estas pestanas separan cotizaciones, clientes, devoluciones, garantias y creditos.', side: 'bottom', align: 'center' } },
            { element: '#tour-quotes-summary', popover: { title: 'Resumen de cotizaciones', description: 'Aqui ves totales, pendientes, facturadas y conversion para medir seguimiento comercial.', side: 'bottom', align: 'center' } },
            { element: '#tour-quotes-filters', popover: { title: 'Estados', description: 'Filtra por pendientes, facturadas o vencidas antes de buscar o tomar accion.', side: 'bottom', align: 'start' } },
            { element: '#tour-quotes-add-btn', popover: { title: 'Nueva cotizacion', description: 'Crea una propuesta para el cliente. Luego podras imprimirla, enviarla o convertirla en venta.', side: 'bottom', align: 'end' } },
            { element: '#tour-quotes-list', popover: { title: 'Lista operativa', description: 'Desde cada tarjeta puedes imprimir, duplicar, enviar por WhatsApp, editar o facturar.', side: 'top', align: 'center' } }
        ]
    },

    SALES_QUOTES_CREATE: {
        id: 'sales_quotes_create',
        title: 'Crear cotizacion',
        description: 'Pasos clave para iniciar una cotizacion.',
        startUrl: '/sales-center?tab=cotizaciones',
        module: null,
        steps: [
            { element: '#tour-quotes-add-btn', popover: { title: 'Comienza aqui', description: 'Pulsa Nueva para abrir el formulario de cotizacion.', side: 'bottom', align: 'end' } },
            { popover: { title: 'Cliente y productos', description: 'Dentro del formulario selecciona cliente, agrega productos, revisa precios y define vigencia si aplica.' } },
            { popover: { title: 'Guardar y compartir', description: 'Al guardar, la cotizacion queda en la lista para imprimir, enviar o convertir en venta.' } }
        ]
    },

    SALES_QUOTES_INVOICE: {
        id: 'sales_quotes_invoice',
        title: 'Facturar cotizacion',
        description: 'Convertir una cotizacion aprobada en venta.',
        startUrl: '/sales-center?tab=cotizaciones',
        module: null,
        steps: [
            { element: '#tour-quotes-filters', popover: { title: 'Ubica pendientes', description: 'Filtra por pendientes o busca por cliente para encontrar la cotizacion aprobada.', side: 'bottom', align: 'start' } },
            { element: '#tour-quotes-list', popover: { title: 'Accion Facturar', description: 'En una cotizacion pendiente usa Facturar. El sistema la carga en POS para cobrarla.', side: 'top', align: 'center' } },
            { popover: { title: 'Termina en POS', description: 'En POS revisa carrito, seriales si aplica y confirma el cobro. La cotizacion queda marcada como facturada.' } }
        ]
    },

    SALES_CUSTOMERS: {
        id: 'sales_customers',
        title: 'Clientes',
        description: 'Gestion de clientes y datos para ventas a credito.',
        startUrl: '/sales-center?tab=clientes',
        module: null,
        steps: [
            { element: '#tour-sales-tab-clientes', popover: { title: 'Clientes', description: 'Aqui administras la cartera de clientes, documentos, telefonos y estado.', side: 'bottom', align: 'center' } },
            { element: '#tour-customers-add-btn', popover: { title: 'Nuevo cliente', description: 'Registra datos basicos y limites de credito si el negocio vende fiado.', side: 'bottom', align: 'end' } }
        ]
    },

    SALES_CUSTOMER_CREATE: {
        id: 'sales_customer_create',
        title: 'Crear cliente',
        description: 'Registrar un cliente para ventas y creditos.',
        startUrl: '/sales-center?tab=clientes',
        module: null,
        steps: [
            { element: '#tour-customers-add-btn', popover: { title: 'Agregar cliente', description: 'Pulsa Nuevo cliente y completa nombre, documento, telefono y condiciones de credito si aplica.', side: 'bottom', align: 'end' } },
            { popover: { title: 'Datos limpios', description: 'Evita duplicados por cedula o telefono. Esto facilita buscar historial, garantias y cuentas por cobrar.' } }
        ]
    },

    SALES_RETURNS: {
        id: 'sales_returns',
        title: 'Devoluciones',
        description: 'Buscar venta, seleccionar items y resolver reembolso o canje.',
        startUrl: '/sales-center?tab=devoluciones',
        module: null,
        steps: [
            { element: '#tour-returns-search-panel', popover: { title: 'Busca la venta original', description: 'Usa numero de factura, cedula o nombre del cliente para cargar los productos vendidos.', side: 'bottom', align: 'center' } },
            { element: '#tour-returns-results', popover: { title: 'Selecciona la venta correcta', description: 'Revisa cliente, fecha y total antes de continuar. Solo una venta valida debe procesarse.', side: 'top', align: 'center' } },
            { popover: { title: 'Luego selecciona items', description: 'Al elegir una venta, marca cantidades, condicion y resolucion: reembolso o canje.' } }
        ]
    },

    SALES_RETURN_PROCESS: {
        id: 'sales_return_process',
        title: 'Procesar devolucion',
        description: 'Flujo de reembolso desde una venta original.',
        startUrl: '/sales-center?tab=devoluciones',
        module: null,
        steps: [
            { element: '#tour-returns-search-input', popover: { title: 'Buscar venta', description: 'Escribe factura, cedula o cliente y pulsa Buscar.', side: 'bottom', align: 'start' } },
            { element: '#tour-returns-results', popover: { title: 'Seleccionar resultado', description: 'Carga la venta correcta para ver sus productos y cantidades disponibles.', side: 'top', align: 'center' } },
            { popover: { title: 'Resumen', description: 'Cuando selecciones una venta, el resumen calcula total a devolver, moneda y resolucion antes de confirmar.' } }
        ]
    },

    SALES_RETURN_EXCHANGE: {
        id: 'sales_return_exchange',
        title: 'Canje por producto',
        description: 'Usar el credito de una devolucion para entregar otro producto.',
        startUrl: '/sales-center?tab=devoluciones',
        module: null,
        steps: [
            { element: '#tour-returns-search-panel', popover: { title: 'Parte de la venta original', description: 'Primero busca y selecciona la venta que el cliente esta devolviendo.', side: 'bottom', align: 'center' } },
            { popover: { title: 'Cambia a Canje', description: 'En Resolucion selecciona Canje para habilitar productos de reemplazo y calcular diferencias.' } },
            { popover: { title: 'Producto de reemplazo', description: 'Busca el producto que se llevara el cliente. Si cuesta mas, se cobra diferencia; si cuesta menos, queda efectivo a devolver.' } }
        ]
    },

    SALES_WARRANTIES: {
        id: 'sales_warranties',
        title: 'Garantias',
        description: 'Verificar IMEI o serial y resolver garantia.',
        startUrl: '/sales-center?tab=garantias',
        module: null,
        steps: [
            { element: '#tour-warranties-search', popover: { title: 'Escanea IMEI o serial', description: 'Busca la unidad vendida para validar cliente, producto, fecha y cobertura.', side: 'bottom', align: 'center' } },
            { popover: { title: 'Resultado de cobertura', description: 'Cuando aparece el equipo, revisa si esta activo, vencido o requiere autorizacion.' } },
            { popover: { title: 'Decision', description: 'Luego define condicion, motivo, accion y moneda de reembolso antes de confirmar.' } }
        ]
    },

    SALES_WARRANTY_PROCESS: {
        id: 'sales_warranty_process',
        title: 'Resolver garantia',
        description: 'Procesar una garantia con trazabilidad.',
        startUrl: '/sales-center?tab=garantias',
        module: null,
        steps: [
            { element: '#tour-warranties-search', popover: { title: 'Escanea la unidad', description: 'Usa el serial exacto. Esto evita devolver un equipo que no corresponde a la venta original.', side: 'bottom', align: 'center' } },
            { popover: { title: 'Completa diagnostico', description: 'Indica si esta en buen estado o danado, escribe el motivo y revisa saldo de caja si hay reembolso.' } },
            { popover: { title: 'Confirmar', description: 'Confirma solo cuando motivo y caja cuadren. El sistema actualiza inventario, caja y comisiones segun aplique.' } }
        ]
    },

    SALES_CREDITS: {
        id: 'sales_credits',
        title: 'Creditos y cuentas por cobrar',
        description: 'Seguimiento de facturas pendientes, vencidas y pagos.',
        startUrl: '/sales-center?tab=creditos',
        module: null,
        steps: [
            { element: '#tour-credits-tabs', popover: { title: 'Vistas de credito', description: 'Alterna cuentas por cobrar, creditos celulares, antiguedad y estado de cuenta.', side: 'bottom', align: 'start' } },
            { element: '#tour-credits-summary', popover: { title: 'Resumen CxC', description: 'Mide saldo pendiente, vencido y cobrado para priorizar seguimiento.', side: 'bottom', align: 'center' } },
            { element: '#tour-credits-controls', popover: { title: 'Filtros y busqueda', description: 'Filtra por pendiente, vencido o pagado y busca cliente o factura.', side: 'bottom', align: 'center' } },
            { element: '#tour-credits-list', popover: { title: 'Facturas', description: 'Desde la lista puedes ver detalle, seleccionar varias facturas o registrar abonos.', side: 'top', align: 'center' } }
        ]
    },

    SALES_CREDIT_PAYMENT: {
        id: 'sales_credit_payment',
        title: 'Registrar abono',
        description: 'Aplicar pagos a facturas a credito.',
        startUrl: '/sales-center?tab=creditos',
        module: null,
        steps: [
            { element: '#tour-credits-controls', popover: { title: 'Filtra pendientes', description: 'Trabaja primero con facturas pendientes o vencidas y busca el cliente correcto.', side: 'bottom', align: 'center' } },
            { element: '#tour-credits-list', popover: { title: 'Boton Abonar', description: 'En la factura pendiente pulsa Abonar. Tambien puedes seleccionar varias facturas y usar pago masivo.', side: 'top', align: 'center' } },
            { popover: { title: 'Modal de pago', description: 'Al pulsar Abonar se abre el modal. Ingresa monto, moneda, metodo, tasa y referencia si el metodo lo exige.' } },
            { popover: { title: 'Confirmar pago', description: 'Confirma solo si el monto no excede el saldo y las referencias requeridas estan completas.' } }
        ]
    },

    // =============================================
    // TOUR 5: FINANZAS (Core)
    // =============================================
    FINANCE: {
        id: 'finance',
        title: 'Finanzas y Caja',
        description: 'Caja, compras, proveedores y cuentas por pagar/cobrar.',
        startUrl: '/cash-registers',
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
                navigate: '/reports?tab=proveedores',
                popover: {
                    title: 'Cuentas por Pagar',
                    description: 'Monitorea cuánto debes a cada proveedor. Ve las facturas pendientes, vencidas y registra pagos parciales o totales.',
                    side: 'bottom', align: 'center'
                }
            },
            {
                navigate: '/reports?tab=creditos',
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
