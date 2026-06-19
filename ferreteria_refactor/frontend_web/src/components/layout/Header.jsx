import { Bell, ShoppingCart, LogOut, Settings, AlertTriangle, AlertCircle, BarChart2, TrendingUp, X, ChevronDown, HelpCircle, LifeBuoy, BookOpen, Building2 } from 'lucide-react';
// import GlobalSearch from './GlobalSearch';
import { Link, useNavigate } from 'react-router-dom';
import { useConfig } from '../../context/ConfigContext';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { useCash } from '../../context/CashContext';
import { useState } from 'react';
import { cn } from '../../utils/cn';
import TourSelectionModal from '../common/TourSelectionModal';

// ─── Rate freshness helper ───────────────────────────────────────────────────
function getRateFreshness(updatedAt) {
    if (!updatedAt) return 'unknown';
    const diff = (Date.now() - new Date(updatedAt)) / (1000 * 60 * 60);
    if (diff < 1) return 'fresh';
    if (diff < 8) return 'stale';
    return 'old';
}

function freshnessLabel(updatedAt) {
    if (!updatedAt) return 'Sin fecha';
    const diff = (Date.now() - new Date(updatedAt)) / (1000 * 60);
    if (diff < 60) return `hace ${Math.round(diff)} min`;
    if (diff < 1440) return `hace ${Math.round(diff / 60)}h`;
    return `hace ${Math.round(diff / 1440)}d`;
}

const FRESHNESS_DOT = {
    fresh:   'bg-emerald-400',
    stale:   'bg-amber-400',
    old:     'bg-rose-400',
    unknown: 'bg-slate-300',
};

const FLAG = { VES: '🇻🇪', COP: '🇨🇴', EUR: '🇪🇺', USD: '🇺🇸', BRL: '🇧🇷' };

// ─── Bottom Sheet ─────────────────────────────────────────────────────────────
function RateBottomSheet({ currencies, onClose }) {
    // Todas las tasas activas no-ancla, agrupadas por currency_code
    const allRates = currencies.filter(c => !c.is_anchor && c.is_active);

    // Agrupar: { VES: [bcv, paralelo, ...], COP: [...] }
    const grouped = allRates.reduce((acc, c) => {
        const key = c.currency_code;
        if (!acc[key]) acc[key] = [];
        acc[key].push(c);
        return acc;
    }, {});

    const currencyCodes = Object.keys(grouped);

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-indigo-950/35 z-40 animate-in fade-in duration-150"
                onClick={onClose}
            />

            {/* Sheet */}
            <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-lg shadow-xl animate-in slide-in-from-bottom duration-200 max-h-[85vh] flex flex-col">

                {/* Handle */}
                <div className="flex justify-center pt-3 pb-1">
                    <div className="w-10 h-1 rounded-full bg-slate-200" />
                </div>

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-md bg-indigo-50 flex items-center justify-center">
                            <TrendingUp size={16} className="text-indigo-600" />
                        </div>
                        <span className="font-bold text-slate-800 text-base">Tasas de Cambio</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-md hover:bg-slate-100 text-slate-400 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Currency list */}
                <div className="overflow-y-auto flex-1 px-4 py-3 space-y-4">
                    {currencyCodes.length === 0 && (
                        <p className="text-center text-sm text-slate-400 py-8">No hay monedas activas configuradas</p>
                    )}
                    {currencyCodes.map(code => {
                        const rates = grouped[code];
                        return (
                            <div key={code}>
                                {/* Currency header */}
                                <div className="flex items-center gap-2 mb-2 px-1">
                                    <span className="text-lg">{FLAG[code] || '💱'}</span>
                                    <span className="text-xs font-black text-slate-500 uppercase tracking-widest">{code}</span>
                                </div>
                                {/* Rate cards */}
                                <div className="space-y-2">
                                    {rates.map(c => {
                                        const freshness = getRateFreshness(c.updated_at);
                                        const rate = parseFloat(c.rate);
                                        const formattedRate = rate >= 1000
                                            ? rate.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                            : rate.toFixed(4);

                                        return (
                                            <div
                                                key={c.id}
                                                className={cn(
                                                    "flex items-center justify-between p-3.5 rounded-lg border",
                                                    c.is_default
                                                        ? "bg-indigo-50 border-indigo-200"
                                                        : "bg-slate-50 border-slate-100"
                                                )}
                                            >
                                                <div>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="font-bold text-slate-800 text-sm">{c.name || c.currency_code}</span>
                                                        {c.is_default && (
                                                            <span className="text-[9px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-md font-bold uppercase">Principal</span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-1 mt-0.5">
                                                        <div className={cn('w-1.5 h-1.5 rounded-full', FRESHNESS_DOT[freshness])} />
                                                        <span className="text-[11px] text-slate-400">{freshnessLabel(c.updated_at)}</span>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-xs text-slate-400 mb-0.5">1 USD =</div>
                                                    <div className="font-black text-slate-800 text-lg leading-none">
                                                        {formattedRate}
                                                        <span className="text-xs font-bold text-slate-400 ml-1">{c.currency_symbol || c.symbol}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Actions */}
                <div className="px-4 pb-6 pt-3 border-t border-slate-100">
                    <Link
                        to="/config-center?tab=monedas"
                        onClick={onClose}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white rounded-md font-bold text-sm hover:bg-indigo-700 active:scale-[0.98] transition-colors"
                    >
                        <Settings size={15} />
                        Gestionar tasas
                    </Link>
                </div>
            </div>
        </>
    );
}

// ─── Main Header ──────────────────────────────────────────────────────────────
export default function Header() {
    const { currencies } = useConfig();
    const { user, logout } = useAuth();
    const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
    const { isSessionOpen, session } = useCash();
    const navigate = useNavigate();
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const [isNotificationMenuOpen, setIsNotificationMenuOpen] = useState(false);
    const [isRateSheetOpen, setIsRateSheetOpen] = useState(false);
    const [isHelpMenuOpen, setIsHelpMenuOpen] = useState(false);
    const [isTourModalOpen, setIsTourModalOpen] = useState(false);
    const canAccessOwnerPortal = Boolean(user?.is_superuser || user?.is_org_owner || user?.org_role === 'owner');

    const secondaryCurrencies = currencies.filter(c => !c.is_anchor && c.is_active);
    const primaryRate = secondaryCurrencies.find(c => c.is_default) || secondaryCurrencies[0];
    const rate = primaryRate ? parseFloat(primaryRate.rate) : 0;
    const freshness = primaryRate ? getRateFreshness(primaryRate.updated_at) : 'unknown';


    const openTours = () => {
        setIsHelpMenuOpen(false);
        setIsTourModalOpen(true);
    };

    const openSupport = () => {
        setIsHelpMenuOpen(false);
    };

    return (
        <>
            <header className="h-16 bg-white/95 backdrop-blur-md border-b border-slate-200/70 sticky top-0 z-[80] px-4 md:px-6 flex items-center justify-between shadow-sm shadow-slate-200/40">

                {/* GlobalSearch — Ctrl+K */}
                {/* GlobalSearch oculto temporalmente por solicitud de UX.
                <div className="flex-1 flex items-center">
                    <GlobalSearch />
                </div>
                */}
                <div className="flex-1" />

                {/* Right: Actions & User */}
                <div className="flex items-center gap-2">

                    {/* ── Rate Chip (visible on ALL screen sizes) ── */}
                    {primaryRate && (
                        <button
                            onClick={() => setIsRateSheetOpen(true)}
                            className="flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 shadow-sm transition-colors hover:border-indigo-300 hover:bg-indigo-50 active:scale-95"
                        >
                            <div className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0', FRESHNESS_DOT[freshness])} />
                            <div className="flex flex-col items-start leading-none">
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                    {primaryRate.currency_symbol || primaryRate.symbol}
                                </span>
                                <span className="text-sm font-black text-slate-800 tabular-nums">
                                    {rate >= 1000
                                        ? rate.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                        : rate.toFixed(2)}
                                </span>
                            </div>
                            {secondaryCurrencies.length > 1 && (
                                <span className="hidden rounded-md bg-indigo-100 px-1.5 py-0.5 text-[10px] font-black text-indigo-600 sm:block">
                                    +{secondaryCurrencies.length - 1}
                                </span>
                            )}
                            <ChevronDown size={13} className="text-slate-400" />
                        </button>
                    )}

                    {/* Quick Actions Panel */}
                    <div className="flex items-center gap-2 border-r border-slate-200 pr-3 mr-1">
                        <div className={cn(
                            "hidden h-10 items-center gap-2 rounded-md border px-3 text-xs font-bold shadow-sm select-none md:flex",
                            isSessionOpen
                                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                                : "bg-rose-50 border-rose-200 text-rose-700"
                        )}
                            title={isSessionOpen ? `Turno Iniciado: ${session?.start_time ? new Date(session.start_time).toLocaleTimeString() : ''}${session?.register ? ` · ${session.register.code}` : ''}` : "La caja registradora está cerrada"}
                        >
                            <div className={cn(
                                "w-2 h-2 rounded-full",
                                isSessionOpen ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
                            )} />
                            {isSessionOpen
                                ? `${session?.register?.code ? `${session.register.code} · ` : ''}Abierta`
                                : "Caja Cerrada"
                            }
                        </div>

                        <Link to="/pos" className="hidden h-10 items-center gap-2 rounded-md bg-indigo-600 px-3 text-white shadow-sm transition-colors hover:bg-indigo-700 md:flex">
                            <ShoppingCart size={16} />
                            <span className="text-sm font-bold">Vender</span>
                        </Link>
                        <Link
                            to="/reports"
                            className="hidden h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-slate-600 shadow-sm transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 md:flex"
                        >
                            <BarChart2 size={16} />
                            <span className="text-sm font-bold">Reportes</span>
                        </Link>
                    </div>

                    {/* Help Menu */}
                    <div className="relative">
                        <button
                            onClick={() => setIsHelpMenuOpen(!isHelpMenuOpen)}
                            className={cn(
                                "relative flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-slate-600 shadow-sm transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700",
                                isHelpMenuOpen && "border-indigo-300 bg-indigo-50 text-indigo-700"
                            )}
                            title="Ayuda"
                        >
                            <HelpCircle size={17} />
                            <span className="hidden lg:inline">Ayuda</span>
                            <ChevronDown size={13} className={cn("text-slate-400 transition-transform", isHelpMenuOpen && "rotate-180 text-indigo-500")} />
                        </button>

                        {isHelpMenuOpen && (
                            <div className="fixed inset-0 z-[85]" onClick={() => setIsHelpMenuOpen(false)} />
                        )}

                        {isHelpMenuOpen && (
                            <div className="absolute right-0 z-[90] mt-2 w-56 overflow-hidden rounded-lg border border-slate-100 bg-white shadow-xl shadow-slate-200/70 animate-in fade-in zoom-in-95 duration-100 origin-top-right">
                                <div className="border-b border-slate-50 bg-slate-50/70 px-4 py-3">
                                    <p className="text-xs font-black uppercase tracking-widest text-slate-400">Ayuda y soporte</p>
                                </div>
                                <div className="p-1.5">
                                    <Link
                                        to="/support"
                                        onClick={openSupport}
                                        className="flex items-center justify-between gap-2 rounded-md px-3 py-2.5 text-sm font-bold text-slate-600 transition-colors hover:bg-indigo-50 hover:text-indigo-700"
                                    >
                                        <span className="flex items-center gap-2"><LifeBuoy size={16} /> Soporte</span>
                                    </Link>
                                    <button
                                        type="button"
                                        onClick={openTours}
                                        className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm font-bold text-slate-600 transition-colors hover:bg-indigo-50 hover:text-indigo-700"
                                    >
                                        <BookOpen size={16} /> Manual / Guía
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Notifications */}
                    <div className="relative">
                        <button
                            onClick={() => { setIsHelpMenuOpen(false); setIsNotificationMenuOpen(!isNotificationMenuOpen); }}
                            className={cn(
                                "relative flex h-10 w-10 items-center justify-center rounded-md transition-colors group focus:outline-none focus:ring-2 focus:ring-indigo-500",
                                unreadCount > 0
                                    ? "bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
                                    : "bg-slate-100 text-slate-600 hover:text-indigo-700 hover:bg-slate-200"
                            )}
                        >
                            <Bell size={22} className="transition-transform group-hover:rotate-6" />
                            {unreadCount > 0 && (
                                <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-rose-500 px-1 text-[10px] font-black text-white shadow-md">
                                    {unreadCount > 9 ? '9+' : unreadCount}
                                </span>
                            )}
                            {unreadCount === 0 && (
                                <span className="absolute top-1 right-1 w-2 h-2 bg-slate-300 rounded-full border-2 border-white" />
                            )}
                        </button>

                        {isNotificationMenuOpen && (
                            <div className="fixed inset-0 z-[85]" onClick={() => setIsNotificationMenuOpen(false)} />
                        )}

                        {isNotificationMenuOpen && (
                            <div className="absolute right-0 mt-2 w-80 max-h-[480px] bg-white rounded-lg shadow-xl shadow-slate-200/70 border border-slate-100 z-[90] animate-in fade-in zoom-in-95 duration-100 origin-top-right flex flex-col overflow-hidden">
                                <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Notificaciones</h3>
                                    {unreadCount > 0 && (
                                        <button
                                            onClick={() => markAllAsRead()}
                                            className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 uppercase tracking-tight"
                                        >
                                            Marcar todo como leído
                                        </button>
                                    )}
                                </div>

                                <div className="overflow-y-auto flex-1 overscroll-contain">
                                    {notifications.length === 0 ? (
                                        <div className="py-12 flex flex-col items-center justify-center text-slate-400">
                                            <Bell size={32} strokeWidth={1} className="mb-2 opacity-20" />
                                            <p className="text-xs font-medium">No hay notificaciones</p>
                                        </div>
                                    ) : (
                                        <div className="divide-y divide-slate-50">
                                            {notifications.map((n) => (
                                                <div
                                                    key={n.id}
                                                    onClick={() => {
                                                        markAsRead(n.id);
                                                        if (n.action_url) {
                                                            setIsNotificationMenuOpen(false);
                                                            navigate(n.action_url);
                                                        }
                                                    }}
                                                    className={cn(
                                                        "px-5 py-4 flex gap-4 hover:bg-slate-50 transition-colors cursor-pointer group relative",
                                                        !n.isRead && "bg-indigo-50/30"
                                                    )}
                                                >
                                                    {!n.isRead && (
                                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-600" />
                                                    )}
                                                    <div className={cn(
                                                        "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm",
                                                        n.level === 'critical' ? 'bg-rose-100 text-rose-600' :
                                                            n.level === 'warning' ? 'bg-amber-100 text-amber-600' :
                                                                'bg-indigo-100 text-indigo-600'
                                                    )}>
                                                        {n.source === 'support' ? <LifeBuoy size={20} /> :
                                                            n.source === 'org_chat' ? <Building2 size={20} /> :
                                                            n.level === 'critical' ? <AlertCircle size={20} /> :
                                                                n.level === 'warning' ? <AlertTriangle size={20} /> :
                                                                    <Bell size={20} />}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center justify-between gap-2 mb-1">
                                                            <p className={cn("text-xs truncate uppercase font-bold tracking-tight", !n.isRead ? "text-slate-900" : "text-slate-500")}>
                                                                {n.title}
                                                            </p>
                                                            <span className="text-[10px] text-slate-400 whitespace-nowrap">
                                                                {new Date(n.starts_at || Date.now()).toLocaleDateString([], { day: '2-digit', month: 'short' })}
                                                            </span>
                                                        </div>
                                                        <p className={cn("text-xs leading-relaxed line-clamp-2", !n.isRead ? "text-slate-600" : "text-slate-400")}>
                                                            {n.content}
                                                        </p>
                                                        {!n.isRead && Number(n.unread_count || 0) > 1 && (
                                                            <span className="mt-2 inline-flex rounded-md bg-indigo-100 px-2 py-0.5 text-[10px] font-black uppercase text-indigo-700">
                                                                {Number(n.unread_count)} nuevos
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {notifications.length > 0 && (
                                    <div className="p-3 border-t border-slate-50 bg-slate-50/30 text-center">
                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                            Fin de las notificaciones
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* User Menu */}
                    <div className="relative">
                        <button
                            onClick={() => { setIsHelpMenuOpen(false); setIsUserMenuOpen(!isUserMenuOpen); }}
                            id="user-menu"
                            className="flex items-center gap-2 focus:outline-none"
                        >
                            <div className="h-10 w-10 rounded-md bg-indigo-600 text-white flex items-center justify-center text-xs font-black shadow-sm ring-1 ring-indigo-100">
                                {user?.username?.substring(0, 2).toUpperCase() || 'US'}
                            </div>
                        </button>

                        {isUserMenuOpen && (
                            <div className="fixed inset-0 z-[85]" onClick={() => setIsUserMenuOpen(false)} />
                        )}

                        {isUserMenuOpen && (
                            <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl shadow-slate-200/70 border border-slate-100 z-[90] animate-in fade-in zoom-in-95 duration-100 origin-top-right overflow-hidden">
                                <div className="px-4 py-3 border-b border-slate-50 bg-slate-50/50">
                                    <p className="text-sm font-bold text-slate-900 truncate">{user?.username}</p>
                                    <p className="text-xs text-slate-500 truncate">{user?.email || user?.role}</p>
                                </div>
                                <div className="p-1">
                                    {canAccessOwnerPortal && (
                                        <Link to="/owner/dashboard" onClick={() => setIsUserMenuOpen(false)} className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-bold text-indigo-700 transition-colors hover:bg-indigo-50">
                                            <Building2 size={16} /> Portal empresarial
                                        </Link>
                                    )}
                                    <Link to="/config-center" onClick={() => setIsUserMenuOpen(false)} className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-600 transition-colors hover:bg-indigo-50 hover:text-indigo-600">
                                        <Settings size={16} /> Configuración
                                    </Link>
                                    <button onClick={() => { logout(); setIsUserMenuOpen(false); }} className="w-full flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-rose-600 transition-colors hover:bg-rose-50">
                                        <LogOut size={16} /> Cerrar Sesión
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <TourSelectionModal
                isOpen={isTourModalOpen}
                onClose={() => setIsTourModalOpen(false)}
            />

            {/* Rate Bottom Sheet */}
            {isRateSheetOpen && (
                <RateBottomSheet
                    currencies={currencies}
                    onClose={() => setIsRateSheetOpen(false)}
                />
            )}
        </>
    );
}
