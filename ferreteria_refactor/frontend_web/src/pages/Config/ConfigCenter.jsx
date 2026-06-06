import React, { Suspense, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import HelpDrawer, { HelpButton } from '../../help/HelpDrawer';
import { useHelp } from '../../help/useHelp';
import { useConfig } from '../../context/ConfigContext';
import MessageCircle from 'lucide-react/dist/esm/icons/message-circle';
import ShoppingBag from 'lucide-react/dist/esm/icons/shopping-bag';
import {
    Building2, Users, DollarSign, Percent, CreditCard, Printer,
    ShieldCheck, ClipboardList, Monitor, ChevronRight, Menu, X, Lock, Calculator
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
const IntegracionesTab      = React.lazy(() => import('./tabs/IntegracionesTab'));
const FinanciadoresConfigTab = React.lazy(() => import('./tabs/FinanciadoresConfigTab'));
const PreciosMasivosTab     = React.lazy(() => import('./tabs/PreciosMasivosTab'));

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
            { id: 'precios',    label: 'Precios masivos',   icon: Calculator,   desc: 'Aplicar margen a todos los productos' },
            { id: 'financiadoras', label: 'Financiadoras',      icon: Building2,    desc: 'Cashea, Krece y empresas de crédito externo' },
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
    <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600" />
    </div>
);

// ── Render contenido ─────────────────────────────────────────────────────────
const renderTabContent = (activeTab) => {
    const wrap = (Component) => (
        <Suspense fallback={<TabSpinner />}><Component /></Suspense>
    );
    switch (activeTab) {
        case 'precios':    return wrap(PreciosMasivosTab);
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
        case 'financiadoras': return wrap(FinanciadoresConfigTab);
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
            if (item.id === 'comisiones') return featureFlags?.modulo_comisiones;
            if (item.id === 'financiadoras') return true; // siempre visible para admins
            return true;
        })
    })).filter(group => group.items.length > 0);

    // Aplanar para búsqueda rápida (solo tabs visibles)
    const allTabs = visibleGroups.flatMap(g => g.items);

    const currentItem = allTabs.find(t => t.id === activeTab);
    const CurrentIcon = currentItem?.icon || Building2;

    // ── Sidebar Nav ──────────────────────────────────────────────────────────
    const SidebarNav = ({ onClose }) => (
        <nav className="flex h-full flex-col">
            {/* Logo / título */}
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4">
                <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-indigo-600 text-white shadow-sm">
                        <Building2 size={18} />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Panel</p>
                        <p className="truncate text-base font-black text-slate-800">Configuración</p>
                    </div>
                </div>
                {onClose && (
                    <button onClick={onClose} className="rounded-md p-1.5 transition-colors hover:bg-slate-100 md:hidden">
                        <X size={18} className="text-slate-500" />
                    </button>
                )}
            </div>

            {/* Grupos */}
            <div className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
                {visibleGroups.map(group => (
                    <div key={group.label}>
                        <p className="mb-1.5 px-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                            {group.label}
                        </p>
                        <div className="space-y-0.5">
                            {group.items.map(item => {
                                const Icon = item.icon;
                                const active = activeTab === item.id;
                                return (
                                    <button key={item.id} onClick={() => setTab(item.id)}
                                        className={`group flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors ${
                                            active
                                                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
                                                : 'text-slate-600 hover:bg-indigo-50 hover:text-indigo-700'
                                        }`}>
                                        <Icon size={16} className={active ? 'text-white' : 'text-slate-400 group-hover:text-indigo-600'} />
                                        <span className="min-w-0 flex-1 truncate font-semibold">{item.label}</span>
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
        <div className="flex min-h-screen bg-slate-50">

            {/* ── SIDEBAR DESKTOP (md+) ─────────────────────────────────── */}
            <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-64 shrink-0 flex-col overflow-hidden border-r border-slate-200 bg-white/95 md:flex">
                <SidebarNav />
            </aside>

            {/* ── DRAWER MOBILE ─────────────────────────────────────────── */}
            {mobileOpen && (
                <div className="fixed inset-0 z-50 md:hidden flex">
                    <div className="absolute inset-0 bg-indigo-950/35" onClick={() => setMobileOpen(false)} />
                    <div className="relative flex h-full w-72 flex-col bg-white shadow-xl">
                        <SidebarNav onClose={() => setMobileOpen(false)} />
                    </div>
                </div>
            )}

            {/* ── CONTENIDO ─────────────────────────────────────────────── */}
            <div className="flex-1 flex flex-col min-w-0">

                {/* Header del contenido */}
                <div className="sticky top-0 z-30 flex items-center gap-4 border-b border-slate-200 bg-white/95 px-4 py-4 shadow-sm shadow-slate-200/40 backdrop-blur-md sm:px-6">
                    {/* Botón menú móvil */}
                    <button onClick={() => setMobileOpen(true)}
                        className="-ml-1 rounded-md p-2 transition-colors hover:bg-slate-100 md:hidden">
                        <Menu size={20} className="text-slate-600" />
                    </button>

                    {/* Icono + título de la sección activa */}
                    <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-indigo-100 bg-indigo-50">
                            <CurrentIcon size={19} className="text-indigo-600" />
                        </div>
                        <div className="min-w-0">
                            <p className="hidden text-[10px] font-black uppercase tracking-widest text-slate-400 sm:block">Configuración</p>
                            <h1 className="truncate text-lg font-black leading-tight text-slate-900">
                                {currentItem?.label || 'Configuración'}
                            </h1>
                            <p className="hidden truncate text-xs text-slate-500 sm:block">
                                {currentItem?.desc}
                            </p>
                        </div>
                    </div>
                    <div className="ml-auto">
                        <HelpButton contextKey={configHelpKey} onClick={help.open} />
                    </div>
                </div>

                {help.isOpen && <HelpDrawer contextKey={configHelpKey} onClose={help.close} />}

                {/* Área de contenido */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                    <div className="mx-auto w-full max-w-6xl">
                        {renderTabContent(activeTab)}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConfigCenter;
