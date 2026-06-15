import { createPortal } from 'react-dom';
import { useMemo, useState } from 'react';
import {
    AlertTriangle,
    ArrowRight,
    BookOpen,
    CheckCircle,
    ChevronRight,
    HelpCircle,
    LifeBuoy,
    ListChecks,
    PlayCircle,
    Search,
    Sparkles,
    X,
    Zap,
} from 'lucide-react';
import { HELP_CONTENT } from './helpContent';
import { useAppTour } from '../hooks/useAppTour';
import { createHashSupportHref } from './supportContext';

const TOUR_BY_CONTEXT = {
    dashboard: 'WELCOME',
    pos: 'POS_COMPLETE',
    purchases: 'PURCHASES_LIST',
    suppliers: 'SUPPLIERS',
    cash: 'CASH_OVERVIEW',
    'cash/registers': 'CASH_REGISTERS',
    'inventory/productos': 'INVENTORY_PRODUCTS',
    'inventory/categorias': 'INVENTORY_CATEGORIES',
    'inventory/kardex': 'INVENTORY_KARDEX',
    'inventory/traslados': 'INVENTORY_TRANSFERS',
    'inventory/almacenes': 'INVENTORY_WAREHOUSES',
    'inventory/seriales': 'INVENTORY_SERIALS',
    'reports/resumen': 'REPORTS',
    'reports/ventas': 'REPORTS_SALES',
    'reports/caja': 'REPORTS_CASH',
    'reports/creditos': 'REPORTS_CREDITS',
    'reports/proveedores': 'REPORTS_SUPPLIERS',
    'reports/inventario': 'REPORTS_INVENTORY',
    'reports/comisiones': 'REPORTS_COMMISSIONS',
    'sales/cotizaciones': 'SALES_QUOTES',
    'sales/clientes': 'SALES_CUSTOMERS',
    'sales/devoluciones': 'SALES_RETURNS',
    'sales/garantias': 'SALES_WARRANTIES',
    'sales/creditos': 'SALES_CREDITS',
    'config/general': 'CONFIG_GENERAL',
    'config/usuarios': 'CONFIG_USERS',
    'config/monedas': 'CONFIG_CURRENCY',
    'config/comisiones': 'CONFIG_COMMISSIONS',
    'config/pagos': 'CONFIG_PAYMENTS',
    'config/impuestos': 'CONFIG_TAXES',
    'config/impresoras': 'CONFIG_PRINTERS',
    'config/garantias': 'CONFIG_WARRANTIES',
    'config/pos': 'CONFIG_POS',
    'config/auditoria': 'CONFIG_AUDIT',
    'config/precios': 'CONFIG_PRICES',
    'config/financiadoras': 'CONFIG_FINANCERS',
    'config/catalogo': 'CONFIG_CATALOG',
    'config/whatsapp': 'CONFIG_WHATSAPP',
    'config/integraciones': 'CONFIG_INTEGRATIONS',
    'services/dashboard': 'SERVICES',
    'services/order-detail': 'SERVICES',
};


const TASK_TOURS = {
    pos: [
        { label: 'Cobrar venta', tour: 'POS_CHECKOUT' },
        { label: 'Pago mixto', tour: 'POS_MIXED_PAYMENT' },
        { label: 'Venta a credito', tour: 'POS_CREDIT_SALE' },
        { label: 'Vender IMEI', tour: 'POS_SERIAL_SALE' },
        { label: 'Caja del turno', tour: 'CASH_POS_ACTIONS' },
    ],
    cash: [
        { label: 'Abrir caja', tour: 'CASH_OPENING' },
        { label: 'Movimientos', tour: 'CASH_MOVEMENTS' },
        { label: 'Cerrar caja', tour: 'CASH_CLOSING' },
        { label: 'Investigar diferencia', tour: 'CASH_RECONCILE' },
    ],
    'cash/registers': [
        { label: 'Gestionar cajas', tour: 'CASH_REGISTERS' },
        { label: 'Abrir caja', tour: 'CASH_OPENING' },
        { label: 'Cerrar caja', tour: 'CASH_CLOSING' },
    ],
    purchases: [
        { label: 'Lista de compras', tour: 'PURCHASES_LIST' },
        { label: 'Registrar compra', tour: 'PURCHASES_CREATE' },
        { label: 'Recibir IMEI', tour: 'PURCHASES_IMEI' },
        { label: 'Recepcion serializada', tour: 'SERIALIZED_RECEPTION' },
    ],
    suppliers: [
        { label: 'Directorio', tour: 'SUPPLIERS' },
        { label: 'Registrar compra', tour: 'PURCHASES_CREATE' },
        { label: 'Cuentas por pagar', tour: 'REPORTS_SUPPLIERS' },
    ],
    'config/general': [
        { label: 'Datos del negocio', tour: 'CONFIG_GENERAL' },
        { label: 'Logo y tickets', tour: 'CONFIG_GENERAL' },
    ],
    'config/usuarios': [
        { label: 'Crear usuario', tour: 'CONFIG_USERS' },
        { label: 'Permisos', tour: 'CONFIG_USERS' },
        { label: 'Auditar actividad', tour: 'CONFIG_AUDIT' },
    ],
    'config/monedas': [
        { label: 'Actualizar tasa', tour: 'CONFIG_CURRENCY' },
        { label: 'POS en Bs', tour: 'CONFIG_CURRENCY' },
    ],
    'config/pagos': [
        { label: 'Metodos POS', tour: 'CONFIG_PAYMENTS' },
        { label: 'Referencias', tour: 'CONFIG_PAYMENTS' },
    ],
    'config/impresoras': [
        { label: 'Ticket termico', tour: 'CONFIG_PRINTERS' },
        { label: 'Prueba impresion', tour: 'CONFIG_PRINTERS' },
    ],
    'config/pos': [
        { label: 'Estacion POS', tour: 'CONFIG_POS' },
        { label: 'Almacen activo', tour: 'CONFIG_POS' },
    ],
    'config/auditoria': [
        { label: 'Investigar cambios', tour: 'CONFIG_AUDIT' },
        { label: 'Usuarios', tour: 'CONFIG_USERS' },
    ],
    'config/comisiones': [
        { label: 'Reglas', tour: 'CONFIG_COMMISSIONS' },
        { label: 'Reporte', tour: 'REPORTS_COMMISSIONS' },
    ],
    'config/garantias': [
        { label: 'Politicas', tour: 'CONFIG_WARRANTIES' },
        { label: 'Garantias ventas', tour: 'SALES_WARRANTY_PROCESS' },
    ],
    'config/precios': [
        { label: 'Precios masivos', tour: 'CONFIG_PRICES' },
        { label: 'Productos', tour: 'INVENTORY_PRODUCTS' },
    ],
    'config/financiadoras': [
        { label: 'Financiadoras', tour: 'CONFIG_FINANCERS' },
        { label: 'Reportes', tour: 'REPORTS' },
    ],
    'config/catalogo': [
        { label: 'Catalogo publico', tour: 'CONFIG_CATALOG' },
        { label: 'Productos', tour: 'INVENTORY_PRODUCTS' },
    ],
    'config/whatsapp': [
        { label: 'WhatsApp', tour: 'CONFIG_WHATSAPP' },
        { label: 'Soporte', tour: 'CONFIG_WHATSAPP' },
    ],
    'config/integraciones': [
        { label: 'Integraciones', tour: 'CONFIG_INTEGRATIONS' },
        { label: 'Auditoria', tour: 'CONFIG_AUDIT' },
    ],
    'reports/resumen': [
        { label: 'Leer resumen', tour: 'REPORTS' },
        { label: 'Ventas', tour: 'REPORTS_SALES' },
        { label: 'Caja', tour: 'REPORTS_CASH' },
    ],
    'reports/ventas': [
        { label: 'Auditar ventas', tour: 'REPORTS_SALES' },
        { label: 'Cuadrar caja', tour: 'REPORTS_CASH' },
    ],
    'reports/caja': [
        { label: 'Cuadre de caja', tour: 'REPORTS_CASH' },
        { label: 'Ventas del periodo', tour: 'REPORTS_SALES' },
    ],
    'reports/creditos': [
        { label: 'Cuentas por cobrar', tour: 'REPORTS_CREDITS' },
        { label: 'Registrar abono', tour: 'SALES_CREDIT_PAYMENT' },
    ],
    'reports/proveedores': [
        { label: 'Cuentas por pagar', tour: 'REPORTS_SUPPLIERS' },
        { label: 'Registrar compra', tour: 'PURCHASES_CREATE' },
    ],
    'reports/inventario': [
        { label: 'Valoracion', tour: 'REPORTS_INVENTORY' },
        { label: 'Auditar Kardex', tour: 'INVENTORY_KARDEX' },
    ],
    'reports/comisiones': [
        { label: 'Comisiones', tour: 'REPORTS_COMMISSIONS' },
    ],
    'inventory/productos': [
        { label: 'Catalogo', tour: 'INVENTORY_PRODUCTS' },
        { label: 'Recepcion IMEI', tour: 'SERIALIZED_RECEPTION' },
        { label: 'Trasladar stock', tour: 'INVENTORY_TRANSFERS' },
    ],
    'inventory/categorias': [
        { label: 'Organizar categorias', tour: 'INVENTORY_CATEGORIES' },
    ],
    'inventory/kardex': [
        { label: 'Auditar Kardex', tour: 'INVENTORY_KARDEX' },
        { label: 'Cruzar traslado', tour: 'INVENTORY_TRANSFERS' },
    ],
    'inventory/traslados': [
        { label: 'Mover stock', tour: 'INVENTORY_TRANSFERS' },
        { label: 'IMEI en transito', tour: 'INVENTORY_SERIALS' },
    ],
    'inventory/almacenes': [
        { label: 'Almacenes', tour: 'INVENTORY_WAREHOUSES' },
        { label: 'Trasladar entre almacenes', tour: 'INVENTORY_TRANSFERS' },
    ],
    'inventory/seriales': [
        { label: 'Auditar IMEI', tour: 'INVENTORY_SERIALS' },
        { label: 'Recepcion serializada', tour: 'SERIALIZED_RECEPTION' },
    ],
    'sales/cotizaciones': [
        { label: 'Crear propuesta', tour: 'SALES_QUOTES_CREATE' },
        { label: 'Facturar cotizacion', tour: 'SALES_QUOTES_INVOICE' },
    ],
    'sales/clientes': [
        { label: 'Crear cliente', tour: 'SALES_CUSTOMER_CREATE' },
        { label: 'Creditos CxC', tour: 'SALES_CREDITS' },
    ],
    'sales/devoluciones': [
        { label: 'Procesar devolucion', tour: 'SALES_RETURN_PROCESS' },
        { label: 'Canje por producto', tour: 'SALES_RETURN_EXCHANGE' },
    ],
    'sales/garantias': [
        { label: 'Resolver garantia', tour: 'SALES_WARRANTY_PROCESS' },
    ],
    'sales/creditos': [
        { label: 'Registrar abono', tour: 'SALES_CREDIT_PAYMENT' },
        { label: 'Reporte CxC', tour: 'REPORTS_CREDITS' },
    ],
    'services/dashboard': [
        { label: 'Tablero taller', tour: 'SERVICES' },
        { label: 'Crear orden', tour: 'SERVICES_CREATE_ORDER' },
        { label: 'Gestionar orden', tour: 'SERVICES_ORDER_FLOW' },
        { label: 'Cobro y entrega', tour: 'SERVICES_PAYMENT' },
    ],
    'services/order-detail': [
        { label: 'Gestionar orden', tour: 'SERVICES_ORDER_FLOW' },
        { label: 'Cobro y entrega', tour: 'SERVICES_PAYMENT' },
    ],
};

const COMMON_ISSUES = {
    pos: [
        'No puedes cobrar: confirma caja abierta, carrito con productos y pago completo.',
        'Producto no aparece: revisa activo, stock, almacen del POS y codigo/SKU.',
        'Precio en Bs raro: actualiza tasa del dia y refresca el POS.',
    ],
    cash: [
        'Caja cerrada: abre turno desde POS y selecciona una caja libre.',
        'Faltante: revisa egresos, avances, devoluciones y vuelto antes de cerrar.',
        'Sobrante: busca ingresos no registrados o cobros de mas.',
        'Caja vs ventas no cuadra: compara por metodo de pago, usuario y rango horario exacto.',
    ],
    'cash/registers': [
        'Caja ocupada: otro usuario tiene sesion abierta.',
        'No se puede editar: primero cierra la sesion activa.',
        'Forzar cierre: usalo solo para sesiones bloqueadas sin cajero activo.',
    ],
    purchases: [
        'Proveedor faltante: selecciona o crea proveedor antes de procesar.',
        'IMEI incompleto: la cantidad de la linea debe coincidir con seriales validos.',
        'Costo cero: corrige antes de confirmar para no danar ganancia real.',
        'Factura duplicada: revisa proveedor, numero de factura y fecha.',
    ],
    suppliers: [
        'Proveedor duplicado: busca por nombre/contacto antes de crear.',
        'Deuda no cuadra: revisa compras a credito y pagos registrados.',
        'Pago no baja saldo: confirma que se aplico a la compra/proveedor correcto.',
    ],
    'config/general': [
        'Ticket con datos viejos: guarda cambios y vuelve a imprimir una prueba.',
        'Logo no aparece: verifica formato, peso y que la carga haya terminado.',
        'Nombre incorrecto en login/tickets: actualiza nombre comercial.',
    ],
    'config/usuarios': [
        'Empleado no puede entrar: revisa estado activo, usuario y contrasena.',
        'Cajero ve demasiado: ajusta rol/permisos y evita compartir admin.',
        'Comision no genera: revisa porcentaje del usuario y modulo de comisiones.',
    ],
    'config/monedas': [
        'Precios en Bs no se ven: confirma tasa activa y moneda visible.',
        'Monto en Bs raro: actualiza tasa del dia y refresca POS.',
        'Tasa vieja: revisa automatizacion o carga manual.',
    ],
    'config/pagos': [
        'Metodo no aparece en POS: confirma que este activo.',
        'Referencia faltante: activa referencia obligatoria para pagos digitales.',
        'Pago mal clasificado: revisa nombre y tipo del metodo.',
    ],
    'config/impresoras': [
        'No imprime: confirma Bridge abierto, impresora detectada y papel correcto.',
        'Texto cortado: revisa ancho 58mm/80mm.',
        'Imprime en otra caja: revisa impresora predeterminada de la estacion.',
    ],
    'config/pos': [
        'POS descuenta del almacen errado: revisa almacen activo de esta estacion.',
        'Otra PC se ve diferente: esta configuracion puede ser local por estacion.',
        'No abre pantalla completa: revisa permisos del navegador.',
    ],
    'config/auditoria': [
        'Cambio sospechoso: filtra por usuario, fecha y tipo de accion.',
        'Precio cambio sin permiso: revisa auditoria y rol del usuario.',
        'Inventario no cuadra: cruza auditoria con Kardex.',
    ],
    'config/comisiones': [
        'Comision no aparece: confirma modulo activo, porcentaje y venta cerrada.',
        'Monto raro: revisa reglas por categoria y usuario.',
        'Doble pago: valida reporte antes de liquidar.',
    ],
    'config/garantias': [
        'Garantia no sale: producto debe tener politica asignada.',
        'Periodo incorrecto: revisa dias de la politica predeterminada.',
        'Cliente reclama: busca garantia desde Centro de Ventas.',
    ],
    'config/precios': [
        'Precio masivo peligroso: filtra antes de aplicar cambios grandes.',
        'Margen raro: revisa costos cero o mal cargados.',
        'Precio en Bs raro: revisa tasa despues de actualizar precios.',
    ],
    'config/financiadoras': [
        'Financiadora no aparece: revisa que este activa.',
        'Cobro no cuadra: separa pago externo de metodo normal.',
        'Falta respaldo: guarda referencia o aprobacion del aliado.',
    ],
    'config/catalogo': [
        'Producto no se ve: confirma activo, stock, precio y publicacion.',
        'Cliente ve precio viejo: refresca catalogo y revisa lista aplicada.',
        'Link no abre: confirma catalogo activo y dominio correcto.',
    ],
    'config/whatsapp': [
        'Mensaje no sale: revisa conexion/autorizacion.',
        'Texto mal formado: envia prueba antes de usarlo con clientes.',
        'Numero incorrecto: verifica formato internacional.',
    ],
    'config/integraciones': [
        'Conexion falla: revisa token, endpoint y ambiente.',
        'Respuesta lenta: desactiva integraciones que no uses.',
        'Credencial expuesta: rota token y revisa auditoria.',
    ],
    'reports/resumen': [
        'Ventas en cero: revisa rango de fechas, caja y ventas anuladas.',
        'Ganancia rara: revisa costos cero o compras cargadas con costo incorrecto.',
        'Comparacion confusa: usa periodos completos y consistentes.',
    ],
    'reports/ventas': [
        'Venta no aparece: confirma fecha, usuario, tenant y estado.',
        'Total no cuadra con caja: revisa creditos, pagos mixtos y devoluciones.',
        'Descuento inesperado: abre detalle y revisa autorizacion/PIN.',
    ],
    'reports/caja': [
        'Faltante: revisa pagos mixtos, egresos y vuelto.',
        'Sobrante: valida ventas duplicadas o montos recibidos mayores.',
        'Egreso dudoso: exige descripcion y responsable.',
    ],
    'reports/creditos': [
        'Saldo no baja: pago aplicado a factura o cliente incorrecto.',
        'Cliente duplicado: puede dividir deuda e historial.',
        'Mora alta: revisa limites y bloqueos de credito.',
    ],
    'reports/proveedores': [
        'Deuda inflada: busca facturas duplicadas o compras marcadas como credito.',
        'Pago no aparece: confirma proveedor y compra asociada.',
        'Proveedor duplicado: consolida datos antes de auditar saldos.',
    ],
    'reports/inventario': [
        'Valoracion baja: revisa productos con costo cero.',
        'Stock raro: investiga en Kardex antes de ajustar.',
        'IMEI descuadrado: compara con Seriales disponibles/en transito.',
    ],
    'reports/comisiones': [
        'Monto raro: revisa reglas por usuario/categoria.',
        'Comision duplicada: verifica ventas anuladas o pagadas previamente.',
        'Pago pendiente: registra liquidacion para cerrar saldo.',
    ],
    'inventory/productos': [
        'SKU duplicado: edita el producto existente o cambia el codigo.',
        'Precio en cero: revisa precio base y listas de precios antes de vender.',
        'No aparece en POS: confirma activo, stock disponible y almacen correcto.',
    ],
    'inventory/categorias': [
        'Categoria repetida: consolida nombres y reasigna productos antes de eliminar.',
        'No aparece en filtros: confirma que tenga productos asociados.',
        'POS saturado: reduce categorias principales y usa nombres cortos.',
    ],
    'inventory/kardex': [
        'Stock no cuadra: revisa Kardex por producto, fecha, tipo y responsable antes de ajustar.',
        'Movimiento raro: valida usuario, fecha, tipo, descripcion y saldo posterior.',
        'Producto con IMEI: compara Kardex con Seriales disponibles, vendidos y en transito.',
    ],
    'inventory/traslados': [
        'IMEI faltante: puede estar vendido, en transito, en otro almacen o no disponible.',
        'Archivo externo: el origen descuenta al exportar; el destino suma solo al importar.',
        'Cantidad confusa: revisa unidades totales, no solo modelos distintos.',
    ],
    'inventory/almacenes': [
        'POS descuenta del sitio errado: revisa almacen activo de la estacion.',
        'Stock dividido: usa traslados para reubicar, no ajustes manuales.',
        'Almacen viejo: desactivalo si tiene historial en vez de eliminarlo.',
    ],
    'inventory/seriales': [
        'Stock vs IMEI no cuadra: compara disponibles, vendidos, devueltos y en transito.',
        'IMEI no aparece: revisa si el producto tiene activo control serial.',
        'Serial no vendible: puede estar vendido, reservado, en transito o no disponible.',
    ],
    'services/dashboard': [
        'Orden sin cliente/equipo: completa la recepcion antes de diagnosticar.',
        'No aparece para cobrar: confirma que tenga items y saldo pendiente.',
        'Trabajo estancado: filtra por estado y actualiza diagnostico o contacto.',
    ],
    'services/order-detail': [
        'Total no cuadra: revisa items duplicados, cantidades y abonos registrados.',
        'Stock no baja: carga el repuesto desde inventario, no como servicio manual.',
        'No se puede entregar: revisa saldo pendiente y estado actual de la orden.',
    ],
    dashboard: [
        'Si ingresos salen en cero, revisa el periodo seleccionado y la caja activa.',
        'Si la ganancia parece baja, revisa costos de compra en productos vendidos.',
        'Si una alerta no desaparece, abre el modulo indicado y resuelve el pendiente.',
    ],
};

const getIssueList = (contextKey, content) => {
    if (COMMON_ISSUES[contextKey]) return COMMON_ISSUES[contextKey];
    if (contextKey?.startsWith('inventory/')) return COMMON_ISSUES[contextKey] || COMMON_ISSUES['inventory/productos'];
    if (contextKey?.startsWith('sales/')) return [
        'Si una venta no aparece, revisa el rango de fechas o el filtro de estado.',
        'Si un cliente no aparece, confirma que este activo y busca por cedula o telefono.',
        'Si un reembolso no cuadra, verifica cantidades devueltas y metodo elegido.',
    ];
    if (content?.tips?.length) return content.tips.slice(0, 3);
    return ['Revisa los campos obligatorios antes de guardar.', 'Usa actualizar si la informacion parece atrasada.', 'Contacta soporte si el comportamiento se repite.'];
};

const normalize = (value) => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export const HelpButton = ({ contextKey, onClick }) => {
    const content = HELP_CONTENT[contextKey];
    if (!content) return null;
    return (
        <button
            type="button"
            onClick={onClick}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 px-3 text-xs font-black text-indigo-700 shadow-sm transition-colors hover:border-indigo-300 hover:bg-indigo-100"
            title="Abrir centro de ayuda"
        >
            <HelpCircle size={15} />
            <span className="hidden sm:inline">Ayuda</span>
        </button>
    );
};

const HelpDrawer = ({ contextKey, onClose }) => {
    const content = HELP_CONTENT[contextKey];
    const { startTour } = useAppTour();
    const [query, setQuery] = useState('');
    const [showAllSteps, setShowAllSteps] = useState(false);
    const [activeTab, setActiveTab] = useState('guide');

    const tourKey = TOUR_BY_CONTEXT[contextKey];
    const issues = useMemo(() => getIssueList(contextKey, content), [contextKey, content]);
    const quickActions = useMemo(() => (content?.actions || []).slice(0, 4), [content?.actions]);
    const taskTours = TASK_TOURS[contextKey] || [];

    const filteredSteps = useMemo(() => {
        const steps = content?.steps || [];
        const q = normalize(query);
        const source = q
            ? steps.filter(step => normalize(`${step.title} ${step.desc}`).includes(q))
            : steps;
        return showAllSteps || q ? source : source.slice(0, 5);
    }, [content?.steps, query, showAllSteps]);

    if (!content) return null;

    const startContextTour = () => {
        if (!tourKey) return;
        onClose?.();
        setTimeout(() => startTour(tourKey), 250);
    };

    const startTaskTour = (flowId) => {
        onClose?.();
        setTimeout(() => startTour(flowId), 250);
    };

    return createPortal(
        <>
            <div className="fixed inset-0 z-[9990] bg-slate-950/35 backdrop-blur-sm" onClick={onClose} />
            <aside className="fixed right-0 top-0 z-[9991] flex h-full w-full max-w-[460px] flex-col border-l border-slate-200 bg-white shadow-2xl shadow-slate-950/20 animate-in slide-in-from-right duration-200">
                <div className="border-b border-slate-100 bg-white px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <div className="mb-1 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-indigo-600">
                                <Sparkles size={14} /> Centro de ayuda
                            </div>
                            <h2 className="truncate text-xl font-black text-slate-950">{content.title}</h2>
                            <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-500">{content.description}</p>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800"
                            aria-label="Cerrar ayuda"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            onClick={startContextTour}
                            disabled={!tourKey}
                            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-indigo-600 px-3 text-sm font-black text-white shadow-sm shadow-indigo-100 transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                        >
                            <PlayCircle size={17} /> Mostrarme
                        </button>
                        <a
                            href={createHashSupportHref(contextKey, content.title)}
                            onClick={onClose}
                            className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-black text-slate-700 transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                        >
                            <LifeBuoy size={17} /> Soporte
                        </a>
                    </div>

                    <div className="mt-4 flex rounded-md bg-slate-100 p-1">
                        {[
                            { id: 'guide', label: 'Guia', icon: BookOpen },
                            { id: 'issues', label: 'Errores', icon: AlertTriangle },
                            { id: 'actions', label: 'Acciones', icon: Zap },
                        ].map(tab => {
                            const Icon = tab.icon;
                            const selected = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md text-xs font-black transition-colors ${selected ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                                >
                                    <Icon size={14} /> {tab.label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="border-b border-slate-100 px-5 py-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 text-slate-400" size={17} />
                        <input
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            className="h-10 w-full rounded-md border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm font-semibold text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                            placeholder="Buscar dentro de esta ayuda..."
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-4">
                    {activeTab === 'guide' && (
                        <div className="space-y-3">
                            <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-3">
                                <div className="flex items-start gap-2">
                                    <ListChecks className="mt-0.5 shrink-0 text-indigo-600" size={18} />
                                    <div className="min-w-0">
                                        <p className="text-sm font-black text-slate-900">Lo esencial de esta pantalla</p>
                                        <p className="mt-0.5 text-xs font-semibold leading-5 text-slate-600">Empieza por estos pasos. La guia completa queda disponible sin interrumpir tu trabajo.</p>
                                        {quickActions.length > 0 && (
                                            <div className="mt-3 flex flex-wrap gap-1.5">
                                                {quickActions.map((action) => (
                                                    <span key={action} className="inline-flex rounded-md border border-indigo-200 bg-white px-2 py-1 text-[11px] font-black text-indigo-700 shadow-sm">
                                                        {action}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {taskTours.length > 0 && (
                                <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                                    <div className="mb-2 flex items-center justify-between gap-2">
                                        <p className="text-xs font-black uppercase tracking-widest text-slate-400">Tareas guiadas</p>
                                        <Zap size={15} className="text-indigo-500" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        {taskTours.map((task) => (
                                            <button
                                                key={task.tour}
                                                type="button"
                                                onClick={() => startTaskTour(task.tour)}
                                                className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-2 text-xs font-black text-indigo-700 transition-colors hover:border-indigo-300 hover:bg-indigo-100"
                                            >
                                                <PlayCircle size={14} /> {task.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {filteredSteps.length === 0 ? (
                                <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm font-bold text-slate-400">No encontre pasos con esa busqueda.</div>
                            ) : filteredSteps.map((step, index) => (
                                <div key={`${step.title}-${index}`} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                                    <div className="flex gap-3">
                                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-900 text-xs font-black text-white">{index + 1}</div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-black text-slate-900">{String(step.title).replace(/^\d+\.\s*/, '')}</p>
                                            <p className="mt-1 text-sm leading-6 text-slate-600">{step.desc}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {(content.steps?.length || 0) > 5 && !query && (
                                <button
                                    type="button"
                                    onClick={() => setShowAllSteps(value => !value)}
                                    className="flex w-full items-center justify-center gap-2 rounded-md border border-slate-200 bg-white py-2.5 text-sm font-black text-slate-600 transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                                >
                                    {showAllSteps ? 'Ver menos' : `Ver guia completa (${content.steps.length} pasos)`}
                                    <ChevronRight size={16} className={showAllSteps ? '-rotate-90' : 'rotate-90'} />
                                </button>
                            )}
                        </div>
                    )}

                    {activeTab === 'issues' && (
                        <div className="space-y-3">
                            {issues.map((issue, index) => (
                                <div key={index} className="rounded-lg border border-amber-100 bg-amber-50 p-3">
                                    <div className="flex gap-3">
                                        <AlertTriangle className="mt-0.5 shrink-0 text-amber-600" size={18} />
                                        <p className="text-sm font-semibold leading-6 text-amber-950">{issue}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {activeTab === 'actions' && (
                        <div className="space-y-3">
                            {(content.actions || []).map((action, index) => (
                                <div key={index} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <CheckCircle className="text-emerald-600" size={18} />
                                        <span className="text-sm font-black text-slate-800">{action}</span>
                                    </div>
                                    <ArrowRight size={15} className="text-slate-300" />
                                </div>
                            ))}
                            {(!content.actions || content.actions.length === 0) && (
                                <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm font-bold text-slate-400">No hay acciones registradas para esta pantalla.</div>
                            )}
                        </div>
                    )}
                </div>

                <div className="border-t border-slate-100 bg-slate-50 px-5 py-3">
                    <p className="text-center text-[11px] font-semibold text-slate-400">La ayuda se adapta a la pantalla actual. Puedes abrirla cuando estes bloqueado.</p>
                </div>
            </aside>
        </>,
        document.body
    );
};

export default HelpDrawer;
