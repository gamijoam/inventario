import { useState, useEffect } from 'react';
import { X, Search, Wrench, Calendar, User, Smartphone, CheckCircle } from 'lucide-react';
import apiClient from '../../config/axios';
import { toast } from 'react-hot-toast';

const ServiceImportModal = ({ isOpen, onClose, onSelect }) => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (isOpen) {
            fetchReadyOrders();
            setSearchTerm('');
        }
    }, [isOpen]);

    const fetchReadyOrders = async () => {
        setLoading(true);
        try {
            const { data } = await apiClient.get('/services/orders/status/ready');
            setOrders(data);
        } catch (error) {
            console.error("Error fetching ready orders:", error);
            toast.error("Error al cargar órdenes de servicio");
            // Mock data for dev if API fails? No, better show error.
        } finally {
            setLoading(false);
        }
    };

    const filteredOrders = orders.filter(order =>
        order.ticket_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customer?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.serial_imei?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col h-[600px] animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="bg-indigo-600 p-4 text-white flex justify-between items-center shadow-lg">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/20 rounded-lg">
                            <Wrench size={20} className="text-white" />
                        </div>
                        <div>
                            <h3 className="font-bold text-lg">Cargar Orden de Servicio</h3>
                            <p className="text-indigo-100 text-xs">Seleccione una orden lista para entregar</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Search */}
                <div className="p-4 border-b border-slate-100 bg-slate-50">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar por Ticket, Cliente o Serial..."
                            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            autoFocus
                        />
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50 custom-scrollbar">
                    {loading ? (
                        <div className="flex justify-center items-center h-40">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                        </div>
                    ) : filteredOrders.length > 0 ? (
                        filteredOrders.map(order => (
                            <div
                                key={order.id}
                                onClick={() => onSelect(order)}
                                className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-300 cursor-pointer transition-all group relative overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 p-2 bg-emerald-50 text-emerald-600 rounded-bl-xl border-b border-l border-emerald-100/50">
                                    <span className="text-xs font-bold uppercase flex items-center gap-1">
                                        <CheckCircle size={12} /> Listo
                                    </span>
                                </div>

                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <span className="font-mono text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded inline-block mb-2">
                                            {order.ticket_number}
                                        </span>
                                        <h4 className="font-bold text-slate-800 text-lg group-hover:text-indigo-600 transition-colors">
                                            {order.customer?.name || "Cliente General"}
                                        </h4>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 text-sm text-slate-500">
                                    <div className="flex items-center gap-2">
                                        <Smartphone size={14} className="text-slate-400" />
                                        <span>{order.device_type} {order.brand} - {order.model}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Calendar size={14} className="text-slate-400" />
                                        <span>{new Date(order.created_at).toLocaleDateString()}</span>
                                    </div>
                                </div>

                                {order.details && (
                                    <div className="mt-3 pt-3 border-t border-slate-50">
                                        <p className="text-xs text-slate-400 font-medium uppercase mb-1">Items ({order.details.length})</p>
                                        <div className="flex flex-wrap gap-1">
                                            {order.details.map((item, idx) => (
                                                <span key={idx} className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-600 truncate max-w-[150px]">
                                                    {item.description || item.product?.name || "Item"}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-12 text-slate-400">
                            <Wrench size={48} className="mx-auto mb-4 opacity-20" />
                            <p>No se encontraron órdenes listas.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ServiceImportModal;
