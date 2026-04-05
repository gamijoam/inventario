/**
 * BloqueoCelular.jsx
 * Panel de control del sistema de bloqueo de celulares a crédito.
 *
 * Muestra en la vista de detalle de una venta a crédito:
 *  - Código BLC-XXXX para activar la app en el celular del cliente
 *  - Link + QR del APK para que el técnico lo instale
 *  - Estado actual del dispositivo (activo / bloqueado / liberado / sin activar)
 *  - Botones de bloquear / desbloquear / regenerar código
 *
 * Requiere que la integración esté habilitada en Configuración → Integraciones.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    Lock, Unlock, Smartphone, Download, RefreshCw,
    QrCode, Copy, CheckCircle2, XCircle, AlertTriangle,
    Info, ChevronDown, ChevronUp, ExternalLink
} from 'lucide-react';
import apiClient from '../../config/axios';
import { toast } from 'react-hot-toast';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ESTADO_CONFIG = {
    activo    : { label: 'Activo',      color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2, dot: 'bg-emerald-500' },
    bloqueado : { label: 'Bloqueado',   color: 'bg-red-100 text-red-700 border-red-200',             icon: Lock,         dot: 'bg-red-500'     },
    liberado  : { label: 'Liberado',    color: 'bg-slate-100 text-slate-600 border-slate-200',       icon: CheckCircle2, dot: 'bg-slate-400'   },
    sin_activar:{ label: 'Sin activar', color: 'bg-amber-100 text-amber-700 border-amber-200',       icon: AlertTriangle,dot: 'bg-amber-500'   },
};

function EstadoBadge({ estado }) {
    const cfg = ESTADO_CONFIG[estado] || ESTADO_CONFIG['sin_activar'];
    const Icon = cfg.icon;
    return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${cfg.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
        </span>
    );
}

// ─── Componente QR simple (usando API pública) ─────────────────────────────────

function QRCode({ url, size = 120 }) {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(url)}&size=${size}x${size}&bgcolor=ffffff`;
    return (
        <img
            src={qrUrl}
            alt="QR APK BloqueCelular"
            className="rounded-xl border border-slate-200"
            width={size}
            height={size}
        />
    );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function BloqueoCelular({ saleId, isCredit }) {
    const [estado, setEstado]         = useState(null);
    const [apkUrl, setApkUrl]         = useState('');
    const [loading, setLoading]       = useState(true);
    const [expanded, setExpanded]     = useState(false);
    const [accionando, setAccionando] = useState(false);
    const [copiado, setCopiado]       = useState(false);
    const [habilitado, setHabilitado] = useState(false);

    // Verificar si la integración está habilitada
    useEffect(() => {
        apiClient.get('/bloqueo/config/estado')
            .then(r => setHabilitado(r.data?.enabled === true))
            .catch(() => setHabilitado(false));

        apiClient.get('/bloqueo/apk-url')
            .then(r => setApkUrl(r.data?.apk_url || ''))
            .catch(() => {});
    }, []);

    // Cargar estado del dispositivo
    const cargarEstado = useCallback(async () => {
        if (!saleId || !isCredit || !habilitado) {
            setLoading(false);
            return;
        }
        try {
            const r = await apiClient.get(`/bloqueo/sales/${saleId}/estado`);
            setEstado(r.data);
        } catch { setEstado(null); }
        finally  { setLoading(false); }
    }, [saleId, isCredit, habilitado]);

    useEffect(() => {
        if (habilitado) cargarEstado();
        else setLoading(false);
    }, [habilitado, cargarEstado]);

    // Copiar código BLC al portapapeles
    const copiarCodigo = async () => {
        const codigo = estado?.codigo_activacion;
        if (!codigo) return;
        try {
            await navigator.clipboard.writeText(codigo);
            setCopiado(true);
            setTimeout(() => setCopiado(false), 2000);
            toast.success('Código copiado al portapapeles');
        } catch {
            toast.error('No se pudo copiar');
        }
    };

    // Bloquear equipo
    const bloquear = async () => {
        if (!confirm('¿Confirmas bloquear el equipo del cliente?\nEl celular se bloqueará en segundos si tiene internet.')) return;
        setAccionando(true);
        try {
            const r = await apiClient.post(`/bloqueo/sales/${saleId}/bloquear`,
                { motivo: 'Mora en pago' });
            toast.success(r.data?.mensaje || '✅ Equipo bloqueado');
            await cargarEstado();
        } catch (e) {
            toast.error(e.response?.data?.detail || 'Error al bloquear el equipo');
        } finally { setAccionando(false); }
    };

    // Desbloquear equipo
    const desbloquear = async () => {
        const fecha = prompt('Nueva fecha límite de pago (YYYY-MM-DD):',
            new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0]);
        if (!fecha) return;
        setAccionando(true);
        try {
            const r = await apiClient.post(`/bloqueo/sales/${saleId}/desbloquear`,
                { nueva_fecha_limite: fecha });
            toast.success(r.data?.mensaje || '✅ Equipo desbloqueado');
            await cargarEstado();
        } catch (e) {
            toast.error(e.response?.data?.detail || 'Error al desbloquear');
        } finally { setAccionando(false); }
    };

    // Generar nuevo código BLC
    const nuevoCodigoBLC = async () => {
        if (!confirm('¿Generar un nuevo código BLC?\nEl código anterior quedará inválido.')) return;
        setAccionando(true);
        try {
            const r = await apiClient.post(`/bloqueo/sales/${saleId}/nuevo-codigo`);
            toast.success(`Nuevo código generado: ${r.data?.codigo_activacion}`);
            await cargarEstado();
        } catch (e) {
            toast.error(e.response?.data?.detail || 'Error generando código');
        } finally { setAccionando(false); }
    };

    // Sincronizar manualmente (si no está sincronizado)
    const sincronizar = async () => {
        setAccionando(true);
        try {
            const r = await apiClient.post(`/bloqueo/sales/${saleId}/sync`, { num_cuotas: 6 });
            toast.success(r.data?.mensaje || '✅ Sincronizado con BloqueCelular');
            await cargarEstado();
        } catch (e) {
            toast.error(e.response?.data?.detail || 'Error al sincronizar');
        } finally { setAccionando(false); }
    };

    // ── Render: No aplica ────────────────────────────────────────────────────
    if (!isCredit) return null;
    if (!habilitado) return null;
    if (loading) return (
        <div className="flex items-center gap-2 p-4 bg-slate-50 rounded-2xl border border-slate-100 text-slate-400">
            <RefreshCw size={14} className="animate-spin" />
            <span className="text-xs">Cargando estado de BloqueCelular...</span>
        </div>
    );

    const sincronizado  = estado?.sincronizado;
    const estadoActual  = estado?.estado || (sincronizado ? 'activo' : 'sin_activar');
    const codigo        = estado?.codigo_activacion;
    const dispositivo_id= estado?.dispositivo_id;

    return (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">

            {/* ── Header con toggle ── */}
            <button
                onClick={() => setExpanded(v => !v)}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0
                        ${estadoActual === 'bloqueado' ? 'bg-red-100' : 'bg-indigo-50'}`}>
                        <Lock size={18} className={estadoActual === 'bloqueado' ? 'text-red-600' : 'text-indigo-600'} />
                    </div>
                    <div className="text-left">
                        <p className="font-bold text-slate-800 text-sm">Control de Bloqueo</p>
                        <p className="text-xs text-slate-400">Sistema BloqueCelular</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <EstadoBadge estado={estadoActual} />
                    {expanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                </div>
            </button>

            {expanded && (
                <div className="border-t border-slate-100 p-4 space-y-4">

                    {/* ── Sin sincronizar ── */}
                    {!sincronizado && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                            <div className="flex items-start gap-3">
                                <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                                <div className="flex-1">
                                    <p className="text-sm font-bold text-amber-800 mb-1">Sin sincronizar</p>
                                    <p className="text-xs text-amber-700 mb-3">
                                        Esta venta no está registrada en BloqueCelular.
                                        Sincroniza para obtener el código de activación.
                                    </p>
                                    <button
                                        onClick={sincronizar}
                                        disabled={accionando}
                                        className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white text-xs font-bold rounded-xl hover:bg-amber-700 transition-colors disabled:opacity-60"
                                    >
                                        {accionando ? <RefreshCw size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                                        Sincronizar ahora
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── Código BLC-XXXX ── */}
                    {sincronizado && codigo && (
                        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                            <p className="text-xs font-bold text-indigo-600 mb-2 uppercase tracking-wider">
                                Código de Activación
                            </p>
                            <div className="flex items-center gap-3">
                                <div className="flex-1 bg-white border-2 border-indigo-300 rounded-xl px-4 py-2.5 text-center">
                                    <p className="text-2xl font-black text-indigo-700 tracking-widest font-mono">
                                        {codigo}
                                    </p>
                                </div>
                                <button
                                    onClick={copiarCodigo}
                                    className="p-2.5 bg-indigo-100 hover:bg-indigo-200 rounded-xl transition-colors shrink-0"
                                    title="Copiar código"
                                >
                                    {copiado
                                        ? <CheckCircle2 size={18} className="text-emerald-600" />
                                        : <Copy size={18} className="text-indigo-600" />
                                    }
                                </button>
                            </div>
                            <p className="text-xs text-indigo-500 mt-2">
                                El técnico ingresa este código en la app instalada en el celular del cliente.
                            </p>
                        </div>
                    )}

                    {/* ── APK + QR ── */}
                    {apkUrl && sincronizado && (
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                            <p className="text-xs font-bold text-slate-600 mb-3 uppercase tracking-wider">
                                App de Bloqueo (APK Android)
                            </p>
                            <div className="flex items-start gap-4">
                                {/* QR */}
                                <div className="shrink-0">
                                    <QRCode url={apkUrl} size={90} />
                                    <p className="text-[10px] text-slate-400 text-center mt-1">Escanear para descargar</p>
                                </div>
                                {/* Instrucciones */}
                                <div className="flex-1 space-y-2">
                                    <p className="text-xs text-slate-600 font-medium">Pasos para activar el bloqueo:</p>
                                    {[
                                        'Descarga e instala la app en el celular del cliente',
                                        `Abre la app e ingresa el código ${codigo || 'BLC-XXXX'}`,
                                        'El equipo quedará vinculado al sistema de bloqueo',
                                    ].map((step, i) => (
                                        <div key={i} className="flex items-start gap-2">
                                            <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">
                                                {i + 1}
                                            </span>
                                            <p className="text-xs text-slate-600">{step}</p>
                                        </div>
                                    ))}
                                    <a
                                        href={apkUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 mt-2 px-3 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition-colors"
                                    >
                                        <Download size={13} />
                                        Descargar APK
                                        <ExternalLink size={11} />
                                    </a>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── Estado del dispositivo ── */}
                    {sincronizado && dispositivo_id && (
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                            <p className="text-xs font-bold text-slate-600 mb-3 uppercase tracking-wider">Estado del equipo</p>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Smartphone size={16} className="text-slate-400" />
                                    <span className="text-sm text-slate-600">
                                        {estado?.nombre_equipo || 'Celular registrado'}
                                    </span>
                                    {estado?.imei && (
                                        <span className="text-[10px] text-slate-400 font-mono">
                                            IMEI: {estado.imei}
                                        </span>
                                    )}
                                </div>
                                <EstadoBadge estado={estadoActual} />
                            </div>
                            {estado?.saldo_pendiente > 0 && (
                                <p className="text-xs text-slate-500 mt-2">
                                    Saldo en BloqueCelular: <strong className="text-slate-700">${parseFloat(estado.saldo_pendiente).toFixed(2)}</strong>
                                    {estado.cuotas_pagadas != null && (
                                        <span> · Cuotas pagadas: {estado.cuotas_pagadas}/{estado.num_cuotas}</span>
                                    )}
                                </p>
                            )}
                        </div>
                    )}

                    {/* ── Acciones ── */}
                    {sincronizado && (
                        <div className="flex flex-wrap gap-2">
                            {/* Bloquear */}
                            {estadoActual === 'activo' && dispositivo_id && (
                                <button
                                    onClick={bloquear}
                                    disabled={accionando}
                                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors disabled:opacity-60"
                                >
                                    {accionando ? <RefreshCw size={12} className="animate-spin" /> : <Lock size={12} />}
                                    Bloquear equipo
                                </button>
                            )}
                            {/* Desbloquear */}
                            {estadoActual === 'bloqueado' && dispositivo_id && (
                                <button
                                    onClick={desbloquear}
                                    disabled={accionando}
                                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors disabled:opacity-60"
                                >
                                    {accionando ? <RefreshCw size={12} className="animate-spin" /> : <Unlock size={12} />}
                                    Desbloquear equipo
                                </button>
                            )}
                            {/* Nuevo código BLC */}
                            <button
                                onClick={nuevoCodigoBLC}
                                disabled={accionando}
                                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-colors disabled:opacity-60"
                            >
                                {accionando ? <RefreshCw size={12} className="animate-spin" /> : <QrCode size={12} />}
                                Nuevo código BLC
                            </button>
                            {/* Refrescar estado */}
                            <button
                                onClick={cargarEstado}
                                className="flex items-center gap-1.5 px-3 py-2 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                            >
                                <RefreshCw size={12} />
                                Refrescar
                            </button>
                        </div>
                    )}

                    {/* ── Nota informativa ── */}
                    <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-100 rounded-xl">
                        <Info size={13} className="text-blue-500 shrink-0 mt-0.5" />
                        <p className="text-[11px] text-blue-700">
                            El bloqueo se aplica en segundos si el celular tiene internet.
                            Si no tiene conexión, Firebase retiene el comando hasta 4 semanas.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
