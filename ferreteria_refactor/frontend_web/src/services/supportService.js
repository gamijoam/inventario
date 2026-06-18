import apiClient from '../config/axios';

const LAST_VISIT_KEY = 'support_last_visit';

const supportService = {
    createTicket: async (ticketData) => {
        const response = await apiClient.post('/support/tickets/', ticketData);
        return response.data;
    },

    getTicketMessages: async (ticketId) => {
        const response = await apiClient.get(`/support/tickets/${ticketId}/messages`);
        return response.data;
    },

    sendMessage: async (ticketId, { message = '', file = null }) => {
        const formData = new FormData();
        formData.append('message', message || '');
        if (file) formData.append('file', file);
        const response = await apiClient.post(`/support/tickets/${ticketId}/messages`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    },

    getMyTickets: async () => {
        const response = await apiClient.get('/support/tickets/');
        return response.data;
    },

    /**
     * Get count of tickets with admin responses since last visit.
     * Used for the notification badge in the Sidebar.
     */
    getUnreadCount: async () => {
        const since = localStorage.getItem(LAST_VISIT_KEY);
        const params = since ? { since } : {};
        const response = await apiClient.get('/support/tickets/unread-count', { params, _silentNetworkError: true });
        return response.data.count;
    },

    getUnreadTickets: async () => {
        const response = await apiClient.get('/support/tickets/unread', { _silentNetworkError: true });
        return Array.isArray(response.data) ? response.data : [];
    },

    markTicketRead: async (ticketId) => {
        if (!ticketId) return null;
        const response = await apiClient.post(`/support/tickets/${ticketId}/read`, {}, { _silentNetworkError: true });
        return response.data;
    },

    /**
     * Legacy local marker kept for old flows; backend read state is authoritative now.
     */
    markAsRead: () => {
        localStorage.setItem(LAST_VISIT_KEY, new Date().toISOString());
    }
};

export default supportService;
