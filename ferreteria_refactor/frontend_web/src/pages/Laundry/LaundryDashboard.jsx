import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Plus, Search, RefreshCw, Filter,
    Shirt, Clock, CheckCircle, Package,
    LayoutGrid, List as ListIcon
} from 'lucide-react';
import apiClient from '../../config/axios';
import { toast } from 'react-hot-toast';
import LaundryDetailModal from './components/LaundryDetailModal';
import LaundryList from './components/LaundryList';

// Status Columns for Kanban
const COLUMNS = [
    { id: 'RECEIVED', label: 'Recibido', color: 'bg-gray-100 border-gray-200' },
    { id: 'IN_PROGRESS', label: 'Lavando / Secando', color: 'bg-blue-50 border-blue-100' },
    { id: 'READY', label: 'Listo para Entrega', color: 'bg-green-50 border-green-100' },
    { id: 'DELIVERED', label: 'Entregado', color: 'bg-teal-50 border-teal-100' }
];

const LaundryDashboard = () => {
    const navigate = useNavigate();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [viewMode, setViewMode] = useState('list');

    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, PENDING, READY, DELIVERED
    const [showLateOnly, setShowLateOnly] = useState(false);

    useEffect(() => {
        fetchOrders();
    }, []);

    const fetchOrders = async () => {
        setLoading(true);
        try {
            // Fetch ONLY Laundry orders
            const res = await apiClient.get('/services/orders', {
                params: { service_type: 'LAUNDRY' }
            });
            setOrders(res.data);
        } catch (error) {
            console.error(error);
            toast.error("Error al cargar órdenes de lavandería");
        } finally {
            setLoading(false);
        }
    };

    const isOrderLate = (order) => {
        if (order.status === 'DELIVERED' || order.status === 'READY') return false;
        const created = new Date(order.created_at);
        const diffTime = Math.abs(new Date() - created);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays > 2; // Considered late after 2 days
    };

    const getFilteredOrders = () => {
        return orders.filter(order => {
            // Search Text
            const searchLower = searchTerm.toLowerCase();
            const matchesSearch =
                order.ticket_number?.toLowerCase().includes(searchLower) ||
                order.customer?.name?.toLowerCase().includes(searchLower);

            if (!matchesSearch) return false;

            // Status Filter
            if (statusFilter !== 'ALL') {
                if (statusFilter === 'PENDING') {
                    if (!['RECEIVED', 'IN_PROGRESS', 'DIAGNOSING'].includes(order.status)) return false;
                } else if (order.status !== statusFilter) {
                    return false;
                }
            }

            // Late Filter
            if (showLateOnly && !isOrderLate(order)) return false;

            return true;
        });
    };

    const filteredOrders = getFilteredOrders();

    const getOrdersByStatus = (statusId) => {
        const list = filteredOrders;
        if (statusId === 'RECEIVED') return list.filter(o => ['RECEIVED', 'DIAGNOSING'].includes(o.status));
        return list.filter(o => o.status === statusId);
    };

    return (
        <div className="p-6 h-[calc(100vh-theme(spacing.16))] flex flex-col">
            {/* Header */}
            <div className="flex flex-col gap-4 mb-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                            <Shirt className="text-teal-600" />
                            Tablero de Lavandería
                        </h1>
                        <p className="text-gray-500 text-sm">Organiza y sigue tus órdenes de servicio</p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => navigate('/laundry/new')}
                            className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg font-semibold shadow-sm flex items-center gap-2"
                        >
                            <Plus size={18} /> Nueva Orden
                        </button>
                    </div>
                </div>

                {/* Filters Bar */}
                <div className="bg-white p-3 rounded-xl border border-gray-200 flex flex-wrap items-center gap-3 shadow-sm">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar por Ticket, Cliente..."
                            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <select
                            className="p-2 border rounded-lg bg-gray-50 text-sm font-medium focus:ring-2 focus:ring-teal-500 outline-none"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <option value="ALL">Todos los Estados</option>
                            <option value="PENDING">Pendientes (Recibido/Lavando)</option>
                            <option value="READY">Listos para Entrega</option>
                            <option value="DELIVERED">Entregados</option>
                        </select>

                        <button
                            onClick={() => setShowLateOnly(!showLateOnly)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold border transition-colors ${showLateOnly ? 'bg-rose-100 text-rose-700 border-rose-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                            title="Ver solo órdenes con más de 2 días de retraso"
                        >
                            <Clock size={16} />
                            {showLateOnly ? 'Viendo Atrasados' : 'Filtrar Atrasados'}
                        </button>

                        <div className="h-8 w-px bg-gray-200 mx-2"></div>

                        <div className="bg-gray-100 p-1 rounded-lg flex gap-1">
                            <button
                                onClick={() => setViewMode('kanban')}
                                className={`p-1.5 rounded-md transition-all ${viewMode === 'kanban' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                <LayoutGrid size={18} />
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                <ListIcon size={18} />
                            </button>
                        </div>
                        <button
                            onClick={fetchOrders}
                            className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                            title="Actualizar"
                        >
                            <RefreshCw size={20} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Content Switcher */}
            <div className="flex-1 overflow-hidden">
                {loading ? (
                    <div className="text-center py-20 text-gray-400">Cargando...</div>
                ) : viewMode === 'list' ? (
                    <LaundryList orders={filteredOrders} onSelectOrder={setSelectedOrder} />
                ) : (
                    // KANBAN VIEW
                    <div className="flex gap-4 h-full min-w-[1000px] overflow-x-auto pb-4">
                        {COLUMNS.map(col => (
                            <div key={col.id} className={`flex-1 rounded-xl p-3 flex flex-col ${col.color} border min-w-[280px]`}>
                                <div className="font-bold text-gray-700 mb-3 flex justify-between items-center">
                                    {col.label}
                                    <span className="bg-white px-2 py-0.5 rounded-full text-xs shadow-sm">
                                        {getOrdersByStatus(col.id).length}
                                    </span>
                                </div>
                                <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-1">
                                    {getOrdersByStatus(col.id).map(order => {
                                        const late = isOrderLate(order);
                                        return (
                                            <div
                                                key={order.id}
                                                onClick={() => setSelectedOrder(order)}
                                                className={`bg-white p-3 rounded-lg shadow-sm border cursor-pointer hover:shadow-md transition-all active:scale-95 group ${late ? 'border-l-4 border-l-rose-500 border-y-gray-100 border-r-gray-100' : 'border-gray-100'}`}
                                            >
                                                {late && (
                                                    <div className="flex items-center gap-1 text-[10px] font-bold text-rose-500 mb-1">
                                                        <Clock size={10} /> REVISAR (ATRASADO)
                                                    </div>
                                                )}
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className="font-bold text-gray-800">{order.ticket_number}</span>
                                                    <span className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">
                                                        {new Date(order.created_at).toLocaleDateString()}
                                                    </span>
                                                </div>

                                                <div className="flex flex-wrap items-center gap-2 mb-2">
                                                    <div className="bg-teal-50 text-teal-700 px-2 py-1 rounded text-xs font-bold border border-teal-100 flex items-center gap-1">
                                                        <Package size={12} />
                                                        {order.order_metadata?.weight_kg || '?'} Kg
                                                    </div>
                                                    <div className="bg-purple-50 text-purple-700 px-2 py-1 rounded text-xs font-bold border border-purple-100">
                                                        {order.order_metadata?.wash_type || 'General'}
                                                    </div>

                                                </div>

                                                <div className="text-xs text-gray-600 truncate">
                                                    <span className="font-medium">{order.customer?.name}</span>
                                                </div>
                                                {order.problem_description && (
                                                    <div className="mt-2 text-[10px] text-gray-400 truncate border-t pt-1">
                                                        Note: {order.problem_description}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                    {getOrdersByStatus(col.id).length === 0 && (
                                        <div className="text-center py-10 text-gray-300 text-sm italic">
                                            Sin órdenes
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Detail Modal */}
            {selectedOrder && (
                <LaundryDetailModal
                    orderId={selectedOrder.id}
                    onClose={() => {
                        setSelectedOrder(null);
                        fetchOrders();
                    }}
                />
            )}
        </div>
    );
};

export default LaundryDashboard;
