import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { X, Loader2, Eye, EyeOff } from 'lucide-react';
import { createTenantUser } from '../api/tenants';
import toast from 'react-hot-toast';

interface CreateUserModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    tenantId: number;
}

const CreateUserModal: React.FC<CreateUserModalProps> = ({ isOpen, onClose, onSuccess, tenantId }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const { register, handleSubmit, formState: { errors }, reset } = useForm();

    if (!isOpen) return null;

    const onSubmit = async (data: any) => {
        setIsLoading(true);
        try {
            await createTenantUser(tenantId, {
                ...data,
                commission_percentage: 0 // Default
            });
            toast.success('Usuario creado exitosamente');
            reset();
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error(error);
            const msg = error.response?.data?.detail || 'Error al crear usuario';
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
                    <h3 className="text-lg font-semibold text-gray-800">Nuevo Usuario</h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-200 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">

                    {/* Username */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Usuario (Login)</label>
                        <input
                            {...register('username', {
                                required: 'El usuario es obligatorio',
                                minLength: { value: 3, message: 'Mínimo 3 caracteres' },
                                pattern: { value: /^[a-zA-Z0-9_]+$/, message: 'Solo letras, números y guiones bajos' }
                            })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                            placeholder="Ej: jdoe"
                        />
                        {errors.username && <span className="text-xs text-red-500">{errors.username.message as string}</span>}
                    </div>

                    {/* Full Name */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Completo</label>
                        <input
                            {...register('full_name', { required: 'El nombre es obligatorio' })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                            placeholder="Ej: John Doe"
                        />
                        {errors.full_name && <span className="text-xs text-red-500">{errors.full_name.message as string}</span>}
                    </div>

                    {/* Email */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <input
                            type="email"
                            {...register('email', {
                                required: 'El email es obligatorio',
                                pattern: { value: /^\S+@\S+$/i, message: 'Email inválido' }
                            })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                            placeholder="Ej: john@empresa.com"
                        />
                        {errors.email && <span className="text-xs text-red-500">{errors.email.message as string}</span>}
                    </div>

                    {/* Role */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
                        <select
                            {...register('role', { required: 'El rol es obligatorio' })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white"
                        >
                            <option value="ADMIN">Admin</option>
                            <option value="CASHIER">Cajero</option>
                            <option value="WAITER">Mesero</option>
                            <option value="KITCHEN">Cocina</option>
                        </select>
                        {errors.role && <span className="text-xs text-red-500">{errors.role.message as string}</span>}
                    </div>

                    {/* Password */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
                        <div className="relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                {...register('password', {
                                    required: 'La contraseña es obligatoria',
                                    minLength: { value: 6, message: 'Mínimo 6 caracteres' }
                                })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all pr-10"
                                placeholder="******"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                            >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                        {errors.password && <span className="text-xs text-red-500">{errors.password.message as string}</span>}
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
                            {isLoading ? 'Creando...' : 'Crear Usuario'}
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
};

export default CreateUserModal;
