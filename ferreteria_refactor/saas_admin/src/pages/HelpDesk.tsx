import React, { useEffect, useState } from 'react';
import { getAllTickets, replyToTicket, updateTicketStatus } from '../api/support';
import type { SupportTicket } from '../api/support';
import { getTenants } from '../api/tenants';
import type { Tenant } from '../types/tenant';
import {
    MessageSquare,
    Filter,
    CheckCircle,
    Send,
    X,
    Eye,
    Building
} from 'lucide-react';
import toast from 'react-hot-toast';

const HelpDesk: React.FC = () => {
    const [tickets, setTickets] = useState<SupportTicket[]>([]);
    const [tenants, setTenants] = useState<Record<number, string>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState('');
    const [filterPriority, setFilterPriority] = useState('');
    const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
    const [replyMessage, setReplyMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        fetchInitialData();
    }, [filterStatus, filterPriority]);

    const fetchInitialData = async () => {
        setIsLoading(true);
        try {
            const [ticketsData, tenantsData] = await Promise.all([
                getAllTickets({ status: filterStatus || undefined, priority: filterPriority || undefined }),
                getTenants()
            ]);

            setTickets(ticketsData);

            // Map tenant IDs to names
            const tenantMap: Record<number, string> = {};
            tenantsData.tenants.forEach((t: Tenant) => {
                tenantMap[t.id] = t.name;
            });
            setTenants(tenantMap);

        } catch (err) {
            console.error(err);
            toast.error('Error al cargar datos de la mesa de ayuda');
        } finally {
            setIsLoading(false);
        }
    };

    const handleReply = async () => {
        if (!selectedTicket || !replyMessage.trim()) return;

        setIsSubmitting(true);
        try {
            const updated = await replyToTicket(selectedTicket.id, replyMessage);
            setTickets(prev => prev.map(t => t.id === updated.id ? updated : t));
            toast.success('Respuesta enviada correctamente');
            setSelectedTicket(null);
            setReplyMessage('');
        } catch (err) {
            console.error(err);
            toast.error('Error al enviar respuesta');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleStatusUpdate = async (id: number, status: string) => {
        try {
            const updated = await updateTicketStatus(id, status);
            setTickets(prev => prev.map(t => t.id === updated.id ? updated : t));
            toast.success('Estado actualizado');
            if (selectedTicket?.id === id) setSelectedTicket(updated);
        } catch (err) {
            console.error(err);
            toast.error('Error al actualizar estado');
        }
    };

    const statusColors: Record<string, string> = {
        open: 'bg-blue-100 text-blue-800',
        in_progress: 'bg-amber-100 text-amber-800',
        pente: 'bg-blue-100 text-blue-800',
        resolved: 'bg-green-100 text-green-800',
        resuelto: 'bg-green-100 text-green-800',
        closed: 'bg-gray-100 text-gray-800'
    };

    const priorityColors: Record<string, string> = {
        low: 'text-gray-500',
        baja: 'text-gray-500',
        medium: 'text-blue-600',
        media: 'text-blue-600',
        high: 'text-amber-600 shadow-amber-100',
        alta: 'text-amber-600 shadow-amber-100',
        critical: 'text-rose-600 font-bold',
        critica: 'text-rose-600 font-bold'
    };

    const getStatusStyle = (status: string = '') => statusColors[status.toLowerCase()] || 'bg-gray-100 text-gray-800';
    const getPriorityStyle = (priority: string = '') => priorityColors[priority.toLowerCase()] || 'text-gray-500';

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Mesa de Ayuda</h1>
                    <p className="text-sm text-gray-500 mt-1">Soporte técnico centralizado para todos los inquilinos.</p>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-wrap gap-4 items-center">
                <div className="flex items-center gap-2">
                    <Filter size={18} className="text-gray-400" />
                    <span className="text-sm font-medium text-gray-700">Filtros:</span>
                </div>

                <select
                    className="text-sm border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                >
                    <option value="">Todos los estados</option>
                    <option value="open">Abiertos</option>
                    <option value="in_progress">En Proceso</option>
                    <option value="resolved">Resueltos</option>
                    <option value="closed">Cerrados</option>
                </select>

                <select
                    className="text-sm border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    value={filterPriority}
                    onChange={(e) => setFilterPriority(e.target.value)}
                >
                    <option value="">Todas las prioridades</option>
                    <option value="low">Baja</option>
                    <option value="medium">Media</option>
                    <option value="high">Alta</option>
                    <option value="critical">Crítica</option>
                </select>

                <div className="ml-auto text-xs text-gray-400 font-medium">
                    {tickets?.length || 0} tickets encontrados
                </div>
            </div>

            {/* Tickets Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {isLoading ? (
                    <div className="p-12 flex justify-center text-gray-400">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                    </div>
                ) : !tickets || tickets.length === 0 ? (
                    <div className="p-12 text-center text-gray-500">
                        <MessageSquare className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                        <p>No se encontraron tickets de soporte.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Empresa</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Asunto</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Prioridad</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                                    <th className="relative px-6 py-3"><span className="sr-only">Ver</span></th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {tickets.map((ticket) => (
                                    <tr key={ticket?.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className="flex-shrink-0 h-8 w-8 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
                                                    <Building size={16} />
                                                </div>
                                                <div className="ml-3">
                                                    <div className="text-sm font-medium text-gray-900">
                                                        {ticket?.tenant_id ? (tenants[ticket.tenant_id] || `ID: ${ticket.tenant_id}`) : 'Desconocido'}
                                                    </div>
                                                    <div className="text-xs text-gray-500">
                                                        {ticket?.contact_email ? (
                                                            <span className="text-blue-600 font-semibold">{ticket.contact_email}</span>
                                                        ) : (
                                                            ticket?.user_email || '-'
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-medium text-gray-900 max-w-xs truncate">{ticket?.subject || '-'}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`text-xs font-medium ${getPriorityStyle(ticket?.priority)}`}>
                                                {ticket?.priority?.toUpperCase() || '-'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusStyle(ticket?.status)}`}>
                                                {ticket?.status?.replace('_', ' ') || '-'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {ticket?.created_at ? new Date(ticket.created_at).toLocaleDateString() : '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button
                                                onClick={() => setSelectedTicket(ticket)}
                                                className="text-blue-600 hover:text-blue-900 p-2 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-200"
                                            >
                                                <Eye size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Reply Modal */}
            {selectedTicket && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true">
                    {/* Overlay */}
                    <div
                        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
                        aria-hidden="true"
                        onClick={() => setSelectedTicket(null)}
                    ></div>

                    {/* Modal Content Container */}
                    <div className="relative bg-white rounded-3xl shadow-2xl overflow-hidden transform transition-all w-full max-w-2xl flex flex-col max-h-[90vh] z-[101]">
                        <div className="flex-1 overflow-y-auto outline-none">
                            <div className="px-6 pt-6 pb-4">
                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <h3 className="text-xl font-bold text-slate-900" id="modal-title">Detalles del Ticket #{selectedTicket?.id}</h3>
                                        <p className="text-sm text-gray-500 mt-1">
                                            Empresa: <span className="font-bold text-gray-700">{selectedTicket?.tenant_id ? (tenants[selectedTicket.tenant_id] || `ID: ${selectedTicket.tenant_id}`) : '-'}</span>
                                        </p>
                                        <p className="text-xs text-gray-400 mt-0.5">
                                            Autor: {selectedTicket?.user_email || '-'}
                                            {selectedTicket?.contact_email && (
                                                <span className="ml-1 text-slate-400">
                                                    | Contacto: <span className="text-blue-600 font-bold">{selectedTicket.contact_email}</span>
                                                </span>
                                            )}
                                        </p>
                                    </div>
                                    <button onClick={() => setSelectedTicket(null)} className="text-gray-400 hover:text-gray-500">
                                        <X size={24} />
                                    </button>
                                </div>

                                <div className="space-y-6">
                                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="text-xs font-black uppercase text-gray-400 tracking-widest">Asunto</div>
                                        </div>
                                        <div className="text-lg font-bold text-gray-800">{selectedTicket?.subject || '-'}</div>
                                    </div>

                                    <div>
                                        <div className="text-xs font-black uppercase text-gray-400 tracking-widest mb-2">Descripción del Problema</div>
                                        <div className="bg-gray-50 p-4 rounded-xl text-gray-700 text-sm whitespace-pre-wrap border border-gray-100 italic">
                                            "{selectedTicket?.message || '-'}"
                                        </div>
                                    </div>

                                    {selectedTicket?.admin_response && (
                                        <div>
                                            <div className="text-xs font-black uppercase text-green-600 tracking-widest mb-2 flex items-center gap-1">
                                                <CheckCircle size={14} /> Respuesta Enviada Anteriormente
                                            </div>
                                            <div className="bg-green-50 p-4 rounded-xl text-green-800 text-sm whitespace-pre-wrap border border-green-100 font-medium">
                                                {selectedTicket.admin_response}
                                            </div>
                                        </div>
                                    )}

                                    {!selectedTicket?.admin_response && (
                                        <div className="space-y-3">
                                            <label className="text-xs font-black uppercase text-blue-600 tracking-widest">Escribir Respuesta</label>
                                            <textarea
                                                className="w-full p-4 border border-blue-200 rounded-xl bg-blue-50/30 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none text-sm min-h-[150px]"
                                                placeholder="Hola, hemos revisado el inconveniente y..."
                                                value={replyMessage}
                                                onChange={(e) => setReplyMessage(e.target.value)}
                                            ></textarea>
                                        </div>
                                    )}

                                    <div className="flex flex-wrap gap-2 pt-2 pb-2">
                                        <div className="text-xs font-medium text-gray-400 w-full mb-1">Cambiar estado rápidamente:</div>
                                        <button
                                            onClick={() => handleStatusUpdate(selectedTicket?.id || 0, 'open')}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${selectedTicket?.status?.toLowerCase() === 'open' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                                        >Pendiente</button>
                                        <button
                                            onClick={() => handleStatusUpdate(selectedTicket?.id || 0, 'in_progress')}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${selectedTicket?.status?.toLowerCase() === 'in_progress' ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                                        >En Proceso</button>
                                        <button
                                            onClick={() => handleStatusUpdate(selectedTicket?.id || 0, 'closed')}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${selectedTicket?.status?.toLowerCase() === 'closed' ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                                        >Cerrar Ticket</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="bg-slate-50 px-6 py-4 flex flex-col sm:flex-row-reverse gap-3 border-t border-slate-100">
                            {!selectedTicket?.admin_response && (
                                <button
                                    type="button"
                                    disabled={isSubmitting || !replyMessage.trim()}
                                    onClick={handleReply}
                                    className="w-full inline-flex justify-center rounded-xl border border-transparent shadow-sm px-6 py-2 bg-blue-600 text-base font-bold text-white hover:bg-blue-700 focus:outline-none sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed items-center gap-2"
                                >
                                    {isSubmitting ? 'Enviando...' : <><Send size={16} /> Enviar Respuesta y Marcar como Resuelto</>}
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => setSelectedTicket(null)}
                                className="w-full inline-flex justify-center rounded-xl border border-slate-300 shadow-sm px-6 py-2 bg-white text-base font-medium text-slate-700 hover:bg-slate-50 focus:outline-none sm:w-auto sm:text-sm"
                            >
                                Cerrar Ventana
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HelpDesk;
