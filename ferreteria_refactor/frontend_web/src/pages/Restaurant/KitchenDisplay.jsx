import React, { useState, useEffect } from 'react';
import kitchenService from '../../services/kitchenService';
import { Clock, CheckCircle, Flame, ChefHat, AlertTriangle, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

const KitchenDisplay = () => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState(new Date());

    const fetchOrders = async () => {
        try {
            const data = await kitchenService.getPendingOrders();
            setOrders(data);
            setLastUpdated(new Date());
            setLoading(false);
        } catch (error) {
            console.error("Error fetching kitchen orders:", error);
        }
    };

    // Polling every 10 seconds
    useEffect(() => {
        fetchOrders();
        const interval = setInterval(fetchOrders, 10000);
        return () => clearInterval(interval);
    }, []);

    const handleStatusChange = async (itemId, newStatus) => {
        try {
            // Optimistic update locally? Or just wait for refresh? 
            // Let's do optimistic to feel snappy
            await kitchenService.updateItemStatus(itemId, newStatus);
            toast.success(`Hiciste click en ${newStatus}`);
            fetchOrders(); // Sync with server
        } catch (error) {
            toast.error('Error actualizando estado');
        }
    };

    const getElapsedTime = (dateString) => {
        const start = new Date(dateString);
        const now = new Date();
        const diffMs = now - start;
        const diffMins = Math.floor(diffMs / 60000);
        return `${diffMins} min`;
    };

    const isUrgent = (dateString) => {
        const start = new Date(dateString);
        const now = new Date();
        return (now - start) > 15 * 60 * 1000; // 15 mins
    };

    return (
        <div className="min-h-screen bg-gray-900 text-gray-100 p-4">
            {/* Header */}
            <div className="flex justify-between items-center mb-6 border-b border-gray-700 pb-4">
                <div className="flex items-center gap-3">
                    <ChefHat size={32} className="text-orange-500" />
                    <h1 className="text-3xl font-bold tracking-wider">COCINA / KDS</h1>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-400">
                    <span>Actualizado: {lastUpdated.toLocaleTimeString()}</span>
                    <button
                        onClick={fetchOrders}
                        className="p-2 bg-gray-800 rounded-full hover:bg-gray-700 transition"
                    >
                        <RefreshCw size={20} />
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center items-center h-96">
                    <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-orange-500"></div>
                </div>
            ) : orders.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-96 text-gray-500 opacity-50">
                    <ChefHat size={64} className="mb-4" />
                    <span className="text-2xl">Todo tranquilo por ahora...</span>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {orders.map(order => (
                        <div
                            key={order.id}
                            className={`flex flex-col rounded-xl overflow-hidden border-2 shadow-lg transition-all ${isUrgent(order.created_at) ? 'border-red-500 shadow-red-900/20' : 'border-gray-700 bg-gray-800'
                                }`}
                        >
                            {/* Card Header */}
                            <div className={`p-3 flex justify-between items-center ${isUrgent(order.created_at) ? 'bg-red-900/50' : 'bg-gray-750 border-b border-gray-700'
                                }`}>
                                <div>
                                    <h3 className="text-xl font-bold text-white">Mesa {order.table_id}</h3>
                                    <span className="text-xs text-gray-400">Orden #{order.id}</span>
                                </div>
                                <div className="text-right">
                                    <span className="flex items-center gap-1 font-mono text-lg font-bold">
                                        <Clock size={16} /> {getElapsedTime(order.created_at)}
                                    </span>
                                </div>
                            </div>

                            {/* Items List */}
                            <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[400px] bg-gray-800">
                                {order.items
                                    .filter(item => item.status !== 'SERVED' && item.status !== 'CANCELLED')
                                    .map(item => (
                                        <div key={item.id} className="bg-gray-700 rounded-lg p-3 flex flex-col gap-2 relative group">
                                            <div className="flex justify-between items-start">
                                                <span className="text-lg font-bold text-white flex gap-2">
                                                    <span className="bg-gray-600 px-2 rounded text-orange-300">{item.quantity}</span>
                                                    {item.product_name}
                                                </span>
                                            </div>

                                            {item.notes && (
                                                <div className="bg-yellow-900/30 text-yellow-200 px-2 py-1 rounded text-sm font-bold border border-yellow-700 flex items-start gap-1">
                                                    <AlertTriangle size={14} className="mt-0.5" /> {item.notes}
                                                </div>
                                            )}

                                            {/* Actions */}
                                            <div className="flex gap-2 mt-2">
                                                {item.status === 'PENDING' && (
                                                    <button
                                                        onClick={() => handleStatusChange(item.id, 'PREPARING')}
                                                        className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold flex justify-center items-center gap-2"
                                                    >
                                                        <Flame size={18} /> COCINAR
                                                    </button>
                                                )}

                                                {(item.status === 'PENDING' || item.status === 'PREPARING') && (
                                                    <button
                                                        onClick={() => handleStatusChange(item.id, 'READY')}
                                                        className="flex-1 py-3 bg-green-600 hover:bg-green-500 text-white rounded font-bold flex justify-center items-center gap-2"
                                                    >
                                                        <CheckCircle size={18} /> LISTO
                                                    </button>
                                                )}

                                                {item.status === 'READY' && (
                                                    <div className="w-full py-2 bg-green-900/50 text-green-400 text-center font-bold border border-green-700 rounded animate-pulse">
                                                        ✅ PARA SERVIR
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}

                                {order.items.filter(i => i.status !== 'SERVED' && i.status !== 'CANCELLED').length === 0 && (
                                    <div className="text-center text-gray-500 py-4 italic">
                                        Todos los items servidos
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default KitchenDisplay;
