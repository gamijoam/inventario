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
    suppliers: 'FINANCE',
    cash: 'FINANCE',
    'inventory/productos': 'INVENTORY_PRODUCTS',
    'inventory/categorias': 'INVENTORY_CATEGORIES',
    'inventory/kardex': 'INVENTORY_KARDEX',
    'inventory/traslados': 'INVENTORY_TRANSFERS',
    'inventory/almacenes': 'INVENTORY_WAREHOUSES',
    'inventory/seriales': 'INVENTORY_SERIALS',
    'sales/cotizaciones': 'SALES_CLIENTS',
    'sales/clientes': 'SALES_CLIENTS',
    'sales/devoluciones': 'SALES_CLIENTS',
    'sales/garantias': 'SALES_CLIENTS',
    'sales/creditos': 'SALES_CLIENTS',
    'config/general': 'SYSTEM',
    'config/usuarios': 'SYSTEM',
    'config/monedas': 'SYSTEM',
    'config/comisiones': 'SYSTEM',
    'config/pagos': 'SYSTEM',
    'config/impuestos': 'SYSTEM',
    'config/impresoras': 'SYSTEM',
    'config/garantias': 'SYSTEM',
    'config/pos': 'SYSTEM',
    'config/auditoria': 'SYSTEM',
    'services/dashboard': 'SERVICES',
    'services/order-detail': 'SERVICES',
};


const TASK_TOURS = {
    pos: [
        { label: 'Cobrar', tour: 'POS_CHECKOUT' },
        { label: 'Pago mixto', tour: 'POS_MIXED_PAYMENT' },
        { label: 'Venta a credito', tour: 'POS_CREDIT_SALE' },
        { label: 'Producto con IMEI', tour: 'POS_SERIAL_SALE' },
    ],
    purchases: [
        { label: 'Lista de compras', tour: 'PURCHASES_LIST' },
        { label: 'Nueva compra', tour: 'PURCHASES_CREATE' },
        { label: 'Compra con IMEI', tour: 'PURCHASES_IMEI' },
        { label: 'Recepcion serializada', tour: 'SERIALIZED_RECEPTION' },
    ],
};

const COMMON_ISSUES = {
    pos: [
        'Si no puedes cobrar, confirma que la caja este abierta.',
        'Si no aparece un producto, revisa stock disponible y que este activo.',
        'Si el cliente paga en bolivares, verifica que la tasa del dia este actualizada.',
    ],
    purchases: [
        'Si un producto maneja IMEI, la cantidad debe coincidir con los seriales ingresados.',
        'Si la deuda del proveedor no cuadra, revisa si la compra fue contado o credito.',
        'Si el costo cambio, decide si tambien deseas actualizar el precio de venta.',
    ],
    'inventory/productos': [
        'Si un SKU ya existe, usa otro codigo o edita el producto existente.',
        'Si el precio sale en cero, revisa precio de venta y listas de precios.',
        'Si no aparece en POS, confirma que el producto este activo y tenga stock si aplica.',
    ],
    'inventory/traslados': [
        'Si el traslado tiene IMEI, cada unidad debe tener serial seleccionado.',
        'Si importas en destino, usa el archivo generado por la sucursal origen.',
        'Si las cantidades no cuadran, revisa productos normales vs serializados por separado.',
    ],
    'inventory/seriales': [
        'Si el stock no cuadra con IMEIs, compara disponibles, vendidos y en transito.',
        'Si un IMEI no aparece, verifica que el producto tenga activo el control serial.',
        'Si un serial no se puede anular, puede estar vendido o no disponible.',
    ],
    dashboard: [
        'Si ingresos salen en cero, revisa el periodo seleccionado y la caja activa.',
        'Si la ganancia parece baja, revisa costos de compra en productos vendidos.',
        'Si una alerta no desaparece, abre el modulo indicado y resuelve el pendiente.',
    ],
};

const getIssueList = (contextKey, content) => {
    if (COMMON_ISSUES[contextKey]) return COMMON_ISSUES[contextKey];
    if (contextKey?.startsWith('inventory/')) return COMMON_ISSUES['inventory/productos'];
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
