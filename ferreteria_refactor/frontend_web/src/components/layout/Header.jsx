import { Search, Bell, ShoppingCart, PackageSearch, DollarSign, RefreshCw, User, LogOut, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useConfig } from '../../context/ConfigContext';
import { useAuth } from '../../context/AuthContext';
import { useState } from 'react';
import ExchangeRateUpdateModal from '../common/ExchangeRateUpdateModal';

export default function Header() {
    const { currencies } = useConfig();
    const { user, logout } = useAuth();
    const [showRateModal, setShowRateModal] = useState(false);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

    // Find the non-anchor default currency (usually Local Currency)
    const displayCurrency = currencies.find(c => c.is_default && !c.is_anchor) || currencies.find(c => !c.is_anchor);
    const rate = displayCurrency ? parseFloat(displayCurrency.rate) : 0;

    return (
        <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200/60 sticky top-0 z-20 px-6 flex items-center justify-between transition-all">

            {/* Left: Global Search */}
            <div className="flex-1 max-w-2xl">
                <div className="relative group hidden md:block w-full max-w-md">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search size={16} className="text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                    </div>
                    <input
                        type="text"
                        placeholder="Buscar en todo el sistema... (Ctrl+K)"
                        className="block w-full pl-10 pr-4 py-2 bg-slate-50/50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                    <div className="absolute inset-y-0 right-0 max-md:hidden flex items-center pr-3 pointer-events-none">
                        <kbd className="inline-flex items-center border border-slate-200 rounded px-1.5 text-[10px] font-sans font-medium text-slate-400">⌘K</kbd>
                    </div>
                </div>
            </div>

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
                        <button
                            onClick={() => setShowRateModal(true)}
                            className="ml-1 p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-indigo-600 transition-colors"
                            title="Actualizar Tasa"
                        >
                            <RefreshCw size={12} />
                        </button>
                    </div>
                )}

                {/* Quick Actions Panel */}
                <div className="flex items-center gap-1 border-r border-slate-200 pr-4 mr-1">
                    <Link to="/pos" className="hidden md:flex items-center gap-2 px-3 py-2 bg-slate-900 text-white hover:bg-slate-800 rounded-lg shadow-sm transition-all hover:-translate-y-0.5 active:translate-y-0">
                        <ShoppingCart size={16} />
                        <span className="text-sm font-bold">Vender</span>
                    </Link>
                </div>

                {/* Notifications */}
                <button className="relative p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors">
                    <Bell size={20} />
                    <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-white"></span>
                </button>

                {/* User Menu */}
                <div className="relative">
                    <button
                        onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
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

            <ExchangeRateUpdateModal
                isOpen={showRateModal}
                onClose={() => setShowRateModal(false)}
            />
        </header>
    );
}
