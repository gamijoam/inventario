import React, { useEffect, useState } from 'react';
import { Building, CheckCircle, XCircle, ArrowUpRight } from 'lucide-react';
import { getTenants } from '../api/tenants';
import type { Tenant } from '../types/tenant';
import StatsCard from '../components/StatsCard';

const Dashboard: React.FC = () => {
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            try {
                const data = await getTenants();
                setTenants(data.tenants);
            } catch (error) {
                console.error("Error loading dashboard data", error);
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, []);

    // Computed Metrics
    const totalTenants = tenants.length;
    const activeTenants = tenants.filter(t => t.is_active).length;
    const inactiveTenants = tenants.filter(t => !t.is_active).length;

    // Recent Tenants (Top 5 sorted by created_at desc)
    const recentTenants = [...tenants]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5);

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Resumen General</h1>
                <p className="text-sm text-gray-500 mt-1">Métricas clave y actividad reciente de la plataforma.</p>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatsCard
                    title="Total Empresas"
                    value={totalTenants}
                    icon={Building}
                    color="text-blue-600"
                    bgColor="bg-blue-100"
                    trend={{ value: "+12%", isPositive: true }} // Mock trend
                />
                <StatsCard
                    title="Empresas Activas"
                    value={activeTenants}
                    icon={CheckCircle}
                    color="text-green-600"
                    bgColor="bg-green-100"
                />
                <StatsCard
                    title="Empresas Inactivas"
                    value={inactiveTenants}
                    icon={XCircle}
                    color="text-red-600"
                    bgColor="bg-red-100"
                />
            </div>

            {/* Recent Registrations Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="text-lg font-semibold text-gray-800">Registros Recientes</h3>
                    <button className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center">
                        Ver todos <ArrowUpRight className="ml-1 w-4 h-4" />
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Empresa</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Esquema</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {recentTenants.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-8 text-center text-gray-500 text-sm">
                                        No hay registros recientes.
                                    </td>
                                </tr>
                            ) : (
                                recentTenants.map((tenant) => (
                                    <tr key={tenant.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-900">{tenant.name}</div>
                                            <div className="text-xs text-gray-500">{tenant.domain || 'Sin dominio'}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <code className="px-2 py-1 text-xs font-mono bg-gray-100 rounded text-gray-600">{tenant.schema_name}</code>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${tenant.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                                }`}>
                                                {tenant.is_active ? 'Activo' : 'Inactivo'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {new Date(tenant.created_at).toLocaleDateString()}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
