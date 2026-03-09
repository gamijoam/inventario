import React from 'react';
import { useForm } from 'react-hook-form';
import { useAuth } from '../context/AuthContext';
import type { LoginCredentials } from '../types/auth'; // Type-only import
import { Mail, Lock, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

const Login: React.FC = () => {
    const { login, isLoading } = useAuth();
    const { register, handleSubmit, formState: { errors } } = useForm<LoginCredentials>();

    const onSubmit = async (data: LoginCredentials) => {
        try {
            await login(data);
            toast.success('¡Bienvenido!');
            // Navigation is handled in login function, or here if preferred, but context handles it usually.
            // But let's rely on Context logic for now, or ensure Context navigates.
            // Context has navigate('/dashboard').
        } catch (error) {
            console.error(error);
            toast.error('Credenciales inválidas. Intenta de nuevo.');
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
            <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md space-y-8">
                <div className="text-center">
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Iniciar Sesión</h1>
                    <p className="mt-2 text-sm text-gray-600">Accede a tu panel administrativo</p>
                </div>

                <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
                    <div className="space-y-4">
                        {/* Email Field */}
                        <div>
                            <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                                Correo Electrónico
                            </label>
                            <div className="mt-1 relative rounded-md shadow-sm">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Mail className="h-5 w-5 text-gray-400" aria-hidden="true" />
                                </div>
                                <input
                                    id="username"
                                    type="email"
                                    autoComplete="email"
                                    className={`block w-full pl-10 sm:text-sm rounded-lg border-gray-300 focus:ring-blue-500 focus:border-blue-500 p-2.5 border ${errors.username ? 'border-red-500' : ''}`}
                                    placeholder="admin@empresa.com"
                                    {...register('username', {
                                        required: 'El correo es requerido',
                                        pattern: {
                                            value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                                            message: "Dirección de correo inválida"
                                        }
                                    })}
                                />
                            </div>
                            {errors.username && (
                                <p className="mt-1 text-sm text-red-600">{errors.username.message}</p>
                            )}
                        </div>

                        {/* Password Field */}
                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                                Contraseña
                            </label>
                            <div className="mt-1 relative rounded-md shadow-sm">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Lock className="h-5 w-5 text-gray-400" aria-hidden="true" />
                                </div>
                                <input
                                    id="password"
                                    type="password"
                                    autoComplete="current-password"
                                    className={`block w-full pl-10 sm:text-sm rounded-lg border-gray-300 focus:ring-blue-500 focus:border-blue-500 p-2.5 border ${errors.password ? 'border-red-500' : ''}`}
                                    placeholder="••••••••"
                                    {...register('password', { required: 'La contraseña es requerida' })}
                                />
                            </div>
                            {errors.password && (
                                <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col gap-3">
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                                    Cargando...
                                </>
                            ) : (
                                'Ingresar'
                            )}
                        </button>

                    </div>
                </form>
            </div>
        </div>
    );
};

export default Login;
