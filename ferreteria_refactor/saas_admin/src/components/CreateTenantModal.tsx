import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { X, Loader2, Plus, Trash2 } from 'lucide-react';
import { createTenant } from '../api/tenants';
import type { CreateTenantDTO } from '../types/tenant';
import toast from 'react-hot-toast';

interface CreateTenantModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const CreateTenantModal: React.FC<CreateTenantModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const [isLoading, setIsLoading] = useState(false);
    const { register, handleSubmit, formState: { errors } } = useForm<CreateTenantDTO>();

    // Subscription Type Logic
    const [planType, setPlanType] = useState(''); // DEMO_15, SUB_3, SUB_6, SUB_12

    // CC emails adicionales (máx 3)
    const [ccEmails, setCcEmails] = useState<string[]>([]);

    if (!isOpen) return null;

    const onSubmit = async (data: any) => {
        setIsLoading(true);
        try {
            if (!planType) {
                toast.error('Debes seleccionar un plan de suscripción');
                setIsLoading(false);
                return;
            }
            // Calculate Subscription Dates based on selected Plan
            let isDemo = true;
            const now = new Date();
            let expiresAt = new Date();

            switch (planType) {
                case 'DEMO_15':
                    isDemo = true;
                    expiresAt.setDate(now.getDate() + 2);
                    break;
                case 'SUB_3':
                    isDemo = false;
                    expiresAt.setMonth(now.getMonth() + 3);
                    break;
                case 'SUB_6':
                    isDemo = false;
                    expiresAt.setMonth(now.getMonth() + 6);
                    break;
                case 'SUB_12':
                    isDemo = false;
                    expiresAt.setFullYear(now.getFullYear() + 1);
                    break;
            }

            const payload: CreateTenantDTO = {
                ...data,
                // Ensure schema name is lowercase/safe
                schema_name: data.schema_name.toLowerCase().replace(/[^a-z0-9]/g, ''),
                is_demo: isDemo,
                subscription_expires_at: expiresAt.toISOString(),
                cc_emails: ccEmails.filter(e => e.trim() !== ''),
            };

            await createTenant(payload);
            toast.success('Empresa creada exitosamente');
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error(error);
            const msg = error.response?.data?.detail || 'Error al crear empresa';
            toast.error(msg);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-200">

                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="text-lg font-semibold text-gray-800">Nueva Empresa</h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-200 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit(onSubmit)} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto flex-1">

                    {/* Left Column: Basic Info */}
                    <div className="space-y-4">
                        <h4 className="font-medium text-gray-900 border-b pb-1">Datos Generales</h4>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Comercial</label>
                            <input
                                {...register('name', { required: 'El nombre es obligatorio' })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                placeholder="Ej: Ferretería El Clavo"
                            />
                            {errors.name && <span className="text-xs text-red-500">{errors.name.message}</span>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Identificador (Schema)</label>
                            <input
                                {...register('schema_name', {
                                    required: 'El identificador es obligatorio',
                                    pattern: {
                                        value: /^[a-z0-9]+$/,
                                        message: 'Solo letras minúsculas y números'
                                    }
                                })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all font-mono text-sm"
                                placeholder="ej: ferreteria01"
                            />
                            <p className="text-xs text-gray-400 mt-1">Identificador único de base de datos. No se puede cambiar.</p>
                            {errors.schema_name && <span className="text-xs text-red-500">{errors.schema_name.message}</span>}
                        </div>

                        {/* Domain */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Dominio (Opcional)</label>
                            <input
                                {...register('domain')}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                placeholder="Ej: https://tutienda.com"
                            />
                        </div>
                    </div>

                    {/* Right Column: Admin & Plan */}
                    <div className="space-y-4">
                        <h4 className="font-medium text-gray-900 border-b pb-1">Administrador Inicial</h4>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email Admin</label>
                            <input
                                type="email"
                                {...register('admin_email', { required: 'El email es obligatorio' })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                placeholder="admin@empresa.com"
                            />
                            {errors.admin_email && <span className="text-xs text-red-500">{errors.admin_email.message}</span>}
                        </div>

                        {/* CC Emails adicionales */}
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="block text-sm font-medium text-gray-700">Enviar copia a (opcional)</label>
                                {ccEmails.length < 3 && (
                                    <button
                                        type="button"
                                        onClick={() => setCcEmails([...ccEmails, ''])}
                                        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
                                    >
                                        <Plus className="w-3 h-3" /> Agregar correo
                                    </button>
                                )}
                            </div>
                            {ccEmails.length === 0 && (
                                <p className="text-xs text-gray-400">El correo de bienvenida llegará solo al email admin. Puedes agregar hasta 3 copias.</p>
                            )}
                            {ccEmails.map((email, idx) => (
                                <div key={idx} className="flex gap-2 mb-2">
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={e => {
                                            const updated = [...ccEmails];
                                            updated[idx] = e.target.value;
                                            setCcEmails(updated);
                                        }}
                                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all"
                                        placeholder={`correo${idx + 1}@ejemplo.com`}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setCcEmails(ccEmails.filter((_, i) => i !== idx))}
                                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña Admin</label>
                            <input
                                type="password"
                                {...register('admin_password', {
                                    required: 'La contraseña es obligatoria',
                                    minLength: { value: 6, message: 'Mínimo 6 caracteres' }
                                })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                placeholder="******"
                            />
                            {errors.admin_password && <span className="text-xs text-red-500">{errors.admin_password.message}</span>}
                        </div>

                        <div className="pt-2">
                            <h4 className="font-medium text-gray-900 border-b pb-1 mb-3">Plan de Suscripción</h4>
                            <div className="space-y-2">
                                {!planType && (
                                    <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                        ⚠️ Selecciona un plan para continuar
                                    </p>
                                )}
                                <label className={`flex items-center p-3 border rounded-lg cursor-pointer transition-all ${planType === 'DEMO_15' ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}>
                                    <input type="radio" name="plan" value="DEMO_15" checked={planType === 'DEMO_15'} onChange={(e) => setPlanType(e.target.value)} className="w-4 h-4 text-blue-600" />
                                    <span className="ml-2 text-sm font-medium text-gray-900">Demo Gratuita <span className="ml-1 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-semibold">2 días</span></span>
                                </label>
                                <label className={`flex items-center p-3 border rounded-lg cursor-pointer transition-all ${planType === 'SUB_3' ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}>
                                    <input type="radio" name="plan" value="SUB_3" checked={planType === 'SUB_3'} onChange={(e) => setPlanType(e.target.value)} className="w-4 h-4 text-blue-600" />
                                    <span className="ml-2 text-sm font-medium text-gray-900">Plan Trimestral</span>
                                </label>
                                <label className={`flex items-center p-3 border rounded-lg cursor-pointer transition-all ${planType === 'SUB_6' ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}>
                                    <input type="radio" name="plan" value="SUB_6" checked={planType === 'SUB_6'} onChange={(e) => setPlanType(e.target.value)} className="w-4 h-4 text-blue-600" />
                                    <span className="ml-2 text-sm font-medium text-gray-900">Plan Semestral</span>
                                </label>
                                <label className={`flex items-center p-3 border rounded-lg cursor-pointer transition-all ${planType === 'SUB_12' ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}>
                                    <input type="radio" name="plan" value="SUB_12" checked={planType === 'SUB_12'} onChange={(e) => setPlanType(e.target.value)} className="w-4 h-4 text-blue-600" />
                                    <span className="ml-2 text-sm font-medium text-gray-900">Plan Anual</span>
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="col-span-1 md:col-span-2 flex justify-end gap-3 pt-4 border-t border-gray-100 mt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            {isLoading ? 'Creando...' : 'Crear Empresa'}
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
};

export default CreateTenantModal;
