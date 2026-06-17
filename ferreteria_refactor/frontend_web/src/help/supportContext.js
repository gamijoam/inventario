const CONTEXT_SUPPORT_MAP = {
    dashboard: { module: 'reports', issueType: 'data', subject: 'Dashboard: necesito ayuda con indicadores o alertas' },
    pos: { module: 'pos', issueType: 'error', subject: 'POS: necesito ayuda en punto de venta' },
    purchases: { module: 'purchases', issueType: 'blocked', subject: 'Compras: necesito ayuda con recepcion o proveedor' },
    suppliers: { module: 'purchases', issueType: 'data', subject: 'Proveedores: necesito ayuda con saldos o deuda' },
    cash: { module: 'reports', issueType: 'data', subject: 'Caja: necesito ayuda con movimientos o cierre' },
    'inventory/productos': { module: 'inventory', issueType: 'blocked', subject: 'Inventario: problema con productos' },
    'inventory/categorias': { module: 'inventory', issueType: 'question', subject: 'Inventario: ayuda con categorias' },
    'inventory/kardex': { module: 'inventory', issueType: 'data', subject: 'Kardex: movimientos no cuadran' },
    'inventory/traslados': { module: 'inventory', issueType: 'data', subject: 'Traslados: necesito revisar un traslado' },
    'inventory/almacenes': { module: 'inventory', issueType: 'question', subject: 'Almacenes: necesito ayuda' },
    'inventory/seriales': { module: 'inventory', issueType: 'data', subject: 'Seriales/IMEI: stock o seriales no cuadran' },
    'sales/cotizaciones': { module: 'sales', issueType: 'blocked', subject: 'Cotizaciones: necesito ayuda' },
    'sales/clientes': { module: 'sales', issueType: 'blocked', subject: 'Clientes: necesito ayuda' },
    'sales/devoluciones': { module: 'sales', issueType: 'data', subject: 'Devoluciones: necesito ayuda con un caso' },
    'sales/garantias': { module: 'sales', issueType: 'blocked', subject: 'Garantias: necesito ayuda' },
    'sales/creditos': { module: 'sales', issueType: 'data', subject: 'Creditos: saldos o pagos no cuadran' },
    'config/general': { module: 'config', issueType: 'question', subject: 'Configuracion: datos del negocio' },
    'config/usuarios': { module: 'config', issueType: 'blocked', subject: 'Usuarios/permisos: necesito ayuda' },
    'config/monedas': { module: 'config', issueType: 'data', subject: 'Monedas/tasa: necesito ayuda' },
    'config/comisiones': { module: 'config', issueType: 'data', subject: 'Comisiones: necesito ayuda' },
    'config/pagos': { module: 'config', issueType: 'blocked', subject: 'Metodos de pago: necesito ayuda' },
    'config/impuestos': { module: 'config', issueType: 'question', subject: 'Impuestos: necesito ayuda' },
    'config/impresoras': { module: 'config', issueType: 'blocked', subject: 'Impresoras: necesito ayuda' },
    'config/garantias': { module: 'config', issueType: 'question', subject: 'Politicas de garantia: necesito ayuda' },
    'config/pos': { module: 'config', issueType: 'question', subject: 'Estacion POS: necesito ayuda' },
    'config/auditoria': { module: 'config', issueType: 'question', subject: 'Auditoria: necesito ayuda' },
    'services/dashboard': { module: 'services', issueType: 'blocked', subject: 'Servicios/taller: necesito ayuda' },
    'services/order-detail': { module: 'services', issueType: 'blocked', subject: 'Orden de servicio: necesito ayuda' },
};

const inferSupportContext = (contextKey, fallbackTitle) => {
    if (CONTEXT_SUPPORT_MAP[contextKey]) return CONTEXT_SUPPORT_MAP[contextKey];
    if (contextKey?.startsWith('inventory/')) return { module: 'inventory', issueType: 'blocked', subject: fallbackTitle || 'Inventario: necesito ayuda' };
    if (contextKey?.startsWith('sales/')) return { module: 'sales', issueType: 'blocked', subject: fallbackTitle || 'Ventas: necesito ayuda' };
    if (contextKey?.startsWith('config/')) return { module: 'config', issueType: 'question', subject: fallbackTitle || 'Configuracion: necesito ayuda' };
    if (contextKey?.startsWith('services/')) return { module: 'services', issueType: 'blocked', subject: fallbackTitle || 'Servicios: necesito ayuda' };
    return { module: 'pos', issueType: 'question', subject: fallbackTitle || 'Necesito ayuda con el sistema' };
};

export const createSupportPath = (contextKey, fallbackTitle) => {
    const context = inferSupportContext(contextKey, fallbackTitle);
    const params = new URLSearchParams({
        module: context.module,
        issueType: context.issueType,
        subject: context.subject,
        source: 'help',
    });
    if (contextKey) params.set('context', contextKey);
    return `/support?${params.toString()}`;
};

export const createHashSupportHref = (contextKey, fallbackTitle) => `/#${createSupportPath(contextKey, fallbackTitle)}`;
