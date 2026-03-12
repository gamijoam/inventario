import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Package, AlertTriangle, Clock, CheckCircle, XCircle,
    RotateCcw, Search, RefreshCw, Plus, ChevronDown, X,
    Edit3, MoreVertical
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { getLots, createLot, updateLot } from '../../services/pharmacyService';
import apiClient from '../../config/axios';

// ─── Helpers ────────────────────────────────────────────────────────────────

const todayDate = () => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};

const daysUntilExpiry = (expiryDateStr) => {
    if (!expiryDateStr) return null;
    const exp = new Date(expiryDateStr + 'T00:00:00');
    const now = todayDate();
    return Math.floor((exp - now) / (1000 * 60 * 60 * 24));
};

const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
        return new Date(dateStr + 'T00:00:00').toLocaleDateString('es-VE', {
            day: '2-digit', month: '2-digit', year: 'numeric',
        });
    } catch {
        return dateStr;
    }
};

const todayISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// ─── Row / Badge Styling ────────────────────────────────────────────────────

const getRowClass = (lot) => {
    const d = lot.daysRemaining;
    const st = lot.status;
    if (st === 'EXPIRED' || (d !== null && d < 0)) return 'bg-red-50 border-l-4 border-red-500';
    if (st === 'RECALLED') return 'bg-orange-50 border-l-4 border-orange-400';
    if (st === 'QUARANTINE') return 'bg-purple-50 border-l-4 border-purple-400';
    if (d !== null && d <= 30) return 'bg-red-50 border-l-4 border-orange-400';
    if (d !== null && d <= 90) return 'bg-yellow-50 border-l-4 border-yellow-400';
    return '';
};

const DaysCell = ({ days }) => {
    if (days === null) return <span className="text-slate-400">—</span>;
    if (days < 0)
        return <span className="font-black text-red-600 text-xs">VENCIDO</span>;
    if (days === 0)
        return <span className="font-bold text-red-600 text-xs">Hoy</span>;
    if (days <= 30)
        return <span className="font-bold text-red-600">{days} días</span>;
    if (days <= 90)
        return <span className="font-bold text-amber-600">{days} días</span>;
    return <span className="font-semibold text-green-600">{days} días</span>;
};

const STATUS_BADGE = {
    ACTIVE: <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">Activo</span>,
    EXPIRED: <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">Vencido</span>,
    RECALLED: <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-700">Retirado</span>,
    QUARANTINE: <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-700">Cuarentena</span>,
};

const getStatusBadge = (status) =>
    STATUS_BADGE[status] ?? <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-500">{status}</span>;

// ─── Filter Tabs ─────────────────────────────────────────────────────────────

const FILTER_TABS = [
    { key: 'all', label: 'Todos' },
    { key: 'ACTIVE', label: 'Activos' },
    { key: 'expiring90', label: 'Por Vencer (≤90d)' },
    { key: 'EXPIRED', label: 'Vencidos' },
    { key: 'QUARANTINE', label: 'Cuarentena' },
    { key: 'RECALLED', label: 'Retirados' },
];

const PAGE_SIZE = 50;

// ─── Receive Stock Modal ─────────────────────────────────────────────────────

const ReceiveStockModal = ({ onClose, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [products, setProducts] = useState([]);
    const [productsLoading, setProductsLoading] = useState(false);
    const [productSearch, setProductSearch] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const searchDebounce = useRef(null);

    const [form, setForm] = useState({
        lot_number: '',
        expiry_date: '',
        quantity: '',
        received_date: todayISO(),
        supplier: '',
        notes: '',
    });

    // Product autocomplete — debounced search against catalog
    const searchProducts = useCallback(async (q) => {
        if (!q || q.length < 2) { setProducts([]); return; }
        setProductsLoading(true);
        try {
            const res = await apiClient.get('/products/catalog', { params: { search: q, limit: 20 } });
            setProducts(res.data?.items || res.data || []);
        } catch {
            // Fallback: search local products endpoint
            try {
                const res2 = await apiClient.get('/products', { params: { search: q, limit: 20 } });
                setProducts(res2.data?.items || res2.data || []);
            } catch {
                setProducts([]);
            }
        } finally {
            setProductsLoading(false);
        }
    }, []);

    const handleProductSearch = (e) => {
        const val = e.target.value;
        setProductSearch(val);
        setSelectedProduct(null);
        setShowDropdown(true);
        clearTimeout(searchDebounce.current);
        searchDebounce.current = setTimeout(() => searchProducts(val), 300);
    };

    const handleSelectProduct = (p) => {
        setSelectedProduct(p);
        setProductSearch(p.name || p.product_name || '');
        setShowDropdown(false);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedProduct) { toast.error('Selecciona un producto'); return; }
        if (!form.lot_number.trim()) { toast.error('Ingresa el número de lote'); return; }
        if (!form.expiry_date) { toast.error('Ingresa la fecha de vencimiento'); return; }
        if (!form.quantity || Number(form.quantity) <= 0) { toast.error('Ingresa una cantidad válida'); return; }

        setLoading(true);
        try {
            await createLot({
                product_id: selectedProduct.id,
                lot_number: form.lot_number.trim(),
                expiry_date: form.expiry_date,
                quantity: Number(form.quantity),
                received_date: form.received_date || null,
                supplier: form.supplier.trim() || null,
                notes: form.notes.trim() || null,
            });
            toast.success('Lote registrado exitosamente');
            onSuccess();
            onClose();
        } catch (err) {
            const detail = err.response?.data?.detail;
            toast.error(typeof detail === 'string' ? detail : 'Error al registrar lote');
        } finally {
            setLoading(false);
        }
    };

    // Close on backdrop click
    const handleBackdrop = (e) => {
        if (e.target === e.currentTarget) onClose();
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            onClick={handleBackdrop}
        >
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                {/* Modal Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center">
                            <Plus size={18} className="text-indigo-600" />
                        </div>
                        <h2 className="font-bold text-slate-800 text-lg">Recibir Stock / Nuevo Lote</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="px-6 pb-6 pt-5 space-y-4">
                    {/* Product search */}
                    <div className="relative">
                        <label className="block text-xs font-bold text-slate-600 mb-1.5">Producto *</label>
                        <div className="relative">
                            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                value={productSearch}
                                onChange={handleProductSearch}
                                onFocus={() => productSearch && setShowDropdown(true)}
                                onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                                placeholder="Buscar producto por nombre o SKU..."
                                className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
                            />
                            {productsLoading && (
                                <RefreshCw size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 animate-spin" />
                            )}
                        </div>
                        {showDropdown && products.length > 0 && (
                            <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                                {products.map(p => (
                                    <button
                                        key={p.id}
                                        type="button"
                                        onMouseDown={() => handleSelectProduct(p)}
                                        className="w-full text-left px-4 py-2.5 hover:bg-indigo-50 text-sm border-b border-slate-50 last:border-0"
                                    >
                                        <span className="font-semibold text-slate-800">{p.name || p.product_name}</span>
                                        {p.sku && <span className="ml-2 text-xs text-slate-400">({p.sku})</span>}
                                    </button>
                                ))}
                            </div>
                        )}
                        {selectedProduct && (
                            <p className="mt-1 text-xs text-green-600 font-semibold flex items-center gap-1">
                                <CheckCircle size={11} /> Seleccionado: {selectedProduct.name || selectedProduct.product_name}
                            </p>
                        )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Lot number */}
                        <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1.5">Número de Lote *</label>
                            <input
                                type="text"
                                name="lot_number"
                                value={form.lot_number}
                                onChange={handleChange}
                                placeholder="Ej: LOT-2025-001"
                                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
                            />
                        </div>
                        {/* Expiry date */}
                        <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1.5">Fecha de Vencimiento *</label>
                            <input
                                type="date"
                                name="expiry_date"
                                value={form.expiry_date}
                                onChange={handleChange}
                                min={todayISO()}
                                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
                            />
                        </div>
                        {/* Quantity */}
                        <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1.5">Cantidad Recibida *</label>
                            <input
                                type="number"
                                name="quantity"
                                value={form.quantity}
                                onChange={handleChange}
                                min="1"
                                placeholder="0"
                                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
                            />
                        </div>
                        {/* Received date */}
                        <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1.5">Fecha de Recepción</label>
                            <input
                                type="date"
                                name="received_date"
                                value={form.received_date}
                                onChange={handleChange}
                                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
                            />
                        </div>
                        {/* Supplier */}
                        <div className="sm:col-span-2">
                            <label className="block text-xs font-bold text-slate-600 mb-1.5">
                                Proveedor <span className="text-slate-400 font-normal">(opcional)</span>
                            </label>
                            <input
                                type="text"
                                name="supplier"
                                value={form.supplier}
                                onChange={handleChange}
                                placeholder="Nombre del proveedor"
                                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
                            />
                        </div>
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5">
                            Notas <span className="text-slate-400 font-normal">(opcional)</span>
                        </label>
                        <textarea
                            name="notes"
                            value={form.notes}
                            onChange={handleChange}
                            rows={2}
                            placeholder="Observaciones sobre el lote..."
                            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 resize-none"
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 transition-colors disabled:opacity-60 flex items-center gap-2"
                        >
                            {loading && <RefreshCw size={14} className="animate-spin" />}
                            Guardar Lote
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ─── Actions Dropdown ────────────────────────────────────────────────────────

const ActionsMenu = ({ lot, onStatusChange, onEditQty }) => {
    const [open, setOpen] = useState(false);
    const menuRef = useRef(null);
    const { status, daysRemaining } = lot;

    useEffect(() => {
        const handler = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const actions = [];

    if (status === 'ACTIVE' && daysRemaining !== null && daysRemaining < 0) {
        actions.push({
            label: 'Marcar Vencido',
            icon: <XCircle size={14} className="text-red-500" />,
            onClick: () => { onStatusChange(lot, 'EXPIRED'); setOpen(false); },
        });
    }
    if (status === 'ACTIVE') {
        actions.push({
            label: 'Poner en Cuarentena',
            icon: <AlertTriangle size={14} className="text-purple-500" />,
            onClick: () => { onStatusChange(lot, 'QUARANTINE'); setOpen(false); },
        });
        actions.push({
            label: 'Retirar (Recall)',
            icon: <AlertTriangle size={14} className="text-orange-500" />,
            onClick: () => { onStatusChange(lot, 'RECALLED'); setOpen(false); },
        });
    }
    if (status === 'QUARANTINE' || status === 'RECALLED') {
        actions.push({
            label: 'Reactivar',
            icon: <RotateCcw size={14} className="text-green-600" />,
            onClick: () => { onStatusChange(lot, 'ACTIVE'); setOpen(false); },
        });
    }
    actions.push({
        label: 'Editar Cantidad',
        icon: <Edit3 size={14} className="text-indigo-500" />,
        onClick: () => { onEditQty(lot); setOpen(false); },
    });

    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={() => setOpen(v => !v)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors"
                title="Acciones"
            >
                <MoreVertical size={16} />
            </button>
            {open && (
                <div className="absolute right-0 z-30 mt-1 w-52 bg-white border border-slate-200 rounded-xl shadow-lg py-1 animate-in fade-in duration-100">
                    {actions.map((a, i) => (
                        <button
                            key={i}
                            onClick={a.onClick}
                            className="w-full text-left flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                            {a.icon}
                            {a.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

// ─── Edit Quantity Modal ─────────────────────────────────────────────────────

const EditQtyModal = ({ lot, onClose, onSuccess }) => {
    const [qty, setQty] = useState(String(lot.quantity ?? lot.stock ?? ''));
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const n = Number(qty);
        if (isNaN(n) || n < 0) { toast.error('Cantidad inválida'); return; }
        setLoading(true);
        try {
            await updateLot(lot.id, { quantity: n });
            toast.success('Cantidad actualizada');
            onSuccess();
            onClose();
        } catch (err) {
            const detail = err.response?.data?.detail;
            toast.error(typeof detail === 'string' ? detail : 'Error al actualizar');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                    <h2 className="font-bold text-slate-800">Editar Cantidad</h2>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
                        <X size={16} />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
                    <p className="text-sm text-slate-600">
                        Lote <span className="font-mono font-bold text-slate-800">{lot.lot_number}</span> —{' '}
                        {lot.product_name || lot.product?.name || ''}
                    </p>
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5">Nueva Cantidad</label>
                        <input
                            type="number"
                            value={qty}
                            onChange={e => setQty(e.target.value)}
                            min="0"
                            autoFocus
                            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
                        />
                    </div>
                    <div className="flex justify-end gap-3">
                        <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-colors">
                            Cancelar
                        </button>
                        <button type="submit" disabled={loading} className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 transition-colors disabled:opacity-60 flex items-center gap-2">
                            {loading && <RefreshCw size={14} className="animate-spin" />}
                            Guardar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const LotsManager = () => {
    const [lots, setLots] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showReceiveModal, setShowReceiveModal] = useState(false);
    const [editQtyLot, setEditQtyLot] = useState(null);

    // Filters
    const [search, setSearch] = useState('');
    const [activeTab, setActiveTab] = useState('all');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    // Pagination
    const [page, setPage] = useState(1);

    const fetchLots = useCallback(async () => {
        setLoading(true);
        try {
            const res = await getLots({ limit: 1000 });
            const raw = res.data?.items || res.data || [];
            setLots(raw);
        } catch {
            toast.error('Error al cargar lotes');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchLots(); }, [fetchLots]);

    // Augment lots with computed days field
    const lotsWithDays = lots.map(lot => ({
        ...lot,
        daysRemaining: daysUntilExpiry(lot.expiry_date),
    }));

    // Apply all filters
    const filteredLots = lotsWithDays.filter(lot => {
        // Search filter
        if (search) {
            const q = search.toLowerCase();
            const name = (lot.product_name || lot.product?.name || '').toLowerCase();
            const num = (lot.lot_number || '').toLowerCase();
            if (!name.includes(q) && !num.includes(q)) return false;
        }

        // Status/tab filter
        if (activeTab === 'ACTIVE') {
            if (lot.status !== 'ACTIVE') return false;
        } else if (activeTab === 'expiring90') {
            if (lot.daysRemaining === null) return false;
            if (lot.daysRemaining < 0 || lot.daysRemaining > 90) return false;
            if (lot.status !== 'ACTIVE') return false;
        } else if (activeTab === 'EXPIRED') {
            if (lot.status !== 'EXPIRED' && !(lot.daysRemaining !== null && lot.daysRemaining < 0)) return false;
        } else if (activeTab === 'QUARANTINE') {
            if (lot.status !== 'QUARANTINE') return false;
        } else if (activeTab === 'RECALLED') {
            if (lot.status !== 'RECALLED') return false;
        }

        // Date range filter (by received_date)
        if (dateFrom && lot.received_date) {
            if (lot.received_date < dateFrom) return false;
        }
        if (dateTo && lot.received_date) {
            if (lot.received_date > dateTo) return false;
        }

        return true;
    });

    // Pagination
    const totalPages = Math.ceil(filteredLots.length / PAGE_SIZE);
    const visibleLots = filteredLots.slice(0, page * PAGE_SIZE);
    const hasMore = page * PAGE_SIZE < filteredLots.length;

    const handleStatusChange = async (lot, newStatus) => {
        try {
            await updateLot(lot.id, { status: newStatus });
            const labels = {
                EXPIRED: 'marcado como vencido',
                QUARANTINE: 'puesto en cuarentena',
                RECALLED: 'retirado',
                ACTIVE: 'reactivado',
            };
            toast.success(`Lote ${labels[newStatus] || 'actualizado'}`);
            fetchLots();
        } catch (err) {
            const detail = err.response?.data?.detail;
            toast.error(typeof detail === 'string' ? detail : 'Error al actualizar estado');
        }
    };

    const handleResetFilters = () => {
        setSearch('');
        setActiveTab('all');
        setDateFrom('');
        setDateTo('');
        setPage(1);
    };

    const hasActiveFilters = search || activeTab !== 'all' || dateFrom || dateTo;

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
            {/* ── Header ── */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-teal-100 text-teal-600 rounded-2xl shadow-sm">
                        <Package size={32} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 tracking-tight">Gestión de Lotes</h1>
                        <p className="text-slate-500 mt-0.5 font-medium">Control de vencimientos, cuarentenas y retiros</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={fetchLots}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-colors disabled:opacity-60"
                    >
                        <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                        Actualizar
                    </button>
                    <button
                        onClick={() => setShowReceiveModal(true)}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 transition-colors shadow-sm"
                    >
                        <Plus size={16} />
                        Recibir Stock
                    </button>
                </div>
            </div>

            {/* ── Filter Bar ── */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 space-y-4">
                {/* Search + date range */}
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => { setSearch(e.target.value); setPage(1); }}
                            placeholder="Buscar por lote o producto..."
                            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-xs font-semibold text-slate-500 whitespace-nowrap">Recibido desde</label>
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={e => { setDateFrom(e.target.value); setPage(1); }}
                            className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-xs font-semibold text-slate-500 whitespace-nowrap">hasta</label>
                        <input
                            type="date"
                            value={dateTo}
                            onChange={e => { setDateTo(e.target.value); setPage(1); }}
                            className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
                        />
                    </div>
                    {hasActiveFilters && (
                        <button
                            onClick={handleResetFilters}
                            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200 text-slate-500 text-sm hover:bg-slate-50 transition-colors whitespace-nowrap"
                        >
                            <X size={13} /> Limpiar
                        </button>
                    )}
                </div>

                {/* Status Tabs */}
                <div className="flex gap-1.5 flex-wrap">
                    {FILTER_TABS.map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => { setActiveTab(tab.key); setPage(1); }}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                activeTab === tab.key
                                    ? 'bg-indigo-600 text-white shadow-sm'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Lots Table ── */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Clock size={18} className="text-teal-600" />
                        <h2 className="font-bold text-slate-800">Lotes Registrados</h2>
                        <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-mono">
                            {filteredLots.length} lotes
                        </span>
                    </div>
                    {/* Legend */}
                    <div className="hidden sm:flex items-center gap-4 text-xs text-slate-500">
                        <span className="flex items-center gap-1.5">
                            <span className="w-3 h-3 rounded-sm bg-red-200 border border-red-400 inline-block" />
                            Vencido / ≤30d
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="w-3 h-3 rounded-sm bg-yellow-200 border border-yellow-400 inline-block" />
                            31–90d
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="w-3 h-3 rounded-sm bg-purple-200 border border-purple-400 inline-block" />
                            Cuarentena
                        </span>
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <RefreshCw size={28} className="animate-spin text-slate-300" />
                    </div>
                ) : filteredLots.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                        <Package size={40} className="mb-3 opacity-30" />
                        <p className="font-semibold text-slate-500">No hay lotes para este filtro</p>
                        {hasActiveFilters && (
                            <button onClick={handleResetFilters} className="mt-3 text-sm text-indigo-500 hover:underline">
                                Limpiar filtros
                            </button>
                        )}
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-100">
                                        <th className="text-left px-6 py-3 font-bold text-slate-600 text-xs uppercase tracking-wider">Producto</th>
                                        <th className="text-left px-4 py-3 font-bold text-slate-600 text-xs uppercase tracking-wider">Lote</th>
                                        <th className="text-left px-4 py-3 font-bold text-slate-600 text-xs uppercase tracking-wider">Vence</th>
                                        <th className="text-center px-4 py-3 font-bold text-slate-600 text-xs uppercase tracking-wider">Días Restantes</th>
                                        <th className="text-right px-4 py-3 font-bold text-slate-600 text-xs uppercase tracking-wider">Cantidad</th>
                                        <th className="text-center px-4 py-3 font-bold text-slate-600 text-xs uppercase tracking-wider">Estado</th>
                                        <th className="text-center px-4 py-3 font-bold text-slate-600 text-xs uppercase tracking-wider">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {visibleLots.map((lot, i) => (
                                        <tr
                                            key={lot.id ?? i}
                                            className={`border-b border-slate-50 last:border-0 transition-colors ${getRowClass(lot)}`}
                                        >
                                            <td className="px-6 py-3 font-semibold text-slate-800 max-w-[220px]">
                                                <span className="truncate block">{lot.product_name || lot.product?.name || '—'}</span>
                                            </td>
                                            <td className="px-4 py-3 font-mono text-slate-600 text-xs whitespace-nowrap">
                                                {lot.lot_number || '—'}
                                            </td>
                                            <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                                                {formatDate(lot.expiry_date)}
                                            </td>
                                            <td className="px-4 py-3 text-center font-mono">
                                                <DaysCell days={lot.daysRemaining} />
                                            </td>
                                            <td className="px-4 py-3 text-right font-bold text-slate-800">
                                                {lot.quantity ?? lot.stock ?? '—'}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                {getStatusBadge(lot.status)}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <ActionsMenu
                                                    lot={lot}
                                                    onStatusChange={handleStatusChange}
                                                    onEditQty={setEditQtyLot}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Load More */}
                        {hasMore && (
                            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
                                <p className="text-sm text-slate-500">
                                    Mostrando <span className="font-bold text-slate-700">{visibleLots.length}</span> de{' '}
                                    <span className="font-bold text-slate-700">{filteredLots.length}</span> lotes
                                </p>
                                <button
                                    onClick={() => setPage(p => p + 1)}
                                    className="flex items-center gap-2 px-5 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-colors"
                                >
                                    <ChevronDown size={15} />
                                    Cargar más
                                </button>
                            </div>
                        )}
                        {!hasMore && filteredLots.length > PAGE_SIZE && (
                            <div className="px-6 py-3 border-t border-slate-100 text-center text-xs text-slate-400">
                                Todos los lotes cargados ({filteredLots.length})
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* ── Modals ── */}
            {showReceiveModal && (
                <ReceiveStockModal
                    onClose={() => setShowReceiveModal(false)}
                    onSuccess={fetchLots}
                />
            )}
            {editQtyLot && (
                <EditQtyModal
                    lot={editQtyLot}
                    onClose={() => setEditQtyLot(null)}
                    onSuccess={fetchLots}
                />
            )}
        </div>
    );
};

export default LotsManager;
