import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { X, Calendar, AlertTriangle } from 'lucide-react';
import { createTask } from '../../api/adminTasks';
import type { CreateTaskDTO } from '../../api/adminTasks';
import toast from 'react-hot-toast';

interface CreateTaskModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const CreateTaskModal: React.FC<CreateTaskModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const [isLoading, setIsLoading] = useState(false);
    const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateTaskDTO>({
        defaultValues: {
            priority: 'medium',
            is_completed: false
        }
    });

    if (!isOpen) return null;

    const onSubmit = async (data: CreateTaskDTO) => {
        setIsLoading(true);
        try {
            // Sanitize payload
            const payload = {
                ...data,
                due_date: data.due_date ? data.due_date : null,
                priority: data.priority || 'medium'
            };

            await createTask(payload as CreateTaskDTO);
            toast.success('Tarea creada exitosamente');
            reset();
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error(error);
            toast.error('Error al crear la tarea');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="text-lg font-semibold text-gray-800">Nueva Tarea</h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-200 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">

                    {/* Title */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
                        <input
                            {...register('title', { required: 'El título es obligatorio' })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            placeholder="Ej: Revisar logs del servidor"
                            autoFocus
                        />
                        {errors.title && <span className="text-xs text-red-500">{errors.title.message}</span>}
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Descripción (Opcional)</label>
                        <textarea
                            {...register('description')}
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none"
                            placeholder="Detalles adicionales..."
                        />
                    </div>

                    {/* Meta Row */}
                    <div className="grid grid-cols-2 gap-4">
                        {/* Priority */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Prioridad</label>
                            <div className="relative">
                                <select
                                    {...register('priority')}
                                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none appearance-none bg-white"
                                >
                                    <option value="low">Baja</option>
                                    <option value="medium">Media</option>
                                    <option value="high">Alta</option>
                                </select>
                                <AlertTriangle className="w-4 h-4 text-gray-400 absolute left-3 top-2.5 pointer-events-none" />
                            </div>
                        </div>

                        {/* Due Date */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Límite</label>
                            <div className="relative">
                                <input
                                    type="datetime-local"
                                    {...register('due_date')}
                                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                                <Calendar className="w-4 h-4 text-gray-400 absolute left-3 top-2.5 pointer-events-none" />
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-4 mt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? 'Creando...' : 'Crear Tarea'}
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
};

export default CreateTaskModal;
