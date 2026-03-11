import { useState, useEffect } from 'react';
import { LifeBuoy, Send, Clock, CheckCircle, AlertTriangle, MessageSquare, ChevronDown, ChevronUp, History } from 'lucide-react';
import supportService from '../services/supportService';
import { toast } from 'react-hot-toast';
import clsx from 'clsx';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';

const SupportTickets = () => {
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [expandedTicket, setExpandedTicket] = useState(null);
    const [formData, setFormData] = useState({
        subject: '',
        message: '',
        priority: 'medium',
        contact_email: ''
    });

    useEffect(() => {
        fetchTickets();
        // Mark support page as visited to reset the unread badge in Sidebar
        supportService.markAsRead();
    }, []);

    const fetchTickets = async () => {
        try {
            const data = await supportService.getMyTickets();
            setTickets(data);
        } catch (error) {
            console.error('Error fetching tickets:', error);
            toast.error('Error al cargar tus reportes');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.subject || !formData.message) return;

        setSubmitting(true);
        try {
            await supportService.createTicket(formData);
            toast.success('Reporte enviado correctamente. Te responderemos pronto.');
            setFormData({ subject: '', message: '', priority: 'medium', contact_email: '' });
            fetchTickets();
        } catch (error) {
            console.error('Error creating ticket:', error);
            let errorMsg = 'No se pudo enviar el reporte';
            const detail = error.response?.data?.detail;

            if (typeof detail === 'string') {
                errorMsg = detail;
            } else if (Array.isArray(detail)) {
                errorMsg = detail.map(d => d.msg).join(', ');
            } else if (detail) {
                errorMsg = JSON.stringify(detail);
            }

            toast.error(errorMsg);
        } finally {
            setSubmitting(false);
        }
    };

    const statusMap = {
        open: { label: 'Abierto', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: <Clock size={14} /> },
        in_progress: { label: 'En Proceso', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: <Clock size={14} /> },
        resolved: { label: 'Resuelto', color: 'bg-green-100 text-green-700 border-green-200', icon: <CheckCircle size={14} /> },
        closed: { label: 'Cerrado', color: 'bg-slate-100 text-slate-700 border-slate-200', icon: <CheckCircle size={14} /> }
    };

    const priorityMap = {
        low: { label: 'Baja', color: 'text-slate-500' },
        medium: { label: 'Media', color: 'text-blue-600' },
        high: { label: 'Alta', color: 'text-amber-600' },
        critical: { label: 'Crítica', color: 'text-rose-600' }
    };

    return (
        <div className="p-6 max-w-[1200px] mx-auto min-h-screen space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-slate-800 tracking-tight flex items-center gap-3">
                    <LifeBuoy className="text-indigo-600" size={32} /> Ayuda y Soporte Técnico
                </h1>
                <p className="text-slate-500 font-medium mt-1">Reporta incidentes o solicita ayuda directamente a nuestro equipo</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Form Column */}
                <div className="lg:col-span-1">
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sticky top-6">
                        <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                            <Send size={20} className="text-indigo-500" /> Nuevo Reporte
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="subject">Asunto</Label>
                                <Input
                                    id="subject"
                                    placeholder="Ej: Error al generar factura"
                                    value={formData.subject}
                                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="contact_email">Correo de Contacto (Opcional)</Label>
                                <Input
                                    id="contact_email"
                                    type="email"
                                    placeholder="correo@ejemplo.com"
                                    value={formData.contact_email}
                                    onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                                />
                                <p className="text-[10px] text-slate-400 italic">Por defecto usaremos tu correo de la cuenta.</p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="priority">Prioridad</Label>
                                <select
                                    id="priority"
                                    className="w-full h-10 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-700"
                                    value={formData.priority}
                                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                                >
                                    <option value="low">Baja</option>
                                    <option value="medium">Media</option>
                                    <option value="high">Alta</option>
                                    <option value="critical">Crítica</option>
                                </select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="message">Mensaje / Detalles</Label>
                                <Textarea
                                    id="message"
                                    placeholder="Explica detalladamente qué ocurrió..."
                                    rows={5}
                                    value={formData.message}
                                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                                    required
                                />
                            </div>

                            <Button
                                type="submit"
                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                                disabled={submitting}
                            >
                                {submitting ? 'Enviando...' : 'Enviar Reporte'}
                            </Button>
                        </form>
                    </div>
                </div>

                {/* List Column */}
                <div className="lg:col-span-2 space-y-4">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <History size={20} className="text-indigo-500" /> Mis Reportes Recientes
                    </h2>

                    {loading ? (
                        <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-2"></div>
                            <p className="text-slate-500 font-medium">Cargando historial...</p>
                        </div>
                    ) : tickets.length === 0 ? (
                        <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-200">
                            <MessageSquare size={48} className="mx-auto mb-3 opacity-20" />
                            <p className="text-slate-500 font-medium">No has enviado ningún reporte todavía</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {tickets.map((ticket) => (
                                <div
                                    key={ticket.id}
                                    className={clsx(
                                        "bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all",
                                        expandedTicket === ticket.id && "ring-2 ring-indigo-500/20 border-indigo-200"
                                    )}
                                >
                                    <div
                                        className="p-5 cursor-pointer hover:bg-slate-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
                                        onClick={() => setExpandedTicket(expandedTicket === ticket.id ? null : ticket.id)}
                                    >
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-1">
                                                <span className={clsx("text-xs font-bold px-2 py-0.5 rounded-full border", statusMap[ticket.status].color)}>
                                                    <span className="flex items-center gap-1">
                                                        {statusMap[ticket.status].icon}
                                                        {statusMap[ticket.status].label}
                                                    </span>
                                                </span>
                                                <span className={clsx("text-xs font-bold", priorityMap[ticket.priority].color)}>
                                                    Prioridad {priorityMap[ticket.priority].label}
                                                </span>
                                            </div>
                                            <h3 className="font-bold text-slate-800 text-lg leading-tight">{ticket.subject}</h3>
                                            <div className="text-slate-400 text-xs mt-1 flex items-center gap-1 font-medium">
                                                <Clock size={12} /> {new Date(ticket.created_at).toLocaleString()}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {ticket.admin_response && (
                                                <span className="px-3 py-1 bg-indigo-50 text-indigo-700 text-[11px] font-black uppercase rounded-lg border border-indigo-100 flex items-center gap-1">
                                                    <CheckCircle size={10} /> Respuesta Recibida
                                                </span>
                                            )}
                                            {expandedTicket === ticket.id ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
                                        </div>
                                    </div>

                                    {expandedTicket === ticket.id && (
                                        <div className="px-5 pb-5 pt-1 space-y-6 border-t border-slate-50 animate-in fade-in slide-in-from-top-2 duration-300">
                                            {/* Original Problem */}
                                            <div className="bg-slate-50 p-4 rounded-xl relative">
                                                <div className="text-[10px] uppercase font-bold text-slate-400 mb-2.5 tracking-widest">Descripción del Problema</div>
                                                <p className="text-slate-700 text-sm whitespace-pre-wrap leading-relaxed">{ticket.message}</p>
                                                {ticket.contact_email && (
                                                    <div className="mt-4 pt-3 border-t border-slate-200/60">
                                                        <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Correo de contacto proporcionado:</span>
                                                        <span className="text-slate-600 text-xs font-medium">{ticket.contact_email}</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Admin Response */}
                                            {ticket.admin_response ? (
                                                <div className="bg-emerald-50 border-l-4 border-emerald-400 p-5 rounded-r-2xl">
                                                    <div className="flex items-center gap-2 mb-3">
                                                        <div className="bg-emerald-600 text-white p-1 rounded-md shadow-sm">
                                                            <MessageSquare size={14} />
                                                        </div>
                                                        <div className="text-[11px] uppercase font-black text-emerald-800 tracking-wider">Respuesta de Soporte</div>
                                                    </div>
                                                    <p className="text-emerald-900 text-sm font-medium whitespace-pre-wrap leading-relaxed">
                                                        {ticket.admin_response}
                                                    </p>
                                                </div>
                                            ) : (
                                                <div className="text-center py-6 px-4 bg-slate-50 border border-slate-100 border-dashed rounded-xl">
                                                    <Clock size={32} className="mx-auto mb-2 text-slate-300 animate-pulse" />
                                                    <p className="text-slate-400 text-xs font-bold">Un administrador revisará tu ticket pronto.</p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SupportTickets;
