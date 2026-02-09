import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { X, Loader2, DollarSign, Calendar } from 'lucide-react';
import { billingApi } from '../api/billing';
import { updateTenant } from '../api/tenants';
import type { CreatePaymentDTO } from '../types/billing';
import toast from 'react-hot-toast';

interface RegisterPaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    tenantId: number;
    currentExpiration: string | null;
}

const RegisterPaymentModal: React.FC<RegisterPaymentModalProps> = ({ isOpen, onClose, onSuccess, tenantId, currentExpiration }) => {
    const [isLoading, setIsLoading] = useState(false);
    const { register, handleSubmit, formState: { errors } } = useForm<CreatePaymentDTO>();

    // Auto-Extend Logic
    const [autoExtend, setAutoExtend] = useState(false);
    const [monthsToAdd, setMonthsToAdd] = useState(1);

    if (!isOpen) return null;

    const onSubmit = async (data: CreatePaymentDTO) => {
        setIsLoading(true);
        try {
            // 1. Create Payment
            await billingApi.createPayment({
                ...data,
                tenant_id: tenantId,
                status: 'completed' // Assuming manual entry is completed
            });

            // 2. Extend Subscription (Optional)
            if (autoExtend) {
                const now = new Date();
                const baseDate = currentExpiration ? new Date(currentExpiration) : now;

                // If expired, start from now. If active, add to existing.
                // Logic: If baseDate < now, use now. Else use baseDate.
                const startDate = baseDate < now ? now : baseDate;

                const newExpiration = new Date(startDate);
                newExpiration.setMonth(newExpiration.getMonth() + monthsToAdd);

                await updateTenant(tenantId, {
                    subscription_expires_at: newExpiration.toISOString(),
                    is_demo: false // Switch to premium if paying
                });
                toast.success('Pago registrado y suscripción extendida');
            } else {
                toast.success('Pago registrado exitosamente');
            }

            onSuccess();
            onClose();
        } catch (error: any) {
            console.error(error);
            toast.error('Error al registrar pago');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">

                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-green-600" />
                        Registrar Pago
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-200 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">

                    {/* Amount & Currency */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Monto</label>
                            <input
                                type="number"
                                step="0.01"
                                {...register('amount', { required: 'Requerido', min: 0.01 })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="0.00"
                            />
                            {errors.amount && <span className="text-xs text-red-500">{errors.amount.message}</span>}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Moneda</label>
                            <select {...register('currency')} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                                <option value="USD">USD ($)</option>
                                <option value="VES">VES (Bs)</option>
                            </select>
                        </div>
                    </div>

                    {/* Method & Reference */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Método</label>
                            <select {...register('payment_method')} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                                <option value="zelle">Zelle</option>
                                <option value="transfer">Transferencia</option>
                                <option value="cash">Efectivo</option>
                                <option value="stripe">Stripe</option>
                                <option value="other">Otro</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Referencia</label>
                            <input
                                {...register('reference', { required: 'Requerido' })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="#123456"
                            />
                            {errors.reference && <span className="text-xs text-red-500">{errors.reference.message}</span>}
                        </div>
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Notas (Opcional)</label>
                        <textarea
                            {...register('notes')}
                            rows={2}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                            placeholder="Detalles adicionales..."
                        />
                    </div>

                    {/* Auto-Extend Section */}
                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                        <label className="flex items-center cursor-pointer mb-2">
                            <input
                                type="checkbox"
                                checked={autoExtend}
                                onChange={(e) => setAutoExtend(e.target.checked)}
                                className="w-4 h-4 text-blue-600 rounded"
                            />
                            <span className="ml-2 text-sm font-medium text-gray-800 flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                ¿Extender Suscripción?
                            </span>
                        </label>

                        {autoExtend && (
                            <div className="pl-6 animate-in fade-in slide-in-from-top-2 duration-200">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-gray-600">Sumar</span>
                                    <input
                                        type="number"
                                        min="1"
                                        max="120"
                                        value={monthsToAdd}
                                        onChange={(e) => setMonthsToAdd(parseInt(e.target.value) || 1)}
                                        className="w-20 px-2 py-1 border border-gray-300 rounded text-center"
                                    />
                                    <span className="text-sm text-gray-600">meses</span>
                                </div>
                                <p className="text-xs text-blue-600 mt-1">
                                    Se sumarán a la fecha actual o de vencimiento (lo que sea mayor).
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Guardar Pago
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
};

export default RegisterPaymentModal;
