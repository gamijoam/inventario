import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Building, Hash, Calendar, Edit, Plus, Clock, Crown, AlertTriangle, DollarSign, Monitor } from 'lucide-react';
import { getTenantById, getTenantUsers, seedTenant } from '../api/tenants';
import { billingApi } from '../api/billing';
import { getTenantDevices, revokeDevice, reactivateDevice } from '../api/licenses';
import type { TenantUser } from '../api/tenants';
import type { Tenant } from '../types/tenant';
import type { Payment } from '../types/billing';
import type { DesktopDevice } from '../api/licenses';
import toast from 'react-hot-toast';

import EditTenantModal from '../components/EditTenantModal';
import CreateUserModal from '../components/CreateUserModal';
import RenewSubscriptionModal from '../components/RenewSubscriptionModal';
import RegisterPaymentModal from '../components/RegisterPaymentModal';

const TenantDetails: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [tenant, setTenant] = useState<Tenant | null>(null);
    const [users, setUsers] = useState<TenantUser[]>([]);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [devices, setDevices] = useState<DesktopDevice[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSeeding, setIsSeeding] = useState(false);
    const [isRevokingDevice, setIsRevokingDevice] = useState<number | null>(null);
    const [activeTab, setActiveTab] = useState<'general' | 'users' | 'payments' | 'devices'>('general');

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [isRenewModalOpen, setIsRenewModalOpen] = useState(false);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

    useEffect(() => {
        if (id) {
            loadData(parseInt(id));
        }
    }, [id]);

    const loadData = async (tenantId: number) => {
        try {
            setIsLoading(true);
            // Load tenant and users first (critical)
            const [tenantData, usersData] = await Promise.all([
                getTenantById(tenantId),
                getTenantUsers(tenantId)
            ]);
            setTenant(tenantData);
            setUsers(usersData);

            // Load payments separately (non-critical)
            try {
                const paymentsData = await billingApi.getTenantPayments(tenantId);
                setPayments(paymentsData);
            } catch (paymentError) {
                console.warn('Failed to load payments:', paymentError);
                setPayments([]);
            }

            // Load desktop devices separately (non-critical)
            try {
                const devicesData = await getTenantDevices(tenantId);
                setDevices(devicesData);
            } catch (deviceError) {
                console.warn('Failed to load desktop devices:', deviceError);
                setDevices([]);
            }
        } catch (error) {
            console.error(error);
            toast.error('Error al cargar información de la empresa');
            navigate('/dashboard/tenants');
        } finally {
            setIsLoading(false);
        }
    };

    const handleRevokeDevice = async (device: DesktopDevice) => {
        const label = device.device_label || device.license_key.substring(0, 12) + '...';
        if (!window.confirm(`¿Revocar la licencia "${label}"? El dispositivo perderá acceso inmediatamente.`)) return;

        try {
            setIsRevokingDevice(device.id);
            await revokeDevice(device.id);
            toast.success(`Licencia revocada correctamente`);
            if (id) setDevices(prev => prev.map(d => d.id === device.id ? { ...d, is_revoked: true, is_active: false } : d));
        } catch (error: any) {
            console.error(error);
            toast.error(error.response?.data?.detail || 'Error al revocar la licencia');
        } finally {
            setIsRevokingDevice(null);
        }
    };

    const handleReactivateDevice = async (device: DesktopDevice) => {
        const label = device.device_label || device.license_key.substring(0, 12) + '...';
        if (!window.confirm(`¿Reactivar la licencia "${label}"?`)) return;

        try {
            setIsRevokingDevice(device.id);
            await reactivateDevice(device.id);
            toast.success(`Licencia reactivada correctamente`);
            if (id) setDevices(prev => prev.map(d => d.id === device.id ? { ...d, is_revoked: false, is_active: true } : d));
        } catch (error: any) {
            console.error(error);
            toast.error(error.response?.data?.detail || 'Error al reactivar la licencia');
        } finally {
            setIsRevokingDevice(null);
        }
    };

    // Calculate days remaining helper
    const getDaysRemaining = (dateStr: string | null) => {
        if (!dateStr) return 0;
        const today = new Date();
        const expiration = new Date(dateStr);
        const diffTime = expiration.getTime() - today.getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    };

    const handleSeedData = async () => {
        if (!tenant || !window.confirm('¿Estás seguro de inyectar datos de prueba? Esto creará productos, clientes y ventas reales en este esquema.')) return;

        try {
            setIsSeeding(true);
            const result = await seedTenant(tenant.id);
            toast.success(result.message || 'Datos inyectados correctamente');
            loadData(tenant.id); // Refresh counts if needed
        } catch (error: any) {
            console.error(error);
            toast.error(error.response?.data?.detail || 'Error al inyectar datos');
        } finally {
            setIsSeeding(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (!tenant) return null;

    const daysRemaining = getDaysRemaining(tenant.subscription_expires_at);
    const isExpired = daysRemaining < 0;
    const isNearExpiration = daysRemaining < 5 && daysRemaining >= 0;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/dashboard/tenants')}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <ArrowLeft className="w-6 h-6 text-gray-600" />
                    </button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold text-gray-900">{tenant.name}</h1>
                            <button
                                onClick={() => setIsEditModalOpen(true)}
                                className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                title="Editar nombre"
                            >
                                <Edit className="w-4 h-4" />
                            </button>

                            {/* DEMO / PREMIUM BADGE */}
                            {tenant.is_demo ? (
                                <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-800 border border-yellow-200">
                                    <Clock className="w-3 h-3" />
                                    MODO DEMO
                                </span>
                            ) : (
                                <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                                    <Crown className="w-3 h-3" />
                                    PREMIUM
                                </span>
                            )}

                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${tenant.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                }`}>
                                {tenant.is_active ? 'Activo' : 'Inactivo'}
                            </span>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">{tenant.domain || 'Sin dominio configurado'}</p>
                    </div>
                </div>

                {/* Header Actions */}
                <div className='flex gap-2 flex-wrap'>
                    <button
                        onClick={handleSeedData}
                        disabled={isSeeding}
                        className="flex items-center px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-200 hover:bg-indigo-100 transition-colors disabled:opacity-50"
                        title="Inyectar datos de prueba coherentes"
                    >
                        {isSeeding ? (
                            <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent animate-spin rounded-full mr-2" />
                        ) : (
                            <span className="mr-2">🌱</span>
                        )}
                        {isSeeding ? 'Inyectando...' : 'Inyectar Demo'}
                    </button>

                    <button
                        onClick={() => setIsRenewModalOpen(true)}
                        className={`flex items-center px-4 py-2 rounded-lg bg-white border shadow-sm text-sm font-medium transition-colors ${isExpired || isNearExpiration
                            ? 'border-red-300 text-red-700 hover:bg-red-50'
                            : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                            }`}
                    >
                        {(isExpired || isNearExpiration) && <AlertTriangle className="w-4 h-4 mr-2" />}
                        {tenant.is_demo ? 'Activar Suscripción' : 'Renovar Suscripción'}
                    </button>

                    {activeTab === 'users' && (
                        <button
                            onClick={() => setIsUserModalOpen(true)}
                            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 transition-colors"
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            Nuevo Usuario
                        </button>
                    )}

                    {activeTab === 'payments' && (
                        <button
                            onClick={() => setIsPaymentModalOpen(true)}
                            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg shadow hover:bg-green-700 transition-colors"
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            Registrar Pago
                        </button>
                    )}
                </div>
            </div>

            {/* Subscription Alert Card */}
            {(isExpired || isNearExpiration) && (
                <div className={`p-4 rounded-lg border ${isExpired ? 'bg-red-50 border-red-200 text-red-800' : 'bg-yellow-50 border-yellow-200 text-yellow-800'
                    }`}>
                    <div className="flex items-center gap-3">
                        <AlertTriangle className="w-5 h-5" />
                        <div>
                            <p className="font-semibold">
                                {isExpired ? '¡La suscripción ha vencido!' : '¡La suscripción está por vencer!'}
                            </p>
                            <p className="text-sm opacity-90">
                                {isExpired
                                    ? `Venció hace ${Math.abs(daysRemaining)} días. El inquilino podría perder acceso.`
                                    : `Quedan solo ${daysRemaining} días de servicio.`}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8">
                    <button
                        onClick={() => setActiveTab('general')}
                        className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'general'
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                    >
                        Vista General
                    </button>
                    <button
                        onClick={() => setActiveTab('users')}
                        className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'users'
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                    >
                        Usuarios ({users.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('payments')}
                        className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'payments'
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                    >
                        Historial de Pagos
                    </button>
                    <button
                        onClick={() => setActiveTab('devices')}
                        className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-1.5 ${activeTab === 'devices'
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                    >
                        <Monitor className="w-4 h-4" />
                        Dispositivos ({devices.length})
                    </button>
                </nav>
            </div>

            {/* Tab Content */}
            <div className="mt-6">
                {activeTab === 'general' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {/* Info Cards */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-blue-50 rounded-lg">
                                    <Hash className="w-5 h-5 text-blue-600" />
                                </div>
                                <h3 className="font-medium text-gray-900">Schema</h3>
                            </div>
                            <code className="text-sm bg-gray-100 px-2 py-1 rounded text-gray-600 font-mono">
                                {tenant.schema_name}
                            </code>
                        </div>

                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-purple-50 rounded-lg">
                                    <Calendar className="w-5 h-5 text-purple-600" />
                                </div>
                                <h3 className="font-medium text-gray-900">Vencimiento</h3>
                            </div>
                            <p className={`text-lg font-bold ${isExpired ? 'text-red-600' : 'text-gray-800'}`}>
                                {tenant.subscription_expires_at
                                    ? new Date(tenant.subscription_expires_at).toLocaleDateString()
                                    : 'Indefinido'}
                            </p>
                            <p className="text-xs text-gray-500">
                                {tenant.subscription_expires_at && (
                                    isExpired
                                        ? `Vencido hace ${Math.abs(daysRemaining)} días`
                                        : `${daysRemaining} días restantes`
                                )}
                            </p>
                        </div>

                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-green-50 rounded-lg">
                                    <Building className="w-5 h-5 text-green-600" />
                                </div>
                                <h3 className="font-medium text-gray-900">Dominio</h3>
                            </div>
                            <p className="text-gray-600 truncate" title={tenant.domain || ''}>
                                {tenant.domain || 'No asignado'}
                            </p>
                        </div>

                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-gray-50 rounded-lg">
                                    <Calendar className="w-5 h-5 text-gray-600" />
                                </div>
                                <h3 className="font-medium text-gray-900">Registro</h3>
                            </div>
                            <p className="text-gray-600">{new Date(tenant.created_at).toLocaleDateString()}</p>
                        </div>
                    </div>
                )}

                {activeTab === 'users' && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usuario</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rol</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {users.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                                            No hay usuarios registrados en esta empresa.
                                        </td>
                                    </tr>
                                ) : (
                                    users.map((user) => (
                                        <tr key={user.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-bold">
                                                        {user.username.substring(0, 2).toUpperCase()}
                                                    </div>
                                                    <div className="ml-3">
                                                        <div className="text-sm font-medium text-gray-900">{user.full_name}</div>
                                                        <div className="text-xs text-gray-500">@{user.username}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {user.email || 'No email'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="px-2 py-1 text-xs font-medium bg-blue-50 text-blue-700 rounded-full border border-blue-100">
                                                    {user.role}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                                    }`}>
                                                    {user.is_active ? 'Activo' : 'Inactivo'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {activeTab === 'devices' && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        {devices.length === 0 ? (
                            <div className="px-6 py-16 text-center text-gray-500">
                                <div className="flex flex-col items-center gap-3">
                                    <div className="p-4 bg-gray-100 rounded-full">
                                        <Monitor className="w-8 h-8 text-gray-400" />
                                    </div>
                                    <p className="font-medium text-gray-900">Sin dispositivos registrados</p>
                                    <p className="text-sm text-gray-500 max-w-xs">
                                        Este tenant aún no ha activado ninguna licencia de escritorio.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Licencia</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Plan</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dispositivo</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Activado el</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Último acceso</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vence</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {devices.map((device) => {
                                        const isExpired = device.expires_at
                                            ? new Date(device.expires_at) < new Date()
                                            : false;

                                        const statusBadge = device.is_revoked
                                            ? <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-700 border border-red-200">Revocado</span>
                                            : isExpired
                                                ? <span className="px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-700 border border-orange-200">Expirado</span>
                                                : <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-700 border border-green-200">Activo</span>;

                                        const isBusy = isRevokingDevice === device.id;

                                        return (
                                            <tr key={device.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className="font-mono text-sm text-gray-700 bg-gray-100 px-2 py-1 rounded" title={device.license_key}>
                                                        {device.license_key.length > 16
                                                            ? device.license_key.substring(0, 16) + '…'
                                                            : device.license_key}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className="capitalize text-sm text-gray-700 font-medium">
                                                        {device.plan_name}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm text-gray-900">
                                                        {device.device_label || <span className="text-gray-400 italic">Sin etiqueta</span>}
                                                    </div>
                                                    {device.device_id && (
                                                        <div className="text-xs text-gray-400 font-mono truncate max-w-xs" title={device.device_id}>
                                                            {device.device_id.substring(0, 20)}…
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                    {device.activated_at
                                                        ? new Date(device.activated_at).toLocaleDateString()
                                                        : <span className="text-gray-400">—</span>}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                    {device.last_seen_at
                                                        ? new Date(device.last_seen_at).toLocaleDateString()
                                                        : <span className="text-gray-400">—</span>}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                    {device.expires_at
                                                        ? <span className={isExpired ? 'text-red-600 font-medium' : ''}>{new Date(device.expires_at).toLocaleDateString()}</span>
                                                        : <span className="text-gray-400">Indefinido</span>}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    {statusBadge}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    {device.is_revoked ? (
                                                        <button
                                                            onClick={() => handleReactivateDevice(device)}
                                                            disabled={isBusy}
                                                            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors disabled:opacity-50"
                                                        >
                                                            {isBusy ? 'Procesando…' : 'Reactivar'}
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleRevokeDevice(device)}
                                                            disabled={isBusy}
                                                            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors disabled:opacity-50"
                                                        >
                                                            {isBusy ? 'Procesando…' : 'Revocar'}
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}

                {activeTab === 'payments' && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Referencia</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Método</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Monto</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notas</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {payments.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                            <div className="flex flex-col items-center gap-2">
                                                <div className="p-3 bg-gray-100 rounded-full">
                                                    <DollarSign className="w-6 h-6 text-gray-400" />
                                                </div>
                                                <p className="font-medium text-gray-900">No hay pagos registrados</p>
                                                <p className="text-sm">Registra el primer pago usando el botón superior.</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    payments.map((payment) => (
                                        <tr key={payment.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                {new Date(payment.created_at).toLocaleDateString()}
                                                <span className="text-xs text-gray-400 block">
                                                    {new Date(payment.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="font-mono text-sm text-gray-700 bg-gray-100 px-2 py-1 rounded">
                                                    {payment.reference || 'N/A'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="capitalize text-sm text-gray-700">
                                                    {payment.payment_method}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="font-semibold text-gray-900">
                                                    {payment.currency === 'USD' ? '$' : 'Bs'} {Number(payment.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </span>
                                                <span className="text-xs text-gray-400 ml-1">{payment.currency}</span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${payment.status === 'completed'
                                                    ? 'bg-green-50 text-green-700 border border-green-100'
                                                    : 'bg-yellow-50 text-yellow-700 border border-yellow-100'
                                                    }`}>
                                                    {payment.status === 'completed' ? 'Completado' : 'Pendiente'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate" title={payment.notes || ''}>
                                                {payment.notes || '-'}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <EditTenantModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                onSuccess={() => tenant && loadData(tenant.id)}
                tenant={tenant}
            />

            {tenant && (
                <>
                    <CreateUserModal
                        isOpen={isUserModalOpen}
                        onClose={() => setIsUserModalOpen(false)}
                        onSuccess={() => loadData(tenant.id)}
                        tenantId={tenant.id}
                    />
                    <RenewSubscriptionModal
                        isOpen={isRenewModalOpen}
                        onClose={() => setIsRenewModalOpen(false)}
                        onSuccess={() => loadData(tenant.id)}
                        tenant={tenant}
                    />
                    <RegisterPaymentModal
                        isOpen={isPaymentModalOpen}
                        onClose={() => setIsPaymentModalOpen(false)}
                        onSuccess={() => loadData(tenant.id)}
                        tenantId={tenant.id}
                        currentExpiration={tenant.subscription_expires_at}
                    />
                </>
            )}
        </div>
    );
};

export default TenantDetails;
