import React, { useState, useEffect, useMemo } from 'react';
import {
    FileText, Calendar, User, DollarSign, ArrowRight, Trash2, Printer,
    RefreshCcw, AlertCircle, CheckCircle, Clock, Search, Edit, Zap,
    Copy, TrendingUp, Filter, Plus, MessageCircle
} from 'lucide-react';
import apiClient from '../../config/axios';
import { toast } from 'react-hot-toast';
import { useConfig } from '../../context/ConfigContext';
import { API_BASE_URL } from '../../config/constants';
import clsx from 'clsx';
import printerService from '../../services/printerService';
import { useFeatureFlag } from '../../hooks/useFeatureFlag';
import { printCotizacionA4 } from '../../components/pos/FacturaA4';

/* ── helpers ─────────────────────────────────────────────────────────────── */
const STATUS_CONFIG = {
    PENDING:   { label: 'Pendiente', color: 'bg-blue-100 text-blue-700',    dot: 'bg-blue-500',    icon: Clock },
    CONVERTED: { label: 'Facturada', color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500', icon: CheckCircle },
    EXPIRED:   { label: 'Vencida',   color: 'bg-rose-100 text-rose-700',    dot: 'bg-rose-500',    icon: AlertCircle },
};

const StatusBadge = ({ status }) => {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.PENDING;
    const Icon = cfg.icon;
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${cfg.color}`}>
            <Icon size={11} /> {cfg.label}
        </span>
    );
};

const StatCard = ({ label, value, sub, color = 'slate' }) => {
    const map = { slate: 'bg-slate-50 border-slate-200', blue: 'bg-blue-50 border-blue-200', emerald: 'bg-emerald-50 border-emerald-200', rose: 'bg-rose-50 border-rose-200', amber: 'bg-amber-50 border-amber-200' };
    const textMap = { slate: 'text-slate-800', blue: 'text-blue-700', emerald: 'text-emerald-700', rose: 'text-rose-700', amber: 'text-amber-700' };
    return (
        <div className={`border rounded-2xl p-4 ${map[color]}`}>
            <p className="text-xs font-semibold text-slate-500 mb-1">{label}</p>
            <p className={`text-xl font-black ${textMap[color]}`}>{value}</p>
            {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
        </div>
    );
};

/* ── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────── */
const QuoteList = ({ onCreateNew, onEdit }) => {
    const [quotes, setQuotes]         = useState([]);
    const [loading, setLoading]       = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [thermalMenuId, setThermalMenuId] = useState(null);
    const [sendingWa, setSendingWa] = useState(null);
    const [duplicating, setDuplicating] = useState(null);

    const { currencies, business } = useConfig();
    const anchorCurrency   = currencies.find(c => c.is_anchor) || { symbol: '$' };
    const facturaA4Active  = useFeatureFlag('impresion_factura_a4');

    useEffect(() => { fetchQuotes(); }, []);

    const fetchQuotes = async () => {
        setLoading(true);
        try {
            const { data } = await apiClient.get('/quotes', { params: { limit: 500 } });
            setQuotes((data.items || []).sort((a, b) => b.id - a.id));
        } catch { toast.error('Error al cargar cotizaciones'); }
        finally { setLoading(false); }
    };

    /* ── Stats ── */
    const stats = useMemo(() => {
        const pending   = quotes.filter(q => q.status === 'PENDING');
        const converted = quotes.filter(q => q.status === 'CONVERTED');
        const expired   = quotes.filter(q => q.status === 'EXPIRED');
        const pendingAmount = pending.reduce((s, q) => s + Number(q.total_amount || 0), 0);
        const convRate  = quotes.length > 0 ? Math.round((converted.length / quotes.length) * 100) : 0;
        return { total: quotes.length, pending: pending.length, converted: converted.length, expired: expired.length, pendingAmount, convRate };
    }, [quotes]);

    /* ── Filtrado ── */
    const filtered = useMemo(() => {
        let res = quotes;
        if (statusFilter !== 'ALL') res = res.filter(q => q.status === statusFilter);
        if (searchTerm) {
            const t = searchTerm.toLowerCase();
            res = res.filter(q =>
                String(q.id).includes(t) ||
                q.customer?.name?.toLowerCase().includes(t) ||
                q.customer?.id_number?.toLowerCase().includes(t)
            );
        }
        return res;
    }, [quotes, statusFilter, searchTerm]);

    /* ── Acciones ── */
    const handleDelete = async (id, e) => {
        e.stopPropagation();
        if (!window.confirm('¿Eliminar esta cotización?')) return;
        try {
            await apiClient.delete(`/quotes/${id}`);
            setQuotes(prev => prev.filter(q => q.id !== id));
            toast.success('Cotización eliminada');
        } catch { toast.error('No se pudo eliminar'); }
    };

    const handleSendWhatsApp = async (quote, e) => {
        e.stopPropagation();
        if (sendingWa === quote.id) return;
        setSendingWa(quote.id);
        try {
            const { data } = await apiClient.post(`/quotes/${quote.id}/send-whatsapp`);
            toast.success(data.message || '✅ Cotización enviada por WhatsApp');
        } catch (err) {
            const msg = err?.response?.data?.detail || err.message;
            toast.error('Error: ' + msg);
        } finally {
            setSendingWa(null);
        }
    };

    const handleDuplicate = async (quote, e) => {
        e.stopPropagation();
        setDuplicating(quote.id);
        try {
            const { data } = await apiClient.post(`/quotes/${quote.id}/duplicate`);
            toast.success(`Cotización #${data.id} creada como copia`);
            fetchQuotes();
        } catch { toast.error('Error al duplicar'); }
        finally { setDuplicating(null); }
    };

    const handleConvert = async (quote, e) => {
        e.stopPropagation();
        if (confirm(`¿Cargar cotización #${quote.id} en Caja para facturar?`)) {
            window.location.href = `/#/pos?quote_id=${quote.id}`;
        }
    };

    const handlePrint = async (partialQuote, e) => {
        e.stopPropagation();
        try {
            const t = toast.loading('Preparando impresión...');
            const { data: fullQuote } = await apiClient.get(`/quotes/${partialQuote.id}`);
            toast.dismiss(t);
            const items = fullQuote.details || fullQuote.items || [];
            if (!items.length) { toast.error('La cotización está vacía'); return; }
            if (facturaA4Active) { printCotizacionA4(fullQuote, business); return; }
            const win = window.open('', '_blank');
            if (!win) { toast.error('Permite pop-ups para imprimir'); return; }
            const rows = items.map(i => `<tr><td>${i.product?.name || 'Ítem'}</td><td style="text-align:center">${i.quantity}</td><td style="text-align:right">${anchorCurrency.symbol}${Number(i.unit_price).toFixed(2)}</td><td style="text-align:right">${anchorCurrency.symbol}${Number(i.subtotal).toFixed(2)}</td></tr>`).join('');
            win.document.write(`<!DOCTYPE html><html><head><title>Cotización #${fullQuote.id}</title><style>body{font-family:sans-serif;padding:20px}table{width:100%;border-collapse:collapse;margin-top:16px}th{background:#f1f5f9;padding:8px;text-align:left}td{padding:8px;border-bottom:1px solid #eee}.total{text-align:right;font-size:18px;font-weight:bold;margin-top:16px}@media print{.np{display:none}}</style></head><body><h2>Cotización #${fullQuote.id}</h2><p><strong>Cliente:</strong> ${fullQuote.customer?.name || 'General'} | <strong>Fecha:</strong> ${new Date(fullQuote.date).toLocaleDateString()}</p><table><thead><tr><th>Descripción</th><th>Cant.</th><th>Precio</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table><div class="total">Total: ${anchorCurrency.symbol}${Number(fullQuote.total_amount).toFixed(2)}</div><div class="np" style="margin-top:20px;text-align:center"><button onclick="window.print()" style="padding:10px 20px;cursor:pointer">Imprimir</button><button onclick="window.close()" style="padding:10px 20px;margin-left:10px;cursor:pointer">Cerrar</button></div><script>window.onload=function(){window.print()}<\/script></body></html>`);
            win.document.close();
        } catch { toast.error('Error al generar impresión'); }
    };

    const handleThermal = async (quote, width, e) => {
        e.stopPropagation(); setThermalMenuId(null);
        const t = toast.loading(`Enviando a térmica (${width}mm)...`);
        try {
            const { data: payload } = await apiClient.get(`/quotes/${quote.id}/print/thermal?width=${width}`);
            await printerService.printRaw(payload);
            toast.dismiss(t); toast.success(`Enviado (${width}mm)`);
        } catch (err) { toast.dismiss(t); toast.error(err.message || 'Bridge no conectado'); }
    };

    /* ── Loading ── */
    if (loading) return (
        <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-400">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-indigo-200 border-t-indigo-600" />
            <p className="text-sm font-medium animate-pulse">Cargando cotizaciones...</p>
        </div>
    );

    return (
        <div className="h-full flex flex-col">

            {/* ── Stats header ── */}
            <div className="p-4 border-b border-slate-100 bg-slate-50/40">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                    <StatCard label="Total"        value={stats.total}     sub="cotizaciones"          color="slate" />
                    <StatCard label="Pendientes"   value={stats.pending}   sub={`$${stats.pendingAmount.toFixed(0)} en espera`} color="blue" />
                    <StatCard label="Facturadas"   value={stats.converted} sub="convertidas a venta"   color="emerald" />
                    <StatCard label="Conversión"   value={`${stats.convRate}%`} sub={`${stats.expired} vencidas`} color={stats.convRate >= 50 ? 'emerald' : 'amber'} />
                </div>

                {/* Filtros + Búsqueda */}
                <div className="flex flex-col sm:flex-row gap-3">
                    {/* Pills de estado */}
                    <div className="flex gap-1.5 flex-wrap">
                        {[
                            { id: 'ALL',       label: 'Todas',     count: stats.total },
                            { id: 'PENDING',   label: 'Pendientes', count: stats.pending },
                            { id: 'CONVERTED', label: 'Facturadas', count: stats.converted },
                            { id: 'EXPIRED',   label: 'Vencidas',  count: stats.expired },
                        ].map(f => (
                            <button key={f.id} onClick={() => setStatusFilter(f.id)}
                                className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border',
                                    statusFilter === f.id
                                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                        : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300')}>
                                {f.label}
                                <span className={clsx('px-1.5 py-0.5 rounded-full text-[10px] font-black',
                                    statusFilter === f.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500')}>
                                    {f.count}
                                </span>
                            </button>
                        ))}
                    </div>

                    {/* Buscador + Botón Nueva Cotización */}
                    <div className="flex items-center gap-2 flex-1 sm:max-w-sm ml-auto">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
                            <input type="text" placeholder="Buscar por cliente o #..."
                                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        </div>
                        <button onClick={onCreateNew}
                            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-all shadow-sm whitespace-nowrap shrink-0">
                            <Plus size={15} /> Nueva
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Lista ── */}
            <div className="flex-1 overflow-y-auto p-4">
                {filtered.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3">
                        <div className="w-20 h-20 bg-slate-50 rounded-2xl flex items-center justify-center">
                            <FileText size={36} className="text-slate-300" />
                        </div>
                        <p className="font-bold text-slate-500 text-lg">
                            {quotes.length === 0 ? 'No hay cotizaciones aún' : 'Sin resultados'}
                        </p>
                        <p className="text-sm text-center max-w-xs">
                            {quotes.length === 0
                                ? 'Crea tu primera cotización para comenzar a presupuestar'
                                : 'Intenta con otro término o cambia el filtro de estado'}
                        </p>
                        {quotes.length === 0 && (
                            <button onClick={onCreateNew}
                                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold shadow-md shadow-indigo-200 hover:bg-indigo-700 transition-all mt-2">
                                <Plus size={16} /> Nueva Cotización
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
                        {filtered.map(quote => {
                            const cfg = STATUS_CONFIG[quote.status] || STATUS_CONFIG.PENDING;
                            const isExpired = quote.valid_until && new Date(quote.valid_until) < new Date() && quote.status === 'PENDING';

                            return (
                                <div key={quote.id}
                                    className="bg-white rounded-2xl border border-slate-200 hover:shadow-md hover:border-indigo-200 transition-all group overflow-hidden flex flex-col">

                                    {/* Línea de color por estado */}
                                    <div className={`h-1 w-full ${cfg.dot}`} />

                                    <div className="p-4 flex-1 flex flex-col gap-3">
                                        {/* Header */}
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <span className="text-xs text-slate-400 font-medium">#{quote.id}</span>
                                                <p className="font-black text-slate-800 leading-tight">
                                                    {quote.customer?.name || 'Cliente General'}
                                                </p>
                                            </div>
                                            <StatusBadge status={quote.status} />
                                        </div>

                                        {/* Info */}
                                        <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                                            <span className="flex items-center gap-1">
                                                <Calendar size={11} />
                                                {new Date(quote.date).toLocaleDateString('es-VE')}
                                            </span>
                                            <span className="bg-slate-100 px-2 py-0.5 rounded-full">
                                                {quote.details?.length || 0} ítems
                                            </span>
                                        </div>

                                        {/* Vencimiento si aplica */}
                                        {quote.valid_until && (
                                            <p className={clsx('text-xs font-semibold flex items-center gap-1',
                                                isExpired ? 'text-rose-500' : 'text-slate-400')}>
                                                <Clock size={11} />
                                                Vence: {new Date(quote.valid_until).toLocaleDateString('es-VE')}
                                                {isExpired && ' · Vencida'}
                                            </p>
                                        )}

                                        {/* Monto */}
                                        <div className="mt-auto pt-2 border-t border-slate-50">
                                            <p className="text-2xl font-black text-slate-900">
                                                {anchorCurrency.symbol}{Number(quote.total_amount).toFixed(2)}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Acciones */}
                                    <div className="bg-slate-50 px-4 py-2.5 border-t border-slate-100 flex items-center justify-between gap-1 group-hover:bg-indigo-50/30 transition-colors">
                                        <div className="flex gap-0.5">
                                            {/* Eliminar */}
                                            <button onClick={e => handleDelete(quote.id, e)} title="Eliminar"
                                                className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
                                                <Trash2 size={15} />
                                            </button>
                                            {/* Imprimir hoja */}
                                            <button onClick={e => handlePrint(quote, e)} title="Imprimir"
                                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                                                <Printer size={15} />
                                            </button>
                                            {/* Térmica */}
                                            <div className="relative">
                                                <button onClick={e => { e.stopPropagation(); setThermalMenuId(p => p === quote.id ? null : quote.id); }}
                                                    title="Impresora térmica"
                                                    className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors">
                                                    <Zap size={15} />
                                                </button>
                                                {thermalMenuId === quote.id && (
                                                    <div className="absolute bottom-full left-0 mb-1 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden w-24">
                                                        {['58','80'].map(w => (
                                                            <button key={w} onClick={e => handleThermal(quote, w, e)}
                                                                className="w-full text-left px-3 py-2 text-xs font-bold text-slate-700 hover:bg-amber-50 hover:text-amber-700 transition-colors flex items-center gap-1.5 border-b last:border-0 border-slate-100">
                                                                <Zap size={11} /> {w}mm
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            {/* Editar */}
                                            <button onClick={e => { e.stopPropagation(); onEdit?.(quote.id); }} title="Editar"
                                                className="p-1.5 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-colors">
                                                <Edit size={15} />
                                            </button>
                                            {/* WhatsApp */}
                                            <button onClick={e => handleSendWhatsApp(quote, e)}
                                                title="Enviar por WhatsApp (PDF)"
                                                disabled={sendingWa === quote.id}
                                                className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-40">
                                                {sendingWa === quote.id
                                                    ? <div className="w-[15px] h-[15px] border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"/>
                                                    : <MessageCircle size={15} />}
                                            </button>
                                            {/* Duplicar */}
                                            <button onClick={e => handleDuplicate(quote, e)} title="Duplicar cotización"
                                                disabled={duplicating === quote.id}
                                                className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors disabled:opacity-40">
                                                <Copy size={15} />
                                            </button>
                                        </div>

                                        {/* Convertir a venta */}
                                        {quote.status !== 'CONVERTED' && (
                                            <button onClick={e => handleConvert(quote, e)}
                                                className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 rounded-lg text-xs font-bold shadow-sm transition-all">
                                                Facturar <ArrowRight size={12} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default QuoteList;
