import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    AlertTriangle,
    ArrowDownLeft,
    ArrowUpRight,
    BookOpenCheck,
    Calendar,
    CheckCircle2,
    ClipboardList,
    Coins,
    Database,
    Download,
    Filter,
    Hash,
    Landmark,
    Layers3,
    RefreshCw,
    RotateCw,
    Search,
    ShieldCheck,
    WalletCards,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import apiClient from '../../../config/axios';
import { getApiErrorMessage } from '../../../utils/apiErrors';
import { useAuth } from '../../../context/AuthContext';
import { PERMISSIONS } from '../../../config/permissions';

const CURRENCY_SYMBOLS = {
    USD: '$',
    Bs: 'Bs',
    VES: 'Bs',
    EUR: '€',
};

const SOURCE_LABELS = {
    sale_payment: 'Cobro de venta',
    debt_payment: 'Abono CxC',
    layaway_payment: 'Abono apartado',
    cash_movement: 'Movimiento manual',
    cash_advance_incoming: 'Contraparte avance',
    sale_change: 'Vuelto entregado',
    purchase_payment: 'Pago proveedor',
    service_payment: 'Cobro servicio',
    cash_session_opening: 'Apertura de caja',
    cash_session_closing_count: 'Conteo de cierre',
    cash_session_difference: 'Diferencia de arqueo',
};

const EVENT_LABELS = {
    'sale.collected': 'Venta cobrada',
    'receivable.payment_collected': 'CxC cobrada',
    'layaway.payment_collected': 'Apartado abonado',
    'cash.manual_movement': 'Movimiento de caja',
    'cash.advance_counterpart': 'Entrada digital avance',
    'sale.change_given': 'Vuelto de venta',
    'purchase.payment_made': 'Proveedor pagado',
    'service.payment_collected': 'Servicio cobrado',
    'cash_session.opened': 'Caja abierta',
    'cash_session.closed': 'Caja cerrada',
    'cash_session.difference_detected': 'Diferencia detectada',
};

const ACCOUNT_BADGES = {
    'cash.sales': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'cash.accounts_receivable_payment': 'bg-cyan-50 text-cyan-700 border-cyan-200',
    'cash.layaway_payment': 'bg-indigo-50 text-indigo-700 border-indigo-200',
    'cash.manual_in': 'bg-teal-50 text-teal-700 border-teal-200',
    'cash.manual_out': 'bg-amber-50 text-amber-700 border-amber-200',
    'cash.return_refund': 'bg-rose-50 text-rose-700 border-rose-200',
    'cash.advance': 'bg-orange-50 text-orange-700 border-orange-200',
    'cash.change_given': 'bg-pink-50 text-pink-700 border-pink-200',
    'cash.purchase_payment': 'bg-violet-50 text-violet-700 border-violet-200',
    'cash.service_payment': 'bg-sky-50 text-sky-700 border-sky-200',
    'cash.opening_float': 'bg-blue-50 text-blue-700 border-blue-200',
    'cash.reported_count': 'bg-slate-50 text-slate-700 border-slate-200',
    'cash.over_short': 'bg-red-50 text-red-700 border-red-200',
};

const ACCOUNT_GROUPS = {
    'cash.opening_float': { label: 'Saldo inicial', tone: 'blue', order: 1 },
    'cash.sales': { label: 'Ventas cobradas', tone: 'emerald', order: 2 },
    'cash.accounts_receivable_payment': { label: 'CxC cobradas', tone: 'cyan', order: 3 },
    'cash.layaway_payment': { label: 'Apartados abonados', tone: 'indigo', order: 4 },
    'cash.service_payment': { label: 'Servicios cobrados', tone: 'sky', order: 5 },
    'cash.manual_in': { label: 'Entradas manuales', tone: 'teal', order: 6 },
    'cash.purchase_payment': { label: 'Pagos a proveedor', tone: 'violet', order: 7 },
    'cash.manual_out': { label: 'Salidas manuales', tone: 'amber', order: 8 },
    'cash.return_refund': { label: 'Devoluciones', tone: 'rose', order: 9 },
    'cash.advance': { label: 'Avances de efectivo', tone: 'orange', order: 10 },
    'cash.change_given': { label: 'Vueltos entregados', tone: 'pink', order: 11 },
    'cash.reported_count': { label: 'Conteo declarado', tone: 'slate', order: 12 },
    'cash.over_short': { label: 'Diferencias de arqueo', tone: 'red', order: 13 },
};

const SESSION_BUCKETS = [
    { key: 'initial', label: 'Saldo inicial', sign: 'in' },
    { key: 'cash_sales', label: 'Ventas efectivo', sign: 'in' },
    { key: 'debt_cash', label: 'CxC cobradas', sign: 'in' },
    { key: 'layaway_cash', label: 'Apartados', sign: 'in' },
    { key: 'service_cash', label: 'Servicios', sign: 'in' },
    { key: 'manual_in', label: 'Entradas manuales', sign: 'in' },
    { key: 'manual_out', label: 'Salidas manuales', sign: 'out' },
    { key: 'purchase_cash', label: 'Pagos proveedor', sign: 'out' },
    { key: 'returns', label: 'Devoluciones', sign: 'out' },
    { key: 'cash_advances', label: 'Avances', sign: 'out' },
    { key: 'change_given', label: 'Vueltos', sign: 'out' },
];

const directionStyles = {
    in: {
        icon: ArrowUpRight,
        label: 'Entrada',
        color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
        amount: 'text-emerald-700',
    },
    out: {
        icon: ArrowDownLeft,
        label: 'Salida',
        color: 'text-rose-700 bg-rose-50 border-rose-200',
        amount: 'text-rose-700',
    },
    neutral: {
        icon: ShieldCheck,
        label: 'Control',
        color: 'text-slate-700 bg-slate-50 border-slate-200',
        amount: 'text-slate-700',
    },
};

const todayInput = () => new Date().toISOString().slice(0, 10);

const formatMoney = (amount, currency = 'USD') => {
    const num = Number(amount) || 0;
    const symbol = CURRENCY_SYMBOLS[currency] || currency || '$';
    const decimals = Math.abs(num) > 0 && Math.abs(num) < 1 ? 4 : 2;
    return `${symbol} ${new Intl.NumberFormat('es-VE', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    }).format(num)}`;
};

const formatDate = (value) => {
    if (!value) return 'Sin fecha';
    return new Date(value).toLocaleString('es-VE', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

const compactNumber = (value) => new Intl.NumberFormat('es-VE').format(Number(value) || 0);

const normalizeCurrency = (value) => {
    const key = String(value || 'USD').trim();
    if (['BS', 'VES', 'VEF'].includes(key.toUpperCase())) return 'Bs';
    if (key === '$' || key === '') return 'USD';
    return key;
};

const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
};

const buildParams = (filters) => {
    const params = {
        start_date: filters.startDate || undefined,
        end_date: filters.endDate || undefined,
        limit: filters.limit,
    };
    if (filters.sessionId) params.session_id = Number(filters.sessionId);
    if (filters.registerId) params.register_id = Number(filters.registerId);
    if (filters.accountCode) params.account_code = filters.accountCode.trim();
    if (filters.currency !== 'all') params.currency = filters.currency;
    if (filters.sourceType !== 'all') params.source_type = filters.sourceType;
    if (filters.affectsCash !== 'all') params.affects_cash = filters.affectsCash === 'true';
    return params;
};

const AccountingTab = ({ dateRange }) => {
    const [searchParams] = useSearchParams();
    const urlSessionId = searchParams.get('session_id') || searchParams.get('sessionId') || '';
    const urlRegisterId = searchParams.get('register_id') || searchParams.get('registerId') || '';
    const { user, hasPermission } = useAuth();
    const isAdmin = user?.role === 'ADMIN';
    const canViewLedger = isAdmin || hasPermission(PERMISSIONS.ACCOUNTING_LEDGER_VIEW);
    const canExportLedger = isAdmin || hasPermission(PERMISSIONS.ACCOUNTING_LEDGER_EXPORT);
    const canRebuildLedger = isAdmin || hasPermission(PERMISSIONS.ACCOUNTING_LEDGER_REBUILD);
    const [filters, setFilters] = useState({
        startDate: dateRange?.start || todayInput(),
        endDate: dateRange?.end || todayInput(),
        sessionId: urlSessionId,
        registerId: urlRegisterId,
        accountCode: '',
        currency: 'all',
        sourceType: 'all',
        affectsCash: 'all',
        limit: 200,
    });
    const [summary, setSummary] = useState(null);
    const [ledger, setLedger] = useState({ total: 0, items: [] });
    const [reconciliation, setReconciliation] = useState(null);
    const [loading, setLoading] = useState(false);
    const [rebuilding, setRebuilding] = useState(false);
    const [exporting, setExporting] = useState(false);

    useEffect(() => {
        setFilters((prev) => ({
            ...prev,
            startDate: dateRange?.start || prev.startDate,
            endDate: dateRange?.end || prev.endDate,
        }));
    }, [dateRange?.start, dateRange?.end]);

    useEffect(() => {
        setFilters((prev) => {
            if (prev.sessionId === urlSessionId && prev.registerId === urlRegisterId) return prev;
            return {
                ...prev,
                sessionId: urlSessionId,
                registerId: urlRegisterId,
            };
        });
    }, [urlSessionId, urlRegisterId]);

    const params = useMemo(() => buildParams(filters), [filters]);

    const fetchLedger = useCallback(async () => {
        if (!canViewLedger) return;
        setLoading(true);
        try {
            const [summaryRes, ledgerRes, auditRes, sessionLedgerRes] = await Promise.all([
                apiClient.get('/accounting/summary', { params }),
                apiClient.get('/accounting/ledger', { params }),
                filters.sessionId
                    ? apiClient.get(`/cash/sessions/${filters.sessionId}/audit-report`).catch(() => null)
                    : Promise.resolve(null),
                filters.sessionId
                    ? apiClient.get(`/accounting/sessions/${filters.sessionId}/summary`).catch(() => null)
                    : Promise.resolve(null),
            ]);
            setSummary(summaryRes.data || null);
            setLedger(ledgerRes.data || { total: 0, items: [] });
            setReconciliation(filters.sessionId ? {
                audit: auditRes?.data || null,
                ledger: sessionLedgerRes?.data || null,
            } : null);
        } catch (error) {
            toast.error(getApiErrorMessage(error, 'No se pudo cargar el libro contable'));
            setSummary(null);
            setLedger({ total: 0, items: [] });
            setReconciliation(null);
        } finally {
            setLoading(false);
        }
    }, [params, canViewLedger]);

    useEffect(() => {
        fetchLedger();
    }, [fetchLedger]);

    const updateFilter = (key, value) => {
        setFilters((prev) => ({ ...prev, [key]: value }));
    };

    const clearFilters = () => {
        setFilters((prev) => ({
            ...prev,
            sessionId: '',
            registerId: '',
            accountCode: '',
            currency: 'all',
            sourceType: 'all',
            affectsCash: 'all',
            limit: 200,
        }));
    };


    const exportCsv = async () => {
        if (!canExportLedger) {
            toast.error('No tienes permiso para exportar el libro contable.');
            return;
        }
        setExporting(true);
        const toastId = toast.loading('Preparando exportacion contable...');
        try {
            const response = await apiClient.get('/accounting/export.csv', {
                params: { ...params, limit: Math.max(Number(filters.limit) || 200, 10000) },
                responseType: 'blob',
            });
            const suffix = filters.sessionId ? `sesion-${filters.sessionId}` : `${filters.startDate || 'inicio'}-${filters.endDate || 'fin'}`;
            downloadBlob(response.data, `libro-contable-${suffix}.csv`);
            toast.success('CSV contable descargado', { id: toastId });
        } catch (error) {
            toast.error(getApiErrorMessage(error, 'No se pudo exportar el libro contable'), { id: toastId });
        } finally {
            setExporting(false);
        }
    };

    const rebuildSession = async () => {
        if (!canRebuildLedger) {
            toast.error('No tienes permiso para reconstruir el libro contable.');
            return;
        }
        if (!filters.sessionId) {
            toast.error('Indica una sesion de caja para reconstruir el libro.');
            return;
        }
        setRebuilding(true);
        const toastId = toast.loading('Reconstruyendo libro contable de la sesion...');
        try {
            const response = await apiClient.post(`/accounting/sessions/${filters.sessionId}/rebuild`);
            await fetchLedger();
            toast.success(`Reconstruido: ${response.data.entries || 0} asientos`, { id: toastId });
        } catch (error) {
            toast.error(getApiErrorMessage(error, 'No se pudo reconstruir la sesion'), { id: toastId });
        } finally {
            setRebuilding(false);
        }
    };

    const currencyCards = useMemo(() => {
        const rows = summary?.by_currency || {};
        return Object.entries(rows).map(([currency, data]) => ({
            currency,
            gross: Number(data.gross_amount || 0),
            neutral: Number(data.neutral_amount || 0),
            net: Number(data.net_amount || 0),
            count: Number(data.count || 0),
        }));
    }, [summary]);


    const reconciliationRows = useMemo(() => {
        if (!reconciliation?.audit?.cash_by_currency || !reconciliation?.ledger) return [];
        return reconciliation.audit.cash_by_currency.map((row) => {
            const currency = normalizeCurrency(row.currency);
            const ledgerRow = reconciliation.ledger[currency] || reconciliation.ledger[row.currency] || {};
            const expected = Number(row.expected || 0);
            const reported = Number(row.reported || 0);
            const difference = Number(row.difference || 0);
            const ledgerNet = Number(ledgerRow.net || 0);
            const delta = ledgerNet - expected;
            return {
                currency,
                expected,
                reported,
                difference,
                ledgerNet,
                delta,
                ok: Math.abs(delta) < 0.01,
            };
        });
    }, [reconciliation]);

    const accounts = summary?.accounts || [];
    const items = ledger?.items || [];

    const operationalGroups = useMemo(() => {
        const map = new Map();
        for (const account of accounts) {
            const meta = ACCOUNT_GROUPS[account.account_code] || { label: account.account_name || account.account_code, tone: 'slate', order: 99 };
            const key = account.account_code;
            if (!map.has(key)) {
                map.set(key, {
                    key,
                    ...meta,
                    count: 0,
                    currencies: {},
                });
            }
            const group = map.get(key);
            group.count += Number(account.count || 0);
            group.currencies[account.currency] = (group.currencies[account.currency] || 0) + Number(account.net_amount || 0);
        }
        return Array.from(map.values()).sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
    }, [accounts]);

    const sourceCoverage = useMemo(() => {
        const map = new Map();
        for (const item of items) {
            const key = item.source_type || 'unknown';
            map.set(key, (map.get(key) || 0) + 1);
        }
        return Array.from(map.entries()).map(([source, count]) => ({
            source,
            label: SOURCE_LABELS[source] || source,
            count,
        })).sort((a, b) => b.count - a.count);
    }, [items]);

    const sessionBreakdown = useMemo(() => {
        return (reconciliation?.audit?.cash_by_currency || []).map((row) => ({
            currency: normalizeCurrency(row.currency),
            rows: SESSION_BUCKETS.map((bucket) => ({
                ...bucket,
                amount: Number(row[bucket.key] || 0),
            })).filter((bucket) => Math.abs(bucket.amount) > 0.0001),
            expected: Number(row.expected || 0),
            reported: Number(row.reported || 0),
            difference: Number(row.difference || 0),
        }));
    }, [reconciliation]);

    const reconciliationAlerts = reconciliation?.audit?.alerts || [];

    if (!canViewLedger) {
        return (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm font-bold text-amber-800">
                No tienes permiso para ver el libro contable. Pide a un administrador activar el permiso de Contabilidad.
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3 border-b border-slate-100 px-4 py-4">
                    <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-200">
                            <BookOpenCheck size={22} />
                        </div>
                        <div>
                            <div className="flex flex-wrap items-center gap-2">
                                <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Modo contaduria</p>
                                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-black text-emerald-700">QA</span>
                            </div>
                            <h2 className="text-xl font-black tracking-tight text-slate-950">Libro contable</h2>
                            <p className="text-sm font-semibold text-slate-500">Rastrea entradas, salidas, conteos y origen operativo por moneda.</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={exportCsv}
                            disabled={exporting || !canExportLedger}
                            className="inline-flex h-10 items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-sm font-black text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <Download size={16} />
                            Exportar CSV
                        </button>
                        <button
                            type="button"
                            onClick={rebuildSession}
                            disabled={rebuilding || !filters.sessionId || !canRebuildLedger}
                            className="inline-flex h-10 items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 text-sm font-black text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <RotateCw size={16} className={rebuilding ? 'animate-spin' : ''} />
                            Reconstruir sesion
                        </button>
                        <button
                            type="button"
                            onClick={fetchLedger}
                            disabled={loading}
                            className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-900 px-3 text-sm font-black text-white transition hover:bg-slate-800 disabled:opacity-60"
                        >
                            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                            Actualizar
                        </button>
                    </div>
                </div>

                <div className="grid gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-3 md:grid-cols-2 xl:grid-cols-6">
                    <label className="space-y-1">
                        <span className="flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-slate-400"><Calendar size={13} /> Desde</span>
                        <input type="date" value={filters.startDate} onChange={(event) => updateFilter('startDate', event.target.value)} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
                    </label>
                    <label className="space-y-1">
                        <span className="flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-slate-400"><Calendar size={13} /> Hasta</span>
                        <input type="date" value={filters.endDate} onChange={(event) => updateFilter('endDate', event.target.value)} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
                    </label>
                    <label className="space-y-1">
                        <span className="flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-slate-400"><Hash size={13} /> Sesion</span>
                        <input type="number" min="1" value={filters.sessionId} onChange={(event) => updateFilter('sessionId', event.target.value)} placeholder="Ej: 30" className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
                    </label>
                    <label className="space-y-1">
                        <span className="flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-slate-400"><Landmark size={13} /> Caja</span>
                        <input type="number" min="1" value={filters.registerId} onChange={(event) => updateFilter('registerId', event.target.value)} placeholder="ID caja" className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
                    </label>
                    <label className="space-y-1">
                        <span className="flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-slate-400"><WalletCards size={13} /> Moneda</span>
                        <select value={filters.currency} onChange={(event) => updateFilter('currency', event.target.value)} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100">
                            <option value="all">Todas</option>
                            <option value="USD">USD</option>
                            <option value="Bs">Bs</option>
                        </select>
                    </label>
                    <label className="space-y-1">
                        <span className="flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-slate-400"><Filter size={13} /> Caja fisica</span>
                        <select value={filters.affectsCash} onChange={(event) => updateFilter('affectsCash', event.target.value)} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100">
                            <option value="all">Todo</option>
                            <option value="true">Afecta caja</option>
                            <option value="false">Control / digital</option>
                        </select>
                    </label>
                </div>

                <div className="grid gap-3 px-4 py-3 md:grid-cols-[1.2fr_1fr_140px_auto]">
                    <label className="space-y-1">
                        <span className="flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-slate-400"><Search size={13} /> Cuenta contable</span>
                        <input value={filters.accountCode} onChange={(event) => updateFilter('accountCode', event.target.value)} placeholder="Ej: cash.sales" className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
                    </label>
                    <label className="space-y-1">
                        <span className="flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-slate-400"><Database size={13} /> Origen</span>
                        <select value={filters.sourceType} onChange={(event) => updateFilter('sourceType', event.target.value)} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100">
                            <option value="all">Todos los origenes</option>
                            {Object.entries(SOURCE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                    </label>
                    <label className="space-y-1">
                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Limite</span>
                        <select value={filters.limit} onChange={(event) => updateFilter('limit', Number(event.target.value))} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100">
                            <option value={100}>100</option>
                            <option value={200}>200</option>
                            <option value={500}>500</option>
                            <option value={1000}>1000</option>
                        </select>
                    </label>
                    <div className="flex items-end">
                        <button type="button" onClick={clearFilters} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-black text-slate-600 transition hover:bg-slate-50">
                            Limpiar
                        </button>
                    </div>
                </div>
            </section>


            {filters.sessionId && (
                <section className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 shadow-sm">
                    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <div className="flex items-center gap-2">
                                <ShieldCheck size={18} className="text-indigo-700" />
                                <h3 className="text-base font-black text-slate-950">Conciliacion de sesion #{filters.sessionId}</h3>
                            </div>
                            <p className="text-sm font-semibold text-slate-500">Explica el esperado de caja y lo compara contra el libro contable reconstruido.</p>
                        </div>
                        {reconciliationRows.length > 0 && (
                            <span className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-xs font-black ${reconciliationRows.every((row) => row.ok) ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
                                {reconciliationRows.every((row) => row.ok) ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                                {reconciliationRows.every((row) => row.ok) ? 'Cuadra con libro' : 'Revisar diferencias'}
                            </span>
                        )}
                    </div>
                    {reconciliationRows.length > 0 ? (
                        <div className="space-y-3">
                            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                {reconciliationRows.map((row) => (
                                    <div key={row.currency} className="rounded-xl border border-white/80 bg-white p-3 shadow-sm">
                                        <div className="mb-3 flex items-center justify-between">
                                            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">{row.currency}</span>
                                            <span className={`rounded-lg px-2 py-1 text-xs font-black ${row.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{row.ok ? 'OK' : 'Diferencia'}</span>
                                        </div>
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between gap-3"><span className="font-bold text-slate-500">Arqueo esperado</span><strong className="text-slate-950">{formatMoney(row.expected, row.currency)}</strong></div>
                                            <div className="flex justify-between gap-3"><span className="font-bold text-slate-500">Libro contable</span><strong className="text-indigo-700">{formatMoney(row.ledgerNet, row.currency)}</strong></div>
                                            <div className="flex justify-between gap-3"><span className="font-bold text-slate-500">Declarado</span><strong className="text-slate-950">{formatMoney(row.reported, row.currency)}</strong></div>
                                            <div className="flex justify-between gap-3 border-t border-slate-100 pt-2"><span className="font-bold text-slate-500">Delta libro</span><strong className={row.ok ? 'text-emerald-700' : 'text-rose-700'}>{formatMoney(row.delta, row.currency)}</strong></div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="grid gap-3 xl:grid-cols-[1.4fr_0.9fr]">
                                <div className="rounded-xl border border-white/80 bg-white p-3 shadow-sm">
                                    <div className="mb-3 flex items-center gap-2">
                                        <ClipboardList size={17} className="text-indigo-600" />
                                        <h4 className="text-sm font-black text-slate-950">Como se formo el esperado</h4>
                                    </div>
                                    <div className="grid gap-3 md:grid-cols-2">
                                        {sessionBreakdown.map((currencyRow) => (
                                            <div key={currencyRow.currency} className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
                                                <div className="mb-2 flex items-center justify-between">
                                                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">{currencyRow.currency}</span>
                                                    <strong className="text-sm font-black text-slate-950">{formatMoney(currencyRow.expected, currencyRow.currency)}</strong>
                                                </div>
                                                <div className="space-y-1.5">
                                                    {currencyRow.rows.map((bucket) => (
                                                        <div key={bucket.key} className="flex items-center justify-between gap-3 text-xs">
                                                            <span className="font-bold text-slate-500">{bucket.label}</span>
                                                            <span className={bucket.sign === 'out' ? 'font-black text-rose-700' : 'font-black text-emerald-700'}>
                                                                {bucket.sign === 'out' ? '-' : '+'}{formatMoney(bucket.amount, currencyRow.currency)}
                                                            </span>
                                                        </div>
                                                    ))}
                                                    <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-2 text-xs">
                                                        <span className="font-black text-slate-500">Declarado</span>
                                                        <span className="font-black text-slate-950">{formatMoney(currencyRow.reported, currencyRow.currency)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="rounded-xl border border-white/80 bg-white p-3 shadow-sm">
                                    <div className="mb-3 flex items-center gap-2">
                                        <AlertTriangle size={17} className={reconciliationAlerts.length ? 'text-amber-600' : 'text-emerald-600'} />
                                        <h4 className="text-sm font-black text-slate-950">Alertas de auditoria</h4>
                                    </div>
                                    {reconciliationAlerts.length ? (
                                        <div className="space-y-2">
                                            {reconciliationAlerts.slice(0, 6).map((alert, index) => (
                                                <div key={`${alert.code}-${index}`} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
                                                    <p className="font-black uppercase tracking-wide">{alert.code || 'alerta'}</p>
                                                    <p className="mt-1 leading-relaxed">{alert.message}</p>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-4 text-sm font-black text-emerald-700">
                                            Sin alertas para esta sesion.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="rounded-xl border border-dashed border-indigo-200 bg-white/70 p-4 text-sm font-bold text-slate-500">
                            No pude cargar el arqueo de esta sesion o aun no hay asientos reconstruidos. Usa Reconstruir sesion y vuelve a actualizar.
                        </div>
                    )}
                </section>
            )}

            <section className="grid gap-3 md:grid-cols-3">
                {currencyCards.length ? currencyCards.map((card) => (
                    <div key={card.currency} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="mb-3 flex items-center justify-between">
                            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Moneda</span>
                            <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-black text-slate-700">{card.currency}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            <div>
                                <p className="text-[11px] font-black uppercase text-slate-400">Neto</p>
                                <p className="mt-1 text-lg font-black text-slate-950">{formatMoney(card.net, card.currency)}</p>
                            </div>
                            <div>
                                <p className="text-[11px] font-black uppercase text-slate-400">Control</p>
                                <p className="mt-1 text-lg font-black text-indigo-700">{formatMoney(card.neutral, card.currency)}</p>
                            </div>
                            <div>
                                <p className="text-[11px] font-black uppercase text-slate-400">Asientos</p>
                                <p className="mt-1 text-lg font-black text-slate-950">{compactNumber(card.count)}</p>
                            </div>
                        </div>
                    </div>
                )) : (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm font-bold text-slate-500 md:col-span-3">
                        No hay asientos contables para los filtros actuales.
                    </div>
                )}
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                        <Coins size={18} className="text-indigo-600" />
                        <div>
                            <h3 className="text-base font-black text-slate-950">Desglose operativo</h3>
                            <p className="text-sm font-semibold text-slate-500">Cada modulo que movio dinero dentro de los filtros actuales.</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {sourceCoverage.slice(0, 6).map((source) => (
                            <span key={source.source} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-black text-slate-600">
                                {source.label} - {source.count}
                            </span>
                        ))}
                    </div>
                </div>
                {operationalGroups.length ? (
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        {operationalGroups.map((group) => (
                            <div key={group.key} className={`rounded-xl border p-3 ${ACCOUNT_BADGES[group.key] || 'border-slate-200 bg-slate-50 text-slate-700'}`}>
                                <div className="mb-3 flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-black">{group.label}</p>
                                        <p className="truncate text-[11px] font-bold opacity-75">{group.key}</p>
                                    </div>
                                    <span className="rounded-lg bg-white/70 px-2 py-1 text-[11px] font-black">{compactNumber(group.count)}</span>
                                </div>
                                <div className="space-y-1">
                                    {Object.entries(group.currencies).map(([currency, amount]) => (
                                        <div key={currency} className="flex items-center justify-between gap-3 text-xs">
                                            <span className="font-black">{currency}</span>
                                            <strong>{formatMoney(amount, currency)}</strong>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm font-bold text-slate-500">
                        No hay movimientos operativos para resumir con estos filtros.
                    </div>
                )}
            </section>

            <section className="grid gap-4 xl:grid-cols-[420px_1fr]">
                <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    <div className="border-b border-slate-100 px-4 py-3">
                        <div className="flex items-center gap-2">
                            <Layers3 size={18} className="text-indigo-600" />
                            <h3 className="text-base font-black text-slate-950">Cuentas afectadas</h3>
                        </div>
                        <p className="text-sm font-semibold text-slate-500">Agrupado por cuenta y moneda.</p>
                    </div>
                    <div className="max-h-[560px] overflow-auto">
                        {accounts.length ? accounts.map((account) => (
                            <div key={`${account.account_code}-${account.currency}`} className="border-b border-slate-100 px-4 py-3 last:border-b-0">
                                <div className="mb-2 flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-black text-slate-900">{account.account_name || account.account_code}</p>
                                        <p className="truncate text-xs font-bold text-slate-400">{account.account_code}</p>
                                    </div>
                                    <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-black text-slate-700">{account.currency}</span>
                                </div>
                                <div className="grid grid-cols-3 gap-2 text-xs">
                                    <div>
                                        <p className="font-black uppercase text-slate-400">Neto</p>
                                        <p className="font-black text-slate-900">{formatMoney(account.net_amount, account.currency)}</p>
                                    </div>
                                    <div>
                                        <p className="font-black uppercase text-slate-400">Control</p>
                                        <p className="font-black text-indigo-700">{formatMoney(account.neutral_amount, account.currency)}</p>
                                    </div>
                                    <div>
                                        <p className="font-black uppercase text-slate-400">Regs.</p>
                                        <p className="font-black text-slate-900">{compactNumber(account.count)}</p>
                                    </div>
                                </div>
                            </div>
                        )) : (
                            <div className="px-4 py-10 text-center text-sm font-bold text-slate-400">Sin cuentas para mostrar.</div>
                        )}
                    </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    <div className="flex flex-col gap-2 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h3 className="text-base font-black text-slate-950">Linea de tiempo contable</h3>
                            <p className="text-sm font-semibold text-slate-500">{compactNumber(ledger.total)} asientos encontrados.</p>
                        </div>
                        <span className="inline-flex w-fit items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-black text-slate-600">
                            <ShieldCheck size={14} /> Idempotente
                        </span>
                    </div>

                    <div className="max-h-[560px] overflow-auto">
                        {loading ? (
                            <div className="space-y-3 p-4">
                                {[...Array(5)].map((_, index) => <div key={index} className="h-20 animate-pulse rounded-xl bg-slate-100" />)}
                            </div>
                        ) : items.length ? items.map((item) => {
                            const style = directionStyles[item.direction] || directionStyles.neutral;
                            const DirectionIcon = style.icon;
                            const accountBadge = ACCOUNT_BADGES[item.account_code] || 'bg-slate-50 text-slate-700 border-slate-200';
                            return (
                                <article key={item.id} className="grid gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 lg:grid-cols-[180px_1fr_160px]">
                                    <div>
                                        <p className="text-xs font-black text-slate-400">{formatDate(item.occurred_at)}</p>
                                        <p className="mt-1 text-xs font-bold text-slate-500">{SOURCE_LABELS[item.source_type] || item.source_type}</p>
                                    </div>
                                    <div className="min-w-0">
                                        <div className="mb-2 flex flex-wrap items-center gap-2">
                                            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-black ${style.color}`}>
                                                <DirectionIcon size={12} /> {style.label}
                                            </span>
                                            <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-black ${accountBadge}`}>{item.account_code}</span>
                                            {item.affects_cash && <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-black text-emerald-700">Afecta caja</span>}
                                        </div>
                                        <p className="truncate text-sm font-black text-slate-900">{EVENT_LABELS[item.event_type] || item.event_type}</p>
                                        <p className="truncate text-sm font-semibold text-slate-500">{item.source_ref || item.account_name || 'Sin referencia'}</p>
                                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-bold text-slate-400">
                                            <span>Origen #{item.source_id || '-'}</span>
                                            <span>Sesion #{item.session_id || '-'}</span>
                                            <span>Caja #{item.register_id || '-'}</span>
                                            <span>{item.payment_method || 'Sin metodo'}</span>
                                        </div>
                                    </div>
                                    <div className="text-left lg:text-right">
                                        <p className={`text-lg font-black ${style.amount}`}>{formatMoney(item.amount, item.currency)}</p>
                                        <p className="text-xs font-bold text-slate-400">Base {formatMoney(item.amount_anchor, item.anchor_currency)}</p>
                                    </div>
                                </article>
                            );
                        }) : (
                            <div className="px-4 py-12 text-center">
                                <Database size={34} className="mx-auto mb-3 text-slate-300" />
                                <p className="text-sm font-black text-slate-500">No hay asientos con estos filtros.</p>
                                <p className="text-xs font-semibold text-slate-400">Prueba otro rango o reconstruye una sesion especifica.</p>
                            </div>
                        )}
                    </div>
                </div>
            </section>
        </div>
    );
};

export default AccountingTab;
