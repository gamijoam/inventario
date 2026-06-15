import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    AlertTriangle,
    ArrowRight,
    BookOpen,
    CheckCircle,
    ClipboardList,
    HelpCircle,
    LifeBuoy,
    PlayCircle,
    Search,
    Sparkles,
    X,
} from 'lucide-react';
import { HELP_CONTENT } from '../help/helpContent';
import { useAppTour } from '../hooks/useAppTour';
import { createSupportPath } from '../help/supportContext';
import clsx from 'clsx';

const MODULES = [
    { id: 'general', label: 'Inicio', match: ['dashboard'], color: 'indigo' },
    { id: 'pos', label: 'Punto de Venta', match: ['pos'], color: 'emerald' },
    { id: 'inventory', label: 'Inventario', prefix: 'inventory/', color: 'blue' },
    { id: 'sales', label: 'Ventas', prefix: 'sales/', color: 'violet' },
    { id: 'finance', label: 'Finanzas', match: ['purchases', 'suppliers', 'cash'], color: 'amber' },
    { id: 'config', label: 'Configuracion', prefix: 'config/', color: 'slate' },
    { id: 'services', label: 'Servicios', prefix: 'services/', color: 'rose' },
];

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

const QUICK_ISSUES = [
    { title: 'No puedo cobrar', desc: 'Confirma que la caja este abierta y que el carrito tenga productos validos.', context: 'pos' },
    { title: 'Producto no aparece en POS', desc: 'Revisa si esta activo, tiene stock, precio y almacen correcto.', context: 'inventory/productos' },
    { title: 'Stock no cuadra', desc: 'Empieza por Kardex y compara compras, ventas, traslados y ajustes.', context: 'inventory/kardex' },
    { title: 'IMEI no cuadra', desc: 'Compara disponibles, vendidos y en transito desde Seriales.', context: 'inventory/seriales' },
    { title: 'Traslado incompleto', desc: 'Si exportaste, el origen descuenta; el destino suma solo al importar el archivo.', context: 'inventory/traslados' },
    { title: 'Compra no guarda', desc: 'Valida proveedor, cantidades, costos, factura y seriales si maneja IMEI.', context: 'purchases' },
    { title: 'Deuda proveedor no cuadra', desc: 'Revisa compras a credito, pagos parciales y proveedor duplicado.', context: 'suppliers' },
    { title: 'Tasa desactualizada', desc: 'Actualiza monedas/tasa antes de vender o revisar precios en moneda local.', context: 'config/monedas' },
    { title: 'Ventas no cuadran con caja', desc: 'Compara ventas, pagos mixtos, creditos, devoluciones y cierre del mismo periodo.', context: 'reports/caja' },
    { title: 'Ganancia baja o rara', desc: 'Revisa productos con costo cero, compras mal cargadas y descuentos.', context: 'reports/resumen' },
];

const colorClasses = {
    indigo: 'border-indigo-200 bg-indigo-50 text-indigo-700',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    violet: 'border-violet-200 bg-violet-50 text-violet-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    slate: 'border-slate-200 bg-slate-50 text-slate-700',
    rose: 'border-rose-200 bg-rose-50 text-rose-700',
};

const normalize = (value) => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const getModuleId = (key) => {
    const found = MODULES.find(module => {
        if (module.match?.includes(key)) return true;
        return module.prefix && key.startsWith(module.prefix);
    });
    return found?.id || 'general';
};

const stripStepTitle = (title) => String(title || '').replace(/^\d+\.\s*/, '');

const Help = () => {
    const { startTour } = useAppTour();
    const [searchTerm, setSearchTerm] = useState('');
    const [activeModule, setActiveModule] = useState('all');
    const [selectedKey, setSelectedKey] = useState('dashboard');

    const topics = useMemo(() => Object.entries(HELP_CONTENT).map(([key, content]) => ({
        key,
        moduleId: getModuleId(key),
        title: content.title,
        description: content.description,
        steps: content.steps || [],
        tips: content.tips || [],
        actions: content.actions || [],
        tourKey: TOUR_BY_CONTEXT[key],
    })), []);

    const selectedTopic = topics.find(topic => topic.key === selectedKey) || topics[0];

    const filteredTopics = useMemo(() => {
        const query = normalize(searchTerm);
        return topics.filter(topic => {
            const moduleMatch = activeModule === 'all' || topic.moduleId === activeModule;
            if (!moduleMatch) return false;
            if (!query) return true;
            const haystack = normalize([
                topic.title,
                topic.description,
                ...topic.steps.map(step => `${step.title} ${step.desc}`),
                ...topic.tips,
                ...topic.actions,
            ].join(' '));
            return haystack.includes(query);
        });
    }, [activeModule, searchTerm, topics]);

    const startSelectedTour = (topic = selectedTopic) => {
        if (!topic?.tourKey) return;
        startTour(topic.tourKey);
    };

    return (
        <div className="min-h-[calc(100vh-64px)] bg-slate-50">
            <div className="border-b border-slate-200 bg-white">
                <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm shadow-indigo-100">
                            <BookOpen size={24} />
                        </div>
                        <div>
                            <p className="text-xs font-black uppercase tracking-widest text-slate-400">Centro de ayuda</p>
                            <h1 className="text-2xl font-black tracking-tight text-slate-950">Guias, errores y tours</h1>
                            <p className="text-sm font-medium text-slate-500">Ayuda practica para resolver tareas dentro del sistema.</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() => startSelectedTour()}
                            disabled={!selectedTopic?.tourKey}
                            className="inline-flex h-10 items-center gap-2 rounded-md bg-indigo-600 px-4 text-sm font-black text-white shadow-sm shadow-indigo-100 transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                        >
                            <PlayCircle size={17} /> Iniciar tour
                        </button>
                        <Link to={createSupportPath(selectedTopic?.key, selectedTopic?.title)} className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700">
                            <LifeBuoy size={17} /> Soporte
                        </Link>
                    </div>
                </div>
            </div>

            <main className="mx-auto grid max-w-7xl gap-4 px-4 py-5 sm:px-6 lg:grid-cols-[320px_1fr]">
                <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
                    <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 text-slate-400" size={17} />
                            <input
                                value={searchTerm}
                                onChange={(event) => setSearchTerm(event.target.value)}
                                placeholder="Buscar guia, error o tarea..."
                                className="h-10 w-full rounded-md border border-slate-200 bg-slate-50 pl-9 pr-9 text-sm font-semibold text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                            />
                            {searchTerm && (
                                <button type="button" onClick={() => setSearchTerm('')} className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Limpiar busqueda">
                                    <X size={15} />
                                </button>
                            )}
                        </div>
                    </section>

                    <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                        <p className="px-2 pb-2 text-xs font-black uppercase tracking-widest text-slate-400">Modulos</p>
                        <div className="space-y-1">
                            <button
                                type="button"
                                onClick={() => setActiveModule('all')}
                                className={clsx('flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-black transition-colors', activeModule === 'all' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950')}
                            >
                                Todos <span>{topics.length}</span>
                            </button>
                            {MODULES.map(module => {
                                const count = topics.filter(topic => topic.moduleId === module.id).length;
                                return (
                                    <button
                                        key={module.id}
                                        type="button"
                                        onClick={() => setActiveModule(module.id)}
                                        className={clsx('flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-black transition-colors', activeModule === module.id ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-indigo-50 hover:text-indigo-700')}
                                    >
                                        {module.label} <span>{count}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </section>

                    <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                        <div className="flex gap-3">
                            <AlertTriangle className="mt-0.5 shrink-0 text-amber-600" size={18} />
                            <div>
                                <p className="text-sm font-black text-amber-950">Errores frecuentes</p>
                                <p className="mt-1 text-xs font-semibold leading-5 text-amber-800">Busca primero aqui si algo no guarda, no aparece o no cuadra.</p>
                            </div>
                        </div>
                    </section>
                </aside>

                <section className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-3">
                        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Guias</p>
                                <BookOpen size={18} className="text-indigo-600" />
                            </div>
                            <p className="mt-2 text-2xl font-black text-slate-950">{topics.length}</p>
                            <p className="text-xs font-semibold text-slate-500">pantallas documentadas</p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Tours</p>
                                <PlayCircle size={18} className="text-emerald-600" />
                            </div>
                            <p className="mt-2 text-2xl font-black text-slate-950">{topics.filter(topic => topic.tourKey).length}</p>
                            <p className="text-xs font-semibold text-slate-500">flujos interactivos</p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Soporte</p>
                                <LifeBuoy size={18} className="text-rose-600" />
                            </div>
                            <p className="mt-2 text-2xl font-black text-slate-950">24/7</p>
                            <p className="text-xs font-semibold text-slate-500">tickets desde el sistema</p>
                        </div>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
                        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
                            <div className="border-b border-slate-100 px-4 py-3">
                                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Temas encontrados</p>
                                <h2 className="text-lg font-black text-slate-950">{filteredTopics.length} resultados</h2>
                            </div>
                            <div className="divide-y divide-slate-100">
                                {filteredTopics.length === 0 ? (
                                    <div className="p-10 text-center">
                                        <HelpCircle className="mx-auto text-slate-200" size={48} />
                                        <p className="mt-3 text-sm font-black text-slate-500">No encontre resultados</p>
                                        <p className="text-xs font-semibold text-slate-400">Prueba con producto, caja, IMEI, compra o tasa.</p>
                                    </div>
                                ) : filteredTopics.map(topic => {
                                    const module = MODULES.find(item => item.id === topic.moduleId) || MODULES[0];
                                    const selected = selectedTopic?.key === topic.key;
                                    return (
                                        <button
                                            key={topic.key}
                                            type="button"
                                            onClick={() => setSelectedKey(topic.key)}
                                            className={clsx('flex w-full items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-slate-50', selected && 'bg-indigo-50/70')}
                                        >
                                            <div className={clsx('mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border', colorClasses[module.color])}>
                                                <ClipboardList size={17} />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <p className="text-sm font-black text-slate-950">{topic.title}</p>
                                                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-slate-500">{module.label}</span>
                                                </div>
                                                <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-500">{topic.description}</p>
                                            </div>
                                            <ArrowRight size={16} className={clsx('mt-2 text-slate-300', selected && 'text-indigo-500')} />
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <article className="rounded-lg border border-slate-200 bg-white shadow-sm">
                                <div className="border-b border-slate-100 p-4">
                                    <p className="text-xs font-black uppercase tracking-widest text-indigo-600">Guia seleccionada</p>
                                    <h2 className="mt-1 text-xl font-black text-slate-950">{selectedTopic?.title}</h2>
                                    <p className="mt-1 text-sm leading-6 text-slate-500">{selectedTopic?.description}</p>
                                </div>
                                <div className="space-y-3 p-4">
                                    {(selectedTopic?.steps || []).slice(0, 5).map((step, index) => (
                                        <div key={`${step.title}-${index}`} className="flex gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
                                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-900 text-xs font-black text-white">{index + 1}</span>
                                            <div>
                                                <p className="text-sm font-black text-slate-900">{stripStepTitle(step.title)}</p>
                                                <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{step.desc}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex gap-2 border-t border-slate-100 p-4">
                                    <button
                                        type="button"
                                        onClick={() => startSelectedTour()}
                                        disabled={!selectedTopic?.tourKey}
                                        className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-md bg-indigo-600 px-3 text-sm font-black text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                                    >
                                        <PlayCircle size={16} /> Mostrarme
                                    </button>
                                    <Link to={createSupportPath(selectedTopic?.key, selectedTopic?.title)} className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-black text-slate-700 transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700">
                                        <LifeBuoy size={16} /> Ticket
                                    </Link>
                                </div>
                            </article>

                            <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                                <div className="mb-3 flex items-center gap-2">
                                    <Sparkles size={17} className="text-amber-500" />
                                    <h3 className="text-sm font-black text-slate-950">Atajos de solucion</h3>
                                </div>
                                <div className="space-y-2">
                                    {QUICK_ISSUES.map(issue => (
                                        <button
                                            key={issue.title}
                                            type="button"
                                            onClick={() => setSelectedKey(issue.context)}
                                            className="w-full rounded-md border border-slate-100 bg-slate-50 p-3 text-left transition-colors hover:border-amber-200 hover:bg-amber-50"
                                        >
                                            <p className="text-sm font-black text-slate-900">{issue.title}</p>
                                            <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{issue.desc}</p>
                                        </button>
                                    ))}
                                </div>
                            </article>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
};

export default Help;
