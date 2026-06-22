import { useState, useEffect, useCallback } from 'react';
import { Building2, RefreshCw, CheckCircle2, Clock, Trash2, ChevronDown, ChevronUp, TrendingUp } from 'lucide-react';
import apiClient from '../../../config/axios';
import { toast } from 'react-hot-toast';
import { getApiErrorMessage } from '../../../utils/apiErrors';

const STATUS_CONFIG = {
    PENDING:   { label: 'Pendiente',  color: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200',  dot: 'bg-amber-400',   icon: Clock },
    PARTIAL:   { label: 'Parcial',    color: 'text-blue-700',    bg: 'bg-blue-50',    border: 'border-blue-200',   dot: 'bg-blue-400',    icon: TrendingUp },
    COMPLETED: { label: 'Pagado',     color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200',dot: 'bg-emerald-500', icon: CheckCircle2 },
};
const getStatus = (s) => STATUS_CONFIG[s] || STATUS_CONFIG.PENDING;

const fmt = (n) => `$${Number(n || 0).toFixed(2)}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

// ─── Modal pago ───────────────────────────────────────────────────────────────
const UpdatePaymentModal = ({ record, onClose, onSuccess }) => {
    const totalFinanciado = Number(record.financed_amount || 0);
    const yaPagado        = Number(record.financer_paid_amount || 0);
    const pendiente       = totalFinanciado - yaPagado;
    const [abono, setAbono]   = useState('');
    const [saving, setSaving] = useState(false);
    const abonoNum   = parseFloat(abono) || 0;
    const nuevoPagado = Math.min(yaPagado + abonoNum, totalFinanciado);
    const nuevoStatus = nuevoPagado >= totalFinanciado ? 'COMPLETED' : nuevoPagado > 0 ? 'PARTIAL' : record.financer_payment_status;
    const nuevoSt    = STATUS_CONFIG[nuevoStatus] || STATUS_CONFIG.PENDING;

    const handleSave = async () => {
        if (!abono || abonoNum <= 0) { toast.error('Ingresa un monto válido'); return; }
        if (abonoNum > pendiente + 0.01) { toast.error(`El abono no puede superar ${fmt(pendiente)}`); return; }
        setSaving(true);
        try {
            const updated = await apiClient.put(`/external-financing/${record.id}`, {
                financer_paid_amount: nuevoPagado,
                financer_payment_status: nuevoStatus,
            });
            toast.success('Pago actualizado');
            onSuccess(updated.data);
            onClose();
        } catch (error) {
            toast.error(getApiErrorMessage(error, 'Error al actualizar'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="bg-slate-900 px-3 py-2.5">
                    <h3 className="text-white font-black text-lg">Registrar Pago</h3>
                    <p className="text-slate-400 text-sm">{record.financer_name} — Venta #{record.sale_id}</p>
                </div>
                <div className="p-4 space-y-4">
                    <div className="grid grid-cols-3 gap-3 text-center">
                        <div className="bg-slate-50 rounded-xl p-3">
                            <p className="text-xs text-slate-400 font-bold uppercase">Total</p>
                            <p className="text-slate-900 font-black">{fmt(totalFinanciado)}</p>
                        </div>
                        <div className="bg-emerald-50 rounded-xl p-3">
                            <p className="text-xs text-emerald-600 font-bold uppercase">Pagado</p>
                            <p className="text-emerald-700 font-black">{fmt(yaPagado)}</p>
                        </div>
                        <div className="bg-amber-50 rounded-xl p-3">
                            <p className="text-xs text-amber-600 font-bold uppercase">Pendiente</p>
                            <p className="text-amber-700 font-black">{fmt(pendiente)}</p>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Monto del abono (USD)</label>
                        <input
                            type="number" step="0.01" min="0" max={pendiente}
                            value={abono} onChange={e => setAbono(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSave()}
                            placeholder={`Máx. ${fmt(pendiente)}`}
                            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-indigo-400"
                            autoFocus
                        />
                    </div>
                    {abono && abonoNum > 0 && (
                        <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border ${nuevoSt.bg} ${nuevoSt.border}`}>
                            <div className={`w-2 h-2 rounded-full ${nuevoSt.dot}`} />
                            <span className={`text-sm font-bold ${nuevoSt.color}`}>
                                Nuevo estado: {nuevoSt.label} — Pagado total: {fmt(nuevoPagado)}
                            </span>
                        </div>
                    )}
                    <div className="flex gap-3 pt-2">
                        <button onClick={onClose} className="flex-1 py-3 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition-colors">Cancelar</button>
                        <button onClick={handleSave} disabled={saving || !abono || abonoNum <= 0}
                            className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-black hover:bg-indigo-700 transition-colors disabled:opacity-50">
                            {saving ? 'Guardando...' : 'Registrar Pago'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─── Card de registro ─────────────────────────────────────────────────────────
const FinancingCard = ({ record, onUpdate, onDelete }) => {
    const st   = getStatus(record.financer_payment_status);
    const Icon = st.icon;
    const pct  = record.financed_amount > 0
        ? Math.min(100, (Number(record.financer_paid_amount || 0) / Number(record.financed_amount)) * 100)
        : 0;

    return (
        <div className={`bg-white rounded-xl border ${st.border} shadow-sm overflow-hidden hover:shadow-md transition-shadow`}>
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-100">
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${st.dot}`} />
                    <span className={`text-xs font-black uppercase tracking-wide ${st.color}`}>{st.label}</span>
                </div>
                <span className="text-xs text-slate-400">{fmtDate(record.created_at)}</span>
            </div>
            <div className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <p className="font-black text-slate-900">{record.financer_name}</p>
                        <p className="text-xs text-slate-400">Venta #{record.sale_id} {record.customer?.name ? `· ${record.customer.name}` : ''}</p>
                    </div>
                    <div className="text-right">
                        <p className="font-black text-slate-900">{fmt(record.total_price)}</p>
                        <p className="text-xs text-slate-400">venta total</p>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2">
                        <p className="text-[10px] font-black uppercase tracking-wide text-emerald-600">Inicial tienda</p>
                        <p className="font-black text-emerald-700">{fmt(record.initial_payment)}</p>
                    </div>
                    <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 text-right">
                        <p className="text-[10px] font-black uppercase tracking-wide text-amber-600">Por financiadora</p>
                        <p className="font-black text-amber-700">{fmt(record.financed_amount)}</p>
                    </div>
                </div>
                {/* Barra de progreso */}
                <div>
                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                        <span>Cobrado: {fmt(record.financer_paid_amount)}</span>
                        <span>{pct.toFixed(0)}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-emerald-500' : pct > 0 ? 'bg-blue-500' : 'bg-amber-400'}`}
                             style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-xs text-slate-400 mt-1">Pendiente: {fmt(Number(record.financed_amount) - Number(record.financer_paid_amount || 0))}</p>
                </div>
                <div className="flex gap-2 pt-1">
                    {record.financer_payment_status !== 'COMPLETED' && (
                        <button onClick={() => onUpdate(record)}
                            className="flex-1 py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-black hover:bg-indigo-600 hover:text-white transition-all">
                            Registrar Pago
                        </button>
                    )}
                    <button onClick={() => onDelete(record)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors">
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Card resumen por financiadora ────────────────────────────────────────────
const FinancerSummaryCard = ({ name, data, isExpanded, onToggle }) => {
    const pendiente = Number(data.total_financed || 0) - Number(data.total_paid || 0);
    const pct = data.total_financed > 0 ? (data.total_paid / data.total_financed) * 100 : 0;

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <button onClick={onToggle} className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                        <Building2 size={18} className="text-indigo-600" />
                    </div>
                    <div className="text-left">
                        <p className="font-black text-slate-900">{name}</p>
                        <p className="text-xs text-slate-500">{data.count} venta{data.count !== 1 ? 's' : ''}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="text-right">
                        <p className="text-xs text-amber-600 font-bold">Te debe</p>
                        <p className="font-black text-amber-700 text-lg">{fmt(pendiente)}</p>
                    </div>
                    {isExpanded ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                </div>
            </button>
            {isExpanded && (
                <div className="px-5 pb-5 border-t border-slate-100 pt-4 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                        <div className="bg-slate-50 rounded-xl p-3 text-center">
                            <p className="text-xs text-slate-400 font-bold uppercase">Ventas</p>
                            <p className="font-black text-slate-900">{fmt(data.total_amount)}</p>
                        </div>
                        <div className="bg-emerald-50 rounded-xl p-3 text-center">
                            <p className="text-xs text-emerald-600 font-bold uppercase">Iniciales</p>
                            <p className="font-black text-emerald-700">{fmt(data.total_initial)}</p>
                        </div>
                        <div className="bg-blue-50 rounded-xl p-3 text-center">
                            <p className="text-xs text-blue-600 font-bold uppercase">Recibido</p>
                            <p className="font-black text-blue-700">{fmt(data.total_paid)}</p>
                        </div>
                        <div className="bg-amber-50 rounded-xl p-3 text-center">
                            <p className="text-xs text-amber-600 font-bold uppercase">Pendiente</p>
                            <p className="font-black text-amber-700">{fmt(pendiente)}</p>
                        </div>
                    </div>
                    <div>
                        <div className="flex justify-between text-xs text-slate-500 mb-1">
                            <span>Progreso de cobro</span>
                            <span>{pct.toFixed(0)}%</span>
                        </div>
                        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${pct >= 100 ? 'bg-emerald-500' : pct > 0 ? 'bg-blue-500' : 'bg-amber-400'}`}
                                 style={{ width: `${pct}%` }} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── Tab principal ────────────────────────────────────────────────────────────
export default function FinanciadoresTab() {
    const [records, setRecords]       = useState([]);
    const [summary, setSummary]       = useState(null);
    const [financers, setFinancers]   = useState([]);
    const [isLoading, setIsLoading]   = useState(true);
    const [updateRecord, setUpdateRecord] = useState(null);
    const [filterStatus, setFilterStatus]     = useState('');
    const [filterFinancer, setFilterFinancer] = useState('');
    const [filterDateFrom, setFilterDateFrom] = useState('');
    const [filterDateTo, setFilterDateTo]     = useState('');
    const [expandedFinancer, setExpandedFinancer] = useState(null);
    const [view, setView] = useState('por-empresa'); // 'por-empresa' | 'detalle'

    const load = useCallback(async () => {
        setIsLoading(true);
        try {
            const [recRes, sumRes, finRes] = await Promise.all([
                apiClient.get('/external-financing/', { params: { status: filterStatus || undefined, financer_name: filterFinancer || undefined, date_from: filterDateFrom || undefined, date_to: filterDateTo || undefined } }),
                apiClient.get('/external-financing/summary', { params: { status: filterStatus || undefined, financer_name: filterFinancer || undefined, date_from: filterDateFrom || undefined, date_to: filterDateTo || undefined } }),
                apiClient.get('/external-financing/financers/list'),
            ]);
            setRecords(Array.isArray(recRes.data) ? recRes.data : []);
            setSummary(sumRes.data);
            setFinancers(Array.isArray(finRes.data) ? finRes.data : []);
        } catch (error) {
            toast.error(getApiErrorMessage(error, 'Error cargando datos'));
        } finally {
            setIsLoading(false);
        }
    }, [filterStatus, filterFinancer, filterDateFrom, filterDateTo]);

    useEffect(() => { load(); }, [load]);

    const handleRecordUpdated = (updatedRecord) => {
        if (!updatedRecord) { load(); return; }
        setRecords(prev => prev.map(r => r.id === updatedRecord.id ? updatedRecord : r));
        apiClient.get('/external-financing/summary').then(res => setSummary(res.data)).catch(() => {});
    };

    const handleDelete = async (record) => {
        if (!confirm(`¿Eliminar el registro de Venta #${record.sale_id}?`)) return;
        try {
            await apiClient.delete(`/external-financing/${record.id}`);
            toast.success('Registro eliminado');
            setRecords(prev => prev.filter(r => r.id !== record.id));
            apiClient.get('/external-financing/summary').then(res => setSummary(res.data)).catch(() => {});
        } catch (error) {
            toast.error(getApiErrorMessage(error, 'Error al eliminar'));
        }
    };

    // Agrupar por financiadora. Se deriva de los registros para no ocultar historicos
    // si una financiadora fue desactivada en configuracion.
    const byFinancer = records.reduce((acc, record) => {
        const name = record.financer_name || 'Sin financiadora';
        if (!acc[name]) {
            acc[name] = {
                count: 0,
                total_amount: 0,
                total_initial: 0,
                total_financed: 0,
                total_paid: 0,
            };
        }
        acc[name].count += 1;
        acc[name].total_amount += Number(record.total_price || 0);
        acc[name].total_initial += Number(record.initial_payment || 0);
        acc[name].total_financed += Number(record.financed_amount || 0);
        acc[name].total_paid += Number(record.financer_paid_amount || 0);
        return acc;
    }, {});

    const totalPendiente = Number(summary?.total_pending_from_financers ?? Object.values(byFinancer).reduce((s, d) => s + (d.total_financed - d.total_paid), 0));

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <RefreshCw size={28} className="text-indigo-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header con resumen */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-wide">Ventas financiadas</p>
                    <p className="text-xl font-black text-slate-900 mt-1">{fmt(summary?.total_amount)}</p>
                    <p className="text-xs text-slate-400 mt-1">{summary?.total_count || 0} operaciones</p>
                </div>
                <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4 shadow-sm">
                    <p className="text-[11px] font-black text-emerald-600 uppercase tracking-wide">Iniciales en caja</p>
                    <p className="text-xl font-black text-emerald-700 mt-1">{fmt(summary?.total_initial_collected)}</p>
                    <p className="text-xs text-emerald-600 mt-1">No es deuda de financiera</p>
                </div>
                <div className="bg-amber-50 rounded-xl border border-amber-200 p-4 shadow-sm">
                    <p className="text-[11px] font-black text-amber-600 uppercase tracking-wide">Por cobrar</p>
                    <p className="text-xl font-black text-amber-700 mt-1">{fmt(totalPendiente)}</p>
                    <p className="text-xs text-amber-600 mt-1">{summary?.pending_count || 0} pendientes · {summary?.partial_count || 0} parciales</p>
                </div>
                <div className="bg-blue-50 rounded-xl border border-blue-200 p-4 shadow-sm">
                    <p className="text-[11px] font-black text-blue-600 uppercase tracking-wide">Recibido de financieras</p>
                    <p className="text-xl font-black text-blue-700 mt-1">{fmt(summary?.total_received_from_financers)}</p>
                    <p className="text-xs text-blue-600 mt-1">{financers.length} configuradas</p>
                </div>
            </div>

            {/* Tabs vista */}
            <div className="flex items-center gap-3">
                <div className="flex bg-slate-100 rounded-lg p-1 gap-1 shadow-inner shadow-slate-200/60">
                    {[
                        { id: 'por-empresa', label: 'Por empresa' },
                        { id: 'detalle', label: 'Detalle' },
                    ].map(v => (
                        <button key={v.id} onClick={() => setView(v.id)}
                            className={`px-3 py-2 rounded-md text-xs font-black transition-all ${view === v.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                            {v.label}
                        </button>
                    ))}
                </div>
                <button onClick={load} className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-indigo-600 transition-colors">
                    <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                </button>
            </div>

            {/* Vista por empresa */}
            {view === 'por-empresa' && (
                <div className="space-y-3">
                    {Object.keys(byFinancer).length === 0 ? (
                        <div className="text-center py-16 text-slate-400">
                            <Building2 size={40} className="mx-auto mb-3 opacity-30" />
                            <p className="font-semibold">Sin registros de financiamiento</p>
                        </div>
                    ) : Object.entries(byFinancer).map(([name, data]) => (
                        <FinancerSummaryCard
                            key={name}
                            name={name}
                            data={data}
                            isExpanded={expandedFinancer === name}
                            onToggle={() => setExpandedFinancer(expandedFinancer === name ? null : name)}
                        />
                    ))}
                </div>
            )}

            {/* Vista detalle */}
            {view === 'detalle' && (
                <>
                    {/* Filtros */}
                    <div className="flex flex-wrap gap-3">
                        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                            className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
                            <option value="">Todos los estados</option>
                            <option value="PENDING">Pendiente</option>
                            <option value="PARTIAL">Parcial</option>
                            <option value="COMPLETED">Pagado</option>
                        </select>
                        <select value={filterFinancer} onChange={e => setFilterFinancer(e.target.value)}
                            className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
                            <option value="">Todas las financiadoras</option>
                            {financers.map(f => <option key={f?.id || f} value={f?.name || f}>{f?.name || f}</option>)}
                        </select>
                        <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)}
                            className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                        <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)}
                            className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                    </div>

                    {records.length === 0 ? (
                        <div className="text-center py-16 text-slate-400">
                            <Building2 size={40} className="mx-auto mb-3 opacity-30" />
                            <p className="font-semibold">Sin registros</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                            {records.map(r => (
                                <FinancingCard key={r.id} record={r} onUpdate={setUpdateRecord} onDelete={handleDelete} />
                            ))}
                        </div>
                    )}
                </>
            )}

            {/* Modal pago */}
            {updateRecord && (
                <UpdatePaymentModal
                    record={updateRecord}
                    onClose={() => setUpdateRecord(null)}
                    onSuccess={handleRecordUpdated}
                />
            )}
        </div>
    );
}
