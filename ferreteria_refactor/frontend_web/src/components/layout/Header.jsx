import { Search, Bell, ShoppingCart, PackageSearch, DollarSign, RefreshCw, User, LogOut, Settings, AlertTriangle, AlertCircle, BarChart2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useConfig } from '../../context/ConfigContext';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { useCash } from '../../context/CashContext';
import { useState } from 'react';
import { cn } from '../../utils/cn';


export default function Header() {
    const { currencies } = useConfig();
    const { user, logout } = useAuth();
    const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
    const { isSessionOpen, session } = useCash();
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const [isNotificationMenuOpen, setIsNotificationMenuOpen] = useState(false);

    // Find the non-anchor default currency (usually Local Currency)
    const displayCurrency = currencies.find(c => c.is_default && !c.is_anchor) || currencies.find(c => !c.is_anchor);
    const rate = displayCurrency ? parseFloat(displayCurrency.rate) : 0;

    return (
        <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200/60 sticky top-0 z-20 px-6 flex items-center justify-between transition-all">

            <div className="flex-1"></div>

            {/* Right: Actions & User */}
            <div className="flex items-center gap-3 md:gap-6">

                {/* Exchange Rate Widget */}
                {displayCurrency && (
                    <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-full shadow-sm hover:border-indigo-200 transition-colors cursor-default">
                        <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                            <DollarSign size={12} strokeWidth={3} />
                        </div>
                        <div className="flex flex-col leading-none">
                            <span className="text-[9px] uppercase font-bold text-slate-400">Tasa {displayCurrency.symbol}</span>
                            <span className="text-xs font-black text-slate-700">{rate.toFixed(2)}</span>
                        </div>
                        <Link
                            to="/settings?tab=currencies"
                            className="ml-1 p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-indigo-600 transition-colors"
                            title="Gestionar Tasas"
                        >
                            <RefreshCw size={12} />
                        </Link>
                    </div>
                )}

                {/* Quick Actions Panel */}
                <div className="flex items-center gap-1 border-r border-slate-200 pr-4 mr-1">
                    {/* Cash Session Status Indicator */}
                    <div className={cn(
                        "hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all select-none mr-2 shadow-sm",
                        isSessionOpen
                            ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                            : "bg-rose-50 border-rose-200 text-rose-700"
                    )}
                        title={isSessionOpen ? `Turno Iniciado: ${session?.start_time ? new Date(session.start_time).toLocaleTimeString() : ''}${session?.register ? ` · ${session.register.code}` : ''}` : "La caja registradora está cerrada"}
                    >
                        <div className={cn(
                            "w-2 h-2 rounded-full",
                            isSessionOpen ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
                        )}></div>
                        {isSessionOpen
                            ? `${session?.register?.code ? `${session.register.code} · ` : ''}Abierta`
                            : "Caja Cerrada"
                        }
                    </div>

                    <Link to="/pos" className="hidden md:flex items-center gap-2 px-3 py-2 bg-slate-900 text-white hover:bg-slate-800 rounded-lg shadow-sm transition-all hover:-translate-y-0.5 active:translate-y-0">
                        <ShoppingCart size={16} />
                        <span className="text-sm font-bold">Vender</span>
                    </Link>
                    <Link
                        to="/reports"
                        className="hidden md:flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg shadow-sm transition-all hover:-translate-y-0.5 active:translate-y-0"
                    >
                        <BarChart2 size={16} />
                        <span className="text-sm font-bold">Reportes</span>
                    </Link>
                </div>

                {/* Notifications */}
                <div className="relative">
                    <button
                        onClick={() => setIsNotificationMenuOpen(!isNotificationMenuOpen)}
                        className={cn(
                            "relative p-2.5 rounded-full transition-all group focus:outline-none focus:ring-2 focus:ring-indigo-500",
                            unreadCount > 0
                                ? "bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
                                : "bg-slate-100 text-slate-600 hover:text-indigo-700 hover:bg-slate-200"
                        )}
                    >
                        <Bell size={24} className={cn(
                            "transition-transform",
                            unreadCount > 0 ? "animate-pulse" : "group-hover:rotate-12"
                        )} />
                        {unreadCount > 0 && (
                            <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 rounded-full border-2 border-white text-[10px] flex items-center justify-center font-black text-white shadow-md animate-bounce">
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                        )}
                        {/* Static indicator dot for subtle alert */}
                        {unreadCount === 0 && (
                            <span className="absolute top-1 right-1 w-2 h-2 bg-slate-300 rounded-full border-2 border-white"></span>
                        )}
                    </button>

                    {/* Notification Dropdown Backdrop */}
                    {isNotificationMenuOpen && (
                        <div className="fixed inset-0 z-40" onClick={() => setIsNotificationMenuOpen(false)}></div>
                    )}

                    {/* Notification Dropdown */}
                    {isNotificationMenuOpen && (
                        <div className="absolute right-0 mt-2 w-80 max-h-[480px] bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 animate-in fade-in zoom-in-95 duration-100 origin-top-right flex flex-col overflow-hidden">
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
                                                onClick={() => { markAsRead(n.id); }}
                                                className={cn(
                                                    "px-5 py-4 flex gap-4 hover:bg-slate-50 transition-colors cursor-pointer group relative",
                                                    !n.isRead && "bg-indigo-50/30"
                                                )}
                                            >
                                                {!n.isRead && (
                                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-600"></div>
                                                )}
                                                <div className={cn(
                                                    "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm",
                                                    n.level === 'critical' ? 'bg-rose-100 text-rose-600' :
                                                        n.level === 'warning' ? 'bg-amber-100 text-amber-600' :
                                                            'bg-indigo-100 text-indigo-600'
                                                )}>
                                                    {n.level === 'critical' ? <AlertCircle size={20} /> :
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
                        onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                        id="user-menu"
                        className="flex items-center gap-2 focus:outline-none"
                    >
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-violet-500 text-white flex items-center justify-center text-xs font-bold shadow-md ring-2 ring-white">
                            {user?.username?.substring(0, 2).toUpperCase() || 'US'}
                        </div>
                    </button>

                    {/* Dropdown Backdrop */}
                    {isUserMenuOpen && (
                        <div className="fixed inset-0 z-40" onClick={() => setIsUserMenuOpen(false)}></div>
                    )}

                    {/* Menu Dropdown */}
                    {isUserMenuOpen && (
                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 z-50 animate-in fade-in zoom-in-95 duration-100 origin-top-right overflow-hidden">
                            <div className="px-4 py-3 border-b border-slate-50 bg-slate-50/50">
                                <p className="text-sm font-bold text-slate-900 truncate">{user?.username}</p>
                                <p className="text-xs text-slate-500 truncate">{user?.email || user?.role}</p>
                            </div>
                            <div className="p-1">
                                <Link to="/settings" onClick={() => setIsUserMenuOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                                    <Settings size={16} /> Configuración
                                </Link>
                                <button onClick={() => { logout(); setIsUserMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 rounded-lg transition-colors text-left">
                                    <LogOut size={16} /> Cerrar Sesión
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

        </header>
    );
}
