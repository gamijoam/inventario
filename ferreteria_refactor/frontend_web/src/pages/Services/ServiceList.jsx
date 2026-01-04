import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Search, Plus, Filter, Clock, CheckCircle,
    AlertTriangle, Wrench, ChevronRight
} from 'lucide-react';
import apiClient from '../../config/axios';
import { toast } from 'react-hot-toast';

const STATUS_COLORS = {
    RECEIVED: 'bg-gray-100 text-gray-800',
    DIAGNOSING: 'bg-yellow-100 text-yellow-800',
    APPROVED: 'bg-blue-100 text-blue-800',
    IN_PROGRESS: 'bg-purple-100 text-purple-800',
    READY: 'bg-green-100 text-green-800',
    DELIVERED: 'bg-teal-100 text-teal-800',
    CANCELLED: 'bg-red-100 text-red-800',
};

const ServiceList = () => {
    const navigate = useNavigate();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState('');

    useEffect(() => {
        fetchOrders();
    }, [filterStatus]);

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const params = {};
            if (filterStatus) params.status = filterStatus;

            const res = await apiClient.get('/services/orders', { params });
            setOrders(res.data);
        } catch (error) {
            toast.error("Error al cargar órdenes");
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <Wrench className="text-blue-600" />
                        Servicios Técnicos
                    </h1>
                    <p className="text-gray-500">Gestión de órdenes de reparación</p>
                </div>

                <div className="flex gap-2 w-full md:w-auto">
                    <button
                        onClick={() => navigate('/services/reception')}
                        className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold shadow-sm flex items-center justify-center gap-2"
                    >
                        <Plus size={18} /> Nueva Orden
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex gap-2 overflow-x-auto pb-2">
                <button
                    onClick={() => setFilterStatus('')}
                    className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors
            ${filterStatus === '' ? 'bg-gray-800 text-white' : 'bg-white text-gray-600 hover:bg-gray-50 border'}`}
                >
                    Todos
                </button>
                {Object.keys(STATUS_COLORS).map(status => (
                    <button
                        key={status}
                        onClick={() => setFilterStatus(status)}
                        className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-2
              ${filterStatus === status
                                ? 'ring-2 ring-offset-1 ring-blue-500 ' + STATUS_COLORS[status]
                                : 'bg-white text-gray-600 hover:bg-gray-50 border'}`}
                    >
                        {status}
                    </button>
                ))}
            </div>

            {/* List */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-gray-500">Cargando...</div>
                ) : orders.length === 0 ? (
                    <div className="p-12 text-center">
                        <Wrench className="mx-auto text-gray-300 mb-4" size={48} />
                        <h3 className="text-lg font-medium text-gray-900">No hay órdenes encontradas</h3>
                        <p className="text-gray-500">Intente cambiar el filtro o cree una nueva orden.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {orders.map(order => (
                            <div
                                key={order.id}
                                onClick={() => navigate(`/services/orders/${order.id}`)}
                                className="p-4 hover:bg-gray-50 cursor-pointer transition-colors group"
                            >
                                <div className="flex justify-between items-start">
                                    <div className="flex gap-4">
                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${STATUS_COLORS[order.status].split(' ')[0]}`}>
                                            <span className="font-bold text-xs">{order.ticket_number.split('-')[1]}</span>
                                        </div>

                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-bold text-gray-900">{order.ticket_number}</span>
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${STATUS_COLORS[order.status]}`}>
                                                    {order.status}
                                                </span>
                                            </div>

                                            <h4 className="font-semibold text-gray-800 mb-1">{order.device_type} {order.brand} {order.model}</h4>
                                            <p className="text-sm text-gray-500 flex items-center gap-1">
                                                <span className="font-medium text-gray-700">{order.customer?.name}</span>
                                                • {new Date(order.created_at).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <div className="text-right hidden sm:block">
                                            <div className="text-xs text-gray-400 mb-1">Total Estimado</div>
                                            <div className="font-bold text-gray-800">
                                                {order.details ? (
                                                    // Simple client-side calc if needed, or backend aggregation
                                                    "$" + order.details.reduce((acc, item) => acc + (parseFloat(item.quantity) * parseFloat(item.unit_price)), 0).toFixed(2)
                                                ) : '$0.00'}
                                            </div>
                                        </div>
                                        <ChevronRight className="text-gray-300 group-hover:text-blue-500 transition-colors" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ServiceList;
