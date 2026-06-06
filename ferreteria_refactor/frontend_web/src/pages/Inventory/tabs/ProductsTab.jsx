import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
    Plus, Search, Package, X, Trash2, Pencil, RefreshCw,
    MoreHorizontal, ChevronDown, Barcode, ArrowUpAZ, ArrowDownAZ,
    TrendingUp, TrendingDown, Download, Upload, FileSpreadsheet,
    FileText, SlidersHorizontal, Boxes, AlertTriangle, Ban,
    Sparkles, Zap
} from 'lucide-react';
import SearchWithScanner from '../../../components/common/SearchWithScanner';
import ProductForm from '../../../components/products/ProductForm';
import QuickProductCreateModal from '../../../components/products/QuickProductCreateModal';
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
        ? { label: 'Agotado',    bg: 'bg-rose-50',    text: 'text-rose-600',    dot: 'bg-rose-400' }
        : isLow
        ? { label: 'Bajo',       bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-400' }
        : { label: 'Disponible', bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-400' };

    return (
        <div className="flex min-w-[88px] flex-col items-end gap-1">
            <span className={cn('text-xl font-black tracking-tight leading-none', cfg.text)}>
                {formatStock(total)} <span className="text-[10px] font-bold opacity-60">un.</span>
            </span>
            <span className={cn('inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-bold', cfg.bg, cfg.text)}>
                <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dot, isOut && 'animate-pulse')} />
                {cfg.label}
            </span>
        </div>
    );
};

// KPI Card
const KpiCard = ({ icon: Icon, label, value, sub, iconBg, iconColor }) => (
    <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <div className={cn('flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md', iconBg)}>
            <Icon size={18} className={iconColor} />
        </div>
        <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
            <p className="truncate text-xl font-black leading-none text-slate-800">{value}</p>
            {sub && <p className="mt-0.5 text-[10px] text-slate-400">{sub}</p>}
        </div>
    </div>
);

// Componente principal
const ProductsTab = () => {
    const { user } = useAuth();
    const showPriceList = useFeatureFlag('precio_lista_en_inventario');
    const { convertProductPrice, modules } = useConfig();
    const { subscribe } = useWebSocket();

    const [isModalOpen, setIsModalOpen]   = useState(false);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [isQuickModalOpen, setIsQuickModalOpen] = useState(false);
    const [isInstancesModalOpen, setIsInstancesModalOpen] = useState(false);
    const [selectedProductForInstances, setSelectedProductForInstances] = useState(null);
    const [searchTerm, setSearchTerm]     = useState('');
    const [products, setProducts]         = useState([]);
    const [totalProductsReal, setTotalProductsReal] = useState(0);
    const [filteredTotal, setFilteredTotal] = useState(0); // Total con filtros activos
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
            const [res, kpisRes] = await Promise.allSettled([
                apiClient.get('/products/', {
                    params: {
                        skip: (page - 1) * ITEMS_PER_PAGE,
                        limit: ITEMS_PER_PAGE,
                        search: searchTerm || undefined,
                        warehouse_id: filterWarehouse || undefined,
                        category_id: filterCategory || undefined,
                        stock_filter: filterStock || undefined,
                        _t: Date.now()
                    }
                }),
                apiClient.get('/products/kpis', {
                    params: { warehouse_id: filterWarehouse || undefined },
                    _silentNetworkError: true,
                }),
            ]);

            if (res.status === 'fulfilled') {
                const data = res.value.data;
                // El endpoint ahora siempre devuelve {items, total, has_more}
                const items = data?.items ?? (Array.isArray(data) ? data : []);
                const total = data?.total ?? items.length;
                setProducts(items);
                setFilteredTotal(total);
            }

            if (kpisRes.status === 'fulfilled') {
                const k = kpisRes.value.data;
                setTotalProductsReal(k.total ?? 0);
                setGlobalKpis({
                    inStock:    k.in_stock    ?? 0,
                    lowStock:   k.low_stock   ?? 0,
                    outOfStock: k.out_of_stock ?? 0,
                });
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
    }, [searchTerm, filterCategory, filterWarehouse, filterStock]);

    const filteredProducts = useMemo(() => {
        // Los filtros category, stock, search ya se aplican en el backend
        // Solo aplicamos sort local sobre la página actual
        let r = [...products];
        if (sortBy === 'az') r = r.sort((a, b) => a.name.localeCompare(b.name));
        else if (sortBy === 'za') r = r.sort((a, b) => b.name.localeCompare(a.name));
        else if (sortBy === 'price_asc') r = r.sort((a, b) => Number(a.price) - Number(b.price));
        else if (sortBy === 'price_desc') r = r.sort((a, b) => Number(b.price) - Number(a.price));
        return r;
    }, [products, sortBy]);

    // KPI stats — siempre usa los totales reales del backend (/products/kpis)
    // Los filtros locales (categoría, stock) NO afectan los totales globales del inventario
    const kpis = useMemo(() => ({
        total:   totalProductsReal,
        inStock: globalKpis.inStock,
        low:     globalKpis.lowStock,
        out:     globalKpis.outOfStock,
    }), [totalProductsReal, globalKpis]);

    const isAdmin = ['ADMIN', 'WAREHOUSE'].includes(user?.role);
    const stockLabels = {
        in_stock: 'En stock',
        low_stock: 'Bajo stock',
        out_of_stock: 'Agotado',
    };
    const sortLabels = {
        az: 'Nombre A-Z',
        za: 'Nombre Z-A',
        price_asc: 'Precio menor',
        price_desc: 'Precio mayor',
    };
    const activeFilters = [
        searchTerm?.trim() && `Búsqueda: ${searchTerm.trim()}`,
        filterCategory && `Categoría: ${categories.find(c => String(c.id) === String(filterCategory))?.name || filterCategory}`,
        filterWarehouse && `Almacén: ${warehouses.find(w => String(w.id) === String(filterWarehouse))?.name || filterWarehouse}`,
        filterStock && stockLabels[filterStock],
        sortBy && sortLabels[sortBy],
    ].filter(Boolean);
    const hasFilters = filterCategory || filterWarehouse || filterStock || sortBy;
    const hasActiveConstraints = activeFilters.length > 0;
    const clearAllFilters = () => {
        setSearchTerm('');
        setFilterCategory('');
        setFilterWarehouse('');
        setFilterStock('');
        setSortBy('');
    };

    return (
        <div className="space-y-4 animate-in fade-in duration-300">

            {/* Toolbar */}
            <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
                        <div className="min-w-[220px] flex-1 lg:max-w-md">
                            <SearchWithScanner
                                value={searchTerm}
                                onChange={setSearchTerm}
                                placeholder="Buscar por nombre, SKU o serial..."
                                inputClassName="h-10 bg-white rounded-md border-slate-200 shadow-none"
                            />
                        </div>
                        <button
                            onClick={() => setShowFilters(f => !f)}
                            className={cn(
                                'inline-flex h-10 items-center justify-center gap-2 rounded-md border px-3 text-sm font-bold transition-colors',
                                showFilters || hasFilters
                                    ? 'border-slate-900 bg-slate-900 text-white'
                                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                            )}
                        >
                            <SlidersHorizontal size={15} />
                            Filtros
                            {hasFilters && <span className="h-2 w-2 rounded-full bg-amber-400" />}
                        </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900">
                                    <Download size={15} />
                                    Acciones
                                    <ChevronDown size={13} className="text-slate-400" />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="min-w-[180px] rounded-lg border-slate-200 shadow-xl">
                                <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-slate-400">Importar / Exportar</DropdownMenuLabel>
                                <BulkProductActions onImportComplete={fetchProducts} asMenuItems searchTerm={searchTerm} filterCategory={filterCategory} filterStock={filterStock} filterWarehouse={filterWarehouse} />
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={fetchProducts} className="cursor-pointer font-medium">
                                    <RefreshCw size={14} className="mr-2 text-slate-400" /> Recargar lista
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        {modules?.services && (
                            <Link
                                to="/inventory/serialized-reception"
                                className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
                            >
                                <Barcode size={15} />
                                <span className="hidden sm:inline">Recepción IMEI</span>
                            </Link>
                        )}

                        {isAdmin && (
                            <button
                                onClick={() => setIsQuickModalOpen(true)}
                                className="inline-flex h-10 items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 text-sm font-bold text-amber-700 transition-colors hover:bg-amber-100"
                                title="Crear un producto con los datos mínimos"
                            >
                                <Zap size={15} />
                                <span className="hidden sm:inline">Rápido</span>
                            </button>
                        )}

                        {isAdmin && (
                            <button
                                onClick={() => { setSelectedProduct(null); setIsModalOpen(true); }}
                                className="inline-flex h-10 items-center gap-2 rounded-md bg-slate-900 px-4 text-sm font-bold text-white shadow-sm transition-colors hover:bg-slate-800"
                            >
                                <Plus size={16} />
                                Nuevo Producto
                            </button>
                        )}
                    </div>
                </div>

                {hasActiveConstraints && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                        <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Vista filtrada</span>
                        {activeFilters.map(label => (
                            <span key={label} className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">
                                {label}
                            </span>
                        ))}
                        <button
                            onClick={clearAllFilters}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-bold text-rose-600 hover:bg-rose-50"
                        >
                            <X size={13} /> Limpiar todo
                        </button>
                    </div>
                )}
            </div>

            {/* Panel de Filtros */}
            {showFilters && (
                <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                    <label className="flex min-w-[190px] flex-col gap-1 text-xs font-bold uppercase tracking-wide text-slate-400">
                        Categoría
                        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="h-9 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-medium normal-case tracking-normal text-slate-700 focus:border-slate-400 focus:outline-none">
                            <option value="">Todas</option>
                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </label>

                    <label className="flex min-w-[190px] flex-col gap-1 text-xs font-bold uppercase tracking-wide text-slate-400">
                        Almacén
                        <select value={filterWarehouse} onChange={e => setFilterWarehouse(e.target.value)} className="h-9 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-medium normal-case tracking-normal text-slate-700 focus:border-slate-400 focus:outline-none">
                            <option value="">Todos</option>
                            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                    </label>

                    <div className="flex flex-col gap-1">
                        <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Stock</span>
                        <div className="flex h-9 items-center gap-1 rounded-md bg-slate-100 p-1">
                            {[{ val: '', label: 'Todo' }, { val: 'in_stock', label: 'En stock' }, { val: 'low_stock', label: 'Bajo' }, { val: 'out_of_stock', label: 'Agotado' }].map(({ val, label }) => (
                                <button key={val} onClick={() => setFilterStock(val)} className={cn('rounded px-3 py-1.5 text-xs font-bold transition-colors', filterStock === val ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800')}>{label}</button>
                            ))}
                        </div>
                    </div>

                    <label className="flex min-w-[190px] flex-col gap-1 text-xs font-bold uppercase tracking-wide text-slate-400">
                        Orden
                        <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="h-9 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-medium normal-case tracking-normal text-slate-700 focus:border-slate-400 focus:outline-none">
                            <option value="">Recientes</option>
                            <option value="az">Nombre A-Z</option>
                            <option value="za">Nombre Z-A</option>
                            <option value="price_asc">Precio menor primero</option>
                            <option value="price_desc">Precio mayor primero</option>
                        </select>
                    </label>
                </div>
            )}

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
            <div className="hidden overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm md:block">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-slate-200 bg-slate-50">
                            <th className="w-14 px-4 py-3 text-left" />
                            <th className="px-4 py-3 text-left text-xs font-black text-slate-400 uppercase tracking-wider">Producto</th>
                            <th className="px-4 py-3 text-left text-xs font-black text-slate-400 uppercase tracking-wider">Categoría</th>
                            <th className="px-4 py-3 text-right text-xs font-black text-slate-400 uppercase tracking-wide">Precio</th>
                            <th className="px-4 py-3 text-right text-xs font-black text-slate-400 uppercase tracking-wide">Stock</th>
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
                            <tr key={product.id} className="group hover:bg-slate-50 transition-colors">

                                {/* Imagen */}
                                <td className="px-3 py-2">
                                    <ProductThumbnail
                                        imageUrl={product.image_url}
                                        productName={product.name}
                                        size="sm"
                                        className="h-10 w-10 rounded-md border border-slate-100 shadow-sm mix-blend-multiply group-hover:scale-105 transition-transform"
                                    />
                                </td>

                                {/* Producto */}
                                <td className="px-4 py-3.5 max-w-xs">
                                    <div className="line-clamp-1 text-sm font-black leading-tight text-slate-900 transition-colors group-hover:text-slate-700">
                                        {product.name}
                                    </div>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        <span className="text-xs text-slate-400 font-mono">
                                            {product.sku || '—'}
                                        </span>
                                        {product.has_imei && (
                                            <span className="rounded-md border border-blue-100 bg-blue-50 px-1.5 py-0.5 text-[9px] font-black text-blue-600">SERIAL</span>
                                        )}
                                    </div>
                                </td>

                                {/* Categoría */}
                                <td className="px-4 py-2.5">
                                    {product.category?.name ? (
                                        <button
                                            onClick={() => setFilterCategory(product.category_id.toString())}
                                            className="rounded-md bg-slate-100 px-2.5 py-1.5 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-200 hover:text-slate-900"
                                        >
                                            {product.category.name}
                                        </button>
                                    ) : (
                                        <span className="text-[11px] text-slate-300 italic">Sin categoría</span>
                                    )}
                                </td>

                                {/* Precios */}
                                <td className="px-4 py-3.5 text-right align-top">
                                    <div className="font-black text-slate-900">${Number(product.price).toFixed(2)}</div>
                                    {convertProductPrice && (
                                        <div className="mt-0.5 text-xs font-medium text-slate-400">
                                            Bs {Number(convertProductPrice(product, 'VES') || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </div>
                                    )}
                                    {showPriceList && Array.isArray(product.prices) && product.prices.length > 0 && (
                                        <div className="mt-2 space-y-1">
                                            {product.prices.slice(0, 3).map((priceItem, idx) => (
                                                <div key={priceItem.id ?? `${priceItem.price_list_id ?? 'list'}-${idx}`} className="text-[11px] font-bold text-slate-500">
                                                    <span className="text-slate-400">{priceItem.price_list?.name || 'Lista'}:</span>{' '}
                                                    <span className="text-slate-700">${Number(priceItem.price || 0).toFixed(2)}</span>
                                                </div>
                                            ))}
                                            {product.prices.length > 3 && (
                                                <div className="text-[11px] font-bold text-slate-400">+{product.prices.length - 3} listas</div>
                                            )}
                                        </div>
                                    )}
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
                                                <button className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900">
                                                    <Pencil size={13} /> Editar
                                                </button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="min-w-[160px] rounded-lg border-slate-100 shadow-xl">
                                                <DropdownMenuLabel className="text-[10px] uppercase text-slate-400 tracking-widest">Opciones</DropdownMenuLabel>
                                                {product.has_imei && (
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
            {/* ── Paginación con info completa ─────────────────────────── */}
            {(() => {
                const totalPages = Math.ceil(filteredTotal / ITEMS_PER_PAGE);
                const from = filteredTotal === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1;
                const to   = Math.min(currentPage * ITEMS_PER_PAGE, filteredTotal);
                return (
                    <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs text-slate-500 font-medium">
                            {filteredTotal === 0 ? 'Sin resultados' : (
                                <>
                                    Mostrando <span className="font-bold text-slate-700">{from}–{to}</span> de{' '}
                                    <span className="font-bold text-slate-700">{filteredTotal}</span> productos
                                    {totalPages > 1 && (
                                        <span className="text-slate-400"> · Página {currentPage} de {totalPages}</span>
                                    )}
                                </>
                            )}
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="h-8 rounded-md border border-slate-200 bg-white px-4 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                ← Anterior
                            </button>
                            {totalPages > 1 && (
                                <span className="text-xs font-bold text-slate-600 px-2">
                                    {currentPage} / {totalPages}
                                </span>
                            )}
                            <button
                                onClick={() => setCurrentPage(p => p + 1)}
                                disabled={currentPage >= totalPages || filteredTotal === 0}
                                className="h-8 rounded-md border border-slate-200 bg-white px-4 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                Siguiente →
                            </button>
                        </div>
                    </div>
                );
            })()}

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
            <QuickProductCreateModal
                isOpen={isQuickModalOpen}
                onClose={() => setIsQuickModalOpen(false)}
                onSuccess={() => { fetchProducts(); }}
            />
        </div>
    );
};

export default ProductsTab;
