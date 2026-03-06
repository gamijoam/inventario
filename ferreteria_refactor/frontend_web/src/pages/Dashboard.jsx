import { useState, useEffect } from 'react';
import {
    DollarSign,
    TrendingUp,
    ShoppingCart,
    CreditCard,
    ArrowUpRight,
    ArrowDownRight,
    Package,
    AlertCircle,
    Users,
    UtensilsCrossed,
    RefreshCw,
    ArrowRight,
    Monitor
} from 'lucide-react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';
import { useConfig } from '../context/ConfigContext';
import { useWebSocket } from '../context/WebSocketContext';
import unifiedReportService from '../services/unifiedReportService';
import MultiCurrencyDisplay from '../components/dashboard/MultiCurrencyDisplay';
import { cn } from '../utils/cn';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

/* --- COMPONENTS DE DISEÑO --- */

// Vercel-style Card Component
const Card = ({ children, className }) => (
    <div className={cn("bg-white rounded-xl border border-slate-200 shadow-sm", className)}>
        {children}
    </div>
);

const KPICard = ({ title, value, icon: Icon, trend, trendValue }) => (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-xl hover:ring-1 hover:ring-indigo-500/20 transition-all duration-300 relative overflow-hidden group hover:-translate-y-1">
        <div className="flex justify-between items-start mb-4">
            <p className="text-slate-500 text-xs font-black uppercase tracking-widest">{title}</p>
            <div className="p-2 bg-slate-50 rounded-lg group-hover:bg-indigo-50 transition-colors">
                <Icon size={18} className="text-slate-400 group-hover:text-indigo-600 transition-colors" />
            </div>
        </div>

        <div className="mb-2">
            {typeof value === 'string' || typeof value === 'number' ? (
                <h3 className="text-3xl font-black text-slate-900 tracking-tight">{value}</h3>
            ) : (
                <div className="text-3xl font-black text-slate-900 tracking-tight">{value}</div>
            )}
        </div>

        {trend && (
            <div className="flex items-center gap-2">
                <span className={cn(
                    "inline-flex items-center gap-1 text-xs font-bold px-1.5 py-0.5 rounded-full",
                    trend === 'up' ? "text-emerald-700 bg-emerald-50" : "text-rose-700 bg-rose-50"
                )}>
                    {trend === 'up' ? <ArrowUpRight size={14} strokeWidth={3} /> : <ArrowDownRight size={14} strokeWidth={3} />}
                    {trendValue}
                </span>
                <span className="text-slate-400 text-[10px] font-medium uppercase tracking-tight">vs mes anterior</span>
            </div>
        )}
    </div>
);

const RecentSalesTable = ({ sales = [] }) => {
    if (!sales || sales.length === 0) {
        return (
            <div className="text-center py-16 px-4">
                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-100">
                    <Package size={32} className="text-slate-300" />
                </div>
                <h4 className="text-slate-900 font-bold mb-1">¡Listo para comenzar!</h4>
                <p className="text-slate-500 text-sm max-w-xs mx-auto">Tus ventas aparecerán aquí en tiempo real una vez que realices tu primera transacción.</p>
            </div>
        );
    }

    return (
        <div className="overflow-hidden">
            {/* Mobile View */}
            <div className="block md:hidden divide-y divide-slate-100">
                {sales.slice(0, 5).map((sale) => (
                    <div key={sale.id} className="p-4 hover:bg-slate-50 transition-colors">
                        <div className="flex justify-between items-start mb-1">
                            <h4 className="font-semibold text-slate-900 text-sm">{sale.customer?.name || 'Cliente General'}</h4>
                            <span className="font-bold text-slate-900">
                                ${Number(sale.total_amount || 0).toFixed(2)}
                            </span>
                        </div>
                        <div className="flex justify-between items-center text-xs text-slate-500">
                            <span>#{sale.id} • {new Date(sale.date).toLocaleDateString('es-VE', { hour: '2-digit', minute: '2-digit' })}</span>
                            <span className="capitalize">{sale.payment_method || 'Efectivo'}</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Desktop View */}
            <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full text-left text-sm whitespace-nowrap">
                    <thead className="border-b border-slate-100 bg-slate-50/50">
                        <tr>
                            <th className="px-6 py-3 font-medium text-slate-500">Cliente / ID</th>
                            <th className="px-6 py-3 font-medium text-slate-500">Fecha</th>
                            <th className="px-6 py-3 font-medium text-slate-500">Método</th>
                            <th className="px-6 py-3 font-medium text-slate-500 text-right">Monto</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {sales.slice(0, 8).map((sale) => (
                            <tr key={sale.id} className="hover:bg-slate-50/80 transition-colors group">
                                <td className="px-6 py-4">
                                    <div className="font-medium text-slate-900">{sale.customer?.name || 'Cliente General'}</div>
                                    <div className="text-xs text-slate-400">#{sale.id}</div>
                                </td>
                                <td className="px-6 py-4 text-slate-500">
                                    {sale.date ? new Date(sale.date).toLocaleDateString('es-VE', {
                                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                    }) : 'N/A'}
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>
                                        <span className="text-slate-600 capitalize">{sale.payment_method || 'Efectivo'}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-right font-medium text-slate-900">
                                    ${Number(sale.total_amount || 0).toFixed(2)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const LowStockWidget = () => {
    const [lowStockProducts, setLowStockProducts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLowStock = async () => {
            try {
                const data = await unifiedReportService.getLowStock(5);
                setLowStockProducts(Array.isArray(data) ? data : []);
            } catch (error) {
                console.error('Error fetching low stock:', error);
                setLowStockProducts([]);
            } finally {
                setLoading(false);
            }
        };
        fetchLowStock();
    }, []);

    if (loading) return <div className="h-20 animate-pulse bg-slate-50 rounded-lg"></div>;

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-slate-900">Alertas de Stock</h4>
                {lowStockProducts.length > 0 && (
                    <span className="bg-rose-100 text-rose-700 text-xs px-2 py-0.5 rounded-full font-medium">
                        {lowStockProducts.length} items
                    </span>
                )}
            </div>

            {lowStockProducts.length > 0 ? (
                <div className="space-y-2">
                    {lowStockProducts.slice(0, 5).map(product => (
                        <div key={product.id} className="flex justify-between items-center bg-rose-50/50 p-2.5 rounded-lg border border-rose-100">
                            <span className="text-sm text-slate-700 truncate flex-1 pr-2 font-medium">
                                {product.name}
                            </span>
                            <span className="text-xs font-bold text-rose-600 bg-white px-2 py-1 rounded shadow-sm border border-rose-100">
                                {product.stock} un.
                            </span>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-6 bg-slate-50 rounded-lg border border-slate-100 border-dashed">
                    <p className="text-sm text-slate-500">Todo el inventario está saludable ✅</p>
                </div>
            )}
        </div>
    );
};

const Dashboard = () => {
    const { modules } = useConfig();
    const { subscribe } = useWebSocket();
    const navigate = useNavigate();

    // State
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [salesSummary, setSalesSummary] = useState(null);
    const [profitData, setProfitData] = useState(null);
    const [recentSales, setRecentSales] = useState([]);
    const [chartData, setChartData] = useState([]);
    const [creditsSummary, setCreditsSummary] = useState(null);

    // Fetch dashboard data
    const fetchDashboardData = async (showToast = false) => {
        if (showToast) setRefreshing(true);
        else setLoading(true);

        try {
            const d = new Date();
            const today = d.getFullYear() + '-' +
                String(d.getMonth() + 1).padStart(2, '0') + '-' +
                String(d.getDate()).padStart(2, '0');

            const [sales, profit, transactions, credits] = await Promise.all([
                unifiedReportService.getSalesSummary({ start_date: today, end_date: today }),
                unifiedReportService.getProfitability({ start_date: today, end_date: today }),
                unifiedReportService.getRecentTransactions(10),
                unifiedReportService.getCreditsSummary().catch(() => null)
            ]);

            setSalesSummary(sales);
            setProfitData(profit);
            setRecentSales(Array.isArray(transactions) ? transactions : []);
            setCreditsSummary(credits);

            // Generate chart data for last 7 days
            const chartPromises = [];
            const chartLabels = [];

            for (let i = 6; i >= 0; i--) {
                const date = new Date();
                date.setDate(date.getDate() - i);
                const dateStr = date.toISOString().split('T')[0];
                const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
                chartLabels.push(i === 0 ? 'Hoy' : dayNames[date.getDay()]);

                chartPromises.push(
                    unifiedReportService.getSalesSummary({ start_date: dateStr, end_date: dateStr })
                        .catch(() => ({ total_revenue: 0 }))
                );
            }

            const dailyResults = await Promise.all(chartPromises);
            setChartData(dailyResults.map((result, index) => ({
                name: chartLabels[index],
                sales: result?.total_revenue || 0
            })));

            if (showToast) toast.success('Dashboard actualizado');
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
            // Don't show toast for 403 errors (permission denied) - axios interceptor handles it
            if (error.response?.status !== 403) {
                toast.error('Error cargando datos');
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchDashboardData();
    }, []);

    // WebSocket real-time updates
    useEffect(() => {
        return subscribe('sale:created', () => {
            console.log('📡 Nueva venta detectada');
            fetchDashboardData(true);
        });
    }, [subscribe]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
            </div>
        );
    }

    return (
        <div id="tour-dashboard-container" className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto pb-10">

            {/* 1. Header with Actions */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Resumen General</h1>
                    <p className="text-slate-500 text-sm">Actividad en tiempo real de tu negocio.</p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    <button
                        onClick={() => navigate('/pos')}
                        className="flex-1 sm:flex-none h-10 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow-sm hover:shadow transition-all flex items-center justify-center gap-2"
                    >
                        <Monitor size={18} />
                        <span>Abrir POS</span>
                    </button>
                    <button
                        onClick={() => navigate('/products')}
                        id="btn-new-product"
                        className="flex-1 sm:flex-none h-10 px-4 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium rounded-lg shadow-sm transition-all flex items-center justify-center gap-2"
                    >
                        <Package size={18} />
                        <span>Ir al Inventario</span>
                    </button>
                    <button
                        onClick={() => fetchDashboardData(true)}
                        disabled={refreshing}
                        className="h-10 w-10 flex items-center justify-center bg-white border border-slate-200 text-slate-500 hover:text-indigo-600 hover:bg-slate-50 rounded-lg shadow-sm transition-all"
                    >
                        <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* 2. KPI Grid (Vercel Style) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <KPICard
                    title="Ingresos Hoy (Neto)"
                    value={<MultiCurrencyDisplay amountUSD={salesSummary?.total_revenue || 0} showRate={false} placeholderIfZero />}
                    icon={DollarSign}
                />
                <KPICard
                    title="Ganancia Real"
                    value={<MultiCurrencyDisplay amountUSD={profitData?.realized_profit || profitData?.total_profit || 0} showRate={false} placeholderIfZero />}
                    icon={TrendingUp}
                    trend="up"
                    trendValue="12.5%"
                />
                <KPICard
                    title="Créditos Pendientes"
                    value={<MultiCurrencyDisplay amountUSD={creditsSummary?.total_pending_usd || 0} showRate={false} placeholderIfZero />}
                    icon={AlertCircle}
                />
                <KPICard
                    title="Artículos Vendidos (Neto)"
                    value={salesSummary?.total_items_sold || 0}
                    icon={ShoppingCart}
                />
                <KPICard
                    title="Ventas Realizadas (Neto)"
                    value={salesSummary?.net_transactions || 0}
                    icon={CreditCard}
                />
            </div>

            {/* 3. Main Content Grid (Chart + Widgets) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Main Chart (2/3 width) */}
                <Card className="lg:col-span-2 p-6 flex flex-col justify-between min-h-[400px]">
                    <div className="mb-6">
                        <h3 className="text-base font-semibold text-slate-900">Rendimiento de Ventas</h3>
                        <p className="text-sm text-slate-500">Volumen de ventas de los últimos 7 días</p>
                    </div>

                    <div className="flex-1 w-full min-h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.1} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                                    dy={10}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                                    tickFormatter={(value) => `$${value}`}
                                    width={50}
                                    domain={[0, 'auto + 20']}
                                />
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                                    cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }}
                                    formatter={(value) => [`$${value.toFixed(2)}`, 'Ventas']}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="sales"
                                    stroke="#10b981"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#colorSales)"
                                    animationDuration={1500}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                {/* Side Widgets (1/3 width) */}
                <div className="space-y-6">
                    {/* Module Specific Widgets */}
                    {modules.retail && (
                        <Card className="p-5">
                            <div className="flex items-center gap-2 mb-4">
                                <div className="p-1.5 bg-indigo-50 rounded-md">
                                    <Package size={16} className="text-indigo-600" />
                                </div>
                                <h3 className="text-sm font-semibold text-slate-900">Estado del Inventario</h3>
                            </div>
                            <LowStockWidget />
                        </Card>
                    )}

                    {/* Pending Payments Widget */}
                    <Card className="p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="p-1.5 bg-blue-50 rounded-md">
                                <Users size={16} className="text-blue-600" />
                            </div>
                            <h3 className="text-sm font-semibold text-slate-900">Cuentas por Cobrar</h3>
                        </div>
                        <div className="bg-blue-50/50 rounded-lg p-4 border border-blue-100 flex justify-between items-center group/ar cursor-pointer hover:bg-blue-100/50 transition-colors" onClick={() => navigate('/accounts-receivable')}>
                            <div>
                                <p className="text-xs text-blue-600 font-black uppercase tracking-widest mb-1">Monto Pendiente</p>
                                <div className="text-2xl font-black text-blue-700 leading-none">
                                    ${(creditsSummary?.total_pending_usd || 0).toFixed(2)}
                                </div>
                                {creditsSummary?.total_pending_bs > 0 && (
                                    <p className="text-xs text-blue-500 font-bold mt-0.5">
                                        Bs. {creditsSummary.total_pending_bs.toFixed(2)}
                                    </p>
                                )}
                                <p className="text-[10px] text-blue-500 font-bold mt-1 uppercase">
                                    {creditsSummary?.pending_count || 0} facturas activas
                                </p>
                            </div>
                            <div className="h-12 w-12 bg-white rounded-xl flex items-center justify-center border border-blue-100 shadow-sm text-blue-500 group-hover/ar:scale-110 transition-transform">
                                <ArrowRight size={24} />
                            </div>
                        </div>
                    </Card>

                    {modules.restaurant && (
                        <Card className="p-5 flex flex-col items-center justify-center text-center min-h-[150px]">
                            <UtensilsCrossed size={32} className="text-slate-300 mb-3" />
                            <p className="text-sm font-medium text-slate-500">Modo Restaurante Activo</p>
                        </Card>
                    )}
                </div>
            </div>

            {/* 4. Recent Transactions */}
            <Card className="overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                    <div>
                        <h3 className="text-base font-semibold text-slate-900">Transacciones Recientes</h3>
                        <p className="text-sm text-slate-500">Últimas 10 ventas registradas</p>
                    </div>
                </div>
                <RecentSalesTable sales={recentSales} />
            </Card>

        </div>
    );
};

export default Dashboard;
