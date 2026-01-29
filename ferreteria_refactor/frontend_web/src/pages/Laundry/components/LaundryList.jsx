import React from 'react';
import { Package, CheckCircle, Clock, AlertTriangle, User, Trash2, Activity } from 'lucide-react';

const LaundryList = ({ orders, onSelectOrder, onDeleteOrder }) => {

    const getStatusBadge = (status) => {
        const styles = {
            RECEIVED: 'bg-gray-100 text-gray-800 border-gray-200',
            IN_PROGRESS: 'bg-blue-100 text-blue-800 border-blue-200',
            READY: 'bg-green-100 text-green-800 border-green-200',
            DELIVERED: 'bg-teal-100 text-teal-800 border-teal-200',
            CANCELLED: 'bg-red-100 text-red-800 border-red-200'
        };
        const label = {
            RECEIVED: 'Recibido',
            IN_PROGRESS: 'Procesando',
            READY: 'Listo',
            DELIVERED: 'Entregado',
            CANCELLED: 'Cancelado'
        }[status] || status;

        return (
            <span className={`px-2 py-1 rounded-full text-xs font-bold border ${styles[status] || 'bg-gray-100'}`}>
                {label}
            </span>
        );
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-500 font-medium border-b">
                    <tr>
                        <th className="px-4 py-3"># Orden</th>
                        <th className="px-4 py-3">Cliente</th>
                        <th className="px-4 py-3">Servicios</th>
                        <th className="px-4 py-3">Identificador</th>
                        <th className="px-4 py-3">Estado</th>
                        <th className="px-4 py-3 text-right">Fecha</th>
                        <th className="px-4 py-3 text-right">Acciones</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {orders.map(order => {
                        const meta = order.order_metadata || {};
                        return (
                            <tr
                                key={order.id}
                                onClick={() => onSelectOrder(order)}
                                className="hover:bg-blue-50 cursor-pointer transition-colors group"
                            >
                                <td className="px-4 py-3 font-bold text-gray-800 font-mono">
                                    {order.ticket_number}
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
                                            <User size={12} />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="font-medium text-gray-900">{order.customer?.name}</span>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex flex-col">
                                        <span className="font-bold text-gray-800">{meta.total_items || 1} Ítems</span>
                                        <span className="text-xs text-gray-500 truncate max-w-[150px]">
                                            {order.problem_description}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    {meta.bag_color ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded border bg-white text-xs font-medium text-gray-600">
                                            <Package size={12} /> {meta.bag_color}
                                        </span>
                                    ) : (
                                        <span className="text-gray-400 italic text-xs">--</span>
                                    )}
                                    {order.priority === 'URGENT' && (
                                        <span className="ml-2 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-rose-100 text-rose-700 text-[10px] font-bold border border-rose-200 uppercase">
                                            <AlertTriangle size={10} /> Urgente
                                        </span>
                                    )}
                                    {order.priority === 'HIGH' && (
                                        <span className="ml-2 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-orange-100 text-orange-700 text-[10px] font-bold border border-orange-200 uppercase">
                                            <Activity size={10} /> Alta
                                        </span>
                                    )}
                                </td>

                                <td className="px-4 py-3">
                                    {getStatusBadge(order.status)}
                                </td>
                                <td className="px-4 py-3 text-right text-gray-500 text-xs">
                                    {new Date(order.created_at).toLocaleDateString()}
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <button
                                        onClick={(e) => onDeleteOrder(e, order.id)}
                                        className="text-gray-300 hover:text-rose-500 p-1.5 hover:bg-rose-50 rounded transition-colors"
                                        title="Eliminar orden"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </td>
                            </tr>
                        );
                    })}
                    {orders.length === 0 && (
                        <tr>
                            <td colSpan="7" className="px-4 py-8 text-center text-gray-400 italic">
                                No hay órdenes registradas
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
};

export default LaundryList;
