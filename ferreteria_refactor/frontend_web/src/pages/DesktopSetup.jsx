/**
 * DesktopSetup.jsx
 *
 * Pantalla de configuración inicial del app de escritorio (Tauri).
 * Se muestra la PRIMERA VEZ que el cliente instala el programa,
 * o cuando quiere cambiar de empresa.
 *
 * El usuario ingresa el código de su empresa (slug del tenant).
 * El app verifica que existe, guarda en localStorage y va al login.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Monitor, CheckCircle2, XCircle, Loader2, Building2, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '../config/constants';

const DesktopSetup = () => {
    const [slug, setSlug]       = useState('');
    const [loading, setLoading] = useState(false);
    const [step, setStep]       = useState('idle'); // idle | connecting | success | error
    const [errorMsg, setErrorMsg] = useState('');
    const [progress, setProgress] = useState(0);
    const navigate = useNavigate();

    // ──────────────────────────────────────────────
    // Detectar si ya hay un tenant configurado
    // ──────────────────────────────────────────────
    const currentTenant = localStorage.getItem('selected_tenant');

    // ──────────────────────────────────────────────
    // Resolver la API base para la verificación
    // Siempre usa la URL baked en el binario (VITE_API_URL)
    // ──────────────────────────────────────────────
    const getBaseUrl = () => {
        // Quitar /api/v1 si ya está incluido
        return API_BASE_URL.replace(/\/api\/v1\/?$/, '');
    };

    // ──────────────────────────────────────────────
    // Conectar y verificar que el tenant existe
    // ──────────────────────────────────────────────
    const handleConnect = async (e) => {
        e?.preventDefault();
        setErrorMsg('');

        const cleanSlug = slug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');

        if (!cleanSlug) {
            setErrorMsg('Ingresa el código de tu empresa');
            setStep('error');
            return;
        }

        setStep('connecting');
        setLoading(true);
        setProgress(20);

        try {
            const baseUrl  = getBaseUrl();
            const endpoint = `${baseUrl}/api/v1/health`;

            setProgress(40);

            const controller = new AbortController();
            const timeout    = setTimeout(() => controller.abort(), 10000);

            setProgress(60);

            const res = await fetch(endpoint, {
                method:  'GET',
                headers: {
                    'Accept':      'application/json',
                    'X-Tenant-ID': cleanSlug,
                },
                signal: controller.signal,
            });
            clearTimeout(timeout);

            setProgress(80);

            const data = await res.json().catch(() => ({}));

            if (res.ok && data.status === 'ok') {
                setProgress(100);
                setStep('success');

                // Guardar SOLO el slug — la API URL ya está en el binario
                localStorage.setItem('selected_tenant', cleanSlug);

                toast.success(`¡Empresa "${cleanSlug}" configurada!`);

                setTimeout(() => {
                    // Recargar para que App.jsx re-detecte el tenant
                    window.location.href = '/#/login';
                    window.location.reload();
                }, 1000);
            } else {
                throw new Error('El servidor respondió pero no pudo verificar la empresa.');
            }

        } catch (err) {
            setProgress(0);
            setStep('error');
            if (err.name === 'AbortError') {
                setErrorMsg('Tiempo de espera agotado. Verifica tu conexión a internet.');
            } else if (err.message.includes('fetch')) {
                setErrorMsg('No se pudo conectar al servidor. Verifica tu internet.');
            } else {
                setErrorMsg(err.message || 'No se pudo verificar la empresa.');
            }
        } finally {
            setLoading(false);
        }
    };

    // ──────────────────────────────────────────────
    // Borrar configuración actual (cambiar empresa)
    // ──────────────────────────────────────────────
    const handleReset = () => {
        localStorage.removeItem('selected_tenant');
        setSlug('');
        setStep('idle');
        toast('Empresa desvinculada. Configura una nueva.', { icon: '🔄' });
    };

    // ──────────────────────────────────────────────
    // UI
    // ──────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-8">

            {/* Panel central */}
            <div className="w-full max-w-md">

                {/* Branding */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-500/20 border border-indigo-400/30 rounded-2xl mb-4">
                        <Monitor className="w-8 h-8 text-indigo-400" />
                    </div>
                    <h1 className="text-2xl font-black text-white">Invensoft</h1>
                    <p className="text-slate-400 text-sm mt-1">App de escritorio</p>
                </div>

                {/* Card */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm shadow-2xl">

                    <div className="flex items-center gap-3 mb-5">
                        <div className="w-9 h-9 bg-indigo-500/20 rounded-xl flex items-center justify-center">
                            <Building2 className="w-5 h-5 text-indigo-400" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-white">
                                {currentTenant ? 'Cambiar empresa' : 'Configurar empresa'}
                            </h2>
                            <p className="text-xs text-slate-400">
                                {currentTenant
                                    ? `Empresa actual: ${currentTenant}`
                                    : 'Ingresa el código de tu empresa para comenzar'}
                            </p>
                        </div>
                    </div>

                    <form onSubmit={handleConnect} className="space-y-4">

                        {/* Input del slug */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wide">
                                Código de empresa
                            </label>
                            <input
                                type="text"
                                value={slug}
                                onChange={(e) => {
                                    setSlug(e.target.value);
                                    if (step !== 'idle') setStep('idle');
                                }}
                                placeholder="ej: miferreteria"
                                autoCapitalize="none"
                                autoCorrect="off"
                                autoComplete="off"
                                spellCheck={false}
                                disabled={loading}
                                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder:text-slate-500 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all disabled:opacity-50"
                            />
                            <p className="text-[11px] text-slate-500 mt-1.5">
                                Es el código que usas en{' '}
                                <span className="text-indigo-400 font-mono">
                                    [codigo].miinventariofacil.com
                                </span>
                            </p>
                        </div>

                        {/* Barra de progreso */}
                        {step === 'connecting' && (
                            <div className="space-y-2">
                                <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                                    <div
                                        className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                                <div className="flex items-center gap-2 text-xs text-indigo-400">
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    Verificando empresa...
                                </div>
                            </div>
                        )}

                        {/* Éxito */}
                        {step === 'success' && (
                            <div className="flex items-center gap-2 py-2.5 px-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                <span className="text-sm font-medium text-emerald-300">
                                    Empresa verificada — redirigiendo al login...
                                </span>
                            </div>
                        )}

                        {/* Error */}
                        {step === 'error' && errorMsg && (
                            <div className="flex items-start gap-2 py-2.5 px-3 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                                <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                                <span className="text-sm text-rose-300">{errorMsg}</span>
                            </div>
                        )}

                        {/* Botón conectar */}
                        <button
                            type="submit"
                            disabled={loading || !slug.trim() || step === 'success'}
                            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-indigo-900/40"
                        >
                            {loading ? (
                                <><Loader2 className="w-4 h-4 animate-spin" /> Verificando...</>
                            ) : step === 'success' ? (
                                <><CheckCircle2 className="w-4 h-4" /> ¡Configurado!</>
                            ) : (
                                <>Conectar empresa <ArrowRight className="w-4 h-4" /></>
                            )}
                        </button>
                    </form>

                    {/* Botón cambiar empresa (si ya hay una configurada) */}
                    {currentTenant && step === 'idle' && (
                        <div className="mt-4 pt-4 border-t border-white/10">
                            <button
                                onClick={() => navigate('/login')}
                                className="w-full py-2 text-sm text-slate-400 hover:text-white transition-colors font-medium"
                            >
                                ← Volver al inicio de sesión
                            </button>
                            <button
                                onClick={handleReset}
                                className="w-full py-2 text-xs text-rose-400/70 hover:text-rose-400 transition-colors"
                            >
                                Desvincular empresa actual ({currentTenant})
                            </button>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <p className="text-center text-slate-600 text-xs mt-6">
                    Invensoft Desktop · miinventariofacil.com
                </p>
            </div>
        </div>
    );
};

export default DesktopSetup;
