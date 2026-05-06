import { useState, useEffect, useRef } from 'react';
import apiClient from '../../../config/axios';
import { toast } from 'react-hot-toast';
import { useFeatureFlag } from '../../../hooks/useFeatureFlag';
import {
    MessageCircle, Wifi, WifiOff, QrCode, RefreshCw,
    Send, ShoppingCart, Wrench, CreditCard, FileText,
    CheckCircle, XCircle, Loader, Smartphone, Zap, Info,
    Edit3, ChevronDown, ChevronUp, User, AlertTriangle,
    Package, BookOpen, Clock, DollarSign
} from 'lucide-react';

/* ── Toggle ─────────────────────────────────────────────── */
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

/* ── Fila de guía ────────────────────────────────────────── */
const GuideRow = ({ icon: Icon, iconColor, label, trigger, recipient, recipientType, example, vars }) => {
    const [open, setOpen] = useState(false);
    return (
        <div className="border border-slate-200 rounded-xl overflow-hidden">
            <button onClick={() => setOpen(o => !o)}
                className="w-full flex items-center gap-3 p-3.5 hover:bg-slate-50 transition-colors text-left">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${iconColor}`}>
                    <Icon size={15} />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-700">{label}</p>
                    <p className="text-xs text-slate-400 truncate">{trigger}</p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0
                    ${recipientType === 'cliente' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {recipientType === 'cliente' ? '👤 Cliente' : '🔑 Admin'}
                </span>
                {open ? <ChevronUp size={14} className="text-slate-400 shrink-0" /> : <ChevronDown size={14} className="text-slate-400 shrink-0" />}
            </button>
            {open && (
                <div className="border-t border-slate-100 p-3.5 bg-slate-50 space-y-3">
                    <div className="flex items-start gap-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase mt-0.5">Llega a:</span>
                        <span className="text-xs text-slate-600">{recipient}</span>
                    </div>
                    <div className="bg-white rounded-lg p-3 border border-slate-200">
                        <p className="text-[10px] font-black text-slate-400 uppercase mb-1.5">Ejemplo del mensaje:</p>
                        <pre className="text-xs text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">{example}</pre>
                    </div>
                    {vars && (
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Variables disponibles:</p>
                            <div className="flex flex-wrap gap-1">
                                {vars.map(v => (
                                    <span key={v} className="px-1.5 py-0.5 text-[10px] font-mono bg-indigo-50 text-indigo-600 border border-indigo-100 rounded">
                                        {v}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

/* ── Componente principal ────────────────────────────────── */
export default function WhatsAppTab() {
    const hasWhatsApp = useFeatureFlag('whatsapp_business');
    const [config, setConfig]       = useState(null);
    const [loading, setLoading]     = useState(true);
    const [qr, setQr]               = useState('');
    const [creating, setCreating]   = useState(false);
    const [testing, setTesting]     = useState(false);
    const [testPhone, setTestPhone] = useState('');
    const [qrAge, setQrAge]         = useState(0);
    const [showGuide, setShowGuide] = useState(false);
    const pollRef  = useRef(null);
    const timerRef = useRef(null);

    useEffect(() => {
        if (hasWhatsApp) loadConfig();
        return () => { clearInterval(pollRef.current); clearInterval(timerRef.current); };
    }, [hasWhatsApp]);

    useEffect(() => {
        clearInterval(pollRef.current); clearInterval(timerRef.current);
        if (config?.status === 'PENDING_QR') {
            pollRef.current  = setInterval(pollQr, 3000);
            timerRef.current = setInterval(() => setQrAge(a => a + 1), 1000);
        } else {
            setQr(''); setQrAge(0);
        }
    }, [config?.status]);

    const loadConfig = async () => {
        setLoading(true);
        try {
            const r = await apiClient.get('/whatsapp/config');
            setConfig(r.data);
            if (r.data.status === 'PENDING_QR') pollQr();
        } catch { toast.error('Error cargando configuración de WhatsApp'); }
        finally { setLoading(false); }
    };

    const pollQr = async () => {
        try {
            const r = await apiClient.get('/whatsapp/instance/qr');
            if (r.data.status === 'CONNECTED') {
                setConfig(c => ({ ...c, status: 'CONNECTED' }));
                toast.success('✅ ¡WhatsApp conectado!');
                clearInterval(pollRef.current); clearInterval(timerRef.current);
                return;
            }
            if (r.data.has_qr && r.data.qr_base64) { setQr(r.data.qr_base64); setQrAge(0); }
        } catch {}
    };

    const handleCreate = async () => {
        setCreating(true); setQr(''); setQrAge(0);
        try {
            await apiClient.post('/whatsapp/instance/create');
            setConfig(c => ({ ...c, status: 'PENDING_QR' }));
            toast.success('Generando código QR...');
        } catch (e) { toast.error('Error: ' + (e?.response?.data?.detail || e.message)); }
        finally { setCreating(false); }
    };

    const handleDisconnect = async () => {
        if (!confirm('¿Desconectar WhatsApp?')) return;
        try {
            await apiClient.post('/whatsapp/instance/disconnect');
            setConfig(c => ({ ...c, status: 'DISCONNECTED', enabled: false }));
            setQr('');
            toast.success('WhatsApp desconectado');
        } catch (e) { toast.error('Error: ' + (e?.response?.data?.detail || e.message)); }
    };

    const handleToggle = async (field, value) => {
        const prev = config;
        setConfig(c => ({ ...c, [field]: value }));
        try { await apiClient.post('/whatsapp/config', { [field]: value }); }
        catch { setConfig(prev); toast.error('Error guardando'); }
    };

    const handleSaveTemplate = async (key, value) => {
        if (!value.trim()) return;
        try { await apiClient.post('/whatsapp/config', { [key]: value }); toast.success('Plantilla guardada'); }
        catch { toast.error('Error guardando plantilla'); }
    };

    const handleSendRemindersNow = async () => {
        try {
            await apiClient.post('/whatsapp/credit-reminders/send-now');
            toast.success('✅ Recordatorios enviándose en segundo plano');
        } catch (e) { toast.error('Error: ' + (e?.response?.data?.detail || e.message)); }
    };

    const handleSaveAdminPhone = async (value) => {
        try { await apiClient.post('/whatsapp/config', { admin_phone: value }); toast.success('Número guardado'); }
        catch { toast.error('Error guardando número'); }
    };

    const handleTest = async () => {
        if (!testPhone.trim()) return toast.error('Ingresa un número');
        setTesting(true);
        try {
            await apiClient.post('/whatsapp/test', { phone: testPhone, message: '✅ Prueba desde Mi Inventario Fácil.\n\n¡WhatsApp configurado correctamente! 🎉' });
            toast.success('¡Mensaje enviado!');
        } catch (e) { toast.error('Error: ' + (e?.response?.data?.detail || e.message)); }
        finally { setTesting(false); }
    };

    /* ── Pantalla premium bloqueada ── */
    if (!hasWhatsApp) return (
        <div className="p-8 flex flex-col items-center justify-center text-center gap-4 min-h-64">
            <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center">
                <MessageCircle size={28} className="text-amber-500" />
            </div>
            <div>
                <h3 className="text-lg font-black text-slate-700 mb-1">WhatsApp Business Premium</h3>
                <p className="text-sm text-slate-500 max-w-sm">
                    Este módulo es una función premium. Contacta a soporte en{' '}
                    <a href="https://miinventariofacil.com" className="text-indigo-600 font-bold hover:underline" target="_blank" rel="noreferrer">
                        miinventariofacil.com
                    </a>{' '}para activarlo.
                </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center text-xs text-slate-400 mt-2">
                {['Ticket de venta automático','Cotizaciones PDF','Taller listo','Recordatorios','Plantillas personalizadas'].map(f => (
                    <span key={f} className="px-3 py-1 bg-slate-100 rounded-full">{f}</span>
                ))}
            </div>
        </div>
    );

    if (loading) return (
        <div className="flex items-center justify-center py-20">
            <Loader className="animate-spin text-indigo-500" size={32} />
        </div>
    );

    const isConnected    = config?.status === 'CONNECTED';
    const isPendingQr    = config?.status === 'PENDING_QR';
    const isDisconnected = !isConnected && !isPendingQr;
    const qrExpiringSoon = qrAge > 45;

    /* ── Datos de la guía ── */
    const guideItems = [
        {
            icon: ShoppingCart, iconColor: 'bg-emerald-100 text-emerald-600',
            label: 'Ticket de venta', recipientType: 'cliente',
            trigger: 'Al confirmar el cobro en el POS',
            recipient: 'El cliente seleccionado en la venta (si tiene teléfono registrado)',
            example: `🧾 *Mi Negocio*\n¡Gracias por tu compra, Juan!\n\n📋 Venta #0042\n📦 Efectivo\n\n*PAGOS:*\n  💳 Bs 148.500,00\n\n*TOTAL: Bs 148.500,00*\n\n¡Gracias por preferirnos! 😊`,
            vars: ['{{negocio}}','{{cliente}}','{{id}}','{{metodo_pago}}','{{pagos}}','{{total}}','{{vuelto}}'],
        },
        {
            icon: FileText, iconColor: 'bg-blue-100 text-blue-600',
            label: 'Cotización en PDF', recipientType: 'cliente',
            trigger: 'Al pulsar el botón WhatsApp (📱) en una cotización',
            recipient: 'El cliente de la cotización (si tiene teléfono registrado)',
            example: `📄 Cotización #0005 de Mi Negocio\n💰 Total: $250,00\n\n¡Gracias por tu preferencia! Respóndenos aquí si tienes dudas. 😊\n\n[Archivo adjunto: Cotizacion_0005.pdf]`,
            vars: null,
        },
        {
            icon: Package, iconColor: 'bg-teal-100 text-teal-600',
            label: 'Orden recibida en taller', recipientType: 'cliente',
            trigger: 'Al crear una nueva orden de servicio',
            recipient: 'El cliente de la orden (si tiene teléfono registrado)',
            example: `📥 *Mi Negocio*\nHola Juan, hemos recibido tu equipo:\n\n📱 Samsung Galaxy A54\n🎫 Orden: SRV-00042\n🔍 Pantalla rota\n📅 Entrega estimada: 05/04/2026\n\nTe avisaremos cuando esté listo. ¡Gracias!`,
            vars: null,
        },
        {
            icon: CreditCard, iconColor: 'bg-indigo-100 text-indigo-600',
            label: 'Confirmación de abono', recipientType: 'cliente',
            trigger: 'Al registrar un abono parcial a una venta de crédito',
            recipient: 'El cliente de la venta a crédito (si tiene teléfono)',
            example: `💳 *Mi Negocio*\nHola Pedro, confirmamos tu abono:\n\n💰 Pago recibido: Bs 50.000,00\n📄 Factura #38\n📋 Saldo restante: $ 30,00\n\n¡Gracias por tu puntualidad! 🙏`,
            vars: null,
        },
        {
            icon: Wrench, iconColor: 'bg-amber-100 text-amber-600',
            label: 'Equipo listo en taller', recipientType: 'cliente',
            trigger: 'Al cambiar el estado de una orden de servicio a LISTO',
            recipient: 'El cliente de la orden de servicio (si tiene teléfono)',
            example: `🔧 ¡Hola María! Tu equipo está listo 🎉\n\n📱 Samsung Galaxy A54\n🎫 Orden: TK-0018\n💰 Total: $85,00\n\n¡Puedes pasar a buscarlo en nuestro horario habitual!`,
            vars: ['{{cliente}}','{{equipo}}','{{orden}}','{{total}}','{{negocio}}'],
        },
        {
            icon: CreditCard, iconColor: 'bg-rose-100 text-rose-600',
            label: 'Recordatorio de deuda', recipientType: 'cliente',
            trigger: 'Automático todos los días a las 9:00am — clientes con crédito vencido +1 día',
            recipient: 'Clientes con saldo de crédito vencido (más de 1 día sin pagar)',
            example: `💳 Hola Pedro, te recordamos que tienes un saldo pendiente de *$150,00*.\n\n📅 Por favor regularizar a la brevedad.\n\n¡Gracias!`,
            vars: ['{{cliente}}','{{monto}}'],
        },
        {
            icon: Package, iconColor: 'bg-orange-100 text-orange-600',
            label: 'Alerta de stock bajo ✅', recipientType: 'admin',
            trigger: 'Automático todos los días a las 8:00am — productos en o bajo el stock mínimo',
            recipient: 'El número del administrador/dueño del negocio (configurable abajo)',
            example: `⚠️ *Alerta de Stock — Mi Negocio*\n\nEl producto *Cable HDMI 1.5m* está por agotarse.\n\n📦 Stock actual: 2 unidades\n🔴 Mínimo configurado: 5\n\n¡Es momento de reabastecer!`,
            vars: ['{{negocio}}','{{producto}}','{{stock_actual}}','{{stock_minimo}}'],
        },
        {
            icon: Clock, iconColor: 'bg-violet-100 text-violet-600',
            label: 'Resumen de cierre de caja ✅', recipientType: 'admin',
            trigger: 'Automático al cerrar la sesión de caja',
            recipient: 'El número del administrador/dueño del negocio',
            example: `📊 *Resumen del día — Mi Negocio*\n📅 Lunes 01/04/2026\n\n💵 Ventas: 12\n💰 Total cobrado: Bs 2.450.000\n💳 Efectivo: Bs 1.800.000\n🏦 Transferencia: Bs 650.000\n\n✅ Caja cerrada exitosamente`,
            vars: ['{{negocio}}','{{fecha}}','{{total_ventas}}','{{total_bs}}','{{efectivo}}','{{transferencia}}'],
        },
    ];

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

            {/* ── GUÍA COMPLETA (expandible) ── */}
            <div className="border border-indigo-200 rounded-2xl overflow-hidden">
                <button onClick={() => setShowGuide(g => !g)}
                    className="w-full flex items-center gap-3 p-4 bg-indigo-50 hover:bg-indigo-100 transition-colors text-left">
                    <BookOpen size={18} className="text-indigo-600 shrink-0" />
                    <div className="flex-1">
                        <p className="text-sm font-black text-indigo-800">📖 Guía de automatizaciones</p>
                        <p className="text-xs text-indigo-600">¿Qué mensajes se envían y cuándo? Toca para ver</p>
                    </div>
                    {showGuide ? <ChevronUp size={16} className="text-indigo-500" /> : <ChevronDown size={16} className="text-indigo-500" />}
                </button>
                {showGuide && (
                    <div className="p-4 space-y-3 bg-white">
                        <div className="flex gap-3 text-xs mb-2">
                            <span className="flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-700 rounded-full font-bold">
                                👤 Cliente — le llega al cliente
                            </span>
                            <span className="flex items-center gap-1 px-2 py-1 bg-amber-50 text-amber-700 rounded-full font-bold">
                                🔑 Admin — te llega a ti
                            </span>
                        </div>
                        {guideItems.map((item) => (
                            <GuideRow key={item.label} {...item} />
                        ))}
                        <p className="text-[11px] text-slate-400 text-center pt-1">
                            Todas las automatizaciones están activas. Puedes configurar cada una con los toggles de la sección "Notificaciones automáticas".
                        </p>
                    </div>
                )}
            </div>

            {/* ── DESCONECTADO ── */}
            {isDisconnected && (
                <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                        <Smartphone size={28} className="text-emerald-600" />
                    </div>
                    <h3 className="text-lg font-black text-slate-700 mb-2">Conecta tu número de WhatsApp</h3>
                    <p className="text-sm text-slate-500 mb-6 max-w-sm mx-auto">
                        Conecta el número del negocio para enviar tickets, notificaciones y más automáticamente.
                    </p>
                    <button onClick={handleCreate} disabled={creating}
                        className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm transition-all mx-auto shadow-lg shadow-emerald-200 disabled:opacity-60">
                        {creating ? <><Loader size={16} className="animate-spin" /> Preparando QR...</> : <><QrCode size={16} /> Conectar WhatsApp</>}
                    </button>
                </div>
            )}

            {/* ── PENDING QR ── */}
            {isPendingQr && (
                <div className="bg-white border border-amber-200 rounded-2xl p-6 shadow-sm">
                    <div className="text-center mb-4">
                        <h3 className="text-base font-black text-slate-700 mb-1">Escanea el código QR</h3>
                        <p className="text-xs text-slate-500">Abre WhatsApp → Menú (⋮) → Dispositivos vinculados → Vincular dispositivo</p>
                    </div>
                    {qr ? (
                        <div className="flex flex-col items-center gap-4">
                            <div className={`relative rounded-2xl overflow-hidden border-4 transition-colors ${qrExpiringSoon ? 'border-amber-300' : 'border-indigo-100'}`}>
                                <img src={qr.startsWith('data:') ? qr : `data:image/png;base64,${qr}`} alt="QR WhatsApp" className="w-56 h-56" />
                                {qrExpiringSoon && (
                                    <div className="absolute inset-0 bg-amber-50/80 flex items-center justify-center flex-col gap-2">
                                        <RefreshCw size={24} className="text-amber-600 animate-spin" />
                                        <p className="text-xs font-bold text-amber-700">Actualizando QR...</p>
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-slate-500 animate-pulse">
                                <Loader size={11} className="animate-spin text-amber-500" /> Esperando escaneo...
                            </div>
                            <div className="w-56 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full transition-all ${qrExpiringSoon ? 'bg-amber-400' : 'bg-indigo-400'}`}
                                    style={{ width: `${Math.max(0, 100 - (qrAge / 60) * 100)}%` }} />
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
                        <p className="text-xs text-blue-700">El QR se actualiza automáticamente cada 60 segundos. Una vez escaneado, esta pantalla cambiará automáticamente.</p>
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
                            <p className="text-xs text-emerald-600">Instancia: {config?.instance_name}</p>
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
                        <Zap size={13} className="text-indigo-500" /> Notificaciones automáticas
                        {!isConnected && <span className="text-[10px] font-medium text-amber-600 normal-case tracking-normal">(activas al conectar)</span>}
                    </h3>
                    <NotifToggle icon={ShoppingCart} label="Ticket de venta" desc="Comprobante al cliente al cobrar en el POS"
                        value={config?.notify_sale ?? true} onChange={v => handleToggle('notify_sale', v)} disabled={!isConnected} />
                    <NotifToggle icon={Wrench} label="Equipo listo en taller" desc="Avisar cuando la orden pasa a LISTO"
                        value={config?.notify_order ?? true} onChange={v => handleToggle('notify_order', v)} disabled={!isConnected} />
                    <NotifToggle icon={CreditCard} label="Recordatorio de deuda" desc="Avisar clientes con crédito vencido"
                        value={config?.notify_credit ?? true} onChange={v => handleToggle('notify_credit', v)} disabled={!isConnected} />
                    <NotifToggle icon={FileText} label="Envío de cotizaciones" desc="Botón PDF en cada cotización"
                        value={config?.notify_quote ?? false} onChange={v => handleToggle('notify_quote', v)} disabled={!isConnected} />
                    <NotifToggle icon={Smartphone} label="Bienvenida cliente nuevo" desc="Mensaje al registrar un cliente con teléfono"
                        value={config?.notify_welcome ?? true} onChange={v => handleToggle('notify_welcome', v)} disabled={!isConnected} />
                    <NotifToggle icon={FileText} label="Cotización por vencer" desc="Aviso 2 días antes del vencimiento"
                        value={config?.notify_quote_expiry ?? true} onChange={v => handleToggle('notify_quote_expiry', v)} disabled={!isConnected} />
                    <NotifToggle icon={Clock} label="Garantía por vencer" desc="Aviso 7 días antes del vencimiento"
                        value={config?.notify_warranty ?? true} onChange={v => handleToggle('notify_warranty', v)} disabled={!isConnected} />
                    <NotifToggle icon={Package} label="Alerta de stock bajo" desc="A las 8:00am cuando hay stock bajo mínimo"
                        value={config?.notify_stock ?? true} onChange={v => handleToggle('notify_stock', v)} disabled={!isConnected} />
                    <NotifToggle icon={Clock} label="Resumen de cierre de caja" desc="Al cerrar la sesión de caja del día"
                        value={config?.notify_cash_summary ?? true} onChange={v => handleToggle('notify_cash_summary', v)} disabled={!isConnected} />
                    <NotifToggle icon={DollarSign} label="Comisiones pendientes al cierre" desc="Resumen de comisiones de todos los vendedores al cerrar caja"
                        value={config?.notify_commissions ?? true} onChange={v => handleToggle('notify_commissions', v)} disabled={!isConnected} />
                </div>
            )}

            {/* ── CONFIG RECORDATORIO CRÉDITO ── */}
            {(isConnected || isPendingQr) && config?.notify_credit && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <CreditCard size={14} className="text-indigo-600" />
                            <span className="text-sm font-bold text-indigo-800">Configurar recordatorio de deuda</span>
                        </div>
                        <button onClick={handleSendRemindersNow}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all">
                            <Send size={12} /> Enviar ahora
                        </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-bold text-slate-600 block mb-1">Envío automático</label>
                            <button
                                onClick={() => handleToggle('credit_reminder_auto', !config?.credit_reminder_auto)}
                                disabled={!isConnected}
                                className={`w-full px-3 py-2 rounded-xl text-xs font-bold border transition-all
                                    ${config?.credit_reminder_auto
                                        ? 'bg-indigo-600 text-white border-indigo-600'
                                        : 'bg-white text-slate-500 border-slate-200'}`}>
                                {config?.credit_reminder_auto ? '✅ Automático' : '⏸ Manual'}
                            </button>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-600 block mb-1">Hora del envío</label>
                            <select
                                value={config?.credit_reminder_hour ?? 9}
                                onChange={e => {
                                    const h = parseInt(e.target.value);
                                    setConfig(c => ({ ...c, credit_reminder_hour: h }));
                                    apiClient.post('/whatsapp/config', { credit_reminder_hour: h });
                                }}
                                disabled={!isConnected || !config?.credit_reminder_auto}
                                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white outline-none focus:ring-2 focus:ring-indigo-300 disabled:opacity-50">
                                {Array.from({length: 24}, (_,i) => (
                                    <option key={i} value={i}>
                                        {String(i).padStart(2,'0')}:00 {i < 12 ? 'am' : 'pm'}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-slate-600 block mb-1">
                            Enviar recordatorio a partir de los <span className="text-indigo-700">{config?.credit_reminder_days ?? 1} día(s)</span> de vencido
                        </label>
                        <input type="range" min="1" max="30"
                            value={config?.credit_reminder_days ?? 1}
                            onChange={e => {
                                const d = parseInt(e.target.value);
                                setConfig(c => ({ ...c, credit_reminder_days: d }));
                            }}
                            onMouseUp={e => apiClient.post('/whatsapp/config', { credit_reminder_days: parseInt(e.target.value) })}
                            onTouchEnd={e => apiClient.post('/whatsapp/config', { credit_reminder_days: parseInt(e.target.value) })}
                            disabled={!isConnected}
                            className="w-full accent-indigo-600" />
                        <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                            <span>1 día (inmediato)</span>
                            <span>15 días</span>
                            <span>30 días</span>
                        </div>
                    </div>
                    <p className="text-[11px] text-indigo-600">
                        {config?.credit_reminder_auto
                            ? `Los recordatorios se envían automáticamente a las ${String(config?.credit_reminder_hour ?? 9).padStart(2,'0')}:00 cuando el crédito lleva más de ${config?.credit_reminder_days ?? 1} día(s) vencido.`
                            : 'Envío automático desactivado. Usa el botón "Enviar ahora" cuando quieras cobrar.'}
                    </p>
                </div>
            )}

            {/* ── NÚMERO DEL ADMINISTRADOR ── */}
            {/* ── NÚMERO DEL ADMINISTRADOR ──  */}
            {(isConnected || isPendingQr) && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2">
                    <div className="flex items-center gap-2 mb-1">
                        <User size={14} className="text-amber-600" />
                        <span className="text-sm font-bold text-amber-800">Mi número personal (Admin)</span>
                    </div>
                    <p className="text-xs text-amber-700">Para alertas de stock bajo, resumen de caja y avisos internos del sistema. No se comparte con clientes.</p>
                    <input
                        type="text"
                        value={config?.admin_phone || ''}
                        onChange={e => setConfig(c => ({ ...c, admin_phone: e.target.value }))}
                        onBlur={e => handleSaveAdminPhone(e.target.value)}
                        placeholder="Ej: 584121234567"
                        className="w-full px-3 py-2 text-sm border border-amber-200 rounded-xl focus:ring-2 focus:ring-amber-300 outline-none bg-white"
                    />
                    <div className="grid grid-cols-1 gap-1.5 text-[11px] text-amber-700 bg-amber-100 rounded-lg p-2.5 mt-1">
                        <p className="font-black uppercase tracking-wide text-amber-800 mb-0.5">📋 Formato del número</p>
                        <div className="grid grid-cols-3 gap-1 mb-1">
                          <span className="bg-white/70 px-2 py-1 rounded text-center font-mono font-bold">🇻🇪 58...</span>
                          <span className="bg-white/70 px-2 py-1 rounded text-center font-mono font-bold">🇨🇴 57...</span>
                          <span className="bg-white/70 px-2 py-1 rounded text-center font-mono font-bold">🇲🇽 52...</span>
                        </div>
                        <p>Código de país <strong>sin el +</strong> + número completo sin espacios.</p>
                        <p>Venezuela: <strong>58</strong> + operador (414, 424, 416, 412, 426) + 7 dígitos → <span className="font-mono">584141234567</span></p>
                    </div>
                </div>
            )}

            {/* ── PLANTILLAS ── */}
            {isConnected && (
                <div className="space-y-4">
                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                        <Edit3 size={13} className="text-indigo-500" /> Plantillas de mensajes
                    </h3>
                    {[
                        { key: 'template_welcome', label: 'Bienvenida cliente nuevo', icon: Smartphone,
                          vars: ['{{cliente}}','{{negocio}}'] },
                        { key: 'template_sale',   label: 'Ticket de venta',        icon: ShoppingCart,
                          vars: ['{{negocio}}','{{cliente}}','{{id}}','{{metodo_pago}}','{{pagos}}','{{total}}','{{vuelto}}'] },
                        { key: 'template_order',  label: 'Equipo listo (taller)',   icon: Wrench,
                          vars: ['{{cliente}}','{{equipo}}','{{orden}}','{{total}}','{{negocio}}'] },
                        { key: 'template_credit', label: 'Recordatorio de deuda',   icon: CreditCard,
                          vars: ['{{cliente}}','{{monto}}'] },
                    ].map(({ key, label, icon: Icon, vars }) => (
                        <div key={key} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                            <div className="flex items-center gap-2">
                                <Icon size={14} className="text-indigo-500" />
                                <span className="text-sm font-bold text-slate-700">{label}</span>
                            </div>
                            <textarea value={config?.[key] || ''} rows={5}
                                onChange={e => setConfig(c => ({ ...c, [key]: e.target.value }))}
                                onBlur={e => handleSaveTemplate(key, e.target.value)}
                                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-300 outline-none bg-white font-mono resize-y leading-relaxed" />
                            <div className="flex flex-wrap gap-1.5">
                                {vars.map(v => (
                                    <button key={v} onClick={() => setConfig(c => ({ ...c, [key]: (c?.[key] || '') + v }))}
                                        className="px-2 py-0.5 text-[10px] font-mono bg-indigo-50 text-indigo-600 border border-indigo-200 rounded hover:bg-indigo-100 transition-colors">
                                        {v}
                                    </button>
                                ))}
                            </div>
                            <p className="text-[10px] text-slate-400">Clic en variable para insertar. Guardado automático al salir del campo.</p>
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
