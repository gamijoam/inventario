import api from './axios';

export interface SystemMessage {
    id: number;
    title: string;
    content: string;
    level: 'info' | 'warning' | 'critical';
    starts_at: string;
    expires_at?: string;
    is_active: boolean;
    created_at: string;
}

export interface SystemMessageCreate {
    title: string;
    content: string;
    level: 'info' | 'warning' | 'critical';
    starts_at?: string;
    expires_at?: string;
    is_active?: boolean;
}

export interface SystemMessageUpdate {
    title?: string;
    content?: string;
    is_active?: boolean;
}

export const getSystemMessages = async (): Promise<SystemMessage[]> => {
    const response = await api.get('/admin/messages');
    return response.data;
};

export const createSystemMessage = async (data: SystemMessageCreate): Promise<SystemMessage> => {
    const response = await api.post('/admin/messages', data);
    return response.data;
};

export const updateSystemMessage = async (id: number, data: SystemMessageUpdate): Promise<SystemMessage> => {
    const response = await api.put(`/admin/messages/${id}`, data);
    return response.data;
};

export const deleteSystemMessage = async (id: number): Promise<void> => {
    await api.delete(`/admin/messages/${id}`);
};
