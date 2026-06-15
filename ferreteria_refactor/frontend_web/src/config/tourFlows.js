
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

    CASH_OVERVIEW: {
        id: 'cash-overview',
        title: 'Caja operativa',
        description: 'Apertura, movimientos, cierre y cuadre.',
        startUrl: '/pos',
        module: null,
        steps: [
            { element: '#tour-pos-cash-menu', popover: { title: 'Menu de caja', description: 'Desde el POS se manejan movimientos, avances y cierre. Si la caja esta cerrada, primero aparece el modal de apertura.', side: 'bottom', align: 'end' } },
            { popover: { title: 'Regla clave', description: 'Caja registra dinero por turno. Las ventas digitales, pagos mixtos, creditos, devoluciones y egresos deben revisarse por separado al cuadrar.' } },
            { navigate: '/reports?tab=caja', element: '#tour-reports-content', popover: { title: 'Reporte de caja', description: 'Usa este reporte para revisar cierres, movimientos y diferencias por periodo.', side: 'top', align: 'center' } }
        ]
    },

    CASH_REGISTERS: {
        id: 'cash-registers',
        title: 'Gestion de cajas',
        description: 'Cajas disponibles, abiertas, cerradas y bloqueadas.',
        startUrl: '/cash-registers',
        module: null,
        steps: [
            { element: '#tour-cash-container', popover: { title: 'Gestion de cajas', description: 'Aqui administras las cajas registradoras disponibles para el POS.', side: 'bottom', align: 'center' } },
            { element: '#tour-cash-registers-summary', popover: { title: 'Estado general', description: 'Revisa cuantas cajas estan activas, abiertas y cerradas antes de operar.', side: 'bottom', align: 'center' } },
            { element: '#tour-cash-new-register', popover: { title: 'Nueva caja', description: 'Crea una caja para cada punto de venta o estacion fisica. Usa codigos cortos como C01, C02 o NORTE.', side: 'bottom', align: 'end' } },
            { element: '#tour-cash-registers-list', popover: { title: 'Lista de cajas', description: 'Cada tarjeta muestra si la caja esta abierta, cerrada y quien la tiene en uso.', side: 'top', align: 'center' } },
            { element: '#tour-cash-registers-rules', popover: { title: 'Reglas de operacion', description: 'No edites ni desactives cajas abiertas. Forzar cierre solo debe usarse para sesiones bloqueadas.', side: 'top', align: 'center' } }
        ]
    },

    CASH_OPENING: {
        id: 'cash-opening',
        title: 'Abrir caja',
        description: 'Selecciona caja libre e ingresa fondo inicial.',
        startUrl: '/pos',
        module: null,
        steps: [
            { popover: { title: 'Apertura de turno', description: 'Si no hay caja abierta, el POS muestra un modal. Selecciona una caja libre y continua.' } },
            { popover: { title: 'Fondo inicial', description: 'Cuenta el efectivo real disponible por moneda. Ese monto se suma al efectivo esperado del cierre.' } },
            { popover: { title: 'Cajas ocupadas', description: 'Una caja abierta por otro cajero aparece ocupada. No la uses si no eres responsable de ese turno.' } }
        ]
    },

    CASH_POS_ACTIONS: {
        id: 'cash-pos-actions',
        title: 'Acciones de caja en POS',
        description: 'Movimientos, avances y cierre desde el menu Caja.',
        startUrl: '/pos',
        module: null,
        steps: [
            { element: '#tour-pos-cash-menu', popover: { title: 'Menu Caja', description: 'Abre este menu para movimientos, avances y cierre de turno.', side: 'bottom', align: 'end' } },
            { popover: { title: 'Movimientos', description: 'Usa movimiento para entradas o salidas que no son ventas. Siempre escribe una descripcion clara.' } },
            { popover: { title: 'Avances', description: 'Avance registra salida de efectivo y entrada bancaria con comision. Requiere referencia.' } },
            { popover: { title: 'Cerrar caja', description: 'Al cerrar, cuenta fisicamente el efectivo y escribe observacion si hay diferencia.' } }
        ]
    },

    CASH_MOVEMENTS: {
        id: 'cash-movements',
        title: 'Movimientos de caja',
        description: 'Entradas, salidas y retiros no asociados a ventas.',
        startUrl: '/pos',
        module: null,
        steps: [
            { element: '#tour-pos-cash-menu', popover: { title: 'Abrir menu Caja', description: 'Desde aqui se abre Movimiento de Caja.', side: 'bottom', align: 'end' } },
            { popover: { title: 'Movimiento de caja', description: 'Selecciona entrada o salida, moneda, monto y descripcion. El sistema valida saldo para salidas.' } },
            { popover: { title: 'Descripcion obligatoria', description: 'La descripcion debe explicar el motivo real: insumos, reposicion, retiro autorizado o ingreso extra.' } }
        ]
    },

    CASH_CLOSING: {
        id: 'cash-closing',
        title: 'Cerrar caja',
        description: 'Arqueo fisico y verificacion de diferencias.',
        startUrl: '/pos',
        module: null,
        steps: [
            { element: '#tour-pos-cash-menu', popover: { title: 'Cerrar desde Caja', description: 'El cierre se inicia desde el menu Caja del POS.', side: 'bottom', align: 'end' } },
            { popover: { title: 'Cierre de turno', description: 'Cuenta el efectivo fisico por moneda e ingresa el monto contado. Pagos digitales aparecen separados.' } },
            { popover: { title: 'Antes de confirmar', description: 'Si hay diferencia, revisa movimientos, avances, devoluciones y pagos mixtos. Agrega observacion si aun queda descuadre.' } }
        ]
    },

    CASH_RECONCILE: {
        id: 'cash-reconcile',
        title: 'Investigar diferencias',
        description: 'Como revisar faltantes y sobrantes sin perder trazabilidad.',
        startUrl: '/reports?tab=caja',
        module: null,
        steps: [
            { element: '#tour-reports-content', popover: { title: 'Reporte de caja', description: 'Empieza por el mismo turno/rango horario del cierre. No compares todo el dia si hubo varios turnos.', side: 'top', align: 'center' } },
            { navigate: '/reports?tab=ventas', element: '#tour-reports-content', popover: { title: 'Ventas del periodo', description: 'Compara ventas, pagos mixtos, creditos, devoluciones y anulaciones del mismo rango.', side: 'top', align: 'center' } },
            { navigate: '/pos', element: '#tour-pos-cash-menu', popover: { title: 'Movimientos y avances', description: 'Un egreso no registrado casi siempre aparece como faltante. Un ingreso no registrado suele verse como sobrante.', side: 'bottom', align: 'end' } }
        ]
    },



    SUPPLIERS: {
        id: 'suppliers',
        title: 'Proveedores',
        description: 'Directorio, terminos de credito y saldos por proveedor.',
        startUrl: '/suppliers',
        module: null,
        steps: [
            { element: '#tour-suppliers-container', popover: { title: 'Directorio de proveedores', description: 'Aqui administras contactos, condiciones de credito, limite y deuda actual de cada proveedor.', side: 'bottom', align: 'center' } },
            { element: '#tour-suppliers-search', popover: { title: 'Buscar antes de crear', description: 'Busca por nombre o contacto para evitar proveedores duplicados y saldos divididos.', side: 'bottom', align: 'start' } },
            { element: '#tour-suppliers-add-btn', popover: { title: 'Nuevo proveedor', description: 'Registra datos de contacto y terminos de pago antes de cargar compras a credito.', side: 'bottom', align: 'end' } },
            { element: '#tour-suppliers-list', popover: { title: 'Deuda y condiciones', description: 'La lista muestra plazo, limite y deuda actual. Si el saldo no cuadra, revisa compras pendientes y pagos.', side: 'top', align: 'center' } },
            { popover: { title: 'Pagos e historial', description: 'Los pagos se registran desde compras o reportes de proveedores. No corrijas deuda con ajustes manuales si puedes registrar el abono real.' } }
        ]
    },


    REPORTS: {
        id: 'reports',
        title: 'Centro de Reportes',
        description: 'Lectura, filtros y exportacion de indicadores del negocio.',
        startUrl: '/reports?tab=resumen',
        module: null,
        steps: [
            { element: '#tour-reports-container', popover: { title: 'Centro de Reportes', description: 'Aqui analizas ventas, caja, creditos, proveedores, inventario y comisiones con el mismo rango de fechas.', side: 'bottom', align: 'center' } },
            { element: '#tour-reports-presets', popover: { title: 'Presets de periodo', description: 'Usa atajos para hoy, semana, mes o rangos mas amplios. Todos los numeros cambian con este periodo.', side: 'bottom', align: 'end' } },
            { element: '#tour-reports-date-range', popover: { title: 'Rango exacto', description: 'Para auditorias usa fechas exactas. Evita comparar un mes completo contra un mes parcial.', side: 'bottom', align: 'end' } },
            { element: '#tour-reports-tabs', popover: { title: 'Pestanas de analisis', description: 'Cambia entre resumen, ventas, caja, creditos, proveedores, inventario y comisiones segun la pregunta que quieras responder.', side: 'bottom', align: 'start' } },
            { element: '#tour-reports-export', popover: { title: 'Exportar', description: 'Descarga los datos del reporte activo para contabilidad, auditoria o seguimiento administrativo.', side: 'bottom', align: 'end' } }
        ]
    },

    REPORTS_SALES: {
        id: 'reports_sales',
        title: 'Reporte de Ventas',
        description: 'Auditar ventas y cruzarlas con caja.',
        startUrl: '/reports?tab=ventas',
        module: null,
        steps: [
            { element: '#tour-reports-date-range', popover: { title: 'Periodo de ventas', description: 'Selecciona el rango exacto antes de investigar ventas, anulaciones o devoluciones.', side: 'bottom', align: 'end' } },
            { element: '#tour-reports-content', popover: { title: 'Detalle de ventas', description: 'Usa filtros internos para buscar factura, cliente, vendedor o metodo. Abre detalles cuando algo no cuadre.', side: 'top', align: 'center' } },
            { popover: { title: 'Cruce recomendado', description: 'Si el total no coincide con caja, revisa pagos mixtos, ventas a credito, devoluciones y anulaciones del mismo periodo.' } }
        ]
    },

    REPORTS_CASH: {
        id: 'reports_cash',
        title: 'Reporte de Caja',
        description: 'Cuadre de turnos, efectivo y metodos de pago.',
        startUrl: '/reports?tab=caja',
        module: null,
        steps: [
            { element: '#tour-reports-content', popover: { title: 'Turnos y cierres', description: 'Revisa apertura, esperado, contado, egresos y diferencia por turno o cajero.', side: 'top', align: 'center' } },
            { popover: { title: 'Cuando hay diferencia', description: 'Compara ventas del mismo periodo, pagos mixtos, egresos, referencias y vuelto entregado.' } }
        ]
    },

    REPORTS_CREDITS: {
        id: 'reports_credits',
        title: 'Reporte de Creditos',
        description: 'Cuentas por cobrar y mora de clientes.',
        startUrl: '/reports?tab=creditos',
        module: null,
        steps: [
            { element: '#tour-reports-content', popover: { title: 'Cartera por cobrar', description: 'Prioriza clientes vencidos, montos altos y facturas con mas dias de atraso.', side: 'top', align: 'center' } },
            { popover: { title: 'Seguimiento', description: 'Registra abonos desde Creditos/CxC para bajar saldo y mantener historial.' } }
        ]
    },

    REPORTS_SUPPLIERS: {
        id: 'reports_suppliers',
        title: 'Reporte de Proveedores',
        description: 'Cuentas por pagar y compras pendientes.',
        startUrl: '/reports?tab=proveedores',
        module: null,
        steps: [
            { element: '#tour-reports-content', popover: { title: 'Cuentas por pagar', description: 'Revisa deuda por proveedor, compras pendientes, pagos parciales y vencimientos.', side: 'top', align: 'center' } },
            { popover: { title: 'Si la deuda no cuadra', description: 'Busca facturas duplicadas, compras marcadas como credito por error o pagos aplicados al proveedor equivocado.' } }
        ]
    },

    REPORTS_INVENTORY: {
        id: 'reports_inventory',
        title: 'Reporte de Inventario',
        description: 'Valoracion, stock bajo y capital detenido.',
        startUrl: '/reports?tab=inventario',
        module: null,
        steps: [
            { element: '#tour-reports-content', popover: { title: 'Valoracion de inventario', description: 'Revisa costo total, valor de venta, margen, bajo stock y productos sin movimiento.', side: 'top', align: 'center' } },
            { popover: { title: 'Auditoria', description: 'Si costo o stock se ven raros, revisa ficha del producto, compras y Kardex antes de ajustar.' } }
        ]
    },

    REPORTS_COMMISSIONS: {
        id: 'reports_commissions',
        title: 'Reporte de Comisiones',
        description: 'Comisiones pendientes y pagadas del equipo.',
        startUrl: '/reports?tab=comisiones',
        module: null,
        steps: [
            { element: '#tour-reports-content', popover: { title: 'Liquidacion', description: 'Filtra el periodo, revisa cada empleado y valida ventas o servicios que originaron la comision.', side: 'top', align: 'center' } },
            { popover: { title: 'Antes de pagar', description: 'Confirma reglas, devoluciones y pagos previos para evitar doble liquidacion.' } }
        ]
    },

    // =============================================
    // TOUR 6: SISTEMA Y SEGURIDAD (Core)
    // =============================================
    SYSTEM: {
        id: 'system',
        title: 'Configuracion del sistema',
        description: 'Ajustes del negocio, usuarios, monedas, pagos, impresoras y seguridad.',
        startUrl: '/config-center',
        module: null,
        steps: [
            { element: '#tour-config-container', popover: { title: 'Centro de configuracion', description: 'Aqui estan los ajustes que afectan POS, reportes, caja, tickets y permisos.', side: 'bottom', align: 'center' } },
            { element: '#tour-config-tabs', popover: { title: 'Pestanas por area', description: 'Negocio, finanzas y sistema estan separados para que el admin cambie solo lo necesario.', side: 'bottom', align: 'center' } },
            { element: '#tour-config-content', popover: { title: 'Contenido activo', description: 'Cada pestana tiene sus propios campos. Antes de guardar, revisa que entiendes que modulo se vera afectado.', side: 'top', align: 'center' } }
        ]
    },

    CONFIG_GENERAL: {
        id: 'config-general', title: 'Datos del negocio', description: 'Nombre, RIF, direccion, logo y datos impresos.', startUrl: '/config-center?tab=general', module: null,
        steps: [
            { element: '#tour-config-tab-general', popover: { title: 'General', description: 'Datos visibles en tickets, facturas, reportes y login.', side: 'bottom', align: 'start' } },
            { element: '#tour-config-content', popover: { title: 'Ficha del negocio', description: 'Actualiza nombre comercial, identificacion fiscal, contacto, direccion y logo. Imprime una prueba despues de cambios importantes.', side: 'top', align: 'center' } }
        ]
    },

    CONFIG_USERS: {
        id: 'config-users', title: 'Usuarios y permisos', description: 'Cuentas, roles, PIN y acceso del personal.', startUrl: '/config-center?tab=usuarios', module: null,
        steps: [
            { element: '#tour-config-tab-usuarios', popover: { title: 'Usuarios', description: 'Administra quien entra al sistema y con que permisos.', side: 'bottom', align: 'start' } },
            { element: '#tour-users-add-btn', popover: { title: 'Nuevo usuario', description: 'Crea cuentas individuales. Evita compartir el admin con cajeros o empleados.', side: 'bottom', align: 'end' } },
            { element: '#tour-config-content', popover: { title: 'Roles y seguridad', description: 'Revisa rol, estado activo, PIN, contrasena y comisiones. Desactiva usuarios que ya no trabajan en el negocio.', side: 'top', align: 'center' } }
        ]
    },

    CONFIG_CURRENCY: {
        id: 'config-currency', title: 'Monedas y tasa', description: 'Tasa del dia y conversiones del POS.', startUrl: '/config-center?tab=monedas', module: null,
        steps: [
            { element: '#tour-config-tab-monedas', popover: { title: 'Monedas', description: 'Controla la tasa que usa el POS para mostrar y cobrar en Bs u otras monedas.', side: 'bottom', align: 'start' } },
            { element: '#tour-config-content', popover: { title: 'Actualizar tasa', description: 'Si los precios en Bs no aparecen o se ven mal, revisa aqui que la moneda este activa y la tasa sea la del dia.', side: 'top', align: 'center' } }
        ]
    },

    CONFIG_PAYMENTS: {
        id: 'config-payments', title: 'Metodos de pago', description: 'Formas de cobro disponibles en POS.', startUrl: '/config-center?tab=pagos', module: null,
        steps: [
            { element: '#tour-config-tab-pagos', popover: { title: 'Metodos de pago', description: 'Solo los metodos activos aparecen al cobrar en POS.', side: 'bottom', align: 'start' } },
            { element: '#tour-config-content', popover: { title: 'Referencia y datos', description: 'Activa referencia obligatoria en pagos digitales y guarda datos bancarios claros para el cajero.', side: 'top', align: 'center' } }
        ]
    },

    CONFIG_TAXES: {
        id: 'config-taxes', title: 'Impuestos', description: 'IVA, IGTF y exenciones.', startUrl: '/config-center?tab=impuestos', module: null,
        steps: [
            { element: '#tour-config-content', popover: { title: 'Impuestos', description: 'Activa impuestos solo con criterio contable. Estos cambios afectan el total cobrado y reportes.', side: 'top', align: 'center' } }
        ]
    },

    CONFIG_PRINTERS: {
        id: 'config-printers', title: 'Impresoras', description: 'Bridge, papel y pruebas de ticket.', startUrl: '/config-center?tab=impresoras', module: null,
        steps: [
            { element: '#tour-config-tab-impresoras', popover: { title: 'Impresoras', description: 'Configura impresora termica y ancho de papel.', side: 'bottom', align: 'start' } },
            { element: '#tour-config-content', popover: { title: 'Prueba de impresion', description: 'Si no imprime, revisa Bridge abierto, impresora detectada y ancho 58mm/80mm.', side: 'top', align: 'center' } }
        ]
    },

    CONFIG_WARRANTIES: {
        id: 'config-warranties', title: 'Politicas de garantia', description: 'Periodos y reglas de garantia.', startUrl: '/config-center?tab=garantias', module: null,
        steps: [
            { element: '#tour-config-tab-garantias', popover: { title: 'Garantias', description: 'Define periodos de garantia que luego se asignan a productos.', side: 'bottom', align: 'start' } },
            { element: '#tour-config-content', popover: { title: 'Politicas', description: 'Crea politicas claras como Sin garantia, 30 dias o 90 dias. Revisa la predeterminada.', side: 'top', align: 'center' } }
        ]
    },

    CONFIG_POS: {
        id: 'config-pos', title: 'Estacion POS', description: 'Ajustes locales de la caja.', startUrl: '/config-center?tab=pos', module: null,
        steps: [
            { element: '#tour-config-tab-pos', popover: { title: 'Estacion POS', description: 'Afecta esta caja o computadora: almacen activo, tema, impresora y modo de uso.', side: 'bottom', align: 'start' } },
            { element: '#tour-config-content', popover: { title: 'Almacen activo', description: 'Si el POS descuenta de un lugar errado, revisa aqui el almacen asignado a esta estacion.', side: 'top', align: 'center' } }
        ]
    },

    CONFIG_AUDIT: {
        id: 'config-audit', title: 'Auditoria', description: 'Rastrea cambios y acciones por usuario.', startUrl: '/config-center?tab=auditoria', module: null,
        steps: [
            { element: '#tour-config-tab-auditoria', popover: { title: 'Auditoria', description: 'Investiga cambios de precios, eliminaciones, descuentos y accesos.', side: 'bottom', align: 'start' } },
            { element: '#tour-config-content', popover: { title: 'Filtros de investigacion', description: 'Filtra por usuario, fecha y tipo de accion. Cruza con Kardex si el problema es inventario.', side: 'top', align: 'center' } }
        ]
    },

    CONFIG_COMMISSIONS: {
        id: 'config-commissions', title: 'Comisiones', description: 'Reglas de vendedores y tecnicos.', startUrl: '/config-center?tab=comisiones', module: null,
        steps: [
            { element: '#tour-config-tab-comisiones', popover: { title: 'Comisiones', description: 'Activa modulos y porcentajes antes de esperar calculos automaticos.', side: 'bottom', align: 'start' } },
            { element: '#tour-config-content', popover: { title: 'Reglas', description: 'Revisa reglas por usuario y categoria. Los cambios suelen aplicar a ventas futuras.', side: 'top', align: 'center' } }
        ]
    },

    CONFIG_PRICES: {
        id: 'config-prices', title: 'Precios masivos', description: 'Ajustes grandes de precios.', startUrl: '/config-center?tab=precios', module: null,
        steps: [
            { element: '#tour-config-tab-precios', popover: { title: 'Precios masivos', description: 'Usa filtros antes de aplicar margenes o precios en lote.', side: 'bottom', align: 'start' } },
            { element: '#tour-config-content', popover: { title: 'Cambios con cuidado', description: 'Verifica una muestra despues de guardar para confirmar precio base, listas y conversion en Bs.', side: 'top', align: 'center' } }
        ]
    },

    CONFIG_FINANCERS: {
        id: 'config-financers', title: 'Financiadoras', description: 'Credito externo y aliados.', startUrl: '/config-center?tab=financiadoras', module: null,
        steps: [
            { element: '#tour-config-tab-financiadoras', popover: { title: 'Financiadoras', description: 'Configura aliados de credito externo y sus condiciones.', side: 'bottom', align: 'start' } },
            { element: '#tour-config-content', popover: { title: 'Validacion', description: 'Haz una prueba controlada en POS y conserva referencias de aprobacion.', side: 'top', align: 'center' } }
        ]
    },

    CONFIG_CATALOG: {
        id: 'config-catalog', title: 'Catalogo publico', description: 'Link publico, QR y carrito.', startUrl: '/config-center?tab=catalogo', module: null,
        steps: [
            { element: '#tour-config-tab-catalogo', popover: { title: 'Catalogo publico', description: 'Controla que productos y precios ve el cliente desde el enlace publico.', side: 'bottom', align: 'start' } },
            { element: '#tour-config-content', popover: { title: 'Antes de compartir', description: 'Revisa stock, precio, imagen y estado activo del catalogo.', side: 'top', align: 'center' } }
        ]
    },

    CONFIG_WHATSAPP: {
        id: 'config-whatsapp', title: 'WhatsApp', description: 'Mensajes y notificaciones.', startUrl: '/config-center?tab=whatsapp', module: null,
        steps: [
            { element: '#tour-config-tab-whatsapp', popover: { title: 'WhatsApp', description: 'Configura conexion y mensajes que salen hacia clientes.', side: 'bottom', align: 'start' } },
            { element: '#tour-config-content', popover: { title: 'Prueba primero', description: 'Envia una prueba a un numero propio antes de usar plantillas con clientes.', side: 'top', align: 'center' } }
        ]
    },

    CONFIG_INTEGRATIONS: {
        id: 'config-integrations', title: 'Integraciones', description: 'Servicios externos y credenciales.', startUrl: '/config-center?tab=integraciones', module: null,
        steps: [
            { element: '#tour-config-tab-integraciones', popover: { title: 'Integraciones', description: 'Conecta sistemas externos solo cuando las credenciales y ambiente sean correctos.', side: 'bottom', align: 'start' } },
            { element: '#tour-config-content', popover: { title: 'Credenciales', description: 'No mezcles QA con produccion. Si falla, revisa token, endpoint y estado del proveedor.', side: 'top', align: 'center' } }
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
        title: 'Servicios / Taller',
        description: 'Recepcion, diagnostico, repuestos, pagos y entrega.',
        startUrl: '/services',
        module: 'services',
        steps: [
            {
                element: '#tour-services-container',
                popover: {
                    title: 'Tablero de servicios',
                    description: 'Aqui controlas las ordenes desde que el cliente deja el equipo hasta que se cobra y entrega.',
                    side: 'bottom', align: 'center'
                }
            },
            {
                element: '#tour-services-list',
                popover: {
                    title: 'Lista de ordenes',
                    description: 'La columna izquierda es la cola de trabajo. Cada orden muestra cliente, equipo, estado y si tiene pagos registrados.',
                    side: 'right', align: 'start'
                }
            },
            {
                element: '#tour-services-filters',
                popover: {
                    title: 'Filtra por estado',
                    description: 'Usa estos filtros para trabajar por prioridad: recibidas, en diagnostico, reparando, listas o entregadas.',
                    side: 'bottom', align: 'start'
                }
            },
            {
                element: '#tour-services-detail',
                popover: {
                    title: 'Detalle de la orden',
                    description: 'Al seleccionar una orden, aqui revisas la ficha completa: cliente, falla, estado, items, pagos y diagnostico.',
                    side: 'left', align: 'start'
                }
            }
        ]
    },

    SERVICES_CREATE_ORDER: {
        id: 'services-create-order',
        title: 'Crear orden de servicio',
        description: 'Registra un equipo de forma ordenada y trazable.',
        startUrl: '/services',
        module: 'services',
        steps: [
            {
                element: '#tour-services-new-order',
                popover: {
                    title: 'Nueva orden',
                    description: 'Comienza aqui cuando el cliente deja un equipo. Registra cliente, equipo, falla, serial/IMEI y accesorios recibidos.',
                    side: 'bottom', align: 'end'
                }
            },
            {
                element: '#tour-services-templates',
                popover: {
                    title: 'Plantillas',
                    description: 'Si repites servicios, crea plantillas para cargar mano de obra y repuestos frecuentes con menos errores.',
                    side: 'bottom', align: 'end'
                }
            },
            {
                popover: {
                    title: 'Datos que no deben faltar',
                    description: 'Confirma telefono del cliente, falla reportada, condicion fisica y accesorios. Esa informacion evita reclamos al entregar.'
                }
            }
        ]
    },

    SERVICES_ORDER_FLOW: {
        id: 'services-order-flow',
        title: 'Gestionar una orden',
        description: 'Avanza estados y carga repuestos o mano de obra.',
        startUrl: '/services',
        module: 'services',
        steps: [
            {
                element: '#tour-services-detail',
                popover: {
                    title: 'Selecciona una orden',
                    description: 'Abre una orden para ver la informacion completa del cliente, equipo y falla reportada.',
                    side: 'left', align: 'start'
                }
            },
            {
                element: '#tour-services-status',
                popover: {
                    title: 'Estados de trabajo',
                    description: 'Actualiza el estado segun avance real: recibido, diagnostico, reparacion, listo y entregado.',
                    side: 'bottom', align: 'start'
                }
            },
            {
                element: '#tour-services-items',
                popover: {
                    title: 'Repuestos y mano de obra',
                    description: 'Carga repuestos desde inventario para que baje el stock. Usa servicio manual para mano de obra o diagnosticos.',
                    side: 'top', align: 'start'
                }
            },
            {
                element: '#tour-services-diagnosis',
                popover: {
                    title: 'Diagnostico y notas',
                    description: 'Documenta hallazgos, autorizaciones y observaciones tecnicas. Guarda despues de editar.',
                    side: 'top', align: 'start'
                }
            }
        ]
    },

    SERVICES_PAYMENT: {
        id: 'services-payment',
        title: 'Pagos y entrega',
        description: 'Controla abonos, saldo pendiente y cierre de la orden.',
        startUrl: '/services',
        module: 'services',
        steps: [
            {
                element: '#tour-services-payments',
                popover: {
                    title: 'Pagos de la orden',
                    description: 'Aqui ves total, abonado y pendiente. Registra cada abono con metodo y referencia para que el cierre cuadre.',
                    side: 'top', align: 'start'
                }
            },
            {
                element: '#tour-services-status',
                popover: {
                    title: 'Antes de entregar',
                    description: 'La orden deberia estar lista y con el pendiente claro. Si falta cobrar, confirma si se pagara ahora o si queda autorizado como credito.',
                    side: 'bottom', align: 'start'
                }
            },
            {
                popover: {
                    title: 'Cierre correcto',
                    description: 'Al cobrar, verifica abonos previos y cobra solo el pendiente. Luego entrega el equipo y deja el historial limpio.'
                }
            }
        ]
    }
};
