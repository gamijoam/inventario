import React, { lazy, Suspense } from 'react';
import { useConfig } from '../../context/ConfigContext';
import HelpDrawer, { HelpButton } from '../../help/HelpDrawer';
import { useHelp } from '../../help/useHelp';
import { useSearchParams } from 'react-router-dom';
import {
    Package, Tags, Archive, ArrowRightLeft, Warehouse, Barcode
} from 'lucide-react';

const ProductsTab = lazy(() => import('./tabs/ProductsTab'));
const CategoriesTab = lazy(() => import('./tabs/CategoriesTab'));
const KardexTab = lazy(() => import('./tabs/KardexTab'));
const TransfersTab = lazy(() => import('./tabs/TransfersTab'));
const WarehousesTab = lazy(() => import('./tabs/WarehousesTab'));
const SerialsTab = lazy(() => import('./tabs/SerialsTab'));

// --- Tab descriptions ---
const TAB_DESCRIPTIONS = {
    productos: { desc: 'Gestiona tu catálogo completo: agrega, edita, busca y controla el stock de cada producto.', tip: 'Tip: usa el botón "Importar Excel" para cargar productos en masa.' },
    categorias: { desc: 'Organiza tus productos en categorías y subcategorías para facilitar la búsqueda en el POS.', tip: 'Las categorías se muestran como filtros en el punto de venta.' },
    kardex: { desc: 'Historial completo de movimientos de inventario: entradas, salidas y ajustes manuales.', tip: 'Filtra por fecha o tipo para auditar cambios específicos.' },
    traslados: { desc: 'Mueve mercancía entre tus almacenes internos o transfiere inventario entre sucursales.', tip: 'Usa "Exportar" para generar un archivo de traslado que la otra sucursal importa.' },
    almacenes: { desc: 'Administra tus ubicaciones de almacenamiento y consulta el stock disponible en cada una.', tip: 'Puedes asignar un almacén por defecto en la configuración.' },
    seriales: { desc: 'Recibe y registra productos con número de serie o IMEI para trazabilidad individual.', tip: 'Ideal para celulares, laptops y equipos electrónicos.' },
};

// --- Tab definitions ---
const BASE_TABS = [
    { id: 'productos', label: 'Productos', icon: Package },
    { id: 'categorias', label: 'Categorías', icon: Tags },
    { id: 'kardex', label: 'Kardex', icon: Archive },
    { id: 'traslados', label: 'Traslados', icon: ArrowRightLeft },
    { id: 'almacenes', label: 'Almacenes', icon: Warehouse },
];
const SERIALES_TAB = { id: 'seriales', label: 'Seriales', icon: Barcode };

// --- Loading spinner for Suspense ---
const TabSpinner = () => (
    <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-3 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
            <span className="text-slate-400 text-sm font-medium animate-pulse">Cargando...</span>
        </div>
    </div>
);

// --- Placeholder for tabs not yet implemented ---
const TabPlaceholder = ({ label, icon: Icon }) => (
    <div className="flex flex-col items-center justify-center h-64 text-slate-400">
        <Icon size={48} className="mb-4 opacity-40" />
        <p className="text-lg font-bold">Sección {label}</p>
        <p className="text-sm">Próximamente</p>
    </div>
);

// ============================================================
// MAIN COMPONENT
// ============================================================
const InventoryCenter = () => {
    const { modules } = useConfig();
    const TABS = modules?.services
        ? [...BASE_TABS, SERIALES_TAB]
        : BASE_TABS;
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = searchParams.get('tab') || 'productos';
    const help = useHelp();
    const helpKey = {
        productos:  'inventory/productos',
        categorias: 'inventory/categorias',
        kardex:     'inventory/kardex',
        traslados:  'inventory/traslados',
        almacenes:  'inventory/almacenes',
        seriales:   'inventory/seriales',
    }[activeTab] || null;


    const setActiveTab = (tabId) => {
        setSearchParams({ tab: tabId });
    };

    // ============================================================
    // RENDER: Tab content router
    // ============================================================
    const renderTabContent = () => {
        switch (activeTab) {
            case 'productos':
                return (
                    <Suspense fallback={<TabSpinner />}>
                        <ProductsTab />
                    </Suspense>
                );
            case 'categorias':
                return (
                    <Suspense fallback={<TabSpinner />}>
                        <CategoriesTab />
                    </Suspense>
                );
            case 'kardex':
                return (
                    <Suspense fallback={<TabSpinner />}>
                        <KardexTab />
                    </Suspense>
                );
            case 'traslados':
                return (
                    <Suspense fallback={<TabSpinner />}>
                        <TransfersTab />
                    </Suspense>
                );
            case 'almacenes':
                return (
                    <Suspense fallback={<TabSpinner />}>
                        <WarehousesTab />
                    </Suspense>
                );
            case 'seriales':
                return (
                    <Suspense fallback={<TabSpinner />}>
                        <SerialsTab />
                    </Suspense>
                );
            default: {
                const tab = TABS.find(t => t.id === activeTab);
                return <TabPlaceholder label={tab?.label || activeTab} icon={tab?.icon || Package} />;
            }
        }
    };

    const activeTabMeta = TABS.find(tab => tab.id === activeTab) || TABS[0];
    const ActiveIcon = activeTabMeta.icon;
    const activeDescription = TAB_DESCRIPTIONS[activeTab];

    // ============================================================
    // MAIN RENDER
    // ============================================================
    return (
        <div className="min-h-screen bg-slate-50">
            <div className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
                <div className="max-w-7xl mx-auto px-4 sm:px-6">
                    <div className="flex flex-col gap-3 py-3">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                                    <Package size={14} /> Inventario
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                    <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Centro de Inventario</h1>
                                    <span className="hidden sm:inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-bold text-slate-600">
                                        <ActiveIcon size={13} /> {activeTabMeta.label}
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                {helpKey && <HelpButton contextKey={helpKey} onClick={help.open} />}
                            </div>
                        </div>

                        <div id="tour-inventory-tabs" className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide" role="tablist" aria-label="Secciones de inventario">
                            {TABS.map(tab => {
                                const TabIcon = tab.icon;
                                const isActive = activeTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        id={`tour-inventory-tab-${tab.id}`}
                                        type="button"
                                        role="tab"
                                        aria-selected={isActive}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`flex h-10 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-bold transition-colors ${
                                            isActive
                                                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-100'
                                                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                                        }`}
                                    >
                                        <TabIcon size={15} className={isActive ? 'text-white' : 'text-slate-400'} />
                                        {tab.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4">
                {activeDescription && (
                    <section className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
                        <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500">
                                <ActiveIcon size={16} />
                            </div>
                            <div className="min-w-0">
                                <h2 className="text-sm font-black text-slate-900">{activeTabMeta.label}</h2>
                                <p className="mt-0.5 text-sm text-slate-600 leading-relaxed">{activeDescription.desc}</p>
                                <p className="mt-1 text-xs font-medium text-slate-400">{activeDescription.tip}</p>
                            </div>
                        </div>
                    </section>
                )}

                {renderTabContent()}
            </main>

            {help.isOpen && helpKey && <HelpDrawer contextKey={helpKey} onClose={help.close} />}

        </div>
    );
};

export default InventoryCenter;
