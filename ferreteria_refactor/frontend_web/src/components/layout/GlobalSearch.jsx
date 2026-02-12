import React, { useState, useEffect, useRef } from 'react';
import { Search, Package, User, FileText, ShoppingCart, ArrowRight, X, Command, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../config/axios';
import { cn } from '../../utils/cn';
import { useHotkeys } from 'react-hotkeys-hook';

const GlobalSearch = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const inputRef = useRef(null);
    const navigate = useNavigate();

    // Hotkey to open: Ctrl+K or Cmd+K
    useHotkeys('ctrl+k, cmd+k', (e) => {
        e.preventDefault();
        setIsOpen(true);
    }, { enableOnFormTags: true });

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
            setIsOpen(false);
        }
    };

    const handleNavigate = (url) => {
        setIsOpen(false);
        setQuery('');
        navigate(url);
    };

    return (
        <div className="relative flex-1 max-w-2xl">
            {/* Search Trigger / Input */}
            <div
                className="relative group hidden md:block w-full max-w-md cursor-pointer"
                onClick={() => setIsOpen(true)}
            >
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search size={16} className="text-slate-400 group-focus-within:text-indigo-500" />
                </div>
                <div className="block w-full pl-10 pr-4 py-2 bg-slate-50/50 border border-slate-200 rounded-xl text-sm text-slate-400 select-none">
                    Buscar en todo el sistema...
                </div>
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <kbd className="inline-flex items-center border border-slate-200 rounded px-1.5 text-[10px] font-sans font-medium text-slate-400">⌘K</kbd>
                </div>
            </div>

            {/* Backdrop & Overlay */}
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4 sm:pt-[20vh]">
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsOpen(false)}></div>

                    <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden relative flex flex-col max-h-[70vh] animate-in fade-in zoom-in-95 duration-200">
                        {/* Header Box */}
                        <div className="p-4 border-b border-slate-100 flex items-center gap-3">
                            <Search className="text-slate-400" size={20} />
                            <input
                                ref={inputRef}
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Próximamente: búsqueda rápida..."
                                className="flex-1 bg-transparent border-none outline-none text-lg text-slate-800 placeholder-slate-400"
                            />
                            {query && (
                                <button onClick={() => setQuery('')} className="p-1 hover:bg-slate-100 rounded-full text-slate-400">
                                    <X size={18} />
                                </button>
                            )}
                        </div>

                        {/* Results Area - Placeholder info */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 text-center">
                            <div className="py-12 flex flex-col items-center justify-center text-slate-400">
                                <Search size={48} strokeWidth={1} className="mb-4 opacity-20" />
                                <h3 className="text-lg font-bold text-slate-700 mb-2">Buscador en Desarrollo</h3>
                                <p className="text-sm max-w-md mx-auto">
                                    Estamos trabajando para integrar búsquedas instantáneas de productos, clientes y ventas en esta barra.
                                </p>

                                <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                                    {[
                                        { title: "Dashboard", url: "/", icon: <Command size={16} /> },
                                        { title: "Nueva Venta", url: "/pos", icon: <ShoppingCart size={16} /> },
                                        { title: "Productos", url: "/inventory", icon: <Package size={16} /> },
                                        { title: "Clientes", url: "/customers", icon: <User size={16} /> },
                                    ].map((navItem, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => handleNavigate(navItem.url)}
                                            className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-indigo-50 text-left transition-colors border border-slate-100 group"
                                        >
                                            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-slate-500 group-hover:text-indigo-600 shadow-sm">
                                                {navItem.icon}
                                            </div>
                                            <span className="text-sm font-semibold text-slate-700">{navItem.title}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Footer Info */}
                        <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            <span>Esc para cerrar</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GlobalSearch;

