import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Search, Package, User, ShoppingCart, X, Wrench, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../config/axios';
import { cn } from '../../utils/cn';
import { useHotkeys } from 'react-hotkeys-hook';

/* ── tipos de resultado ─────────────────────────────────────────────────── */
const TYPE = {
    product:  { icon: Package,     color: 'text-blue-600 bg-blue-50' },
    customer: { icon: User,         color: 'text-emerald-600 bg-emerald-50' },
    order:    { icon: Wrench,       color: 'text-violet-600 bg-violet-50' },
    sale:     { icon: ShoppingCart, color: 'text-amber-600 bg-amber-50' },
};

const ResultRow = ({ type, title, subtitle, meta, onClick }) => {
    const t = TYPE[type] || TYPE.product;
    const Icon = t.icon;
    return (
        <button onClick={onClick}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left group">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${t.color}`}>
                <Icon size={16} />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{title}</p>
                {subtitle && <p className="text-xs text-slate-400 truncate">{subtitle}</p>}
            </div>
            {meta && <span className="text-xs text-slate-400 shrink-0">{meta}</span>}
            <ArrowRight size={14} className="text-slate-300 group-hover:text-slate-500 shrink-0 transition-colors" />
        </button>
    );
};

const QUICK = [
    { label: 'Abrir POS',      path: '/pos',                       icon: ShoppingCart, color: 'text-indigo-600 bg-indigo-50' },
    { label: 'Nuevo producto', path: '/inventory-center',           icon: Package,      color: 'text-blue-600 bg-blue-50' },
    { label: 'Clientes',       path: '/sales-center?tab=clientes', icon: User,         color: 'text-emerald-600 bg-emerald-50' },
    { label: 'Taller',         path: '/services',                  icon: Wrench,       color: 'text-violet-600 bg-violet-50' },
];

/* ── Modal renderizado via Portal (escapa del stacking context del layout) ── */
const SearchModal = ({ onClose, navigate }) => {
    const [query, setQuery]         = useState('');
    const [results, setResults]     = useState([]);
    const [loading, setLoading]     = useState(false);
    const [selected, setSelected]   = useState(0);
    const inputRef = useRef(null);
    const debounceRef = useRef(null);

    useEffect(() => { setTimeout(() => inputRef.current?.focus(), 50); }, []);

    const search = useCallback(async (q) => {
        if (!q || q.length < 2) { setResults([]); return; }
        setLoading(true);
        try {
            const [prods, custs, orders] = await Promise.allSettled([
                apiClient.get(`/products/?search=${encodeURIComponent(q)}&limit=4`),
                apiClient.get(`/customers/?q=${encodeURIComponent(q)}&limit=4`),
                apiClient.get(`/services/orders?search=${encodeURIComponent(q)}&limit=3`).catch(() => ({ data: [] })),
            ]);

            const out = [];
            const prodData = prods.status === 'fulfilled' ? (prods.value.data?.items || prods.value.data || []) : [];
            const custData = custs.status === 'fulfilled' ? (custs.value.data?.items || custs.value.data || []) : [];
            const ordData  = orders.status === 'fulfilled' ? (orders.value.data?.items || orders.value.data || []) : [];

            prodData.slice(0,4).forEach(p => out.push({
                id: `p-${p.id}`, type: 'product',
                title: p.name, subtitle: p.sku ? `SKU: ${p.sku}` : null,
                meta: p.price ? `$${Number(p.price).toFixed(2)}` : null,
                action: () => navigate('/inventory-center?tab=productos'),
            }));
            custData.slice(0,3).forEach(c => out.push({
                id: `c-${c.id}`, type: 'customer',
                title: c.name || c.full_name,
                subtitle: c.id_number || c.email || null,
                action: () => navigate('/sales-center?tab=clientes'),
            }));
            ordData.slice(0,3).forEach(o => out.push({
                id: `o-${o.id}`, type: 'order',
                title: o.ticket_number || `Orden #${o.id}`,
                subtitle: o.device_description || null,
                meta: o.status,
                action: () => navigate('/services'),
            }));
            setResults(out);
        } finally { setLoading(false); }
    }, [navigate]);

    useEffect(() => {
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => search(query), 280);
        return () => clearTimeout(debounceRef.current);
    }, [query, search]);

    const handleKeyDown = (e) => {
        if (e.key === 'Escape') { onClose(); return; }
        const count = results.length || QUICK.length;
        if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s+1, count-1)); }
        if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected(s => Math.max(s-1, 0)); }
        if (e.key === 'Enter') {
            if (results[selected]) { results[selected].action(); onClose(); }
            else if (QUICK[selected]) { navigate(QUICK[selected].path); onClose(); }
        }
    };

    /* Portal renderiza directamente en document.body — sin stacking context */
    return createPortal(
        <>
            {/* Backdrop */}
            <div
                style={{ position:'fixed', inset:0, zIndex:9998, background:'rgba(15,23,42,0.45)', backdropFilter:'blur(4px)' }}
                onClick={onClose}
            />

            {/* Panel — pegado al tope de la ventana, encima de absolutamente todo */}
            <div style={{ position:'fixed', top:0, left:0, right:0, zIndex:9999, display:'flex', justifyContent:'center', padding:'64px 16px 0' }}>
                <div style={{ width:'100%', maxWidth:'560px', background:'white', borderRadius:'0 0 16px 16px',
                              boxShadow:'0 20px 60px -10px rgba(0,0,0,0.3)', maxHeight:'75vh',
                              display:'flex', flexDirection:'column', overflow:'hidden',
                              animation:'slideDown 0.15s ease-out' }}>

                    {/* Input */}
                    <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100">
                        <Search size={18} className="text-slate-400 shrink-0" />
                        <input ref={inputRef} type="text" value={query}
                            onChange={e => { setQuery(e.target.value); setSelected(0); }}
                            onKeyDown={handleKeyDown}
                            placeholder="Buscar productos, clientes, órdenes..."
                            className="flex-1 bg-transparent outline-none text-base text-slate-800 placeholder-slate-400" />
                        {query
                            ? <button onClick={() => { setQuery(''); setResults([]); inputRef.current?.focus(); }}
                                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400"><X size={16} /></button>
                            : <kbd className="text-[10px] border border-slate-200 rounded px-1.5 py-0.5 text-slate-400 font-mono">Esc</kbd>
                        }
                    </div>

                    {/* Resultados */}
                    <div className="flex-1 overflow-y-auto">
                        {loading && (
                            <div className="px-4 py-3 space-y-2">
                                {[1,2,3].map(i => <div key={i} className="h-10 bg-slate-100 rounded-xl animate-pulse" />)}
                            </div>
                        )}
                        {!loading && query.length >= 2 && results.length === 0 && (
                            <div className="py-12 text-center text-slate-400">
                                <Search size={32} className="mx-auto mb-2 opacity-20" />
                                <p className="text-sm font-medium">Sin resultados para "{query}"</p>
                            </div>
                        )}
                        {!loading && results.length > 0 && (
                            <div className="py-1 divide-y divide-slate-50">
                                {results.map((r, i) => (
                                    <div key={r.id} className={selected === i ? 'bg-slate-50' : ''}>
                                        <ResultRow {...r} onClick={() => { r.action(); onClose(); }} />
                                    </div>
                                ))}
                            </div>
                        )}
                        {!query && (
                            <div className="p-4">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">Acceso rápido</p>
                                <div className="grid grid-cols-2 gap-2">
                                    {QUICK.map((q, i) => {
                                        const Icon = q.icon;
                                        return (
                                            <button key={q.path} onClick={() => { navigate(q.path); onClose(); }}
                                                className={cn('flex items-center gap-2.5 p-3 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-all text-left', selected === i ? 'bg-slate-50 border-slate-200' : '')}>
                                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${q.color}`}><Icon size={14} /></div>
                                                <span className="text-sm font-semibold text-slate-700">{q.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-medium">
                        <span className="flex items-center gap-3">
                            <span>↑↓ navegar</span>
                            <span>↵ abrir</span>
                            <span>Esc cerrar</span>
                        </span>
                        {results.length > 0 && <span>{results.length} resultados</span>}
                    </div>
                </div>
            </div>

            {/* Animación CSS */}
            <style>{`@keyframes slideDown { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }`}</style>
        </>,
        document.body
    );
};

/* ── Trigger visible en el header ───────────────────────────────────────── */
const GlobalSearch = () => {
    const [isOpen, setIsOpen] = useState(false);
    const navigate = useNavigate();

    useHotkeys('ctrl+k, meta+k', (e) => { e.preventDefault(); setIsOpen(true); }, { enableOnFormTags: true });

    return (
        <>
            <button onClick={() => setIsOpen(true)}
                className="hidden md:flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl text-sm text-slate-400 transition-all max-w-xs w-full">
                <Search size={15} className="shrink-0" />
                <span className="flex-1 text-left">Buscar...</span>
                <kbd className="text-[10px] border border-slate-300 rounded px-1 bg-white font-mono">⌘K</kbd>
            </button>

            {isOpen && (
                <SearchModal
                    onClose={() => setIsOpen(false)}
                    navigate={navigate}
                />
            )}
        </>
    );
};

export default GlobalSearch;
