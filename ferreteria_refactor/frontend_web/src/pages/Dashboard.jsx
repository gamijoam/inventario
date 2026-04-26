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
const KPICard = ({ title, value, prevValue, icon: Icon, prefix = '$', isCurrency = true, color = 'indigo', loading = false }) => {
    const pct   = prevValue != null ? pctChange(Number(value || 0), Number(prevValue || 0)) : null;
    const up    = pct !== null && pct >= 0;
    const colorMap = {
        indigo:  'bg-indigo-50 text-indigo-600',
        emerald: 'bg-emerald-50 text-emerald-600',
        amber:   'bg-amber-50 text-amber-600',
        blue:    'bg-blue-50 text-blue-600',
        violet:  'bg-violet-50 text-violet-600',
        rose:    'bg-rose-50 text-rose-600',
    };

    if (loading) return (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm animate-pulse">
            <div className="h-3 bg-slate-100 rounded w-24 mb-4" />
            <div className="h-8 bg-slate-100 rounded w-32 mb-3" />
            <div className="h-3 bg-slate-100 rounded w-16" />
        </div>
    );

    return (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group">
            <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest leading-tight">{title}</p>
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${colorMap[color] || colorMap.indigo}`}>
                    <Icon size={16} />
                </div>
            </div>
            <div className="text-2xl font-black text-slate-900 tracking-tight mb-2">
                {isCurrency ? fmt(value) : (Number(value || 0).toLocaleString())}
            </div>
            {pct !== null ? (
                <div className="flex items-center gap-1.5">
                    <span className={`inline-flex items-center gap-0.5 text-xs font-bold px-1.5 py-0.5 rounded-full ${up ? 'text-emerald-700 bg-emerald-50' : 'text-rose-700 bg-rose-50'}`}>
                        {up ? <ArrowUpRight size={12} strokeWidth={3}/> : <ArrowDownRight size={12} strokeWidth={3}/>}
                        {Math.abs(pct).toFixed(1)}%
                    </span>
                    <span className="text-slate-400 text-[10px]">vs periodo anterior</span>
                </div>
            ) : (
                <span className="text-slate-400 text-[10px]">Sin datos anteriores</span>
            )}
        </div>
    );
};

/* ─────────────────────────────────────────────────────────────────────────── */
/*  ALERT CARD                                                                 */
/* ─────────────────────────────────────────────────────────────────────────── */
const AlertCard = ({ icon: Icon, title, count, desc, color, onClick }) => {
    const colorMap = {
        red:    'border-red-200 bg-red-50',
        amber:  'border-amber-200 bg-amber-50',
        blue:   'border-blue-200 bg-blue-50',
        violet: 'border-violet-200 bg-violet-50',
    };
    const iconMap = {
        red:    'text-red-600 bg-red-100',
        amber:  'text-amber-600 bg-amber-100',
        blue:   'text-blue-600 bg-blue-100',
        violet: 'text-violet-600 bg-violet-100',
    };
    return (
        <button onClick={onClick}
            className={`w-full text-left p-4 rounded-2xl border-2 flex items-center gap-3 hover:shadow-sm transition-all ${colorMap[color]}`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconMap[color]}`}>
                <Icon size={18} />
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800 text-sm">{title}</span>
                    <span className={`text-xs font-black px-1.5 py-0.5 rounded-full ${iconMap[color]}`}>{count}</span>
                </div>
                <p className="text-xs text-slate-500 truncate mt-0.5">{desc}</p>
            </div>
            <ChevronRight size={16} className="text-slate-400 shrink-0" />
        </button>
    );
};

/* ─────────────────────────────────────────────────────────────────────────── */
/*  TOOLTIP PERSONALIZADO                                                      */
/* ─────────────────────────────────────────────────────────────────────────── */
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
    const load = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const { start, end, prevStart, prevEnd } = period;

            const [curr, prev, profC, profP, topP, empC, cred, recent, payments] = await Promise.all([
                unifiedReportService.getSalesSummary({ start_date: start, end_date: end }),
                unifiedReportService.getSalesSummary({ start_date: prevStart, end_date: prevEnd }),
                unifiedReportService.getProfitability({ start_date: start, end_date: end }),
                unifiedReportService.getProfitability({ start_date: prevStart, end_date: prevEnd }),
                unifiedReportService.getTopProducts({ start_date: start, end_date: end, limit: 5, by: 'revenue' }).catch(() => []),
                apiClient.get(`/commissions/summary`).catch(() => ({ data: [] })),
                unifiedReportService.getCreditsSummary().catch(() => null),
                unifiedReportService.getRecentTransactions(8).catch(() => []),
                unifiedReportService.getSalesByPaymentMethod({ start_date: start, end_date: end }).catch(() => []),
            ]);

            setSalesCurr(curr);
            setSalesPrev(prev);
            setProfitCurr(profC);
            setProfitPrev(profP);
            setTopProducts(Array.isArray(topP) ? topP : []);
            const empData = Array.isArray(empC?.data) ? empC.data : [];
            // Consolidar por usuario (puede haber VENDOR + TECHNICIAN del mismo user)
            const empMap = {};
            empData.forEach(e => {
                const key = e.user_id;
                if (!empMap[key]) {
                    empMap[key] = {
                        user_id:        e.user_id,
                        username:       e.user_name,
                        full_name:      e.full_name || e.user_name,
                        commission_role: e.commission_role,
                        total_earned:   Number(e.total_earned || 0),
                        total_pending:  Number(e.pending_amount || 0),
                    };
                } else {
                    empMap[key].total_earned  += Number(e.total_earned || 0);
                    empMap[key].total_pending += Number(e.pending_amount || 0);
                }
            });
            const consolidated = Object.values(empMap)
                .sort((a, b) => b.total_earned - a.total_earned)
                .slice(0, 5);
            setTopEmployees(consolidated);
            setCredits(cred);
            setRecentSales(Array.isArray(recent) ? recent : []);

            /* métodos de pago → pie */
            const PIE_COLORS = ['#6366f1','#10b981','#f59e0b','#3b82f6','#8b5cf6','#ef4444'];
            const pieArr = Array.isArray(payments) ? payments : (payments?.data || []);
            setPaymentPie(pieArr.slice(0, 6).map((p, i) => ({
                name:  p.method || p.payment_method || 'Otro',
                value: Number(p.total_amount || p.total || p.amount || 0),
                color: PIE_COLORS[i % PIE_COLORS.length],
            })));

            /* gráfico diario del periodo */
            await buildChart(start, end);

            /* alertas */
            const [lowStockData, tallerData] = await Promise.all([
                unifiedReportService.getLowStock(5).catch(() => []),
                apiClient.get('/services/orders/status/ready').catch(() => ({ data: [] })),
            ]);
            const overdueCount = cred?.overdue_count || 0;
            const pendingComm  = empC?.data?.filter(e => Number(e.total_pending || 0) > 0)?.length || 0;
            setAlerts({
                lowStock:            Array.isArray(lowStockData) ? lowStockData.length : 0,
                tallerReady:         Array.isArray(tallerData?.data) ? tallerData.data.length : 0,
                overdueCredits:      overdueCount,
                pendingCommissions:  pendingComm,
            });

        } catch (e) {
            if (e?.response?.status !== 403) toast.error('Error cargando el dashboard');
        } finally {
            setLoading(false);
        }
    }, [period]);

    const buildChart = async (start, end) => {
        const startD = new Date(start + 'T12:00:00');
        const endD   = new Date(end   + 'T12:00:00');
        const days   = Math.round((endD - startD) / 86400000) + 1;
        const points = Math.min(days, 30);
        const dayNames = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
        const pad = (n) => String(n).padStart(2, '0');
        const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

        const promises = [];
        const labels   = [];
        for (let i = 0; i < points; i++) {
            const d = new Date(startD); d.setDate(startD.getDate() + i);
            const ds = iso(d);
            labels.push(points <= 7 ? (i === points-1 && preset === 'today' ? 'Hoy' : dayNames[d.getDay()]) : `${d.getDate()}/${d.getMonth()+1}`);
            promises.push(
                Promise.all([
                    unifiedReportService.getSalesSummary({ start_date: ds, end_date: ds }).catch(() => ({ total_revenue: 0 })),
                    unifiedReportService.getProfitability({ start_date: ds, end_date: ds }).catch(() => ({ realized_profit: 0 })),
                ])
            );
        }
        const results = await Promise.all(promises);
        setChartData(results.map(([s, p], i) => ({
            name:    labels[i],
            Ventas:  Number(s?.total_revenue || 0),
            Ganancia: Number(p?.realized_profit || p?.total_profit || 0),
        })));
    };

    useEffect(() => { if (user && user.role !== 'CASHIER') load(); }, [load, user]);
    useEffect(() => {
        if (!user || user.role === 'CASHIER') return;
        return subscribe('sale:created', () => load(true));
    }, [subscribe, user, load]);

    /* cajero → panel simplificado */
    if (user?.role === 'CASHIER') return <CashierDashboard />;

    /* ── RENDER ── */
    return (
        <div className="space-y-6 animate-in fade-in duration-300 max-w-7xl mx-auto pb-12 px-1">

            {/* ── HEADER ── */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-1">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">Resumen del Negocio</h1>
                    <p className="text-slate-500 text-sm mt-0.5">Vista general de tu actividad</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Selector de periodo */}
                    <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                        {PRESETS.map(p => (
                            <button key={p.id} onClick={() => setPreset(p.id)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${preset === p.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                                {p.label}
                            </button>
                        ))}
                    </div>
                    <HelpButton contextKey="dashboard" onClick={help.open} />
                    <button onClick={() => load()} title="Actualizar"
                        className="w-9 h-9 flex items-center justify-center bg-white border border-slate-200 rounded-xl text-slate-500 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm">
                        <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <button onClick={() => navigate('/pos')}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow-sm transition-all">
                        <Monitor size={15} /> Abrir POS
                    </button>
                </div>
            </div>

            {/* ── KPIs ── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <KPICard title="Ingresos"     value={salesCurr?.total_revenue || 0}      prevValue={salesPrev?.total_revenue}                             icon={DollarSign}   color="emerald" loading={loading} />
                <KPICard title="Ganancia real" value={profitCurr?.realized_profit || profitCurr?.total_profit || 0} prevValue={profitPrev?.realized_profit || profitPrev?.total_profit} icon={TrendingUp}  color="indigo"  loading={loading} />
                <KPICard title="Transacciones" value={salesCurr?.net_transactions || salesCurr?.total_transactions || 0} prevValue={salesPrev?.net_transactions || salesPrev?.total_transactions} icon={ShoppingCart} color="blue" isCurrency={false} loading={loading} />
                <KPICard title="Ticket prom."  value={salesCurr?.average_ticket || 0}     prevValue={salesPrev?.average_ticket}                            icon={BarChart2}    color="violet"  loading={loading} />
                <KPICard title="Créditos pend." value={credits?.total_pending_usd || 0}   prevValue={null}                                                 icon={CreditCard}   color="amber"   loading={loading} />
                <KPICard title="Órdenes taller" value={alerts.tallerReady}                prevValue={null}                                                 icon={Wrench}       color="rose"    loading={loading} isCurrency={false} />
            </div>

            {/* ── ALERTAS ACCIONABLES ── */}
            {!loading && (alerts.lowStock > 0 || alerts.tallerReady > 0 || alerts.overdueCredits > 0 || alerts.pendingCommissions > 0) && (
                <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                        <Bell size={12} /> Requieren atención
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                        {alerts.lowStock > 0 && (
                            <AlertCard icon={Package}     title="Stock bajo"         count={alerts.lowStock}           desc="Productos por debajo del mínimo"         color="red"    onClick={() => navigate('/products')} />
                        )}
                        {alerts.tallerReady > 0 && (
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
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

                {/* Gráfico combinado */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="font-bold text-slate-800">Ventas vs Ganancia</h3>
                            <p className="text-xs text-slate-400 mt-0.5">{period.label} — comparativa diaria</p>
                        </div>
                    </div>
                    <div className="h-64">
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

                {/* Métodos de pago */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                    <h3 className="font-bold text-slate-800 mb-1">Métodos de Pago</h3>
                    <p className="text-xs text-slate-400 mb-3">Distribución del periodo</p>
                    {loading ? (
                        <div className="h-44 bg-slate-50 rounded-xl animate-pulse" />
                    ) : paymentPie.length > 0 ? (
                        <>
                            <div className="h-36">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={paymentPie} cx="50%" cy="50%" innerRadius="55%" outerRadius="80%"
                                             paddingAngle={3} dataKey="value" animationDuration={800}>
                                            {paymentPie.map((e, i) => <Cell key={i} fill={e.color} stroke="none" />)}
                                        </Pie>
                                        <Tooltip formatter={(v) => [`$${Number(v).toFixed(2)}`]} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgb(0 0 0 / .1)', fontSize: 12 }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="space-y-1.5 mt-2">
                                {paymentPie.map((e, i) => (
                                    <div key={i} className="flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-2.5 h-2.5 rounded-full" style={{ background: e.color }} />
                                            <span className="text-slate-600 font-medium">{e.name}</span>
                                        </div>
                                        <span className="font-bold text-slate-700">${Number(e.value).toFixed(0)}</span>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div className="h-44 flex items-center justify-center text-slate-400 text-xs">Sin pagos en el periodo</div>
                    )}
                </div>
            </div>

            {/* ── TOP PRODUCTOS + TOP EMPLEADOS ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                {/* Top productos */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                        <div>
                            <h3 className="font-bold text-slate-800 text-sm">Top Productos</h3>
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
                            {topProducts.map((p, i) => (
                                <div key={p.product_id || i} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors">
                                    <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 text-xs font-black flex items-center justify-center shrink-0">{i+1}</span>
                                    <p className="flex-1 text-sm font-semibold text-slate-700 truncate">{p.product_name}</p>
                                    <div className="text-right">
                                        <p className="text-sm font-bold text-slate-900">${Number(p.revenue || 0).toFixed(0)}</p>
                                        <p className="text-xs text-slate-400">{Number(p.quantity_sold || 0).toFixed(0)} uds</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="py-10 text-center text-slate-400 text-sm">Sin ventas en el periodo</div>
                    )}
                </div>

                {/* Top empleados por comisiones */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                        <div>
                            <h3 className="font-bold text-slate-800 text-sm">Rendimiento Equipo</h3>
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
                                    <div key={e.user_id || i} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors">
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
                        <div className="py-10 text-center text-slate-400 text-sm">Sin comisiones registradas</div>
                    )}
                </div>
            </div>

            {/* ── ACTIVIDAD RECIENTE MEJORADA ── */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                    <div>
                        <h3 className="font-bold text-slate-800 text-sm">Actividad Reciente</h3>
                        <p className="text-xs text-slate-400">Últimas 8 transacciones</p>
                    </div>
                    <button onClick={() => navigate('/sales-history')} className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-0.5">
                        Ver todo <ChevronRight size={13} />
                    </button>
                </div>
                {loading ? (
                    <div className="p-4 space-y-2">{[...Array(5)].map((_,i) => <div key={i} className="h-10 bg-slate-50 rounded-xl animate-pulse" />)}</div>
                ) : recentSales.length > 0 ? (
                    <>
                        {/* Mobile */}
                        <div className="block md:hidden divide-y divide-slate-50">
                            {recentSales.slice(0,5).map(sale => (
                                <div key={sale.id} className="px-5 py-3 hover:bg-slate-50">
                                    <div className="flex justify-between items-start">
                                        <p className="font-semibold text-slate-800 text-sm">{sale.customer?.name || 'Cliente General'}</p>
                                        <span className="font-bold text-slate-900 text-sm">${Number(sale.total_amount||0).toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-xs text-slate-400 mt-0.5">
                                        <span>#{sale.id} · {sale.payment_method || 'Efectivo'}</span>
                                        <span>{sale.date ? new Date(sale.date).toLocaleTimeString('es-VE',{hour:'2-digit',minute:'2-digit'}) : ''}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {/* Desktop */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead className="border-b border-slate-100 bg-slate-50/50">
                                    <tr>
                                        <th className="px-5 py-3 text-left font-semibold text-slate-500 text-xs uppercase tracking-wider">Cliente</th>
                                        <th className="px-5 py-3 text-left font-semibold text-slate-500 text-xs uppercase tracking-wider">Fecha</th>
                                        <th className="px-5 py-3 text-left font-semibold text-slate-500 text-xs uppercase tracking-wider">Método</th>
                                        <th className="px-5 py-3 text-left font-semibold text-slate-500 text-xs uppercase tracking-wider">Estado</th>
                                        <th className="px-5 py-3 text-right font-semibold text-slate-500 text-xs uppercase tracking-wider">Monto</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {recentSales.map(sale => (
                                        <tr key={sale.id} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="px-5 py-3.5">
                                                <p className="font-semibold text-slate-800">{sale.customer?.name || 'Cliente General'}</p>
                                                <p className="text-xs text-slate-400">#{sale.id}</p>
                                            </td>
                                            <td className="px-5 py-3.5 text-slate-500 text-xs">
                                                {sale.date ? new Date(sale.date).toLocaleDateString('es-VE',{ month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'}) : '—'}
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-300" />
                                                    {sale.payment_method || 'Efectivo'}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${sale.credit_sale ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                                                    {sale.credit_sale ? <Clock size={10}/> : <CheckCircle size={10}/>}
                                                    {sale.credit_sale ? 'Crédito' : 'Pagado'}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5 text-right font-bold text-slate-900">
                                                ${Number(sale.total_amount||0).toFixed(2)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                ) : (
                    <div className="py-14 text-center">
                        <Package size={36} className="text-slate-200 mx-auto mb-3" />
                        <p className="text-slate-400 text-sm font-medium">Sin transacciones recientes</p>
                    </div>
                )}
            </div>

            {help.isOpen && <HelpDrawer contextKey="dashboard" onClose={help.close} />}
        </div>
    );
};

export default Dashboard;
