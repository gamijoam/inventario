import { useEffect, useMemo, useState } from 'react';
import { Archive, CalendarClock, CheckCircle2, Clock, CreditCard, DollarSign, Eye, FileText, Loader2, Plus, RefreshCw, Search, ShieldCheck, X, XCircle } from 'lucide-react';
import apiClient from '../../../config/axios';
import { toast } from 'react-hot-toast';
import { getApiErrorMessage } from '../../../utils/apiErrors';
import { useAuth } from '../../../context/AuthContext';
import { useCash } from '../../../context/CashContext';
import { PERMISSIONS } from '../../../config/permissions';

const STATUS_META = {
    ACTIVE: { label: 'Activo', icon: Clock, className: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
    PAID: { label: 'Pagado', icon: ShieldCheck, className: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
    COMPLETED: { label: 'Entregado', icon: CheckCircle2, className: 'bg-slate-100 text-slate-700 border-slate-200' },
    CANCELLED: { label: 'Cancelado', icon: XCircle, className: 'bg-rose-50 text-rose-700 border-rose-100' },
    EXPIRED: { label: 'Vencido', icon: CalendarClock, className: 'bg-amber-50 text-amber-700 border-amber-100' },
};

const money = (value, currency = 'USD') => {
    const number = Number(value || 0);
    const prefix = currency === 'USD' ? '$' : `${currency} `;
    return `${prefix}${number.toFixed(2)}`;
};

const formatDate = (value) => {
    if (!value) return 'Sin fecha';
    try {
        return new Date(value).toLocaleString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
        return value;
    }
};

const daysLeft = (value) => {
    if (!value) return null;
    const diff = new Date(value).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

const StatusBadge = ({ status }) => {
    const meta = STATUS_META[status] || STATUS_META.ACTIVE;
    const Icon = meta.icon;
    return (
        <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-black ${meta.className}`}>
            <Icon size={13} /> {meta.label}
        </span>
    );
};

const ApartadosTab = () => {
    const { hasPermission } = useAuth();
    const { session } = useCash();
    const canAddPayment = hasPermission(PERMISSIONS.LAYAWAYS_PAYMENTS_ADD);
    const canCancel = hasPermission(PERMISSIONS.LAYAWAYS_CANCEL);
    const canExtend = hasPermission(PERMISSIONS.LAYAWAYS_EXTEND);
    const canComplete = hasPermission(PERMISSIONS.LAYAWAYS_COMPLETE);

    const [layaways, setLayaways] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('ACTIVE');
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [paymentForm, setPaymentForm] = useState({ amount: '', currency: 'USD', payment_method: 'Efectivo', reference: '' });
    const [completeForm, setCompleteForm] = useState({ payment_method: 'Efectivo', reference: '', notes: '' });
    const [extendDate, setExtendDate] = useState('');
    const [processing, setProcessing] = useState(false);

    const fetchLayaways = async () => {
        setLoading(true);
        try {
            const params = { limit: 300 };
            if (statusFilter !== 'ALL') params.status = statusFilter;
            const response = await apiClient.get('/layaways', { params });
            setLayaways(Array.isArray(response.data?.items) ? response.data.items : []);
            setTotal(response.data?.total || 0);
        } catch (error) {
            toast.error(getApiErrorMessage(error, 'No se pudieron cargar los apartados'));
        } finally {
            setLoading(false);
        }
    };

    const fetchDetail = async (id) => {
        setDetailLoading(true);
        try {
            const response = await apiClient.get(`/layaways/${id}`);
            setSelected(response.data);
        } catch (error) {
            toast.error(getApiErrorMessage(error, 'No se pudo cargar el apartado'));
        } finally {
            setDetailLoading(false);
        }
    };

    useEffect(() => {
        fetchLayaways();
    }, [statusFilter]);

    const filteredLayaways = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return layaways;
        return layaways.filter((item) => {
            const haystack = [item.code, item.customer_name, item.status, item.warehouse_name, ...(item.items || []).map((line) => `${line.product_name} ${line.serial_number || ''}`)].join(' ').toLowerCase();
            return haystack.includes(q);
        });
    }, [layaways, search]);

    const summary = useMemo(() => {
        return layaways.reduce((acc, item) => {
            acc.totalAmount += Number(item.total_amount || 0);
            acc.paidAmount += Number(item.paid_amount || 0);
            acc.balanceAmount += Number(item.balance_amount || 0);
            if (item.status === 'ACTIVE') acc.active += 1;
            if (item.status === 'PAID') acc.paid += 1;
            const left = daysLeft(item.expires_at);
            if (item.status === 'ACTIVE' && left !== null && left <= 2) acc.dueSoon += 1;
            return acc;
        }, { totalAmount: 0, paidAmount: 0, balanceAmount: 0, active: 0, paid: 0, dueSoon: 0 });
    }, [layaways]);

    const handlePayment = async () => {
        if (!selected) return;
        const amount = Number(paymentForm.amount);
        if (!amount || amount <= 0) {
            toast.error('Coloca un monto valido');
            return;
        }
        setProcessing(true);
        try {
            const response = await apiClient.post(`/layaways/${selected.id}/payments`, {
                amount,
                currency: paymentForm.currency,
                exchange_rate: 1,
                payment_method: paymentForm.payment_method,
                reference: paymentForm.reference || null,
                session_id: session?.id || null,
            });
            setSelected(response.data);
            setPaymentForm({ amount: '', currency: 'USD', payment_method: 'Efectivo', reference: '' });
            await fetchLayaways();
            toast.success('Abono registrado');
        } catch (error) {
            toast.error(getApiErrorMessage(error, 'No se pudo registrar el abono'));
        } finally {
            setProcessing(false);
        }
    };

    const handleExtend = async () => {
        if (!selected || !extendDate) return;
        setProcessing(true);
        try {
            const response = await apiClient.put(`/layaways/${selected.id}/extend`, { expires_at: new Date(extendDate).toISOString() });
            setSelected(response.data);
            setExtendDate('');
            await fetchLayaways();
            toast.success('Apartado prorrogado');
        } catch (error) {
            toast.error(getApiErrorMessage(error, 'No se pudo prorrogar el apartado'));
        } finally {
            setProcessing(false);
        }
    };

    const handleCancel = async () => {
        if (!selected) return;
        const reason = window.prompt('Motivo de cancelacion del apartado:');
        if (reason === null) return;
        setProcessing(true);
        try {
            const response = await apiClient.put(`/layaways/${selected.id}/cancel`, { reason });
            setSelected(response.data);
            await fetchLayaways();
            toast.success('Apartado cancelado y productos liberados');
        } catch (error) {
            toast.error(getApiErrorMessage(error, 'No se pudo cancelar el apartado'));
        } finally {
            setProcessing(false);
        }
    };

    const handleComplete = async () => {
        if (!selected) return;
        const balance = Number(selected.balance_amount || 0);
        const needsPayment = balance > 0.0001;
        if (!window.confirm(needsPayment ? 'Se registrara el pago final y se entregara el apartado. ¿Continuar?' : 'Se entregara el apartado y se generara la venta final. ¿Continuar?')) return;
        setProcessing(true);
        try {
            const payload = {
                session_id: session?.id || null,
                notes: completeForm.notes || null,
            };
            if (needsPayment) {
                payload.final_payment = {
                    amount: balance,
                    currency: selected.currency || 'USD',
                    exchange_rate: 1,
                    payment_method: completeForm.payment_method,
                    reference: completeForm.reference || null,
                    session_id: session?.id || null,
                };
            }
            const response = await apiClient.post(`/layaways/${selected.id}/complete`, payload);
            setSelected(response.data);
            setCompleteForm({ payment_method: 'Efectivo', reference: '', notes: '' });
            await fetchLayaways();
            toast.success(`Apartado entregado${response.data?.sale_id ? ` · Venta #${response.data.sale_id}` : ''}`);
        } catch (error) {
            toast.error(getApiErrorMessage(error, 'No se pudo entregar el apartado'));
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div className="space-y-2">
            <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-indigo-50 text-indigo-600">
                            <Archive size={18} />
                        </div>
                        <div>
                            <p className="text-xs font-black uppercase tracking-widest text-slate-400">Ventas reservadas</p>
                            <h2 className="text-lg font-black text-slate-950">Apartados</h2>
                            <p className="text-xs font-medium text-slate-500">Controla productos reservados, abonos, vencimientos y liberaciones.</p>
                        </div>
                    </div>
                    <button className="inline-flex h-10 items-center gap-2 rounded-md bg-indigo-600 px-4 text-sm font-black text-white shadow-sm opacity-60" title="Se activara al integrar Apartados con POS">
                        <Plus size={17} /> Nuevo desde POS
                    </button>
                </div>
            </div>

            <div className="grid gap-2 md:grid-cols-4">
                <MetricCard label="Apartados" value={total} icon={FileText} tone="indigo" />
                <MetricCard label="Abonado" value={money(summary.paidAmount)} icon={DollarSign} tone="emerald" />
                <MetricCard label="Pendiente" value={money(summary.balanceAmount)} icon={CreditCard} tone="amber" />
                <MetricCard label="Por vencer" value={summary.dueSoon} icon={CalendarClock} tone="rose" />
            </div>

            <div className="grid gap-2 xl:grid-cols-[minmax(0,1fr)_380px]">
                <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                    <div className="flex flex-col gap-2 border-b border-slate-100 p-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex flex-wrap gap-2">
                            {['ACTIVE', 'PAID', 'COMPLETED', 'CANCELLED', 'EXPIRED', 'ALL'].map((status) => (
                                <button
                                    key={status}
                                    onClick={() => setStatusFilter(status)}
                                    className={`h-9 rounded-md border px-3 text-xs font-black transition-colors ${statusFilter === status ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                                >
                                    {status === 'ALL' ? 'Todos' : (STATUS_META[status]?.label || status)}
                                </button>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <div className="flex h-8 min-w-[240px] items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2.5">
                                <Search size={16} className="text-slate-400" />
                                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar codigo, cliente, producto..." className="w-full bg-transparent text-sm font-bold outline-none placeholder:text-slate-400" />
                            </div>
                            <button onClick={fetchLayaways} className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-50" title="Actualizar">
                                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                            </button>
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex h-72 items-center justify-center text-slate-400"><Loader2 className="mr-2 animate-spin" /> Cargando apartados...</div>
                    ) : filteredLayaways.length === 0 ? (
                        <div className="flex h-72 flex-col items-center justify-center text-center text-slate-400">
                            <Archive size={42} className="mb-3 opacity-40" />
                            <p className="font-black text-slate-700">No hay apartados en esta vista</p>
                            <p className="text-sm">Cuando se creen desde POS apareceran aqui.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {filteredLayaways.map((item) => {
                                const left = daysLeft(item.expires_at);
                                return (
                                    <button key={item.id} onClick={() => fetchDetail(item.id)} className="grid w-full gap-2 px-3 py-2.5 text-left transition-colors hover:bg-indigo-50/40 lg:grid-cols-[1fr_130px_130px_110px] lg:items-center">
                                        <div className="min-w-0">
                                            <div className="mb-1 flex flex-wrap items-center gap-1.5">
                                                <span className="font-black text-slate-950">{item.code}</span>
                                                <StatusBadge status={item.status} />
                                            </div>
                                            <p className="truncate text-sm font-bold text-slate-600">{item.customer_name || 'Cliente sin asignar'}</p>
                                            <p className="truncate text-xs text-slate-400">{(item.items || []).map((line) => line.product_name).join(', ')}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-black uppercase tracking-widest text-slate-400">Total</p>
                                            <p className="font-black text-slate-900">{money(item.total_amount, item.currency)}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-black uppercase tracking-widest text-slate-400">Pendiente</p>
                                            <p className="font-black text-amber-700">{money(item.balance_amount, item.currency)}</p>
                                        </div>
                                        <div className="flex items-center justify-between gap-2 lg:justify-end">
                                            <div className="text-right">
                                                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Vence</p>
                                                <p className={`text-sm font-black ${left !== null && left <= 2 && item.status === 'ACTIVE' ? 'text-rose-600' : 'text-slate-700'}`}>{left === null ? '-' : `${left} dias`}</p>
                                            </div>
                                            <Eye size={16} className="text-slate-400" />
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                <aside className="rounded-lg border border-slate-200 bg-white shadow-sm">
                    {!selected ? (
                        <div className="flex h-full min-h-[440px] flex-col items-center justify-center p-6 text-center text-slate-400">
                            <Archive size={44} className="mb-3 opacity-40" />
                            <p className="font-black text-slate-700">Selecciona un apartado</p>
                            <p className="text-sm">Veras productos, abonos y acciones disponibles.</p>
                        </div>
                    ) : detailLoading ? (
                        <div className="flex h-72 items-center justify-center text-slate-400"><Loader2 className="mr-2 animate-spin" /> Cargando detalle...</div>
                    ) : (
                        <div className="flex max-h-[calc(100vh-210px)] flex-col">
                            <div className="border-b border-slate-100 p-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-xs font-black uppercase tracking-widest text-slate-400">Detalle</p>
                                        <h3 className="text-lg font-black text-slate-950">{selected.code}</h3>
                                        <p className="text-sm font-bold text-slate-500">{selected.customer_name || 'Sin cliente'}</p>
                                    </div>
                                    <button onClick={() => setSelected(null)} className="rounded-md border border-slate-200 p-2 text-slate-400 hover:bg-slate-50"><X size={16} /></button>
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2"><StatusBadge status={selected.status} /><span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-black text-slate-500">Vence: {formatDate(selected.expires_at)}</span></div>
                            </div>

                            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
                                <div className="grid grid-cols-3 gap-2">
                                    <MiniTotal label="Total" value={money(selected.total_amount, selected.currency)} />
                                    <MiniTotal label="Abonado" value={money(selected.paid_amount, selected.currency)} tone="emerald" />
                                    <MiniTotal label="Saldo" value={money(selected.balance_amount, selected.currency)} tone="amber" />
                                </div>

                                <section>
                                    <h4 className="mb-2 text-xs font-black uppercase tracking-widest text-slate-400">Productos reservados</h4>
                                    <div className="space-y-2">
                                        {(selected.items || []).map((line) => (
                                            <div key={line.id} className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <p className="truncate font-black text-slate-900">{line.product_name}</p>
                                                        <p className="text-xs font-bold text-slate-400">Cant. {line.quantity} · {money(line.unit_price, selected.currency)}</p>
                                                        {line.serial_number && <p className="mt-1 text-xs font-black text-indigo-600">IMEI: {line.serial_number}</p>}
                                                    </div>
                                                    <span className="font-black text-slate-900">{money(line.subtotal, selected.currency)}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </section>

                                <section>
                                    <h4 className="mb-2 text-xs font-black uppercase tracking-widest text-slate-400">Abonos</h4>
                                    <div className="space-y-2">
                                        {(selected.payments || []).length === 0 ? <p className="rounded-md bg-slate-50 p-3 text-sm font-bold text-slate-400">Sin abonos registrados.</p> : selected.payments.map((payment) => (
                                            <div key={payment.id} className="flex items-center justify-between rounded-md border border-slate-100 p-2.5">
                                                <div>
                                                    <p className="font-black text-slate-900">{money(payment.amount, payment.currency)}</p>
                                                    <p className="text-xs font-bold text-slate-400">{payment.payment_method} · {formatDate(payment.created_at)}</p>
                                                </div>
                                                <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-black text-emerald-700">{payment.status}</span>
                                            </div>
                                        ))}
                                    </div>
                                </section>

                                {canAddPayment && ['ACTIVE', 'PAID'].includes(selected.status) && Number(selected.balance_amount || 0) > 0 && (
                                    <section className="rounded-lg border border-indigo-100 bg-indigo-50 p-3">
                                        <h4 className="mb-2 text-xs font-black uppercase tracking-widest text-indigo-600">Registrar abono</h4>
                                        <div className="grid grid-cols-2 gap-2">
                                            <input type="number" min="0" step="0.01" value={paymentForm.amount} onChange={(event) => setPaymentForm({ ...paymentForm, amount: event.target.value })} placeholder="Monto" className="h-10 rounded-md border border-indigo-100 px-3 text-sm font-bold outline-none" />
                                            <select value={paymentForm.payment_method} onChange={(event) => setPaymentForm({ ...paymentForm, payment_method: event.target.value })} className="h-10 rounded-md border border-indigo-100 px-3 text-sm font-bold outline-none">
                                                <option>Efectivo</option><option>Punto de Venta</option><option>Pago Movil</option><option>Zelle</option><option>Transferencia</option>
                                            </select>
                                            <input value={paymentForm.reference} onChange={(event) => setPaymentForm({ ...paymentForm, reference: event.target.value })} placeholder="Referencia" className="col-span-2 h-10 rounded-md border border-indigo-100 px-3 text-sm font-bold outline-none" />
                                        </div>
                                        <button onClick={handlePayment} disabled={processing} className="mt-2 h-10 w-full rounded-md bg-indigo-600 text-sm font-black text-white disabled:opacity-50">Registrar abono</button>
                                    </section>
                                )}

                                {canExtend && ['ACTIVE', 'PAID'].includes(selected.status) && (
                                    <section className="rounded-lg border border-slate-200 p-3">
                                        <h4 className="mb-2 text-xs font-black uppercase tracking-widest text-slate-400">Prorrogar</h4>
                                        <div className="flex gap-2">
                                            <input type="datetime-local" value={extendDate} onChange={(event) => setExtendDate(event.target.value)} className="h-10 min-w-0 flex-1 rounded-md border border-slate-200 px-3 text-sm font-bold outline-none" />
                                            <button onClick={handleExtend} disabled={processing || !extendDate} className="rounded-md border border-slate-200 px-3 text-sm font-black text-slate-700 disabled:opacity-50">Guardar</button>
                                        </div>
                                    </section>
                                )}

                                {canComplete && ['ACTIVE', 'PAID'].includes(selected.status) && (
                                    <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                                        <div className="mb-2 flex items-center justify-between gap-2">
                                            <div>
                                                <h4 className="text-xs font-black uppercase tracking-widest text-emerald-700">Entrega final</h4>
                                                <p className="text-xs font-bold text-emerald-700/80">{Number(selected.balance_amount || 0) > 0.0001 ? 'Liquida el saldo y genera la venta.' : 'Genera la venta y descuenta inventario.'}</p>
                                            </div>
                                            <ShieldCheck size={18} className="text-emerald-700" />
                                        </div>
                                        {Number(selected.balance_amount || 0) > 0.0001 && (
                                            <div className="grid grid-cols-2 gap-2">
                                                <input value={money(selected.balance_amount, selected.currency)} disabled className="h-10 rounded-md border border-emerald-100 bg-white px-3 text-sm font-black text-emerald-800" />
                                                <select value={completeForm.payment_method} onChange={(event) => setCompleteForm({ ...completeForm, payment_method: event.target.value })} className="h-10 rounded-md border border-emerald-100 bg-white px-3 text-sm font-bold outline-none">
                                                    <option>Efectivo</option><option>Punto de Venta</option><option>Pago Movil</option><option>Zelle</option><option>Transferencia</option>
                                                </select>
                                                <input value={completeForm.reference} onChange={(event) => setCompleteForm({ ...completeForm, reference: event.target.value })} placeholder="Referencia del pago final" className="col-span-2 h-10 rounded-md border border-emerald-100 bg-white px-3 text-sm font-bold outline-none" />
                                            </div>
                                        )}
                                        <textarea value={completeForm.notes} onChange={(event) => setCompleteForm({ ...completeForm, notes: event.target.value })} placeholder="Nota de entrega" rows={2} className="mt-2 w-full resize-none rounded-md border border-emerald-100 bg-white px-3 py-2 text-sm font-bold outline-none" />
                                        <button onClick={handleComplete} disabled={processing} className="mt-2 h-10 w-full rounded-md bg-emerald-600 text-sm font-black text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50">
                                            {Number(selected.balance_amount || 0) > 0.0001 ? 'Liquidar y entregar' : 'Entregar apartado'}
                                        </button>
                                    </section>
                                )}
                            </div>

                            {(canCancel && !['CANCELLED', 'COMPLETED'].includes(selected.status)) && (
                                <div className="border-t border-slate-100 p-3">
                                    <button onClick={handleCancel} disabled={processing} className="h-10 w-full rounded-md border border-rose-200 bg-rose-50 text-sm font-black text-rose-700 hover:bg-rose-100 disabled:opacity-50">Cancelar y liberar productos</button>
                                </div>
                            )}
                        </div>
                    )}
                </aside>
            </div>
        </div>
    );
};

const MetricCard = ({ label, value, icon: Icon, tone }) => {
    const toneMap = {
        indigo: 'bg-indigo-50 text-indigo-700 border-indigo-100',
        emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
        amber: 'bg-amber-50 text-amber-700 border-amber-100',
        rose: 'bg-rose-50 text-rose-700 border-rose-100',
    };
    return (
        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <p className="text-xs font-black uppercase tracking-widest text-slate-400">{label}</p>
                    <p className="mt-1 text-xl font-black text-slate-950">{value}</p>
                </div>
                <div className={`flex h-9 w-9 items-center justify-center rounded-md border ${toneMap[tone] || toneMap.indigo}`}><Icon size={18} /></div>
            </div>
        </div>
    );
};

const MiniTotal = ({ label, value, tone = 'slate' }) => {
    const colors = tone === 'emerald' ? 'text-emerald-700 bg-emerald-50' : tone === 'amber' ? 'text-amber-700 bg-amber-50' : 'text-slate-900 bg-slate-50';
    return (
        <div className={`rounded-md p-2.5 ${colors}`}>
            <p className="text-[10px] font-black uppercase tracking-widest opacity-70">{label}</p>
            <p className="mt-1 font-black">{value}</p>
        </div>
    );
};

export default ApartadosTab;
