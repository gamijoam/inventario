/**
 * LicenseActivation.jsx
 *
 * Primera pantalla del app de escritorio (Tauri).
 * El usuario ingresa su código de licencia para activar el programa.
 *
 * Flujo:
 *   1. Usuario ingresa código (ej: INVS-XXXX-XXXX-XXXX)
 *   2. App llama al SERVIDOR DE LICENCIAS (VPS) para validar
 *   3. Si válido: guarda token en localStorage → abre el programa
 *   4. Si sin internet: verifica archivo local .lic (fecha de gracia)
 *   5. Si licencia caducada: muestra pantalla de bloqueo
 *
 * NOTA (Fase 1): El endpoint del servidor de licencias se implementará
 * en el VPS. Por ahora valida formato localmente y simula activación.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ShieldCheck, KeyRound, AlertCircle, CheckCircle2,
    Loader2, Monitor, WifiOff, RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';

// URL del servidor de licencias (siempre el VPS, nunca localhost)
const LICENSE_SERVER = 'https://api.miinventariofacil.com';

// Clave en localStorage donde guardamos el estado de la licencia
const LICENSE_KEY = 'desktop_license';
const LICENSE_EXP = 'desktop_license_exp';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Verifica si el código tiene formato válido: XXXX-XXXX-XXXX-XXXX */
const isValidFormat = (code) =>
    /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(code.trim());

/** Verifica si la licencia local sigue vigente (gracia offline) */
const isLocalLicenseValid = () => {
    const lic = localStorage.getItem(LICENSE_KEY);
    const exp = localStorage.getItem(LICENSE_EXP);
    if (!lic || !exp) return false;
    return new Date(exp) > new Date();
};

// ── Componente ────────────────────────────────────────────────────────────────

const LicenseActivation = () => {
    const [code, setCode]       = useState('');
    const [step, setStep]       = useState('idle'); // idle | verifying | success | error | blocked
    const [errorMsg, setErrorMsg] = useState('');
    const [isOffline, setIsOffline] = useState(false);
    const navigate = useNavigate();

    // ── Formatear el código mientras el usuario escribe ───────────────────────
    const handleCodeChange = (e) => {
        let val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
        // Insertar guiones automáticamente cada 4 chars
        val = val.match(/.{1,4}/g)?.join('-') || val;
        if (val.length > 19) return; // XXXX-XXXX-XXXX-XXXX = 19 chars
        setCode(val);
    };

    // ── Verificar con el servidor ─────────────────────────────────────────────
    const handleActivate = async () => {
        const cleanCode = code.trim().toUpperCase();

        if (!isValidFormat(cleanCode)) {
            toast.error('Formato inválido. Usa: XXXX-XXXX-XXXX-XXXX');
            return;
        }

        setStep('verifying');
        setErrorMsg('');

        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000);

            const res = await fetch(`${LICENSE_SERVER}/api/v1/desktop/license/activate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ license_key: cleanCode }),
                signal: controller.signal,
            });
            clearTimeout(timeout);

            const data = await res.json().catch(() => ({}));

            if (res.ok && data.valid) {
                // Guardar licencia y fecha de expiración
                localStorage.setItem(LICENSE_KEY, data.token || cleanCode);
                localStorage.setItem(LICENSE_EXP, data.expires_at || _defaultExpiry());

                setStep('success');
                toast.success('¡Licencia activada correctamente!');
                setTimeout(() => navigate('/login'), 1200);
            } else if (res.status === 402) {
                setStep('blocked');
                setErrorMsg(data.detail || 'Licencia vencida o suspendida. Contacta al soporte.');
            } else if (res.status === 404) {
                setStep('error');
                setErrorMsg('Código de licencia no encontrado. Verifica e intenta de nuevo.');
            } else {
                setStep('error');
                setErrorMsg(data.detail || 'No se pudo verificar la licencia. Intenta de nuevo.');
            }

        } catch (err) {
            if (err.name === 'AbortError' || !navigator.onLine) {
                // Sin internet: verificar licencia local
                setIsOffline(true);
                if (isLocalLicenseValid()) {
                    setStep('success');
                    toast('Modo sin conexión — licencia local válida.', { icon: '📴' });
                    setTimeout(() => navigate('/login'), 1200);
                } else {
                    setStep('error');
                    setErrorMsg(
                        'Sin conexión a internet y no hay licencia local válida.\n' +
                        'Conéctate a internet para activar el programa.'
                    );
                }
            } else {
                setStep('error');
                setErrorMsg('Error de conexión con el servidor de licencias.');
            }
        }
    };

    /** Expiración por defecto: 1 año desde hoy */
    const _defaultExpiry = () => {
        const d = new Date();
        d.setFullYear(d.getFullYear() + 1);
        return d.toISOString();
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900">

            <div className="w-full max-w-md mx-4">

                {/* Logo / Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600 shadow-xl mb-4">
                        <Monitor className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-white">Invensoft Desktop</h1>
                    <p className="text-slate-400 text-sm mt-1">
                        Activa tu licencia para comenzar
                    </p>
                </div>

                {/* Card */}
                <div className="bg-slate-800/60 backdrop-blur border border-slate-700 rounded-2xl p-8 shadow-2xl">

                    {/* ── Estado: Bloqueado ── */}
                    {step === 'blocked' && (
                        <div className="text-center">
                            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-red-500/20 mb-4">
                                <AlertCircle className="w-7 h-7 text-red-400" />
                            </div>
                            <h2 className="text-lg font-semibold text-white mb-2">Licencia Suspendida</h2>
                            <p className="text-slate-400 text-sm mb-6">{errorMsg}</p>
                            <a
                                href="https://miinventariofacil.com"
                                className="text-indigo-400 hover:text-indigo-300 text-sm underline"
                            >
                                Renovar en miinventariofacil.com
                            </a>
                        </div>
                    )}

                    {/* ── Estado: Éxito ── */}
                    {step === 'success' && (
                        <div className="text-center">
                            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-500/20 mb-4">
                                <CheckCircle2 className="w-7 h-7 text-green-400" />
                            </div>
                            <h2 className="text-lg font-semibold text-white mb-2">
                                {isOffline ? 'Modo sin conexión' : '¡Activado!'}
                            </h2>
                            <p className="text-slate-400 text-sm">Iniciando el programa...</p>
                        </div>
                    )}

                    {/* ── Estado: Formulario (idle / verifying / error) ── */}
                    {(step === 'idle' || step === 'verifying' || step === 'error') && (
                        <>
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 rounded-lg bg-indigo-500/20">
                                    <KeyRound className="w-5 h-5 text-indigo-400" />
                                </div>
                                <div>
                                    <h2 className="text-white font-semibold">Código de Licencia</h2>
                                    <p className="text-slate-400 text-xs">
                                        Recibiste este código al comprar Invensoft
                                    </p>
                                </div>
                            </div>

                            {/* Input */}
                            <input
                                type="text"
                                value={code}
                                onChange={handleCodeChange}
                                placeholder="XXXX-XXXX-XXXX-XXXX"
                                disabled={step === 'verifying'}
                                autoFocus
                                spellCheck={false}
                                className={`
                                    w-full px-4 py-3 rounded-xl text-center text-lg font-mono
                                    tracking-widest border bg-slate-900/60 text-white placeholder-slate-600
                                    focus:outline-none focus:ring-2 transition-colors
                                    ${step === 'error'
                                        ? 'border-red-500/60 focus:ring-red-500/40'
                                        : 'border-slate-600 focus:ring-indigo-500/60 focus:border-indigo-500'}
                                    disabled:opacity-50
                                `}
                                onKeyDown={(e) => e.key === 'Enter' && step !== 'verifying' && handleActivate()}
                            />

                            {/* Error message */}
                            {step === 'error' && errorMsg && (
                                <div className="mt-3 flex items-start gap-2 text-red-400 text-sm bg-red-500/10 rounded-lg px-3 py-2">
                                    {isOffline
                                        ? <WifiOff className="w-4 h-4 mt-0.5 shrink-0" />
                                        : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                                    }
                                    <span className="whitespace-pre-line">{errorMsg}</span>
                                </div>
                            )}

                            {/* Botón */}
                            <button
                                onClick={handleActivate}
                                disabled={step === 'verifying' || code.length < 19}
                                className="mt-5 w-full py-3 rounded-xl font-semibold text-white
                                    bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700
                                    disabled:opacity-40 disabled:cursor-not-allowed
                                    transition-colors flex items-center justify-center gap-2"
                            >
                                {step === 'verifying' ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Verificando...
                                    </>
                                ) : step === 'error' ? (
                                    <>
                                        <RefreshCw className="w-4 h-4" />
                                        Intentar de nuevo
                                    </>
                                ) : (
                                    <>
                                        <ShieldCheck className="w-4 h-4" />
                                        Activar licencia
                                    </>
                                )}
                            </button>

                            {/* Modo offline si ya hay licencia local */}
                            {isLocalLicenseValid() && (
                                <button
                                    onClick={() => { setStep('success'); setTimeout(() => navigate('/login'), 800); }}
                                    className="mt-3 w-full py-2 rounded-xl text-slate-400 hover:text-slate-300
                                        text-sm border border-slate-700 hover:border-slate-500 transition-colors
                                        flex items-center justify-center gap-2"
                                >
                                    <WifiOff className="w-4 h-4" />
                                    Continuar sin conexión
                                </button>
                            )}

                            {/* Bypass solo en modo desarrollo (Vite dev server) */}
                            {import.meta.env.DEV && (
                                <button
                                    onClick={() => {
                                        const exp = new Date();
                                        exp.setFullYear(exp.getFullYear() + 5);
                                        localStorage.setItem(LICENSE_KEY, 'DEV-0000-0000-0000');
                                        localStorage.setItem(LICENSE_EXP, exp.toISOString());
                                        setStep('success');
                                        setTimeout(() => navigate('/login'), 800);
                                    }}
                                    className="mt-2 w-full py-2 rounded-xl text-yellow-500/70 hover:text-yellow-400
                                        text-xs border border-yellow-900/40 hover:border-yellow-700/60 transition-colors
                                        flex items-center justify-center gap-1"
                                >
                                    🛠 Modo Desarrollo — Saltar licencia
                                </button>
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                <p className="text-center text-slate-600 text-xs mt-6">
                    ¿Problemas con tu licencia?{' '}
                    <a href="https://miinventariofacil.com/soporte" className="text-slate-500 hover:text-slate-400 underline">
                        Contactar soporte
                    </a>
                </p>

            </div>
        </div>
    );
};

export default LicenseActivation;
