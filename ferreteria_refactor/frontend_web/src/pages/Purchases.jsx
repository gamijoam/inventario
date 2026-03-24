import { useState, useEffect } from 'react';
import { Plus, FileText, DollarSign, Calendar, TrendingUp, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import apiClient from '../config/axios';
import toast from 'react-hot-toast';

const Purchases = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
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

    const handleVoid = async (purchase) => {
        const ref = purchase.invoice_number || `#${purchase.id}`;
        if (!window.confirm(`¿Anular la factura ${ref}? Esto revertirá el stock ingresado y no se puede deshacer.`)) return;
        try {
            const res = await apiClient.delete(`/purchases/${purchase.id}`);
            toast.success(`Factura ${ref} anulada. Se revirtieron ${res.data.reversed_items?.length || 0} productos.`);
            fetchPurchases();
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Error al anular la factura');
        }
    };

    const handleViewDetails = (purchaseId) => {
        navigate(`/purchases/${purchaseId}`);
    };

    return (
        <div className="p-4 md:p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
                <div>
                    <h1 className="text-xl md:text-2xl font-bold text-gray-800">Compras</h1>
                    <p className="text-gray-600 text-sm">Gestión de compras y cuentas por pagar</p>
                </div>
                {['ADMIN', 'WAREHOUSE'].includes(user?.role) && (
                    <button
                        id="tour-purchases-add-btn"
                        onClick={() => navigate('/purchases/new')}
                        className="flex items-center bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow transition-colors text-sm whitespace-nowrap"
                    >
                        <Plus size={18} className="mr-1.5" />
                        Nueva Compra
                    </button>
                )}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2 mb-4">
                {['ALL', 'PENDING', 'PARTIAL', 'PAID'].map(status => (
                    <button
                        key={status}
                        onClick={() => setFilter(status)}
                        className={`px-3 md:px-4 py-2 rounded-lg font-medium transition-colors text-sm ${filter === status
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                    >
                        {status === 'ALL' ? 'Todas' : status === 'PENDING' ? 'Pendientes' : status === 'PARTIAL' ? 'Parciales' : 'Pagadas'}
                    </button>
                ))}
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
                {loading ? (
                    <div className="text-center py-10 text-gray-500">Cargando...</div>
                ) : purchases.length === 0 ? (
                    <div className="text-center py-10 text-gray-500">No hay compras registradas</div>
                ) : (
                    purchases.map(purchase => (
                        <div
                            key={purchase.id}
                            onClick={() => handleViewDetails(purchase.id)}
                            className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm active:bg-slate-50 transition-colors cursor-pointer"
                        >
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex-1 min-w-0 mr-3">
                                    <p className="font-semibold text-slate-800 truncate">{purchase.supplier?.name || 'N/A'}</p>
                                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                                        <Calendar size={12} />
                                        <span>{new Date(purchase.purchase_date).toLocaleDateString()}</span>
                                        {purchase.invoice_number && (
                                            <>
                                                <span className="text-slate-300">•</span>
                                                <span className="flex items-center gap-1"><FileText size={12} />{purchase.invoice_number}</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                                {getStatusBadge(purchase.payment_status)}
                            </div>
                            <div className="flex items-end justify-between border-t border-slate-100 pt-3">
                                <div className="flex gap-6">
                                    <div>
                                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total</p>
                                        <p className="text-base font-bold text-slate-800">${Number(purchase.total_amount || 0).toFixed(2)}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Pagado</p>
                                        <p className="text-base font-semibold text-green-600">${Number(purchase.paid_amount || 0).toFixed(2)}</p>
                                    </div>
                                </div>
                                <span className="text-blue-600 text-xs font-semibold">
                                    {purchase.payment_status === 'PAID' ? 'Ver Detalles →' : 'Ver / Pagar →'}
                                </span>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block bg-white rounded-lg shadow">
                <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                        <tr>
                            <th className="text-left p-4 font-semibold text-gray-700 text-sm">Fecha</th>
                            <th className="text-left p-4 font-semibold text-gray-700 text-sm">Proveedor</th>
                            <th className="text-left p-4 font-semibold text-gray-700 text-sm">Nro. Factura</th>
                            <th className="text-right p-4 font-semibold text-gray-700 text-sm">Total</th>
                            <th className="text-right p-4 font-semibold text-gray-700 text-sm">Pagado</th>
                            <th className="text-center p-4 font-semibold text-gray-700 text-sm">Estado</th>
                            <th className="text-right p-4 font-semibold text-gray-700 text-sm">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {loading ? (
                            <tr>
                                <td colSpan="7" className="text-center p-8 text-gray-500">Cargando...</td>
                            </tr>
                        ) : purchases.length === 0 ? (
                            <tr>
                                <td colSpan="7" className="text-center p-8 text-gray-500">No hay compras registradas</td>
                            </tr>
                        ) : (
                            purchases.map(purchase => (
                                <tr key={purchase.id} className="hover:bg-gray-50">
                                    <td className="p-4 text-sm whitespace-nowrap">{new Date(purchase.purchase_date).toLocaleDateString()}</td>
                                    <td className="p-4 font-medium text-sm">{purchase.supplier?.name || 'N/A'}</td>
                                    <td className="p-4 text-sm">{purchase.invoice_number || '-'}</td>
                                    <td className="p-4 text-right font-bold text-sm">${Number(purchase.total_amount || 0).toFixed(2)}</td>
                                    <td className="p-4 text-right text-green-600 font-medium text-sm">${Number(purchase.paid_amount || 0).toFixed(2)}</td>
                                    <td className="p-4 text-center">{getStatusBadge(purchase.payment_status)}</td>
                                    <td className="p-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => handleViewDetails(purchase.id)}
                                                className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                                            >
                                                {purchase.payment_status === 'PAID' ? 'Ver Detalles' : 'Ver / Pagar'}
                                            </button>
                                            {user?.role === 'ADMIN' && (
                                                <button
                                                    onClick={() => handleVoid(purchase)}
                                                    title="Anular factura"
                                                    className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors"
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            )}
                                        </div>
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
