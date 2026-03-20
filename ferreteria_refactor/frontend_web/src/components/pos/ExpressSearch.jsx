import { useState, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';

/**
 * ExpressSearch — Barra de búsqueda para Modo Express POS.
 * Al hacer Enter o seleccionar un producto, lo agrega al carrito y limpia.
 * Compatible con lectores de código de barras (flujo de teclas rápido).
 */
const ExpressSearch = ({ onAddToCart, lookupProduct }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [highlightIndex, setHighlightIndex] = useState(0);
    const inputRef = useRef(null);
    const debounceRef = useRef(null);

    useEffect(() => {
        // Auto-focus al montar
        inputRef.current?.focus();
    }, []);

    const search = async (value) => {
        if (!value || value.trim().length < 1) {
            setResults([]);
            setDropdownOpen(false);
            return;
        }
        setIsSearching(true);
        try {
            const found = await lookupProduct(value.trim());
            if (found) {
                // lookupProduct devuelve un solo producto (por SKU/código)
                setResults([found]);
            } else {
                setResults([]);
            }
        } catch {
            setResults([]);
        } finally {
            setIsSearching(false);
        }
        setDropdownOpen(true);
        setHighlightIndex(0);
    };

    const handleChange = (e) => {
        const value = e.target.value;
        setQuery(value);
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            search(value);
        }, 200);
    };

    const selectProduct = (product) => {
        onAddToCart(product);
        setQuery('');
        setResults([]);
        setDropdownOpen(false);
        inputRef.current?.focus();
    };

    const handleKeyDown = (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightIndex(i => Math.min(i + 1, results.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightIndex(i => Math.max(i - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (results.length === 1) {
                selectProduct(results[0]);
            } else if (results.length > 1 && highlightIndex >= 0) {
                selectProduct(results[highlightIndex]);
            } else if (query.trim().length > 0) {
                // Intento directo por si es código de barras exacto
                search(query.trim()).then(() => {
                    if (results.length === 1) selectProduct(results[0]);
                });
            }
        } else if (e.key === 'Escape') {
            setDropdownOpen(false);
            setQuery('');
        }
    };

    const formatStock = (stock) => {
        const num = Number(stock);
        return num % 1 === 0 ? num.toFixed(0) : num.toFixed(2);
    };

    return (
        <div className="relative w-full">
            <div className="relative flex items-center">
                <Search size={20} className="absolute left-4 text-slate-400 pointer-events-none" />
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    onFocus={() => results.length > 0 && setDropdownOpen(true)}
                    onBlur={() => setTimeout(() => setDropdownOpen(false), 150)}
                    placeholder="Buscar por nombre, SKU o código de barras…"
                    className="w-full h-14 pl-12 pr-10 text-lg rounded-2xl border-2 border-slate-200 focus:border-indigo-500 focus:ring-0 outline-none bg-white shadow-sm transition-colors"
                    autoComplete="off"
                />
                {query && (
                    <button
                        onClick={() => { setQuery(''); setResults([]); setDropdownOpen(false); inputRef.current?.focus(); }}
                        className="absolute right-4 text-slate-400 hover:text-slate-600"
                    >
                        <X size={18} />
                    </button>
                )}
            </div>

            {/* Dropdown de resultados */}
            {dropdownOpen && (
                <div className="absolute left-0 right-0 top-full mt-2 z-50 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
                    {isSearching && (
                        <div className="px-4 py-3 text-sm text-slate-500">Buscando…</div>
                    )}
                    {!isSearching && results.length === 0 && (
                        <div className="px-4 py-3 text-sm text-slate-500">Sin resultados para "{query}"</div>
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
                                    {Number(product.stock) > 0 ? `${formatStock(product.stock)} disponibles` : 'Sin stock'}
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
