import React, { lazy, Suspense, useState } from 'react';
import { useConfig } from '../../context/ConfigContext';
import HelpDrawer, { HelpButton } from '../../help/HelpDrawer';
import { useHelp } from '../../help/useHelp';
import { useSearchParams } from 'react-router-dom';
import InventoryExportCenter from '../../components/inventory/InventoryExportCenter';
import {
    Package, Tags, Archive, ArrowRightLeft, Warehouse, Barcode, Download
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
    const [isExportOpen, setIsExportOpen] = useState(false);
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
        <div className="min-h-screen bg-slate-50/80 md:-mx-4 lg:-mx-6">
            <div className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
                <div className="w-full px-2.5 sm:px-4 lg:px-5">
                    <div className="flex flex-col gap-1.5 py-2">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                                <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide text-slate-400">
                                    <Package size={13} /> Inventario
                                </div>
                                <h1 className="text-lg font-black text-slate-900 tracking-tight">Centro de Inventario</h1>
                                <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-bold text-slate-600">
                                    <ActiveIcon size={12} /> {activeTabMeta.label}
                                </span>
                                {activeDescription && (
                                    <span className="hidden xl:inline min-w-0 truncate text-xs font-medium text-slate-500">
                                        {activeDescription.desc}
                                    </span>
                                )}
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                                <button
                                    id="tour-inventory-export-center"
                                    type="button"
                                    onClick={() => setIsExportOpen(true)}
                                    className="inline-flex h-8 items-center gap-2 rounded-md border border-indigo-200 bg-indigo-50 px-2.5 text-xs font-black text-indigo-700 shadow-sm transition-colors hover:border-indigo-300 hover:bg-indigo-100"
                                >
                                    <Download size={16} />
                                    <span className="hidden sm:inline">Exportar datos</span>
                                </button>
                                {helpKey && <HelpButton contextKey={helpKey} onClick={help.open} />}
                            </div>
                        </div>

                        <div id="tour-inventory-tabs" className="flex gap-1 overflow-x-auto scrollbar-hide" role="tablist" aria-label="Secciones de inventario">
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
                                        className={`flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-bold transition-colors ${
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

            <main className="w-full px-2.5 py-2.5 sm:px-4 lg:px-5">
                {renderTabContent()}
            </main>

            {help.isOpen && helpKey && <HelpDrawer contextKey={helpKey} onClose={help.close} />}
            <InventoryExportCenter isOpen={isExportOpen} onClose={() => setIsExportOpen(false)} />

        </div>
    );
};

export default InventoryCenter;
