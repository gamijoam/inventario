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
    RefreshCw
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

const KPICard = ({ title, value, icon: Icon, trend, trendValue, color }) => (
    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
        <div className="flex justify-between items-start mb-2">
            <p className="text-slate-500 text-sm font-medium">{title}</p>
            <div className={cn("p-2 rounded-lg transition-colors group-hover:bg-slate-50", color)}>
                <Icon size={18} className="text-slate-600" />
            </div>
        </div>
        <div className="mb-4">
            {typeof value === 'string' || typeof value === 'number' ? (
                <h3 className="text-3xl font-bold text-slate-800 tracking-tight">{value}</h3>
            ) : (
                value
            )}
        </div>

        {trend && (
            <div className="flex items-center gap-2">
                <span className={cn(
                    "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ring-1 ring-inset",
                    trend === 'up'
                        ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
                        : "bg-rose-50 text-rose-700 ring-rose-600/20"
                )}>
                    {trend === 'up' ? <ArrowUpRight size={12} strokeWidth={3} /> : <ArrowDownRight size={12} strokeWidth={3} />}
                    {trendValue}
                </span>
                <span className="text-slate-400 text-xs">vs mes pasado</span>
            </div>
        )}
    </div>
);

const RecentSalesTable = ({ sales = [] }) => {
    if (!sales || sales.length === 0) {
        return (
            <div className="text-center py-12 text-slate-400">
                <Package size={48} className="mx-auto mb-4 opacity-50" />
                <p>No hay ventas recientes</p>
            </div>
        );
    }

    return (
        <div className="overflow-hidden">
            <table className="min-w-full text-left text-sm whitespace-nowrap">
                <thead className="uppercase tracking-wider border-b border-slate-200 bg-slate-50/50">
                    <tr>
                        <th scope="col" className="px-6 py-4 font-semibold text-slate-500">ID</th>
                        <th scope="col" className="px-6 py-4 font-semibold text-slate-500">Cliente</th>
                        <th scope="col" className="px-6 py-4 font-semibold text-slate-500">Fecha</th>
                        <th scope="col" className="px-6 py-4 font-semibold text-slate-500">Método</th>
                        <th scope="col" className="px-6 py-4 font-semibold text-slate-500 text-right">Monto</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {sales.slice(0, 10).map((sale) => (
                        <tr key={sale.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 font-medium text-slate-900">#{sale.id}</td>
                            <td className="px-6 py-4 text-slate-600">
                                {sale.customer?.name || 'Cliente General'}
                            </td>
                            <td className="px-6 py-4 text-slate-500">
                                {new Date(sale.created_at).toLocaleDateString('es-VE')}
                            </td>
                            <td className="px-6 py-4">
                                <span className="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset bg-blue-50 text-blue-700 ring-blue-600/20">
                                    {sale.payment_method || 'Efectivo'}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-slate-900 font-medium text-right">
                                ${Number(sale.total_amount || 0).toFixed(2)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

const Dashboard = () => {
    const { modules, getExchangeRate } = useConfig();
    const { subscribe } = useWebSocket();

    // State
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [salesSummary, setSalesSummary] = useState(null);
    const [profitData, setProfitData] = useState(null);
    const [recentSales, setRecentSales] = useState([]);
    const [chartData, setChartData] = useState([]);

    // Fetch dashboard data
    const fetchDashboardData = async (showToast = false) => {
        if (showToast) setRefreshing(true);
        else setLoading(true);

        try {
            const today = new Date().toISOString().split('T')[0];
            const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

            const [sales, profit, transactions] = await Promise.all([
                unifiedReportService.getSalesSummary({
                    start_date: today,
                    end_date: today
                }),
                unifiedReportService.getProfitability({
                    start_date: today,
                    end_date: today
                }),
                unifiedReportService.getRecentTransactions(10)
            ]);

            setSalesSummary(sales);
            setProfitData(profit);
            setRecentSales(Array.isArray(transactions) ? transactions : []);

            // Fetch weekly data for chart
            const weeklyData = await unifiedReportService.getSalesSummary({
                start_date: weekAgo,
                end_date: today
            });

            // Transform data for chart (if backend provides daily breakdown)
            if (weeklyData.daily_breakdown) {
                setChartData(weeklyData.daily_breakdown);
            } else {
                // Fallback: create simple chart data
                setChartData([
                    { name: 'Hoy', sales: sales?.total_revenue || 0 }
                ]);
            }

            if (showToast) {
                toast.success('Dashboard actualizado');
            }
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
            toast.error('Error cargando datos del dashboard');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    // Initial load
    useEffect(() => {
        fetchDashboardData();
    }, []);

    // WebSocket real-time updates
    useEffect(() => {
        const unsubSale = subscribe('sale:created', () => {
            console.log('📡 Nueva venta detectada, actualizando dashboard...');
            fetchDashboardData(true);
        });

        return unsubSale;
    }, [subscribe]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Dashboard General</h1>
                    <p className="text-slate-500 mt-1">
                        Bienvenido de nuevo, aquí tienes lo que está pasando hoy.
                    </p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => fetchDashboardData(true)}
                        disabled={refreshing}
                        className="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-lg shadow-sm hover:bg-slate-50 transition-all flex items-center gap-2"
                    >
                        <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                        Actualizar
                    </button>
                </div>
            </div>

            {/* KPI Bento Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <KPICard
                    title="Ingresos del Día"
                    value={<MultiCurrencyDisplay amountUSD={salesSummary?.total_revenue || 0} />}
                    icon={DollarSign}
                    color="bg-indigo-50"
                />
                <KPICard
                    title="Ganancia Real"
                    value={<MultiCurrencyDisplay amountUSD={profitData?.realized_profit || profitData?.total_profit || 0} />}
                    icon={TrendingUp}
                    color="bg-emerald-50"
                />
                <KPICard
                    title="Transacciones"
                    value={salesSummary?.total_transactions || 0}
                    icon={ShoppingCart}
                    color="bg-blue-50"
                />
                <KPICard
                    title="Ticket Promedio"
                    value={<MultiCurrencyDisplay
                        amountUSD={salesSummary?.average_ticket || 0}
                        showRate={false}
                        size="sm"
                    />}
                    icon={CreditCard}
                    color="bg-purple-50"
                />
            </div>

            {/* Charts & Widgets Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Chart */}
                <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-bold text-slate-800">Rendimiento de Ventas</h3>
                        <span className="text-sm text-slate-500">Últimos 7 días</span>
                    </div>
                    <div className="h-[350px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1} />
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#64748b', fontSize: 12 }}
                                    dy={10}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#64748b', fontSize: 12 }}
                                    tickFormatter={(value) => `$${value}`}
                                />
                                <Tooltip
                                    contentStyle={{
                                        borderRadius: '12px',
                                        border: 'none',
                                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -1px rgb(0 0 0 / 0.06)',
                                        padding: '12px'
                                    }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="sales"
                                    stroke="#6366f1"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#colorSales)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Conditional Widgets based on Module */}
                {modules.restaurant && (
                    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <UtensilsCrossed size={20} className="text-indigo-600" />
                            Modo Restaurante
                        </h3>
                        <div className="text-center py-8">
                            <p className="text-slate-500 text-sm">
                                Widgets de mesas y cocina próximamente
                            </p>
                        </div>
                    </div>
                )}

                {modules.retail && !modules.restaurant && (
                    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <Package size={20} className="text-emerald-600" />
                            Modo Retail
                        </h3>
                        <div className="space-y-4">
                            <div className="p-4 bg-rose-50 rounded-lg border border-rose-200">
                                <div className="flex items-center gap-2 text-rose-700 mb-2">
                                    <AlertCircle size={16} />
                                    <span className="font-bold text-sm">Stock Bajo</span>
                                </div>
                                <p className="text-xs text-rose-600">
                                    Widget próximamente
                                </p>
                            </div>
                            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                                <div className="flex items-center gap-2 text-blue-700 mb-2">
                                    <Users size={16} />
                                    <span className="font-bold text-sm">Cuentas por Cobrar</span>
                                </div>
                                <p className="text-xs text-blue-600">
                                    Widget próximamente
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Recent Transactions Table */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-slate-800">Transacciones Recientes</h3>
                    <span className="text-sm text-slate-500">{recentSales.length} ventas</span>
                </div>
                <RecentSalesTable sales={recentSales} />
            </div>
        </div>
    );
};

export default Dashboard;
