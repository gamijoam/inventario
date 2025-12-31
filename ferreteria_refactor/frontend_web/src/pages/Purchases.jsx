import { useState, useEffect } from 'react';
import { Plus, FileText, DollarSign, Calendar, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../config/axios';

const Purchases = () => {
    const navigate = useNavigate();
    const [purchases, setPurchases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('ALL'); // ALL, PENDING, PARTIAL, PAID

    useEffect(() => {
        fetchPurchases();
    }, [filter]);

    const fetchPurchases = async () => {
        try {
            let endpoint = '/purchases';
            if (filter !== 'ALL') {
                endpoint = `/purchases?status=${filter}`;
            }
            const response = await apiClient.get(endpoint);
            setPurchases(response.data);
        } catch (error) {
            console.error('Error fetching purchases:', error);
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (status) => {
        const styles = {
            PENDING: 'bg-red-100 text-red-700',
            PARTIAL: 'bg-yellow-100 text-yellow-700',
            PAID: 'bg-green-100 text-green-700'
        };
        const labels = {
            PENDING: 'Pendiente',
            PARTIAL: 'Parcial',
            PAID: 'Pagado'
        };
        return (
            <span className={`px-2 py-1 rounded text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-700'}`}>
                {labels[status] || status}
            </span>
        );
    };

    const handleViewDetails = (purchaseId) => {
        navigate(`/purchases/${purchaseId}`);
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Compras</h1>
                    <p className="text-gray-600">Gestión de compras y cuentas por pagar</p>
                </div>
                <button
                    onClick={() => navigate('/purchases/new')}
                    className="flex items-center bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow transition-colors"
                >
                    <Plus size={20} className="mr-2" />
                    Nueva Compra
                </button>
            </div>

            {/* Filters */}
            <div className="flex gap-2 mb-4">
                {['ALL', 'PENDING', 'PARTIAL', 'PAID'].map(status => (
                    <button
                        key={status}
                        onClick={() => setFilter(status)}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${filter === status
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                    >
                        {status === 'ALL' ? 'Todas' : status === 'PENDING' ? 'Pendientes' : status === 'PARTIAL' ? 'Parciales' : 'Pagadas'}
                    </button>
                ))}
            </div>

            {/* Purchases Table */}
            <div className="bg-white rounded-lg shadow">
                <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                        <tr>
                            <th className="text-left p-4 font-semibold text-gray-700">Fecha</th>
                            <th className="text-left p-4 font-semibold text-gray-700">Proveedor</th>
                            <th className="text-left p-4 font-semibold text-gray-700">Nro. Factura</th>
                            <th className="text-right p-4 font-semibold text-gray-700">Total</th>
                            <th className="text-right p-4 font-semibold text-gray-700">Pagado</th>
                            <th className="text-center p-4 font-semibold text-gray-700">Estado</th>
                            <th className="text-right p-4 font-semibold text-gray-700">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {loading ? (
                            <tr>
                                <td colSpan="7" className="text-center p-8 text-gray-500">
                                    Cargando...
                                </td>
                            </tr>
                        ) : purchases.length === 0 ? (
                            <tr>
                                <td colSpan="7" className="text-center p-8 text-gray-500">
                                    No hay compras registradas
                                </td>
                            </tr>
                        ) : (
                            purchases.map(purchase => (
                                <tr key={purchase.id} className="hover:bg-gray-50">
                                    <td className="p-4">
                                        {new Date(purchase.purchase_date).toLocaleDateString()}
                                    </td>
                                    <td className="p-4 font-medium">{purchase.supplier?.name || 'N/A'}</td>
                                    <td className="p-4">{purchase.invoice_number || '-'}</td>
                                    <td className="p-4 text-right font-bold">
                                        ${Number(purchase.total_amount || 0).toFixed(2)}
                                    </td>
                                    <td className="p-4 text-right text-green-600 font-medium">
                                        ${Number(purchase.paid_amount || 0).toFixed(2)}
                                    </td>
                                    <td className="p-4 text-center">
                                        {getStatusBadge(purchase.payment_status)}
                                    </td>
                                    <td className="p-4 text-right">
                                        <button
                                            onClick={() => handleViewDetails(purchase.id)}
                                            className="text-blue-600 hover:text-blue-800 font-medium"
                                        >
                                            {purchase.payment_status === 'PAID' ? 'Ver Detalles' : 'Ver / Pagar'}
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Purchases;
