import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { X, Loader2 } from 'lucide-react';
import { updateTenant } from '../api/tenants';
import type { Tenant, UpdateTenantDTO } from '../types/tenant';
import toast from 'react-hot-toast';

interface EditTenantModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    tenant: Tenant | null;
}

const EditTenantModal: React.FC<EditTenantModalProps> = ({ isOpen, onClose, onSuccess, tenant }) => {
    const [isLoading, setIsLoading] = useState(false);
    const { register, handleSubmit, formState: { errors }, reset, setValue } = useForm<UpdateTenantDTO>();

    useEffect(() => {
        if (tenant) {
            setValue('name', tenant.name);
            setValue('domain', tenant.domain || '');
            // We do not edit schema_name or email/password here
        }
    }, [tenant, setValue]);

    if (!isOpen || !tenant) return null;

    const onSubmit = async (data: UpdateTenantDTO) => {
        setIsLoading(true);
        try {
            await updateTenant(tenant.id, data);
            toast.success('Empresa actualizada exitosamente');
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error(error);
            const msg = error.response?.data?.detail || 'Error al actualizar la empresa';
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
                    <h3 className="text-lg font-semibold text-gray-800">Editar Empresa</h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-200 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">

                    {/* Esquema (Read Only) */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Esquema (Identificador)</label>
                        <input
                            disabled
                            value={tenant.schema_name}
                            className="w-full px-3 py-2 border border-gray-200 bg-gray-100 rounded-lg text-gray-500 font-mono text-sm cursor-not-allowed"
                        />
                        <p className="text-xs text-gray-400 mt-1">El identificador de base de datos no se puede cambiar.</p>
                    </div>

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

                    {/* Domain */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Dominio Personalizado</label>
                        <input
                            {...register('domain')}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                            placeholder="Ej: https://juan.mitool.com"
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 mt-4">
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
                            {isLoading ? 'Guardando...' : 'Guardar Cambios'}
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
};

export default EditTenantModal;
