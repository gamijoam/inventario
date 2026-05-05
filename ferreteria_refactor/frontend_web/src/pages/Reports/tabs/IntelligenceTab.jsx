import { useState, useEffect, useCallback } from 'react';
import apiClient from '../../../config/axios';
import { useConfig } from '../../../context/ConfigContext';
import { Flame, Snowflake, TruckIcon, RefreshCw, TrendingUp, Package, Clock, DollarSign, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmtUSD = (n) => `$${Number(n || 0).toFixed(2)}`;
const fmtDays = (d) => d == null ? '∞ días' : `${d} días`;

const PERIOD_OPTIONS = [
    { label: '15 días', value: 15 },
    { label: '30 días', value: 30 },
    { label: '60 días', value: 60 },
    { label: '90 días', value: 90 },
];

// ─── Card producto caliente ───────────────────────────────────────────────────
const HotCard = ({ item, bsRate }) => {
    const urgency = item.days_of_stock != null && item.days_of_stock <= 3
        ? 'border-rose-300 bg-rose-50'
        : item.days_of_stock != null && item.days_of_stock <= 7
            ? 'border-amber-300 bg-amber-50'
            : 'border-orange-200 bg-orange-50';

    return (
        <div className={`rounded-2xl border-2 p-4 flex items-start gap-3 ${urgency}`}>
            <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center shrink-0">
                <Flame size={18} className="text-orange-500" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="font-black text-slate-800 text-sm truncate">{item.name}</p>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">{item.sku || '—'}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                    <span className="text-[11px] font-bold text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full">
                        {item.units_sold} ud vendidas
                    </span>
                    <span className="text-[11px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">
                        {item.velocity_per_day} ud/día
                    </span>
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                        {fmtUSD(item.revenue)} generado
                    </span>
                </div>
            </div>
            <div className="text-right shrink-0">
                <p className="text-xs font-black text-slate-600">Stock</p>
                <p className={`text-lg font-black ${item.stock <= 3 ? 'text-rose-600' : 'text-slate-800'}`}>
                    {item.stock}
                </p>
                {item.days_of_stock != null && (
                    <p className={`text-[10px] font-bold ${item.days_of_stock <= 3 ? 'text-rose-500' : item.days_of_stock <= 7 ? 'text-amber-500' : 'text-slate-400'}`}>
                        ~{item.days_of_stock}d restantes
                    </p>
                )}
            </div>
        </div>
    );
};

// ─── Card producto dormido ────────────────────────────────────────────────────
const DormantCard = ({ item }) => (
    <div className="rounded-2xl border-2 border-slate-200 bg-white p-4 flex items-start gap-3 hover:border-slate-300 transition-all">
        <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">
            <Snowflake size={18} className="text-slate-400" />
        </div>
        <div className="flex-1 min-w-0">
            <p className="font-black text-slate-700 text-sm truncate">{item.name}</p>
            <p className="text-[10px] text-slate-400 font-mono mt-0.5">{item.sku || '—'}</p>
            <div className="flex flex-wrap gap-2 mt-2">
                <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Clock size={9} /> Sin ventas: {fmtDays(item.days_dormant)}
                </span>
                <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                    {item.stock} en stock
                </span>
            </div>
        </div>
        <div className="text-right shrink-0">
            <p className="text-[10px] text-slate-400 font-bold">Valor stock</p>
            <p className="text-sm font-black text-slate-600">{fmtUSD(item.stock_value)}</p>
        </div>
    </div>
);

// ─── Card sugerencia traslado ─────────────────────────────────────────────────
const TransferCard = ({ item }) => {
    const priorityStyle = {
        HIGH:   { bg: 'bg-rose-100',   text: 'text-rose-700',   label: '🔴 Urgente' },
        MEDIUM: { bg: 'bg-amber-100',  text: 'text-amber-700',  label: '🟡 Medio'  },
        LOW:    { bg: 'bg-slate-100',  text: 'text-slate-600',  label: '⚪ Bajo'   },
    }[item.priority] || {};

    return (
        <div className="rounded-2xl border-2 border-indigo-100 bg-indigo-50/30 p-4 flex items-start gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center shrink-0">
                <TruckIcon size={18} className="text-indigo-500" />
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-black text-slate-800 text-sm truncate">{item.name}</p>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${priorityStyle.bg} ${priorityStyle.text}`}>
                        {priorityStyle.label}
                    </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">{item.reason}</p>
                <div className="flex gap-2 mt-2 flex-wrap">
                    <span className="text-[11px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">
                        {item.stock} unidades disponibles
                    </span>
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                        {fmtUSD(item.stock_value)} en stock
                    </span>
                </div>
            </div>
        </div>
    );
};

// ─── Sección colapsable ───────────────────────────────────────────────────────
const Section = ({ icon: Icon, title, subtitle, color, count, children, defaultOpen = true }) => {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <button
                onClick={() => setOpen(o => !o)}
                className="w-full flex items-center gap-3 px-5 py-4 hover:bg-slate-50 transition-colors"
            >
                <div className={`w-9 h-9 ${color} rounded-xl flex items-center justify-center shrink-0`}>
                    <Icon size={18} className="text-white" />
                </div>
                <div className="flex-1 text-left">
                    <p className="font-black text-slate-800 text-sm">{title}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>
                </div>
                <span className="text-xs font-black text-slate-400 bg-slate-100 px-2 py-1 rounded-lg mr-2">
                    {count}
                </span>
                {open ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
            </button>
            {open && <div className="px-5 pb-5 space-y-3">{children}</div>}
        </div>
    );
};

// ─── Tab principal ────────────────────────────────────────────────────────────
const IntelligenceTab = () => {
    const [days, setDays] = useState(30);
    const [loading, setLoading] = useState(true);
    const [hot, setHot] = useState([]);
    const [dormant, setDormant] = useState([]);
    const [transfers, setTransfers] = useState([]);
    const { currencies } = useConfig();

    const bsRate = (() => {
        if (!Array.isArray(currencies)) return null;
        const ves = currencies.find(c => c.is_default && (c.currency_code === 'VES' || c.currency_symbol === 'Bs'));
        return ves ? parseFloat(ves.rate) : null;
    })();

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [h, d, t] = await Promise.all([
                apiClient.get(`/reports/intelligence/hot-products?days=${days}&limit=10`),
                apiClient.get(`/reports/intelligence/dormant-products?days=${days}&limit=20`),
                apiClient.get(`/reports/intelligence/transfer-suggestions?days=${days}`),
            ]);
            setHot(h.data || []);
            setDormant(d.data || []);
            setTransfers(t.data || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [days]);

    useEffect(() => { load(); }, [load]);

    const totalCapitalDormido = dormant.reduce((s, d) => s + (d.stock_value || 0), 0);

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h2 className="font-black text-slate-800 text-base flex items-center gap-2">
                        🧠 Inteligencia de Inventario
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">Análisis automático basado en ventas reales</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
                        {PERIOD_OPTIONS.map(opt => (
                            <button key={opt.value} onClick={() => setDays(opt.value)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${days === opt.value ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                                {opt.label}
                            </button>
                        ))}
                    </div>
                    <button onClick={load} className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-500 transition-all">
                        <RefreshCw size={15} className={loading ? 'animate-spin text-indigo-500' : ''} />
                    </button>
                </div>
            </div>

            {/* KPI summary */}
            {!loading && (
                <div className="grid grid-cols-3 gap-3">
                    <div className="bg-orange-50 border border-orange-100 rounded-2xl p-3 text-center">
                        <p className="text-2xl font-black text-orange-600">{hot.length}</p>
                        <p className="text-[10px] font-bold text-orange-400 uppercase tracking-widest">Calientes</p>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-center">
                        <p className="text-2xl font-black text-slate-500">{dormant.length}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Dormidos</p>
                    </div>
                    <div className="bg-rose-50 border border-rose-100 rounded-2xl p-3 text-center">
                        <p className="text-2xl font-black text-rose-600">{fmtUSD(totalCapitalDormido)}</p>
                        <p className="text-[10px] font-bold text-rose-400 uppercase tracking-widest">Capital inmovilizado</p>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-300 gap-3">
                    <div className="w-10 h-10 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" style={{ borderWidth: 3 }} />
                    <p className="text-sm font-bold text-slate-400">Analizando inventario...</p>
                </div>
            ) : (
                <>
                    {/* 🔥 Calientes */}
                    <Section icon={Flame} title="Productos Calientes" color="bg-orange-500"
                        subtitle={`Más vendidos en los últimos ${days} días`} count={`${hot.length} productos`} defaultOpen={true}>
                        {hot.length === 0
                            ? <p className="text-sm text-slate-400 text-center py-4">Sin ventas en este período</p>
                            : hot.map(item => <HotCard key={item.id} item={item} bsRate={bsRate} />)
                        }
                    </Section>

                    {/* ❄️ Dormidos */}
                    <Section icon={Snowflake} title="Productos Dormidos" color="bg-slate-500"
                        subtitle={`Con stock pero sin ventas en ${days}+ días`} count={`${dormant.length} productos`} defaultOpen={true}>
                        {dormant.length === 0
                            ? <p className="text-sm text-slate-400 text-center py-4">¡Todo el inventario está rotando! 🎉</p>
                            : dormant.map(item => <DormantCard key={item.id} item={item} />)
                        }
                    </Section>

                    {/* 🚚 Traslados sugeridos */}
                    <Section icon={TruckIcon} title="Sugerencias para Otros Locales" color="bg-indigo-500"
                        subtitle="Productos dormidos con mayor capital inmovilizado" count={`${transfers.length} sugerencias`} defaultOpen={true}>
                        {transfers.length === 0
                            ? <p className="text-sm text-slate-400 text-center py-4">Sin sugerencias de traslado</p>
                            : transfers.map(item => <TransferCard key={item.id} item={item} />)
                        }
                    </Section>
                </>
            )}
        </div>
    );
};

export default IntelligenceTab;
