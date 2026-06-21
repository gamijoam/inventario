import React, { lazy, Suspense } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useFeatureFlag } from '../../hooks/useFeatureFlag';
import HelpDrawer, { HelpButton } from '../../help/HelpDrawer';
import { useHelp } from '../../help/useHelp';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { PERMISSIONS } from '../../config/permissions';
import {
    FileText, Users, CornerDownLeft, ShieldCheck, CreditCard, Info, Archive
} from 'lucide-react';

const CotizacionesTab = React.lazy(() => import('./tabs/CotizacionesTab'));
const ClientesTab = React.lazy(() => import('./tabs/ClientesTab'));
const DevolucionesTab = React.lazy(() => import('./tabs/DevolucionesTab'));
const GarantiasTab = React.lazy(() => import('./tabs/GarantiasTab'));
const CreditosTab = React.lazy(() => import('./tabs/CreditosTab'));
const ApartadosTab = React.lazy(() => import('./tabs/ApartadosTab'));

// --- Tab descriptions ---
const TAB_DESCRIPTIONS = {
    cotizaciones: { desc: 'Crea y gestiona cotizaciones para tus clientes. Conviértelas en ventas con un solo clic.', tip: 'Las cotizaciones tienen fecha de vencimiento configurable.' },
    clientes: { desc: 'Administra tu cartera de clientes: historial de compras, límite de crédito y datos de contacto.', tip: 'Puedes marcar clientes como inactivos sin perder su historial.' },
    devoluciones: { desc: 'Procesa devoluciones de ventas buscando por número de factura. El stock se reintegra automáticamente.', tip: 'Solo se pueden devolver ventas en estado COMPLETADO.' },
    garantias: { desc: 'Gestiona las reclamaciones de garantía de tus clientes y consulta el historial por producto.', tip: 'Las garantías se vinculan a la política configurada al momento de la venta.' },
    creditos: { desc: 'Controla las cuentas por cobrar: facturas a crédito, abonos pendientes y antigüedad de cartera.', tip: 'Usa el reporte de antigüedad para priorizar cobros urgentes.' },
    apartados: { desc: 'Gestiona productos reservados con inicial, abonos, vencimientos y liberacion de stock o IMEI.', tip: 'Los apartados reducen el disponible sin cerrar la venta hasta completar el pago.' },
};

// --- Tab definitions ---
const ALL_TABS = [
    { id: 'cotizaciones', label: 'Cotizaciones', icon: FileText },
    { id: 'clientes',     label: 'Clientes',     icon: Users },
    { id: 'devoluciones', label: 'Devoluciones', icon: CornerDownLeft, adminOnly: true },
    { id: 'garantias',    label: 'Garantías',    icon: ShieldCheck,    adminOnly: true },
    { id: 'creditos',     label: 'Créditos (CxC)', icon: CreditCard,  adminOnly: true },
    { id: 'apartados',    label: 'Apartados', icon: Archive, permissions: [PERMISSIONS.LAYAWAYS_VIEW] },
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
const SalesCenter = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const { user, hasAnyPermission } = useAuth();
    const isCashier = user?.role === 'CASHIER';
    const showCajeroRestringido = useFeatureFlag('cajero_restringido_pos');
    const TABS = ALL_TABS.filter(t => (!t.adminOnly || !(isCashier && showCajeroRestringido)) && (!t.permissions || hasAnyPermission(t.permissions)));

    const requestedTab = searchParams.get('tab') || 'cotizaciones';
    const activeTab = TABS.some(t => t.id === requestedTab) ? requestedTab : (TABS[0]?.id || 'cotizaciones');
    const help = useHelp();
    const helpKey = {
        cotizaciones: 'sales/cotizaciones',
        clientes:     'sales/clientes',
        devoluciones: 'sales/devoluciones',
        garantias:    'sales/garantias',
        creditos:     'sales/creditos',
        apartados:    'sales/apartados',
    }[activeTab] || null;

    const setActiveTab = (tabId) => {
        setSearchParams({ tab: tabId });
    };

    // ============================================================
    // RENDER: Tab content router
    // ============================================================
    const renderTabContent = () => {
        switch (activeTab) {
            case 'cotizaciones':
                return (
                    <Suspense fallback={<TabSpinner />}>
                        <CotizacionesTab
                            onCreateNew={() => navigate('/quotes')}
                            onEdit={(id) => navigate(`/quotes?edit=${id}`)}
                        />
                    </Suspense>
                );
            case 'clientes':
                return (
                    <Suspense fallback={<TabSpinner />}>
                        <ClientesTab />
                    </Suspense>
                );
            case 'devoluciones':
                return (
                    <Suspense fallback={<TabSpinner />}>
                        <DevolucionesTab />
                    </Suspense>
                );
            case 'garantias':
                return (
                    <Suspense fallback={<TabSpinner />}>
                        <GarantiasTab />
                    </Suspense>
                );
            case 'creditos':
                return (
                    <Suspense fallback={<TabSpinner />}>
                        <CreditosTab />
                    </Suspense>
                );
            case 'apartados':
                return (
                    <Suspense fallback={<TabSpinner />}>
                        <ApartadosTab />
                    </Suspense>
                );
            default: {
                const tab = TABS.find(t => t.id === activeTab);
                return <TabPlaceholder label={tab?.label || activeTab} icon={tab?.icon || FileText} />;
            }
        }
    };

    // ============================================================
    // MAIN RENDER
    // ============================================================
    return (
        <div id="tour-sales-container" className="min-h-screen bg-slate-50/50">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-30">
                <div className="max-w-7xl mx-auto px-4 sm:px-6">
                    {/* Title row */}
                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 py-4">
                        <div>
                            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Centro de Ventas</h1>
                            <p className="text-slate-500 text-sm font-medium">Gestión completa de clientes, cotizaciones y postventa</p>
                        </div>
                        {helpKey && <HelpButton contextKey={helpKey} onClick={help.open} />}
                    </div>

                    {/* Tab Navigation */}
                    <div id="tour-sales-tabs" className="flex overflow-x-auto gap-1.5 pb-1 scrollbar-hide">
                        {TABS.map(tab => {
                            const TabIcon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    id={`tour-sales-tab-${tab.id}`}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all shrink-0 ${
                                        isActive
                                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                                            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
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

            {/* Description Banner */}
            {TAB_DESCRIPTIONS[activeTab] && (
                <div className="mx-6 mb-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex items-start gap-3">
                    <Info size={16} className="text-slate-400 mt-0.5 shrink-0" />
                    <div>
                        <p className="text-sm text-slate-600">{TAB_DESCRIPTIONS[activeTab].desc}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{TAB_DESCRIPTIONS[activeTab].tip}</p>
                    </div>
                </div>
            )}

            {/* Tab Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
                {renderTabContent()}
            </div>
            {help.isOpen && helpKey && <HelpDrawer contextKey={helpKey} onClose={help.close} />}
        </div>
    );
};

export default SalesCenter;
