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

    // RESTORED DEBUGGING STATE
    const [debugLog, setDebugLog] = useState([]);
    const [showDebug, setShowDebug] = useState(false); // FIXED: Add missing state


    const addLog = (msg) => {
        console.log(`[MobileWelcome] ${msg}`);
        setDebugLog(prev => [...prev, `${new Date().toLocaleTimeString()} - ${msg}`]);
    };

    const resolveUrl = (cleanSlug) => {
        let url = '';
        let tenant = '';

        // 1. Production Domain Matching (*.miinventariofacil.com)
        if (cleanSlug.includes('miinventariofacil.com')) {
            // Extract subdomain
            // e.g. https://prueba.miinventariofacil.com/login -> prueba
            // e.g. prueba.miinventariofacil.com -> prueba

            let hostname = cleanSlug;
            try {
                if (cleanSlug.startsWith('http')) {
                    hostname = new URL(cleanSlug).hostname;
                }
            } catch (e) { console.error(e); }

            const parts = hostname.split('.');
            if (parts.length >= 3) {
                const sub = parts[0];
                if (!['www', 'api', 'app', 'local'].includes(sub)) {
                    tenant = sub;
                }
            }

            // FORCE Central API for all cloud requests
            url = 'https://api.miinventariofacil.com';
            addLog(`☁️ Cloud Domain Detected. Tenant: ${tenant || 'N/A'}`);
            addLog(`🔗 Redirecting API to: ${url}`);
        }
        // 2. Localhost / IP
        else if (cleanSlug === 'local') {
            url = 'http://10.0.2.2:8000';
            addLog('🏠 Android Emulator Localhost');
        }
        else if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(cleanSlug)) {
            // IP Address
            url = cleanSlug.startsWith('http') ? cleanSlug : `http://${cleanSlug}`;
            addLog(`🔌 Local IP Detected: ${url}`);
        }
        // 3. Just a Slug (e.g. "ferreteria")
        else {
            tenant = cleanSlug;
            url = 'https://api.miinventariofacil.com';
            addLog(`🏷️ Simple Slug Detected. Tenant: ${tenant}`);
            addLog(`🔗 Using Central API: ${url}`);
        }

        // Clean trailing slash
        if (url.endsWith('/')) url = url.slice(0, -1);

        return { url, tenant };
    };

    const runConnectionTest = async (actualConnect = false) => {
        setError('');
        setDebugLog([]);
        setLoading(true);
        setShowDebug(true); // Auto-show debug on attempt

        const cleanSlug = slug.trim().toLowerCase();

        if (!cleanSlug) {
            setError('Escribe algo primero');
            setLoading(false);
            return;
        }

        addLog(`🚀 Iniciando con input: "${cleanSlug}"`);

        try {
            const { url, tenant } = resolveUrl(cleanSlug);
            const endpoint = `${url}/api/v1/health`;

            addLog(`📡 Testing endpoint: ${endpoint}`);
            if (tenant) addLog(`🎫 X-Tenant-ID: ${tenant}`);

            // Test execution with 10s Timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 seconds

            const start = Date.now();
            try {
                const response = await fetch(endpoint, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                        ...(tenant ? { 'X-Tenant-ID': tenant } : {})
                    },
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                const ms = Date.now() - start;
                addLog(`⏱️ Ping: ${ms}ms`);
                addLog(`📩 Status: ${response.status} ${response.statusText}`);

                const text = await response.text();
                let data = {};
                try {
                    data = JSON.parse(text);
                    addLog(`📦 JSON: ${JSON.stringify(data).slice(0, 50)}...`);
                } catch (e) {
                    addLog(`⚠️ Non-JSON Response: ${text.slice(0, 30)}...`);
                }

                if (response.ok && data.status === 'ok') {
                    addLog('✅ SUCCESS! Backend verified.');

                    if (actualConnect) {
                        // Success!
                        // FIX: Ensure the stored URL includes /api/v1 to match axios expectations
                        const finalUrl = url.endsWith('/api/v1') ? url : `${url}/api/v1`;
                        localStorage.setItem('api_url', finalUrl);
                        localStorage.setItem('selected_tenant', tenant);
                        toast.success('¡Conectado! Reiniciando app...', { duration: 2000 });

                        // CRITICAL FIX: Force a FULL HARD RELOAD
                        setTimeout(() => {
                            window.location.href = '/#/login';
                            window.location.reload();
                        }, 500);
                    } else {
                        toast.success('Prueba Exitosa. Pulsa "Conectar" para entrar.');
                    }
                } else {
                    throw new Error(`Server returned ${response.status}`);
                }
            } catch (fetchError) {
                if (fetchError.name === 'AbortError') {
                    throw new Error('Connection timed out (10s). Check IP/Network.');
                }
                throw fetchError;
            }

        } catch (err) {
            addLog(`❌ ERROR: ${err.message}`);
            setError('Error de conexión. Revisa el log 👇');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        runConnectionTest(true);
    };

    return (
        <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 pb-20 overflow-y-auto">
            <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden">

                {/* Header */}
                <div className="bg-indigo-600 p-6 text-center text-white">
                    <div className="mx-auto bg-white/20 w-14 h-14 rounded-full flex items-center justify-center mb-3">
                        <Smartphone size={28} className="text-white" />
                    </div>
                    <h1 className="text-xl font-bold">Configuración Móvil</h1>
                </div>

                {/* Form */}
                <div className="p-6 space-y-4">
                    {/* Input Area */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase ml-1">
                                Código / URL / IP
                            </label>
                            <div className="relative">
                                <Server className="absolute left-3 top-3 text-slate-400" size={18} />
                                <input
                                    type="text"
                                    className="w-full pl-10 pr-4 py-2.5 bg-slate-100 border-0 rounded-lg focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800"
                                    placeholder="ej. prueba.miinventario..."
                                    value={slug}
                                    onChange={(e) => setSlug(e.target.value)}
                                    autoCapitalize="none"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => runConnectionTest(false)}
                                disabled={loading || !slug}
                                className="py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg text-sm transition-colors"
                            >
                                🧪 Probar
                            </button>
                            <button
                                type="submit"
                                disabled={loading || !slug}
                                className="py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-sm shadow-md transition-all active:scale-95"
                            >
                                {loading ? '...' : 'Conectar'}
                            </button>
                        </div>
                    </form>

                    {/* Check if we already have a config to go back to */}
                    {localStorage.getItem('api_url') && (
                        <div className="pt-2 border-t border-slate-100 flex justify-center">
                            <button
                                onClick={() => navigate('/login')}
                                className="text-xs text-slate-400 hover:text-indigo-500 flex items-center gap-1 transition-colors"
                            >
                                <span>← Volver al Login</span>
                            </button>
                        </div>
                    )}

                    {/* RESTORED DEBUG LOG UI */}
                    {debugLog.length > 0 && (
                        <div className="mt-4 p-3 bg-slate-900 rounded-lg text-left">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-xs font-bold text-indigo-400">DEBUG LOG</span>
                                <button onClick={() => setDebugLog([])} className="text-[10px] text-slate-500 hover:text-white">LIMPIAR</button>
                            </div>
                            <div className="h-32 overflow-y-auto space-y-1 font-mono text-[10px] text-green-400">
                                {debugLog.map((log, i) => (
                                    <div key={i} className="border-l-2 border-slate-700 pl-2">{log}</div>
                                ))}
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="text-xs text-rose-600 font-medium text-center bg-rose-50 p-2 rounded">
                            {error}
                        </div>
                    )}
                </div>
            </div>

            <p className="fixed bottom-6 text-slate-500 text-xs">v2.5 (Production)</p>
        </div>
    );
};

export default MobileWelcome;
