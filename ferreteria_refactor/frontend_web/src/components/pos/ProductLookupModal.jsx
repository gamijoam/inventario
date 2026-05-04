import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, Package, Tag, Layers, AlertTriangle, Barcode, DollarSign, TrendingDown, Info, Wifi, CheckCircle2, XCircle } from 'lucide-react';
import apiClient from '../../config/axios';
import { useConfig } from '../../context/ConfigContext';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmtUSD = (n) => `$${parseFloat(n || 0).toFixed(2)}`;
const fmtBs  = (n, rate) => rate ? `Bs ${(parseFloat(n || 0) * rate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : null;

const StockBadge = ({ stock }) => {
    if (stock <= 0)  return <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-600">AGOTADO</span>;
    if (stock <= 3)  return <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-600">BAJO · {stock}</span>;
    return <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-700">{stock} en stock</span>;
};

// ─── ProductLookupModal ───────────────────────────────────────────────────────
const ProductLookupModal = ({ isOpen, onClose }) => {
    const [query, setQuery]       = useState('');
    const [results, setResults]   = useState([]);
    const [selected, setSelected] = useState(null);
    const [loading, setLoading]   = useState(false);
    const [notFound, setNotFound] = useState(false);

    const inputRef  = useRef(null);
    const debounce  = useRef(null);
    const { currencies } = useConfig();

    // Tasa activa
    const bsRate = (() => {
        if (!Array.isArray(currencies)) return null;
        const ves = currencies.find(c => c.is_default && (c.currency_code === 'VES' || c.currency_symbol === 'Bs'));
        return ves ? parseFloat(ves.rate) : null;
    })();

    // Reset al abrir
    useEffect(() => {
        if (isOpen) {
            setQuery(''); setResults([]); setSelected(null); setNotFound(false);
            setTimeout(() => inputRef.current?.focus(), 80);
        }
    }, [isOpen]);

    // Detectar si es un IMEI (15 dígitos numéricos)
    const isImei = (q) => /^\d{14,16}$/.test(q.trim());

    // Búsqueda con debounce
    const search = useCallback(async (q) => {
        if (!q || q.length < 2) { setResults([]); setNotFound(false); return; }
        setLoading(true);
        setNotFound(false);
        try {
            if (isImei(q)) {
                // Búsqueda por IMEI
                try {
                    const res = await apiClient.get('/inventory/lookup-imei', { params: { imei: q.trim() } });
                    const data = res.data;
                    if (data?.product) {
                        // Enriquecer el producto con info del IMEI
                        const product = { ...data.product, _imei_info: { imei: data.imei, status: data.status, warehouse: data.warehouse, sold_at: data.sold_at } };
                        setSelected(product);
                        setResults([product]);
                        setNotFound(false);
                    }
                } catch (err) {
                    if (err.response?.status === 404) {
                        setNotFound(true);
                        setResults([]);
                        setSelected(null);
                    }
                }
            } else {
                // Búsqueda normal por nombre/SKU
                const res = await apiClient.get('/products/', { params: { search: q, limit: 10 } });
                const items = Array.isArray(res.data) ? res.data : res.data?.items || [];
                setResults(items);
                setNotFound(items.length === 0);
                if (items.length === 1) setSelected(items[0]);
                else setSelected(null);
            }
        } catch {
            setResults([]);
        } finally {
            setLoading(false);
        }
    }, []);

    const handleInput = (e) => {
        const v = e.target.value;
        setQuery(v);
        clearTimeout(debounce.current);
        debounce.current = setTimeout(() => search(v), 280);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Escape') onClose();
        if (e.key === 'Enter' && query) search(query);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center pt-[8vh] px-4"
            onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">

                {/* Search input */}
                <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-100">
                    {loading
                        ? <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin shrink-0" />
                        : <Search size={18} className="text-slate-400 shrink-0" />
                    }
                    <input
                        ref={inputRef}
                        value={query}
                        onChange={handleInput}
                        onKeyDown={handleKeyDown}
                        placeholder="Escanear código o escribir nombre del producto..."
                        className="flex-1 text-sm font-medium outline-none text-slate-800 placeholder:text-slate-400 bg-transparent"
                    />
                    <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-400 transition-colors shrink-0">
                        <X size={15} />
                    </button>
                </div>

                {/* Resultados */}
                {!selected && results.length > 1 && (
                    <div className="max-h-60 overflow-y-auto divide-y divide-slate-50">
                        {results.map(p => (
                            <button key={p.id} onClick={() => setSelected(p)}
                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-indigo-50 text-left transition-colors group">
                                <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-indigo-100 transition-colors">
                                    <Package size={16} className="text-slate-400 group-hover:text-indigo-500 transition-colors" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-slate-800 truncate">{p.name}</p>
                                    <p className="text-[11px] text-slate-400 font-mono">{p.sku || 'Sin SKU'}</p>
                                </div>
                                <div className="text-right shrink-0">
                                    <p className="text-sm font-black text-indigo-600">{fmtUSD(p.price)}</p>
                                    <StockBadge stock={p.stock} />
                                </div>
                            </button>
                        ))}
                    </div>
                )}

                {/* Sin resultados */}
                {notFound && !selected && (
                    <div className="flex flex-col items-center py-10 text-slate-300 gap-2">
                        <AlertTriangle size={32} strokeWidth={1.5} className="text-amber-300" />
                        <p className="text-sm font-bold text-slate-400">Sin resultados para "{query}"</p>
                        <p className="text-xs text-slate-300">Verifica el código o el nombre del producto</p>
                    </div>
                )}

                {/* Detalle del producto seleccionado */}
                {selected && (
                    <div className="p-5 space-y-4">
                        {/* Header producto */}
                        <div className="flex items-start gap-3">
                            <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center shrink-0">
                                {selected.image_url
                                    ? <img src={selected.image_url} alt="" className="w-full h-full object-cover rounded-2xl" />
                                    : <Package size={24} className="text-indigo-400" />
                                }
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-black text-slate-800 text-base leading-tight">{selected.name}</h3>
                                <p className="text-xs text-slate-400 font-mono mt-0.5">{selected.sku || 'Sin SKU'}</p>
                                {selected.category_name && (
                                    <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                                        <Tag size={9} /> {selected.category_name}
                                    </span>
                                )}
                            </div>
                            {results.length > 1 && (
                                <button onClick={() => setSelected(null)}
                                    className="text-[10px] font-bold text-slate-400 hover:text-indigo-600 border border-slate-200 hover:border-indigo-300 px-2 py-1 rounded-lg transition-all shrink-0">
                                    Cambiar
                                </button>
                            )}
                        </div>

                        {/* Info grid */}
                        <div className="grid grid-cols-3 gap-3">
                            {/* Precio */}
                            <div className="bg-indigo-50 rounded-2xl p-3 text-center">
                                <DollarSign size={14} className="text-indigo-400 mx-auto mb-1" />
                                <p className="text-lg font-black text-indigo-700">{fmtUSD(selected.price)}</p>
                                {bsRate && <p className="text-[10px] text-indigo-400 mt-0.5">{fmtBs(selected.price, bsRate)}</p>}
                                <p className="text-[9px] font-bold text-indigo-400 uppercase tracking-wider mt-0.5">Precio</p>
                            </div>

                            {/* Stock */}
                            <div className={`rounded-2xl p-3 text-center ${selected.stock <= 0 ? 'bg-rose-50' : selected.stock <= 3 ? 'bg-amber-50' : 'bg-emerald-50'}`}>
                                <Layers size={14} className={`mx-auto mb-1 ${selected.stock <= 0 ? 'text-rose-400' : selected.stock <= 3 ? 'text-amber-400' : 'text-emerald-400'}`} />
                                <p className={`text-lg font-black ${selected.stock <= 0 ? 'text-rose-600' : selected.stock <= 3 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                    {selected.stock}
                                </p>
                                <p className={`text-[9px] font-bold uppercase tracking-wider mt-0.5 ${selected.stock <= 0 ? 'text-rose-400' : selected.stock <= 3 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                    {selected.stock <= 0 ? 'Agotado' : 'En stock'}
                                </p>
                            </div>

                            {/* Costo */}
                            <div className="bg-slate-50 rounded-2xl p-3 text-center">
                                <TrendingDown size={14} className="text-slate-400 mx-auto mb-1" />
                                <p className="text-lg font-black text-slate-600">{fmtUSD(selected.cost || 0)}</p>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Costo</p>
                            </div>
                        </div>

                        {/* IMEI / Serial */}
                        {selected.has_imei && (
                            <div className="flex items-center gap-2 bg-purple-50 border border-purple-100 rounded-xl px-3 py-2">
                                <Barcode size={14} className="text-purple-500 shrink-0" />
                                <p className="text-xs font-bold text-purple-700">Producto serializado con IMEI</p>
                            </div>
                        )}

                        {/* Descripción */}
                        {selected.description && (
                            <div className="flex items-start gap-2 bg-slate-50 rounded-xl px-3 py-2.5">
                                <Info size={13} className="text-slate-400 shrink-0 mt-0.5" />
                                <p className="text-xs text-slate-600 leading-relaxed">{selected.description}</p>
                            </div>
                        )}

                        {/* Footer */}
                        <button onClick={onClose}
                            className="w-full py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-sm transition-all">
                            Cerrar
                        </button>
                    </div>
                )}

                {/* Estado inicial */}
                {!selected && results.length === 0 && !notFound && (
                    <div className="flex flex-col items-center py-10 text-slate-300 gap-2">
                        <Search size={36} strokeWidth={1} />
                        <p className="text-sm font-bold text-slate-400">Escanea o escribe para buscar</p>
                        <p className="text-xs text-slate-300">Código de barras, SKU o nombre del producto</p>
                        <p className="text-[10px] text-slate-200 mt-2 bg-slate-50 px-3 py-1 rounded-full font-mono">Ctrl+K para abrir · Esc para cerrar</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProductLookupModal;
