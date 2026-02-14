import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wifi, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

const MobileWelcome = () => {
    const [slug, setSlug] = useState('');
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState('idle'); // idle | connecting | success | error
    const [error, setError] = useState('');
    const [progress, setProgress] = useState(0);
    const navigate = useNavigate();

    const resolveUrl = (cleanSlug) => {
        let url = '';
        let tenant = '';

        if (cleanSlug.includes('miinventariofacil.com')) {
            let hostname = cleanSlug;
            try {
                if (cleanSlug.startsWith('http')) {
                    hostname = new URL(cleanSlug).hostname;
                }
            } catch (e) { /* ignore */ }

            const parts = hostname.split('.');
            if (parts.length >= 3) {
                const sub = parts[0];
                if (!['www', 'api', 'app', 'local'].includes(sub)) {
                    tenant = sub;
                }
            }
            url = 'https://api.miinventariofacil.com';
        }
        else if (cleanSlug === 'local') {
            url = 'http://10.0.2.2:8000';
        }
        else if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(cleanSlug)) {
            url = cleanSlug.startsWith('http') ? cleanSlug : `http://${cleanSlug}`;
        }
        else {
            tenant = cleanSlug;
            url = 'https://api.miinventariofacil.com';
        }

        if (url.endsWith('/')) url = url.slice(0, -1);
        return { url, tenant };
    };

    const handleConnect = async (e) => {
        e?.preventDefault();
        setError('');
        setStatus('connecting');
        setLoading(true);
        setProgress(10);

        const cleanSlug = slug.trim().toLowerCase();

        if (!cleanSlug) {
            setError('Ingresa tu código de empresa o dirección IP');
            setStatus('error');
            setLoading(false);
            return;
        }

        try {
            const { url, tenant } = resolveUrl(cleanSlug);
            const endpoint = `${url}/api/v1/health`;

            setProgress(30);

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            setProgress(50);

            const response = await fetch(endpoint, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    ...(tenant ? { 'X-Tenant-ID': tenant } : {})
                },
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            setProgress(70);

            const text = await response.text();
            let data = {};
            try { data = JSON.parse(text); } catch (e) { /* ignore */ }

            setProgress(90);

            if (response.ok && data.status === 'ok') {
                setProgress(100);
                setStatus('success');

                const finalUrl = url.endsWith('/api/v1') ? url : `${url}/api/v1`;
                localStorage.setItem('api_url', finalUrl);
                localStorage.setItem('selected_tenant', tenant);

                toast.success('¡Conectado exitosamente!');

                setTimeout(() => {
                    window.location.href = '/#/login';
                    window.location.reload();
                }, 1200);
            } else {
                throw new Error('No se pudo verificar el servidor');
            }

        } catch (err) {
            setProgress(0);
            setStatus('error');
            if (err.name === 'AbortError') {
                setError('Tiempo de espera agotado. Verifica tu conexión o la dirección.');
            } else {
                setError('No se pudo conectar. Verifica que la dirección sea correcta y que el servidor esté activo.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-indigo-600 via-indigo-700 to-slate-900 flex flex-col items-center justify-center p-6" style={{ paddingTop: 'env(safe-area-inset-top)' }}>

            {/* Logo & Branding */}
            <div className="text-center mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="mx-auto w-20 h-20 bg-white/15 backdrop-blur-lg rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-indigo-900/30 border border-white/20">
                    <span className="text-4xl font-black text-white">M</span>
                </div>
                <h1 className="text-2xl font-black text-white tracking-tight">Mi Inventario Fácil</h1>
                <p className="text-indigo-200 text-sm mt-1">Tu inventario, donde estés</p>
            </div>

            {/* Connection Card */}
            <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl shadow-black/20 overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-700">

                {/* Card Header */}
                <div className="p-6 pb-4">
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                            <Wifi size={20} className="text-indigo-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-800">Conectar</h2>
                            <p className="text-xs text-slate-400">Ingresa tu código de empresa</p>
                        </div>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleConnect} className="px-6 pb-6 space-y-4">
                    <div className="space-y-1.5">
                        <input
                            type="text"
                            className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-medium text-slate-800 text-base placeholder:text-slate-400 transition-all"
                            placeholder="ej: miempresa, 192.168.1.5"
                            value={slug}
                            onChange={(e) => { setSlug(e.target.value); if (status !== 'idle') setStatus('idle'); }}
                            autoCapitalize="none"
                            autoCorrect="off"
                            disabled={loading}
                        />
                        <p className="text-[11px] text-slate-400 ml-1">Código, URL o dirección IP de tu servidor</p>
                    </div>

                    {/* Progress Bar (visible during connection) */}
                    {status === 'connecting' && (
                        <div className="space-y-2 animate-in fade-in duration-300">
                            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full transition-all duration-500 ease-out"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                            <div className="flex items-center justify-center gap-2 text-sm text-indigo-600 font-medium">
                                <Loader2 size={14} className="animate-spin" />
                                <span>Conectando...</span>
                            </div>
                        </div>
                    )}

                    {/* Success Message */}
                    {status === 'success' && (
                        <div className="flex items-center justify-center gap-2 py-3 bg-emerald-50 rounded-xl border border-emerald-100 animate-in fade-in zoom-in duration-300">
                            <CheckCircle2 size={20} className="text-emerald-500" />
                            <span className="text-sm font-bold text-emerald-700">¡Conectado exitosamente!</span>
                        </div>
                    )}

                    {/* Error Message */}
                    {status === 'error' && error && (
                        <div className="flex items-start gap-2 py-3 px-3 bg-rose-50 rounded-xl border border-rose-100 animate-in fade-in duration-300">
                            <XCircle size={18} className="text-rose-500 shrink-0 mt-0.5" />
                            <span className="text-sm font-medium text-rose-700">{error}</span>
                        </div>
                    )}

                    {/* Connect Button */}
                    <button
                        type="submit"
                        disabled={loading || !slug.trim() || status === 'success'}
                        className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-bold rounded-xl text-base shadow-lg shadow-indigo-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
                    >
                        {status === 'success' ? '¡Conectado!' : loading ? 'Conectando...' : 'Conectar'}
                    </button>
                </form>

                {/* Already configured — go to login */}
                {localStorage.getItem('api_url') && status === 'idle' && (
                    <div className="px-6 pb-5 pt-0">
                        <button
                            onClick={() => navigate('/login')}
                            className="w-full py-2.5 text-sm text-slate-500 hover:text-indigo-600 font-medium transition-colors"
                        >
                            ← Volver al inicio de sesión
                        </button>
                    </div>
                )}
            </div>

            {/* Version */}
            <p className="mt-8 text-indigo-300/50 text-xs font-medium">v2.5</p>
        </div>
    );
};

export default MobileWelcome;
