import React, { Suspense, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import HelpDrawer, { HelpButton } from '../../help/HelpDrawer';
import { useHelp } from '../../help/useHelp';
import { useConfig } from '../../context/ConfigContext';
import MessageCircle from 'lucide-react/dist/esm/icons/message-circle';
import ShoppingBag from 'lucide-react/dist/esm/icons/shopping-bag';
import {
    Building2, Users, DollarSign, Percent, CreditCard, Printer,
    ShieldCheck, ClipboardList, Monitor, ChevronRight, Menu, X, Lock
} from 'lucide-react';

const GeneralTab        = React.lazy(() => import('./tabs/GeneralTab'));
const UsuariosTab       = React.lazy(() => import('./tabs/UsuariosTab'));
const MonedasTab        = React.lazy(() => import('./tabs/MonedasTab'));
const ImpuestosTab      = React.lazy(() => import('./tabs/ImpuestosTab'));
const PagosTab          = React.lazy(() => import('./tabs/PagosTab'));
const ImpresorasTab     = React.lazy(() => import('./tabs/ImpresorasTab'));
const GarantiasConfigTab = React.lazy(() => import('./tabs/GarantiasConfigTab'));
const AuditoriaTab      = React.lazy(() => import('./tabs/AuditoriaTab'));
const EstacionPOSTab    = React.lazy(() => import('./tabs/EstacionPOSTab'));
const ComisionesTab     = React.lazy(() => import('./tabs/ComisionesTab'));
const WhatsAppTab       = React.lazy(() => import('./tabs/WhatsAppTab'));
const CatalogTab        = React.lazy(() => import('./tabs/CatalogTab'));
const IntegracionesTab  = React.lazy(() => import('./tabs/IntegracionesTab'));

// ── Grupos del menú lateral ──────────────────────────────────────────────────
const GROUPS = [
    {
        label: 'Negocio',
        items: [
            { id: 'general',    label: 'General',           icon: Building2,    desc: 'Datos del negocio, logo, dirección' },
            { id: 'usuarios',   label: 'Usuarios',          icon: Users,        desc: 'Cuentas de acceso y permisos' },
            { id: 'comisiones', label: 'Comisiones',        icon: DollarSign,   desc: 'Reglas y tasas de comisión' },
        ],
    },
    {
        label: 'Finanzas',
        items: [
            { id: 'monedas',    label: 'Monedas',           icon: DollarSign,   desc: 'Tasas de cambio y monedas' },
            { id: 'impuestos',  label: 'Impuestos',         icon: Percent,      desc: 'IVA, IGTF y tasas especiales' },
            { id: 'pagos',      label: 'Métodos de Pago',   icon: CreditCard,   desc: 'Formas de cobro disponibles' },
        ],
    },
    {
        label: 'Sistema',
        items: [
            { id: 'impresoras', label: 'Impresoras',        icon: Printer,      desc: 'Impresoras térmicas ESC/POS' },
            { id: 'garantias',  label: 'Garantías',         icon: ShieldCheck,  desc: 'Políticas de garantía' },
            { id: 'pos',        label: 'Estación POS',      icon: Monitor,      desc: 'Opciones avanzadas del POS' },
            { id: 'auditoria',  label: 'Auditoría',         icon: ClipboardList, desc: 'Registro de actividad' },
            { id: 'catalogo',   label: 'Catálogo Público',  icon: ShoppingBag,  desc: 'Link, QR, carrito y opciones del catálogo' },
            { id: 'whatsapp',   label: 'WhatsApp',          icon: MessageCircle, desc: 'Notificaciones y mensajes' },
            { id: 'integraciones', label: 'Integraciones',   icon: Lock,         desc: 'BloqueCelular y otros sistemas externos' },
        ],
    },
];

// ── Spinner ──────────────────────────────────────────────────────────────────
const TabSpinner = () => (
    <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
    </div>
);

// ── Render contenido ─────────────────────────────────────────────────────────
const renderTabContent = (activeTab) => {
    const wrap = (Component) => (
        <Suspense fallback={<TabSpinner />}><Component /></Suspense>
    );
    switch (activeTab) {
        case 'general':    return wrap(GeneralTab);
        case 'usuarios':   return wrap(UsuariosTab);
        case 'monedas':    return wrap(MonedasTab);
        case 'impuestos':  return wrap(ImpuestosTab);
        case 'pagos':      return wrap(PagosTab);
        case 'impresoras': return wrap(ImpresorasTab);
        case 'garantias':  return wrap(GarantiasConfigTab);
        case 'auditoria':  return wrap(AuditoriaTab);
        case 'catalogo':   return wrap(CatalogTab);
        case 'whatsapp':      return wrap(WhatsAppTab);
        case 'integraciones': return wrap(IntegracionesTab);
        case 'pos':        return wrap(EstacionPOSTab);
        case 'comisiones': return wrap(ComisionesTab);
        default:           return null;
    }
};

// ── MAIN ─────────────────────────────────────────────────────────────────────
const ConfigCenter = () => {
    const { modules, featureFlags } = useConfig();
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = searchParams.get('tab') || 'general';
    const [mobileOpen, setMobileOpen] = useState(false);
    const help = useHelp();
    const configHelpKey = `config/${activeTab}`;

    const setTab = (id) => {
        setSearchParams({ tab: id });
        setMobileOpen(false);
    };

    // Filtrar tabs según módulos activos y feature flags
    const visibleGroups = GROUPS.map(group => ({
        ...group,
        items: group.items.filter(item => {
            if (item.id === 'integraciones') return modules?.services;
            if (item.id === 'whatsapp') return featureFlags?.whatsapp_business;
            if (item.id === 'catalogo') return featureFlags?.catalogo_publico;
            return true;
        })
    })).filter(group => group.items.length > 0);

    // Aplanar para búsqueda rápida (solo tabs visibles)
    const allTabs = visibleGroups.flatMap(g => g.items);

    const currentItem = allTabs.find(t => t.id === activeTab);
    const CurrentIcon = currentItem?.icon || Building2;

    // ── Sidebar Nav ──────────────────────────────────────────────────────────
    const SidebarNav = ({ onClose }) => (
        <nav className="flex flex-col h-full">
            {/* Logo / título */}
            <div className="px-4 py-5 border-b border-slate-100 flex items-center justify-between">
                <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Panel</p>
                    <p className="text-base font-black text-slate-800">Configuración</p>
                </div>
                {onClose && (
                    <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg md:hidden">
                        <X size={18} className="text-slate-500" />
                    </button>
                )}
            </div>

            {/* Grupos */}
            <div className="flex-1 overflow-y-auto py-3 px-3 space-y-5">
                {visibleGroups.map(group => (
                    <div key={group.label}>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2 mb-1.5">
                            {group.label}
                        </p>
                        <div className="space-y-0.5">
                            {group.items.map(item => {
                                const Icon = item.icon;
                                const active = activeTab === item.id;
                                return (
                                    <button key={item.id} onClick={() => setTab(item.id)}
                                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all text-left group ${
                                            active
                                                ? 'bg-blue-600 text-white shadow-sm shadow-indigo-200'
                                                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                                        }`}>
                                        <Icon size={16} className={active ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'} />
                                        <span className="font-semibold flex-1">{item.label}</span>
                                        {active && <ChevronRight size={14} className="text-white/70" />}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </nav>
    );

    return (
        <div className="flex h-full min-h-screen bg-slate-50">

            {/* ── SIDEBAR DESKTOP (md+) ─────────────────────────────────── */}
            <aside className="hidden md:flex flex-col w-56 lg:w-60 shrink-0 bg-white border-r border-slate-200 sticky top-0 h-screen overflow-hidden">
                <SidebarNav />
            </aside>

            {/* ── DRAWER MOBILE ─────────────────────────────────────────── */}
            {mobileOpen && (
                <div className="fixed inset-0 z-50 md:hidden flex">
                    <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
                    <div className="relative w-64 bg-white h-full shadow-2xl flex flex-col">
                        <SidebarNav onClose={() => setMobileOpen(false)} />
                    </div>
                </div>
            )}

            {/* ── CONTENIDO ─────────────────────────────────────────────── */}
            <div className="flex-1 flex flex-col min-w-0">

                {/* Header del contenido */}
                <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 flex items-center gap-4 sticky top-0 z-20">
                    {/* Botón menú móvil */}
                    <button onClick={() => setMobileOpen(true)}
                        className="md:hidden p-2 -ml-1 hover:bg-slate-100 rounded-xl transition-colors">
                        <Menu size={20} className="text-slate-600" />
                    </button>

                    {/* Icono + título de la sección activa */}
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-center shrink-0">
                            <CurrentIcon size={18} className="text-blue-600" />
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-lg font-black text-slate-900 leading-tight truncate">
        {currentItem?.label || 'Configuración'}
                            </h1>
                            <p className="text-xs text-slate-400 truncate hidden sm:block">
                                {currentItem?.desc}
                            </p>
                        </div>
                    </div>
                    <HelpButton contextKey={configHelpKey} onClick={help.open} />
                </div>

                {help.isOpen && <HelpDrawer contextKey={configHelpKey} onClose={help.close} />}

                {/* Área de contenido */}
                <div className="flex-1 p-4 sm:p-6 overflow-y-auto">
                    <div className="max-w-4xl w-full mx-auto">
                        {renderTabContent(activeTab)}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConfigCenter;
