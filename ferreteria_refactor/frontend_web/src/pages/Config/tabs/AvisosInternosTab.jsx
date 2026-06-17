import { useEffect, useMemo, useState } from 'react';
import { Bell, Megaphone, RefreshCw, Send, Sparkles, Trash2, AlertTriangle, Info, AlertCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import apiClient from '../../../config/axios';
import { getApiErrorMessage } from '../../../utils/apiErrors';

const levelOptions = [
    { value: 'info', label: 'Informacion', icon: Info, tone: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
    { value: 'warning', label: 'Advertencia', icon: AlertTriangle, tone: 'bg-amber-50 text-amber-700 border-amber-100' },
    { value: 'critical', label: 'Critico', icon: AlertCircle, tone: 'bg-rose-50 text-rose-700 border-rose-100' },
];

const defaultForm = {
    title: '',
    content: '',
    level: 'info',
    message_type: 'banner',
    starts_at: '',
    expires_at: '',
    is_active: true,
};

const formatDate = (value) => {
    if (!value) return 'Sin fecha';
    return new Date(value).toLocaleString('es-VE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const isActiveNow = (message) => {
    const now = Date.now();
    const startsAt = message.starts_at ? new Date(message.starts_at).getTime() : 0;
    const expiresAt = message.expires_at ? new Date(message.expires_at).getTime() : null;
    return Boolean(message.is_active && startsAt <= now && (!expiresAt || expiresAt > now));
};

const AvisosInternosTab = () => {
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState(defaultForm);

    const activeCount = useMemo(() => messages.filter(isActiveNow).length, [messages]);
    const scheduledCount = useMemo(() => messages.filter(m => m.is_active && m.starts_at && new Date(m.starts_at).getTime() > Date.now()).length, [messages]);

    const fetchMessages = async () => {
        setLoading(true);
        try {
            const response = await apiClient.get('/system/messages/internal');
            setMessages(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            toast.error(getApiErrorMessage(error, 'No se pudieron cargar los avisos internos'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchMessages(); }, []);

    const updateForm = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!form.title.trim()) return toast.error('Ingresa un titulo para el aviso');
        if (!form.content.trim()) return toast.error('Ingresa el contenido del aviso');

        setSaving(true);
        try {
            await apiClient.post('/system/messages/internal', {
                ...form,
                title: form.title.trim(),
                content: form.content.trim(),
                starts_at: form.starts_at || null,
                expires_at: form.expires_at || null,
            });
            toast.success('Aviso interno publicado');
            setForm(defaultForm);
            fetchMessages();
        } catch (error) {
            toast.error(getApiErrorMessage(error, 'No se pudo publicar el aviso'));
        } finally {
            setSaving(false);
        }
    };

    const handleDeactivate = async (message) => {
        if (!window.confirm(`Desactivar el aviso "${message.title}"?`)) return;
        try {
            await apiClient.delete(`/system/messages/internal/${message.id}`);
            toast.success('Aviso desactivado');
            fetchMessages();
        } catch (error) {
            toast.error(getApiErrorMessage(error, 'No se pudo desactivar el aviso'));
        }
    };

    const currentLevel = levelOptions.find(option => option.value === form.level) || levelOptions[0];
    const PreviewIcon = form.message_type === 'announcement' ? Sparkles : Bell;

    return (
        <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Avisos creados</p>
                    <p className="mt-2 text-3xl font-black text-slate-900">{messages.length}</p>
                </div>
                <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Activos ahora</p>
                    <p className="mt-2 text-3xl font-black text-emerald-700">{activeCount}</p>
                </div>
                <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-4 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Programados</p>
                    <p className="mt-2 text-3xl font-black text-indigo-700">{scheduledCount}</p>
                </div>
            </div>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(360px,0.55fr)]">
                <form onSubmit={handleSubmit} className="rounded-lg border border-slate-200 bg-white shadow-sm">
                    <div className="flex items-center gap-3 border-b border-slate-100 p-5">
                        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-indigo-600 text-white">
                            <Megaphone size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-slate-900">Nuevo aviso interno</h2>
                            <p className="text-xs font-semibold text-slate-500">Solo se enviara a usuarios de esta empresa.</p>
                        </div>
                    </div>

                    <div className="grid gap-4 p-5">
                        <div className="grid gap-2">
                            <label className="text-xs font-black uppercase tracking-wide text-slate-500">Tipo</label>
                            <div className="grid gap-2 sm:grid-cols-2">
                                <button type="button" onClick={() => updateForm('message_type', 'banner')} className={`rounded-md border p-3 text-left transition-colors ${form.message_type === 'banner' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                                    <Bell size={18} />
                                    <p className="mt-2 text-sm font-black">Campanita / banner</p>
                                    <p className="text-[11px] font-medium text-slate-500">Aviso rapido en navbar.</p>
                                </button>
                                <button type="button" onClick={() => updateForm('message_type', 'announcement')} className={`rounded-md border p-3 text-left transition-colors ${form.message_type === 'announcement' ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                                    <Sparkles size={18} />
                                    <p className="mt-2 text-sm font-black">Modal destacado</p>
                                    <p className="text-[11px] font-medium text-slate-500">Ideal para comunicados importantes.</p>
                                </button>
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <label className="text-xs font-black uppercase tracking-wide text-slate-500">Titulo</label>
                            <input value={form.title} onChange={e => updateForm('title', e.target.value)} className="h-11 rounded-md border border-slate-200 px-3 text-sm font-bold outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" placeholder="Ej: Reunion de inventario" />
                        </div>

                        <div className="grid gap-2">
                            <label className="text-xs font-black uppercase tracking-wide text-slate-500">Mensaje</label>
                            <textarea value={form.content} onChange={e => updateForm('content', e.target.value)} rows={5} className="rounded-md border border-slate-200 px-3 py-3 text-sm outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" placeholder="Escribe el aviso que vera tu equipo..." />
                        </div>

                        {form.message_type === 'banner' && (
                            <div className="grid gap-2">
                                <label className="text-xs font-black uppercase tracking-wide text-slate-500">Nivel</label>
                                <div className="grid gap-2 sm:grid-cols-3">
                                    {levelOptions.map(option => {
                                        const Icon = option.icon;
                                        return (
                                            <button key={option.value} type="button" onClick={() => updateForm('level', option.value)} className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-black transition-colors ${form.level === option.value ? option.tone : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                                                <Icon size={15} /> {option.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        <div className="grid gap-3 md:grid-cols-2">
                            <div className="grid gap-2">
                                <label className="text-xs font-black uppercase tracking-wide text-slate-500">Publicar desde</label>
                                <input type="datetime-local" value={form.starts_at} onChange={e => updateForm('starts_at', e.target.value)} className="h-11 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
                            </div>
                            <div className="grid gap-2">
                                <label className="text-xs font-black uppercase tracking-wide text-slate-500">Expira</label>
                                <input type="datetime-local" value={form.expires_at} onChange={e => updateForm('expires_at', e.target.value)} className="h-11 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end border-t border-slate-100 bg-slate-50 px-5 py-4">
                        <button type="submit" disabled={saving} className="inline-flex h-11 items-center gap-2 rounded-md bg-indigo-600 px-4 text-sm font-black text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-60">
                            {saving ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
                            Publicar aviso
                        </button>
                    </div>
                </form>

                <div className="space-y-5">
                    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Vista previa</p>
                        <div className={`mt-3 rounded-lg border p-4 ${form.message_type === 'announcement' ? 'border-violet-100 bg-violet-50' : currentLevel.tone}`}>
                            <div className="flex items-start gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white/80 shadow-sm">
                                    <PreviewIcon size={18} />
                                </div>
                                <div className="min-w-0">
                                    <p className="font-black text-slate-900">{form.title || 'Titulo del aviso'}</p>
                                    <p className="mt-1 whitespace-pre-line text-sm leading-6 text-slate-600">{form.content || 'El contenido del aviso aparecera aqui.'}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
                        <div className="flex items-center justify-between border-b border-slate-100 p-4">
                            <div>
                                <h3 className="font-black text-slate-900">Avisos recientes</h3>
                                <p className="text-xs font-semibold text-slate-500">Historial interno de esta empresa</p>
                            </div>
                            <button onClick={fetchMessages} className="rounded-md border border-slate-200 p-2 text-slate-500 transition-colors hover:bg-slate-50">
                                <RefreshCw size={16} />
                            </button>
                        </div>
                        <div className="max-h-[520px] overflow-y-auto p-3">
                            {loading ? (
                                <div className="flex h-32 items-center justify-center text-sm font-bold text-slate-400">Cargando avisos...</div>
                            ) : messages.length === 0 ? (
                                <div className="flex h-32 flex-col items-center justify-center text-center text-slate-400">
                                    <Bell size={28} strokeWidth={1.5} />
                                    <p className="mt-2 text-sm font-bold">No hay avisos internos</p>
                                </div>
                            ) : messages.map(message => {
                                const active = isActiveNow(message);
                                return (
                                    <div key={message.id} className="mb-2 rounded-md border border-slate-200 p-3 last:mb-0">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${active ? 'bg-emerald-100 text-emerald-700' : message.is_active ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>
                                                        {active ? 'Activo' : message.is_active ? 'Programado' : 'Inactivo'}
                                                    </span>
                                                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase text-slate-500">{message.message_type === 'announcement' ? 'Modal' : 'Banner'}</span>
                                                </div>
                                                <p className="mt-2 truncate font-black text-slate-900">{message.title}</p>
                                                <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{message.content}</p>
                                                <p className="mt-2 text-[11px] font-semibold text-slate-400">Desde {formatDate(message.starts_at)}</p>
                                            </div>
                                            {message.is_active && (
                                                <button onClick={() => handleDeactivate(message)} className="rounded-md p-2 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600" title="Desactivar">
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AvisosInternosTab;
