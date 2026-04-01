import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import axios from '../config/axios';
import { toast } from 'react-hot-toast';
import { Lock, Eye, EyeOff, Loader2, CheckCircle2, ArrowLeft } from 'lucide-react';

export default function ResetPassword() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    // Fallback robusto para capturar el token (maneja puntos del JWT en Traefik)
    const getTokenFromUrl = () => {
        // Intento 1: useSearchParams (React Router)
        const tokenFromParams = searchParams.get('token');
        if (tokenFromParams) return tokenFromParams;

        // Intento 2: window.location.search (fallback para caracteres especiales)
        const urlParams = new URLSearchParams(window.location.search);
        const tokenFromWindow = urlParams.get('token');
        if (tokenFromWindow) return tokenFromWindow;

        // Intento 3: Parseo manual (último recurso)
        const search = window.location.search;
        const match = search.match(/[?&]token=([^&]+)/);
        return match ? decodeURIComponent(match[1]) : null;
    };

    const token = getTokenFromUrl();

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [tokenError, setTokenError] = useState(false);
    const [loginUrl, setLoginUrl] = useState(null);

    // NO redirigir automáticamente - el formulario siempre se muestra

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validar token antes de enviar
        if (!token) {
            setTokenError(true);
            toast.error('Token no encontrado. Por favor, solicita un nuevo enlace de recuperación.');
            return;
        }

        if (password !== confirmPassword) {
            return toast.error('Las contraseñas no coinciden');
        }

        setLoading(true);
        setTokenError(false);

        try {
            const res = await axios.post('auth/reset-password', {
                token: token,
                new_password: password
            });
            setLoginUrl(res.data?.login_url || null);
            setSuccess(true);
            toast.success('Contraseña actualizada correctamente');
        } catch (error) {
            console.error('Error resetting password:', error);
            const errorMessage = error.response?.data?.detail || 'Error al restablecer la contraseña';

            // Si el error es de token inválido, mostrar en pantalla sin redirigir
            if (error.response?.status === 400 || error.response?.status === 404) {
                setTokenError(true);
                toast.error(errorMessage);
            } else {
                toast.error(errorMessage);
            }
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
                <div className="max-w-md w-full space-y-8 p-10 bg-white rounded-xl shadow-lg text-center">
                    <div className="flex justify-center">
                        <div className="bg-green-100 p-3 rounded-full">
                            <CheckCircle2 className="h-10 w-10 text-green-600" />
                        </div>
                    </div>
                    <h2 className="text-3xl font-extrabold text-gray-900">¡Éxito!</h2>
                    <p className="mt-2 text-gray-600">
                        Tu contraseña ha sido actualizada. Ya puedes iniciar sesión con tu nueva clave.
                    </p>
                    <div className="mt-6">
                        <button
                            onClick={() => {
                                if (loginUrl) {
                                    window.location.href = loginUrl;
                                } else {
                                    navigate('/login');
                                }
                            }}
                            className="w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                            Ir al inicio de sesión
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8 p-10 bg-white rounded-xl shadow-lg">
                <div>
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                        Restablecer Contraseña
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-600">
                        Elige una nueva contraseña segura para tu cuenta.
                    </p>
                </div>

                {tokenError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <p className="text-sm text-red-800">
                            ⚠️ El enlace de recuperación es inválido o ha expirado.
                            <Link to="/forgot-password" className="font-medium underline ml-1">
                                Solicita uno nuevo aquí
                            </Link>
                        </p>
                    </div>
                )}

                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Nueva Contraseña</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Lock className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    required
                                    className="appearance-none rounded-lg relative block w-full px-10 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    minLength={6}
                                />
                                <button
                                    type="button"
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? <EyeOff className="h-5 w-5 text-gray-400" /> : <Eye className="h-5 w-5 text-gray-400" />}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar Contraseña</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Lock className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    required
                                    className="appearance-none rounded-lg relative block w-full px-10 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                    placeholder="••••••••"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    <div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
                        >
                            {loading ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                                'Actualizar contraseña'
                            )}
                        </button>
                    </div>

                    <div className="text-center">
                        <Link
                            to="/login"
                            className="font-medium text-blue-600 hover:text-blue-500 flex items-center justify-center gap-2"
                        >
                            <ArrowLeft className="h-4 w-4" /> Cancelar y volver
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    );
}
