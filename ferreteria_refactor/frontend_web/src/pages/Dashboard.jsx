import { useState, useEffect } from 'react';
import {
    DollarSign,
    TrendingUp,
    ShoppingCart,
    CreditCard,
    ArrowUpRight,
    ArrowDownRight,
    Package,
    AlertCircle
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
import apiClient from '../config/axios';
import { cn } from '../utils/cn';

// Mock Data for Chart
const data = [
    { name: 'Lun', value: 4000 },
    { name: 'Mar', value: 3000 },
    { name: 'Mié', value: 2000 },
    { name: 'Jue', value: 2780 },
    { name: 'Vie', value: 1890 },
    { name: 'Sáb', value: 2390 },
    { name: 'Dom', value: 3490 },
];

const KPICard = ({ title, value, icon: Icon, trend, trendValue, color }) => (
    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex justify-between items-start mb-4">
            <div className={cn("p-2 rounded-lg", color)}>
                <Icon size={20} className="text-slate-700" />
            </div>
            {trend && (
                <div className={cn(
                    "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full",
                    trend === 'up' ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                )}>
                    {trend === 'up' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                    {trendValue}
                </div>
            )}
        </div>
        <h3 className="text-slate-500 text-sm font-medium mb-1">{title}</h3>
        <p className="text-2xl font-bold text-slate-800">{value}</p>
    </div>
);

const Dashboard = () => {
    const [financials, setFinancials] = useState(null);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState('today');

    useEffect(() => {
        fetchFinancials();
    }, [dateRange]);

    const fetchFinancials = async () => {
        setLoading(true);
        try {
            const params = {};
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const today = `${year}-${month}-${day}`;

            if (dateRange === 'today') {
                params.start_date = today;
                params.end_date = today;
            } else if (dateRange === 'week') {
                const weekAgo = new Date();
                weekAgo.setDate(weekAgo.getDate() - 7);
                const wYear = weekAgo.getFullYear();
                const wMonth = String(weekAgo.getMonth() + 1).padStart(2, '0');
                const wDay = String(weekAgo.getDate()).padStart(2, '0');
                params.start_date = `${wYear}-${wMonth}-${wDay}`;
                params.end_date = today;
            } else if (dateRange === 'month') {
                const monthAgo = new Date();
                monthAgo.setMonth(monthAgo.getMonth() - 1);
                const mYear = monthAgo.getFullYear();
                const mMonth = String(monthAgo.getMonth() + 1).padStart(2, '0');
                const mDay = String(monthAgo.getDate()).padStart(2, '0');
                params.start_date = `${mYear}-${mMonth}-${mDay}`;
                params.end_date = today;
            }

            const response = await apiClient.get('/reports/dashboard/financials', { params });
            setFinancials(response.data);
        } catch (error) {
            console.error('Error fetching financials:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    const totalSales = financials?.total_sales_base_usd || 0;
    const estimatedProfit = financials?.profit_estimated || 0;
    const totalTransactions = financials?.sales_by_currency?.reduce((sum, curr) => sum + curr.count, 0) || 0;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
                    <p className="text-slate-500 text-sm">Resumen de actividad y rendimiento</p>
                </div>
                <div className="flex gap-2 bg-white p-1 rounded-lg border border-slate-200">
                    {['today', 'week', 'month'].map((range) => (
                        <button
                            key={range}
                            onClick={() => setDateRange(range)}
                            className={cn(
                                "px-4 py-1.5 text-sm font-medium rounded-md transition-all",
                                dateRange === range
                                    ? "bg-slate-900 text-white shadow-sm"
                                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                            )}
                        >
                            {range === 'today' ? 'Hoy' : range === 'week' ? 'Semana' : 'Mes'}
                        </button>
                    ))}
                </div>
            </div>

            {/* KPI Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard
                    title="Ventas Totales (USD)"
                    value={`$${totalSales.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                    icon={DollarSign}
                    color="bg-indigo-50"
                    trend="up"
                    trendValue="+12.5%"
                />
                <KPICard
                    title="Ganancia Estimada"
                    value={`$${estimatedProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                    icon={TrendingUp}
                    color="bg-emerald-50"
                    trend="up"
                    trendValue="+8.2%"
                />
                <KPICard
                    title="Pedidos"
                    value={totalTransactions}
                    icon={ShoppingCart}
                    color="bg-blue-50"
                />
                <KPICard
                    title="Ticket Promedio"
                    value={`$${totalTransactions > 0 ? (totalSales / totalTransactions).toFixed(2) : '0.00'}`}
                    icon={CreditCard}
                    color="bg-purple-50"
                />
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Chart Section */}
                <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 mb-6">Tendencia de Ventas</h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data}>
                                <defs>
                                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
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
                                />
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="value"
                                    stroke="#6366f1"
                                    strokeWidth={2}
                                    fillOpacity={1}
                                    fill="url(#colorValue)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Right Column: Top Products or Alerts */}
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col">
                    <h3 className="text-lg font-bold text-slate-800 mb-4">Productos Top</h3>

                    <div className="flex-1 space-y-4">
                        {[1, 2, 3, 4, 5].map((item) => (
                            <div key={item} className="flex items-center gap-4 p-3 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer group">
                                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-white group-hover:shadow-sm transition-all">
                                    <Package size={20} />
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-slate-800">Producto Ejemplo {item}</p>
                                    <p className="text-xs text-slate-500">124 ventas</p>
                                </div>
                                <div className="text-sm font-bold text-slate-800">$450</div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-6 pt-6 border-t border-slate-100">
                        <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-800 mb-3">
                            <AlertCircle size={16} className="text-amber-500" />
                            Alertas de Stock
                        </h4>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs p-2 bg-amber-50 text-amber-900 rounded-lg">
                                <span>Cemento Portland</span>
                                <span className="font-bold">5 un.</span>
                            </div>
                            <div className="flex items-center justify-between text-xs p-2 bg-red-50 text-red-900 rounded-lg">
                                <span>Llave Inglesa 12"</span>
                                <span className="font-bold">0 un.</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
