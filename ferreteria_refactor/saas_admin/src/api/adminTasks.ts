import axios from './axios';

export type TaskPriority = 'low' | 'medium' | 'high';

export interface AdminTask {
    id: number;
    title: string;
    description?: string;
    is_completed: boolean;
    priority: TaskPriority;
    due_date?: string;
    created_by_id?: number;
    created_at: string;
    updated_at: string;
}

export interface CreateTaskDTO {
    title: string;
    description?: string | null;
    priority?: TaskPriority;
    due_date?: string | Date | null;
    is_completed?: boolean;
}

export interface UpdateTaskDTO {
    title?: string;
    description?: string | null;
    priority?: TaskPriority;
    due_date?: string | Date | null;
    is_completed?: boolean;
}

export const getTasks = async (params?: { status_filter?: 'completed' | 'pending'; priority?: TaskPriority }): Promise<AdminTask[]> => {
    const response = await axios.get('/admin/tasks/', { params });
    return response.data;
};

export const createTask = async (data: CreateTaskDTO): Promise<AdminTask> => {
    const response = await axios.post('/admin/tasks/', data);
    return response.data;
};

export const updateTask = async (id: number, data: UpdateTaskDTO): Promise<AdminTask> => {
    const response = await axios.patch(`/admin/tasks/${id}`, data);
    return response.data;
};

export const deleteTask = async (id: number): Promise<void> => {
    await axios.delete(`/admin/tasks/${id}`);
};

export const toggleTaskCompletion = async (task: AdminTask): Promise<AdminTask> => {
    return updateTask(task.id, { is_completed: !task.is_completed });
};
