import React, { useState, useEffect } from 'react';
import { Plus, Loader2, CheckSquare } from 'lucide-react';
import { getTasks, deleteTask, toggleTaskCompletion } from '../api/adminTasks';
import type { AdminTask } from '../api/adminTasks';
import CreateTaskModal from '../components/reminders/CreateTaskModal';
import TaskCard from '../components/reminders/TaskCard';
import toast from 'react-hot-toast';

const RemindersPage: React.FC = () => {
    const [tasks, setTasks] = useState<AdminTask[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<'pending' | 'completed' | 'all'>('pending');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    const fetchTasks = async () => {
        setIsLoading(true);
        try {
            const params = filterStatus !== 'all' ? { status_filter: filterStatus } : {};
            const data = await getTasks(params);
            setTasks(data);
        } catch (error) {
            console.error(error);
            toast.error('Error al cargar tareas');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchTasks();
    }, [filterStatus]);

    const handleCreateSuccess = () => {
        fetchTasks();
    };

    const handleToggleTask = async (task: AdminTask) => {
        try {
            // Optimistic update
            const updatedTasks = tasks.map(t =>
                t.id === task.id ? { ...t, is_completed: !t.is_completed } : t
            );

            // If filtering by pending/completed, usually item disappears. 
            // For better UX, let's keep it for a moment or just refresh list if we want standard behavior.
            // But if we toggle completion in "Pending" view, it should verify with backend.

            setTasks(updatedTasks);

            await toggleTaskCompletion(task);

            // If viewing specific list, maybe refresh to remove it or re-sort
            if (filterStatus !== 'all') {
                // Wait a bit or let user see the change
                // For now, let's refresh to be consistent with backend sorting order
                fetchTasks();
            } else {
                // If viewing all, keeping optimistic update is fine but re-fetch ensures consistency
            }

        } catch (error) {
            console.error(error);
            toast.error('Error al actualizar tarea');
            fetchTasks(); // Revert
        }
    };

    const handleDeleteTask = async (id: number) => {
        if (!window.confirm('¿Estás seguro de eliminar esta tarea?')) return;

        try {
            await deleteTask(id);
            setTasks(prev => prev.filter(t => t.id !== id));
            toast.success('Tarea eliminada');
        } catch (error) {
            console.error(error);
            toast.error('Error al eliminar tarea');
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <CheckSquare className="w-8 h-8 text-blue-600" />
                        Mis Recordatorios
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Gestiona tus tareas pendientes y notas rápidas.
                    </p>
                </div>
                <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-900/20"
                >
                    <Plus className="w-5 h-5 mr-2" />
                    Nueva Tarea
                </button>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2 border-b border-gray-200 pb-1">
                <button
                    onClick={() => setFilterStatus('pending')}
                    className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors relative top-[1px] ${filterStatus === 'pending'
                        ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                        }`}
                >
                    Pendientes
                </button>
                <button
                    onClick={() => setFilterStatus('completed')}
                    className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors relative top-[1px] ${filterStatus === 'completed'
                        ? 'text-green-600 border-b-2 border-green-600 bg-green-50/50'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                        }`}
                >
                    Completados
                </button>
                <button
                    onClick={() => setFilterStatus('all')}
                    className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors relative top-[1px] ${filterStatus === 'all'
                        ? 'text-gray-900 border-b-2 border-gray-900 bg-gray-100'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                        }`}
                >
                    Todos
                </button>
            </div>

            {/* Content */}
            {isLoading ? (
                <div className="flex justify-center items-center py-20">
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                </div>
            ) : tasks.length === 0 ? (
                <div className="text-center py-20 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                    <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                        <CheckSquare className="w-6 h-6 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900">No hay tareas</h3>
                    <p className="text-gray-500 mt-1">
                        {filterStatus === 'pending'
                            ? '¡Todo al día! No tienes tareas pendientes.'
                            : 'No se encontraron tareas en esta vista.'}
                    </p>
                    {filterStatus === 'pending' && (
                        <button
                            onClick={() => setIsCreateModalOpen(true)}
                            className="mt-4 text-blue-600 font-medium hover:underline"
                        >
                            Crear una nueva tarea
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {tasks.map(task => (
                        <TaskCard
                            key={task.id}
                            task={task}
                            onToggle={handleToggleTask}
                            onDelete={handleDeleteTask}
                        />
                    ))}
                </div>
            )}

            <CreateTaskModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSuccess={handleCreateSuccess}
            />
        </div>
    );
};

export default RemindersPage;
