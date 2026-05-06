import { useState, useEffect, useCallback } from 'react';
import { DollarSign, Search, AlertTriangle, X, ChevronDown, ChevronUp, Printer, User, TrendingUp } from 'lucide-react';
import apiClient from '../../../config/axios';
import { useConfig } from '../../../context/ConfigContext';
import { useAuth } from '../../../context/AuthContext';
import { toast } from 'react-hot-toast';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtUSD = (n) => `$${parseFloat(n || 0).toFixed(2)}`;
const fmtBs  = (n, rate) => rate ? `Bs ${(parseFloat(n || 0) * rate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : null;
const fmtDate = (d) => { try { return new Date(d).toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: '2-digit' }); } catch { return d; } };

// ─── Modal confirmar pago ─────────────────────────────────────────────────────
const ConfirmPayModal = ({ summary, onConfirm, onCancel, isProcessing, bsRate, payMode, onPayModeChange }) => {
    if (!summary) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
                <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-amber-50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-100 rounded-xl text-amber-600"><AlertTriangle className="w-5 h-5" /></div>
                        <h3 className="text-lg font-bold text-slate-800">Confirmar Pago</h3>
                    </div>
                    <button onClick={onCancel} disabled={isProcessing} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-5 space-y-4">
                    <div className="bg-slate-50 rounded-xl p-4 space-y-2 border border-slate-100">
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-500">Vendedor</span>
                            <span className="font-bold text-slate-800">{summary.user_name}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-500">Registros</span>
                            <span className="font-medium text-slate-700">{summary.count}</span>
                        </div>
                        <div className="flex justify-between text-base border-t border-slate-200 pt-2 mt-2">
                            <span className="font-bold text-slate-700">Total USD</span>
                            <span className="font-black text-emerald-600">${parseFloat(summary.pending_amount).toFixed(2)}</span>
                        </div>
                        {bsRate && (
                            <div className="flex justify-between text-sm text-slate-500">
                                <span>E.Q Bs</span>
                                <span className="font-bold">Bs {(parseFloat(summary.pending_amount) * bsRate).toFixed(2)}</span>
                            </div>
                        )}
                    </div>
                    {bsRate && (
                        <div>
                            <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Pagar en:</p>
                            <div className="flex gap-2">
                                <button onClick={() => onPayModeChange('USD')}
                                    className={`flex-1 py-2.5 rounded-xl text-sm font-black border-2 transition-all ${payMode === 'USD' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300'}`}>
                                    $ USD
                                </button>
                                <button onClick={() => onPayModeChange('Bs')}
                                    className={`flex-1 py-2.5 rounded-xl text-sm font-black border-2 transition-all ${payMode === 'Bs' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-500 border-slate-200 hover:border-emerald-300'}`}>
                                    Bs
                                </button>
                            </div>
                        </div>
                    )}
                    <div className="flex gap-3 pt-2">
                        <button onClick={onCancel} disabled={isProcessing}
                            className="flex-1 py-3 border-2 border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 disabled:opacity-50">
                            Cancelar
                        </button>
                        <button onClick={onConfirm} disabled={isProcessing}
                            className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl disabled:opacity-50 transition-all">
                            {isProcessing ? 'Procesando...' : 'Pagar'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─── Tabla detalle por vendedor (estilo Control de Entrada) ───────────────────
const VendorDetailTable = ({ userId, bsRate }) => {
    const [details, setDetails] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        apiClient.get(`/commissions/details/${userId}`)
            .then(r => setDetails(r.data))
            .catch(() => setDetails([]))
            .finally(() => setLoading(false));
    }, [userId]);

    if (loading) return (
        <div className="p-6 flex justify-center">
            <div className="w-5 h-5 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
    );
    if (!details?.length) return (
        <div className="p-4 text-center text-slate-400 text-sm">Sin comisiones pendientes</div>
    );

    const totalUSD = details.reduce((s, d) => s + parseFloat(d.amount || 0), 0);
    const totalBs  = details.reduce((s, d) => {
        if (d.paid_in_bs && d.amount_bs) return s + parseFloat(d.amount_bs);
        return s + (bsRate ? parseFloat(d.amount || 0) * bsRate : 0);
    }, 0);

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-xs">
                <thead>
                    <tr className="bg-indigo-700 text-white text-[10px]">
                        <th className="px-3 py-2.5 text-left font-black whitespace-nowrap">FECHA</th>
                        <th className="px-3 py-2.5 text-left font-black">REFERENCIA</th>
                        <th className="px-3 py-2.5 text-left font-black whitespace-nowrap">MÉTODO DE PAGO</th>
                        <th className="px-3 py-2.5 text-center font-black">$ / Bs</th>
                        <th className="px-3 py-2.5 text-right font-black whitespace-nowrap">P.V $</th>
                        <th className="px-3 py-2.5 text-right font-black whitespace-nowrap">E.Q Bs</th>
                        <th className="px-3 py-2.5 text-left font-black whitespace-nowrap">FINANCIAMIENTO</th>
                        <th className="px-3 py-2.5 text-left font-black">NIVEL</th>
                        <th className="px-3 py-2.5 text-right font-black whitespace-nowrap">M. FINANCIADO</th>
                        <th className="px-3 py-2.5 text-right font-black whitespace-nowrap">COMIS. %</th>
                        <th className="px-3 py-2.5 text-right font-black whitespace-nowrap">COMIS. $</th>
                        <th className="px-3 py-2.5 text-right font-black whitespace-nowrap">COMIS. Bs</th>
                        <th className="px-3 py-2.5 text-right font-black">TOTAL</th>
                        <th className="px-3 py-2.5 text-center font-black">ESTADO</th>
                    </tr>
                </thead>
                <tbody>
                    {details.map((d, i) => {
                        const bsEquiv = d.paid_in_bs && d.amount_bs
                            ? parseFloat(d.amount_bs)
                            : bsRate ? parseFloat(d.amount || 0) * bsRate : null;
                        const rate = d.exchange_rate_snapshot || bsRate;
                        const vendidoEnBs = d.sale_currency === 'Bs' || d.paid_in_bs;
                        const totalLabel = vendidoEnBs
                            ? `Bs ${(d.sale_total_bs || 0).toLocaleString('es-VE', { maximumFractionDigits: 2 })}`
                            : d.sale_total_usd ? `$${parseFloat(d.sale_total_usd).toFixed(2)}` : '—';
                        const totalSubLabel = vendidoEnBs && d.sale_exchange_rate && d.sale_total_bs
                            ? `$${(parseFloat(d.sale_total_bs) / parseFloat(d.sale_exchange_rate)).toFixed(2)}`
                            : null;

                        return (
                            <tr key={d.id} className={`border-b border-slate-100 text-xs ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'} hover:bg-indigo-50/20 transition-colors`}>
                                <td className="px-3 py-2 text-slate-400 whitespace-nowrap">{fmtDate(d.created_at)}</td>
                                <td className="px-3 py-2">
                                    <span className="font-bold text-slate-700">{d.source_reference || `#${d.source_id}`}</span>
                                    <span className={`ml-1 text-[9px] px-1 py-0.5 rounded-full font-bold ${d.commission_role === 'TECHNICIAN' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                                        {d.source_type === 'SERVICE' ? '🔧' : '🛒'}
                                    </span>
                                </td>
                                <td className="px-3 py-2">
                                    <div className="flex flex-wrap gap-1">
                                        {d.payment_methods?.length > 0
                                            ? d.payment_methods.map((m, mi) => <span key={mi} className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium whitespace-nowrap">{m}</span>)
                                            : <span className="text-slate-300">—</span>}
                                    </div>
                                </td>
                                <td className="px-3 py-2 text-center">
                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${vendidoEnBs ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                                        {vendidoEnBs ? 'Bs' : '$'}
                                    </span>
                                </td>
                                <td className="px-3 py-2 text-right font-bold text-slate-700 whitespace-nowrap">
                                    {d.sale_total_usd ? `$${parseFloat(d.sale_total_usd).toFixed(2)}` : '—'}
                                </td>
                                <td className="px-3 py-2 text-right text-slate-500 whitespace-nowrap">
                                    {d.sale_total_bs
                                        ? `Bs ${parseFloat(d.sale_total_bs).toLocaleString('es-VE', { maximumFractionDigits: 2 })}`
                                        : d.sale_total_usd && rate ? `Bs ${(d.sale_total_usd * rate).toLocaleString('es-VE', { maximumFractionDigits: 2 })}` : '—'}
                                </td>
                                <td className="px-3 py-2">
                                    {d.financing_method
                                        ? <span className="text-[9px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-bold whitespace-nowrap">{d.financing_method}</span>
                                        : <span className="text-slate-300 text-[9px]">Contado</span>}
                                </td>
                                <td className="px-3 py-2 text-slate-400 text-[10px] whitespace-nowrap">{d.financing_level || '—'}</td>
                                <td className="px-3 py-2 text-right text-slate-500 whitespace-nowrap">
                                    {d.financed_amount ? `$${parseFloat(d.financed_amount).toFixed(2)}` : '—'}
                                </td>
                                <td className="px-3 py-2 text-right text-slate-400">{d.percentage_applied ? `${parseFloat(d.percentage_applied).toFixed(1)}%` : '—'}</td>
                                <td className="px-3 py-2 text-right font-black text-emerald-700 whitespace-nowrap">{fmtUSD(d.amount)}</td>
                                <td className="px-3 py-2 text-right whitespace-nowrap">
                                    {d.paid_in_bs && d.amount_bs
                                        ? <div><span className="font-bold text-indigo-600">Bs {parseFloat(d.amount_bs).toFixed(2)}</span><div className="text-[8px] text-slate-300">@ {parseFloat(d.exchange_rate_snapshot || 0).toFixed(2)}</div></div>
                                        : bsEquiv ? <span className="text-slate-400">Bs {bsEquiv.toLocaleString('es-VE', { maximumFractionDigits: 2 })}</span> : '—'}
                                </td>
                                <td className="px-3 py-2 text-right whitespace-nowrap">
                                    <div className="font-black text-slate-800">{totalLabel}</div>
                                    {totalSubLabel && <div className="text-[9px] text-slate-400">{totalSubLabel}</div>}
                                </td>
                                <td className="px-3 py-2 text-center">
                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${d.status === 'PENDING' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                        {d.status === 'PENDING' ? 'PENDIENTE' : 'PAGADO'}
                                    </span>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
                {/* Totales */}
                <tfoot>
                    <tr className="bg-indigo-50 border-t-2 border-indigo-200 font-black text-sm">
                        <td colSpan={10} className="px-3 py-3 text-right text-slate-700 uppercase tracking-wide text-[10px] font-black">TOTAL COMISIONES</td>
                        <td className="px-3 py-3 text-right font-black text-emerald-700 whitespace-nowrap">{fmtUSD(totalUSD)}</td>
                        <td className="px-3 py-3 text-right font-black text-indigo-700 whitespace-nowrap">{bsRate ? `Bs ${totalBs.toLocaleString('es-VE', { maximumFractionDigits: 2 })}` : '—'}</td>
                        <td></td><td></td>
                    </tr>
                </tfoot>
            </table>
        </div>
    );
};

// ─── Fila de resumen por vendedor ─────────────────────────────────────────────
const VendorRow = ({ s, bsRate, onPay, expanded, onToggle }) => (
    <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        {/* Header */}
        <div className={`flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-slate-50 transition-colors ${expanded ? 'bg-indigo-50/30 border-b border-indigo-100' : 'bg-white'}`}
            onClick={onToggle}>
            {/* Avatar */}
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                <span className="text-indigo-700 font-black text-sm">{(s.user_name || 'U').charAt(0).toUpperCase()}</span>
            </div>
            {/* Nombre y resumen */}
            <div className="flex-1 min-w-0">
                <p className="font-black text-slate-800">{s.user_name}</p>
                <p className="text-xs text-slate-400 mt-0.5">{s.count} registro{s.count !== 1 ? 's' : ''} pendientes</p>
            </div>
            {/* Montos */}
            <div className="text-right shrink-0">
                <p className="font-black text-emerald-600 text-base">{fmtUSD(s.pending_amount)}</p>
                {bsRate && <p className="text-xs font-bold text-slate-400 mt-0.5">{fmtBs(s.pending_amount, bsRate)}</p>}
            </div>
            {/* Botón pagar */}
            <button
                onClick={e => { e.stopPropagation(); onPay(s); }}
                className="shrink-0 flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl transition-all shadow-sm shadow-indigo-200"
            >
                <DollarSign size={13} /> Pagar
            </button>
            {expanded ? <ChevronUp size={16} className="text-slate-400 shrink-0" /> : <ChevronDown size={16} className="text-slate-400 shrink-0" />}
        </div>
        {/* Detalle expandido */}
        {expanded && <VendorDetailTable userId={s.user_id} bsRate={bsRate} />}
    </div>
);

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
const CommissionsTab = () => {
    const { currencies } = useConfig();
    const { user } = useAuth();

    const bsRate = (() => {
        if (!Array.isArray(currencies)) return null;
        const ves = currencies.find(c => c.is_default && (c.currency_code === 'VES' || c.currency_symbol === 'Bs'))
            || currencies.find(c => c.currency_code === 'VES' || c.currency_symbol === 'Bs');
        return ves ? parseFloat(ves.rate) : null;
    })();

    const [summary, setSummary]           = useState([]);
    const [isLoading, setIsLoading]       = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [searchTerm, setSearchTerm]     = useState('');
    const [expandedUser, setExpandedUser] = useState(null);
    const [pendingPayout, setPendingPayout] = useState(null);
    const [payMode, setPayMode]           = useState('USD');

    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await apiClient.get('/commissions/summary');
            setSummary(res.data);
        } catch { toast.error('Error al cargar comisiones'); }
        finally { setIsLoading(false); }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    const handleConfirmPay = async () => {
        if (!pendingPayout) return;
        setIsProcessing(true);
        try {
            const detailsRes = await apiClient.get(`/commissions/details/${pendingPayout.user_id}`);
            const pendingLogs = detailsRes.data.filter(d => d.status === 'PENDING');
            if (!pendingLogs.length) { toast.error('Sin comisiones pendientes'); setPendingPayout(null); return; }

            const payInBs = payMode === 'Bs';
            const totalBsPago = payInBs
                ? pendingLogs.reduce((s, d) => s + (d.paid_in_bs && d.amount_bs ? parseFloat(d.amount_bs) : (parseFloat(d.amount) * (bsRate || 1))), 0)
                : 0;

            await apiClient.post('/commissions/payout', {
                user_id: pendingPayout.user_id,
                log_ids: pendingLogs.map(d => d.id),
                payment_source: 'DRAWER',
                payment_method: payInBs ? 'CASH_VES' : 'CASH_USD',
                amount_usd_total: parseFloat(pendingPayout.pending_amount),
                exchange_rate: payInBs ? (bsRate || 1) : 1.0,
                reference: null,
            });

            const msg = payInBs ? `Bs ${totalBsPago.toFixed(2)}` : fmtUSD(pendingPayout.pending_amount);
            toast.success(`✅ Comisiones pagadas — ${msg}`);
            setPendingPayout(null); setExpandedUser(null); setPayMode('USD');
            loadData();
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Error al procesar el pago');
        } finally { setIsProcessing(false); }
    };

    const filtered = summary.filter(s =>
        !searchTerm || (s.user_name || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
    const totalPendiente = filtered.reduce((s, r) => s + parseFloat(r.pending_amount || 0), 0);
    const totalEmpleados = filtered.filter(r => parseFloat(r.pending_amount || 0) > 0).length;

    return (
        <div className="space-y-5">
            <ConfirmPayModal
                summary={pendingPayout}
                onConfirm={handleConfirmPay}
                onCancel={() => { if (!isProcessing) { setPendingPayout(null); setPayMode('USD'); } }}
                isProcessing={isProcessing}
                bsRate={bsRate}
                payMode={payMode}
                onPayModeChange={setPayMode}
            />

            {/* KPIs */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Total Pendiente</p>
                    <p className="text-3xl font-black text-emerald-600">{fmtUSD(totalPendiente)}</p>
                    {bsRate && <p className="text-sm font-bold text-slate-400 mt-1">{fmtBs(totalPendiente, bsRate)}</p>}
                    <p className="text-xs text-slate-400 mt-1">Tasa {bsRate ? bsRate.toFixed(2) : '—'} Bs/$</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Vendedores</p>
                    <p className="text-3xl font-black text-indigo-600">{totalEmpleados}</p>
                    <p className="text-xs text-slate-400 mt-1">con comisiones pendientes</p>
                </div>
            </div>

            {/* Buscador */}
            <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-sm">
                <Search size={15} className="text-slate-400 shrink-0" />
                <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Buscar vendedor..."
                    className="flex-1 text-sm outline-none text-slate-700 placeholder:text-slate-400 bg-transparent" />
            </div>

            {/* Lista de vendedores */}
            {isLoading ? (
                <div className="flex justify-center py-20">
                    <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                </div>
            ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center py-20 text-slate-300 gap-3">
                    <TrendingUp size={40} strokeWidth={1} />
                    <p className="text-sm font-bold text-slate-400">Sin comisiones pendientes</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map(s => (
                        <VendorRow
                            key={s.user_id}
                            s={s}
                            bsRate={bsRate}
                            onPay={setPendingPayout}
                            expanded={expandedUser === s.user_id}
                            onToggle={() => setExpandedUser(expandedUser === s.user_id ? null : s.user_id)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default CommissionsTab;
