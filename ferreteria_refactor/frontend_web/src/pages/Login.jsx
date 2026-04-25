import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useConfig } from '../context/ConfigContext';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, User, LogIn, AlertCircle, Eye, EyeOff, LayoutTemplate, Briefcase, MessageCircle, X, Phone, Mail, Send } from 'lucide-react';
import authService from '../services/authService';
import toast from 'react-hot-toast';
import { Capacitor } from '@capacitor/core';
import apiClient from '../config/axios';

import OrgSelector from './Org/OrgSelector';

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showTenant, setShowTenant] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showContact, setShowContact] = useState(false);
    const [contactForm, setContactForm] = useState({ full_name: '', email: '', phone: '', message: '' });
    const [contactLoading, setContactLoading] = useState(false);

    const { login, user, isAuthenticated, refreshUser, logout } = useAuth();
    const [showOrgSelector, setShowOrgSelector] = useState(false);
    const [orgCompanies, setOrgCompanies]       = useState([]);
    const { business } = useConfig();
    const navigate = useNavigate();

    // Redirect if already authenticated
    useEffect(() => {
        if (!loading && isAuthenticated && user) {
            navigate('/');
        }
    }, [isAuthenticated, user, loading]);

    // 🕵️ IMPERSONATION HANDLER
    useEffect(() => {
        const handleImpersonation = async () => {
            // 🔍 Extract parameters from BOTH standard URL and Hash URL
            // Case 1: domain.com/?impersonate_token=XYZ#/login
            const searchParams = new URLSearchParams(window.location.search);

            // Case 2: domain.com/#/login?impersonate_token=XYZ (Hash Router style)
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
                    // 1. Exchange Token for HttpOnly Cookie
                    await authService.impersonateLogin(token);

                    // 2. Refresh User Profile (checks cookie)
                    await refreshUser();

                    // 3. Restaurar org_companies si vienen en la URL (switch entre dominios)
                    const orgData = searchParams.get('org_data');
                    if (orgData) {
                        try {
                            const orgs = JSON.parse(decodeURIComponent(atob(orgData)));
                            if (Array.isArray(orgs) && orgs.length > 0) {
                                localStorage.setItem('org_companies', JSON.stringify(orgs));
                            }
                        } catch (_) {}
                    }

                    toast.success('Sesión iniciada como Soporte/Admin');
                    navigate('/');

                } catch (err) {
                    console.error("Fallo impersonación:", err);
                    setError('El enlace de acceso es inválido o ha expirado.');
                    toast.error('Error al iniciar sesión con token de acceso');
                } finally {
                    setLoading(false);
                    // Clear URL params but PRESERVE HASH
                    const newUrl = window.location.pathname + window.location.hash;
                    window.history.replaceState({}, document.title, newUrl);
                }
            }
        };

        handleImpersonation();
    }, []);

    // Tenant logic (preserved)
    const hostname = window.location.hostname;
    const isIp = /^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$/.test(hostname);
    const isSubdomain = hostname.split('.').length > 2 && !hostname.includes('localhost') && !isIp;

    // Derived Tenant Auto-Sync
    useEffect(() => {
        if (isSubdomain) {
            const tenantFromUrl = hostname.split('.')[0];
            const currentTenant = localStorage.getItem('selected_tenant');
            if (currentTenant !== `tenant_${tenantFromUrl}` && !currentTenant?.includes(tenantFromUrl)) {
                // console.log("Auto-setting derived tenant from subdomain:", tenantFromUrl);
            }
        }
    }, [isSubdomain, hostname]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        // 🔄 SYNC TENANT FROM SUBDOMAIN BEFORE LOGIN
        if (isSubdomain) {
            const tenantFromUrl = hostname.split('.')[0];
            localStorage.setItem('selected_tenant', tenantFromUrl);
        }

        try {
            const loginData = await login(username, password);
            // Multi-empresa: si el usuario tiene varias empresas → mostrar selector
            if (loginData?.has_multiple_companies && loginData?.org_companies?.length > 1) {
                setOrgCompanies(loginData.org_companies);
                setShowOrgSelector(true);
            } else {
                navigate('/');
            }
        } catch (err) {
            setError(err.response?.data?.detail || 'Credenciales inválidas. Por favor intenta nuevamente.');
        } finally {
            setLoading(false);
        }
    };

    const handleOrgSelect = (company) => {
        // Si ya estamos en esa empresa → ir al dashboard
        if (company.is_current || !company.switch_url) {
            navigate('/');
            return;
        }
        // Ir al subdominio de la empresa seleccionada
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
            toast.success('¡Mensaje enviado! Te contactaremos pronto.');
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
        <div className="min-h-screen w-full flex bg-white">

            {/* LEFT SIDE: Image & Branding (50%) - Hidden on mobile */}
            <div className="hidden lg:flex lg:w-1/2 relative bg-slate-900 overflow-hidden">
                <div className="absolute inset-0 bg-indigo-900/20 z-10"></div>
                {/* Background Image */}
                <img
                    src="https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=2301&auto=format&fit=crop"
                    alt="Office Background"
                    className="absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-overlay"
                />

                {/* Overlay Gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/50 to-transparent z-20"></div>

                {/* Content over image */}
                <div className="relative z-30 flex flex-col justify-between p-12 w-full h-full">
                    {/* Logo Area */}
                    <div className="flex items-center gap-3">
                        <div className="bg-white/10 backdrop-blur-md p-2.5 rounded-xl border border-white/20">
                            <Briefcase className="text-white" size={24} />
                        </div>
                        <span className="text-white text-xl tracking-wide font-medium">
                            Mi<span className="font-bold">Inventario</span>
                        </span>
                    </div>

                    {/* Quote / Testimonial */}
                    <div className="max-w-lg mb-12">
                        <div className="flex gap-1 mb-4">
                            {[1, 2, 3, 4, 5].map(i => (
                                <svg key={i} className="w-5 h-5 text-yellow-400 fill-current" viewBox="0 0 24 24">
                                    <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                                </svg>
                            ))}
                        </div>
                        <h2 className="text-3xl font-bold text-white mb-4 leading-tight">
                            "La solución definitiva para el control total de tu Inventario y Punto de Venta."
                        </h2>
                        <p className="text-slate-300 text-lg">
                            Optimiza tus ventas, gestiona tu stock en tiempo real y haz crecer tu negocio con tecnología simple y potente.
                        </p>
                    </div>
                </div>
            </div>

            {/* RIGHT SIDE: Login Form (50%) */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 lg:p-24 bg-white relative">
                <div className="w-full max-w-[400px] space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

                    {/* Header Text */}
                    <div className="text-center lg:text-left space-y-2">
                        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                            Bienvenido de nuevo
                        </h1>
                        <p className="text-slate-500">
                            Ingresa tus credenciales para acceder a <span className="text-indigo-600 font-semibold">{business?.name || 'Mi Inventario'}</span>.
                        </p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-5">

                        {/* Error Alert */}
                        {error && (
                            <div className="bg-rose-50 border border-rose-200 text-rose-600 px-4 py-3 rounded-xl flex items-start gap-3 text-sm animate-in slide-in-from-top-2">
                                <AlertCircle className="shrink-0 mt-0.5" size={16} />
                                <p>{error}</p>
                            </div>
                        )}

                        <div className="space-y-4">
                            {/* Username */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700" htmlFor="username">
                                    Correo
                                </label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <User className="text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                                    </div>
                                    <input
                                        id="username"
                                        type="text"
                                        className="h-12 w-full pl-10 pr-4 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-medium"
                                        placeholder="Ej: correo@empresa.com"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>

                            {/* Password */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-sm font-medium text-slate-700" htmlFor="password">
                                        Contraseña
                                    </label>
                                    <Link to="/forgot-password" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:underline">
                                        ¿Olvidaste tu contraseña?
                                    </Link>
                                </div>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Lock className="text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                                    </div>
                                    <input
                                        id="password"
                                        type={showPassword ? "text" : "password"}
                                        className="h-12 w-full pl-10 pr-10 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-medium"
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 hover:shadow-indigo-300 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <span>Ingresar</span>
                                    <LogIn size={18} />
                                </>
                            )}
                        </button>
                    </form>

                    {/* Footer / Tenant Toggle */}
                    <div className="pt-6 border-t border-slate-100 flex flex-col gap-4">

                        {/* Tenant ID (Collapsible for Dev) */}
                        {!isSubdomain && (
                            <div className="w-full">
                                <button
                                    onClick={() => setShowTenant(!showTenant)}
                                    className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-600 transition-colors mx-auto"
                                >
                                    <LayoutTemplate size={12} />
                                    <span>{showTenant ? 'Ocultar' : 'Configurar'} ID de Empresa</span>
                                </button>

                                {showTenant && (
                                    <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200 animate-in slide-in-from-top-2">
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                                            Tenant ID (Desarrollo)
                                        </label>
                                        <input
                                            type="text"
                                            className="w-full text-sm p-2 bg-white rounded-lg border border-slate-200 focus:border-indigo-500 focus:outline-none transition-colors"
                                            placeholder="public"
                                            defaultValue={localStorage.getItem('selected_tenant') || ''}
                                            onChange={(e) => {
                                                const val = e.target.value.trim();
                                                if (val) localStorage.setItem('selected_tenant', val);
                                                else localStorage.removeItem('selected_tenant');
                                            }}
                                        />
                                        <p className="text-[10px] text-slate-400 mt-1">
                                            Usado para simular multi-tenancy local.
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* CONTACT SUPPORT BUTTON */}
                        <div className="w-full flex justify-center pt-1">
                            <button
                                type="button"
                                onClick={() => setShowContact(true)}
                                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-indigo-500 transition-colors"
                            >
                                <MessageCircle size={13} />
                                ¿Necesitas ayuda? Contáctanos
                            </button>
                        </div>

                        {/* MOBILE CONFIG BUTTON (Only visible on Native App) */}
                        {Capacitor.isNativePlatform() && (
                            <>
                                <div className="w-full flex justify-center pt-2">
                                    <Link to="/mobile-welcome" className="flex items-center gap-2 text-xs text-indigo-500 hover:text-indigo-700 font-medium transition-colors">
                                        <LayoutTemplate size={14} />
                                        ⚙️ Cambiar Servidor
                                    </Link>
                                </div>

                                <div className="mt-4 text-center opacity-50">
                                    <p className="text-xs text-slate-400">
                                        © {new Date().getFullYear()} {business?.name || 'Mi Inventario'}
                                    </p>
                                    <p className="text-[10px] text-indigo-400 mt-1 font-mono">
                                        v2.5 Mobile
                                    </p>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
        {/* CONTACT MODAL */}
        {showContact && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 relative">
                    <button onClick={() => setShowContact(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
                        <X size={20} />
                    </button>
                    <div className="flex items-center gap-3 mb-5">
                        <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                            <MessageCircle size={20} className="text-indigo-600" />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800 text-lg">Contactar soporte</h3>
                            <p className="text-xs text-slate-400">Te respondemos a la brevedad</p>
                        </div>
                    </div>
                    <form onSubmit={handleContactSubmit} className="space-y-3">
                        <input
                            type="text"
                            placeholder="Nombre completo *"
                            value={contactForm.full_name}
                            onChange={e => setContactForm(f => ({ ...f, full_name: e.target.value }))}
                            className="w-full text-sm px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-400 transition-colors"
                            required
                        />
                        <div className="relative">
                            <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="email"
                                placeholder="Correo electrónico *"
                                value={contactForm.email}
                                onChange={e => setContactForm(f => ({ ...f, email: e.target.value }))}
                                className="w-full text-sm pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-400 transition-colors"
                                required
                            />
                        </div>
                        <div className="relative">
                            <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="tel"
                                placeholder="Teléfono *"
                                value={contactForm.phone}
                                onChange={e => setContactForm(f => ({ ...f, phone: e.target.value }))}
                                className="w-full text-sm pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-400 transition-colors"
                                required
                            />
                        </div>
                        <textarea
                            placeholder="¿En qué podemos ayudarte? *"
                            value={contactForm.message}
                            onChange={e => setContactForm(f => ({ ...f, message: e.target.value }))}
                            rows={3}
                            className="w-full text-sm px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-400 transition-colors resize-none"
                            required
                        />
                        <button
                            type="submit"
                            disabled={contactLoading}
                            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-60"
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
