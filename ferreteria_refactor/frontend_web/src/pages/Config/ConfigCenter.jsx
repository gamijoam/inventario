import React, { Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    Info, Building2, Users, DollarSign, Percent, CreditCard, Printer, ShieldCheck, ClipboardList, Monitor
} from 'lucide-react';

const GeneralTab = React.lazy(() => import('./tabs/GeneralTab'));
const UsuariosTab = React.lazy(() => import('./tabs/UsuariosTab'));
const MonedasTab = React.lazy(() => import('./tabs/MonedasTab'));
const ImpuestosTab = React.lazy(() => import('./tabs/ImpuestosTab'));
const PagosTab = React.lazy(() => import('./tabs/PagosTab'));
const ImpresorasTab = React.lazy(() => import('./tabs/ImpresorasTab'));
const GarantiasConfigTab = React.lazy(() => import('./tabs/GarantiasConfigTab'));
const AuditoriaTab = React.lazy(() => import('./tabs/AuditoriaTab'));
const EstacionPOSTab = React.lazy(() => import('./tabs/EstacionPOSTab'));
const ComisionesTab = React.lazy(() => import('./tabs/ComisionesTab'));

// --- Tab descriptions ---
const TAB_DESCRIPTIONS = {
    general: { desc: 'Configura los datos de tu negocio: nombre, logo, dirección, RIF y datos fiscales.', tip: 'Estos datos aparecen en los tickets y reportes.' },
    usuarios: { desc: 'Administra las cuentas de acceso al sistema con sus roles y permisos.', tip: 'Roles disponibles: ADMIN (acceso total), CAJERO (POS + ventas), ALMACÉN (inventario).' },
    monedas: { desc: 'Configura tasas de cambio, activa la consulta automática del BCV y define tu moneda ancla.', tip: 'La tasa BCV se actualiza automáticamente cada día hábil.' },
    impuestos: { desc: 'Define los impuestos aplicables a tus ventas: IVA, IGTF y tasas especiales.', tip: 'El IGTF 3% se aplica automáticamente a pagos en divisas según normativa venezolana.' },
    pagos: { desc: 'Configura los métodos de cobro disponibles en el POS y sus respectivas cuentas.', tip: 'Puedes habilitar o deshabilitar métodos por tipo de negocio.' },
    impresoras: { desc: 'Conecta y configura impresoras térmicas ESC/POS para tickets de venta y servicios.', tip: 'Requiere el puente Hardware Bridge instalado en la PC con la impresora.' },
    garantias: { desc: 'Define las políticas de garantía que puedes asignar a productos y órdenes de servicio.', tip: 'Marca una política como predeterminada para que se aplique automáticamente.' },
    auditoria: { desc: 'Consulta el registro completo de acciones realizadas en el sistema por todos los usuarios.', tip: 'Filtra por usuario, tipo de acción o rango de fechas para rastrear cambios.' },
    pos: { desc: 'Configura opciones avanzadas de la estación de punto de venta: pantalla, comportamiento y accesos.', tip: 'Los cambios en esta sección aplican a la sesión actual del POS.' },
};

// --- Tab definitions ---
const TABS = [
    { id: 'general', label: 'General', icon: Building2 },
    { id: 'usuarios', label: 'Usuarios', icon: Users },
    { id: 'monedas', label: 'Monedas', icon: DollarSign },
    { id: 'impuestos', label: 'Impuestos', icon: Percent },
    { id: 'pagos', label: 'Métodos de Pago', icon: CreditCard },
    { id: 'impresoras', label: 'Impresoras', icon: Printer },
    { id: 'garantias', label: 'Políticas de Garantía', icon: ShieldCheck },
    { id: 'auditoria', label: 'Auditoría', icon: ClipboardList },
    { id: 'pos', label: 'Estación POS', icon: Monitor },
    { id: 'comisiones', label: 'Comisiones', icon: DollarSign },
];

// --- Loading spinner for Suspense ---
const TabSpinner = () => (
    <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-3 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
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
const ConfigCenter = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = searchParams.get('tab') || 'general';

    const setActiveTab = (tabId) => {
        setSearchParams({ tab: tabId });
    };

    // ============================================================
    // RENDER: Tab content router
    // ============================================================
    const renderTabContent = () => {
        switch (activeTab) {
            case 'general':
                return (
                    <Suspense fallback={<TabSpinner />}>
                        <GeneralTab />
                    </Suspense>
                );
            case 'usuarios':
                return (
                    <Suspense fallback={<TabSpinner />}>
                        <UsuariosTab />
                    </Suspense>
                );
            case 'monedas':
                return (
                    <Suspense fallback={<TabSpinner />}>
                        <MonedasTab />
                    </Suspense>
                );
            case 'impuestos':
                return (
                    <Suspense fallback={<TabSpinner />}>
                        <ImpuestosTab />
                    </Suspense>
                );
            case 'pagos':
                return (
                    <Suspense fallback={<TabSpinner />}>
                        <PagosTab />
                    </Suspense>
                );
            case 'impresoras':
                return (
                    <Suspense fallback={<TabSpinner />}>
                        <ImpresorasTab />
                    </Suspense>
                );
            case 'garantias':
                return (
                    <Suspense fallback={<TabSpinner />}>
                        <GarantiasConfigTab />
                    </Suspense>
                );
            case 'auditoria':
                return (
                    <Suspense fallback={<TabSpinner />}>
                        <AuditoriaTab />
                    </Suspense>
                );
            case 'pos':
                return (
                    <Suspense fallback={<TabSpinner />}>
                        <EstacionPOSTab />
                    </Suspense>
                );
            case 'comisiones':
                return (
                    <Suspense fallback={<TabSpinner />}>
                        <ComisionesTab />
                    </Suspense>
                );
            default: {
                const tab = TABS.find(t => t.id === activeTab);
                return <TabPlaceholder label={tab?.label || activeTab} icon={tab?.icon || Building2} />;
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
                            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Centro de Configuración</h1>
                            <p className="text-slate-500 text-sm font-medium">Personaliza tu sistema, usuarios y opciones avanzadas</p>
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
                                            ? 'text-slate-600 border-slate-600'
                                            : 'text-slate-500 border-transparent hover:text-slate-600 hover:bg-slate-50'
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
        </div>
    );
};

export default ConfigCenter;
