import React, { useEffect, useMemo, useState } from 'react';
import {
    getAllTickets,
    getTicketMessages,
    sendTicketMessage,
    updateTicketStatus,
} from '../api/support';
import type { SupportMessage, SupportTicket } from '../api/support';
import { getTenants } from '../api/tenants';
import type { Tenant } from '../types/tenant';
import {
    Building,
    CheckCircle,
    Clock,
    Download,
    Eye,
    Filter,
    LifeBuoy,
    MessageSquare,
    Paperclip,
    RefreshCw,
    Send,
    X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';

const STATUS_LABELS: Record<string, string> = {
    open: 'Abierto',
    in_progress: 'En proceso',
    resolved: 'Resuelto',
    closed: 'Cerrado',
};

const PRIORITY_LABELS: Record<string, string> = {
    low: 'Baja',
    medium: 'Media',
    high: 'Alta',
    critical: 'Critica',
};

const statusColors: Record<string, string> = {
    open: 'bg-blue-50 text-blue-700 ring-blue-100',
    in_progress: 'bg-amber-50 text-amber-700 ring-amber-100',
    resolved: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    closed: 'bg-slate-100 text-slate-600 ring-slate-200',
};

const priorityColors: Record<string, string> = {
    low: 'text-slate-500 bg-slate-50 ring-slate-200',
    medium: 'text-blue-700 bg-blue-50 ring-blue-100',
    high: 'text-amber-700 bg-amber-50 ring-amber-100',
    critical: 'text-rose-700 bg-rose-50 ring-rose-100',
};

const formatDateTime = (value?: string) => {
    if (!value) return '-';
    try {
        return new Date(value).toLocaleString('es-VE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return '-';
    }
};

const formatBytes = (bytes?: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const HelpDesk: React.FC = () => {
    const [tickets, setTickets] = useState<SupportTicket[]>([]);
    const [tenants, setTenants] = useState<Record<number, string>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState('');
    const [filterPriority, setFilterPriority] = useState('');
    const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
    const [messages, setMessages] = useState<SupportMessage[]>([]);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [replyMessage, setReplyMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        fetchInitialData();
    }, [filterStatus, filterPriority]);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) return;

        const apiBase = api.defaults.baseURL || `${window.location.origin}/api/v1`;
        const wsProtocol = apiBase.startsWith('https') ? 'wss:' : 'ws:';
        const cleanBase = apiBase.replace(/^https?:\/\//, '').replace(/\/+$/, '');
        const wsUrl = `${wsProtocol}//${cleanBase}/ws?tenant_id=public&token=${encodeURIComponent(token)}`;
        const socket = new WebSocket(wsUrl);

        socket.onmessage = (event) => {
            if (event.data === 'pong') return;
            try {
                const payload = JSON.parse(event.data);
                if (payload.type === 'support:ticket_created') {
                    fetchInitialData();
                    toast.success('Nuevo ticket de soporte recibido');
                }
                if (payload.type === 'support:message_created') {
                    const message = payload.data as SupportMessage & { tenant?: string };
                    if (!message?.ticket_id) return;
                    setTickets(prev => prev.map(ticket => (
                        ticket.id === message.ticket_id
                            ? {
                                ...ticket,
                                updated_at: message.created_at,
                                last_message_at: message.created_at,
                                last_message_sender: message.sender_type,
                                unread_for_admin: message.sender_type === 'user' && selectedTicket?.id !== message.ticket_id,
                                admin_response: message.sender_type === 'admin' ? message.message : ticket.admin_response,
                            }
                            : ticket
                    )));
                    setMessages(prev => {
                        if (selectedTicket?.id !== message.ticket_id) return prev;
                        if (prev.some(item => item.id === message.id)) return prev;
                        return [...prev, message];
                    });
                    if (selectedTicket?.id !== message.ticket_id && message.sender_type === 'user') {
                        toast.success('Nuevo mensaje de soporte recibido');
                    }
                }
            } catch (err) {
                console.warn('Mensaje WS no reconocido', err);
            }
        };

        socket.onopen = () => {
            const timer = window.setInterval(() => {
                if (socket.readyState === WebSocket.OPEN) socket.send('ping');
            }, 30000);
            socket.addEventListener('close', () => window.clearInterval(timer), { once: true });
        };

        return () => socket.close();
    }, [selectedTicket?.id]);

    const fetchInitialData = async () => {
        setIsLoading(true);
        try {
            const [ticketsData, tenantsData] = await Promise.all([
                getAllTickets({ status: filterStatus || undefined, priority: filterPriority || undefined }),
                getTenants(),
            ]);
            setTickets(ticketsData || []);

            const tenantMap: Record<number, string> = {};
            tenantsData.tenants.forEach((tenant: Tenant) => {
                tenantMap[tenant.id] = tenant.name;
            });
            setTenants(tenantMap);
        } catch (err) {
            console.error(err);
            toast.error('Error al cargar datos de la mesa de ayuda');
        } finally {
            setIsLoading(false);
        }
    };

    const stats = useMemo(() => ({
        total: tickets.length,
        active: tickets.filter(ticket => ['open', 'in_progress'].includes(ticket.status)).length,
        critical: tickets.filter(ticket => ticket.priority === 'critical').length,
        unread: tickets.filter(ticket => ticket.unread_for_admin).length,
    }), [tickets]);

    const openTicket = async (ticket: SupportTicket) => {
        setSelectedTicket(ticket);
        setReplyMessage('');
        setLoadingMessages(true);
        try {
            const data = await getTicketMessages(ticket.id);
            setMessages(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error(err);
            toast.error('No se pudo cargar la conversacion');
            setMessages([]);
        } finally {
            setLoadingMessages(false);
        }
    };

    const closeTicket = () => {
        setSelectedTicket(null);
        setMessages([]);
        setReplyMessage('');
    };

    const handleReply = async () => {
        if (!selectedTicket || !replyMessage.trim()) return;
        setIsSubmitting(true);
        try {
            const created = await sendTicketMessage(selectedTicket.id, replyMessage.trim());
            setMessages(prev => [...prev, created]);
            setReplyMessage('');
            setTickets(prev => prev.map(ticket => (
                ticket.id === selectedTicket.id
                    ? { ...ticket, admin_response: created.message, status: ticket.status === 'open' ? 'in_progress' : ticket.status, updated_at: created.created_at, last_message_at: created.created_at, last_message_sender: 'admin', unread_for_admin: false }
                    : ticket
            )));
            setSelectedTicket(prev => prev ? { ...prev, admin_response: created.message, status: prev.status === 'open' ? 'in_progress' : prev.status, updated_at: created.created_at, last_message_at: created.created_at, last_message_sender: 'admin', unread_for_admin: false } : prev);
            toast.success('Mensaje enviado');
        } catch (err) {
            console.error(err);
            toast.error('Error al enviar mensaje');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleStatusUpdate = async (id: number, status: string) => {
        try {
            const updated = await updateTicketStatus(id, status);
            setTickets(prev => prev.map(ticket => ticket.id === updated.id ? updated : ticket));
            if (selectedTicket?.id === id) setSelectedTicket(updated);
            toast.success('Estado actualizado');
        } catch (err) {
            console.error(err);
            toast.error('Error al actualizar estado');
        }
    };

    const companyName = (ticket: SupportTicket) => (
        ticket.tenant_id ? (tenants[ticket.tenant_id] || `ID: ${ticket.tenant_id}`) : (ticket.full_name || 'Sin empresa')
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-500">Soporte tecnico</p>
                    <h1 className="text-3xl font-black text-slate-950">Mesa de Ayuda</h1>
                    <p className="mt-1 text-sm font-medium text-slate-500">Consola central para conversar con clientes y revisar archivos adjuntos.</p>
                </div>
                <div className="grid grid-cols-3 gap-2 sm:min-w-[360px]">
                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-center shadow-sm">
                        <p className="text-2xl font-black text-slate-950">{stats.total}</p>
                        <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Tickets</p>
                    </div>
                    <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-center shadow-sm">
                        <p className="text-2xl font-black text-blue-700">{stats.active}</p>
                        <p className="text-[10px] font-black uppercase tracking-wide text-blue-500">Activos</p>
                    </div>
                    <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-center shadow-sm">
                        <p className="text-2xl font-black text-rose-700">{stats.critical}</p>
                        <p className="text-[10px] font-black uppercase tracking-wide text-rose-500">Criticos</p>
                    </div>
                    <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-center shadow-sm">
                        <p className="text-2xl font-black text-amber-700">{stats.unread}</p>
                        <p className="text-[10px] font-black uppercase tracking-wide text-amber-500">Sin leer</p>
                    </div>
                </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 text-sm font-black text-slate-700">
                        <Filter size={18} className="text-slate-400" /> Filtros
                    </div>
                    <select className="h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-300 focus:bg-white" value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)}>
                        <option value="">Todos los estados</option>
                        <option value="open">Abiertos</option>
                        <option value="in_progress">En proceso</option>
                        <option value="resolved">Resueltos</option>
                        <option value="closed">Cerrados</option>
                    </select>
                    <select className="h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-300 focus:bg-white" value={filterPriority} onChange={(event) => setFilterPriority(event.target.value)}>
                        <option value="">Todas las prioridades</option>
                        <option value="low">Baja</option>
                        <option value="medium">Media</option>
                        <option value="high">Alta</option>
                        <option value="critical">Critica</option>
                    </select>
                    <button type="button" onClick={fetchInitialData} className="ml-auto inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-black text-slate-600 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700">
                        <RefreshCw size={16} /> Actualizar
                    </button>
                </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                {isLoading ? (
                    <div className="flex items-center justify-center py-20 text-slate-400">
                        <RefreshCw className="mr-2 animate-spin" size={20} /> Cargando tickets...
                    </div>
                ) : tickets.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                        <LifeBuoy size={48} className="mb-3 text-slate-200" />
                        <p className="font-bold">No se encontraron tickets de soporte.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-100">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-5 py-3 text-left text-xs font-black uppercase tracking-wide text-slate-400">Empresa</th>
                                    <th className="px-5 py-3 text-left text-xs font-black uppercase tracking-wide text-slate-400">Asunto</th>
                                    <th className="px-5 py-3 text-left text-xs font-black uppercase tracking-wide text-slate-400">Prioridad</th>
                                    <th className="px-5 py-3 text-left text-xs font-black uppercase tracking-wide text-slate-400">Estado</th>
                                    <th className="px-5 py-3 text-left text-xs font-black uppercase tracking-wide text-slate-400">Actualizado</th>
                                    <th className="px-5 py-3 text-right text-xs font-black uppercase tracking-wide text-slate-400">Accion</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                                {tickets.map(ticket => (
                                    <tr key={ticket.id} className="transition-colors hover:bg-slate-50">
                                        <td className="px-5 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                                                    <Building size={17} />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-black text-slate-900">{companyName(ticket)}</p>
                                                    <p className="text-xs font-semibold text-slate-500">{ticket.user_email || '-'}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="max-w-[340px] px-5 py-4">
                                            <div className="flex items-center gap-2">
                                                {ticket.unread_for_admin && <span className="h-2.5 w-2.5 rounded-full bg-amber-500 shadow-sm shadow-amber-200" title="Mensaje sin leer" />}
                                                <p className="truncate text-sm font-black text-slate-900">{ticket.subject}</p>
                                            </div>
                                            <p className="truncate text-xs font-semibold text-slate-400">Ultimo: {ticket.last_message_sender === 'admin' ? 'Soporte' : 'Cliente'} · {ticket.message}</p>
                                        </td>
                                        <td className="px-5 py-4">
                                            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ring-1 ${priorityColors[ticket.priority] || priorityColors.medium}`}>
                                                {PRIORITY_LABELS[ticket.priority] || ticket.priority}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4">
                                            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ring-1 ${statusColors[ticket.status] || statusColors.open}`}>
                                                {STATUS_LABELS[ticket.status] || ticket.status}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4 text-xs font-semibold text-slate-500">{formatDateTime(ticket.last_message_at || ticket.updated_at || ticket.created_at)}</td>
                                        <td className="px-5 py-4 text-right">
                                            <button type="button" onClick={() => openTicket(ticket)} className="inline-flex h-9 items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 text-xs font-black text-blue-700 transition-colors hover:bg-blue-100">
                                                <Eye size={15} /> Abrir chat
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {selectedTicket && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true">
                    <button className="fixed inset-0 cursor-default bg-slate-950/55 backdrop-blur-sm" aria-label="Cerrar" onClick={closeTicket} />
                    <div className="relative z-[101] grid h-[88vh] w-full max-w-6xl overflow-hidden rounded-2xl bg-white shadow-2xl lg:grid-cols-[360px_1fr]">
                        <aside className="border-r border-slate-200 bg-slate-50 p-5">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-xs font-black uppercase tracking-widest text-blue-500">Ticket #{selectedTicket.id}</p>
                                    <h2 className="mt-1 text-xl font-black text-slate-950">{selectedTicket.subject}</h2>
                                </div>
                                <button onClick={closeTicket} className="rounded-lg p-2 text-slate-400 hover:bg-white hover:text-slate-700"><X size={20} /></button>
                            </div>

                            <div className="mt-5 space-y-3">
                                <div className="rounded-xl border border-slate-200 bg-white p-3">
                                    <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Empresa</p>
                                    <p className="mt-1 text-sm font-black text-slate-900">{companyName(selectedTicket)}</p>
                                    <p className="mt-1 text-xs font-semibold text-slate-500">{selectedTicket.user_email}</p>
                                    {selectedTicket.phone && <p className="mt-1 text-xs font-bold text-emerald-700">Telefono: {selectedTicket.phone}</p>}
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className={`rounded-xl px-3 py-2 text-xs font-black ring-1 ${priorityColors[selectedTicket.priority] || priorityColors.medium}`}>
                                        {PRIORITY_LABELS[selectedTicket.priority] || selectedTicket.priority}
                                    </div>
                                    <div className={`rounded-xl px-3 py-2 text-xs font-black ring-1 ${statusColors[selectedTicket.status] || statusColors.open}`}>
                                        {STATUS_LABELS[selectedTicket.status] || selectedTicket.status}
                                    </div>
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-white p-3">
                                    <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Descripcion inicial</p>
                                    <p className="mt-2 max-h-52 overflow-y-auto whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-700">{selectedTicket.message}</p>
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-white p-3">
                                    <p className="mb-2 text-[10px] font-black uppercase tracking-wide text-slate-400">Estado rapido</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        {['open', 'in_progress', 'resolved', 'closed'].map(status => (
                                            <button key={status} onClick={() => handleStatusUpdate(selectedTicket.id, status)} className={`rounded-lg border px-2 py-2 text-xs font-black transition-colors ${selectedTicket.status === status ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
                                                {STATUS_LABELS[status]}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </aside>

                        <section className="flex min-h-0 flex-col bg-white">
                            <div className="border-b border-slate-100 px-5 py-4">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                        <MessageSquare className="text-blue-600" size={20} />
                                        <h3 className="text-lg font-black text-slate-950">Conversacion</h3>
                                    </div>
                                    <button onClick={() => openTicket(selectedTicket)} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-black text-slate-600 hover:bg-slate-50">
                                        <RefreshCw size={14} /> Refrescar
                                    </button>
                                </div>
                            </div>

                            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-slate-50 px-5 py-4">
                                {loadingMessages ? (
                                    <div className="flex h-full items-center justify-center text-sm font-bold text-slate-400">
                                        <RefreshCw className="mr-2 animate-spin" size={18} /> Cargando conversacion...
                                    </div>
                                ) : messages.length === 0 ? (
                                    <div className="flex h-full flex-col items-center justify-center text-slate-400">
                                        <Clock size={36} className="mb-2 text-slate-300" />
                                        <p className="text-sm font-bold">Sin mensajes todavia</p>
                                    </div>
                                ) : messages.map(message => {
                                    const isAdmin = message.sender_type === 'admin';
                                    return (
                                        <div key={message.id} className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[78%] rounded-2xl border px-4 py-3 shadow-sm ${isAdmin ? 'border-blue-100 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-900'}`}>
                                                <div className={`mb-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-wide ${isAdmin ? 'text-blue-100' : 'text-slate-400'}`}>
                                                    {isAdmin ? <CheckCircle size={12} /> : <MessageSquare size={12} />}
                                                    {isAdmin ? 'Soporte' : (message.sender_email || 'Cliente')} · {formatDateTime(message.created_at)}
                                                </div>
                                                {message.message && <p className="whitespace-pre-wrap text-sm font-semibold leading-6">{message.message}</p>}
                                                {message.attachments?.length > 0 && (
                                                    <div className="mt-3 space-y-2">
                                                        {message.attachments.map(file => (
                                                            <a key={file.id} href={file.stored_url} target="_blank" rel="noreferrer" className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-black transition-colors ${isAdmin ? 'border-white/20 bg-white/10 text-white hover:bg-white/20' : 'border-blue-100 bg-blue-50 text-blue-700 hover:bg-blue-100'}`}>
                                                                <Paperclip size={14} />
                                                                <span className="min-w-0 flex-1 truncate">{file.original_filename}</span>
                                                                <span className="shrink-0 opacity-70">{formatBytes(file.file_size)}</span>
                                                                <Download size={13} />
                                                            </a>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="border-t border-slate-100 bg-white p-4">
                                <textarea
                                    value={replyMessage}
                                    onChange={(event) => setReplyMessage(event.target.value)}
                                    rows={3}
                                    placeholder="Escribe una respuesta para el cliente..."
                                    className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold leading-6 text-slate-700 outline-none transition-colors focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
                                />
                                <div className="mt-3 flex items-center justify-between gap-3">
                                    <p className="text-xs font-semibold text-slate-400">Los mensajes llegan en tiempo real al tenant del cliente.</p>
                                    <button onClick={handleReply} disabled={isSubmitting || !replyMessage.trim()} className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300">
                                        <Send size={16} /> {isSubmitting ? 'Enviando...' : 'Enviar mensaje'}
                                    </button>
                                </div>
                            </div>
                        </section>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HelpDesk;
