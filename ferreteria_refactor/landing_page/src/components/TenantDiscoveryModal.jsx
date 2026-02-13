import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, ArrowRight, Loader2, AlertCircle } from 'lucide-react';

const TenantDiscoveryModal = ({ isOpen, onClose }) => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

        try {
            const response = await fetch(`${API_URL}/api/v1/auth/discovery`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email }),
            });

            const data = await response.json();

            if (response.ok) {
                // Redirección total
                window.location.href = data.redirect_url;
            } else {
                setError(data.detail || 'No pudimos encontrar tu cuenta. Verifica el correo.');
            }
        } catch (err) {
            setError('Error de conexión. Intenta más tarde.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Overlay */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100]"
                    />

                    {/* Modal Container */}
                    <div className="fixed inset-0 flex items-center justify-center z-[101] p-4 pointer-events-none">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden pointer-events-auto"
                        >
                            {/* Header */}
                            <div className="p-6 flex items-center justify-between border-b border-slate-100">
                                <h3 className="text-xl font-black text-slate-800">Recuperar Acceso</h3>
                                <button
                                    onClick={onClose}
                                    className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Body */}
                            <div className="p-8">
                                <div className="bg-indigo-50 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 border border-indigo-100 mx-auto">
                                    <Search className="text-indigo-600" size={32} />
                                </div>

                                <div className="text-center mb-8">
                                    <h4 className="text-lg font-bold text-slate-900 mb-2">¿Ya tienes una cuenta?</h4>
                                    <p className="text-slate-500 text-sm">
                                        Ingresa tu correo electrónico y te redirigiremos automáticamente a tu plataforma personalizada.
                                    </p>
                                </div>

                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">
                                            Correo Electrónico
                                        </label>
                                        <input
                                            type="email"
                                            required
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="ejemplo@correo.com"
                                            className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-slate-800"
                                        />
                                    </div>

                                    {error && (
                                        <motion.div
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            className="flex items-center gap-3 p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-sm font-medium"
                                        >
                                            <AlertCircle size={18} className="shrink-0" />
                                            {error}
                                        </motion.div>
                                    )}

                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-black py-4 rounded-2xl transition-all shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 group"
                                    >
                                        {loading ? (
                                            <Loader2 className="animate-spin" size={20} />
                                        ) : (
                                            <>
                                                Buscar mi cuenta
                                                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                                            </>
                                        )}
                                    </button>
                                </form>
                            </div>

                            {/* Footer */}
                            <div className="p-6 bg-slate-50 border-t border-slate-100 text-center">
                                <p className="text-xs text-slate-400">
                                    ¿No tienes cuenta? <span className="text-indigo-600 font-bold cursor-pointer hover:underline" onClick={onClose}>Regístrate ahora</span>
                                </p>
                            </div>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    );
};

export default TenantDiscoveryModal;
