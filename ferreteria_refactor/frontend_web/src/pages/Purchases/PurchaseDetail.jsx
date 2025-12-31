import React, { useState, useEffect } from 'react';
import { useConfig } from '../../context/ConfigContext';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, DollarSign, Calendar, FileText, CreditCard, Package, User, Clock, CheckCircle, AlertCircle, TrendingUp } from 'lucide-react';
import apiClient from '../../config/axios';
import { toast } from 'react-hot-toast';
import clsx from 'clsx';

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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const fetchPurchaseDetails = async () => {
        try {
            const response = await apiClient.get(`/purchases/${id}`);
            setPurchase(response.data);
        } catch (error) {
            console.error('Error fetching purchase:', error);
            toast.error('Error al cargar detalles de la compra');
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
            toast.error('Error al cargar historial de pagos');
        }
    };

    const handlePaymentSuccess = () => {
        setShowPaymentModal(false);
        fetchPurchaseDetails();
        fetchPayments();
        toast.success('Pago registrado correctamente');
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-200 border-t-indigo-600"></div>
            </div>
        );
    }

    if (!purchase) {
        return (
            <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 m-6">
                <AlertCircle className="mx-auto text-slate-400 mb-4" size={48} />
                <h2 className="text-xl font-bold text-slate-800">Compra no encontrada</h2>
                <button
                    onClick={() => navigate('/purchases')}
                    className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all"
                >
                    Volver a Compras
                </button>
            </div>
        );
    }

    const balance = purchase.total_amount - purchase.paid_amount;

    // Improved overdue check - compare dates at midnight
    const isOverdue = purchase.due_date && purchase.payment_status !== 'PAID' && (() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dueDate = new Date(purchase.due_date);
        dueDate.setHours(0, 0, 0, 0);
        return dueDate < today;
    })();

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Navigation */}
            <button
                onClick={() => navigate('/purchases')}
                className="flex items-center text-slate-500 hover:text-indigo-600 font-bold transition-colors group mb-2"
            >
                <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm mr-3 group-hover:border-indigo-200 transition-all">
                    <ArrowLeft size={20} />
                </div>
                Volver a Compras
            </button>

            {/* Header Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 md:p-8">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <h1 className="text-3xl font-black text-slate-800">Compra #{purchase.id}</h1>
                                <span className={clsx(
                                    "px-3 py-1 rounded-lg text-sm font-bold border",
                                    purchase.payment_status === 'PAID'
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                        : purchase.payment_status === 'PARTIAL'
                                            ? 'bg-amber-50 text-amber-700 border-amber-100'
                                            : 'bg-rose-50 text-rose-700 border-rose-100'
                                )}>
                                    {purchase.payment_status === 'PAID' ? 'Pagado' :
                                        purchase.payment_status === 'PARTIAL' ? 'Parcial' : 'Pendiente'}
                                </span>
                            </div>
                            <p className="text-slate-500 font-medium flex items-center gap-2">
                                <FileText size={16} />
                                Ref. Factura: <span className="text-slate-700 font-bold">{purchase.invoice_number || 'Sin número'}</span>
                            </p>
                        </div>

                        {/* Financial Summary */}
                        <div className="flex gap-4">
                            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 text-right min-w-[140px]">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Monto Total</p>
                                <p className="text-2xl font-black text-slate-800">${Number(purchase.total_amount).toFixed(2)}</p>
                            </div>
                            <div className={clsx(
                                "rounded-xl p-4 border text-right min-w-[140px]",
                                balance > 0
                                    ? "bg-rose-50 border-rose-100"
                                    : "bg-emerald-50 border-emerald-100"
                            )}>
                                <p className={clsx(
                                    "text-xs font-bold uppercase tracking-wider mb-1",
                                    balance > 0 ? "text-rose-400" : "text-emerald-400"
                                )}>
                                    {balance > 0 ? "Saldo Pendiente" : "Completado"}
                                </p>
                                <p className={clsx(
                                    "text-2xl font-black",
                                    balance > 0 ? "text-rose-700" : "text-emerald-700"
                                )}>
                                    ${Number(balance).toFixed(2)}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pt-6 border-t border-slate-100">
                        <div className="flex items-start gap-3">
                            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                                <User size={20} />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase">Proveedor</p>
                                <p className="font-bold text-slate-800 text-lg">{purchase.supplier?.name || 'N/A'}</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="p-2 bg-slate-100 text-slate-600 rounded-lg">
                                <Calendar size={20} />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase">Fecha Compra</p>
                                <p className="font-bold text-slate-700">
                                    {new Date(purchase.purchase_date).toLocaleDateString()}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className={clsx(
                                "p-2 rounded-lg",
                                isOverdue ? "bg-rose-100 text-rose-600" : "bg-slate-100 text-slate-600"
                            )}>
                                <Clock size={20} />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase">Vencimiento</p>
                                <p className={clsx("font-bold flex items-center gap-2", isOverdue ? "text-rose-600" : "text-slate-700")}>
                                    {purchase.due_date ? new Date(purchase.due_date).toLocaleDateString() : '-'}
                                    {isOverdue && <span className="px-1.5 py-0.5 bg-rose-200 text-rose-800 text-[10px] rounded font-bold uppercase">Vencida</span>}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3 justify-end md:justify-start">
                            {balance > 0 && (
                                <button
                                    onClick={() => setShowPaymentModal(true)}
                                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 px-4 rounded-xl font-bold shadow-lg shadow-indigo-200 active:scale-95 transition-all flex items-center justify-center gap-2"
                                >
                                    <CreditCard size={18} />
                                    Registrar Pago
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Purchase Items List - Takes 2 cols */}
                <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                    <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <Package className="text-indigo-600" size={20} />
                            Productos Comprados
                        </h3>
                        <span className="text-xs font-bold text-slate-400 uppercase bg-white border border-slate-200 px-2 py-1 rounded-md">
                            {purchase.items?.length || 0} Items
                        </span>
                    </div>
                    <div className="overflow-x-auto custom-scrollbar flex-1">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-50 border-b border-slate-100">
                                <tr>
                                    <th className="p-4 font-bold text-slate-400 uppercase text-xs tracking-wider">Producto</th>
                                    <th className="p-4 font-bold text-slate-400 uppercase text-xs tracking-wider text-center">Cantidad</th>
                                    <th className="p-4 font-bold text-slate-400 uppercase text-xs tracking-wider text-right">Costo Razonable</th>
                                    <th className="p-4 font-bold text-slate-400 uppercase text-xs tracking-wider text-right">Subtotal</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {purchase.items && purchase.items.length > 0 ? (
                                    purchase.items.map((item, index) => (
                                        <tr key={index} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="p-4">
                                                <div className="font-bold text-slate-800">
                                                    {item.product?.name || `Producto #${item.product_id}`}
                                                </div>
                                                {item.product?.sku && (
                                                    <div className="text-xs text-slate-500 font-mono mt-0.5">SKU: {item.product.sku}</div>
                                                )}
                                            </td>
                                            <td className="p-4 text-center">
                                                <span className="bg-slate-100 text-slate-700 py-1 px-3 rounded-lg text-sm font-bold border border-slate-200">
                                                    {item.quantity}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right text-slate-600 font-medium">
                                                ${Number(item.unit_cost).toFixed(2)}
                                            </td>
                                            <td className="p-4 text-right font-bold text-slate-800">
                                                ${(Number(item.quantity) * Number(item.unit_cost)).toFixed(2)}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="4" className="p-12 text-center text-slate-400 italic">
                                            No hay productos registrados en esta compra.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Payment History - Takes 1 col */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
                    <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <TrendingUp className="text-emerald-600" size={20} />
                            Historial de Pagos
                        </h3>
                    </div>
                    <div className="overflow-y-auto custom-scrollbar md:max-h-[500px]">
                        {payments.length === 0 ? (
                            <div className="p-12 text-center flex flex-col items-center">
                                <div className="bg-slate-50 p-4 rounded-full mb-3">
                                    <DollarSign className="text-slate-300" size={32} />
                                </div>
                                <p className="text-slate-400 font-medium">No hay pagos registrados</p>
                            </div>
                        ) : (
                            <div className="flex flex-col">
                                {payments.map(payment => (
                                    <div key={payment.id} className="p-4 border-b border-slate-50 hover:bg-slate-50 transition-colors last:border-0 relative group">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                                                    <DollarSign size={16} />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-700 text-sm">{payment.payment_method}</p>
                                                    <p className="text-xs text-slate-400">{new Date(payment.payment_date).toLocaleDateString()}</p>
                                                </div>
                                            </div>
                                            <p className="font-bold text-emerald-600 text-lg">
                                                +${Number(payment.amount).toFixed(2)}
                                            </p>
                                        </div>
                                        {payment.reference && (
                                            <div className="text-xs bg-slate-50 p-2 rounded border border-slate-100 text-slate-500 font-mono ml-10">
                                                Ref: {payment.reference}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="p-4 border-t border-slate-100 bg-slate-50 text-center text-xs text-slate-400 font-medium">
                        Pagado: ${Number(purchase.paid_amount || 0).toFixed(2)} / Total: ${Number(purchase.total_amount).toFixed(2)}
                    </div>
                </div>
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
    const { paymentMethods } = useConfig();
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
            toast.error(`El monto debe estar entre $0.01 y $${balance.toFixed(2)}`);
            return;
        }

        setLoading(true);
        try {
            await apiClient.post(`/purchases/${purchase.id}/payment`, formData);
            onSuccess();
        } catch (error) {
            console.error('Error registering payment:', error);
            toast.error(error.response?.data?.detail || 'Error al registrar pago');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-bold text-slate-800">Registrar Pago</h3>
                        <p className="text-sm text-slate-500 font-medium">
                            Compra #{purchase.id}
                        </p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 text-center">
                        <span className="text-slate-500 text-xs font-bold uppercase tracking-wider block mb-1">Saldo Pendiente</span>
                        <span className="font-black text-indigo-700 text-3xl tracking-tight">${balance.toFixed(2)}</span>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">
                                Monto a Abonar <span className="text-rose-500">*</span>
                            </label>
                            <div className="relative">
                                <span className="absolute left-4 top-3 text-slate-400 font-bold">$</span>
                                <input
                                    type="number"
                                    value={formData.amount}
                                    onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                                    className="w-full pl-8 p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-lg font-bold text-slate-800 transition-all placeholder:text-slate-300"
                                    step="0.01"
                                    min="0.01"
                                    max={balance}
                                    required
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">
                                Método de Pago <span className="text-rose-500">*</span>
                            </label>
                            <div className="relative">
                                <select
                                    value={formData.payment_method}
                                    onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                                    className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none appearance-none font-medium text-slate-700 transition-all cursor-pointer"
                                    required
                                >
                                    <option value="">Seleccione un método</option>
                                    {paymentMethods.filter(pm => pm.is_active).map(pm => (
                                        <option key={pm.id} value={pm.name}>{pm.name}</option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-3 top-3.5 text-slate-400 pointer-events-none" size={16} />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">
                                Referencia
                            </label>
                            <input
                                type="text"
                                value={formData.reference}
                                onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                                className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400"
                                placeholder="Ej: TRF-12345"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">
                                Notas
                            </label>
                            <textarea
                                value={formData.notes}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none resize-none transition-all placeholder:text-slate-400 bg-slate-50 focus:bg-white"
                                rows="2"
                                placeholder="Observaciones..."
                            />
                        </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-3 border border-slate-300 rounded-xl hover:bg-slate-50 font-bold text-slate-700 transition-all active:scale-95"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-200 active:scale-95 disabled:opacity-50 disabled:shadow-none"
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
