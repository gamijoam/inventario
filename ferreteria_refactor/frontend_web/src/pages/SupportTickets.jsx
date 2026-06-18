import { useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    CheckCircle,
    ChevronDown,
    ChevronUp,
    Clock,
    DollarSign,
    History,
    Info,
    LifeBuoy,
    Mail,
    MessageSquare,
    Monitor,
    Package,
    Paperclip,
    Phone,
    RefreshCw,
    Search,
    Send,
    Settings,
    ShieldCheck,
    ShoppingCart,
    User,
    Wrench,
    X,
} from 'lucide-react';
import supportService from '../services/supportService';
import { useWebSocket } from '../context/WebSocketContext';
import { toast } from 'react-hot-toast';
import clsx from 'clsx';

const MODULE_OPTIONS = [
    { id: 'pos', label: 'Punto de venta', icon: ShoppingCart, hint: 'Cobro, carrito, caja, pagos o tickets' },
    { id: 'inventory', label: 'Inventario', icon: Package, hint: 'Productos, stock, IMEI, traslados o kardex' },
    { id: 'sales', label: 'Ventas y clientes', icon: User, hint: 'Devoluciones, garantias, creditos o clientes' },
    { id: 'purchases', label: 'Compras', icon: DollarSign, hint: 'Recepcion, proveedores, costos o deudas' },
    { id: 'reports', label: 'Reportes', icon: Monitor, hint: 'Dashboard, reportes, caja o metricas' },
    { id: 'config', label: 'Configuracion', icon: Settings, hint: 'Usuarios, monedas, impresoras o permisos' },
    { id: 'services', label: 'Servicios', icon: Wrench, hint: 'Taller, ordenes, repuestos o entregas' },
];

const ISSUE_TYPES = [
    { id: 'error', label: 'Error o pantalla rota', priority: 'high', hint: 'Algo muestra error, no carga o se queda bloqueado.' },
    { id: 'data', label: 'Datos no cuadran', priority: 'high', hint: 'Stock, dinero, IMEI, deuda o reporte no coincide.' },
    { id: 'blocked', label: 'No me deja continuar', priority: 'medium', hint: 'Un boton, permiso o validacion impide completar la tarea.' },
    { id: 'slow', label: 'Lento o se congela', priority: 'medium', hint: 'La pantalla tarda mucho o responde lento.' },
    { id: 'question', label: 'Duda de uso', priority: 'low', hint: 'Necesitas orientacion para usar una funcion.' },
    { id: 'urgent', label: 'Operacion detenida', priority: 'critical', hint: 'No puedes vender, cobrar o trabajar.' },
];

const PRIORITY_META = {
    low: { label: 'Baja', color: 'border-slate-200 bg-slate-50 text-slate-600', dot: 'bg-slate-400' },
    medium: { label: 'Media', color: 'border-blue-200 bg-blue-50 text-blue-700', dot: 'bg-blue-500' },
    high: { label: 'Alta', color: 'border-amber-200 bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
    critical: { label: 'Critica', color: 'border-rose-200 bg-rose-50 text-rose-700', dot: 'bg-rose-500' },
};

const STATUS_META = {
    open: { label: 'Abierto', color: 'border-blue-200 bg-blue-50 text-blue-700', icon: Clock },
    in_progress: { label: 'En proceso', color: 'border-amber-200 bg-amber-50 text-amber-700', icon: RefreshCw },
    resolved: { label: 'Resuelto', color: 'border-emerald-200 bg-emerald-50 text-emerald-700', icon: CheckCircle },
    closed: { label: 'Cerrado', color: 'border-slate-200 bg-slate-50 text-slate-600', icon: CheckCircle },
};

const INITIAL_FORM = {
    module: 'pos',
    issueType: 'error',
    subject: '',
    message: '',
    priority: 'high',
    contact_email: '',
    phone: '',
    full_name: '',
};

const formatDateTime = (value) => {
    if (!value) return '--';
    try {
        return new Date(value).toLocaleString('es-VE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return '--';
    }
};

const getTicketMeta = (ticket) => ({
    status: STATUS_META[ticket.status] || STATUS_META.open,
    priority: PRIORITY_META[ticket.priority] || PRIORITY_META.medium,
});

const normalize = (value) => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const SupportTickets = () => {
    const [searchParams] = useSearchParams();
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [expandedTicket, setExpandedTicket] = useState(null);
    const [ticketFilter, setTicketFilter] = useState('');
    const [formData, setFormData] = useState(INITIAL_FORM);
    const [reportFile, setReportFile] = useState(null);
    const [ticketMessages, setTicketMessages] = useState({});
    const [messageDrafts, setMessageDrafts] = useState({});
    const [messageFiles, setMessageFiles] = useState({});
    const [sendingMessage, setSendingMessage] = useState(null);
    const { subscribe } = useWebSocket();

    const hasHelpContext = searchParams.get('source') === 'help';
    const helpContext = searchParams.get('context') || '';
    const selectedModule = MODULE_OPTIONS.find(module => module.id === formData.module) || MODULE_OPTIONS[0];
    const selectedIssue = ISSUE_TYPES.find(issue => issue.id === formData.issueType) || ISSUE_TYPES[0];
    const SelectedModuleIcon = selectedModule.icon;

    useEffect(() => {
        const moduleParam = searchParams.get('module');
        const issueParam = searchParams.get('issueType');
        const subjectParam = searchParams.get('subject');
        const validModule = MODULE_OPTIONS.some(module => module.id === moduleParam) ? moduleParam : null;
        const validIssue = ISSUE_TYPES.some(issue => issue.id === issueParam) ? issueParam : null;

        if (!validModule && !validIssue && !subjectParam) return;

        setFormData(prev => {
            const nextIssue = validIssue || prev.issueType;
            const issue = ISSUE_TYPES.find(item => item.id === nextIssue);
            return {
                ...prev,
                module: validModule || prev.module,
                issueType: nextIssue,
                priority: issue?.priority || prev.priority,
                subject: subjectParam || prev.subject,
            };
        });
    }, [searchParams]);

    useEffect(() => {
        fetchTickets();
        supportService.markAsRead();
    }, []);

    useEffect(() => {
        const unsubscribe = subscribe('support:message_created', async (message) => {
            if (!message?.ticket_id) return;
            const isOpenTicket = expandedTicket === message.ticket_id;
            setTicketMessages(prev => {
                const current = prev[message.ticket_id] || [];
                if (current.some(item => item.id === message.id)) return prev;
                return { ...prev, [message.ticket_id]: [...current, message] };
            });
            setTickets(prev => prev.map(ticket => ticket.id === message.ticket_id ? {
                ...ticket,
                updated_at: message.created_at,
                last_message_at: message.created_at,
                last_message_sender: message.sender_type,
                unread_for_user: message.sender_type === 'admin' && !isOpenTicket,
                admin_response: message.sender_type === 'admin' ? message.message : ticket.admin_response
            } : ticket));
            if (message.sender_type === 'admin' && isOpenTicket) {
                try {
                    await supportService.getTicketMessages(message.ticket_id);
                } catch (err) {
                    console.warn('No se pudo marcar el mensaje de soporte como leido', err);
                }
            }
        });
        return () => unsubscribe();
    }, [subscribe, expandedTicket]);

    const fetchTickets = async () => {
        setLoading(true);
        try {
            const data = await supportService.getMyTickets();
            setTickets(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Error fetching tickets:', error);
            toast.error('Error al cargar tus reportes');
        } finally {
            setLoading(false);
        }
    };

    const loadTicketMessages = async (ticketId) => {
        if (ticketMessages[ticketId]) return;
        try {
            const data = await supportService.getTicketMessages(ticketId);
            setTicketMessages(prev => ({ ...prev, [ticketId]: Array.isArray(data) ? data : [] }));
        } catch (error) {
            console.error('Error loading support messages:', error);
            toast.error('No se pudo cargar la conversacion');
        }
    };

    const toggleTicket = (ticketId) => {
        setExpandedTicket(prev => {
            const next = prev === ticketId ? null : ticketId;
            if (next) loadTicketMessages(next);
            return next;
        });
    };

    const handleSendMessage = async (ticketId) => {
        const message = messageDrafts[ticketId] || '';
        const file = messageFiles[ticketId] || null;
        if (!message.trim() && !file) {
            toast.error('Escribe un mensaje o adjunta un archivo');
            return;
        }
        setSendingMessage(ticketId);
        try {
            const created = await supportService.sendMessage(ticketId, { message, file });
            setTicketMessages(prev => {
                const current = prev[ticketId] || [];
                if (current.some(item => item.id === created.id)) return prev;
                return { ...prev, [ticketId]: [...current, created] };
            });
            setMessageDrafts(prev => ({ ...prev, [ticketId]: '' }));
            setMessageFiles(prev => ({ ...prev, [ticketId]: null }));
            toast.success(file ? 'Mensaje y archivo enviados' : 'Mensaje enviado');
        } catch (error) {
            console.error('Error sending support message:', error);
            toast.error(error.response?.data?.detail || 'No se pudo enviar el mensaje');
        } finally {
            setSendingMessage(null);
        }
    };

    const updateForm = (field, value) => {
        setFormData(prev => {
            if (field === 'issueType') {
                const issue = ISSUE_TYPES.find(item => item.id === value);
                return { ...prev, issueType: value, priority: issue?.priority || prev.priority };
            }
            return { ...prev, [field]: value };
        });
    };

    const buildPayload = () => {
        const route = window.location.hash || window.location.pathname || 'sin ruta';
        const subject = formData.subject.trim() || `${selectedModule.label}: ${selectedIssue.label}`;
        const message = [
            `Modulo afectado: ${selectedModule.label}`,
            `Tipo de incidencia: ${selectedIssue.label}`,
            `Prioridad seleccionada: ${PRIORITY_META[formData.priority]?.label || formData.priority}`,
            `Ruta actual: ${route}`,
            `Fecha del reporte: ${formatDateTime(new Date().toISOString())}`,
            '',
            'Detalle del usuario:',
            formData.message.trim(),
        ].join('\n');

        return {
            subject,
            message,
            priority: formData.priority,
            contact_email: formData.contact_email.trim() || null,
            phone: formData.phone.trim() || null,
            full_name: formData.full_name.trim() || null,
        };
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!formData.message.trim()) {
            toast.error('Describe que ocurrio para poder ayudarte mejor');
            return;
        }

        setSubmitting(true);
        try {
            const createdTicket = await supportService.createTicket(buildPayload());
            if (reportFile && createdTicket?.id) {
                await supportService.sendMessage(createdTicket.id, { message: 'Archivo adjunto para soporte', file: reportFile });
            }
            toast.success(reportFile ? 'Reporte enviado con archivo adjunto.' : 'Reporte enviado correctamente. Te responderemos pronto.');
            setFormData(INITIAL_FORM);
            setReportFile(null);
            await fetchTickets();
        } catch (error) {
            console.error('Error creating ticket:', error);
            let errorMsg = 'No se pudo enviar el reporte';
            const detail = error.response?.data?.detail;

            if (typeof detail === 'string') {
                errorMsg = detail;
            } else if (Array.isArray(detail)) {
                errorMsg = detail.map(item => item.msg).join(', ');
            } else if (detail) {
                errorMsg = JSON.stringify(detail);
            }

            toast.error(errorMsg);
        } finally {
            setSubmitting(false);
        }
    };

    const filteredTickets = useMemo(() => {
        const query = normalize(ticketFilter);
        if (!query) return tickets;
        return tickets.filter(ticket => normalize(`${ticket.subject} ${ticket.message} ${ticket.status} ${ticket.priority}`).includes(query));
    }, [ticketFilter, tickets]);

    const stats = useMemo(() => ({
        total: tickets.length,
        open: tickets.filter(ticket => ['open', 'in_progress'].includes(ticket.status)).length,
        answered: tickets.filter(ticket => Boolean(ticket.admin_response)).length,
        unread: tickets.filter(ticket => ticket.unread_for_user).length,
    }), [tickets]);

    return (
        <div className="min-h-[calc(100vh-64px)] bg-slate-50">
            <div className="border-b border-slate-200 bg-white">
                <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm shadow-indigo-100">
                            <LifeBuoy size={25} />
                        </div>
                        <div>
                            <p className="text-xs font-black uppercase tracking-widest text-slate-400">Ayuda y soporte</p>
                            <h1 className="text-2xl font-black tracking-tight text-slate-950">Reportar un problema</h1>
                            <p className="text-sm font-medium text-slate-500">Envianos el contexto correcto para resolver mas rapido.</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2 sm:min-w-[460px]">
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-center">
                            <p className="text-lg font-black text-slate-950">{stats.total}</p>
                            <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Tickets</p>
                        </div>
                        <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-center">
                            <p className="text-lg font-black text-blue-700">{stats.open}</p>
                            <p className="text-[10px] font-black uppercase tracking-wide text-blue-500">Activos</p>
                        </div>
                        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-center">
                            <p className="text-lg font-black text-emerald-700">{stats.answered}</p>
                            <p className="text-[10px] font-black uppercase tracking-wide text-emerald-500">Con respuesta</p>
                        </div>
                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-center">
                            <p className="text-lg font-black text-amber-700">{stats.unread}</p>
                            <p className="text-[10px] font-black uppercase tracking-wide text-amber-500">Sin leer</p>
                        </div>
                    </div>
                </div>
            </div>

            <main className="mx-auto grid max-w-7xl gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[440px_1fr]">
                <section className="space-y-4 lg:sticky lg:top-20 lg:self-start">
                    <form onSubmit={handleSubmit} className="rounded-lg border border-slate-200 bg-white shadow-sm">
                        <div className="border-b border-slate-100 p-4">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-indigo-50 text-indigo-600">
                                    <Send size={20} />
                                </div>
                                <div>
                                    <h2 className="text-lg font-black text-slate-950">Nuevo reporte</h2>
                                    <p className="text-xs font-semibold text-slate-500">Primero ubicamos el problema, luego explicas que paso.</p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-5 p-4">
                            <div>
                                <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500">Modulo afectado</label>
                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                    {MODULE_OPTIONS.map(module => {
                                        const Icon = module.icon;
                                        const selected = formData.module === module.id;
                                        return (
                                            <button
                                                key={module.id}
                                                type="button"
                                                onClick={() => updateForm('module', module.id)}
                                                className={clsx(
                                                    'rounded-lg border p-3 text-left transition-colors',
                                                    selected ? 'border-indigo-300 bg-indigo-50 ring-2 ring-indigo-100' : 'border-slate-200 bg-white hover:border-indigo-200 hover:bg-indigo-50/50'
                                                )}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <Icon size={17} className={selected ? 'text-indigo-600' : 'text-slate-400'} />
                                                    <span className="text-sm font-black text-slate-900">{module.label}</span>
                                                </div>
                                                <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{module.hint}</p>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div>
                                <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500">Que esta pasando</label>
                                <div className="space-y-2">
                                    {ISSUE_TYPES.map(issue => {
                                        const selected = formData.issueType === issue.id;
                                        return (
                                            <button
                                                key={issue.id}
                                                type="button"
                                                onClick={() => updateForm('issueType', issue.id)}
                                                className={clsx(
                                                    'flex w-full items-start justify-between gap-3 rounded-lg border p-3 text-left transition-colors',
                                                    selected ? 'border-indigo-300 bg-indigo-50 ring-2 ring-indigo-100' : 'border-slate-200 bg-white hover:border-indigo-200 hover:bg-indigo-50/50'
                                                )}
                                            >
                                                <span>
                                                    <span className="block text-sm font-black text-slate-900">{issue.label}</span>
                                                    <span className="mt-1 block text-xs font-semibold leading-5 text-slate-500">{issue.hint}</span>
                                                </span>
                                                <span className={clsx('shrink-0 rounded-md border px-2 py-1 text-[10px] font-black uppercase', PRIORITY_META[issue.priority]?.color)}>
                                                    {PRIORITY_META[issue.priority]?.label}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2">
                                <div>
                                    <label htmlFor="full_name" className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">Nombre contacto</label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-3 text-slate-400" size={16} />
                                        <input
                                            id="full_name"
                                            value={formData.full_name}
                                            onChange={(event) => updateForm('full_name', event.target.value)}
                                            placeholder="Opcional"
                                            className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm font-semibold text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label htmlFor="phone" className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">Telefono</label>
                                    <div className="relative">
                                        <Phone className="absolute left-3 top-3 text-slate-400" size={16} />
                                        <input
                                            id="phone"
                                            value={formData.phone}
                                            onChange={(event) => updateForm('phone', event.target.value)}
                                            placeholder="Opcional"
                                            className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm font-semibold text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label htmlFor="contact_email" className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">Correo alterno</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-3 text-slate-400" size={16} />
                                    <input
                                        id="contact_email"
                                        type="email"
                                        value={formData.contact_email}
                                        onChange={(event) => updateForm('contact_email', event.target.value)}
                                        placeholder="Opcional, usaremos tu cuenta si lo dejas vacio"
                                        className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm font-semibold text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                    />
                                </div>
                            </div>

                            <div>
                                <label htmlFor="subject" className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">Asunto</label>
                                <input
                                    id="subject"
                                    value={formData.subject}
                                    onChange={(event) => updateForm('subject', event.target.value)}
                                    placeholder={`${selectedModule.label}: ${selectedIssue.label}`}
                                    className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                />
                            </div>

                            <div>
                                <label htmlFor="message" className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">Detalle del problema *</label>
                                <textarea
                                    id="message"
                                    rows={7}
                                    value={formData.message}
                                    onChange={(event) => updateForm('message', event.target.value)}
                                    placeholder="Ej: Estaba en el POS, agregue un producto, presione cobrar y aparecio error en servidor. Ya intente actualizar la pagina."
                                    className="w-full resize-none rounded-md border border-slate-200 bg-white px-3 py-3 text-sm font-semibold leading-6 text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                    required
                                />
                            </div>

                            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="flex items-start gap-3">
                                        <Paperclip className="mt-0.5 shrink-0 text-indigo-600" size={18} />
                                        <div>
                                            <p className="text-sm font-black text-slate-900">Adjuntar evidencia</p>
                                            <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">Acepta capturas, PDF, Excel, CSV, TXT y JSON de traslados.</p>
                                        </div>
                                    </div>
                                    <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700">
                                        <Paperclip size={15} /> Seleccionar
                                        <input
                                            type="file"
                                            className="hidden"
                                            accept=".json,.xlsx,.xls,.csv,.txt,.pdf,.png,.jpg,.jpeg,.webp"
                                            onChange={(event) => setReportFile(event.target.files?.[0] || null)}
                                        />
                                    </label>
                                </div>
                                {reportFile && (
                                    <div className="mt-3 flex items-center justify-between rounded-md border border-indigo-100 bg-white px-3 py-2 text-xs font-bold text-slate-600">
                                        <span className="truncate"><Paperclip size={13} className="mr-1 inline text-indigo-500" /> {reportFile.name}</span>
                                        <button type="button" onClick={() => setReportFile(null)} className="text-slate-400 hover:text-rose-600"><X size={15} /></button>
                                    </div>
                                )}
                            </div>

                            {hasHelpContext && (
                                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                                    <div className="flex items-start gap-3">
                                        <CheckCircle className="mt-0.5 shrink-0 text-emerald-600" size={18} />
                                        <div className="min-w-0">
                                            <p className="text-sm font-black text-emerald-950">Contexto cargado desde ayuda</p>
                                            <p className="mt-1 text-xs font-semibold leading-5 text-emerald-800">
                                                Ya sabemos que vienes de {helpContext || 'una guia del sistema'}. Completa solo el detalle del problema.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                <div className="flex items-start gap-3">
                                    <SelectedModuleIcon className="mt-0.5 shrink-0 text-indigo-600" size={18} />
                                    <div className="min-w-0">
                                        <p className="text-sm font-black text-slate-900">Resumen que recibira soporte</p>
                                        <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                                            {selectedModule.label} / {selectedIssue.label} / prioridad {PRIORITY_META[formData.priority]?.label}. Incluiremos ruta actual y fecha del reporte.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-4 py-3">
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                                <ShieldCheck size={15} className="text-emerald-600" /> Compatible con soporte actual
                            </div>
                            <button
                                type="submit"
                                disabled={submitting}
                                className="inline-flex h-11 items-center gap-2 rounded-md bg-indigo-600 px-5 text-sm font-black text-white shadow-sm shadow-indigo-100 transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                            >
                                <Send size={17} /> {submitting ? 'Enviando...' : 'Enviar reporte'}
                            </button>
                        </div>
                    </form>

                    <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-4">
                        <div className="flex gap-3">
                            <Info className="mt-0.5 shrink-0 text-indigo-600" size={18} />
                            <div>
                                <p className="text-sm font-black text-indigo-950">Antes de enviar</p>
                                <p className="mt-1 text-xs font-semibold leading-5 text-indigo-800">Incluye que estabas haciendo, que esperabas que pasara y el mensaje exacto del error si aparece.</p>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="space-y-4">
                    <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
                        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 md:flex-row md:items-center md:justify-between">
                            <div>
                                <div className="flex items-center gap-2">
                                    <History size={19} className="text-indigo-600" />
                                    <h2 className="text-lg font-black text-slate-950">Historial de reportes</h2>
                                </div>
                                <p className="mt-1 text-sm font-medium text-slate-500">Consulta respuestas y seguimiento de tus solicitudes.</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="relative min-w-[220px]">
                                    <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                                    <input
                                        value={ticketFilter}
                                        onChange={(event) => setTicketFilter(event.target.value)}
                                        placeholder="Buscar ticket..."
                                        className="h-10 w-full rounded-md border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm font-semibold text-slate-700 outline-none focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={fetchTickets}
                                    className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                                    title="Actualizar"
                                >
                                    <RefreshCw size={16} />
                                </button>
                            </div>
                        </div>

                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                                <div className="mb-3 h-8 w-8 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
                                <p className="text-sm font-bold">Cargando historial...</p>
                            </div>
                        ) : filteredTickets.length === 0 ? (
                            <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
                                <MessageSquare size={50} className="mb-3 text-slate-200" />
                                <p className="text-base font-black text-slate-600">Sin reportes para mostrar</p>
                                <p className="mt-1 text-sm font-semibold text-slate-400">Cuando envies un reporte, aparecera aqui con su estado.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {filteredTickets.map(ticket => {
                                    const { status, priority } = getTicketMeta(ticket);
                                    const StatusIcon = status.icon;
                                    const isExpanded = expandedTicket === ticket.id;
                                    return (
                                        <article key={ticket.id} className={clsx('transition-colors', isExpanded && 'bg-indigo-50/30')}>
                                            <button
                                                type="button"
                                                onClick={() => toggleTicket(ticket.id)}
                                                className="flex w-full flex-col gap-3 p-4 text-left transition-colors hover:bg-slate-50 md:flex-row md:items-center md:justify-between"
                                            >
                                                <div className="min-w-0 flex-1">
                                                    <div className="mb-2 flex flex-wrap items-center gap-2">
                                                        <span className={clsx('inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-black', status.color)}>
                                                            <StatusIcon size={13} /> {status.label}
                                                        </span>
                                                        <span className={clsx('inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-black', priority.color)}>
                                                            <span className={clsx('h-2 w-2 rounded-full', priority.dot)} /> {priority.label}
                                                        </span>
                                                        {ticket.admin_response && (
                                                            <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-black text-emerald-700">
                                                                <CheckCircle size={13} /> Respondido
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {ticket.unread_for_user && <span className="h-2.5 w-2.5 rounded-full bg-amber-500 shadow-sm shadow-amber-200" title="Respuesta sin leer" />}
                                                        <h3 className="truncate text-base font-black text-slate-950">{ticket.subject}</h3>
                                                    </div>
                                                    <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-slate-400">
                                                        <Clock size={12} /> Creado {formatDateTime(ticket.created_at)}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2 text-slate-400">
                                                    <span className="text-xs font-black uppercase tracking-wide">#{ticket.id}</span>
                                                    {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                                </div>
                                            </button>

                                            {isExpanded && (
                                                <div className="space-y-4 px-4 pb-4">
                                                    <div className="rounded-lg border border-slate-200 bg-white p-4">
                                                        <div className="mb-3 flex items-center justify-between gap-3">
                                                            <p className="text-xs font-black uppercase tracking-widest text-slate-400">Conversacion</p>
                                                            <span className="text-[11px] font-black uppercase tracking-wide text-slate-400">Ticket #{ticket.id}</span>
                                                        </div>
                                                        <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
                                                            {(ticketMessages[ticket.id] || []).map(message => {
                                                                const isAdmin = message.sender_type === 'admin';
                                                                return (
                                                                    <div key={message.id} className={clsx('flex', isAdmin ? 'justify-start' : 'justify-end')}>
                                                                        <div className={clsx('max-w-[86%] rounded-lg border px-3 py-2 shadow-sm', isAdmin ? 'border-emerald-200 bg-emerald-50 text-emerald-950' : 'border-indigo-100 bg-indigo-50 text-slate-900')}>
                                                                            <div className="mb-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-wide opacity-70">
                                                                                <MessageSquare size={12} /> {isAdmin ? 'Soporte' : 'Tu mensaje'} · {formatDateTime(message.created_at)}
                                                                            </div>
                                                                            {message.message && <p className="whitespace-pre-wrap text-sm font-semibold leading-6">{message.message}</p>}
                                                                            {Array.isArray(message.attachments) && message.attachments.length > 0 && (
                                                                                <div className="mt-2 space-y-1">
                                                                                    {message.attachments.map(file => (
                                                                                        <a key={file.id} href={file.stored_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-md border border-white/70 bg-white/80 px-2 py-1.5 text-xs font-black text-indigo-700 hover:text-indigo-900">
                                                                                            <Paperclip size={13} />
                                                                                            <span className="truncate">{file.original_filename}</span>
                                                                                        </a>
                                                                                    ))}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                            {(!ticketMessages[ticket.id] || ticketMessages[ticket.id].length === 0) && (
                                                                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-center">
                                                                    <Clock className="mx-auto mb-2 text-slate-300" size={28} />
                                                                    <p className="text-sm font-black text-slate-500">Cargando conversacion...</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                                        <textarea
                                                            rows={3}
                                                            value={messageDrafts[ticket.id] || ''}
                                                            onChange={(event) => setMessageDrafts(prev => ({ ...prev, [ticket.id]: event.target.value }))}
                                                            placeholder="Responder o agregar mas contexto..."
                                                            className="w-full resize-none rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold leading-6 text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                                        />
                                                        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                                            <div className="min-w-0">
                                                                {messageFiles[ticket.id] ? (
                                                                    <div className="flex items-center gap-2 rounded-md border border-indigo-100 bg-white px-2 py-1.5 text-xs font-bold text-slate-600">
                                                                        <Paperclip size={13} className="text-indigo-500" />
                                                                        <span className="truncate">{messageFiles[ticket.id].name}</span>
                                                                        <button type="button" onClick={() => setMessageFiles(prev => ({ ...prev, [ticket.id]: null }))} className="text-slate-400 hover:text-rose-600"><X size={14} /></button>
                                                                    </div>
                                                                ) : (
                                                                    <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700">
                                                                        <Paperclip size={14} /> Adjuntar archivo
                                                                        <input type="file" className="hidden" accept=".json,.xlsx,.xls,.csv,.txt,.pdf,.png,.jpg,.jpeg,.webp" onChange={(event) => setMessageFiles(prev => ({ ...prev, [ticket.id]: event.target.files?.[0] || null }))} />
                                                                    </label>
                                                                )}
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleSendMessage(ticket.id)}
                                                                disabled={sendingMessage === ticket.id}
                                                                className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 text-xs font-black text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:bg-slate-300"
                                                            >
                                                                <Send size={15} /> {sendingMessage === ticket.id ? 'Enviando...' : 'Enviar'}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </article>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </section>
            </main>
        </div>
    );
};

export default SupportTickets;
