import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Smartphone, Check, AlertCircle, Server } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';

const MobileWelcome = () => {
    const [slug, setSlug] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const cleanSlug = slug.trim().toLowerCase();
        if (!cleanSlug) {
            setError('Por favor ingresa un código válido');
            setLoading(false);
            return;
        }

        // Construct the URL
        // Assumption: The system uses a standard domain structure
        // If localhost, we might need a different logic, but for now we assume production URL structure
        // Or we assume the user might input the full URL?
        // Let's stick to the plan: https://{slug}.miinventariofacil.com
        
        // For development/testing on localhost, we might want to allow overriding this via a hidden feature or just defaulting to localhost if slug is 'local'
        let candidateUrl = `https://${cleanSlug}.miinventariofacil.com`;
        
        // DEV OVERRIDE
        if (cleanSlug === 'local' || cleanSlug === 'localhost') {
             candidateUrl = 'http://127.0.0.1:8000';
        }

        console.log(`📱 Testing connection to: ${candidateUrl}`);

        try {
            // Test connection using a simple HEAD or GET request to a public endpoint
            // We use fetch directly to avoid the axios interceptors for this initial check
            const response = await fetch(`${candidateUrl}/api/v1/health`, {
                method: 'GET',
                headers: { 'Accept': 'application/json' }
            });

            if (response.ok) {
                // Success!
                localStorage.setItem('api_url', candidateUrl);
                localStorage.setItem('selected_tenant', cleanSlug); // Also set tenant for context
                toast.success('¡Conectado exitosamente!');
                
                // Force reload to apply new axios config
                window.location.href = '/login';
            } else {
                throw new Error('El servidor respondió pero con error.');
            }

        } catch (err) {
            console.error('Connection failed:', err);
            setError('No pudimos conectar con esa empresa. Verifica el código.');
            toast.error('Error de conexión');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6">
            <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in duration-500">
                
                {/* Header */}
                <div className="bg-indigo-600 p-8 text-center text-white">
                    <div className="mx-auto bg-white/20 w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-transform hover:scale-110">
                        <Smartphone size={32} className="text-white" />
                    </div>
                    <h1 className="text-2xl font-bold">Configuración Móvil</h1>
                    <p className="text-indigo-100 text-sm mt-2">
                        Conecta esta App con tu empresa
                    </p>
                </div>

                {/* Form */}
                <div className="p-8 space-y-6">
                    {error && (
                        <div className="bg-rose-50 border border-rose-200 text-rose-600 p-3 rounded-xl flex items-start gap-3 text-sm">
                            <AlertCircle size={18} className="shrink-0 mt-0.5" />
                            <p>{error}</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700 ml-1">
                                Código de Empresa (Slug)
                            </label>
                            <div className="relative">
                                <Server className="absolute left-3 top-3.5 text-slate-400" size={18} />
                                <input 
                                    type="text" 
                                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-medium text-slate-900 placeholder:text-slate-400"
                                    placeholder="ej. ferreteria-central"
                                    value={slug}
                                    onChange={(e) => setSlug(e.target.value)}
                                    autoCapitalize="none"
                                    autoCorrect="off"
                                />
                            </div>
                            <p className="text-xs text-slate-400 ml-1">
                                Este es el subdominio que usas en la web.
                            </p>
                        </div>

                        <button 
                            type="submit" 
                            disabled={loading || !slug}
                            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <span>Conectar</span>
                                    <Check size={20} />
                                </>
                            )}
                        </button>
                    </form>
                </div>

                {/* Footer */}
                <div className="bg-slate-50 p-4 text-center border-t border-slate-100">
                    <p className="text-xs text-slate-400">
                        ¿Problemas? Contacta a soporte técnico.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default MobileWelcome;
