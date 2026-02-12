import React, { useState, useEffect, useRef } from 'react';
import { Search, Package, User, FileText, ShoppingCart, ArrowRight, X, Command, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../config/axios';
import { cn } from '../../utils/cn';
import { useHotkeys } from 'react-hotkeys-hook';

const GlobalSearch = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [results, setResults] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
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

    // Handle searching with debounce
    useEffect(() => {
        if (!query || query.length < 2) {
            setResults(null);
            return;
        }

        const timer = setTimeout(async () => {
            setIsLoading(true);
            try {
                const { data } = await apiClient.get(`/system/search?q=${query}`);
                setResults(data);
                setSelectedIndex(0);
            } catch (error) {
                console.error("Search failed", error);
            } finally {
                setIsLoading(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [query]);

    // Flatten results for keyboard navigation
    const flatResults = React.useMemo(() => {
        if (!results) return [];
        return [
            ...(results.navigation || []),
            ...(results.products || []),
            ...(results.customers || []),
            ...(results.sales || []),
            ...(results.quotes || []),
            ...(results.service_orders || [])
        ];
    }, [results]);

    const handleKeyDown = (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev + 1) % flatResults.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev - 1 + flatResults.length) % flatResults.length);
        } else if (e.key === 'Enter') {
            if (flatResults[selectedIndex]) {
                handleNavigate(flatResults[selectedIndex]);
            }
        } else if (e.key === 'Escape') {
            setIsOpen(false);
        }
    };

    const handleNavigate = (item) => {
        setIsOpen(false);
        setQuery('');
        navigate(item.url);
        // If it's a specific entity search, we might want to pass state, but for now simple navigation
    };

    const ResultIcon = ({ type }) => {
        switch (type) {
            case 'product': return <Package size={16} className="text-blue-500" />;
            case 'customer': return <User size={16} className="text-emerald-500" />;
            case 'sale': return <ShoppingCart size={16} className="text-indigo-500" />;
            case 'quote': return <FileText size={16} className="text-amber-500" />;
            case 'service_order': return <ArrowRight size={16} className="text-rose-500" />;
            case 'nav': return <Command size={16} className="text-slate-400" />;
            default: return <Search size={16} className="text-slate-400" />;
        }
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
                                placeholder="Escribe para buscar productos, clientes, facturas..."
                                className="flex-1 bg-transparent border-none outline-none text-lg text-slate-800 placeholder-slate-400"
                            />
                            {isLoading ? (
                                <div className="animate-spin rounded-full h-5 w-5 border-2 border-indigo-500 border-t-transparent"></div>
                            ) : query && (
                                <button onClick={() => setQuery('')} className="p-1 hover:bg-slate-100 rounded-full text-slate-400">
                                    <X size={18} />
                                </button>
                            )}
                        </div>

                        {/* Results Area */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                            {!query || query.length < 2 ? (
                                <div className="p-4">
                                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 px-2">Sugerencias de Navegación</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                                        {[
                                            { title: "Dashboard Principal", url: "/", icon: <Command size={16} /> },
                                            { title: "Realizar una Venta", url: "/pos", icon: <ShoppingCart size={16} /> },
                                            { title: "Inventario de Stock", url: "/inventory", icon: <Package size={16} /> },
                                            { title: "Base de Clientes", url: "/customers", icon: <User size={16} /> },
                                        ].map((navItem, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => handleNavigate(navItem)}
                                                className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 text-left transition-colors border border-transparent hover:border-slate-100 group"
                                            >
                                                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                                                    {navItem.icon}
                                                </div>
                                                <span className="text-sm font-semibold text-slate-700">{navItem.title}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : results && flatResults.length > 0 ? (
                                <div className="space-y-1">
                                    {Object.entries(results).map(([type, items]) => {
                                        if (items.length === 0) return null;
                                        const typeLabels = {
                                            products: "Productos",
                                            customers: "Clientes",
                                            sales: "Ventas",
                                            quotes: "Cotizaciones",
                                            service_orders: "Órdenes de Servicio",
                                            navigation: "Navegación"
                                        };

                                        return (
                                            <div key={type}>
                                                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest my-2 px-3">{typeLabels[type] || type}</h3>
                                                {items.map((item) => {
                                                    const isSelected = flatResults[selectedIndex]?.id === item.id && flatResults[selectedIndex]?.title === item.title;
                                                    return (
                                                        <div
                                                            key={`${item.type}-${item.id}`}
                                                            onClick={() => handleNavigate(item)}
                                                            className={cn(
                                                                "flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border border-transparent",
                                                                isSelected ? "bg-indigo-50 border-indigo-100 ring-1 ring-indigo-200" : "hover:bg-slate-50"
                                                            )}
                                                        >
                                                            <div className={cn(
                                                                "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm transition-colors",
                                                                isSelected ? "bg-white text-indigo-600" : "bg-white text-slate-400 border border-slate-100"
                                                            )}>
                                                                <ResultIcon type={item.type} />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className={cn("text-sm font-bold truncate", isSelected ? "text-indigo-900" : "text-slate-800")}>{item.title}</p>
                                                                {item.subtitle && <p className="text-xs text-slate-500 truncate">{item.subtitle}</p>}
                                                            </div>
                                                            {isSelected && (
                                                                <div className="text-indigo-500 px-2">
                                                                    <ExternalLink size={14} />
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : !isLoading && (
                                <div className="py-12 flex flex-col items-center justify-center text-slate-400">
                                    <Search size={48} strokeWidth={1} className="mb-4 opacity-20" />
                                    <p className="text-sm font-medium">No se encontraron resultados para "{query}"</p>
                                </div>
                            )}
                        </div>

                        {/* Footer Info */}
                        <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            <div className="flex gap-4">
                                <span className="flex items-center gap-1"><span className="p-1 bg-white border border-slate-200 rounded shadow-xs text-[9px]">⏎</span> Ir a</span>
                                <span className="flex items-center gap-1"><span className="p-1 bg-white border border-slate-200 rounded shadow-xs text-[9px]">↑↓</span> Navegar</span>
                            </div>
                            <span>Esc para cerrar</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GlobalSearch;
