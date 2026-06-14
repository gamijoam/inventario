import { useMemo, useState, useEffect } from 'react';
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
    Phone,
    RefreshCw,
    Search,
    Send,
    Settings,
    ShieldCheck,
    ShoppingCart,
    User,
    Wrench,
} from 'lucide-react';
import supportService from '../services/supportService';
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
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [expandedTicket, setExpandedTicket] = useState(null);
    const [ticketFilter, setTicketFilter] = useState('');
    const [formData, setFormData] = useState(INITIAL_FORM);

    const selectedModule = MODULE_OPTIONS.find(module => module.id === formData.module) || MODULE_OPTIONS[0];
    const selectedIssue = ISSUE_TYPES.find(issue => issue.id === formData.issueType) || ISSUE_TYPES[0];
    const SelectedModuleIcon = selectedModule.icon;

    useEffect(() => {
        fetchTickets();
        supportService.markAsRead();
    }, []);

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
            await supportService.createTicket(buildPayload());
            toast.success('Reporte enviado correctamente. Te responderemos pronto.');
            setFormData(INITIAL_FORM);
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
                    <div className="grid grid-cols-3 gap-2 sm:min-w-[360px]">
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
                                                onClick={() => setExpandedTicket(isExpanded ? null : ticket.id)}
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
                                                    <h3 className="truncate text-base font-black text-slate-950">{ticket.subject}</h3>
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
                                                        <p className="mb-2 text-xs font-black uppercase tracking-widest text-slate-400">Descripcion enviada</p>
                                                        <p className="whitespace-pre-wrap text-sm font-medium leading-6 text-slate-700">{ticket.message}</p>
                                                        {(ticket.contact_email || ticket.phone || ticket.full_name) && (
                                                            <div className="mt-4 grid gap-2 border-t border-slate-100 pt-3 text-xs font-bold text-slate-500 sm:grid-cols-3">
                                                                {ticket.full_name && <span>Contacto: {ticket.full_name}</span>}
                                                                {ticket.contact_email && <span>Email: {ticket.contact_email}</span>}
                                                                {ticket.phone && <span>Telefono: {ticket.phone}</span>}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {ticket.admin_response ? (
                                                        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                                                            <div className="mb-2 flex items-center gap-2 text-emerald-800">
                                                                <MessageSquare size={17} />
                                                                <p className="text-xs font-black uppercase tracking-widest">Respuesta de soporte</p>
                                                            </div>
                                                            <p className="whitespace-pre-wrap text-sm font-semibold leading-6 text-emerald-950">{ticket.admin_response}</p>
                                                        </div>
                                                    ) : (
                                                        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-center">
                                                            <Clock className="mx-auto mb-2 text-slate-300" size={28} />
                                                            <p className="text-sm font-black text-slate-500">Pendiente por revisar</p>
                                                            <p className="mt-1 text-xs font-semibold text-slate-400">Soporte vera el contexto del reporte y podra responder desde el panel administrativo.</p>
                                                        </div>
                                                    )}
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
