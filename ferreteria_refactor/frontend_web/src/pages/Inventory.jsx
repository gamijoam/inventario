import { useState, useEffect } from 'react';
import { Archive, ArrowDownCircle, ArrowUpCircle, Filter, Search } from 'lucide-react';
import AdjustmentModal from '../components/inventory/AdjustmentModal';
import apiClient from '../config/axios';

const Inventory = () => {
    const [kardex, setKardex] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');  // NEW: Search state

    // Fetch Kardex
    const fetchKardex = async () => {
        try {
            const response = await apiClient.get('/inventory/kardex');
            setKardex(response.data);
        } catch (error) {
            console.error("Error fetching kardex:", error);
        }
    };

    useEffect(() => {
        fetchKardex();
    }, []);

    const getMovementStyle = (type) => {
        if (['SALE', 'ADJUSTMENT_OUT', 'DAMAGED', 'INTERNAL_USE', 'OUT'].includes(type)) {
            return { color: 'text-red-600', icon: <ArrowDownCircle size={16} className="mr-1" />, bg: 'bg-red-50' };
        }
        return { color: 'text-green-600', icon: <ArrowUpCircle size={16} className="mr-1" />, bg: 'bg-green-50' };
    };

    const getLabel = (type) => {
        const labels = {
            'SALE': 'Venta',
            'PURCHASE': 'Compra',
            'ADJUSTMENT_IN': 'Entrada Ajuste',
            'ADJUSTMENT_OUT': 'Salida Ajuste',
            'DAMAGED': 'Dañado',
            'INTERNAL_USE': 'Uso Interno'
        };
        return labels[type] || type;
    };

    return (
        <div className="container mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center">
                        <Archive className="mr-2" /> Movimientos de Inventario
                    </h1>
                    <p className="text-gray-500">Historial completo de entradas y salidas (Kardex)</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow-sm transition-all font-medium"
                >
                    Nuevo Ajuste Manual
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 mb-6 flex flex-col md:flex-row gap-4">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-2.5 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="Buscar por producto..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <div className="flex flex-col md:flex-row gap-2 md:gap-4 w-full md:w-auto">
                    <div className="flex gap-2 w-full md:w-auto">
                        <input type="date" className="flex-1 w-full md:w-auto border rounded-md px-3 py-2 text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        <span className="self-center text-gray-400">a</span>
                        <input type="date" className="flex-1 w-full md:w-auto border rounded-md px-3 py-2 text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                </div>
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha / Hora</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Producto</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Movimiento</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Cantidad</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Saldo Final</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nota</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {kardex
                                .filter(item => {
                                    if (!searchQuery) return true;
                                    const productName = item.product?.name || '';
                                    return productName.toLowerCase().includes(searchQuery.toLowerCase());
                                })
                                .map(item => {
                                    const style = getMovementStyle(item.movement_type);
                                    return (
                                        <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                {new Date(item.date).toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="font-medium text-gray-900">
                                                    {item.product ? item.product.name : `ID: ${item.product_id}`}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.color}`}>
                                                    {style.icon}
                                                    {getLabel(item.movement_type)}
                                                </span>
                                            </td>
                                            <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-bold ${style.color}`}>
                                                {['SALE', 'ADJUSTMENT_OUT', 'DAMAGED', 'INTERNAL_USE'].includes(item.movement_type) ? '-' : '+'}{item.quantity}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                                                {item.balance_after}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 italic truncate max-w-xs">{item.description}</td>
                                        </tr>
                                    );
                                })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden grid grid-cols-1 gap-4">
                {kardex
                    .filter(item => {
                        if (!searchQuery) return true;
                        const productName = item.product?.name || '';
                        return productName.toLowerCase().includes(searchQuery.toLowerCase());
                    })
                    .map(item => {
                        const style = getMovementStyle(item.movement_type);
                        return (
                            <div key={item.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex flex-col gap-3">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="font-bold text-gray-800 text-sm mb-1">
                                            {item.product ? item.product.name : `ID: ${item.product_id}`}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            {new Date(item.date).toLocaleString()}
                                        </div>
                                    </div>
                                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${style.bg} ${style.color}`}>
                                        {style.icon}
                                        {getLabel(item.movement_type)}
                                    </span>
                                </div>
                                <div className="flex justify-between items-end border-t border-gray-100 pt-2">
                                    <div className="text-xs text-gray-500 italic">
                                        {item.description || "Sin notas"}
                                    </div>
                                    <div className="text-right">
                                        <div className={`text-lg font-bold ${style.color}`}>
                                            {['SALE', 'ADJUSTMENT_OUT', 'DAMAGED', 'INTERNAL_USE'].includes(item.movement_type) ? '-' : '+'}{item.quantity}
                                        </div>
                                        <div className="text-xs text-gray-400 font-medium">
                                            Saldo: {item.balance_after}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
            </div>

            {kardex.length === 0 && (
                <div className="p-10 text-center text-gray-500">
                    No hay movimientos registrados en este periodo.
                </div>
            )}
            {/* End of Card View Wrapper from original code structure */}

            <AdjustmentModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={() => {
                    console.log('Refresh Kardex');
                    fetchKardex();
                }}
            />
        </div>
    );
};

export default Inventory;
