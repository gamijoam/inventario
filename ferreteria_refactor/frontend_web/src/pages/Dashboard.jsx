import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    DollarSign, TrendingUp, ShoppingCart, CreditCard, ArrowUpRight,
    ArrowDownRight, Package, AlertCircle, Users, UtensilsCrossed,
    RefreshCw, ArrowRight, Monitor, UserPlus, FileText, Wrench,
    Scissors, Droplets, FlaskConical, Landmark, ClipboardList,
    TrendingDown, Bell, CheckCircle, Clock, BarChart2, ChevronRight
} from 'lucide-react';
import {
    ComposedChart, Bar, Line, AreaChart, Area,
    XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Cell, PieChart, Pie
} from 'recharts';
import { useConfig }      from '../context/ConfigContext';
import { useWebSocket }   from '../context/WebSocketContext';
import { useAuth }        from '../context/AuthContext';
import { HelpButton }     from '../help/HelpDrawer';
import HelpDrawer         from '../help/HelpDrawer';
import { useHelp }        from '../help/useHelp';
import apiClient          from '../config/axios';
import unifiedReportService from '../services/unifiedReportService';
import MultiCurrencyDisplay from '../components/dashboard/MultiCurrencyDisplay';
import { cn }             from '../utils/cn';
import toast              from 'react-hot-toast';
import { useNavigate }    from 'react-router-dom';

/* ─────────────────────────────────────────────────────────────────────────── */
/*  HELPERS                                                                    */
/* ─────────────────────────────────────────────────────────────────────────── */
const fmt = (n = 0) => `$${Number(n).toFixed(2)}`;
const fmtCompact = (n = 0) => {
    const value = Number(n || 0);
    if (Math.abs(value) >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(1)}K`;
    return fmt(value);
};
const fmtNumber = (n = 0) => Number(n || 0).toLocaleString('es-VE');

const pctChange = (curr, prev) => {
    if (!prev || prev === 0) return null;
    return ((curr - prev) / prev) * 100;
};

const dateRange = (preset) => {
    const today = new Date();
    const pad   = (n) => String(n).padStart(2, '0');
    const iso   = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

    const todayStr = iso(today);

    const prev = (d, days) => { const r = new Date(d); r.setDate(r.getDate() - days); return r; };

    switch (preset) {
        case 'today':
            return { start: todayStr, end: todayStr,
                     prevStart: iso(prev(today,1)), prevEnd: iso(prev(today,1)), label: 'Hoy' };
        case 'yesterday': {
            const y = prev(today,1);
            return { start: iso(y), end: iso(y),
                     prevStart: iso(prev(today,2)), prevEnd: iso(prev(today,2)), label: 'Ayer' };
        }
        case 'week': {
            const mon = new Date(today); mon.setDate(today.getDate() - today.getDay() + 1);
            const prevMon = prev(mon, 7); const prevSun = prev(today, today.getDay()||7);
            return { start: iso(mon), end: todayStr,
                     prevStart: iso(prevMon), prevEnd: iso(prevSun), label: 'Esta semana' };
        }
        case 'month': {
            const first = new Date(today.getFullYear(), today.getMonth(), 1);
            const prevFirst = new Date(today.getFullYear(), today.getMonth()-1, 1);
            const prevLast  = new Date(today.getFullYear(), today.getMonth(), 0);
            return { start: iso(first), end: todayStr,
                     prevStart: iso(prevFirst), prevEnd: iso(prevLast), label: 'Este mes' };
        }
        default:
            return { start: todayStr, end: todayStr,
                     prevStart: iso(prev(today,1)), prevEnd: iso(prev(today,1)), label: 'Hoy' };
    }
};

/* ─────────────────────────────────────────────────────────────────────────── */
/*  CASHIER DASHBOARD (sin cambios)                                            */
/* ─────────────────────────────────────────────────────────────────────────── */
const CashierDashboard = () => {
    const { modules } = useConfig();
    const navigate    = useNavigate();
    const { user }    = useAuth();
    const effectiveModules = modules;
    const quickLinks = [
        { label: 'Punto de Venta',      icon: Monitor,      path: '/pos',                    color: 'bg-indigo-600 hover:bg-indigo-700 text-white', primary: true },
        { label: 'Registrar Cliente',   icon: UserPlus,     path: '/sales-center?tab=clientes', color: 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200' },
        { label: 'Cotizaciones',        icon: FileText,     path: '/quotes',                 color: 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200' },
        { label: 'Apertura / Cierre Caja', icon: Landmark,  path: '/cash-close',             color: 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200' },
        ...(effectiveModules?.services    ? [{ label: 'Taller / Servicios', icon: Wrench,       path: '/services',    color: 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200' }] : []),
        ...(effectiveModules?.laundry     ? [{ label: 'Lavandería',        icon: Droplets,     path: '/laundry',     color: 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200' }] : []),
        ...(effectiveModules?.barbershop  ? [{ label: 'Barbería',          icon: Scissors,     path: '/barbershop',  color: 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200' }] : []),
        ...(effectiveModules?.pharmacy    ? [{ label: 'Farmacia',          icon: FlaskConical, path: '/pharmacy',   color: 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200' }] : []),
        ...(effectiveModules?.restaurant  ? [{ label: 'Restaurante',       icon: UtensilsCrossed, path: '/restaurant/tables', color: 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200' }] : []),
    ];
    return (
        <div className="space-y-6 animate-in fade-in duration-500 max-w-2xl mx-auto pb-10">
            <div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Bienvenido, {user?.username}</h1>
                <p className="text-slate-500 text-sm">¿Qué vas a hacer hoy?</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {quickLinks.map(({ label, icon: Icon, path, color, primary }) => (
                    <button key={path} onClick={() => navigate(path)}
                        className={`flex flex-col items-center justify-center gap-2 p-5 rounded-xl font-medium shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 ${color} ${primary ? 'col-span-2 sm:col-span-3 flex-row gap-3 py-4' : ''}`}>
                        <Icon size={primary ? 22 : 26} />
                        <span className={primary ? 'text-base' : 'text-sm text-center'}>{label}</span>
                    </button>
                ))}
            </div>
        </div>
    );
};

/* ─────────────────────────────────────────────────────────────────────────── */
/*  KPI CARD con tendencia real                                                */
/* ─────────────────────────────────────────────────────────────────────────── */
const KPICard = ({ title, value, prevValue, icon: Icon, isCurrency = true, color = 'indigo', loading = false }) => {
    const pct = prevValue != null ? pctChange(Number(value || 0), Number(prevValue || 0)) : null;
    const up = pct !== null && pct >= 0;
    const colorMap = {
        indigo:  { accent: 'from-indigo-600 to-blue-600', icon: 'text-indigo-600 bg-indigo-50 border-indigo-100' },
        emerald: { accent: 'from-emerald-600 to-teal-600', icon: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
        amber:   { accent: 'from-amber-500 to-orange-500', icon: 'text-amber-600 bg-amber-50 border-amber-100' },
        blue:    { accent: 'from-blue-600 to-cyan-600', icon: 'text-blue-600 bg-blue-50 border-blue-100' },
        violet:  { accent: 'from-violet-600 to-indigo-600', icon: 'text-violet-600 bg-violet-50 border-violet-100' },
        rose:    { accent: 'from-rose-600 to-pink-600', icon: 'text-rose-600 bg-rose-50 border-rose-100' },
    };
    const palette = colorMap[color] || colorMap.indigo;

    if (loading) return (
        <div className="min-h-[112px] rounded-lg border border-slate-200 bg-white p-3 shadow-sm animate-pulse">
            <div className="flex items-center justify-between mb-4">
                <div className="h-3 bg-slate-100 rounded w-24" />
                <div className="h-8 w-8 bg-slate-100 rounded-lg" />
            </div>
            <div className="h-6 bg-slate-100 rounded w-28 mb-3" />
            <div className="h-3 bg-slate-100 rounded w-20" />
        </div>
    );

    return (
        <div className="relative min-h-[112px] overflow-hidden rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
            <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${palette.accent}`} />
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 leading-tight">{title}</p>
                    <div className="mt-2 text-[22px] leading-none font-black tracking-tight text-slate-950 truncate">
                        {isCurrency ? fmtCompact(value) : fmtNumber(value)}
                    </div>
                </div>
                <div className={`h-8 w-8 shrink-0 rounded-lg border flex items-center justify-center ${palette.icon}`}>
                    <Icon size={16} strokeWidth={2.5} />
                </div>
            </div>
            {pct !== null ? (
                <div className="mt-3 flex items-center gap-1.5 text-[11px]">
                    <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-black ${up ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                        {up ? <ArrowUpRight size={12} strokeWidth={3}/> : <ArrowDownRight size={12} strokeWidth={3}/>}
                        {Math.abs(pct).toFixed(1)}%
                    </span>
                    <span className="truncate font-semibold text-slate-400">vs anterior</span>
                </div>
            ) : (
                <div className="mt-3 text-[11px] font-semibold text-slate-400">Sin comparativo</div>
            )}
        </div>
    );
};

/* --------------------------------------------------------------------------- */
/*  ALERT CARD                                                                 */
/* --------------------------------------------------------------------------- */
const AlertCard = ({ icon: Icon, title, count, desc, color, onClick }) => {
    const colorMap = {
        red:    'border-red-200 bg-red-50/80 text-red-700',
        amber:  'border-amber-200 bg-amber-50/80 text-amber-700',
        blue:   'border-blue-200 bg-blue-50/80 text-blue-700',
        violet: 'border-violet-200 bg-violet-50/80 text-violet-700',
    };
    return (
        <button onClick={onClick}
            className={`group w-full rounded-lg border p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${colorMap[color]}`}>
            <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/80 shadow-sm">
                    <Icon size={16} strokeWidth={2.5} />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-black text-slate-900">{title}</span>
                        <span className="rounded-full bg-white/90 px-1.5 py-0.5 text-xs font-black shadow-sm">{count}</span>
                    </div>
                    <p className="mt-0.5 truncate text-[11px] font-semibold text-slate-500">{desc}</p>
                </div>
                <ChevronRight size={15} className="shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" />
            </div>
        </button>
    );
};

const EmptyState = ({ icon: Icon = Package, title, desc }) => (
    <div className="flex min-h-[168px] flex-col items-center justify-center px-4 py-8 text-center">
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-slate-50 text-slate-300">
            <Icon size={22} />
        </div>
        <p className="text-sm font-black text-slate-500">{title}</p>
        {desc && <p className="mt-1 max-w-xs text-xs font-semibold text-slate-400">{desc}</p>}
    </div>
);

/* --------------------------------------------------------------------------- */
/*  TOOLTIP PERSONALIZADO                                                      */
/* --------------------------------------------------------------------------- */
const ChartTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-sm">
            <p className="font-bold text-slate-700 mb-1">{label}</p>
            {payload.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
                    <span className="text-slate-500">{p.name}:</span>
                    <span className="font-bold text-slate-800">${Number(p.value || 0).toFixed(2)}</span>
                </div>
            ))}
        </div>
    );
};

/* ─────────────────────────────────────────────────────────────────────────── */
/*  DASHBOARD PRINCIPAL (ADMIN)                                                */
/* ─────────────────────────────────────────────────────────────────────────── */
const PRESETS = [
    { id: 'today',     label: 'Hoy' },
    { id: 'yesterday', label: 'Ayer' },
    { id: 'week',      label: 'Semana' },
    { id: 'month',     label: 'Mes' },
];

const Dashboard = () => {
    const { modules }  = useConfig();
    const { subscribe } = useWebSocket();
    const navigate     = useNavigate();
    const { user }     = useAuth();

    /* ── redireccion bodega ── */
    useEffect(() => {
        if (user?.role === 'WAREHOUSE') { navigate('/inventory-center', { replace: true }); }
    }, [user, navigate]);

    /* ── periodo seleccionado ── */
    const [preset, setPreset] = useState('today');
    const period = useMemo(() => dateRange(preset), [preset]);

    /* ── estados de datos ── */
    const [loading,       setLoading]       = useState(true);
    const help = useHelp();
    const [salesCurr,     setSalesCurr]     = useState(null);
    const [salesPrev,     setSalesPrev]     = useState(null);
    const [profitCurr,    setProfitCurr]    = useState(null);
    const [profitPrev,    setProfitPrev]    = useState(null);
    const [chartData,     setChartData]     = useState([]);
    const [topProducts,   setTopProducts]   = useState([]);
    const [topEmployees,  setTopEmployees]  = useState([]);
    const [credits,       setCredits]       = useState(null);
    const [recentSales,   setRecentSales]   = useState([]);
    const [alerts,        setAlerts]        = useState({ lowStock: 0, tallerReady: 0, overdueCredits: 0, pendingCommissions: 0 });
    const [paymentPie,    setPaymentPie]    = useState([]);

    /* ── carga principal ── */
    const buildChartFromDaily = useCallback((dailyRows = [], start, end) => {
        const startD = new Date(start + 'T12:00:00');
        const endD   = new Date(end   + 'T12:00:00');
        const days   = Math.round((endD - startD) / 86400000) + 1;
        const points = Math.min(days, 30);
        const dayNames = ['Dom','Lun','Mar','Mie','Jue','Vie','Sab'];
        const pad = (n) => String(n).padStart(2, '0');
        const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
        const byDate = new Map((dailyRows || []).map(row => [row.date, row]));

        return Array.from({ length: points }, (_, i) => {
            const d = new Date(startD);
            d.setDate(startD.getDate() + i);
            const ds = iso(d);
            const row = byDate.get(ds) || {};
            return {
                name: points <= 7 ? (i === points - 1 && preset === 'today' ? 'Hoy' : dayNames[d.getDay()]) : `${d.getDate()}/${d.getMonth()+1}`,
                Ventas: Number(row.revenue || 0),
                Ganancia: Number(row.gross_profit || 0),
            };
        });
    }, [preset]);

    const load = useCallback(async (silent = false, forceRefresh = false) => {
        if (!silent) setLoading(true);
        try {
            const { start, end } = period;

            const [init, empC, cred, recent, tallerData] = await Promise.all([
                unifiedReportService.getDashboardInit({ date_from: start, date_to: end, refresh: forceRefresh }),
                apiClient.get(`/commissions/summary`).catch(() => ({ data: [] })),
                unifiedReportService.getCreditsSummary().catch(() => null),
                unifiedReportService.getRecentTransactions(8).catch(() => []),
                modules?.services ? apiClient.get('/services/orders/status/ready').catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
            ]);

            const sales = init?.sales || {};
            const profit = init?.profit || {};
            const previous = init?.vs_previous || {};
            const revenue = Number(sales.revenue || 0);
            const count = Number(sales.count || 0);
            const previousCount = Number(previous.sales_count || 0);
            const previousRevenue = Number(previous.sales_revenue || 0);

            setSalesCurr({
                total_revenue: revenue,
                net_transactions: count,
                total_transactions: count,
                average_ticket: count > 0 ? revenue / count : 0,
            });
            setSalesPrev({
                total_revenue: previousRevenue,
                net_transactions: previousCount,
                total_transactions: previousCount,
                average_ticket: previousCount > 0 ? previousRevenue / previousCount : 0,
            });
            setProfitCurr({
                realized_profit: Number(profit.gross_profit || 0),
                total_profit: Number(profit.gross_profit || 0),
            });
            setProfitPrev({
                realized_profit: Number(previous.gross_profit || 0),
                total_profit: Number(previous.gross_profit || 0),
            });

            setTopProducts((init?.top_products || []).map((p, i) => ({
                product_id: p.product_id || i,
                product_name: p.product_name || p.name || 'Producto',
                revenue: Number(p.revenue || 0),
                quantity_sold: Number(p.quantity_sold || p.qty || 0),
            })));

            const empData = Array.isArray(empC?.data) ? empC.data : [];
            const empMap = {};
            empData.forEach(e => {
                const key = e.user_id;
                if (!empMap[key]) {
                    empMap[key] = {
                        user_id:         e.user_id,
                        username:        e.user_name,
                        full_name:       e.full_name || e.user_name,
                        commission_role: e.commission_role,
                        total_earned:    Number(e.total_earned || 0),
                        total_pending:   Number(e.pending_amount || 0),
                    };
                } else {
                    empMap[key].total_earned  += Number(e.total_earned || 0);
                    empMap[key].total_pending += Number(e.pending_amount || 0);
                }
            });
            setTopEmployees(Object.values(empMap).sort((a, b) => b.total_earned - a.total_earned).slice(0, 5));
            setCredits(cred);
            setRecentSales(Array.isArray(recent) ? recent : []);

            const PIE_COLORS = ['#6366f1','#10b981','#f59e0b','#3b82f6','#8b5cf6','#ef4444'];
            setPaymentPie((init?.payment_methods || []).slice(0, 6).map((p, i) => ({
                name:  p.method || p.payment_method || 'Otro',
                value: Number(p.total_amount || p.total || p.amount || 0),
                color: PIE_COLORS[i % PIE_COLORS.length],
            })));

            setChartData(buildChartFromDaily(init?.daily || [], start, end));

            const overdueCount = cred?.overdue_count || 0;
            const pendingComm  = empData.filter(e => Number(e.pending_amount || e.total_pending || 0) > 0).length;
            setAlerts({
                lowStock:           Array.isArray(init?.low_stock) ? init.low_stock.length : 0,
                tallerReady:        Array.isArray(tallerData?.data) ? tallerData.data.length : 0,
                overdueCredits:     overdueCount,
                pendingCommissions: pendingComm,
            });

        } catch (e) {
            if (e?.response?.status !== 403) toast.error('Error cargando el dashboard');
        } finally {
            setLoading(false);
        }
    }, [period, buildChartFromDaily, modules?.services]);

    useEffect(() => { if (user && user.role !== 'CASHIER') load(); }, [load, user]);
    useEffect(() => {
        if (!user || user.role === 'CASHIER') return;
        return subscribe('sale:created', () => load(true, true));
    }, [subscribe, user, load]);

    /* cajero → panel simplificado */
    if (user?.role === 'CASHIER') return <CashierDashboard />;

    /* ── RENDER ── */
    return (
        <div className="space-y-3 animate-in fade-in duration-300 max-w-[1540px] mx-auto pb-8 px-1">

            {/* ── HEADER ── */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <div>
                    <h1 className="text-xl font-black text-slate-900 tracking-tight">Resumen del Negocio</h1>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                        <span>Vista ejecutiva de ventas, ganancia y actividad</span>
                        <span className="hidden sm:inline text-slate-300">/</span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">{period.start} a {period.end}</span>
                    </div>
                </div>
                <div className="flex w-full flex-wrap items-center gap-2 xl:w-auto xl:justify-end">
                    {/* Selector de periodo */}
                    <div className="flex bg-slate-100 p-1 rounded-lg gap-1 shadow-inner shadow-slate-200/60">
                        {PRESETS.map(p => (
                            <button key={p.id} onClick={() => setPreset(p.id)}
                                className={`px-3 py-1.5 rounded-md text-xs font-black transition-all ${preset === p.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                                {p.label}
                            </button>
                        ))}
                    </div>
                    <HelpButton contextKey="dashboard" onClick={help.open} />
                    <button onClick={() => load(false, true)} title="Actualizar"
                        className="w-9 h-9 flex items-center justify-center bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm">
                        <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <button onClick={() => navigate('/pos')}
                        className="h-9 flex items-center gap-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-lg shadow-sm transition-all">
                        <Monitor size={15} /> Abrir POS
                    </button>
                </div>
            </div>

            {/* ── KPIs ── */}
            <div className={cn("grid grid-cols-2 sm:grid-cols-3 gap-3", modules?.services ? "lg:grid-cols-6" : "lg:grid-cols-5")}>
                <KPICard title="Ingresos"     value={salesCurr?.total_revenue || 0}      prevValue={salesPrev?.total_revenue}                             icon={DollarSign}   color="emerald" loading={loading} />
                <KPICard title="Ganancia real" value={profitCurr?.realized_profit || profitCurr?.total_profit || 0} prevValue={profitPrev?.realized_profit || profitPrev?.total_profit} icon={TrendingUp}  color="indigo"  loading={loading} />
                <KPICard title="Transacciones" value={salesCurr?.net_transactions || salesCurr?.total_transactions || 0} prevValue={salesPrev?.net_transactions || salesPrev?.total_transactions} icon={ShoppingCart} color="blue" isCurrency={false} loading={loading} />
                <KPICard title="Ticket prom."  value={salesCurr?.average_ticket || 0}     prevValue={salesPrev?.average_ticket}                            icon={BarChart2}    color="violet"  loading={loading} />
                <KPICard title="Créditos pend." value={credits?.total_pending_usd || 0}   prevValue={null}                                                 icon={CreditCard}   color="amber"   loading={loading} />
                {modules?.services && (
                    <KPICard title="Órdenes taller" value={alerts.tallerReady}                prevValue={null}                                                 icon={Wrench}       color="rose"    loading={loading} isCurrency={false} />
                )}
            </div>

            {/* ── ALERTAS ACCIONABLES ── */}
            {!loading && (alerts.lowStock > 0 || (modules?.services && alerts.tallerReady > 0) || alerts.overdueCredits > 0 || alerts.pendingCommissions > 0) && (
                <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                    <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                        <Bell size={12} /> Requieren atención
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                        {alerts.lowStock > 0 && (
                            <AlertCard icon={Package}     title="Stock bajo"         count={alerts.lowStock}           desc="Productos por debajo del mínimo"         color="red"    onClick={() => navigate('/products')} />
                        )}
                        {modules?.services && alerts.tallerReady > 0 && (
                            <AlertCard icon={Wrench}      title="Taller listo"       count={alerts.tallerReady}        desc="Órdenes listas para cobrar"              color="amber"  onClick={() => navigate('/services')} />
                        )}
                        {alerts.overdueCredits > 0 && (
                            <AlertCard icon={CreditCard}  title="Créditos vencidos"  count={alerts.overdueCredits}     desc="Clientes con deuda vencida"              color="red"    onClick={() => navigate('/accounts-receivable')} />
                        )}
                        {alerts.pendingCommissions > 0 && (
                            <AlertCard icon={DollarSign}  title="Comisiones pendientes" count={alerts.pendingCommissions} desc="Empleados con saldo por pagar"         color="violet" onClick={() => navigate('/reports?tab=comisiones')} />
                        )}
                    </div>
                </div>
            )}

            {/* ── GRÁFICO PRINCIPAL + MÉTODOS DE PAGO ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

                {/* Gráfico combinado */}
                <div className="lg:col-span-2 bg-white rounded-lg border border-slate-200 shadow-sm p-4">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="font-black text-slate-900 text-sm">Ventas vs Ganancia</h3>
                            <p className="text-xs text-slate-400 mt-0.5">{period.label} — comparativa diaria</p>
                        </div>
                    </div>
                    <div className="h-[260px]">
                        {loading ? (
                            <div className="h-full bg-slate-50 rounded-xl animate-pulse" />
                        ) : chartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} dy={8} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={v => `$${v}`} width={52} />
                                    <Tooltip content={<ChartTooltip />} />
                                    <Bar dataKey="Ventas"   fill="#e0e7ff" radius={[6,6,0,0]} />
                                    <Line dataKey="Ganancia" stroke="#6366f1" strokeWidth={2.5} dot={false} type="monotone" />
                                </ComposedChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-slate-400 text-sm">Sin ventas en este periodo</div>
                        )}
                    </div>
                </div>

                {/* Metodos de pago */}
                <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
                    <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                            <h3 className="font-black text-slate-900 text-sm">Metodos de Pago</h3>
                            <p className="text-xs text-slate-400">Distribucion del periodo</p>
                        </div>
                        {!loading && paymentPie.length > 0 && (
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-black text-slate-600">
                                {paymentPie.length} activos
                            </span>
                        )}
                    </div>
                    {loading ? (
                        <div className="h-52 bg-slate-50 rounded-lg animate-pulse" />
                    ) : paymentPie.length > 0 ? (() => {
                        const paymentTotal = paymentPie.reduce((sum, item) => sum + Number(item.value || 0), 0);
                        const mainPayment = paymentPie.reduce((max, item) => Number(item.value || 0) > Number(max.value || 0) ? item : max, paymentPie[0]);
                        return (
                            <>
                                <div className="relative h-40">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={paymentPie} cx="50%" cy="50%" innerRadius="62%" outerRadius="86%"
                                                 paddingAngle={3} dataKey="value" animationDuration={700}>
                                                {paymentPie.map((e, i) => <Cell key={i} fill={e.color} stroke="none" />)}
                                            </Pie>
                                            <Tooltip formatter={(v) => [`$${Number(v).toFixed(2)}`]} contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: '0 8px 20px rgb(15 23 42 / .10)', fontSize: 12 }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total</span>
                                        <span className="text-xl font-black tracking-tight text-slate-950">{fmtCompact(paymentTotal)}</span>
                                    </div>
                                </div>
                                <div className="mb-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                                    <div className="flex items-center justify-between gap-3 text-xs">
                                        <span className="font-bold text-slate-500">Principal</span>
                                        <span className="font-black text-slate-900 truncate">{mainPayment.name}</span>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    {paymentPie.map((e, i) => {
                                        const pct = paymentTotal > 0 ? Math.round((Number(e.value || 0) / paymentTotal) * 100) : 0;
                                        return (
                                            <div key={i}>
                                                <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                                                    <div className="flex min-w-0 items-center gap-1.5">
                                                        <div className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: e.color }} />
                                                        <span className="truncate font-bold text-slate-600">{e.name}</span>
                                                    </div>
                                                    <div className="shrink-0 text-right">
                                                        <span className="font-black text-slate-800">${Number(e.value).toFixed(0)}</span>
                                                        <span className="ml-1 text-[10px] font-bold text-slate-400">{pct}%</span>
                                                    </div>
                                                </div>
                                                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                                                    <div className="h-full rounded-full" style={{ width: `${Math.max(pct, 4)}%`, background: e.color }} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        );
                    })() : (
                        <EmptyState icon={CreditCard} title="Sin pagos en el periodo" desc="Los metodos usados apareceran cuando existan ventas." />
                    )}
                </div>
            </div>

            {/* Top productos + equipo */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                {/* Top productos */}
                <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                        <div>
                            <h3 className="font-black text-slate-800 text-sm">Top Productos</h3>
                            <p className="text-xs text-slate-400">Por ingresos — {period.label}</p>
                        </div>
                        <button onClick={() => navigate('/reports?tab=ventas')} className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-0.5">
                            Ver más <ChevronRight size={13} />
                        </button>
                    </div>
                    {loading ? (
                        <div className="p-4 space-y-3">{[...Array(5)].map((_,i) => <div key={i} className="h-8 bg-slate-50 rounded-xl animate-pulse" />)}</div>
                    ) : topProducts.length > 0 ? (
                        <div className="divide-y divide-slate-50">
                            {topProducts.map((p, i) => {
                                const maxRevenue = Math.max(...topProducts.map(item => Number(item.revenue || 0)), 1);
                                const width = Math.max(8, Math.round((Number(p.revenue || 0) / maxRevenue) * 100));
                                return (
                                    <div key={p.product_id || i} className="px-4 py-2.5 hover:bg-slate-50 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <span className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-600 text-xs font-black flex items-center justify-center shrink-0">{i+1}</span>
                                            <p className="flex-1 text-sm font-bold text-slate-700 truncate">{p.product_name}</p>
                                            <div className="text-right shrink-0">
                                                <p className="text-sm font-black text-slate-900">${Number(p.revenue || 0).toFixed(0)}</p>
                                                <p className="text-[11px] font-semibold text-slate-400">{Number(p.quantity_sold || 0).toFixed(0)} uds</p>
                                            </div>
                                        </div>
                                        <div className="ml-8 mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                            <div className="h-full rounded-full bg-indigo-500" style={{ width: `${width}%` }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <EmptyState icon={Package} title="Sin ventas en el periodo" desc="Cuando registres ventas apareceran aqui los productos con mejor rendimiento." />
                    )}
                </div>

                {/* Top empleados por comisiones */}
                <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                        <div>
                            <h3 className="font-black text-slate-800 text-sm">Rendimiento Equipo</h3>
                            <p className="text-xs text-slate-400">Comisiones generadas acumuladas</p>
                        </div>
                        <button onClick={() => navigate('/reports?tab=comisiones')} className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-0.5">
                            Ver más <ChevronRight size={13} />
                        </button>
                    </div>
                    {loading ? (
                        <div className="p-4 space-y-3">{[...Array(5)].map((_,i) => <div key={i} className="h-8 bg-slate-50 rounded-xl animate-pulse" />)}</div>
                    ) : topEmployees.length > 0 ? (
                        <div className="divide-y divide-slate-50">
                            {topEmployees.map((e, i) => {
                                const total   = Number(e.total_earned || 0);
                                const pending = Number(e.total_pending || 0);
                                return (
                                    <div key={e.user_id || i} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors">
                                        <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 text-xs font-black flex items-center justify-center shrink-0 uppercase">
                                            {(e.full_name || e.username || '?')[0]}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-slate-700 truncate">{e.full_name || e.username}</p>
                                            <p className="text-xs text-slate-400">{e.commission_role === 'TECHNICIAN' ? 'Técnico' : 'Vendedor'}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-bold text-slate-900">${total.toFixed(2)}</p>
                                            {pending > 0 && <p className="text-xs text-amber-600 font-semibold">${pending.toFixed(2)} pend.</p>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <EmptyState icon={Users} title="Sin comisiones registradas" desc="El rendimiento del equipo aparecera cuando existan comisiones." />
                    )}
                </div>
            </div>

            {/* Actividad reciente */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
                    <div>
                        <h3 className="font-black text-slate-800 text-sm">Actividad Reciente</h3>
                        <p className="text-xs text-slate-400">Ultimas 8 transacciones</p>
                    </div>
                    <button onClick={() => navigate('/sales-history')} className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-0.5 shrink-0">
                        Ver todo <ChevronRight size={13} />
                    </button>
                </div>
                {loading ? (
                    <div className="grid gap-2 p-4 md:grid-cols-2">{[...Array(6)].map((_,i) => <div key={i} className="h-16 bg-slate-50 rounded-lg animate-pulse" />)}</div>
                ) : recentSales.length > 0 ? (
                    <div className="grid gap-2 p-3 md:grid-cols-2 xl:grid-cols-4">
                        {recentSales.map(sale => {
                            const isCredit = !!sale.credit_sale;
                            const saleDate = sale.date ? new Date(sale.date) : null;
                            return (
                                <button key={sale.id} onClick={() => navigate('/sales-history')}
                                    className="group rounded-lg border border-slate-100 bg-slate-50/60 p-3 text-left transition-all hover:-translate-y-0.5 hover:border-indigo-100 hover:bg-white hover:shadow-md">
                                    <div className="mb-2 flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-black text-slate-900">{sale.customer?.name || 'Cliente General'}</p>
                                            <p className="mt-0.5 text-[11px] font-bold text-slate-400">#{sale.id}</p>
                                        </div>
                                        <span className="shrink-0 text-sm font-black text-slate-950">${Number(sale.total_amount||0).toFixed(2)}</span>
                                    </div>
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-white px-2 py-1 text-[11px] font-bold text-slate-600 shadow-sm">
                                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" />
                                            <span className="truncate">{sale.payment_method || 'Efectivo'}</span>
                                        </span>
                                        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] font-black ${isCredit ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                                            {isCredit ? <Clock size={10}/> : <CheckCircle size={10}/>}
                                            {isCredit ? 'Credito' : 'Pagado'}
                                        </span>
                                    </div>
                                    <div className="mt-2 flex items-center justify-between text-[11px] font-semibold text-slate-400">
                                        <span>{saleDate ? saleDate.toLocaleDateString('es-VE',{ month:'short', day:'numeric' }) : 'Sin fecha'}</span>
                                        <span>{saleDate ? saleDate.toLocaleTimeString('es-VE',{ hour:'2-digit', minute:'2-digit' }) : ''}</span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                ) : (
                    <EmptyState icon={ShoppingCart} title="Sin transacciones recientes" desc="Las ultimas ventas apareceran en esta seccion." />
                )}
            </div>

            {help.isOpen && <HelpDrawer contextKey="dashboard" onClose={help.close} />}
        </div>
    );
};

export default Dashboard;
