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
