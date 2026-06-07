import { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from '../config/axios';
import { toast } from 'react-hot-toast';
import {
    Mail,
    ArrowLeft,
    Loader2,
    ShieldCheck,
    Briefcase,
    CheckCircle2,
    HelpCircle,
} from 'lucide-react';

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
            toast.success('Solicitud enviada');
        } catch (error) {
            console.error('Error in forgot password:', error);
            toast.error(error.response?.data?.detail || 'Error al procesar la solicitud');
        } finally {
            setLoading(false);
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
                            <h1 className="text-3xl font-black leading-tight">Recuperacion segura</h1>
                        </div>
                    </div>

                    <div className="max-w-md space-y-5">
                        <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-blue-100">
                            <ShieldCheck size={15} /> Cuenta protegida
                        </div>
                        <h2 className="text-4xl font-black leading-tight">Vuelve a entrar sin perder el ritmo de operacion.</h2>
                        <p className="text-base leading-7 text-blue-100/85">
                            Enviaremos un enlace al correo registrado para que puedas crear una nueva clave y volver al sistema.
                        </p>
                    </div>
                </div>
            </aside>

            <main className="flex min-h-screen items-center justify-center px-4 py-8 sm:px-8 lg:px-12">
                <section className="w-full max-w-[480px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-200/70">
                    <header className="border-b border-slate-100 p-6 sm:p-7">
                        <Link to="/login" className="mb-6 inline-flex items-center gap-2 text-sm font-black text-slate-500 transition hover:text-indigo-600">
                            <ArrowLeft size={17} /> Volver al login
                        </Link>
                        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-100">
                            {submitted ? <CheckCircle2 size={24} /> : <Mail size={24} />}
                        </div>
                        <h1 className="mt-5 text-3xl font-black tracking-tight text-slate-950">
                            {submitted ? 'Revisa tu correo' : 'Recuperar contrasena'}
                        </h1>
                        <p className="mt-2 text-sm leading-6 text-slate-500">
                            {submitted
                                ? `Si ${email} esta registrado, recibira un enlace de recuperacion en unos minutos.`
                                : 'Escribe el correo de tu usuario y te enviaremos un enlace para crear una nueva clave.'}
                        </p>
                    </header>

                    {submitted ? (
                        <div className="space-y-4 p-6 sm:p-7">
                            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
                                El enlace puede tardar unos minutos. Revisa tambien spam o promociones.
                            </div>
                            <Link
                                to="/login"
                                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 text-sm font-black text-white shadow-lg shadow-indigo-100 transition hover:bg-indigo-700"
                            >
                                Ir al inicio de sesion
                            </Link>
                        </div>
                    ) : (
                        <form className="space-y-5 p-6 sm:p-7" onSubmit={handleSubmit}>
                            <div className="space-y-2">
                                <label htmlFor="email-address" className="text-sm font-black text-slate-700">Correo</label>
                                <div className="relative group">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500" size={18} />
                                    <input
                                        id="email-address"
                                        name="email"
                                        type="email"
                                        autoComplete="email"
                                        required
                                        className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                                        placeholder="correo@empresa.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 text-sm font-black text-white shadow-lg shadow-indigo-100 transition hover:bg-indigo-700 disabled:opacity-60"
                            >
                                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Enviar enlace'}
                            </button>

                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs font-semibold leading-5 text-slate-500">
                                <div className="mb-1 flex items-center gap-2 font-black text-slate-700">
                                    <HelpCircle size={14} /> Consejo
                                </div>
                                Usa el mismo correo con el que entras normalmente al POS o al panel administrativo.
                            </div>
                        </form>
                    )}
                </section>
            </main>
        </div>
    );
}
