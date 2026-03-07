import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
    Megaphone,
    Plus,
    Trash2,
    AlertTriangle,
    Info,
    AlertCircle,
    Sparkles,
    Bell,
    X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
    getSystemMessages,
    createSystemMessage,
    deleteSystemMessage,
} from '../api/systemMessages';
import type { SystemMessage, SystemMessageCreate, MessageType } from '../api/systemMessages';

// ─── helpers ────────────────────────────────────────────────────────────────
const getLevelIcon = (level: string) => {
    switch (level) {
        case 'info':     return <Info      className="text-blue-500"   size={16} />;
        case 'warning':  return <AlertTriangle className="text-yellow-500" size={16} />;
        case 'critical': return <AlertCircle  className="text-red-500"    size={16} />;
        default:         return <Info size={16} />;
    }
};

const getLevelBadge = (level: string) => {
    switch (level) {
        case 'info':     return 'bg-blue-100   text-blue-800';
        case 'warning':  return 'bg-yellow-100 text-yellow-800';
        case 'critical': return 'bg-red-100    text-red-800';
        default:         return 'bg-gray-100   text-gray-800';
    }
};

// ─── Component ───────────────────────────────────────────────────────────────
const SystemMessages = () => {
    const [messages,     setMessages]     = useState<SystemMessage[]>([]);
    const [loading,      setLoading]      = useState(true);
    const [isModalOpen,  setIsModalOpen]  = useState(false);
    const [activeType,   setActiveType]   = useState<MessageType>('banner');

    const { register, handleSubmit, reset, watch, setValue } = useForm<SystemMessageCreate>({
        defaultValues: { level: 'info', message_type: 'banner', is_active: true },
    });

    const watchedType = watch('message_type');

    // Keep activeType tab in sync with the hidden field
    const selectType = (t: MessageType) => {
        setActiveType(t);
        setValue('message_type', t);
    };

    const loadMessages = async () => {
        try {
            setLoading(true);
            const data = await getSystemMessages();
            setMessages(data);
        } catch (err) {
            console.error(err);
            toast.error('Error al cargar mensajes');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadMessages(); }, []);

    const onSubmit = async (data: SystemMessageCreate) => {
        try {
            const cleaned: SystemMessageCreate = {
                ...data,
                starts_at   : data.starts_at   || undefined,
                expires_at  : data.expires_at  || undefined,
                version_tag : data.version_tag || undefined,
            };
            await createSystemMessage(cleaned);
            toast.success('Mensaje creado');
            setIsModalOpen(false);
            reset({ level: 'info', message_type: 'banner', is_active: true });
            setActiveType('banner');
            loadMessages();
        } catch (err) {
            console.error(err);
            toast.error('Error al crear mensaje');
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('¿Eliminar este mensaje? Dejará de mostrarse a todos los usuarios.')) return;
        try {
            await deleteSystemMessage(id);
            toast.success('Mensaje eliminado');
            loadMessages();
        } catch (err) {
            console.error(err);
            toast.error('Error al eliminar');
        }
    };

    return (
        <div className="space-y-6">

            {/* ── Header ── */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Megaphone className="text-indigo-600" /> Mensajes del Sistema
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Publica alertas de banner o modales de novedades para todos los usuarios.
                    </p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
                >
                    <Plus size={18} /> Nuevo Mensaje
                </button>
            </div>

            {/* ── Message list ── */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-gray-500">Cargando mensajes...</div>
                ) : messages.length === 0 ? (
                    <div className="p-12 text-center text-gray-500 flex flex-col items-center">
                        <Megaphone size={48} className="text-gray-200 mb-4" />
                        <p>No hay mensajes activos.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mensaje</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nivel</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Desde</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {messages.map((msg) => (
                                    <tr key={msg.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 max-w-xs">
                                            <div className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
                                                {msg.version_tag && (
                                                    <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-1.5 py-0.5 rounded">
                                                        {msg.version_tag}
                                                    </span>
                                                )}
                                                {msg.title}
                                            </div>
                                            <div className="text-xs text-gray-500 truncate mt-0.5">{msg.content}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {msg.message_type === 'announcement' ? (
                                                <span className="flex items-center gap-1 text-xs font-semibold text-violet-700 bg-violet-100 px-2 py-1 rounded-full w-fit">
                                                    <Sparkles size={12} /> Novedad
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1 text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-1 rounded-full w-fit">
                                                    <Bell size={12} /> Banner
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full items-center gap-1 ${getLevelBadge(msg.level)}`}>
                                                {getLevelIcon(msg.level)}
                                                {msg.level.toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {new Date(msg.starts_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${msg.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                                {msg.is_active ? 'Activo' : 'Inactivo'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            <button
                                                onClick={() => handleDelete(msg.id)}
                                                className="text-red-400 hover:text-red-600 transition-colors"
                                                title="Eliminar"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ── Create Modal ── */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">

                        {/* modal header */}
                        <div className="flex justify-between items-center px-6 pt-5 pb-4 border-b border-gray-100">
                            <h2 className="text-lg font-bold text-gray-900">Nuevo Mensaje Global</h2>
                            <button onClick={() => { setIsModalOpen(false); reset(); setActiveType('banner'); }} className="text-gray-400 hover:text-gray-600">
                                <X size={22} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-5 space-y-4">

                            {/* ── Type selector ── */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de mensaje</label>
                                <div className="grid grid-cols-2 gap-3">
                                    {/* Banner */}
                                    <button
                                        type="button"
                                        onClick={() => selectType('banner')}
                                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-center
                                            ${activeType === 'banner'
                                                ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                                                : 'border-gray-200 hover:border-gray-300 text-gray-600'}`}
                                    >
                                        <Bell size={20} />
                                        <span className="text-xs font-bold">Alerta de Banner</span>
                                        <span className="text-[10px] text-gray-500 leading-tight">
                                            Aparece en la esquina superior. Múltiples veces.
                                        </span>
                                    </button>
                                    {/* Announcement */}
                                    <button
                                        type="button"
                                        onClick={() => selectType('announcement')}
                                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-center
                                            ${activeType === 'announcement'
                                                ? 'border-violet-500 bg-violet-50 text-violet-700'
                                                : 'border-gray-200 hover:border-gray-300 text-gray-600'}`}
                                    >
                                        <Sparkles size={20} />
                                        <span className="text-xs font-bold">Modal de Novedad</span>
                                        <span className="text-[10px] text-gray-500 leading-tight">
                                            Modal centrado. Aparece solo una vez por usuario.
                                        </span>
                                    </button>
                                </div>
                                <input type="hidden" {...register('message_type')} />
                            </div>

                            {/* Announcement-specific: version tag hint */}
                            {watchedType === 'announcement' && (
                                <div className="bg-violet-50 border border-violet-200 rounded-lg p-3 text-xs text-violet-700 space-y-1">
                                    <p className="font-semibold">💡 Formato de contenido para lista de novedades:</p>
                                    <p className="font-mono bg-white/60 p-1.5 rounded">
                                        🔧 Título de la mejora | Descripción breve<br />
                                        📱 Otra función | Su descripción aquí
                                    </p>
                                    <p>Una función por línea. Usa <code className="bg-white/60 px-1 rounded">emoji Título | descripción</code>.</p>
                                </div>
                            )}

                            {/* Title */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Título</label>
                                <input
                                    {...register('title', { required: true })}
                                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                                    placeholder={activeType === 'announcement' ? 'Novedades de marzo 2026' : 'Mantenimiento programado'}
                                />
                            </div>

                            {/* Content */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Contenido</label>
                                <textarea
                                    {...register('content', { required: true })}
                                    rows={activeType === 'announcement' ? 5 : 3}
                                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none resize-none"
                                    placeholder={
                                        activeType === 'announcement'
                                            ? '🔧 Impresión automática | El ticket se imprime al crear una recepción\n📱 IMEI en recibos | El número de serie aparece en el recibo\n📊 Tasa BCV | Consulta la tasa oficial con un clic'
                                            : 'El sistema estará en mantenimiento el sábado 8 de marzo...'
                                    }
                                />
                            </div>

                            {/* Version tag (announcement only) */}
                            {watchedType === 'announcement' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">
                                        Etiqueta de versión <span className="text-gray-400 font-normal">(opcional)</span>
                                    </label>
                                    <input
                                        {...register('version_tag')}
                                        className="mt-1 block w-40 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none"
                                        placeholder="v2.5"
                                        maxLength={20}
                                    />
                                </div>
                            )}

                            {/* Level (banner only) */}
                            {watchedType !== 'announcement' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Nivel de alerta</label>
                                    <select
                                        {...register('level')}
                                        className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                                    >
                                        <option value="info">Información (Azul)</option>
                                        <option value="warning">Advertencia (Amarillo)</option>
                                        <option value="critical">Crítico (Rojo)</option>
                                    </select>
                                </div>
                            )}

                            {/* Start date */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Fecha de inicio <span className="text-gray-400 font-normal">(opcional)</span></label>
                                <input
                                    type="datetime-local"
                                    {...register('starts_at')}
                                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                                />
                                <p className="text-xs text-gray-400 mt-1">Dejar vacío para publicar inmediatamente.</p>
                            </div>

                            {/* Footer */}
                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => { setIsModalOpen(false); reset(); setActiveType('banner'); }}
                                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors
                                        ${activeType === 'announcement'
                                            ? 'bg-violet-600 hover:bg-violet-700'
                                            : 'bg-indigo-600 hover:bg-indigo-700'}`}
                                >
                                    Publicar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SystemMessages;
