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
    MoreHorizontal
} from 'lucide-react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
    Legend
} from 'recharts';
import apiClient from '../config/axios';
import { cn } from '../utils/cn';

// Mock Data for Charts
const data = [
    { name: 'Lun', sales: 4000, profit: 2400 },
    { name: 'Mar', sales: 3000, profit: 1398 },
    { name: 'Mié', sales: 2000, profit: 9800 },
    { name: 'Jue', sales: 2780, profit: 3908 },
    { name: 'Vie', sales: 1890, profit: 4800 },
    { name: 'Sáb', sales: 2390, profit: 3800 },
    { name: 'Dom', sales: 3490, profit: 4300 },
];

const KPICard = ({ title, value, icon: Icon, trend, trendValue, color, footer }) => (
    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
        <div className="flex justify-between items-start mb-2">
            <p className="text-slate-500 text-sm font-medium">{title}</p>
            <div className={cn("p-2 rounded-lg transition-colors group-hover:bg-slate-50", color)}>
                <Icon size={18} className="text-slate-600" />
            </div>
        </div>
        <div className="flex items-baseline gap-2 mb-4">
            <h3 className="text-3xl font-bold text-slate-800 tracking-tight">{value}</h3>
        </div>

        <div className="flex items-center gap-2">
            {trend && (
                <span className={cn(
                    "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ring-1 ring-inset",
                    trend === 'up'
                        ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
                        : "bg-rose-50 text-rose-700 ring-rose-600/20"
                )}>
                    {trend === 'up' ? <ArrowUpRight size={12} strokeWidth={3} /> : <ArrowDownRight size={12} strokeWidth={3} />}
                    {trendValue}
                </span>
            )}
            <span className="text-slate-400 text-xs">vs mes pasado</span>
        </div>
    </div>
);

const TransactionTable = () => (
    <div className="overflow-hidden">
        <table className="min-w-full text-left text-sm whitespace-nowrap">
            <thead className="uppercase tracking-wider border-b border-slate-200 bg-slate-50/50">
                <tr>
                    <th scope="col" className="px-6 py-4 font-semibold text-slate-500">ID Pedido</th>
                    <th scope="col" className="px-6 py-4 font-semibold text-slate-500">Cliente</th>
                    <th scope="col" className="px-6 py-4 font-semibold text-slate-500">Fecha</th>
                    <th scope="col" className="px-6 py-4 font-semibold text-slate-500">Estado</th>
                    <th scope="col" className="px-6 py-4 font-semibold text-slate-500 text-right">Monto</th>
                    <th scope="col" className="px-6 py-4 font-semibold text-slate-500 text-right">Acciones</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
                {[101, 102, 103, 104, 105].map((id, index) => (
                    <tr key={id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-medium text-slate-900">#{id + 2030}</td>
                        <td className="px-6 py-4 text-slate-600">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">
                                    C{index + 1}
                                </div>
                                <span>Cliente Ejemplo {index + 1}</span>
                            </div>
                        </td>
                        <td className="px-6 py-4 text-slate-500">Hace {index * 2 + 5} min</td>
                        <td className="px-6 py-4">
                            <span className={cn(
                                "inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset",
                                index % 3 === 0 ? "bg-green-50 text-green-700 ring-green-600/20" :
                                    index % 3 === 1 ? "bg-yellow-50 text-yellow-800 ring-yellow-600/20" :
                                        "bg-blue-50 text-blue-700 ring-blue-600/20"
                            )}>
                                {index % 3 === 0 ? 'Completado' : index % 3 === 1 ? 'Pendiente' : 'Enviado'}
                            </span>
                        </td>
                        <td className="px-6 py-4 text-slate-900 font-medium text-right">$ {(Math.random() * 500).toFixed(2)}</td>
                        <td className="px-6 py-4 text-right">
                            <button className="text-slate-400 hover:text-indigo-600 transition-colors">
                                <MoreHorizontal size={18} />
                            </button>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
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

            // Simple Logic for example purposes
            params.start_date = today;
            params.end_date = today;

            // Mock call for now to preserve structure
            // const response = await apiClient.get('/reports/dashboard/financials', { params });
            // setFinancials(response.data);
            setLoading(false); // Simulate load
        } catch (error) {
            console.error('Error fetching financials:', error);
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

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Dashboard General</h1>
                    <p className="text-slate-500 mt-1">Bienvenido de nuevo, aquí tienes lo que está pasando hoy.</p>
                </div>
                <div className="flex gap-3">
                    <button className="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-lg shadow-sm hover:bg-slate-50 transition-all">
                        Descargar Reporte
                    </button>
                    <button className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg shadow-sm hover:bg-indigo-700 hover:shadow transition-all">
                        Nueva Venta
                    </button>
                </div>
            </div>

            {/* KPI Bento Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <KPICard
                    title="Ingresos Totales"
                    value="$12,450.00"
                    icon={DollarSign}
                    color="bg-indigo-50"
                    trend="up"
                    trendValue="+12.5%"
                />
                <KPICard
                    title="Ganancia Neta"
                    value="$3,200.00"
                    icon={TrendingUp}
                    color="bg-emerald-50"
                    trend="up"
                    trendValue="+8.2%"
                />
                <KPICard
                    title="Pedidos Activos"
                    value="145"
                    icon={ShoppingCart}
                    color="bg-blue-50"
                    trend="down"
                    trendValue="-2.4%"
                />
                <KPICard
                    title="Ticket Promedio"
                    value="$85.50"
                    icon={CreditCard}
                    color="bg-purple-50"
                    trend="up"
                    trendValue="+4.1%"
                />
            </div>

            {/* Charts & Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Chart */}
                <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-bold text-slate-800">Rendimiento de Ventas</h3>
                        <select className="text-sm border-none bg-slate-50 text-slate-600 rounded-lg px-2 py-1 focus:ring-0 cursor-pointer">
                            <option>Últimos 7 días</option>
                            <option>Este Mes</option>
                            <option>Este Año</option>
                        </select>
                    </div>
                    <div className="h-[350px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data}>
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

                {/* Secondary Chart / Stats */}
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col">
                    <h3 className="text-lg font-bold text-slate-800 mb-6">Por Categoría</h3>
                    <div className="flex-1 min-h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data.slice(0, 5)} layout="vertical">
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={30} tick={{ fontSize: 12 }} />
                                <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px' }} />
                                <Bar dataKey="profit" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="mt-4 pt-4 border-t border-slate-100">
                        <div className="flex items-center justify-between text-sm mb-2">
                            <span className="text-slate-500">Meta Mensual</span>
                            <span className="font-semibold text-slate-700">75%</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2">
                            <div className="bg-indigo-600 h-2 rounded-full w-3/4"></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Recent Transactions Table */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-slate-800">Transacciones Recientes</h3>
                    <button className="text-sm text-indigo-600 font-medium hover:text-indigo-800">Ver todas</button>
                </div>
                <TransactionTable />
            </div>
        </div>
    );
};

export default Dashboard;
