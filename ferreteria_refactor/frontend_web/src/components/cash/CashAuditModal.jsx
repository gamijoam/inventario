import { useEffect, useMemo, useState } from 'react';
import {
    AlertTriangle,
    ArrowDownLeft,
    ArrowUpRight,
    Banknote,
    ClipboardList,
    CreditCard,
    FileWarning,
    Gauge,
    Loader2,
    Search,
    ShieldCheck,
    Wallet,
    X
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import clsx from 'clsx';

import cashService from '../../services/cashService';
import { useConfig } from '../../context/ConfigContext';
import { getApiErrorMessage } from '../../utils/apiErrors';

const FILTERS = [
    { id: 'all', label: 'Todo' },
    { id: 'cash', label: 'Efectivo' },
    { id: 'sales', label: 'Ventas' },
    { id: 'movements', label: 'Movimientos' },
    { id: 'alerts', label: 'Salidas' }
];

const SOURCE_LABELS = {
    sale_payment: 'Venta',
    debt_payment: 'CxC',
    cash_movement: 'Caja',
    cash_advance_incoming: 'Avance',
    sale_change: 'Vuelto',
    purchase_payment: 'Proveedor',
    service_payment: 'Servicio'
};

const BUCKET_LABELS = {
    cash_sales: 'Venta efectivo',
    digital_sales: 'Venta no efectivo',
    debt_cash: 'Abono CxC / servicio',
    service_cash: 'Servicio efectivo',
    manual_in: 'Entrada manual',
    manual_out: 'Salida manual',
    returns: 'Devolucion',
    cash_advances: 'Avance efectivo',
    change_given: 'Vuelto',
    purchase_cash: 'Pago proveedor',
    digital_advance_incoming: 'Contraparte digital',
    digital_or_movement_backed_debt: 'CxC conciliado',
    non_cash_purchase_payment: 'Pago proveedor no efectivo',
    non_cash_service_payment: 'Servicio no efectivo'
};

const CashAuditModal = ({ session, isOpen, onClose }) => {
    const { formatCurrency } = useConfig();
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState('cash');
    const [query, setQuery] = useState('');

    useEffect(() => {
        if (!isOpen || !session?.id) return;
        let mounted = true;

        const loadReport = async () => {
            setLoading(true);
            setReport(null);
            setFilter('cash');
            setQuery('');
            try {
                const data = await cashService.getAuditReport(session.id);
                if (mounted) setReport(data);
            } catch (error) {
                toast.error(getApiErrorMessage(error, 'No se pudo cargar la auditoria de caja'));
                if (mounted) setReport(null);
            } finally {
                if (mounted) setLoading(false);
            }
        };

        loadReport();
        return () => { mounted = false; };
    }, [isOpen, session?.id]);

    useEffect(() => {
        if (!isOpen) return;
        const onKeyDown = (event) => {
            if (event.key === 'Escape') onClose?.();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isOpen, onClose]);

    const money = (value, currency = 'USD') => {
        const numeric = Number(value || 0);
        const normalized = currency === 'Bs' ? 'VES' : currency;
        try {
            return formatCurrency(numeric, normalized);
        } catch (_) {
            return `${currency || '$'} ${numeric.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }
    };

    const transactionRows = useMemo(() => {
        const rows = report?.transactions || [];
        const needle = query.trim().toLowerCase();

        return rows.filter((row) => {
            const matchesFilter = (() => {
                if (filter === 'all') return true;
                if (filter === 'cash') return row.affects_cash;
                if (filter === 'sales') return row.source_type === 'sale_payment';
                if (filter === 'movements') return ['cash_movement', 'cash_advance_incoming', 'sale_change'].includes(row.source_type);
                if (filter === 'alerts') return row.affects_cash && Number(row.outflow || 0) > 0;
                return true;
            })();

            if (!matchesFilter) return false;
            if (!needle) return true;

            return [row.reference, row.description, row.method, row.currency, row.cash_bucket]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()
                .includes(needle);
        });
    }, [filter, query, report?.transactions]);

    const diagnostic = useMemo(() => buildDiagnostic(report), [report]);
    const methodGroups = useMemo(() => groupPaymentMethods(report?.payment_methods || []), [report?.payment_methods]);
    const criticalRows = useMemo(() => {
        return (report?.transactions || [])
            .filter((row) => row.affects_cash)
            .filter((row) => Number(row.outflow || 0) > 0 || ['manual_in', 'debt_cash', 'service_cash'].includes(row.cash_bucket))
            .slice(0, 8);
    }, [report?.transactions]);

    if (!isOpen) return null;

    const summary = report?.summary || {};
    const alerts = report?.alerts || [];
    const cashRows = report?.cash_by_currency || [];
    const credits = report?.credits || {};

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm" role="dialog" aria-modal="true">
            <div className="flex h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-2xl">
                <header className="border-b border-slate-200 bg-white px-5 py-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex min-w-0 items-center gap-3">
                            <div className={clsx('flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white shadow-sm', diagnostic.headerClass)}>
                                <ShieldCheck size={23} />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">Auditoria post-cierre</p>
                                <h3 className="truncate text-xl font-black text-slate-950">Sesion #{session?.id}</h3>
                                <p className="truncate text-xs font-semibold text-slate-500">
                                    {report?.session?.register?.code || session?.register?.code || 'Caja'} / {report?.session?.user?.full_name || session?.user?.full_name || session?.user?.username || 'Usuario'}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            {report?.schema_version && (
                                <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700">
                                    Fuente unica activa
                                </span>
                            )}
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-slate-300 hover:text-slate-800 active:scale-95"
                                aria-label="Cerrar auditoria"
                            >
                                <X size={19} />
                            </button>
                        </div>
                    </div>
                </header>

                {loading ? (
                    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-slate-500">
                        <Loader2 className="animate-spin text-indigo-600" size={34} />
                        <p className="text-sm font-black">Cargando libro de caja...</p>
                    </div>
                ) : !report ? (
                    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center text-slate-500">
                        <FileWarning className="text-amber-500" size={40} />
                        <p className="text-base font-black text-slate-800">No se pudo cargar la auditoria</p>
                        <p className="max-w-md text-sm font-semibold">Intenta de nuevo desde el historial de caja.</p>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto px-5 py-4">
                        <section className={clsx('rounded-2xl border p-4 shadow-sm', diagnostic.panelClass)}>
                            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                                <div className="flex items-start gap-3">
                                    <div className={clsx('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', diagnostic.iconClass)}>
                                        <Gauge size={22} />
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-black uppercase tracking-widest opacity-70">Diagnostico del cierre</p>
                                        <h4 className="mt-1 text-lg font-black text-slate-950">{diagnostic.title}</h4>
                                        <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-slate-600">{diagnostic.description}</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:w-[560px]">
                                    <DiagnosticPill label="Esperado" value={money(summary.cash_expected_total_display_only)} />
                                    <DiagnosticPill label="Declarado" value={money(summary.cash_reported_total_display_only)} />
                                    <DiagnosticPill label="Diferencia" value={money(summary.cash_difference_total_display_only)} danger={diagnostic.hasDifference} />
                                    <DiagnosticPill label="Alertas" value={summary.alert_count || 0} danger={Number(summary.alert_count || 0) > 0} />
                                </div>
                            </div>
                        </section>

                        <section className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                            <MetricCard icon={ClipboardList} label="Transacciones" value={summary.transaction_count || 0} tone="indigo" />
                            <MetricCard icon={CreditCard} label="Metodos" value={summary.payment_method_count || 0} tone="blue" />
                            <MetricCard icon={Wallet} label="Creditos pendientes" value={`${credits.pending_count || 0} / ${money(credits.pending_amount || 0)}`} tone="amber" />
                            <MetricCard icon={Banknote} label="Efectivo reportado" value={money(summary.cash_reported_total_display_only)} tone="emerald" />
                        </section>

                        {alerts.length > 0 && (
                            <section className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                                <div className="mb-2 flex items-center gap-2 text-amber-800">
                                    <AlertTriangle size={17} />
                                    <h4 className="text-sm font-black">Alertas de auditoria</h4>
                                </div>
                                <div className="grid gap-2 md:grid-cols-2">
                                    {alerts.map((alert, index) => (
                                        <div key={`${alert.code}-${index}`} className="rounded-lg bg-white/75 px-3 py-2 text-xs font-semibold leading-5 text-amber-900 shadow-sm">
                                            {alert.message}
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        <section className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                            <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
                                <div className="border-b border-slate-100 px-4 py-3">
                                    <h4 className="text-sm font-black text-slate-900">Efectivo por moneda</h4>
                                    <p className="text-xs font-semibold text-slate-500">Formula: inicial + cobros + entradas - salidas = esperado.</p>
                                </div>
                                <div className="grid grid-cols-1 gap-3 p-4 lg:grid-cols-2">
                                    {cashRows.map((row) => (
                                        <CashCurrencyCard key={row.currency} row={row} money={money} />
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
                                    <div className="border-b border-slate-100 px-4 py-3">
                                        <h4 className="text-sm font-black text-slate-900">Metodos de pago</h4>
                                        <p className="text-xs font-semibold text-slate-500">Separado por moneda para conciliacion bancaria.</p>
                                    </div>
                                    <div className="max-h-[306px] space-y-3 overflow-y-auto p-4">
                                        {methodGroups.length === 0 ? (
                                            <p className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm font-bold text-slate-400">Sin pagos registrados.</p>
                                        ) : methodGroups.map((group) => (
                                            <div key={group.currency} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                                <div className="mb-2 flex items-center justify-between">
                                                    <span className="text-xs font-black uppercase tracking-widest text-slate-400">{group.currency}</span>
                                                    <span className="text-sm font-black text-slate-950">{money(group.total, group.currency)}</span>
                                                </div>
                                                <div className="space-y-2">
                                                    {group.items.map((method) => (
                                                        <div key={`${method.method}-${method.currency}`} className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 shadow-sm">
                                                            <div className="min-w-0">
                                                                <p className="truncate text-sm font-black text-slate-800" title={method.method}>{method.method}</p>
                                                                <p className="text-[11px] font-bold text-slate-400">{method.count} movimiento{Number(method.count || 0) === 1 ? '' : 's'}</p>
                                                            </div>
                                                            <span className="shrink-0 text-sm font-black text-slate-900">{money(method.amount, method.currency)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
                                    <div className="border-b border-slate-100 px-4 py-3">
                                        <h4 className="text-sm font-black text-slate-900">Rastreo rapido</h4>
                                        <p className="text-xs font-semibold text-slate-500">Movimientos que suelen explicar descuadres.</p>
                                    </div>
                                    <div className="space-y-2 p-4">
                                        {criticalRows.length === 0 ? (
                                            <p className="rounded-xl border border-dashed border-slate-200 py-7 text-center text-sm font-bold text-slate-400">Sin movimientos criticos.</p>
                                        ) : criticalRows.map((row) => (
                                            <CriticalRow key={row.id} row={row} money={money} />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </section>

                        <section className="mt-4 rounded-xl border border-slate-200 bg-white shadow-sm">
                            <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
                                <div>
                                    <h4 className="text-sm font-black text-slate-900">Libro de transacciones</h4>
                                    <p className="text-xs font-semibold text-slate-500">Cada fila indica si afecta o no el efectivo de caja.</p>
                                </div>
                                <div className="flex flex-col gap-2 sm:flex-row">
                                    <div className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-slate-400">
                                        <Search size={16} />
                                        <input
                                            value={query}
                                            onChange={(event) => setQuery(event.target.value)}
                                            className="h-full w-full min-w-[190px] bg-transparent text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400"
                                            placeholder="Buscar referencia..."
                                        />
                                    </div>
                                    <div className="flex rounded-xl bg-slate-100 p-1">
                                        {FILTERS.map((item) => (
                                            <button
                                                key={item.id}
                                                type="button"
                                                onClick={() => setFilter(item.id)}
                                                className={clsx(
                                                    'h-8 rounded-lg px-3 text-xs font-black transition',
                                                    filter === item.id ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'
                                                )}
                                            >
                                                {item.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-slate-100 text-sm">
                                    <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-400">
                                        <tr>
                                            <th className="px-4 py-3 text-left font-black">Fecha</th>
                                            <th className="px-4 py-3 text-left font-black">Origen</th>
                                            <th className="px-4 py-3 text-left font-black">Detalle</th>
                                            <th className="px-4 py-3 text-left font-black">Metodo</th>
                                            <th className="px-4 py-3 text-right font-black">Entrada</th>
                                            <th className="px-4 py-3 text-right font-black">Salida</th>
                                            <th className="px-4 py-3 text-center font-black">Caja</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 bg-white">
                                        {transactionRows.length === 0 ? (
                                            <tr>
                                                <td colSpan="7" className="px-4 py-10 text-center text-sm font-bold text-slate-400">No hay transacciones para este filtro.</td>
                                            </tr>
                                        ) : transactionRows.map((row) => (
                                            <tr key={row.id} className="hover:bg-slate-50/80">
                                                <td className="whitespace-nowrap px-4 py-3 text-xs font-bold text-slate-500">{formatDate(row.occurred_at)}</td>
                                                <td className="px-4 py-3">
                                                    <span className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-black text-slate-600">
                                                        {SOURCE_LABELS[row.source_type] || row.source_type}
                                                    </span>
                                                </td>
                                                <td className="min-w-[250px] px-4 py-3">
                                                    <p className="font-black text-slate-800">{row.reference || 'Sin referencia'}</p>
                                                    <p className="text-xs font-semibold text-slate-500">{row.description || BUCKET_LABELS[row.cash_bucket] || row.cash_bucket}</p>
                                                </td>
                                                <td className="px-4 py-3 text-xs font-bold text-slate-600">{row.method || '-'}</td>
                                                <td className="whitespace-nowrap px-4 py-3 text-right font-black text-emerald-700">
                                                    {Number(row.inflow || 0) > 0 ? money(row.inflow, row.currency) : '-'}
                                                </td>
                                                <td className="whitespace-nowrap px-4 py-3 text-right font-black text-rose-700">
                                                    {Number(row.outflow || 0) > 0 ? money(row.outflow, row.currency) : '-'}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={clsx(
                                                        'inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-black',
                                                        row.affects_cash ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                                                    )}>
                                                        {row.affects_cash ? <ArrowUpRight size={12} /> : <ArrowDownLeft size={12} />}
                                                        {row.affects_cash ? 'Si' : 'No'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    </div>
                )}
            </div>
        </div>
    );
};

const buildDiagnostic = (report) => {
    const diff = Number(report?.summary?.cash_difference_total_display_only || 0);
    const alertCount = Number(report?.summary?.alert_count || 0);
    const absDiff = Math.abs(diff);

    if (absDiff <= 0.01 && alertCount === 0) {
        return {
            title: 'Caja cuadrada sin alertas',
            description: 'El efectivo declarado coincide con el calculo del sistema y no hay advertencias operativas en la sesion.',
            hasDifference: false,
            headerClass: 'bg-emerald-600',
            panelClass: 'border-emerald-200 bg-emerald-50',
            iconClass: 'bg-emerald-100 text-emerald-700'
        };
    }

    if (absDiff > 0.01) {
        return {
            title: diff < 0 ? 'Faltante detectado' : 'Sobrante detectado',
            description: diff < 0
                ? 'El cajero declaro menos efectivo que el esperado. Revisa salidas, devoluciones, avances y pagos en efectivo.'
                : 'El cajero declaro mas efectivo que el esperado. Revisa entradas manuales, abonos CxC y cobros que pudieron quedar sin registrar.',
            hasDifference: true,
            headerClass: diff < 0 ? 'bg-rose-600' : 'bg-blue-600',
            panelClass: diff < 0 ? 'border-rose-200 bg-rose-50' : 'border-blue-200 bg-blue-50',
            iconClass: diff < 0 ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'
        };
    }

    return {
        title: 'Caja cuadrada con alertas',
        description: 'El efectivo cuadra, pero hay movimientos que conviene revisar antes de archivar el cierre.',
        hasDifference: false,
        headerClass: 'bg-amber-500',
        panelClass: 'border-amber-200 bg-amber-50',
        iconClass: 'bg-amber-100 text-amber-700'
    };
};

const groupPaymentMethods = (methods) => {
    const groups = new Map();
    methods.forEach((method) => {
        const currency = method.currency || 'USD';
        if (!groups.has(currency)) groups.set(currency, { currency, total: 0, items: [] });
        const group = groups.get(currency);
        group.total += Number(method.amount || 0);
        group.items.push(method);
    });
    return Array.from(groups.values()).sort((a, b) => a.currency.localeCompare(b.currency));
};

const DiagnosticPill = ({ label, value, danger }) => (
    <div className="rounded-xl border border-white/70 bg-white/80 px-3 py-2 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
        <p className={clsx('mt-1 truncate text-sm font-black', danger ? 'text-rose-700' : 'text-slate-950')}>{value}</p>
    </div>
);

const MetricCard = ({ icon: Icon, label, value, tone }) => {
    const toneClasses = {
        indigo: 'bg-indigo-50 text-indigo-700 border-indigo-100',
        blue: 'bg-blue-50 text-blue-700 border-blue-100',
        emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
        amber: 'bg-amber-50 text-amber-700 border-amber-100',
        rose: 'bg-rose-50 text-rose-700 border-rose-100'
    };

    return (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">{label}</p>
                    <p className="mt-1 truncate text-xl font-black text-slate-900">{value}</p>
                </div>
                <div className={clsx('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border', toneClasses[tone])}>
                    <Icon size={21} />
                </div>
            </div>
        </div>
    );
};

const CashCurrencyCard = ({ row, money }) => {
    const diff = Number(row.difference || 0);
    const inflows = Number(row.cash_sales || 0) + Number(row.debt_cash || 0) + Number(row.manual_in || 0);
    const outflows = Number(row.manual_out || 0) + Number(row.purchase_cash || 0) + Number(row.returns || 0) + Number(row.cash_advances || 0) + Number(row.change_given || 0);

    return (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="mb-3 flex items-center justify-between">
                <span className="text-lg font-black text-slate-900">{row.currency}</span>
                <span className={clsx(
                    'rounded-lg px-2 py-1 text-[11px] font-black uppercase',
                    Math.abs(diff) <= 0.01 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                )}>
                    {Math.abs(diff) <= 0.01 ? 'Cuadra' : 'Revisar'}
                </span>
            </div>
            <MoneyLine label="Inicial" value={row.initial} currency={row.currency} money={money} />
            <MoneyLine label="Cobros efectivo" value={row.cash_sales} currency={row.currency} money={money} positive />
            <MoneyLine label="CxC / servicios" value={row.debt_cash} currency={row.currency} money={money} positive />
            <MoneyLine label="Entradas manuales" value={row.manual_in} currency={row.currency} money={money} positive />
            <MoneyLine label="Salidas manuales" value={row.manual_out} currency={row.currency} money={money} negative />
            <MoneyLine label="Pagos proveedor" value={row.purchase_cash} currency={row.currency} money={money} negative />
            <MoneyLine label="Devoluciones" value={row.returns} currency={row.currency} money={money} negative />
            <MoneyLine label="Avances / vuelto" value={Number(row.cash_advances || 0) + Number(row.change_given || 0)} currency={row.currency} money={money} negative />
            <div className="my-3 rounded-lg bg-white px-3 py-2 text-[11px] font-black text-slate-500">
                {money(row.initial, row.currency)} + {money(inflows, row.currency)} - {money(outflows, row.currency)}
            </div>
            <div className="border-t border-dashed border-slate-300 pt-3">
                <MoneyLine label="Esperado" value={row.expected} currency={row.currency} money={money} strong />
                <MoneyLine label="Declarado" value={row.reported} currency={row.currency} money={money} strong />
                <MoneyLine label="Diferencia" value={row.difference} currency={row.currency} money={money} strong danger={Math.abs(diff) > 0.01} />
            </div>
        </div>
    );
};

const MoneyLine = ({ label, value, currency, money, positive, negative, strong, danger }) => {
    const numeric = Number(value || 0);
    return (
        <div className={clsx('flex items-center justify-between gap-3 py-1', strong && 'font-black')}>
            <span className={clsx('text-xs font-bold', strong ? 'text-slate-700' : 'text-slate-500')}>{label}</span>
            <span className={clsx(
                'text-xs font-black',
                danger ? 'text-rose-700' : positive && numeric > 0 ? 'text-emerald-700' : negative && numeric > 0 ? 'text-rose-700' : 'text-slate-800'
            )}>
                {money(numeric, currency)}
            </span>
        </div>
    );
};

const CriticalRow = ({ row, money }) => {
    const amount = Number(row.outflow || 0) > 0 ? Number(row.outflow || 0) : Number(row.inflow || 0);
    const isOut = Number(row.outflow || 0) > 0;
    return (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="truncate text-sm font-black text-slate-800">{row.reference || SOURCE_LABELS[row.source_type] || 'Movimiento'}</p>
                    <p className="text-xs font-semibold text-slate-500">{BUCKET_LABELS[row.cash_bucket] || row.description || row.cash_bucket}</p>
                </div>
                <span className={clsx('shrink-0 text-sm font-black', isOut ? 'text-rose-700' : 'text-emerald-700')}>
                    {isOut ? '-' : '+'}{money(amount, row.currency)}
                </span>
            </div>
        </div>
    );
};

const formatDate = (value) => {
    if (!value) return 'N/A';
    return new Date(value).toLocaleString('es-VE', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
    });
};

export default CashAuditModal;
