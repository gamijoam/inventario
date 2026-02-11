import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getTenants, deleteTenant, updateTenantStatus, updateTenant } from '../api/tenants';
import type { Tenant } from '../types/tenant';
import { Plus, Search, Building, Trash2, Edit, Utensils, Shirt, Zap, ShoppingBag } from 'lucide-react';
import toast from 'react-hot-toast';

import CreateTenantModal from '../components/CreateTenantModal';
import EditTenantModal from '../components/EditTenantModal';
import Switch from '../components/ui/Switch';
import ModuleToggle from '../components/ModuleToggle';

const Tenants: React.FC = () => {
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);

    useEffect(() => {
        fetchTenants();
    }, []);

    const fetchTenants = async () => {
        try {
            setIsLoading(true);
            const data = await getTenants();
            setTenants(data.tenants);
            setError(null);
        } catch (err) {
            console.error(err);
            setError('Error al cargar empresas');
            toast.error('No se pudieron cargar las empresas');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id: number, name: string) => {
        if (!window.confirm(`¿Estás seguro de eliminar la empresa "${name}"?\n\n⚠️ ESTA ACCIÓN ELIMINARÁ TODOS LOS DATOS Y ESQUEMAS DE BASE DE DATOS.\nNO SE PUEDE DESHACER.`)) {
            return;
        }

        const toastId = toast.loading('Eliminando empresa...');
        try {
            await deleteTenant(id);
            setTenants(prev => prev.filter(t => t.id !== id));
            toast.success('Empresa eliminada correctamente', { id: toastId });
        } catch (error: any) {
            console.error(error);
            const msg = error.response?.data?.detail || 'Error al eliminar empresa';
            toast.error(msg, { id: toastId });
        }
    };

    const handleStatusChange = async (id: number, currentStatus: boolean) => {
        const newStatus = !currentStatus;
        // Optimistic update
        setTenants(prev => prev.map(t => t.id === id ? { ...t, is_active: newStatus } : t));

        try {
            await updateTenantStatus(id, newStatus);
            toast.success(`Empresa ${newStatus ? 'activada' : 'desactivada'}`);
        } catch (error: any) {
            console.error(error);
            // Revert changes on error
            setTenants(prev => prev.map(t => t.id === id ? { ...t, is_active: currentStatus } : t));
            toast.error('Error al actualizar estado');
        }
    };

    const handleModuleToggle = async (id: number, moduleKey: keyof Tenant, newValue: boolean) => {
        // Optimistic update
        setTenants(prev => prev.map(t => {
            if (t.id === id) {
                return { ...t, [moduleKey]: newValue };
            }
            return t;
        }));

        try {
            // @ts-ignore - Dynamic key access
            await updateTenant(id, { [moduleKey]: newValue });
            toast.success(`Módulo actualizado`);
        } catch (error) {
            console.error(error);
            // Revert
            setTenants(prev => prev.map(t => {
                if (t.id === id) {
                    // @ts-ignore
                    return { ...t, [moduleKey]: !newValue };
                }
                return t;
            }));
            toast.error('Error al actualizar módulo');
        }
    };

    const openEditModal = (tenant: Tenant) => {
        setSelectedTenant(tenant);
        setIsEditModalOpen(true);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Gestión de Empresas</h1>
                    <p className="text-sm text-gray-500 mt-1">Administra los tenants y sus configuraciones.</p>
                </div>
                <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 transition-colors"
                >
                    <Plus className="w-5 h-5 mr-2" />
                    Nueva Empresa
                </button>
            </div>

            {/* Stats Cards (Optional future expansion) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Placeholder for stats */}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-200 flex gap-4">
                    <div className="relative flex-1 max-w-md">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="Buscar empresa..."
                            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        />
                    </div>
                </div>

                {isLoading ? (
                    <div className="p-12 flex justify-center text-gray-400">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                    </div>
                ) : error ? (
                    <div className="p-12 text-center text-red-500">
                        {error}
                        <button onClick={fetchTenants} className="ml-2 text-blue-600 underline">Reintentar</button>
                    </div>
                ) : tenants.length === 0 ? (
                    <div className="p-12 text-center text-gray-500">
                        <Building className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                        <p>No hay empresas registradas aún.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Empresa / Dominio
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Esquema DB
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Módulos Contratados
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Estado
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Usuarios
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Fecha Registro
                                    </th>
                                    <th scope="col" className="relative px-6 py-3">
                                        <span className="sr-only">Acciones</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {tenants.map((tenant) => (
                                    <tr key={tenant.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">
                                                    {tenant.name.substring(0, 2).toUpperCase()}
                                                </div>
                                                <div className="ml-4">
                                                    <Link to={`/dashboard/tenants/${tenant.id}`} className="text-sm font-medium text-gray-900 hover:text-blue-600 hover:underline">
                                                        {tenant.name}
                                                    </Link>
                                                    <div className="text-sm text-gray-500">{tenant.domain || 'Sin dominio'}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <code className="px-2 py-1 text-xs font-mono bg-gray-100 rounded text-gray-600">
                                                {tenant.schema_name}
                                            </code>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => handleModuleToggle(tenant.id, 'has_hardware_module', !tenant.has_hardware_module)}
                                                    className={`p-2 rounded-lg transition-all duration-200 border ${tenant.has_hardware_module
                                                        ? 'bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100 hover:border-blue-300 shadow-sm'
                                                        : 'bg-white border-dashed border-gray-300 text-gray-300 hover:bg-gray-50 hover:text-gray-400'}`}
                                                    title="Módulo Ferretería / Retail"
                                                >
                                                    <ShoppingBag size={18} />
                                                </button>

                                                <button
                                                    onClick={() => handleModuleToggle(tenant.id, 'has_restaurant_module', !tenant.has_restaurant_module)}
                                                    className={`p-2 rounded-lg transition-all duration-200 border ${tenant.has_restaurant_module
                                                        ? 'bg-orange-50 border-orange-200 text-orange-600 hover:bg-orange-100 hover:border-orange-300 shadow-sm'
                                                        : 'bg-white border-dashed border-gray-300 text-gray-300 hover:bg-gray-50 hover:text-gray-400'}`}
                                                    title="Módulo Restaurante"
                                                >
                                                    <Utensils size={18} />
                                                </button>

                                                <button
                                                    onClick={() => handleModuleToggle(tenant.id, 'has_laundry_module', !tenant.has_laundry_module)}
                                                    className={`p-2 rounded-lg transition-all duration-200 border ${tenant.has_laundry_module
                                                        ? 'bg-cyan-50 border-cyan-200 text-cyan-600 hover:bg-cyan-100 hover:border-cyan-300 shadow-sm'
                                                        : 'bg-white border-dashed border-gray-300 text-gray-300 hover:bg-gray-50 hover:text-gray-400'}`}
                                                    title="Módulo Lavandería"
                                                >
                                                    <Shirt size={18} />
                                                </button>

                                                <button
                                                    onClick={() => handleModuleToggle(tenant.id, 'has_services_module', !tenant.has_services_module)}
                                                    className={`p-2 rounded-lg transition-all duration-200 border ${tenant.has_services_module
                                                        ? 'bg-purple-50 border-purple-200 text-purple-600 hover:bg-purple-100 hover:border-purple-300 shadow-sm'
                                                        : 'bg-white border-dashed border-gray-300 text-gray-300 hover:bg-gray-50 hover:text-gray-400'}`}
                                                    title="Módulo Servicios"
                                                >
                                                    <Zap size={18} />
                                                </button>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <Switch
                                                    checked={tenant.is_active}
                                                    onChange={() => handleStatusChange(tenant.id, tenant.is_active)}
                                                />
                                                <span className={`ml-2 text-xs font-medium ${tenant.is_active ? 'text-green-600' : 'text-gray-500'}`}>
                                                    {tenant.is_active ? 'Activo' : 'Inactivo'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {tenant.user_count ?? '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {new Date(tenant.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() => openEditModal(tenant)}
                                                    className="text-indigo-600 hover:text-indigo-900 p-1 hover:bg-indigo-50 rounded"
                                                    title="Editar"
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(tenant.id, tenant.name)}
                                                    className="text-red-600 hover:text-red-900 p-1 hover:bg-red-50 rounded"
                                                    title="Eliminar"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <CreateTenantModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSuccess={fetchTenants}
            />

            <EditTenantModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                onSuccess={fetchTenants}
                tenant={selectedTenant}
            />
        </div>
    );
};

export default Tenants;
