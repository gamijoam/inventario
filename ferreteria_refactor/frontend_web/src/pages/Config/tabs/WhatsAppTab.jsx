import { useState, useEffect, useRef } from 'react';
import apiClient from '../../../config/axios';
import { toast } from 'react-hot-toast';
import {
    MessageCircle, Wifi, WifiOff, QrCode, RefreshCw,
    Send, ShoppingCart, Wrench, CreditCard, FileText,
    CheckCircle, XCircle, Loader, Smartphone, Zap, Info, Edit3
} from 'lucide-react';

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
        <button disabled={disabled} onClick={() => !disabled && onChange(!value)}
            className={`relative w-12 h-6 rounded-full transition-colors focus:outline-none
                ${value ? 'bg-indigo-600' : 'bg-slate-300'}`}>
            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform
                ${value ? 'translate-x-7' : 'translate-x-1'}`} />
        </button>
    </div>
);

export default function WhatsAppTab() {
    const [config, setConfig]       = useState(null);
    const [loading, setLoading]     = useState(true);
    const [qr, setQr]               = useState('');
    const [creating, setCreating]   = useState(false);
    const [testing, setTesting]     = useState(false);
    const [testPhone, setTestPhone] = useState('');
    const [qrAge, setQrAge]         = useState(0);   // segundos desde que apareció el QR
    const pollRef  = useRef(null);
    const timerRef = useRef(null);

    useEffect(() => {
        loadConfig();
        return () => { clearInterval(pollRef.current); clearInterval(timerRef.current); };
    }, []);

    // Polling cada 3s cuando status es PENDING_QR
    useEffect(() => {
        clearInterval(pollRef.current);
        clearInterval(timerRef.current);

        if (config?.status === 'PENDING_QR') {
            pollRef.current = setInterval(pollQr, 3000);
            // Contador de antigüedad del QR (expira en ~60s)
            timerRef.current = setInterval(() => setQrAge(a => a + 1), 1000);
        } else {
            setQr('');
            setQrAge(0);
        }
    }, [config?.status]);

    const loadConfig = async () => {
        setLoading(true);
        try {
            const r = await apiClient.get('/whatsapp/config');
            setConfig(r.data);
            // Si ya hay QR pendiente, cargarlo
            if (r.data.status === 'PENDING_QR') pollQr();
        } catch {
            toast.error('Error cargando configuración de WhatsApp');
        } finally {
            setLoading(false);
        }
    };

    const pollQr = async () => {
        try {
            const r = await apiClient.get('/whatsapp/instance/qr');
            if (r.data.status === 'CONNECTED') {
                setConfig(c => ({ ...c, status: 'CONNECTED' }));
                toast.success('✅ ¡WhatsApp conectado exitosamente!');
                clearInterval(pollRef.current);
                clearInterval(timerRef.current);
                return;
            }
            if (r.data.has_qr && r.data.qr_base64) {
                setQr(r.data.qr_base64);
                setQrAge(0);
            }
        } catch {}
    };

    const handleCreate = async () => {
        setCreating(true);
        setQr('');
        setQrAge(0);
        try {
            await apiClient.post('/whatsapp/instance/create');
            setConfig(c => ({ ...c, status: 'PENDING_QR' }));
            toast.success('Generando código QR... aparecerá en segundos');
        } catch (e) {
            toast.error('Error: ' + (e?.response?.data?.detail || e.message));
        } finally {
            setCreating(false);
        }
    };

    const handleDisconnect = async () => {
        if (!confirm('¿Desconectar WhatsApp? Dejarás de enviar mensajes automáticos.')) return;
        try {
            await apiClient.post('/whatsapp/instance/disconnect');
            setConfig(c => ({ ...c, status: 'DISCONNECTED', enabled: false }));
            setQr('');
            toast.success('WhatsApp desconectado');
        } catch (e) {
            toast.error('Error: ' + (e?.response?.data?.detail || e.message));
        }
    };

    const handleSaveTemplate = async (key, value) => {
        if (!value.trim()) return;
        try {
            await apiClient.post('/whatsapp/config', { [key]: value });
            toast.success('Plantilla guardada');
        } catch {
            toast.error('Error guardando plantilla');
        }
    };

    const handleToggle = async (field, value) => {
        const prev = config;
        setConfig(c => ({ ...c, [field]: value }));
        try {
            await apiClient.post('/whatsapp/config', { [field]: value });
        } catch {
            setConfig(prev);
            toast.error('Error guardando');
        }
    };

    const handleTest = async () => {
        if (!testPhone.trim()) return toast.error('Ingresa un número');
        setTesting(true);
        try {
            await apiClient.post('/whatsapp/test', { phone: testPhone, message: '✅ Prueba desde Mi Inventario Fácil.\n\n¡WhatsApp configurado correctamente! 🎉' });
            toast.success('¡Mensaje enviado!');
        } catch (e) {
            toast.error('Error: ' + (e?.response?.data?.detail || e.message));
        } finally {
            setTesting(false);
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center py-20">
            <Loader className="animate-spin text-indigo-500" size={32} />
        </div>
    );

    const isConnected    = config?.status === 'CONNECTED';
    const isPendingQr    = config?.status === 'PENDING_QR';
    const isDisconnected = !isConnected && !isPendingQr;
    const qrExpiringSoon = qrAge > 45;

    return (
        <div className="p-6 max-w-2xl mx-auto space-y-6">

            {/* Header */}
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
                          isPendingQr  ? 'bg-amber-50   text-amber-700  border-amber-200' :
                                         'bg-slate-50   text-slate-500  border-slate-200'}`}>
                        {isConnected   && <><Wifi size={12} /> Conectado</>}
                        {isPendingQr   && <><Loader size={12} className="animate-spin" /> Esperando escaneo</>}
                        {isDisconnected && <><WifiOff size={12} /> Desconectado</>}
                    </span>
                </div>
            </div>

            {/* ── DESCONECTADO ── */}
            {isDisconnected && (
                <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                        <Smartphone size={28} className="text-emerald-600" />
                    </div>
                    <h3 className="text-lg font-black text-slate-700 mb-2">Conecta tu número de WhatsApp</h3>
                    <p className="text-sm text-slate-500 mb-6 max-w-sm mx-auto">
                        Conecta el número de WhatsApp del negocio para enviar tickets de venta, notificaciones del taller y recordatorios de pago automáticamente.
                    </p>
                    <button onClick={handleCreate} disabled={creating}
                        className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm transition-all mx-auto shadow-lg shadow-emerald-200 disabled:opacity-60">
                        {creating
                            ? <><Loader size={16} className="animate-spin" /> Preparando QR...</>
                            : <><QrCode size={16} /> Conectar WhatsApp</>}
                    </button>
                </div>
            )}

            {/* ── PENDING QR ── */}
            {isPendingQr && (
                <div className="bg-white border border-amber-200 rounded-2xl p-6 shadow-sm">
                    <div className="text-center mb-4">
                        <h3 className="text-base font-black text-slate-700 mb-1">Escanea el código QR</h3>
                        <p className="text-xs text-slate-500">
                            Abre WhatsApp → Menú (⋮) → Dispositivos vinculados → Vincular dispositivo
                        </p>
                    </div>

                    {qr ? (
                        <div className="flex flex-col items-center gap-4">
                            <div className={`relative rounded-2xl overflow-hidden border-4 transition-colors
                                ${qrExpiringSoon ? 'border-amber-300' : 'border-indigo-100'}`}>
                                <img
                                    src={qr.startsWith('data:') ? qr : `data:image/png;base64,${qr}`}
                                    alt="QR WhatsApp"
                                    className="w-56 h-56"
                                />
                                {qrExpiringSoon && (
                                    <div className="absolute inset-0 bg-amber-50/80 flex items-center justify-center flex-col gap-2">
                                        <RefreshCw size={24} className="text-amber-600 animate-spin" />
                                        <p className="text-xs font-bold text-amber-700">Actualizando QR...</p>
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-slate-500 animate-pulse">
                                <Loader size={11} className="animate-spin text-amber-500" />
                                Esperando que escanees... el QR se actualiza automáticamente
                            </div>
                            {/* Barra de progreso del QR */}
                            <div className="w-56 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all ${qrExpiringSoon ? 'bg-amber-400' : 'bg-indigo-400'}`}
                                    style={{ width: `${Math.max(0, 100 - (qrAge / 60) * 100)}%` }}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="py-10 text-center">
                            <Loader size={36} className="animate-spin text-indigo-400 mx-auto mb-3" />
                            <p className="text-sm font-medium text-slate-600">Generando código QR...</p>
                            <p className="text-xs text-slate-400 mt-1">Esto tarda unos segundos</p>
                        </div>
                    )}

                    <div className="mt-4 p-3 bg-blue-50 rounded-xl flex gap-2">
                        <Info size={14} className="text-blue-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-blue-700">
                            El QR se actualiza automáticamente cada 60 segundos si no fue escaneado. Una vez que lo escanees con WhatsApp, esta pantalla cambiará automáticamente.
                        </p>
                    </div>
                </div>
            )}

            {/* ── CONECTADO ── */}
            {isConnected && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <CheckCircle size={22} className="text-emerald-600" />
                        <div>
                            <p className="text-sm font-bold text-emerald-800">WhatsApp conectado y activo</p>
                            <p className="text-xs text-emerald-600">
                                Instancia: {config?.instance_name}
                            </p>
                        </div>
                    </div>
                    <button onClick={handleDisconnect}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-600 border border-rose-200 bg-white rounded-lg hover:bg-rose-50 transition-all">
                        <XCircle size={13} /> Desconectar
                    </button>
                </div>
            )}

            {/* ── NOTIFICACIONES ── */}
            {(isConnected || isPendingQr) && (
                <div className="space-y-3">
                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                        <Zap size={13} className="text-indigo-500" />
                        Notificaciones automáticas
                        {!isConnected && <span className="text-[10px] font-medium text-amber-600 normal-case tracking-normal">(se activarán al conectar)</span>}
                    </h3>
                    <NotifToggle icon={ShoppingCart} label="Ticket de venta"
                        desc="Enviar comprobante al cliente al cobrar en el POS"
                        value={config?.notify_sale ?? true} onChange={v => handleToggle('notify_sale', v)} disabled={!isConnected} />
                    <NotifToggle icon={Wrench} label="Equipo listo en taller"
                        desc="Avisar cuando la orden pasa a estado LISTO"
                        value={config?.notify_order ?? true} onChange={v => handleToggle('notify_order', v)} disabled={!isConnected} />
                    <NotifToggle icon={CreditCard} label="Recordatorio de deuda"
                        desc="Avisar clientes con crédito vencido (una vez al día)"
                        value={config?.notify_credit ?? true} onChange={v => handleToggle('notify_credit', v)} disabled={!isConnected} />
                    <NotifToggle icon={FileText} label="Envío de cotizaciones"
                        desc="Enviar cotización al cliente al crearla"
                        value={config?.notify_quote ?? false} onChange={v => handleToggle('notify_quote', v)} disabled={!isConnected} />
                </div>
            )}


            {/* ── PLANTILLAS DE MENSAJES ── */}
            {isConnected && (
                <div className="space-y-4">
                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                        <Edit3 size={13} className="text-indigo-500" /> Plantillas de mensajes
                    </h3>
                    {[
                        {
                            key: 'template_sale',
                            label: 'Ticket de venta',
                            icon: ShoppingCart,
                            vars: ['{{negocio}}','{{cliente}}','{{id}}','{{metodo_pago}}','{{pagos}}','{{total}}','{{vuelto}}'],
                        },
                        {
                            key: 'template_order',
                            label: 'Equipo listo (taller)',
                            icon: Wrench,
                            vars: ['{{cliente}}','{{equipo}}','{{orden}}','{{total}}'],
                        },
                        {
                            key: 'template_credit',
                            label: 'Recordatorio de deuda',
                            icon: CreditCard,
                            vars: ['{{cliente}}','{{monto}}'],
                        },
                    ].map(({ key, label, icon: Icon, vars }) => (
                        <div key={key} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                            <div className="flex items-center gap-2">
                                <Icon size={14} className="text-indigo-500" />
                                <span className="text-sm font-bold text-slate-700">{label}</span>
                            </div>
                            <textarea
                                value={config?.[key] || ''}
                                onChange={e => setConfig(c => ({ ...c, [key]: e.target.value }))}
                                onBlur={e => handleSaveTemplate(key, e.target.value)}
                                rows={5}
                                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-300 outline-none bg-white font-mono resize-y leading-relaxed"
                                placeholder="Escribe tu mensaje..."
                            />
                            <div className="flex flex-wrap gap-1.5">
                                {vars.map(v => (
                                    <button key={v}
                                        onClick={() => setConfig(c => ({ ...c, [key]: (c?.[key] || '') + v }))}
                                        className="px-2 py-0.5 text-[10px] font-mono bg-indigo-50 text-indigo-600 border border-indigo-200 rounded hover:bg-indigo-100 transition-colors">
                                        {v}
                                    </button>
                                ))}
                            </div>
                            <p className="text-[10px] text-slate-400">Clic en una variable para insertarla. Al salir del campo se guarda automáticamente.</p>
                        </div>
                    ))}
                </div>
            )}

            {/* ── MENSAJE DE PRUEBA ── */}
            {isConnected && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                        <Send size={13} className="text-indigo-500" /> Mensaje de prueba
                    </h3>
                    <div className="flex gap-2">
                        <input type="text" value={testPhone} onChange={e => setTestPhone(e.target.value)}
                            placeholder="Ej: +58 412 123 4567"
                            className="flex-1 px-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-300 outline-none bg-white" />
                        <button onClick={handleTest} disabled={testing || !testPhone.trim()}
                            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-all disabled:opacity-60 shrink-0">
                            {testing ? <Loader size={15} className="animate-spin" /> : <Send size={15} />}
                            {testing ? 'Enviando...' : 'Enviar'}
                        </button>
                    </div>
                    <p className="text-[11px] text-slate-400">Ingresa el número con código de país (+58 para Venezuela)</p>
                </div>
            )}

        </div>
    );
}
