import React, { useState } from 'react';
import { X, Loader2, Calendar } from 'lucide-react';
import { updateTenant } from '../api/tenants';
import toast from 'react-hot-toast';
import type { Tenant } from '../types/tenant';

interface RenewSubscriptionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    tenant: Tenant;
}

const RenewSubscriptionModal: React.FC<RenewSubscriptionModalProps> = ({ isOpen, onClose, onSuccess, tenant }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [planType, setPlanType] = useState('SUB_3'); // SUB_3, SUB_6, SUB_12

    if (!isOpen) return null;

    const handleRenew = async () => {
        setIsLoading(true);
        try {
            // Calculate new expiration date
            // Start from CURRENT expiration date if valid, otherwise from NOW
            const currentExpires = tenant.subscription_expires_at ? new Date(tenant.subscription_expires_at) : new Date();
            const now = new Date();

            // If expired, start from now. If valid, extend.
            let baseDate = currentExpires > now ? currentExpires : now;

            let newExpires = new Date(baseDate);

            switch (planType) {
                case 'SUB_3':
                    newExpires.setMonth(newExpires.getMonth() + 3);
                    break;
                case 'SUB_6':
                    newExpires.setMonth(newExpires.getMonth() + 6);
                    break;
                case 'SUB_12':
                    newExpires.setFullYear(newExpires.getFullYear() + 1);
                    break;
            }

            // Call Update API
            await updateTenant(tenant.id, {
                is_demo: false, // Force upgrade to paid
                subscription_expires_at: newExpires.toISOString()
            });

            toast.success('Suscripción renovada exitosamente');
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error(error);
            toast.error('Error al renovar suscripción');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="text-lg font-semibold text-gray-800">Renovar Suscripción</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-200 rounded-full">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4">
                    <p className="text-sm text-gray-600">
                        Selecciona el nuevo periodo de suscripción para <strong>{tenant.name}</strong>.
                        Se extenderá la vigencia actual y se activará el modo Premium.
                    </p>

                    <div className="space-y-2">
                        <label className={`flex items-center p-3 border rounded-lg cursor-pointer transition-all ${planType === 'SUB_3' ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}>
                            <input type="radio" name="plan" value="SUB_3" checked={planType === 'SUB_3'} onChange={(e) => setPlanType(e.target.value)} className="w-4 h-4 text-blue-600" />
                            <div className="ml-3">
                                <span className="block text-sm font-medium text-gray-900">3 Meses</span>
                                <span className="block text-xs text-gray-500">Plan Trimestral</span>
                            </div>
                        </label>
                        <label className={`flex items-center p-3 border rounded-lg cursor-pointer transition-all ${planType === 'SUB_6' ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}>
                            <input type="radio" name="plan" value="SUB_6" checked={planType === 'SUB_6'} onChange={(e) => setPlanType(e.target.value)} className="w-4 h-4 text-blue-600" />
                            <div className="ml-3">
                                <span className="block text-sm font-medium text-gray-900">6 Meses</span>
                                <span className="block text-xs text-gray-500">Plan Semestral (Ahorras 10%)</span>
                            </div>
                        </label>
                        <label className={`flex items-center p-3 border rounded-lg cursor-pointer transition-all ${planType === 'SUB_12' ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}>
                            <input type="radio" name="plan" value="SUB_12" checked={planType === 'SUB_12'} onChange={(e) => setPlanType(e.target.value)} className="w-4 h-4 text-blue-600" />
                            <div className="ml-3">
                                <span className="block text-sm font-medium text-gray-900">1 Año</span>
                                <span className="block text-xs text-gray-500">Plan Anual (Mejor Valor)</span>
                            </div>
                        </label>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 mt-4">
                        <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
                        <button
                            onClick={handleRenew}
                            disabled={isLoading}
                            className="flex items-center px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                        >
                            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Confimar Renovación
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RenewSubscriptionModal;
