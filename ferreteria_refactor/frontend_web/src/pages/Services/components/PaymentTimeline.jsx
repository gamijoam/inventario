import React, { useState } from 'react';
import { Plus, TrendingUp, DollarSign } from 'lucide-react';
import apiClient from '../../../config/axios';
import { toast } from 'react-hot-toast';

const PaymentTimeline = ({ order, calculations, onAddPayment }) => {
    const [showPaymentForm, setShowPaymentForm] = useState(false);
    const [paymentForm, setPaymentForm] = useState({
        amount: '',
        payment_method: 'CASH',
        reference: '',
    });
    const [submitting, setSubmitting] = useState(false);

    const handlePaymentSubmit = async (e) => {
        e.preventDefault();
        if (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) {
            toast.error('Monto debe ser mayor a 0');
            return;
        }

        setSubmitting(true);
        try {
            await apiClient.post(`/services/orders/${order.id}/payments`, {
                amount: parseFloat(paymentForm.amount),
                payment_method: paymentForm.payment_method,
                reference: paymentForm.reference,
            });
            toast.success('Pago registrado');
            setPaymentForm({ amount: '', payment_method: 'CASH', reference: '' });
            setShowPaymentForm(false);
            onAddPayment?.();
        } catch (err) {
            toast.error('Error al registrar pago');
        } finally {
            setSubmitting(false);
        }
    };

    const paymentStatusColor = {
        paid: 'emerald',
        partial: 'amber',
        unpaid: 'slate',
    };

    const statusColor = paymentStatusColor[calculations.paymentStatus];

    return (
        <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-6">
                <div className="bg-blue-100 text-blue-600 p-2 rounded-lg">
                    <DollarSign size={20} />
                </div>
                <h3 className="font-bold text-slate-900 text-lg">Pagos</h3>
            </div>

            {/* Resumen */}
            <div className="grid grid-cols-3 gap-2 mb-6 p-4 bg-slate-50 rounded-lg">
                <div className="text-center">
                    <p className="text-xs text-slate-600 mb-1">Total</p>
                    <p className="font-bold text-slate-900">${calculations.orderTotal.toFixed(2)}</p>
                </div>
                <div className="text-center border-l border-r border-slate-300">
                    <p className="text-xs text-slate-600 mb-1">Pagado</p>
                    <p className="font-bold text-emerald-600">${calculations.orderPaid.toFixed(2)}</p>
                </div>
                <div className="text-center">
                    <p className="text-xs text-slate-600 mb-1">Pendiente</p>
                    <p className="font-bold text-amber-600">${calculations.orderPending.toFixed(2)}</p>
                </div>
            </div>

            {/* Barra de progreso */}
            {calculations.orderTotal > 0 && (
                <div className="mb-6">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-slate-700">Progreso de pago</span>
                        <span className="text-sm font-bold text-slate-900">{Math.round(calculations.paymentPercentage)}%</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                        <div
                            className={`h-full bg-${statusColor}-500 transition-all duration-300`}
                            style={{ width: `${Math.min(100, calculations.paymentPercentage)}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Status badge */}
            <div className="mb-6 p-3 bg-slate-50 rounded-lg">
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold bg-${statusColor}-100 text-${statusColor}-700`}>
                    {calculations.paymentStatus === 'paid' && '✓ Pagado completo'}
                    {calculations.paymentStatus === 'partial' && '⚠️ Pago parcial'}
                    {calculations.paymentStatus === 'unpaid' && '❌ Sin pagos'}
                </span>
            </div>

            {/* Timeline de pagos */}
            {order.payments && order.payments.length > 0 && (
                <div className="mb-6 space-y-3 max-h-48 overflow-y-auto">
                    {order.payments.map((payment, idx) => (
                        <div key={payment.id || idx} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                            <div className="flex-shrink-0 w-8 h-8 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-sm font-bold">
                                ✓
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                    <p className="font-semibold text-slate-900">${parseFloat(payment.amount).toFixed(2)}</p>
                                    <p className="text-xs text-slate-500">
                                        {new Date(payment.created_at).toLocaleDateString()}
                                    </p>
                                </div>
                                <p className="text-xs text-slate-600">{payment.payment_method}</p>
                                {payment.reference && (
                                    <p className="text-xs text-slate-500 mt-1">Ref: {payment.reference}</p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Formulario de pago */}
            {!showPaymentForm ? (
                <button
                    onClick={() => setShowPaymentForm(true)}
                    className="w-full py-3 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg font-semibold hover:bg-emerald-100 transition-colors flex items-center justify-center gap-2"
                >
                    <Plus size={18} /> Agregar abono
                </button>
            ) : (
                <form onSubmit={handlePaymentSubmit} className="space-y-3 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Monto *</label>
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={paymentForm.amount}
                            onChange={(e) => setPaymentForm(prev => ({ ...prev, amount: e.target.value }))}
                            placeholder="0.00"
                            className="w-full px-3 py-2 border border-emerald-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                            autoFocus
                        />
                        {paymentForm.amount && (
                            <p className="text-xs text-emerald-600 mt-1">
                                Pendiente después: ${Math.max(0, calculations.orderPending - parseFloat(paymentForm.amount)).toFixed(2)}
                            </p>
                        )}
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Método</label>
                        <select
                            value={paymentForm.payment_method}
                            onChange={(e) => setPaymentForm(prev => ({ ...prev, payment_method: e.target.value }))}
                            className="w-full px-3 py-2 border border-emerald-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                        >
                            <option value="CASH">Efectivo</option>
                            <option value="CARD">Tarjeta</option>
                            <option value="TRANSFER">Transferencia</option>
                            <option value="CHECK">Cheque</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Referencia (Opcional)</label>
                        <input
                            type="text"
                            value={paymentForm.reference}
                            onChange={(e) => setPaymentForm(prev => ({ ...prev, reference: e.target.value }))}
                            placeholder="Ej: Cheque #123"
                            className="w-full px-3 py-2 border border-emerald-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                    </div>

                    <div className="flex gap-2">
                        <button
                            type="submit"
                            disabled={submitting}
                            className="flex-1 px-3 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50"
                        >
                            {submitting ? 'Guardando...' : 'Guardar pago'}
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowPaymentForm(false)}
                            className="flex-1 px-3 py-2 bg-slate-200 text-slate-700 rounded-lg font-semibold hover:bg-slate-300 transition-colors"
                        >
                            Cancelar
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
};

export default PaymentTimeline;
