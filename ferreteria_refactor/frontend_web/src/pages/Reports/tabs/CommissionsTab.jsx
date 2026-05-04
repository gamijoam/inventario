import { useState, useEffect } from 'react';
import {
    DollarSign, Search, CheckCircle, Download, AlertTriangle,
    X, TrendingUp, ChevronDown, ChevronUp, Eye
} from 'lucide-react';
import apiClient from '../../../config/axios';
import { useConfig } from '../../../context/ConfigContext';
import { toast } from 'react-hot-toast';

// ---------------------------------------------------------------------------
// Payout Confirmation Modal
// ---------------------------------------------------------------------------
const ConfirmPayModal = ({ summary, onConfirm, onCancel, isProcessing }) => {
    if (!summary) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
                <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-amber-50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-100 rounded-xl text-amber-600">
                            <AlertTriangle className="w-5 h-5" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800">Confirmar Pago</h3>
                    </div>
                    <button onClick={onCancel} disabled={isProcessing} className="text-slate-400 hover:text-slate-600 disabled:opacity-50">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-5 space-y-4">
                    <p className="text-slate-600 text-sm">
                        Se liquidaran todas las comisiones pendientes del empleado y se registrara un egreso en la caja activa.
                    </p>
                    <div className="bg-slate-50 rounded-xl p-4 space-y-2 border border-slate-100">
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-500">Empleado</span>
                            <span className="font-bold text-slate-800">{summary.user_name}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-500">Registros pendientes</span>
                            <span className="font-medium text-slate-700">{summary.count}</span>
                        </div>
                        <div className="flex justify-between text-base border-t border-slate-200 pt-2 mt-2">
                            <span className="font-bold text-slate-700">Total a pagar</span>
                            <span className="font-black text-emerald-600">${parseFloat(summary.pending_amount).toFixed(2)}</span>
                        </div>
                    </div>
                    <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                        Recuerde retirar fisicamente el dinero de la caja para que coincida con el sistema.
                    </p>
                </div>
                <div className="px-5 pb-5 flex gap-3">
                    <button onClick={onCancel} disabled={isProcessing} className="flex-1 px-4 py-2.5 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl font-medium transition-colors disabled:opacity-50">
                        Cancelar
                    </button>
                    <button onClick={onConfirm} disabled={isProcessing} className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-colors shadow-sm disabled:opacity-60">
                        {isProcessing ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                        {isProcessing ? 'Procesando...' : 'Confirmar Pago'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ---------------------------------------------------------------------------
// Detail row (lazy loaded per user)
// ---------------------------------------------------------------------------
const UserDetailRow = ({ userId, bsRate }) => {
    const [details, setDetails] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        apiClient.get(`/commissions/details/${userId}`)
            .then(r => setDetails(r.data))
            .catch(() => setDetails([]))
            .finally(() => setLoading(false));
    }, [userId]);

    const fmtDate = (d) => {
        try { return new Date(d).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' }); }
        catch { return d; }
    };

    if (loading) return (
        <tr><td colSpan="5" className="p-4 text-center text-slate-400 text-xs bg-slate-50/70">
            <div className="animate-spin w-4 h-4 border-2 border-indigo-200 border-t-indigo-600 rounded-full mx-auto" />
        </td></tr>
    );
    if (!details?.length) return (
        <tr><td colSpan="5" className="p-4 text-center text-slate-400 text-xs bg-slate-50/70">Sin detalles disponibles</td></tr>
    );

    return details.map(d => (
        <tr key={d.id} className="bg-slate-50/60 text-xs border-b border-slate-100">
            <td className="pl-12 py-2 text-slate-500">{fmtDate(d.created_at)}</td>
            <td className="py-2 text-slate-500">
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${d.commission_role === 'TECHNICIAN' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                    {d.commission_role === 'TECHNICIAN' ? '🔧 Técnico' : '🛒 Vendedor'}
                </span>
            </td>
            <td className="py-2 text-slate-500">{d.source_type === 'SERVICE' ? '🔧 Taller' : '🛒 POS'}</td>
            <td className="py-2 text-slate-500">{d.source_reference || `#${d.source_id || d.id}`}</td>
            <td className="py-2 text-right">
                <span className="font-bold text-emerald-700">${parseFloat(d.amount).toFixed(2)}</span>
                {/* Solo mostrar Bs si la venta fue cobrada en Bs — con tasa congelada */}
                {d.paid_in_bs && d.amount_bs ? (
                    <div className="text-[10px] font-bold text-indigo-500 flex items-center justify-end gap-1 mt-0.5">
                        <span className="bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded-full">
                            Bs {parseFloat(d.amount_bs).toFixed(2)}
                        </span>
                        <span className="text-slate-300 text-[9px]" title={`Tasa del día: ${d.exchange_rate_snapshot}`}>
                            @ {parseFloat(d.exchange_rate_snapshot || 0).toFixed(2)}
                        </span>
                    </div>
                ) : null}
            </td>
            <td className="py-2 pr-4 text-center">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${d.status === 'PENDING' ? 'bg-amber-50 text-amber-600 border border-amber-200' : 'bg-emerald-50 text-emerald-600 border border-emerald-200'}`}>
                    {d.status === 'PENDING' ? 'PENDIENTE' : 'PAGADO'}
                </span>
            </td>
        </tr>
    ));
};

// ---------------------------------------------------------------------------
// Currency helper
// ---------------------------------------------------------------------------
const formatUSD = (amount) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(Number(amount) || 0);

const formatBs = (amountUSD, rate) => {
    if (!rate || rate <= 0) return null;
    const bs = Number(amountUSD) * Number(rate);
    return new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(bs) + ' Bs';
};

// ---------------------------------------------------------------------------
// MAIN COMPONENT
// ---------------------------------------------------------------------------
const CommissionsTab = () => {
    const { currencies } = useConfig();
    // Obtener tasa VES activa (la tasa del día)
    const bsRate = (() => {
        if (!Array.isArray(currencies)) return null;
        const ves = currencies.find(c =>
            c.is_default && (c.currency_code === 'VES' || c.currency_symbol === 'Bs')
        ) || currencies.find(c => c.currency_code === 'VES' || c.currency_symbol === 'Bs');
        return ves ? parseFloat(ves.rate) : null;
    })();

    const [summary, setSummary] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedUser, setExpandedUser] = useState(null);
    const [pendingPayout, setPendingPayout] = useState(null);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const res = await apiClient.get('/commissions/summary');
            setSummary(res.data);
        } catch (error) {
            console.error(error);
            toast.error('Error al cargar comisiones');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    const handleConfirmPay = async () => {
        if (!pendingPayout) return;
        setIsProcessing(true);
        try {
            // Load detail IDs first
            const detailsRes = await apiClient.get(`/commissions/details/${pendingPayout.user_id}`);
            const pendingLogs = detailsRes.data.filter(d => d.status === 'PENDING');
            if (!pendingLogs.length) {
                toast.error('No hay comisiones pendientes para este usuario');
                setPendingPayout(null);
                return;
            }
            await apiClient.post('/commissions/payout', {
                user_id: pendingPayout.user_id,
                log_ids: pendingLogs.map(d => d.id),
                payment_source: 'DRAWER',
                payment_method: 'CASH_USD',
                amount_usd_total: parseFloat(pendingPayout.pending_amount),
                exchange_rate: 1.0,
                reference: null,
            });
            toast.success(`Comisiones de ${pendingPayout.user_name} pagadas correctamente`);
            setPendingPayout(null);
            setExpandedUser(null);
            loadData();
        } catch (error) {
            const detail = error.response?.data?.detail;
            toast.error(typeof detail === 'string' ? detail : 'Error al procesar el pago');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleExport = () => {
        if (!filtered.length) { toast.error('No hay datos para exportar'); return; }
        const headers = ['Empleado', 'Comisiones Pendientes', 'Monto Total'];
        const rows = filtered.map(s => [s.user_name, s.count, parseFloat(s.pending_amount).toFixed(2)]);
        const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `Comisiones_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        link.parentNode.removeChild(link);
        window.URL.revokeObjectURL(url);
        toast.success('Exportado correctamente');
    };

    const filtered = summary.filter(s =>
        s.user_name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalPendiente = filtered.reduce((acc, s) => acc + parseFloat(s.pending_amount || 0), 0);
    const totalEmpleados = filtered.length;

    return (
        <div className="space-y-6">
            <ConfirmPayModal
                summary={pendingPayout}
                onConfirm={handleConfirmPay}
                onCancel={() => !isProcessing && setPendingPayout(null)}
                isProcessing={isProcessing}
            />

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-lg transition-all duration-300 group hover:-translate-y-0.5">
                    <div className="flex justify-between items-start mb-3">
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Pendiente de Pago</p>
                        <div className="p-2 rounded-lg bg-emerald-500 bg-opacity-10 group-hover:bg-opacity-20 transition-colors">
                            <DollarSign size={16} className="text-emerald-500" />
                        </div>
                    </div>
                    <h3 className="text-2xl font-black text-emerald-600 tracking-tight">{formatUSD(totalPendiente)}</h3>
                    {bsRate && <p className="text-sm font-bold text-slate-500 mt-0.5">{formatBs(totalPendiente, bsRate)}</p>}
                    <p className="text-xs text-slate-400 font-medium mt-0.5">total acumulado · tasa {bsRate ? bsRate.toFixed(2) : "—"} Bs/$</p>
                </div>
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-lg transition-all duration-300 group hover:-translate-y-0.5">
                    <div className="flex justify-between items-start mb-3">
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Empleados con Saldo</p>
                        <div className="p-2 rounded-lg bg-indigo-500 bg-opacity-10 group-hover:bg-opacity-20 transition-colors">
                            <TrendingUp size={16} className="text-indigo-500" />
                        </div>
                    </div>
                    <h3 className="text-2xl font-black text-indigo-600 tracking-tight">{totalEmpleados}</h3>
                    <p className="text-xs text-slate-400 font-medium mt-1">con comisiones pendientes</p>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50/50">
                    <div className="relative w-full sm:w-80">
                        <Search className="w-5 h-5 absolute left-3 top-2.5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar empleado..."
                            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-shadow bg-white text-sm"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl transition-colors font-medium text-sm"
                    >
                        <Download className="w-4 h-4" />
                        <span className="hidden sm:inline">Exportar</span>
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50/80 text-slate-500 text-xs font-bold uppercase tracking-wider">
                            <tr>
                                <th className="p-4 text-left">Empleado</th>
                                <th className="p-4 text-center">Registros</th>
                                <th className="p-4 text-right">Total Pendiente</th>
                                <th className="p-4 text-center">Detalle</th>
                                <th className="p-4 text-center">Accion</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoading ? (
                                <tr>
                                    <td colSpan="5" className="p-12 text-center text-slate-400">
                                        <div className="animate-spin w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full mx-auto mb-3" />
                                        Cargando comisiones...
                                    </td>
                                </tr>
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="p-12 text-center text-slate-400">
                                        No hay comisiones pendientes
                                    </td>
                                </tr>
                            ) : (
                                filtered.map(s => (
                                    <>
                                        <tr key={s.user_id} className="hover:bg-slate-50/60 transition-colors">
                                            <td className="p-4 font-bold text-slate-800">{s.user_name}</td>
                                            <td className="p-4 text-center text-slate-600">{s.count}</td>
                                            <td className="p-4 text-right">
                                                <span className="inline-block px-2 py-1 bg-emerald-100 text-emerald-800 font-bold rounded-lg border border-emerald-200">
                                                    {formatUSD(s.pending_amount)}
                                                </span>
                                                {bsRate && (
                                                    <div className="text-[10px] font-bold text-slate-400 mt-0.5 text-right">
                                                        {formatBs(s.pending_amount, bsRate)}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-4 text-center">
                                                <button
                                                    onClick={() => setExpandedUser(expandedUser === s.user_id ? null : s.user_id)}
                                                    className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors"
                                                >
                                                    <Eye className="w-3.5 h-3.5" />
                                                    {expandedUser === s.user_id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                                </button>
                                            </td>
                                            <td className="p-4 text-center">
                                                <button
                                                    onClick={() => setPendingPayout(s)}
                                                    disabled={isProcessing}
                                                    className="inline-flex items-center gap-1 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg transition-colors shadow-sm disabled:opacity-50"
                                                >
                                                    <CheckCircle className="w-4 h-4" />
                                                    Pagar
                                                </button>
                                            </td>
                                        </tr>
                                        {expandedUser === s.user_id && (
                                            <>
                                                <tr className="bg-slate-50/40">
                                                    <th className="pl-12 py-1.5 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Fecha</th>
                                                    <th className="py-1.5 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Rol</th>
                                                    <th className="py-1.5 text-left text-xs font-bold text-slate-400 uppercase tracking-wider" colSpan="2">Módulo / Referencia</th>
                                                    <th className="py-1.5 text-right text-xs font-bold text-slate-400 uppercase tracking-wider">Monto</th>
                                                    <th className="py-1.5 pr-4 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">Estado</th>
                                                </tr>
                                                <UserDetailRow userId={s.user_id} bsRate={bsRate} />
                                            </>
                                        )}
                                    </>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default CommissionsTab;
