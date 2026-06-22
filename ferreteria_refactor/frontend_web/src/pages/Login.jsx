import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useConfig } from '../context/ConfigContext';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import {
    Lock, User, LogIn, AlertCircle, Eye, EyeOff, LayoutTemplate,
    Briefcase, MessageCircle, X, Phone, Mail, Send, ShieldCheck,
    Building2, Wifi, Server, HelpCircle
} from 'lucide-react';
import authService from '../services/authService';
import toast from 'react-hot-toast';
import { Capacitor } from '@capacitor/core';
import apiClient from '../config/axios';
import { getDefaultRouteForUser } from '../utils/defaultRoute';

import OrgSelector from './Org/OrgSelector';

const Login = ({ ownerMode = false }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showTenant, setShowTenant] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showContact, setShowContact] = useState(false);
    const [contactForm, setContactForm] = useState({ full_name: '', email: '', phone: '', message: '' });
    const [contactLoading, setContactLoading] = useState(false);

    const { login, user, isAuthenticated, refreshUser, logout, permissions } = useAuth();
    const [showOrgSelector, setShowOrgSelector] = useState(false);
    const [orgCompanies, setOrgCompanies]       = useState([]);
    const { business } = useConfig();
    const navigate = useNavigate();
    const location = useLocation();
    const ownerLogin = ownerMode || location.pathname.startsWith('/owner/login');

    const reason = new URLSearchParams(location.search || '').get('reason');
    const sessionExpired = reason === 'session_expired';

    useEffect(() => {
        if (!loading && isAuthenticated && user) {
            navigate(ownerLogin ? '/owner/dashboard' : getDefaultRouteForUser(user, permissions));
        }
    }, [isAuthenticated, user, loading, ownerLogin, permissions, navigate]);

    useEffect(() => {
        const handleImpersonation = async () => {
            const searchParams = new URLSearchParams(window.location.search);
            const hashString = window.location.hash;
            if (hashString.includes('?')) {
                const hashParams = new URLSearchParams(hashString.split('?')[1]);
                hashParams.forEach((value, key) => {
                    searchParams.append(key, value);
                });
            }

            const token = searchParams.get('impersonate_token');

            if (token) {
                setLoading(true);
                try {
                    await authService.impersonateLogin(token);
                    await refreshUser();

                    const orgData = searchParams.get('org_data');
                    if (orgData) {
                        try {
                            const orgs = JSON.parse(decodeURIComponent(atob(orgData)));
                            if (Array.isArray(orgs) && orgs.length > 0) {
                                localStorage.setItem('org_companies', JSON.stringify(orgs));
                            }
                        } catch (_) {}
                    }

                    toast.success('Sesion iniciada como Soporte/Admin');
                    navigate('/');
                } catch (err) {
                    console.error('Fallo impersonacion:', err);
                    setError('El enlace de acceso es invalido o ha expirado.');
                    toast.error('Error al iniciar sesion con token de acceso');
                } finally {
                    setLoading(false);
                    const newUrl = window.location.pathname + window.location.hash;
                    window.history.replaceState({}, document.title, newUrl);
                }
            }
        };

        handleImpersonation();
    }, []);

    const hostname = window.location.hostname;
    const isIp = /^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$/.test(hostname);
    const isSubdomain = hostname.split('.').length > 2 && !hostname.includes('localhost') && !isIp;
    const tenantName = isSubdomain ? hostname.split('.')[0] : null;

    useEffect(() => {
        if (isSubdomain) {
            const tenantFromUrl = hostname.split('.')[0];
            const currentTenant = localStorage.getItem('selected_tenant');
            if (currentTenant !== `tenant_${tenantFromUrl}` && !currentTenant?.includes(tenantFromUrl)) {
                // Tenant derives from subdomain during submit.
            }
        }
    }, [isSubdomain, hostname]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        if (isSubdomain) {
            const tenantFromUrl = hostname.split('.')[0];
            localStorage.setItem('selected_tenant', tenantFromUrl);
        }

        try {
            const loginData = await login(username, password);
            if (loginData?.has_multiple_companies && loginData?.org_companies?.length > 1) {
                setOrgCompanies(loginData.org_companies);
                setShowOrgSelector(true);
            } else {
                navigate(ownerLogin ? '/owner/dashboard' : '/');
            }
        } catch (err) {
            setError(err.response?.data?.detail || 'Credenciales invalidas. Por favor intenta nuevamente.');
        } finally {
            setLoading(false);
        }
    };

    const handleOrgSelect = (company) => {
        if (company.is_current || !company.switch_url) {
            navigate(ownerLogin ? '/owner/dashboard' : '/');
            return;
        }
        localStorage.setItem('selected_tenant', company.schema_name);
        window.location.href = company.switch_url + '/#/';
    };

    const handleContactSubmit = async (e) => {
        e.preventDefault();
        if (!contactForm.full_name || !contactForm.email || !contactForm.phone || !contactForm.message) {
            toast.error('Por favor completa todos los campos');
            return;
        }
        setContactLoading(true);
        try {
            await apiClient.post('/support/tickets/public-contact', { ...contactForm, source: 'login' });
            toast.success('Mensaje enviado. Te contactaremos pronto.');
            setShowContact(false);
            setContactForm({ full_name: '', email: '', phone: '', message: '' });
        } catch {
            toast.error('Error al enviar el mensaje. Intenta de nuevo.');
        } finally {
            setContactLoading(false);
        }
    };

    if (showOrgSelector) {
        return (
            <OrgSelector
                companies={orgCompanies}
                onSelect={handleOrgSelect}
                onLogout={() => { logout(); setShowOrgSelector(false); }}
                userName={username}
            />
        );
    }

    return (
        <>
            <div className="min-h-screen w-full bg-slate-50 text-slate-950 lg:grid lg:grid-cols-[minmax(460px,0.95fr)_minmax(520px,1.05fr)]">
                <aside className="relative hidden lg:flex min-h-screen overflow-hidden bg-slate-950 text-white">
                    <img
                        src="https://images.unsplash.com/photo-1556761175-5973dc0f32e7?q=80&w=2200&auto=format&fit=crop"
                        alt="Equipo administrando inventario"
                        className="absolute inset-0 h-full w-full object-cover opacity-60"
                    />
                    <div className="absolute inset-0 bg-indigo-950/80" />
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.05)_0%,rgba(15,23,42,0.78)_100%)]" />

                    <div className="relative z-10 flex w-full flex-col justify-between p-10 xl:p-14">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-white/20 bg-white/10 backdrop-blur">
                                    <Briefcase size={24} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-lg font-black leading-none">Mi Inventario</p>
                                    <p className="mt-1 text-xs font-bold uppercase tracking-wide text-indigo-100">Sistema de gestion</p>
                                </div>
                            </div>
                            <span className="rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-black text-indigo-50">
                                QA
                            </span>
                        </div>

                        <div className="max-w-xl space-y-6">
                            <div className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-xs font-black text-indigo-50 backdrop-blur">
                                <Wifi size={14} /> Inventario, POS y multiempresa
                            </div>
                            <div className="space-y-4">
                                <h1 className="text-4xl font-black leading-tight text-white xl:text-5xl">
                                    Control operativo para vender, mover y medir mejor.
                                </h1>
                                <p className="max-w-lg text-base leading-7 text-indigo-100">
                                    {ownerLogin ? 'Centro privado para duenos: empresas, permisos, traslados y administracion global.' : 'Acceso seguro al panel de ventas, inventario, reportes y administracion empresarial en tiempo real.'}
                                </p>
                            </div>
                            <div className="grid grid-cols-3 gap-3 max-w-lg">
                                <div className="rounded-lg border border-white/15 bg-white/10 p-4 backdrop-blur">
                                    <ShieldCheck size={18} className="text-emerald-300" />
                                    <p className="mt-3 text-xs font-black uppercase text-white">Seguro</p>
                                </div>
                                <div className="rounded-lg border border-white/15 bg-white/10 p-4 backdrop-blur">
                                    <Building2 size={18} className="text-indigo-200" />
                                    <p className="mt-3 text-xs font-black uppercase text-white">Multiempresa</p>
                                </div>
                                <div className="rounded-lg border border-white/15 bg-white/10 p-4 backdrop-blur">
                                    <Server size={18} className="text-sky-200" />
                                    <p className="mt-3 text-xs font-black uppercase text-white">En vivo</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between gap-4 text-xs text-indigo-100">
                            <span>{business?.name || 'Mi Inventario'}</span>
                            {tenantName && <span className="font-mono">{tenantName}</span>}
                        </div>
                    </div>
                </aside>

                <main className="min-h-screen flex items-center justify-center px-5 py-8 sm:px-8 lg:px-12 xl:px-20">
                    <div className="w-full max-w-[470px]">
                        <div className="mb-8 flex items-center justify-between gap-4 lg:hidden">
                            <div className="flex items-center gap-3">
                                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-lg shadow-indigo-100">
                                    <Briefcase size={22} />
                                </div>
                                <div>
                                    <p className="text-lg font-black text-slate-950">Mi Inventario</p>
                                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Acceso seguro</p>
                                </div>
                            </div>
                            {tenantName && (
                                <span className="rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-xs font-black text-indigo-700">
                                    {tenantName}
                                </span>
                            )}
                        </div>

                        <section className="rounded-lg border border-slate-200 bg-white shadow-xl shadow-slate-200/70 overflow-hidden">
                            <div className="border-b border-slate-100 p-6 sm:p-7">
                                <div className="mb-5 inline-flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-2 text-xs font-black text-indigo-700 border border-indigo-100">
                                    <ShieldCheck size={14} /> {ownerLogin ? 'Acceso de dueno' : 'Acceso protegido'}
                                </div>
                                <h2 className="text-3xl font-black text-slate-950">{ownerLogin ? 'Portal empresarial' : 'Bienvenido de nuevo'}</h2>
                                <p className="mt-2 text-sm leading-6 text-slate-500">
                                    {ownerLogin ? 'Ingresa con la cuenta duena para administrar tus empresas.' : <>Ingresa a <span className="font-black text-indigo-600">{business?.name || 'Mi Inventario'}</span> para continuar tu operacion.</>}
                                </p>
                            </div>

                            <form onSubmit={handleSubmit} className="p-6 sm:p-7 space-y-5">
                                {sessionExpired && !error && (
                                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-start gap-3">
                                        <AlertCircle className="shrink-0 mt-0.5" size={16} />
                                        <p>Tu sesion expiro por seguridad. Inicia sesion nuevamente para continuar.</p>
                                    </div>
                                )}

                                {error && (
                                    <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 flex items-start gap-3">
                                        <AlertCircle className="shrink-0 mt-0.5" size={16} />
                                        <p>{error}</p>
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <label className="text-sm font-black text-slate-700" htmlFor="username">Correo</label>
                                    <div className="relative group">
                                        <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                                        <input
                                            id="username"
                                            type="text"
                                            className="h-12 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-4 text-sm font-semibold text-slate-900 placeholder:text-slate-400 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                                            placeholder="correo@empresa.com"
                                            value={username}
                                            onChange={(e) => setUsername(e.target.value)}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between gap-3">
                                        <label className="text-sm font-black text-slate-700" htmlFor="password">Contrasena</label>
                                        <Link to="/forgot-password" className="text-xs font-black text-indigo-600 hover:text-indigo-700 hover:underline">
                                            Olvide mi contrasena
                                        </Link>
                                    </div>
                                    <div className="relative group">
                                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                                        <input
                                            id="password"
                                            type={showPassword ? 'text' : 'password'}
                                            className="h-12 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-11 text-sm font-semibold text-slate-900 placeholder:text-slate-400 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                                            placeholder="Tu contrasena"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-700"
                                            title={showPassword ? 'Ocultar contrasena' : 'Ver contrasena'}
                                        >
                                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 text-sm font-black text-white shadow-lg shadow-indigo-100 transition-all hover:bg-indigo-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
                                >
                                    {loading ? <div className="h-5 w-5 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : <><span>Ingresar</span><LogIn size={18} /></>}
                                </button>
                            </form>

                            <div className="border-t border-slate-100 bg-slate-50 px-6 py-5 sm:px-7 space-y-4">
                                {!isSubdomain && (
                                    <div>
                                        <button
                                            onClick={() => setShowTenant(!showTenant)}
                                            className="mx-auto flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold text-slate-500 hover:bg-white hover:text-slate-700 transition-colors"
                                        >
                                            <LayoutTemplate size={13} />
                                            <span>{showTenant ? 'Ocultar empresa local' : 'Configurar empresa local'}</span>
                                        </button>

                                        {showTenant && (
                                            <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
                                                <label className="block text-xs font-black uppercase tracking-wide text-slate-500 mb-1.5">Tenant ID</label>
                                                <input
                                                    type="text"
                                                    className="w-full rounded-lg border border-slate-200 bg-white p-2 text-sm outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                                                    placeholder="public"
                                                    defaultValue={localStorage.getItem('selected_tenant') || ''}
                                                    onChange={(e) => {
                                                        const val = e.target.value.trim();
                                                        if (val) localStorage.setItem('selected_tenant', val);
                                                        else localStorage.removeItem('selected_tenant');
                                                    }}
                                                />
                                                <p className="mt-1 text-[10px] text-slate-400">Usado para desarrollo local.</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-slate-500">
                                    <button
                                        type="button"
                                        onClick={() => setShowContact(true)}
                                        className="inline-flex items-center justify-center gap-1.5 font-bold text-slate-500 hover:text-indigo-600 transition-colors"
                                    >
                                        <HelpCircle size={14} /> Necesito ayuda
                                    </button>
                                    {Capacitor.isNativePlatform() && (
                                        <Link to="/mobile-welcome" className="inline-flex items-center justify-center gap-2 font-bold text-indigo-600 hover:text-indigo-700 transition-colors">
                                            <LayoutTemplate size={14} /> Cambiar servidor
                                        </Link>
                                    )}
                                </div>
                            </div>
                        </section>

                        <p className="mt-5 text-center text-xs font-semibold text-slate-400">
                            {new Date().getFullYear()} {business?.name || 'Mi Inventario'}
                        </p>
                    </div>
                </main>
            </div>

            {showContact && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm">
                    <div className="w-full max-w-md overflow-hidden rounded-lg bg-white shadow-2xl">
                        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600 text-white">
                                    <MessageCircle size={20} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-slate-900">Contactar soporte</h3>
                                    <p className="text-xs text-slate-500">Cuentanos que necesitas revisar.</p>
                                </div>
                            </div>
                            <button onClick={() => setShowContact(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-700">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleContactSubmit} className="space-y-3 p-5">
                            <input
                                type="text"
                                placeholder="Nombre completo"
                                value={contactForm.full_name}
                                onChange={e => setContactForm(f => ({ ...f, full_name: e.target.value }))}
                                className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none transition-colors focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                required
                            />
                            <div className="relative">
                                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="email"
                                    placeholder="Correo electronico"
                                    value={contactForm.email}
                                    onChange={e => setContactForm(f => ({ ...f, email: e.target.value }))}
                                    className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-4 text-sm outline-none transition-colors focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                    required
                                />
                            </div>
                            <div className="relative">
                                <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="tel"
                                    placeholder="Telefono"
                                    value={contactForm.phone}
                                    onChange={e => setContactForm(f => ({ ...f, phone: e.target.value }))}
                                    className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-4 text-sm outline-none transition-colors focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                    required
                                />
                            </div>
                            <textarea
                                placeholder="En que podemos ayudarte?"
                                value={contactForm.message}
                                onChange={e => setContactForm(f => ({ ...f, message: e.target.value }))}
                                rows={4}
                                className="w-full resize-none rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none transition-colors focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                required
                            />
                            <button
                                type="submit"
                                disabled={contactLoading}
                                className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-3 text-sm font-black text-white transition-colors hover:bg-indigo-700 disabled:opacity-60"
                            >
                                {contactLoading ? 'Enviando...' : <><Send size={14} /> Enviar mensaje</>}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
};

export default Login;
