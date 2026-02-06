import { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from '../config/axios';
import { toast } from 'react-hot-toast';
import { Mail, ArrowLeft, Loader2 } from 'lucide-react';

export default function ForgotPassword() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await axios.post('auth/forgot-password', { email });
            setSubmitted(true);
            toast.success('Solicitud enviada exitosamente');
        } catch (error) {
            console.error('Error in forgot password:', error);
            toast.error(error.response?.data?.detail || 'Error al procesar la solicitud');
        } finally {
            setLoading(false);
        }
    };

    if (submitted) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
                <div className="max-w-md w-full space-y-8 p-10 bg-white rounded-xl shadow-lg text-center">
                    <div className="flex justify-center">
                        <div className="bg-green-100 p-3 rounded-full">
                            <Mail className="h-10 w-10 text-green-600" />
                        </div>
                    </div>
                    <h2 className="text-3xl font-extrabold text-gray-900">Revisa tu correo</h2>
                    <p className="mt-2 text-gray-600">
                        Si el correo <strong>{email}</strong> está registrado, recibirás un enlace para restablecer tu contraseña en unos minutos.
                    </p>
                    <div className="mt-6">
                        <Link
                            to="/login"
                            className="font-medium text-blue-600 hover:text-blue-500 flex items-center justify-center gap-2"
                        >
                            <ArrowLeft className="h-4 w-4" /> Volver al inicio de sesión
                        </Link>
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
                        ¿Olvidaste tu contraseña?
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-600">
                        Ingresa tu correo electrónico y te enviaremos un enlace para recuperarla.
                    </p>
                </div>
                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    <div>
                        <label htmlFor="email-address" className="sr-only">
                            Correo Electrónico
                        </label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Mail className="h-5 w-5 text-gray-400" />
                            </div>
                            <input
                                id="email-address"
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                className="appearance-none rounded-lg relative block w-full px-10 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                placeholder="correo@ejemplo.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                    </div>

                    <div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
                        >
                            {loading ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                                'Enviar enlace de recuperación'
                            )}
                        </button>
                    </div>

                    <div className="text-center">
                        <Link
                            to="/login"
                            className="font-medium text-blue-600 hover:text-blue-500 flex items-center justify-center gap-2"
                        >
                            <ArrowLeft className="h-4 w-4" /> Volver al inicio de sesión
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    );
}
