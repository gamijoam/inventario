import axios from './axios';

export interface SupportAttachment {
    id: number;
    ticket_id: number;
    message_id: number;
    original_filename: string;
    stored_url: string;
    content_type?: string | null;
    file_size?: number | null;
    created_at: string;
}

export interface SupportMessage {
    id: number;
    ticket_id: number;
    sender_type: 'user' | 'admin' | 'system';
    sender_email?: string | null;
    message: string;
    is_internal: boolean;
    created_at: string;
    attachments: SupportAttachment[];
}

export interface SupportTicket {
    id: number;
    tenant_id: number | null;
    user_email: string;
    contact_email?: string;
    phone?: string;
    full_name?: string;
    subject: string;
    message: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    status: 'open' | 'in_progress' | 'resolved' | 'closed';
    admin_response: string | null;
    last_message_at?: string | null;
    last_message_sender?: string | null;
    user_last_read_at?: string | null;
    admin_last_read_at?: string | null;
    unread_for_user?: boolean;
    unread_for_admin?: boolean;
    created_at: string;
    updated_at: string;
}

export const getAllTickets = async (params?: { status?: string, priority?: string }): Promise<SupportTicket[]> => {
    const response = await axios.get('/admin/support/tickets/', { params });
    return response.data;
};

export const replyToTicket = async (id: number, admin_response: string, status: string = 'resolved'): Promise<SupportTicket> => {
    const response = await axios.patch(`/admin/support/tickets/${id}/reply`, { admin_response, status });
    return response.data;
};

export const getTicketMessages = async (id: number): Promise<SupportMessage[]> => {
    const response = await axios.get(`/admin/support/tickets/${id}/messages`);
    return response.data;
};

export const sendTicketMessage = async (id: number, message: string): Promise<SupportMessage> => {
    const formData = new FormData();
    formData.append('message', message);
    const response = await axios.post(`/admin/support/tickets/${id}/messages`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
};

export const updateTicketStatus = async (id: number, status: string): Promise<SupportTicket> => {
    const response = await axios.patch(`/admin/support/tickets/${id}`, { status });
    return response.data;
};

/**
 * Get count of tickets pending admin attention (open or in_progress).
 * Used for the notification badge in the admin sidebar.
 */
export const getPendingCount = async (): Promise<number> => {
    const response = await axios.get('/admin/support/tickets/pending-count');
    return response.data.count;
};
