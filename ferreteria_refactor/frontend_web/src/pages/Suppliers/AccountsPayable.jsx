import { useState, useEffect } from 'react';
import { useConfig } from '../../context/ConfigContext'; // NEW
import { DollarSign, AlertTriangle, FileText, CreditCard, ArrowLeft, TrendingDown, Eye } from 'lucide-react';
import apiClient from '../../config/axios';
import PurchaseItemsModal from '../../components/purchases/PurchaseItemsModal';

const AccountsPayable = () => {
    const [suppliers, setSuppliers] = useState([]);
    const [selectedSupplier, setSelectedSupplier] = useState(null);
    const [supplierPurchases, setSupplierPurchases] = useState([]);
    const [selectedPurchase, setSelectedPurchase] = useState(null);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [showItemsModal, setShowItemsModal] = useState(false); // NEW
    const [loading, setLoading] = useState(true);

    // Summary stats
    const [totalDebt, setTotalDebt] = useState(0);
    const [overdueInvoices, setOverdueInvoices] = useState(0);

    useEffect(() => {
        fetchSuppliersWithDebt();
    }, []);

    const fetchSuppliersWithDebt = async () => {
        try {
            const response = await apiClient.get('/suppliers');
            const suppliersWithDebt = response.data.filter(s => s.current_balance > 0);
            setSuppliers(suppliersWithDebt);

            // Calculate totals
            const total = suppliersWithDebt.reduce((sum, s) => sum + Number(s.current_balance || 0), 0);
            setTotalDebt(total);

            // Get overdue count with improved date comparison
            const pendingRes = await apiClient.get('/purchases/pending');
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const overdue = pendingRes.data.filter(p => {
                if (!p.due_date || p.payment_status === 'PAID') return false;
                const dueDate = new Date(p.due_date);
                dueDate.setHours(0, 0, 0, 0);
                return dueDate < today;
            });
            setOverdueInvoices(overdue.length);
        } catch (error) {
            console.error('Error fetching suppliers:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchSupplierPurchases = async (supplierId) => {
        try {
            const response = await apiClient.get(`/suppliers/${supplierId}/purchases?status=PENDING,PARTIAL`);
            setSupplierPurchases(response.data);
        } catch (error) {
            console.error('Error fetching purchases:', error);
        }
    };

    const handleSupplierClick = (supplier) => {
        setSelectedSupplier(supplier);
        fetchSupplierPurchases(supplier.id);
    };

    const handleBackToList = () => {
        setSelectedSupplier(null);
        setSupplierPurchases([]);
    };

    const handleRegisterPayment = (purchase) => {
        setSelectedPurchase(purchase);
        setShowPaymentModal(true);
    };

    // NEW: Handle view items
    const handleViewItems = (purchase) => {
        setSelectedPurchase(purchase);
        setShowItemsModal(true);
    };

    const handlePaymentSuccess = () => {
        setShowPaymentModal(false);
        setSelectedPurchase(null);
        fetchSuppliersWithDebt();
        if (selectedSupplier) {
            fetchSupplierPurchases(selectedSupplier.id);
        }
    };

    if (loading) {
        return <div className="p-6">Cargando...</div>;
    }

    // Main view - Summary
    if (!selectedSupplier) {
        return (
            <div className="p-6">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-800">Cuentas por Pagar</h1>
                    <p className="text-gray-600">Gestión de deudas con proveedores</p>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-gradient-to-br from-red-500 to-red-600 text-white rounded-lg shadow-lg p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-red-100 text-sm font-medium">Deuda Total</p>
                                <p className="text-4xl font-bold mt-2">${Number(totalDebt || 0).toFixed(2)}</p>
                            </div>
                            <DollarSign size={48} className="opacity-30" />
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-lg shadow-lg p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-orange-100 text-sm font-medium">Facturas Vencidas</p>
                                <p className="text-4xl font-bold mt-2">{overdueInvoices}</p>
                            </div>
                            <AlertTriangle size={48} className="opacity-30" />
                        </div>
                    </div>
                </div>

                {/* Suppliers Table */}
                <div className="bg-white rounded-lg shadow">
                    <div className="p-4 border-b">
                        <h2 className="text-lg font-bold text-gray-800">Proveedores con Deuda</h2>
                    </div>
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="text-left p-4 font-semibold text-gray-700">Proveedor</th>
                                <th className="text-left p-4 font-semibold text-gray-700">Contacto</th>
                                <th className="text-right p-4 font-semibold text-gray-700">Deuda Actual</th>
                                <th className="text-right p-4 font-semibold text-gray-700">Límite Crédito</th>
                                <th className="text-right p-4 font-semibold text-gray-700">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {suppliers.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="text-center p-8 text-gray-500">
                                        ✅ No hay deudas pendientes
                                    </td>
                                </tr>
                            ) : (
                                suppliers.map(supplier => (
                                    <tr key={supplier.id} className="hover:bg-gray-50">
                                        <td className="p-4 font-medium">{supplier.name}</td>
                                        <td className="p-4 text-gray-600">{supplier.phone || '-'}</td>
                                        <td className="p-4 text-right">
                                            <span className="text-red-600 font-bold text-lg">
                                                ${Number(supplier.current_balance || 0).toFixed(2)}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right text-gray-600">
                                            {supplier.credit_limit ? `$${Number(supplier.credit_limit).toFixed(2)}` : '-'}
                                        </td>
                                        <td className="p-4 text-right">
                                            <button
                                                onClick={() => handleSupplierClick(supplier)}
                                                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                                            >
                                                Ver Facturas
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
    }

    // Detail view - Supplier Invoices
    return (
        <div className="p-6">
            <button
                onClick={handleBackToList}
                className="flex items-center text-blue-600 hover:text-blue-800 mb-4 font-medium"
            >
                <ArrowLeft size={20} className="mr-2" />
                Volver a la lista
            </button>

            <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h2 className="text-2xl font-bold text-gray-800">{selectedSupplier.name}</h2>
                <div className="mt-4 grid grid-cols-3 gap-4">
                    <div>
                        <p className="text-sm text-gray-600">Deuda Actual</p>
                        <p className="text-2xl font-bold text-red-600">
                            ${Number(selectedSupplier.current_balance || 0).toFixed(2)}
                        </p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-600">Términos de Pago</p>
                        <p className="text-xl font-medium">{selectedSupplier.payment_terms || 0} días</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-600">Límite de Crédito</p>
                        <p className="text-xl font-medium">
                            {selectedSupplier.credit_limit ? `$${Number(selectedSupplier.credit_limit).toFixed(2)}` : 'Sin límite'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Invoices Table */}
            <div className="bg-white rounded-lg shadow">
                <div className="p-4 border-b">
                    <h3 className="text-lg font-bold text-gray-800">Facturas Pendientes</h3>
                </div>
                <table className="w-full">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="text-left p-4 font-semibold text-gray-700">Nro. Factura</th>
                            <th className="text-left p-4 font-semibold text-gray-700">Fecha</th>
                            <th className="text-left p-4 font-semibold text-gray-700">Vencimiento</th>
                            <th className="text-right p-4 font-semibold text-gray-700">Total</th>
                            <th className="text-right p-4 font-semibold text-gray-700">Pagado</th>
                            <th className="text-right p-4 font-semibold text-gray-700">Saldo</th>
                            <th className="text-center p-4 font-semibold text-gray-700">Estado</th>
                            <th className="text-right p-4 font-semibold text-gray-700">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {supplierPurchases.length === 0 ? (
                            <tr>
                                <td colSpan="8" className="text-center p-8 text-gray-500">
                                    No hay facturas pendientes
                                </td>
                            </tr>
                        ) : (
                            supplierPurchases.map(purchase => {
                                const balance = Number(purchase.total_amount || 0) - Number(purchase.paid_amount || 0);

                                // Improved overdue check - compare dates at midnight
                                const isOverdue = purchase.due_date && purchase.payment_status !== 'PAID' && (() => {
                                    const today = new Date();
                                    today.setHours(0, 0, 0, 0);
                                    const dueDate = new Date(purchase.due_date);
                                    dueDate.setHours(0, 0, 0, 0);
                                    return dueDate < today;
                                })();

                                return (
                                    <tr key={purchase.id} className={`hover:bg-gray-50 ${isOverdue ? 'bg-red-50' : ''}`}>
                                        <td className="p-4 font-medium">{purchase.invoice_number || `#${purchase.id}`}</td>
                                        <td className="p-4">{new Date(purchase.purchase_date).toLocaleDateString()}</td>
                                        <td className="p-4">
                                            {purchase.due_date ? (
                                                <span className={isOverdue ? 'text-red-600 font-medium' : ''}>
                                                    {new Date(purchase.due_date).toLocaleDateString()}
                                                    {isOverdue && ' ⚠️'}
                                                </span>
                                            ) : '-'}
                                        </td>
                                        <td className="p-4 text-right font-bold">${Number(purchase.total_amount).toFixed(2)}</td>
                                        <td className="p-4 text-right text-green-600">${Number(purchase.paid_amount).toFixed(2)}</td>
                                        <td className="p-4 text-right">
                                            <span className="text-red-600 font-bold">${Number(balance).toFixed(2)}</span>
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${purchase.payment_status === 'PENDING'
                                                ? 'bg-red-100 text-red-700'
                                                : 'bg-yellow-100 text-yellow-700'
                                                }`}>
                                                {purchase.payment_status === 'PENDING' ? 'Pendiente' : 'Parcial'}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => handleViewItems(purchase)}
                                                className="bg-blue-100 hover:bg-blue-200 text-blue-700 p-2 rounded-lg transition-colors"
                                                title="Ver Productos"
                                            >
                                                <Eye size={20} />
                                            </button>
                                            <button
                                                onClick={() => handleRegisterPayment(purchase)}
                                                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                                            >
                                                Registrar Pago
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Payment Modal */}
            {showPaymentModal && selectedPurchase && (
                <PaymentModal
                    purchase={selectedPurchase}
                    onClose={() => setShowPaymentModal(false)}
                    onSuccess={handlePaymentSuccess}
                />
            )}

            {/* NEW: Purchase Items Modal */}
            <PurchaseItemsModal
                isOpen={showItemsModal}
                onClose={() => setShowItemsModal(false)}
                purchaseId={selectedPurchase?.id}
            />
        </div>
    );
};

// Payment Modal Component
const PaymentModal = ({ purchase, onClose, onSuccess }) => {
    const { paymentMethods } = useConfig(); // NEW
    const balance = Number(purchase.total_amount || 0) - Number(purchase.paid_amount || 0);
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
            alert(`El monto debe estar entre $0.01 y $${Number(balance).toFixed(2)}`);
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
                        Factura: {purchase.invoice_number || `#${purchase.id}`}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="bg-blue-50 p-4 rounded-lg">
                        <div className="flex justify-between mb-2">
                            <span className="text-gray-700">Total Factura:</span>
                            <span className="font-bold">${Number(purchase.total_amount || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between mb-2">
                            <span className="text-gray-700">Pagado:</span>
                            <span className="text-green-600 font-medium">${Number(purchase.paid_amount || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between pt-2 border-t border-blue-200">
                            <span className="font-bold text-gray-800">Saldo Pendiente:</span>
                            <span className="font-bold text-red-600 text-lg">${Number(balance).toFixed(2)}</span>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Monto a Abonar *
                        </label>
                        <input
                            type="number"
                            value={formData.amount}
                            onChange={(e) => setFormData({ ...formData, amount: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-lg font-bold"
                            step="0.01"
                            min="0.01"
                            max={balance}
                            required
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Puede ser pago total o parcial
                        </p>
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
                            placeholder="Observaciones adicionales..."
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
                            className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center"
                        >
                            {loading ? 'Procesando...' : (
                                <>
                                    <CreditCard className="mr-2" size={18} />
                                    Registrar Pago
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AccountsPayable;
