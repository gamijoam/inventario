import { useState, useEffect, useRef } from 'react';
import apiClient from '../../../config/axios';
import { toast } from 'react-hot-toast';
import {
    MessageCircle, Wifi, WifiOff, QrCode, RefreshCw,
    Send, ShoppingCart, Wrench, CreditCard, FileText,
    CheckCircle, XCircle, Loader, Smartphone, Zap
} from 'lucide-react';

/* ── Toggle de notificación ─────────────────────────────── */
const NotifToggle = ({ icon: Icon, label, desc, value, onChange, disabled }) => (
    <div className={`flex items-center justify-between p-4 rounded-xl border transition-all
        ${value ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-200'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
        <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center
                ${value ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 text-slate-500'}`}>
                <Icon size={16} />
            </div>
            <div>
                <p className="text-sm font-bold text-slate-700">{label}</p>
                <p className="text-xs text-slate-400">{desc}</p>
            </div>
        </div>
        <button
            disabled={disabled}
            onClick={() => !disabled && onChange(!value)}
            className={`relative w-12 h-6 rounded-full transition-colors focus:outline-none
                ${value ? 'bg-indigo-600' : 'bg-slate-300'}`}
        >
            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform
                ${value ? 'translate-x-7' : 'translate-x-1'}`} />
        </button>
    </div>
);

/* ── Componente principal ───────────────────────────────── */
export default function WhatsAppTab() {
    const [config, setConfig]       = useState(null);
    const [loading, setLoading]     = useState(true);
    const [qrData, setQrData]       = useState(null);
    const [creating, setCreating]   = useState(false);
    const [testing, setTesting]     = useState(false);
    const [testPhone, setTestPhone] = useState('');
    const [polling, setPolling]     = useState(false);
    const pollRef = useRef(null);

    /* Cargar config inicial */
    useEffect(() => {
        loadConfig();
        return () => clearInterval(pollRef.current);
    }, []);

    /* Polling de estado cuando está en PENDING_QR */
    useEffect(() => {
        if (config?.status === 'PENDING_QR') {
            setPolling(true);
            pollRef.current = setInterval(checkStatus, 4000);
        } else {
            setPolling(false);
            clearInterval(pollRef.current);
        }
        return () => clearInterval(pollRef.current);
    }, [config?.status]);

    const loadConfig = async () => {
        setLoading(true);
        try {
            const r = await apiClient.get('/whatsapp/config');
            setConfig(r.data);
        } catch {
            toast.error('Error cargando configuración de WhatsApp');
        } finally {
            setLoading(false);
        }
    };

    const checkStatus = async () => {
        try {
            const r = await apiClient.get('/whatsapp/instance/status');
            if (r.data.status === 'CONNECTED') {
                setConfig(prev => ({ ...prev, status: 'CONNECTED', enabled: true }));
                setQrData(null);
                toast.success('✅ ¡WhatsApp conectado exitosamente!');
                clearInterval(pollRef.current);
            }
        } catch {}
    };

    const handleCreate = async () => {
        setCreating(true);
        try {
            const r = await apiClient.post('/whatsapp/instance/create');
            setConfig(prev => ({ ...prev, status: 'PENDING_QR', enabled: true }));
            if (r.data.qr_base64) {
                setQrData(r.data.qr_base64);
            } else {
                // Pedir el QR explícitamente
                const qr = await apiClient.get('/whatsapp/instance/qr');
                setQrData(qr.data.qr_base64);
            }
            toast.success('¡QR generado! Escanéalo con WhatsApp');
        } catch (e) {
            toast.error('Error creando instancia: ' + (e?.response?.data?.detail || e.message));
        } finally {
            setCreating(false);
        }
    };

    const handleRefreshQr = async () => {
        try {
            const r = await apiClient.get('/whatsapp/instance/qr');
            setQrData(r.data.qr_base64);
            toast.success('QR actualizado');
        } catch {
            toast.error('Error obteniendo QR');
        }
    };

    const handleDisconnect = async () => {
        if (!confirm('¿Desconectar WhatsApp? Dejarás de enviar mensajes automáticos.')) return;
        try {
            await apiClient.post('/whatsapp/instance/disconnect');
            setConfig(prev => ({ ...prev, status: 'DISCONNECTED', enabled: false }));
            setQrData(null);
            toast.success('WhatsApp desconectado');
        } catch (e) {
            toast.error('Error desconectando: ' + (e?.response?.data?.detail || e.message));
        }
    };

    const handleToggle = async (field, value) => {
        const prev = { ...config };
        setConfig(c => ({ ...c, [field]: value }));
        try {
            await apiClient.post('/whatsapp/config', { [field]: value });
        } catch {
            setConfig(prev);
            toast.error('Error guardando configuración');
        }
    };

    const handleTest = async () => {
        if (!testPhone.trim()) return toast.error('Ingresa un número de teléfono');
        setTesting(true);
        try {
            await apiClient.post('/whatsapp/test', {
                phone: testPhone,
                message: '✅ Mensaje de prueba desde Mi Inventario Fácil.\n\n¡Tu WhatsApp está configurado correctamente!'
            });
            toast.success('¡Mensaje enviado! Revisa el teléfono.');
        } catch (e) {
            toast.error('Error enviando: ' + (e?.response?.data?.detail || e.message));
        } finally {
            setTesting(false);
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center py-20">
            <Loader className="animate-spin text-indigo-500" size={32} />
        </div>
    );

    const isConnected  = config?.status === 'CONNECTED';
    const isPendingQr  = config?.status === 'PENDING_QR';
    const isDisconnected = !isConnected && !isPendingQr;

    return (
        <div className="p-6 max-w-2xl mx-auto space-y-6">

            {/* ── Header ────────────────────────────── */}
            <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center">
                    <MessageCircle size={24} className="text-emerald-600" />
                </div>
                <div>
                    <h2 className="text-xl font-black text-slate-800">WhatsApp Business</h2>
                    <p className="text-sm text-slate-500">Notificaciones automáticas a tus clientes</p>
                </div>
                <div className="ml-auto">
                    <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border
                        ${isConnected  ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          isPendingQr  ? 'bg-amber-50  text-amber-700  border-amber-200' :
                                         'bg-slate-50  text-slate-500  border-slate-200'}`}>
                        {isConnected  && <><Wifi size={12} /> Conectado</>}
                        {isPendingQr  && <><Loader size={12} className="animate-spin" /> Esperando QR</>}
                        {isDisconnected && <><WifiOff size={12} /> Desconectado</>}
                    </span>
                </div>
            </div>

            {/* ── Estado DESCONECTADO — botón conectar ── */}
            {isDisconnected && (
                <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                        <Smartphone size={28} className="text-emerald-600" />
                    </div>
                    <h3 className="text-lg font-black text-slate-700 mb-2">Conecta tu número de WhatsApp</h3>
                    <p className="text-sm text-slate-500 mb-6 max-w-sm mx-auto">
                        Usa tu número de WhatsApp para enviar tickets de venta, notificaciones del taller y recordatorios de pago automáticamente.
                    </p>
                    <button
                        onClick={handleCreate}
                        disabled={creating}
                        className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm transition-all mx-auto shadow-lg shadow-emerald-200 disabled:opacity-60"
                    >
                        {creating
                            ? <><Loader size={16} className="animate-spin" /> Generando QR...</>
                            : <><QrCode size={16} /> Conectar WhatsApp</>}
                    </button>
                </div>
            )}

            {/* ── Estado PENDING_QR — mostrar QR ────── */}
            {isPendingQr && (
                <div className="bg-white border border-amber-200 rounded-2xl p-6 text-center shadow-sm">
                    <h3 className="text-base font-black text-slate-700 mb-1">Escanea el código QR</h3>
                    <p className="text-xs text-slate-500 mb-4">
                        Abre WhatsApp → Dispositivos vinculados → Vincular dispositivo
                    </p>
                    {qrData ? (
                        <div className="flex flex-col items-center gap-4">
                            <img
                                src={qrData.startsWith('data:') ? qrData : `data:image/png;base64,${qrData}`}
                                alt="QR WhatsApp"
                                className="w-56 h-56 rounded-xl border-4 border-indigo-100 shadow-md"
                            />
                            <div className="flex items-center gap-1.5 text-xs text-amber-600 font-medium animate-pulse">
                                <Loader size={12} className="animate-spin" />
                                Esperando que escanees...
                            </div>
                            <button
                                onClick={handleRefreshQr}
                                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-indigo-600 transition-colors"
                            >
                                <RefreshCw size={12} /> Actualizar QR
                            </button>
                        </div>
                    ) : (
                        <div className="py-8 text-slate-400">
                            <Loader size={32} className="animate-spin mx-auto mb-2" />
                            <p className="text-sm">Cargando código QR...</p>
                        </div>
                    )}
                </div>
            )}

            {/* ── Estado CONECTADO ─────────────────── */}
            {isConnected && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <CheckCircle size={20} className="text-emerald-600" />
                        <div>
                            <p className="text-sm font-bold text-emerald-800">WhatsApp conectado</p>
                            <p className="text-xs text-emerald-600">Instancia: {config?.instance_name}</p>
                        </div>
                    </div>
                    <button
                        onClick={handleDisconnect}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-600 border border-rose-200 bg-white rounded-lg hover:bg-rose-50 transition-all"
                    >
                        <XCircle size={13} /> Desconectar
                    </button>
                </div>
            )}

            {/* ── Notificaciones (solo si hay instancia) ── */}
            {(isConnected || isPendingQr) && (
                <div className="space-y-3">
                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                        <Zap size={13} className="text-indigo-500" /> Notificaciones automáticas
                    </h3>
                    <NotifToggle
                        icon={ShoppingCart}
                        label="Ticket de venta"
                        desc="Enviar comprobante al cliente al cobrar en el POS"
                        value={config?.notify_sale ?? true}
                        onChange={v => handleToggle('notify_sale', v)}
                        disabled={!isConnected}
                    />
                    <NotifToggle
                        icon={Wrench}
                        label="Equipo listo en taller"
                        desc="Avisar cuando la orden pasa a estado LISTO"
                        value={config?.notify_order ?? true}
                        onChange={v => handleToggle('notify_order', v)}
                        disabled={!isConnected}
                    />
                    <NotifToggle
                        icon={CreditCard}
                        label="Recordatorio de deuda"
                        desc="Avisar clientes con crédito vencido (diario)"
                        value={config?.notify_credit ?? true}
                        onChange={v => handleToggle('notify_credit', v)}
                        disabled={!isConnected}
                    />
                    <NotifToggle
                        icon={FileText}
                        label="Envío de cotizaciones"
                        desc="Enviar cotización al cliente al crearla"
                        value={config?.notify_quote ?? false}
                        onChange={v => handleToggle('notify_quote', v)}
                        disabled={!isConnected}
                    />
                </div>
            )}

            {/* ── Mensaje de prueba ────────────────── */}
            {isConnected && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                        <Send size={13} className="text-indigo-500" /> Mensaje de prueba
                    </h3>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={testPhone}
                            onChange={e => setTestPhone(e.target.value)}
                            placeholder="Ej: +58 412 123 4567"
                            className="flex-1 px-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 outline-none bg-white"
                        />
                        <button
                            onClick={handleTest}
                            disabled={testing || !testPhone.trim()}
                            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-all disabled:opacity-60 shrink-0"
                        >
                            {testing
                                ? <Loader size={15} className="animate-spin" />
                                : <Send size={15} />}
                            {testing ? 'Enviando...' : 'Enviar'}
                        </button>
                    </div>
                    <p className="text-[11px] text-slate-400">
                        Ingresa el número con código de país. Se enviará un mensaje de prueba para verificar que todo funciona.
                    </p>
                </div>
            )}

        </div>
    );
}
