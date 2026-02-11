import { useEffect, useState } from 'react';
import {
    Users,
    Building,
    Zap,
    TrendingUp,
    Activity
} from 'lucide-react';
import { StatCard } from '../components/dashboard/StatCard';
import { GrowthChart } from '../components/dashboard/GrowthChart';
import api from '../api/axios';
import toast from 'react-hot-toast';

interface DashboardStats {
    total_tenants: number;
    active_tenants: number;
    new_tenants_last_30_days: number;
    total_users: number;
    growth_data: { month: string; tenants: number }[];
}

const DashboardHome = () => {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const response = await api.get('/admin/dashboard/stats');
                setStats(response.data);
            } catch (error) {
                console.error('Error fetching dashboard stats:', error);
                toast.error('Error al cargar estadísticas');
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
            </div>
        );
    }

    if (!stats) return null;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                    Resumen Ejecutivo
                </h1>
                <span className="text-sm text-gray-500">
                    Última actualización: {new Date().toLocaleTimeString()}
                </span>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Empresas Totales"
                    value={stats.total_tenants}
                    icon={Building}
                    color="blue"
                    trend="+100% histórico"
                    trendType="neutral"
                />
                <StatCard
                    title="Empresas Activas"
                    value={stats.active_tenants}
                    icon={Zap}
                    color="green"
                    trend={`${Math.round((stats.active_tenants / (stats.total_tenants || 1)) * 100)}% del total`}
                    trendType="positive"
                />
                <StatCard
                    title="Nuevas (30 días)"
                    value={stats.new_tenants_last_30_days}
                    icon={TrendingUp}
                    color="purple"
                    trendType={stats.new_tenants_last_30_days > 0 ? 'positive' : 'neutral'}
                    trend={stats.new_tenants_last_30_days > 0 ? 'Crecimiento reciente' : 'Sin cambios'}
                />
                <StatCard
                    title="Usuarios Globales"
                    value={stats.total_users}
                    icon={Users}
                    color="orange"
                    trend="En todos los tenants"
                    trendType="neutral"
                />
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 min-h-[400px]">
                    <GrowthChart
                        data={stats.growth_data}
                        title="Crecimiento de Empresas (Últimos 6 meses)"
                    />
                </div>

                {/* Secondary Widget (Optional / Placehoder for Future) */}
                <div className="bg-gradient-to-br from-indigo-900 to-indigo-700 rounded-xl p-6 text-white flex flex-col justify-between">
                    <div>
                        <div className="bg-white/10 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                            <Activity className="text-white" size={24} />
                        </div>
                        <h3 className="text-xl font-bold mb-2">Estado del Sistema</h3>
                        <p className="text-indigo-100 text-sm">
                            Todos los servicios operando correctamente. Base de datos y API optimizados.
                        </p>
                    </div>
                    <div className="mt-6 pt-6 border-t border-white/10">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-indigo-200">Versión API</span>
                            <span className="font-mono font-medium">v1.2.5</span>
                        </div>
                        <div className="flex items-center justify-between text-sm mt-2">
                            <span className="text-indigo-200">Latencia Media</span>
                            <span className="font-mono font-medium text-green-300">45ms</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardHome;
