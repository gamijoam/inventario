import React, { useState, useEffect, useCallback } from 'react';
import { Package, ClipboardList, BookOpen, AlertTriangle, ChevronDown, ChevronUp, RefreshCw, Search, Plus } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { getLots, createLot, getAlerts } from '../../services/pharmacyService';
import apiClient from '../../config/axios';

// --- Helpers ---
const today = () => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};

const daysUntilExpiry = (expiryDateStr) => {
    if (!expiryDateStr) return null;
    const exp = new Date(expiryDateStr);
    const now = today();
    return Math.floor((exp - now) / (1000 * 60 * 60 * 24));
};

const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
        return new Date(dateStr + 'T00:00:00').toLocaleDateString('es-VE', {
            day: '2-digit', month: '2-digit', year: 'numeric'
        });
    } catch {
        return dateStr;
    }
};

// Row color based on days remaining
const getRowClass = (days) => {
    if (days === null) return '';
    if (days < 0) return 'bg-red-50 border-l-4 border-red-500';
    if (days <= 30) return 'bg-red-50 border-l-4 border-orange-400';
    if (days <= 90) return 'bg-yellow-50 border-l-4 border-yellow-400';
    return 'bg-green-50/40';
};

const getStatusBadge = (days) => {
    if (days === null) return null;
    if (days < 0) return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">Vencido</span>;
    if (days === 0) return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">Vence hoy</span>;
    if (days <= 30) return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-700">{days}d</span>;
    if (days <= 90) return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700">{days}d</span>;
    return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">{days}d</span>;
};

// --- Alert Card ---
const AlertCard = ({ label, count, color, icon: Icon }) => (
    <div className={`bg-white rounded-2xl shadow-sm border p-5 flex items-center gap-4 ${color.border}`}>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color.bg}`}>
            <Icon size={24} className={color.icon} />
        </div>
        <div>
            <p className="text-2xl font-black text-slate-800">{count ?? '—'}</p>
            <p className="text-sm font-semibold text-slate-500">{label}</p>
        </div>
    </div>
);

// --- Receive Stock Form (collapsible) ---
const ReceiveStockForm = ({ onSuccess }) => {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [products, setProducts] = useState([]);
    const [productSearch, setProductSearch] = useState('');
    const [showProductDropdown, setShowProductDropdown] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [form, setForm] = useState({
        lot_number: '',
        expiry_date: '',
        quantity: '',
        supplier: '',
        notes: '',
    });

    // Load products for autocomplete
    useEffect(() => {
        if (!open) return;
        apiClient.get('/products', { params: { limit: 500 } })
            .then(res => setProducts(res.data.items || res.data || []))
            .catch(() => {});
    }, [open]);

    const filteredProducts = products.filter(p =>
        p.name?.toLowerCase().includes(productSearch.toLowerCase()) ||
        p.sku?.toLowerCase().includes(productSearch.toLowerCase())
    ).slice(0, 10);

    const handleSelectProduct = (p) => {
        setSelectedProduct(p);
        setProductSearch(p.name);
        setShowProductDropdown(false);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedProduct) {
            toast.error('Selecciona un producto');
            return;
        }
        if (!form.lot_number.trim()) {
            toast.error('Ingresa el número de lote');
            return;
        }
        if (!form.expiry_date) {
            toast.error('Ingresa la fecha de vencimiento');
            return;
        }
        if (!form.quantity || Number(form.quantity) <= 0) {
            toast.error('Ingresa una cantidad válida');
            return;
        }

        setLoading(true);
        try {
            await createLot({
                product_id: selectedProduct.id,
                lot_number: form.lot_number.trim(),
                expiry_date: form.expiry_date,
                quantity: Number(form.quantity),
                supplier: form.supplier.trim() || null,
                notes: form.notes.trim() || null,
            });
            toast.success('Lote registrado exitosamente');
            // Reset form
            setForm({ lot_number: '', expiry_date: '', quantity: '', supplier: '', notes: '' });
            setSelectedProduct(null);
            setProductSearch('');
            setOpen(false);
            if (onSuccess) onSuccess();
        } catch (err) {
            const detail = err.response?.data?.detail;
            toast.error(typeof detail === 'string' ? detail : 'Error al registrar lote');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <button
                onClick={() => setOpen(v => !v)}
                className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center">
                        <Plus size={18} className="text-indigo-600" />
                    </div>
                    <span className="font-bold text-slate-800">Recibir Stock / Nuevo Lote</span>
                </div>
                {open ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
            </button>

            {open && (
                <form onSubmit={handleSubmit} className="px-6 pb-6 border-t border-slate-100 pt-5 space-y-4">
                    {/* Product search */}
                    <div className="relative">
                        <label className="block text-xs font-bold text-slate-600 mb-1.5">Producto *</label>
                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                value={productSearch}
                                onChange={(e) => { setProductSearch(e.target.value); setShowProductDropdown(true); setSelectedProduct(null); }}
                                onFocus={() => setShowProductDropdown(true)}
                                placeholder="Buscar producto..."
                                className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
                            />
                        </div>
                        {showProductDropdown && filteredProducts.length > 0 && (
                            <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                                {filteredProducts.map(p => (
                                    <button
                                        key={p.id}
                                        type="button"
                                        onMouseDown={() => handleSelectProduct(p)}
                                        className="w-full text-left px-4 py-2.5 hover:bg-indigo-50 text-sm border-b border-slate-50 last:border-0"
                                    >
                                        <span className="font-semibold text-slate-800">{p.name}</span>
                                        {p.sku && <span className="ml-2 text-xs text-slate-400">({p.sku})</span>}
                                    </button>
                                ))}
                            </div>
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
                                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
                            />
                        </div>
                        {/* Quantity */}
                        <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1.5">Cantidad *</label>
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
                        {/* Supplier */}
                        <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1.5">Proveedor <span className="text-slate-400 font-normal">(opcional)</span></label>
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
                        <label className="block text-xs font-bold text-slate-600 mb-1.5">Notas <span className="text-slate-400 font-normal">(opcional)</span></label>
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
                            onClick={() => setOpen(false)}
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
            )}
        </div>
    );
};

// --- Main Dashboard ---
const FILTER_OPTIONS = [
    { key: 'all', label: 'Todos' },
    { key: 'expired', label: 'Vencidos' },
    { key: '30', label: '30 días' },
    { key: '90', label: '90 días' },
];

const PharmacyDashboard = () => {
    const [alerts, setAlerts] = useState(null);
    const [lots, setLots] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [alertsRes, lotsRes] = await Promise.all([
                getAlerts().catch(() => ({ data: null })),
                getLots({ limit: 500 }).catch(() => ({ data: [] })),
            ]);
            setAlerts(alertsRes.data);
            const rawLots = lotsRes.data?.items || lotsRes.data || [];
            setLots(rawLots);
        } catch (err) {
            toast.error('Error al cargar datos de farmacia');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    // Augment lots with computed days field
    const lotsWithDays = lots.map(lot => ({
        ...lot,
        daysRemaining: daysUntilExpiry(lot.expiry_date),
    }));

    const filteredLots = lotsWithDays.filter(lot => {
        const d = lot.daysRemaining;
        if (filter === 'expired') return d !== null && d < 0;
        if (filter === '30') return d !== null && d >= 0 && d <= 30;
        if (filter === '90') return d !== null && d > 30 && d <= 90;
        return true;
    });

    const alertCards = [
        {
            label: 'Vencidos',
            count: alerts?.expired?.length ?? lotsWithDays.filter(l => l.daysRemaining !== null && l.daysRemaining < 0).length,
            color: { border: 'border-red-200', bg: 'bg-red-100', icon: 'text-red-600' },
            icon: AlertTriangle,
        },
        {
            label: 'Vencen en 30 días',
            count: alerts?.expiring_30?.length ?? lotsWithDays.filter(l => l.daysRemaining !== null && l.daysRemaining >= 0 && l.daysRemaining <= 30).length,
            color: { border: 'border-orange-200', bg: 'bg-orange-100', icon: 'text-orange-600' },
            icon: AlertTriangle,
        },
        {
            label: 'Vencen en 90 días',
            count: alerts?.expiring_90?.length ?? lotsWithDays.filter(l => l.daysRemaining !== null && l.daysRemaining > 30 && l.daysRemaining <= 90).length,
            color: { border: 'border-yellow-200', bg: 'bg-yellow-100', icon: 'text-yellow-500' },
            icon: Package,
        },
        {
            label: 'Stock Bajo',
            count: alerts?.low_stock?.length ?? '—',
            color: { border: 'border-blue-200', bg: 'bg-blue-100', icon: 'text-blue-600' },
            icon: Package,
        },
    ];

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-teal-100 text-teal-600 rounded-2xl shadow-sm">
                        <Package size={32} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 tracking-tight">Dashboard Farmacia</h1>
                        <p className="text-slate-500 mt-0.5 font-medium">Control de lotes, vencimientos y stock</p>
                    </div>
                </div>
                <button
                    onClick={fetchData}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-colors disabled:opacity-60"
                >
                    <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                    Actualizar
                </button>
            </div>

            {/* Section A — Alert Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {alertCards.map((card, i) => (
                    <AlertCard key={i} {...card} />
                ))}
            </div>

            {/* Section B — Expiry Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <ClipboardList size={18} className="text-teal-600" />
                        <h2 className="font-bold text-slate-800">Tabla de Vencimientos</h2>
                        <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-mono">
                            {filteredLots.length} lotes
                        </span>
                    </div>
                    {/* Filter buttons */}
                    <div className="flex gap-1.5 flex-wrap">
                        {FILTER_OPTIONS.map(opt => (
                            <button
                                key={opt.key}
                                onClick={() => setFilter(opt.key)}
                                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    filter === opt.key
                                        ? 'bg-indigo-600 text-white shadow-sm'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <RefreshCw size={24} className="animate-spin text-slate-400" />
                    </div>
                ) : filteredLots.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                        <Package size={36} className="mb-3 opacity-40" />
                        <p className="font-semibold">No hay lotes para este filtro</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-100">
                                    <th className="text-left px-6 py-3 font-bold text-slate-600 text-xs uppercase tracking-wider">Producto</th>
                                    <th className="text-left px-4 py-3 font-bold text-slate-600 text-xs uppercase tracking-wider">Lote</th>
                                    <th className="text-left px-4 py-3 font-bold text-slate-600 text-xs uppercase tracking-wider">Fecha Venc.</th>
                                    <th className="text-center px-4 py-3 font-bold text-slate-600 text-xs uppercase tracking-wider">Días Rest.</th>
                                    <th className="text-right px-4 py-3 font-bold text-slate-600 text-xs uppercase tracking-wider">Cantidad</th>
                                    <th className="text-center px-6 py-3 font-bold text-slate-600 text-xs uppercase tracking-wider">Estado</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredLots.map((lot, i) => (
                                    <tr key={lot.id ?? i} className={`border-b border-slate-50 last:border-0 transition-colors ${getRowClass(lot.daysRemaining)}`}>
                                        <td className="px-6 py-3 font-semibold text-slate-800">
                                            {lot.product_name || lot.product?.name || '—'}
                                        </td>
                                        <td className="px-4 py-3 font-mono text-slate-600 text-xs">
                                            {lot.lot_number || '—'}
                                        </td>
                                        <td className="px-4 py-3 text-slate-600">
                                            {formatDate(lot.expiry_date)}
                                        </td>
                                        <td className="px-4 py-3 text-center font-mono font-bold text-slate-700">
                                            {lot.daysRemaining !== null
                                                ? (lot.daysRemaining < 0 ? `${Math.abs(lot.daysRemaining)}d atrás` : `${lot.daysRemaining}d`)
                                                : '—'
                                            }
                                        </td>
                                        <td className="px-4 py-3 text-right font-bold text-slate-800">
                                            {lot.quantity ?? lot.stock ?? '—'}
                                        </td>
                                        <td className="px-6 py-3 text-center">
                                            {getStatusBadge(lot.daysRemaining)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Section C — Receive Stock Form */}
            <ReceiveStockForm onSuccess={fetchData} />
        </div>
    );
};

export default PharmacyDashboard;
