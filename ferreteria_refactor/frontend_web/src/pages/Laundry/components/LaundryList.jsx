import React from 'react';
import { Package, CheckCircle, Clock, AlertTriangle, User } from 'lucide-react';

const LaundryList = ({ orders, onSelectOrder }) => {

    const getStatusBadge = (status) => {
        const styles = {
            RECEIVED: 'bg-gray-100 text-gray-800',
            IN_PROGRESS: 'bg-blue-100 text-blue-800',
            READY: 'bg-green-100 text-green-800',
            DELIVERED: 'bg-teal-100 text-teal-800',
            CANCELLED: 'bg-red-100 text-red-800'
        };
        const label = {
            RECEIVED: 'Recibido',
            IN_PROGRESS: 'Procesando',
            READY: 'Listo',
            DELIVERED: 'Entregado',
            CANCELLED: 'Cancelado'
        }[status] || status;

        return (
            <span className={`px-2 py-1 rounded-full text-xs font-bold ${styles[status] || 'bg-gray-100'}`}>
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
                        <th className="px-4 py-3">Detalle (Peso/Pzas)</th>
                        <th className="px-4 py-3">Tipo Servicio</th>
                        <th className="px-4 py-3">Identificador</th>

                        <th className="px-4 py-3">Estado</th>
                        <th className="px-4 py-3 text-right">Fecha</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {orders.map(order => {
                        const meta = order.order_metadata || {};
                        return (
                            <tr
                                key={order.id}
                                onClick={() => onSelectOrder(order)}
                                className="hover:bg-blue-50 cursor-pointer transition-colors"
                            >
                                <td className="px-4 py-3 font-bold text-gray-700">
                                    {order.ticket_number}
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
                                            <User size={12} />
                                        </div>
                                        <span className="font-medium text-gray-900">{order.customer?.name}</span>
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex flex-col">
                                        <span className="font-bold text-gray-800">{meta.weight_kg || 0} Kg</span>
                                        <span className="text-xs text-gray-500">{meta.pieces || 0} Pzas</span>
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <span className="font-bold text-indigo-600 text-xs uppercase px-2 py-1 bg-indigo-50 rounded-md border border-indigo-100">
                                        {meta.wash_type || 'General'}
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    {meta.bag_color ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded border bg-white text-xs font-medium text-gray-600">
                                            <Package size={12} /> {meta.bag_color}
                                        </span>
                                    ) : (
                                        <span className="text-gray-400 italic">N/A</span>
                                    )}
                                </td>

                                <td className="px-4 py-3">
                                    {getStatusBadge(order.status)}
                                </td>
                                <td className="px-4 py-3 text-right text-gray-500 text-xs">
                                    {new Date(order.created_at).toLocaleDateString()}
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
