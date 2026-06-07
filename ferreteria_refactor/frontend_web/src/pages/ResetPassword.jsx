import { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import axios from '../config/axios';
import { toast } from 'react-hot-toast';
import {
    Lock,
    Eye,
    EyeOff,
    Loader2,
    CheckCircle2,
    ArrowLeft,
    ShieldCheck,
    Briefcase,
    AlertCircle,
    KeyRound,
} from 'lucide-react';

export default function ResetPassword() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const getTokenFromUrl = () => {
        const tokenFromParams = searchParams.get('token');
        if (tokenFromParams) return tokenFromParams;

        const urlParams = new URLSearchParams(window.location.search);
        const tokenFromWindow = urlParams.get('token');
        if (tokenFromWindow) return tokenFromWindow;

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

    const passwordReady = password.length >= 6 && password === confirmPassword;

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!token) {
            setTokenError(true);
            toast.error('Token no encontrado. Solicita un nuevo enlace de recuperacion.');
            return;
        }

        if (password !== confirmPassword) {
            toast.error('Las contrasenas no coinciden');
            return;
        }

        setLoading(true);
        setTokenError(false);

        try {
            const res = await axios.post('auth/reset-password', {
                token,
                new_password: password,
            });
            setLoginUrl(res.data?.login_url || null);
            setSuccess(true);
            toast.success('Contrasena actualizada');
        } catch (error) {
            console.error('Error resetting password:', error);
            const errorMessage = error.response?.data?.detail || 'Error al restablecer la contrasena';
            if (error.response?.status === 400 || error.response?.status === 404) {
                setTokenError(true);
            }
            toast.error(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const goToLogin = () => {
        if (loginUrl) {
            window.location.href = loginUrl;
        } else {
            navigate('/login');
        }
    };

    return (
        <div className="min-h-screen bg-slate-100 text-slate-950 lg:grid lg:grid-cols-[minmax(420px,0.9fr)_minmax(520px,1.1fr)]">
            <aside className="relative hidden overflow-hidden bg-[#101a3a] text-white lg:block">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_20%,rgba(79,70,229,0.45),transparent_32%),linear-gradient(145deg,rgba(37,99,235,0.18),transparent_44%)]" />
                <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#0b1024] to-transparent" />
                <div className="relative flex h-full flex-col justify-between p-12">
                    <div className="flex items-center gap-4">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/15 bg-white/10 shadow-2xl shadow-blue-950/40">
                            <Briefcase size={27} />
                        </div>
                        <div>
                            <p className="text-sm font-black uppercase tracking-[0.22em] text-blue-200">MiInventario</p>
                            <h1 className="text-3xl font-black leading-tight">Nueva clave</h1>
                        </div>
                    </div>

                    <div className="max-w-md space-y-5">
                        <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-blue-100">
                            <ShieldCheck size={15} /> Acceso verificado
                        </div>
                        <h2 className="text-4xl font-black leading-tight">Crea una clave nueva y vuelve a operar.</h2>
                        <p className="text-base leading-7 text-blue-100/85">
                            El enlace se usa una sola vez. Si expiro, solicita uno nuevo desde recuperacion de cuenta.
                        </p>
                    </div>
                </div>
            </aside>

            <main className="flex min-h-screen items-center justify-center px-4 py-8 sm:px-8 lg:px-12">
                <section className="w-full max-w-[500px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-200/70">
                    <header className="border-b border-slate-100 p-6 sm:p-7">
                        {!success && (
                            <Link to="/login" className="mb-6 inline-flex items-center gap-2 text-sm font-black text-slate-500 transition hover:text-indigo-600">
                                <ArrowLeft size={17} /> Volver al login
                            </Link>
                        )}
                        <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-lg ${success ? 'bg-emerald-600 shadow-emerald-100' : 'bg-indigo-600 shadow-indigo-100'}`}>
                            {success ? <CheckCircle2 size={24} /> : <KeyRound size={24} />}
                        </div>
                        <h1 className="mt-5 text-3xl font-black tracking-tight text-slate-950">
                            {success ? 'Contrasena actualizada' : 'Restablecer contrasena'}
                        </h1>
                        <p className="mt-2 text-sm leading-6 text-slate-500">
                            {success
                                ? 'Ya puedes iniciar sesion con tu nueva clave.'
                                : 'Elige una clave segura para tu cuenta. Debe tener al menos 6 caracteres.'}
                        </p>
                    </header>

                    {success ? (
                        <div className="space-y-4 p-6 sm:p-7">
                            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
                                La proxima vez que entres, usa esta nueva contrasena.
                            </div>
                            <button
                                onClick={goToLogin}
                                className="flex h-12 w-full items-center justify-center rounded-xl bg-indigo-600 text-sm font-black text-white shadow-lg shadow-indigo-100 transition hover:bg-indigo-700"
                            >
                                Ir al inicio de sesion
                            </button>
                        </div>
                    ) : (
                        <form className="space-y-5 p-6 sm:p-7" onSubmit={handleSubmit}>
                            {tokenError && (
                                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                                    <div className="flex items-start gap-3">
                                        <AlertCircle size={17} className="mt-0.5 shrink-0" />
                                        <p>
                                            El enlace de recuperacion es invalido o expiro.
                                            <Link to="/forgot-password" className="ml-1 font-black underline">Solicita uno nuevo.</Link>
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="text-sm font-black text-slate-700">Nueva contrasena</label>
                                <div className="relative group">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500" size={18} />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        required
                                        className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-11 text-sm font-semibold text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                                        placeholder="Nueva clave"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        minLength={6}
                                    />
                                    <button
                                        type="button"
                                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 transition hover:bg-slate-50 hover:text-slate-700"
                                        onClick={() => setShowPassword(!showPassword)}
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-black text-slate-700">Confirmar contrasena</label>
                                <div className="relative group">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500" size={18} />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        required
                                        className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                                        placeholder="Repite la clave"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        minLength={6}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-xs font-black">
                                <div className={`rounded-xl border p-3 ${password.length >= 6 ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                                    Minimo 6 caracteres
                                </div>
                                <div className={`rounded-xl border p-3 ${password && password === confirmPassword ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                                    Coinciden
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading || !passwordReady}
                                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 text-sm font-black text-white shadow-lg shadow-indigo-100 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Actualizar contrasena'}
                            </button>
                        </form>
                    )}
                </section>
            </main>
        </div>
    );
}
