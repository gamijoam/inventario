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
