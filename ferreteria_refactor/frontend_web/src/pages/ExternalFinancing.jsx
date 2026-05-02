import { useState, useEffect, useCallback } from 'react';
import apiClient from '../config/axios';
import { toast } from 'react-hot-toast';
import {
    Building2, Plus, Search, Filter, CheckCircle2, Clock, Calendar,
    DollarSign, ChevronDown, ChevronUp, AlertCircle, X, Loader2, RefreshCw,
    TrendingUp, Wallet, CreditCard, User, FileText, Hash, ChevronRight, Edit3, Trash2
} from 'lucide-react';
import clsx from 'clsx';

// ─── Configs ──────────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
    PENDING:   { label: 'Pendiente',  color: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200',   icon: Clock },
    PARTIAL:   { label: 'Parcial',    color: 'text-blue-700',    bg: 'bg-blue-50',    border: 'border-blue-200',    icon: AlertCircle },
    COMPLETED: { label: 'Completado', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: CheckCircle2 },
};
const getStatus = (s) => STATUS_CONFIG[s] || STATUS_CONFIG.PENDING;

const FREQ_OPTIONS = [
    { value: 'semanal',    label: 'Semanal' },
    { value: 'quincenal',  label: 'Quincenal' },
    { value: 'mensual',    label: 'Mensual' },
];

const fmt = (n) => `$${Number(n || 0).toFixed(2)}`;
const fmtDate = (d) => new Date(d).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' });

// ─── Modal Nuevo Registro ─────────────────────────────────────────────────────
const NewFinancingModal = ({ financers, onClose, onSuccess }) => {
    const [step, setStep] = useState(1); // 1=buscar venta, 2=datos financiamiento
    const [saleSearch, setSaleSearch] = useState('');
    const [saleResults, setSaleResults] = useState([]);
    const [selectedSale, setSelectedSale] = useState(null);
    const [searching, setSearching] = useState(false);
    const [saving, setSaving] = useState(false);

    const [form, setForm] = useState({
        financer_payment_method_id: '',
        total_price: '',
        initial_payment: '',
        initial_currency: 'USD',
        financed_amount: '',
        installments: '',
        installment_amount: '',
        installment_frequency: 'mensual',
        notes: '',
    });

    const searchSales = async () => {
        if (!saleSearch.trim()) return;
        setSearching(true);
        try {
            const res = await apiClient.get('/external-financing/search-sales', {
                params: { q: saleSearch }
            });
            setSaleResults(Array.isArray(res.data) ? res.data : []);
        } catch {
            toast.error('Error buscando ventas');
        } finally {
            setSearching(false);
        }
    };

    const selectSale = (sale) => {
        setSelectedSale(sale);
        setForm(f => ({
            ...f,
            total_price: Number(sale.total_amount).toFixed(2),
        }));
        setStep(2);
    };

    // Auto-calcular monto financiado
    useEffect(() => {
        const total = parseFloat(form.total_price) || 0;
        const initial = parseFloat(form.initial_payment) || 0;
        setForm(f => ({ ...f, financed_amount: Math.max(0, total - initial).toFixed(2) }));
    }, [form.total_price, form.initial_payment]);

    const handleSave = async () => {
        if (!selectedSale || !form.financer_payment_method_id) {
            toast.error('Selecciona la venta y la financiadora');
            return;
        }
        setSaving(true);
        try {
            await apiClient.post('/external-financing/', {
                sale_id: selectedSale.id,
                customer_id: selectedSale.customer_id,
                financer_payment_method_id: parseInt(form.financer_payment_method_id),
                financer_name: financers.find(f => f.id === parseInt(form.financer_payment_method_id))?.name || '',
                total_price: parseFloat(form.total_price),
                initial_payment: parseFloat(form.initial_payment) || 0,
                initial_currency: form.initial_currency,
                financed_amount: parseFloat(form.financed_amount) || 0,
                installments: form.installments ? parseInt(form.installments) : null,
                installment_amount: form.installment_amount ? parseFloat(form.installment_amount) : null,
                installment_frequency: form.installment_frequency || null,
                notes: form.notes || null,
            });
            toast.success('Financiamiento registrado ✅');
            onSuccess();
            onClose();
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Error al guardar');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-slate-100">
                    <div>
                        <h2 className="font-black text-slate-800 text-lg">Nueva Venta Financiada</h2>
                        <p className="text-xs text-slate-400 mt-0.5">
                            {step === 1 ? 'Paso 1: Busca la venta realizada' : `Paso 2: Datos del financiamiento — Venta #${selectedSale?.id}`}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400">
                        <X size={18} />
                    </button>
                </div>

                <div className="p-5 space-y-4">
                    {/* PASO 1: Buscar venta */}
                    {step === 1 && (
                        <>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                                    <input
                                        type="text"
                                        placeholder="Busca por # venta, cliente, teléfono o IMEI del equipo..."
                                        value={saleSearch}
                                        onChange={e => setSaleSearch(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && searchSales()}
                                        className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    />
                                </div>
                                <button
                                    onClick={searchSales}
                                    disabled={searching}
                                    className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 disabled:opacity-50"
                                >
                                    {searching ? <Loader2 size={16} className="animate-spin" /> : 'Buscar'}
                                </button>
                            </div>

                            {saleResults.length > 0 && (
                                <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                                    {saleResults.map(sale => (
                                        <button
                                            key={sale.id}
                                            onClick={() => selectSale(sale)}
                                            className="w-full p-3 hover:bg-indigo-50 text-left transition-colors"
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex-1 min-w-0">
                                                    {/* Header */}
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-black text-indigo-600 text-sm">#{sale.id}</span>
                                                        <span className="text-[10px] text-slate-400">{fmtDate(sale.date)}</span>
                                                    </div>
                                                    {/* Cliente */}
                                                    {sale.customer_name && (
                                                        <div className="flex items-center gap-1 mt-0.5">
                                                            <User size={10} className="text-slate-400" />
                                                            <span className="text-xs font-semibold text-slate-600">{sale.customer_name}</span>
                                                            {sale.customer_phone && <span className="text-[10px] text-slate-400">· {sale.customer_phone}</span>}
                                                        </div>
                                                    )}
                                                    {/* Productos */}
                                                    {sale.products?.length > 0 && (
                                                        <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                                                            📦 {sale.products.join(', ')}
                                                        </div>
                                                    )}
                                                    {/* IMEIs */}
                                                    {sale.imeis?.length > 0 && (
                                                        <div className="flex flex-wrap gap-1 mt-1">
                                                            {sale.imeis.map(imei => (
                                                                <span key={imei} className="text-[9px] font-mono font-bold bg-indigo-50 text-indigo-600 border border-indigo-200 px-1.5 py-0.5 rounded">
                                                                    {imei}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {/* Métodos de pago */}
                                                    {sale.payments?.length > 0 && (
                                                        <div className="flex flex-wrap gap-1 mt-1">
                                                            {sale.payments.map((p, i) => (
                                                                <span key={i} className="text-[9px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                                                                    {p.method}: {p.currency === 'VES' ? 'Bs' : '$'}{Number(p.amount).toFixed(2)}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <div className="font-black text-slate-800 text-base">{fmt(sale.total_amount)}</div>
                                                    <ChevronRight size={14} className="text-indigo-400 ml-auto mt-1" />
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {saleResults.length === 0 && saleSearch && !searching && (
                                <p className="text-center text-slate-400 text-sm py-4">No se encontraron ventas</p>
                            )}
                        </>
                    )}

                    {/* PASO 2: Datos del financiamiento */}
                    {step === 2 && (
                        <>
                            {/* Info venta seleccionada */}
                            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 flex items-center justify-between">
                                <div>
                                    <div className="text-xs font-bold text-indigo-400 uppercase">Venta seleccionada</div>
                                    <div className="font-black text-indigo-800">#{selectedSale.id} — {fmt(selectedSale.total_amount)}</div>
                                    <div className="text-xs text-indigo-500">{selectedSale.customer?.name || 'Sin cliente'} · {fmtDate(selectedSale.date)}</div>
                                </div>
                                <button onClick={() => setStep(1)} className="text-xs text-indigo-500 font-bold hover:underline">
                                    Cambiar
                                </button>
                            </div>

                            {/* Financiadora */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                                    💳 Financiadora
                                </label>
                                <select
                                    value={form.financer_payment_method_id}
                                    onChange={e => setForm(f => ({ ...f, financer_payment_method_id: e.target.value }))}
                                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                >
                                    <option value="">Seleccionar financiadora...</option>
                                    {financers.map(f => (
                                        <option key={f.id} value={f.id}>{f.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Precios */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                                        Precio Total
                                    </label>
                                    <input
                                        type="number"
                                        value={form.total_price}
                                        onChange={e => setForm(f => ({ ...f, total_price: e.target.value }))}
                                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                        placeholder="0.00"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                                        Inicial Cobrado
                                    </label>
                                    <div className="flex gap-1">
                                        <select
                                            value={form.initial_currency}
                                            onChange={e => setForm(f => ({ ...f, initial_currency: e.target.value }))}
                                            className="border border-slate-200 rounded-xl px-2 py-2.5 text-xs font-bold focus:outline-none focus:border-indigo-500 bg-slate-50"
                                        >
                                            <option value="USD">USD</option>
                                            <option value="VES">Bs</option>
                                        </select>
                                        <input
                                            type="number"
                                            value={form.initial_payment}
                                            onChange={e => setForm(f => ({ ...f, initial_payment: e.target.value }))}
                                            className="flex-1 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Monto financiado (calculado automático) */}
                            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center justify-between">
                                <div>
                                    <div className="text-xs font-bold text-emerald-500 uppercase tracking-wider">Monto Financiado por la empresa</div>
                                    <div className="text-2xl font-black text-emerald-700 mt-0.5">{fmt(form.financed_amount)}</div>
                                </div>
                                <Building2 size={28} className="text-emerald-300" />
                            </div>

                            {/* Cuotas (referencial) */}
                            <div>
                                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                    Cuotas del cliente a la financiadora <span className="text-slate-300 font-normal">(referencial)</span>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    <div>
                                        <label className="block text-[10px] text-slate-400 mb-1">Nº cuotas</label>
                                        <input
                                            type="number"
                                            value={form.installments}
                                            onChange={e => setForm(f => ({ ...f, installments: e.target.value }))}
                                            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium focus:outline-none focus:border-indigo-500"
                                            placeholder="12"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] text-slate-400 mb-1">Monto c/u</label>
                                        <input
                                            type="number"
                                            value={form.installment_amount}
                                            onChange={e => setForm(f => ({ ...f, installment_amount: e.target.value }))}
                                            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium focus:outline-none focus:border-indigo-500"
                                            placeholder="0.00"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] text-slate-400 mb-1">Frecuencia</label>
                                        <select
                                            value={form.installment_frequency}
                                            onChange={e => setForm(f => ({ ...f, installment_frequency: e.target.value }))}
                                            className="w-full border border-slate-200 rounded-xl px-2 py-2 text-sm font-medium focus:outline-none focus:border-indigo-500"
                                        >
                                            {FREQ_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Notas */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Notas</label>
                                <textarea
                                    value={form.notes}
                                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500 resize-none"
                                    rows={2}
                                    placeholder="Observaciones adicionales..."
                                />
                            </div>

                            {/* Botones */}
                            <div className="flex gap-2 pt-2">
                                <button
                                    onClick={() => setStep(1)}
                                    className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50"
                                >
                                    Atrás
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                                    {saving ? 'Guardando...' : 'Registrar'}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

// ─── Modal actualizar pago de financiadora (simplificado) ────────────────────
const UpdatePaymentModal = ({ record, onClose, onSuccess }) => {
    const totalFinanciado = Number(record.financed_amount || 0);
    const yaPagado        = Number(record.financer_paid_amount || 0);
    const pendiente       = totalFinanciado - yaPagado;

    const [abono, setAbono] = useState('');
    const [saving, setSaving] = useState(false);

    // Calcular preview en tiempo real
    const abonoNum      = parseFloat(abono) || 0;
    const nuevoPagado   = Math.min(yaPagado + abonoNum, totalFinanciado);
    const nuevoStatus   = nuevoPagado >= totalFinanciado ? 'COMPLETED' : nuevoPagado > 0 ? 'PARTIAL' : record.financer_payment_status;
    const nuevoSt       = STATUS_CONFIG[nuevoStatus] || STATUS_CONFIG.PENDING;

    const handleSave = async () => {
        if (!abono || abonoNum <= 0) {
            toast.error('Ingresa el monto recibido');
            return;
        }
        if (abonoNum > pendiente + 0.01) {
            toast.error(`El abono no puede superar el pendiente (${fmt(pendiente)})`);
            return;
        }
        setSaving(true);
        try {
            const updated = await apiClient.put(`/external-financing/${record.id}`, {
                financer_paid_amount: nuevoPagado,
                financer_payment_status: nuevoStatus,
            });
            toast.success(nuevoStatus === 'COMPLETED' ? '✅ Pago completado' : '✅ Abono registrado');
            onSuccess(updated.data); // pasar data actualizada
            onClose();
        } catch {
            toast.error('Error al registrar el pago');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
                <div className="flex items-center justify-between p-5 border-b border-slate-100">
                    <div>
                        <h3 className="font-black text-slate-800">Registrar Pago</h3>
                        <p className="text-xs text-slate-400 mt-0.5">{record.financer_name} → Venta #{record.sale_id}</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100">
                        <X size={18} className="text-slate-400" />
                    </button>
                </div>
                <div className="p-5 space-y-4">

                    {/* Resumen actual */}
                    <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
                            <div className="text-[9px] font-bold text-slate-400 uppercase mb-1">Financiado</div>
                            <div className="text-sm font-black text-slate-700">{fmt(totalFinanciado)}</div>
                        </div>
                        <div className="bg-emerald-50 rounded-xl p-2.5 border border-emerald-100">
                            <div className="text-[9px] font-bold text-emerald-400 uppercase mb-1">Cobrado</div>
                            <div className="text-sm font-black text-emerald-700">{fmt(yaPagado)}</div>
                        </div>
                        <div className="bg-amber-50 rounded-xl p-2.5 border border-amber-100">
                            <div className="text-[9px] font-bold text-amber-400 uppercase mb-1">Pendiente</div>
                            <div className="text-sm font-black text-amber-700">{fmt(pendiente)}</div>
                        </div>
                    </div>

                    {/* Input abono */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                            ¿Cuánto pagó {record.financer_name}?
                        </label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">$</span>
                            <input
                                type="number"
                                autoFocus
                                value={abono}
                                onChange={e => setAbono(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSave()}
                                className="w-full pl-7 pr-4 py-3 border-2 border-indigo-200 rounded-xl text-lg font-black focus:outline-none focus:border-indigo-500 text-center tracking-tight"
                                placeholder="0.00"
                                max={pendiente}
                            />
                        </div>
                        {pendiente > 0 && (
                            <button
                                onClick={() => setAbono(pendiente.toFixed(2))}
                                className="mt-1.5 text-xs font-bold text-indigo-500 hover:text-indigo-700 transition-colors"
                            >
                                Marcar todo como pagado → {fmt(pendiente)}
                            </button>
                        )}
                    </div>

                    {/* Preview del resultado */}
                    {abonoNum > 0 && (
                        <div className={clsx('rounded-xl p-3 border flex items-center justify-between', nuevoSt.bg, nuevoSt.border)}>
                            <div>
                                <div className="text-[10px] font-bold text-slate-400 uppercase">Nuevo estado</div>
                                <div className={clsx('text-sm font-black mt-0.5', nuevoSt.color)}>{nuevoSt.label}</div>
                            </div>
                            <div className="text-right">
                                <div className="text-[10px] font-bold text-slate-400 uppercase">Total cobrado</div>
                                <div className={clsx('text-base font-black', nuevoSt.color)}>{fmt(nuevoPagado)}</div>
                            </div>
                        </div>
                    )}

                    <button
                        onClick={handleSave}
                        disabled={saving || abonoNum <= 0}
                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
                    >
                        {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                        {saving ? 'Registrando...' : 'Registrar Pago'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Card de registro ─────────────────────────────────────────────────────────
const FinancingCard = ({ record, onUpdate, onDelete }) => {
    const st = getStatus(record.financer_payment_status);
    const Icon = st.icon;
    const pending = Number(record.financed_amount) - Number(record.financer_paid_amount);
    const [commissions, setCommissions] = useState([]);
    const [showComm, setShowComm] = useState(false);
    const [loadingComm, setLoadingComm] = useState(false);

    const loadCommissions = async () => {
        if (commissions.length > 0) { setShowComm(s => !s); return; }
        setLoadingComm(true);
        try {
            const res = await apiClient.get(`/external-financing/commissions/${record.sale_id}`);
            setCommissions(Array.isArray(res.data) ? res.data : []);
            setShowComm(true);
        } catch { }
        finally { setLoadingComm(false); }
    };

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-all">
            {/* Header */}
            <div className="flex items-center justify-between p-4 bg-slate-50/50 border-b border-slate-100">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                        <Building2 size={18} className="text-indigo-600" />
                    </div>
                    <div>
                        <div className="font-black text-slate-800">{record.financer_name}</div>
                        <div className="text-xs text-slate-400">Venta #{record.sale_id} · {fmtDate(record.created_at)}</div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className={clsx('flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black border', st.bg, st.color, st.border)}>
                        <Icon size={10} /> {st.label}
                    </span>
                </div>
            </div>

            {/* Body */}
            <div className="p-4 grid grid-cols-3 gap-3">
                <div className="flex flex-col items-center bg-slate-50 rounded-xl p-2.5 border border-slate-100">
                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Inicial</div>
                    <div className="text-base font-black text-slate-800">{fmt(record.initial_payment)}</div>
                    <div className="text-[9px] text-slate-400">{record.initial_currency}</div>
                </div>
                <div className="flex flex-col items-center bg-indigo-50 rounded-xl p-2.5 border border-indigo-100">
                    <div className="text-[9px] font-bold text-indigo-400 uppercase tracking-wider mb-1">Financiado</div>
                    <div className="text-base font-black text-indigo-700">{fmt(record.financed_amount)}</div>
                    <div className="text-[9px] text-indigo-400">por {record.financer_name}</div>
                </div>
                <div className={clsx('flex flex-col items-center rounded-xl p-2.5 border', pending > 0 ? 'bg-amber-50 border-amber-100' : 'bg-emerald-50 border-emerald-100')}>
                    <div className={clsx('text-[9px] font-bold uppercase tracking-wider mb-1', pending > 0 ? 'text-amber-500' : 'text-emerald-500')}>
                        {pending > 0 ? 'Pendiente' : 'Cobrado'}
                    </div>
                    <div className={clsx('text-base font-black', pending > 0 ? 'text-amber-700' : 'text-emerald-700')}>
                        {fmt(pending > 0 ? pending : record.financer_paid_amount)}
                    </div>
                </div>
            </div>

            {/* Cliente + cuotas */}
            {(record.customer || record.installments) && (
                <div className="px-4 pb-3 flex items-center gap-4 text-xs text-slate-500">
                    {record.customer && (
                        <div className="flex items-center gap-1">
                            <User size={11} /> {record.customer.name}
                        </div>
                    )}
                    {record.installments && (
                        <div className="flex items-center gap-1">
                            <Hash size={11} /> {record.installments} cuotas de {fmt(record.installment_amount)} ({record.installment_frequency})
                        </div>
                    )}
                    {record.notes && (
                        <div className="flex items-center gap-1 truncate">
                            <FileText size={11} /> {record.notes}
                        </div>
                    )}
                </div>
            )}

            {/* Comisiones del vendedor */}
            <div className="px-4 pb-2">
                <button
                    onClick={loadCommissions}
                    className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-indigo-600 transition-colors"
                >
                    <DollarSign size={12} />
                    Comisiones
                    {loadingComm ? <Loader2 size={11} className="animate-spin" /> : showComm ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                </button>

                {showComm && (
                    <div className="mt-2 space-y-1">
                        {commissions.length === 0 ? (
                            <p className="text-[10px] text-slate-400 italic">Sin comisiones registradas para esta venta</p>
                        ) : commissions.map(c => (
                            <div key={c.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-2.5 py-1.5 border border-slate-100">
                                <div>
                                    <span className="text-[10px] font-bold text-slate-600">{c.user_name}</span>
                                    <span className="text-[9px] text-slate-400 ml-1.5">{c.commission_role === 'VENDOR' ? 'Vendedor' : 'Técnico'} · {c.percentage_applied}%</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-black text-emerald-600">${Number(c.amount).toFixed(2)}</span>
                                    <span className={clsx(
                                        'text-[8px] font-bold px-1.5 py-0.5 rounded-full',
                                        c.status === 'PENDING' ? 'bg-amber-100 text-amber-600' :
                                        c.status === 'PAID'    ? 'bg-emerald-100 text-emerald-600' :
                                                                 'bg-slate-100 text-slate-400'
                                    )}>
                                        {c.status === 'PENDING' ? 'Pendiente' : c.status === 'PAID' ? 'Pagada' : c.status}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Acciones */}
            <div className="px-4 pb-4 flex gap-2">
                <button
                    onClick={() => onUpdate(record)}
                    disabled={record.financer_payment_status === 'COMPLETED'}
                    className={clsx(
                        'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all',
                        record.financer_payment_status === 'COMPLETED'
                            ? 'bg-emerald-50 text-emerald-500 border border-emerald-200 cursor-not-allowed'
                            : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    )}
                >
                    {record.financer_payment_status === 'COMPLETED'
                        ? <><CheckCircle2 size={12} /> Pagado Completo</>
                        : <><Edit3 size={12} /> Registrar Pago</>
                    }
                </button>
                <button
                    onClick={() => onDelete(record)}
                    className="p-2 border border-slate-200 rounded-xl text-slate-400 hover:text-rose-500 hover:border-rose-200 transition-all"
                >
                    <Trash2 size={14} />
                </button>
            </div>
        </div>
    );
};

// ─── Página principal ─────────────────────────────────────────────────────────
const ExternalFinancing = () => {
    const [records, setRecords] = useState([]);
    const [summary, setSummary] = useState(null);
    const [financers, setFinancers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showNew, setShowNew] = useState(false);
    const [updateRecord, setUpdateRecord] = useState(null);
    const [filterStatus, setFilterStatus] = useState('');
    const [filterDateFrom, setFilterDateFrom] = useState('');
    const [filterDateTo, setFilterDateTo] = useState('');
    const [filterFinancer, setFilterFinancer] = useState('');

    const load = useCallback(async () => {
        setIsLoading(true);
        try {
            const [recRes, sumRes, finRes] = await Promise.all([
                apiClient.get('/external-financing/', { params: { status: filterStatus || undefined, financer_name: filterFinancer || undefined, date_from: filterDateFrom || undefined, date_to: filterDateTo || undefined } }),
                apiClient.get('/external-financing/summary'),
                apiClient.get('/external-financing/financers/list'),
            ]);
            setRecords(Array.isArray(recRes.data) ? recRes.data : []);
            setSummary(sumRes.data);
            setFinancers(Array.isArray(finRes.data) ? finRes.data : []);
        } catch {
            toast.error('Error cargando registros');
        } finally {
            setIsLoading(false);
        }
    }, [filterStatus, filterFinancer, filterDateFrom, filterDateTo]);

    useEffect(() => { load(); }, [load]);

    // Actualizar una card específica sin recargar todo
    const handleRecordUpdated = (updatedRecord) => {
        if (!updatedRecord) { load(); return; }
        setRecords(prev => prev.map(r => r.id === updatedRecord.id ? updatedRecord : r));
        // Actualizar summary también
        apiClient.get('/external-financing/summary').then(res => setSummary(res.data)).catch(() => {});
    };

    const handleDelete = async (record) => {
        if (!confirm(`¿Eliminar el registro de financiamiento de Venta #${record.sale_id}?`)) return;
        try {
            await apiClient.delete(`/external-financing/${record.id}`);
            toast.success('Registro eliminado');
            setRecords(prev => prev.filter(r => r.id !== record.id));
            apiClient.get('/external-financing/summary').then(res => setSummary(res.data)).catch(() => {});
        } catch {
            toast.error('Error al eliminar');
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-6 space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                        <Building2 className="text-indigo-600" size={26} />
                        Créditos Externos
                    </h1>
                    <p className="text-sm text-slate-400 mt-0.5">Ventas financiadas por Cashea, Krece y otras</p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={load} className="p-2 rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-indigo-600 hover:border-indigo-300 transition-all">
                        <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                    </button>
                    <button
                        onClick={() => setShowNew(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm shadow-md shadow-indigo-200 hover:-translate-y-0.5 transition-all"
                    >
                        <Plus size={16} /> Nueva
                    </button>
                </div>
            </div>

            {/* KPIs */}
            {summary && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1"><CreditCard size={10} /> Total financiado</div>
                        <div className="text-xl font-black text-slate-800">{fmt(summary.total_financed)}</div>
                        <div className="text-xs text-slate-400 mt-0.5">{summary.total_records} registros</div>
                    </div>
                    <div className="bg-emerald-50 rounded-2xl border border-emerald-200 p-4 shadow-sm">
                        <div className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider mb-1 flex items-center gap-1"><Wallet size={10} /> Iniciales cobrados</div>
                        <div className="text-xl font-black text-emerald-700">{fmt(summary.total_initial_collected)}</div>
                        <div className="text-xs text-emerald-400 mt-0.5">Dinero en tu caja</div>
                    </div>
                    <div className="bg-amber-50 rounded-2xl border border-amber-200 p-4 shadow-sm">
                        <div className="text-[10px] font-bold text-amber-500 uppercase tracking-wider mb-1 flex items-center gap-1"><Clock size={10} /> Pendiente por cobrar</div>
                        <div className="text-xl font-black text-amber-700">{fmt(summary.total_pending_from_financers)}</div>
                        <div className="text-xs text-amber-400 mt-0.5">Las financiadoras te deben esto</div>
                    </div>
                    <div className="bg-indigo-50 rounded-2xl border border-indigo-200 p-4 shadow-sm">
                        <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider mb-1 flex items-center gap-1"><TrendingUp size={10} /> Cobrado de financiadoras</div>
                        <div className="text-xl font-black text-indigo-700">{fmt(summary.total_received_from_financers)}</div>
                        <div className="text-xs text-indigo-400 mt-0.5">Ya recibido</div>
                    </div>
                </div>
            )}

            {/* Filtros */}
            <div className="flex flex-wrap gap-2 items-center">
                {/* Estado */}
                <select
                    value={filterStatus}
                    onChange={e => setFilterStatus(e.target.value)}
                    className="border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium bg-white focus:outline-none focus:border-indigo-500"
                >
                    <option value="">Todos los estados</option>
                    <option value="PENDING">Pendiente</option>
                    <option value="PARTIAL">Parcial</option>
                    <option value="COMPLETED">Completado</option>
                </select>

                {/* Financiadora */}
                <select
                    value={filterFinancer}
                    onChange={e => setFilterFinancer(e.target.value)}
                    className="border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium bg-white focus:outline-none focus:border-indigo-500"
                >
                    <option value="">Todas las financiadoras</option>
                    {financers.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}
                </select>

                {/* Filtro por fecha */}
                <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-2">
                    <Calendar size={14} className="text-slate-400" />
                    <input
                        type="date"
                        value={filterDateFrom}
                        onChange={e => setFilterDateFrom(e.target.value)}
                        className="text-sm font-medium text-slate-600 bg-transparent outline-none"
                        title="Desde"
                    />
                    <span className="text-slate-300 text-xs font-bold">→</span>
                    <input
                        type="date"
                        value={filterDateTo}
                        onChange={e => setFilterDateTo(e.target.value)}
                        className="text-sm font-medium text-slate-600 bg-transparent outline-none"
                        title="Hasta"
                    />
                </div>

                {/* Limpiar filtros */}
                {(filterStatus || filterFinancer || filterDateFrom || filterDateTo) && (
                    <button
                        onClick={() => { setFilterStatus(''); setFilterFinancer(''); setFilterDateFrom(''); setFilterDateTo(''); }}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-500 border border-rose-200 hover:bg-rose-50 transition-all"
                    >
                        <X size={13} /> Limpiar
                    </button>
                )}
            </div>

            {/* Lista */}
            {isLoading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 size={36} className="animate-spin text-indigo-400" />
                </div>
            ) : records.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                    <Building2 size={48} className="opacity-20 mb-3" />
                    <p className="font-semibold">No hay ventas financiadas registradas</p>
                    {financers.length === 0 && (
                        <p className="text-sm mt-2 text-center max-w-xs">
                            Primero activa el toggle <strong>"💳 Financiadora Externa"</strong> en algún método de pago desde <strong>Configuración → Métodos de Pago</strong>
                        </p>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {records.map(r => (
                        <FinancingCard
                            key={r.id}
                            record={r}
                            onUpdate={setUpdateRecord}
                            onDelete={handleDelete}
                        />
                    ))}
                </div>
            )}

            {/* Modales */}
            {showNew && (
                <NewFinancingModal
                    financers={financers}
                    onClose={() => setShowNew(false)}
                    onSuccess={load}
                />
            )}
            {updateRecord && (
                <UpdatePaymentModal
                    record={updateRecord}
                    onClose={() => setUpdateRecord(null)}
                    onSuccess={handleRecordUpdated}
                />
            )}
        </div>
    );
};

export default ExternalFinancing;
