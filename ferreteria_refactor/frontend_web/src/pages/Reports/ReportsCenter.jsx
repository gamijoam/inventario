import { useSearchParams } from 'react-router-dom';
import React, { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import HelpDrawer, { HelpButton } from '../../help/HelpDrawer';
import { useHelp } from '../../help/useHelp';
import {
    Building2,
    BarChart3, ShoppingCart, Landmark, CreditCard, Truck,
    Package, DollarSign, Calendar, Download, RefreshCw,
    TrendingUp, ArrowUpRight, ArrowDownRight, Pill
} from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { toast } from 'react-hot-toast';
import unifiedReportService from '../../services/unifiedReportService';
import reportService from '../../services/reportService';
import { useConfig } from '../../context/ConfigContext';

const SalesTab = lazy(() => import('./tabs/SalesTab'));
const CashTab = lazy(() => import('./tabs/CashTab'));
const CreditsTab = lazy(() => import('./tabs/CreditsTab'));
const SuppliersTab = lazy(() => import('./tabs/SuppliersTab'));
const InventoryTab = lazy(() => import('./tabs/InventoryTab'));
const PharmacyTab = lazy(() => import('./tabs/PharmacyTab'));
const CommissionsTab = lazy(() => import('./tabs/CommissionsTab'));
const IntelligenceTab = lazy(() => import('./tabs/IntelligenceTab'));
const FinanciadoresTab = lazy(() => import('./tabs/FinanciadoresTab'));

// --- Tab definitions ---
const TABS = [
    { id: 'resumen', label: 'Resumen', icon: BarChart3 },
    { id: 'ventas', label: 'Ventas', icon: ShoppingCart },
    { id: 'caja', label: 'Caja', icon: Landmark },
    { id: 'creditos', label: 'Créditos', icon: CreditCard },
    { id: 'proveedores', label: 'Proveedores', icon: Truck },
    { id: 'inventario', label: 'Inventario', icon: Package },
    { id: 'farmacia', label: 'Farmacia', icon: Pill, moduleRequired: 'pharmacy' },
    { id: 'comisiones', label: 'Comisiones', icon: DollarSign },
    { id: 'intelligence', label: '🧠 Inteligencia', icon: TrendingUp },
    { id: 'financiadoras', label: 'Financiadoras', icon: Building2, moduleRequired: 'external_financing' },
];

// --- Date helpers ---
const toDateStr = (date) => {
    const d = date instanceof Date ? date : new Date(date);
    return d.getFullYear() + '-' +
        String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0');
};

const getFirstOfMonth = () => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
};

const getToday = () => new Date();

const addDays = (date, days) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
};

const daysBetween = (start, end) => {
    const s = new Date(start);
    const e = new Date(end);
    return Math.round((e - s) / (1000 * 60 * 60 * 24));
};

// --- Currency formatter ---
const fmtCurrency = (amount, currency = 'USD') => {
    try {
        const num = Number(amount) || 0;
        const abs = Math.abs(num);
        const frac = abs > 0 && abs < 1 ? 4 : 2;
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency,
            minimumFractionDigits: frac,
            maximumFractionDigits: frac,
        }).format(num);
    } catch {
        return `$${(Number(amount) || 0).toFixed(2)}`;
    }
};

const fmtNumber = (n) => new Intl.NumberFormat('es-VE').format(Number(n) || 0);

// --- Payment method colors ---
const PAYMENT_COLORS = {
    'Efectivo': '#10b981',
    'Efectivo USD': '#059669',
    'Efectivo Bs': '#34d399',
    'Transferencia': '#3b82f6',
    'PdV': '#8b5cf6',
    'Punto de Venta': '#8b5cf6',
    'Zelle': '#f97316',
    'Pago Movil': '#06b6d4',
    'Pago Móvil': '#06b6d4',
};
const DEFAULT_PIE_COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f97316', '#06b6d4', '#f43f5e', '#eab308', '#64748b'];

// --- Skeleton components ---
const SkeletonCard = () => (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm animate-pulse">
        <div className="h-3 w-24 bg-slate-200 rounded mb-4" />
        <div className="h-8 w-32 bg-slate-200 rounded mb-3" />
        <div className="h-3 w-20 bg-slate-100 rounded" />
    </div>
);

const SkeletonChart = () => (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm animate-pulse">
        <div className="h-4 w-40 bg-slate-200 rounded mb-2" />
        <div className="h-3 w-56 bg-slate-100 rounded mb-6" />
        <div className="h-64 bg-slate-50 rounded-lg" />
    </div>
);

const SkeletonTable = () => (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm animate-pulse">
        <div className="h-4 w-40 bg-slate-200 rounded mb-6" />
        {[...Array(5)].map((_, i) => (
            <div key={i} className="flex gap-4 mb-3">
                <div className="h-3 w-6 bg-slate-100 rounded" />
                <div className="h-3 flex-1 bg-slate-100 rounded" />
                <div className="h-3 w-16 bg-slate-100 rounded" />
                <div className="h-3 w-20 bg-slate-100 rounded" />
            </div>
        ))}
    </div>
);

// --- KPI Card with comparison ---
const KPICard = ({ title, value, prevValue, icon: Icon, color = 'bg-emerald-500', prefix = '', isCurrency = true, currency = 'USD', showComparison = true }) => {
    const change = useMemo(() => {
        if (!showComparison || prevValue === null || prevValue === undefined) return null;
        const curr = Number(value) || 0;
        const prev = Number(prevValue) || 0;
        if (prev === 0) return curr > 0 ? { pct: 100, direction: 'up' } : null;
        const pct = ((curr - prev) / Math.abs(prev)) * 100;
        return { pct, direction: pct >= 0 ? 'up' : 'down' };
    }, [value, prevValue, showComparison]);

    const displayValue = isCurrency ? fmtCurrency(value, currency) : fmtNumber(value);

    return (
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-lg hover:ring-1 hover:ring-emerald-500/20 transition-all duration-300 relative overflow-hidden group hover:-translate-y-0.5">
            <div className="flex justify-between items-start mb-3">
                <p className="text-slate-500 text-xs font-bold uppercase tracking-wider leading-tight">{title}</p>
                <div className={`p-2 rounded-lg ${color} bg-opacity-10 group-hover:bg-opacity-20 transition-colors`}>
                    <Icon size={16} className={`${color.replace('bg-', 'text-')}`} />
                </div>
            </div>
            <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-1">
                {prefix}{displayValue}
            </h3>
            {change !== null && (
                <div className="flex items-center gap-1.5">
                    <span className={`inline-flex items-center gap-0.5 text-xs font-bold px-1.5 py-0.5 rounded-full ${
                        change.direction === 'up'
                            ? 'text-emerald-700 bg-emerald-50'
                            : 'text-rose-700 bg-rose-50'
                    }`}>
                        {change.direction === 'up'
                            ? <ArrowUpRight size={12} strokeWidth={3} />
                            : <ArrowDownRight size={12} strokeWidth={3} />
                        }
                        {Math.abs(change.pct).toFixed(1)}%
                    </span>
                    <span className="text-slate-400 text-[10px] font-medium uppercase">vs periodo anterior</span>
                </div>
            )}
        </div>
    );
};

// --- Custom Recharts tooltip ---
const ChartTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-lg p-3 text-sm">
            <p className="font-bold text-slate-700 mb-1">{label}</p>
            {payload.map((entry, i) => (
                <p key={i} className="text-slate-600">
                    <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ backgroundColor: entry.color }} />
                    {entry.name}: {fmtCurrency(entry.value)}
                </p>
            ))}
        </div>
    );
};

// --- Pie chart custom label ---
const renderPieLabel = ({ name, percent }) => {
    if (percent < 0.04) return null;
    return `${(percent * 100).toFixed(0)}%`;
};

// ============================================================
// MAIN COMPONENT
// ============================================================
const ReportsCenter = () => {
    const { modules, business } = useConfig();

    // --- State ---
    const [searchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'resumen');
    const help = useHelp();
    const [activePreset, setActivePreset] = useState('month');
    const [loading, setLoading] = useState(false);
    const [dateRange, setDateRange] = useState({
        start: toDateStr(getFirstOfMonth()),
        end: toDateStr(getToday()),
    });

    // Resumen data
    const [salesSummary, setSalesSummary] = useState(null);
    const [prevSalesSummary, setPrevSalesSummary] = useState(null);
    const [profitData, setProfitData] = useState(null);
    const [prevProfitData, setPrevProfitData] = useState(null);
    const [creditsSummary, setCreditsSummary] = useState(null);
    const [dailySales, setDailySales] = useState([]);
    const [paymentMethods, setPaymentMethods] = useState([]);
    const [topProducts, setTopProducts] = useState([]);
    const [topCustomers, setTopCustomers] = useState([]);
    const helpKey = {
        resumen:     'reports/resumen',
        ventas:      'reports/ventas',
        caja:        'reports/caja',
        creditos:    'reports/creditos',
        proveedores: 'reports/proveedores',
        inventario:  'reports/inventario',
        comisiones:  'reports/comisiones',
        farmacia:    'reports/inventario',
    }[activeTab] || null;

    // --- Compute previous period ---
    const prevPeriod = useMemo(() => {
        const days = daysBetween(dateRange.start, dateRange.end);
        const prevEnd = addDays(dateRange.start, -1);
        const prevStart = addDays(prevEnd, -days);
        return {
            start: toDateStr(prevStart),
            end: toDateStr(prevEnd),
        };
    }, [dateRange]);

    // --- Date presets ---
    const applyPreset = (preset) => {
        const today = getToday();
        let start;
        switch (preset) {
            case 'today':
                start = today;
                break;
            case '7d':
                start = addDays(today, -6);
                break;
            case 'month':
                start = getFirstOfMonth();
                break;
            case '30d':
                start = addDays(today, -29);
                break;
            case '90d':
                start = addDays(today, -89);
                break;
            case 'year':
                start = new Date(today.getFullYear(), 0, 1);
                break;
            default:
                start = getFirstOfMonth();
        }
        setDateRange({ start: toDateStr(start), end: toDateStr(today) });
        setActivePreset(preset);
    };

    const presets = [
        { id: 'today', label: 'Hoy' },
        { id: '7d', label: '7D' },
        { id: 'month', label: 'Mes' },
        { id: '30d', label: '30D' },
        { id: '90d', label: '90D' },
        { id: 'year', label: 'Año' },
    ];

    // --- Load data for Resumen tab ---
    const loadResumenData = useCallback(async () => {
        setLoading(true);
        try {
            // PERF: Usar dashboard-init (1 request) en lugar de 6-8 requests separados
            // Luego en paralelo cargar lo que falta (clientes, ventas detalladas)
            const [dashInit, customersRes] = await Promise.allSettled([
                apiClient.get('/reports/dashboard-init', {
                    params: { date_from: dateRange.start, date_to: dateRange.end },
                    _silentNetworkError: true,
                }),
                unifiedReportService.getSalesByCustomer({
                    start_date: dateRange.start, end_date: dateRange.end, limit: 10
                }),
            ]);

            if (dashInit.status === 'fulfilled' && dashInit.value?.data) {
                const d = dashInit.value.data;

                // Sales summary
                setSalesSummary({
                    total_sales: d.sales.count,
                    total_revenue: d.sales.revenue,
                    total_discounts: d.sales.discounts,
                });

                // Profitability
                setProfitData({
                    revenue: d.profit.revenue,
                    cost: d.profit.cost,
                    gross_profit: d.profit.gross_profit,
                    margin_pct: d.profit.margin_pct,
                });

                // Credits
                setCreditsSummary({
                    count: d.sales.credit_count,
                    amount: d.sales.credit_amount,
                });

                // Top products
                setTopProducts(d.top_products.map(p => ({
                    name: p.name, total_quantity: p.qty, total_revenue: p.revenue
                })));

                // Payment methods
                setPaymentMethods(d.payment_methods.map(m => ({
                    method: m.method, payment_method: m.method,
                    count: m.count, total_amount: m.total
                })));

                // Período anterior
                setPrevSalesSummary({
                    total_sales: d.vs_previous.sales_count,
                    total_revenue: d.vs_previous.sales_revenue,
                });
                setPrevProfitData(null);
                setDailySales([]);
            } else {
                // Fallback a requests individuales si dashboard-init falla
                const params = { start_date: dateRange.start, end_date: dateRange.end };
                const [s, p, c, tp, pm] = await Promise.allSettled([
                    unifiedReportService.getSalesSummary(params),
                    unifiedReportService.getProfitability(params),
                    unifiedReportService.getCreditsSummary(),
                    unifiedReportService.getTopProducts({ ...params, limit: 10, by: 'revenue' }),
                    unifiedReportService.getSalesByPaymentMethod(params),
                ]);
                const gv = r => r.status === 'fulfilled' ? r.value : null;
                setSalesSummary(gv(s));
                setProfitData(gv(p));
                setCreditsSummary(gv(c));
                setTopProducts(Array.isArray(gv(tp)) ? gv(tp) : []);
                setPaymentMethods(Array.isArray(gv(pm)) ? gv(pm) : []);
            }

            // Clientes top (request separado — no está en dashboard-init)
            if (customersRes.status === 'fulfilled') {
                setTopCustomers(Array.isArray(customersRes.value) ? customersRes.value : []);
            }

        } catch (error) {
            console.error('Error loading resumen data:', error);
            toast.error('Error cargando datos del resumen');
        } finally {
            setLoading(false);
        }
    }, [dateRange, prevPeriod]);

    // Load on mount and when date/tab changes
    useEffect(() => {
        if (activeTab === 'resumen') {
            loadResumenData();
        }
    }, [activeTab, dateRange, loadResumenData]);

    // --- Export handler ---
    const handleExport = async () => {
        const toastId = toast.loading('Generando reporte Excel...');
        try {
            await reportService.downloadExcelReport(dateRange.start, dateRange.end);
            toast.success('Reporte descargado correctamente', { id: toastId });
        } catch (error) {
            console.error('Export error:', error);
            toast.error('Error al generar el reporte Excel', { id: toastId });
        }
    };

    // --- Date change handler ---
    const handleDateChange = (e) => {
        const { name, value } = e.target;
        setDateRange(prev => ({ ...prev, [name]: value }));
        setActivePreset(null);
    };

    // --- Filtered tabs (hide module-specific tabs if module not active) ---
    const visibleTabs = useMemo(() => {
        return TABS.filter(tab => {
            if (!tab.moduleRequired) return true;
            if (tab.moduleRequired === 'external_financing') {
                return business?.external_financing_enabled === true || business?.external_financing_enabled === 'true';
            }
            return modules?.[tab.moduleRequired];
        });
    }, [modules]);

    // --- Chart data for daily sales ---
    const chartData = useMemo(() => {
        return dailySales.map(d => ({
            name: new Date(d.date + 'T12:00:00').toLocaleDateString('es-VE', { day: '2-digit', month: 'short' }),
            Ventas: Number(d.revenue.toFixed(2)),
        }));
    }, [dailySales]);

    // --- Pie data for payment methods ---
    const pieData = useMemo(() => {
        if (!paymentMethods.length) return [];
        const total = paymentMethods.reduce((sum, m) => sum + (Number(m.total_amount) || Number(m.total) || Number(m.amount) || 0), 0);
        return paymentMethods.map((m, i) => {
            const amount = Number(m.total_amount) || Number(m.total) || Number(m.amount) || 0;
            return {
                name: m.method || m.payment_method || m.name || `Metodo ${i + 1}`,
                value: amount,
                pct: total > 0 ? ((amount / total) * 100).toFixed(1) : '0.0',
                color: PAYMENT_COLORS[m.method || m.payment_method || m.name] || DEFAULT_PIE_COLORS[i % DEFAULT_PIE_COLORS.length],
            };
        }).filter(d => d.value > 0);
    }, [paymentMethods]);

    // ============================================================
    // RENDER: Resumen Tab
    // ============================================================
    const renderResumen = () => {
        if (loading) {
            return (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                        {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <SkeletonChart />
                        <SkeletonChart />
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <SkeletonTable />
                        <SkeletonTable />
                    </div>
                </div>
            );
        }

        return (
            <div className="space-y-6">
                {/* KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    <KPICard
                        title="Ingresos Totales (USD)"
                        value={salesSummary?.total_revenue || 0}
                        prevValue={prevSalesSummary?.total_revenue}
                        icon={DollarSign}
                        color="bg-emerald-500"
                    />
                    <KPICard
                        title="Ingresos Totales (Bs)"
                        value={salesSummary?.total_ves || salesSummary?.total_revenue_bs || 0}
                        prevValue={prevSalesSummary?.total_ves || prevSalesSummary?.total_revenue_bs}
                        icon={DollarSign}
                        color="bg-blue-500"
                        currency="VES"
                    />
                    <KPICard
                        title="Ganancia Real (USD)"
                        value={profitData?.realized_profit || profitData?.total_profit || 0}
                        prevValue={prevProfitData?.realized_profit || prevProfitData?.total_profit}
                        icon={TrendingUp}
                        color="bg-teal-500"
                    />
                    <KPICard
                        title="Transacciones"
                        value={salesSummary?.total_transactions || salesSummary?.net_transactions || 0}
                        prevValue={prevSalesSummary?.total_transactions || prevSalesSummary?.net_transactions}
                        icon={ShoppingCart}
                        color="bg-indigo-500"
                        isCurrency={false}
                    />
                    <KPICard
                        title="Ticket Promedio (USD)"
                        value={salesSummary?.average_ticket || 0}
                        prevValue={prevSalesSummary?.average_ticket}
                        icon={BarChart3}
                        color="bg-purple-500"
                    />
                    <KPICard
                        title="Créditos Pendientes (USD)"
                        value={creditsSummary?.total_pending_usd || 0}
                        prevValue={null}
                        icon={CreditCard}
                        color="bg-amber-500"
                        showComparison={false}
                    />
                </div>

                {/* Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Area Chart: Ventas por Dia */}
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <div className="mb-4">
                            <h3 className="text-base font-bold text-slate-900">Ventas por Día</h3>
                            <p className="text-sm text-slate-500">Ingresos diarios en el periodo seleccionado</p>
                        </div>
                        {chartData.length > 0 ? (
                            <div className="h-72">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis
                                            dataKey="name"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: '#94a3b8', fontSize: 11 }}
                                            dy={10}
                                            interval="preserveStartEnd"
                                        />
                                        <YAxis
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: '#94a3b8', fontSize: 11 }}
                                            tickFormatter={(v) => `$${v}`}
                                            width={55}
                                        />
                                        <Tooltip content={<ChartTooltip />} />
                                        <Area
                                            type="monotone"
                                            dataKey="Ventas"
                                            stroke="#10b981"
                                            strokeWidth={2.5}
                                            fillOpacity={1}
                                            fill="url(#colorVentas)"
                                            animationDuration={1200}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="h-72 flex items-center justify-center text-slate-400 text-sm">
                                Sin datos de ventas en este periodo
                            </div>
                        )}
                    </div>

                    {/* Donut Chart: Metodos de Pago */}
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <div className="mb-4">
                            <h3 className="text-base font-bold text-slate-900">Métodos de Pago</h3>
                            <p className="text-sm text-slate-500">Distribución por método de pago</p>
                        </div>
                        {pieData.length > 0 ? (
                            <div className="h-72 flex flex-col">
                                <div className="flex-1 min-h-0">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={pieData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius="55%"
                                                outerRadius="80%"
                                                paddingAngle={3}
                                                dataKey="value"
                                                label={renderPieLabel}
                                                animationDuration={1000}
                                            >
                                                {pieData.map((entry, i) => (
                                                    <Cell key={i} fill={entry.color} stroke="none" />
                                                ))}
                                            </Pie>
                                            <Tooltip
                                                formatter={(value, name) => [fmtCurrency(value), name]}
                                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '10px 14px' }}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                {/* Legend */}
                                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
                                    {pieData.map((entry, i) => (
                                        <div key={i} className="flex items-center gap-2 text-xs">
                                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
                                            <span className="text-slate-600 truncate">{entry.name}</span>
                                            <span className="text-slate-400 ml-auto font-medium">{entry.pct}%</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="h-72 flex items-center justify-center text-slate-400 text-sm">
                                Sin datos de métodos de pago
                            </div>
                        )}
                    </div>
                </div>

                {/* Tables */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Top 10 Products */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100">
                            <h3 className="text-base font-bold text-slate-900">Top 10 Productos</h3>
                            <p className="text-sm text-slate-500">Productos con mayor ingreso en el periodo</p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50/80 text-slate-500 text-xs font-bold uppercase tracking-wider">
                                    <tr>
                                        <th className="px-4 py-3 text-left">#</th>
                                        <th className="px-4 py-3 text-left">Producto</th>
                                        <th className="px-4 py-3 text-right">Cant.</th>
                                        <th className="px-4 py-3 text-right">Ingreso</th>
                                        <th className="px-4 py-3 text-right">Margen</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {topProducts.length > 0 ? topProducts.map((p, i) => (
                                        <tr key={i} className="hover:bg-slate-50/60 transition-colors">
                                            <td className="px-4 py-3 text-slate-400 font-bold">{i + 1}</td>
                                            <td className="px-4 py-3 font-medium text-slate-800 max-w-[200px] truncate">
                                                {p.product_name || p.name}
                                            </td>
                                            <td className="px-4 py-3 text-right text-slate-600">
                                                {p.quantity_sold || p.quantity || 0}
                                            </td>
                                            <td className="px-4 py-3 text-right font-bold text-slate-900">
                                                {fmtCurrency(p.revenue || p.total_revenue || 0)}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                {(() => {
                                                    const marginVal = p.margin_percent ?? p.margin ?? null;
                                                    if (marginVal !== null && marginVal !== undefined) {
                                                        const num = Number(marginVal) || 0;
                                                        return (
                                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                                                                num >= 20 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                                                            }`}>
                                                                {num.toFixed(1)}%
                                                            </span>
                                                        );
                                                    }
                                                    // Calculate margin from cost if available
                                                    const revenue = Number(p.revenue || p.total_revenue || 0);
                                                    const cost = Number(p.total_cost || p.cost || 0);
                                                    if (revenue > 0 && cost > 0) {
                                                        const calculated = ((revenue - cost) / revenue) * 100;
                                                        return (
                                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                                                                calculated >= 20 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                                                            }`}>
                                                                {calculated.toFixed(1)}%
                                                            </span>
                                                        );
                                                    }
                                                    return <span className="text-slate-300">--</span>;
                                                })()}
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                                                Sin datos de productos
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Top 10 Customers */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100">
                            <h3 className="text-base font-bold text-slate-900">Top 10 Clientes</h3>
                            <p className="text-sm text-slate-500">Clientes con mayor volumen de compra</p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50/80 text-slate-500 text-xs font-bold uppercase tracking-wider">
                                    <tr>
                                        <th className="px-4 py-3 text-left">#</th>
                                        <th className="px-4 py-3 text-left">Cliente</th>
                                        <th className="px-4 py-3 text-right">Transacc.</th>
                                        <th className="px-4 py-3 text-right">Total (USD)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {topCustomers.length > 0 ? topCustomers.map((c, i) => (
                                        <tr key={i} className="hover:bg-slate-50/60 transition-colors">
                                            <td className="px-4 py-3 text-slate-400 font-bold">{i + 1}</td>
                                            <td className="px-4 py-3 font-medium text-slate-800 max-w-[200px] truncate">
                                                {c.customer_name || c.name || 'Cliente General'}
                                            </td>
                                            <td className="px-4 py-3 text-right text-slate-600">
                                                {c.transaction_count || c.transactions || c.count || 0}
                                            </td>
                                            <td className="px-4 py-3 text-right font-bold text-slate-900">
                                                {fmtCurrency(c.total_purchased || c.total || c.total_amount || c.revenue || 0)}
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                                                Sin datos de clientes
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // ============================================================
    // RENDER: Placeholder for other tabs
    // ============================================================
    const renderPlaceholder = (tabLabel) => (
        <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <Package size={48} className="mb-4 opacity-40" />
            <p className="text-lg font-bold">Sección {tabLabel}</p>
            <p className="text-sm">Próximamente</p>
        </div>
    );

    // ============================================================
    // RENDER: Tab content router
    // ============================================================
    const renderTabContent = () => {
        switch (activeTab) {
            case 'resumen':
                return renderResumen();
            case 'ventas':
                return (
                    <Suspense fallback={<div className="flex items-center justify-center h-64 text-slate-400 animate-pulse">Cargando...</div>}>
                        <SalesTab dateRange={dateRange} />
                    </Suspense>
                );
            case 'caja':
                return (
                    <Suspense fallback={<div className="flex items-center justify-center h-64 text-slate-400 animate-pulse">Cargando...</div>}>
                        <CashTab dateRange={dateRange} />
                    </Suspense>
                );
            case 'creditos':
                return (
                    <Suspense fallback={<div className="flex items-center justify-center h-64 text-slate-400 animate-pulse">Cargando...</div>}>
                        <CreditsTab dateRange={dateRange} />
                    </Suspense>
                );
            case 'proveedores':
                return (
                    <Suspense fallback={<div className="flex items-center justify-center h-64 text-slate-400 animate-pulse">Cargando...</div>}>
                        <SuppliersTab dateRange={dateRange} />
                    </Suspense>
                );
            case 'inventario':
                return (
                    <Suspense fallback={<div className="flex items-center justify-center h-64 text-slate-400 animate-pulse">Cargando...</div>}>
                        <InventoryTab dateRange={dateRange} />
                    </Suspense>
                );
            case 'farmacia':
                return (
                    <Suspense fallback={<div className="flex items-center justify-center h-64 text-slate-400 animate-pulse">Cargando...</div>}>
                        <PharmacyTab dateRange={dateRange} />
                    </Suspense>
                );
            case 'intelligence':
                return (
                    <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="animate-spin w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full" /></div>}>
                        <IntelligenceTab />
                    </Suspense>
                );
            case 'financiadoras':
                return (
                    <Suspense fallback={<div className="flex items-center justify-center h-64 text-slate-400 animate-pulse">Cargando...</div>}>
                        <FinanciadoresTab />
                    </Suspense>
                );
            case 'comisiones':
                return (
                    <Suspense fallback={<div className="flex items-center justify-center h-64 text-slate-400 animate-pulse">Cargando...</div>}>
                        <CommissionsTab dateRange={dateRange} />
                    </Suspense>
                );
            default: {
                const tab = TABS.find(t => t.id === activeTab);
                return renderPlaceholder(tab?.label || activeTab);
            }
        }
    };

    // ============================================================
    // MAIN RENDER
    // ============================================================
    return (
        <div className="min-h-screen bg-slate-50/50">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-30">
                <div className="max-w-7xl mx-auto px-4 sm:px-6">
                    {/* Title row + date controls */}
                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 py-4">
                        <div>
                            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Centro de Reportes</h1>
                            <p className="text-slate-500 text-sm font-medium">Analítica avanzada de tu negocio</p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            {helpKey && <HelpButton contextKey={helpKey} onClick={help.open} />}
                            {/* Date presets */}
                            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
                                {presets.map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => applyPreset(p.id)}
                                        className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                                            activePreset === p.id
                                                ? 'bg-white text-slate-900 shadow-sm'
                                                : 'text-slate-500 hover:text-slate-700 hover:bg-white/60'
                                        }`}
                                    >
                                        {p.label}
                                    </button>
                                ))}
                            </div>

                            {/* Date inputs */}
                            <div className="flex items-center gap-1.5 bg-slate-100 rounded-lg px-2.5 py-1.5">
                                <Calendar size={14} className="text-slate-400" />
                                <input
                                    type="date"
                                    name="start"
                                    value={dateRange.start}
                                    onChange={handleDateChange}
                                    className="bg-transparent border-none p-0 text-xs font-bold text-slate-700 focus:ring-0 w-[110px]"
                                />
                                <span className="text-slate-300 text-xs">-</span>
                                <input
                                    type="date"
                                    name="end"
                                    value={dateRange.end}
                                    onChange={handleDateChange}
                                    className="bg-transparent border-none p-0 text-xs font-bold text-slate-700 focus:ring-0 w-[110px]"
                                />
                            </div>

                            {/* Refresh */}
                            <button
                                onClick={() => { if (activeTab === 'resumen') loadResumenData(); }}
                                disabled={loading}
                                className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50"
                                title="Actualizar"
                            >
                                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                            </button>

                            {/* Export */}
                            <button
                                onClick={handleExport}
                                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
                                title="Descargar reporte Excel"
                            >
                                <Download size={14} />
                                <span className="hidden sm:inline">Exportar</span>
                            </button>
                        </div>
                    </div>

                    {/* Tab Navigation */}
                    <div className="flex overflow-x-auto gap-0 -mb-px scrollbar-hide">
                        {visibleTabs.map(tab => {
                            const TabIcon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-2 px-4 py-3 text-sm font-bold whitespace-nowrap border-b-2 transition-all ${
                                        isActive
                                            ? 'text-emerald-600 border-emerald-600'
                                            : 'text-slate-500 border-transparent hover:text-slate-700 hover:border-slate-300'
                                    }`}
                                >
                                    <TabIcon size={16} />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Tab Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
                {renderTabContent()}
            </div>
            {help.isOpen && helpKey && <HelpDrawer contextKey={helpKey} onClose={help.close} />}
        </div>
    );
};

export default ReportsCenter;
