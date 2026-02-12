import React from 'react';
import { CheckCircle2, Circle, Clock, Trash2, AlertTriangle, Calendar } from 'lucide-react';
import type { AdminTask } from '../../api/adminTasks';

interface TaskCardProps {
    task: AdminTask;
    onToggle: (task: AdminTask) => void;
    onDelete: (id: number) => void;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, onToggle, onDelete }) => {

    // Priority Colors
    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'high': return 'text-red-600 bg-red-50 border-red-100';
            case 'medium': return 'text-orange-600 bg-orange-50 border-orange-100';
            case 'low': return 'text-blue-600 bg-blue-50 border-blue-100';
            default: return 'text-gray-600 bg-gray-50 border-gray-100';
        }
    };

    // Format Date Helper (fallback to Intl if date-fns not available, but user has it?)
    // User has `date-fns`? I haven't checked package.json. I'll use Intl for safety.
    const formatDate = (dateString?: string) => {
        if (!dateString) return null;
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('es-ES', {
            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
        }).format(date);
    };

    return (
        <div className={`group relative bg-white border rounded-xl p-4 transition-all duration-200 hover:shadow-md ${task.is_completed ? 'opacity-60 bg-gray-50' : 'border-gray-100'}`}>

            <div className="flex items-start justify-between gap-3">
                {/* Checkbox / Status */}
                <button
                    onClick={() => onToggle(task)}
                    className={`mt-0.5 flex-shrink-0 transition-colors ${task.is_completed ? 'text-green-500' : 'text-gray-300 hover:text-blue-500'}`}
                >
                    {task.is_completed ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                        <h4 className={`font-medium text-gray-900 leading-snug ${task.is_completed ? 'line-through text-gray-500' : ''}`}>
                            {task.title}
                        </h4>
                    </div>

                    {task.description && (
                        <p className={`text-sm text-gray-500 line-clamp-3 ${task.is_completed ? 'line-through' : ''}`}>
                            {task.description}
                        </p>
                    )}

                    {/* Metadata Badges */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                        {/* Priority Badge */}
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getPriorityColor(task.priority)}`}>
                            {task.priority === 'high' && <AlertTriangle className="w-3 h-3 mr-1" />}
                            {task.priority === 'medium' && <Clock className="w-3 h-3 mr-1" />}
                            {task.priority === 'low' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                            {task.priority === 'high' ? 'Alta' : task.priority === 'medium' ? 'Media' : 'Baja'}
                        </span>

                        {/* Due Date */}
                        {task.due_date && (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border text-gray-600 bg-gray-50 border-gray-100`}>
                                <Calendar className="w-3 h-3 mr-1 text-gray-400" />
                                {formatDate(task.due_date)}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Actions (Hover) */}
            <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                    onClick={() => onDelete(task.id)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

export default TaskCard;
