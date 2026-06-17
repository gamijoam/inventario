import { useState, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';

/**
 * ExpressSearch — Panel izquierdo para Modo Express POS.
 * - Búsqueda por nombre, SKU o código de barras.
 * - Cuando hay exactamente 1 resultado se agrega automáticamente al carrito.
 * - Compatible con lectores de barras: la secuencia rápida de teclas + Enter
 *   hace un lookup directo y agrega sin mostrar dropdown.
 */
const ExpressSearch = ({ onAddToCart, lookupProduct }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [highlightIndex, setHighlightIndex] = useState(0);
    const [lastAdded, setLastAdded] = useState(null); // feedback visual
    const inputRef = useRef(null);
    const debounceRef = useRef(null);
    const lastAddedTimerRef = useRef(null);
    const searchSeqRef = useRef(0);
    const mountedRef = useRef(true);

    useEffect(() => {
        inputRef.current?.focus();
        return () => {
            mountedRef.current = false;
            clearTimeout(debounceRef.current);
            clearTimeout(lastAddedTimerRef.current);
        };
    }, []);

    // Retorna array de productos encontrados (para poder usarlo en async)
    const search = async (value) => {
        const term = value.trim();
        const requestId = ++searchSeqRef.current;

        if (!term) {
            setResults([]);
            setDropdownOpen(false);
            setIsSearching(false);
            return [];
        }

        setIsSearching(true);
        try {
            const found = await lookupProduct(term);
            const list = found ? [found] : [];
            if (!mountedRef.current || requestId !== searchSeqRef.current) return [];

            setResults(list);
            setDropdownOpen(list.length > 0 || term.length > 0);
            setHighlightIndex(0);
            return list;
        } catch {
            if (!mountedRef.current || requestId !== searchSeqRef.current) return [];
            setResults([]);
            setDropdownOpen(false);
            return [];
        } finally {
            if (mountedRef.current && requestId === searchSeqRef.current) {
                setIsSearching(false);
            }
        }
    };

    const selectProduct = (product) => {
        onAddToCart(product);
        setLastAdded(product.name);
        clearTimeout(lastAddedTimerRef.current);
        lastAddedTimerRef.current = setTimeout(() => {
            if (mountedRef.current) setLastAdded(null);
        }, 1500);
        searchSeqRef.current += 1;
        setQuery('');
        setResults([]);
        setDropdownOpen(false);
        setIsSearching(false);
        inputRef.current?.focus();
    };

    const handleChange = (e) => {
        const value = e.target.value;
        setQuery(value);
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            search(value).then(list => {
                // Si hay exactamente 1 resultado y el query parece un código
                // (sin espacios, como lo envía un escáner), agregar automáticamente
                if (list.length === 1 && !value.includes(' ')) {
                    // No auto-agregar aquí: esperamos Enter para no interrumpir escritura manual
                }
            });
        }, 180);
    };

    const handleKeyDown = async (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightIndex(i => Math.min(i + 1, results.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightIndex(i => Math.max(i - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            clearTimeout(debounceRef.current); // cancelar debounce pendiente
            if (results.length === 1) {
                selectProduct(results[0]);
            } else if (results.length > 1) {
                selectProduct(results[highlightIndex >= 0 ? highlightIndex : 0]);
            } else if (query.trim().length > 0) {
                // Búsqueda directa (caso escáner de barras: Enter llega antes del debounce)
                const list = await search(query.trim());
                if (list.length === 1) {
                    selectProduct(list[0]);
                }
                // Si hay > 1 resultado el dropdown quedará abierto para que elija
            }
        } else if (e.key === 'Escape') {
            searchSeqRef.current += 1;
            clearTimeout(debounceRef.current);
            setDropdownOpen(false);
            setQuery('');
            setResults([]);
            setIsSearching(false);
        }
    };

    const formatStock = (stock) => {
        const num = Number(stock);
        return num % 1 === 0 ? num.toFixed(0) : num.toFixed(2);
    };

    return (
        <div className="relative w-full">
            {/* Input principal */}
            <div className="relative flex items-center">
                <Search size={22} className={`absolute left-4 pointer-events-none transition-colors ${isSearching ? 'text-indigo-400 animate-pulse' : 'text-slate-400'}`} />
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    onFocus={() => results.length > 0 && setDropdownOpen(true)}
                    onBlur={() => setTimeout(() => setDropdownOpen(false), 150)}
                    placeholder="Escanea código de barras o escribe nombre / SKU…"
                    className="w-full h-16 pl-12 pr-10 text-xl rounded-2xl border-2 border-slate-200 focus:border-indigo-500 focus:ring-0 outline-none bg-white shadow-sm transition-colors font-medium"
                    autoComplete="off"
                />
                {query && (
                    <button
                        onClick={() => {
                            searchSeqRef.current += 1;
                            clearTimeout(debounceRef.current);
                            setQuery('');
                            setResults([]);
                            setDropdownOpen(false);
                            setIsSearching(false);
                            inputRef.current?.focus();
                        }}
                        className="absolute right-4 text-slate-400 hover:text-slate-600"
                    >
                        <X size={18} />
                    </button>
                )}
            </div>

            {/* Feedback visual: último producto agregado */}
            {lastAdded && (
                <div className="absolute left-0 right-0 top-full mt-2 z-50 px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm font-semibold flex items-center gap-2">
                    <span className="text-emerald-500">✓</span> Agregado: {lastAdded}
                </div>
            )}

            {/* Dropdown de resultados (solo cuando hay >1 o no se pudo auto-agregar) */}
            {!lastAdded && dropdownOpen && (
                <div className="absolute left-0 right-0 top-full mt-2 z-50 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
                    {isSearching && (
                        <div className="px-4 py-3 text-sm text-slate-500">Buscando…</div>
                    )}
                    {!isSearching && results.length === 0 && query.trim().length > 0 && (
                        <div className="px-4 py-3 text-sm text-slate-500">Sin resultados para "<strong>{query}</strong>"</div>
                    )}
                    {!isSearching && results.map((product, index) => (
                        <button
                            key={product.id}
                            onMouseDown={() => selectProduct(product)}
                            className={`w-full flex items-center justify-between px-4 py-3 text-left hover:bg-indigo-50 transition-colors ${index === highlightIndex ? 'bg-indigo-50' : ''}`}
                        >
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-slate-800 truncate">{product.name}</p>
                                {product.sku && (
                                    <p className="text-xs text-slate-400 mt-0.5">{product.sku}</p>
                                )}
                            </div>
                            <div className="ml-4 text-right shrink-0">
                                <p className="font-black text-indigo-600 text-base">${Number(product.price).toFixed(2)}</p>
                                <p className={`text-xs font-semibold ${Number(product.stock) > 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                                    {Number(product.stock) > 0 ? `${formatStock(product.stock)} disp.` : 'Sin stock'}
                                </p>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ExpressSearch;
