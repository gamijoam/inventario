/**
 * IntegracionesTab.jsx
 * Tab de configuración de integraciones externas.
 * Actualmente: BloqueCelular (sistema de bloqueo de celulares a crédito)
 */

import React, { useState, useEffect } from 'react';
import { Lock, CheckCircle2, XCircle, RefreshCw, ExternalLink, Smartphone, Save } from 'lucide-react';
import apiClient from '../../../config/axios';
import { toast } from 'react-hot-toast';

export default function IntegracionesTab() {
    const [estado, setEstado]       = useState(null);
    const [loading, setLoading]     = useState(true);
    const [form, setForm]           = useState({ email: '', password: '' });
    const [conectando, setConectando] = useState(false);
    const [mostrarPass, setMostrarPass] = useState(false);

    // Cargar estado actual de la integración
    const cargarEstado = async () => {
        setLoading(true);
        try {
            const r = await apiClient.get('/bloqueo/config/estado');
            setEstado(r.data);
        } catch {
            setEstado(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { cargarEstado(); }, []);

    // Conectar BloqueCelular
    const conectar = async () => {
        if (!form.email || !form.password) {
            toast.error('Ingresa el email y la contraseña');
            return;
        }
        setConectando(true);
        try {
            const r = await apiClient.post('/bloqueo/config/conectar', {
                email   : form.email,
                password: form.password,
            });
            toast.success(r.data?.mensaje || '✅ Conectado correctamente');
            setForm({ email: '', password: '' });
            cargarEstado();
        } catch (e) {
            toast.error(e.response?.data?.detail || 'Error al conectar con BloqueCelular');
        } finally {
            setConectando(false);
        }
    };

    // Desconectar
    const desconectar = async () => {
        if (!confirm('¿Desactivar la integración con BloqueCelular?')) return;
        try {
            await apiClient.post('/bloqueo/config/desconectar');
            toast.success('Integración desactivada');
            cargarEstado();
        } catch {
            toast.error('Error al desconectar');
        }
    };

    return (
        <div className="space-y-6 max-w-2xl">
            <div>
                <h2 className="text-lg font-black text-slate-800 mb-1">Integraciones</h2>
                <p className="text-sm text-slate-400">Conecta Mi Inventario con sistemas externos.</p>
            </div>

            {/* ── Tarjeta BloqueCelular ── */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">

                {/* Header */}
                <div className="flex items-center gap-4 p-5 border-b border-slate-100">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
                        <Lock className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-bold text-slate-800">BloqueCelular</h3>
                        <p className="text-xs text-slate-400">
                            Sistema de bloqueo remoto para celulares vendidos a crédito
                        </p>
                    </div>
                    {loading ? (
                        <RefreshCw className="w-4 h-4 text-slate-400 animate-spin" />
                    ) : estado?.enabled ? (
                        <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Conectado
                        </span>
                    ) : (
                        <span className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 text-slate-500 border border-slate-200 rounded-full text-xs font-bold">
                            <XCircle className="w-3.5 h-3.5" /> No conectado
                        </span>
                    )}
                </div>

                <div className="p-5 space-y-4">

                    {/* Estado conectado */}
                    {estado?.enabled && (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-2">
                            <p className="text-sm font-bold text-emerald-800">
                                ✅ Integración activa
                            </p>
                            <div className="grid grid-cols-2 gap-3 text-xs">
                                <div>
                                    <p className="text-emerald-600 font-medium">Cuenta conectada</p>
                                    <p className="text-emerald-800 font-bold">{estado.email}</p>
                                </div>
                                <div>
                                    <p className="text-emerald-600 font-medium">Tienda en BloqueCelular</p>
                                    <p className="text-emerald-800 font-bold">{estado.tenant_id || '—'}</p>
                                </div>
                                <div>
                                    <p className="text-emerald-600 font-medium">Token JWT</p>
                                    <p className="text-emerald-800 font-bold">
                                        {estado.token_vigente ? '✅ Vigente' : '⚠️ Expirado'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-emerald-600 font-medium">APK disponible</p>
                                    <a
                                        href={estado.apk_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-indigo-600 font-bold flex items-center gap-1 hover:underline"
                                    >
                                        <Smartphone className="w-3 h-3" />
                                        Descargar
                                        <ExternalLink className="w-3 h-3" />
                                    </a>
                                </div>
                            </div>
                            <button
                                onClick={desconectar}
                                className="mt-2 text-xs font-semibold text-red-600 hover:text-red-700 hover:underline"
                            >
                                Desconectar integración
                            </button>
                        </div>
                    )}

                    {/* Cómo funciona */}
                    {!estado?.enabled && (
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                            <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">¿Cómo funciona?</p>
                            <ul className="space-y-1.5 text-xs text-slate-600">
                                {[
                                    'Al registrar una venta a crédito de un celular, el sistema genera automáticamente un código BLC-XXXX',
                                    'El técnico instala la app BloqueCelular en el celular del cliente e ingresa ese código',
                                    'Si el cliente no paga, puedes bloquear el equipo remotamente desde la vista de créditos',
                                    'Cuando el cliente paga, desbloqueas el equipo con un clic',
                                ].map((item, i) => (
                                    <li key={i} className="flex items-start gap-2">
                                        <span className="w-4 h-4 rounded-full bg-indigo-600 text-white text-[9px] font-black flex items-center justify-center shrink-0 mt-0.5">
                                            {i+1}
                                        </span>
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Formulario de conexión */}
                    <div className="space-y-3">
                        <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                            {estado?.enabled ? 'Reconectar con otra cuenta' : 'Conectar con BloqueCelular'}
                        </p>
                        <p className="text-xs text-slate-400">
                            Ingresa las credenciales de tu cuenta en{' '}
                            <a href="https://bloqueo.miinventariofacil.com/admin/"
                               target="_blank" rel="noopener noreferrer"
                               className="text-indigo-600 hover:underline">
                                bloqueo.miinventariofacil.com
                            </a>
                        </p>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1.5">
                                    Email de administrador
                                </label>
                                <input
                                    type="email"
                                    value={form.email}
                                    onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                                    placeholder="admin@tutienda.com"
                                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-400 text-sm outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1.5">
                                    Contraseña
                                </label>
                                <div className="relative">
                                    <input
                                        type={mostrarPass ? 'text' : 'password'}
                                        value={form.password}
                                        onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                                        onKeyDown={e => e.key === 'Enter' && conectar()}
                                        placeholder="••••••••"
                                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-400 text-sm outline-none pr-10"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setMostrarPass(v => !v)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                                    >
                                        {mostrarPass ? 'Ocultar' : 'Ver'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={conectar}
                            disabled={conectando || !form.email || !form.password}
                            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-60"
                        >
                            {conectando
                                ? <RefreshCw className="w-4 h-4 animate-spin" />
                                : <Save className="w-4 h-4" />
                            }
                            {conectando ? 'Conectando...' : (estado?.enabled ? 'Reconectar' : 'Conectar BloqueCelular')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
