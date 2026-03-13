import React, { useState, useMemo, lazy, Suspense } from 'react';
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

// --- Tab definitions ---
const TABS = [
    { id: 'productos', label: 'Productos', icon: Package },
    { id: 'categorias', label: 'Categorías', icon: Tags },
    { id: 'kardex', label: 'Kardex', icon: Archive },
    { id: 'traslados', label: 'Traslados', icon: ArrowRightLeft },
    { id: 'almacenes', label: 'Almacenes', icon: Warehouse },
    { id: 'seriales', label: 'Seriales', icon: Barcode },
];

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
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = searchParams.get('tab') || 'productos';

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

    // ============================================================
    // MAIN RENDER
    // ============================================================
    return (
        <div className="min-h-screen bg-slate-50/50">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-30">
                <div className="max-w-7xl mx-auto px-4 sm:px-6">
                    {/* Title row */}
                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 py-4">
                        <div>
                            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Centro de Inventario</h1>
                            <p className="text-slate-500 text-sm font-medium">Gestión completa de tu inventario</p>
                        </div>
                    </div>

                    {/* Tab Navigation */}
                    <div className="flex overflow-x-auto gap-0 -mb-px scrollbar-hide">
                        {TABS.map(tab => {
                            const TabIcon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-2 px-4 py-3 text-sm font-bold whitespace-nowrap border-b-2 transition-all ${
                                        isActive
                                            ? 'text-emerald-600 border-emerald-600'
                                            : 'text-slate-500 border-transparent hover:text-slate-700 hover:border-slate-300'
                                    }`}
                                >
                                    <TabIcon size={16} />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Tab Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
                {renderTabContent()}
            </div>
        </div>
    );
};

export default InventoryCenter;
