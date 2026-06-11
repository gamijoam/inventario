import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
    Plus, Search, Package, X, Trash2, Pencil, RefreshCw,
    MoreHorizontal, ChevronDown, Barcode, ArrowUpAZ, ArrowDownAZ,
    TrendingUp, TrendingDown, Download, Upload, FileSpreadsheet,
    FileText, SlidersHorizontal, Boxes, AlertTriangle, Ban,
    Zap, Tag, Wrench, Layers, CircleDollarSign, History, PackagePlus, Save
} from 'lucide-react';
import SearchWithScanner from '../../../components/common/SearchWithScanner';
import CompactProductForm from '../../../components/products/CompactProductForm';
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
import { getApiErrorMessage } from '../../../utils/apiErrors';
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
    const num = Number(stock || 0);
    return num % 1 === 0 ? num.toFixed(0) : num.toFixed(3).replace(/\.?0+$/, '');
};

const formatMoney = (value) => `$${Number(value || 0).toFixed(2)}`;

const ProductTypeBadges = ({ product }) => {
    const badges = [
        product.is_service && { label: 'Servicio', className: 'border-sky-100 bg-sky-50 text-sky-700' },
        product.has_imei && { label: 'Serial', className: 'border-indigo-100 bg-indigo-50 text-indigo-700' },
        product.is_combo && { label: 'Combo', className: 'border-violet-100 bg-violet-50 text-violet-700' },
        product.is_commissionable && { label: 'Comision', className: 'border-emerald-100 bg-emerald-50 text-emerald-700' },
    ].filter(Boolean);

    if (!badges.length) return null;

    return (
        <div className="mt-1 flex flex-wrap gap-1">
            {badges.map(badge => (
                <span key={badge.label} className={cn('rounded-md border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide', badge.className)}>
                    {badge.label}
                </span>
            ))}
        </div>
    );
};

const getProductIssues = (product) => {
    const issues = [];
    if (!String(product.sku || '').trim()) {
        issues.push({ key: 'missing_sku', label: 'Sin SKU', className: 'border-amber-100 bg-amber-50 text-amber-700' });
    }
    if (Number(product.price || 0) <= 0) {
        issues.push({ key: 'zero_price', label: 'Precio 0', className: 'border-rose-100 bg-rose-50 text-rose-700' });
    }
    if (Array.isArray(product.prices) && product.prices.some(item => Number(item?.price || 0) <= 0)) {
        issues.push({ key: 'incomplete_prices', label: 'Lista pendiente', className: 'border-orange-100 bg-orange-50 text-orange-700' });
    }
    if (product.has_imei && Number(product.stock || 0) <= 0) {
        issues.push({ key: 'serial_without_stock', label: 'Serial sin stock', className: 'border-indigo-100 bg-indigo-50 text-indigo-700' });
    }
    return issues;
};

const ProductIssueBadges = ({ product, compact = false }) => {
    const issues = getProductIssues(product);
    if (!issues.length) return null;

    return (
        <div className={cn('flex flex-wrap gap-1', compact ? 'mt-1' : 'mt-1.5')}>
            {issues.slice(0, compact ? 2 : 3).map(issue => (
                <span key={issue.key} className={cn('inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide', issue.className)}>
                    <AlertTriangle size={10} />
                    {issue.label}
                </span>
            ))}
            {issues.length > (compact ? 2 : 3) && (
                <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-slate-500">
                    +{issues.length - (compact ? 2 : 3)}
                </span>
            )}
        </div>
    );
};

// Stock compacto del listado
const StockPill = ({ stock, minStock }) => {
    const total = Number(stock || 0);
    const configuredMin = Number(minStock);
    const min = Number.isFinite(configuredMin) && configuredMin > 0 ? configuredMin : 5;
    const isOut = total <= 0;
    const isLow = !isOut && total <= min;
    const visualTarget = Math.max(min * 4, 1);
    const ratio = Math.min(100, Math.max(6, (total / visualTarget) * 100));

    const cfg = isOut
        ? { label: 'Agotado', text: 'text-rose-600', bar: 'bg-rose-400', bg: 'bg-rose-50' }
        : isLow
        ? { label: 'Bajo', text: 'text-amber-700', bar: 'bg-amber-400', bg: 'bg-amber-50' }
        : { label: 'Disponible', text: 'text-emerald-700', bar: 'bg-emerald-500', bg: 'bg-emerald-50' };

    return (
        <div className="ml-auto w-[118px] text-right">
            <div className="flex items-baseline justify-end gap-1">
                <span className={cn('text-base font-black leading-none', cfg.text)}>{formatStock(total)}</span>
                <span className="text-[10px] font-bold text-slate-400">un.</span>
            </div>
            <div className={cn('mt-1 h-1.5 overflow-hidden rounded-full', cfg.bg)}>
                <div className={cn('h-full rounded-full', cfg.bar)} style={{ width: `${isOut ? 0 : ratio}%` }} />
            </div>
            <div className={cn('mt-1 text-[10px] font-black uppercase tracking-wide', cfg.text)}>{cfg.label}</div>
        </div>
    );
};


const QuickPriceModal = ({ product, priceLists, isOpen, onClose, onSave }) => {
    const [basePrice, setBasePrice] = useState('');
    const [listPrices, setListPrices] = useState({});
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!product || !isOpen) return;
        const prices = {};
        if (Array.isArray(product.prices)) {
            product.prices.forEach(item => {
                const listId = item.price_list_id || item.price_list?.id;
                if (listId) prices[listId] = Number(item.price || 0).toFixed(2);
            });
        }
        setBasePrice(Number(product.price || 0).toFixed(2));
        setListPrices(prices);
    }, [product, isOpen]);

    if (!isOpen || !product) return null;

    const submit = async () => {
        setSaving(true);
        try {
            const prices = Object.entries(listPrices)
                .map(([price_list_id, price]) => ({ price_list_id: Number(price_list_id), price: Number(price || 0) }))
                .filter(item => Number.isFinite(item.price_list_id) && item.price > 0);
            await onSave({ price: Number(basePrice || 0), prices });
            onClose();
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
            <div className="w-full max-w-xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                    <div>
                        <p className="text-xs font-black uppercase tracking-wide text-slate-400">Precios rapidos</p>
                        <h3 className="text-lg font-black text-slate-900">{product.name}</h3>
                    </div>
                    <button onClick={onClose} className="rounded-md px-3 py-2 text-sm font-bold text-slate-500 hover:bg-slate-50">Cerrar</button>
                </div>
                <div className="space-y-4 p-5">
                    <label className="block">
                        <span className="text-xs font-black uppercase tracking-wide text-slate-400">Precio de venta</span>
                        <div className="mt-1 flex h-12 items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 focus-within:border-emerald-400">
                            <span className="text-lg font-black text-emerald-700">$</span>
                            <input value={basePrice} onChange={e => setBasePrice(e.target.value)} type="number" min="0" step="0.01" className="h-full flex-1 bg-transparent text-lg font-black text-slate-900 outline-none" />
                        </div>
                    </label>
                    <div className="rounded-lg border border-slate-200">
                        <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
                            <span className="text-xs font-black uppercase tracking-wide text-slate-400">Listas de precio</span>
                            <span className="text-xs font-bold text-slate-400">{priceLists.length} configuradas</span>
                        </div>
                        <div className="max-h-64 divide-y divide-slate-100 overflow-auto">
                            {priceLists.length === 0 ? (
                                <div className="px-3 py-4 text-sm font-medium text-slate-400">No hay listas configuradas.</div>
                            ) : priceLists.map(list => (
                                <label key={list.id} className="grid grid-cols-[1fr_150px] items-center gap-3 px-3 py-2">
                                    <span className="min-w-0 truncate text-sm font-bold text-slate-700">{list.name}</span>
                                    <input
                                        value={listPrices[list.id] || ''}
                                        onChange={e => setListPrices(prev => ({ ...prev, [list.id]: e.target.value }))}
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        placeholder="0.00"
                                        className="h-9 rounded-md border border-slate-200 px-3 text-right text-sm font-black text-slate-800 outline-none focus:border-indigo-300"
                                    />
                                </label>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-4">
                    <button onClick={onClose} className="h-10 rounded-md px-4 text-sm font-bold text-slate-600 hover:bg-white">Cancelar</button>
                    <button onClick={submit} disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-md bg-indigo-600 px-4 text-sm font-black text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60">
                        <Save size={15} /> {saving ? 'Guardando...' : 'Guardar precios'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const StockAdjustModal = ({ product, warehouses, isOpen, onClose, onSave }) => {
    const [mode, setMode] = useState('add');
    const [warehouseId, setWarehouseId] = useState('');
    const [quantity, setQuantity] = useState('1');
    const [reason, setReason] = useState('Ajuste rapido de inventario');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        setMode('add');
        setWarehouseId(warehouses[0]?.id ? String(warehouses[0].id) : '');
        setQuantity('1');
        setReason('Ajuste rapido de inventario');
    }, [isOpen, warehouses]);

    if (!isOpen || !product) return null;

    const submit = async () => {
        setSaving(true);
        try {
            await onSave({ mode, warehouse_id: Number(warehouseId), quantity: Number(quantity || 0), reason });
            onClose();
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl">
                <div className="border-b border-slate-100 px-5 py-4">
                    <p className="text-xs font-black uppercase tracking-wide text-slate-400">Ajuste rapido de stock</p>
                    <h3 className="text-lg font-black text-slate-900">{product.name}</h3>
                    <p className="mt-1 text-sm font-medium text-slate-500">Stock actual: <span className="font-black text-slate-900">{formatStock(product.stock)} un.</span></p>
                </div>
                <div className="space-y-4 p-5">
                    <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1">
                        <button onClick={() => setMode('add')} className={cn('h-10 rounded-md text-sm font-black', mode === 'add' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500')}>Entrada</button>
                        <button onClick={() => setMode('remove')} className={cn('h-10 rounded-md text-sm font-black', mode === 'remove' ? 'bg-white text-rose-700 shadow-sm' : 'text-slate-500')}>Salida</button>
                    </div>
                    <label className="block">
                        <span className="text-xs font-black uppercase tracking-wide text-slate-400">Almacen</span>
                        <select value={warehouseId} onChange={e => setWarehouseId(e.target.value)} className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-indigo-300">
                            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                    </label>
                    <label className="block">
                        <span className="text-xs font-black uppercase tracking-wide text-slate-400">Cantidad</span>
                        <input value={quantity} onChange={e => setQuantity(e.target.value)} type="number" min="0.001" step="0.001" className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm font-black text-slate-800 outline-none focus:border-indigo-300" />
                    </label>
                    <label className="block">
                        <span className="text-xs font-black uppercase tracking-wide text-slate-400">Motivo</span>
                        <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:border-indigo-300" />
                    </label>
                </div>
                <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-4">
                    <button onClick={onClose} className="h-10 rounded-md px-4 text-sm font-bold text-slate-600 hover:bg-white">Cancelar</button>
                    <button onClick={submit} disabled={saving || !warehouseId || Number(quantity || 0) <= 0} className="inline-flex h-10 items-center gap-2 rounded-md bg-indigo-600 px-4 text-sm font-black text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60">
                        <PackagePlus size={15} /> {saving ? 'Aplicando...' : 'Aplicar ajuste'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const QuickKardexModal = ({ product, isOpen, onClose }) => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!isOpen || !product) return;
        let alive = true;
        setLoading(true);
        apiClient.get('/inventory/kardex', { params: { product_id: product.id, limit: 20 } })
            .then(res => { if (alive) setItems(res.data || []); })
            .catch(err => toast.error(getApiErrorMessage(err, 'No se pudo cargar el Kardex del producto')))
            .finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, [isOpen, product]);

    if (!isOpen || !product) return null;

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
            <div className="w-full max-w-2xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                    <div>
                        <p className="text-xs font-black uppercase tracking-wide text-slate-400">Kardex del producto</p>
                        <h3 className="text-lg font-black text-slate-900">{product.name}</h3>
                    </div>
                    <button onClick={onClose} className="rounded-md px-3 py-2 text-sm font-bold text-slate-500 hover:bg-slate-50">Cerrar</button>
                </div>
                <div className="max-h-[480px] overflow-auto p-5">
                    {loading ? (
                        <div className="py-10 text-center text-sm font-bold text-slate-400">Cargando movimientos...</div>
                    ) : items.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 py-10 text-center text-sm font-bold text-slate-400">Sin movimientos recientes.</div>
                    ) : (
                        <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                            {items.map(item => {
                                const qty = Number(item.quantity || 0);
                                const isOut = qty < 0;
                                return (
                                    <div key={item.id} className="grid grid-cols-[1fr_auto] gap-3 px-4 py-3">
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className={cn('rounded-md px-2 py-1 text-xs font-black', isOut ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700')}>
                                                    {item.movement_type}
                                                </span>
                                                <span className="text-xs font-bold text-slate-400">{new Date(item.date).toLocaleString('es-VE')}</span>
                                            </div>
                                            <p className="mt-1 truncate text-sm font-medium text-slate-600">{item.description || 'Sin descripcion'}</p>
                                        </div>
                                        <div className="text-right">
                                            <div className={cn('text-base font-black', isOut ? 'text-rose-600' : 'text-emerald-700')}>{qty > 0 ? '+' : ''}{formatStock(qty)}</div>
                                            <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Saldo {formatStock(item.balance_after)}</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
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

    const [selectedProduct, setSelectedProduct] = useState(null);
    const [isQuickModalOpen, setIsQuickModalOpen] = useState(false);
    const [isCompactModalOpen, setIsCompactModalOpen] = useState(false);
    const [isInstancesModalOpen, setIsInstancesModalOpen] = useState(false);
    const [selectedProductForInstances, setSelectedProductForInstances] = useState(null);
    const [quickPriceProduct, setQuickPriceProduct] = useState(null);
    const [stockAdjustProduct, setStockAdjustProduct] = useState(null);
    const [quickKardexProduct, setQuickKardexProduct] = useState(null);
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
    const [priceLists, setPriceLists]     = useState([]);
    const [filterCategory, setFilterCategory] = useState('');
    const [filterWarehouse, setFilterWarehouse] = useState('');
    const [filterStock, setFilterStock]   = useState('');
    const [sortBy, setSortBy]             = useState('');
    const [filterType, setFilterType]     = useState('');
    const [filterIssue, setFilterIssue]   = useState('');
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
            } else {
                toast.error(getApiErrorMessage(res.reason, 'No se pudo cargar el catalogo de productos'));
                setProducts([]);
                setFilteredTotal(0);
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
        } catch (e) {
            toast.error(getApiErrorMessage(e, 'No se pudo cargar el catalogo de productos'));
        }
        finally { setIsLoading(false); }
    };

    const handleDelete = async (product) => {
        if (!window.confirm(`¿Eliminar "${product.name}"?`)) return;
        try {
            await apiClient.delete(`/products/${product.id}`);
            toast.success('Producto eliminado');
        } catch (e) { toast.error(getApiErrorMessage(e, 'No se pudo eliminar el producto')); }
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
                const [c, e, w, pl] = await Promise.all([
                    apiClient.get('/categories'),
                    apiClient.get('/config/exchange-rates', { params: { is_active: true } }),
                    apiClient.get('/warehouses'),
                    apiClient.get('/price-lists/'),
                ]);
                setCategories(c.data); setExchangeRates(e.data); setWarehouses(w.data); setPriceLists(pl.data || []);
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
    }, [searchTerm, filterCategory, filterWarehouse, filterStock, filterType, filterIssue]);

    const filteredProducts = useMemo(() => {
        // Category, stock and search run in the backend. Smart filters run locally over the current page.
        let r = [...products];

        if (filterType === 'serial') r = r.filter(p => p.has_imei);
        else if (filterType === 'service') r = r.filter(p => p.is_service);
        else if (filterType === 'combo') r = r.filter(p => p.is_combo);
        else if (filterType === 'physical') r = r.filter(p => !p.has_imei && !p.is_service && !p.is_combo);

        if (filterIssue) {
            r = r.filter(p => getProductIssues(p).some(issue => issue.key === filterIssue));
        }

        if (sortBy === 'az') r = r.sort((a, b) => a.name.localeCompare(b.name));
        else if (sortBy === 'za') r = r.sort((a, b) => b.name.localeCompare(a.name));
        else if (sortBy === 'price_asc') r = r.sort((a, b) => Number(a.price) - Number(b.price));
        else if (sortBy === 'price_desc') r = r.sort((a, b) => Number(b.price) - Number(a.price));
        else if (sortBy === 'issues') r = r.sort((a, b) => getProductIssues(b).length - getProductIssues(a).length);
        return r;
    }, [products, sortBy, filterType, filterIssue]);

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
        issues: 'Mas alertas',
    };
    const typeLabels = {
        physical: 'Producto fisico',
        serial: 'Serial / IMEI',
        service: 'Servicio',
        combo: 'Combo',
    };
    const issueLabels = {
        missing_sku: 'Sin SKU',
        zero_price: 'Precio en cero',
        incomplete_prices: 'Listas pendientes',
        serial_without_stock: 'Serial sin stock',
    };
    const activeFilters = [
        searchTerm?.trim() && `Búsqueda: ${searchTerm.trim()}`,
        filterCategory && `Categoría: ${categories.find(c => String(c.id) === String(filterCategory))?.name || filterCategory}`,
        filterWarehouse && `Almacén: ${warehouses.find(w => String(w.id) === String(filterWarehouse))?.name || filterWarehouse}`,
        filterStock && stockLabels[filterStock],
        filterType && `Tipo: ${typeLabels[filterType]}`,
        filterIssue && `Alerta: ${issueLabels[filterIssue]}`,
        sortBy && sortLabels[sortBy],
    ].filter(Boolean);
    const hasFilters = filterCategory || filterWarehouse || filterStock || filterType || filterIssue || sortBy;
    const hasActiveConstraints = activeFilters.length > 0;
    const clearAllFilters = () => {
        setSearchTerm('');
        setFilterCategory('');
        setFilterWarehouse('');
        setFilterStock('');
        setFilterType('');
        setFilterIssue('');
        setSortBy('');
    };

    const handleQuickPriceSave = async (payload) => {
        try {
            await apiClient.put(`/products/${quickPriceProduct.id}`, payload);
            toast.success('Precios actualizados');
            await fetchProducts();
        } catch (e) {
            toast.error(getApiErrorMessage(e, 'No se pudieron actualizar los precios'));
            throw e;
        }
    };

    const handleStockAdjustSave = async ({ mode, warehouse_id, quantity, reason }) => {
        try {
            const endpoint = mode === 'add' ? '/inventory/add' : '/inventory/remove';
            await apiClient.post(endpoint, {
                product_id: stockAdjustProduct.id,
                warehouse_id,
                quantity,
                reason,
                type: mode === 'add' ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT',
            });
            toast.success('Stock ajustado');
            await fetchProducts();
        } catch (e) {
            toast.error(getApiErrorMessage(e, 'No se pudo ajustar el stock'));
            throw e;
        }
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
                                    ? 'border-indigo-600 bg-indigo-600 text-white'
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
                                onClick={() => { setSelectedProduct(null); setIsCompactModalOpen(true); }}
                                className="inline-flex h-10 items-center gap-2 rounded-md bg-indigo-600 px-4 text-sm font-bold text-white shadow-sm shadow-indigo-100 transition-colors hover:bg-indigo-700"
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
                <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                    <div className="grid gap-3 xl:grid-cols-[1.1fr_1.4fr_1fr]">
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                            <label className="flex min-w-[190px] flex-col gap-1 text-xs font-bold uppercase tracking-wide text-slate-400">
                                Categoria
                                <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="h-9 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-medium normal-case tracking-normal text-slate-700 focus:border-slate-400 focus:outline-none">
                                    <option value="">Todas</option>
                                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </label>

                            <label className="flex min-w-[190px] flex-col gap-1 text-xs font-bold uppercase tracking-wide text-slate-400">
                                Almacen
                                <select value={filterWarehouse} onChange={e => setFilterWarehouse(e.target.value)} className="h-9 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-medium normal-case tracking-normal text-slate-700 focus:border-slate-400 focus:outline-none">
                                    <option value="">Todos</option>
                                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                </select>
                            </label>
                        </div>

                        <div className="space-y-3 rounded-lg border border-slate-100 bg-slate-50/70 p-3">
                            <div>
                                <span className="text-xs font-black uppercase tracking-wide text-slate-400">Tipo de producto</span>
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                    {[
                                        { val: '', label: 'Todos', icon: Package },
                                        { val: 'physical', label: 'Fisicos', icon: Boxes },
                                        { val: 'serial', label: 'Serial/IMEI', icon: Barcode },
                                        { val: 'service', label: 'Servicios', icon: Wrench },
                                        { val: 'combo', label: 'Combos', icon: Layers },
                                    ].map(({ val, label, icon: Icon }) => (
                                        <button
                                            key={val || 'all-types'}
                                            onClick={() => setFilterType(val)}
                                            className={cn(
                                                'inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-black transition-colors',
                                                filterType === val
                                                    ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm'
                                                    : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700'
                                            )}
                                        >
                                            <Icon size={13} /> {label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <span className="text-xs font-black uppercase tracking-wide text-slate-400">Diagnostico</span>
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                    {[
                                        { val: '', label: 'Sin filtro', icon: SlidersHorizontal },
                                        { val: 'missing_sku', label: 'Sin SKU', icon: AlertTriangle },
                                        { val: 'zero_price', label: 'Precio 0', icon: CircleDollarSign },
                                        { val: 'incomplete_prices', label: 'Listas pendientes', icon: Tag },
                                        { val: 'serial_without_stock', label: 'Serial sin stock', icon: Barcode },
                                    ].map(({ val, label, icon: Icon }) => (
                                        <button
                                            key={val || 'all-issues'}
                                            onClick={() => setFilterIssue(val)}
                                            className={cn(
                                                'inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-black transition-colors',
                                                filterIssue === val
                                                    ? 'border-amber-500 bg-amber-50 text-amber-800 shadow-sm'
                                                    : 'border-slate-200 bg-white text-slate-600 hover:border-amber-200 hover:bg-amber-50 hover:text-amber-700'
                                            )}
                                        >
                                            <Icon size={13} /> {label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
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
                                    <option value="issues">Mas alertas primero</option>
                                    <option value="az">Nombre A-Z</option>
                                    <option value="za">Nombre Z-A</option>
                                    <option value="price_asc">Precio menor primero</option>
                                    <option value="price_desc">Precio mayor primero</option>
                                </select>
                            </label>
                        </div>
                    </div>
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
                        onEdit={p => { setSelectedProduct(p); setIsCompactModalOpen(true); }}
                        onDelete={handleDelete}
                        onCategoryClick={id => setFilterCategory(id.toString())}
                    />
                ))}
            </div>
            {/* Tabla Desktop */}
            <div className="hidden overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm md:block">
                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-4 py-3">
                    <div>
                        <p className="text-xs font-black uppercase tracking-wide text-slate-400">Catalogo</p>
                        <p className="text-sm font-bold text-slate-700">Productos listos para venta, inventario y edicion rapida</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                        <span className="rounded-md bg-white px-2.5 py-1 shadow-sm">{filteredProducts.length} en vista</span>
                        {hasActiveConstraints && <span className="rounded-md bg-indigo-50 px-2.5 py-1 text-indigo-700">Filtrado</span>}
                    </div>
                </div>
                <table className="w-full table-fixed text-sm">
                    <thead>
                        <tr className="border-b border-slate-200 bg-white">
                            <th className="w-[46%] px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-400">Producto</th>
                            <th className="w-[18%] px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-400">Categoria</th>
                            <th className="w-[18%] px-4 py-3 text-right text-xs font-black uppercase tracking-wide text-slate-400">Precio</th>
                            <th className="w-[12%] px-4 py-3 text-right text-xs font-black uppercase tracking-wide text-slate-400">Stock</th>
                            <th className="w-[6%] px-3 py-3" />
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {isLoading ? (
                            <tr><td colSpan={5} className="py-16 text-center">
                                <div className="flex items-center justify-center gap-2 text-slate-400">
                                    <RefreshCw size={16} className="animate-spin" /> Cargando productos...
                                </div>
                            </td></tr>
                        ) : filteredProducts.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="py-16 text-center">
                                    <div className="mx-auto max-w-sm rounded-lg border border-dashed border-slate-200 bg-slate-50 px-6 py-8">
                                        <Package size={28} className="mx-auto mb-3 text-slate-300" />
                                        <p className="font-black text-slate-700">No se encontraron productos</p>
                                        <p className="mt-1 text-xs font-medium text-slate-400">Prueba limpiar filtros o buscar por otro SKU.</p>
                                    </div>
                                </td>
                            </tr>
                        ) : filteredProducts.map(product => (
                            <tr key={product.id} className="group transition-colors hover:bg-slate-50/80">
                                <td className="px-4 py-3 align-middle">
                                    <div className="flex min-w-0 items-center gap-3">
                                        <ProductThumbnail
                                            imageUrl={product.image_url}
                                            productName={product.name}
                                            size="sm"
                                            className="h-11 w-11 flex-shrink-0 rounded-lg border border-slate-100 bg-slate-50 object-cover shadow-sm transition-transform group-hover:scale-[1.03]"
                                        />
                                        <div className="min-w-0">
                                            <button
                                                type="button"
                                                onClick={() => { setSelectedProduct(product); setIsCompactModalOpen(true); }}
                                                className="line-clamp-1 text-left text-sm font-black leading-tight text-slate-900 transition-colors hover:text-indigo-700"
                                            >
                                                {product.name}
                                            </button>
                                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                                <span className="rounded-md border border-slate-100 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                                    {product.sku || 'Sin SKU'}
                                                </span>
                                                {Array.isArray(product.prices) && product.prices.length > 0 && (
                                                    <span className="rounded-md border border-indigo-100 bg-indigo-50 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-indigo-600">
                                                        {product.prices.length} lista{product.prices.length === 1 ? '' : 's'}
                                                    </span>
                                                )}
                                            </div>
                                            <ProductTypeBadges product={product} />
                                            <ProductIssueBadges product={product} />
                                        </div>
                                    </div>
                                </td>

                                <td className="px-4 py-3 align-middle">
                                    {product.category?.name ? (
                                        <button
                                            onClick={() => setFilterCategory(product.category_id.toString())}
                                            className="max-w-full truncate rounded-md bg-slate-100 px-2.5 py-1.5 text-xs font-bold text-slate-600 transition-colors hover:bg-indigo-50 hover:text-indigo-700"
                                            title={product.category.name}
                                        >
                                            {product.category.name}
                                        </button>
                                    ) : (
                                        <span className="text-[11px] italic text-slate-300">Sin categoria</span>
                                    )}
                                </td>

                                <td className="px-4 py-3 text-right align-middle">
                                    <div className="text-base font-black leading-tight text-slate-900">{formatMoney(product.price)}</div>
                                    {convertProductPrice && (
                                        <div className="mt-0.5 text-[11px] font-bold text-slate-400">
                                            Bs {Number(convertProductPrice(product, 'VES') || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </div>
                                    )}
                                    {showPriceList && Array.isArray(product.prices) && product.prices.length > 0 && (
                                        <div className="mt-1 flex flex-col items-end gap-0.5">
                                            {product.prices.slice(0, 2).map((priceItem, idx) => (
                                                <div key={priceItem.id ?? `${priceItem.price_list_id ?? 'list'}-${idx}`} className="max-w-[150px] truncate text-[11px] font-bold text-slate-500">
                                                    <span className="text-slate-400">{priceItem.price_list?.name || 'Lista'}:</span>{' '}
                                                    <span className="text-indigo-700">{formatMoney(priceItem.price)}</span>
                                                </div>
                                            ))}
                                            {product.prices.length > 2 && (
                                                <div className="text-[10px] font-black uppercase tracking-wide text-slate-400">+{product.prices.length - 2} mas</div>
                                            )}
                                        </div>
                                    )}
                                </td>

                                <td className="px-4 py-3 align-middle">
                                    <StockPill stock={product.stock} minStock={product.min_stock} />
                                </td>

                                <td className="px-3 py-3 text-right align-middle">
                                    {isAdmin && (
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <button className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700" title="Acciones del producto">
                                                    <MoreHorizontal size={17} />
                                                </button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="min-w-[190px] rounded-lg border-slate-100 shadow-xl">
                                                <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-slate-400">Opciones</DropdownMenuLabel>
                                                <DropdownMenuItem
                                                    onClick={() => { setSelectedProduct(product); setIsCompactModalOpen(true); }}
                                                    className="cursor-pointer rounded-md font-bold"
                                                >
                                                    <Pencil size={14} className="mr-2 text-indigo-500" /> Editar producto
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    onClick={() => setQuickPriceProduct(product)}
                                                    className="cursor-pointer rounded-md font-medium text-slate-700"
                                                >
                                                    <CircleDollarSign size={14} className="mr-2 text-emerald-500" /> Precios rapidos
                                                </DropdownMenuItem>
                                                {!product.has_imei && !product.is_service && (
                                                    <DropdownMenuItem
                                                        onClick={() => setStockAdjustProduct(product)}
                                                        className="cursor-pointer rounded-md font-medium text-slate-700"
                                                    >
                                                        <PackagePlus size={14} className="mr-2 text-amber-500" /> Ajustar stock
                                                    </DropdownMenuItem>
                                                )}
                                                <DropdownMenuItem
                                                    onClick={() => setQuickKardexProduct(product)}
                                                    className="cursor-pointer rounded-md font-medium text-slate-700"
                                                >
                                                    <History size={14} className="mr-2 text-slate-500" /> Ver Kardex
                                                </DropdownMenuItem>
                                                {product.has_imei && (
                                                    <DropdownMenuItem
                                                        onClick={() => { setSelectedProductForInstances(product); setIsInstancesModalOpen(true); }}
                                                        className="cursor-pointer rounded-md font-medium text-slate-700"
                                                    >
                                                        <Search size={14} className="mr-2 text-indigo-400" /> Ver Seriales / IMEIs
                                                    </DropdownMenuItem>
                                                )}
                                                {user?.role === 'ADMIN' && (
                                                    <>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem
                                                            onClick={() => handleDelete(product)}
                                                            className="cursor-pointer rounded-md font-bold text-rose-600 hover:text-rose-700 focus:bg-rose-50"
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
            <QuickPriceModal
                isOpen={!!quickPriceProduct}
                product={quickPriceProduct}
                priceLists={priceLists}
                onClose={() => setQuickPriceProduct(null)}
                onSave={handleQuickPriceSave}
            />
            <StockAdjustModal
                isOpen={!!stockAdjustProduct}
                product={stockAdjustProduct}
                warehouses={warehouses}
                onClose={() => setStockAdjustProduct(null)}
                onSave={handleStockAdjustSave}
            />
            <QuickKardexModal
                isOpen={!!quickKardexProduct}
                product={quickKardexProduct}
                onClose={() => setQuickKardexProduct(null)}
            />
            <ProductInstancesModal
                isOpen={isInstancesModalOpen}
                onClose={() => { setIsInstancesModalOpen(false); setSelectedProductForInstances(null); }}
                product={selectedProductForInstances}
            />
            <CompactProductForm
                isOpen={isCompactModalOpen}
                onClose={() => { setIsCompactModalOpen(false); setSelectedProduct(null); }}
                initialData={selectedProduct}
                categories={categories}
                warehouses={warehouses}
                exchangeRates={exchangeRates}
                onSubmit={async (data) => {
                    try {
                        if (selectedProduct) {
                            await apiClient.put(`/products/${selectedProduct.id}`, data);
                            toast.success('Producto actualizado');
                        } else {
                            await apiClient.post('/products/', data);
                            toast.success('Producto creado');
                        }
                        await fetchProducts();
                        setIsCompactModalOpen(false);
                        setSelectedProduct(null);
                    } catch (e) {
                        throw e;
                    }
                }}
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
