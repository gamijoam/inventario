import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { X, Loader2 } from 'lucide-react';
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
    const { register, handleSubmit, formState: { errors }, reset } = useForm<CreateTenantDTO>();

    if (!isOpen) return null;

    const onSubmit = async (data: CreateTenantDTO) => {
        setIsLoading(true);
        try {
            await createTenant(data);
            toast.success('Empresa creada exitosamente');
            reset();
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error(error);
            const msg = error.response?.data?.detail || 'Error al crear la empresa';
            toast.error(msg);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">

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
                <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">

                    {/* Nombre Empresa */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de la Empresa</label>
                        <input
                            {...register('name', { required: 'El nombre es obligatorio' })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                            placeholder="Ej: Ferretería El Clavo"
                        />
                        {errors.name && <span className="text-xs text-red-500">{errors.name.message}</span>}
                    </div>

                    {/* Schema (Technical Name) */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de Esquema (DB)</label>
                        <input
                            {...register('schema_name', {
                                required: 'El esquema es obligatorio',
                                pattern: {
                                    value: /^[a-z0-9_]+$/,
                                    message: 'Solo minúsculas, números y guiones bajos (sin espacios)'
                                }
                            })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-mono text-sm"
                            placeholder="Ej: ferreteria_juan"
                        />
                        {errors.schema_name && <span className="text-xs text-red-500">{errors.schema_name.message}</span>}
                        <p className="text-xs text-gray-400 mt-1">Este será el identificador interno de la base de datos.</p>
                    </div>

                    {/* Domain */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Dominio Personalizado (Opcional)</label>
                        <input
                            {...register('domain')}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                            placeholder="Ej: https://juan.mitool.com"
                        />
                    </div>

                    <div className="border-t border-gray-100 my-4 pt-4">
                        <h4 className="text-sm font-semibold text-gray-900 mb-3">Cuenta de Administrador</h4>

                        {/* Admin Email */}
                        <div className="mb-3">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Correo Electrónico</label>
                            <input
                                {...register('admin_email', {
                                    required: 'El correo es obligatorio',
                                    pattern: {
                                        value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                                        message: "Correo inválido"
                                    }
                                })}
                                type="email"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                placeholder="admin@empresa.com"
                            />
                            {errors.admin_email && <span className="text-xs text-red-500">{errors.admin_email.message}</span>}
                        </div>

                        {/* Admin Password */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña Inicial</label>
                            <input
                                {...register('admin_password', {
                                    required: 'La contraseña es obligatoria',
                                    minLength: { value: 6, message: 'Mínimo 6 caracteres' }
                                })}
                                type="password"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                placeholder="••••••••"
                            />
                            {errors.admin_password && <span className="text-xs text-red-500">{errors.admin_password.message}</span>}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-2">
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
