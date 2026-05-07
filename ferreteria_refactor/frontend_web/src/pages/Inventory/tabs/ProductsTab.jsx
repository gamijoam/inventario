import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
    Plus, Search, Package, X, Trash2, Pencil, RefreshCw,
    MoreHorizontal, ChevronDown, Barcode, ArrowUpAZ, ArrowDownAZ,
    TrendingUp, TrendingDown, Download, Upload, FileSpreadsheet,
    FileText, SlidersHorizontal, Boxes, AlertTriangle, Ban,
    Sparkles
} from 'lucide-react';
import SearchWithScanner from '../../../components/common/SearchWithScanner';
import ProductForm from '../../../components/products/ProductForm';
import ProductMobileCard from '../../../components/products/ProductMobileCard';
import BulkProductActions from '../../../components/products/BulkProductActions';
import InventoryValuationCard from '../../../components/products/InventoryValuationCard';
import ProductThumbnail from '../../../components/products/ProductThumbnail';
import ProductInstancesModal from '../../../components/products/ProductInstancesModal';
import { useConfig } from '../../../context/ConfigContext';
import { useWebSocket } from '../../../context/WebSocketContext';
import { useAuth } from '../../../context/AuthContext';
import apiClient from '../../../config/axios';
import clsx from 'clsx';
import { useFeatureFlag } from '../../../hooks/useFeatureFlag';
import { cn } from '../../../utils/cn';
import { normalizeSearch } from '../../../utils/search';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import {
    Table, TableBody, TableCell, TableHead,
    TableHeader, TableRow,
} from "../../../components/ui/table";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem,
    DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";

const formatStock = (stock) => {
    const num = Number(stock);
    return num % 1 === 0 ? num.toFixed(0) : num.toFixed(3).replace(/\.?0+$/, '');
};

// ─── Stock Pill ───────────────────────────────────────────────────────────────
const StockPill = ({ stock, minStock }) => {
    const total = Number(stock || 0);
    const min   = Number(minStock ?? 5);
    const isOut = total === 0;
    const isLow = !isOut && total < min;

    const cfg = isOut
        ? { label: 'Agotado',   bg: 'bg-rose-50',   text: 'text-rose-600',   dot: 'bg-rose-400'   }
        : isLow
        ? { label: 'Bajo Stock', bg: 'bg-amber-50',  text: 'text-amber-600',  dot: 'bg-amber-400'  }
        : { label: 'En Stock',   bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-400' };

    return (
        <div className="flex flex-col items-end gap-1">
            <span className={cn('text-2xl font-black tracking-tight', cfg.text)}>
                {formatStock(total)} <span className="text-[10px] font-bold opacity-60">un.</span>
            </span>
            <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold', cfg.bg, cfg.text)}>
                <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dot, isOut && 'animate-pulse')} />
                {cfg.label}
            </span>
        </div>
    );
};

// ─── KPI Card ─────────────────────────────────────────────────────────────────
const KpiCard = ({ icon: Icon, label, value, sub, iconBg, iconColor }) => (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex items-center gap-4">
        <div className={cn('w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0', iconBg)}>
            <Icon size={20} className={iconColor} />
        </div>
        <div className="min-w-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">{label}</p>
            <p className="text-2xl font-black text-slate-800 leading-none truncate">{value}</p>
            {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
        </div>
    </div>
);

// ─── Componente principal ─────────────────────────────────────────────────────
const ProductsTab = () => {
    const { user } = useAuth();
    const showPriceList = useFeatureFlag('precio_lista_en_inventario');
    const { convertProductPrice, modules } = useConfig();
    const { subscribe } = useWebSocket();

    const [isModalOpen, setIsModalOpen]   = useState(false);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [isInstancesModalOpen, setIsInstancesModalOpen] = useState(false);
    const [selectedProductForInstances, setSelectedProductForInstances] = useState(null);
    const [searchTerm, setSearchTerm]     = useState('');
    const [products, setProducts]         = useState([]);
    const [totalProductsReal, setTotalProductsReal] = useState(0);
    const [globalKpis, setGlobalKpis] = useState({ inStock: 0, lowStock: 0, outOfStock: 0 });
    const [isLoading, setIsLoading]       = useState(true);
    const [currentPage, setCurrentPage]   = useState(1);
    const ITEMS_PER_PAGE = 50;

    const [categories, setCategories]     = useState([]);
    const [exchangeRates, setExchangeRates] = useState([]);
    const [warehouses, setWarehouses]     = useState([]);
    const [filterCategory, setFilterCategory] = useState('');
    const [filterWarehouse, setFilterWarehouse] = useState('');
    const [filterStock, setFilterStock]   = useState('');
    const [sortBy, setSortBy]             = useState('');
    const [showFilters, setShowFilters]   = useState(false);

    const fetchProducts = async (page = currentPage) => {
        setIsLoading(true);
        try {
            const res = await apiClient.get('/products/', {
                params: {
                    skip: (page - 1) * ITEMS_PER_PAGE,
                    limit: ITEMS_PER_PAGE,
                    search: searchTerm || undefined,
                    warehouse_id: filterWarehouse || undefined,
                    _t: Date.now()   // cache-bust: fuerza datos frescos siempre
                }
            });
            // El backend devuelve { items, total, has_more } o un array directo
            if (res.data && Array.isArray(res.data.items)) {
                setProducts(res.data.items);
                setTotalProductsReal(res.data.total || res.data.items.length);
                setGlobalKpis({
                    inStock:     res.data.total_in_stock     ?? 0,
                    lowStock:    res.data.total_low_stock    ?? 0,
                    outOfStock:  res.data.total_out_of_stock ?? 0,
                });
            } else {
                setProducts(Array.isArray(res.data) ? res.data : []);
                setTotalProductsReal(Array.isArray(res.data) ? res.data.length : 0);
                setGlobalKpis({ inStock: 0, lowStock: 0, outOfStock: 0 });
            }
        } catch {}
        finally { setIsLoading(false); }
    };

    const handleDelete = async (product) => {
        if (!window.confirm(`¿Eliminar "${product.name}"?`)) return;
        try {
            await apiClient.delete(`/products/${product.id}`);
            toast.success('Producto eliminado');
        } catch { toast.error('Error al eliminar'); }
    };

    useEffect(() => {
        window.__refreshCategories = async () => {
            try { const r = await apiClient.get('/categories'); setCategories(r.data); } catch {}
        };
        return () => { delete window.__refreshCategories; };
    }, []);

    useEffect(() => {
        const fetch = async () => {
            try {
                const [c, e, w] = await Promise.all([
                    apiClient.get('/categories'),
                    apiClient.get('/config/exchange-rates', { params: { is_active: true } }),
                    apiClient.get('/warehouses'),
                ]);
                setCategories(c.data); setExchangeRates(e.data); setWarehouses(w.data);
            } catch {}
        };
        fetch();
        const u1 = subscribe('product:created', p => setProducts(prev => [p, ...prev]));
        const u2 = subscribe('product:updated', p => setProducts(prev => prev.map(x => x.id === p.id ? { ...x, ...p } : x)));
        const u3 = subscribe('product:deleted', p => setProducts(prev => prev.filter(x => x.id !== p.id)));
        return () => { u1(); u2(); u3(); };
    }, [subscribe]);

    // Recargar siempre al montar el componente para obtener datos frescos
    useEffect(() => { fetchProducts(1); }, []);
    useEffect(() => { fetchProducts(currentPage); }, [currentPage]);
    useEffect(() => {
        const t = setTimeout(() => { setCurrentPage(1); fetchProducts(1); }, 400);
        return () => clearTimeout(t);
    }, [searchTerm, filterCategory, filterWarehouse]);

    const filteredProducts = useMemo(() => {
        let r = products.filter(p => {
            if (filterCategory && p.category_id !== parseInt(filterCategory)) return false;
            if (filterStock) {
                const s = Number(p.stock || 0), m = Number(p.min_stock ?? 5);
                if (filterStock === 'out_of_stock' && s > 0) return false;
                if (filterStock === 'low_stock'   && !(s > 0 && s < m)) return false;
                if (filterStock === 'in_stock'    && !(s >= m)) return false;
            }
            return true;
        });
        if (sortBy === 'az') r = [...r].sort((a, b) => a.name.localeCompare(b.name));
        else if (sortBy === 'za') r = [...r].sort((a, b) => b.name.localeCompare(a.name));
        else if (sortBy === 'price_asc') r = [...r].sort((a, b) => Number(a.price) - Number(b.price));
        else if (sortBy === 'price_desc') r = [...r].sort((a, b) => Number(b.price) - Number(a.price));
        return r;
    }, [products, filterCategory, filterStock, sortBy]);

    // KPI stats — usa totales reales del backend (todos los productos, no solo la página)
    const kpis = useMemo(() => {
        const total   = totalProductsReal || filteredProducts.length;
        // Si hay filtros activos, calcular sobre los filtrados; si no, usar globales del backend
        const hasActiveFilters = filterCategory || filterStock;
        const inStock = hasActiveFilters
            ? filteredProducts.filter(p => Number(p.stock) >= Number(p.min_stock ?? 5)).length
            : globalKpis.inStock || 0;
        const low = hasActiveFilters
            ? filteredProducts.filter(p => { const s = Number(p.stock||0), m = Number(p.min_stock??5); return s > 0 && s < m; }).length
            : globalKpis.lowStock || 0;
        const out = hasActiveFilters
            ? filteredProducts.filter(p => Number(p.stock||0) === 0).length
            : globalKpis.outOfStock || 0;
        return { total, inStock, low, out };
    }, [filteredProducts, totalProductsReal, globalKpis, filterCategory, filterStock]);

    const isAdmin = ['ADMIN', 'WAREHOUSE'].includes(user?.role);
    const hasFilters = filterCategory || filterWarehouse || filterStock || sortBy;

    return (
        <div className="space-y-4 animate-in fade-in duration-300">

            {/* ── Toolbar ─────────────────────────────────────────────────── */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Búsqueda */}
                <div className="flex-1 min-w-[200px] max-w-sm">
                    <SearchWithScanner
                        value={searchTerm}
                        onChange={setSearchTerm}
                        placeholder="Buscar producto o SKU..."
                        inputClassName="h-10 bg-white rounded-xl border-slate-200 shadow-sm"
                    />
                </div>

                {/* Acciones lado derecho */}
                <div className="flex items-center gap-2 flex-wrap">

                    {/* Filtros toggle */}
                    <button
                        onClick={() => setShowFilters(f => !f)}
                        className={cn(
                            'flex items-center gap-2 h-10 px-3.5 rounded-xl text-sm font-bold border transition-all',
                            showFilters || hasFilters
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 shadow-sm'
                        )}
                    >
                        <SlidersHorizontal size={15} />
                        <span className="hidden sm:inline">Filtros</span>
                        {hasFilters && <span className="w-2 h-2 rounded-full bg-amber-400" />}
                    </button>

                    {/* Dropdown Acciones / Exportar */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button className="flex items-center gap-2 h-10 px-3.5 rounded-xl text-sm font-bold border bg-white text-slate-600 border-slate-200 hover:border-slate-300 shadow-sm transition-all">
                                <Download size={15} />
                                <span className="hidden sm:inline">Acciones</span>
                                <ChevronDown size={13} className="text-slate-400" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl shadow-xl border-slate-200 min-w-[180px]">
                            <DropdownMenuLabel className="text-[10px] uppercase text-slate-400 tracking-widest">Importar / Exportar</DropdownMenuLabel>
                            <BulkProductActions onImportComplete={fetchProducts} asMenuItems />
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={fetchProducts} className="cursor-pointer font-medium">
                                <RefreshCw size={14} className="mr-2 text-slate-400" /> Recargar lista
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Recepción serializada */}
                    {modules?.services && (
                        <Link
                            to="/inventory/serialized-reception"
                            className="flex items-center gap-2 h-10 px-3.5 rounded-xl text-sm font-bold border bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50 shadow-sm transition-all"
                        >
                            <Barcode size={15} />
                            <span className="hidden sm:inline">Recepción</span>
                        </Link>
                    )}

                    {/* CTA Principal */}
                    {isAdmin && (
                        <button
                            onClick={() => { setSelectedProduct(null); setIsModalOpen(true); }}
                            className="flex items-center gap-2 h-10 px-4 rounded-xl text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200 hover:-translate-y-0.5 transition-all"
                        >
                            <Plus size={16} />
                            <span>Nuevo Producto</span>
                        </button>
                    )}
                </div>
            </div>

            {/* ── Panel de Filtros ─────────────────────────────────────────── */}
            {showFilters && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-wrap gap-3 items-center">
                    <select
                        value={filterCategory}
                        onChange={e => setFilterCategory(e.target.value)}
                        className="h-9 px-3 rounded-xl border border-slate-200 text-sm font-medium bg-slate-50 text-slate-700 focus:outline-none focus:border-indigo-400"
                    >
                        <option value="">Todas las Categorías</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>

                    <select
                        value={filterWarehouse}
                        onChange={e => setFilterWarehouse(e.target.value)}
                        className="h-9 px-3 rounded-xl border border-slate-200 text-sm font-medium bg-slate-50 text-slate-700 focus:outline-none focus:border-indigo-400"
                    >
                        <option value="">Todas las Bodegas</option>
                        {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>

                    {/* Stock pills */}
                    <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
                        {[
                            { val: '',             label: 'Todo' },
                            { val: 'in_stock',     label: 'En Stock' },
                            { val: 'low_stock',    label: 'Bajo Stock' },
                            { val: 'out_of_stock', label: 'Agotado' },
                        ].map(({ val, label }) => (
                            <button
                                key={val}
                                onClick={() => setFilterStock(val)}
                                className={cn(
                                    'px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                                    filterStock === val
                                        ? 'bg-white text-slate-800 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                )}
                            >{label}</button>
                        ))}
                    </div>

                    {/* Sort */}
                    <select
                        value={sortBy}
                        onChange={e => setSortBy(e.target.value)}
                        className="h-9 px-3 rounded-xl border border-slate-200 text-sm font-medium bg-slate-50 text-slate-700 focus:outline-none focus:border-indigo-400"
                    >
                        <option value="">Ordenar por...</option>
                        <option value="az">Nombre A → Z</option>
                        <option value="za">Nombre Z → A</option>
                        <option value="price_asc">Precio: menor primero</option>
                        <option value="price_desc">Precio: mayor primero</option>
                    </select>

                    {hasFilters && (
                        <button
                            onClick={() => { setFilterCategory(''); setFilterWarehouse(''); setFilterStock(''); setSortBy(''); }}
                            className="flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-bold text-rose-500 hover:bg-rose-50 border border-rose-200 transition-all"
                        >
                            <X size={13} /> Limpiar
                        </button>
                    )}
                </div>
            )}

            {/* ── KPI Cards ────────────────────────────────────────────────── */}
            <div className="hidden md:grid grid-cols-4 gap-3">
                <KpiCard icon={Boxes}         label="Total productos" value={kpis.total}   iconBg="bg-indigo-50"  iconColor="text-indigo-500" />
                <KpiCard icon={Sparkles}      label="En stock"        value={kpis.inStock}  iconBg="bg-emerald-50" iconColor="text-emerald-500" />
                <KpiCard icon={AlertTriangle} label="Bajo stock"      value={kpis.low}      iconBg="bg-amber-50"   iconColor="text-amber-500" />
                <KpiCard icon={Ban}           label="Agotados"        value={kpis.out}      iconBg="bg-rose-50"    iconColor="text-rose-500" />
            </div>

            {/* ── Vista móvil ──────────────────────────────────────────────── */}
            <div className="md:hidden space-y-3">
                {isLoading ? (
                    <div className="py-12 text-center text-slate-400 animate-pulse">Cargando productos...</div>
                ) : filteredProducts.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 border border-dashed border-slate-200 rounded-2xl">No se encontraron productos.</div>
                ) : filteredProducts.map(p => (
                    <ProductMobileCard key={p.id} product={p}
                        onEdit={p => { setSelectedProduct(p); setIsModalOpen(true); }}
                        onDelete={handleDelete}
                        onCategoryClick={id => setFilterCategory(id.toString())}
                    />
                ))}
            </div>

            {/* ── Tabla Desktop ─────────────────────────────────────────────── */}
            <div className="hidden md:block bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/60">
                            <th className="w-14 px-4 py-3 text-left" />
                            <th className="px-4 py-3 text-left text-xs font-black text-slate-400 uppercase tracking-wider">Producto</th>
                            <th className="px-4 py-3 text-left text-xs font-black text-slate-400 uppercase tracking-wider">Categoría</th>
                            <th className="px-4 py-3 text-right text-xs font-black text-slate-400 uppercase tracking-wider">Precios</th>
                            <th className="px-4 py-3 text-right text-xs font-black text-slate-400 uppercase tracking-wider">Stock</th>
                            <th className="w-16 px-4 py-3" />
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {isLoading ? (
                            <tr><td colSpan={6} className="py-16 text-center">
                                <div className="flex items-center justify-center gap-2 text-slate-400">
                                    <RefreshCw size={16} className="animate-spin" /> Cargando...
                                </div>
                            </td></tr>
                        ) : filteredProducts.length === 0 ? (
                            <tr><td colSpan={6} className="py-16 text-center text-slate-400">No se encontraron productos.</td></tr>
                        ) : filteredProducts.map(product => (
                            <tr key={product.id} className="group hover:bg-indigo-50/20 transition-colors">

                                {/* Imagen */}
                                <td className="px-3 py-2">
                                    <ProductThumbnail
                                        imageUrl={product.image_url}
                                        productName={product.name}
                                        size="sm"
                                        className="h-10 w-10 rounded-xl border border-slate-100 shadow-sm mix-blend-multiply group-hover:scale-105 transition-transform"
                                    />
                                </td>

                                {/* Producto */}
                                <td className="px-4 py-3.5 max-w-xs">
                                    <div className="font-black text-slate-900 text-base leading-tight group-hover:text-indigo-700 transition-colors line-clamp-1">
                                        {product.name}
                                    </div>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        <span className="text-xs text-slate-400 font-mono">
                                            {product.sku || '—'}
                                        </span>
                                        {product.has_imei && (
                                            <span className="text-[9px] font-black bg-blue-50 text-blue-600 border border-blue-100 px-1.5 py-0.5 rounded-full">SERIAL</span>
                                        )}
                                    </div>
                                </td>

                                {/* Categoría */}
                                <td className="px-4 py-2.5">
                                    {product.category?.name ? (
                                        <button
                                            onClick={() => setFilterCategory(product.category_id.toString())}
                                            className="text-xs font-bold text-slate-600 bg-slate-100 hover:bg-indigo-100 hover:text-indigo-700 px-2.5 py-1.5 rounded-full transition-colors"
                                        >
                                            {product.category.name}
                                        </button>
                                    ) : (
                                        <span className="text-[11px] text-slate-300 italic">Sin categoría</span>
                                    )}
                                </td>

                                {/* Precios */}
                                <td className="px-4 py-3.5 text-right">
                                    <div className="flex items-stretch justify-end gap-2">
                                        <div className="flex flex-col items-end bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 min-w-[76px]">
                                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">P. Mayor</span>
                                            <span className="text-base font-black text-slate-800 leading-none">${Number(product.price).toFixed(2)}</span>
                                            {convertProductPrice && (
                                                <span className="text-[9px] text-slate-400 mt-0.5">
                                                    Bs {Number(convertProductPrice(product, 'VES') || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </span>
                                            )}
                                        </div>
                                        {showPriceList && Array.isArray(product.prices) && product.prices.length > 0 && (
                                            <div className="flex flex-col items-end bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-1.5 min-w-[76px]">
                                                <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest truncate max-w-[72px]">
                                                    {product.prices[0].price_list?.name || 'Lista'}
                                                </span>
                                                <span className="text-base font-black text-indigo-700 leading-none">${Number(product.prices[0].price || 0).toFixed(2)}</span>
                                                {convertProductPrice && (
                                                    <span className="text-[9px] text-indigo-300 mt-0.5">
                                                        Bs {Number((Number(product.prices[0].price||0) * (convertProductPrice(product,'VES')/(Number(product.price)||1))).toFixed(2)).toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2})}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </td>

                                {/* Stock */}
                                <td className="px-4 py-3.5 text-right">
                                    <StockPill stock={product.stock} minStock={product.min_stock} />
                                </td>

                                {/* Acciones */}
                                <td className="px-3 py-3.5 text-right">
                                    {isAdmin && (
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 transition-all">
                                                    <Pencil size={13} /> Editar
                                                </button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="rounded-2xl shadow-xl border-slate-100 min-w-[160px]">
                                                <DropdownMenuLabel className="text-[10px] uppercase text-slate-400 tracking-widest">Opciones</DropdownMenuLabel>
                                                {product.has_imei && modules?.services && (
                                                    <DropdownMenuItem
                                                        onClick={() => { setSelectedProductForInstances(product); setIsInstancesModalOpen(true); }}
                                                        className="rounded-xl cursor-pointer font-medium text-slate-700"
                                                    >
                                                        <Search size={14} className="mr-2 text-indigo-400" /> Ver Seriales / IMEIs
                                                    </DropdownMenuItem>
                                                )}
                                                <DropdownMenuItem
                                                    onClick={() => { setSelectedProduct(product); setIsModalOpen(true); }}
                                                    className="rounded-xl cursor-pointer font-bold"
                                                >
                                                    <Pencil size={14} className="mr-2 text-indigo-500" /> Editar
                                                </DropdownMenuItem>
                                                {user?.role === 'ADMIN' && (
                                                    <>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem
                                                            onClick={() => handleDelete(product)}
                                                            className="rounded-xl cursor-pointer font-bold text-rose-600 hover:text-rose-700 focus:bg-rose-50"
                                                        >
                                                            <Trash2 size={14} className="mr-2" /> Eliminar
                                                        </DropdownMenuItem>
                                                    </>
                                                )}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* ── Paginación ───────────────────────────────────────────────── */}
            <div className="flex items-center justify-between px-1">
                <p className="text-xs text-slate-400 font-medium">
                    {filteredProducts.length} productos · página {currentPage}
                </p>
                <div className="flex gap-2">
                    <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="h-8 px-4 rounded-xl text-xs font-bold border border-slate-200 bg-white text-slate-600 hover:border-indigo-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                        Anterior
                    </button>
                    <button
                        onClick={() => setCurrentPage(p => p + 1)}
                        disabled={products.length < ITEMS_PER_PAGE}
                        className="h-8 px-4 rounded-xl text-xs font-bold border border-slate-200 bg-white text-slate-600 hover:border-indigo-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                        Siguiente
                    </button>
                </div>
            </div>

            {/* ── Modales ──────────────────────────────────────────────────── */}
            <ProductForm
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setSelectedProduct(null); }}
                initialData={selectedProduct}
                categories={categories}
                warehouses={warehouses}
                exchangeRates={exchangeRates}
                onSubmit={async (data) => {
                    try {
                        if (selectedProduct) { await apiClient.put(`/products/${selectedProduct.id}`, data); toast.success('Actualizado'); }
                        else { await apiClient.post('/products/', data); toast.success('Producto creado'); }
                        await fetchProducts(); setIsModalOpen(false); setSelectedProduct(null);
                    } catch (e) { toast.error(e.response?.data?.detail || 'Error'); }
                }}
            />
            <ProductInstancesModal
                isOpen={isInstancesModalOpen}
                onClose={() => { setIsInstancesModalOpen(false); setSelectedProductForInstances(null); }}
                product={selectedProductForInstances}
            />
        </div>
    );
};

export default ProductsTab;
