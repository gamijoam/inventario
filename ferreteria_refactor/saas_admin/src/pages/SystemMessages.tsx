import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
    Megaphone,
    Plus,
    Trash2,
    AlertTriangle,
    Info,
    AlertCircle,
    X
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
    getSystemMessages,
    createSystemMessage,
    deleteSystemMessage,
} from '../api/systemMessages';
import type { SystemMessage, SystemMessageCreate } from '../api/systemMessages';

const SystemMessages = () => {
    const [messages, setMessages] = useState<SystemMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const { register, handleSubmit, reset } = useForm<SystemMessageCreate>();

    const loadMessages = async () => {
        try {
            setLoading(true);
            const data = await getSystemMessages();
            setMessages(data);
        } catch (error) {
            console.error(error);
            toast.error('Error al cargar mensajes');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadMessages();
    }, []);

    const onSubmit = async (data: SystemMessageCreate) => {
        try {
            // Limpiar datos: si las fechas son strings vacíos, pasarlos como undefined
            const cleanedData = {
                ...data,
                starts_at: data.starts_at || undefined,
                expires_at: data.expires_at || undefined,
            };
            await createSystemMessage(cleanedData);
            toast.success('Mensaje creado exitosamente');
            setIsModalOpen(false);
            reset();
            loadMessages();
        } catch (error) {
            console.error(error);
            toast.error('Error al crear mensaje');
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('¿Estás seguro de eliminar este mensaje? Dejará de ser visible para todos.')) return;
        try {
            await deleteSystemMessage(id);
            toast.success('Mensaje eliminado');
            loadMessages();
        } catch (error) {
            console.error(error);
            toast.error('Error al eliminar mensaje');
        }
    };

    const getLevelIcon = (level: string) => {
        switch (level) {
            case 'info': return <Info className="text-blue-500" size={20} />;
            case 'warning': return <AlertTriangle className="text-yellow-500" size={20} />;
            case 'critical': return <AlertCircle className="text-red-500" size={20} />;
            default: return <Info size={20} />;
        }
    };

    const getLevelColor = (level: string) => {
        switch (level) {
            case 'info': return 'bg-blue-100 text-blue-800';
            case 'warning': return 'bg-yellow-100 text-yellow-800';
            case 'critical': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Megaphone className="text-indigo-600" /> Mensajes del Sistema
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Publica anuncios globales para todos los usuarios.
                    </p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
                >
                    <Plus size={18} /> Nuevo Mensaje
                </button>
            </div>

            {/* List */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-gray-500">Cargando mensajes...</div>
                ) : messages.length === 0 ? (
                    <div className="p-12 text-center text-gray-500 flex flex-col items-center">
                        <Megaphone size={48} className="text-gray-200 mb-4" />
                        <p>No hay mensajes activos actualmente.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mensaje</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nivel</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Desde</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {messages.map((msg) => (
                                    <tr key={msg.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-medium text-gray-900">{msg.title}</div>
                                            <div className="text-sm text-gray-500 truncate max-w-md">{msg.content}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full items-center gap-1 ${getLevelColor(msg.level)}`}>
                                                {getLevelIcon(msg.level)}
                                                {msg.level.toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {new Date(msg.starts_at).toLocaleDateString()}
                                            {msg.starts_at && <div className="text-xs text-gray-400">{new Date(msg.starts_at).toLocaleTimeString()}</div>}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${msg.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                                {msg.is_active ? 'Activo' : 'Inactivo'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button
                                                onClick={() => handleDelete(msg.id)}
                                                className="text-red-600 hover:text-red-900"
                                                title="Eliminar"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Create Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-gray-900">Nuevo Mensaje Global</h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Título</label>
                                <input
                                    {...register('title', { required: true })}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                                    placeholder="Ej: Mantenimiento Programado"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">Contenido</label>
                                <textarea
                                    {...register('content', { required: true })}
                                    rows={3}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                                    placeholder="El sistema estará en mantenimiento el..."
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">Nivel de Alerta</label>
                                <select
                                    {...register('level')}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                                >
                                    <option value="info">Información (Azul)</option>
                                    <option value="warning">Advertencia (Amarillo)</option>
                                    <option value="critical">Crítico (Rojo)</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">Fecha de Inicio (Opcional)</label>
                                <input
                                    type="datetime-local"
                                    {...register('starts_at')}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                                />
                                <p className="text-xs text-gray-500 mt-1">Dejar vacío para publicar inmediatamente.</p>
                            </div>

                            <div className="pt-4 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
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
