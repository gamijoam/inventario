import { useState, useEffect } from 'react';
import { useConfig } from '../../context/ConfigContext'; // NEW
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, DollarSign, Calendar, FileText, CreditCard, Package } from 'lucide-react';
import apiClient from '../../config/axios';

const PurchaseDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [purchase, setPurchase] = useState(null);
    const [payments, setPayments] = useState([]);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchPurchaseDetails();
        fetchPayments();
    }, [id]);

    const fetchPurchaseDetails = async () => {
        try {
            const response = await apiClient.get(`/purchases/${id}`);
            setPurchase(response.data);
        } catch (error) {
            console.error('Error fetching purchase:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchPayments = async () => {
        try {
            const response = await apiClient.get(`/purchases/${id}/payments`);
            setPayments(response.data);
        } catch (error) {
            console.error('Error fetching payments:', error);
        }
    };

    const handlePaymentSuccess = () => {
        setShowPaymentModal(false);
        fetchPurchaseDetails();
        fetchPayments();
    };

    if (loading) {
        return <div className="p-6">Cargando...</div>;
    }

    if (!purchase) {
        return <div className="p-6">Compra no encontrada</div>;
    }

    const balance = purchase.total_amount - purchase.paid_amount;

    // Improved overdue check - compare dates at midnight
    const isOverdue = purchase.due_date && purchase.payment_status !== 'PAID' && (() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dueDate = new Date(purchase.due_date);
        dueDate.setHours(0, 0, 0, 0);

        // Debug logging
        console.log('=== OVERDUE CHECK ===');
        console.log('Due Date (original):', purchase.due_date);
        console.log('Due Date (midnight):', dueDate.toISOString());
        console.log('Today (midnight):', today.toISOString());
        console.log('Payment Status:', purchase.payment_status);
        console.log('Is Overdue:', dueDate < today);
        console.log('====================');

        return dueDate < today;
    })();

    return (
        <div className="p-6">
            <button
                onClick={() => navigate('/purchases')}
                className="flex items-center text-blue-600 hover:text-blue-800 mb-4 font-medium"
            >
                <ArrowLeft size={20} className="mr-2" />
                Volver a Compras
            </button>

            {/* Header */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">
                            Compra #{purchase.id}
                        </h1>
                        <p className="text-gray-600 mt-1">
                            {purchase.invoice_number || 'Sin número de factura'}
                        </p>
                    </div>
                    <div className="text-right">
                        <span className={`px-3 py-1 rounded text-sm font-medium ${purchase.payment_status === 'PAID'
                            ? 'bg-green-100 text-green-700'
                            : purchase.payment_status === 'PARTIAL'
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-red-100 text-red-700'
                            }`}>
                            {purchase.payment_status === 'PAID' ? 'Pagado' :
                                purchase.payment_status === 'PARTIAL' ? 'Parcial' : 'Pendiente'}
                        </span>
                    </div>
                </div>

                <div className="grid grid-cols-4 gap-4 mt-6">
                    <div>
                        <p className="text-sm text-gray-600">Proveedor</p>
                        <p className="font-medium">{purchase.supplier?.name || 'N/A'}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-600">Fecha de Compra</p>
                        <p className="font-medium">
                            {new Date(purchase.purchase_date).toLocaleDateString()}
                        </p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-600">Vencimiento</p>
                        <p className={`font-medium ${isOverdue ? 'text-red-600' : ''}`}>
                            {purchase.due_date ? new Date(purchase.due_date).toLocaleDateString() : '-'}
                            {isOverdue && ' ⚠️'}
                        </p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-600">Total</p>
                        <p className="font-bold text-lg">${Number(purchase.total_amount).toFixed(2)}</p>
                    </div>
                </div>
            </div>

            {/* NEW: Purchase Items List */}
            <div className="bg-white rounded-lg shadow mb-6">
                <div className="p-4 border-b bg-gray-50 flex items-center">
                    <Package className="mr-2 text-gray-500" size={20} />
                    <h3 className="text-lg font-bold text-gray-800">Productos Comprados</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="p-4 font-semibold text-gray-600">Producto</th>
                                <th className="p-4 font-semibold text-gray-600 text-center">Cantidad</th>
                                <th className="p-4 font-semibold text-gray-600 text-right">Costo Unit.</th>
                                <th className="p-4 font-semibold text-gray-600 text-right">Subtotal</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {purchase.items && purchase.items.length > 0 ? (
                                purchase.items.map((item, index) => (
                                    <tr key={index} className="hover:bg-gray-50">
                                        <td className="p-4">
                                            <div className="font-medium text-gray-800">
                                                {item.product?.name || `Producto #${item.product_id}`}
                                            </div>
                                            {item.product?.sku && (
                                                <div className="text-xs text-gray-500">SKU: {item.product.sku}</div>
                                            )}
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className="bg-blue-50 text-blue-700 py-1 px-3 rounded-full text-sm font-bold">
                                                {item.quantity}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right text-gray-600">
                                            ${Number(item.unit_cost).toFixed(2)}
                                        </td>
                                        <td className="p-4 text-right font-bold text-gray-800">
                                            ${(Number(item.quantity) * Number(item.unit_cost)).toFixed(2)}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="4" className="p-8 text-center text-gray-500">
                                        No hay productos registrados en esta compra.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Payment Summary */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-blue-50 rounded-lg p-4 border-2 border-blue-200">
                    <p className="text-sm text-blue-700 mb-1">Total Factura</p>
                    <p className="text-2xl font-bold text-blue-800">
                        ${Number(purchase.total_amount).toFixed(2)}
                    </p>
                </div>
                <div className="bg-green-50 rounded-lg p-4 border-2 border-green-200">
                    <p className="text-sm text-green-700 mb-1">Pagado</p>
                    <p className="text-2xl font-bold text-green-800">
                        ${Number(purchase.paid_amount || 0).toFixed(2)}
                    </p>
                </div>
                <div className={`rounded-lg p-4 border-2 ${balance > 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'
                    }`}>
                    <p className={`text-sm mb-1 ${balance > 0 ? 'text-red-700' : 'text-gray-700'}`}>
                        Saldo Pendiente
                    </p>
                    <p className={`text-2xl font-bold ${balance > 0 ? 'text-red-800' : 'text-gray-800'}`}>
                        ${balance.toFixed(2)}
                    </p>
                </div>
            </div>

            {/* Payment Button */}
            {balance > 0 && (
                <div className="mb-6">
                    <button
                        onClick={() => setShowPaymentModal(true)}
                        className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold flex items-center justify-center transition-colors"
                    >
                        <CreditCard className="mr-2" size={20} />
                        Registrar Pago
                    </button>
                </div>
            )}

            {/* Payment History */}
            <div className="bg-white rounded-lg shadow">
                <div className="p-4 border-b">
                    <h3 className="text-lg font-bold text-gray-800">Historial de Pagos</h3>
                </div>
                <table className="w-full">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="text-left p-4 font-semibold text-gray-700">Fecha</th>
                            <th className="text-left p-4 font-semibold text-gray-700">Método</th>
                            <th className="text-left p-4 font-semibold text-gray-700">Referencia</th>
                            <th className="text-right p-4 font-semibold text-gray-700">Monto</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {payments.length === 0 ? (
                            <tr>
                                <td colSpan="4" className="text-center p-8 text-gray-500">
                                    No hay pagos registrados
                                </td>
                            </tr>
                        ) : (
                            payments.map(payment => (
                                <tr key={payment.id} className="hover:bg-gray-50">
                                    <td className="p-4">
                                        {new Date(payment.payment_date).toLocaleDateString()}
                                    </td>
                                    <td className="p-4">{payment.payment_method}</td>
                                    <td className="p-4">{payment.reference || '-'}</td>
                                    <td className="p-4 text-right font-bold text-green-600">
                                        ${Number(payment.amount).toFixed(2)}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Payment Modal */}
            {showPaymentModal && (
                <PaymentModal
                    purchase={purchase}
                    balance={balance}
                    onClose={() => setShowPaymentModal(false)}
                    onSuccess={handlePaymentSuccess}
                />
            )}
        </div>
    );
};

// Payment Modal Component
const PaymentModal = ({ purchase, balance, onClose, onSuccess }) => {
    const { paymentMethods } = useConfig(); // NEW
    const [formData, setFormData] = useState({
        amount: balance,
        payment_method: 'Transferencia',
        reference: '',
        notes: ''
    });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (formData.amount <= 0 || formData.amount > balance) {
            alert(`El monto debe estar entre $0.01 y $${balance.toFixed(2)}`);
            return;
        }

        setLoading(true);
        try {
            await apiClient.post(`/purchases/${purchase.id}/payment`, formData);
            alert('Pago registrado exitosamente');
            onSuccess();
        } catch (error) {
            console.error('Error registering payment:', error);
            alert(error.response?.data?.detail || 'Error al registrar pago');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
                <div className="p-6 border-b">
                    <h3 className="text-xl font-bold text-gray-800">Registrar Pago</h3>
                    <p className="text-sm text-gray-600 mt-1">
                        Compra #{purchase.id}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="bg-blue-50 p-4 rounded-lg">
                        <div className="flex justify-between mb-2">
                            <span className="text-gray-700">Saldo Pendiente:</span>
                            <span className="font-bold text-red-600 text-lg">${balance.toFixed(2)}</span>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Monto a Abonar *
                        </label>
                        <input
                            type="number"
                            value={formData.amount}
                            onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-lg font-bold"
                            step="0.01"
                            min="0.01"
                            max={balance}
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Método de Pago *
                        </label>
                        <select
                            value={formData.payment_method}
                            onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            required
                        >
                            <option value="">Seleccione un método</option>
                            {paymentMethods.filter(pm => pm.is_active).map(pm => (
                                <option key={pm.id} value={pm.name}>{pm.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Referencia / Nro. Comprobante
                        </label>
                        <input
                            type="text"
                            value={formData.reference}
                            onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="Ej: TRF-12345"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Notas
                        </label>
                        <textarea
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                            rows="2"
                            placeholder="Observaciones..."
                        />
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                        >
                            {loading ? 'Procesando...' : 'Registrar Pago'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default PurchaseDetail;
