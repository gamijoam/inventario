
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
        description: 'Vender rapido: caja activa, catalogo, carrito, cobro e impresion.',
        startUrl: '/pos',
        module: null,
        steps: [
            {
                element: '#tour-pos-container',
                popover: {
                    title: 'Terminal de venta',
                    description: 'Esta pantalla se usa durante la atencion al cliente. A la izquierda eliges productos y a la derecha controlas carrito, total y cobro.',
                    side: 'bottom', align: 'center'
                }
            },
            {
                element: '#tour-pos-cash-menu',
                popover: {
                    title: 'Caja y estacion',
                    description: 'Antes de cobrar confirma que la caja este abierta y corresponda a esta estacion. Si aparece sin impresora, revisa la configuracion antes de facturar.',
                    side: 'bottom', align: 'end'
                }
            },
            {
                element: '#tour-pos-search',
                popover: {
                    title: 'Buscar o escanear',
                    description: 'Busca por nombre, SKU o codigo. Con lector de barras, el campo recibe el codigo y agrega el producto sin navegar por categorias.',
                    side: 'bottom', align: 'start'
                }
            },
            {
                element: '#tour-pos-cart',
                popover: {
                    title: 'Carrito',
                    description: 'Revisa cantidades, precio, descuentos, cliente y seriales antes de cobrar. Si el producto tiene IMEI, debe quedar seleccionada la unidad exacta.',
                    side: 'left', align: 'start'
                }
            },
            {
                element: '#tour-pos-hold-btn',
                popover: {
                    title: 'Pausar venta',
                    description: 'Usa Pausar cuando el cliente se detiene y necesitas atender a otro. Luego retomas la venta sin reconstruir el carrito.',
                    side: 'bottom', align: 'center'
                }
            },
            {
                element: '#tour-pos-pay-btn',
                popover: {
                    title: 'Cobrar',
                    description: 'Abre el cobro con F5 o este boton. El modal valida metodo, referencia, credito, vuelto y pago completo antes de confirmar.',
                    side: 'top', align: 'center'
                }
            },
            {
                element: '#tour-pos-settings',
                popover: {
                    title: 'Configuracion de estacion',
                    description: 'Aqui ajustas almacen activo, preferencias visuales y datos locales de la estacion. Es clave cuando una PC vende desde otro almacen.',
                    side: 'bottom', align: 'end'
                }
            },
            {
                popover: {
                    title: 'Atajos utiles',
                    description: 'F2 limpia venta, F3 busca producto, F5 cobra y F6 pausa o retoma. En horas pico estos atajos reducen pasos del cajero.',
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
        title: 'Compras y recepcion',
        description: 'Historial, facturas de proveedor, costos, pagos e inventario recibido.',
        startUrl: '/purchases',
        module: null,
        steps: [
            { element: '#tour-purchases-container', popover: { title: 'Centro de compras', description: 'Aqui controlas lo recibido de proveedores: facturas, deuda, pagos y anulaciones.', side: 'bottom', align: 'center' } },
            { element: '#tour-purchases-summary', popover: { title: 'Resumen rapido', description: 'Mira cuanto se compro, cuanto se pago y que sigue pendiente. Es la primera alerta antes de revisar proveedor por proveedor.', side: 'bottom', align: 'center' } },
            { element: '#tour-purchases-list', popover: { title: 'Historial auditable', description: 'Cada compra debe poder explicarse: proveedor, productos, costos, seriales si aplica, condicion de pago y estado.', side: 'top', align: 'center' } },
            { element: '#tour-purchases-add-btn', popover: { title: 'Nueva recepcion', description: 'Usa este boton cuando llega mercancia. Si recibes celulares o equipos con IMEI, captura los seriales dentro de la misma compra.', side: 'bottom', align: 'end' } }
        ]
    },

    PURCHASES_CREATE: {
        id: 'purchases_create',
        title: 'Nueva compra',
        description: 'Registrar proveedor, productos, costos, IMEIs y pago.',
        startUrl: '/purchases/new',
        module: null,
        steps: [
            { element: '#tour-purchase-supplier', popover: { title: 'Proveedor correcto', description: 'Selecciona el proveedor real antes de cargar productos. Asi la deuda, historial y pagos quedan unidos al mismo contacto.', side: 'bottom', align: 'start' } },
            { element: '#tour-purchase-product-search', popover: { title: 'Agregar productos', description: 'Busca por nombre, SKU o codigo. Usa producto nuevo solo si verificaste que no existe para evitar duplicados de stock.', side: 'bottom', align: 'start' } },
            { element: '#tour-purchase-new-product', popover: { title: 'Crear al vuelo', description: 'Si el producto no existe, crealo desde aqui con nombre, SKU, costo, precio y tipo correcto. Para telefonos, activa serial/IMEI desde la ficha.', side: 'bottom', align: 'end' } },
            { element: '#tour-purchase-items', popover: { title: 'Cantidad y costo', description: 'La cantidad suma inventario y el costo alimenta ganancia real. No proceses lineas con costo cero salvo una excepcion documentada.', side: 'top', align: 'center' } },
            { element: '#tour-purchase-conditions', popover: { title: 'Contado o credito', description: 'Contado no genera deuda. Credito crea cuenta por pagar al proveedor. Revisa factura, fecha y referencia antes de guardar.', side: 'left', align: 'start' } },
            { element: '#tour-purchase-submit', popover: { title: 'Procesar', description: 'Al procesar sube stock, se crea Kardex y se registran seriales si aplica. Revisa el resumen antes de confirmar.', side: 'top', align: 'center' } }
        ]
    },

    PURCHASES_IMEI: {
        id: 'purchases_imei',
        title: 'Compra con IMEI',
        description: 'Recibir equipos serializados sin duplicar stock.',
        startUrl: '/purchases/new',
        module: null,
        steps: [
            { element: '#tour-purchase-product-search', popover: { title: 'Producto serializado', description: 'Agrega el modelo que maneja IMEI. Si no esta marcado como serializado, corrigelo en la ficha antes de recibir.', side: 'bottom', align: 'start' } },
            { element: '#tour-purchase-items', popover: { title: 'Cantidad fisica', description: 'La cantidad de la linea debe ser la misma cantidad de equipos que tienes en mano.', side: 'top', align: 'center' } },
            { element: '#tour-purchase-imei-lines', popover: { title: 'Capturar IMEIs', description: 'Escanea o pega los IMEIs de esta linea. El sistema debe validar cantidad, duplicados y seriales ya registrados antes de procesar.', side: 'top', align: 'center' } },
            { element: '#tour-purchase-submit', popover: { title: 'Guardar recepcion', description: 'Al confirmar, el stock sube una vez y cada IMEI queda disponible para venta o traslado. No lo vuelvas a cargar desde Seriales.', side: 'top', align: 'center' } }
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
        title: 'Gestion de Inventario',
        description: 'Vista general de productos, categorias, kardex, traslados y almacenes.',
        startUrl: '/inventory-center?tab=productos',
        module: null,
        steps: [
            {
                element: '#tour-inventory-tabs',
                popover: {
                    title: 'Centro de Inventario',
                    description: 'Estas pestanas separan el trabajo diario: catalogo, categorias, kardex, traslados, almacenes y seriales cuando el negocio los usa.',
                    side: 'bottom', align: 'center'
                }
            },
            {
                element: '#tour-products-search',
                popover: {
                    title: 'Buscar productos',
                    description: 'Busca por nombre, SKU o serial. Es la forma mas rapida de ubicar productos antes de editar, revisar stock o diagnosticar precios.',
                    side: 'bottom', align: 'start'
                }
            },
            {
                element: '#tour-products-add-btn',
                popover: {
                    title: 'Crear producto',
                    description: 'Aqui registras productos nuevos con precio, costo, categoria, stock, IMEI/serial, servicios o combos segun corresponda.',
                    side: 'bottom', align: 'end'
                }
            },
            {
                navigate: '/inventory-center?tab=categorias',
                element: '#tour-categories-add-btn',
                popover: {
                    title: 'Categorias',
                    description: 'Organiza el catalogo para filtrar mejor en inventario y POS. Crea categorias simples o subcategorias si necesitas mas orden.',
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
                    description: 'Administra ubicaciones de stock. Define almacen principal, revisa inventario por ubicacion y crea almacenes cuando el negocio crezca.',
                    side: 'bottom', align: 'end'
                }
            },
            {
                popover: {
                    title: 'Listo para operar',
                    description: 'Usa la ayuda contextual de cada pestana cuando necesites pasos especificos. Si algo no cuadra, abre soporte desde la ayuda y se enviara con contexto.',
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
                    title: 'Busqueda rapida',
                    description: 'Busca por nombre, SKU o serial. La lista se actualiza para encontrar rapido lo que quieres editar o revisar.',
                    side: 'bottom', align: 'start'
                }
            },
            {
                element: '#tour-products-filters-btn',
                popover: {
                    title: 'Filtros y diagnostico',
                    description: 'Filtra por categoria, almacen, tipo de producto o problemas como precio cero, SKU faltante o listas pendientes.',
                    side: 'bottom', align: 'center'
                }
            },
            {
                element: '#tour-products-panel',
                popover: {
                    title: 'Catalogo operativo',
                    description: 'El panel resume productos, categoria, precios, stock y estado. Desde aqui puedes editar y corregir datos sin entrar al POS.',
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
        title: 'Categorias de Inventario',
        description: 'Organizacion del catalogo para busqueda y POS.',
        startUrl: '/inventory-center?tab=categorias',
        module: null,
        steps: [
            {
                element: '#tour-categories-add-btn',
                popover: {
                    title: 'Nueva categoria',
                    description: 'Crea categorias para ordenar productos y facilitar filtros en inventario y punto de venta.',
                    side: 'bottom', align: 'end'
                }
            },
            {
                popover: {
                    title: 'Buenas practicas',
                    description: 'Usa nombres cortos y claros. Evita duplicar categorias parecidas porque eso hace mas dificil buscar productos en el POS.'
                }
            }
        ]
    },

    INVENTORY_KARDEX: {
        id: 'inventory_kardex',
        title: 'Kardex de Inventario',
        description: 'Auditar cada entrada, salida, traslado, devolucion y ajuste.',
        startUrl: '/inventory-center?tab=kardex',
        module: null,
        steps: [
            { element: '#tour-kardex-panel', popover: { title: 'Bitacora de stock', description: 'Kardex es la historia del inventario. Antes de ajustar, revisa aqui que movimiento cambio la cantidad.', side: 'bottom', align: 'center' } },
            { element: '#tour-kardex-search', popover: { title: 'Buscar producto o IMEI', description: 'Busca por producto, SKU, IMEI o descripcion. Para descuadres, empieza por el producto exacto y luego reduce el rango de fechas.', side: 'bottom', align: 'start' } },
            { element: '#tour-kardex-date-range', popover: { title: 'Rango de fechas', description: 'Usa el mismo rango del problema: turno, dia de venta, fecha de compra o fecha del traslado. Rangos grandes esconden la causa.', side: 'bottom', align: 'end' } },
            { element: '#tour-kardex-type-btn', popover: { title: 'Filtrar por movimiento', description: 'Filtra ventas, compras, traslados, devoluciones o ajustes. Esto acelera la auditoria cuando ya sospechas el origen.', side: 'bottom', align: 'center' } },
            { element: '#tour-kardex-adjust-btn', popover: { title: 'Ajuste manual', description: 'Usalo solo despues de investigar. Debe tener motivo claro: conteo fisico, merma, dano, robo, error de carga o conciliacion.', side: 'bottom', align: 'end' } },
            { popover: { title: 'Regla de oro', description: 'Si el producto maneja IMEI, cruza Kardex con Seriales. El stock numerico y las unidades disponibles deben contar la misma historia.' } }
        ]
    },

    INVENTORY_TRANSFERS: {
        id: 'inventory_transfers',
        title: 'Traslados de Inventario',
        description: 'Mover stock interno o entre empresas con trazabilidad e IMEI exacto.',
        startUrl: '/inventory-center?tab=traslados',
        module: null,
        steps: [
            { element: '#tour-transfers-panel', popover: { title: 'Centro de traslados', description: 'Aqui decides si el stock se mueve dentro del mismo negocio o viaja a otra empresa mediante archivo.', side: 'bottom', align: 'center' } },
            { element: '#tour-transfers-modes', popover: { title: 'Tres flujos distintos', description: 'Interno mueve entre almacenes. Exportar descuenta y genera archivo. Importar suma en la empresa destino al cargar ese archivo.', side: 'bottom', align: 'center' } },
            { element: '#tour-transfers-mode-internal', popover: { title: 'Interno', description: 'Usalo para mover de deposito a tienda, vitrina o sucursal interna. Debe quedar salida y entrada dentro del mismo tenant.', side: 'bottom', align: 'start' } },
            { element: '#tour-transfers-mode-export', popover: { title: 'Exportar', description: 'Exportar descuenta del origen desde ese momento. El destino no sube hasta importar el archivo en el otro tenant.', side: 'bottom', align: 'center' } },
            { element: '#tour-transfers-mode-import', popover: { title: 'Importar', description: 'Importar recibe el paquete en destino. Revisa modelos, unidades totales, costos e IMEIs antes de aceptar.', side: 'bottom', align: 'end' } },
            { popover: { title: 'Unidades vs modelos', description: 'Si envias 5 unidades del mismo modelo, el resumen debe hablar de 5 unidades aunque sea 1 modelo. Para IMEI, cada unidad viaja identificada.' } },
            { popover: { title: 'Despues del traslado', description: 'Revisa Kardex y Seriales. En externos, un IMEI puede quedar en transito hasta que el destino importe el archivo.' } }
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
        description: 'Auditar unidades individuales, disponibles, vendidas y en transito.',
        startUrl: '/inventory-center?tab=seriales',
        module: null,
        steps: [
            { element: '#tour-serials-panel', popover: { title: 'Trazabilidad por unidad', description: 'Esta vista no audita cantidades generales: audita cada IMEI o serial como una unidad unica.', side: 'bottom', align: 'center' } },
            { element: '#tour-serials-modes', popover: { title: 'Catalogo y transitos', description: 'Catalogo muestra modelos serializados. En transito muestra IMEIs exportados o movidos que aun no cerraron destino.', side: 'bottom', align: 'end' } },
            { popover: { title: 'Stock vs IMEI', description: 'Si un producto dice 12 pero cuentas 11, busca disponibles, vendidos y en transito. Puede haber una unidad exportada que aun no se importo.' } },
            { popover: { title: 'Conteo fisico', description: 'Cuando dudes, escanea los IMEIs fisicos y compara contra el sistema. No corrijas con ajuste general sin identificar la unidad exacta.' } },
            { popover: { title: 'Ingreso correcto', description: 'Para compras nuevas, captura IMEIs desde Compras o Recepcion IMEI. Evita registrar dos veces la misma unidad.' } },
            { popover: { title: 'Garantias y devoluciones', description: 'El serial vendido permite validar si el equipo que vuelve es el mismo que salio, y mantiene historial para reclamos.' } }
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
        description: 'Crear, filtrar, dar seguimiento y convertir cotizaciones en ventas.',
        startUrl: '/sales-center?tab=cotizaciones',
        module: null,
        steps: [
            { element: '#tour-sales-tabs', popover: { title: 'Centro de ventas', description: 'Estas pestanas separan cotizaciones, clientes, devoluciones, garantias y creditos para que cada flujo quede trazado.', side: 'bottom', align: 'center' } },
            { element: '#tour-quotes-summary', popover: { title: 'Resumen comercial', description: 'Mide pendientes, facturadas y conversion. Si hay muchas pendientes, toca hacer seguimiento antes de perder ventas.', side: 'bottom', align: 'center' } },
            { element: '#tour-quotes-filters', popover: { title: 'Estados de seguimiento', description: 'Filtra pendientes para llamar al cliente, facturadas para confirmar ventas y vencidas para limpiar propuestas viejas.', side: 'bottom', align: 'start' } },
            { element: '#tour-quotes-search', popover: { title: 'Buscar cliente o numero', description: 'Usa la busqueda cuando el cliente vuelve con una cotizacion. Evita crear otra si ya existe una pendiente.', side: 'bottom', align: 'start' } },
            { element: '#tour-quotes-add-btn', popover: { title: 'Nueva cotizacion', description: 'Crea la propuesta con cliente, productos, cantidades, precios y vigencia. La cotizacion no descuenta stock hasta facturar.', side: 'bottom', align: 'end' } },
            { element: '#tour-quotes-list', popover: { title: 'Acciones por cotizacion', description: 'Desde cada tarjeta puedes imprimir, duplicar, editar, enviar o facturar. Facturar lleva la cotizacion al POS para cobrar.', side: 'top', align: 'center' } }
        ]
    },

    SALES_QUOTES_CREATE: {
        id: 'sales_quotes_create',
        title: 'Crear cotizacion',
        description: 'Preparar una propuesta sin descontar inventario.',
        startUrl: '/sales-center?tab=cotizaciones',
        module: null,
        steps: [
            { element: '#tour-quotes-add-btn', popover: { title: 'Comienza aqui', description: 'Pulsa Nueva Cotizacion cuando el cliente aun no va a pagar, pero necesita una propuesta formal.', side: 'bottom', align: 'end' } },
            { popover: { title: 'Cliente y productos', description: 'Dentro del formulario selecciona cliente, agrega productos, revisa cantidades, precios, descuentos y vigencia.' } },
            { popover: { title: 'No descuenta stock', description: 'La cotizacion reserva la informacion comercial, pero el inventario baja solo cuando se factura y se cobra en POS.' } },
            { popover: { title: 'Seguimiento', description: 'Guarda y comparte. Luego vuelve a Pendientes para contactar al cliente o convertirla en venta.' } }
        ]
    },

    SALES_QUOTES_INVOICE: {
        id: 'sales_quotes_invoice',
        title: 'Facturar cotizacion',
        description: 'Convertir una cotizacion aprobada en venta real.',
        startUrl: '/sales-center?tab=cotizaciones',
        module: null,
        steps: [
            { element: '#tour-quotes-filters', popover: { title: 'Ubica pendientes', description: 'Filtra por pendientes o busca por cliente para encontrar la propuesta aprobada.', side: 'bottom', align: 'start' } },
            { element: '#tour-quotes-list', popover: { title: 'Accion Facturar', description: 'Usa Facturar solo cuando el cliente confirma. El sistema carga productos y cantidades en POS.', side: 'top', align: 'center' } },
            { popover: { title: 'Revisa antes de cobrar', description: 'En POS confirma stock, precios, cliente y seriales si aplica. Luego cobra con el metodo correcto.' } },
            { popover: { title: 'Estado final', description: 'Al completar la venta, la cotizacion queda facturada y la venta aparece en reportes.' } }
        ]
    },

    SALES_CUSTOMERS: {
        id: 'sales_customers',
        title: 'Clientes',
        description: 'Datos, historial, precios especiales, credito y seguimiento comercial.',
        startUrl: '/sales-center?tab=clientes',
        module: null,
        steps: [
            { element: '#tour-sales-tab-clientes', popover: { title: 'Clientes', description: 'Aqui administras datos del cliente para ventas, creditos, garantias, cotizaciones y seguimiento.', side: 'bottom', align: 'center' } },
            { element: '#tour-customers-add-btn', popover: { title: 'Nuevo cliente', description: 'Crea clientes con documento y telefono siempre que sea posible. Evita duplicados porque dividen deuda e historial.', side: 'bottom', align: 'end' } },
            { popover: { title: 'Datos que impactan ventas', description: 'Lista de precios, limite de credito, documento, telefono y estado activo afectan POS, CxC y reportes.' } },
            { popover: { title: 'Mejor practica', description: 'Desactiva clientes problematicos o inactivos en vez de borrarlos, para conservar ventas y garantias.' } }
        ]
    },

    SALES_CUSTOMER_CREATE: {
        id: 'sales_customer_create',
        title: 'Crear cliente',
        description: 'Registrar datos limpios para ventas, creditos y garantias.',
        startUrl: '/sales-center?tab=clientes',
        module: null,
        steps: [
            { element: '#tour-customers-add-btn', popover: { title: 'Agregar cliente', description: 'Pulsa Nuevo cliente y completa nombre, documento, telefono y direccion si el negocio los exige.', side: 'bottom', align: 'end' } },
            { popover: { title: 'Evita duplicados', description: 'Busca por documento o telefono antes de crear. Un duplicado divide creditos, garantias e historial de compras.' } },
            { popover: { title: 'Credito y precios', description: 'Configura limite de credito y lista de precios solo cuando el cliente realmente tiene condiciones especiales.' } }
        ]
    },

    SALES_RETURNS: {
        id: 'sales_returns',
        title: 'Devoluciones',
        description: 'Buscar venta original, seleccionar items y resolver reembolso o canje.',
        startUrl: '/sales-center?tab=devoluciones',
        module: null,
        steps: [
            { element: '#tour-returns-search-panel', popover: { title: 'Venta original', description: 'Toda devolucion debe partir de una venta real. Busca por factura, cedula o cliente para mantener trazabilidad.', side: 'bottom', align: 'center' } },
            { element: '#tour-returns-results', popover: { title: 'Selecciona la venta correcta', description: 'Compara cliente, fecha y total. No proceses devoluciones contra una venta parecida.', side: 'top', align: 'center' } },
            { element: '#tour-returns-items', popover: { title: 'Items a devolver', description: 'Marca cantidades o seriales exactos. En productos con IMEI, la unidad devuelta debe ser la misma vendida.', side: 'top', align: 'center' } },
            { element: '#tour-returns-resolution', popover: { title: 'Resolucion', description: 'Elige reembolso o canje. El resumen debe mostrar cuanto vuelve al cliente o cuanto falta cobrar.', side: 'left', align: 'start' } },
            { element: '#tour-returns-summary', popover: { title: 'Resumen final', description: 'Confirma solo cuando cantidades, motivo, moneda, caja y resolucion cuadren.', side: 'left', align: 'center' } }
        ]
    },

    SALES_RETURN_PROCESS: {
        id: 'sales_return_process',
        title: 'Procesar devolucion',
        description: 'Reembolso controlado desde una venta original.',
        startUrl: '/sales-center?tab=devoluciones',
        module: null,
        steps: [
            { element: '#tour-returns-search-input', popover: { title: 'Buscar venta', description: 'Escribe factura, cedula o cliente. Mientras mas exacta la busqueda, menor riesgo de devolver la venta equivocada.', side: 'bottom', align: 'start' } },
            { element: '#tour-returns-results', popover: { title: 'Cargar venta', description: 'Abre la venta correcta para ver productos, cantidades disponibles y seriales vendidos.', side: 'top', align: 'center' } },
            { element: '#tour-returns-items', popover: { title: 'Cantidad o serial', description: 'En productos normales indica cantidad. En IMEI selecciona la unidad exacta devuelta.', side: 'top', align: 'center' } },
            { element: '#tour-returns-summary', popover: { title: 'Reembolso', description: 'Revisa moneda y monto. Si sale de caja, confirma que el turno tenga saldo suficiente y deja motivo claro.', side: 'left', align: 'center' } }
        ]
    },

    SALES_RETURN_EXCHANGE: {
        id: 'sales_return_exchange',
        title: 'Canje por producto',
        description: 'Usar el valor devuelto para entregar otro producto.',
        startUrl: '/sales-center?tab=devoluciones',
        module: null,
        steps: [
            { element: '#tour-returns-search-panel', popover: { title: 'Parte de la venta original', description: 'Primero busca la venta y selecciona lo que el cliente devuelve. El canje usa ese valor como credito.', side: 'bottom', align: 'center' } },
            { element: '#tour-returns-resolution', popover: { title: 'Selecciona Canje', description: 'Al elegir canje se habilita la busqueda de producto de reemplazo y el calculo de diferencia.', side: 'left', align: 'start' } },
            { element: '#tour-returns-replacement', popover: { title: 'Producto de reemplazo', description: 'Busca el producto que se llevara el cliente. Si cuesta mas, se cobra diferencia; si cuesta menos, queda monto a devolver.', side: 'top', align: 'center' } },
            { element: '#tour-returns-summary', popover: { title: 'Diferencia final', description: 'Confirma si el resultado es cero, cobro adicional o efectivo a devolver. Revisa stock/IMEI del reemplazo.', side: 'left', align: 'center' } }
        ]
    },

    SALES_WARRANTIES: {
        id: 'sales_warranties',
        title: 'Garantias',
        description: 'Verificar venta, IMEI/serial, cobertura y resolucion.',
        startUrl: '/sales-center?tab=garantias',
        module: null,
        steps: [
            { element: '#tour-warranties-search', popover: { title: 'Busca IMEI o serial', description: 'La garantia debe validarse contra la unidad vendida. Esto evita recibir un equipo que no corresponde.', side: 'bottom', align: 'center' } },
            { element: '#tour-warranties-result', popover: { title: 'Resultado de cobertura', description: 'Revisa cliente, producto, fecha de venta, politica y vigencia antes de decidir.', side: 'bottom', align: 'center' } },
            { element: '#tour-warranties-decision', popover: { title: 'Decision', description: 'Define condicion, motivo, accion y monto si hay reembolso. Documenta bien el diagnostico.', side: 'left', align: 'start' } },
            { element: '#tour-warranties-confirm', popover: { title: 'Confirmar garantia', description: 'Confirma solo cuando la unidad, motivo y resolucion cuadren. Puede afectar inventario, caja y comisiones.', side: 'top', align: 'center' } }
        ]
    },

    SALES_WARRANTY_PROCESS: {
        id: 'sales_warranty_process',
        title: 'Resolver garantia',
        description: 'Procesar una garantia con trazabilidad por unidad.',
        startUrl: '/sales-center?tab=garantias',
        module: null,
        steps: [
            { element: '#tour-warranties-search', popover: { title: 'Escanea la unidad', description: 'Usa serial/IMEI exacto. No resuelvas garantia por nombre de producto si el item fue serializado.', side: 'bottom', align: 'center' } },
            { element: '#tour-warranties-result', popover: { title: 'Valida cobertura', description: 'Confirma que la garantia este vigente y que el equipo corresponda a la venta original.', side: 'bottom', align: 'center' } },
            { element: '#tour-warranties-decision', popover: { title: 'Completa diagnostico', description: 'Indica condicion, motivo y accion: reparacion, reemplazo, reembolso o rechazo segun politica.', side: 'left', align: 'start' } },
            { element: '#tour-warranties-confirm', popover: { title: 'Confirmar', description: 'Confirma cuando caja, inventario y motivo esten claros. El historial queda como respaldo ante reclamos.', side: 'top', align: 'center' } }
        ]
    },

    SALES_CREDITS: {
        id: 'sales_credits',
        title: 'Creditos y cuentas por cobrar',
        description: 'Seguimiento de facturas pendientes, vencidas, abonos y riesgo de mora.',
        startUrl: '/sales-center?tab=creditos',
        module: null,
        steps: [
            { element: '#tour-credits-tabs', popover: { title: 'Vistas de credito', description: 'Alterna entre cuentas por cobrar, creditos celulares, antiguedad y estado de cuenta segun la investigacion.', side: 'bottom', align: 'start' } },
            { element: '#tour-credits-summary', popover: { title: 'Resumen CxC', description: 'Mide saldo pendiente, vencido y cobrado. Prioriza vencidos y montos altos.', side: 'bottom', align: 'center' } },
            { element: '#tour-credits-controls', popover: { title: 'Filtros y busqueda', description: 'Filtra por pendiente, vencido o pagado y busca cliente/factura antes de registrar abonos.', side: 'bottom', align: 'center' } },
            { element: '#tour-credits-list', popover: { title: 'Facturas y abonos', description: 'Desde la lista puedes ver detalle, registrar pago individual o seleccionar varias facturas para pago masivo.', side: 'top', align: 'center' } },
            { element: '#tour-credits-bulk-bar', popover: { title: 'Pago masivo', description: 'Si seleccionas varias facturas, revisa total, cliente y metodo antes de confirmar el abono.', side: 'top', align: 'center' } }
        ]
    },

    SALES_CREDIT_PAYMENT: {
        id: 'sales_credit_payment',
        title: 'Registrar abono',
        description: 'Aplicar pagos a facturas a credito sin romper saldo.',
        startUrl: '/sales-center?tab=creditos',
        module: null,
        steps: [
            { element: '#tour-credits-controls', popover: { title: 'Filtra pendientes', description: 'Trabaja con facturas pendientes o vencidas y busca el cliente correcto antes de pagar.', side: 'bottom', align: 'center' } },
            { element: '#tour-credits-list', popover: { title: 'Abonar factura', description: 'En una factura pendiente usa Abonar. Para varias facturas del mismo cliente, selecciona y usa pago masivo.', side: 'top', align: 'center' } },
            { popover: { title: 'Datos del pago', description: 'Ingresa monto, moneda, metodo, tasa y referencia si aplica. El monto no debe exceder el saldo pendiente.' } },
            { popover: { title: 'Despues de confirmar', description: 'El saldo baja, queda historial de pago y el reporte de creditos debe reflejar el cambio.' } }
        ]
    },

    // =============================================
    // TOUR 5: FINANZAS (Core)
    // =============================================
    FINANCE: {
        id: 'finance',
        title: 'Finanzas y caja',
        description: 'Dinero operativo: caja, compras, proveedores, cuentas por pagar y cuentas por cobrar.',
        startUrl: '/cash-registers',
        module: null,
        steps: [
            { element: '#tour-cash-container', popover: { title: 'Punto de control financiero', description: 'Aqui revisas cajas y sesiones. Es el primer lugar para validar si cada venta quedo asociada a la caja correcta.', side: 'bottom', align: 'center' } },
            { element: '#tour-cash-registers-summary', popover: { title: 'Estado antes de operar', description: 'Confirma cajas abiertas, cerradas u ocupadas antes de iniciar turno. Una caja abierta ya tiene responsable.', side: 'bottom', align: 'center' } },
            { navigate: '/reports?tab=caja', element: '#tour-reports-content', popover: { title: 'Reporte de caja', description: 'Cuadra efectivo, pagos digitales, devoluciones, avances y movimientos usando el mismo turno o rango horario.', side: 'top', align: 'center' } },
            { navigate: '/purchases', element: '#tour-purchases-add-btn', popover: { title: 'Compras y recepcion', description: 'Las compras aumentan stock y pueden crear cuentas por pagar. En productos con IMEI, registra seriales desde la recepcion.', side: 'bottom', align: 'end' } },
            { navigate: '/reports?tab=proveedores', popover: { title: 'Cuentas por pagar', description: 'Revisa compras a credito, vencimientos y pagos a proveedores para que la deuda no quede fuera del flujo de caja.' } },
            { navigate: '/reports?tab=creditos', popover: { title: 'Cuentas por cobrar', description: 'Controla ventas a credito, abonos y clientes vencidos. Venta a credito no es efectivo disponible en caja.' } }
        ]
    },

    CASH_OVERVIEW: {
        id: 'cash-overview',
        title: 'Caja operativa',
        description: 'Abrir turno, cobrar, registrar movimientos, cerrar e investigar diferencias.',
        startUrl: '/pos',
        module: null,
        steps: [
            { element: '#tour-pos-cash-menu', popover: { title: 'Menu Caja', description: 'Desde aqui abres movimientos, avances y cierre. Si no hay caja abierta, el POS pedira seleccionar una caja libre antes de vender.', side: 'bottom', align: 'end' } },
            { popover: { title: 'Responsabilidad del turno', description: 'Cada turno queda unido a caja, usuario y estacion. No vendas desde una caja abierta por otra persona.' } },
            { popover: { title: 'Pagos por metodo', description: 'Efectivo se cuenta fisicamente. Punto, transferencia, pago movil y Zelle se cuadran por referencia y reporte.' } },
            { navigate: '/reports?tab=caja', element: '#tour-reports-content', popover: { title: 'Cuadre posterior', description: 'Usa Reportes > Caja para comparar contado contra esperado por el mismo rango, usuario y caja.', side: 'top', align: 'center' } }
        ]
    },

    CASH_REGISTERS: {
        id: 'cash-registers',
        title: 'Gestion de cajas',
        description: 'Cajas fisicas, sesiones activas, bloqueo, estacion e impresora.',
        startUrl: '/cash-registers',
        module: null,
        steps: [
            { element: '#tour-cash-container', popover: { title: 'Mapa de cajas', description: 'Administra las cajas disponibles para cada punto de venta. Crea una caja por mostrador o equipo que maneje dinero.', side: 'bottom', align: 'center' } },
            { element: '#tour-cash-registers-summary', popover: { title: 'Estado general', description: 'Revisa abiertas, cerradas y bloqueadas. Una caja abierta esta ocupada por un usuario y no deberia reutilizarse.', side: 'bottom', align: 'center' } },
            { element: '#tour-cash-new-register', popover: { title: 'Crear caja', description: 'Usa codigos cortos: C01, C02, Taller. Si hay impresora por caja, documenta el Client ID del bridge.', side: 'bottom', align: 'end' } },
            { element: '#tour-cash-registers-list', popover: { title: 'Sesion activa', description: 'La tarjeta muestra usuario, estado, caja y estacion. Si esta abierta, primero debe cerrarse antes de editar.', side: 'top', align: 'center' } },
            { element: '#tour-cash-registers-rules', popover: { title: 'Cierre forzado', description: 'Forzar cierre es emergencia: equipo apagado, sesion trabada o cajero ausente. Registra motivo y revisa reporte despues.', side: 'top', align: 'center' } }
        ]
    },

    CASH_OPENING: {
        id: 'cash-opening',
        title: 'Abrir caja',
        description: 'Seleccionar caja libre, contar fondo inicial y validar estacion.',
        startUrl: '/pos',
        module: null,
        steps: [
            { popover: { title: 'Apertura obligatoria', description: 'Antes de cobrar, el POS necesita una caja abierta. Selecciona una caja libre, no una ocupada por otro usuario.' } },
            { popover: { title: 'Fondo inicial real', description: 'Cuenta el efectivo fisico por moneda. Ese monto entra al esperado del cierre y sirve para dar vuelto.' } },
            { popover: { title: 'Estacion correcta', description: 'Confirma que esta computadora tenga almacen e impresora correctos en Configuracion > Estacion POS.' } },
            { popover: { title: 'Prueba rapida', description: 'Si es una caja nueva, realiza una venta pequena o prueba controlada para confirmar caja, almacen e impresion.' } }
        ]
    },

    CASH_POS_ACTIONS: {
        id: 'cash-pos-actions',
        title: 'Acciones de caja en POS',
        description: 'Movimientos, avances, cierre y diagnostico desde el menu Caja.',
        startUrl: '/pos',
        module: null,
        steps: [
            { element: '#tour-pos-cash-menu', popover: { title: 'Menu Caja', description: 'Desde aqui registras lo que afecta el turno: movimientos, avances y cierre.', side: 'bottom', align: 'end' } },
            { popover: { title: 'Movimientos', description: 'Entrada o salida que no es venta: gasto, retiro autorizado, reposicion, ingreso externo. Siempre deja descripcion clara.' } },
            { popover: { title: 'Avances', description: 'Un avance mueve efectivo a banco o punto con comision. Requiere referencia para poder cuadrar despues.' } },
            { popover: { title: 'Cierre', description: 'Cuenta efectivo fisico por moneda. Si hay diferencia, revisa movimientos, avances, devoluciones y pagos mixtos antes de confirmar.' } }
        ]
    },

    CASH_MOVEMENTS: {
        id: 'cash-movements',
        title: 'Movimientos de caja',
        description: 'Entradas, salidas y retiros no asociados a ventas.',
        startUrl: '/pos',
        module: null,
        steps: [
            { element: '#tour-pos-cash-menu', popover: { title: 'Abrir menu Caja', description: 'Desde el menu Caja abre Movimiento de Caja cuando el dinero entra o sale sin venta.', side: 'bottom', align: 'end' } },
            { popover: { title: 'Tipo correcto', description: 'Entrada aumenta caja; salida disminuye caja. Elige moneda y monto exacto.' } },
            { popover: { title: 'Motivo auditable', description: 'Escribe una descripcion concreta: compra de insumos, retiro autorizado, reposicion de fondo o correccion aprobada.' } },
            { popover: { title: 'Impacto en cierre', description: 'Un movimiento mal registrado se convierte en sobrante o faltante al cerrar. Registra en el momento.' } }
        ]
    },

    CASH_CLOSING: {
        id: 'cash-closing',
        title: 'Cerrar caja',
        description: 'Arqueo fisico, comparacion por metodo y observacion de diferencias.',
        startUrl: '/pos',
        module: null,
        steps: [
            { element: '#tour-pos-cash-menu', popover: { title: 'Cerrar desde Caja', description: 'El cierre se inicia desde el menu Caja del POS. No cierres si todavia quedan ventas por cobrar.', side: 'bottom', align: 'end' } },
            { popover: { title: 'Cuenta efectivo', description: 'Cuenta billetes y monedas por divisa. Pagos digitales no se suman como efectivo fisico.' } },
            { popover: { title: 'Compara esperado', description: 'El sistema calcula fondo inicial + ventas en efectivo + entradas - salidas - devoluciones/avances.' } },
            { popover: { title: 'Diferencias', description: 'Si hay faltante o sobrante, revisa pagos mixtos, vuelto, egresos, avances, devoluciones y ventas anuladas. Deja observacion.' } }
        ]
    },

    CASH_RECONCILE: {
        id: 'cash-reconcile',
        title: 'Investigar diferencias',
        description: 'Revisar faltantes y sobrantes sin perder trazabilidad.',
        startUrl: '/reports?tab=caja',
        module: null,
        steps: [
            { element: '#tour-reports-content', popover: { title: 'Mismo turno', description: 'Empieza por el cierre exacto: misma caja, cajero y rango horario. No mezcles turnos.', side: 'top', align: 'center' } },
            { navigate: '/reports?tab=ventas', element: '#tour-reports-content', popover: { title: 'Ventas del periodo', description: 'Compara ventas, anulaciones, devoluciones, creditos, pagos mixtos y metodo de pago.', side: 'top', align: 'center' } },
            { navigate: '/pos', element: '#tour-pos-cash-menu', popover: { title: 'Movimientos y avances', description: 'Un egreso no registrado suele ser faltante; un ingreso no registrado suele ser sobrante. Revisa referencias.', side: 'bottom', align: 'end' } },
            { navigate: '/config-center?tab=pos', element: '#tour-config-content', popover: { title: 'Caja equivocada', description: 'Si la venta o impresion salio por otra caja, revisa estacion POS, impresora local y caja seleccionada antes de seguir vendiendo.', side: 'top', align: 'center' } }
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
        description: 'Leer indicadores, filtrar periodos y cruzar datos del negocio.',
        startUrl: '/reports?tab=resumen',
        module: null,
        steps: [
            { element: '#tour-reports-container', popover: { title: 'Centro de decisiones', description: 'Aqui no solo ves numeros: cruzas ventas, caja, creditos, proveedores e inventario para explicar diferencias.', side: 'bottom', align: 'center' } },
            { element: '#tour-reports-presets', popover: { title: 'Atajos de periodo', description: 'Usa Hoy, Semana o Mes para una lectura rapida. Para auditorias, cambia al rango exacto del problema.', side: 'bottom', align: 'end' } },
            { element: '#tour-reports-date-range', popover: { title: 'Rango exacto', description: 'El rango controla todo el reporte activo. Para cierres de caja usa el mismo turno; para compras o creditos usa fechas reales del documento.', side: 'bottom', align: 'end' } },
            { element: '#tour-reports-tabs', popover: { title: 'Pestanas de analisis', description: 'Resumen responde como va el negocio. Ventas, Caja, Creditos, Proveedores e Inventario sirven para investigar la causa.', side: 'bottom', align: 'start' } },
            { element: '#tour-reports-export', popover: { title: 'Exportar respaldo', description: 'Exporta cuando necesites enviar al contador, revisar con administracion o guardar evidencia de una auditoria.', side: 'bottom', align: 'end' } },
            { element: '#tour-reports-content', popover: { title: 'Leer antes de actuar', description: 'Si un numero se ve raro, no corrijas de inmediato. Cambia de pestana y cruza ventas, caja, Kardex, compras o pagos.', side: 'top', align: 'center' } }
        ]
    },

    REPORTS_SALES: {
        id: 'reports_sales',
        title: 'Reporte de Ventas',
        description: 'Auditar ventas, pagos, devoluciones, anulaciones y descuentos.',
        startUrl: '/reports?tab=ventas',
        module: null,
        steps: [
            { element: '#tour-reports-date-range', popover: { title: 'Periodo de venta', description: 'Primero fija el rango exacto. Para cierre diario, usa el mismo dia o el mismo turno que caja.', side: 'bottom', align: 'end' } },
            { element: '#tour-reports-content', popover: { title: 'Detalle comercial', description: 'Busca por factura, cliente, vendedor, metodo de pago o estado. Abre el detalle si hay descuentos, devoluciones o pagos mixtos.', side: 'top', align: 'center' } },
            { popover: { title: 'Cruce con caja', description: 'Ventas puede incluir credito o pagos digitales. Caja mide dinero por turno. Si no coinciden, revisa metodo de pago, devoluciones y anulaciones.' } },
            { popover: { title: 'Cruce con inventario', description: 'Si la venta afecto stock o IMEI, valida Kardex y Seriales para confirmar que se desconto la unidad correcta.' } }
        ]
    },

    REPORTS_CASH: {
        id: 'reports_cash',
        title: 'Reporte de Caja',
        description: 'Cuadrar turnos, efectivo, pagos digitales, egresos y diferencias.',
        startUrl: '/reports?tab=caja',
        module: null,
        steps: [
            { element: '#tour-reports-date-range', popover: { title: 'Rango del turno', description: 'No compares todo el dia si hubo varios turnos. Usa cajero, caja y horario lo mas parecido al cierre.', side: 'bottom', align: 'end' } },
            { element: '#tour-reports-content', popover: { title: 'Cuadre de caja', description: 'Revisa apertura, ventas, egresos, avances, esperado, contado y diferencia. Efectivo y pagos digitales se auditan distinto.', side: 'top', align: 'center' } },
            { popover: { title: 'Faltante o sobrante', description: 'Faltante suele venir de egresos no registrados, vuelto mal dado o venta mal clasificada. Sobrante suele ser ingreso no registrado o cobro de mas.' } },
            { popover: { title: 'Cruce recomendado', description: 'Abre Ventas con el mismo periodo y compara pagos mixtos, creditos, devoluciones y anulaciones antes de cerrar una investigacion.' } }
        ]
    },

    REPORTS_CREDITS: {
        id: 'reports_credits',
        title: 'Reporte de Creditos',
        description: 'Cuentas por cobrar, vencimientos, abonos y saldo por cliente.',
        startUrl: '/reports?tab=creditos',
        module: null,
        steps: [
            { element: '#tour-reports-date-range', popover: { title: 'Periodo de cartera', description: 'El rango ayuda a ver ventas a credito, pagos y vencimientos. Para deuda actual, revisa tambien saldos abiertos.', side: 'bottom', align: 'end' } },
            { element: '#tour-reports-content', popover: { title: 'Cartera por cobrar', description: 'Prioriza vencidos, montos altos y clientes con muchos dias de atraso. Abre detalle antes de contactar o bloquear credito.', side: 'top', align: 'center' } },
            { popover: { title: 'Cuando el saldo no baja', description: 'Verifica si el abono se aplico al cliente/factura correcta y si existen clientes duplicados dividiendo la deuda.' } }
        ]
    },

    REPORTS_SUPPLIERS: {
        id: 'reports_suppliers',
        title: 'Reporte de Proveedores',
        description: 'Cuentas por pagar, compras a credito, pagos y facturas pendientes.',
        startUrl: '/reports?tab=proveedores',
        module: null,
        steps: [
            { element: '#tour-reports-date-range', popover: { title: 'Periodo de compras/pagos', description: 'Usa fechas de factura o pago segun lo que investigas. Para deuda actual, revisa tambien saldos pendientes.', side: 'bottom', align: 'end' } },
            { element: '#tour-reports-content', popover: { title: 'Deuda por proveedor', description: 'La deuda debe salir de compras a credito menos pagos registrados. Revisa vencimientos y facturas parciales.', side: 'top', align: 'center' } },
            { popover: { title: 'Si no cuadra', description: 'Busca compras duplicadas, proveedor duplicado, compras marcadas como credito por error o pagos aplicados al proveedor equivocado.' } }
        ]
    },

    REPORTS_INVENTORY: {
        id: 'reports_inventory',
        title: 'Reporte de Inventario',
        description: 'Valoracion, costo, precio de venta, stock bajo y capital detenido.',
        startUrl: '/reports?tab=inventario',
        module: null,
        steps: [
            { element: '#tour-reports-content', popover: { title: 'Valoracion y riesgo', description: 'Mide dinero invertido, valor potencial de venta, stock bajo y productos sin movimiento.', side: 'top', align: 'center' } },
            { popover: { title: 'Costo cero o margen raro', description: 'Si la ganancia se ve inflada o baja, revisa costos en productos, compras recientes y listas de precios.' } },
            { popover: { title: 'Stock raro', description: 'No ajustes desde el reporte. Abre Kardex para movimientos y Seriales si el producto maneja IMEI.' } },
            { popover: { title: 'Decision operativa', description: 'Stock bajo pide reposicion o traslado. Capital detenido pide promocion, liquidacion o dejar de reponer.' } }
        ]
    },

    REPORTS_COMMISSIONS: {
        id: 'reports_commissions',
        title: 'Reporte de Comisiones',
        description: 'Liquidar comisiones con reglas, devoluciones y pagos previos claros.',
        startUrl: '/reports?tab=comisiones',
        module: null,
        steps: [
            { element: '#tour-reports-date-range', popover: { title: 'Periodo de liquidacion', description: 'Usa el rango exacto de pago: semanal, quincenal o mensual. Evita mezclar periodos parciales.', side: 'bottom', align: 'end' } },
            { element: '#tour-reports-content', popover: { title: 'Detalle por empleado', description: 'Revisa empleado, venta/servicio, porcentaje, monto generado, pagado y pendiente antes de liquidar.', side: 'top', align: 'center' } },
            { popover: { title: 'Antes de pagar', description: 'Confirma reglas activas, devoluciones, anulaciones y pagos previos para evitar doble liquidacion.' } }
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
