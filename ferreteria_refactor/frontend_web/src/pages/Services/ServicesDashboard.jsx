import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Zap, Wrench, TrendingUp } from 'lucide-react';
import apiClient from '../../config/axios';
import { toast } from 'react-hot-toast';
import ServiceCard from './components/ServiceCard';
import ServiceOrderWizard from './ServiceOrderWizard';
import ServiceOrderDetail from './ServiceOrderDetail';
import ServiceTemplatesManager from './components/ServiceTemplatesManager';
import printerService from '../../services/printerService';
import { useConfig } from '../../context/ConfigContext';
import { useAuth } from '../../context/AuthContext';

const FILTER_OPTIONS = [
    { id: 'today', label: '📅 Hoy', filter: 'today' },
    { id: 'in-process', label: '🔧 En Proceso', filter: 'IN_PROGRESS' },
    { id: 'ready', label: '✓ Listo', filter: 'READY' },
    { id: 'delivered', label: '📦 Entregado', filter: 'DELIVERED' },
    { id: 'all', label: '📋 Todas', filter: 'all' },
];

const ServicesDashboard = () => {
    const { business } = useConfig();
    const { user } = useAuth();
    const isAdmin = user?.role === 'ADMIN';
    const paperWidth = business?.paper_width || '80';

    // State
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeFilter, setActiveFilter] = useState('today');
    const [showWizard, setShowWizard] = useState(false);
    const [showTemplates, setShowTemplates] = useState(false);
    const [showOrderDetail, setShowOrderDetail] = useState(false);
    const [selectedOrderId, setSelectedOrderId] = useState(null);

    // Stats
    const [stats, setStats] = useState({
        today: 0,
        inProcess: 0,
        ready: 0,
        pendingAmount: 0,
    });

    // Fetch orders
    const fetchOrders = useCallback(async () => {
        setLoading(true);
        try {
            const params = { service_type: 'REPAIR' };

            // Aplicar filtro por estado
            const activeOption = FILTER_OPTIONS.find(o => o.id === activeFilter);
            if (activeOption && activeOption.filter !== 'all' && activeOption.filter !== 'today') {
                params.status = activeOption.filter;
            }

            // Si es "hoy", aplicar filtro en cliente
            if (activeFilter === 'today') {
                // Nota: El backend debería soportar filtro por fecha
                // Por ahora trae todos y filtramos en cliente
            }

            const res = await apiClient.get('/services/orders', { params });
            let filteredOrders = res.data;

            // Filtro en cliente si es necesario
            if (activeFilter === 'today') {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                filteredOrders = filteredOrders.filter(o => {
                    const orderDate = new Date(o.created_at);
                    orderDate.setHours(0, 0, 0, 0);
                    return orderDate.getTime() === today.getTime();
                });
            }

            // Buscar término
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                filteredOrders = filteredOrders.filter(o =>
                    o.ticket_number.toLowerCase().includes(term) ||
                    o.customer?.name.toLowerCase().includes(term) ||
                    o.serial_imei?.toLowerCase().includes(term)
                );
            }

            setOrders(filteredOrders);

            // Calcular stats
            const todayOrders = res.data.filter(o => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const orderDate = new Date(o.created_at);
                orderDate.setHours(0, 0, 0, 0);
                return orderDate.getTime() === today.getTime();
            });

            const inProcessCount = res.data.filter(o => o.status === 'IN_PROGRESS').length;
            const readyCount = res.data.filter(o => o.status === 'READY').length;
            const pendingTotal = res.data.reduce((sum, o) => {
                const orderTotal = o.details?.reduce((acc, d) => acc + Number(d.quantity) * Number(d.unit_price), 0) || 0;
                const orderPaid = o.payments?.reduce((acc, p) => acc + parseFloat(p.amount), 0) || 0;
                return sum + Math.max(0, orderTotal - orderPaid);
            }, 0);

            setStats({
                today: todayOrders.length,
                inProcess: inProcessCount,
                ready: readyCount,
                pendingAmount: pendingTotal,
            });
        } catch (error) {
            toast.error('Error al cargar órdenes');
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [activeFilter, searchTerm]);

    useEffect(() => {
        fetchOrders();
    }, [fetchOrders]);

    const handlePrint = async (orderId) => {
        try {
            const res = await apiClient.get(`/services/orders/${orderId}/print/thermal?width=${paperWidth}`);
            await printerService.printRaw(res.data);
            toast.success('Ticket enviado a impresora');
        } catch (err) {
            toast.error('Error al imprimir');
        }
    };

    const handleOpenOrder = (orderId) => {
        setSelectedOrderId(orderId);
        setShowOrderDetail(true);
    };

    const handleWizardSuccess = () => {
        fetchOrders();
        toast.success('¡Orden creada exitosamente!');
    };

    const handleDetailClose = () => {
        setShowOrderDetail(false);
        setSelectedOrderId(null);
        fetchOrders(); // Recargar órdenes por si hubo cambios
    };

    return (
        <>
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
                <div className="max-w-7xl mx-auto space-y-8">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <h1 className="text-4xl font-bold text-slate-900 flex items-center gap-3">
                                <div className="bg-gradient-to-br from-blue-600 to-blue-700 text-white p-3 rounded-xl">
                                    <Wrench size={28} />
                                </div>
                                Taller de Servicios
                            </h1>
                            <p className="text-slate-600 mt-1">Gestión de órdenes de reparación</p>
                        </div>

                        <div className="flex gap-3">
                            {isAdmin && (
                                <button
                                    onClick={() => setShowTemplates(true)}
                                    className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 rounded-lg font-semibold hover:bg-amber-100 border border-amber-200 transition-colors"
                                >
                                    <Zap size={18} /> Plantillas
                                </button>
                            )}
                            <button
                                onClick={() => setShowWizard(true)}
                                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 shadow-lg shadow-blue-200 transition-colors"
                            >
                                <Plus size={20} /> Nueva Orden
                            </button>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-slate-600 text-sm font-semibold">Hoy</p>
                                    <p className="text-3xl font-bold text-slate-900 mt-2">{stats.today}</p>
                                </div>
                                <div className="bg-blue-100 text-blue-600 p-3 rounded-lg">
                                    📅
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-slate-600 text-sm font-semibold">En Proceso</p>
                                    <p className="text-3xl font-bold text-slate-900 mt-2">{stats.inProcess}</p>
                                </div>
                                <div className="bg-purple-100 text-purple-600 p-3 rounded-lg">
                                    🔧
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-slate-600 text-sm font-semibold">Listas</p>
                                    <p className="text-3xl font-bold text-slate-900 mt-2">{stats.ready}</p>
                                </div>
                                <div className="bg-emerald-100 text-emerald-600 p-3 rounded-lg">
                                    ✓
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-slate-600 text-sm font-semibold">Pendiente</p>
                                    <p className="text-3xl font-bold text-slate-900 mt-2">${stats.pendingAmount.toFixed(0)}</p>
                                </div>
                                <div className="bg-amber-100 text-amber-600 p-3 rounded-lg">
                                    💰
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Filtros y Búsqueda */}
                    <div className="space-y-4">
                        <div className="flex gap-2 flex-wrap">
                            {FILTER_OPTIONS.map(option => (
                                <button
                                    key={option.id}
                                    onClick={() => setActiveFilter(option.id)}
                                    className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                                        activeFilter === option.id
                                            ? 'bg-slate-900 text-white shadow-lg'
                                            : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                                    }`}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>

                        <div className="relative">
                            <Search className="absolute left-4 top-3 text-slate-400" size={20} />
                            <input
                                type="text"
                                placeholder="Buscar por ticket, cliente o IMEI..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            />
                        </div>
                    </div>

                    {/* Lista de órdenes */}
                    <div>
                        {loading ? (
                            <div className="text-center py-12">
                                <div className="inline-block">
                                    <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                                </div>
                                <p className="text-slate-600 mt-4">Cargando órdenes...</p>
                            </div>
                        ) : orders.length === 0 ? (
                            <div className="text-center py-12">
                                <Wrench className="mx-auto text-slate-300 mb-4" size={48} />
                                <p className="text-slate-600 font-semibold">No hay órdenes</p>
                                <p className="text-slate-500 text-sm mt-1">
                                    {searchTerm ? 'Ajusta tu búsqueda' : 'Crea una nueva para comenzar'}
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {orders.map(order => (
                                    <ServiceCard
                                        key={order.id}
                                        order={order}
                                        onOpen={handleOpenOrder}
                                        onPrint={handlePrint}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Modales */}
            {showWizard && (
                <ServiceOrderWizard
                    isOpen={showWizard}
                    onClose={() => setShowWizard(false)}
                    onSuccess={handleWizardSuccess}
                />
            )}

            {showTemplates && (
                <ServiceTemplatesManager
                    onClose={() => setShowTemplates(false)}
                />
            )}

            {showOrderDetail && selectedOrderId && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
                        <ServiceOrderDetail
                            orderId={selectedOrderId}
                            onClose={handleDetailClose}
                        />
                    </div>
                </div>
            )}
        </>
    );
};

export default ServicesDashboard;
