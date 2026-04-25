import { useState, useEffect } from 'react';
import React from 'react';
import { createPortal } from 'react-dom';
import { useConfig } from '../../context/ConfigContext';
import {
    X, ShoppingCart, Wrench, FileText, CreditCard, DollarSign,
    Phone, Mail, MapPin, Package, TrendingUp, Clock,
    AlertCircle, Star, User, MessageCircle, Send
} from 'lucide-react';
import apiClient from '../../config/axios';

const fmt = (n) => `$${Number(n || 0).toFixed(2)}`;

// ── Helpers WhatsApp ──────────────────────────────────────
const waLink = (phone, msg) => {
    const clean = (phone || '').replace(/\D/g, '');
    if (!clean) return null;
    return `https://wa.me/${clean}?text=${encodeURIComponent(msg)}`;
};

const WaButton = ({ phone, label, icon: Icon, message, color = 'emerald' }) => {
    const [sending, setSending] = React.useState(false);
    if (!phone) return null;

    const colors = {
        emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100',
        amber:   'bg-amber-50   border-amber-200   text-amber-700   hover:bg-amber-100',
        indigo:  'bg-indigo-50  border-indigo-200  text-indigo-700  hover:bg-indigo-100',
    };

    const handleSend = async () => {
        setSending(true);
        try {
            await apiClient.post('/whatsapp/send-message', { phone, message });
            toast.success('✅ Mensaje enviado por WhatsApp');
        } catch (e) {
            const detail = e?.response?.data?.detail || 'Error al enviar';
            // Si WhatsApp no está conectado, ofrecer el link manual como fallback
            if (e?.response?.status === 503) {
                toast.error('WhatsApp no conectado — abriendo manualmente...');
                const clean = phone.replace(/\D/g, '');
                window.open(`https://wa.me/${clean}?text=${encodeURIComponent(message)}`, '_blank');
            } else {
                toast.error(detail);
            }
        } finally {
            setSending(false);
        }
    };

    return (
        <button onClick={handleSend} disabled={sending}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition-all disabled:opacity-60 ${colors[color]}`}>
            {sending
                ? <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                : <Icon size={13} />
            }
            {sending ? 'Enviando...' : label}
        </button>
    );
};
const fmtDate = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' });
};

const TYPE_CFG = {
    sale:          { icon: ShoppingCart, label: 'Venta',       color: 'text-blue-600',    bg: 'bg-blue-50',    dot: 'bg-blue-500',    border: 'border-blue-100' },
    service_order: { icon: Wrench,       label: 'Taller',      color: 'text-violet-600',  bg: 'bg-violet-50',  dot: 'bg-violet-500',  border: 'border-violet-100' },
    quote:         { icon: FileText,     label: 'Cotización',  color: 'text-amber-600',   bg: 'bg-amber-50',   dot: 'bg-amber-500',   border: 'border-amber-100' },
    credit_payment:{ icon: CreditCard,   label: 'Pago crédito',color: 'text-emerald-600', bg: 'bg-emerald-50', dot: 'bg-emerald-500', border: 'border-emerald-100' },
};

const STATUS_CFG = {
    PAID:       { label: 'Pagada',      color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
    CREDIT:     { label: 'Crédito',     color: 'text-amber-600   bg-amber-50   border-amber-200'   },
    PENDING:    { label: 'Pendiente',   color: 'text-blue-600    bg-blue-50    border-blue-200'     },
    CONVERTED:  { label: 'Facturada',   color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
    EXPIRED:    { label: 'Vencida',     color: 'text-rose-600    bg-rose-50    border-rose-200'     },
    RECEIVED:   { label: 'Recibido',    color: 'text-slate-600   bg-slate-50   border-slate-200'    },
    DIAGNOSIS:  { label: 'Diagnóstico', color: 'text-blue-600    bg-blue-50    border-blue-200'     },
    APPROVED:   { label: 'Aprobado',    color: 'text-indigo-600  bg-indigo-50  border-indigo-200'   },
    IN_PROGRESS:{ label: 'En Proceso',  color: 'text-violet-600  bg-violet-50  border-violet-200'   },
    READY:      { label: 'Listo',       color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
    DELIVERED:  { label: 'Entregado',   color: 'text-slate-500   bg-slate-50   border-slate-200'    },
};

const StatusBadge = ({ status }) => {
    const cfg = STATUS_CFG[status] || STATUS_CFG.PENDING;
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${cfg.color}`}>
            {cfg.label}
        </span>
    );
};

const StatCard = ({ icon: Icon, label, value, sub, colorClass, alert = false }) => (
    <div className={`rounded-2xl border p-4 flex flex-col gap-1 ${colorClass} ${alert ? 'ring-2 ring-rose-300' : ''}`}>
        <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest opacity-70">{label}</span>
            <Icon size={15} className="opacity-60" />
        </div>
        <p className="text-xl font-black leading-none mt-1">{value}</p>
        {sub && <p className="text-[11px] font-medium opacity-60 mt-0.5">{sub}</p>}
    </div>
);

const TimelineItem = ({ item }) => {
    const cfg = TYPE_CFG[item.type] || TYPE_CFG.sale;
    const Icon = cfg.icon;
    return (
        <div className={`flex gap-3 p-3 rounded-xl border ${cfg.border} ${cfg.bg}`}>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-white/70`}>
                <Icon size={14} className={cfg.color} />
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-xs font-bold text-slate-700 truncate">{item.ref}</span>
                        <span className={`text-[9px] font-bold uppercase ${cfg.color}`}>{cfg.label}</span>
                    </div>
                    <StatusBadge status={item.status} />
                </div>
                <div className="flex items-center justify-between">
                    <div className="min-w-0">
                        {item.meta?.device && <p className="text-[11px] text-slate-500 truncate">{item.meta.device}</p>}
                        {item.meta?.items_count > 0 && <p className="text-[11px] text-slate-500">{item.meta.items_count} ítems</p>}
                        {item.type === 'credit_payment' && <p className="text-[11px] text-slate-500">{item.method}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                        {item.amount > 0 && <span className="text-xs font-black text-slate-700">{fmt(item.amount)}</span>}
                        <span className="text-[10px] text-slate-400">{fmtDate(item.date)}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

const Customer360 = ({ customerId, customerName, onClose }) => {
    const [data, setData]       = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError]     = useState(null);
    const { business }          = useConfig();
    const bizName = business?.name || 'Mi Inventario';

    useEffect(() => {
        if (!customerId) return;
        setLoading(true); setError(null);
        apiClient.get(`/customers/${customerId}/360`)
            .then(r => setData(r.data))
            .catch(() => setError('No se pudo cargar el historial del cliente'))
            .finally(() => setLoading(false));
    }, [customerId]);

    const c = data?.customer;
    const s = data?.summary;

    return createPortal(
        <>
            <div style={{ position:'fixed',inset:0,zIndex:9990,background:'rgba(15,23,42,0.45)',backdropFilter:'blur(3px)' }} onClick={onClose} />

            <div style={{ position:'fixed',top:0,right:0,bottom:0,zIndex:9991,width:'100%',maxWidth:'520px',background:'white',boxShadow:'-8px 0 40px rgba(0,0,0,0.15)',display:'flex',flexDirection:'column',animation:'slideInRight 0.2s ease-out' }}>

                {/* Header */}
                <div style={{ background:'linear-gradient(135deg,#4f46e5,#7c3aed)',padding:'20px',flexShrink:0 }}>
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                                <User size={22} className="text-white" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest">Vista 360° del Cliente</p>
                                <h2 className="text-white font-black text-lg leading-tight truncate">
                                    {c?.name || customerName || 'Cliente'}
                                </h2>
                                {c?.id_number && <p className="text-white/60 text-xs mt-0.5">{c.id_number}</p>}
                            </div>
                        </div>
                        <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/15 hover:bg-white/25 flex items-center justify-center text-white/80 transition-all shrink-0">
                            <X size={16} />
                        </button>
                    </div>
                    {c && (
                        <div className="flex flex-wrap gap-3 mt-3">
                            {c.phone && <span className="flex items-center gap-1 text-white/70 text-xs"><Phone size={11}/>{c.phone}</span>}
                            {c.email && <span className="flex items-center gap-1 text-white/70 text-xs"><Mail size={11}/>{c.email}</span>}
                            {c.address && <span className="flex items-center gap-1 text-white/70 text-xs"><MapPin size={11}/>{c.address}</span>}
                        </div>
                    )}
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto">
                    {loading && (
                        <div className="flex flex-col items-center justify-center h-60 gap-3 text-slate-400">
                            <div className="w-10 h-10 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin" />
                            <p className="text-sm font-medium animate-pulse">Cargando historial...</p>
                        </div>
                    )}
                    {error && (
                        <div className="m-4 p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-600 text-sm font-medium flex items-center gap-2">
                            <AlertCircle size={16}/>{error}
                        </div>
                    )}
                    {data && !loading && (
                        <div className="p-4 space-y-5">

                            {/* Stats */}
                            <div className="grid grid-cols-2 gap-2.5">
                                <StatCard icon={DollarSign} label="Valor total cliente" value={fmt(s.lifetime_value)} sub={`${s.total_sales} ventas · ${s.total_orders} taller`} colorClass="bg-indigo-50 border-indigo-100 text-indigo-700" />
                                <StatCard icon={TrendingUp}  label="Solo ventas POS"   value={fmt(s.total_spent)}        sub={`${s.total_sales} transacciones`}                  colorClass="bg-emerald-50 border-emerald-100 text-emerald-700" />
                                <StatCard icon={Wrench}      label="Total en taller"   value={fmt(s.total_orders_amount)} sub={`${s.total_orders} órdenes de servicio`}          colorClass="bg-violet-50 border-violet-100 text-violet-700" />
                                <StatCard icon={CreditCard}  label="Saldo crédito"     value={fmt(c.current_balance)}     sub={c.credit_limit > 0 ? `Límite: ${fmt(c.credit_limit)}` : 'Sin crédito configurado'} colorClass={c.current_balance > 0 ? "bg-rose-50 border-rose-100 text-rose-700" : "bg-slate-50 border-slate-100 text-slate-700"} alert={c.current_balance > 0} />
                            </div>

                            {/* ── Acciones WhatsApp ── */}
                            {c?.phone && (
                                <div>
                                    <div className="flex items-center gap-2 mb-2.5">
                                        <MessageCircle size={13} className="text-emerald-600" />
                                        <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Contactar por WhatsApp</h3>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {c.current_balance > 0 && (
                                            <WaButton
                                                phone={c.phone}
                                                label={`Cobrar crédito ${fmt(c.current_balance)}`}
                                                icon={Send}
                                                color="amber"
                                                message={`Hola ${c.name}! 👋\n\nTe recordamos desde *${bizName}* que tienes un saldo pendiente de *${fmt(c.current_balance)}*.\n\nCuando puedas, por favor comunícate con nosotros para coordinar el pago. ¡Gracias!`}
                                            />
                                        )}
                                        <WaButton
                                            phone={c.phone}
                                            label="Enviar recordatorio"
                                            icon={MessageCircle}
                                            color="indigo"
                                            message={`Hola ${c.name}! 👋\n\nTe escribimos desde *${bizName}*. ¿En qué podemos ayudarte hoy?`}
                                        />
                                        <WaButton
                                            phone={c.phone}
                                            label="Nuevos productos"
                                            icon={MessageCircle}
                                            color="emerald"
                                            message={`Hola ${c.name}! 🛍️\n\nEn *${bizName}* tenemos nuevos productos que pueden interesarte. ¡Visítanos o escríbenos!`}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Top productos */}
                            {data.top_products?.length > 0 && (
                                <div>
                                    <div className="flex items-center gap-2 mb-2.5">
                                        <Star size={13} className="text-amber-500" />
                                        <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Productos que más compra</h3>
                                    </div>
                                    <div className="space-y-1.5">
                                        {data.top_products.map((p, i) => (
                                            <div key={p.id} className="flex items-center gap-3 px-3 py-2.5 bg-amber-50/60 rounded-xl border border-amber-100">
                                                <div className="w-6 h-6 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                                                    <span className="text-[10px] font-black text-amber-600">#{i+1}</span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-bold text-slate-700 truncate">{p.name}</p>
                                                    <p className="text-[10px] text-slate-400">{p.times_bought}x · {Number(p.total_qty).toFixed(0)} unidades</p>
                                                </div>
                                                <span className="text-xs font-black text-slate-700 shrink-0">{fmt(p.total_amount)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Timeline */}
                            <div>
                                <div className="flex items-center justify-between mb-2.5">
                                    <div className="flex items-center gap-2">
                                        <Clock size={13} className="text-slate-400" />
                                        <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Actividad reciente</h3>
                                    </div>
                                    {s.pending_quotes > 0 && (
                                        <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                                            {s.pending_quotes} cotización{s.pending_quotes > 1 ? 'es' : ''} sin respuesta
                                        </span>
                                    )}
                                </div>
                                {data.timeline.length === 0 ? (
                                    <div className="py-10 text-center text-slate-400">
                                        <Package size={32} className="mx-auto mb-2 opacity-20" />
                                        <p className="text-sm font-medium">Sin actividad registrada</p>
                                        <p className="text-xs mt-1">Este cliente aún no tiene compras, órdenes ni cotizaciones</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {data.timeline.map((item, i) => (
                                            <TimelineItem key={`${item.type}-${item.id}-${i}`} item={item} />
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Leyenda */}
                            <div className="flex flex-wrap gap-3 pt-2 border-t border-slate-100">
                                {Object.entries(TYPE_CFG).map(([type, cfg]) => (
                                    <div key={type} className="flex items-center gap-1.5">
                                        <div className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
                                        <span className="text-[10px] text-slate-400 font-medium">{cfg.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/80 shrink-0 text-center">
                    <p className="text-[10px] text-slate-400">Mostrando los últimos 20 registros por categoría</p>
                </div>
            </div>

            <style>{`@keyframes slideInRight{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}`}</style>
        </>,
        document.body
    );
};

export default Customer360;
