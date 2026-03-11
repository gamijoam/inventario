import axios from './axios';

export interface SupportTicket {
    id: number;
    tenant_id: number;
    user_email: string;
    contact_email?: string;
    subject: string;
    message: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    status: 'open' | 'in_progress' | 'resolved' | 'closed';
    admin_response: string | null;
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
